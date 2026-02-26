/**
 * HokkaidoMES — Write Invalidation Utility
 * Fase 4B: Nível 2 — Ação 2.1
 *
 * Invalida automaticamente todas as camadas de cache após operações de escrita
 * no Firestore (add, set, update, delete).
 *
 * Camadas de cache existentes:
 *   1. DataStore      (legacy, script.js)
 *   2. CacheManager   (legacy, script.js)
 *   3. StateManager   (modular, src/core/state-manager.js)
 *   4. Inline caches  (analysis._inlineQueryCache, reports._relQueryCache)
 *   5. Downtime cache (downtimeStatusCache via invalidateDowntimeCache)
 *
 * Uso:
 *   import { invalidateCacheForCollection, invalidateAfterWrite } from '../utils/write-invalidation.js';
 *
 *   // Após qualquer escrita:
 *   await db.collection('production_entries').add(data);
 *   invalidateCacheForCollection('production_entries');
 *
 *   // Ou com wrapper automático:
 *   await invalidateAfterWrite('production_entries', () =>
 *       db.collection('production_entries').add(data)
 *   );
 */

import { stateManager } from '../core/state-manager.js';
import { EventBus } from '../core/event-bus.js';

// ─── Mapa de coleção → chaves de cache afetadas ──────────────────────
const CACHE_KEYS_BY_COLLECTION = {
    'production_entries': {
        dataStore:    ['productionEntries'],
        cacheManager: ['production_entries', 'prod_'],
        stateManager: ['productionEntries'],
        events:       ['production_entries:changed'],
    },
    'production_orders': {
        dataStore:    ['productionOrders'],
        cacheManager: ['production_orders'],
        stateManager: ['productionOrders'],
        events:       ['production_orders:changed'],
    },
    'planning': {
        dataStore:    ['planning'],
        cacheManager: ['planning', 'plan_'],
        stateManager: ['planning'],
        events:       ['planning:changed'],
    },
    'active_downtimes': {
        dataStore:    ['activeDowntimes'],
        cacheManager: ['active_downtimes'],
        stateManager: ['activeDowntimes'],
        events:       ['active_downtimes:changed'],
        downtimeCache: true,
    },
    'downtime_entries': {
        dataStore:    ['downtimeEntries'],
        cacheManager: ['downtime_entries', 'down_'],
        stateManager: ['downtimeEntries'],
        events:       ['downtime_entries:changed'],
        downtimeCache: true,
    },
    'extended_downtime_logs': {
        dataStore:    ['extendedDowntimeLogs'],
        cacheManager: ['extended_downtime_logs'],
        stateManager: ['extendedDowntimeLogs'],
        events:       ['extended_downtime_logs:changed'],
        downtimeCache: true,
    },
    'quantity_adjustments': {
        dataStore:    [],
        cacheManager: ['quantity_adjustments'],
        stateManager: [],
        events:       [],
    },
    'rework_entries': {
        dataStore:    [],
        cacheManager: ['rework_entries'],
        stateManager: [],
        events:       [],
    },
    'triage_entries': {
        dataStore:    [],
        cacheManager: ['triage_entries'],
        stateManager: [],
        events:       [],
    },
    'system_logs': {
        dataStore:    [],
        cacheManager: [],
        stateManager: [],
        events:       [],
        // system_logs é write-only, sem cache para invalidar
    },
};

// ─── Contadores de uso ───────────────────────────────────────────────
let _invalidationCount = 0;
let _writeCount = 0;

/**
 * Invalida TODAS as camadas de cache para uma coleção após escrita.
 *
 * @param {string} collectionName - Nome da coleção Firestore (snake_case)
 * @param {string} [machineId] - ID da máquina (para invalidação específica de downtimes)
 */
export function invalidateCacheForCollection(collectionName, machineId = null) {
    const mapping = CACHE_KEYS_BY_COLLECTION[collectionName];
    if (!mapping) {
        console.debug(`[WriteInvalidation] Coleção "${collectionName}" sem mapeamento de cache — ignorado`);
        return;
    }

    _invalidationCount++;
    console.debug(`[WriteInvalidation] Invalidando cache para "${collectionName}" (#${_invalidationCount})`);

    // 1. DataStore (legacy)
    if (window.DataStore && mapping.dataStore) {
        mapping.dataStore.forEach(key => {
            try { window.DataStore.invalidate(key); } catch (e) { /* ok */ }
        });
    }

    // 2. CacheManager (legacy) — suporta prefixo com wildcard
    if (window.CacheManager && mapping.cacheManager) {
        mapping.cacheManager.forEach(key => {
            try {
                if (key.endsWith('_')) {
                    // Prefixo: invalidar todas as chaves que começam com este prefixo
                    if (typeof window.CacheManager.invalidatePrefix === 'function') {
                        window.CacheManager.invalidatePrefix(key);
                    } else {
                        // Fallback: invalidar chave exata (sem prefix support)
                        window.CacheManager.invalidate(key);
                    }
                } else {
                    window.CacheManager.invalidate(key);
                }
            } catch (e) { /* ok */ }
        });
    }

    // 3. StateManager (modular)
    if (mapping.stateManager) {
        mapping.stateManager.forEach(key => {
            try { stateManager.invalidate(key); } catch (e) { /* ok */ }
        });
    }

    // 4. Downtime status cache (específico)
    if (mapping.downtimeCache) {
        try {
            if (typeof window.invalidateDowntimeCache === 'function') {
                window.invalidateDowntimeCache(machineId || null);
            }
        } catch (e) { /* ok */ }
    }

    // 5. Emitir eventos para outros módulos reagirem
    if (mapping.events) {
        mapping.events.forEach(event => {
            try { EventBus.emit(event, { collection: collectionName, machineId }); } catch (e) { /* ok */ }
        });
    }
}

/**
 * Wrapper que executa uma operação de escrita e invalida cache automaticamente.
 *
 * @param {string} collectionName - Nome da coleção Firestore
 * @param {Function} writeFn - Função assíncrona que executa a escrita
 * @param {string} [machineId] - ID da máquina (para invalidação de downtimes)
 * @returns {Promise<*>} - Resultado da operação de escrita
 *
 * @example
 *   const docRef = await invalidateAfterWrite('production_entries', () =>
 *       db.collection('production_entries').add(data)
 *   );
 */
export async function invalidateAfterWrite(collectionName, writeFn, machineId = null) {
    _writeCount++;
    const result = await writeFn();
    invalidateCacheForCollection(collectionName, machineId);
    return result;
}

/**
 * Retorna estatísticas de invalidação.
 * @returns {{ writes: number, invalidations: number, collections: string[] }}
 */
export function getWriteInvalidationStats() {
    return {
        writes: _writeCount,
        invalidations: _invalidationCount,
        collections: Object.keys(CACHE_KEYS_BY_COLLECTION),
    };
}

// Expor no window para uso em script.js e debug no console
window.invalidateCacheForCollection = invalidateCacheForCollection;
window.invalidateAfterWrite = invalidateAfterWrite;
window.getWriteInvalidationStats = getWriteInvalidationStats;
