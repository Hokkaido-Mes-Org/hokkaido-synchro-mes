// =============================================
// RESUMO + OEE CONTROLLER
// Aba de Análise: Resumo (Relatórios Quantitativo / Eficiência)
// + OEE Calculation Helpers (calculateShiftOEE, calculateRealTimeOEE)
// + OEE History (save/load/group)
// Extraído de script.js – Phase 15
// =============================================
import { getDowntimeCategory } from '../utils/color.utils.js';
import { calculateShiftOEE, calculateRealTimeShiftOEE, getPlanParamsForShift } from '../utils/oee.utils.js';

// ─── Window-forwarded dependencies (closure functions from script.js) ───
const db = (() => { try { return firebase.firestore(); } catch { return null; } })();
const showLoadingState = (...args) => window.showLoadingState?.(...args);
const getProductionDateString = (...args) => window.getProductionDateString?.(...args);
const getPlanningCached = (...args) => window.getPlanningCached?.(...args);
const isPlanActive = (...args) => window.isPlanActive?.(...args);
const showConfirmModal = (...args) => window.showConfirmModal?.(...args);
const coerceToNumber = (...args) => window.coerceToNumber?.(...args);

// ─── Module State ───
let currentReportData = [];

// ─── DOM Helpers ───
function getResumoDateSelector() { return document.getElementById('resumo-date-selector'); }
function getResumoContentContainer() { return document.getElementById('resumo-content-container'); }
function getReportQuantBtn() { return document.getElementById('report-quant-btn'); }
function getReportEfficBtn() { return document.getElementById('report-effic-btn'); }

// =============================================
// OEE CALCULATION HELPERS
// Fase 1: Delegam para src/utils/oee.utils.js (fonte única de verdade)
// calculateShiftOEE importado de oee.utils.js
// =============================================

function calculateRealTimeOEE(data) {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    // Determinar turno atual - T1: 06:30-14:59, T2: 15:00-23:19, T3: 23:20-06:29
    let currentShift;
    if ((currentHour === 6 && currentMinute >= 30) || (currentHour >= 7 && currentHour < 15)) {
        currentShift = 'T1';
    } else if (currentHour >= 15 && (currentHour < 23 || (currentHour === 23 && currentMinute < 20))) {
        currentShift = 'T2';
    } else {
        currentShift = 'T3';
    }

    // Calcular tempo decorrido no turno atual
    let tempoDecorridoMin;
    if (currentShift === 'T1') {
        tempoDecorridoMin = (currentHour - 6) * 60 + currentMinute - 30;
    } else if (currentShift === 'T2') {
        tempoDecorridoMin = (currentHour - 15) * 60 + currentMinute;
    } else {
        if (currentHour >= 23) {
            tempoDecorridoMin = (currentHour - 23) * 60 + (currentMinute - 20);
        } else {
            tempoDecorridoMin = (currentHour + 1) * 60 + currentMinute;
        }
    }

    const maxTurnoMin = currentShift === 'T1' ? 510 : (currentShift === 'T2' ? 500 : 430);
    tempoDecorridoMin = Math.min(tempoDecorridoMin, maxTurnoMin);

    const oeeByShift = {};
    const oeeByMachine = {};

    const groupedData = {};
    data.forEach(item => {
        const key = `${item.machine}_${item.turno}`;
        if (!groupedData[key]) {
            // FIX: Selecionar ciclo/cavidades do turno correto (era || que sempre pegava T1)
            const { ciclo, cavidades } = getPlanParamsForShift(item, item.turno);
            groupedData[key] = {
                machine: item.machine,
                turno: item.turno,
                produzido: 0,
                paradas: 0,
                refugo_pcs: 0,
                ciclo_real: ciclo || item.budgeted_cycle || 30,
                cav_ativas: cavidades || item.mold_cavities || 2
            };
        }

        groupedData[key].produzido += item.produzido || 0;
        groupedData[key].paradas += item.duracao_min || 0;

        if (item.piece_weight > 0) {
            groupedData[key].refugo_pcs += Math.round(((item.refugo_kg || 0) * 1000) / item.piece_weight);
        }
    });

    Object.values(groupedData).forEach(group => {
        const tempoParadaMin = group.paradas;
        const oeeCalc = calculateShiftOEE(
            group.produzido,
            tempoParadaMin,
            group.refugo_pcs,
            group.ciclo_real,
            group.cav_ativas
        );

        if (group.turno === currentShift) {
            // Fase 1: Usar calculateRealTimeShiftOEE unificado
            const rtOee = calculateRealTimeShiftOEE({
                produzido: group.produzido,
                tempoDecorridoMin,
                tempoParadaMin,
                refugoPcs: group.refugo_pcs,
                cicloSeg: group.ciclo_real,
                cavidades: group.cav_ativas
            });
            oeeCalc.disponibilidade = rtOee.disponibilidade;
            oeeCalc.performance = rtOee.performance;
            oeeCalc.qualidade = rtOee.qualidade;
            oeeCalc.oee = rtOee.oee;
            oeeCalc.isRealTime = true;
            oeeCalc.tempoDecorrido = tempoDecorridoMin;
        }

        if (!oeeByShift[group.turno]) {
            oeeByShift[group.turno] = [];
        }
        oeeByShift[group.turno].push({
            machine: group.machine,
            ...oeeCalc
        });

        if (!oeeByMachine[group.machine]) {
            oeeByMachine[group.machine] = {};
        }
        oeeByMachine[group.machine][group.turno] = oeeCalc;
    });

    return {
        currentShift,
        tempoDecorridoMin,
        oeeByShift,
        oeeByMachine
    };
}

