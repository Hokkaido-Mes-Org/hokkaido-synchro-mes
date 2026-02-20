/**
 * HokkaidoMES — Active Downtimes Live Service
 * Fase 4B — Nível 3.2: onSnapshot compartilhado para active_downtimes
 *
 * Substitui TODOS os pollings de active_downtimes por um único listener
 * Firestore onSnapshot que atualiza dados em tempo real.
 *
 * Economia estimada: ~97% das leituras de active_downtimes
 * - Polling anterior: ~17.280 leituras/dia (26 docs × 288 polls)
 * - onSnapshot: ~26 leituras iniciais + ~500 deltas/dia
 *
 * Integra com: DataStore, CacheManager, StateManager, EventBus
 */

import { getDb } from './firebase-client.js';
import { EventBus } from '../core/event-bus.js';

class ActiveDowntimesLiveService {
    constructor() {
        /** @type {Array<Object>} Dados atuais dos docs */
        this._data = [];
        /** @type {Map<string, Object>} Índice por machineId */
        this._byMachine = new Map();
        /** @type {Array<Function>} Callbacks registrados */
        this._subscribers = [];
        /** @type {Function|null} Unsub do Firestore */
        this._unsubscribe = null;
        /** @type {boolean} Se está ativo */
        this._active = false;
        /** @type {number} Timestamp do último update */
        this._lastUpdate = 0;
        /** @type {number} Contador de snapshots recebidos */
        this._snapshotCount = 0;
        /** @type {number} Contador de docs atualizados (deltas) */
        this._deltaCount = 0;
        /** @type {boolean} Se está pausado por visibilitychange */
        this._paused = false;
    }

    /**
     * Inicia o listener onSnapshot na coleção active_downtimes.
     * Idempotente — chamadas subsequentes são ignoradas.
     */
    start() {
        if (this._unsubscribe) {
            console.debug('[ActiveDowntimesLive] Já ativo, ignorando start()');
            return;
        }

        const db = getDb();
        if (!db) {
            console.warn('[ActiveDowntimesLive] Firestore não disponível');
            return;
        }

        console.log('[ActiveDowntimesLive] Iniciando onSnapshot compartilhado...');

        this._unsubscribe = db.collection('active_downtimes')
            .onSnapshot({ includeMetadataChanges: true }, (snapshot) => {
                try {
                    // Ação 3.4: Ignorar eventos do cache local na reconexão
                    if (snapshot.metadata.fromCache && this._snapshotCount > 0) {
                        console.debug('[ActiveDowntimesLive] Snapshot do cache local (ignorando)');
                        return;
                    }

                    this._snapshotCount++;
                    this._lastUpdate = Date.now();

                    // Contar deltas (docs que realmente mudaram)
                    const changes = snapshot.docChanges();
                    this._deltaCount += changes.length;

                    // Mapear dados
                    this._data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    this._byMachine.clear();
                    this._data.forEach(d => {
                        const id = this._normalizeId(d.id);
                        this._byMachine.set(id, d);
                    });

                    // Sincronizar com DataStore (legado)
                    if (window.DataStore) {
                        window.DataStore.set('activeDowntimes', this._data);
                    }

                    // Sincronizar com CacheManager (legado)
                    if (window.CacheManager) {
                        window.CacheManager.set('active_downtimes', this._data, 300000);
                    }

                    // Emitir evento no EventBus
                    EventBus.emit('active_downtimes:updated', {
                        data: this._data,
                        changes: changes.map(c => ({
                            type: c.type, // 'added', 'modified', 'removed'
                            id: c.doc.id,
                            data: c.type !== 'removed' ? { id: c.doc.id, ...c.doc.data() } : null
                        }))
                    });

                    // Track no FirebaseMonitor
                    if (window.FirebaseMonitor) {
                        // onSnapshot: primeira leitura = N docs, deltas = apenas docs alterados
                        if (this._snapshotCount === 1) {
                            window.FirebaseMonitor.trackRead('active_downtimes', false, this._data.length);
                        } else {
                            window.FirebaseMonitor.trackRead('active_downtimes', false, changes.length);
                        }
                    }

                    console.debug(`[ActiveDowntimesLive] Snapshot #${this._snapshotCount}: ${this._data.length} docs, ${changes.length} changes`);

                    // Notificar subscribers
                    this._notifySubscribers();

                } catch (error) {
                    console.error('[ActiveDowntimesLive] Erro ao processar snapshot:', error);
                }
            }, (error) => {
                console.error('[ActiveDowntimesLive] Erro no listener:', error.message);
                // Tentar restart após 30s
                this._unsubscribe = null;
                this._active = false;
                setTimeout(() => this.start(), 30000);
            });

        this._active = true;

        // Gerenciar visibilidade — pausar/retomar o listener
        this._setupVisibility();
    }

