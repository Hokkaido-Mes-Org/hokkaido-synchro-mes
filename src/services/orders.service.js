/**
 * HokkaidoMES — Orders Service
 * Fase 1: Fundação Modular
 * 
 * Gerencia a coleção `production_orders` e `machine_priorities`.
 * Campos comuns: order_number, orderNumber, product, productCode,
 *                quantity, status, machine, priority, createdAt
 */

import { BaseService } from './base.service.js';
import { getDb } from './firebase-client.js';
import { stateManager } from '../core/state-manager.js';

class OrdersService extends BaseService {
    constructor() {
        super('production_orders', { cacheTTL: 120000 }); // 2 min
    }

    /**
     * Busca uma ordem por número (não por doc ID).
     * @param {string} orderNumber
     * @returns {Promise<Object|null>}
     */
    async getByOrderNumber(orderNumber) {
        const all = await this.getAll();
        const normalized = String(orderNumber).toUpperCase().trim();
        return all.find(o => {
            const oNum = String(o.order_number || o.orderNumber || '').toUpperCase().trim();
            return oNum === normalized;
        }) || null;
    }

    /**
     * Busca ordens por status.
     * @param {string} status - 'active', 'completed', 'cancelled', etc.
     * @returns {Promise<Array>}
     */
    async getByStatus(status) {
        const all = await this.getAll();
        return all.filter(o => o.status === status);
    }

    /**
     * Busca ordens por máquina.
     * @param {string} machineId
     * @returns {Promise<Array>}
     */
    async getByMachine(machineId) {
        const all = await this.getAll();
        const mid = machineId.toUpperCase().trim();
        return all.filter(o => {
            const om = (o.machine || o.machineId || '').toUpperCase().trim();
            return om === mid;
        });
    }

    /**
     * Busca prioridades de máquinas.
     * Cache de 5 min (dados quase estáticos).
     * @param {boolean} [forceRefresh=false]
     * @returns {Promise<Object>} Mapa { machineId: priority }
     */
    async getPriorities(forceRefresh = false) {
        const cacheKey = 'machinePriorities';

        if (!forceRefresh) {
            const cached = stateManager.getIfFresh(cacheKey, 300000); // 5 min
            if (cached) return cached;
        }

        const db = getDb();
        const snapshot = await db.collection('machine_priorities').get();
        const priorities = {};

        snapshot.docs.forEach(doc => {
            const p = doc.data().priority;
            priorities[doc.id] = (p !== null && p !== undefined && !isNaN(p)) 
                ? Number(p) : 99;
        });

        stateManager.set(cacheKey, priorities);
        return priorities;
    }

    /**
     * Atualiza a prioridade de uma máquina.
     * @param {string} machineId
     * @param {number} priority
     */
    async setPriority(machineId, priority) {
        const db = getDb();
        await db.collection('machine_priorities').doc(machineId).set({
            priority: Number(priority),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        stateManager.invalidate('machinePriorities');
    }
}

export const ordersService = new OrdersService();
