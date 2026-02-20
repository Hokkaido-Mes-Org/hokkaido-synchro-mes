/**
 * HokkaidoMES — Legacy Bridge
 * Fase 1: Fundação Modular
 * 
 * ARQUIVO TEMPORÁRIO — Será removido na Fase 3.
 * 
 * Conecta o mundo ES6 Modules ao mundo window.* do script.js legado:
 *   1. Sincroniza DataStore legado → StateManager novo
 *   2. Expõe Services modernos como window.services.*
 *   3. Expõe EventBus + StateManager no window para debug
 */

import { stateManager } from '../core/state-manager.js';
import { EventBus } from '../core/event-bus.js';
import { productionService } from '../services/production.service.js';
import { downtimeService } from '../services/downtime.service.js';
import { planningService } from '../services/planning.service.js';
import { ordersService } from '../services/orders.service.js';
import { logsService } from '../services/logs.service.js';

/**
 * Sincroniza dados do DataStore legado (script.js) → StateManager (módulos).
 * Quando o legado atualiza seus dados via DataStore.set(), o StateManager
 * novo recebe os mesmos dados automaticamente.
 */
function syncLegacyToModern() {
    if (!window.DataStore) {
        console.warn('[Bridge] window.DataStore não encontrado. Sincronização ignorada.');
        return;
    }

    const collections = [
        'planning',
        'productionOrders',
        'productionEntries',
        'activeDowntimes',
        'extendedDowntimeLogs',
        'downtimeEntries'
    ];

    collections.forEach(col => {
        try {
            // Subscrever no DataStore legado
            window.DataStore.subscribe(col, (data) => {
                stateManager.set(col, data);
            });

            // Se já tem dados no DataStore, sincronizar imediatamente
            const existing = window.DataStore.get(col);
            if (existing) {
                stateManager.set(col, existing);
            }
        } catch (e) {
            console.warn(`[Bridge] Erro ao sincronizar "${col}":`, e);
        }
    });

    console.log(`[Bridge] ${collections.length} coleções sincronizadas: DataStore → StateManager`);
}

/**
 * Expõe os Services modernos em window.services para que:
 *   1. Código legado possa chamar (opcionalmente) 
 *   2. Desenvolvedores possam testar pelo console
 */
function exposeServicesToGlobal() {
    window.services = {
        production: productionService,
        downtime: downtimeService,
        planning: planningService,
        orders: ordersService,
        logs: logsService,
    };

    // Expor EventBus e StateManager para debug
    window.EventBus = EventBus;
    window.stateManager = stateManager;
}

/**
 * Registra listeners de eventos do EventBus que precisam
 * atualizar o mundo legado quando algo muda nos módulos.
 */
function setupModernToLegacySync() {
    // Quando um service moderno deleta um downtime, invalidar caches legados
    EventBus.on('downtime_entries:deleted', () => {
        try {
            if (typeof window.invalidateDowntimeCache === 'function') {
                window.invalidateDowntimeCache();
            }
            if (window.DataStore) {
                window.DataStore.invalidate('downtimeEntries');
            }
            if (window.CacheManager) {
                window.CacheManager.invalidate('downtime_entries');
            }
        } catch (e) { /* legado pode não existir */ }
    });

    EventBus.on('downtime_entries:deletedMany', () => {
        try {
            if (typeof window.invalidateDowntimeCache === 'function') {
                window.invalidateDowntimeCache();
            }
            if (window.DataStore) {
                window.DataStore.invalidate('downtimeEntries');
            }
            if (window.CacheManager) {
                window.CacheManager.invalidate('downtime_entries');
            }
        } catch (e) { /* legado pode não existir */ }
    });

    // Quando production_entries muda, invalidar caches legados
    EventBus.on('production_entries:created', () => {
        try {
            if (window.DataStore) window.DataStore.invalidate('productionEntries');
            if (window.CacheManager) window.CacheManager.invalidate('production_entries');
        } catch (e) { /* ok */ }
    });

    EventBus.on('production_entries:deleted', () => {
        try {
            if (window.DataStore) window.DataStore.invalidate('productionEntries');
            if (window.CacheManager) window.CacheManager.invalidate('production_entries');
        } catch (e) { /* ok */ }
    });

    // ── Fase 4B: Reagir a eventos genéricos de write-invalidation ──
    // O módulo write-invalidation.js emite '*:changed' após writes.
    // Aqui garantimos que caches legados sejam sincronizados.
    const collectionEventMap = {
        'production_orders:changed':      { ds: 'productionOrders',    cm: 'production_orders' },
        'planning:changed':               { ds: 'planning',            cm: 'planning' },
        'active_downtimes:changed':       { ds: 'activeDowntimes',     cm: 'active_downtimes' },
        'extended_downtime_logs:changed':  { ds: 'extendedDowntimeLogs', cm: 'extended_downtime_logs' },
    };
    Object.entries(collectionEventMap).forEach(([event, keys]) => {
        EventBus.on(event, () => {
            try {
                if (window.DataStore) window.DataStore.invalidate(keys.ds);
                if (window.CacheManager) window.CacheManager.invalidate(keys.cm);
            } catch (e) { /* ok */ }
        });
    });
}

/**
 * Inicializa a ponte legado ↔ módulos.
 * Chamado pelo index.js após confirmar que window.db está disponível.
 */
export function initBridge() {
    syncLegacyToModern();
    exposeServicesToGlobal();
    setupModernToLegacySync();
    console.log('🌉 [Bridge] Legado ↔ Módulos ES6 conectados');
    console.log('🌉 [Bridge] Teste: window.services.downtime.entries.getAll()');
    console.log('🌉 [Bridge] Stats: window.stateManager.stats()');
    console.log('🌉 [Bridge] Eventos: window.EventBus.stats()');
}
