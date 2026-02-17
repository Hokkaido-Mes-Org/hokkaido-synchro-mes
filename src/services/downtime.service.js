/**
 * HokkaidoMES — Downtime Service
 * Fase 1: Fundação Modular
 * 
 * Gerencia 3 coleções relacionadas a paradas:
 *   - downtime_entries: Registros finalizados de parada
 *   - active_downtimes: Paradas ativas (em andamento)
 *   - extended_downtime_logs: Logs de paradas prolongadas
 * 
 * Campos comuns de downtime_entries:
 *   machineId, machine, motivo, reason, categoria, category,
 *   data, duration_minutes, start_time, end_time, turno, orderNumber
 */

import { BaseService } from './base.service.js';
import { getDb, serverTimestamp, createBatch } from './firebase-client.js';
import { EventBus } from '../core/event-bus.js';

// ── Service principal: downtime_entries ──
class DowntimeEntriesService extends BaseService {
    constructor() {
        super('downtime_entries', { cacheTTL: 60000 }); // 1 min
    }

    /**
     * Busca paradas por período.
     * @param {string} startDate - 'YYYY-MM-DD'
     * @param {string} endDate - 'YYYY-MM-DD'
     * @returns {Promise<Array>}
     */
    async getByDateRange(startDate, endDate) {
        return this.getAll({
            where: [
                ['data', '>=', startDate],
                ['data', '<=', endDate]
            ]
        });
    }

    /**
     * Busca paradas por máquina.
     * @param {string} machineId
     * @returns {Promise<Array>}
     */
    async getByMachine(machineId) {
        const all = await this.getAll();
        const mid = machineId.toUpperCase().trim();
        return all.filter(d => {
            const dm = (d.machineId || d.machine || '').toUpperCase().trim();
            return dm === mid;
        });
    }

    /**
     * Agrega paradas por motivo/razão.
     * @param {Array} entries - Lista de downtime entries
     * @returns {Array<{reason: string, count: number, totalMinutes: number, entries: Array}>}
     */
    aggregateByReason(entries) {
        const grouped = {};
        for (const entry of entries) {
            const reason = entry.motivo || entry.reason || 'Sem motivo';
            if (!grouped[reason]) {
                grouped[reason] = { reason, count: 0, totalMinutes: 0, entries: [] };
            }
            grouped[reason].count++;
            grouped[reason].totalMinutes += Number(entry.duration_minutes) || 0;
            grouped[reason].entries.push(entry);
        }
        return Object.values(grouped).sort((a, b) => b.totalMinutes - a.totalMinutes);
    }

    /**
     * Agrega paradas por categoria.
     * @param {Array} entries
     * @returns {Array<{category: string, count: number, totalMinutes: number}>}
     */
    aggregateByCategory(entries) {
        const grouped = {};
        for (const entry of entries) {
            const cat = entry.categoria || entry.category || 'Sem categoria';
            if (!grouped[cat]) {
                grouped[cat] = { category: cat, count: 0, totalMinutes: 0 };
            }
            grouped[cat].count++;
            grouped[cat].totalMinutes += Number(entry.duration_minutes) || 0;
        }
        return Object.values(grouped).sort((a, b) => b.totalMinutes - a.totalMinutes);
    }

    /**
     * Agrega paradas por máquina.
     * @param {Array} entries
     * @returns {Array<{machine: string, count: number, totalMinutes: number}>}
     */
    aggregateByMachine(entries) {
        const grouped = {};
        for (const entry of entries) {
            const machine = (entry.machineId || entry.machine || 'N/A').toUpperCase().trim();
            if (!grouped[machine]) {
                grouped[machine] = { machine, count: 0, totalMinutes: 0 };
            }
            grouped[machine].count++;
            grouped[machine].totalMinutes += Number(entry.duration_minutes) || 0;
        }
        return Object.values(grouped).sort((a, b) => b.totalMinutes - a.totalMinutes);
    }

    /**
     * Deleta entradas por motivo (busca parcial por substring).
     * @param {string} reason - Motivo a buscar (substring)
     * @returns {Promise<number>} Quantidade deletada
     */
    async deleteByReason(reason) {
        const all = await this.getAll({}, true); // force refresh
        const matching = all.filter(d => {
            const motivo = (d.motivo || d.reason || '').toLowerCase();
            return motivo.includes(reason.toLowerCase());
        });

        if (matching.length === 0) {
            console.log(`[downtime_entries] Nenhuma entrada com motivo "${reason}"`);
            return 0;
        }

        const ids = matching.map(d => d.id);
        const deleted = await this.deleteMany(ids);
        console.log(`[downtime_entries] ${deleted} entradas com motivo "${reason}" deletadas`);
        return deleted;
    }
}

// ── Service para active_downtimes ──
class ActiveDowntimesService extends BaseService {
    constructor() {
        super('active_downtimes', { cacheTTL: 30000 }); // 30s — dados real-time
    }

    /**
     * Verifica se uma máquina tem parada ativa.
     * @param {string} machineId
     * @returns {Promise<Object|null>}
     */
    async getForMachine(machineId) {
        const mid = machineId.toUpperCase().trim();
        return this.getById(mid);
    }

    /**
     * Retorna todas as máquinas com parada ativa.
     * @returns {Promise<Array>}
     */
    async getAllActive() {
        return this.getAll();
    }
}

// ── Service para extended_downtime_logs ──
class ExtendedDowntimeService extends BaseService {
    constructor() {
        super('extended_downtime_logs', { cacheTTL: 60000 });
    }

    /**
     * Busca apenas logs com status ativo.
     * @returns {Promise<Array>}
     */
    async getActive() {
        const all = await this.getAll();
        return all.filter(d => d.status === 'active');
    }

    /**
     * Busca logs por máquina.
     * @param {string} machineId
     * @returns {Promise<Array>}
     */
    async getByMachine(machineId) {
        const all = await this.getAll();
        const mid = machineId.toUpperCase().trim();
        return all.filter(d => {
            const dm = (d.machine_id || d.machine || '').toUpperCase().trim();
            return dm === mid;
        });
    }
}

// ── Facade que agrupa os 3 services ──
export const downtimeService = {
    entries: new DowntimeEntriesService(),
    active: new ActiveDowntimesService(),
    extended: new ExtendedDowntimeService(),

    // Atalhos para o service mais usado (entries)
    getByDateRange: (...args) => downtimeService.entries.getByDateRange(...args),
    getByMachine: (...args) => downtimeService.entries.getByMachine(...args),
    aggregateByReason: (...args) => downtimeService.entries.aggregateByReason(...args),
    aggregateByCategory: (...args) => downtimeService.entries.aggregateByCategory(...args),
    aggregateByMachine: (...args) => downtimeService.entries.aggregateByMachine(...args),
    deleteByReason: (...args) => downtimeService.entries.deleteByReason(...args),

    /**
     * Invalida TODOS os caches de downtime (entries + active + extended).
     * Também invalida os caches legados do script.js.
     */
    invalidateAll() {
        this.entries.invalidateCache();
        this.active.invalidateCache();
        this.extended.invalidateCache();

        // Invalidar caches legados (script.js)
        try {
            if (typeof window.invalidateDowntimeCache === 'function') {
                window.invalidateDowntimeCache();
            }
            if (window._downtimeStatusCache) {
                window._downtimeStatusCache = {};
                window._downtimeStatusCacheTimestamp = 0;
            }
            if (window.downtimeStatusCache) {
                window.downtimeStatusCache = {};
            }
        } catch (e) { /* ok — legado pode não existir */ }

        EventBus.emit('downtime:allCachesInvalidated');
    }
};