    /**
     * Para o listener onSnapshot.
     */
    stop() {
        if (this._unsubscribe) {
            this._unsubscribe();
            this._unsubscribe = null;
            this._active = false;
            console.log('[ActiveDowntimesLive] Listener parado');
        }
    }

    /**
     * Retorna todos os dados atuais (sem leitura Firebase).
     * @returns {Array<Object>} Lista de paradas ativas
     */
    getData() {
        return this._data;
    }

    /**
     * Retorna dados de uma máquina específica (sem leitura Firebase).
     * @param {string} machineId - ID da máquina (ex: 'H01')
     * @returns {Object|null} Dados da parada ativa ou null
     */
    getForMachine(machineId) {
        if (!machineId) return null;
        const id = this._normalizeId(machineId);
        return this._byMachine.get(id) || null;
    }

    /**
     * Verifica se há dados disponíveis (listener ativo e com pelo menos 1 snapshot recebido).
     * @returns {boolean}
     */
    hasData() {
        return this._snapshotCount > 0;
    }

    /**
     * Verifica se o listener está ativo.
     * @returns {boolean}
     */
    isActive() {
        return this._active;
    }

    /**
     * Registra um callback para receber updates em tempo real.
     * Se já há dados, chama o callback imediatamente.
     * @param {Function} fn - fn(data: Array, changes: Array)
     * @returns {Function} Função para remover a subscription
     */
    subscribe(fn) {
        this._subscribers.push(fn);
        // Entrega imediata se já tem dados
        if (this._data.length > 0 || this._snapshotCount > 0) {
            try { fn(this._data, []); } catch (e) { console.error('[ActiveDowntimesLive] Subscriber error:', e); }
        }
        return () => {
            this._subscribers = this._subscribers.filter(s => s !== fn);
        };
    }

    /**
     * Retorna estatísticas do serviço.
     * @returns {Object}
     */
    stats() {
        return {
            active: this._active,
            paused: this._paused,
            docs: this._data.length,
            snapshots: this._snapshotCount,
            deltas: this._deltaCount,
            subscribers: this._subscribers.length,
            lastUpdate: this._lastUpdate,
            avgDeltasPerSnapshot: this._snapshotCount > 1
                ? (this._deltaCount / (this._snapshotCount - 1)).toFixed(1)
                : '—'
        };
    }

    // ── Internos ──────────────────────────────────

    _normalizeId(id) {
        if (!id) return '';
        const str = String(id).trim().toUpperCase().replace(/[\s_-]/g, '');
        const match = str.match(/^([A-Z]+)(\d{1,2})$/);
        if (match) return `${match[1]}${match[2].padStart(2, '0')}`;
        return str;
    }

    _notifySubscribers() {
        for (const fn of this._subscribers) {
            try {
                fn(this._data);
            } catch (error) {
                console.error('[ActiveDowntimesLive] Subscriber error:', error);
            }
        }
    }

    _setupVisibility() {
        if (this._visibilityHandler) return; // Já registrado

        this._visibilityHandler = () => {
            if (document.hidden) {
                // Pausar para economizar bandwidth enquanto aba não está visível
                if (this._unsubscribe && !this._paused) {
                    console.debug('[ActiveDowntimesLive] Aba oculta — pausando listener');
                    this._unsubscribe();
                    this._unsubscribe = null;
                    this._paused = true;
                }
            } else {
                // Retomar quando aba voltar
                if (this._paused) {
                    console.debug('[ActiveDowntimesLive] Aba visível — retomando listener');
                    this._paused = false;
                    this.start();
                }
            }
        };

        document.addEventListener('visibilitychange', this._visibilityHandler);
    }
}

// Singleton
const activeDowntimesLive = new ActiveDowntimesLiveService();

// Expor globalmente para legado
window.activeDowntimesLive = activeDowntimesLive;

export { activeDowntimesLive, ActiveDowntimesLiveService };
