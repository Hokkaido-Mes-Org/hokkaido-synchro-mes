/**
 * HokkaidoMES — Triage Service (Triagem / Quarentena)
 * 
 * Gerencia a coleção `triage_entries` — peças rejeitadas que vão
 * para quarentena e podem ser reaproveitadas (triagem) ou descartadas.
 *
 * Fluxo:
 *  1. Peça rejeitada na produção → registro de quarentena (status: QUARENTENA)
 *  2. Triagem acontece → peças aprovadas voltam para produção (APROVADA)
 *                       → peças definitivamente refugadas (REFUGADA)
 *
 * Campos: machineId, orderNumber, product, productCode, defectReason,
 *         quantity, quantityApproved, quantityRejected, status,
 *         quarantineDate, triageDate, triageOperator, notes, turno
 */

import { BaseService } from './base.service.js';

const TRIAGE_STATUS = {
    QUARENTENA: 'QUARENTENA',
    EM_TRIAGEM: 'EM_TRIAGEM',
    CONCLUIDA:  'CONCLUIDA'
};

class TriageService extends BaseService {
    constructor() {
        super('triage_entries', { cacheTTL: 60000 }); // 1 min
    }

    // --- Consultas de domínio ---

    /**
     * Busca lotes em quarentena (aguardando triagem).
     * @param {boolean} [forceRefresh=false]
     * @returns {Promise<Array>}
     */
    async getQuarantined(forceRefresh = false) {
        const all = await this.getAll({}, forceRefresh);
        return all.filter(e => e.status === TRIAGE_STATUS.QUARENTENA);
    }

    /**
     * Busca lotes atualmente em triagem.
     * @returns {Promise<Array>}
     */
    async getInTriage() {
        const all = await this.getAll();
        return all.filter(e => e.status === TRIAGE_STATUS.EM_TRIAGEM);
    }

    /**
     * Busca lotes já concluídos (triagem finalizada).
     * @param {string} [startDate] - 'YYYY-MM-DD'
     * @param {string} [endDate]   - 'YYYY-MM-DD'
     * @returns {Promise<Array>}
     */
    async getCompleted(startDate, endDate) {
        const all = await this.getAll();
        let completed = all.filter(e => e.status === TRIAGE_STATUS.CONCLUIDA);
        if (startDate) completed = completed.filter(e => (e.triageDate || e.quarantineDate) >= startDate);
        if (endDate)   completed = completed.filter(e => (e.triageDate || e.quarantineDate) <= endDate);
        return completed;
    }

    /**
     * Busca lotes por máquina.
     * @param {string} machineId
     * @returns {Promise<Array>}
     */
    async getByMachine(machineId) {
        const all = await this.getAll();
        const mid = machineId.toUpperCase().trim();
        return all.filter(e => (e.machineId || '').toUpperCase().trim() === mid);
    }

    /**
     * Busca lotes por número de ordem.
     * @param {string} orderNumber
     * @returns {Promise<Array>}
     */
    async getByOrder(orderNumber) {
        const all = await this.getAll();
        const norm = String(orderNumber).toUpperCase().trim();
        return all.filter(e => String(e.orderNumber || '').toUpperCase().trim() === norm);
    }

    /**
     * Busca lotes por produto.
     * @param {string} productCode
     * @returns {Promise<Array>}
     */
    async getByProduct(productCode) {
        const all = await this.getAll();
        const norm = String(productCode).toUpperCase().trim();
        return all.filter(e => String(e.productCode || '').toUpperCase().trim() === norm);
    }

    // --- Ações de negócio ---

    /**
     * Envia peças para quarentena (entrada no sistema de triagem).
     * @param {Object} data - Dados do lote
     * @param {string} data.machineId
     * @param {string} data.orderNumber
     * @param {string} data.product
     * @param {string} data.productCode
     * @param {string} data.defectReason - Motivo do defeito (ex: "204-REBARBA")
     * @param {number} data.quantity     - Quantidade de peças enviadas
     * @param {string} data.turno        - Turno (1T, 2T, 3T)
     * @param {string} [data.notes]      - Observações
     * @param {string} [data.operador]   - Quem registrou
     * @returns {Promise<Object>}
     */
    async sendToQuarantine(data) {
        if (!data.machineId || !data.quantity || data.quantity <= 0) {
            throw new Error('Máquina e quantidade são obrigatórios');
        }

        const today = this._todayStr();

        return this.create({
            machineId:        data.machineId,
            orderNumber:      data.orderNumber || '',
            product:          data.product || '',
            productCode:      data.productCode || '',
            defectReason:     data.defectReason || '',
            defectCategory:   data.defectCategory || '',
            quantity:         Number(data.quantity),
            quantityApproved: 0,
            quantityRejected: 0,
            quantityPending:  Number(data.quantity),
            status:           TRIAGE_STATUS.QUARENTENA,
            quarantineDate:   data.quarantineDate || today,
            triageDate:       null,
            triageOperator:   null,
            operador:         data.operador || '',
            turno:            data.turno || '',
            notes:            data.notes || '',
            history:          []
        });
    }