// =============================================
// OEE HISTORY (save/load/group)
// =============================================

async function saveOeeHistory(machine, turno, data, oeeData) {
    try {
        const historyEntry = {
            machine,
            turno,
            data,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            disponibilidade: oeeData.disponibilidade,
            performance: oeeData.performance,
            qualidade: oeeData.qualidade,
            oee: oeeData.oee,
            isRealTime: oeeData.isRealTime || false,
            tempoDecorrido: oeeData.tempoDecorrido || 480
        };

        const docId = `${machine}_${turno}_${data}`;
        await db.collection('oee_history').doc(docId).set(historyEntry, { merge: true });

    } catch (error) {
        console.error("Erro ao salvar histórico de OEE: ", error);
    }
}

async function loadOeeHistory(startDate, endDate, machine = null, turno = null) {
    try {
        let query = db.collection('oee_history')
            .where('data', '>=', startDate)
            .where('data', '<=', endDate)
            .orderBy('data')
            .orderBy('timestamp');

        if (machine) {
            query = query.where('machine', '==', machine);
        }

        if (turno) {
            query = query.where('turno', '==', turno);
        }

        const snapshot = await query.get();
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            timestamp: doc.data().timestamp?.toDate()
        }));

    } catch (error) {
        console.error("Erro ao carregar histórico de OEE: ", error);
        return [];
    }
}

