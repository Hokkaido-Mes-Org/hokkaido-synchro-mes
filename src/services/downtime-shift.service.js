// =============================================
// DOWNTIME SHIFT SERVICE
// Sistema Robusto de Paradas V2.0 — Splitting Engine
// Pure computation: shift segmentation, consolidation, utilities
// Extraído de script.js – Phase 16
// =============================================

import {
    SHIFT_DEFINITIONS,
    getShiftForDateTime,
    formatDateYMD,
    formatTimeHM,
    pad2,
    combineDateAndTime
} from '../utils/date.utils.js';

// =============================================
// SHIFT BOUNDARY HELPERS
// =============================================

/**
 * Retorna o início do turno para uma data e turno específicos
 */
function getShiftStart(date, shift) {
    const d = new Date(date);
    switch (shift) {
        case 1: d.setHours(6, 30, 0, 0); break;
        case 2: d.setHours(15, 0, 0, 0); break;
        case 3: d.setHours(23, 20, 0, 0); break;
        default: d.setHours(6, 30, 0, 0);
    }
    return d;
}

/**
 * Retorna o fim do turno para uma data e turno específicos
 */
function getShiftEnd(date, shift) {
    const d = new Date(date);
    const hour = d.getHours();

    switch (shift) {
        case 1:
            d.setHours(14, 59, 59, 999);
            break;
        case 2:
            d.setHours(23, 19, 59, 999);
            break;
        case 3:
            if (hour >= 23) {
                d.setDate(d.getDate() + 1);
            }
            d.setHours(6, 29, 59, 999);
            break;
        default:
            d.setHours(14, 59, 59, 999);
    }
    return d;
}

// =============================================
// WORKDAY
// =============================================

/**
 * Calcula a data de produção (workday) para uma data/hora
 */
function getWorkdayForDateTime(dateTime) {
    if (!(dateTime instanceof Date) || isNaN(dateTime.getTime())) {
        return formatDateYMD(new Date());
    }

    const hour = dateTime.getHours();
    const minute = dateTime.getMinutes();
    if (hour < 6 || (hour === 6 && minute < 30)) {
        const prevDay = new Date(dateTime);
        prevDay.setDate(prevDay.getDate() - 1);
        return formatDateYMD(prevDay);
    }
    return formatDateYMD(dateTime);
}

// =============================================
// PARSE / INFER HELPERS
// =============================================

/**
 * Função auxiliar para fazer parse de data + hora
 */
function parseDateTime(dateStr, timeStr) {
    if (!dateStr || !timeStr) return null;

    try {
        const normalizedTime = timeStr.length === 5 ? `${timeStr}:00` : timeStr;
        const dateTimeStr = `${dateStr}T${normalizedTime}`;
        const dt = new Date(dateTimeStr);

        if (isNaN(dt.getTime())) {
            console.warn('[DOWNTIME] Parse falhou para:', dateTimeStr);
            return null;
        }

        return dt;
    } catch (e) {
        console.error('[DOWNTIME] Erro ao fazer parse de data:', e);
        return null;
    }
}

/**
 * Inferir turno a partir de um segmento (usa o ponto médio do intervalo)
 */
function inferShiftFromSegment(dateStr, startTimeStr, endTimeStr) {
    const toMinutes = (t) => {
        if (!t || !t.includes(':')) return null;
        const [h, m] = t.split(':').map(Number);
        if (Number.isNaN(h) || Number.isNaN(m)) return null;
        return h * 60 + m;
    };
    const startMin = toMinutes(startTimeStr);
    const endMin = toMinutes(endTimeStr);
    const refMin = (startMin !== null && endMin !== null)
        ? Math.floor((startMin + endMin) / 2)
        : (startMin !== null ? startMin : endMin);
    if (refMin === null) return null;

    if (refMin >= (7 * 60) && refMin < (15 * 60)) return 1;
    if (refMin >= (15 * 60) && refMin < (23 * 60 + 20)) return 2;
    return 3;
}

/**
 * Verifica se dois horários estão próximos (dentro de N minutos)
 */
function isTimeClose(time1, time2, toleranceMinutes = 5) {
    if (!time1 || !time2) return false;

    const toMinutes = (t) => {
        const parts = t.split(':');
        if (parts.length < 2) return null;
        const h = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        if (isNaN(h) || isNaN(m)) return null;
        return h * 60 + m;
    };

    const min1 = toMinutes(time1);
    const min2 = toMinutes(time2);

    if (min1 === null || min2 === null) return false;

    return Math.abs(min2 - min1) <= toleranceMinutes;
}