    /**
     * Inicia a triagem de um lote.
     * @param {string} id - ID do documento
     * @param {string} operator - Nome/código do operador de triagem
     * @returns {Promise<void>}
     */
    async startTriage(id, operator) {
        return this.update(id, {
            status: TRIAGE_STATUS.EM_TRIAGEM,
            triageOperator: operator || '',
            triageStartedAt: new Date().toISOString()
        });
    }

    /**
     * Registra resultado parcial ou final da triagem.
     * @param {string} id
     * @param {Object} result
     * @param {number} result.approved  - Peças aprovadas nesta rodada
     * @param {number} result.rejected  - Peças refugadas nesta rodada
     * @param {string} [result.notes]   - Observações
     * @param {string} [result.operator]
     * @returns {Promise<void>}
     */
    async recordTriageResult(id, result) {
        const doc = await this.getById(id);
        if (!doc) throw new Error('Lote de triagem não encontrado');

        const approved = Number(result.approved || 0);
        const rejected = Number(result.rejected || 0);

        const newApproved = (doc.quantityApproved || 0) + approved;
        const newRejected = (doc.quantityRejected || 0) + rejected;
        const newPending  = Math.max(0, doc.quantity - newApproved - newRejected);

        const historyEntry = {
            timestamp: new Date().toISOString(),
            approved,
            rejected,
            operator: result.operator || doc.triageOperator || '',
            notes: result.notes || ''
        };

        const history = [...(doc.history || []), historyEntry];

        // Se não há mais peças pendentes → triagem concluída
        const isDone = newPending <= 0;

        return this.update(id, {
            quantityApproved: newApproved,
            quantityRejected: newRejected,
            quantityPending:  newPending,
            status:           isDone ? TRIAGE_STATUS.CONCLUIDA : TRIAGE_STATUS.EM_TRIAGEM,
            triageDate:       isDone ? this._todayStr() : (doc.triageDate || null),
            triageOperator:   result.operator || doc.triageOperator || '',
            history,
            notes: result.notes || doc.notes || ''
        });
    }

    /**
     * Encerra a triagem imediatamente — tudo que sobrou vira refugo.
     * @param {string} id
     * @param {string} [operator]
     * @param {string} [notes]
     * @returns {Promise<void>}
     */
    async finalizeTriage(id, operator, notes) {
        const doc = await this.getById(id);
        if (!doc) throw new Error('Lote de triagem não encontrado');

        const pending = doc.quantityPending || (doc.quantity - (doc.quantityApproved || 0) - (doc.quantityRejected || 0));

        const historyEntry = {
            timestamp: new Date().toISOString(),
            approved: 0,
            rejected: pending,
            operator: operator || doc.triageOperator || '',
            notes: notes || 'Triagem finalizada — peças pendentes descartadas'
        };

        const history = [...(doc.history || []), historyEntry];

        return this.update(id, {
            quantityRejected: (doc.quantityRejected || 0) + pending,
            quantityPending:  0,
            status:           TRIAGE_STATUS.CONCLUIDA,
            triageDate:       this._todayStr(),
            triageOperator:   operator || doc.triageOperator || '',
            history,
            notes: notes || doc.notes || ''
        });
    }

    // --- KPIs ---

    /**
     * Calcula KPIs de triagem.
     * @param {string} [startDate]
     * @param {string} [endDate]
     * @returns {Promise<Object>}
     */
    async getKPIs(startDate, endDate) {
        const all = await this.getAll();

        let entries = all;
        if (startDate) entries = entries.filter(e => (e.quarantineDate || '') >= startDate);
        if (endDate)   entries = entries.filter(e => (e.quarantineDate || '') <= endDate);

        const totalLots      = entries.length;
        const inQuarantine   = entries.filter(e => e.status === TRIAGE_STATUS.QUARENTENA).length;
        const inTriage       = entries.filter(e => e.status === TRIAGE_STATUS.EM_TRIAGEM).length;
        const completed      = entries.filter(e => e.status === TRIAGE_STATUS.CONCLUIDA).length;

        const totalPieces    = entries.reduce((s, e) => s + (e.quantity || 0), 0);
        const totalApproved  = entries.reduce((s, e) => s + (e.quantityApproved || 0), 0);
        const totalRejected  = entries.reduce((s, e) => s + (e.quantityRejected || 0), 0);
        const totalPending   = entries.reduce((s, e) => s + (e.quantityPending || 0), 0);

        const approvalRate   = totalPieces > 0 ? ((totalApproved / totalPieces) * 100).toFixed(1) : '0.0';

        // Top defeitos
        const defectMap = {};
        entries.forEach(e => {
            const reason = e.defectReason || 'Não informado';
            if (!defectMap[reason]) defectMap[reason] = { count: 0, qty: 0 };
            defectMap[reason].count++;
            defectMap[reason].qty += (e.quantity || 0);
        });
        const topDefects = Object.entries(defectMap)
            .map(([reason, d]) => ({ reason, ...d }))
            .sort((a, b) => b.qty - a.qty)
            .slice(0, 10);

        return {
            totalLots,
            inQuarantine,
            inTriage,
            completed,
            totalPieces,
            totalApproved,
            totalRejected,
            totalPending,
            approvalRate,
            topDefects
        };
    }

    /** Helper — data de hoje 'YYYY-MM-DD' */
    _todayStr() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
}

// Singleton
const triageService = new TriageService();

export { triageService, TriageService, TRIAGE_STATUS };
