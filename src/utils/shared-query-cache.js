/**
 * HokkaidoMES — Shared Query Cache
 * Fase 4B: Nível 2 — Ação 2.3
 *
 * Cache compartilhado entre controllers que consultam as mesmas coleções
 * com os mesmos filtros de data. Evita que Analysis e Reports façam
 * queries duplicadas para os mesmos dados.
 *
 * Chaves padronizadas:
 *   - prod_{startDate}_{endDate}  → production_entries
 *   - down_{startDate}_{endDate}  → downtime_entries
 *   - losses_{startDate}_{endDate} → production_entries (perdas)
 *   - plan_{startDate}_{endDate}  → planning
 *
 * Uso:
 *   import { sharedQueryCache } from '../utils/shared-query-cache.js';
 *   const data = await sharedQueryCache.get('prod_2026-02-20_2026-02-20', () => query.get());
 */

const _cache = new Map();
const _TTL = 300000; // 5 min — consistente com outros caches do sistema

/**
 * Cache compartilhado para queries Firestore entre controllers.
 * Singleton acessível via import ou window.sharedQueryCache.
 */
export const sharedQueryCache = {
    /**
     * Busca do cache ou executa queryFn e armazena.
     * @param {string} key - Chave normalizada (ex: 'prod_2026-02-20_2026-02-20')
     * @param {Function} queryFn - Função assíncrona que retorna resultado
     * @returns {Promise<*>} Resultado cacheado ou fresco
     */
    async get(key, queryFn) {
        const entry = _cache.get(key);
        if (entry && Date.now() - entry.ts < _TTL) {
            console.debug(`📦 [SharedCache] hit: ${key}`);
            return entry.data;
        }
        console.debug(`🔥 [SharedCache] miss: ${key}`);
        const data = await queryFn();
        _cache.set(key, { data, ts: Date.now() });
        return data;
    },

    /**
     * Verifica se uma chave existe e está fresca.
     * @param {string} key
     * @returns {boolean}
     */
    has(key) {
        const entry = _cache.get(key);
        return !!(entry && Date.now() - entry.ts < _TTL);
    },

    /**
     * Invalida uma chave específica ou todas com prefixo.
     * @param {string} [key] - Chave ou prefixo. Se omitida, limpa tudo.
     */
    invalidate(key) {
        if (!key) {
            _cache.clear();
            return;
        }
        // Prefixo: invalidar todas as chaves que começam com o valor
        if (key.endsWith('_')) {
            for (const k of _cache.keys()) {
                if (k.startsWith(key)) _cache.delete(k);
            }
        } else {
            _cache.delete(key);
        }
    },

    /**
     * Retorna estatísticas do cache.
     * @returns {{ size: number, keys: string[] }}
     */
    stats() {
        const now = Date.now();
        const entries = [];
        for (const [key, entry] of _cache.entries()) {
            entries.push({
                key,
                age: `${Math.round((now - entry.ts) / 1000)}s`,
                fresh: (now - entry.ts) < _TTL,
            });
        }
        return { size: _cache.size, entries };
    }
};

// Expor globalmente para debug e uso cross-module
window.sharedQueryCache = sharedQueryCache;