function groupOeeByPeriod(oeeHistory, period = 'day') {
    const grouped = {};

    oeeHistory.forEach(entry => {
        let key;
        const date = entry.timestamp || new Date(entry.data);

        switch (period) {
            case 'hour':
                key = `${entry.data}_${String(date.getHours()).padStart(2, '0')}:00`;
                break;
            case 'day':
                key = entry.data;
                break;
            case 'week':
                const startOfWeek = new Date(date);
                startOfWeek.setDate(date.getDate() - date.getDay());
                key = startOfWeek.toISOString().split('T')[0];
                break;
            default:
                key = entry.data;
        }

        if (!grouped[key]) {
            grouped[key] = {
                period: key,
                machines: {},
                shifts: {},
                overall: {
                    disponibilidade: [],
                    performance: [],
                    qualidade: [],
                    oee: []
                }
            };
        }

        if (!grouped[key].machines[entry.machine]) {
            grouped[key].machines[entry.machine] = {
                disponibilidade: [],
                performance: [],
                qualidade: [],
                oee: []
            };
        }

        if (!grouped[key].shifts[entry.turno]) {
            grouped[key].shifts[entry.turno] = {
                disponibilidade: [],
                performance: [],
                qualidade: [],
                oee: []
            };
        }

        const metrics = ['disponibilidade', 'performance', 'qualidade', 'oee'];
        metrics.forEach(metric => {
            grouped[key].machines[entry.machine][metric].push(entry[metric]);
            grouped[key].shifts[entry.turno][metric].push(entry[metric]);
            grouped[key].overall[metric].push(entry[metric]);
        });
    });

    // Calcular médias
    Object.values(grouped).forEach(group => {
        const calculateAverage = (arr) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

        Object.values(group.machines).forEach(machine => {
            machine.avgDisponibilidade = calculateAverage(machine.disponibilidade);
            machine.avgPerformance = calculateAverage(machine.performance);
            machine.avgQualidade = calculateAverage(machine.qualidade);
            machine.avgOee = calculateAverage(machine.oee);
        });

        Object.values(group.shifts).forEach(shift => {
            shift.avgDisponibilidade = calculateAverage(shift.disponibilidade);
            shift.avgPerformance = calculateAverage(shift.performance);
            shift.avgQualidade = calculateAverage(shift.qualidade);
            shift.avgOee = calculateAverage(shift.oee);
        });

        group.overall.avgDisponibilidade = calculateAverage(group.overall.disponibilidade);
        group.overall.avgPerformance = calculateAverage(group.overall.performance);
        group.overall.avgQualidade = calculateAverage(group.overall.qualidade);
        group.overall.avgOee = calculateAverage(group.overall.oee);
    });

    return grouped;
}

// =============================================
// RESUMO DATA + RENDERING
// =============================================

async function loadResumoData(showLoading = true) {
    const resumoDateSelector = getResumoDateSelector();
    const date = resumoDateSelector ? resumoDateSelector.value : getProductionDateString();
    if (!date) return;

    if (showLoading) showLoadingState('resumo', true);

    try {
        const allPlans = await getPlanningCached();
        const plans = allPlans.filter(isPlanActive);

        if (plans.length === 0) {
            showLoadingState('resumo', false, true);
            return;
        }

        // OTIMIZAÇÃO Fase 2: executar queries em paralelo
        const [productionSnapshot, downtimeSnapshot] = await Promise.all([
            db.collection('production_entries').where('data', '==', date).get(),
            db.collection('downtime_entries').where('date', '==', date).get()
        ]);
        const productions = productionSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const downtimes = downtimeSnapshot.docs.map(doc => doc.data());

        currentReportData = processResumoData(plans, productions, downtimes);

        const reportQuantBtn = getReportQuantBtn();
        const currentView = reportQuantBtn && reportQuantBtn.classList.contains('active') ? 'quant' : 'effic';
        switchReportView(currentView);

        showLoadingState('resumo', false, false);

    } catch (error) {
        console.error("Erro ao carregar dados de resumo: ", error);
        showLoadingState('resumo', false, true);
    }
}

function getShiftFromTime(timeStr) {
    if (!timeStr) return null;
    const [hour, minute] = timeStr.split(':').map(Number);
    const totalMinutes = hour * 60 + (minute || 0);

    if (totalMinutes >= 390 && totalMinutes < 900) {
        return 'T1';
    } else if (totalMinutes >= 900 && totalMinutes < 1400) {
        return 'T2';
    } else {
        return 'T3';
    }
}

