/**
 * firebase-cache.service.js
 * ─────────────────────────────────────────────────────────────────────
 * Serviço centralizado de cache Firebase para módulos ES6.
 * Proxia as funções de cache definidas no script.js (window.*),
 * com fallback direto ao Firestore quando indisponível.
 *
 * IMPORTANTE: Todas as funções de cache "master" vivem dentro da IIFE
 * do script.js e são expostas via window.*. Este módulo fornece
 * imports ES6 limpos para os controllers, evitando chamadas diretas
 * a window.* espalhadas pelo código.
 * ─────────────────────────────────────────────────────────────────────
 */

function getDb() {
    return window.db || (typeof firebase !== 'undefined' ? firebase.firestore() : null);
}

// ─── Production Orders ──────────────────────────────────────────────

/**
 * Busca production_orders usando cache global.
 * @param {boolean} [forceRefresh=false]
 * @returns {Promise<Array>}
 */
export async function getProductionOrdersCached(forceRefresh = false) {
    if (typeof window.getProductionOrdersCached === 'function') {
        return window.getProductionOrdersCached(forceRefresh);
    }
    const db = getDb();
    if (!db) return [];
    const snap = await db.collection('production_orders').get();
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Busca ordem por ID usando cache.
 * @param {string} orderId
 * @returns {Promise<Object|null>}
 */
export async function findProductionOrderCached(orderId) {
    if (typeof window.findProductionOrderCached === 'function') {
        return window.findProductionOrderCached(orderId);
    }
    const all = await getProductionOrdersCached();
    return all.find(o => o.id === orderId) || null;
}

// ─── Planning ───────────────────────────────────────────────────────

/**
 * Busca planning usando cache global (com filtro de data opcional).
 * @param {string|null} [date=null]
 * @param {boolean} [forceRefresh=false]
 * @returns {Promise<Array>}
 */
export async function getPlanningCached(date = null, forceRefresh = false) {
    if (typeof window.getPlanningCached === 'function') {
        return window.getPlanningCached(date, forceRefresh);
    }
    const db = getDb();
    if (!db) return [];
    let q = db.collection('planning');
    if (date) q = q.where('date', '==', date);
    const snap = await q.get();
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// ─── Production Entries ─────────────────────────────────────────────

/**
 * Busca production_entries usando cache global (com filtro de data opcional).
 * @param {string|null} [date=null]
 * @param {boolean} [forceRefresh=false]
 * @returns {Promise<Array>}
 */
export async function getProductionEntriesCached(date = null, forceRefresh = false) {
    if (typeof window.getProductionEntriesCached === 'function') {
        return window.getProductionEntriesCached(date, forceRefresh);
    }
    const db = getDb();
    if (!db) return [];
    let q = db.collection('production_entries');
    if (date) q = q.where('data', '==', date);
    else q = q.where('data', '==', new Date().toISOString().split('T')[0]);
    const snap = await q.get();
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// ─── Active Downtimes ───────────────────────────────────────────────

/**
 * Busca active_downtimes usando cache global (TTL 30s no DataStore).
 * @param {boolean} [forceRefresh=false]
 * @returns {Promise<Array>}
 */
export async function getActiveDowntimesCached(forceRefresh = false) {
    if (typeof window.getActiveDowntimesCached === 'function') {
        return window.getActiveDowntimesCached(forceRefresh);
    }
    const db = getDb();
    if (!db) return [];
    const snap = await db.collection('active_downtimes').get();
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// ─── Extended Downtimes ─────────────────────────────────────────────

/**
 * Busca extended_downtime_logs usando cache global.
 * @param {boolean} [forceRefresh=false]
 * @param {boolean} [activeOnly=false]
 * @returns {Promise<Array>}
 */
export async function getExtendedDowntimesCached(forceRefresh = false, activeOnly = false) {
    if (typeof window.getExtendedDowntimesCached === 'function') {
        return window.getExtendedDowntimesCached(forceRefresh, activeOnly);
    }
    const db = getDb();
    if (!db) return [];
    let q = db.collection('extended_downtime_logs');
    if (activeOnly) q = q.where('status', '==', 'active');
    const snap = await q.get();
    const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return activeOnly ? data.filter(d => d.status === 'active') : data;
}

// ─── Downtime Entries ───────────────────────────────────────────────

/**
 * Busca downtime_entries usando cache global.
 * @param {string|null} [date=null] - Data para filtrar (YYYY-MM-DD). Se null, usa hoje.
 * @param {boolean} [forceRefresh=false]
 * @returns {Promise<Array>}
 */
export async function getDowntimeEntriesCached(date = null, forceRefresh = false) {
    if (typeof window.getDowntimeEntriesCached === 'function') {
        return window.getDowntimeEntriesCached(date, forceRefresh);
    }
    const db = getDb();
    if (!db) return [];
    const filterDate = date || new Date().toISOString().split('T')[0];
    const snap = await db.collection('downtime_entries')
        .where('date', '==', filterDate).get();
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// ─── Machine Priorities ─────────────────────────────────────────────

/**
 * Busca machine_priorities usando cache global (TTL 5min).
 * @param {boolean} [forceRefresh=false]
 * @returns {Promise<Object>} Mapa { machineId: priority }
 */
export async function getMachinePrioritiesCached(forceRefresh = false) {
    if (typeof window.getMachinePrioritiesCached === 'function') {
        return window.getMachinePrioritiesCached(forceRefresh);
    }
    const db = getDb();
    if (!db) return {};
    const snap = await db.collection('machine_priorities').get();
    const priorities = {};
    snap.docs.forEach(doc => {
        const p = doc.data().priority;
        priorities[doc.id] = (p !== null && p !== undefined && !isNaN(p)) ? Number(p) : 99;
    });
    return priorities;
}

// ─── Cache Control ──────────────────────────────────────────────────

/**
 * Invalida todas as entradas de cache de uma collection.
 * @param {string} collection
 */
export function invalidateCache(collection) {
    if (window.DataStore) window.DataStore.invalidate(collection);
    if (window.CacheManager) window.CacheManager.invalidate(collection);
}

/**
 * Retorna estatísticas de leitura Firebase.
 * @returns {Object}
 */
export function getCacheStats() {
    if (window.FirebaseMonitor) return window.FirebaseMonitor.getStats?.() || {};
    if (window.DataStore) return window.DataStore.getStats();
    return {};
}
