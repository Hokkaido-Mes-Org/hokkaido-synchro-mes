// ============================================================
// src/utils/color.utils.js  — Phase 17: Color, Formatting & Reasons utilities
// Extracted from script.js L3622-3854 (pure computation, zero DOM/Firebase)
// ============================================================

// ─── Constantes ───────────────────────────────────────────────
export const PRODUCTION_DAY_START_HOUR = 7;
export const HOURS_IN_PRODUCTION_DAY = 24;

export const PROGRESS_PALETTE = {
    danger: { start: '#ef4444', end: '#f87171', textClass: 'text-red-600' },
    warning: { start: '#f59e0b', end: '#fbbf24', textClass: 'text-amber-500' },
    success: { start: '#10b981', end: '#34d399', textClass: 'text-emerald-600' }
};

export const ANALYSIS_LINE_COLORS = [
    { border: '#2563EB', fill: 'rgba(37, 99, 235, 0.15)' },
    { border: '#10B981', fill: 'rgba(16, 185, 129, 0.15)' },
    { border: '#F59E0B', fill: 'rgba(245, 158, 11, 0.15)' },
    { border: '#9333EA', fill: 'rgba(147, 51, 234, 0.15)' },
    { border: '#EC4899', fill: 'rgba(236, 72, 153, 0.15)' },
    { border: '#0EA5E9', fill: 'rgba(14, 165, 233, 0.15)' },
    { border: '#22C55E', fill: 'rgba(34, 197, 94, 0.15)' },
    { border: '#F97316', fill: 'rgba(249, 115, 22, 0.15)' }
];

// ─── Funções de Cor ──────────────────────────────────────────

/**
 * Converte hex (#RRGGBB ou #RGB) para {r, g, b}
 */
export function hexToRgb(hex) {
    if (!hex) return { r: 0, g: 0, b: 0 };
    const normalized = hex.replace('#', '');
    const expanded = normalized.length === 3
        ? normalized.split('').map((char) => char + char).join('')
        : normalized.padEnd(6, '0');
    const value = parseInt(expanded, 16);
    return {
        r: (value >> 16) & 255,
        g: (value >> 8) & 255,
        b: value & 255
    };
}

/**
 * Converte {r, g, b} para hex #RRGGBB
 */