function processResumoData(plans, productions, downtimes) {
    return plans.map(plan => {
        const data = { ...plan, T1: {}, T2: {}, T3: {} };
        const turnos = ['T1', 'T2', 'T3'];

        const oeeExcludedCategoriesResumo = window.databaseModule?.oeeExcludedCategories || [];

        const machineDowntimesFiltered = downtimes.filter(d => {
            if (d.machine !== plan.machine) return false;
            const reason = d.reason || '';
            const category = getDowntimeCategory(reason);
            if (oeeExcludedCategoriesResumo.includes(category)) {
                return false;
            }
            return true;
        });

        turnos.forEach(turno => {
            const entries = productions.filter(p => p.planId === plan.id && p.turno === turno);
            const produzido = entries.reduce((sum, item) => sum + (item.produzido || 0), 0);

            const turnoDowntimes = machineDowntimesFiltered.filter(d => {
                const downtimeShift = getShiftFromTime(d.startTime);
                return downtimeShift === turno;
            });

            const totalParadas = turnoDowntimes.reduce((sum, item) => {
                const start = new Date(`${item.date}T${item.startTime}`);
                const end = new Date(`${item.date}T${item.endTime}`);
                return sum + (end > start ? Math.round((end - start) / 60000) : 0);
            }, 0);

            const refugo_kg = entries.reduce((sum, item) => sum + (item.refugo_kg || 0), 0);
            const refugo_pcs = plan.piece_weight > 0 ? Math.round((refugo_kg * 1000) / plan.piece_weight) : 0;

            const ciclo_real = plan[`real_cycle_${turno.toLowerCase()}`] || plan.budgeted_cycle;
            const cav_ativas = plan[`active_cavities_${turno.toLowerCase()}`] || plan.mold_cavities;

            const oee = calculateShiftOEE(produzido, totalParadas, refugo_pcs, ciclo_real, cav_ativas);

            data[turno] = { produzido, paradas: totalParadas, refugo_kg, refugo_pcs, ...oee };

            const dateStr = getResumoDateSelector()?.value || getProductionDateString();
            saveOeeHistory(plan.machine, turno, dateStr, oee);
        });

        data.total_produzido = (data.T1.produzido || 0) + (data.T2.produzido || 0) + (data.T3.produzido || 0);
        return data;
    });
}

function switchReportView(view) {
    const reportQuantBtn = getReportQuantBtn();
    const reportEfficBtn = getReportEfficBtn();
    if (reportQuantBtn && reportEfficBtn) {
        reportQuantBtn.classList.toggle('active', view === 'quant');
        reportEfficBtn.classList.toggle('active', view === 'effic');
    }
    if (view === 'quant') {
        renderRelatorioQuantitativo(currentReportData);
    } else {
        renderRelatorioEficiencia(currentReportData);
    }
}

function handleResumoTableClick(e) {
    const deleteButton = e.target.closest('.delete-resumo-btn');
    if (deleteButton) {
        const docId = deleteButton.dataset.id;
        showConfirmModal(docId, 'planning');
    }
}

