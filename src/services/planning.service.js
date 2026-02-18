/**
 * HokkaidoMES — Planning Service
 * Fase 1: Fundação Modular
 * 
 * Gerencia a coleção `planning`.
 * Campos comuns: date, machine, machineId, product, productCode,
 *                quantity, orderNumber, status, turno, createdAt
 */

import { BaseService } from './base.service.js';

class PlanningService extends BaseService {
    constructor() {
        super('planning', { cacheTTL: 120000 }); // 2 min
    }

    /**
     * Busca planejamento para uma data específica.
     * @param {string} date - 'YYYY-MM-DD'
     * @param {boolean} [forceRefresh=false]
     * @returns {Promise<Array>}
     */
    async getForDate(date, forceRefresh = false) {
        if (!date) return this.getAll({}, forceRefresh);

        // Tentar filtrar do cache geral
        if (!forceRefresh) {
            const allCached = this._getFromCache(this._buildKey({}));
            if (allCached) {
                this._trackRead(true);
                return allCached.filter(p => p.date === date);
            }
        }

        return this.getAll({
            where: [['date', '==', date]]
        }, forceRefresh);
    }

    /**
     * Busca planejamento por máquina.
     * @param {string} machineId
     * @param {string} [date]
     * @returns {Promise<Array>}
     */
    async getByMachine(machineId, date = null) {
        const data = date 
            ? await this.getForDate(date) 
            : await this.getAll();
        
        const mid = machineId.toUpperCase().trim();
        return data.filter(p => {
            const pm = (p.machineId || p.machine || '').toUpperCase().trim();
            return pm === mid;
        });
    }

    /**
     * Busca planejamento por número de ordem.
     * @param {string} orderNumber
     * @returns {Promise<Object|null>}
     */
    async getByOrder(orderNumber) {
        const all = await this.getAll();
        const normalized = String(orderNumber).toUpperCase().trim();
        return all.find(p => {
            const pOrder = String(p.orderNumber || p.order_number || '').toUpperCase().trim();
            return pOrder === normalized;
        }) || null;
    }

    /**
     * Busca planejamentos por período.
     * @param {string} startDate
     * @param {string} endDate
     * @returns {Promise<Array>}
     */
    async getByDateRange(startDate, endDate) {
        return this.getAll({
            where: [
                ['date', '>=', startDate],
                ['date', '<=', endDate]
            ]
        });
    }
}

export const planningService = new PlanningService();
