// =============================================
// DASHBOARD CONTROLLER
// Aba de Análise: Dashboard (KPIs, Gráficos, Pareto)
// Extraído de script.js – Phase 14
// =============================================

// ─── Window-forwarded dependencies (closure functions from script.js) ───
const db = (() => { try { return firebase.firestore(); } catch { return null; } })();
const showLoadingState = (...args) => window.showLoadingState?.(...args);
const getProductionDateString = (...args) => window.getProductionDateString?.(...args);
const calculateRealTimeOEE = (...args) => window.calculateRealTimeOEE?.(...args);
const calculateShiftOEE = (...args) => window.calculateShiftOEE?.(...args);
const loadOeeHistory = (...args) => window.loadOeeHistory?.(...args);
const groupOeeByPeriod = (...args) => window.groupOeeByPeriod?.(...args);

// ─── Module State ───
let fullDashboardData = { perdas: [] };
let paretoChartInstance = null;
let productionTimelineChartInstance = null;
let oeeByShiftChartInstance = null;
let oeeTrendChartInstance = null;

// ─── DOM Helpers ───
function getStartDateSelector() { return document.getElementById('start-date-selector'); }
function getEndDateSelector() { return document.getElementById('end-date-selector'); }
function getMachineFilter() { return document.getElementById('machine-filter'); }
function getGraphMachineFilter() { return document.getElementById('graph-machine-filter'); }

// =============================================
// DASHBOARD FUNCTIONS
// =============================================

async function loadDashboardData() {
    const startDateSelector = getStartDateSelector();
    const endDateSelector = getEndDateSelector();
    const graphMachineFilter = getGraphMachineFilter();
    
    const startDate = startDateSelector ? startDateSelector.value : getProductionDateString();
    const endDate = endDateSelector ? endDateSelector.value : getProductionDateString();

    if (!startDate || !endDate) {
        alert('Por favor, selecione as datas de início e fim.');
        return;
    }
    
    showLoadingState('dashboard', true);
    const dashboardContent = document.getElementById('dashboard-content');
    if (dashboardContent) dashboardContent.style.display = 'none';

    try {
        const prodSnapshot = await db.collection('production_entries').where('data', '>=', startDate).where('data', '<=', endDate).get();
        const productions = prodSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (productions.length === 0) {
            fullDashboardData = { perdas: [] };
            populateMachineFilter([]);
            processAndRenderDashboard(fullDashboardData);
            if (dashboardContent) dashboardContent.style.display = 'block';
            showLoadingState('dashboard', false, false);
            return;
        }

        const planIds = [...new Set(productions.map(p => p.planId))];
        const plans = {};
        
        // OTIMIZAÇÃO Fase 2: executar todos os batches de planning em paralelo
        const batchPromises = [];
        for (let i = 0; i < planIds.length; i += 10) {
            const batchIds = planIds.slice(i, i + 10);
            if (batchIds.length > 0) {
                batchPromises.push(
                    db.collection('planning').where(firebase.firestore.FieldPath.documentId(), 'in', batchIds).get()
                );
            }
        }
        const batchResults = await Promise.all(batchPromises);
        batchResults.forEach(snap => {
            snap.docs.forEach(doc => { plans[doc.id] = doc.data(); });
        });
        
        const combinedData = productions.filter(prod => plans[prod.planId]).map(prod => ({ ...prod, ...plans[prod.planId] }));

        fullDashboardData = { perdas: combinedData };
        
        populateMachineFilter(combinedData);
        if (graphMachineFilter && graphMachineFilter.options.length > 1 && !graphMachineFilter.value) {
             graphMachineFilter.value = graphMachineFilter.options[1].value;
        }
        processAndRenderDashboard(fullDashboardData);
        
        if (dashboardContent) dashboardContent.style.display = 'block';
        showLoadingState('dashboard', false, false);
    } catch (error) {
        console.error("Erro ao carregar dados do dashboard: ", error);
        showLoadingState('dashboard', false, true);
        const dashboardError = document.getElementById('dashboard-error');
        if (dashboardError) dashboardError.style.display = 'block';
    }
}

