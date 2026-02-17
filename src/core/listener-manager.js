/**
 * HokkaidoMES — Listener Manager (ES6 Module)
 * Fase 3: Extraído de script.js (linhas 508-598)
 *
 * Gerencia o ciclo de vida de listeners Firestore (subscribe/unsubscribe/pause/resume).
 * Integra com a Visibility API para economizar recursos quando a aba está oculta.
 */

/**
 * Gerenciador centralizado de listeners Firestore.
 * Baseado em Map para rastreamento por nome.
 */
export const listenerManager = {
    listeners: new Map(),
    _paused: false,
    _pausedListeners: null,

    /**
     * Inscreve um listener Firestore nomeado.
     * Se já existir um listener com o mesmo nome, desinscreve o anterior.
     * @param {string} name - Nome identificador do listener
     * @param {Object} query - Query Firestore (deve ter .onSnapshot)
     * @param {Function} onSnapshot - Callback para snapshot
     * @param {Function} [onError] - Callback para erro
     */
    subscribe(name, query, onSnapshot, onError) {
        this.unsubscribe(name);

        try {
            const unsubscribe = query.onSnapshot(
                snapshot => {
                    try {
                        onSnapshot(snapshot);
                    } catch (error) {
                        console.error(`Erro ao processar snapshot ${name}:`, error);
                    }
                },
                error => {
                    console.error(`Erro no listener ${name}:`, error);
                    if (onError) onError(error);
                }
            );

            this.listeners.set(name, unsubscribe);
            console.log(`[ListenerMgr] "${name}" inscrito`);
        } catch (error) {
            console.error(`Erro ao criar listener ${name}:`, error);
            if (onError) onError(error);
        }
    },

    /**
     * Desinscreve um listener específico.
     * @param {string} name
     */
    unsubscribe(name) {
        const unsubscribe = this.listeners.get(name);
        if (unsubscribe) {
            try {
                unsubscribe();
                this.listeners.delete(name);
                console.log(`[ListenerMgr] "${name}" desinscrito`);
            } catch (error) {
                console.error(`Erro ao desinscrever listener ${name}:`, error);
            }
        }
    },

    /**
     * Desinscreve todos os listeners ativos.
     */
    unsubscribeAll() {
        for (const name of this.listeners.keys()) {
            this.unsubscribe(name);
        }
    },

    /**
     * Pausa todos os listeners (Visibility API — aba oculta).
     * Salva a lista de listeners ativos para retomar depois.
     */
    pauseAll() {
        if (this._paused) return;
        this._paused = true;
        this._pausedListeners = new Map(this.listeners);
        for (const [name, unsubscribe] of this.listeners) {
            try {
                unsubscribe();
                console.log(`[ListenerMgr] "${name}" pausado`);
            } catch (e) {
                console.warn(`Erro ao pausar listener ${name}:`, e);
            }
        }
        this.listeners.clear();
    },

    /**
     * Retoma listeners após a aba ficar visível novamente.
     * Delega re-registro para window._currentListenerSetup.
     */
    resumeAll() {
        if (!this._paused) return;
        this._paused = false;
        console.log('[ListenerMgr] Retomando listeners...');
        if (typeof window._currentListenerSetup === 'function') {
            window._currentListenerSetup();
        }
    }
};

// Expor globalmente para compatibilidade legada
window.listenerManager = listenerManager;
