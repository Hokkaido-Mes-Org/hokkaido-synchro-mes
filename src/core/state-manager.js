/**
 * HokkaidoMES — State Manager (Cache Centralizado)
 * Fase 1: Fundação Modular
 * 
 * Substitui DataStore + CacheManager legados.
 * Armazena estado em memória com TTL, notifica mudanças via EventBus.
 * 
 * Uso:
 *   import { stateManager } from '../core/state-manager.js';
 *   
 *   stateManager.set('planning', data);
 *   const cached = stateManager.get('planning');
 *   const fresh = stateManager.isFresh('planning', 60000);
 *   stateManager.invalidate('planning');
 */

import { EventBus } from './event-bus.js';

class StateManager {
    /** @type {Object<string, *>} */
    #state = {};
    
    /** @type {Object<string, number>} */
    #timestamps = {};
    
    /** @type {number} TTL padrão: 5 minutos (otimizado Fase 2 — era 2 min) */
    #defaultTTL = 300000;
    
    /** @type {Object<string, number>} Contadores de acesso para monitoramento */
    #accessCounts = { hits: 0, misses: 0, sets: 0, invalidations: 0 };

    /**
     * Obtém dados armazenados para uma chave.
     * @param {string} key - Chave do estado (ex: 'planning', 'activeDowntimes')
     * @returns {*|null} Dados armazenados ou null se não existir
     */
    get(key) {
        const data = this.#state[key];
        if (data !== undefined && data !== null) {
            this.#accessCounts.hits++;
            return data;
        }
        this.#accessCounts.misses++;
        return null;
    }

    /**
     * Armazena dados com timestamp.
     * @param {string} key - Chave do estado
     * @param {*} data - Dados a armazenar
     */
    set(key, data) {
        this.#state[key] = data;
        this.#timestamps[key] = Date.now();
        this.#accessCounts.sets++;
        EventBus.emit(`state:${key}:updated`, data);
    }

    /**
     * Verifica se os dados de uma chave ainda estão "frescos" (dentro do TTL).
     * @param {string} key - Chave do estado
     * @param {number} [ttl] - TTL em ms (padrão: 120000 = 2 min)
     * @returns {boolean}
     */
    isFresh(key, ttl = this.#defaultTTL) {
        const ts = this.#timestamps[key];
        if (!ts) return false;
        return (Date.now() - ts) < ttl;
    }

    /**
     * Retorna o timestamp da última atualização de uma chave.
     * @param {string} key
     * @returns {number} Timestamp em ms ou 0 se nunca atualizado
     */
    getTimestamp(key) {
        return this.#timestamps[key] || 0;
    }

    /**
     * Verifica se uma chave existe no estado (independente de frescor).
     * @param {string} key
     * @returns {boolean}
     */
    has(key) {
        return this.#state[key] !== undefined && this.#state[key] !== null;
    }

    /**
     * Invalida uma chave específica ou todo o estado.
     * @param {string} [key] - Chave a invalidar. Se omitida, invalida tudo.
     */
    invalidate(key) {
        this.#accessCounts.invalidations++;
        
        if (key) {
            delete this.#state[key];
            delete this.#timestamps[key];
            EventBus.emit(`state:${key}:invalidated`);
        } else {
            // Invalidar tudo
            const keys = Object.keys(this.#state);
            this.#state = {};
            this.#timestamps = {};
            keys.forEach(k => EventBus.emit(`state:${k}:invalidated`));
            EventBus.emit('state:*:invalidated');
        }
    }

    /**
     * Obtém dados se frescos, ou retorna null para forçar fetch.
     * Útil para o padrão cache-first nos services.
     * @param {string} key
     * @param {number} [ttl]
     * @returns {*|null}
     */
    getIfFresh(key, ttl = this.#defaultTTL) {
        if (this.isFresh(key, ttl)) {
            return this.get(key);
        }
        return null;
    }

    /**
     * Retorna estatísticas para monitoramento.
     * Acessível via console: window.stateManager.stats()
     */
    stats() {
        const keys = Object.keys(this.#state);
        const ages = {};
        const now = Date.now();
        
        for (const key of keys) {
            const ts = this.#timestamps[key];
            ages[key] = ts ? `${Math.round((now - ts) / 1000)}s atrás` : 'sem timestamp';
        }

        return {
            keys,
            count: keys.length,
            ages,
            access: { ...this.#accessCounts },
            hitRate: this.#accessCounts.hits + this.#accessCounts.misses > 0
                ? `${Math.round((this.#accessCounts.hits / (this.#accessCounts.hits + this.#accessCounts.misses)) * 100)}%`
                : 'N/A'
        };
    }

    /**
     * Reseta contadores de acesso.
     */
    resetStats() {
        this.#accessCounts = { hits: 0, misses: 0, sets: 0, invalidations: 0 };
    }
}

export const stateManager = new StateManager();