export function rgbToHex({ r, g, b }) {
    const clamp = (value) => Math.max(0, Math.min(255, Math.round(value)));
    const toHex = (value) => clamp(value).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Mistura duas cores hex com um fator de 0-1
 */
export function mixHexColors(hexA, hexB, factor = 0) {
    const ratio = Math.max(0, Math.min(1, factor));
    const colorA = hexToRgb(hexA);
    const colorB = hexToRgb(hexB);
    const mixChannel = (channel) => colorA[channel] + (colorB[channel] - colorA[channel]) * ratio;
    return rgbToHex({
        r: mixChannel('r'),
        g: mixChannel('g'),
        b: mixChannel('b')
    });
}

/**
 * Retorna paleta de progresso (start, end, textClass) baseada em percentual
 */
export function resolveProgressPalette(percent = 0) {
    const clamped = Math.max(0, percent);
    if (clamped >= 85) {
        return {
            start: PROGRESS_PALETTE.success.start,
            end: PROGRESS_PALETTE.success.end,
            textClass: PROGRESS_PALETTE.success.textClass
        };
    }

    if (clamped <= 60) {
        const ratio = Math.min(clamped / 60, 1);
        return {
            start: mixHexColors(PROGRESS_PALETTE.danger.start, PROGRESS_PALETTE.warning.start, ratio),
            end: mixHexColors(PROGRESS_PALETTE.danger.end, PROGRESS_PALETTE.warning.end, ratio),
            textClass: clamped >= 45 ? PROGRESS_PALETTE.warning.textClass : PROGRESS_PALETTE.danger.textClass
        };
    }

    const transitionRatio = Math.min((clamped - 60) / 25, 1);
    return {
        start: mixHexColors(PROGRESS_PALETTE.warning.start, PROGRESS_PALETTE.success.start, transitionRatio),
        end: mixHexColors(PROGRESS_PALETTE.warning.end, PROGRESS_PALETTE.success.end, transitionRatio),
        textClass: clamped >= 75 ? PROGRESS_PALETTE.success.textClass : PROGRESS_PALETTE.warning.textClass
    };
}

/**
 * Converte hex para rgba com alpha
 */
export function hexWithAlpha(hex, alpha) {
    const { r, g, b } = hexToRgb(hex);
    return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
}

// ─── Funções de Formatação de Hora/Data ──────────────────────

/**
 * Formata valor de hora (0-23) para "HH:00"
 */
export function formatHourLabel(hourValue) {
    const normalized = ((hourValue % 24) + 24) % 24;
    return `${String(normalized).padStart(2, '0')}:00`;
}

/**
 * Formata "YYYY-MM-DD" para "DD/MM" (pt-BR curto)
 */
export function formatShortDateLabel(dateStr) {
    if (!dateStr) return '--';
    const safeValue = String(dateStr).slice(0, 10);
    const parsed = new Date(`${safeValue}T00:00:00`);
    if (!Number.isNaN(parsed.getTime())) {
        return parsed.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    }
    const parts = safeValue.split('-');
    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}`;
    }
    return safeValue;
}

/**
 * Retorna array ordenado de horas de produção ["07:00", "08:00", ..., "06:00"]
 */
export function getProductionHoursOrder() {
    const ordered = [];
    for (let hour = PRODUCTION_DAY_START_HOUR; hour < 24; hour++) {
        ordered.push(formatHourLabel(hour));
    }
    for (let hour = 0; hour < PRODUCTION_DAY_START_HOUR; hour++) {
        ordered.push(formatHourLabel(hour));
    }
    return ordered;
}

/**
 * Retorna label de hora de produção para um Date
 */
export function getProductionHourLabel(date = new Date()) {
    return formatHourLabel(date.getHours());
}

/**
 * Calcula horas decorridas no dia de produção (07:00-07:00)
 */
export function getHoursElapsedInProductionDay(date = new Date()) {
    const reference = new Date(date);
    if (Number.isNaN(reference.getTime())) return 0;

    const productionStart = new Date(reference);
    if (productionStart.getHours() < PRODUCTION_DAY_START_HOUR) {
        productionStart.setDate(productionStart.getDate() - 1);
    }
    productionStart.setHours(PRODUCTION_DAY_START_HOUR, 0, 0, 0);

    const diffMs = Math.max(0, reference.getTime() - productionStart.getTime());
    const elapsedHours = Math.floor(diffMs / (60 * 60 * 1000));
    const clamped = Math.min(elapsedHours + 1, HOURS_IN_PRODUCTION_DAY);
    return Math.max(0, clamped);
}

// ─── Funções de Turno / Motivos ─────────────────────────────

/**
 * Formata chave de turno ("T1" → "1º Turno")
 */
export function formatShiftLabel(shiftKey) {
    switch (shiftKey) {
        case 'T1':
            return '1º Turno';
        case 'T2':
            return '2º Turno';
        case 'T3':
            return '3º Turno';
        default:
            return 'Turno atual';
    }
}

/**
 * Retorna motivos de perda agrupados por categoria
 */
export function getGroupedLossReasons() {
    if (window.databaseModule && window.databaseModule.groupedLossReasons) {
        return window.databaseModule.groupedLossReasons;
    }
    return {
        "PROCESSO": [
            "FALHA DE INJEÇÃO", "CONTAMINAÇÃO", "PONTO ALTO DE INJEÇÃO / FIAPO", "REBARBA",
            "FORA DE COR", "FORA DE DIMENSIONAL", "REINICIO/INICIO", "CHUPAGEM",
            "BOLHA", "QUEIMA", "MANCHAS", "JUNÇÃO", "EMPENAMENTO",
            "PEÇAS SCRAP", "PEÇAS DEFORMADAS"
        ],
        "FERRAMENTARIA": [
            "GALHO PRESO", "MARCA D'AGUA", "MARCA DE EXTRATOR", "RISCO",
            "SUJIDADE MOLDE", "LAMINA QUEBRADA", "TRY OUT", "LIMPEZA DE TIPS",
            "ABERTURA DE CAVIDADES"
        ],
        "MAQUINA": [
            "QUEDA DE ENERGIA", "PARADA EMERGENCIAL", "VAZAMENTO DE OLEO",
            "AUSENCIA DE PERIFERICOS", "SUJIDADE (GRAXA, AGUA, ETC)"
        ],
        "MATERIA PRIMA": [
            "MATERIAL NÃO CONFORME"
        ]
    };
}

/**
 * Retorna motivos de parada agrupados por categoria
 */
export function getGroupedDowntimeReasons() {
    if (window.databaseModule && window.databaseModule.groupedDowntimeReasons) {
        return window.databaseModule.groupedDowntimeReasons;
    }
    return {
        "FERRAMENTARIA": ["CORRETIVA DE MOLDE", "PREVENTIVA DE MOLDE", "TROCA DE VERSÃO"],
        "PROCESSO": ["ABERTURA DE CAVIDADE", "AJUSTE DE PROCESSO", "FECHAMENTO DE CAVIDADE", "TRY OUT", "PRENDENDO GALHO", "PRENDENDO PEÇAS"],
        "COMPRAS": ["FALTA DE MATÉRIA PRIMA", "FALTA DE SACO PLÁSTICO", "FALTA DE CAIXA DE PAPELÃO", "FALTA DE MASTER", "ANÁLISE ADMINISTRATIVA", "LEAD TIME"],
        "PREPARAÇÃO": ["AGUARDANDO PREPARAÇÃO DE MATERIAL", "AGUARDANDO ESTUFAGEM DE M.P", "FORA DE COR", "TESTE DE COR", "MATERIAL CONTAMINADO"],
        "QUALIDADE": ["AGUARDANDO CLIENTE/FORNECEDOR", "LIBERAÇÃO INÍCIAL", "AGUARDANDO DISPOSIÇÃO DA QUALIDADE"],
        "MANUTENÇÃO": ["MANUTENÇÃO CORRETIVA", "MANUTENÇÃO PREVENTIVA", "MANUTENÇÃO EXTERNA"],
        "PRODUÇÃO": ["FALTA DE OPERADOR", "TROCA DE COR", "F.O REVEZAMENTO ALMOÇO", "F.O REVEZAMENTO JANTA", "INICIO/REINICIO"],
        "SETUP": ["INSTALAÇÃO DE MOLDE", "RETIRADA DE MOLDE", "INSTALAÇÃO DE PERÍFÉRICOS", "AGUARDANDO SETUP"],
        "ADMINISTRATIVO": ["FALTA DE ENERGIA"],
        "PCP": ["SEM PROGRAMAÇÃO", "SEM PROGRAMAÇÃO-FIM DE SEMANA", "ESTRATÉGIA PCP"],
        "COMERCIAL": ["SEM PEDIDO", "PARADA COMERCIAL", "BAIXA DEMANDA"],
        "OUTROS": ["VAZAMENTO DO BICO", "QUEIMA DE RESISTÊNCIA"]
    };
}

/**
 * Obtém a categoria de um motivo de parada
 */
export function getDowntimeCategory(reason) {
    if (!reason) return 'OUTROS';

    const reasonUpper = reason.trim().toUpperCase();

    // Mapeamento especial para motivos comuns
    const specialReasonMapping = {
        'FIM DE SEMANA': 'PCP',
        'MANUTENÇÃO PREVENTIVA': 'MANUTENÇÃO',
        'MANUTENÇÃO PROGRAMADA': 'MANUTENÇÃO',
        'FERIADO': 'ADMINISTRATIVO',
        'SETUP/TROCA': 'SETUP',
        'PARADA COMERCIAL': 'COMERCIAL',
        'SEM PEDIDO': 'COMERCIAL',
        'BAIXA DEMANDA': 'COMERCIAL',
        'PARADA LONGA': 'OUTROS',
        'OUTROS (PARADA LONGA)': 'OUTROS'
    };

    if (specialReasonMapping[reasonUpper]) {
        return specialReasonMapping[reasonUpper];
    }

    const grouped = getGroupedDowntimeReasons();

    for (const [category, reasons] of Object.entries(grouped)) {
        const reasonsUpper = reasons.map(r => r.toUpperCase());
        if (reasonsUpper.includes(reasonUpper)) {
            return category;
        }
    }
    return 'OUTROS';
}

// ─── Window exports (para script.js closure callers) ─────────
window.PRODUCTION_DAY_START_HOUR = PRODUCTION_DAY_START_HOUR;
window.HOURS_IN_PRODUCTION_DAY = HOURS_IN_PRODUCTION_DAY;
window.ANALYSIS_LINE_COLORS = ANALYSIS_LINE_COLORS;
window.hexToRgb = hexToRgb;
window.rgbToHex = rgbToHex;
window.mixHexColors = mixHexColors;
window.resolveProgressPalette = resolveProgressPalette;
window.hexWithAlpha = hexWithAlpha;
window.formatHourLabel = formatHourLabel;
window.formatShortDateLabel = formatShortDateLabel;
window.getProductionHoursOrder = getProductionHoursOrder;
window.getProductionHourLabel = getProductionHourLabel;
window.getHoursElapsedInProductionDay = getHoursElapsedInProductionDay;
window.formatShiftLabel = formatShiftLabel;
window.getGroupedLossReasons = getGroupedLossReasons;
window.getGroupedDowntimeReasons = getGroupedDowntimeReasons;
window.getDowntimeCategory = getDowntimeCategory;

console.log('[COLOR.UTILS] Módulo carregado — 14 funções + 4 constantes');