function renderRelatorioQuantitativo(data) {
    const resumoContentContainer = getResumoContentContainer();
    if (!resumoContentContainer) return;

    const resumoDateSelector = getResumoDateSelector();
    const date = resumoDateSelector ? resumoDateSelector.value : getProductionDateString();
    const tableHTML = `
        <h3 class="text-lg font-bold mb-4 no-print">Relatório Quantitativo - ${date}</h3>
        <div class="print-header hidden">
            <h1 class="text-xl font-bold">Hokkaido Synchro - Relatório de Produção</h1>
            <p>Data: ${new Date(date.replace(/-/g, '/')).toLocaleDateString('pt-BR')}</p>
        </div>
        <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
                <tr>
                    <th rowspan="2" class="px-2 py-2 text-left text-xs font-medium uppercase align-middle">Máquina</th>
                    <th rowspan="2" class="px-2 py-2 text-left text-xs font-medium uppercase align-middle">Produto</th>
                    <th colspan="2" class="px-2 py-2 text-center text-xs font-medium uppercase">Turno 1</th>
                    <th colspan="2" class="px-2 py-2 text-center text-xs font-medium uppercase border-l">Turno 2</th>
                    <th colspan="2" class="px-2 py-2 text-center text-xs font-medium uppercase border-l">Turno 3</th>
                    <th rowspan="2" class="px-2 py-2 text-center text-xs font-medium uppercase border-l align-middle">Qtd. Planejada</th>
                    <th rowspan="2" class="px-2 py-2 text-center text-xs font-medium uppercase border-l align-middle">Total Dia</th>
                    <th rowspan="2" class="px-2 py-2 text-center text-xs font-medium uppercase border-l align-middle">Prod. Faltante</th>
                    <th rowspan="2" class="px-2 py-2 text-center text-xs font-medium uppercase border-l align-middle no-print">Ação</th>
                </tr>
                <tr>
                    <th class="px-2 py-2 text-center text-xs font-medium uppercase">Prod.</th><th class="px-2 py-2 text-center text-xs font-medium uppercase">Refugo (kg)</th>
                    <th class="px-2 py-2 text-center text-xs font-medium uppercase border-l">Prod.</th><th class="px-2 py-2 text-center text-xs font-medium uppercase">Refugo (kg)</th>
                    <th class="px-2 py-2 text-center text-xs font-medium uppercase border-l">Prod.</th><th class="px-2 py-2 text-center text-xs font-medium uppercase">Refugo (kg)</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-gray-200">
                ${data.map(item => {
                    const plannedTotal = coerceToNumber(item.planned_quantity, 0);
                    const producedTotal = coerceToNumber(item.total_produzido, 0);
                    const faltante = plannedTotal - producedTotal;
                    return `
                    <tr>
                        <td class="px-2 py-2 whitespace-nowrap">${item.machine}</td><td class="px-2 py-2 whitespace-nowrap">${item.product}</td>
                        <td class="px-2 py-2 text-center">${(item.T1.produzido || 0).toLocaleString('pt-BR')}</td><td class="px-2 py-2 text-center">${(item.T1.refugo_kg || 0).toFixed(2)}</td>
                        <td class="px-2 py-2 text-center border-l">${(item.T2.produzido || 0).toLocaleString('pt-BR')}</td><td class="px-2 py-2 text-center">${(item.T2.refugo_kg || 0).toFixed(2)}</td>
                        <td class="px-2 py-2 text-center border-l">${(item.T3.produzido || 0).toLocaleString('pt-BR')}</td><td class="px-2 py-2 text-center">${(item.T3.refugo_kg || 0).toFixed(2)}</td>
                        <td class="px-2 py-2 text-center border-l">${plannedTotal.toLocaleString('pt-BR')}</td>
                        <td class="px-2 py-2 text-center font-bold border-l">${producedTotal.toLocaleString('pt-BR')}</td>
                        <td class="px-2 py-2 text-center font-bold border-l ${faltante > 0 ? 'text-status-error' : 'text-status-success'}">${faltante.toLocaleString('pt-BR')}</td>
                        <td class="px-2 py-2 text-center border-l no-print">
                            <button data-id="${item.id}" class="delete-resumo-btn text-status-error hover:text-red-700 p-1"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                        </td>
                    </tr>
                `}).join('')}
            </tbody>
        </table>`;
    resumoContentContainer.innerHTML = tableHTML;
    lucide.createIcons();
}

