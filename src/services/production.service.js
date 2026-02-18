/**
 * HokkaidoMES — Production Service
 * Fase 1: Fundação Modular
 * 
 * Gerencia a coleção `production_entries`.
 * Campos comuns: machineId, orderNumber, quantity, workDay, data, turno,
 *                product, productCode, operador, timestamp, createdAt
 */

import { BaseService } from './base.service.js';

class ProductionService extends BaseService {
    constructor() {
        super('production_entries', { cacheTTL: 60000 }); // 1 min
    }

    /**
     * Busca entradas de produção por data de trabalho.
     * @param {string} date - Data no formato 'YYYY-MM-DD'
     * @param {boolean} [forceRefresh=false]
     * @returns {Promise<Array>}
     */
    async getForDate(date, forceRefresh = false) {
        if (!date) return this.getAll({}, forceRefresh);

        // Tentar filtrar do cache geral primeiro
        if (!forceRefresh) {
            const allCached = this._getFromCache(this._buildKey({}));
            if (allCached) {
                this._trackRead(true);
                return allCached.filter(e => e.workDay === date || e.data === date);
            }
        }

        return this.getAll({
            where: [['workDay', '==', date]]
        }, forceRefresh);
    }

    /**
     * Busca entradas por máquina.
     * @param {string} machineId - Ex: 'H01'
     * @param {string} [date] - Filtro opcional por data
     * @returns {Promise<Array>}
     */
    async getByMachine(machineId, date = null) {
        const all = date 
            ? await this.getForDate(date) 
            : await this.getAll();
        
        const normalizedId = machineId.toUpperCase().trim();
        return all.filter(e => {
            const eMachine = (e.machineId || e.machine || '').toUpperCase().trim();
            return eMachine === normalizedId;
        });
    }

    /**
     * Busca entradas por número de ordem.
     * @param {string} orderNumber
     * @returns {Promise<Array>}
     */
    async getByOrder(orderNumber) {
        const all = await this.getAll();
        const normalized = String(orderNumber).toUpperCase().trim();
        return all.filter(e => {
            const eOrder = String(e.orderNumber || e.order_number || '').toUpperCase().trim();
            return eOrder === normalized;
        });
    }

    /**
     * Busca entradas por período.
     * @param {string} startDate - 'YYYY-MM-DD'
     * @param {string} endDate - 'YYYY-MM-DD'
     * @returns {Promise<Array>}
     */
    async getByDateRange(startDate, endDate) {
        return this.getAll({
            where: [
                ['workDay', '>=', startDate],
                ['workDay', '<=', endDate]
            ]
        });
    }

    /**
     * Calcula total produzido por ordem.
     * @param {string} orderNumber
     * @returns {Promise<number>}
     */
    async getTotalByOrder(orderNumber) {
        const entries = await this.getByOrder(orderNumber);
        return entries.reduce((sum, e) => sum + (Number(e.quantity) || 0), 0);
    }
}

export const productionService = new ProductionService();