function processAndRenderDashboard(data) {
    // Accept either object or use module state
    const dashData = data || fullDashboardData;
    const { perdas } = dashData;
    
    const machineFilter = getMachineFilter();
    const graphMachineFilter = getGraphMachineFilter();
    const startDateSelector = getStartDateSelector();
    const endDateSelector = getEndDateSelector();
    
    const mainFilterMachine = machineFilter ? machineFilter.value : 'total';
    const graphFilterMachine = graphMachineFilter ? graphMachineFilter.value : null;

    const filteredDataForKpis = mainFilterMachine === 'total' ? perdas : perdas.filter(p => p.machine === mainFilterMachine);
    const filteredDataForGraphs = graphFilterMachine ? perdas.filter(p => p.machine === graphFilterMachine && p.data >= startDateSelector?.value && p.data <= endDateSelector?.value) : [];
    
    // Calcular OEE em tempo real
    const realTimeOee = calculateRealTimeOEE(filteredDataForKpis);
    
    // Usar OEE em tempo real se disponível, senão usar cálculo tradicional
    let kpis;
    if (realTimeOee && Object.keys(realTimeOee.oeeByMachine).length > 0) {
        // Calcular médias dos OEEs em tempo real
        const allOeeValues = Object.values(realTimeOee.oeeByMachine)
            .flatMap(machine => Object.values(machine));
        
        if (allOeeValues.length > 0) {
            kpis = {
                disponibilidade: allOeeValues.reduce((sum, oee) => sum + oee.disponibilidade, 0) / allOeeValues.length,
                performance: allOeeValues.reduce((sum, oee) => sum + oee.performance, 0) / allOeeValues.length,
                qualidade: allOeeValues.reduce((sum, oee) => sum + oee.qualidade, 0) / allOeeValues.length,
                oee: allOeeValues.reduce((sum, oee) => sum + oee.oee, 0) / allOeeValues.length,
                isRealTime: true,
                currentShift: realTimeOee.currentShift,
                tempoDecorrido: realTimeOee.tempoDecorridoMin
            };
        } else {
            kpis = calculateDashboardOEE(filteredDataForKpis);
        }
    } else {
        kpis = calculateDashboardOEE(filteredDataForKpis);
    }
    
    updateKpiCards(kpis);
    
    if (graphFilterMachine) {
        renderProductionTimelineChart(filteredDataForGraphs, graphFilterMachine);
        renderOeeByShiftChart(filteredDataForGraphs, graphFilterMachine);
        renderOeeTrendChart(graphFilterMachine); // Novo gráfico de tendência
    } else {
         if (productionTimelineChartInstance) productionTimelineChartInstance.destroy();
         if (oeeByShiftChartInstance) oeeByShiftChartInstance.destroy();
         if (oeeTrendChartInstance) oeeTrendChartInstance.destroy();
         const messageDiv = document.getElementById('timeline-chart-message');
         if (messageDiv) messageDiv.style.display = 'flex';
    }

    renderParetoChart(filteredDataForKpis);
}

