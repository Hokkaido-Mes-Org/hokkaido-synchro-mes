// =============================================
// OEE UTILS — Fonte Única de Verdade
// Fase 1: Unificação das funções de cálculo OEE
// Criado: 2026-02-23
// =============================================

/**
 * Configuração de turnos.
 * Futuramente migrar para Firestore (system_config/oee_config).
 */
const SHIFT_CONFIG = Object.freeze({
    T1: { start: '06:30', end: '15:00', minutes: 510 },
    T2: { start: '15:00', end: '23:20', minutes: 500 },
    T3: { start: '23:20', end: '06:30', minutes: 430 },
    DEFAULT_MINUTES: 480
});

/**
 * Sanitiza um valor numérico: NaN/Infinity → 0, clamp [0, 1].
 * @param {number} v
 * @returns {number}
 */
function _safe(v) {
    return (isNaN(v) || !isFinite(v)) ? 0 : Math.max(0, Math.min(1, v));
}

/**
 * Retorna a duração em minutos para um turno.
 * @param {string|number|null} turno — 'T1' | 'T2' | 'T3' | 1 | 2 | 3 | null
 * @returns {number}
 */
function getShiftMinutes(turno) {
    if (!turno) return SHIFT_CONFIG.DEFAULT_MINUTES;
    const key = typeof turno === 'string'
        ? turno.toUpperCase()
        : `T${turno}`;
    return SHIFT_CONFIG[key]?.minutes ?? SHIFT_CONFIG.DEFAULT_MINUTES;
}

/**
 * Seleciona ciclo e cavidades corretos para um turno específico.
 * Resolve o bug de usar `||` que sempre pegava T1 independente do turno.
 *
 * @param {Object} planRaw — Objeto raw do plano (com real_cycle_t1, active_cavities_t2, etc.)
 * @param {string|number|null} turno — 'T1' | 1 | 'T2' | 2 | 'T3' | 3 | null
 * @returns {{ ciclo: number, cavidades: number }}
 */
function getPlanParamsForShift(planRaw, turno) {
    const raw = planRaw || {};

    // Normalizar turno para número: 'T2' → 2, 2 → 2
    let shiftNum = null;
    if (turno != null) {
        shiftNum = typeof turno === 'string'
            ? Number(turno.replace(/\D/g, ''))
            : Number(turno);
        if (!shiftNum || shiftNum < 1 || shiftNum > 3) shiftNum = null;
    }

    let ciclo, cavidades;

    if (shiftNum) {
        // Buscar valores específicos do turno, fallback para orçado/global
        ciclo = Number(raw[`real_cycle_t${shiftNum}`]) || Number(raw.budgeted_cycle) || 0;
        cavidades = Number(raw[`active_cavities_t${shiftNum}`])
                 || Number(raw[`active_cavities_T${shiftNum}`])
                 || Number(raw[`activeCavitiesT${shiftNum}`])
                 || Number(raw.mold_cavities)
                 || Number(raw.cavities)
                 || 0;
    } else {
        // Sem turno definido: usar orçado/global
        ciclo = Number(raw.budgeted_cycle) || 0;
        cavidades = Number(raw.mold_cavities) || Number(raw.cavities) || 0;
    }

    return { ciclo, cavidades };
}

/**
 * Calcula OEE para um turno completo (D × P × Q).
 *
 * Performance é SEMPRE baseada em capacidade teórica (ciclo × cavidades),
 * NUNCA em meta comercial (planned_quantity).
 *
 * @param {Object} params
 * @param {number} params.produzido        — Peças boas produzidas
 * @param {number} params.tempoParadaMin   — Minutos de parada (excluindo categorias isentas)
 * @param {number} params.refugoPcs        — Peças refugadas (em peças, não kg)
 * @param {number} params.cicloSeg         — Tempo de ciclo em segundos
 * @param {number} params.cavidades        — Cavidades ativas do molde
 * @param {string|number|null} [params.turno] — Turno para usar duração correta (opcional)
 * @returns {{ disponibilidade: number, performance: number, qualidade: number, oee: number, _debug: Object }}
 */
