/**
 * HokkaidoMES — Base Service (Classe Abstrata)
 * Fase 1: Fundação Modular
 * 
 * Toda interação com uma coleção Firestore deve herdar desta classe.
 * Oferece: CRUD com cache automático, listeners gerenciados, invalidação centralizada.
 * 
 * Uso:
 *   import { BaseService } from './base.service.js';
 *   
 *   class MyService extends BaseService {
 *       constructor() {
 *           super('my_collection', { cacheTTL: 60000 });
 *       }
 *   }
 */

import { getDb, serverTimestamp, createBatch } from './firebase-client.js';
import { stateManager } from '../core/state-manager.js';
import { EventBus } from '../core/event-bus.js';

export class BaseService {
    /** @type {string} Nome da coleção Firestore */
    collection;

    /** @type {number} TTL do cache in-memory em ms */
    cacheTTL;

    /** @type {Map<string, {data: *, ts: number}>} Cache in-memory */
    _cache;

    /** @type {Map<string, Function>} Listeners Firestore ativos (name → unsubscribe fn) */
    _listeners;

    /**
     * @param {string} collectionName - Nome da coleção Firestore
     * @param {Object} [options]
     * @param {number} [options.cacheTTL=60000] - TTL do cache em ms (padrão: 1 min)
     */
    constructor(collectionName, options = {}) {
        this.collection = collectionName;
        this.cacheTTL = options.cacheTTL || 60000;
        this._cache = new Map();
        this._listeners = new Map();
    }

    // ────────────────────────────────────────────────
    //  READ Operations
    // ────────────────────────────────────────────────

    /**
     * Busca todos os documentos da coleção, com filtros opcionais.
     * Cache-first: retorna do cache se ainda fresco.
     * 
     * @param {Object} [filters={}] - Filtros Firestore
     * @param {Array<[string, string, *]>} [filters.where] - Condições where
     * @param {{field: string, direction?: string}} [filters.orderBy] - Ordenação
     * @param {number} [filters.limit] - Limite de documentos
     * @param {boolean} [forceRefresh=false] - Ignorar cache
     * @returns {Promise<Array<Object>>}
     */
    async getAll(filters = {}, forceRefresh = false) {
        const cacheKey = this._buildKey(filters);

        // Cache-first
        if (!forceRefresh) {
            const cached = this._getFromCache(cacheKey);
            if (cached !== null) {
                this._trackRead(true);
                return cached;
            }
        }

        // Fetch do Firestore
        const data = await this._fetchFromFirestore(filters);
        this._setCache(cacheKey, data);
        this._trackRead(false);

        // Sincronizar com StateManager (para chave padrão = sem filtros)
        if (Object.keys(filters).length === 0) {
            stateManager.set(this.collection, data);
        }

        return data;
    }

    /**
     * Busca um documento por ID.
     * Tenta cache primeiro, fallback para Firestore.
     * 
     * @param {string} id - ID do documento
     * @returns {Promise<Object|null>}
     */
    async getById(id) {
        // Tentar encontrar no cache geral
        const allCacheKey = this._buildKey({});
        const allData = this._getFromCache(allCacheKey);
        if (allData) {
            const item = allData.find(d => d.id === id);
            if (item) {
                this._trackRead(true);
                return item;
            }
        }

        // Fallback: read individual
        try {
            const db = getDb();
            const doc = await db.collection(this.collection).doc(id).get();
            this._trackRead(false);
            return doc.exists ? { id: doc.id, ...doc.data() } : null;
        } catch (error) {
            console.error(`[${this.collection}] Erro ao buscar doc ${id}:`, error);
            return null;
        }
    }

    // ────────────────────────────────────────────────
    //  WRITE Operations (auto-invalidam cache)
    // ────────────────────────────────────────────────

    /**
     * Cria um novo documento.
     * @param {Object} data - Dados do documento
     * @returns {Promise<string>} ID do documento criado
     */
    async create(data) {
        const db = getDb();
        const ref = await db.collection(this.collection).add({
            ...data,
            createdAt: serverTimestamp()
        });
        
        this.invalidateCache();
        EventBus.emit(`${this.collection}:created`, { id: ref.id, ...data });
        console.log(`[${this.collection}] Criado: ${ref.id}`);
        return ref.id;
    }

    /**
     * Atualiza um documento existente.
     * @param {string} id - ID do documento
     * @param {Object} data - Campos a atualizar
     * @returns {Promise<void>}
     */
    async update(id, data) {
        const db = getDb();
        await db.collection(this.collection).doc(id).update({
            ...data,
            updatedAt: serverTimestamp()
        });
        
        this.invalidateCache();
        EventBus.emit(`${this.collection}:updated`, { id, ...data });
        console.log(`[${this.collection}] Atualizado: ${id}`);
    }

    /**
     * Deleta um documento.
     * @param {string} id - ID do documento
     * @returns {Promise<void>}
     */
    async delete(id) {
        const db = getDb();
        await db.collection(this.collection).doc(id).delete();
        
        this.invalidateCache();
        EventBus.emit(`${this.collection}:deleted`, { id });
        console.log(`[${this.collection}] Deletado: ${id}`);
    }