function calculateDashboardOEE(data) {
    if (data.length === 0) return { disponibilidade: 0, performance: 0, qualidade: 0, oee: 0 };

    let totalTempoProgramado = 0;
    let totalTempoParada = 0;
    let totalProducaoBoa = 0;
    let totalProducaoTeorica = 0;
    let totalRefugoPcs = 0;

    const machineDays = new Set(data.map(d => `${d.machine}-${d.data}`));
    totalTempoProgramado = machineDays.size * 3 * 480;

    data.forEach(item => {
        const cicloReal = item[`real_cycle_${item.turno.toLowerCase()}`] || item.budgeted_cycle;
        const cavAtivas = item[`active_cavities_${item.turno.toLowerCase()}`] || item.mold_cavities;
        const pesoPeca = item.piece_weight;
        
        totalTempoParada += item.duracao_min || 0;
        totalProducaoBoa += item.produzido || 0;

        if (pesoPeca > 0) {
           totalRefugoPcs += Math.round(((item.refugo_kg || 0) * 1000) / pesoPeca);
        }
        
        if (cicloReal > 0 && cavAtivas > 0) {
            const tempoProduzindo = 480 - (item.duracao_min || 0);
            totalProducaoTeorica += (tempoProduzindo * 60 / cicloReal) * cavAtivas;
        }
    });
    
    const tempoProduzindoTotal = totalTempoProgramado - totalTempoParada;

    const disponibilidade = totalTempoProgramado > 0 ? (tempoProduzindoTotal / totalTempoProgramado) : 0;
    const performance = totalProducaoTeorica > 0 ? (totalProducaoBoa / totalProducaoTeorica) : 0;
    const qualidade = (totalProducaoBoa + totalRefugoPcs) > 0 ? (totalProducaoBoa / (totalProducaoBoa + totalRefugoPcs)) : 0;
    const oee = disponibilidade * performance * qualidade;

    return {
        disponibilidade: isNaN(disponibilidade) ? 0 : disponibilidade,
        performance: isNaN(performance) ? 0 : performance,
        qualidade: isNaN(qualidade) ? 0 : qualidade,
        oee: isNaN(oee) ? 0 : oee
    };
}

function updateKpiCards(kpis) {
    const disponibilidadeEl = document.getElementById('kpi-disponibilidade');
    const performanceEl = document.getElementById('kpi-performance');
    const qualidadeEl = document.getElementById('kpi-qualidade');
    const oeeEl = document.getElementById('kpi-oee');
    
    if (disponibilidadeEl) {
        const dispValue = (kpis.disponibilidade * 100).toFixed(1) + '%';
        disponibilidadeEl.textContent = dispValue;
        if (kpis.isRealTime) {
            disponibilidadeEl.title = `Tempo Real - Turno ${kpis.currentShift} (${kpis.tempoDecorrido}min)`;
        }
    }
    
    if (performanceEl) {
        const perfValue = (kpis.performance * 100).toFixed(1) + '%';
        performanceEl.textContent = perfValue;
        if (kpis.isRealTime) {
            performanceEl.title = `Tempo Real - Turno ${kpis.currentShift} (${kpis.tempoDecorrido}min)`;
        }
    }
    
    if (qualidadeEl) {
        const qualValue = (kpis.qualidade * 100).toFixed(1) + '%';
        qualidadeEl.textContent = qualValue;
        if (kpis.isRealTime) {
            qualidadeEl.title = `Tempo Real - Turno ${kpis.currentShift} (${kpis.tempoDecorrido}min)`;
        }
    }
    
    if (oeeEl) {
        const oeeValue = (kpis.oee * 100).toFixed(1) + '%';
        oeeEl.textContent = oeeValue;
        if (kpis.isRealTime) {
            oeeEl.title = `Tempo Real - Turno ${kpis.currentShift} (${kpis.tempoDecorrido}min)`;
            oeeEl.style.color = '#059669'; // Verde para indicar tempo real
        } else {
            oeeEl.style.color = '';
        }
    }
}