// =============================================
// SHIFT SEGMENTATION
// =============================================

/**
 * Quebra uma parada longa em segmentos por TURNO
 */
function splitDowntimeIntoShiftSegments(startDateStr, startTimeStr, endDateStr, endTimeStr) {
    const segments = [];

    const startDateTime = parseDateTime(startDateStr, startTimeStr);
    const endDateTime = parseDateTime(endDateStr, endTimeStr);

    console.log('[DOWNTIME] splitDowntimeIntoShiftSegments input:', {
        startDateStr, startTimeStr, endDateStr, endTimeStr,
        startDateTime: startDateTime?.toISOString(),
        endDateTime: endDateTime?.toISOString()
    });

    if (!startDateTime || !endDateTime) {
        console.error('[DOWNTIME] Datas inválidas:', { startDateStr, startTimeStr, endDateStr, endTimeStr });
        return segments;
    }

    const diffMs = endDateTime.getTime() - startDateTime.getTime();

    if (diffMs <= 0) {
        console.warn('[DOWNTIME] Data fim anterior ou igual à data início - criando segmento mínimo', {
            diffMs,
            start: startDateTime.toISOString(),
            end: endDateTime.toISOString()
        });
        const currentShift = getShiftForDateTime(startDateTime);
        const workday = getWorkdayForDateTime(startDateTime);
        segments.push({
            date: workday,
            startTime: formatTimeHM(startDateTime),
            endTime: formatTimeHM(startDateTime),
            duration: 1,
            shift: currentShift,
            _segmentStart: startDateTime.toISOString(),
            _segmentEnd: startDateTime.toISOString()
        });
        return segments;
    }

    if (diffMs < 60000) {
        console.log('[DOWNTIME] Parada muito curta (' + Math.round(diffMs/1000) + 's), criando segmento mínimo de 1 min');
        const currentShift = getShiftForDateTime(startDateTime);
        const workday = getWorkdayForDateTime(startDateTime);
        segments.push({
            date: workday,
            startTime: formatTimeHM(startDateTime),
            endTime: formatTimeHM(endDateTime),
            duration: 1,
            shift: currentShift,
            _segmentStart: startDateTime.toISOString(),
            _segmentEnd: endDateTime.toISOString()
        });
        return segments;
    }

    if (diffMs < 600000) {
        console.log('[DOWNTIME] Parada curta (' + Math.round(diffMs/60000) + ' min), criando segmento único');
        const currentShift = getShiftForDateTime(startDateTime);
        const workday = getWorkdayForDateTime(startDateTime);
        const durationMin = Math.max(1, Math.round(diffMs / 60000));
        segments.push({
            date: workday,
            startTime: formatTimeHM(startDateTime),
            endTime: formatTimeHM(endDateTime),
            duration: durationMin,
            shift: currentShift,
            _segmentStart: startDateTime.toISOString(),
            _segmentEnd: endDateTime.toISOString()
        });
        return segments;
    }

    let cursor = new Date(startDateTime);
    let safetyCounter = 0;
    const MAX_ITERATIONS = 1000;

    while (cursor < endDateTime && safetyCounter < MAX_ITERATIONS) {
        safetyCounter++;

        const currentShift = getShiftForDateTime(cursor);
        const shiftEndTime = getShiftEnd(cursor, currentShift);

        const segmentEnd = new Date(Math.min(shiftEndTime.getTime(), endDateTime.getTime()));

        const durationMs = segmentEnd.getTime() - cursor.getTime();

        if (durationMs <= 0) {
            console.warn('[DOWNTIME] Segmento inválido detectado. Forçando avanço mínimo.', {
                cursor: cursor.toISOString(),
                shift: currentShift,
                shiftEnd: shiftEndTime.toISOString()
            });
            cursor = new Date(cursor.getTime() + 60000);
            continue;
        }

        const durationMin = Math.max(1, Math.round(durationMs / 60000));

        const workday = getWorkdayForDateTime(cursor);

        segments.push({
            date: workday,
            startTime: formatTimeHM(cursor),
            endTime: formatTimeHM(segmentEnd),
            duration: durationMin,
            shift: currentShift,
            _segmentStart: cursor.toISOString(),
            _segmentEnd: segmentEnd.toISOString()
        });

        if (segmentEnd.getTime() >= endDateTime.getTime()) {
            break;
        }
        cursor = new Date(segmentEnd.getTime() + 60000);
    }

    if (safetyCounter >= MAX_ITERATIONS) {
        console.error('[DOWNTIME] Loop de segmentação excedeu limite de segurança');
    }

    if (segments.length === 0) {
        console.warn('[DOWNTIME] Nenhum segmento gerado, criando segmento mínimo');
        const currentShift = getShiftForDateTime(startDateTime);
        const workday = getWorkdayForDateTime(startDateTime);
        segments.push({
            date: workday,
            startTime: formatTimeHM(startDateTime),
            endTime: formatTimeHM(endDateTime),
            duration: Math.max(1, Math.round(diffMs / 60000)),
            shift: currentShift,
            _segmentStart: startDateTime.toISOString(),
            _segmentEnd: endDateTime.toISOString()
        });
    }

    console.log('[DOWNTIME] Segmentos gerados:', segments.length, segments);
    return segments;
}