    /**
     * Deleta múltiplos documentos em batch.
     * @param {Array<string>} ids - IDs dos documentos
     * @returns {Promise<number>} Quantidade deletada
     */
    async deleteMany(ids) {
        if (!ids || ids.length === 0) return 0;

        const db = getDb();
        // Firestore limita batches a 500 operações
        const chunks = [];
        for (let i = 0; i < ids.length; i += 500) {
            chunks.push(ids.slice(i, i + 500));
        }

        for (const chunk of chunks) {
            const batch = createBatch();
            for (const id of chunk) {
                batch.delete(db.collection(this.collection).doc(id));
            }
            await batch.commit();
        }

        this.invalidateCache();
        EventBus.emit(`${this.collection}:deletedMany`, { count: ids.length, ids });
        console.log(`[${this.collection}] Batch delete: ${ids.length} docs`);
        return ids.length;
    }

    // ────────────────────────────────────────────────
    //  LISTENER Operations (onSnapshot gerenciado)
    // ────────────────────────────────────────────────

    /**
     * Registra um listener onSnapshot para a coleção.
     * Gerencia o ciclo de vida automaticamente.
     * 
     * @param {string} name - Nome único do listener
     * @param {Function|null} queryModifier - Função que modifica a query (ou null)
     * @param {Function} callback - Chamada a cada atualização com Array<Object>
     * @returns {Function} Função para cancelar o listener
     */
    subscribe(name, queryModifier, callback) {
        this.unsubscribe(name);

        try {
            const db = getDb();
            let query = db.collection(this.collection);
            if (queryModifier) {
                query = queryModifier(query);
            }

            const unsub = query.onSnapshot(
                (snapshot) => {
                    const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                    
                    // Atualizar cache e state
                    const cacheKey = this._buildKey({});
                    this._setCache(cacheKey, data);
                    stateManager.set(this.collection, data);
                    
                    callback(data);
                },
                (error) => {
                    console.error(`[${this.collection}] Listener "${name}" erro:`, error);
                }
            );

            this._listeners.set(name, unsub);
            console.log(`[${this.collection}] Listener "${name}" ativo`);
            return () => this.unsubscribe(name);
        } catch (error) {
            console.error(`[${this.collection}] Erro ao criar listener "${name}":`, error);
            return () => {};
        }
    }

    /**
     * Cancela um listener específico.
     * @param {string} name
     */
    unsubscribe(name) {
        const unsub = this._listeners.get(name);
        if (unsub) {
            try {
                unsub();
            } catch (e) {
                console.warn(`[${this.collection}] Erro ao cancelar listener "${name}":`, e);
            }
            this._listeners.delete(name);
        }
    }

    /**
     * Cancela todos os listeners desta coleção.
     */
    unsubscribeAll() {
        for (const [name] of this._listeners) {
            this.unsubscribe(name);
        }
    }

    // ────────────────────────────────────────────────
    //  CACHE Operations
    // ────────────────────────────────────────────────

    /**
     * Invalida todo o cache deste service + StateManager.
     */
    invalidateCache() {
        this._cache.clear();
        stateManager.invalidate(this.collection);
        
        // Também invalidar caches legados se existirem
        if (window.DataStore) {
            try { window.DataStore.invalidate(this.collection); } catch (e) { /* ok */ }
        }
        if (window.CacheManager) {
            try { window.CacheManager.invalidate(this.collection); } catch (e) { /* ok */ }
        }
    }

    /**
     * Obtém dados do cache in-memory se ainda frescos.
     * @param {string} key
     * @returns {Array|null}
     */
    _getFromCache(key) {
        const entry = this._cache.get(key);
        if (!entry) return null;
        if (Date.now() - entry.ts > this.cacheTTL) {
            this._cache.delete(key);
            return null;
        }
        return entry.data;
    }

    /**
     * Armazena dados no cache in-memory.
     * @param {string} key
     * @param {Array} data
     */
    _setCache(key, data) {
        this._cache.set(key, { data, ts: Date.now() });
    }

    /**
     * Gera chave de cache com base nos filtros.
     * @param {Object} filters
     * @returns {string}
     */
    _buildKey(filters) {
        return `${this.collection}:${JSON.stringify(filters)}`;
    }

    // ────────────────────────────────────────────────
    //  FIRESTORE Fetch (interno)
    // ────────────────────────────────────────────────

    /**
     * Executa a query no Firestore.
     * @param {Object} filters
     * @returns {Promise<Array<Object>>}
     */
    async _fetchFromFirestore(filters = {}) {
        const db = getDb();
        let query = db.collection(this.collection);

        // Aplicar filtros where
        if (filters.where && Array.isArray(filters.where)) {
            for (const [field, op, value] of filters.where) {
                query = query.where(field, op, value);
            }
        }

        // Aplicar ordenação
        if (filters.orderBy) {
            query = query.orderBy(
                filters.orderBy.field,
                filters.orderBy.direction || 'asc'
            );
        }

        // Aplicar limite
        if (filters.limit) {
            query = query.limit(filters.limit);
        }

        const snapshot = await query.get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    // ────────────────────────────────────────────────
    //  MONITORING
    // ────────────────────────────────────────────────

    /**
     * Registra uma leitura para monitoramento de uso do Firebase.
     * @param {boolean} fromCache
     */
    _trackRead(fromCache) {
        if (window.FirebaseMonitor) {
            try {
                window.FirebaseMonitor.trackRead(this.collection, fromCache);
            } catch (e) { /* ok */ }
        }
    }
}