function renderProductionTimelineChart(data, selectedMachine) {
    const ctx = document.getElementById('productionTimelineChart');
    if (!ctx) return;
    
    const messageDiv = document.getElementById('timeline-chart-message');
    const endDateSelector = getEndDateSelector();
    const startDateSelector = getStartDateSelector();
    
    if (productionTimelineChartInstance) productionTimelineChartInstance.destroy();
    
    if (!selectedMachine || selectedMachine === 'total') {
        ctx.style.display = 'none';
        if (messageDiv) messageDiv.style.display = 'flex';
        return;
    }
    ctx.style.display = 'block';
    if (messageDiv) messageDiv.style.display = 'none';
    
    const hourlyData = {};
    for (let i = 7; i < 24; i++) { hourlyData[`${String(i).padStart(2,'0')}:00`] = 0; }
    for (let i = 0; i < 7; i++) { hourlyData[`${String(i).padStart(2,'0')}:00`] = 0; }

    data.forEach(item => {
        const ts = item.timestamp?.toDate();
        if (!ts) return;
        const hour = `${String(ts.getHours()).padStart(2,'0')}:00`;
        if (hourlyData[hour] !== undefined) {
           hourlyData[hour] += item.produzido || 0;
        }
    });

    const sortedHours = Object.keys(hourlyData).sort((a,b) => {
        const hourA = parseInt(a.split(':')[0]);
        const hourB = parseInt(b.split(':')[0]);
        if (hourA >= 6 && hourB < 6) return -1;
        if (hourA < 6 && hourB >= 6) return 1;
        return hourA - hourB;
    });
    
    let cumulativeTotal = 0;
    const cumulativeProductionData = sortedHours.map(hour => {
        cumulativeTotal += hourlyData[hour];
        return cumulativeTotal;
    });

    const planItem = data.length > 0 ? data.find(d => d.planned_quantity > 0) : null;
    const metaDiaria = planItem ? planItem.planned_quantity : 0;
    const metaPorHora = metaDiaria / 24;
    
    let cumulativeTarget = 0;
    const cumulativeTargetData = sortedHours.map(() => {
        cumulativeTarget += metaPorHora;
        return cumulativeTarget;
    });
    
    let displayLabels = sortedHours;
    let displayProdData = cumulativeProductionData;
    let displayTargetData = cumulativeTargetData;
    
    const todayString = getProductionDateString();
    const viewingToday = (endDateSelector?.value === todayString && startDateSelector?.value === todayString);

    if (viewingToday) {
        const currentHour = new Date().getHours();
        let currentHourIndex = sortedHours.findIndex(h => parseInt(h.split(':')[0]) === currentHour);
        
        if (currentHourIndex === -1 && currentHour < 6) {
            currentHourIndex = 18 + currentHour;
        } else if (currentHourIndex === -1) {
            currentHourIndex = 23;
        }

        const sliceIndex = Math.min(currentHourIndex + 2, sortedHours.length);

        displayLabels = sortedHours.slice(0, sliceIndex);
        displayProdData = cumulativeProductionData.slice(0, sliceIndex);
        displayTargetData = cumulativeTargetData.slice(0, sliceIndex);
    }

    productionTimelineChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: displayLabels,
            datasets: [
                { 
                    label: 'Produção Acumulada', 
                    data: displayProdData, 
                    borderColor: '#0077C2',
                    backgroundColor: 'rgba(0, 119, 194, 0.1)',
                    fill: true,
                    tension: 0.3
                },
                {
                    label: 'Meta Acumulada',
                    data: displayTargetData,
                    borderColor: '#DC2626',
                    borderDash: [5, 5],
                    fill: false,
                    pointRadius: 0
                }
            ]
        },
        options: {
            responsive: true,

            scales: { y: { beginAtZero: true, title: { display: true, text: 'Quantidade de Peças' } } },
            plugins: { 
                legend: { position: 'top' },
                tooltip: { mode: 'index', intersect: false }
            },
            hover: { mode: 'index', intersect: false }
        }
    });
}