function calculateOEE({ produzido, tempoParadaMin, refugoPcs, cicloSeg, cavidades, turno }) {
    const tempoProgramado = getShiftMinutes(turno);

    // Disponibilidade
    const tempoProduzindo = Math.max(0, tempoProgramado - Math.max(0, tempoParadaMin || 0));
    const disponibilidade = tempoProgramado > 0
        ? tempoProduzindo / tempoProgramado
        : 0;

    // Performance (capacidade teórica)
    const producaoTeorica = (cicloSeg > 0 && cavidades > 0)
        ? (tempoProduzindo * 60 / cicloSeg) * cavidades
        : 0;
    const performance = producaoTeorica > 0
        ? Math.min(1, Math.max(0, produzido || 0) / producaoTeorica)
        : ((produzido || 0) > 0 ? 1 : 0);

    // Qualidade: P / (P + R)  — consistente em todas as telas
    const boas = Math.max(0, produzido || 0);
    const refugo = Math.max(0, refugoPcs || 0);
    const totalProduzido = boas + refugo;
    const qualidade = totalProduzido > 0
        ? boas / totalProduzido
        : ((produzido || 0) > 0 ? 1 : 0);

    // OEE
    const oee = disponibilidade * performance * qualidade;

    return {
        disponibilidade: _safe(disponibilidade),
        performance: _safe(performance),
        qualidade: _safe(qualidade),
        oee: _safe(oee),
        _debug: { tempoProgramado, tempoProduzindo, producaoTeorica, cicloSeg, cavidades }
    };
}

/**
 * Wrapper de compatibilidade: mesma assinatura da função legada calculateShiftOEE.
 * Delega para calculateOEE mantendo interface 100% retrocompatível.
 *
 * @param {number} produzido
 * @param {number} tempoParadaMin
 * @param {number} refugoPcs
 * @param {number} cicloReal
 * @param {number} cavAtivas
 * @param {string|number|null} [turno]  — parâmetro NOVO (opcional, backward-compatible)
 * @returns {{ disponibilidade: number, performance: number, qualidade: number, oee: number }}
 */
function calculateShiftOEE(produzido, tempoParadaMin, refugoPcs, cicloReal, cavAtivas, turno) {
    const result = calculateOEE({
        produzido,
        tempoParadaMin,
        refugoPcs,
        cicloSeg: cicloReal,
        cavidades: cavAtivas,
        turno: turno || null
    });
    // Retornar sem _debug para manter interface legada limpa
    return {
        disponibilidade: result.disponibilidade,
        performance: result.performance,
        qualidade: result.qualidade,
        oee: result.oee
    };
}

/**
 * Calcula OEE em tempo real para turno parcial (turno ainda em andamento).
 *
 * @param {Object} params
 * @param {number} params.produzido          — Peças boas produzidas até agora
 * @param {number} params.tempoDecorridoMin  — Minutos decorridos desde o início do turno
 * @param {number} params.tempoParadaMin     — Minutos de parada acumulados
 * @param {number} params.refugoPcs          — Peças refugadas
 * @param {number} params.cicloSeg           — Tempo de ciclo em segundos
 * @param {number} params.cavidades          — Cavidades ativas do molde
 * @returns {{ disponibilidade: number, performance: number, qualidade: number, oee: number, isRealTime: boolean, tempoDecorrido: number }}
 */
function calculateRealTimeShiftOEE({ produzido, tempoDecorridoMin, tempoParadaMin, refugoPcs, cicloSeg, cavidades }) {
    const tempoProduzindo = Math.max(0, (tempoDecorridoMin || 0) - Math.max(0, tempoParadaMin || 0));

    const disponibilidade = (tempoDecorridoMin || 0) > 0
        ? tempoProduzindo / tempoDecorridoMin
        : 0;

    const producaoTeorica = (cicloSeg > 0 && cavidades > 0)
        ? (tempoProduzindo * 60 / cicloSeg) * cavidades
        : 0;
    const performance = producaoTeorica > 0
        ? Math.min(1, Math.max(0, produzido || 0) / producaoTeorica)
        : ((produzido || 0) > 0 ? 1 : 0);

    const boas = Math.max(0, produzido || 0);
    const refugo = Math.max(0, refugoPcs || 0);
    const totalProduzido = boas + refugo;
    const qualidade = totalProduzido > 0
        ? boas / totalProduzido
        : ((produzido || 0) > 0 ? 1 : 0);

    const oee = disponibilidade * performance * qualidade;

    return {
        disponibilidade: _safe(disponibilidade),
        performance: _safe(performance),
        qualidade: _safe(qualidade),
        oee: _safe(oee),
        isRealTime: true,
        tempoDecorrido: tempoDecorridoMin
    };
}

// =============================================
// WINDOW EXPORTS — expor globalmente para legado
// =============================================
window.oeeUtils = Object.freeze({
    SHIFT_CONFIG,
    getShiftMinutes,
    getPlanParamsForShift,
    calculateOEE,
    calculateShiftOEE,
    calculateRealTimeShiftOEE,
    _safe
});

// Manter compatibilidade: window.calculateShiftOEE aponta para a versão unificada
window.calculateShiftOEE = calculateShiftOEE;

// ES6 exports para uso via import
export {
    SHIFT_CONFIG,
    getShiftMinutes,
    getPlanParamsForShift,
    calculateOEE,
    calculateShiftOEE,
    calculateRealTimeShiftOEE,
    _safe
};
