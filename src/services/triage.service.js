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
     * @returns {Promise<Object>} — Retorna { doc, approved, rejected, isDone }
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

        await this.update(id, {
            quantityApproved: newApproved,
            quantityRejected: newRejected,
            quantityPending:  newPending,
            status:           isDone ? TRIAGE_STATUS.CONCLUIDA : TRIAGE_STATUS.EM_TRIAGEM,
            triageDate:       isDone ? this._todayStr() : (doc.triageDate || null),
            triageOperator:   result.operator || doc.triageOperator || '',
            history,
            notes: result.notes || doc.notes || ''
        });

        return { doc: { ...doc, quantityApproved: newApproved, quantityRejected: newRejected, quantityPending: newPending }, approved, rejected, isDone };
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
     * Retorna peças aprovadas na triagem para a produção da OP de origem.
     * Cria um registro em production_entries com as peças aprovadas como produção.
     * @param {Object} triageDoc - Documento de triagem com dados do lote
     * @param {number} approvedQty - Quantidade aprovada nesta rodada
     * @param {string} operator - Operador que executou a triagem
     * @returns {Promise<{success: boolean, productionEntryId: string|null}>}
     */
    async returnToProduction(triageDoc, approvedQty, operator) {
        if (!approvedQty || approvedQty <= 0) {
            return { success: false, productionEntryId: null };
        }

        try {
            const db = firebase.firestore();

            // Resolver peso unitário do produto
            let pieceWeightG = triageDoc.pieceWeight || 0;
            if (!pieceWeightG && triageDoc.productCode && window.productByCode) {
                const prod = window.productByCode.get(Number(triageDoc.productCode));
                if (prod && prod.weight) pieceWeightG = prod.weight;
            }

            // Calcular peso total das peças aprovadas (em kg)
            const pesoKg = pieceWeightG > 0 ? Number(((approvedQty * pieceWeightG) / 1000).toFixed(3)) : 0;

            // Resolver planId da máquina/ordem se possível
            let planId = triageDoc.planId || null;
            if (!planId && triageDoc.orderNumber && window.machineCardData) {
                // Tentar encontrar o plano pela máquina
                const machineData = window.machineCardData[triageDoc.machineId];
                if (machineData) {
                    const plans = Array.isArray(machineData) ? machineData : [machineData];
                    const matchingPlan = plans.find(p => 
                        String(p.order_number || p.order_number_original || '') === String(triageDoc.orderNumber)
                    ) || plans[0];
                    if (matchingPlan) planId = matchingPlan.id;
                }
            }

            const turnoNorm = (triageDoc.turno || '').replace('T', '');
            const turnoNum = parseInt(turnoNorm, 10) || null;

            const productionEntry = {
                planId: planId,
                data: this._todayStr(),
                turno: turnoNum || 1,
                produzido: approvedQty,
                peso_bruto: pesoKg,
                refugo_kg: 0,
                refugo_qty: 0,
                perdas: '',
                observacoes: `Retorno de triagem: ${approvedQty} peças aprovadas (lote: ${triageDoc.id || 'N/A'})`,
                machine: triageDoc.machineId || null,
                product_cod: triageDoc.productCode || '',
                product: triageDoc.product || '',
                orderId: triageDoc.orderId || null,
                orderNumber: triageDoc.orderNumber || null,
                manual: true,
                isTriageReturn: true,
                triageEntryId: triageDoc.id || null,
                registradoPor: operator || '',
                registradoPorNome: operator || '',
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            const docRef = await db.collection('production_entries').add(productionEntry);

            console.log(`[Triage] ✅ Retorno à produção: ${approvedQty} peças → production_entries/${docRef.id} (OP: ${triageDoc.orderNumber || 'N/A'})`);

            return { success: true, productionEntryId: docRef.id };
        } catch (err) {
            console.error('[Triage] ❌ Erro ao retornar peças à produção:', err);
            return { success: false, productionEntryId: null };
        }
    }

    /**
     * Calcula total de peças em triagem/quarentena que impactam qualidade do OEE.
     * Peças pendentes + em quarentena são consideradas "não-conformes" até serem triadas.
     * @param {string} [machineId] - Filtrar por máquina
     * @param {string} [date] - Filtrar por data (YYYY-MM-DD)
     * @param {string|number} [turno] - Filtrar por turno
     * @returns {Promise<{totalPending: number, totalRejected: number, totalForOEE: number}>}
     */
    async getTriagePiecesForOEE(machineId, date, turno) {
        let entries = await this.getAll();

        // Filtrar apenas lotes ativos (não concluídos retornam pendentes como impacto)
        // Lotes concluídos retornam apenas refugadas
        if (machineId) {
            const mid = machineId.toUpperCase().trim();
            entries = entries.filter(e => (e.machineId || '').toUpperCase().trim() === mid);
        }

        if (date) {
            entries = entries.filter(e => (e.quarantineDate || '') === date);
        }

        if (turno) {
            const t = String(turno).replace('T', '');
            entries = entries.filter(e => {
                const et = String(e.turno || '').replace('T', '');
                return et === t;
            });
        }

        // Peças pendentes em quarentena/triagem contam como "não-conformes" no OEE
        const totalPending = entries
            .filter(e => e.status !== TRIAGE_STATUS.CONCLUIDA)
            .reduce((s, e) => s + (e.quantityPending || 0), 0);

        // Peças rejeitadas (de todos os lotes) contam como refugo
        const totalRejected = entries.reduce((s, e) => s + (e.quantityRejected || 0), 0);

        // Total que impacta qualidade no OEE = pendentes + rejeitadas
        return {
            totalPending,
            totalRejected,
            totalForOEE: totalPending + totalRejected
        };
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