/**
 * Versão legada mantida para compatibilidade
 */
function splitDowntimeIntoDailySegments(startDateStr, startTimeStr, endDateStr, endTimeStr) {
    return splitDowntimeIntoShiftSegments(startDateStr, startTimeStr, endDateStr, endTimeStr);
}

// =============================================
// CONSOLIDATION
// =============================================

/**
 * Consolida segmentos de parada em eventos únicos.
 */
function consolidateDowntimeEvents(segments = []) {
    if (!Array.isArray(segments) || segments.length === 0) {
        return [];
    }

    const MAX_DURATION_MIN = 24 * 60;
    const eventsMap = new Map();

    const sortedSegments = [...segments].sort((a, b) => {
        const machineA = a.machine || '';
        const machineB = b.machine || '';
        if (machineA !== machineB) return machineA.localeCompare(machineB);

        const dateA = a.date || a.workDay || '';
        const dateB = b.date || b.workDay || '';
        if (dateA !== dateB) return dateA.localeCompare(dateB);

        const timeA = a.startTime || '00:00';
        const timeB = b.startTime || '00:00';
        return timeA.localeCompare(timeB);
    });

    sortedSegments.forEach((segment, index) => {
        if (!segment) return;

        const raw = segment.raw || {};
        const baseStart = raw.originalStartTimestamp || null;
        const baseEnd = raw.originalEndTimestamp || null;
        const machineId = segment.machine || 'unknown-machine';
        const reason = (segment.reason || raw.reason || '').trim().toLowerCase();

        let key;
        let isGrouped = false;

        if (baseStart) {
            key = `parent|${machineId}|${baseStart}|${baseEnd || ''}`;
            isGrouped = true;
        } else if (raw.totalSegments && raw.totalSegments > 1) {
            const parentStart = raw.originalStartTimestamp || raw.startTimestamp || `${segment.date}T${segment.startTime || '00:00'}`;
            key = `segmented|${machineId}|${parentStart}`;
            isGrouped = true;
        } else {
            const segmentDate = segment.date || segment.workDay || '';
            const segmentStartTime = segment.startTime || '';

            let matchingKey = null;
            for (const [existingKey, existingEvent] of eventsMap.entries()) {
                if (!existingKey.startsWith('proximity|')) continue;
                if (existingEvent.machine !== machineId) continue;
                if (existingEvent.reason.toLowerCase() !== reason) continue;

                const eventDate = existingEvent.workDay || existingEvent.date || '';
                if (eventDate !== segmentDate) continue;

                const lastSegment = existingEvent.segments[existingEvent.segments.length - 1];
                const lastEndTime = lastSegment?.endTime || '';

                if (lastEndTime && segmentStartTime) {
                    if (segmentStartTime <= lastEndTime || isTimeClose(lastEndTime, segmentStartTime, 5)) {
                        matchingKey = existingKey;
                        break;
                    }
                }
            }

            if (matchingKey) {
                key = matchingKey;
                isGrouped = true;
            } else {
                key = `proximity|${machineId}|${segmentDate}|${segmentStartTime}|${reason.substring(0, 20)}`;
                isGrouped = false;
            }
        }

        let event = eventsMap.get(key);
        if (!event) {
            const startDateTime = baseStart ? new Date(baseStart) : combineDateAndTime(segment.date, segment.startTime);
            const endDateTime = baseEnd ? new Date(baseEnd) : combineDateAndTime(segment.date, segment.endTime);

            event = {
                id: key,
                machine: machineId,
                reason: segment.reason || raw.reason || 'Não informado',
                duration: 0,
                startDateTime: startDateTime,
                endDateTime: endDateTime,
                workDay: segment.workDay || segment.date || '',
                segments: [],
                metadata: raw,
                isGrouped: isGrouped,
                date: segment.date || ''
            };
            eventsMap.set(key, event);
        }

        const segmentDuration = Math.min(Number(segment.duration) || 0, MAX_DURATION_MIN);

        const isDuplicate = event.segments.some(s =>
            s.date === segment.date &&
            s.startTime === segment.startTime &&
            s.endTime === segment.endTime
        );

        if (!isDuplicate) {
            event.duration += segmentDuration;
            event.segments.push(segment);

            const segStart = combineDateAndTime(segment.date, segment.startTime);
            const segEnd = combineDateAndTime(segment.date, segment.endTime);

            if (segStart && (!event.startDateTime || segStart < event.startDateTime)) {
                event.startDateTime = segStart;
            }
            if (segEnd && (!event.endDateTime || segEnd > event.endDateTime)) {
                event.endDateTime = segEnd;
            }

            if (segment.workDay && (!event.workDay || segment.workDay < event.workDay)) {
                event.workDay = segment.workDay;
            }
        }
    });

    return Array.from(eventsMap.values()).map(event => {
        const cappedDuration = Math.min(event.duration, MAX_DURATION_MIN);

        const startDate = event.startDateTime ? formatDateYMD(event.startDateTime) : (event.segments[0]?.date || '');
        const endDate = event.endDateTime ? formatDateYMD(event.endDateTime) : (event.segments[event.segments.length - 1]?.date || '');
        const startTime = event.startDateTime ? formatTimeHM(event.startDateTime) : (event.segments[0]?.startTime || '');
        const endTime = event.endDateTime ? formatTimeHM(event.endDateTime) : (event.segments[event.segments.length - 1]?.endTime || '');

        return {
            id: event.id,
            machine: event.machine,
            reason: event.reason,
            duration: cappedDuration,
            date: startDate,
            workDay: event.workDay || startDate,
            startTime,
            endTime,
            startDateTime: event.startDateTime,
            endDateTime: event.endDateTime,
            shift: event.segments[0]?.shift || inferShiftFromSegment(event.workDay || startDate, startTime, endTime),
            segments: event.segments,
            segmentCount: event.segments.length,
            raw: event.metadata
        };
    });
}