function renderRelatorioEficiencia(data) {
    const resumoContentContainer = getResumoContentContainer();
    if (!resumoContentContainer) return;

    const resumoDateSelector = getResumoDateSelector();
    const formatPercent = (val, isRealTime = false) => {
        const colorClass = val < 0.7 ? 'text-status-error' : val < 0.85 ? 'text-status-warning' : 'text-status-success';
        const realtimeIndicator = isRealTime ? ' ⚡' : '';
        return `<span class="${colorClass}" title="${isRealTime ? 'OEE em Tempo Real' : 'OEE Calculado'}">${(val * 100).toFixed(1)}%${realtimeIndicator}</span>`;
    };

    const date = resumoDateSelector ? resumoDateSelector.value : getProductionDateString();
    const today = getProductionDateString();
    const isToday = date === today;

    let realTimeData = {};
    if (isToday) {
        data.forEach(item => {
            const combinedData = [
                {
                    machine: item.machine,
                    turno: 'T1',
                    produzido: item.T1.produzido || 0,
                    duracao_min: item.T1.paradas || 0,
                    refugo_kg: item.T1.refugo_kg || 0,
                    piece_weight: item.piece_weight,
                    real_cycle_t1: item.real_cycle_t1 || item.budgeted_cycle,
                    active_cavities_t1: item.active_cavities_t1 || item.mold_cavities,
                    budgeted_cycle: item.budgeted_cycle,
                    mold_cavities: item.mold_cavities
                },
                {
                    machine: item.machine,
                    turno: 'T2',
                    produzido: item.T2.produzido || 0,
                    duracao_min: item.T2.paradas || 0,
                    refugo_kg: item.T2.refugo_kg || 0,
                    piece_weight: item.piece_weight,
                    real_cycle_t2: item.real_cycle_t2 || item.budgeted_cycle,
                    active_cavities_t2: item.active_cavities_t2 || item.mold_cavities,
                    budgeted_cycle: item.budgeted_cycle,
                    mold_cavities: item.mold_cavities
                },
                {
                    machine: item.machine,
                    turno: 'T3',
                    produzido: item.T3.produzido || 0,
                    duracao_min: item.T3.paradas || 0,
                    refugo_kg: item.T3.refugo_kg || 0,
                    piece_weight: item.piece_weight,
                    real_cycle_t3: item.real_cycle_t3 || item.budgeted_cycle,
                    active_cavities_t3: item.active_cavities_t3 || item.mold_cavities,
                    budgeted_cycle: item.budgeted_cycle,
                    mold_cavities: item.mold_cavities
                }
            ];

            const realTimeOee = calculateRealTimeOEE(combinedData);
            if (realTimeOee && realTimeOee.oeeByMachine[item.machine]) {
                realTimeData[item.machine] = realTimeOee.oeeByMachine[item.machine];
            }
        });
    }

    const tableHTML = `
         <h3 class="text-lg font-bold mb-4 no-print">
            Relatório de Eficiência - ${date}
            ${isToday ? '<span class="text-sm text-green-600 ml-2">⚡ Dados em Tempo Real Disponíveis</span>' : ''}
         </h3>
         <div class="print-header hidden">
            <h1 class="text-xl font-bold">Hokkaido Synchro - Relatório de Eficiência</h1>
            <p>Data: ${new Date(date.replace(/-/g, '/')).toLocaleDateString('pt-BR')}</p>
            ${isToday ? '<p class="text-sm">⚡ Inclui dados em tempo real</p>' : ''}
        </div>
        <div class="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 class="font-semibold text-blue-800 mb-2">Legenda:</h4>
            <div class="flex flex-wrap gap-4 text-sm">
                <span class="text-status-success">★ ≥85% - Excelente</span>
                <span class="text-status-warning">★ 70-84% - Aceitável</span>
                <span class="text-status-error">★ <70% - Crítico</span>
                ${isToday ? '<span class="text-green-600">⚡ Tempo Real</span>' : ''}
            </div>
        </div>
        <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
                <tr>
                    <th rowspan="2" class="px-2 py-2 text-left text-xs font-medium uppercase align-middle">Máquina</th><th rowspan="2" class="px-2 py-2 text-left text-xs font-medium uppercase align-middle">Produto</th>
                    <th colspan="4" class="px-2 py-2 text-center text-xs font-medium uppercase">Turno 1</th>
                    <th colspan="4" class="px-2 py-2 text-center text-xs font-medium uppercase border-l">Turno 2</th>
                    <th colspan="4" class="px-2 py-2 text-center text-xs font-medium uppercase border-l">Turno 3</th>
                    <th rowspan="2" class="px-2 py-2 text-center text-xs font-medium uppercase border-l align-middle">OEE Médio</th>
                     <th rowspan="2" class="px-2 py-2 text-center text-xs font-medium uppercase border-l align-middle no-print">Ação</th>
                </tr>
                <tr>
                    <th class="px-2 py-2 text-center text-xs font-medium uppercase">Disp.</th><th class="px-2 py-2 text-center text-xs font-medium uppercase">Perf.</th><th class="px-2 py-2 text-center text-xs font-medium uppercase">Qual.</th><th class="px-2 py-2 text-center text-xs font-medium uppercase font-bold">OEE</th>
                    <th class="px-2 py-2 text-center text-xs font-medium uppercase border-l">Disp.</th><th class="px-2 py-2 text-center text-xs font-medium uppercase">Perf.</th><th class="px-2 py-2 text-center text-xs font-medium uppercase">Qual.</th><th class="px-2 py-2 text-center text-xs font-medium uppercase font-bold">OEE</th>
                    <th class="px-2 py-2 text-center text-xs font-medium uppercase border-l">Disp.</th><th class="px-2 py-2 text-center text-xs font-medium uppercase">Perf.</th><th class="px-2 py-2 text-center text-xs font-medium uppercase">Qual.</th><th class="px-2 py-2 text-center text-xs font-medium uppercase font-bold">OEE</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-gray-200">
                ${data.map(item => {
                    const oeeValues = [item.T1.oee, item.T2.oee, item.T3.oee].filter(v => v > 0);
                    const avgOee = oeeValues.length > 0 ? oeeValues.reduce((a, b) => a + b, 0) / oeeValues.length : 0;
                    const machineRealTime = realTimeData[item.machine];
                    const hasRealTime = isToday && machineRealTime;

                    return `
                    <tr class="${hasRealTime ? 'bg-green-50' : ''}">
                        <td class="px-2 py-2 whitespace-nowrap font-medium">${item.machine}</td>
                        <td class="px-2 py-2 whitespace-nowrap text-sm">${item.product}</td>
                        <td class="px-2 py-2 text-center">${formatPercent(item.T1.disponibilidade, hasRealTime && machineRealTime.T1)}</td>
                        <td class="px-2 py-2 text-center">${formatPercent(item.T1.performance, hasRealTime && machineRealTime.T1)}</td>
                        <td class="px-2 py-2 text-center">${formatPercent(item.T1.qualidade, hasRealTime && machineRealTime.T1)}</td>
                        <td class="px-2 py-2 text-center font-bold">${formatPercent(item.T1.oee, hasRealTime && machineRealTime.T1)}</td>
                        <td class="px-2 py-2 text-center border-l">${formatPercent(item.T2.disponibilidade, hasRealTime && machineRealTime.T2)}</td>
                        <td class="px-2 py-2 text-center">${formatPercent(item.T2.performance, hasRealTime && machineRealTime.T2)}</td>
                        <td class="px-2 py-2 text-center">${formatPercent(item.T2.qualidade, hasRealTime && machineRealTime.T2)}</td>
                        <td class="px-2 py-2 text-center font-bold">${formatPercent(item.T2.oee, hasRealTime && machineRealTime.T2)}</td>
                        <td class="px-2 py-2 text-center border-l">${formatPercent(item.T3.disponibilidade, hasRealTime && machineRealTime.T3)}</td>
                        <td class="px-2 py-2 text-center">${formatPercent(item.T3.performance, hasRealTime && machineRealTime.T3)}</td>
                        <td class="px-2 py-2 text-center">${formatPercent(item.T3.qualidade, hasRealTime && machineRealTime.T3)}</td>
                        <td class="px-2 py-2 text-center font-bold">${formatPercent(item.T3.oee, hasRealTime && machineRealTime.T3)}</td>
                        <td class="px-2 py-2 text-center border-l font-bold text-lg">${formatPercent(avgOee, hasRealTime)}</td>
                        <td class="px-2 py-2 text-center border-l no-print">
                            <button data-id="${item.id}" class="delete-resumo-btn text-status-error hover:text-red-700 p-1"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                        </td>
                    </tr>
                `;}).join('')}
            </tbody>
        </table>
        ${isToday ? `
        <div class="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p class="text-sm text-green-700">
                <strong>Nota:</strong> Os valores marcados com ⚡ representam cálculos de OEE em tempo real, 
                atualizados conforme o progresso do turno atual.
            </p>
        </div>
        ` : ''}`;
    resumoContentContainer.innerHTML = tableHTML;
    lucide.createIcons();
}

function handlePrintReport() {
    window.print();
}

// =============================================
// WINDOW EXPORTS
// =============================================
window.loadResumoData = loadResumoData;
window.switchReportView = switchReportView;
window.handleResumoTableClick = handleResumoTableClick;
window.handlePrintReport = handlePrintReport;
window.calculateShiftOEE = calculateShiftOEE;
window.calculateRealTimeOEE = calculateRealTimeOEE;
window.loadOeeHistory = loadOeeHistory;
window.groupOeeByPeriod = groupOeeByPeriod;
window.saveOeeHistory = saveOeeHistory;

// =============================================
// INIT
// =============================================
export function initResumo() {
    console.log('[RESUMO] Controller inicializado');
}