function renderOeeByShiftChart(data, selectedMachine) {
    const ctx = document.getElementById('oeeByShiftChart');
    if (!ctx) return;
    
    if (oeeByShiftChartInstance) oeeByShiftChartInstance.destroy();
    
    if (!selectedMachine || selectedMachine === 'total') {
        return;
    }
    
    const oeeData = { T1: [], T2: [], T3: [] };
    data.forEach(item => {
        const refugoPcs = item.piece_weight > 0 ? ((item.refugo_kg || 0) * 1000) / item.piece_weight : 0;
        const oee = calculateShiftOEE(item.produzido || 0, item.duracao_min || 0, refugoPcs, item[`real_cycle_${item.turno.toLowerCase()}`] || item.budgeted_cycle, item[`active_cavities_${item.turno.toLowerCase()}`] || item.mold_cavities);
        if (oeeData[item.turno]) {
            oeeData[item.turno].push(oee.oee);
        }
    });

    const avgOee = (arr) => arr.length > 0 ? (arr.reduce((a, b) => a + b, 0) / arr.length) * 100 : 0;

    oeeByShiftChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Turno 1', 'Turno 2', 'Turno 3'],
            datasets: [{
                label: 'Eficiência (OEE)',
                data: [avgOee(oeeData.T1), avgOee(oeeData.T2), avgOee(oeeData.T3)],
                backgroundColor: ['#4F46E5', '#10B981', '#0077C2']
            }]
        },
        options: {
            responsive: true,

            scales: { y: { beginAtZero: true, max: 100, ticks: { callback: value => value + '%' } } },
            plugins: { legend: { display: false } }
        }
    });
}

async function renderOeeTrendChart(selectedMachine) {
    const ctx = document.getElementById('oeeTrendChart');
    if (!ctx) return;
    
    const endDateSelector = getEndDateSelector();
    
    if (oeeTrendChartInstance) oeeTrendChartInstance.destroy();
    
    if (!selectedMachine || selectedMachine === 'total') {
        return;
    }
    
    try {
        // Carregar histórico de OEE dos últimos 7 dias
        const endDate = endDateSelector?.value;
        const startDateObj = new Date(endDate);
        startDateObj.setDate(startDateObj.getDate() - 6);
        const startDate = startDateObj.toISOString().split('T')[0];
        
        const oeeHistory = await loadOeeHistory(startDate, endDate, selectedMachine);
        
        if (!oeeHistory || oeeHistory.length === 0) {
            return;
        }
        
        // Agrupar por dia e turno
        const groupedByDay = groupOeeByPeriod(oeeHistory, 'day');
        
        // Preparar dados para o gráfico
        const dates = Object.keys(groupedByDay).sort();
        const datasets = [
            {
                label: 'Turno 1',
                data: dates.map(date => {
                    const dayData = groupedByDay[date];
                    return dayData.shifts.T1 ? (dayData.shifts.T1.avgOee * 100) : null;
                }),
                borderColor: '#4F46E5',
                backgroundColor: 'rgba(79, 70, 229, 0.1)',
                tension: 0.3,
                fill: false
            },
            {
                label: 'Turno 2',
                data: dates.map(date => {
                    const dayData = groupedByDay[date];
                    return dayData.shifts.T2 ? (dayData.shifts.T2.avgOee * 100) : null;
                }),
                borderColor: '#10B981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                tension: 0.3,
                fill: false
            },
            {
                label: 'Turno 3',
                data: dates.map(date => {
                    const dayData = groupedByDay[date];
                    return dayData.shifts.T3 ? (dayData.shifts.T3.avgOee * 100) : null;
                }),
                borderColor: '#0077C2',
                backgroundColor: 'rgba(0, 119, 194, 0.1)',
                tension: 0.3,
                fill: false
            },
            {
                label: 'OEE Médio Diário',
                data: dates.map(date => {
                    const dayData = groupedByDay[date];
                    return dayData.overall.avgOee * 100;
                }),
                borderColor: '#DC2626',
                backgroundColor: 'rgba(220, 38, 38, 0.1)',
                borderWidth: 3,
                borderDash: [5, 5],
                tension: 0.3,
                fill: false
            }
        ];
        
        // Formatear datas para exibição
        const formattedDates = dates.map(date => {
            const dateObj = new Date(date);
            return dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        });
        
        oeeTrendChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: formattedDates,
                datasets: datasets
            },
            options: {
                responsive: true,

                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        title: {
                            display: true,
                            text: 'OEE (%)'
                        },
                        ticks: {
                            callback: value => value + '%'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Data'
                        }
                    }
                },
                plugins: {
                    legend: {
                        position: 'top'
                    },
                    title: {
                        display: true,
                        text: `Tendência de OEE - ${selectedMachine} (Últimos 7 dias)`
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: function(context) {
                                return context.dataset.label + ': ' + (context.parsed.y || 0).toFixed(1) + '%';
                            }
                        }
                    }
                },
                hover: {
                    mode: 'index',
                    intersect: false
                },
                elements: {
                    point: {
                        radius: 4,
                        hoverRadius: 6
                    }
                }
            }
        });
        
    } catch (error) {
        console.error("Erro ao carregar gráfico de tendência de OEE: ", error);
    }
}