// =============================================
// PERIOD HOURS
// =============================================

function calculateHoursInPeriod(startDate, endDate) {
    if (!startDate || !endDate) return 0;

    const start = new Date(`${startDate}T07:00:00`);
    let end = new Date(`${endDate}T07:00:00`);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return 0;
    }

    if (end <= start) {
        end = new Date(start);
        end.setDate(end.getDate() + 1);
    }

    const diffHours = (end - start) / (1000 * 60 * 60);
    return Math.max(24, diffHours);
}

// =============================================
// WINDOW EXPORTS
// =============================================
window.SHIFT_DEFINITIONS = SHIFT_DEFINITIONS;
window.getShiftForDateTime = getShiftForDateTime;
window.getShiftStart = getShiftStart;
window.getShiftEnd = getShiftEnd;
window.getWorkdayForDateTime = getWorkdayForDateTime;
window.parseDateTime = parseDateTime;
window.inferShiftFromSegment = inferShiftFromSegment;
window.isTimeClose = isTimeClose;
window.splitDowntimeIntoShiftSegments = splitDowntimeIntoShiftSegments;
window.splitDowntimeIntoDailySegments = splitDowntimeIntoDailySegments;
window.consolidateDowntimeEvents = consolidateDowntimeEvents;
window.calculateHoursInPeriod = calculateHoursInPeriod;
window.combineDateAndTime = combineDateAndTime;
window.formatDateYMD = formatDateYMD;
window.formatTimeHM = formatTimeHM;

// =============================================
// ES6 EXPORTS (for controllers that can import directly)
// =============================================
export {
    getShiftStart,
    getShiftEnd,
    getWorkdayForDateTime,
    parseDateTime,
    inferShiftFromSegment,
    isTimeClose,
    splitDowntimeIntoShiftSegments,
    splitDowntimeIntoDailySegments,
    consolidateDowntimeEvents,
    calculateHoursInPeriod,
    // Re-exports from date.utils
    SHIFT_DEFINITIONS,
    getShiftForDateTime,
    formatDateYMD,
    formatTimeHM,
    pad2,
    combineDateAndTime
};

export function initDowntimeShift() {
    console.log('[DOWNTIME-SHIFT] Service inicializado');
}
