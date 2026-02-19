/**
 * HokkaidoMES — Logs Service
 * Fase 1: Fundação Modular
 * 
 * Gerencia a coleção `system_logs`.
 * Campos comuns: action, category, user, userName, details, timestamp, createdAt
 */

import { BaseService } from './base.service.js';
import { getDb, serverTimestamp } from './firebase-client.js';

class LogsService extends BaseService {
    constructor() {
        super('system_logs', { cacheTTL: 300000 }); // 300s (5min) — otimizado Fase 2 (era 30s)
    }

    /**
     * Registra uma ação no log do sistema.
     * @param {string} action - Ação realizada (ex: 'delete_downtime')
     * @param {string} category - Categoria (ex: 'admin', 'production', 'downtime')
     * @param {Object} [details={}] - Detalhes adicionais
     * @returns {Promise<string>} ID do log criado
     */
    async log(action, category, details = {}) {
        const user = window.authSystem?.getCurrentUser?.();
        
        const logEntry = {
            action,
            category,
            details,
            user: user?.code || user?.email || 'sistema',
            userName: user?.name || 'Sistema',
            timestamp: new Date().toISOString(),
            createdAt: serverTimestamp()
        };

        return this.create(logEntry);
    }

    /**
     * Busca logs por categoria.
     * @param {string} category
     * @param {number} [limit=50]
     * @returns {Promise<Array>}
     */
    async getByCategory(category, limit = 50) {
        return this.getAll({
            where: [['category', '==', category]],
            orderBy: { field: 'createdAt', direction: 'desc' },
            limit
        });
    }

    /**
     * Busca logs por período.
     * @param {string} startDate
     * @param {string} endDate
     * @returns {Promise<Array>}
     */
    async getByDateRange(startDate, endDate) {
        return this.getAll({
            where: [
                ['timestamp', '>=', startDate],
                ['timestamp', '<=', endDate + 'T23:59:59']
            ],
            orderBy: { field: 'timestamp', direction: 'desc' }
        });
    }
}

export const logsService = new LogsService();