function renderParetoChart(data) {
    const ctx = document.getElementById('paretoChart');
    if (!ctx) return;
    
    if (paretoChartInstance) paretoChartInstance.destroy();

    const reasonCounts = data.reduce((acc, item) => {
        if(item.motivo_refugo && (item.refugo_kg || 0) > 0) {
            acc[item.motivo_refugo] = (acc[item.motivo_refugo] || 0) + (item.refugo_kg || 0);
        }
        return acc;
    }, {});

    const sortedReasons = Object.entries(reasonCounts).sort(([, a], [, b]) => b - a);
    const labels = sortedReasons.map(([reason]) => reason);
    const values = sortedReasons.map(([, count]) => count);
    const total = values.reduce((sum, val) => sum + val, 0);

    let cumulative = 0;
    const cumulativePercentage = values.map(val => {
        cumulative += val;
        return total > 0 ? (cumulative / total) * 100 : 0;
    });
    
    paretoChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: 'Refugo (kg)',
                    data: values,
                    backgroundColor: 'rgba(220, 38, 38, 0.7)',
                    yAxisID: 'y'
                },
                {
                    label: 'Acumulado %',
                    data: cumulativePercentage,
                    type: 'line',
                    borderColor: '#4F46E5',
                    backgroundColor: 'rgba(79, 70, 229, 0.2)',
                    fill: false,
                    tension: 0.1,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                y: { type: 'linear', display: true, position: 'left', beginAtZero: true, title: { display: true, text: 'Kg' }},
                y1: { type: 'linear', display: true, position: 'right', min: 0, max: 105, grid: { drawOnChartArea: false }, ticks: { callback: value => value + '%' } }
            }
        }
    });
}

function populateMachineFilter(data) {
    const machineFilter = getMachineFilter();
    const graphMachineFilter = getGraphMachineFilter();
    const machines = [...new Set(data.map(item => item.machine))].sort();
    const mainOptions = '<option value="total">Visão Geral (Total)</option>' + machines.map(m => `<option value="${m}">${m}</option>`).join('');
    const graphOptions = '<option value="">Selecione...</option>' + machines.map(m => `<option value="${m}">${m}</option>`).join('');
    if (machineFilter) machineFilter.innerHTML = mainOptions;
    if (graphMachineFilter) graphMachineFilter.innerHTML = graphOptions;
}

// =============================================
// WINDOW EXPORTS
// =============================================
window.loadDashboardData = loadDashboardData;
window.processAndRenderDashboard = processAndRenderDashboard;
window.populateMachineFilter = populateMachineFilter;

// Expose fullDashboardData as getter/setter for auto-update code in script.js
Object.defineProperty(window, 'fullDashboardData', {
    get: () => fullDashboardData,
    set: (val) => { fullDashboardData = val; },
    configurable: true
});

// =============================================
// INIT
// =============================================
export function initDashboard() {
    console.log('[DASHBOARD] Controller inicializado');
}
