/**
 * HokkaidoMES — Feature Flags
 * 
 * Fase 5: Bridge code removal em andamento.
 *   - Fase 4: Gates sem fallback legado, import() direto.
 *   - Fase 5A: Removido código morto (reports stubs/dead), bridge monitoring,
 *              admin (64-70), historico. Bug 2nd init() corrigido. (-5.998 linhas)
 *   - Fase 5B: Removido bridge quality + quality hourly.
 *              init() não chama mais setup*Tab() de abas não-padrão. (-1.838 linhas)
 *   - Total Fase 5: ~7.836 linhas removidas. script.js: 43.796 → 35.960 linhas.
 *   - Bloqueio: Controllers usam window.* forwarding para funções do closure.
 *              Bridge analysis/orders/planning/launch não pode ser removido
 *              até controllers importarem de módulos ES6 compartilhados.
 */

export const FLAGS = {
    // ── Controllers: Todos migrados (Fase 4 — sem fallback legado) ──
    USE_MODULAR_PCP: true,
    USE_MODULAR_TOOLING: true,
    USE_MODULAR_SETUP: true,
    USE_MODULAR_REPORTS: true,
    USE_MODULAR_LEADERSHIP: true,
    USE_MODULAR_ORDERS: true,
    USE_MODULAR_MONITORING: true,
    USE_MODULAR_ADMIN: true,
    USE_MODULAR_HISTORICO: true,
    USE_MODULAR_PMP: true,
    USE_MODULAR_QUALITY: true,
    USE_MODULAR_PLANNING: true,
    USE_MODULAR_ANALYSIS: true,
    USE_MODULAR_LAUNCH: true,
    USE_MODULAR_EXTENDED_DOWNTIME: true,
    USE_MODULAR_DOWNTIME_GRID: true,
    USE_MODULAR_DASHBOARD: true,
    USE_MODULAR_RESUMO: true,
    USE_MODULAR_DOWNTIME_SHIFT: true,
    USE_MODULAR_COLOR_UTILS: true,

    // ── Debug ──
    LOG_SERVICE_CALLS: false,
    LOG_CACHE_HITS: false,
    LOG_EVENT_BUS: false,
};

/**
 * Verifica se uma feature flag está ativa.
 * @param {string} flagName
 * @returns {boolean}
 */
export function isEnabled(flagName) {
    return FLAGS[flagName] === true;
}
