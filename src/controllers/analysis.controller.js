// ============================================================
// src/controllers/analysis.controller.js  Phase 3B: Analysis module
// Extracted from script.js lines 4682-14380 (~9700 lines, 122+ functions)
// ============================================================
import { getDb } from '../services/firebase-client.js';
import { escapeHtml, normalizeMachineId } from '../utils/dom.utils.js';
import { showNotification } from '../components/notification.js';
import { logSystemAction, registrarLogSistema } from '../utils/logger.js';
import { getActiveUser, isUserGestorOrAdmin, showPermissionDeniedNotification, getCurrentUserName } from '../utils/auth.utils.js';
import { getProductionDateString, getCurrentShift, formatDateBR, formatDateYMD, getShiftForDateTime } from '../utils/date.utils.js';
import { consolidateDowntimeEvents, inferShiftFromSegment, calculateHoursInPeriod } from '../services/downtime-shift.service.js';
import { coerceToNumber, parseOptionalNumber } from '../utils/number.utils.js';
import { getProductByCode } from '../utils/product.utils.js';
import { getProductionOrderStatusBadge } from '../utils/plan.utils.js';
import { HOURS_IN_PRODUCTION_DAY, ANALYSIS_LINE_COLORS, hexWithAlpha, resolveProgressPalette, getProductionHoursOrder, getHoursElapsedInProductionDay, getProductionHourLabel, formatHourLabel, formatShortDateLabel, getDowntimeCategory } from '../utils/color.utils.js';

// --- Closure-scoped functions accessed via window forwarding ---
const onMachineSelected = (...args) => window.onMachineSelected?.(...args);
const getDescricaoMP = (...args) => window.getDescricaoMP?.(...args);
const updateMachineInfo = (...args) => window.updateMachineInfo?.(...args);
const loadOpProductionChart = (...args) => window.loadOpProductionChart?.(...args);
const loadTodayStats = (...args) => window.loadTodayStats?.(...args);
const loadProductionOrders = (...args) => window.loadProductionOrders?.(...args);
const setOrderAsActive = (...args) => window.setOrderAsActive?.(...args);
const loadLaunchPanel = (...args) => window.loadLaunchPanel?.(...args);
const openEditDowntimeModal = (...args) => window.openEditDowntimeModal?.(...args);
const loadSucataAnalysis = (...args) => window.loadSucataAnalysis?.(...args);
const populateMachineSelector = (...args) => window.populateMachineSelector?.(...args);
const getPlanningCached = (...args) => window.getPlanningCached?.(...args);
const getExtendedDowntimesCached = (...args) => window.getExtendedDowntimesCached?.(...args);
const getProductionOrdersCached = (...args) => window.getProductionOrdersCached?.(...args);
const getActiveDowntimesCached = (...args) => window.getActiveDowntimesCached?.(...args);

// --- Helper functions forwarded from script.js closure ---
const normalizeToDate = (...args) => window.normalizeToDate?.(...args);
const getWorkDayFromTimestamp = (...args) => window.getWorkDayFromTimestamp?.(...args);
const getWorkDay = (...args) => window.getWorkDay?.(...args);
const getPlanQuantity = (...args) => window.getPlanQuantity?.(...args) ?? 0;
const parseTimeToMinutes = (...args) => window.parseTimeToMinutes?.(...args);
const resolveProductionDateTime = (...args) => window.resolveProductionDateTime?.(...args);

// --- calculateShiftOEE: Fase 1 — delega para oee.utils.js via window.oeeUtils
// A função é carregada por src/utils/oee.utils.js e exposta em window.calculateShiftOEE.
// Fallback mínimo caso oee.utils ainda não tenha carregado (race condition de módulos).
function calculateShiftOEE(produzido, tempoParadaMin, refugoPcs, cicloReal, cavAtivas, turno) {
    if (typeof window.calculateShiftOEE === 'function') {
        return window.calculateShiftOEE(produzido, tempoParadaMin, refugoPcs, cicloReal, cavAtivas, turno);
    }
    // Fallback mínimo (mesma lógica do oee.utils.js)
    const tempoTurnoMin = 480;
    const tempoProduzindo = Math.max(0, tempoTurnoMin - Math.max(0, tempoParadaMin));
    const disponibilidade = tempoTurnoMin > 0 ? (tempoProduzindo / tempoTurnoMin) : 0;
    const producaoTeorica = cicloReal > 0 && cavAtivas > 0 ? (tempoProduzindo * 60 / cicloReal) * cavAtivas : 0;
    const performance = producaoTeorica > 0 ? Math.min(1, produzido / producaoTeorica) : (produzido > 0 ? 1 : 0);
    const totalProduzido = Math.max(0, produzido) + Math.max(0, refugoPcs);
    const qualidade = totalProduzido > 0 ? (Math.max(0, produzido) / totalProduzido) : (produzido > 0 ? 1 : 0);
    const oee = disponibilidade * performance * qualidade;
    const s = (v) => isNaN(v) || !isFinite(v) ? 0 : Math.max(0, Math.min(1, v));
    return { disponibilidade: s(disponibilidade), performance: s(performance), qualidade: s(qualidade), oee: s(oee) };
}

// --- isPageVisible (small utility, copied from script.js L4600) ---
function isPageVisible() {
    return document.visibilityState === 'visible';
}

// ── Cache de consultas inline para relatórios (evita leituras duplicadas) ──
// ── Fase 4B: Cache compartilhado entre controllers (sharedQueryCache) ──
// Substitui _inlineQueryCache local. Permite que Reports e Analysis
// reutilizem dados do mesmo período sem queries duplicadas.
const _inlineQueryCache = window.sharedQueryCache || new Map();
const _inlineQueryCacheTTL = 300000; // 5 min (backup, sharedQueryCache tem TTL interno)

/**
 * Executa query Firestore com cache compartilhado por chave (para relatórios inline).
 * @param {string} key - Chave única do cache (ex: 'prod_2026-02-20_2026-02-20')
 * @param {Function} queryFn - Função que retorna a Promise do .get()
 * @returns {Promise<Array>} Array de docs { id, ...data }
 */
async function cachedInlineQuery(key, queryFn) {
    // Usar sharedQueryCache se disponível (compartilha com reports.controller)
    if (window.sharedQueryCache) {
        return window.sharedQueryCache.get(key, async () => {
            const snapshot = await queryFn();
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        });
    }
    // Fallback: cache local
    const entry = _inlineQueryCache.get(key);
    if (entry && Date.now() - entry.ts < _inlineQueryCacheTTL) {
        console.debug(`📦 [Analysis·cache] hit: ${key}`);
        return entry.data;
    }
    console.debug(`🔥 [Analysis·cache] miss: ${key}`);
    const snapshot = await queryFn();
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    _inlineQueryCache.set(key, { data, ts: Date.now() });
    return data;
}

// --- State variables (formerly closure-scoped) ---
let analysisHourlyChartInstance = null;
let hourlyChartInstance = null;
let machineProductionTimelineInstance = null;

// --- Gauge chart state (era closure-scoped no script.js, agora local ao módulo) ---
const gaugeChartInstances = {};
const gaugeChartStyles = {
    'availability-gauge': {
        color: '#10B981',
        warningColor: '#F59E0B',
        dangerColor: '#EF4444'
    },
    'performance-gauge': {
        color: '#3B82F6',
        warningColor: '#8B5CF6',
        dangerColor: '#EF4444'
    },
    'quality-gauge': {
        color: '#F59E0B',
        warningColor: '#F97316',
        dangerColor: '#EF4444'
    },
    'oee-main-gauge': {
        color: '#8B5CF6',
        warningColor: '#F59E0B',
        dangerColor: '#EF4444'
    }
};

let cachedProductionDataset = {
    productionData: [],
    planData: [],
    startDate: null,
    endDate: null,
    shift: 'all',
    machine: 'all'
};
let productionRateMode = 'day';
let machines = [];
let currentAnalysisFilters = {};
let productionOrdersCache = [];
let filteredProductionOrders = [];
let currentSelectedOrderForAnalysis = null;
let currentActiveOrder = null;
let currentOrderProgress = { executed: 0, planned: 0, expected: 0 };

// ═══════════════════════════════════════════════════════════════════
// OTIMIZAÇÃO: Cache de getFilteredData para evitar re-queries Firestore
// em cada troca de sub-aba. Chave = collection:startDate:endDate
// Invalidado quando filtros mudam via applyAnalysisFilters().
// ═══════════════════════════════════════════════════════════════════
const _filteredDataCache = new Map();
const _FILTERED_DATA_TTL = 300000; // 5 minutos (otimizado - era 3 min)

function _getFilteredDataCacheKey(collection, startDate, endDate) {
    return `${collection}:${startDate}:${endDate}`;
}

function _getFilteredDataFromCache(collection, startDate, endDate) {
    const key = _getFilteredDataCacheKey(collection, startDate, endDate);
    const entry = _filteredDataCache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.ts > _FILTERED_DATA_TTL) {
        _filteredDataCache.delete(key);
        return null;
    }
    return entry.data;
}

function _setFilteredDataCache(collection, startDate, endDate, data) {
    const key = _getFilteredDataCacheKey(collection, startDate, endDate);
    _filteredDataCache.set(key, { data, ts: Date.now() });
}

function _invalidateFilteredDataCache() {
    _filteredDataCache.clear();
    console.debug('🗑️ [Analysis] Cache de getFilteredData invalidado');
}

//  Extracted Analysis Functions 
    function setupAnalysisTab() {
        console.log('🔧 Configurando aba de análise...');
        
        // Event listeners para as abas de análise
        document.querySelectorAll('.analysis-tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                // CORREÇÃO: usar currentTarget (o botão) em vez de target (pode ser <span>/<i>/<div> filho)
                const view = e.currentTarget.getAttribute('data-view');
                if (view) switchAnalysisView(view);
            });
        });

        // Event listeners para filtros
        const periodSelector = document.getElementById('analysis-period');
        const machineSelector = document.getElementById('analysis-machine');
        const applyFiltersBtn = document.getElementById('apply-analysis-filters');

        if (periodSelector) {
            periodSelector.addEventListener('change', (e) => {
                const customRange = document.getElementById('custom-date-range');
                if (e.target.value === 'custom') {
                    customRange.classList.remove('hidden');
                } else {
                    customRange.classList.add('hidden');
                }
            });
        }

        if (machineSelector) {
            machineSelector.addEventListener('change', updateAnalysisInfoPanel);
        }

        if (applyFiltersBtn) {
            applyFiltersBtn.addEventListener('click', applyAnalysisFilters);
        }

        // Event listeners para comparação
        const generateComparisonBtn = document.getElementById('generate-comparison');
        if (generateComparisonBtn) {
            generateComparisonBtn.addEventListener('click', generateComparison);
        }

        // Event listener para botão de teste
        const testChartsBtn = document.getElementById('test-charts-btn');
        if (testChartsBtn) {
            testChartsBtn.addEventListener('click', () => {
                console.log('🧪 [TEST] Teste manual iniciado');
                testAllCharts();
                diagnosticFirestoreData();
            });
        }

        const rateDayBtn = document.getElementById('production-rate-mode-day');
        const rateShiftBtn = document.getElementById('production-rate-mode-shift');
        if (rateDayBtn && rateShiftBtn) {
            rateDayBtn.addEventListener('click', () => {
                if (productionRateMode === 'day') return;
                productionRateMode = 'day';
                updateProductionRateToggle();
                updateProductionRateDisplay();
            });
            rateShiftBtn.addEventListener('click', () => {
                if (productionRateMode === 'shift') return;
                productionRateMode = 'shift';
                updateProductionRateToggle();
                updateProductionRateDisplay();
            });
            updateProductionRateToggle();
        }

        // Carregar dados iniciais
        loadAnalysisMachines();
        setAnalysisDefaultDates();
        
        // Executar diagnósticos
        diagnosticFirestoreData();
        
        // Carregar dados da view inicial (overview)
        setTimeout(() => {
            loadAnalysisData('overview');
            // Testar todos os gráficos após 2 segundos
            setTimeout(() => {
                testAllCharts();
            }, 2000);
        }, 100);
        
        console.log('✅ Aba de análise configurada');
    }

    // Função para trocar entre views de análise
    function switchAnalysisView(viewName) {
        // Atualizar botões - remover classes active
        document.querySelectorAll('.analysis-tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Adicionar classe active ao botão selecionado
        const activeBtn = document.querySelector(`.analysis-tab-btn[data-view="${viewName}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }

        // Mostrar/ocultar views
        document.querySelectorAll('.analysis-view').forEach(view => {
            view.classList.add('hidden');
        });
        
        const targetView = document.getElementById(`${viewName}-view`);
        if (targetView) {
            targetView.classList.remove('hidden');
            // Carregar dados específicos da view
            loadAnalysisData(viewName);
        }
    }

    // Função para aplicar filtros de análise
    async function applyAnalysisFilters() {
        const period = document.getElementById('analysis-period').value;
        const machine = document.getElementById('analysis-machine').value;
        const shift = document.getElementById('analysis-shift').value;
        
        const toIsoDate = (dateObj) => new Date(dateObj.getTime() - dateObj.getTimezoneOffset() * 60000).toISOString().split('T')[0];
        let startDate, endDate;
        const workToday = getProductionDateString();
        const baseDate = new Date(`${workToday}T12:00:00`);
        
        switch (period) {
            case 'today':
                startDate = endDate = workToday;
                break;
            case 'yesterday':
                const yesterday = new Date(baseDate);
                yesterday.setDate(yesterday.getDate() - 1);
                startDate = endDate = toIsoDate(yesterday);
                break;
            case '7days':
                const week = new Date(baseDate);
                week.setDate(week.getDate() - 6);
                startDate = toIsoDate(week);
                endDate = workToday;
                break;
            case '30days':
                const month = new Date(baseDate);
                month.setDate(month.getDate() - 29);
                startDate = toIsoDate(month);
                endDate = workToday;
                break;
            case 'month':
                startDate = toIsoDate(new Date(baseDate.getFullYear(), baseDate.getMonth(), 1));
                endDate = workToday;
                break;
            case 'lastmonth':
                const lastMonth = new Date(baseDate.getFullYear(), baseDate.getMonth() - 1, 1);
                const lastMonthEnd = new Date(baseDate.getFullYear(), baseDate.getMonth(), 0);
                startDate = toIsoDate(lastMonth);
                endDate = toIsoDate(lastMonthEnd);
                break;
            case 'custom':
                startDate = document.getElementById('analysis-start-date').value;
                endDate = document.getElementById('analysis-end-date').value;
                break;
        }

        if (!startDate) startDate = workToday;
        if (!endDate) endDate = workToday;

        // Atualizar dados com filtros
        currentAnalysisFilters = { startDate, endDate, machine, shift, period };
        
        // OTIMIZAÇÃO: invalidar cache ao mudar filtros de período
        _invalidateFilteredDataCache();

        // Recarregar a view atual
        const activeView = document.querySelector('.analysis-tab-btn.active')?.getAttribute('data-view') || 'overview';
        loadAnalysisData(activeView);
    }

    // Função para carregar dados de análise
    async function loadAnalysisData(viewName = 'overview') {
        console.log('[TRACE][loadAnalysisData] start', { viewName, filters: currentAnalysisFilters });
        
        // Garantir que os filtros estejam inicializados
        if (!currentAnalysisFilters.startDate || !currentAnalysisFilters.endDate) {
            console.log('[TRACE][loadAnalysisData] initializing default filters');
            setAnalysisDefaultDates();
        }
        
        showAnalysisLoading(true);
        
        try {
            switch (viewName) {
                case 'overview':
                    await loadOverviewData();
                    break;
                case 'production':
                    await loadProductionAnalysis();
                    break;
                case 'efficiency':
                    await loadEfficiencyAnalysis();
                    break;
                case 'losses':
                    await loadLossesAnalysis();
                    break;
                case 'downtime':
                    await loadDowntimeAnalysis();
                    break;
                case 'comparative':
                    await loadComparativeAnalysis();
                    break;
                case 'orders':
                    await loadOrdersAnalysis();
                    break;
                case 'predictive':
                    await loadPredictiveAnalysis();
                    break;
                case 'reports':
                    await loadReportsView();
                    break;
            }
        } catch (error) {
            console.error('Erro ao carregar dados de análise:', error);
            showAnalysisError();
        } finally {
            showAnalysisLoading(false);
            console.log('[TRACE][loadAnalysisData] end', { viewName });
        }
    }

    function populateOrdersMachineFilter(orders) {
        // Popular filtro na aba Análises/Ordens
        const machineFilter = document.getElementById('analysis-orders-machine-filter');
        if (!machineFilter) return;

        // Preservar valor atual
        const currentValue = machineFilter.value;

        // Recriar opções usando window.machineDatabase (todas as máquinas do sistema)
        machineFilter.innerHTML = '<option value="">Todas as Máquinas</option>';
        
        if (typeof window.machineDatabase !== 'undefined' && window.machineDatabase.length > 0) {
            window.machineDatabase.forEach(function(machine) {
                const mid = normalizeMachineId(machine.id);
                const option = document.createElement('option');
                option.value = mid;
                option.textContent = mid + ' - ' + machine.model;
                machineFilter.appendChild(option);
            });
        }

        // Restaurar valor anterior
        if (currentValue) machineFilter.value = currentValue;
    }

    function computeOrderExecutionMetrics(order, productionTotalsByOrderId) {
        const lotSize = coerceToNumber(order.lot_size, 0);
        const status = (order.status || '').toLowerCase();
        const isFinishedStatus = ['concluida', 'finalizada', 'encerrada'].includes(status);

        const aggregateTotals = productionTotalsByOrderId.get(order.id) || 0;
        const storedTotals = coerceToNumber(order.total_produzido ?? order.totalProduced, 0);

        // CORREÇÃO: Sempre usar o MAIOR valor entre armazenado e agregado
        // Isso garante que novos lançamentos após edição manual sejam contabilizados
        const totalProduced = Math.max(aggregateTotals, storedTotals, 0);

        const computedProgress = lotSize > 0
            ? Math.min((totalProduced / lotSize) * 100, 100)
            : 0;
        const progress = isFinishedStatus && computedProgress < 100 ? 100 : computedProgress;
        const remaining = isFinishedStatus
            ? 0
            : Math.max(0, lotSize - totalProduced);

        return {
            lotSize,
            totalProduced,
            progress,
            remaining,
            isComplete: isFinishedStatus || (lotSize > 0 && totalProduced >= lotSize),
            hasProduction: totalProduced > 0
        };
    }

    async function loadOrdersAnalysis() {
        console.log('📋 Carregando análise de ordens de produção');

        // Usar cache otimizado para reduzir leituras do Firebase
        let ordersDataset = Array.isArray(productionOrdersCache) ? [...productionOrdersCache] : [];

        if (ordersDataset.length === 0) {
            try {
                // Usar função cacheada para economizar leituras
                ordersDataset = await getProductionOrdersCached();
                productionOrdersCache = ordersDataset;
                console.log('📋 Ordens carregadas (cache/Firebase):', ordersDataset.length);
            } catch (error) {
                console.error('Erro ao recuperar ordens de produção para análise:', error);
            }
        } else {
            console.log('📋 Usando cache de ordens:', ordersDataset.length);
        }

        if (!ordersDataset || ordersDataset.length === 0) {
            console.warn('❌ Nenhuma ordem de produção encontrada.');
            showAnalysisNoData('Nenhuma ordem de produção cadastrada.');
            return;
        }

        const ordersGrid = document.getElementById('orders-grid');
        if (!ordersGrid) {
            console.error('❌ Elemento orders-grid não encontrado no DOM');
            return;
        }

        const startDateStr = currentAnalysisFilters.startDate;
        const endDateStr = currentAnalysisFilters.endDate;

        const normalizedOrders = ordersDataset.map(order => ({
            ...order,
            normalizedCode: String(order.part_code || order.product_cod || '').trim()
        }));

        // CORREÇÃO: Mapear produção por ID de ordem SEM filtro de data
        // Isso garante que o progresso exibido seja o mesmo dos cards de máquinas
        // Os valores são pegos diretamente do total_produzido armazenado na OP (atualizado a cada lançamento)
        // ou calculados a partir de TODOS os lançamentos da ordem (sem filtro de data)
        const productionTotalsByOrderId = new Map();

        try {
            // Buscar TODOS os lançamentos de produção (sem filtro de data)
            // para garantir consistência com os cards de máquinas
            const orderIds = normalizedOrders.map(o => o.id).filter(id => id);
            
            if (orderIds.length > 0) {
                // Buscar em lotes de 10 (limite do Firestore para 'in')
                const batchSize = 10;
                for (let i = 0; i < orderIds.length; i += batchSize) {
                    const batchIds = orderIds.slice(i, i + batchSize);
                    const productionSnapshot = await getDb().collection('production_entries')
                        .where('orderId', 'in', batchIds)
                        .get();

                    productionSnapshot.docs.forEach(doc => {
                        const data = doc.data();
                        const orderId = data.orderId || data.order_id;
                        
                        if (!orderId) return;

                        const producedQty = coerceToNumber(data.produzido ?? data.quantity, 0);
                        if (!Number.isFinite(producedQty) || producedQty <= 0) {
                            return;
                        }

                        productionTotalsByOrderId.set(
                            orderId,
                            (productionTotalsByOrderId.get(orderId) || 0) + producedQty
                        );
                    });
                }
            }
        } catch (error) {
            console.error('Erro ao carregar lançamentos para análise de ordens:', error);
        }

        // Preencher dropdown de máquinas com máquinas usadas nas ordens
        populateOrdersMachineFilter(normalizedOrders);

        const ordersWithProgress = normalizedOrders.map(order => {
            const metrics = computeOrderExecutionMetrics(order, productionTotalsByOrderId);
            return { ...order, ...metrics };
        });

        // Aplicar filtros de status, máquina e pesquisa
        const ordersStatusFilter = document.getElementById('orders-status-filter')?.value || '';
        const ordersMachineFilter = document.getElementById('analysis-orders-machine-filter')?.value || '';
        const ordersSearchQuery = document.getElementById('orders-search')?.value.toLowerCase() || '';
        const ordersSortValue = document.getElementById('orders-sort-filter')?.value || 'recent';

        let filteredOrders = ordersWithProgress;

        // Filtro por status
        if (ordersStatusFilter) {
            filteredOrders = filteredOrders.filter(order => {
                const status = (order.status || '').toLowerCase();
                if (ordersStatusFilter === 'planejada') return status === 'planejada';
                if (ordersStatusFilter === 'em_andamento') return status === 'em_andamento';
                if (ordersStatusFilter === 'ativa') return status === 'ativa';
                if (ordersStatusFilter === 'concluida') return status === 'concluida' || status === 'finalizada';
                if (ordersStatusFilter === 'cancelada') return status === 'cancelada';
                return true;
            });
        }

        // Filtro por máquina
        if (ordersMachineFilter) {
            filteredOrders = filteredOrders.filter(order => {
                return order.machine_id === ordersMachineFilter;
            });
        }

        // Filtro de busca
        if (ordersSearchQuery) {
            filteredOrders = filteredOrders.filter(order => 
                (order.order_number || '').toLowerCase().includes(ordersSearchQuery) ||
                (order.product || '').toLowerCase().includes(ordersSearchQuery) ||
                (order.part_code || '').toLowerCase().includes(ordersSearchQuery) ||
                (order.customer || '').toLowerCase().includes(ordersSearchQuery)
            );
        }

        // Ordenação
        filteredOrders.sort((a, b) => {
            switch (ordersSortValue) {
                case 'recent':
                    const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt) || new Date(0);
                    const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt) || new Date(0);
                    return dateB - dateA;
                case 'oldest':
                    const dateA2 = a.createdAt?.toDate?.() || new Date(a.createdAt) || new Date(0);
                    const dateB2 = b.createdAt?.toDate?.() || new Date(b.createdAt) || new Date(0);
                    return dateA2 - dateB2;
                case 'progress-desc':
                    return (b.progress || 0) - (a.progress || 0);
                case 'progress-asc':
                    return (a.progress || 0) - (b.progress || 0);
                case 'lot-desc':
                    return (Number(b.lot_size) || 0) - (Number(a.lot_size) || 0);
                case 'lot-asc':
                    return (Number(a.lot_size) || 0) - (Number(b.lot_size) || 0);
                case 'alpha':
                case 'name-asc':
                    return (a.order_number || '').localeCompare(b.order_number || '');
                default:
                    return 0;
            }
        });

        // ===== ATUALIZAR KPIs =====
        const totalOrders = ordersWithProgress.length;
        const activeOrders = ordersWithProgress.filter(o => ['ativa', 'em_andamento'].includes((o.status || '').toLowerCase())).length;
        const completedOrders = ordersWithProgress.filter(o => ['concluida', 'finalizada'].includes((o.status || '').toLowerCase())).length;
        const avgProgress = totalOrders > 0 
            ? Math.round(ordersWithProgress.reduce((sum, o) => sum + (o.progress || 0), 0) / totalOrders)
            : 0;

        // Atualizar elementos KPI no DOM
        const kpiTotal = document.getElementById('orders-kpi-total');
        const kpiActive = document.getElementById('orders-kpi-active');
        const kpiCompleted = document.getElementById('orders-kpi-completed');
        const kpiProgress = document.getElementById('orders-kpi-avg-progress');

        if (kpiTotal) kpiTotal.textContent = totalOrders.toLocaleString('pt-BR');
        if (kpiActive) kpiActive.textContent = activeOrders.toLocaleString('pt-BR');
        if (kpiCompleted) kpiCompleted.textContent = completedOrders.toLocaleString('pt-BR');
        if (kpiProgress) kpiProgress.textContent = `${avgProgress}%`;

        // ===== GERAR CARDS DE ORDENS =====
        const ordersHtml = filteredOrders.map(order => {
            const progressPercent = Math.min(order.progress || 0, 100);
            const progressColor = progressPercent >= 100 ? 'bg-emerald-500' : progressPercent >= 70 ? 'bg-blue-500' : progressPercent >= 40 ? 'bg-amber-500' : 'bg-red-500';
            const progressRingColor = progressPercent >= 100 ? 'text-emerald-500' : progressPercent >= 70 ? 'text-blue-500' : progressPercent >= 40 ? 'text-amber-500' : 'text-red-500';
            const lotSizeNumeric = Number(order.lot_size) || 0;
            const status = (order.status || '').toLowerCase();

            // Mapa de cores para status
            const statusColorMap = {
                'planejada': { badge: 'bg-slate-100 text-slate-600 border border-slate-300', icon: 'calendar', label: 'Planejada' },
                'em_andamento': { badge: 'bg-amber-100 text-amber-700 border border-amber-300', icon: 'play-circle', label: 'Em Andamento' },
                'ativa': { badge: 'bg-blue-100 text-blue-700 border border-blue-300', icon: 'zap', label: 'Ativa' },
                'concluida': { badge: 'bg-emerald-100 text-emerald-700 border border-emerald-300', icon: 'check-circle-2', label: 'Concluída' },
                'finalizada': { badge: 'bg-emerald-100 text-emerald-700 border border-emerald-300', icon: 'check-circle-2', label: 'Finalizada' },
                'cancelada': { badge: 'bg-red-100 text-red-700 border border-red-300', icon: 'x-circle', label: 'Cancelada' }
            };

            const statusDisplay = statusColorMap[status] || statusColorMap['planejada'];
            const isActive = status === 'ativa' || status === 'em_andamento';

            // Buscar modelo da máquina
            const machineInfo = window.databaseModule?.machineById?.get(order.machine_id);
            const machineLabel = machineInfo ? `${order.machine_id} - ${machineInfo.model}` : (order.machine_id || 'N/A');

            // Data de criação formatada
            const createdDate = order.createdAt?.toDate?.() || new Date(order.createdAt);
            const formattedDate = createdDate instanceof Date && !isNaN(createdDate) 
                ? createdDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
                : '';

            // Verificar se pode reativar
            const isReactivatable = ['concluida','finalizada','encerrada'].includes(status);

            return `
                <div class="group bg-white rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100 overflow-hidden ${isActive ? 'ring-2 ring-blue-400 ring-offset-1' : ''}">
                    <!-- Header do Card -->
                    <div class="p-4 border-b border-gray-50 bg-gradient-to-r ${isActive ? 'from-blue-50 to-white' : 'from-gray-50 to-white'}">
                        <div class="flex items-start justify-between gap-2">
                            <div class="flex-1 min-w-0">
                                <div class="flex items-center gap-2">
                                    <span class="text-lg font-bold text-gray-800 truncate">${escapeHtml(order.order_number)}</span>
                                    ${formattedDate ? `<span class="text-xs text-gray-400">${formattedDate}</span>` : ''}
                                </div>
                                <p class="text-sm text-gray-600 truncate mt-0.5" title="${escapeHtml(order.product || '')}">${escapeHtml(order.product || 'Produto não especificado')}</p>
                            </div>
                            <span class="flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${statusDisplay.badge}">
                                <i data-lucide="${statusDisplay.icon}" class="w-3 h-3"></i>
                                ${statusDisplay.label}
                            </span>
                        </div>
                    </div>

                    <!-- Corpo do Card -->
                    <div class="p-4">
                        <!-- Informações principais em grid compacto -->
                        <div class="grid grid-cols-2 gap-3 text-sm mb-4">
                            <div class="flex items-center gap-2">
                                <i data-lucide="user" class="w-4 h-4 text-gray-400"></i>
                                <span class="text-gray-600 truncate" title="${escapeHtml(order.customer || '')}">${escapeHtml(order.customer || 'N/A')}</span>
                            </div>
                            <div class="flex items-center gap-2">
                                <i data-lucide="cog" class="w-4 h-4 text-gray-400"></i>
                                <span class="text-gray-600 truncate" title="${escapeHtml(machineLabel)}">${escapeHtml(machineLabel)}</span>
                            </div>
                            <div class="flex items-center gap-2">
                                <i data-lucide="hash" class="w-4 h-4 text-gray-400"></i>
                                <span class="text-gray-600 truncate" title="${escapeHtml(order.part_code || '')}">${escapeHtml(order.part_code || 'N/A')}</span>
                            </div>
                            ${order.raw_material ? `
                            <div class="flex items-center gap-2">
                                <i data-lucide="package" class="w-4 h-4 text-gray-400"></i>
                                <span class="text-gray-600 truncate" title="${escapeHtml(order.raw_material)}">${escapeHtml(order.raw_material)}</span>
                            </div>
                            ` : '<div></div>'}
                        </div>

                        <!-- Progresso Visual -->
                        <div class="bg-gray-50 rounded-lg p-3">
                            <div class="flex items-center justify-between mb-2">
                                <span class="text-xs font-medium text-gray-500 uppercase tracking-wide">Progresso da OP</span>
                                <span class="text-sm font-bold ${progressRingColor}">${Math.round(progressPercent)}%</span>
                            </div>
                            <div class="w-full bg-gray-200 rounded-full h-2 mb-2">
                                <div class="${progressColor} h-2 rounded-full transition-all duration-500" style="width: ${progressPercent}%"></div>
                            </div>
                            <div class="flex justify-between text-xs text-gray-500">
                                <span><strong class="text-emerald-600">${order.totalProduced.toLocaleString('pt-BR')}</strong> produzido</span>
                                <span><strong class="text-gray-700">${lotSizeNumeric.toLocaleString('pt-BR')}</strong> planejado</span>
                            </div>
                            ${order.remaining > 0 ? `<div class="text-center mt-1 text-xs text-amber-600">Faltam <strong>${order.remaining.toLocaleString('pt-BR')}</strong> un</div>` : ''}
                        </div>
                    </div>

                    <!-- Footer com Ações -->
                    <div class="px-4 pb-4 flex gap-2">
                        ${status === 'planejada' ? `
                        <button class="activate-order-btn flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium text-sm transition-colors" data-order-id="${order.id}" data-machine-id="${order.machine_id || ''}">
                            <i data-lucide="play" class="w-4 h-4"></i>
                            Ativar
                        </button>
                        ` : ''}
                        ${isReactivatable ? `
                        <button class="reactivate-order-btn flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors" data-order-id="${order.id}">
                            <i data-lucide="rotate-ccw" class="w-4 h-4"></i>
                            Reativar
                        </button>
                        ` : ''}
                        <button class="edit-order-btn ${(status === 'planejada' || isReactivatable) ? 'flex-1' : 'w-full'} flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium text-sm transition-colors" data-order-id="${order.id}">
                            <i data-lucide="edit-3" class="w-4 h-4"></i>
                            Editar
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        if (filteredOrders.length === 0) {
            ordersGrid.innerHTML = `
                <div class="col-span-full flex flex-col items-center justify-center py-16">
                    <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                        <i data-lucide="inbox" class="w-8 h-8 text-gray-400"></i>
                    </div>
                    <h3 class="text-lg font-medium text-gray-700 mb-1">Nenhuma ordem encontrada</h3>
                    <p class="text-sm text-gray-500">Tente ajustar os filtros de busca</p>
                </div>
            `;
        } else {
            ordersGrid.innerHTML = ordersHtml;
        }

        try {
            if (typeof lucide !== "undefined") lucide.createIcons();
        } catch (iconError) {
            console.warn('Falha ao renderizar ícones lucide na aba de ordens:', iconError);
        }

        const noDataContainer = document.getElementById('analysis-no-data');
        if (filteredOrders.length > 0 && noDataContainer) {
            noDataContainer.classList.add('hidden');
        }

        // Configurar event listeners para filtros
        const ordersStatusFilterBtn = document.getElementById('orders-status-filter');
        const ordersMachineFilterBtn = document.getElementById('analysis-orders-machine-filter');
        const ordersSearchInput = document.getElementById('orders-search');
        const ordersSortSelect = document.getElementById('orders-sort-filter');
        const ordersClearFiltersBtn = document.getElementById('orders-clear-filters');
        const ordersRefreshBtn = document.getElementById('orders-refresh-btn');
        const ordersResultsCount = document.getElementById('orders-results-count');
        
        // Atualizar contador de resultados
        if (ordersResultsCount) {
            ordersResultsCount.textContent = `${filteredOrders.length} ordem${filteredOrders.length !== 1 ? 'ns' : ''} encontrada${filteredOrders.length !== 1 ? 's' : ''}`;
        }
        
        if (ordersStatusFilterBtn && !ordersStatusFilterBtn.dataset.listenerAttached) {
            ordersStatusFilterBtn.addEventListener('change', () => loadOrdersAnalysis());
            ordersStatusFilterBtn.dataset.listenerAttached = 'true';
        }

        if (ordersMachineFilterBtn && !ordersMachineFilterBtn.dataset.listenerAttached) {
            ordersMachineFilterBtn.addEventListener('change', () => loadOrdersAnalysis());
            ordersMachineFilterBtn.dataset.listenerAttached = 'true';
        }
        
        if (ordersSearchInput && !ordersSearchInput.dataset.listenerAttached) {
            ordersSearchInput.addEventListener('input', debounce(() => loadOrdersAnalysis(), 300));
            ordersSearchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    loadOrdersAnalysis();
                }
            });
            ordersSearchInput.dataset.listenerAttached = 'true';
        }

        // Botão de busca explícito
        const ordersSearchBtn = document.getElementById('orders-search-btn');
        if (ordersSearchBtn && !ordersSearchBtn.dataset.listenerAttached) {
            ordersSearchBtn.addEventListener('click', () => loadOrdersAnalysis());
            ordersSearchBtn.dataset.listenerAttached = 'true';
        }

        if (ordersSortSelect && !ordersSortSelect.dataset.listenerAttached) {
            ordersSortSelect.addEventListener('change', () => loadOrdersAnalysis());
            ordersSortSelect.dataset.listenerAttached = 'true';
        }

        if (ordersClearFiltersBtn && !ordersClearFiltersBtn.dataset.listenerAttached) {
            ordersClearFiltersBtn.addEventListener('click', () => {
                if (ordersStatusFilterBtn) ordersStatusFilterBtn.value = '';
                if (ordersMachineFilterBtn) ordersMachineFilterBtn.value = '';
                if (ordersSearchInput) ordersSearchInput.value = '';
                if (ordersSortSelect) ordersSortSelect.value = 'recent';
                loadOrdersAnalysis();
            });
            ordersClearFiltersBtn.dataset.listenerAttached = 'true';
        }

        if (ordersRefreshBtn && !ordersRefreshBtn.dataset.listenerAttached) {
            ordersRefreshBtn.addEventListener('click', async () => {
                productionOrdersCache = null;
                await loadOrdersAnalysis();
                showNotification('Ordens atualizadas!', 'success');
            });
            ordersRefreshBtn.dataset.listenerAttached = 'true';
        }

        // Toggle de visualização Grid/Lista
        const ordersViewGrid = document.getElementById('orders-view-grid');
        const ordersViewList = document.getElementById('orders-view-list');
        const ordersListContainer = document.getElementById('orders-list');
        
        if (ordersViewGrid && !ordersViewGrid.dataset.listenerAttached) {
            ordersViewGrid.addEventListener('click', () => {
                ordersGrid.classList.remove('hidden');
                if (ordersListContainer) ordersListContainer.classList.add('hidden');
                ordersViewGrid.classList.add('bg-white', 'shadow-sm', 'text-primary-blue');
                ordersViewGrid.classList.remove('text-gray-500');
                if (ordersViewList) {
                    ordersViewList.classList.remove('bg-white', 'shadow-sm', 'text-primary-blue');
                    ordersViewList.classList.add('text-gray-500');
                }
            });
            ordersViewGrid.dataset.listenerAttached = 'true';
        }

        if (ordersViewList && !ordersViewList.dataset.listenerAttached) {
            ordersViewList.addEventListener('click', () => {
                ordersGrid.classList.add('hidden');
                if (ordersListContainer) {
                    ordersListContainer.classList.remove('hidden');
                    populateOrdersListView(filteredOrders);
                }
                ordersViewList.classList.add('bg-white', 'shadow-sm', 'text-primary-blue');
                ordersViewList.classList.remove('text-gray-500');
                if (ordersViewGrid) {
                    ordersViewGrid.classList.remove('bg-white', 'shadow-sm', 'text-primary-blue');
                    ordersViewGrid.classList.add('text-gray-500');
                }
            });
            ordersViewList.dataset.listenerAttached = 'true';
        }

        // Função para preencher view de lista (tabela)
        function populateOrdersListView(orders) {
            const listBody = document.getElementById('orders-list-body');
            if (!listBody) return;

            const statusColorMap = {
                'planejada': { badge: 'bg-slate-100 text-slate-600', label: 'Planejada' },
                'em_andamento': { badge: 'bg-amber-100 text-amber-700', label: 'Em Andamento' },
                'ativa': { badge: 'bg-blue-100 text-blue-700', label: 'Ativa' },
                'concluida': { badge: 'bg-emerald-100 text-emerald-700', label: 'Concluída' },
                'finalizada': { badge: 'bg-emerald-100 text-emerald-700', label: 'Finalizada' },
                'cancelada': { badge: 'bg-red-100 text-red-700', label: 'Cancelada' }
            };

            listBody.innerHTML = orders.map(order => {
                const status = (order.status || '').toLowerCase();
                const statusDisplay = statusColorMap[status] || statusColorMap['planejada'];
                const progressPercent = Math.min(order.progress || 0, 100);
                const progressColor = progressPercent >= 100 ? 'bg-emerald-500' : progressPercent >= 70 ? 'bg-blue-500' : progressPercent >= 40 ? 'bg-amber-500' : 'bg-red-500';
                const lotSize = Number(order.lot_size) || 0;
                const machineInfo = window.databaseModule?.machineById?.get(order.machine_id);
                const machineLabel = machineInfo ? `${order.machine_id}` : (order.machine_id || 'N/A');

                return `
                    <tr class="hover:bg-gray-50 transition-colors">
                        <td class="px-4 py-3 text-sm font-semibold text-gray-800">${escapeHtml(order.order_number)}</td>
                        <td class="px-4 py-3 text-sm text-gray-600 max-w-xs truncate" title="${escapeHtml(order.product || '')}">${escapeHtml(order.product || 'N/A')}</td>
                        <td class="px-4 py-3 text-sm text-gray-600">${escapeHtml(machineLabel)}</td>
                        <td class="px-4 py-3">
                            <span class="inline-flex px-2 py-1 rounded-full text-xs font-medium ${statusDisplay.badge}">${statusDisplay.label}</span>
                        </td>
                        <td class="px-4 py-3">
                            <div class="flex items-center gap-2">
                                <div class="flex-1 bg-gray-200 rounded-full h-2 w-20">
                                    <div class="${progressColor} h-2 rounded-full" style="width: ${progressPercent}%"></div>
                                </div>
                                <span class="text-xs font-medium text-gray-600">${Math.round(progressPercent)}%</span>
                            </div>
                        </td>
                        <td class="px-4 py-3 text-sm text-right font-medium text-emerald-600">${order.totalProduced.toLocaleString('pt-BR')}</td>
                        <td class="px-4 py-3 text-sm text-right text-gray-600">${lotSize.toLocaleString('pt-BR')}</td>
                        <td class="px-4 py-3 text-center">
                            <button class="edit-order-btn p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" data-order-id="${order.id}" title="Editar">
                                <i data-lucide="edit-3" class="w-4 h-4"></i>
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');

            if (typeof lucide !== "undefined") lucide.createIcons();

            // Re-attach listeners para botões de edição na lista
            listBody.querySelectorAll('.edit-order-btn').forEach(btn => {
                if (!btn.dataset.listenerAttached) {
                    btn.addEventListener('click', async () => {
                        const orderId = btn.getAttribute('data-order-id');
                        if (!orderId) return;
                        // Simular click no botão do grid
                        const gridBtn = document.querySelector(`.edit-order-btn[data-order-id="${orderId}"]`);
                        if (gridBtn) gridBtn.click();
                    });
                    btn.dataset.listenerAttached = 'true';
                }
            });
        }

        if (typeof lucide !== "undefined") lucide.createIcons();

        // Adicionar event listener para botões de reativação
        document.querySelectorAll('.reactivate-order-btn').forEach(btn => {
            if (!btn.dataset.listenerAttached) {
                btn.addEventListener('click', async (e) => {
                    const orderId = btn.getAttribute('data-order-id');
                    if (!orderId) return;
                    if (!confirm('Deseja realmente reativar esta ordem? Ela voltará ao status ATIVA.')) return;
                    try {
                        await getDb().collection('production_orders').doc(orderId).update({ status: 'ativa' });
                        showNotification('Ordem reativada com sucesso!', 'success');
                        await loadOrdersAnalysis();
                    } catch (err) {
                        showNotification('Erro ao reativar ordem. Tente novamente.', 'error');
                        console.error('Erro ao reativar ordem:', err);
                    }
                });
                btn.dataset.listenerAttached = 'true';
            }
        });

        // Adicionar event listener para botões de ativação (ordens planejadas)
        document.querySelectorAll('.activate-order-btn').forEach(btn => {
            if (!btn.dataset.listenerAttached) {
                btn.addEventListener('click', async (e) => {
                    const orderId = btn.getAttribute('data-order-id');
                    const machineId = btn.getAttribute('data-machine-id');
                    if (!orderId) return;
                    
                    // Verificar se há máquina definida
                    if (!machineId) {
                        showNotification('Esta ordem não tem máquina definida. Edite a ordem e selecione uma máquina primeiro.', 'warning');
                        return;
                    }
                    
                    if (!confirm(`Deseja ativar esta ordem na máquina ${machineId}?`)) return;
                    
                    try {
                        // Atualizar status para ativa
                        await getDb().collection('production_orders').doc(orderId).update({ 
                            status: 'ativa',
                            activatedAt: firebase.firestore.FieldValue.serverTimestamp()
                        });
                        showNotification('Ordem ativada com sucesso!', 'success');

                        // Registrar no histórico do sistema
                        if (typeof logSystemAction === 'function') {
                            logSystemAction('ordem_ativada', `Ordem ${orderId} ativada`, {
                                maquina: machineId,
                                orderId: orderId
                            });
                        }
                        
                        // Atualizar cache e recarregar
                        productionOrdersCache = null;
                        await loadOrdersAnalysis();
                    } catch (err) {
                        showNotification('Erro ao ativar ordem. Tente novamente.', 'error');
                        console.error('Erro ao ativar ordem:', err);
                    }
                });
                btn.dataset.listenerAttached = 'true';
            }
        });

        // Adicionar event listener para botões de edição
        document.querySelectorAll('.edit-order-btn').forEach(btn => {
            if (!btn.dataset.listenerAttached) {
                btn.addEventListener('click', async (e) => {
                    const orderId = btn.getAttribute('data-order-id');
                    if (!orderId) return;
                    // Buscar dados da ordem
                    let orderData = null;
                    if (Array.isArray(productionOrdersCache)) {
                        orderData = productionOrdersCache.find(o => o.id === orderId);
                    }
                    if (!orderData) {
                        try {
                            const doc = await getDb().collection('production_orders').doc(orderId).get();
                            if (doc.exists) orderData = { id: doc.id, ...doc.data() };
                        } catch (err) { orderData = null; }
                    }
                    if (!orderData) {
                        showNotification('Ordem não encontrada.', 'error');
                        return;
                    }
                    // Preencher campos do modal
                    document.getElementById('edit-order-id').value = orderData.id;
                    // Preencher select de produtos
                    const productSelect = document.getElementById('edit-order-product');
                    productSelect.innerHTML = '';
                    if (window.databaseModule && window.databaseModule.productByCode) {
                        const products = Array.from(window.databaseModule.productByCode.values());
                        products.forEach(prod => {
                            const opt = document.createElement('option');
                            opt.value = prod.cod;
                            opt.textContent = `${prod.cod} - ${prod.name} (${prod.client})`;
                            if ((orderData.product_cod || orderData.part_code || orderData.product) == prod.cod || orderData.product == prod.name) opt.selected = true;
                            productSelect.appendChild(opt);
                        });
                    } else {
                        const opt = document.createElement('option');
                        opt.value = orderData.product || '';
                        opt.textContent = orderData.product || '';
                        opt.selected = true;
                        productSelect.appendChild(opt);
                    }

                    // Preencher select de máquinas
                    const machineSelect = document.getElementById('edit-order-machine');
                    machineSelect.innerHTML = '';
                    if (window.databaseModule && window.databaseModule.machineById) {
                        const machines = Array.from(window.databaseModule.machineById.values());
                        machines.forEach(mac => {
                            const opt = document.createElement('option');
                            opt.value = mac.id;
                            opt.textContent = `${mac.id} - ${mac.model}`;
                            if ((orderData.machine_id || orderData.machine) == mac.id) opt.selected = true;
                            machineSelect.appendChild(opt);
                        });
                    } else {
                        const opt = document.createElement('option');
                        opt.value = orderData.machine_id || orderData.machine || '';
                        opt.textContent = orderData.machine_id || orderData.machine || '';
                        opt.selected = true;
                        machineSelect.appendChild(opt);
                    }

                    document.getElementById('edit-order-customer').value = orderData.customer || orderData.client || '';
                    document.getElementById('edit-order-lot').value = orderData.lot || orderData.lot_size || '';
                    document.getElementById('edit-order-planned').value = orderData.lot_size || '';
                    document.getElementById('edit-order-executed').value = orderData.total_produzido || orderData.totalProduced || '';
                    
                    // Mostrar info de última edição
                    const lastAdj = orderData.lastManualAdjustment;
                    if (lastAdj && lastAdj.editedByName) {
                        const adjTime = lastAdj.timestamp?.toDate?.() || new Date();
                        const timeStr = adjTime.toLocaleString('pt-BR');
                        console.log(`[EDIT-ORDER] Última edição: ${lastAdj.editedByName} em ${timeStr}`);
                    }
                    
                    document.getElementById('edit-order-modal').classList.remove('hidden');
                });
                btn.dataset.listenerAttached = 'true';
            }
        });
// Modal de edição de ordem
document.getElementById('close-edit-order-modal').onclick = () => {
    document.getElementById('edit-order-modal').classList.add('hidden');
};
document.getElementById('cancel-edit-order').onclick = () => {
    document.getElementById('edit-order-modal').classList.add('hidden');
};
document.getElementById('edit-order-form').onsubmit = async function(e) {
    e.preventDefault();
    const id = document.getElementById('edit-order-id').value;
    const product = document.getElementById('edit-order-product').value;
    const machine = document.getElementById('edit-order-machine').value;
    const customer = document.getElementById('edit-order-customer').value;
    const lot = document.getElementById('edit-order-lot').value;
    const planned = Number(document.getElementById('edit-order-planned').value);
    const executed = Number(document.getElementById('edit-order-executed').value);
    if (!id) return;
    try {
        const currentUser = getActiveUser();
        
        const updateData = {
            product,
            machine_id: machine,
            customer,
            lot_size: planned,
            total_produzido: executed,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        if (executed > 0) {
            updateData.lastManualAdjustment = {
                value: executed,
                editedBy: currentUser?.username || 'desconhecido',
                editedByName: currentUser?.name || 'Desconhecido',
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                reason: 'Edição manual via interface'
            };
            console.log(`[AUDIT] ${currentUser?.name || 'Desconhecido'} editou quantidade da ordem ${id}: ${executed}`);
        }
        
        await getDb().collection('production_orders').doc(id).update(updateData);
        showNotification('Ordem atualizada com sucesso!', 'success');
        document.getElementById('edit-order-modal').classList.add('hidden');
        
        // CRÍTICO: Invalidar cache de ordens para forçar recarregamento do banco
        productionOrdersCache = null;
        
        // Aguardar Firestore processar E atualizar todas as visualizações
        console.log('[EDIT-ORDER-HANDLER] Iniciando refresh após edição...');
        
        // 1. Recarregar lista de análise de ordens
        await loadOrdersAnalysis();
        console.log('[EDIT-ORDER-HANDLER] loadOrdersAnalysis() concluído');
        
        // 2. CRÍTICO: Recarregar seletor de máquinas (atualiza aba Lançamentos)
        // Usar Promise para aguardar o evento machineDataUpdated
        const machineDataPromise = new Promise((resolve) => {
            const handler = () => {
                console.log('[EDIT-ORDER-HANDLER] Evento machineDataUpdated recebido');
                document.removeEventListener('machineDataUpdated', handler);
                resolve();
            };
            document.addEventListener('machineDataUpdated', handler);
            // Timeout de 3s para segurança
            setTimeout(() => {
                document.removeEventListener('machineDataUpdated', handler);
                console.warn('[EDIT-ORDER-HANDLER] Timeout aguardando machineDataUpdated');
                resolve();
            }, 3000);
        });
        
        await populateMachineSelector(); // Aguardar completamente
        await machineDataPromise; // Aguardar evento
        console.log('[EDIT-ORDER-HANDLER] populateMachineSelector() concluído e dados prontos');
        
        // 3. Recarregar dados atuais da máquina selecionada do machineCardData
        if (window.selectedMachineData && window.selectedMachineData.machine) {
            const machineName = window.selectedMachineData.machine;
            const machineDataArray = machineCardData[machineName];
            // machineCardData agora é array - pegar primeiro plano para compatibilidade
            const updatedMachineData = Array.isArray(machineDataArray) ? machineDataArray[0] : machineDataArray;
            if (updatedMachineData) {
                window.selectedMachineData = updatedMachineData;
                console.log('[EDIT-ORDER-HANDLER] window.selectedMachineData atualizado:', { 
                    total: window.selectedMachineData.total_produzido, 
                    lot: window.selectedMachineData.lot_size || window.selectedMachineData.order_lot_size 
                });
            }
            
            // 4. Forçar re-seleção da máquina para atualizar o painel completamente
            if (typeof onMachineSelected === 'function') {
                await onMachineSelected(machineName);
                console.log('[EDIT-ORDER-HANDLER] onMachineSelected() executado para', machineName);
            }
        }
        
        // 5. Forçar atualização visual da aba Lançamentos
        updateMachineInfo();
        console.log('[EDIT-ORDER-HANDLER] updateMachineInfo() concluído');
        
        // 6. Se gráfico OP estiver aberto, atualizar também
        if (launchChartMode === 'op') {
            await loadOpProductionChart();
            console.log('[EDIT-ORDER-HANDLER] loadOpProductionChart() concluído');
        }
        
        // 7. Atualizar estatísticas
        await loadTodayStats();
        console.log('[EDIT-ORDER-HANDLER] ✅ Refresh completo finalizado!');
    } catch (err) {
        showNotification('Erro ao atualizar ordem.', 'error');
        console.error('Erro ao atualizar ordem:', err);
    }
};
    }

    // Função para carregar visão geral
    async function loadOverviewData() {
        let { startDate, endDate, machine, shift } = currentAnalysisFilters;
        console.log('[TRACE][loadOverviewData] fetching data', { startDate, endDate, machine, shift });
        
        if (!startDate || !endDate) {
            console.warn('[TRACE][loadOverviewData] missing date filters, initializing defaults');
            setAnalysisDefaultDates();
            // Reler os filtros após inicialização (não retornar mais sem carregar)
            ({ startDate, endDate, machine, shift } = currentAnalysisFilters);
        }
        
        // Buscar dados do Firebase (sempre sem filtro de turno para permitir comparação geral)
        const [productionAll, lossesAll, downtimeAll, planData] = await Promise.all([
            getFilteredData('production', startDate, endDate, machine, 'all'),
            getFilteredData('losses', startDate, endDate, machine, 'all'),
            getFilteredData('downtime', startDate, endDate, machine, 'all'),
            getFilteredData('plan', startDate, endDate, machine, 'all')
        ]);

        console.log('[TRACE][loadOverviewData] datasets received', {
            productionCount: productionAll.length,
            lossesCount: lossesAll.length,
            downtimeCount: downtimeAll.length,
            planCount: planData.length,
            productionSample: productionAll.slice(0, 2),
            lossesSample: lossesAll.slice(0, 2),
            downtimeSample: downtimeAll.slice(0, 2)
        });

        // Atualizar informações do produto se uma máquina específica foi selecionada
        if (machine && machine !== 'all' && productionAll.length > 0) {
            const firstProduction = productionAll[0];
            if (firstProduction.product_code) {
                const productInfo = window.databaseModule?.productByCode?.get(Number(firstProduction.product_code)) || 
                                   window.databaseModule?.productByCode?.get(firstProduction.product_code);
                if (productInfo) {
                    updateAnalysisProductInfo(
                        firstProduction.product_code,
                        productInfo.cycle,
                        productInfo.cavities,
                        productInfo.weight,
                        productInfo.name
                    );
                }
            }
        }

        const normalizeShiftFilter = (value) => {
            if (value === undefined || value === null || value === 'all') return 'all';
            const num = Number(value);
            return Number.isFinite(num) ? num : 'all';
        };

        const appliedShift = normalizeShiftFilter(shift);

        const filterByShift = (data) => {
            if (appliedShift === 'all') return data;
            return data.filter(item => Number(item.shift || 0) === appliedShift);
        };

    const productionData = filterByShift(productionAll);
    const lossesData = filterByShift(lossesAll);
    const downtimeFiltered = filterByShift(downtimeAll);
    const planFiltered = filterByShift(planData);

        // CORREÇÃO: Usar consolidateDowntimeEvents para consistência com aba Paradas
        const downtimeConsolidated = consolidateDowntimeEvents(downtimeFiltered);

        // Calcular KPIs básicos
        const totalProduction = productionData.reduce((sum, item) => sum + item.quantity, 0);
    const totalLosses = lossesData.reduce((sum, item) => sum + (Number(item.scrapPcs ?? item.quantity ?? 0) || 0), 0);
        // Calcular tempo de paradas usando dados consolidados (igual à aba Paradas)
        const totalDowntime = downtimeConsolidated.reduce((sum, item) => sum + (item.duration || 0), 0);
        
        // Fase 2: Calcular OEE direto via aggregateOeeMetrics (calculateOverviewOEE removida)
        const { overall: overallAgg, filtered: filteredAgg } = aggregateOeeMetrics(
            productionAll,
            lossesAll,
            downtimeAll,
            planData,
            appliedShift
        );
        const overallOee = overallAgg.oee;
        const filteredOee = filteredAgg.oee;
        const displayedOee = appliedShift === 'all' ? overallOee : filteredOee;
        
        // Atualizar KPIs na interface
        const overviewOee = document.getElementById('overview-oee');
        const overviewProduction = document.getElementById('overview-production');
        const overviewLosses = document.getElementById('overview-losses');
        const overviewDowntime = document.getElementById('overview-downtime');
        
        if (overviewOee) {
            if (appliedShift === 'all') {
                overviewOee.textContent = `${(overallOee * 100).toFixed(1)}%`;
            } else {
                overviewOee.textContent = `Turno: ${(filteredOee * 100).toFixed(1)}% | Geral: ${(overallOee * 100).toFixed(1)}%`;
            }
        }
        if (overviewProduction) overviewProduction.textContent = totalProduction.toLocaleString();
    if (overviewLosses) overviewLosses.textContent = totalLosses.toLocaleString('pt-BR');
        if (overviewDowntime) overviewDowntime.textContent = `${(totalDowntime / 60).toFixed(1)}h`;

        console.log('[TRACE][loadOverviewData] KPIs calculated', { 
            overallOee: (overallOee * 100).toFixed(1) + '%',
            filteredOee: (filteredOee * 100).toFixed(1) + '%',
            totalProduction, 
            totalLosses, 
            totalDowntime 
        });

        // Gerar gráficos
        await generateOEEDistributionChart(productionData, lossesData, downtimeConsolidated, planFiltered);
    await generateMachineRanking(productionData, planFiltered);
    }

    function aggregateOeeMetrics(productionData, lossesData, downtimeData, planData, shiftFilter = 'all') {
        console.log('[TRACE][aggregateOeeMetrics] iniciando com', {
            production: productionData.length,
            losses: lossesData.length,
            downtime: downtimeData.length,
            plan: planData.length,
            shiftFilter
        });

        const toShiftNumber = (value) => {
            if (value === null || value === undefined) return null;
            const num = Number(value);
            return Number.isFinite(num) && num > 0 ? num : null;
        };

        const determineShiftFromTime = (timeStr) => {
            if (!timeStr || typeof timeStr !== 'string') return null;
            const [hoursStr, minutesStr] = timeStr.split(':');
            const hours = Number(hoursStr);
            const minutes = Number(minutesStr) || 0;
            if (!Number.isFinite(hours)) return null;
            // T1: 06:30 - 14:59
            if ((hours === 6 && minutes >= 30) || (hours >= 7 && hours < 15)) return 1;
            // T2: 15:00 - 23:19
            if (hours >= 15 && (hours < 23 || (hours === 23 && minutes < 20))) return 2;
            // T3: 23:20 - 06:29
            return 3;
        };

        const determineShiftFromDate = (dateObj) => {
            if (!(dateObj instanceof Date) || Number.isNaN(dateObj.getTime())) return null;
            const hours = dateObj.getHours();
            return determineShiftFromTime(`${String(hours).padStart(2, '0')}:00`);
        };

        const inferShift = (item) => {
            const candidates = [
                item.shift,
                item?.raw?.shift,
                item?.raw?.turno,
                item?.raw?.Shift,
                item?.raw?.Turno
            ];
            for (const value of candidates) {
                const shiftNum = toShiftNumber(value);
                if (shiftNum) return shiftNum;
            }

            const timeCandidates = [
                item.startTime,
                item.endTime,
                item?.raw?.startTime,
                item?.raw?.endTime,
                item?.raw?.hora,
                item?.raw?.hour,
                item?.raw?.time,
                item?.raw?.horaInformada
            ];
            for (const time of timeCandidates) {
                const shiftNum = determineShiftFromTime(time);
                if (shiftNum) return shiftNum;
            }

            const dateCandidates = [];
            if (item.datetime) {
                const parsed = new Date(item.datetime);
                if (!Number.isNaN(parsed.getTime())) dateCandidates.push(parsed);
            }
            if (item?.raw?.timestamp?.toDate) {
                dateCandidates.push(item.raw.timestamp.toDate());
            }
            if (item?.raw?.createdAt?.toDate) {
                dateCandidates.push(item.raw.createdAt.toDate());
            }
            if (item?.raw?.updatedAt?.toDate) {
                dateCandidates.push(item.raw.updatedAt.toDate());
            }
            const resolvedDate = resolveProductionDateTime(item.raw);
            if (resolvedDate) {
                dateCandidates.push(resolvedDate);
            }
            for (const date of dateCandidates) {
                const shiftNum = determineShiftFromDate(date);
                if (shiftNum) return shiftNum;
            }

            // CORREÇÃO: Se não conseguir inferir o turno, assume turno 1 (padrão) para evitar descarte
            console.log('[TRACE][aggregateOeeMetrics] turno não identificado para item', item.id || 'sem-id', 'assumindo turno 1');
            return 1;
        };

        const inferMachine = (item) => item.machine || item?.raw?.machine || item?.raw?.machineRef || item?.raw?.machine_id || null;

        // CORREÇÃO: Incluir workDay/date no agrupamento para múltiplas datas
        const groupKey = (machine, shift, workDay) => `${machine || 'unknown'}_${shift ?? 'none'}_${workDay || 'nodate'}`;
        const grouped = {};

        const getOrCreateGroup = (item) => {
            const machine = inferMachine(item);
            const shiftNum = inferShift(item);
            const workDay = item.workDay || item.date || 'nodate';
            
            if (!machine) {
                console.log('[TRACE][aggregateOeeMetrics] máquina não identificada para item', item.id || 'sem-id');
                return null;
            }
            
            const key = groupKey(machine, shiftNum, workDay);
            if (!grouped[key]) {
                grouped[key] = {
                    machine,
                    shift: shiftNum,
                    workDay,
                    production: 0,
                    scrapPcs: 0,
                    scrapKg: 0,
                    downtimeMin: 0
                };
            }
            return grouped[key];
        };

        productionData.forEach(item => {
            const group = getOrCreateGroup(item);
            if (!group) return;
            group.production += item.quantity || 0;
        });

        lossesData.forEach(item => {
            const group = getOrCreateGroup(item);
            if (!group) return;
            const scrapPcs = Number(item.scrapPcs ?? item.quantity ?? 0) || 0;
            const scrapKg = Number(item.scrapKg ?? 0) || 0;
            group.scrapPcs += scrapPcs;
            group.scrapKg += scrapKg;
        });

        // Obter categorias excluídas do OEE
        const oeeExcludedCategories = window.databaseModule?.oeeExcludedCategories || [];
        
        // NOVO: Criar set de máquinas com plano ativo para validação
        const machinesWithPlan = new Set();
        planData.forEach(p => {
            if (p && p.machine) {
                machinesWithPlan.add(normalizeMachineId(p.machine));
            }
        });

        downtimeData.forEach(item => {
            // CORREÇÃO: Verificar se é parada semOP (sem OP planejada)
            // Paradas semOP só devem ser contabilizadas se a máquina tem planejamento
            const isSemOP = item.raw?.semOP === true;
            const machineId = normalizeMachineId(item.machine || '');
            
            if (isSemOP && !machinesWithPlan.has(machineId)) {
                // Máquina SEM OP e SEM planejamento - NÃO contabilizar no OEE
                console.log('[TRACE][aggregateOeeMetrics] Parada semOP ignorada (máquina sem planejamento):', machineId, item.reason);
                return;
            }
            
            const group = getOrCreateGroup(item);
            if (!group) return;
            
            // Verificar se a categoria deve ser excluída do cálculo de OEE
            const reason = item.reason || '';
            const category = getDowntimeCategory(reason);
            if (oeeExcludedCategories.includes(category)) {
                // Parada de categoria excluída - NÃO contabilizar no OEE
                console.log('[TRACE][aggregateOeeMetrics] Parada excluída do OEE:', category, reason);
                return;
            }
            
            group.downtimeMin += item.duration || 0;
        });

        const clamp01 = (value) => Math.max(0, Math.min(1, value));
        const groupsWithMetrics = [];

        console.log('[TRACE][aggregateOeeMetrics] grupos criados:', Object.keys(grouped).length);

        Object.values(grouped).forEach(group => {
            // CORREÇÃO: Buscar planos por máquina e data também
            const planCandidates = planData.filter(p => p && p.raw && p.machine === group.machine);
            
            if (!planCandidates.length) {
                // CORREÇÃO: Se não há plano E não há produção, ignorar do OEE
                // Isso evita contabilizar máquinas que estão apenas "paradas" sem planejamento
                if (group.production === 0) {
                    console.log('[TRACE][aggregateOeeMetrics] ignorando máquina sem plano e sem produção:', group.machine);
                    return;
                }
                
                console.log('[TRACE][aggregateOeeMetrics] sem plano para máquina', group.machine, '— OEE parcial (sem performance)');
                // Fase 2: Sem plano → calcular apenas disponibilidade e qualidade.
                // Performance fica null para não poluir médias com valores inventados.
                const tempoTurnoMin = (window.oeeUtils?.getShiftMinutes || (() => 480))(group.shift);
                const tempoProduzindo = Math.max(0, tempoTurnoMin - Math.max(0, group.downtimeMin));
                const disp = tempoTurnoMin > 0 ? tempoProduzindo / tempoTurnoMin : 0;
                const qual = group.production > 0 ? group.production / (group.production + Math.max(0, group.scrapPcs || 0)) : 1;

                groupsWithMetrics.push({
                    machine: group.machine,
                    shift: group.shift,
                    workDay: group.workDay,
                    production: group.production,
                    shiftMinutes: tempoTurnoMin,
                    disponibilidade: clamp01(disp),
                    performance: null,  // sem plano = sem capacidade teórica
                    qualidade: clamp01(qual),
                    oee: null,          // OEE incompleto
                    semPlano: true
                });
                return;
            }

            // Tentar encontrar plano específico para o turno
            let plan = planCandidates.find(p => {
                const planShift = Number(p.shift || 0);
                return planShift && planShift === group.shift;
            });

            // Se não encontrou plano específico, usar o primeiro disponível
            if (!plan) {
                plan = planCandidates[0];
                console.log('[TRACE][aggregateOeeMetrics] usando plano genérico para máquina', group.machine, 'turno', group.shift);
            }

            if (!plan || !plan.raw) {
                console.log('[TRACE][aggregateOeeMetrics] plano inválido para máquina', group.machine);
                return;
            }

            // Fase 1: usar getPlanParamsForShift para selecionar ciclo/cav do turno correto
            const planParams = (window.oeeUtils?.getPlanParamsForShift || function(raw, t) {
                const sk = `t${typeof t === 'string' ? t.replace(/\D/g,'') : t}`;
                return { ciclo: Number(raw[`real_cycle_${sk}`]) || Number(raw.budgeted_cycle) || 30, cavidades: Number(raw[`active_cavities_${sk}`]) || Number(raw.mold_cavities) || 2 };
            })(plan.raw, group.shift);
            const cicloReal = planParams.ciclo || 30;
            const cavAtivas = planParams.cavidades || 2;
            const pieceWeight = plan.raw.piece_weight || 0.1; // peso padrão de 100g

            let refugoPcs = Math.round(Math.max(0, group.scrapPcs || 0));
            if (!refugoPcs && group.scrapKg > 0 && pieceWeight > 0) {
                refugoPcs = Math.round((group.scrapKg * 1000) / pieceWeight);
            }

            const metrics = calculateShiftOEE(
                group.production,
                group.downtimeMin,
                refugoPcs,
                cicloReal,
                cavAtivas
            );

            console.log('[TRACE][aggregateOeeMetrics] grupo processado:', {
                machine: group.machine,
                shift: group.shift,
                workDay: group.workDay,
                production: group.production,
                downtimeMin: group.downtimeMin,
                refugoPcs,
                scrapPcs: group.scrapPcs,
                scrapKg: group.scrapKg,
                cicloReal,
                cavAtivas,
                metrics
            });

            groupsWithMetrics.push({
                machine: group.machine,
                shift: group.shift,
                workDay: group.workDay,
                production: group.production,
                shiftMinutes: (window.oeeUtils?.getShiftMinutes || (() => 480))(group.shift),
                disponibilidade: clamp01(metrics.disponibilidade),
                performance: clamp01(metrics.performance),
                qualidade: clamp01(metrics.qualidade),
                oee: clamp01(metrics.oee),
                semPlano: false
            });
        });

        // ── Média ponderada por TEMPO PROGRAMADO (minutos do turno) ──
        // Turnos mais longos pesam proporcionalmente mais.
        // Grupos semPlano (performance=null) são excluídos de Performance e OEE,
        // mas incluídos em Disponibilidade e Qualidade.
        const weightedAvg = (items, selector) => {
            const validItems = items.filter(g => selector(g) !== null && selector(g) !== undefined);
            if (!validItems.length) return 0;
            const totalWeight = validItems.reduce((s, g) => s + (g.shiftMinutes || 480), 0);
            if (totalWeight === 0) {
                return validItems.reduce((s, g) => s + selector(g), 0) / validItems.length;
            }
            return validItems.reduce((s, g) => s + selector(g) * (g.shiftMinutes || 480), 0) / totalWeight;
        };

        const normalizedShift = shiftFilter === 'all' ? 'all' : toShiftNumber(shiftFilter);
        const filteredGroups = normalizedShift === 'all'
            ? groupsWithMetrics
            : groupsWithMetrics.filter(item => item.shift === normalizedShift);

        console.log('[TRACE][aggregateOeeMetrics] grupos com métricas:', groupsWithMetrics.length,
            '(semPlano:', groupsWithMetrics.filter(g => g.semPlano).length, ')');
        console.log('[TRACE][aggregateOeeMetrics] grupos filtrados:', filteredGroups.length);

        const computeAggregated = (items) => {
            const D = weightedAvg(items, g => g.disponibilidade);
            const P = weightedAvg(items, g => g.performance);  // exclui semPlano (null)
            const Q = weightedAvg(items, g => g.qualidade);
            // OEE principal: média ponderada dos OEEs individuais (para cards/KPIs)
            const oeeAvg = weightedAvg(items, g => g.oee);     // exclui semPlano (null)
            return {
                disponibilidade: D,
                performance: P,
                qualidade: Q,
                oee: oeeAvg,           // Para card principal / KPI único
                oeeDecomposed: D * P * Q  // Para gráficos de decomposição D×P×Q
            };
        };

        const overall = computeAggregated(groupsWithMetrics);
        const filtered = computeAggregated(filteredGroups);

        console.log('[TRACE][aggregateOeeMetrics] resultado final:', {
            overall,
            filtered,
            shiftFilter,
            normalizedShift
        });

        return {
            overall,
            filtered,
            groups: groupsWithMetrics
        };
    }

    // Fase 2: calculateOverviewOEE REMOVIDA — era redundante.
    // aggregateOeeMetrics agora retorna OEE = D×P×Q diretamente em overall.oee e filtered.oee.
    // Callers antigos devem usar aggregateOeeMetrics diretamente.

    // Função para carregar análise de produção
    async function loadProductionAnalysis() {
        const { startDate, endDate, machine, shift } = currentAnalysisFilters;
        console.log('[TRACE][loadProductionAnalysis] fetching data', { startDate, endDate, machine, shift });
        
        const productionData = await getFilteredData('production', startDate, endDate, machine, shift);
        const planData = await getFilteredData('plan', startDate, endDate, machine, shift);
        const lossesData = await getFilteredData('losses', startDate, endDate, machine, shift);
        const downtimeData = await getFilteredData('downtime', startDate, endDate, machine, shift);

        console.log('[TRACE][loadProductionAnalysis] datasets received', {
            productionCount: productionData.length,
            planCount: planData.length,
            lossesCount: lossesData.length,
            downtimeCount: downtimeData.length
        });
        
        // Calcular métricas
        const totalProduction = productionData.reduce((sum, item) => sum + item.quantity, 0);
        const totalPlan = planData.reduce((sum, item) => sum + item.quantity, 0);

        // META calculada pelo calendário do período:
        //   Dias úteis (seg-sex): 1.400.000 peças/dia
        //   Sábados: 450.000 peças/dia
        //   Domingos: não contam (fábrica não opera)
        //   Para filtros 'month'/'lastmonth', a meta cobre o mês inteiro
        const META_WEEKDAY = 1400000;
        const META_SATURDAY = 450000;
        let totalMeta = 0;
        let metaWeekdays = 0;
        let metaSaturdays = 0;
        {
            const dStart = new Date(startDate + 'T12:00:00');
            // Para filtro 'month' ou 'lastmonth', estender até o último dia do mês
            const filterPeriod = currentAnalysisFilters.period || '';
            let metaEndDate;
            if (filterPeriod === 'month' || filterPeriod === 'lastmonth') {
                const refDate = new Date(startDate + 'T12:00:00');
                metaEndDate = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0, 12, 0, 0);
            } else {
                metaEndDate = new Date(endDate + 'T12:00:00');
            }
            const dayMs = 86400000;

            for (let d = new Date(dStart); d <= metaEndDate; d = new Date(d.getTime() + dayMs)) {
                const dayOfWeek = d.getDay(); // 0=dom, 6=sáb

                if (dayOfWeek === 0) continue; // Domingo — fábrica não opera

                if (dayOfWeek === 6) {
                    totalMeta += META_SATURDAY;
                    metaSaturdays++;
                } else {
                    totalMeta += META_WEEKDAY;
                    metaWeekdays++;
                }
            }
        }
        console.log('[META] Meta calculada pelo calendário:', {
            totalMeta,
            metaWeekdays,
            metaSaturdays,
            totalDias: metaWeekdays + metaSaturdays,
            periodo: currentAnalysisFilters.period || 'custom'
        });

        const targetVsActual = totalMeta > 0 ? (totalProduction / totalMeta * 100) : 0;
        
        // Encontrar máquina top
        const machineProduction = {};
        productionData.forEach(item => {
            machineProduction[item.machine] = (machineProduction[item.machine] || 0) + item.quantity;
        });
        const topMachine = Object.keys(machineProduction).reduce((a, b) => 
            machineProduction[a] > machineProduction[b] ? a : b, '---'
        );

        cachedProductionDataset = {
            productionData,
            planData,
            startDate,
            endDate,
            shift,
            machine
        };

        // Atualizar interface - KPIs
        // META (baseada no agendamento semanal)
        const plannedProductionKpi = document.getElementById('planned-production-kpi');
        const plannedProductionSubtext = document.getElementById('planned-production-subtext');
        if (plannedProductionKpi) {
            let formattedMeta;
            if (totalMeta >= 1000000) {
                formattedMeta = (totalMeta / 1000000).toFixed(1) + 'M';
            } else if (totalMeta >= 1000) {
                formattedMeta = (totalMeta / 1000).toFixed(1) + 'K';
            } else {
                formattedMeta = totalMeta.toLocaleString('pt-BR');
            }
            plannedProductionKpi.textContent = formattedMeta;
        }
        if (plannedProductionSubtext) {
            plannedProductionSubtext.textContent = `${totalMeta.toLocaleString('pt-BR')} peças`;
        }

        // REALIZADO
        const actualProductionKpi = document.getElementById('actual-production-kpi');
        const actualProductionSubtext = document.getElementById('actual-production-subtext');
        if (actualProductionKpi) {
            let formattedTotal;
            if (totalProduction >= 1000000) {
                formattedTotal = (totalProduction / 1000000).toFixed(1) + 'M';
            } else if (totalProduction >= 1000) {
                formattedTotal = (totalProduction / 1000).toFixed(1) + 'K';
            } else {
                formattedTotal = totalProduction.toLocaleString('pt-BR');
            }
            actualProductionKpi.textContent = formattedTotal;
        }
        if (actualProductionSubtext) {
            actualProductionSubtext.textContent = `${totalProduction.toLocaleString('pt-BR')} peças produzidas`;
        }
        
        // META x REALIZADO
        const targetVsActualEl = document.getElementById('production-target-vs-actual');
        if (targetVsActualEl) {
            targetVsActualEl.textContent = `${targetVsActual.toFixed(1)}%`;
        }
        
        // TAXA DE PRODUÇÃO
        updateProductionRateDisplay();

        // Gerar gráficos
        await generateHourlyProductionChart(productionData, {
            targetCanvasId: 'analysis-hourly-production-chart',
            chartContext: 'analysis',
            dailyTargetOverride: totalMeta,
            updateTimeline: false
        });
        await generateShiftProductionChart(productionData);
        await generateMachineProductionTimeline(productionData, {
            targetCanvasId: 'analysis-machine-production-timeline'
        });
    }
    
    // generateCycleCavityChart removida — Kaizen 02/2026
    async function generateCycleCavityChart(_planData) {
        // Função desativada — canvas removido do HTML
        return;
        
        // Destruir gráfico existente
        const existingChart = Chart.getChart(canvas);
        if (existingChart) {
            existingChart.destroy();
        }
        
        // Processar dados por turno
        const turnosData = {
            t1: { cicloReal: 0, cicloOrçado: 0, cavLancada: 0, cavOrcada: 0, count: 0 },
            t2: { cicloReal: 0, cicloOrçado: 0, cavLancada: 0, cavOrcada: 0, count: 0 },
            t3: { cicloReal: 0, cicloOrçado: 0, cavLancada: 0, cavOrcada: 0, count: 0 }
        };
        
        planData.forEach(plan => {
            const raw = plan.raw || plan;
            const budgetedCycle = Number(raw.budgeted_cycle) || 0;
            const cavOrcada = Number(raw.mold_cavities || raw.cavities) || 0;
            
            // T1
            if (raw.real_cycle_t1 || budgetedCycle) {
                turnosData.t1.cicloReal += Number(raw.real_cycle_t1) || budgetedCycle;
                turnosData.t1.cicloOrçado += budgetedCycle;
                turnosData.t1.cavLancada += Number(raw.active_cavities_t1 || raw.active_cavities_T1 || raw.activeCavitiesT1) || 0;
                turnosData.t1.cavOrcada += cavOrcada;
                turnosData.t1.count++;
            }
            
            // T2
            if (raw.real_cycle_t2 || budgetedCycle) {
                turnosData.t2.cicloReal += Number(raw.real_cycle_t2) || budgetedCycle;
                turnosData.t2.cicloOrçado += budgetedCycle;
                turnosData.t2.cavLancada += Number(raw.active_cavities_t2 || raw.active_cavities_T2 || raw.activeCavitiesT2) || 0;
                turnosData.t2.cavOrcada += cavOrcada;
                turnosData.t2.count++;
            }
            
            // T3
            if (raw.real_cycle_t3 || budgetedCycle) {
                turnosData.t3.cicloReal += Number(raw.real_cycle_t3) || budgetedCycle;
                turnosData.t3.cicloOrçado += budgetedCycle;
                turnosData.t3.cavLancada += Number(raw.active_cavities_t3 || raw.active_cavities_T3 || raw.activeCavitiesT3) || 0;
                turnosData.t3.cavOrcada += cavOrcada;
                turnosData.t3.count++;
            }
        });
        
        // Calcular médias
        const labels = ['1º Turno', '2º Turno', '3º Turno'];
        const cicloOrcado = [
            turnosData.t1.count ? (turnosData.t1.cicloOrçado / turnosData.t1.count).toFixed(1) : 0,
            turnosData.t2.count ? (turnosData.t2.cicloOrçado / turnosData.t2.count).toFixed(1) : 0,
            turnosData.t3.count ? (turnosData.t3.cicloOrçado / turnosData.t3.count).toFixed(1) : 0
        ];
        const cicloReal = [
            turnosData.t1.count ? (turnosData.t1.cicloReal / turnosData.t1.count).toFixed(1) : 0,
            turnosData.t2.count ? (turnosData.t2.cicloReal / turnosData.t2.count).toFixed(1) : 0,
            turnosData.t3.count ? (turnosData.t3.cicloReal / turnosData.t3.count).toFixed(1) : 0
        ];
        const cavOrcada = [
            turnosData.t1.count ? Math.round(turnosData.t1.cavOrcada / turnosData.t1.count) : 0,
            turnosData.t2.count ? Math.round(turnosData.t2.cavOrcada / turnosData.t2.count) : 0,
            turnosData.t3.count ? Math.round(turnosData.t3.cavOrcada / turnosData.t3.count) : 0
        ];
        const cavLancada = [
            turnosData.t1.count ? Math.round(turnosData.t1.cavLancada / turnosData.t1.count) : 0,
            turnosData.t2.count ? Math.round(turnosData.t2.cavLancada / turnosData.t2.count) : 0,
            turnosData.t3.count ? Math.round(turnosData.t3.cavLancada / turnosData.t3.count) : 0
        ];
        
        const ctx = canvas.getContext('2d');
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Ciclo Orçado (s)',
                        data: cicloOrcado,
                        backgroundColor: 'rgba(59, 130, 246, 0.7)',
                        borderColor: 'rgba(59, 130, 246, 1)',
                        borderWidth: 1,
                        borderRadius: 4,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Ciclo Real (s)',
                        data: cicloReal,
                        backgroundColor: 'rgba(16, 185, 129, 0.7)',
                        borderColor: 'rgba(16, 185, 129, 1)',
                        borderWidth: 1,
                        borderRadius: 4,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Cavidade Orçada',
                        data: cavOrcada,
                        backgroundColor: 'rgba(249, 115, 22, 0.7)',
                        borderColor: 'rgba(249, 115, 22, 1)',
                        borderWidth: 1,
                        borderRadius: 4,
                        yAxisID: 'y1'
                    },
                    {
                        label: 'Cavidade Lançada',
                        data: cavLancada,
                        backgroundColor: 'rgba(139, 92, 246, 0.7)',
                        borderColor: 'rgba(139, 92, 246, 1)',
                        borderWidth: 1,
                        borderRadius: 4,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            padding: 15,
                            font: { size: 11 }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(17, 24, 39, 0.9)',
                        padding: 12,
                        cornerRadius: 8,
                        titleFont: { size: 13, weight: 'bold' },
                        bodyFont: { size: 12 },
                        callbacks: {
                            label: function(context) {
                                const label = context.dataset.label || '';
                                const value = context.parsed.y;
                                if (label.includes('Ciclo')) {
                                    return `${label}: ${value}s`;
                                }
                                return `${label}: ${value}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { font: { size: 11, weight: '500' } }
                    },
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: 'Ciclo (segundos)',
                            font: { size: 11 }
                        },
                        grid: { color: 'rgba(0, 0, 0, 0.05)' },
                        ticks: { font: { size: 10 } }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Cavidades',
                            font: { size: 11 }
                        },
                        grid: { drawOnChartArea: false },
                        ticks: { 
                            font: { size: 10 },
                            stepSize: 1
                        }
                    }
                }
            }
        });
        
        console.log('[CYCLE-CAVITY] Gráfico gerado com sucesso');
    }

    function updateProductionRateToggle() {
        const dayBtn = document.getElementById('production-rate-mode-day');
        const shiftBtn = document.getElementById('production-rate-mode-shift');
        if (!dayBtn || !shiftBtn) return;

        const applyState = (btn, isActive) => {
            btn.classList.remove('bg-green-600', 'text-white', 'bg-white', 'text-green-600', 'hover:bg-green-50');
            if (isActive) {
                btn.classList.add('bg-green-600', 'text-white');
            } else {
                btn.classList.add('bg-white', 'text-green-600', 'hover:bg-green-50');
            }
        };

        applyState(dayBtn, productionRateMode === 'day');
        applyState(shiftBtn, productionRateMode === 'shift');
    }

    function updateProductionRateDisplay() {
        const valueEl = document.getElementById('production-rate-value');
        const subtextEl = document.getElementById('production-rate-subtext');
        if (!valueEl) return;

        const dataset = cachedProductionDataset || {};
        const productionData = dataset.productionData || [];
        const startDate = dataset.startDate;
        const endDate = dataset.endDate;
        const shiftFilterRaw = dataset.shift;
        const shiftFilter = shiftFilterRaw != null ? String(shiftFilterRaw) : 'all';

        if (!productionData.length) {
            valueEl.textContent = '--- pcs/h';
            if (subtextEl) {
                const modeLabel = productionRateMode === 'shift' ? 'Modo turno' : 'Modo dia';
                subtextEl.textContent = `${modeLabel} – Sem registros no período selecionado.`;
            }
            return;
        }

        const totalProduction = productionData.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
        const workDaysSet = new Set(productionData.map(item => item.workDay || item.date).filter(Boolean));
        const workDaysCount = workDaysSet.size;

        let effectiveDays = workDaysCount;
        if (!effectiveDays) {
            if (startDate && endDate) {
                const baseStart = new Date(`${startDate}T00:00:00`);
                const baseEnd = new Date(`${endDate}T00:00:00`);
                const diffDays = Math.max(Math.round((baseEnd - baseStart) / (1000 * 60 * 60 * 24)) + 1, 1);
                effectiveDays = diffDays;
            } else {
                effectiveDays = 1;
            }
        }

        if (productionRateMode === 'day') {
            let hoursInPeriod = 0;
            if (startDate && endDate) {
                hoursInPeriod = calculateHoursInPeriod(startDate, endDate);
            }
            if (!hoursInPeriod) {
                hoursInPeriod = effectiveDays * 24;
            }

            const rate = hoursInPeriod > 0 ? totalProduction / hoursInPeriod : 0;
            valueEl.textContent = `${rate.toFixed(1)} pcs/h`;

            if (subtextEl) {
                const daysLabel = effectiveDays > 1 ? `${effectiveDays} dias` : '1 dia';
                const dataDaysLabel = workDaysCount && workDaysCount !== effectiveDays ? `, ${workDaysCount} com lançamentos` : '';
                subtextEl.textContent = `Modo dia – ${totalProduction.toLocaleString('pt-BR')} peças em ${daysLabel}${dataDaysLabel}.`;
            }
            return;
        }

        const hoursPerShift = 8;
        const denominator = Math.max(effectiveDays * hoursPerShift, 1);
        const shiftTotals = { '1': 0, '2': 0, '3': 0 };
        let unknownTotal = 0;

        productionData.forEach(item => {
            const shiftValue = item.shift;
            const normalizedShift = shiftValue != null ? String(shiftValue) : null;
            const qty = Number(item.quantity) || 0;
            if (normalizedShift && Object.prototype.hasOwnProperty.call(shiftTotals, normalizedShift)) {
                shiftTotals[normalizedShift] += qty;
            } else {
                unknownTotal += qty;
            }
        });

        const shiftRates = ['1', '2', '3'].map(shiftKey => {
            const total = shiftTotals[shiftKey] || 0;
            const rate = total > 0 ? total / denominator : 0;
            return { shift: shiftKey, total, rate };
        });

        const selectedShift = shiftFilter !== 'all' ? shiftFilter : 'all';

        if (selectedShift !== 'all' && ['1', '2', '3'].includes(selectedShift)) {
            const selectedData = shiftRates.find(r => r.shift === selectedShift);
            if (selectedData && selectedData.total > 0) {
                valueEl.textContent = `Turno ${selectedData.shift}: ${selectedData.rate.toFixed(1)} pcs/h`;
            } else {
                valueEl.textContent = `Turno ${selectedShift}: -- pcs/h`;
            }
        } else {
            const bestShift = shiftRates.reduce((best, current) => {
                if (current.total <= 0) return best;
                if (!best || current.rate > best.rate) {
                    return current;
                }
                return best;
            }, null);

            if (bestShift) {
                valueEl.textContent = `Melhor turno: T${bestShift.shift} ${bestShift.rate.toFixed(1)} pcs/h`;
            } else {
                valueEl.textContent = 'Sem dados por turno';
            }
        }

        if (subtextEl) {
            const detailParts = shiftRates.map(r => {
                const label = `T${r.shift}`;
                return r.total > 0 ? `${label}: ${r.rate.toFixed(1)} pcs/h` : `${label}: --`;
            });
            if (unknownTotal > 0) {
                detailParts.push(`Sem turno: ${unknownTotal.toLocaleString('pt-BR')} pcs`);
            }
            const daysLabel = effectiveDays > 1 ? `${effectiveDays} dias` : '1 dia';
            subtextEl.textContent = `Modo turno – ${detailParts.join(' – ')} – ${daysLabel} analisado(s).`;
        }
    }

    // Função para debug de eficiência
    async function debugEfficiencyCalculation() {
        const { startDate, endDate, machine, shift } = currentAnalysisFilters;
        console.log('=== DEBUG EFICIÊNCIA ===');
        console.log('Filtros:', { startDate, endDate, machine, shift });
        
        // Buscar dados raw
        const [productionData, lossesData, downtimeData, planData] = await Promise.all([
            getFilteredData('production', startDate, endDate, machine, 'all'),
            getFilteredData('losses', startDate, endDate, machine, 'all'),
            getFilteredData('downtime', startDate, endDate, machine, 'all'),
            getFilteredData('plan', startDate, endDate, machine, 'all')
        ]);

        console.log('Dados Raw:', {
            production: productionData.length,
            losses: lossesData.length,
            downtime: downtimeData.length,
            plan: planData.length
        });

        console.log('Amostra Production:', productionData.slice(0, 3));
        console.log('Amostra Plan:', planData.slice(0, 3));

        // Normalizar shift para evitar problemas com undefined
        const normalizedShift = shift === undefined || shift === null || shift === '' ? 'all' : shift;
        const result = aggregateOeeMetrics(productionData, lossesData, downtimeData, planData, normalizedShift);
        console.log('Resultado Agregação:', result);

        alert(`Debug concluído! Verifique o console para detalhes.
        
Production: ${productionData.length} registros
Losses: ${lossesData.length} registros  
Downtime: ${downtimeData.length} registros
Plan: ${planData.length} registros

Disponibilidade: ${(result.filtered.disponibilidade * 100).toFixed(1)}%
Performance: ${(result.filtered.performance * 100).toFixed(1)}%
Qualidade: ${(result.filtered.qualidade * 100).toFixed(1)}%`);
    }

    // Função para carregar análise de eficiência
    async function loadEfficiencyAnalysis() {
        let { startDate, endDate, machine, shift } = currentAnalysisFilters;
        console.log('[TRACE][loadEfficiencyAnalysis] calculating', { startDate, endDate, machine, shift });
        if (!startDate || !endDate) {
            console.warn('[TRACE][loadEfficiencyAnalysis] missing date filters, initializing defaults');
            setAnalysisDefaultDates();
            ({ startDate, endDate, machine, shift } = currentAnalysisFilters);
        }
        const oeeData = await calculateDetailedOEE(startDate, endDate, machine, shift);

        console.log('[TRACE][loadEfficiencyAnalysis] oeeData', oeeData);
        
        // Atualizar gauges dos componentes
        updateGauge('availability-gauge', oeeData.availability);
        updateGauge('performance-gauge', oeeData.performance);
        updateGauge('quality-gauge', oeeData.quality);
        
        const availabilityEl = document.getElementById('availability-value');
        const performanceEl = document.getElementById('performance-value');
        const qualityEl = document.getElementById('quality-value');
        if (availabilityEl) availabilityEl.textContent = `${oeeData.availability.toFixed(1)}%`;
        if (performanceEl) performanceEl.textContent = `${oeeData.performance.toFixed(1)}%`;
        if (qualityEl) qualityEl.textContent = `${oeeData.quality.toFixed(1)}%`;

        // ========== PREENCHER OEE GERAL ==========
        const oeeGeneral = oeeData.oee || ((oeeData.availability * oeeData.performance * oeeData.quality) / 10000);
        const oeeGeneralValue = document.getElementById('oee-general-value');
        const oeeClassification = document.getElementById('oee-classification');
        
        if (oeeGeneralValue) {
            oeeGeneralValue.textContent = `${oeeGeneral.toFixed(1)}%`;
        }
        
        // Atualizar gauge OEE principal
        updateGauge('oee-main-gauge', oeeGeneral);
        
        // Classificação do OEE
        if (oeeClassification) {
            let classification = 'Inaceitável';
            let classColor = 'text-red-600';
            if (oeeGeneral >= 85) {
                classification = 'Classe Mundial';
                classColor = 'text-green-600';
            } else if (oeeGeneral >= 75) {
                classification = 'Excelente';
                classColor = 'text-blue-600';
            } else if (oeeGeneral >= 65) {
                classification = 'Bom';
                classColor = 'text-teal-600';
            } else if (oeeGeneral >= 50) {
                classification = 'Regular';
                classColor = 'text-amber-600';
            }
            oeeClassification.textContent = classification;
            oeeClassification.className = `font-semibold ${classColor}`;
        }

        // ========== PREENCHER RANKING DE OEE POR MÁQUINA ==========
        const machineOeeRanking = document.getElementById('machine-oee-ranking');
        if (machineOeeRanking) {
            try {
                // Calcular OEE por máquina
                const productionData = await getFilteredData('production', startDate, endDate, machine === 'all' ? null : machine, shift);
                const lossesData = await getFilteredData('losses', startDate, endDate, machine === 'all' ? null : machine, shift);
                const planData = await getFilteredData('plan', startDate, endDate, machine === 'all' ? null : machine, shift);
                
                // Agrupar por máquina
                const machineData = {};
                
                productionData.forEach(item => {
                    const m = item.machine || 'N/A';
                    if (!machineData[m]) machineData[m] = { production: 0, losses: 0, planned: 0 };
                    machineData[m].production += Number(item.quantity) || 0;
                });
                
                lossesData.forEach(item => {
                    const m = item.machine || 'N/A';
                    if (!machineData[m]) machineData[m] = { production: 0, losses: 0, planned: 0 };
                    machineData[m].losses += Number(item.scrapPcs ?? item.quantity ?? 0) || 0;
                });
                
                planData.forEach(item => {
                    const m = item.machine || 'N/A';
                    if (!machineData[m]) machineData[m] = { production: 0, losses: 0, planned: 0 };
                    machineData[m].planned += Number(item.quantity) || 0;
                });
                
                // Calcular OEE por máquina (Disponibilidade × Performance × Qualidade)
                // Buscar dados de parada para calcular disponibilidade
                let downtimeData = [];
                try {
                    downtimeData = await getFilteredData('downtime', startDate, endDate, machine === 'all' ? null : machine, shift);
                } catch(e) { console.warn('[loadEfficiencyAnalysis] Erro ao buscar downtime:', e.message); }
                const machineDowntime = {};
                downtimeData.forEach(item => {
                    const m = item.machine || 'N/A';
                    machineDowntime[m] = (machineDowntime[m] || 0) + (Number(item.duration) || 0);
                });
                // Tempo total disponível por turno (minutos): T1=510, T2=500, T3=430 → ~480 avg
                const TOTAL_AVAILABLE_MINUTES = shift ? (shift === 1 ? 510 : shift === 2 ? 500 : 430) : 1440;
                const machineEntries = Object.entries(machineData)
                    .map(([mach, data]) => {
                        const totalOutput = data.production + data.losses;
                        const downtime = machineDowntime[mach] || 0;
                        const availability = TOTAL_AVAILABLE_MINUTES > 0 ? Math.min(((TOTAL_AVAILABLE_MINUTES - downtime) / TOTAL_AVAILABLE_MINUTES) * 100, 100) : 100;

                        // Performance: capacidade teórica baseada em ciclo/cavidades (FIX: era prod/planned)
                        const machPlan = planData.find(p => (p.machine || '') === mach);
                        const rawPlan = machPlan?.raw || machPlan || {};
                        const shiftKey = shift ? `t${shift}` : null;
                        const ciclo = Number(shiftKey ? (rawPlan[`real_cycle_${shiftKey}`] || rawPlan.budgeted_cycle) : rawPlan.budgeted_cycle) || 30;
                        const cav = Number(shiftKey ? (rawPlan[`active_cavities_${shiftKey}`] || rawPlan.mold_cavities) : rawPlan.mold_cavities) || 2;
                        const tempoDisp = Math.max(0, TOTAL_AVAILABLE_MINUTES - downtime);
                        const capTeorica = (ciclo > 0 && cav > 0) ? (tempoDisp * 60 / ciclo) * cav : 0;
                        const performance = capTeorica > 0 ? Math.min((data.production / capTeorica) * 100, 100) : (data.production > 0 ? 100 : 0);

                        const quality = totalOutput > 0 ? (data.production / totalOutput) * 100 : 100;
                        const oee = (availability * performance * quality) / 10000;
                        return { machine: mach, oee, production: data.production };
                    })
                    .filter(e => e.production > 0) // Só máquinas com produção
                    .sort((a, b) => b.oee - a.oee)
                    .slice(0, 5);
                
                if (machineEntries.length === 0) {
                    machineOeeRanking.innerHTML = '<div class="text-center py-4 text-gray-400"><p class="text-xs">Sem dados de OEE por máquina</p></div>';
                } else {
                    const getOeeColor = (oee) => {
                        if (oee >= 85) return 'bg-green-500';
                        if (oee >= 75) return 'bg-blue-500';
                        if (oee >= 65) return 'bg-teal-500';
                        if (oee >= 50) return 'bg-amber-500';
                        return 'bg-red-500';
                    };
                    machineOeeRanking.innerHTML = machineEntries.map((e, idx) => `
                        <div class="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                            <div class="w-5 h-5 ${getOeeColor(e.oee)} text-white rounded-full flex items-center justify-center text-xs font-bold">${idx + 1}</div>
                            <span class="flex-1 text-sm font-medium text-gray-700">${e.machine}</span>
                            <span class="text-sm font-bold ${e.oee >= 75 ? 'text-green-600' : e.oee >= 50 ? 'text-amber-600' : 'text-red-600'}">${e.oee.toFixed(1)}%</span>
                        </div>
                    `).join('');
                }
            } catch (err) {
                console.error('[loadEfficiencyAnalysis] Erro ao calcular ranking OEE por máquina:', err);
                machineOeeRanking.innerHTML = '<div class="text-center py-4 text-gray-400"><p class="text-xs">Erro ao carregar</p></div>';
            }
        }

        // OEE Components Timeline e OEE Heatmap removidos — Kaizen 02/2026
    }

    // Função para carregar análise de perdas
    async function loadLossesAnalysis() {
        const { startDate, endDate, machine, shift } = currentAnalysisFilters;
        console.log('[TRACE][loadLossesAnalysis] fetching data', { startDate, endDate, machine, shift });
        
        // OTIMIZAÇÃO Fase 2: executar queries de perdas e produção em paralelo
        const [lossesData, productionData] = await Promise.all([
            getFilteredData('losses', startDate, endDate, machine, shift),
            getFilteredData('production', startDate, endDate, machine, shift)
        ]);

        // =====================================================
        // BUSCAR BORRAS DA COLEÇÃO pmp_borra (Nova aba PMP)
        // =====================================================
        let pmpBorraData = [];
        try {
            // Buscar borras do período selecionado
            const pmpBorraSnapshot = await getDb().collection('pmp_borra')
                .where('date', '>=', startDate)
                .where('date', '<=', endDate)
                .get();
            
            pmpBorraSnapshot.forEach(doc => {
                const data = doc.data();
                const machineId = normalizeMachineId(data.machine || '');
                
                // Aplicar filtros de máquina e turno
                if (machine !== 'all' && machineId !== normalizeMachineId(machine)) {
                    return;
                }
                
                // Para turno, inferir pelo horário se disponível
                if (shift !== 'all' && data.hour) {
                    const hourParts = data.hour.split(':');
                    const hourNum = parseInt(hourParts[0], 10);
                    const minNum = parseInt(hourParts[1], 10) || 0;
                    let inferredShift = 1;
                    // T1: 06:30-14:59, T2: 15:00-23:19, T3: 23:20-06:29
                    if ((hourNum === 6 && minNum >= 30) || (hourNum >= 7 && hourNum < 15)) inferredShift = 1;
                    else if (hourNum >= 15 && (hourNum < 23 || (hourNum === 23 && minNum < 20))) inferredShift = 2;
                    else inferredShift = 3;
                    
                    if (inferredShift !== parseInt(shift, 10)) {
                        return;
                    }
                }
                
                // Mapear para formato compatível com análise
                pmpBorraData.push({
                    id: doc.id,
                    date: data.date,
                    machine: machineId,
                    quantity: 0, // Borra não tem peças, só peso
                    reason: 'BORRA - PMP',
                    mp: '',
                    mp_type: '',
                    workDay: data.date,
                    scrapPcs: 0,
                    scrapKg: data.quantityKg || 0,
                    pieceWeight: 0,
                    raw: {
                        ...data,
                        tipo_lancamento: 'borra',
                        refugo_kg: data.quantityKg || 0,
                        source: 'pmp_borra'
                    }
                });
            });
            
            console.log('[TRACE][loadLossesAnalysis] PMP Borra data loaded:', pmpBorraData.length);
        } catch (error) {
            console.warn('[TRACE][loadLossesAnalysis] Erro ao carregar pmp_borra:', error);
        }
        
        // Combinar dados de perdas com borras do PMP
        const allLossesData = [...lossesData, ...pmpBorraData];

        console.log('[TRACE][loadLossesAnalysis] datasets received', {
            lossesCount: lossesData.length,
            pmpBorraCount: pmpBorraData.length,
            totalLossesCount: allLossesData.length,
            productionCount: productionData.length
        });
        
        const totalLosses = allLossesData.reduce((sum, item) => sum + item.quantity, 0);
        const totalProduction = productionData.reduce((sum, item) => sum + item.quantity, 0);
        const lossesPercentage = totalProduction > 0 ? (totalLosses / totalProduction * 100) : 0;
        
        // Calcular principal motivo
        const reasonCounts = {};
        allLossesData.forEach(item => {
            reasonCounts[item.reason] = (reasonCounts[item.reason] || 0) + item.quantity;
        });
        const mainReason = Object.keys(reasonCounts).reduce((a, b) => 
            reasonCounts[a] > reasonCounts[b] ? a : b, '---'
        );
        
        // Separar dados de borra (inclui pmp_borra)
        const borraData = allLossesData.filter(item => {
            const reasonStr = (item.reason || item.raw?.perdas || '').toString().toLowerCase();
            const isTagged = (item.raw && item.raw.tipo_lancamento === 'borra');
            const isPmpBorra = item.raw?.source === 'pmp_borra';
            return isTagged || isPmpBorra || reasonStr.includes('borra');
        });
        const regularLossesData = allLossesData.filter(item => !borraData.includes(item));
        console.log('[TRACE][loadLossesAnalysis] borra split', {
            borraCount: borraData.length,
            regularLossesCount: regularLossesData.length,
            borraSample: borraData.slice(0, 3)
        });
        
        // Calcular total de borra em kg
        const totalBorraKg = borraData.reduce((sum, item) => {
            // Para borra, usar preferencialmente o peso em kg
            const weight = item.raw?.refugo_kg || item.raw?.quantityKg || item.scrapKg || 0;
            return sum + weight;
        }, 0);
        if (allLossesData.length > 0 && borraData.length === 0) {
            console.warn('[TRACE][loadLossesAnalysis] Atenção: há perdas mas nenhuma BORRA detectada. Verifique se os lançamentos de borra possuem tipo_lancamento="borra" ou motivo contendo "borra".');
        }

        // Calcular MP mais perdida
        const materialCounts = {};
        allLossesData.forEach(item => {
            const mpType = item.mp_type || 'Não especificado';
            materialCounts[mpType] = (materialCounts[mpType] || 0) + item.quantity;
        });
        const mainMaterialCode = Object.keys(materialCounts).length > 0 
            ? Object.keys(materialCounts).reduce((a, b) => 
                materialCounts[a] > materialCounts[b] ? a : b, '---'
            ) 
            : '---';
        const mainMaterial = mainMaterialCode !== '---' ? getDescricaoMP(mainMaterialCode) : '---';

        // Análise específica de borra
        const borraMPCounts = {};
        const borraReasonCounts = {};
        const borraMachineCounts = {};
        
        borraData.forEach(item => {
            const mpType = item.mp_type || item.raw?.mp_type || 'Não especificado';
            const reason = item.reason || item.raw?.perdas || 'Não especificado';
            const machine = item.machine || 'Não especificado';
            
            borraMPCounts[mpType] = (borraMPCounts[mpType] || 0) + (item.raw?.refugo_kg || item.quantity || 0);
            borraReasonCounts[reason] = (borraReasonCounts[reason] || 0) + (item.raw?.refugo_kg || item.quantity || 0);
            borraMachineCounts[machine] = (borraMachineCounts[machine] || 0) + (item.raw?.refugo_kg || item.quantity || 0);
        });

        const topBorraMP = Object.keys(borraMPCounts).length > 0
            ? Object.keys(borraMPCounts).reduce((a, b) => borraMPCounts[a] > borraMPCounts[b] ? a : b, '---')
            : '---';
            
        const topBorraReason = Object.keys(borraReasonCounts).length > 0
            ? Object.keys(borraReasonCounts).reduce((a, b) => borraReasonCounts[a] > borraReasonCounts[b] ? a : b, '---')
            : '---';
            
        const topBorraMachine = Object.keys(borraMachineCounts).length > 0
            ? Object.keys(borraMachineCounts).reduce((a, b) => borraMachineCounts[a] > borraMachineCounts[b] ? a : b, '---')
            : '---';

        // Atualizar interface
        document.getElementById('total-losses').textContent = totalLosses.toLocaleString();
        document.getElementById('losses-percentage').textContent = `${lossesPercentage.toFixed(1)}%`;
        document.getElementById('total-borra').textContent = `${totalBorraKg.toFixed(3)}`;
        document.getElementById('main-loss-reason').textContent = mainReason;
        document.getElementById('main-loss-material').textContent = mainMaterial;

        // Calcular %Triagem/Produção (respeitando filtros de período, máquina e turno)
        try {
            const { triageService } = await import('../services/triage.service.js');
            let triageEntries = await triageService.getAll();

            // Filtro por período (quarantineDate é YYYY-MM-DD)
            if (startDate) triageEntries = triageEntries.filter(e => (e.quarantineDate || '') >= startDate);
            if (endDate)   triageEntries = triageEntries.filter(e => (e.quarantineDate || '') <= endDate);

            // Filtro por máquina
            if (machine && machine !== 'all') {
                const target = normalizeMachineId(machine);
                triageEntries = triageEntries.filter(e => normalizeMachineId(e.machineId || '') === target);
            }

            // Filtro por turno (triage armazena '1T','2T','3T'; filtro usa '1','2','3')
            if (shift && shift !== 'all') {
                triageEntries = triageEntries.filter(e => {
                    const t = (e.turno || '').replace('T', '');
                    return t === String(shift);
                });
            }

            const totalTriagePieces = triageEntries.reduce((s, e) => s + (e.quantity || 0), 0);
            const triagePct = totalProduction > 0 ? (totalTriagePieces / totalProduction * 100) : 0;
            const triagePctEl = document.getElementById('triage-production-pct');
            if (triagePctEl) triagePctEl.textContent = `${triagePct.toFixed(2)}%`;
        } catch (triageErr) {
            console.warn('[Losses] Erro ao calcular %Triagem/Produção:', triageErr);
            const triagePctEl = document.getElementById('triage-production-pct');
            if (triagePctEl) triagePctEl.textContent = '0.00%';
        }
        
        // Atualizar dados específicos de borra
        const topBorraMPElement = document.getElementById('top-borra-mp');
        const topBorraReasonElement = document.getElementById('top-borra-reason');
        const topBorraMachineElement = document.getElementById('top-borra-machine');
        
        if (topBorraMPElement) topBorraMPElement.textContent = topBorraMP;
        if (topBorraReasonElement) topBorraReasonElement.textContent = topBorraReason.replace('BORRA - ', '');
        if (topBorraMachineElement) topBorraMachineElement.textContent = topBorraMachine;

        // ✅ CORREÇÃO: Armazenar dados ANTES da geração de gráficos
        // para garantir que filtros funcionem mesmo se um gráfico falhar
        window._lossesAnalysisData = [...regularLossesData];
        populateLossesReasonFilter(regularLossesData);
        console.log('[TRACE][loadLossesAnalysis] _lossesAnalysisData populated with', regularLossesData.length, 'items');

        // Gerar gráficos (usando regularLossesData que exclui borra)
        try { await generateLossesParetoChart(regularLossesData); } catch(e) { console.warn('[CHART] Pareto error:', e); }
        try { await generateLossesByMachineChart(regularLossesData); } catch(e) { console.warn('[CHART] ByMachine error:', e); }
        try { await generateLossesByProductChart(regularLossesData); } catch(e) { console.warn('[CHART] ByProduct error:', e); }
        try { await generateLossesByMaterialChart(regularLossesData); } catch(e) { console.warn('[CHART] ByMaterial error:', e); }
        try { await generateLossesDailyChart(regularLossesData); } catch(e) { console.warn('[CHART] Daily error:', e); }
        
        // Gerar gráficos específicos de borra
        await generateBorraByMachineChart(borraData);
        await generateBorraMonthlyChart(borraData);
        
        // Preencher tabela de apontamentos de borra
        await populateBorraApontamentosTable(borraData);
        
        // ✅ Carregar análise de sucata
        if (typeof loadSucataAnalysis === 'function') {
            await loadSucataAnalysis(startDate, endDate, machine, shift);
        }
    }

    // Função para carregar análise de paradas
    async function loadDowntimeAnalysis() {
        const { startDate, endDate, machine, shift } = currentAnalysisFilters;
        console.log('[TRACE][loadDowntimeAnalysis] fetching data', { startDate, endDate, machine, shift });
        
        // ✅ SEMPRE limpar caches antes de carregar dados frescos do Firebase
        cachedDowntimeDetails = [];
        cachedDowntimeDataForChart = [];
        
        // Carregar paradas normais (do turno) - busca direto do Firebase
        const downtimeSegments = await getFilteredData('downtime', startDate, endDate, machine, shift);
        const downtimeData = consolidateDowntimeEvents(downtimeSegments);
        
        // Debug: log dos motivos encontrados
        const uniqueReasons = [...new Set(downtimeData.map(d => d.reason || 'Sem motivo'))];
        console.log('[loadDowntimeAnalysis] Motivos encontrados no Firebase:', uniqueReasons);
        console.log('[loadDowntimeAnalysis] Total de segmentos:', downtimeSegments.length, '| Eventos consolidados:', downtimeData.length);

        console.log('[TRACE][loadDowntimeAnalysis] normal downtime received', {
            segments: downtimeSegments.length,
            events: downtimeData.length
        });
        
        // Paradas longas removidas - Unificação 02/2026 (usa apenas downtime_entries)
        
        // Usar apenas paradas normais para estatísticas principais (KPIs)
        const totalDowntime = downtimeData.reduce((sum, item) => sum + (item.duration || 0), 0);
        const downtimeCount = downtimeData.length;
        const avgDowntime = downtimeCount > 0 ? (totalDowntime / downtimeCount) : 0;
        
        // Calcular MTBF (Mean Time Between Failures) - apenas paradas normais
        const hoursInPeriod = calculateHoursInPeriod(startDate, endDate);
        const mtbf = downtimeCount > 0 ? (hoursInPeriod / downtimeCount) : 0;

        // Atualizar interface
        document.getElementById('total-downtime').textContent = `${(totalDowntime / 60).toFixed(1)}h`;
        document.getElementById('downtime-count').textContent = downtimeCount.toString();
        document.getElementById('avg-downtime').textContent = `${avgDowntime.toFixed(0)}min`;
        document.getElementById('mtbf-value').textContent = `${mtbf.toFixed(1)}h`;

        // ✅ Gerar gráfico de CATEGORIAS/MOTIVOS apenas com paradas normais
        await generateDowntimeReasonsChart(downtimeData);
        setupDowntimeChartToggle(); // Setup dos botões de toggle categoria/motivo
        
        // Outros gráficos apenas com paradas normais
        await generateDowntimeByMachineChart(downtimeData);
        await generateDowntimeTimelineChart(downtimeData);

        // ✅ Popular filtro de motivos de parada apenas com paradas normais
        await populateDowntimeReasonFilter(downtimeData, downtimeSegments);

        // Paradas longas removidas - Unificação 02/2026
    }

    // ==================== FILTRO POR MOTIVO DE PARADA ====================
    let cachedDowntimeDetails = []; // Cache para os detalhes das paradas
    let currentDowntimePage = 1;
    const DOWNTIME_PAGE_SIZE = 20;

    async function populateDowntimeReasonFilter(allDowntimeData, rawSegments) {
        const filterSelect = document.getElementById('downtime-reason-filter');
        const machineFilterSelect = document.getElementById('downtime-machine-filter');
        const countEl = document.getElementById('downtime-reason-count');
        
        if (!filterSelect) return;
        
        // Extrair todos os motivos únicos
        const reasons = new Set();
        const machines = new Set();
        allDowntimeData.forEach(item => {
            const reason = (item.reason || 'Sem motivo').trim();
            if (reason) reasons.add(reason);
            const machine = (item.machine || 'N/A').trim();
            if (machine && machine !== 'N/A') machines.add(machine);
        });
        
        // Popular o select de motivos
        filterSelect.innerHTML = '<option value="">-- Todos os Motivos --</option>';
        const sortedReasons = Array.from(reasons).sort((a, b) => a.localeCompare(b, 'pt-BR'));
        
        sortedReasons.forEach(reason => {
            const count = allDowntimeData.filter(d => (d.reason || 'Sem motivo').trim() === reason).length;
            const opt = document.createElement('option');
            opt.value = reason;
            opt.textContent = `${reason} (${count})`;
            filterSelect.appendChild(opt);
        });
        
        // Popular o select de máquinas
        if (machineFilterSelect) {
            machineFilterSelect.innerHTML = '<option value="">-- Todas as Máquinas --</option>';
            const sortedMachines = Array.from(machines).sort((a, b) => a.localeCompare(b, 'pt-BR'));
            
            sortedMachines.forEach(machine => {
                const count = allDowntimeData.filter(d => (d.machine || '').trim() === machine).length;
                const opt = document.createElement('option');
                opt.value = machine;
                opt.textContent = `${machine} (${count})`;
                machineFilterSelect.appendChild(opt);
            });
        }
        
        // Guardar detalhes no cache com dados completos
        cachedDowntimeDetails = rawSegments.map(seg => {
            const reason = (seg.reason || seg.motivo || 'Sem motivo').trim();
            return {
                date: seg.date || seg.data || '',
                startTime: seg.startTime || seg.start_time || '--:--',
                endTime: seg.endTime || seg.end_time || '--:--',
                machine: seg.machine || seg.maquina || 'N/A',
                reason: reason,
                category: getDowntimeCategory(reason),
                duration: seg.duration || 0,
                observations: seg.observations || seg.observacoes || seg.obs || seg.notes || seg.raw?.observations || seg.raw?.observacoes || seg.raw?.obs || '',
                nomeUsuario: seg.nomeUsuario || seg.raw?.nomeUsuario || '',
                userCod: seg.userCod ?? seg.raw?.userCod ?? null
            };
        });
        
        // Ordenar por data e hora (mais recente primeiro)
        cachedDowntimeDetails.sort((a, b) => {
            const dateA = a.date + ' ' + a.startTime;
            const dateB = b.date + ' ' + b.startTime;
            return dateB.localeCompare(dateA);
        });
        
        // Atualizar contador
        if (countEl) {
            countEl.textContent = `${cachedDowntimeDetails.length} ocorrências`;
        }
        
        // Função para aplicar filtros
        const applyFilters = () => {
            currentDowntimePage = 1;
            const reasonValue = filterSelect.value;
            const machineValue = machineFilterSelect ? machineFilterSelect.value : '';
            renderDowntimeReasonTable(reasonValue, machineValue);
        };
        
        // Event listeners para os filtros
        filterSelect.onchange = applyFilters;
        if (machineFilterSelect) {
            machineFilterSelect.onchange = applyFilters;
        }
        
        // Renderizar tabela inicial (todos)
        renderDowntimeReasonTable('', '');
    }

    function renderDowntimeReasonTable(reasonFilter, machineFilter) {
        const tbody = document.getElementById('downtime-reason-table-body');
        const countEl = document.getElementById('downtime-reason-count');
        const paginationEl = document.getElementById('downtime-reason-pagination');
        const showingInfo = document.getElementById('downtime-showing-info');
        const prevBtn = document.getElementById('downtime-prev-page');
        const nextBtn = document.getElementById('downtime-next-page');
        
        if (!tbody) return;
        
        // Filtrar dados por motivo e máquina
        let filteredData = cachedDowntimeDetails;
        if (reasonFilter) {
            filteredData = filteredData.filter(d => d.reason === reasonFilter);
        }
        if (machineFilter) {
            filteredData = filteredData.filter(d => d.machine === machineFilter);
        }
        
        // Atualizar contador
        if (countEl) {
            countEl.textContent = `${filteredData.length} ocorrência${filteredData.length !== 1 ? 's' : ''}`;
        }
        
        // Calcular paginação
        const totalPages = Math.ceil(filteredData.length / DOWNTIME_PAGE_SIZE);
        const startIndex = (currentDowntimePage - 1) * DOWNTIME_PAGE_SIZE;
        const endIndex = Math.min(startIndex + DOWNTIME_PAGE_SIZE, filteredData.length);
        const pageData = filteredData.slice(startIndex, endIndex);
        
        // Mostrar paginação se necessário
        if (paginationEl) {
            paginationEl.classList.toggle('hidden', filteredData.length <= DOWNTIME_PAGE_SIZE);
        }
        if (showingInfo) {
            showingInfo.textContent = `Mostrando ${startIndex + 1}-${endIndex} de ${filteredData.length} registros`;
        }
        if (prevBtn) {
            prevBtn.disabled = currentDowntimePage <= 1;
            prevBtn.onclick = () => {
                if (currentDowntimePage > 1) {
                    currentDowntimePage--;
                    renderDowntimeReasonTable(reasonFilter, machineFilter);
                }
            };
        }
        if (nextBtn) {
            nextBtn.disabled = currentDowntimePage >= totalPages;
            nextBtn.onclick = () => {
                if (currentDowntimePage < totalPages) {
                    currentDowntimePage++;
                    renderDowntimeReasonTable(reasonFilter, machineFilter);
                }
            };
        }
        
        // Renderizar tabela
        if (pageData.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" class="text-center py-8 text-gray-500">
                        <i data-lucide="inbox" class="w-6 h-6 mx-auto mb-2 text-gray-400"></i>
                        <p>${(reasonFilter || machineFilter) ? 'Nenhuma ocorrência encontrada para os filtros selecionados' : 'Nenhuma parada registrada no período'}</p>
                    </td>
                </tr>
            `;
            if (typeof lucide !== 'undefined') lucide.createIcons();
            return;
        }
        
        // Cores para as categorias
        const categoryColors = {
            'FERRAMENTARIA': 'bg-indigo-100 text-indigo-800',
            'PROCESSO': 'bg-purple-100 text-purple-800',
            'COMPRAS': 'bg-pink-100 text-pink-800',
            'PREPARAÇÃO': 'bg-amber-100 text-amber-800',
            'QUALIDADE': 'bg-emerald-100 text-emerald-800',
            'MANUTENÇÃO': 'bg-red-100 text-red-800',
            'PRODUÇÃO': 'bg-blue-100 text-blue-800',
            'SETUP': 'bg-teal-100 text-teal-800',
            'ADMINISTRATIVO': 'bg-orange-100 text-orange-800',
            'PCP': 'bg-lime-100 text-lime-800',
            'COMERCIAL': 'bg-cyan-100 text-cyan-800',
            'OUTROS': 'bg-gray-100 text-gray-800'
        };
        
        tbody.innerHTML = pageData.map(item => {
            // Formatar data
            const dateFormatted = item.date ? formatDateBR(item.date) : '--';
            
            // Formatar duração
            let durationStr = '--';
            if (item.duration > 0) {
                if (item.duration >= 60) {
                    const hours = Math.floor(item.duration / 60);
                    const mins = item.duration % 60;
                    durationStr = `${hours}h${mins > 0 ? mins + 'min' : ''}`;
                } else {
                    durationStr = `${item.duration}min`;
                }
            }
            
            // Cor baseada na duração
            let durationClass = 'text-gray-700';
            if (item.duration >= 120) durationClass = 'text-red-600 font-semibold';
            else if (item.duration >= 60) durationClass = 'text-orange-600 font-medium';
            else if (item.duration >= 30) durationClass = 'text-amber-600';
            
            // Truncar observações se muito longas
            const obsText = item.observations || '-';
            const obsDisplay = obsText.length > 50 ? obsText.substring(0, 47) + '...' : obsText;
            
            // Operador
            const operadorDisplay = item.nomeUsuario ? `<span class="text-indigo-600 font-medium" title="Cód: ${item.userCod}">${item.nomeUsuario}</span>` : '<span class="text-gray-400">-</span>';
            
            // Categoria com cor
            const categoryClass = categoryColors[item.category] || categoryColors['OUTROS'];
            
            return `
                <tr class="hover:bg-gray-50 transition-colors">
                    <td class="py-2.5 px-3 text-gray-700">${dateFormatted}</td>
                    <td class="py-2.5 px-3 text-gray-700 font-mono">${item.startTime}</td>
                    <td class="py-2.5 px-3 text-gray-700 font-mono">${item.endTime}</td>
                    <td class="py-2.5 px-3">
                        <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800">
                            ${item.machine}
                        </span>
                    </td>
                    <td class="py-2.5 px-3">
                        <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${categoryClass}">
                            ${item.category}
                        </span>
                    </td>
                    <td class="py-2.5 px-3 text-gray-800 font-medium">${item.reason}</td>
                    <td class="py-2.5 px-3 text-center ${durationClass}">${durationStr}</td>
                    <td class="py-2.5 px-3 text-xs">${operadorDisplay}</td>
                    <td class="py-2.5 px-3 text-gray-500 text-xs" title="${obsText}">${obsDisplay}</td>
                </tr>
            `;
        }).join('');
        
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    // formatDateBR: removido — importado de date.utils.js

    // Função para carregar paradas longas na análise
    async function loadExtendedDowntimeAnalysis(startDate, endDate, machine) {
        console.log('[EXTENDED-DOWNTIME] Carregando paradas longas para análise', { startDate, endDate, machine });
        
        try {
            // ✅ OTIMIZADO: Usar cache em vez de buscar diretamente do Firebase
            const allData = await getExtendedDowntimesCached();
            
            let data = [];
            const seenAnalysisIds = new Set();
            
            console.log('[EXTENDED-DOWNTIME] Total de registros (cache):', allData.length);
            
            allData.forEach(item => {
                const d = item;
                if (!item.id) return;
                if (seenAnalysisIds.has(item.id)) return; // FIX: usar item.id em vez de doc.id
                
                // Pegar data do registro (pode estar em diferentes campos)
                const recordDate = d.start_date || d.date || '';
                
                // Verificar se está no período OU se está ativa (paradas ativas sempre aparecem)
                const isActive = d.status === 'active';
                const isInPeriod = recordDate >= startDate && recordDate <= endDate;
                
                if (!isActive && !isInPeriod) {
                    return; // Fora do período e não está ativa
                }
                
                // Filtrar por máquina se selecionada
                const machineId = d.machine_id || d.machine || '';
                if (machine && machine !== 'all' && machine !== '' && machineId !== machine) {
                    return;
                }
                
                seenAnalysisIds.add(item.id); // FIX: usar item.id em vez de doc.id
                data.push({ id: item.id, ...d, machine_id: machineId }); // FIX: usar item.id em vez de doc.id
                
                // Log para debug
                if (isActive) {
                    console.log('[EXTENDED-DOWNTIME] Incluindo ATIVA:', machineId, recordDate, d.status);
                }
            });

            console.log('[EXTENDED-DOWNTIME] Registros filtrados:', data.length);
            console.log('[EXTENDED-DOWNTIME] Máquinas:', [...new Set(data.map(d => d.machine_id))].join(', '));
            
            // Log detalhado de cada registro
            data.forEach((d, i) => {
                console.log(`[EXTENDED-DOWNTIME] [${i+1}] ${d.machine_id} | ${d.start_date || d.date} | status: ${d.status || 'N/A'} | type: ${d.type}`);
            });

            // Mapear tipos antigos para motivos reconhecíveis por getDowntimeCategory
            const oldTypeToReason = {
                'weekend': 'FIM DE SEMANA',
                'maintenance': 'MANUTENÇÃO PROGRAMADA',
                'preventive': 'MANUTENÇÃO PREVENTIVA',
                'holiday': 'FERIADO',
                'no_order': 'SEM PEDIDO',
                'commercial': 'PARADA COMERCIAL',
                'setup': 'SETUP/TROCA',
                'other': ''
            };

            // Agrupar horas por CATEGORIA real usando getDowntimeCategory
            const categoryHours = {};

            data.forEach(item => {
                // Calcular duração
                let hours = 0;
                if (item.status === 'active' && item.start_datetime) {
                    const startTime = item.start_datetime?.toDate?.() || new Date(item.start_date);
                    const now = new Date();
                    const durationMin = Math.floor((now - startTime) / (1000 * 60));
                    hours = durationMin / 60;
                } else {
                    hours = (item.duration_minutes || 0) / 60;
                }
                
                // Determinar o motivo para categorização
                // Priorizar: item.reason > item.category > mapear item.type antigo
                let reasonForCategory = (item.reason || '').trim();
                
                if (!reasonForCategory) {
                    // Tentar mapear tipo antigo
                    const typeKey = (item.type || '').toLowerCase();
                    reasonForCategory = oldTypeToReason[typeKey] || item.type || '';
                }
                
                // Se temos o campo category preenchido, usar diretamente
                let assignedCategory;
                if (item.category && item.category.trim()) {
                    assignedCategory = item.category.trim().toUpperCase();
                } else {
                    // Usar getDowntimeCategory para resolver a categoria pelo motivo
                    assignedCategory = getDowntimeCategory(reasonForCategory);
                }
                
                categoryHours[assignedCategory] = (categoryHours[assignedCategory] || 0) + hours;
                
                console.log(`[EXTENDED-DOWNTIME] ${item.machine_id} | reason="${item.reason}" | category="${item.category}" | type="${item.type}" => ${assignedCategory} (${hours.toFixed(1)}h)`);
            });

            console.log('[EXTENDED-DOWNTIME] Distribuição por categoria:', categoryHours);

            // Cores e estilos por categoria
            const categoryStyles = {
                'FERRAMENTARIA': { bg: 'bg-red-50', border: 'border-red-100', text: 'text-red-700', textSub: 'text-red-600', label: 'moldes' },
                'PROCESSO':      { bg: 'bg-purple-50', border: 'border-purple-100', text: 'text-purple-700', textSub: 'text-purple-600', label: 'técnico' },
                'COMPRAS':       { bg: 'bg-yellow-50', border: 'border-yellow-100', text: 'text-yellow-700', textSub: 'text-yellow-600', label: 'insumos' },
                'PREPARAÇÃO':    { bg: 'bg-orange-50', border: 'border-orange-100', text: 'text-orange-700', textSub: 'text-orange-600', label: 'material' },
                'QUALIDADE':     { bg: 'bg-indigo-50', border: 'border-indigo-100', text: 'text-indigo-700', textSub: 'text-indigo-600', label: 'inspeção' },
                'MANUTENÇÃO':    { bg: 'bg-blue-50', border: 'border-blue-100', text: 'text-blue-700', textSub: 'text-blue-600', label: 'planejada' },
                'PRODUÇÃO':      { bg: 'bg-green-50', border: 'border-green-100', text: 'text-green-700', textSub: 'text-green-600', label: 'operação' },
                'SETUP':         { bg: 'bg-amber-50', border: 'border-amber-100', text: 'text-amber-700', textSub: 'text-amber-600', label: 'troca' },
                'ADMINISTRATIVO':{ bg: 'bg-gray-50', border: 'border-gray-100', text: 'text-gray-700', textSub: 'text-gray-600', label: 'feriado/energia' },
                'PCP':           { bg: 'bg-slate-50', border: 'border-slate-100', text: 'text-slate-700', textSub: 'text-slate-600', label: 'programação' },
                'COMERCIAL':     { bg: 'bg-cyan-50', border: 'border-cyan-100', text: 'text-cyan-700', textSub: 'text-cyan-600', label: 'sem pedido' },
                'OUTROS':        { bg: 'bg-stone-50', border: 'border-stone-100', text: 'text-stone-700', textSub: 'text-stone-600', label: 'diversos' }
            };

            const defaultStyle = { bg: 'bg-gray-50', border: 'border-gray-100', text: 'text-gray-700', textSub: 'text-gray-600', label: '' };

            // Gerar cards dinamicamente
            const cardsContainer = document.getElementById('extended-downtime-category-cards');
            if (cardsContainer) {
                // Ordenar categorias por horas (maior primeiro)
                const sortedCategories = Object.entries(categoryHours)
                    .filter(([, h]) => h > 0)
                    .sort((a, b) => b[1] - a[1]);

                if (sortedCategories.length === 0) {
                    cardsContainer.innerHTML = '<div class="col-span-full text-center py-4 text-gray-400 text-sm">Nenhuma parada no período</div>';
                } else {
                    cardsContainer.innerHTML = sortedCategories.map(([cat, hours]) => {
                        const style = categoryStyles[cat] || defaultStyle;
                        return `
                            <div class="${style.bg} rounded-xl p-4 text-center shadow-sm border ${style.border} hover:shadow-md transition">
                                <p class="text-xs ${style.text} font-medium mb-2">${cat}</p>
                                <p class="text-2xl font-bold ${style.text}">${hours.toFixed(1)}h</p>
                                <p class="text-xs ${style.textSub} mt-1">${style.label}</p>
                            </div>
                        `;
                    }).join('');
                }
            }

            document.getElementById('extended-downtime-total').textContent = `${data.length} registros`;

            // Renderizar gráfico de distribuição por categoria
            renderExtendedDowntimeChart(categoryHours);

            // Renderizar lista
            const listContainer = document.getElementById('extended-downtime-analysis-list');
            if (data.length === 0) {
                listContainer.innerHTML = '<p class="text-sm text-gray-500 text-center py-4">Nenhuma parada longa no período selecionado.</p>';
            } else {
                listContainer.innerHTML = data.map(item => {
                    // Calcular duração: se ativa, calcular do início até agora; senão usar duration_minutes
                    let hours;
                    const isActive = item.status === 'active';
                    
                    if (isActive) {
                        // Parada ativa - calcular tempo desde o início até agora
                        let startTime;
                        if (item.start_datetime?.toDate) {
                            startTime = item.start_datetime.toDate();
                        } else if (item.start_date && item.start_time) {
                            startTime = new Date(`${item.start_date}T${item.start_time}`);
                        } else if (item.start_date) {
                            startTime = new Date(item.start_date);
                        } else {
                            startTime = new Date();
                        }
                        const now = new Date();
                        const durationMin = Math.max(0, Math.floor((now - startTime) / (1000 * 60)));
                        hours = (durationMin / 60).toFixed(1);
                    } else {
                        // Parada finalizada - usar duration_minutes
                        hours = ((item.duration_minutes || 0) / 60).toFixed(1);
                    }
                    
                    // Determinar categoria/tipo para exibição
                    const type = (item.type || '').toUpperCase();
                    const reason = (item.reason || '').toUpperCase();
                    const category = (item.category || '').toUpperCase();
                    
                    let typeLabel = item.reason || item.type || 'Outro';
                    let typeColor = 'bg-gray-100 text-gray-700';
                    
                    // Categorizar para cor
                    if (type === 'weekend' || reason.includes('FIM DE SEMANA') || reason.includes('SEM PROGRAMAÇÃO-FIM DE SEMANA')) {
                        typeColor = 'bg-gray-200 text-gray-800';
                    } else if (type === 'maintenance' || type === 'preventive' || 
                        reason.includes('MANUTENÇÃO') || category === 'MANUTENÇÃO') {
                        typeColor = 'bg-blue-100 text-blue-700';
                    } else if (type === 'holiday' || reason.includes('FERIADO')) {
                        typeColor = 'bg-amber-100 text-amber-700';
                    } else if (category === 'COMERCIAL' || reason.includes('SEM PEDIDO') || reason.includes('PARADA COMERCIAL')) {
                        typeColor = 'bg-cyan-100 text-cyan-700';
                    } else if (category === 'PCP') {
                        typeColor = 'bg-slate-100 text-slate-700';
                    } else {
                        typeColor = 'bg-red-100 text-red-700';
                    }
                    
                    // Badge de status - considerar vários valores
                    let statusBadge;
                    if (isActive) {
                        statusBadge = '<span class="text-xs px-2 py-1 rounded bg-red-100 text-red-700 font-semibold animate-pulse">🔴 ATIVA</span>';
                    } else if (item.status === 'inactive' || item.status === 'registered' || item.status === 'finished') {
                        statusBadge = '<span class="text-xs px-2 py-1 rounded bg-green-100 text-green-700 font-semibold">✅ FINALIZADA</span>';
                    } else {
                        statusBadge = `<span class="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700 font-semibold">${item.status || 'N/A'}</span>`;
                    }
                    
                    // Período detalhado com horários
                    const startTimeStr = item.start_time || '00:00';
                    const endTimeStr = item.end_time || '23:59';
                    let periodText;
                    if (isActive) {
                        periodText = `Início: ${item.start_date || ''} às ${startTimeStr} (em andamento)`;
                    } else {
                        periodText = `${item.start_date || ''} ${startTimeStr} → ${item.end_date || ''} ${endTimeStr}`;
                    }
                    
                    // Informações adicionais
                    const registeredBy = item.registered_by || item.registeredBy || item.created_by || '-';
                    const finishedBy = item.finished_by || item.finishedBy || '-';
                    const createdAt = item.createdAt?.toDate?.() 
                        ? item.createdAt.toDate().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                        : '-';
                    const finishedAt = item.finishedAt?.toDate?.()
                        ? item.finishedAt.toDate().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                        : (isActive ? '-' : (item.end_date || '-'));
                    
                    return `
                        <div class="p-4 ${isActive ? 'bg-red-50 border-2 border-red-300' : 'bg-gray-50 border border-gray-200'} rounded-xl hover:shadow-md transition-all">
                            <!-- Header com máquina e status -->
                            <div class="flex items-center justify-between mb-3">
                                <div class="flex items-center gap-3">
                                    <div class="w-10 h-10 bg-gradient-to-br ${isActive ? 'from-red-500 to-red-600' : 'from-gray-500 to-gray-600'} rounded-lg flex items-center justify-center text-white font-bold text-sm">
                                        ${(item.machine_id || '-').slice(-2)}
                                    </div>
                                    <div>
                                        <span class="font-bold text-base text-gray-800">${item.machine_id || '-'}</span>
                                        <div class="flex items-center gap-2 mt-0.5">
                                            <span class="text-xs px-2 py-0.5 rounded ${typeColor}">${typeLabel}</span>
                                            ${statusBadge}
                                        </div>
                                    </div>
                                </div>
                                <div class="flex items-center gap-2">
                                    <span class="text-xl font-bold ${isActive ? 'text-red-600' : 'text-gray-700'}">${hours}h</span>
                                    <button class="btn-edit-extended-downtime-analysis bg-blue-500 hover:bg-blue-600 text-white px-2.5 py-1.5 rounded-lg text-xs font-semibold transition shadow-sm" data-id="${item.id}" data-machine="${item.machine_id}" data-type="${item.type}" data-start-date="${item.start_date}" data-end-date="${item.end_date || ''}" data-reason="${item.reason}" data-start-time="${startTimeStr}" data-end-time="${endTimeStr}">
                                        <i data-lucide="edit-2" class="w-3.5 h-3.5"></i>
                                    </button>
                                    <button class="btn-delete-extended-downtime-analysis bg-red-500 hover:bg-red-600 text-white px-2.5 py-1.5 rounded-lg text-xs font-semibold transition shadow-sm" data-id="${item.id}" data-machine="${item.machine_id}">
                                        <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                                    </button>
                                </div>
                            </div>
                            
                            <!-- Motivo -->
                            <div class="mb-3 p-2 bg-white rounded-lg border ${isActive ? 'border-red-200' : 'border-gray-200'}">
                                <p class="text-xs text-gray-500 mb-1 font-medium">MOTIVO:</p>
                                <p class="text-sm text-gray-800">${item.reason || 'Não informado'}</p>
                            </div>
                            
                            <!-- Grid de informações detalhadas -->
                            <div class="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                                <div class="bg-white p-2 rounded-lg border ${isActive ? 'border-red-100' : 'border-gray-100'}">
                                    <span class="text-gray-500 block">Período</span>
                                    <span class="font-semibold text-gray-700">${periodText}</span>
                                </div>
                                <div class="bg-white p-2 rounded-lg border ${isActive ? 'border-red-100' : 'border-gray-100'}">
                                    <span class="text-gray-500 block">Registrado por</span>
                                    <span class="font-semibold text-gray-700">${registeredBy}</span>
                                </div>
                                <div class="bg-white p-2 rounded-lg border ${isActive ? 'border-red-100' : 'border-gray-100'}">
                                    <span class="text-gray-500 block">Registro em</span>
                                    <span class="font-semibold text-gray-700">${createdAt}</span>
                                </div>
                                <div class="bg-white p-2 rounded-lg border ${isActive ? 'border-red-100' : 'border-gray-100'}">
                                    <span class="text-gray-500 block">${isActive ? 'Status' : 'Finalizado por'}</span>
                                    <span class="font-semibold ${isActive ? 'text-red-600' : 'text-gray-700'}">${isActive ? 'Em andamento' : finishedBy}</span>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('');
                
                // Attach listeners para os botões da análise
                document.querySelectorAll('.btn-edit-extended-downtime-analysis').forEach(btn => {
                    btn.removeEventListener('click', handleEditExtendedDowntimeFromAnalysis);
                    btn.addEventListener('click', handleEditExtendedDowntimeFromAnalysis);
                });
                
                document.querySelectorAll('.btn-delete-extended-downtime-analysis').forEach(btn => {
                    btn.removeEventListener('click', handleDeleteExtendedDowntimeFromAnalysis);
                    btn.addEventListener('click', handleDeleteExtendedDowntimeFromAnalysis);
                });
                
                if (typeof lucide !== "undefined") lucide.createIcons();
            }

        } catch (error) {
            console.error('[EXTENDED-DOWNTIME] Erro ao carregar paradas longas:', error);
        }
    }

    // Variável para armazenar instância do gráfico de paradas longas
    let extendedDowntimeChartInstance = null;

    // Renderiza o gráfico de distribuição de paradas longas por tipo
    function renderExtendedDowntimeChart(categoryHoursObj) {
        const canvas = document.getElementById('extended-downtime-chart');
        if (!canvas) {
            console.warn('[EXTENDED-DOWNTIME-CHART] Canvas não encontrado');
            return;
        }

        // Destruir gráfico existente se houver
        if (extendedDowntimeChartInstance) {
            extendedDowntimeChartInstance.destroy();
        }

        const ctx = canvas.getContext('2d');
        
        // Cores por categoria (sincronizadas com o gráfico principal)
        const categoryChartColors = {
            'FERRAMENTARIA': '#ff1744',
            'PROCESSO': '#7c4dff',
            'COMPRAS': '#ffab00',
            'PREPARAÇÃO': '#ff9100',
            'QUALIDADE': '#6366f1',
            'MANUTENÇÃO': '#3b82f6',
            'PRODUÇÃO': '#00e676',
            'SETUP': '#fbbf24',
            'ADMINISTRATIVO': '#78909c',
            'PCP': '#475569',
            'COMERCIAL': '#06b6d4',
            'OUTROS': '#9e9e9e'
        };
        
        // Filtrar categorias com valor > 0 e ordenar por horas
        const sortedEntries = Object.entries(categoryHoursObj)
            .filter(([, h]) => h > 0)
            .sort((a, b) => b[1] - a[1]);
        
        const labels = sortedEntries.map(([cat]) => cat);
        const data = sortedEntries.map(([, h]) => h);
        const colors = labels.map(cat => categoryChartColors[cat] || '#6B7280');
        const total = data.reduce((sum, val) => sum + val, 0);

        // Se não houver dados, mostrar mensagem
        if (total === 0) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.font = '14px sans-serif';
            ctx.fillStyle = '#9ca3af';
            ctx.textAlign = 'center';
            ctx.fillText('Sem dados para exibir', canvas.width / 2, canvas.height / 2);
            return;
        }

        const isMobile = window.innerWidth < 768;

        extendedDowntimeChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    data,
                    backgroundColor: colors,
                    borderWidth: 0,
                    hoverOffset: 8,
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '60%',
                plugins: {
                    legend: {
                        position: isMobile ? 'bottom' : 'right',
                        labels: {
                            usePointStyle: true,
                            padding: isMobile ? 10 : 14,
                            boxWidth: isMobile ? 10 : 12,
                            font: { size: isMobile ? 10 : 12 },
                            generateLabels: function(chart) {
                                const dataset = chart.data.datasets[0];
                                return chart.data.labels.map((label, i) => {
                                    const value = dataset.data[i];
                                    const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                                    return {
                                        text: `${label}: ${value.toFixed(1)}h (${percentage}%)`,
                                        fillStyle: dataset.backgroundColor[i],
                                        hidden: false,
                                        index: i
                                    };
                                });
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const value = context.parsed;
                                const percentage = ((value / total) * 100).toFixed(1);
                                return `${context.label}: ${value.toFixed(1)}h (${percentage}%)`;
                            }
                        },
                        backgroundColor: '#0F172A',
                        titleFont: { size: 12 },
                        bodyFont: { size: 11 },
                        padding: 10
                    }
                },
                animation: {
                    animateRotate: true,
                    animateScale: true,
                    duration: 800
                }
            }
        });
    }

    // Handlers para editar/deletar da análise
    async function handleEditExtendedDowntimeFromAnalysis(e) {
        e.stopPropagation();
        
        // ⚠️ VERIFICAÇÃO DE PERMISSÃO: Apenas gestores podem editar
        if (!isUserGestorOrAdmin()) {
            showPermissionDeniedNotification('editar paradas longas');
            return;
        }
        
        const btn = e.currentTarget;
        const recordId = btn.dataset.id;
        
        console.log('[EXTENDED-DOWNTIME] Editando da análise:', recordId);
        
        // Abrir diretamente o modal de edição completa
        await openEditDowntimeModal(recordId);
    }

    async function handleDeleteExtendedDowntimeFromAnalysis(e) {
        e.stopPropagation();
        
        // ⚠️ VERIFICAÇÃO DE PERMISSÃO: Apenas gestores podem excluir
        if (!isUserGestorOrAdmin()) {
            showPermissionDeniedNotification('excluir paradas longas');
            return;
        }
        
        const btn = e.currentTarget;
        const recordId = btn.dataset.id;
        const machine = btn.dataset.machine;

        if (!confirm(`Tem certeza que deseja excluir a parada da máquina ${machine}?`)) {
            return;
        }

        try {
            btn.disabled = true;
            await getDb().collection('extended_downtime_logs').doc(recordId).delete();
            
            // Recarregar análise
            const { startDate, endDate, machine } = currentAnalysisFilters;
            await loadExtendedDowntimeAnalysis(startDate, endDate, machine);

        } catch (error) {
            console.error('[EXTENDED-DOWNTIME] Erro ao excluir:', error);
            alert('Erro ao excluir: ' + error.message);
            btn.disabled = false;
        }
    }

    // Função para carregar análise comparativa
    async function loadComparativeAnalysis() {
        console.log('[TRACE][loadComparativeAnalysis] View comparativa não implementada no HTML');
        // A view comparativa ainda não foi implementada no HTML
        // TODO: Adicionar canvas comparison-chart e interface no index.html para habilitar esta funcionalidade
    }

    // Função para carregar análise preditiva
    async function loadPredictiveAnalysis() {
        console.log('[PREDICTIVE] Carregando view de analytics preditivos');
        
        try {
            // Inicializar sistema de analytics preditivos se não estiver ativo
            if (!window.predictiveAnalytics || !window.predictiveAnalytics.predictions) {
                console.log('[PREDICTIVE] Inicializando sistema preditivo...');
                await window.predictiveAnalytics.initialize();
            } else {
                // Se já estiver inicializado, apenas atualizar as previsões
                console.log('[PREDICTIVE] Atualizando previsões existentes...');
                await window.predictiveAnalytics.generatePredictions();
            }

            // Inicializar KPIs avançados se não estiver ativo
            if (!window.advancedKPIs || !window.advancedKPIs.cache.lastUpdate) {
                console.log('[ADVANCED-KPIs] Inicializando KPIs avançados...');
                await window.advancedKPIs.initialize();
            } else {
                // Se já estiver inicializado, apenas atualizar se necessário
                const lastUpdate = window.advancedKPIs.cache.lastUpdate;
                const hoursSinceUpdate = (new Date() - lastUpdate) / (1000 * 60 * 60);
                
                if (hoursSinceUpdate > 1) { // Atualizar se foi há mais de 1 hora
                    console.log('[ADVANCED-KPIs] Atualizando KPIs avançados...');
                    await window.advancedKPIs.calculateAllKPIs();
                }
            }

            // Inicializar análise Pareto automática
            if (!window.autoParetoAnalysis || !window.autoParetoAnalysis.analytics.lastUpdate) {
                console.log('[AUTO-PARETO] Inicializando análise Pareto automática...');
                await window.autoParetoAnalysis.initialize();
            } else {
                // Se já estiver inicializado, verificar se precisa atualizar
                const lastUpdate = window.autoParetoAnalysis.analytics.lastUpdate;
                const hoursSinceUpdate = (new Date() - lastUpdate) / (1000 * 60 * 60);
                
                if (hoursSinceUpdate > 2) { // Atualizar se foi há mais de 2 horas
                    console.log('[AUTO-PARETO] Atualizando análise Pareto...');
                    await window.autoParetoAnalysis.performCompleteAnalysis();
                }
            }

            // Inicializar sistema SPC automaticamente
            if (window.spcController) {
                if (!window.spcController.spcData.lastUpdate) {
                    console.log('[SPC] Inicializando sistema SPC...');
                    await window.spcController.initialize();
                } else {
                    // Verificar se precisa atualizar
                    const lastUpdate = window.spcController.spcData.lastUpdate;
                    const hoursSinceUpdate = (new Date() - lastUpdate) / (1000 * 60 * 60);
                    
                    if (hoursSinceUpdate > 1) { // Atualizar se foi há mais de 1 hora
                        console.log('[SPC] Atualizando sistema SPC...');
                        await window.spcController.initialize();
                    }
                }
            } else {
                console.warn('[SPC] SPCController não disponível');
            }

            // Inicializar sistema de rastreabilidade total
            if (!window.traceabilitySystem || !window.traceabilitySystem.traceabilityData.lastUpdate) {
                console.log('[TRACEABILITY] Inicializando sistema de rastreabilidade total...');
                await window.traceabilitySystem.initialize();
            } else {
                // Se já estiver inicializado, verificar se precisa atualizar
                const lastUpdate = window.traceabilitySystem.traceabilityData.lastUpdate;
                const hoursSinceUpdate = (new Date() - lastUpdate) / (1000 * 60 * 60);
                
                if (hoursSinceUpdate > 6) { // Atualizar se foi há mais de 6 horas
                    console.log('[TRACEABILITY] Atualizando dados de rastreabilidade...');
                    await window.traceabilitySystem.loadTraceabilityData();
                    window.traceabilitySystem.buildGenealogyTree();
                    window.traceabilitySystem.updateTraceabilityInterface();
                }
            }
            
            console.log('[PREDICTIVE] Todos os sistemas avançados carregados com sucesso');
            
        } catch (error) {
            console.error('[PREDICTIVE] Erro ao carregar analytics preditivos:', error);
            
            // Mostrar interface de erro
            const alertsContainer = document.getElementById('proactive-alerts');
            if (alertsContainer) {
                alertsContainer.innerHTML = `
                    <div class="text-center text-red-500 py-8">
                        <i data-lucide="alert-circle" class="w-12 h-12 mx-auto text-red-400 mb-2"></i>
                        <p class="font-semibold">Erro ao carregar sistema preditivo</p>
                        <p class="text-sm text-gray-600 mt-1">${error.message}</p>
                    </div>
                `;
            }
        }
    }

    // Função para gerar comparação
    async function generateComparison() {
        const comparisonType = document.getElementById('comparison-type').value;
        const metric = document.getElementById('comparison-metric').value;
        const { startDate, endDate } = currentAnalysisFilters;
        
        let comparisonData = [];
        
        switch (comparisonType) {
            case 'machines':
                comparisonData = await compareByMachines(metric, startDate, endDate);
                break;
            case 'shifts':
                comparisonData = await compareByShifts(metric, startDate, endDate);
                break;
            case 'periods':
                comparisonData = await compareByPeriods(metric);
                break;
            case 'products':
                comparisonData = await compareByProducts(metric, startDate, endDate);
                break;
        }

        // Gerar gráfico de comparação
        await generateComparisonChart(comparisonData, metric);
        generateComparisonRanking(comparisonData);
        generateComparisonStats(comparisonData);
    }

    // Funções auxiliares para análise
    
    // Função de diagnóstico para verificar dados no Firestore
    async function diagnosticFirestoreData() {
        console.log('📍 [DIAGNOSTIC] Iniciando diagnóstico de dados do Firestore...');
        
        try {
            // Verificar production_entries
            const prodSnapshot = await getDb().collection('production_entries').limit(5).get();
            console.log('📍 [DIAGNOSTIC] production_entries:', {
                size: prodSnapshot.size,
                samples: prodSnapshot.docs.map(d => ({
                    id: d.id,
                    data: d.data().data,
                    machine: d.data().machine,
                    produzido: d.data().produzido,
                    turno: d.data().turno
                }))
            });
            
            // Verificar downtime_entries
            const downtimeSnapshot = await getDb().collection('downtime_entries').limit(5).get();
            console.log('📍 [DIAGNOSTIC] downtime_entries:', {
                size: downtimeSnapshot.size,
                samples: downtimeSnapshot.docs.map(d => ({
                    id: d.id,
                    date: d.data().date,
                    machine: d.data().machine,
                    duration: d.data().duration,
                    reason: d.data().reason
                }))
            });
            
            // Verificar planning
            const planningSnapshot = await getDb().collection('planning').limit(5).get();
            console.log('📍 [DIAGNOSTIC] planning:', {
                size: planningSnapshot.size,
                samples: planningSnapshot.docs.map(d => ({
                    id: d.id,
                    date: d.data().date,
                    machine: d.data().machine,
                    mp: d.data().mp
                }))
            });
            
        } catch (error) {
            console.error('📍 [DIAGNOSTIC] Erro ao buscar dados:', error);
        }
    }

    // Função para testar todos os gráficos
    async function testAllCharts() {
        console.log('🧪 [TEST] Iniciando teste de todos os gráficos...');
        
        const chartTests = [
            { name: 'OEE Distribution', canvasId: 'oee-distribution-chart', view: 'overview' },
            { name: 'Hourly Production', canvasId: 'hourly-production-chart', view: 'production' },
            { name: 'Analysis Hourly Production', canvasId: 'analysis-hourly-production-chart', view: 'analysis-production' },
            { name: 'Shift Production', canvasId: 'shift-production-chart', view: 'production' },
            { name: 'Machine Production Timeline', canvasId: 'analysis-machine-production-timeline', view: 'analysis-production' },

            { name: 'Losses Pareto', canvasId: 'losses-pareto-chart', view: 'losses' },
            { name: 'Losses by Machine', canvasId: 'losses-by-machine-chart', view: 'losses' },
            { name: 'Losses by Product', canvasId: 'losses-by-product-chart', view: 'losses' },
            { name: 'Losses by Material', canvasId: 'losses-by-material-chart', view: 'losses' },
            { name: 'Losses Trend', canvasId: 'losses-trend-chart', view: 'losses' },
            { name: 'Downtime Reasons', canvasId: 'downtime-reasons-chart', view: 'downtime' },
            { name: 'Downtime by Machine', canvasId: 'downtime-by-machine-chart', view: 'downtime' },
            { name: 'Downtime Timeline', canvasId: 'downtime-timeline-chart', view: 'downtime' }
            // Nota: comparison-chart removido pois a view comparative não foi implementada no HTML
        ];
        
        for (const test of chartTests) {
            const canvas = document.getElementById(test.canvasId);
            const chart = canvas ? Chart.getChart(canvas) : null;
            
            const status = {
                canvasExists: !!canvas,
                chartCreated: !!chart,
                hasData: chart?.data?.datasets?.length > 0 || false,
                view: test.view
            };
            
            console.log(`🧪 [TEST] ${test.name}:`, status);
            
            if (!canvas) {
                console.error(`❌ [TEST] Canvas "${test.canvasId}" não encontrado no DOM`);
            } else if (!chart) {
                console.warn(`⚠️ [TEST] Gráfico "${test.name}" não inicializado (canvas existe mas sem Chart.js)`);
            } else if (!status.hasData) {
                console.warn(`⚠️ [TEST] Gráfico "${test.name}" sem dados`);
            } else {
                console.log(`✅ [TEST] Gráfico "${test.name}" OK`);
            }
        }
        
        console.log('🧪 [TEST] Teste completo');
    }
    
    // Helper para destruir gráficos Chart.js existentes
    function destroyChart(canvasId) {
        const canvas = document.getElementById(canvasId);
        if (canvas) {
            const existingChart = Chart.getChart(canvas);
            if (existingChart) {
                existingChart.destroy();
            }
        }
    }
    
    // Helper para mostrar mensagem quando não há dados no gráfico
    function showNoDataMessage(canvasId, message = 'Nenhum dado disponível para o período selecionado') {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        
        // Limpar canvas
        const context = canvas.getContext('2d');
        if (context) {
            context.clearRect(0, 0, canvas.width, canvas.height);
        }
        
        // Adicionar mensagem
        const container = canvas.parentElement;
        if (container) {
            let messageDiv = container.querySelector('.no-data-message');
            if (!messageDiv) {
                messageDiv = document.createElement('div');
                messageDiv.className = 'no-data-message absolute inset-0 flex items-center justify-center';
                container.style.position = 'relative';
                container.appendChild(messageDiv);
            }
            messageDiv.innerHTML = `<p class="text-gray-500 text-sm">${message}</p>`;
        }
    }
    
    // Helper para remover mensagem de "sem dados"
    function clearNoDataMessage(canvasId) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        
        const container = canvas.parentElement;
        if (container) {
            const messageDiv = container.querySelector('.no-data-message');
            if (messageDiv) messageDiv.remove();
        }
    }

    // Configurações responsivas globais para gráficos
    function getResponsiveChartOptions() {
        const isMobile = window.innerWidth < 768;
        const isTablet = window.innerWidth < 1024;
        
        return {
            responsive: true,
            maintainAspectRatio: false,
            devicePixelRatio: window.devicePixelRatio || 1,
            scales: {
                x: {
                    grid: {
                        display: !isMobile,
                        color: 'rgba(0, 0, 0, 0.05)'
                    },
                    ticks: {
                        font: {
                            size: isMobile ? 8 : isTablet ? 10 : 12
                        },
                        maxRotation: isMobile ? 45 : 0,
                        minRotation: 0,
                        autoSkip: true,
                        maxTicksLimit: isMobile ? 8 : isTablet ? 12 : 16
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    },
                    ticks: {
                        font: {
                            size: isMobile ? 9 : isTablet ? 11 : 12
                        },
                        maxTicksLimit: isMobile ? 6 : 8
                    }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: isMobile ? 'bottom' : 'top',
                    labels: {
                        font: {
                            size: isMobile ? 10 : isTablet ? 11 : 12
                        },
                        usePointStyle: true,
                        padding: isMobile ? 10 : 20,
                        boxWidth: isMobile ? 8 : 12
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: 'white',
                    bodyColor: 'white',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                    titleFont: {
                        size: isMobile ? 11 : 12
                    },
                    bodyFont: {
                        size: isMobile ? 10 : 11
                    },
                    padding: isMobile ? 6 : 10
                }
            },
            layout: {
                padding: {
                    top: isMobile ? 5 : 10,
                    right: isMobile ? 5 : 10,
                    bottom: isMobile ? 5 : 10,
                    left: isMobile ? 5 : 10
                }
            }
        };
    }

    // Função para mesclar configurações específicas com as responsivas
    function mergeChartOptions(specificOptions = {}) {
        const baseOptions = getResponsiveChartOptions();
        
        // Função helper para merge profundo
        function deepMerge(target, source) {
            for (const key in source) {
                if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                    target[key] = target[key] || {};
                    deepMerge(target[key], source[key]);
                } else {
                    target[key] = source[key];
                }
            }
            return target;
        }
        
        return deepMerge(JSON.parse(JSON.stringify(baseOptions)), specificOptions);
    }

    async function getFilteredData(collection, startDate, endDate, machine = 'all', shift = 'all') {
        try {
            console.log('[TRACE][getFilteredData] called', { collection, startDate, endDate, machine, shift });

            // OTIMIZAÇÃO: verificar cache antes de ir ao Firestore
            const cachedRaw = _getFilteredDataFromCache(collection, startDate, endDate);
            if (cachedRaw) {
                console.debug(`📦 [Analysis] Cache hit: ${collection} (${cachedRaw.length} docs)`);
                // Aplicar filtros de máquina e turno localmente sobre o cache
                let data = cachedRaw;
                if (machine !== 'all') {
                    const target = normalizeMachineId(machine);
                    data = data.filter(item => normalizeMachineId(item.machine) === target);
                }
                if (shift !== 'all') {
                    data = data.filter(item => Number(item.shift || 0) === Number(shift));
                }
                return data;
            }
            
            const normalizeShift = (value) => {
                if (value === undefined || value === null) return null;
                if (typeof value === 'number' && Number.isFinite(value)) return value;
                const match = String(value).match(/(\d+)/);
                return match ? Number(match[1]) : null;
            };
            // FIX: map cada tipo analítico para a coleção real no Firestore e normalizar os campos esperados pela aba de análise
            const collectionConfig = {
                production: {
                    collection: 'production_entries',
                    dateField: 'data',
                    mapper: (id, raw) => {
                        const mappedDate = raw.data || raw.date || '';
                        const primaryTimestamp = raw.timestamp || raw.createdAt || raw.updatedAt;
                        const resolvedDateTime = resolveProductionDateTime(raw);
                        const timestamp = resolvedDateTime || normalizeToDate(primaryTimestamp);
                        const timeHint = raw.horaInformada || raw.hora || raw.hour || raw.time || null;
                        const workDay = getWorkDayFromTimestamp(resolvedDateTime || primaryTimestamp) || getWorkDay(mappedDate, timeHint);
                        const isoDateTime = timestamp ? new Date(timestamp.getTime() - timestamp.getTimezoneOffset() * 60000).toISOString() : null;
                        
                        // Resolver produto através de múltiplas fontes
                        const product = raw.product || raw.produto || raw.product_cod || raw.cod_produto || raw.productName || raw.mp || '';
                        
                        // CORREÇÃO: Usar mesma lógica do Dashboard TV para consistência
                        // Verificar todos os campos possíveis de quantidade produzida
                        const rawQty = Number(raw.produzido ?? raw.pecasBoas ?? raw.quantity ?? raw.produced ?? raw.qtd ?? raw.quantidade ?? raw.total_produzido ?? 0) || 0;
                        
                        return {
                            id,
                            date: mappedDate,
                            machine: normalizeMachineId(raw.machine || raw.machineRef || raw.machine_id || null),
                            quantity: Math.round(rawQty), // Sempre inteiro, consistente com Dashboard TV
                            shift: normalizeShift(raw.turno ?? raw.shift),
                            datetime: isoDateTime,
                            mp: raw.mp || '',
                            product: product,
                            workDay: workDay || mappedDate,
                            raw
                        };
                    }
                },
                losses: {
                    collection: 'production_entries',
                    dateField: 'data',
                    mapper: (id, raw) => {
                        const dateValue = raw.data || raw.date || '';
                        const primaryTimestamp = raw.timestamp || raw.createdAt || raw.updatedAt;
                        const resolvedDateTime = resolveProductionDateTime(raw);
                        const timeHint = raw.horaInformada || raw.hora || raw.hour || raw.time || null;
                        const workDay = getWorkDayFromTimestamp(resolvedDateTime || primaryTimestamp) || getWorkDay(dateValue, timeHint);
                        const rawRefugoKg = Number(raw.refugo_kg ?? raw.refugoKg ?? raw.scrap_kg ?? raw.scrapKg ?? 0) || 0;
                        const rawRefugoPcs = Number(raw.refugo_qty ?? raw.refugo_qtd ?? raw.scrap_qty ?? raw.scrap_qtd ?? 0) || 0;
                        const pieceWeight = Number(raw.piece_weight ?? raw.peso_unitario ?? raw.pesoUnitario ?? raw.peso ?? 0) || 0;
                        const resolvedPcs = rawRefugoPcs > 0
                            ? rawRefugoPcs
                            : (rawRefugoKg > 0 && pieceWeight > 0 ? Math.round((rawRefugoKg * 1000) / pieceWeight) : 0);
                        const resolvedKg = rawRefugoKg > 0
                            ? rawRefugoKg
                            : (pieceWeight > 0 && resolvedPcs > 0 ? (resolvedPcs * pieceWeight) / 1000 : 0);
                        
                        // Resolver produto através de múltiplas fontes
                        const product = raw.product || raw.produto || raw.product_cod || raw.cod_produto || raw.productName || '';
                        
                        return {
                            id,
                            date: dateValue,
                            machine: normalizeMachineId(raw.machine || raw.machineRef || raw.machine_id || null),
                            quantity: resolvedPcs,
                            shift: normalizeShift(raw.turno ?? raw.shift),
                            reason: raw.perdas || raw.reason || '',
                            mp: raw.mp || '',
                            mp_type: raw.mp_type || raw.mp || '',
                            product: product,
                            workDay: workDay || dateValue,
                            scrapPcs: resolvedPcs,
                            scrapKg: resolvedKg,
                            pieceWeight,
                            raw
                        };
                    }
                },
                downtime: {
                    collection: 'downtime_entries',
                    dateField: 'date',
                    mapper: (id, raw) => {
                        const startMinutes = raw.startTime ? parseTimeToMinutes(raw.date, raw.startTime) : null;
                        const endMinutes = raw.endTime ? parseTimeToMinutes(raw.date, raw.endTime) : null;
                        let duration = Number(raw.duration ?? raw.duration_min ?? raw.duracao_min ?? 0) || 0;
                        if (!duration && startMinutes !== null && endMinutes !== null) {
                            duration = Math.max(0, endMinutes - startMinutes);
                        }
                        const primaryTimestamp = raw.timestamp || raw.createdAt || raw.updatedAt;
                                const timeHint = raw.startTime || raw.endTime || null;
                                // Preferir calcular o workDay a partir da data/horário do próprio registro
                                // (evita classificar pelo createdAt quando o lançamento é retroativo)
                                const workDay = getWorkDay(raw.date || '', timeHint) || getWorkDayFromTimestamp(primaryTimestamp);
                        let mappedShift = normalizeShift(raw.shift ?? raw.turno);
                        if (!mappedShift) {
                            mappedShift = inferShiftFromSegment(raw.date || '', raw.startTime || '', raw.endTime || '');
                        }
                        return {
                            id,
                            date: raw.date || '',
                            machine: normalizeMachineId(raw.machine || null),
                            duration,
                            reason: raw.reason || '',
                            shift: mappedShift,
                            startTime: raw.startTime || '',
                            endTime: raw.endTime || '',
                            workDay: workDay || raw.date || '',
                            raw
                        };
                    }
                },
                plan: {
                    collection: 'planning',
                    dateField: 'date',
                    mapper: (id, raw) => {
                        const dateValue = raw.date || '';
                        const primaryTimestamp = raw.createdAt || raw.updatedAt || raw.timestamp;
                        // Calcular workDay usando timestamp (quando foi criado)
                        // Se não tiver timestamp, assumir que a data salva JÁ é uma data de trabalho
                        const workDay = getWorkDayFromTimestamp(primaryTimestamp) || dateValue;
                        
                        return {
                            id,
                            date: dateValue,
                            machine: normalizeMachineId(raw.machine || null),
                            quantity: getPlanQuantity(raw), // Usa função centralizada para consistência com Dashboard TV
                            shift: normalizeShift(raw.shift ?? raw.turno),
                            product: raw.product || '',
                            mp: raw.mp || '',
                            workDay: workDay || dateValue,
                            raw
                        };
                    }
                },
                rework: {
                    collection: 'rework_entries',
                    dateField: 'data',
                    mapper: (id, raw) => {
                        const dateValue = raw.data || '';
                        const primaryTimestamp = raw.timestamp || raw.createdAt || raw.updatedAt;
                        const workDay = getWorkDayFromTimestamp(primaryTimestamp) || dateValue;
                        return {
                            id,
                            date: dateValue,
                            machine: normalizeMachineId(raw.machine || null),
                            quantity: Number(raw.quantidade ?? raw.quantity ?? 0) || 0,
                            shift: normalizeShift(raw.turno ?? raw.shift),
                            reason: raw.motivo || raw.reason || '',
                            mp: raw.mp || '',
                            workDay: workDay || dateValue,
                            raw
                        };
                    }
                }
            };

            const config = collectionConfig[collection];
            if (!config) {
                console.warn(`Coleção de análise desconhecida: ${collection}`);
                return [];
            }

            if (!startDate || !endDate) {
                console.warn('[TRACE][getFilteredData] datas inválidas fornecidas', { startDate, endDate });
                return [];
            }

            let query = getDb().collection(config.collection);
            
            // Buscar um período amplo (do dia anterior ao dia posterior)
            // para capturar dados do turno 3 (23h-7h)
            const startObj = new Date(startDate);
            startObj.setDate(startObj.getDate() - 1);
            const queryStartDate = Number.isNaN(startObj.getTime()) ? null : startObj.toISOString().split('T')[0];
            
            const endObj = new Date(endDate);
            endObj.setDate(endObj.getDate() + 1);
            const queryEndDate = Number.isNaN(endObj.getTime()) ? null : endObj.toISOString().split('T')[0];
            
            console.log('[TRACE][getFilteredData] query setup with expanded date range', { 
                collection: config.collection,
                dateField: config.dateField,
                userStartDate: startDate,
                userEndDate: endDate,
                queryStartDate,
                queryEndDate,
                machine,
                shift
            });
            
            if (queryStartDate && queryEndDate) {
                query = query.where(config.dateField, '>=', queryStartDate).where(config.dateField, '<=', queryEndDate);
            }

            let snapshot = await query.get();

            if (snapshot.empty && queryStartDate && queryEndDate) {
                console.warn('[TRACE][getFilteredData] snapshot vazio com filtro de datas — sem dados para o período (otimização: fallback sem filtro REMOVIDO)');
            }
            console.log('[TRACE][getFilteredData] raw snapshot', { 
                collection: config.collection,
                size: snapshot.size,
                empty: snapshot.empty
            });
            
            let data = snapshot.docs.map(doc => config.mapper(doc.id, doc.data()));

            const startWorkDay = startDate || null;
            const endWorkDay = endDate || null;

            data = data.filter(item => {
                const workDay = item.workDay || item.date;
                if (!workDay) return false;
                const meetsStart = !startWorkDay || workDay >= startWorkDay;
                const meetsEnd = !endWorkDay || workDay <= endWorkDay;
                return meetsStart && meetsEnd;
            });

            if (collection === 'losses') {
                data = data.filter(item => {
                    if (item.quantity > 0) return true;
                    const rawWeight = Number(item.raw?.refugo_kg ?? item.raw?.weight ?? 0) || 0;
                    return rawWeight > 0;
                });
            }

            // OTIMIZAÇÃO: salvar no cache ANTES dos filtros de máquina/turno
            // para que trocas de filtro reutilizem os dados brutos
            _setFilteredDataCache(collection, startDate, endDate, data);

            if (machine !== 'all') {
                const target = normalizeMachineId(machine);
                data = data.filter(item => normalizeMachineId(item.machine) === target);
            }

            if (shift !== 'all') {
                data = data.filter(item => Number(item.shift || 0) === Number(shift));
            }

            console.log('[TRACE][getFilteredData] returning data', {
                collection,
                count: data.length,
                sample: data.slice(0, 3)
            });
            return data;
        } catch (error) {
            console.error('Erro ao buscar dados filtrados:', error);
            return [];
        }
    }

    // parseTimeToMinutes removido — usa proxy window.parseTimeToMinutes (linha 39)

    function showAnalysisLoading(show) {
        const loading = document.getElementById('analysis-loading');
        const noData = document.getElementById('analysis-no-data');
        
        if (show) {
            if (loading) loading.classList.remove('hidden');
            if (noData) noData.classList.add('hidden');
        } else {
            if (loading) loading.classList.add('hidden');
        }
    }

    function showAnalysisError() {
        const loading = document.getElementById('analysis-loading');
        const noData = document.getElementById('analysis-no-data');
        
        if (loading) loading.classList.add('hidden');
        if (noData) noData.classList.remove('hidden');
    }

    function showAnalysisNoData(message = 'Nenhum dado disponível para os filtros selecionados.') {
        const loading = document.getElementById('analysis-loading');
        const noData = document.getElementById('analysis-no-data');

        if (loading) {
            loading.classList.add('hidden');
        }

        if (noData) {
            noData.classList.remove('hidden');
            const messageElement = noData.querySelector('[data-analysis-empty-message]') || noData.querySelector('p');
            if (messageElement && message) {
                messageElement.textContent = message;
            }
        }
    }

    function loadAnalysisMachines() {
        // Inicializar lista de máquinas com os dados do banco de dados (normalizados)
        machines = window.machineDatabase.map(machine => ({ 
            id: normalizeMachineId(machine.id), 
            name: normalizeMachineId(machine.id), 
            model: machine.model 
        }));
        
        // Carregar lista de máquinas para o filtro
        const machineSelector = document.getElementById('analysis-machine');
        if (machineSelector) {
            machineSelector.innerHTML = '<option value="all">Todas as máquinas</option>';
            machines.forEach(machine => {
                const option = document.createElement('option');
                option.value = machine.id;
                option.textContent = `${machine.id} - ${machine.model}`;
                machineSelector.appendChild(option);
            });
        }

        // Carregar lista de máquinas para o formulário de ordens
        populateOrderMachineSelect();
    }

    function populateOrderMachineSelect() {
        const orderMachineSelect = document.getElementById('order-machine');
        if (orderMachineSelect) {
            // Manter a opção vazia no início
            const currentValue = orderMachineSelect.value;
            orderMachineSelect.innerHTML = '<option value="">Selecione uma máquina</option>';
            
            window.machineDatabase.forEach(machine => {
                const option = document.createElement('option');
                const mid = normalizeMachineId(machine.id);
                option.value = mid;
                option.textContent = `${mid} - ${machine.model}`;
                orderMachineSelect.appendChild(option);
            });

            // Restaurar valor anterior se existisse
            if (currentValue) {
                orderMachineSelect.value = currentValue;
            }
        }
    }

    // Função para atualizar o painel de informações da máquina na análise
    function updateAnalysisInfoPanel() {
        const machineSelector = document.getElementById('analysis-machine');
        const infoPanel = document.getElementById('analysis-info-panel');
        
        if (!machineSelector || !infoPanel) return;
        
        const selectedMachineId = machineSelector.value;
        
        // Se nenhuma máquina específica foi selecionada, ocultar o painel
        if (selectedMachineId === 'all') {
            infoPanel.classList.add('hidden');
            return;
        }
        
        // Encontrar a máquina
        const machineInfo = window.machineDatabase.find(m => normalizeMachineId(m.id) === selectedMachineId);
        
        if (machineInfo) {
            infoPanel.classList.remove('hidden');
            
            // Atualizar apenas nome e modelo da máquina
            document.getElementById('analysis-info-machine').textContent = selectedMachineId;
            document.getElementById('analysis-info-machine-model').textContent = machineInfo.model || '-';
        }
    }
    
    // Função para limpar informações do produto
    function clearAnalysisProductInfo() {
        // Função simplificada - não usada mais
    }
    
    // Função para atualizar o painel com informações do produto
    function updateAnalysisProductInfo(productCode, cycle, cavities, weight, productName) {
        const infoPanel = document.getElementById('analysis-info-panel');
        
        if (!infoPanel) return;
        
        if (productCode) {
            document.getElementById('analysis-info-product').textContent = productName || `Produto ${productCode}`;
            document.getElementById('analysis-info-product-code').textContent = `Código: ${productCode}`;
        }
        
        if (cycle) document.getElementById('analysis-info-cycle').textContent = cycle.toFixed(2);
        if (cavities) document.getElementById('analysis-info-cavities').textContent = cavities;
        if (weight) document.getElementById('analysis-info-weight').textContent = weight.toFixed(3);
    }

    function setAnalysisDefaultDates() {
        const workdayDate = getProductionDateString();
        // CORREÇÃO: Usar apenas o workday, não o range de calendário
        // O range de calendário era usado para cobrir dados de dois dias, mas isso causa
        // discrepância com o Dashboard TV que só mostra o dia atual
        
        const startDateInput = document.getElementById('analysis-start-date');
        const endDateInput = document.getElementById('analysis-end-date');
        
        if (startDateInput) startDateInput.value = workdayDate;
        if (endDateInput) endDateInput.value = workdayDate;
        
        // Configurar filtros padrão - usar apenas o workday atual (consistente com Dashboard TV)
        currentAnalysisFilters = {
            startDate: workdayDate,
            endDate: workdayDate,
            machine: 'all',
            shift: 'all',
            period: 'today'
        };
        
        console.log('[ANALYSIS] Default dates set:', {
            workdayDate,
            filters: currentAnalysisFilters
        });
    }

    // Helper: atualiza a aba de análise se ela estiver ativa
    async function refreshAnalysisIfActive() {
        try {
            const currentPage = document.querySelector('.nav-btn.active')?.dataset.page;
            if (currentPage !== 'analise') return;

            const activeView = document.querySelector('.analysis-tab-btn.active')?.getAttribute('data-view') || 'overview';
            console.log('[TRACE][refreshAnalysisIfActive] refreshing analysis view', { activeView, filters: currentAnalysisFilters });
            await loadAnalysisData(activeView);
        } catch (err) {
            console.error('[TRACE][refreshAnalysisIfActive] erro ao refrescar análise', err);
        }
    }

    // Funções para geração de gráficos específicos da análise

    // Gráfico de distribuição OEE por máquina
    async function generateOEEDistributionChart(productionData, lossesData, downtimeData, planData) {
        const ctx = document.getElementById('oee-distribution-chart');
        if (!ctx) return;

        destroyChart('oee-distribution-chart');

        const machines = [...new Set(productionData.map(item => item.machine))].filter(m => m);
        
        if (machines.length === 0) {
            showNoDataMessage('oee-distribution-chart');
            return;
        }
        
        clearNoDataMessage('oee-distribution-chart');
        
    const oeeByMachine = {};
    // Janela analisada em minutos (07:00 → 07:00)
    const periodMinutes = Math.max(1, calculateHoursInPeriod(currentAnalysisFilters.startDate, currentAnalysisFilters.endDate) * 60);

        machines.forEach(machine => {
            const machineProduction = productionData.filter(item => item.machine === machine);
            const machineLosses = lossesData.filter(item => item.machine === machine);
            const machineDowntime = downtimeData.filter(item => item.machine === machine);

            const totalProduced = machineProduction.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
            const totalLosses = machineLosses.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
            const totalDowntime = machineDowntime.reduce((sum, item) => sum + (Number(item.duration) || 0), 0);

            // Componentes em fração [0..1]
            const availability = Math.max(0, 1 - (totalDowntime / periodMinutes));
            const quality = totalProduced > 0 ? Math.max(0, (totalProduced - totalLosses) / totalProduced) : 1;

            // Performance: capacidade teórica baseada em ciclo/cavidades do plano (FIX: era 0.85 hardcoded)
            const machinePlan = (planData || []).find(p => (p.machine || '') === machine);
            const raw = machinePlan?.raw || machinePlan || {};
            const ciclo = Number(raw.budgeted_cycle) || 30;
            const cav = Number(raw.mold_cavities) || 2;
            const tempoDisponivel = Math.max(0, periodMinutes - totalDowntime);
            const capacidadeTeorica = (ciclo > 0 && cav > 0) ? (tempoDisponivel * 60 / ciclo) * cav : 0;
            const performance = capacidadeTeorica > 0 ? Math.min(1, totalProduced / capacidadeTeorica) : (totalProduced > 0 ? 1 : 0);

            const oeeFraction = Math.max(0, Math.min(1, availability * performance * quality));
            oeeByMachine[machine] = oeeFraction * 100; // guardar já em %
        });

        const labels = Object.keys(oeeByMachine);
        const values = Object.values(oeeByMachine).map(value => Number((value || 0).toFixed(1)));

        renderModernDonutChart({
            canvasId: 'oee-distribution-chart',
            labels,
            data: values,
            colors: ['#10B981', '#3B82F6', '#F97316', '#8B5CF6', '#F59E0B', '#EC4899'],
            datasetLabel: 'OEE %',
            tooltipFormatter: (context) => `${context.label}: ${Number(context.parsed || 0).toFixed(1)}%`
        });
    }

    // Geração do ranking de máquinas
    async function generateMachineRanking(productionData, planData) {
        const rankingContainer = document.getElementById('machine-ranking');
        if (!rankingContainer) return;

        const producedByMachine = new Map();
        const plannedByMachine = new Map();

        (productionData || []).forEach(item => {
            const m = (item?.machine || '').toString();
            if (!m) return;
            producedByMachine.set(m, (producedByMachine.get(m) || 0) + (Number(item.quantity) || 0));
        });

        (planData || []).forEach(plan => {
            const m = (plan?.machine || '').toString();
            if (!m) return;
            plannedByMachine.set(m, (plannedByMachine.get(m) || 0) + (Number(plan.quantity) || 0));
        });

        const entries = Array.from(new Set([...producedByMachine.keys(), ...plannedByMachine.keys()]))
            .map(m => {
                const produced = producedByMachine.get(m) || 0;
                const planned = plannedByMachine.get(m) || 0;
                const perf = planned > 0 ? Math.max(0, (produced / planned) * 100) : null;
                return { machine: m, produced, planned, perf };
            })
            .filter(e => e.perf !== null)
            .sort((a, b) => (b.perf - a.perf));

        if (entries.length === 0) {
            rankingContainer.innerHTML = '<div class="p-4 text-sm text-gray-500">Sem dados de plano para calcular performance.</div>';
            return;
        }

        const getColor = (p) => {
            if (p >= 90) return 'bg-green-500';
            if (p >= 75) return 'bg-blue-500';
            if (p >= 60) return 'bg-yellow-500';
            return 'bg-red-500';
        };

        const html = entries.slice(0, 6).map((row, index) => `
            <div class="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div class="flex items-center gap-4">
                    <div class="flex items-center justify-center w-8 h-8 ${getColor(row.perf)} text-white rounded-full font-bold">
                        ${index + 1}
                    </div>
                    <span class="font-semibold">${row.machine}</span>
                </div>
                <div class="text-right">
                    <span class="text-2xl font-bold text-gray-800">${row.perf.toFixed(1)}%</span>
                    <div class="w-24 h-2 bg-gray-200 rounded-full mt-1">
                        <div class="h-2 ${getColor(row.perf)} rounded-full" style="width: ${Math.min(100, row.perf).toFixed(1)}%"></div>
                    </div>
                    <div class="text-xs text-gray-500 mt-1">${row.produced.toLocaleString('pt-BR')} / ${row.planned.toLocaleString('pt-BR')} pcs</div>
                </div>
            </div>
        `).join('');

        rankingContainer.innerHTML = html;
    }

    // Gráfico de produção por hora
    async function generateHourlyProductionChart(productionData, options = {}) {
        const {
            canvas: providedCanvas = null,
            targetCanvasId = 'hourly-production-chart',
            chartContext = 'main',
            dailyTargetOverride = null,
            updateTimeline = chartContext === 'main'
        } = options;

        const canvas = providedCanvas || document.getElementById(targetCanvasId);
        if (!canvas) return;
        const canvasId = canvas.id || targetCanvasId;

        if (chartContext === 'analysis') {
            if (analysisHourlyChartInstance) {
                analysisHourlyChartInstance.destroy();
                analysisHourlyChartInstance = null;
            }
        } else if (hourlyChartInstance) {
            hourlyChartInstance.destroy();
            hourlyChartInstance = null;
        }

        if (!Array.isArray(productionData) || productionData.length === 0) {
            showNoDataMessage(canvasId);
            if (updateTimeline) {
                updateTimelineProgress(0, 0, 0);
            }
            return;
        }

        clearNoDataMessage(canvasId);

        const orderedHours = getProductionHoursOrder();
        const executedByHour = Object.fromEntries(orderedHours.map(label => [label, 0]));

        productionData.forEach(item => {
            let eventDate = null;
            if (item?.datetime) {
                eventDate = new Date(item.datetime);
            }
            // FIX: Fallback — tentar construir datetime a partir de date+time quando datetime está ausente
            if (!eventDate || Number.isNaN(eventDate.getTime())) {
                const d = item?.raw?.data || item?.raw?.date || item?.date;
                const t = item?.raw?.horaInformada || item?.raw?.hora || item?.raw?.time;
                if (d && t) {
                    eventDate = new Date(`${d}T${t}`);
                }
            }
            if (!eventDate || Number.isNaN(eventDate.getTime())) return;
            const label = formatHourLabel(eventDate.getHours());
            executedByHour[label] = (executedByHour[label] || 0) + (Number(item.quantity) || 0);
        });

        const overrideTarget = Number(dailyTargetOverride);
        let dailyTarget = Number.isFinite(overrideTarget) && overrideTarget > 0 ? overrideTarget : Number(window.selectedMachineData?.daily_target) || 1000;
        if (!Number.isFinite(dailyTarget) || dailyTarget < 0) {
            dailyTarget = 0;
        }

        const hourlyTarget = HOURS_IN_PRODUCTION_DAY > 0 ? (dailyTarget / HOURS_IN_PRODUCTION_DAY) : 0;

        const executedSeries = orderedHours.map(label => executedByHour[label] || 0);
        const plannedSeries = orderedHours.map(() => hourlyTarget);

        const totalExecuted = executedSeries.reduce((sum, value) => sum + value, 0);
        const totalPlanned = Math.max(0, dailyTarget);
        const hoursElapsed = getHoursElapsedInProductionDay(new Date());
        const expectedByNow = totalPlanned > 0 ? Math.min(hoursElapsed * hourlyTarget, totalPlanned) : 0;

        const instance = createHourlyProductionChart({
            canvas,
            labels: orderedHours,
            executedPerHour: executedSeries,
            plannedPerHour: plannedSeries,
            highlightCurrentHour: chartContext === 'main'
        });

        if (chartContext === 'analysis') {
            analysisHourlyChartInstance = instance;
        } else {
            hourlyChartInstance = instance;
        }

        if (updateTimeline) {
            updateTimelineProgress(totalExecuted, totalPlanned, expectedByNow);
        }

    }

    // Função para atualizar a barra de timeline
    function updateTimelineProgress(executed, planned, expectedByNow) {
        const progressBar = document.getElementById('timeline-progress');
        const targetIndicator = document.getElementById('timeline-target-indicator');
        const percentageText = document.getElementById('timeline-percentage');
        const executedText = document.getElementById('timeline-executed');
        const plannedText = document.getElementById('timeline-planned');
        const statusIndicator = document.getElementById('timeline-status-indicator');
        const statusText = document.getElementById('timeline-status-text');
        const lastUpdateText = document.getElementById('timeline-last-update');

        if (!progressBar || !targetIndicator) return;

        // Calcular percentuais
        const executedPercentage = planned > 0 ? Math.min((executed / planned) * 100, 100) : 0;
        const expectedPercentage = planned > 0 ? Math.min((expectedByNow / planned) * 100, 100) : 0;
        const palette = resolveProgressPalette(executedPercentage);
        const orderStatus = (currentActiveOrder && typeof currentActiveOrder.status === 'string')
            ? currentActiveOrder.status.toLowerCase()
            : '';
        const blockedStatuses = ['concluida', 'cancelada', 'finalizada', 'encerrada'];
    const orderEligibleForFinalize = !!currentActiveOrder?.id && !blockedStatuses.includes(orderStatus);
    const orderEligibleForActivate = !!currentActiveOrder?.id && !blockedStatuses.includes(orderStatus) && orderStatus !== 'ativa';

        currentOrderProgress = {
            executed: Number.isFinite(executed) ? executed : 0,
            planned: Number.isFinite(planned) ? planned : 0,
            expected: Number.isFinite(expectedByNow) ? expectedByNow : 0
        };

        // Animar barra de progresso
        setTimeout(() => {
            progressBar.style.width = `${executedPercentage}%`;
            targetIndicator.style.left = `${expectedPercentage}%`;
        }, 100);

        progressBar.classList.add('timeline-progress');
        progressBar.style.background = `linear-gradient(90deg, ${palette.start}, ${palette.end})`;
        progressBar.style.boxShadow = `0 6px 18px ${hexWithAlpha(palette.end, 0.35)}`;
        targetIndicator.style.backgroundColor = palette.end;
    const lotCompleted = planned > 0 && executed >= planned;
    progressBar.classList.toggle('timeline-complete', lotCompleted);

        // Atualizar textos
        if (percentageText) {
            percentageText.textContent = `${executedPercentage.toFixed(1)}%`;
            percentageText.classList.remove('text-red-600', 'text-amber-500', 'text-emerald-600', 'text-green-600');
            if (palette.textClass) {
                percentageText.classList.add(palette.textClass);
            }
        }
        
        if (executedText) {
            executedText.textContent = `${executed.toLocaleString('pt-BR')} peças`;
        }
        
        if (plannedText) {
            plannedText.textContent = `${planned.toLocaleString('pt-BR')} un (Planejado)`;
        }

        // Determinar status
        let status = 'on-track';
        let statusMessage = 'No prazo';
        let indicatorClass = 'bg-green-500 animate-pulse';

        if (executed < expectedByNow * 0.8) {
            status = 'behind';
            statusMessage = 'Atrasado';
            indicatorClass = 'bg-red-500 animate-pulse';
        } else if (executed > expectedByNow * 1.2) {
            status = 'ahead';
            statusMessage = 'Adiantado';
            indicatorClass = 'bg-blue-500 animate-pulse';
        }

        if (lotCompleted) {
            status = 'completed';
            statusMessage = 'Lote concluído';
            indicatorClass = 'bg-emerald-500 animate-pulse';
        }

        // Atualizar indicador de status
        if (statusIndicator) {
            statusIndicator.className = `w-2 h-2 rounded-full ${indicatorClass}`;
        }
        
        if (statusText) {
            statusText.textContent = statusMessage;
            statusText.className = `text-gray-600 font-medium`;
            
            if (status === 'behind') {
                statusText.className = 'text-red-600 font-medium';
            } else if (status === 'ahead') {
                statusText.className = 'text-blue-600 font-medium';
            } else {
                statusText.className = 'text-green-600 font-medium';
            }
        }

        // Atualizar timestamp
        if (lastUpdateText) {
            const now = new Date();
            lastUpdateText.textContent = `Última atualização: ${now.toLocaleTimeString('pt-BR', { 
                hour: '2-digit', 
                minute: '2-digit' 
            })}`;
        }

        if (finalizeOrderBtn) {
            finalizeOrderBtn.classList.toggle('hidden', !orderEligibleForFinalize);
            finalizeOrderBtn.disabled = !orderEligibleForFinalize;
        }
        if (activateOrderBtn) {
            activateOrderBtn.classList.toggle('hidden', !orderEligibleForActivate);
            activateOrderBtn.disabled = !orderEligibleForActivate;
        }
    }

    // Ativa OP a partir do painel da máquina (botão azul)
    async function handleActivateOrderFromPanel(event) {
        event?.preventDefault?.();

        if (!window.selectedMachineData) {
            alert('Selecione uma máquina antes de ativar a OP.');
            return;
        }

        // Se já houver ordem ativa, não fazer nada
        if (currentActiveOrder && String(currentActiveOrder.status || '').toLowerCase() === 'ativa') {
            showNotification('Esta OP já está ativa nesta máquina.', 'info');
            return;
        }

        const machineId = window.selectedMachineData.machine;
        let targetOrder = currentActiveOrder;

        // Caso não exista uma ordem resolvida no contexto, localizar pela part_code atual
        if (!targetOrder || !targetOrder.id) {
            try {
                const partCode = window.selectedMachineData.product_cod || window.selectedMachineData.product_code;
                if (partCode) {
                    const lotsSnapshot = await getDb().collection('production_orders')
                        .where('part_code', '==', String(partCode))
                        .get();

                    if (!lotsSnapshot.empty) {
                        const orders = lotsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                        const toNum = (v) => { const n = parseInt(String(v||'').replace(/\D/g,''), 10); return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY; };
                        const isOpen = (o) => !['concluida','cancelada','finalizada','encerrada'].includes(String(o.status||'').toLowerCase());
                        const sameMachine = orders.filter(o => (o.machine_id || o.machine) === machineId);
                        targetOrder = sameMachine.find(o => ['ativa','em_andamento'].includes(String(o.status||'').toLowerCase()))
                            || sameMachine.filter(isOpen).sort((a,b) => toNum(a.order_number) - toNum(b.order_number))[0]
                            || orders.filter(isOpen).sort((a,b) => toNum(a.order_number) - toNum(b.order_number))[0]
                            || orders.sort((a,b) => toNum(a.order_number) - toNum(b.order_number))[0];
                    }
                }
            } catch (error) {
                console.warn('Falha ao localizar OP para ativação:', error);
            }
        }

        if (!targetOrder || !targetOrder.id) {
            alert('Nenhuma OP elegível encontrada para ativação.');
            return;
        }

        try {
            const ok = await setOrderAsActive(targetOrder.id, machineId);
            if (!ok) {
                showNotification('Ativação cancelada ou não concluída.', 'warning');
                return;
            }

            // Atualizar status do planejamento para em_execucao
            const planId = window.selectedMachineData?.id;
            if (planId) {
                try {
                    await getDb().collection('planning').doc(planId).update({
                        status: 'em_execucao',
                        startedAt: firebase.firestore.FieldValue.serverTimestamp(),
                        startedBy: getActiveUser()?.name || 'Sistema'
                    });
                } catch (planErr) {
                    console.warn('Não foi possível atualizar o status do planejamento ao ativar a OP:', planErr);
                }
            }

            // Atualizar listas e painel
            await Promise.allSettled([
                typeof loadProductionOrders === 'function' ? loadProductionOrders() : Promise.resolve(),
                populateMachineSelector()
            ]);
            if (window.selectedMachineData?.machine) {
                await onMachineSelected(window.selectedMachineData.machine);
            }

            showNotification('OP ativada com sucesso!', 'success');
        } catch (error) {
            console.error('Erro ao ativar OP pelo painel:', error);
            alert('Erro ao ativar a OP. Tente novamente.');
        }
    }

    // Finalizar OP diretamente pelo botão do card
    async function handleCardFinalizeClick(buttonEl) {
        try {
            const orderId = buttonEl?.dataset?.orderId;
            const planId = buttonEl?.dataset?.planId;
            const card = buttonEl.closest('.machine-card');
            const machine = card?.dataset?.machine;
            if (!orderId) {
                alert('Ordem não encontrada para finalizar.');
                return;
            }

            if (typeof window.authSystem?.checkPermissionForAction === 'function') {
                const hasPermission = window.authSystem.checkPermissionForAction('close_production_order');
                if (hasPermission === false) return;
            }

            const confirmMsg = `Confirma a finalização desta OP?`;
            if (!window.confirm(confirmMsg)) return;

            const originalHtml = buttonEl.innerHTML;
            buttonEl.disabled = true;
            buttonEl.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i><span>Finalizando...</span>`;
            if (typeof lucide !== 'undefined') lucide.createIcons();

            const user = getActiveUser();
            const updatePayload = {
                status: 'concluida',
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                completedAt: firebase.firestore.FieldValue.serverTimestamp(),
                completedBy: user?.username || null,
                completedByName: user?.name || null
            };
            await getDb().collection('production_orders').doc(orderId).update(updatePayload);

            if (planId) {
                try {
                    await getDb().collection('planning').doc(planId).update({
                        status: 'concluida',
                        finishedAt: firebase.firestore.FieldValue.serverTimestamp(),
                        finishedBy: user?.name || user?.username || null
                    });
                } catch (e) {
                    console.warn('Falha ao atualizar planejamento ao finalizar pelo card:', e);
                }
            }

            // Se a OP finalizada for a ativa no painel, limpar contexto
            if (currentActiveOrder?.id === orderId) {
                currentActiveOrder = null;
                resetProductionTimer?.();
                if (productionControlPanel) productionControlPanel.classList.add('hidden');
            }

            showNotification('OP finalizada com sucesso!', 'success');

            // Recarregar cartões e, se a mesma máquina estiver selecionada, recarregar painel
            await populateMachineSelector();
            if (machine) {
                const stillSelected = window.selectedMachineData?.machine === machine;
                if (stillSelected) await onMachineSelected(machine);
            }
        } catch (err) {
            console.error('Erro ao finalizar OP pelo card:', err);
            alert('Erro ao finalizar OP. Tente novamente.');
        } finally {
            if (buttonEl) {
                buttonEl.disabled = false;
                buttonEl.classList.add('hidden');
            }
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
    }

    // Ativar próxima OP diretamente pelo botão do card
    async function handleCardActivateNextClick(buttonEl) {
        const card = buttonEl.closest('.machine-card');
        const machine = buttonEl?.dataset?.machine || card?.dataset?.machine;
        if (!machine) {
            alert('Máquina não identificada para ativar próxima OP.');
            return;
        }

        const originalHtml = buttonEl.innerHTML;
        buttonEl.disabled = true;
        buttonEl.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i><span>Ativando...</span>`;
        if (typeof lucide !== 'undefined') lucide.createIcons();

        try {
            // Seleciona a máquina para garantir contexto e reaproveitar a lógica de ativação do painel
            await onMachineSelected(machine);
            await handleActivateOrderFromPanel();

            // Recarregar cards e painel
            await populateMachineSelector();
            await onMachineSelected(machine);
        } catch (err) {
            console.error('Erro ao ativar próxima OP pelo card:', err);
            alert('Erro ao ativar próxima OP. Tente novamente.');
        } finally {
            buttonEl.disabled = false;
            buttonEl.innerHTML = originalHtml;
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
    }

    // Função de debounce para otimizar redimensionamento
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Função para lidar com redimensionamento da janela
    function handleWindowResize() {
        const chartInstances = [];

        if (typeof Chart !== 'undefined' && Chart.instances) {
            if (Array.isArray(Chart.instances)) {
                chartInstances.push(...Chart.instances);
            } else if (Chart.instances instanceof Map) {
                chartInstances.push(...Chart.instances.values());
            } else {
                chartInstances.push(...Object.values(Chart.instances));
            }
        }

        chartInstances.forEach(chart => {
            if (chart && typeof chart.resize === 'function') {
                chart.resize();
            }
        });

        // Recarregar dados da aba ativa se necessário
        const activeTab = document.querySelector('.nav-btn.active');
        if (activeTab) {
            const activePage = activeTab.getAttribute('data-page');
            
            // Só recarregar se for uma aba com gráficos e se houve mudança significativa no tamanho
            if (['analise', 'lancamento'].includes(activePage)) {
                // Verificar se mudou entre breakpoints importantes (mobile/desktop)
                const wasMobile = typeof window.previousWidth === 'number' ? window.previousWidth < 768 : window.innerWidth < 768;
                const isMobile = window.innerWidth < 768;
                
                if (wasMobile !== isMobile) {
                    // Recarregar gráficos com novas configurações responsivas
                    setTimeout(() => {
                        if (activePage === 'analise') {
                            loadAnalysisData();
                        } else if (activePage === 'lancamento') {
                            loadLaunchPanel();
                        }
                    }, 100);
                }
            }
        }
        
        // Salvar largura atual para comparação futura
        window.previousWidth = window.innerWidth;
    }

    // Função para atualizar timeline apenas se estiver visível
    async function updateTimelineIfVisible() {
        // Otimização: Não atualizar se a aba do navegador não estiver visível
        if (!isPageVisible()) {
            return;
        }
        
        const timelineElement = document.getElementById('timeline-progress');
        if (!timelineElement || timelineElement.offsetParent === null) {
            return; // Timeline não está visível
        }

        // Recarregar dados de produção atuais
        try {
            if (!window.selectedMachineData) {
                updateTimelineProgress(0, 0, 0);
                return;
            }

            const today = new Date().toISOString().split('T')[0];
            const productionData = await getFilteredData('production', today, today, window.selectedMachineData.machine || 'all');

            const totalExecuted = productionData.reduce((sum, item) => sum + (item.quantity || 0), 0);
            const totalPlanned = Number(window.selectedMachineData.planned_quantity) || 0;
            const hourlyTarget = totalPlanned / HOURS_IN_PRODUCTION_DAY;
            const hoursElapsed = getHoursElapsedInProductionDay(new Date());
            const expectedByNow = Math.min(totalPlanned, hoursElapsed * hourlyTarget);

            updateTimelineProgress(totalExecuted, totalPlanned, expectedByNow);
        } catch (error) {
            console.warn('Erro ao atualizar timeline:', error);
        }
    }
    // Gráfico de produção por turno
    async function generateShiftProductionChart(productionData) {
        const ctx = document.getElementById('shift-production-chart');
        if (!ctx) return;

        destroyChart('shift-production-chart');

        if (productionData.length === 0) {
            showNoDataMessage('shift-production-chart');
            return;
        }
        
        clearNoDataMessage('shift-production-chart');

        const shiftData = [0, 0, 0]; // 1º, 2º, 3º Turno
        const shiftLabels = ['1º Turno', '2º Turno', '3º Turno'];

        productionData.forEach(item => {
            let s = item.shift;
            // FIX: Se shift null/undefined, inferir do datetime usando horários de turno
            if (!s && item.datetime) {
                const dt = new Date(item.datetime);
                if (!isNaN(dt.getTime())) {
                    const hhmm = dt.getHours() * 100 + dt.getMinutes();
                    if (hhmm >= 630 && hhmm < 1500) s = 1;
                    else if (hhmm >= 1500 && hhmm < 2320) s = 2;
                    else s = 3;
                }
            }
            if (s >= 1 && s <= 3) {
                shiftData[s - 1] += (Number(item.quantity) || 0);
            }
        });

        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: shiftLabels,
                datasets: [{
                    label: 'Peças',
                    data: shiftData,
                    backgroundColor: ['#10B981', '#3B82F6', '#F59E0B'],
                    borderColor: ['#047857', '#1E40AF', '#D97706'],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            font: {
                                size: window.innerWidth < 768 ? 9 : 11
                            }
                        }
                    },
                    x: {
                        ticks: {
                            font: {
                                size: window.innerWidth < 768 ? 9 : 11
                            }
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.parsed.y} pcs`;
                            }
                        }
                    }
                }
            }
        });
    }

    async function generateMachineProductionTimeline(productionData, options = {}) {
        const {
            canvas: providedCanvas = null,
            targetCanvasId = 'analysis-machine-production-timeline',
            maxMachines = 6
        } = options;

        const canvas = providedCanvas || document.getElementById(targetCanvasId);
        if (!canvas) return;
        const canvasId = canvas.id || targetCanvasId;

        if (machineProductionTimelineInstance) {
            machineProductionTimelineInstance.destroy();
            machineProductionTimelineInstance = null;
        }

        if (!Array.isArray(productionData) || productionData.length === 0) {
            showNoDataMessage(canvasId);
            return;
        }

        const dateSet = new Set();
        const totalsByMachine = new Map();
        const totalsByMachineDate = new Map();

        productionData.forEach(item => {
            const machine = (item?.machine || 'Sem máquina').toString();
            const rawDate = item?.workDay || item?.date || '';
            const dateKey = rawDate ? String(rawDate).slice(0, 10) : '';
            if (!dateKey) return;
            const quantity = Number(item?.quantity) || 0;

            dateSet.add(dateKey);
            totalsByMachine.set(machine, (totalsByMachine.get(machine) || 0) + quantity);
            const compositeKey = `${machine}__${dateKey}`;
            totalsByMachineDate.set(compositeKey, (totalsByMachineDate.get(compositeKey) || 0) + quantity);
        });

        if (dateSet.size === 0 || totalsByMachine.size === 0) {
            showNoDataMessage(canvasId);
            return;
        }

        const sortedDates = Array.from(dateSet).sort();
        const displayLabels = sortedDates.map(formatShortDateLabel);
        const machinesSorted = Array.from(totalsByMachine.entries())
            .sort((a, b) => b[1] - a[1])
            .map(entry => entry[0]);

        const machinesToPlot = machinesSorted.slice(0, Math.max(1, maxMachines));

        clearNoDataMessage(canvasId);

        const datasets = machinesToPlot.map((machine, index) => {
            const colors = ANALYSIS_LINE_COLORS[index % ANALYSIS_LINE_COLORS.length];
            const points = sortedDates.map(dateKey => totalsByMachineDate.get(`${machine}__${dateKey}`) || 0);
            return {
                label: machine,
                data: points,
                borderColor: colors.border,
                backgroundColor: colors.fill,
                tension: 0.3,
                pointRadius: 3,
                pointHoverRadius: 5,
                fill: false
            };
        });

        const context = canvas.getContext('2d');
        machineProductionTimelineInstance = new Chart(context, {
            type: 'line',
            data: {
                labels: displayLabels,
                datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: (value) => `${Number(value).toLocaleString('pt-BR')} pcs`
                        },
                        title: {
                            display: true,
                            text: 'Peças'
                        }
                    },
                    x: {
                        ticks: {
                            maxRotation: 0
                        }
                    }
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            boxWidth: 12
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const label = context.dataset?.label || '';
                                const value = Number(context.parsed.y) || 0;
                                return `${label}: ${value.toLocaleString('pt-BR')} pcs`;
                            }
                        }
                    }
                }
            }
        });
    }

    // Função para atualizar gráficos de eficiência em formato doughnut
    function updateGauge(canvasId, percentage) {
        console.log(`[GAUGE] Atualizando ${canvasId} com ${percentage}%`);
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.error(`[GAUGE] Canvas "${canvasId}" não encontrado`);
            return;
        }

        const normalizedValue = Math.max(0, Math.min(Number(percentage) || 0, 100));
        const remainingValue = Math.max(0, 100 - normalizedValue);
        const style = gaugeChartStyles[canvasId] || { color: '#0F172A' };
        let activeColor = style.color;

        if (normalizedValue < 60 && style.dangerColor) {
            activeColor = style.dangerColor;
        } else if (normalizedValue < 80 && style.warningColor) {
            activeColor = style.warningColor;
        }

        const valueElementId = canvasId.replace('-gauge', '-value');
        const valueElement = document.getElementById(valueElementId);
        if (valueElement) {
            valueElement.style.color = activeColor;
        }

        if (gaugeChartInstances[canvasId]) {
            const chart = gaugeChartInstances[canvasId];
            chart.data.datasets[0].data = [normalizedValue, remainingValue];
            chart.data.datasets[0].backgroundColor = [
                activeColor,
                'rgba(229, 231, 235, 0.45)'
            ];
            chart.update();
            return;
        }

        gaugeChartInstances[canvasId] = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels: ['Atual', 'Restante'],
                datasets: [{
                    data: [normalizedValue, remainingValue],
                    backgroundColor: [
                        activeColor,
                        'rgba(229, 231, 235, 0.45)'
                    ],
                    borderWidth: 0,
                    hoverOffset: 4,
                    borderRadius: 10
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '72%',
                rotation: -90,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        enabled: false
                    }
                },
                animation: {
                    animateRotate: true,
                    duration: 800
                }
            }
        });
    }

    function renderModernDonutChart({
        canvasId,
        labels = [],
        data = [],
        colors = DEFAULT_DONUT_COLORS,
        datasetLabel = '',
        tooltipFormatter,
        legendPosition,
        cutout = '65%'
    }) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.error(`[DONUT] Canvas "${canvasId}" não encontrado`);
            return null;
        }

        const existing = Chart.getChart(canvas);
        if (existing) existing.destroy();

        const palette = labels.map((_, index) => colors[index % colors.length]);
        const total = data.reduce((sum, value) => sum + (Number(value) || 0), 0);
        const isMobile = window.innerWidth < 768;
        const resolvedLegendPosition = legendPosition || (isMobile ? 'bottom' : 'right');

        const chart = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    label: datasetLabel,
                    data,
                    backgroundColor: palette,
                    borderWidth: 0,
                    hoverOffset: 6,
                    borderRadius: 12
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout,
                rotation: -90,
                plugins: {
                    legend: {
                        position: resolvedLegendPosition,
                        labels: {
                            usePointStyle: true,
                            padding: isMobile ? 10 : 14,
                            boxWidth: isMobile ? 10 : 12,
                            font: {
                                size: isMobile ? 10 : 12
                            }
                        }
                    },
                    tooltip: {
                        mode: 'nearest',
                        callbacks: {
                            label: tooltipFormatter || ((context) => {
                                const label = context.label || '';
                                const value = Number(context.parsed || 0);
                                if (!total) {
                                    return `${label}: ${value.toLocaleString()}`;
                                }
                                const percentage = ((value / total) * 100).toFixed(1);
                                return `${label}: ${value.toLocaleString()} (${percentage}%)`;
                            })
                        },
                        backgroundColor: '#0F172A',
                        borderColor: 'rgba(15, 23, 42, 0.2)',
                        borderWidth: 1,
                        titleFont: {
                            size: isMobile ? 11 : 12
                        },
                        bodyFont: {
                            size: isMobile ? 10 : 11
                        },
                        padding: isMobile ? 8 : 10
                    }
                },
                animation: {
                    animateRotate: true,
                    animateScale: true,
                    duration: 900,
                    easing: 'easeOutQuart'
                }
            }
        });

        return chart;
    }

    function createHourlyProductionChart({
        canvas,
        labels,
        executedPerHour,
        plannedPerHour,
        highlightCurrentHour = false
    }) {
        if (!canvas) {
            console.error('[HOUR-CHART] Canvas não encontrado para renderização.');
            return null;
        }

        const ctx = canvas.getContext('2d');
        const canvasRect = canvas.getBoundingClientRect();
        const gradientHeight = canvasRect.height || canvas.height || 320;

        const fillGradient = ctx.createLinearGradient(0, 0, 0, gradientHeight);
        fillGradient.addColorStop(0, 'rgba(16, 185, 129, 0.65)');
        fillGradient.addColorStop(1, 'rgba(16, 185, 129, 0.1)');

        const executed = executedPerHour.map(value => Number(value) || 0);
        const planned = plannedPerHour.map(value => Number(value) || 0);

        const executedCumulative = [];
        const plannedCumulative = [];
        executed.reduce((sum, value, index) => {
            const total = sum + value;
            executedCumulative[index] = total;
            return total;
        }, 0);
        planned.reduce((sum, value, index) => {
            const total = sum + value;
            plannedCumulative[index] = total;
            return total;
        }, 0);

        let highlightIndex = -1;
        if (highlightCurrentHour) {
            const highlightLabel = getProductionHourLabel();
            highlightIndex = labels.indexOf(highlightLabel);
        }

        const barBackground = (context) => {
            if (!context) return fillGradient;
            const { dataIndex } = context;
            if (dataIndex === highlightIndex) {
                return 'rgba(14, 165, 233, 0.85)';
            }
            return fillGradient;
        };

        return new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [
                    {
                        type: 'line',
                        label: 'Produção Acumulada',
                        data: executedCumulative,
                        borderColor: '#10B981',
                        borderWidth: 2,
                        fill: false,
                        tension: 0.35,
                        pointRadius: 0,
                        yAxisID: 'y1',
                        order: 1
                    },
                    {
                        type: 'line',
                        label: 'Meta Acumulada',
                        data: plannedCumulative,
                        borderColor: '#EF4444',
                        borderWidth: 2,
                        borderDash: [8, 6],
                        fill: false,
                        tension: 0.25,
                        pointRadius: 0,
                        yAxisID: 'y1',
                        order: 0
                    }
                ]
            },
            options: mergeChartOptions({
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                layout: {
                    padding: {
                        top: 8,
                        bottom: 0,
                        left: 6,
                        right: 12
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(148, 163, 184, 0.18)',
                            drawBorder: false
                        },
                        ticks: {
                            callback: (value) => `${Number(value).toLocaleString()} pcs`
                        }
                    },
                    y1: {
                        beginAtZero: true,
                        position: 'right',
                        grid: {
                            drawOnChartArea: false
                        },
                        ticks: {
                            callback: (value) => `${Number(value).toLocaleString()} pcs`
                        }
                    }
                },
                plugins: {
                    legend: {
                        position: 'top',
                        align: 'center',
                        labels: {
                            usePointStyle: true,
                            padding: 14
                        }
                    },
                    tooltip: {
                        callbacks: {
                            title: (tooltipItems) => `Hora ${tooltipItems[0].label}`,
                            label: (context) => {
                                const label = context.dataset.label || '';
                                const rawValue = context.parsed?.y ?? context.parsed ?? 0;
                                const suffix = label.includes('Acumulada') ? ' peças acumuladas' : ' peças';
                                return `${label}: ${Number(rawValue).toLocaleString()}${suffix}`;
                            }
                        }
                    }
                }
            })
        });
    }

    // Gráfico Pareto de perdas
    async function generateLossesParetoChart(lossesData) {
        const canvas = document.getElementById('losses-pareto-chart');
        if (!canvas) return;

        destroyChart('losses-pareto-chart');

        if (!Array.isArray(lossesData) || lossesData.length === 0) {
            showNoDataMessage('losses-pareto-chart');
            return;
        }

        clearNoDataMessage('losses-pareto-chart');

        const aggregated = {};
        lossesData.forEach(item => {
            const reason = item?.reason || item?.category || item?.type || 'Sem classificação';
            // Usar refugo_kg para perdas, não quantity
            const quantity = Number(item?.raw?.refugo_kg || item?.quantity || 0);
            aggregated[reason] = (aggregated[reason] || 0) + quantity;
        });

        const sortedEntries = Object.entries(aggregated).sort((a, b) => b[1] - a[1]);
        const labels = sortedEntries.map(([label]) => label);
        const values = sortedEntries.map(([, value]) => value);
        const total = values.reduce((sum, value) => sum + value, 0);

        const cumulativePercentages = [];
        values.reduce((sum, value, index) => {
            const accumulated = sum + value;
            cumulativePercentages[index] = total ? (accumulated / total) * 100 : 0;
            return accumulated;
        }, 0);

        new Chart(canvas, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    {
                        type: 'bar',
                        label: 'Perdas (kg)',
                        data: values,
                        backgroundColor: 'rgba(239, 68, 68, 0.85)',
                        borderColor: '#B91C1C',
                        borderWidth: 1,
                        yAxisID: 'y'
                    },
                    {
                        type: 'line',
                        label: '% Acumulado',
                        data: cumulativePercentages,
                        borderColor: '#0EA5E9',
                        backgroundColor: 'transparent',
                        borderWidth: 2,
                        tension: 0.3,
                        pointRadius: 3,
                        pointHoverRadius: 5,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: mergeChartOptions({
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Perdas (kg)'
                        }
                    },
                    y1: {
                        beginAtZero: true,
                        suggestedMax: 100,
                        position: 'right',
                        grid: {
                            drawOnChartArea: false
                        },
                        ticks: {
                            callback: (value) => `${value}%`
                        },
                        title: {
                            display: true,
                            text: '% Acumulado'
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                if (context.dataset.type === 'line') {
                                    return `${context.dataset.label}: ${context.parsed.y.toFixed(1)}%`;
                                }
                                return `${context.dataset.label}: ${Number(context.parsed.y).toLocaleString()} kg`;
                            }
                        }
                    }
                }
            })
        });
    }

    // Gerar gráfico de perdas por máquina
    async function generateLossesByMachineChart(lossesData) {
        const ctx = document.getElementById('losses-by-machine-chart');
        if (!ctx) return;

        destroyChart('losses-by-machine-chart');

        if (lossesData.length === 0) {
            showNoDataMessage('losses-by-machine-chart');
            return;
        }
        
        clearNoDataMessage('losses-by-machine-chart');

        const machineLosses = {};
        lossesData.forEach(item => {
            const machine = item.machine || 'Sem máquina';
            // Usar refugo_kg para perdas, não quantity
            machineLosses[machine] = (machineLosses[machine] || 0) + (item.raw?.refugo_kg || item.quantity || 0);
        });

        const labels = Object.keys(machineLosses);
        const data = Object.values(machineLosses);

        const isMobile = window.innerWidth < 768;

        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Perdas (kg)',
                    data: data,
                    backgroundColor: 'rgba(239, 68, 68, 0.8)',
                    borderColor: '#EF4444',
                    borderWidth: 1
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,

                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: {
                            font: {
                                size: isMobile ? 10 : 12
                            }
                        }
                    },
                    y: {
                        ticks: {
                            font: {
                                size: isMobile ? 10 : 12
                            }
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    }

    // ========== PERDAS POR PRODUTO + TOGGLE + FILTROS + RELATÓRIO ==========
    
    // Dados globais para filtros de perdas
    window._lossesAnalysisData = [];
    window._lossesFilteredData = [];
    window._lossesTraceCurrentPage = 1;
    const LOSSES_TRACE_PAGE_SIZE = 20;

    // Toggle entre gráfico Máquina / Produto
    window.toggleLossesChart = function(mode) {
        const machineWrapper = document.getElementById('losses-machine-chart-wrapper');
        const productWrapper = document.getElementById('losses-product-chart-wrapper');
        const title = document.getElementById('losses-machine-product-title');
        const subtitle = document.getElementById('losses-machine-product-subtitle');
        const toggleBtns = document.querySelectorAll('#losses-chart-toggle button');
        
        toggleBtns.forEach(btn => {
            const isActive = btn.getAttribute('data-losses-chart') === mode;
            btn.className = isActive
                ? 'px-3 py-1 text-xs font-medium rounded-md transition-all bg-white shadow text-gray-800'
                : 'px-3 py-1 text-xs font-medium rounded-md transition-all text-gray-500 hover:text-gray-700';
        });
        
        if (mode === 'machine') {
            if (machineWrapper) machineWrapper.classList.remove('hidden');
            if (productWrapper) productWrapper.classList.add('hidden');
            if (title) title.textContent = 'Refugos por Máquina';
            if (subtitle) subtitle.textContent = 'Comparativo máquinas';
        } else {
            if (machineWrapper) machineWrapper.classList.add('hidden');
            if (productWrapper) productWrapper.classList.remove('hidden');
            if (title) title.textContent = 'Refugos por Produto';
            if (subtitle) subtitle.textContent = 'Comparativo por código de produto';
        }
    };

    // Gerar gráfico de perdas por produto
    async function generateLossesByProductChart(lossesData) {
        const ctx = document.getElementById('losses-by-product-chart');
        if (!ctx) return;
        
        destroyChart('losses-by-product-chart');
        
        if (lossesData.length === 0) {
            showNoDataMessage('losses-by-product-chart');
            return;
        }
        
        clearNoDataMessage('losses-by-product-chart');
        
        // ── Construir mapa planId → product_cod a partir do planejamento ──
        // Isso permite resolver o produto de entries antigos que não salvaram product_cod
        const planProductMap = {}; // planId → { cod, name }
        try {
            const { startDate, endDate, machine, shift } = currentAnalysisFilters;
            const planData = await getFilteredData('plan', startDate, endDate, machine, shift);
            planData.forEach(plan => {
                if (!plan.id) return;
                const raw = plan.raw || {};
                const pCode = raw.part_code || raw.product_cod || raw.product_code || '';
                if (pCode && typeof getProductByCode === 'function') {
                    const info = getProductByCode(pCode);
                    if (info) {
                        planProductMap[plan.id] = { cod: String(info.cod || pCode), name: info.name || info.descricao || '' };
                    }
                }
                // Também tentar pelo campo product do planejamento (pode ser o nome ou cod)
                if (!planProductMap[plan.id] && raw.product && typeof getProductByCode === 'function') {
                    const info = getProductByCode(raw.product);
                    if (info) {
                        planProductMap[plan.id] = { cod: String(info.cod || raw.product), name: info.name || info.descricao || '' };
                    }
                }
            });
            console.log('[CHART][ByProduct] planProductMap built with', Object.keys(planProductMap).length, 'entries');
        } catch (e) {
            console.warn('[CHART][ByProduct] Failed to load planData for cross-reference:', e);
        }
        
        const productLosses = {};       // cod → kg acumulado
        const productDescriptions = {}; // cod → descrição completa do produto
        
        lossesData.forEach(item => {
            const raw = item.raw || {};
            let prodCod = '';
            let prodName = '';
            let resolved = false;
            
            // 1. Tentar campo product_cod salvo diretamente no entry
            const directCode = raw.product_cod || raw.product_code || raw.cod_produto || '';
            if (directCode && typeof getProductByCode === 'function') {
                const info = getProductByCode(directCode);
                if (info) {
                    prodCod = String(info.cod || directCode);
                    prodName = info.name || info.descricao || '';
                    resolved = true;
                }
            }
            
            // 2. Tentar cross-reference pelo planId no mapa de planejamento
            if (!resolved) {
                const planId = raw.planId || raw.plan_id || '';
                if (planId && planProductMap[planId]) {
                    prodCod = planProductMap[planId].cod;
                    prodName = planProductMap[planId].name;
                    resolved = true;
                }
            }
            
            // 3. Tentar campo product/produto como código no database
            if (!resolved) {
                const altCode = raw.product || raw.produto || '';
                if (altCode && typeof getProductByCode === 'function') {
                    const info = getProductByCode(altCode);
                    if (info) {
                        prodCod = String(info.cod || altCode);
                        prodName = info.name || info.descricao || '';
                        resolved = true;
                    }
                }
            }
            
            // 4. Fallback: sem produto identificado
            if (!resolved || !prodCod) {
                prodCod = 'Sem produto';
                prodName = '';
            }
            
            const lossKg = raw.refugo_kg || item.scrapKg || item.quantity || 0;
            productLosses[prodCod] = (productLosses[prodCod] || 0) + lossKg;
            if (!productDescriptions[prodCod]) {
                productDescriptions[prodCod] = prodName;
            }
        });
        
        // Ordenar por maior perda
        const sorted = Object.entries(productLosses).sort((a, b) => b[1] - a[1]).slice(0, 15);
        // Labels do eixo Y: "COD - descrição truncada" para caber no gráfico
        const labels = sorted.map(([cod]) => {
            const desc = productDescriptions[cod];
            return desc ? `${cod} - ${desc.substring(0, 25)}` : cod;
        });
        const codes = sorted.map(s => s[0]);  // códigos puros para lookup
        const data = sorted.map(s => s[1]);
        
        const colors = [
            '#EF4444', '#F97316', '#EAB308', '#22C55E', '#06B6D4',
            '#3B82F6', '#8B5CF6', '#EC4899', '#F43F5E', '#14B8A6',
            '#A855F7', '#6366F1', '#D946EF', '#0EA5E9', '#84CC16'
        ];
        
        const isMobile = window.innerWidth < 768;
        
        // Referências para tooltip
        const _codes = codes;
        const _descriptions = productDescriptions;
        
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Perdas (kg)',
                    data: data,
                    backgroundColor: colors.slice(0, data.length).map(c => c + 'CC'),
                    borderColor: colors.slice(0, data.length),
                    borderWidth: 1
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: { font: { size: isMobile ? 10 : 12 } }
                    },
                    y: {
                        ticks: { font: { size: isMobile ? 9 : 11 } }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            title: function(tooltipItems) {
                                const idx = tooltipItems[0].dataIndex;
                                const cod = _codes[idx] || '';
                                const desc = _descriptions[cod] || '';
                                // Tooltip mostra código + descrição COMPLETA (sem truncar)
                                return desc ? `${cod} - ${desc}` : cod;
                            },
                            label: function(ctx) {
                                return `Perdas: ${ctx.parsed.x.toFixed(3)} kg`;
                            }
                        }
                    }
                }
            }
        });
    }

    // Populate reason filter dropdown
    function populateLossesReasonFilter(lossesData) {
        const select = document.getElementById('losses-filter-reason');
        if (!select) return;
        
        const reasons = new Set();
        lossesData.forEach(item => {
            const reason = item.reason || item.raw?.perdas || '';
            if (reason) reasons.add(reason);
        });
        
        // Preservar valor selecionado
        const currentVal = select.value;
        select.innerHTML = '<option value="all">Todos os motivos</option>';
        
        // Agrupar por categoria se possível
        const grouped = {};
        const ungrouped = [];
        
        reasons.forEach(reason => {
            let foundGroup = false;
            if (window.groupedLossReasons) {
                for (const [group, list] of Object.entries(window.groupedLossReasons)) {
                    if (list.includes(reason.toUpperCase()) || list.includes(reason)) {
                        if (!grouped[group]) grouped[group] = [];
                        grouped[group].push(reason);
                        foundGroup = true;
                        break;
                    }
                }
            }
            if (!foundGroup) ungrouped.push(reason);
        });
        
        // Adicionar agrupados
        for (const [group, items] of Object.entries(grouped)) {
            const optgroup = document.createElement('optgroup');
            optgroup.label = group;
            items.sort().forEach(reason => {
                const opt = document.createElement('option');
                opt.value = reason;
                opt.textContent = reason;
                optgroup.appendChild(opt);
            });
            select.appendChild(optgroup);
        }
        
        // Adicionar não agrupados
        ungrouped.sort().forEach(reason => {
            const opt = document.createElement('option');
            opt.value = reason;
            opt.textContent = reason;
            select.appendChild(opt);
        });
        
        // Restaurar seleção
        if (currentVal) select.value = currentVal;
    }

    // Aplicar filtros de rastreabilidade de perdas
    window.applyLossesFilters = function() {
        const opFilter = (document.getElementById('losses-filter-op')?.value || '').trim().toLowerCase();
        const productFilter = (document.getElementById('losses-filter-product')?.value || '').trim().toLowerCase();
        const reasonFilter = document.getElementById('losses-filter-reason')?.value || 'all';
        
        const allData = window._lossesAnalysisData || [];
        console.log('[TRACE][applyLossesFilters] Data available:', allData.length, 'items. Filters:', { opFilter, productFilter, reasonFilter });
        
        if (allData.length === 0) {
            showNotification('Nenhum dado de perdas carregado. Verifique se o período possui dados e aguarde o carregamento.', 'warning');
        }
        
        let filtered = allData.filter(item => {
            const raw = item.raw || {};
            
            // Filtro por OP - verificar campos mapeados E raw (prioridade: orderNumber)
            if (opFilter) {
                const orderNumber = (raw.orderNumber || raw.order_number || raw.orderId || raw.order_id || '').toString().toLowerCase();
                if (!orderNumber.includes(opFilter)) return false;
            }
            
            // Filtro por produto - verificar campos mapeados E raw
            if (productFilter) {
                const mp = (item.mp || raw.mp || item.product || raw.product || raw.produto || raw.product_cod || raw.cod_produto || '').toString().toLowerCase();
                const tipoMP = (raw.tipoMateriaPrima || '').toLowerCase();
                if (!mp.includes(productFilter) && !tipoMP.includes(productFilter)) return false;
            }
            
            // Filtro por motivo
            if (reasonFilter !== 'all') {
                const reason = (item.reason || raw.perdas || '').toString();
                if (reason !== reasonFilter) return false;
            }
            
            return true;
        });
        
        console.log('[TRACE][applyLossesFilters] Filtered results:', filtered.length);
        
        window._lossesFilteredData = filtered;
        window._lossesTraceCurrentPage = 1;
        
        // Mostrar seção de resultados
        const section = document.getElementById('losses-traceability-section');
        if (section) section.classList.remove('hidden');
        
        // Atualizar info
        const infoEl = document.getElementById('losses-filter-results-info');
        if (infoEl) infoEl.textContent = `${filtered.length} registros encontrados`;
        
        // Atualizar tags de filtros ativos
        updateActiveFilterTags(opFilter, productFilter, reasonFilter);
        
        // Renderizar tabela
        renderLossesTraceTable();
        
        // Scroll para a tabela
        if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    // Limpar filtros
    window.clearLossesFilters = function() {
        const opInput = document.getElementById('losses-filter-op');
        const productInput = document.getElementById('losses-filter-product');
        const reasonSelect = document.getElementById('losses-filter-reason');
        
        if (opInput) opInput.value = '';
        if (productInput) productInput.value = '';
        if (reasonSelect) reasonSelect.value = 'all';
        
        window._lossesFilteredData = [];
        window._lossesTraceCurrentPage = 1;
        
        const section = document.getElementById('losses-traceability-section');
        if (section) section.classList.add('hidden');
        
        const tagsContainer = document.getElementById('losses-active-filters');
        if (tagsContainer) tagsContainer.classList.add('hidden');
    };

    // Atualizar tags visuais dos filtros ativos
    function updateActiveFilterTags(opFilter, productFilter, reasonFilter) {
        const container = document.getElementById('losses-active-filters');
        if (!container) return;
        
        container.innerHTML = '<span class="text-xs text-gray-500">Filtros ativos:</span>';
        let hasFilters = false;
        
        if (opFilter) {
            hasFilters = true;
            container.innerHTML += `<span class="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">OP: ${opFilter}</span>`;
        }
        if (productFilter) {
            hasFilters = true;
            container.innerHTML += `<span class="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">Produto: ${productFilter}</span>`;
        }
        if (reasonFilter !== 'all') {
            hasFilters = true;
            container.innerHTML += `<span class="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium">Motivo: ${reasonFilter}</span>`;
        }
        
        container.classList.toggle('hidden', !hasFilters);
    }

    // Renderizar tabela de rastreabilidade paginada
    function renderLossesTraceTable() {
        const tbody = document.getElementById('losses-traceability-tbody');
        if (!tbody) return;
        
        const data = window._lossesFilteredData || [];
        const page = window._lossesTraceCurrentPage || 1;
        const start = (page - 1) * LOSSES_TRACE_PAGE_SIZE;
        const end = Math.min(start + LOSSES_TRACE_PAGE_SIZE, data.length);
        const pageData = data.slice(start, end);
        
        if (pageData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="px-4 py-6 text-center text-gray-400 text-sm">Nenhum registro encontrado com os filtros aplicados</td></tr>';
        } else {
            tbody.innerHTML = pageData.map(item => {
                const raw = item.raw || {};
                const date = item.date || raw.data || '-';
                const machine = item.machine || '-';
                const orderId = raw.orderNumber || raw.order_number || '-';
                const mp = raw.mp || raw.product || raw.produto || '-';
                let productLabel = mp;
                if (mp && mp !== '-') {
                    if (typeof getProductByCode === 'function') {
                        const prodInfo = getProductByCode(mp);
                        if (prodInfo) productLabel = `${prodInfo.cod || mp} - ${(prodInfo.name || prodInfo.descricao || '').substring(0, 20)}`;
                    } else if (typeof getDescricaoMP === 'function') {
                        const desc = getDescricaoMP(mp);
                        if (desc && desc !== mp) productLabel = `${mp} - ${desc.substring(0, 20)}`;
                    }
                }
                const reason = item.reason || raw.perdas || '-';
                const qty = item.scrapPcs || item.quantity || 0;
                const kg = (item.scrapKg || raw.refugo_kg || 0).toFixed(3);
                const turno = item.shift || raw.turno || '-';
                
                return `<tr class="hover:bg-indigo-50/50 transition">
                    <td class="px-3 py-2 text-xs text-gray-700">${date}</td>
                    <td class="px-3 py-2 text-xs font-medium text-gray-800">${machine}</td>
                    <td class="px-3 py-2 text-xs text-gray-600 max-w-[100px] truncate" title="${orderId}">${orderId}</td>
                    <td class="px-3 py-2 text-xs text-gray-600 max-w-[150px] truncate" title="${productLabel}">${productLabel}</td>
                    <td class="px-3 py-2 text-xs text-gray-600 max-w-[120px] truncate" title="${reason}">${reason}</td>
                    <td class="px-3 py-2 text-xs text-center font-medium text-red-600">${qty}</td>
                    <td class="px-3 py-2 text-xs text-center font-medium text-red-600">${kg}</td>
                    <td class="px-3 py-2 text-xs text-center"><span class="px-1.5 py-0.5 bg-gray-100 rounded text-gray-700 font-medium">T${turno}</span></td>
                </tr>`;
            }).join('');
        }
        
        // Atualizar paginação
        const showingEl = document.getElementById('losses-trace-showing');
        const totalEl = document.getElementById('losses-trace-total');
        const pageEl = document.getElementById('losses-trace-page');
        const prevBtn = document.getElementById('losses-trace-prev');
        const nextBtn = document.getElementById('losses-trace-next');
        
        if (showingEl) showingEl.textContent = pageData.length;
        if (totalEl) totalEl.textContent = data.length;
        if (pageEl) pageEl.textContent = `Página ${page}`;
        
        const totalPages = Math.ceil(data.length / LOSSES_TRACE_PAGE_SIZE) || 1;
        if (prevBtn) prevBtn.disabled = page <= 1;
        if (nextBtn) nextBtn.disabled = page >= totalPages;
    }

    // Mudança de página na tabela de rastreabilidade
    window.lossesTracePageChange = function(dir) {
        const data = window._lossesFilteredData || [];
        const totalPages = Math.ceil(data.length / LOSSES_TRACE_PAGE_SIZE) || 1;
        window._lossesTraceCurrentPage = Math.max(1, Math.min(totalPages, (window._lossesTraceCurrentPage || 1) + dir));
        renderLossesTraceTable();
    };

    // Exportar dados filtrados para CSV
    window.exportFilteredLosses = function() {
        const data = window._lossesFilteredData || [];
        if (data.length === 0) {
            showNotification('Nenhum dado para exportar. Aplique filtros primeiro.', 'warning');
            return;
        }
        
        const headers = ['Data', 'Máquina', 'OP', 'Produto', 'Motivo', 'Qtd (pçs)', 'Peso (kg)', 'Turno', 'Observações'];
        const rows = data.map(item => {
            const raw = item.raw || {};
            return [
                item.date || raw.data || '',
                item.machine || '',
                raw.orderNumber || raw.order_number || '',
                raw.mp || raw.product || '',
                item.reason || raw.perdas || '',
                item.scrapPcs || item.quantity || 0,
                (item.scrapKg || raw.refugo_kg || 0).toFixed(3),
                item.shift || raw.turno || '',
                (raw.observacoes || '').replace(/[;\n\r]/g, ' ')
            ];
        });
        
        const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `perdas_filtradas_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        URL.revokeObjectURL(url);
        
        showNotification(`✅ ${data.length} registros exportados com sucesso!`, 'success');
    };

    // Gerar relatório detalhado de perdas
    // MELHORADO: Agora aceita parâmetros de data e busca dados diretamente
    window.generateLossesReport = async function(startDateParam, endDateParam) {
        // Usar datas do parâmetro ou do filtro global ou data atual
        const today = getProductionDateString();
        const startDate = startDateParam || currentAnalysisFilters?.startDate || today;
        const endDate = endDateParam || currentAnalysisFilters?.endDate || startDate;
        const machine = currentAnalysisFilters?.machine || 'all';
        const shift = currentAnalysisFilters?.shift || 'all';
        
        if (!startDate) {
            showNotification('Selecione uma data para gerar o relatório.', 'warning');
            return;
        }
        
        showNotification('⏳ Gerando relatório de perdas...', 'info');
        
        let allData = window._lossesAnalysisData || [];
        
        // Se datas foram fornecidas, buscar dados diretamente do Firebase COM cache
        if (startDateParam || endDateParam) {
            try {
                const rawDocs = await cachedInlineQuery(`losses_${startDate}_${endDate}`, () => {
                    let query = getDb().collection('production_entries')
                        .where('entryType', '==', 'losses');
                    if (startDate === endDate) {
                        query = query.where('data', '==', startDate);
                    } else {
                        query = query.where('data', '>=', startDate).where('data', '<=', endDate);
                    }
                    return query.get();
                });
                allData = rawDocs.map(data => {
                    return {
                        id: data.id,
                        date: data.data,
                        machine: data.machine,
                        shift: data.turno,
                        reason: data.perdas || data.reason,
                        scrapPcs: data.produzido || data.quantidade || 0,
                        scrapKg: data.refugo_kg || 0,
                        quantity: data.produzido || data.quantidade || 0,
                        raw: data
                    };
                });
                
                // Aplicar filtros de máquina e turno
                if (machine && machine !== 'all') {
                    allData = allData.filter(d => d.machine === machine);
                }
                if (shift && shift !== 'all') {
                    allData = allData.filter(d => String(d.shift) === String(shift));
                }
            } catch (error) {
                console.error('Erro ao buscar dados de perdas:', error);
                showNotification('Erro ao buscar dados. Tente novamente.', 'error');
                return;
            }
        }
        
        if (allData.length === 0) {
            showNotification('Nenhum dado de perdas para o período selecionado.', 'warning');
            return;
        }
        
        // Calcular estatísticas
        let totalPcs = 0, totalKg = 0;
        const byMachine = {}, byReason = {}, byProduct = {}, byShift = {}, byDate = {};
        
        allData.forEach(item => {
            const raw = item.raw || {};
            const pcs = item.scrapPcs || item.quantity || 0;
            const kg = item.scrapKg || raw.refugo_kg || 0;
            const machineId = item.machine || 'N/A';
            const reason = item.reason || raw.perdas || 'N/A';
            const mp = raw.mp || raw.product || 'N/A';
            const shiftVal = item.shift || raw.turno || 'N/A';
            const date = item.date || raw.data || 'N/A';
            
            totalPcs += pcs;
            totalKg += kg;
            
            if (!byMachine[machineId]) byMachine[machineId] = { pcs: 0, kg: 0, count: 0 };
            byMachine[machineId].pcs += pcs;
            byMachine[machineId].kg += kg;
            byMachine[machineId].count++;
            
            if (!byReason[reason]) byReason[reason] = { pcs: 0, kg: 0, count: 0 };
            byReason[reason].pcs += pcs;
            byReason[reason].kg += kg;
            byReason[reason].count++;
            
            if (!byProduct[mp]) byProduct[mp] = { pcs: 0, kg: 0, count: 0 };
            byProduct[mp].pcs += pcs;
            byProduct[mp].kg += kg;
            byProduct[mp].count++;
            
            if (!byShift[shiftVal]) byShift[shiftVal] = { pcs: 0, kg: 0, count: 0 };
            byShift[shiftVal].pcs += pcs;
            byShift[shiftVal].kg += kg;
            byShift[shiftVal].count++;
            
            if (!byDate[date]) byDate[date] = { pcs: 0, kg: 0, count: 0 };
            byDate[date].pcs += pcs;
            byDate[date].kg += kg;
            byDate[date].count++;
        });
        
        // Ordenar
        const sortedMachines = Object.entries(byMachine).sort((a, b) => b[1].kg - a[1].kg);
        const sortedReasons = Object.entries(byReason).sort((a, b) => b[1].kg - a[1].kg);
        const sortedProducts = Object.entries(byProduct).sort((a, b) => b[1].kg - a[1].kg);
        const sortedDates = Object.entries(byDate).sort((a, b) => a[0].localeCompare(b[0]));
        
        // Gerar HTML do relatório
        const reportWindow = window.open('', '_blank');
        if (!reportWindow) {
            showNotification('Popup bloqueado. Permita popups para gerar o relatório.', 'warning');
            return;
        }
        
        reportWindow.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>Relatório de Perdas - HokkaidoMES</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, sans-serif; color: #333; padding: 30px; background: #f8f9fa; }
        .report-header { background: linear-gradient(135deg, #dc2626, #991b1b); color: white; padding: 25px 30px; border-radius: 12px; margin-bottom: 25px; }
        .report-header h1 { font-size: 22px; margin-bottom: 5px; }
        .report-header p { opacity: 0.85; font-size: 13px; }
        .meta-info { display: flex; gap: 20px; flex-wrap: wrap; margin-top: 12px; }
        .meta-item { background: rgba(255,255,255,0.15); padding: 6px 14px; border-radius: 8px; font-size: 12px; }
        .section { background: white; border-radius: 10px; padding: 20px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
        .section h2 { font-size: 16px; color: #dc2626; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid #fee2e2; }
        .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-bottom: 20px; }
        .kpi-card { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px; text-align: center; }
        .kpi-card .value { font-size: 24px; font-weight: 700; color: #dc2626; }
        .kpi-card .label { font-size: 11px; color: #991b1b; margin-top: 4px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        thead th { background: #fef2f2; color: #991b1b; padding: 8px 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #fecaca; }
        tbody td { padding: 6px 12px; border-bottom: 1px solid #f3f4f6; }
        tbody tr:hover { background: #fff5f5; }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; }
        .badge-red { background: #fef2f2; color: #dc2626; }
        .footer { text-align: center; color: #9ca3af; font-size: 11px; margin-top: 30px; padding-top: 15px; border-top: 1px solid #e5e7eb; }
        @media print { body { padding: 15px; background: white; } .section { box-shadow: none; border: 1px solid #e5e7eb; } }
        .print-btn { position: fixed; top: 15px; right: 15px; background: #dc2626; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 13px; z-index: 100; }
        .print-btn:hover { background: #991b1b; }
        @media print { .print-btn { display: none; } }
    </style>
</head>
<body>
    <button class="print-btn" onclick="window.print()">🖨️ Imprimir</button>
    
    <div class="report-header">
        <h1>📊 Relatório Detalhado de Perdas</h1>
        <p>HokkaidoMES - Sistema de Execução da Manufatura</p>
        <div class="meta-info">
            <div class="meta-item">📅 Período: ${startDate || '-'} a ${endDate || '-'}</div>
            <div class="meta-item">🏭 Máquina: ${machine === 'all' ? 'Todas' : machine}</div>
            <div class="meta-item">⏰ Turno: ${shift === 'all' ? 'Todos' : 'T' + shift}</div>
            <div class="meta-item">📋 Gerado em: ${new Date().toLocaleString('pt-BR')}</div>
        </div>
    </div>
    
    <div class="kpi-grid">
        <div class="kpi-card"><div class="value">${allData.length}</div><div class="label">Total de Registros</div></div>
        <div class="kpi-card"><div class="value">${totalPcs.toLocaleString()}</div><div class="label">Total Peças Perdidas</div></div>
        <div class="kpi-card"><div class="value">${totalKg.toFixed(3)}</div><div class="label">Total Peso (kg)</div></div>
        <div class="kpi-card"><div class="value">${sortedReasons.length}</div><div class="label">Motivos Distintos</div></div>
        <div class="kpi-card"><div class="value">${sortedMachines.length}</div><div class="label">Máquinas Afetadas</div></div>
    </div>
    
    <div class="section">
        <h2>🏭 Perdas por Máquina</h2>
        <table>
            <thead><tr><th>Máquina</th><th class="text-right">Peças</th><th class="text-right">Peso (kg)</th><th class="text-center">Ocorrências</th><th class="text-right">% do Total</th></tr></thead>
            <tbody>
                ${sortedMachines.map(([m, v]) => `<tr><td><strong>${m}</strong></td><td class="text-right">${v.pcs.toLocaleString()}</td><td class="text-right">${v.kg.toFixed(3)}</td><td class="text-center">${v.count}</td><td class="text-right">${totalKg > 0 ? (v.kg / totalKg * 100).toFixed(1) : 0}%</td></tr>`).join('')}
            </tbody>
        </table>
    </div>
    
    <div class="section">
        <h2>⚠️ Perdas por Motivo</h2>
        <table>
            <thead><tr><th>Motivo</th><th class="text-right">Peças</th><th class="text-right">Peso (kg)</th><th class="text-center">Ocorrências</th><th class="text-right">% do Total</th></tr></thead>
            <tbody>
                ${sortedReasons.map(([r, v]) => `<tr><td>${r}</td><td class="text-right">${v.pcs.toLocaleString()}</td><td class="text-right">${v.kg.toFixed(3)}</td><td class="text-center">${v.count}</td><td class="text-right">${totalKg > 0 ? (v.kg / totalKg * 100).toFixed(1) : 0}%</td></tr>`).join('')}
            </tbody>
        </table>
    </div>
    
    <div class="section">
        <h2>📦 Perdas por Produto / MP</h2>
        <table>
            <thead><tr><th>Produto / MP</th><th class="text-right">Peças</th><th class="text-right">Peso (kg)</th><th class="text-center">Ocorrências</th><th class="text-right">% do Total</th></tr></thead>
            <tbody>
                ${sortedProducts.map(([p, v]) => {
                    let label = p;
                    if (p && p !== 'N/A' && typeof getDescricaoMP === 'function') {
                        const desc = getDescricaoMP(p);
                        if (desc && desc !== p) label = p + ' - ' + desc;
                    }
                    return `<tr><td>${label}</td><td class="text-right">${v.pcs.toLocaleString()}</td><td class="text-right">${v.kg.toFixed(3)}</td><td class="text-center">${v.count}</td><td class="text-right">${totalKg > 0 ? (v.kg / totalKg * 100).toFixed(1) : 0}%</td></tr>`;
                }).join('')}
            </tbody>
        </table>
    </div>
    
    <div class="section">
        <h2>📅 Evolução Diária</h2>
        <table>
            <thead><tr><th>Data</th><th class="text-right">Peças</th><th class="text-right">Peso (kg)</th><th class="text-center">Ocorrências</th></tr></thead>
            <tbody>
                ${sortedDates.map(([d, v]) => `<tr><td>${d}</td><td class="text-right">${v.pcs.toLocaleString()}</td><td class="text-right">${v.kg.toFixed(3)}</td><td class="text-center">${v.count}</td></tr>`).join('')}
            </tbody>
        </table>
    </div>
    
    <div class="section">
        <h2>⏰ Perdas por Turno</h2>
        <table>
            <thead><tr><th>Turno</th><th class="text-right">Peças</th><th class="text-right">Peso (kg)</th><th class="text-center">Ocorrências</th></tr></thead>
            <tbody>
                ${Object.entries(byShift).sort((a, b) => String(a[0]).localeCompare(String(b[0]))).map(([s, v]) => `<tr><td>Turno ${s}</td><td class="text-right">${v.pcs.toLocaleString()}</td><td class="text-right">${v.kg.toFixed(3)}</td><td class="text-center">${v.count}</td></tr>`).join('')}
            </tbody>
        </table>
    </div>
    
    <div class="section">
        <h2>📋 Listagem Completa (${allData.length} registros)</h2>
        <div style="overflow-x:auto;">
        <table>
            <thead><tr><th>Data</th><th>Máquina</th><th>OP</th><th>Produto</th><th>Motivo</th><th class="text-right">Qtd</th><th class="text-right">Peso (kg)</th><th class="text-center">Turno</th></tr></thead>
            <tbody>
                ${allData.slice(0, 500).map(item => {
                    const raw = item.raw || {};
                    return `<tr>
                        <td>${item.date || raw.data || '-'}</td>
                        <td>${item.machine || '-'}</td>
                        <td>${raw.orderNumber || raw.order_number || '-'}</td>
                        <td>${raw.mp || raw.product || '-'}</td>
                        <td>${item.reason || raw.perdas || '-'}</td>
                        <td class="text-right">${(item.scrapPcs || item.quantity || 0).toLocaleString()}</td>
                        <td class="text-right">${(item.scrapKg || raw.refugo_kg || 0).toFixed(3)}</td>
                        <td class="text-center">T${item.shift || raw.turno || '-'}</td>
                    </tr>`;
                }).join('')}
                ${allData.length > 500 ? `<tr><td colspan="8" style="text-align:center;color:#9ca3af;padding:12px;">... e mais ${allData.length - 500} registros (exportar CSV para ver todos)</td></tr>` : ''}
            </tbody>
        </table>
        </div>
    </div>
    
    <div class="footer">
        <p>HokkaidoMES &copy; ${new Date().getFullYear()} - Relatório gerado automaticamente</p>
    </div>
</body>
</html>`);
        reportWindow.document.close();
        
        showNotification('📊 Relatório gerado em nova aba!', 'success');
    };

    // ========== MÓDULO RELATÓRIOS (ABA RELATÓRIOS) - REMOVIDO 02/2026 ==========
    // Subaba Relatórios removida por otimização. Viabilidade será analisada futuramente.
    // Funções stub para evitar erros caso algum código antigo faça referência:
    window.loadReportsView = function() { console.log('[REPORTS] Módulo desabilitado'); };
    window.selectReportType = function() { console.log('[REPORTS] Módulo desabilitado'); };
    window.generateInlineReport = function() { console.log('[REPORTS] Módulo desabilitado'); };
    window.exportReportToPDF = function() { console.log('[REPORTS] Módulo desabilitado'); };
    window.printInlineReport = function() { console.log('[REPORTS] Módulo desabilitado'); };
    window.clearInlineReport = function() { console.log('[REPORTS] Módulo desabilitado'); };
    // ========== FIM MÓDULO RELATÓRIOS (REMOVIDO) ==========
    
    /* ===== INÍCIO CÓDIGO REMOVIDO (ABA RELATÓRIOS) =====
    let currentReportType = null;
    let _inlineReportData = null;
    const reportTypeConfig = {
        quantitativo: { color: '#10B981', colorDark: '#059669', title: 'Relatório Quantitativo de Produção', icon: 'factory' },
        eficiencia: { color: '#8B5CF6', colorDark: '#7C3AED', title: 'Relatório de Eficiência (OEE)', icon: 'gauge' },
        paradas: { color: '#F97316', colorDark: '#EA580C', title: 'Relatório de Paradas', icon: 'timer-off' },
        perdas: { color: '#EF4444', colorDark: '#DC2626', title: 'Relatório de Perdas', icon: 'alert-triangle' },
        borra: { color: '#F59E0B', colorDark: '#D97706', title: 'Relatório de Borra e Sucata', icon: 'trash-2' },
        consolidado: { color: '#2563EB', colorDark: '#1D4ED8', title: 'Relatório Consolidado Executivo', icon: 'layout-dashboard' }
    };
    
    // Carregar aba de relatórios - inicializar filtros e popular máquinas
    async function loadReportsView() {
        const today = getProductionDateString();
        
        // Inicializar campos de data
        const startInput = document.getElementById('report-filter-start');
        const endInput = document.getElementById('report-filter-end');
        if (startInput && !startInput.value) startInput.value = today;
        if (endInput && !endInput.value) endInput.value = today;
        
        // Popular seletor de máquinas
        const machineSelect = document.getElementById('report-filter-machine');
        if (machineSelect) {
            // Limpar e repopular sempre para garantir que as máquinas estejam presentes
            machineSelect.innerHTML = '<option value="all">Todas as máquinas</option>';
            
            // Lista de máquinas válidas (fonte confiável)
            const validMachines = ['H01', 'H02', 'H03', 'H04', 'H05', 'H06', 'H07', 'H08', 'H09', 'H10', 
                                   'H11', 'H21', 'H22', 'H23', 'H24', 'H25', 'H26', 'H27', 'H28', 'H29', 'H30', 
                                   'H31', 'H32', 'H33', 'H34', 'H35', 'H42', 'H43', 'H44', 'H45'];
            
            validMachines.forEach(m => {
                const opt = document.createElement('option');
                opt.value = m;
                opt.textContent = m;
                machineSelect.appendChild(opt);
            });
            
            console.log('[REPORTS] Máquinas carregadas:', validMachines.length);
        }
        
        // Limpar campo de OP
        const orderInput = document.getElementById('report-filter-order');
        if (orderInput) orderInput.value = '';
        
        // Resetar estado
        currentReportType = null;
        _inlineReportData = null;
        
        // Mostrar placeholder
        document.getElementById('report-placeholder')?.classList.remove('hidden');
        document.getElementById('report-content-container')?.classList.add('hidden');
        document.getElementById('report-action-buttons')?.classList.add('hidden');
        document.getElementById('btn-generate-report')?.setAttribute('disabled', 'true');
        
        // Limpar seleção de tipo
        document.querySelectorAll('.report-type-btn').forEach(btn => {
            btn.classList.remove('ring-2', 'border-primary-blue', 'bg-blue-50');
        });
        
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
    window.loadReportsView = loadReportsView;
    
    // Selecionar tipo de relatório
    window.selectReportType = function(type) {
        currentReportType = type;
        
        // Atualizar visual dos botões
        document.querySelectorAll('.report-type-btn').forEach(btn => {
            btn.classList.remove('ring-2', 'border-primary-blue', 'bg-blue-50');
            if (btn.getAttribute('data-report-type') === type) {
                btn.classList.add('ring-2', 'ring-primary-blue', 'border-primary-blue', 'bg-blue-50');
            }
        });
        
        // Habilitar botão de gerar
        const generateBtn = document.getElementById('btn-generate-report');
        if (generateBtn) generateBtn.removeAttribute('disabled');
        
        console.log('[REPORTS] Tipo selecionado:', type);
    };
    
    // Obter filtros atuais
    function getReportFilters() {
        const orderValue = document.getElementById('report-filter-order')?.value?.trim() || '';
        return {
            startDate: document.getElementById('report-filter-start')?.value || getProductionDateString(),
            endDate: document.getElementById('report-filter-end')?.value || getProductionDateString(),
            machine: document.getElementById('report-filter-machine')?.value || 'all',
            shift: document.getElementById('report-filter-shift')?.value || 'all',
            order: orderValue // Texto livre - número da OP ou vazio para todas
        };
    }
    
    // Gerar relatório inline
    window.generateInlineReport = async function() {
        if (!currentReportType) {
            showNotification('Selecione um tipo de relatório primeiro.', 'warning');
            return;
        }
        
        const filters = getReportFilters();
        console.log('[REPORTS] Gerando relatório:', currentReportType, filters);
        
        // Mostrar loading
        document.getElementById('report-placeholder')?.classList.add('hidden');
        document.getElementById('report-content-container')?.classList.add('hidden');
        document.getElementById('report-loading')?.classList.remove('hidden');
        
        try {
            let reportHTML = '';
            
            switch (currentReportType) {
                case 'quantitativo':
                    reportHTML = await generateInlineQuantitativo(filters);
                    break;
                case 'eficiencia':
                    reportHTML = await generateInlineEficiencia(filters);
                    break;
                case 'paradas':
                    reportHTML = await generateInlineParadas(filters);
                    break;
                case 'perdas':
                    reportHTML = await generateInlinePerdas(filters);
                    break;
                case 'borra':
                    reportHTML = await generateInlineBorra(filters);
                    break;
                case 'consolidado':
                    reportHTML = await generateInlineConsolidado(filters);
                    break;
                default:
                    throw new Error('Tipo de relatório não suportado');
            }
            
            // Esconder loading, mostrar conteúdo
            document.getElementById('report-loading')?.classList.add('hidden');
            
            const contentContainer = document.getElementById('report-content-container');
            const content = document.getElementById('report-content');
            
            if (content && contentContainer) {
                content.innerHTML = reportHTML;
                contentContainer.classList.remove('hidden');
                
                // Mostrar botões de ação
                document.getElementById('report-action-buttons')?.classList.remove('hidden');
                document.getElementById('report-action-buttons')?.classList.add('flex');
            }
            
            if (typeof lucide !== 'undefined') lucide.createIcons();
            showNotification('✅ Relatório gerado com sucesso!', 'success');
            
        } catch (error) {
            console.error('[REPORTS] Erro ao gerar relatório:', error);
            document.getElementById('report-loading')?.classList.add('hidden');
            document.getElementById('report-placeholder')?.classList.remove('hidden');
            showNotification('Erro ao gerar relatório: ' + error.message, 'error');
        }
    };
    
    // Exportar relatório para PDF
    window.exportReportToPDF = function() {
        const content = document.getElementById('report-content');
        if (!content || !content.innerHTML.trim()) {
            showNotification('Nenhum relatório para exportar.', 'warning');
            return;
        }
        
        showNotification('⏳ Gerando PDF...', 'info');
        
        const config = reportTypeConfig[currentReportType] || reportTypeConfig.consolidado;
        const filters = getReportFilters();
        const filename = `${currentReportType || 'relatorio'}_${filters.startDate}_${filters.endDate}.pdf`;
        
        const opt = {
            margin: [10, 10, 10, 10],
            filename: filename,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, logging: false },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
            pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
        };
        
        html2pdf().set(opt).from(content).save().then(() => {
            showNotification('📄 PDF exportado com sucesso!', 'success');
        }).catch(err => {
            console.error('Erro ao exportar PDF:', err);
            showNotification('Erro ao exportar PDF', 'error');
        });
    };
    
    // Imprimir relatório
    window.printInlineReport = function() {
        const content = document.getElementById('report-content');
        if (!content || !content.innerHTML.trim()) {
            showNotification('Nenhum relatório para imprimir.', 'warning');
            return;
        }
        
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            showNotification('Popup bloqueado. Permita popups para imprimir.', 'warning');
            return;
        }
        
        printWindow.document.write(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Imprimir Relatório</title>
<style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', sans-serif; padding: 20px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
    th { background: #f3f4f6; font-weight: 600; }
    .report-header { margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #ddd; }
    .report-header h1 { font-size: 18px; margin-bottom: 5px; }
    .kpi-grid { display: flex; flex-wrap: wrap; gap: 10px; margin: 15px 0; }
    .kpi-card { padding: 10px 15px; border: 1px solid #ddd; border-radius: 6px; text-align: center; }
    .section { margin-top: 20px; }
    .section h2 { font-size: 14px; margin-bottom: 10px; padding-bottom: 5px; border-bottom: 1px solid #ddd; }
    @media print { body { padding: 10px; } }
</style>
</head><body>
${content.innerHTML}
<script>window.onload = function() { window.print(); window.close(); }</script>
</body></html>`);
        printWindow.document.close();
    };
    
    // Limpar relatório
    window.clearInlineReport = function() {
        document.getElementById('report-content-container')?.classList.add('hidden');
        document.getElementById('report-placeholder')?.classList.remove('hidden');
        document.getElementById('report-action-buttons')?.classList.add('hidden');
        
        const content = document.getElementById('report-content');
        if (content) content.innerHTML = '';
        
        _inlineReportData = null;
    };
    
    // ========== GERADORES DE RELATÓRIO INLINE ==========
    
    // Relatório Quantitativo Inline
    async function generateInlineQuantitativo(filters) {
        const { startDate, endDate, machine, shift, order } = filters;
        const config = reportTypeConfig.quantitativo;
        
        // OTIMIZAÇÃO: Usar cache para planning
        const allPlans = await getPlanningCached();
        let plans = allPlans.filter(isPlanActive);
        
        // Filtrar por OP se digitado (busca parcial por número da ordem)
        if (order && order.length > 0) {
            const orderSearch = order.toLowerCase();
            plans = plans.filter(p => {
                const orderNum = String(p.order_number || p.orderNumber || '').toLowerCase();
                return orderNum.includes(orderSearch);
            });
        }
        
        if (plans.length === 0) throw new Error('Nenhum plano ativo encontrado para os filtros aplicados');
        
        // OTIMIZADO Fase 2: executar queries em paralelo COM cache
        const [productions, downtimes] = await Promise.all([
            cachedInlineQuery(`prod_${startDate}_${endDate}`, () =>
                getDb().collection('production_entries').where('data', '>=', startDate).where('data', '<=', endDate).get()),
            cachedInlineQuery(`down_${startDate}_${endDate}`, () =>
                getDb().collection('downtime_entries').where('date', '>=', startDate).where('date', '<=', endDate).get())
        ]);
        
        // Processar dados
        let reportData = processResumoData(plans, productions, downtimes);
        
        if (machine !== 'all') reportData = reportData.filter(r => r.machine === machine);
        if (shift !== 'all') {
            const shiftKey = 'T' + shift;
            reportData = reportData.filter(r => r[shiftKey] && r[shiftKey].produzido > 0);
        }
        
        if (reportData.length === 0) throw new Error('Nenhum dado encontrado para os filtros selecionados');
        
        // Obter label da OP se filtrada
        const orderLabel = order && order.length > 0 ? order : null;
        
        // Totais
        let totalPlanejado = 0, totalProduzido = 0, totalRefugo = 0;
        reportData.forEach(item => {
            totalPlanejado += coerceToNumber(item.planned_quantity, 0);
            totalProduzido += coerceToNumber(item.total_produzido, 0);
            totalRefugo += (item.T1.refugo_kg || 0) + (item.T2.refugo_kg || 0) + (item.T3.refugo_kg || 0);
        });
        
        return `
        <div class="p-6" style="font-family: 'Segoe UI', sans-serif;">
            <div class="report-header" style="background: linear-gradient(135deg, ${config.color}, ${config.colorDark}); color: white; padding: 20px 25px; border-radius: 12px; margin-bottom: 20px;">
                <h1 style="font-size: 20px; margin-bottom: 5px;">📊 ${config.title}</h1>
                <p style="opacity: 0.9; font-size: 13px;">Período: ${startDate} a ${endDate} | Máquina: ${machine === 'all' ? 'Todas' : machine} | Turno: ${shift === 'all' ? 'Todos' : 'T' + shift}${orderLabel ? ` | OP: ${orderLabel}` : ''}</p>
                <p style="opacity: 0.7; font-size: 11px; margin-top: 5px;">Gerado em: ${new Date().toLocaleString('pt-BR')}</p>
            </div>
            
            <div class="kpi-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: 20px;">
                <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 15px; text-align: center;">
                    <div style="font-size: 26px; font-weight: 700; color: #16a34a;">${totalProduzido.toLocaleString('pt-BR')}</div>
                    <div style="font-size: 11px; color: #166534;">Peças Produzidas</div>
                </div>
                <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 15px; text-align: center;">
                    <div style="font-size: 26px; font-weight: 700; color: #2563eb;">${totalPlanejado.toLocaleString('pt-BR')}</div>
                    <div style="font-size: 11px; color: #1e40af;">Planejado</div>
                </div>
                <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 15px; text-align: center;">
                    <div style="font-size: 26px; font-weight: 700; color: #dc2626;">${(totalPlanejado - totalProduzido).toLocaleString('pt-BR')}</div>
                    <div style="font-size: 11px; color: #991b1b;">Faltante</div>
                </div>
                <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 15px; text-align: center;">
                    <div style="font-size: 26px; font-weight: 700; color: #ea580c;">${totalRefugo.toFixed(2)}</div>
                    <div style="font-size: 11px; color: #9a3412;">Refugo (kg)</div>
                </div>
            </div>
            
            <div class="section" style="margin-top: 20px;">
                <h2 style="font-size: 16px; color: ${config.colorDark}; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid ${config.color}40;">📋 Detalhamento por Máquina e Turno</h2>
                <div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                        <thead>
                            <tr style="background: ${config.color}15;">
                                <th rowspan="2" style="padding: 8px; border: 1px solid #ddd; text-align: left;">Máquina</th>
                                <th rowspan="2" style="padding: 8px; border: 1px solid #ddd; text-align: left;">Produto</th>
                                <th colspan="2" style="padding: 8px; border: 1px solid #ddd; text-align: center; background: #dcfce7;">Turno 1</th>
                                <th colspan="2" style="padding: 8px; border: 1px solid #ddd; text-align: center; background: #dbeafe;">Turno 2</th>
                                <th colspan="2" style="padding: 8px; border: 1px solid #ddd; text-align: center; background: #fef3c7;">Turno 3</th>
                                <th rowspan="2" style="padding: 8px; border: 1px solid #ddd; text-align: center;">Planejado</th>
                                <th rowspan="2" style="padding: 8px; border: 1px solid #ddd; text-align: center;">Total</th>
                                <th rowspan="2" style="padding: 8px; border: 1px solid #ddd; text-align: center;">Faltante</th>
                            </tr>
                            <tr>
                                <th style="padding: 6px; border: 1px solid #ddd; text-align: center; background: #dcfce7;">Prod.</th>
                                <th style="padding: 6px; border: 1px solid #ddd; text-align: center; background: #dcfce7;">Ref.(kg)</th>
                                <th style="padding: 6px; border: 1px solid #ddd; text-align: center; background: #dbeafe;">Prod.</th>
                                <th style="padding: 6px; border: 1px solid #ddd; text-align: center; background: #dbeafe;">Ref.(kg)</th>
                                <th style="padding: 6px; border: 1px solid #ddd; text-align: center; background: #fef3c7;">Prod.</th>
                                <th style="padding: 6px; border: 1px solid #ddd; text-align: center; background: #fef3c7;">Ref.(kg)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${reportData.map(item => {
                                const planned = coerceToNumber(item.planned_quantity, 0);
                                const produced = coerceToNumber(item.total_produzido, 0);
                                const faltante = planned - produced;
                                const faltanteColor = faltante > 0 ? '#dc2626' : '#16a34a';
                                return `<tr style="border-bottom: 1px solid #e5e7eb;">
                                    <td style="padding: 8px; border: 1px solid #ddd; font-weight: 600;">${item.machine || '-'}</td>
                                    <td style="padding: 8px; border: 1px solid #ddd;">${item.product || '-'}</td>
                                    <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${(item.T1.produzido || 0).toLocaleString('pt-BR')}</td>
                                    <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${(item.T1.refugo_kg || 0).toFixed(2)}</td>
                                    <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${(item.T2.produzido || 0).toLocaleString('pt-BR')}</td>
                                    <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${(item.T2.refugo_kg || 0).toFixed(2)}</td>
                                    <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${(item.T3.produzido || 0).toLocaleString('pt-BR')}</td>
                                    <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${(item.T3.refugo_kg || 0).toFixed(2)}</td>
                                    <td style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: 600;">${planned.toLocaleString('pt-BR')}</td>
                                    <td style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: 600;">${produced.toLocaleString('pt-BR')}</td>
                                    <td style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: 600; color: ${faltanteColor};">${faltante.toLocaleString('pt-BR')}</td>
                                </tr>`;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>`;
    }
    
    // Relatório de Eficiência Inline
    async function generateInlineEficiencia(filters) {
        const { startDate, endDate, machine, shift, order } = filters;
        const config = reportTypeConfig.eficiencia;
        
        // OTIMIZAÇÃO: Usar cache para planning
        const allPlans = await getPlanningCached();
        let plans = allPlans.filter(isPlanActive);
        
        // Filtrar por OP se digitado (busca parcial por número da ordem)
        if (order && order.length > 0) {
            const orderSearch = order.toLowerCase();
            plans = plans.filter(p => {
                const orderNum = String(p.order_number || p.orderNumber || '').toLowerCase();
                return orderNum.includes(orderSearch);
            });
        }
        
        if (plans.length === 0) throw new Error('Nenhum plano ativo encontrado para os filtros aplicados');
        
        // OTIMIZADO Fase 2: executar queries em paralelo COM cache
        const [productions, downtimes] = await Promise.all([
            cachedInlineQuery(`prod_${startDate}_${endDate}`, () =>
                getDb().collection('production_entries').where('data', '>=', startDate).where('data', '<=', endDate).get()),
            cachedInlineQuery(`down_${startDate}_${endDate}`, () =>
                getDb().collection('downtime_entries').where('date', '>=', startDate).where('date', '<=', endDate).get())
        ]);
        
        let reportData = processResumoData(plans, productions, downtimes);
        
        if (machine !== 'all') reportData = reportData.filter(r => r.machine === machine);
        
        if (reportData.length === 0) throw new Error('Nenhum dado encontrado para os filtros selecionados');
        
        // Obter label da OP se filtrada
        const orderLabel = order && order.length > 0 ? order : null;
        
        // Calcular OEE médio
        let totalOee = 0, countOee = 0;
        reportData.forEach(item => {
            [item.T1, item.T2, item.T3].forEach(t => {
                if (t.oee > 0) { totalOee += t.oee; countOee++; }
            });
        });
        const avgOee = countOee > 0 ? totalOee / countOee : 0;
        
        const formatPct = (val) => {
            const pct = (val * 100).toFixed(1);
            let color = '#16a34a';
            if (val < 0.7) color = '#dc2626';
            else if (val < 0.85) color = '#f59e0b';
            return `<span style="color: ${color}; font-weight: 600;">${pct}%</span>`;
        };
        
        return `
        <div class="p-6" style="font-family: 'Segoe UI', sans-serif;">
            <div class="report-header" style="background: linear-gradient(135deg, ${config.color}, ${config.colorDark}); color: white; padding: 20px 25px; border-radius: 12px; margin-bottom: 20px;">
                <h1 style="font-size: 20px; margin-bottom: 5px;">📊 ${config.title}</h1>
                <p style="opacity: 0.9; font-size: 13px;">Período: ${startDate} a ${endDate} | Máquina: ${machine === 'all' ? 'Todas' : machine} | Turno: ${shift === 'all' ? 'Todos' : 'T' + shift}${orderLabel ? ` | OP: ${orderLabel}` : ''}</p>
            </div>
            
            <div class="kpi-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 20px;">
                <div style="background: ${avgOee >= 0.85 ? '#f0fdf4' : avgOee >= 0.7 ? '#fffbeb' : '#fef2f2'}; border: 1px solid ${avgOee >= 0.85 ? '#bbf7d0' : avgOee >= 0.7 ? '#fde68a' : '#fecaca'}; border-radius: 8px; padding: 15px; text-align: center;">
                    <div style="font-size: 28px; font-weight: 700; color: ${avgOee >= 0.85 ? '#16a34a' : avgOee >= 0.7 ? '#d97706' : '#dc2626'};">${(avgOee * 100).toFixed(1)}%</div>
                    <div style="font-size: 11px; color: #666;">OEE Médio</div>
                </div>
                <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 15px; text-align: center;">
                    <div style="font-size: 28px; font-weight: 700; color: #2563eb;">${reportData.length}</div>
                    <div style="font-size: 11px; color: #1e40af;">Máquinas</div>
                </div>
            </div>
            
            <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px;">
                <strong style="color: #1e40af;">Legenda OEE:</strong>
                <span style="color: #16a34a; margin-left: 15px;">★ ≥85% Excelente</span>
                <span style="color: #f59e0b; margin-left: 15px;">★ 70-84% Aceitável</span>
                <span style="color: #dc2626; margin-left: 15px;">★ <70% Crítico</span>
            </div>
            
            <div class="section" style="margin-top: 20px;">
                <h2 style="font-size: 16px; color: ${config.colorDark}; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid ${config.color}40;">📋 OEE por Máquina e Turno</h2>
                <div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                        <thead>
                            <tr style="background: ${config.color}15;">
                                <th rowspan="2" style="padding: 6px; border: 1px solid #ddd; text-align: left;">Máquina</th>
                                <th colspan="4" style="padding: 6px; border: 1px solid #ddd; text-align: center; background: #dcfce7;">Turno 1</th>
                                <th colspan="4" style="padding: 6px; border: 1px solid #ddd; text-align: center; background: #dbeafe;">Turno 2</th>
                                <th colspan="4" style="padding: 6px; border: 1px solid #ddd; text-align: center; background: #fef3c7;">Turno 3</th>
                                <th rowspan="2" style="padding: 6px; border: 1px solid #ddd; text-align: center;">OEE Médio</th>
                            </tr>
                            <tr>
                                <th style="padding: 4px; border: 1px solid #ddd; background: #dcfce7; font-size: 10px;">Disp.</th>
                                <th style="padding: 4px; border: 1px solid #ddd; background: #dcfce7; font-size: 10px;">Perf.</th>
                                <th style="padding: 4px; border: 1px solid #ddd; background: #dcfce7; font-size: 10px;">Qual.</th>
                                <th style="padding: 4px; border: 1px solid #ddd; background: #dcfce7; font-size: 10px; font-weight: 700;">OEE</th>
                                <th style="padding: 4px; border: 1px solid #ddd; background: #dbeafe; font-size: 10px;">Disp.</th>
                                <th style="padding: 4px; border: 1px solid #ddd; background: #dbeafe; font-size: 10px;">Perf.</th>
                                <th style="padding: 4px; border: 1px solid #ddd; background: #dbeafe; font-size: 10px;">Qual.</th>
                                <th style="padding: 4px; border: 1px solid #ddd; background: #dbeafe; font-size: 10px; font-weight: 700;">OEE</th>
                                <th style="padding: 4px; border: 1px solid #ddd; background: #fef3c7; font-size: 10px;">Disp.</th>
                                <th style="padding: 4px; border: 1px solid #ddd; background: #fef3c7; font-size: 10px;">Perf.</th>
                                <th style="padding: 4px; border: 1px solid #ddd; background: #fef3c7; font-size: 10px;">Qual.</th>
                                <th style="padding: 4px; border: 1px solid #ddd; background: #fef3c7; font-size: 10px; font-weight: 700;">OEE</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${reportData.map(item => {
                                const oeeVals = [item.T1.oee, item.T2.oee, item.T3.oee].filter(v => v > 0);
                                const itemAvg = oeeVals.length > 0 ? oeeVals.reduce((a,b) => a + b, 0) / oeeVals.length : 0;
                                return `<tr>
                                    <td style="padding: 6px; border: 1px solid #ddd; font-weight: 600;">${item.machine || '-'}</td>
                                    <td style="padding: 4px; border: 1px solid #ddd; text-align: center;">${formatPct(item.T1.disponibilidade || 0)}</td>
                                    <td style="padding: 4px; border: 1px solid #ddd; text-align: center;">${formatPct(item.T1.performance || 0)}</td>
                                    <td style="padding: 4px; border: 1px solid #ddd; text-align: center;">${formatPct(item.T1.qualidade || 0)}</td>
                                    <td style="padding: 4px; border: 1px solid #ddd; text-align: center; font-weight: 700;">${formatPct(item.T1.oee || 0)}</td>
                                    <td style="padding: 4px; border: 1px solid #ddd; text-align: center;">${formatPct(item.T2.disponibilidade || 0)}</td>
                                    <td style="padding: 4px; border: 1px solid #ddd; text-align: center;">${formatPct(item.T2.performance || 0)}</td>
                                    <td style="padding: 4px; border: 1px solid #ddd; text-align: center;">${formatPct(item.T2.qualidade || 0)}</td>
                                    <td style="padding: 4px; border: 1px solid #ddd; text-align: center; font-weight: 700;">${formatPct(item.T2.oee || 0)}</td>
                                    <td style="padding: 4px; border: 1px solid #ddd; text-align: center;">${formatPct(item.T3.disponibilidade || 0)}</td>
                                    <td style="padding: 4px; border: 1px solid #ddd; text-align: center;">${formatPct(item.T3.performance || 0)}</td>
                                    <td style="padding: 4px; border: 1px solid #ddd; text-align: center;">${formatPct(item.T3.qualidade || 0)}</td>
                                    <td style="padding: 4px; border: 1px solid #ddd; text-align: center; font-weight: 700;">${formatPct(item.T3.oee || 0)}</td>
                                    <td style="padding: 6px; border: 1px solid #ddd; text-align: center; font-weight: 700; font-size: 13px;">${formatPct(itemAvg)}</td>
                                </tr>`;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>`;
    }
    
    // Relatório de Paradas Inline
    async function generateInlineParadas(filters) {
        const { startDate, endDate, machine, shift, order } = filters;
        const config = reportTypeConfig.paradas;
        
        // Buscar planos se houver filtro de OP (para obter IDs correspondentes)
        let matchingPlanIds = null;
        if (order && order.length > 0) {
            // OTIMIZAÇÃO: Usar cache para planning
            const allPlans = await getPlanningCached();
            const orderSearch = order.toLowerCase();
            matchingPlanIds = allPlans
                .filter(plan => {
                    const orderNum = String(plan.order_number || plan.orderNumber || '').toLowerCase();
                    return orderNum.includes(orderSearch);
                })
                .map(plan => plan.id);
            if (matchingPlanIds.length === 0) throw new Error('Nenhuma OP encontrada com o número digitado');
        }
        
        // OTIMIZADO Fase 2: Buscar dados de paradas COM cache
        const cacheKey = startDate === endDate ? `down_${startDate}_${endDate}` : `down_${startDate}_${endDate}`;
        const rawDocs = await cachedInlineQuery(cacheKey, () => {
            let query = getDb().collection('downtime_entries');
            if (startDate === endDate) {
                query = query.where('date', '==', startDate);
            } else {
                query = query.where('date', '>=', startDate).where('date', '<=', endDate);
            }
            return query.get();
        });
        let downtimeData = rawDocs.map(data => {
            let duration = data.duration || 0;
            if (!duration && data.startTime && data.endTime && data.date) {
                const start = new Date(`${data.date}T${data.startTime}`);
                const end = new Date(`${data.date}T${data.endTime}`);
                duration = end > start ? Math.round((end - start) / 60000) : 0;
            }
            return { ...data, duration, raw: data };
        });
        
        if (machine !== 'all') downtimeData = downtimeData.filter(d => d.machine === machine);
        if (shift !== 'all') downtimeData = downtimeData.filter(d => String(d.shift) === String(shift));
        
        // Filtrar por OP se digitado (usando IDs dos planos encontrados)
        if (matchingPlanIds) {
            downtimeData = downtimeData.filter(d => matchingPlanIds.includes(d.planId) || matchingPlanIds.includes(d.order_id));
        }
        
        if (downtimeData.length === 0) throw new Error('Nenhuma parada encontrada para os filtros selecionados');
        
        // Estatísticas
        let totalMin = 0;
        const byMachine = {}, byReason = {}, byShift = {};
        
        downtimeData.forEach(item => {
            const dur = item.duration || 0;
            const machId = item.machine || 'N/A';
            const reason = item.reason || 'N/A';
            const sh = item.shift || 'N/A';
            
            totalMin += dur;
            
            if (!byMachine[machId]) byMachine[machId] = { min: 0, count: 0 };
            byMachine[machId].min += dur;
            byMachine[machId].count++;
            
            if (!byReason[reason]) byReason[reason] = { min: 0, count: 0 };
            byReason[reason].min += dur;
            byReason[reason].count++;
            
            if (!byShift[sh]) byShift[sh] = { min: 0, count: 0 };
            byShift[sh].min += dur;
            byShift[sh].count++;
        });
        
        const sortedMachines = Object.entries(byMachine).sort((a,b) => b[1].min - a[1].min);
        const sortedReasons = Object.entries(byReason).sort((a,b) => b[1].min - a[1].min);
        
        // Obter label da OP se filtrada
        const orderLabel = order && order.length > 0 ? order : null;
        
        return `
        <div class="p-6" style="font-family: 'Segoe UI', sans-serif;">
            <div class="report-header" style="background: linear-gradient(135deg, ${config.color}, ${config.colorDark}); color: white; padding: 20px 25px; border-radius: 12px; margin-bottom: 20px;">
                <h1 style="font-size: 20px; margin-bottom: 5px;">⏸ ${config.title}</h1>
                <p style="opacity: 0.9; font-size: 13px;">Período: ${startDate} a ${endDate} | Máquina: ${machine === 'all' ? 'Todas' : machine} | Turno: ${shift === 'all' ? 'Todos' : 'T' + shift}${orderLabel ? ` | OP: ${orderLabel}` : ''}</p>
            </div>
            
            <div class="kpi-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-bottom: 20px;">
                <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 15px; text-align: center;">
                    <div style="font-size: 26px; font-weight: 700; color: #ea580c;">${downtimeData.length}</div>
                    <div style="font-size: 11px; color: #9a3412;">Total Paradas</div>
                </div>
                <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 15px; text-align: center;">
                    <div style="font-size: 26px; font-weight: 700; color: #ea580c;">${(totalMin / 60).toFixed(1)}h</div>
                    <div style="font-size: 11px; color: #9a3412;">Tempo Total</div>
                </div>
                <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 15px; text-align: center;">
                    <div style="font-size: 26px; font-weight: 700; color: #ea580c;">${downtimeData.length > 0 ? (totalMin / downtimeData.length).toFixed(0) : 0}min</div>
                    <div style="font-size: 11px; color: #9a3412;">Duração Média</div>
                </div>
                <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 15px; text-align: center;">
                    <div style="font-size: 26px; font-weight: 700; color: #ea580c;">${sortedMachines.length}</div>
                    <div style="font-size: 11px; color: #9a3412;">Máquinas Afetadas</div>
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 20px;">
                <div class="section">
                    <h2 style="font-size: 15px; color: ${config.colorDark}; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid ${config.color}40;">🏭 Por Máquina</h2>
                    <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                        <thead>
                            <tr style="background: ${config.color}15;"><th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Máquina</th><th style="padding: 8px; border: 1px solid #ddd; text-align: right;">Tempo (min)</th><th style="padding: 8px; border: 1px solid #ddd; text-align: center;">Qtd</th><th style="padding: 8px; border: 1px solid #ddd; text-align: right;">%</th></tr>
                        </thead>
                        <tbody>
                            ${sortedMachines.map(([m, v]) => `<tr><td style="padding: 6px; border: 1px solid #ddd; font-weight: 600;">${m}</td><td style="padding: 6px; border: 1px solid #ddd; text-align: right;">${v.min.toFixed(0)}</td><td style="padding: 6px; border: 1px solid #ddd; text-align: center;">${v.count}</td><td style="padding: 6px; border: 1px solid #ddd; text-align: right;">${totalMin > 0 ? (v.min / totalMin * 100).toFixed(1) : 0}%</td></tr>`).join('')}
                        </tbody>
                    </table>
                </div>
                
                <div class="section">
                    <h2 style="font-size: 15px; color: ${config.colorDark}; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid ${config.color}40;">⚠️ Por Motivo</h2>
                    <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                        <thead>
                            <tr style="background: ${config.color}15;"><th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Motivo</th><th style="padding: 8px; border: 1px solid #ddd; text-align: right;">Tempo (min)</th><th style="padding: 8px; border: 1px solid #ddd; text-align: center;">Qtd</th><th style="padding: 8px; border: 1px solid #ddd; text-align: right;">%</th></tr>
                        </thead>
                        <tbody>
                            ${sortedReasons.map(([r, v]) => `<tr><td style="padding: 6px; border: 1px solid #ddd;">${r}</td><td style="padding: 6px; border: 1px solid #ddd; text-align: right;">${v.min.toFixed(0)}</td><td style="padding: 6px; border: 1px solid #ddd; text-align: center;">${v.count}</td><td style="padding: 6px; border: 1px solid #ddd; text-align: right;">${totalMin > 0 ? (v.min / totalMin * 100).toFixed(1) : 0}%</td></tr>`).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
            
            <div class="section" style="margin-top: 20px;">
                <h2 style="font-size: 15px; color: ${config.colorDark}; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid ${config.color}40;">📋 Listagem (${Math.min(downtimeData.length, 100)} de ${downtimeData.length})</h2>
                <div style="overflow-x: auto; max-height: 400px; overflow-y: auto;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                        <thead style="position: sticky; top: 0; background: white;">
                            <tr style="background: ${config.color}15;"><th style="padding: 6px; border: 1px solid #ddd;">Data</th><th style="padding: 6px; border: 1px solid #ddd;">Máquina</th><th style="padding: 6px; border: 1px solid #ddd;">Motivo</th><th style="padding: 6px; border: 1px solid #ddd; text-align: right;">Duração</th><th style="padding: 6px; border: 1px solid #ddd; text-align: center;">Turno</th><th style="padding: 6px; border: 1px solid #ddd;">Início</th><th style="padding: 6px; border: 1px solid #ddd;">Fim</th></tr>
                        </thead>
                        <tbody>
                            ${downtimeData.slice(0, 100).map(item => `<tr><td style="padding: 5px; border: 1px solid #ddd;">${item.date || '-'}</td><td style="padding: 5px; border: 1px solid #ddd;">${item.machine || '-'}</td><td style="padding: 5px; border: 1px solid #ddd;">${item.reason || '-'}</td><td style="padding: 5px; border: 1px solid #ddd; text-align: right;">${(item.duration || 0).toFixed(0)} min</td><td style="padding: 5px; border: 1px solid #ddd; text-align: center;">T${item.shift || '-'}</td><td style="padding: 5px; border: 1px solid #ddd;">${item.raw?.startTime || '-'}</td><td style="padding: 5px; border: 1px solid #ddd;">${item.raw?.endTime || '-'}</td></tr>`).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>`;
    }
    
    // Relatório de Perdas Inline
    async function generateInlinePerdas(filters) {
        const { startDate, endDate, machine, shift, order } = filters;
        const config = reportTypeConfig.perdas;
        
        // Buscar planos se houver filtro de OP (para obter IDs correspondentes)
        let matchingPlanIds = null;
        if (order && order.length > 0) {
            // OTIMIZAÇÃO: Usar cache para planning
            const allPlans = await getPlanningCached();
            const orderSearch = order.toLowerCase();
            matchingPlanIds = allPlans
                .filter(plan => {
                    const orderNum = String(plan.order_number || plan.orderNumber || '').toLowerCase();
                    return orderNum.includes(orderSearch);
                })
                .map(plan => plan.id);
            if (matchingPlanIds.length === 0) throw new Error('Nenhuma OP encontrada com o número digitado');
        }
        
        // OTIMIZADO Fase 2: Buscar perdas COM cache
        const rawDocs = await cachedInlineQuery(`losses_${startDate}_${endDate}`, () => {
            let query = getDb().collection('production_entries').where('entryType', '==', 'losses');
            if (startDate === endDate) {
                query = query.where('data', '==', startDate);
            } else {
                query = query.where('data', '>=', startDate).where('data', '<=', endDate);
            }
            return query.get();
        });
        let allData = rawDocs.map(data => {
            return {
                id: data.id,
                date: data.data,
                machine: data.machine,
                shift: data.turno,
                reason: data.perdas || data.reason,
                scrapPcs: data.produzido || data.quantidade || 0,
                scrapKg: data.refugo_kg || 0,
                planId: data.planId,
                raw: data
            };
        });
        
        if (machine !== 'all') allData = allData.filter(d => d.machine === machine);
        if (shift !== 'all') allData = allData.filter(d => String(d.shift) === String(shift));
        
        // Filtrar por OP se digitado (usando IDs dos planos encontrados)
        if (matchingPlanIds) {
            allData = allData.filter(d => matchingPlanIds.includes(d.planId));
        }
        
        if (allData.length === 0) throw new Error('Nenhuma perda encontrada para os filtros selecionados');
        
        // Estatísticas
        let totalPcs = 0, totalKg = 0;
        const byMachine = {}, byReason = {}, byShift = {};
        
        allData.forEach(item => {
            const pcs = item.scrapPcs || 0;
            const kg = item.scrapKg || 0;
            const machineId = item.machine || 'N/A';
            const reason = item.reason || 'N/A';
            const shiftVal = item.shift || 'N/A';
            
            totalPcs += pcs;
            totalKg += kg;
            
            if (!byMachine[machineId]) byMachine[machineId] = { pcs: 0, kg: 0, count: 0 };
            byMachine[machineId].pcs += pcs;
            byMachine[machineId].kg += kg;
            byMachine[machineId].count++;
            
            if (!byReason[reason]) byReason[reason] = { pcs: 0, kg: 0, count: 0 };
            byReason[reason].pcs += pcs;
            byReason[reason].kg += kg;
            byReason[reason].count++;
            
            if (!byShift[shiftVal]) byShift[shiftVal] = { pcs: 0, kg: 0, count: 0 };
            byShift[shiftVal].pcs += pcs;
            byShift[shiftVal].kg += kg;
            byShift[shiftVal].count++;
        });
        
        const sortedMachines = Object.entries(byMachine).sort((a, b) => b[1].kg - a[1].kg);
        const sortedReasons = Object.entries(byReason).sort((a, b) => b[1].kg - a[1].kg);
        
        // Obter label da OP se filtrada
        const orderLabel = order && order.length > 0 ? order : null;
        
        return `
        <div class="p-6" style="font-family: 'Segoe UI', sans-serif;">
            <div class="report-header" style="background: linear-gradient(135deg, ${config.color}, ${config.colorDark}); color: white; padding: 20px 25px; border-radius: 12px; margin-bottom: 20px;">
                <h1 style="font-size: 20px; margin-bottom: 5px;">⚠️ ${config.title}</h1>
                <p style="opacity: 0.9; font-size: 13px;">Período: ${startDate} a ${endDate} | Máquina: ${machine === 'all' ? 'Todas' : machine} | Turno: ${shift === 'all' ? 'Todos' : 'T' + shift}${orderLabel ? ` | OP: ${orderLabel}` : ''}</p>
            </div>
            
            <div class="kpi-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 20px;">
                <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 15px; text-align: center;">
                    <div style="font-size: 26px; font-weight: 700; color: #dc2626;">${allData.length}</div>
                    <div style="font-size: 11px; color: #991b1b;">Registros</div>
                </div>
                <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 15px; text-align: center;">
                    <div style="font-size: 26px; font-weight: 700; color: #dc2626;">${totalPcs.toLocaleString('pt-BR')}</div>
                    <div style="font-size: 11px; color: #991b1b;">Peças Perdidas</div>
                </div>
                <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 15px; text-align: center;">
                    <div style="font-size: 26px; font-weight: 700; color: #dc2626;">${totalKg.toFixed(3)}</div>
                    <div style="font-size: 11px; color: #991b1b;">Peso (kg)</div>
                </div>
                <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 15px; text-align: center;">
                    <div style="font-size: 26px; font-weight: 700; color: #dc2626;">${sortedReasons.length}</div>
                    <div style="font-size: 11px; color: #991b1b;">Motivos</div>
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 20px;">
                <div class="section">
                    <h2 style="font-size: 15px; color: ${config.colorDark}; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid ${config.color}40;">🏭 Por Máquina</h2>
                    <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                        <thead><tr style="background: ${config.color}15;"><th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Máquina</th><th style="padding: 8px; border: 1px solid #ddd; text-align: right;">Peças</th><th style="padding: 8px; border: 1px solid #ddd; text-align: right;">Peso (kg)</th><th style="padding: 8px; border: 1px solid #ddd; text-align: right;">%</th></tr></thead>
                        <tbody>${sortedMachines.map(([m, v]) => `<tr><td style="padding: 6px; border: 1px solid #ddd; font-weight: 600;">${m}</td><td style="padding: 6px; border: 1px solid #ddd; text-align: right;">${v.pcs.toLocaleString('pt-BR')}</td><td style="padding: 6px; border: 1px solid #ddd; text-align: right;">${v.kg.toFixed(3)}</td><td style="padding: 6px; border: 1px solid #ddd; text-align: right;">${totalKg > 0 ? (v.kg / totalKg * 100).toFixed(1) : 0}%</td></tr>`).join('')}</tbody>
                    </table>
                </div>
                <div class="section">
                    <h2 style="font-size: 15px; color: ${config.colorDark}; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid ${config.color}40;">⚠️ Por Motivo</h2>
                    <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                        <thead><tr style="background: ${config.color}15;"><th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Motivo</th><th style="padding: 8px; border: 1px solid #ddd; text-align: right;">Peças</th><th style="padding: 8px; border: 1px solid #ddd; text-align: right;">Peso (kg)</th><th style="padding: 8px; border: 1px solid #ddd; text-align: right;">%</th></tr></thead>
                        <tbody>${sortedReasons.map(([r, v]) => `<tr><td style="padding: 6px; border: 1px solid #ddd;">${r}</td><td style="padding: 6px; border: 1px solid #ddd; text-align: right;">${v.pcs.toLocaleString('pt-BR')}</td><td style="padding: 6px; border: 1px solid #ddd; text-align: right;">${v.kg.toFixed(3)}</td><td style="padding: 6px; border: 1px solid #ddd; text-align: right;">${totalKg > 0 ? (v.kg / totalKg * 100).toFixed(1) : 0}%</td></tr>`).join('')}</tbody>
                    </table>
                </div>
            </div>
            
            <div class="section" style="margin-top: 20px;">
                <h2 style="font-size: 15px; color: ${config.colorDark}; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid ${config.color}40;">📋 Listagem (${Math.min(allData.length, 100)} de ${allData.length})</h2>
                <div style="overflow-x: auto; max-height: 350px; overflow-y: auto;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                        <thead style="position: sticky; top: 0; background: white;"><tr style="background: ${config.color}15;"><th style="padding: 6px; border: 1px solid #ddd;">Data</th><th style="padding: 6px; border: 1px solid #ddd;">Máquina</th><th style="padding: 6px; border: 1px solid #ddd;">Motivo</th><th style="padding: 6px; border: 1px solid #ddd; text-align: right;">Qtd</th><th style="padding: 6px; border: 1px solid #ddd; text-align: right;">Peso (kg)</th><th style="padding: 6px; border: 1px solid #ddd; text-align: center;">Turno</th></tr></thead>
                        <tbody>${allData.slice(0, 100).map(item => `<tr><td style="padding: 5px; border: 1px solid #ddd;">${item.date || '-'}</td><td style="padding: 5px; border: 1px solid #ddd;">${item.machine || '-'}</td><td style="padding: 5px; border: 1px solid #ddd;">${item.reason || '-'}</td><td style="padding: 5px; border: 1px solid #ddd; text-align: right;">${(item.scrapPcs || 0).toLocaleString('pt-BR')}</td><td style="padding: 5px; border: 1px solid #ddd; text-align: right;">${(item.scrapKg || 0).toFixed(3)}</td><td style="padding: 5px; border: 1px solid #ddd; text-align: center;">T${item.shift || '-'}</td></tr>`).join('')}</tbody>
                    </table>
                </div>
            </div>
        </div>`;
    }
    
    // Relatório de Borra Inline
    async function generateInlineBorra(filters) {
        const { startDate, endDate, machine, order } = filters;
        const config = reportTypeConfig.borra;
        
        // Buscar planos se houver filtro de OP (para obter IDs correspondentes)
        let matchingPlanIds = null;
        if (order && order.length > 0) {
            // OTIMIZAÇÃO: Usar cache para planning
            const allPlans = await getPlanningCached();
            const orderSearch = order.toLowerCase();
            matchingPlanIds = allPlans
                .filter(plan => {
                    const orderNum = String(plan.order_number || plan.orderNumber || '').toLowerCase();
                    return orderNum.includes(orderSearch);
                })
                .map(plan => plan.id);
            if (matchingPlanIds.length === 0) throw new Error('Nenhuma OP encontrada com o número digitado');
        }
        
        // Buscar borra
        let borraData = [];
        const pmpSnap = await getDb().collection('pmp_borra')
            .where('date', '>=', startDate)
            .where('date', '<=', endDate)
            .get();
        
        pmpSnap.forEach(doc => {
            const d = doc.data();
            borraData.push({ id: doc.id, ...d, machine: normalizeMachineId(d.machine || '') });
        });
        
        if (machine !== 'all') borraData = borraData.filter(b => b.machine === normalizeMachineId(machine));
        
        // Filtrar por OP se digitado (usando IDs dos planos encontrados)
        if (matchingPlanIds) {
            borraData = borraData.filter(b => matchingPlanIds.includes(b.planId));
        }
        
        // Buscar sucata
        let sucataData = [];
        try {
            const sucSnap = await getDb().collection('pmp_sucata')
                .where('date', '>=', startDate)
                .where('date', '<=', endDate)
                .get();
            sucSnap.forEach(doc => {
                const d = doc.data();
                sucataData.push({ id: doc.id, ...d, machine: normalizeMachineId(d.machine || '') });
            });
            if (machine !== 'all') sucataData = sucataData.filter(s => s.machine === normalizeMachineId(machine));
            if (matchingPlanIds) {
                sucataData = sucataData.filter(s => matchingPlanIds.includes(s.planId));
            }
        } catch(e) { console.warn('Sem dados de sucata:', e); }
        
        if (borraData.length === 0 && sucataData.length === 0) {
            throw new Error('Nenhum dado de borra/sucata encontrado para os filtros selecionados');
        }
        
        const totalBorraKg = borraData.reduce((s, b) => s + (b.quantityKg || 0), 0);
        const totalSucataKg = sucataData.reduce((s, b) => s + (b.quantityKg || b.weight || 0), 0);
        
        const borraByMachine = {};
        borraData.forEach(b => {
            if (!borraByMachine[b.machine]) borraByMachine[b.machine] = { kg: 0, count: 0 };
            borraByMachine[b.machine].kg += b.quantityKg || 0;
            borraByMachine[b.machine].count++;
        });
        
        // Obter label da OP se filtrada
        const orderLabel = order && order.length > 0 ? order : null;
        
        return `
        <div class="p-6" style="font-family: 'Segoe UI', sans-serif;">
            <div class="report-header" style="background: linear-gradient(135deg, ${config.color}, ${config.colorDark}); color: white; padding: 20px 25px; border-radius: 12px; margin-bottom: 20px;">
                <h1 style="font-size: 20px; margin-bottom: 5px;">🗑️ ${config.title}</h1>
                <p style="opacity: 0.9; font-size: 13px;">Período: ${startDate} a ${endDate} | Máquina: ${machine === 'all' ? 'Todas' : machine}${orderLabel ? ` | OP: ${orderLabel}` : ''}</p>
            </div>
            
            <div class="kpi-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-bottom: 20px;">
                <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 15px; text-align: center;">
                    <div style="font-size: 26px; font-weight: 700; color: #d97706;">${totalBorraKg.toFixed(3)}</div>
                    <div style="font-size: 11px; color: #92400e;">Total Borra (kg)</div>
                </div>
                <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 15px; text-align: center;">
                    <div style="font-size: 26px; font-weight: 700; color: #d97706;">${borraData.length}</div>
                    <div style="font-size: 11px; color: #92400e;">Lançamentos Borra</div>
                </div>
                <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 15px; text-align: center;">
                    <div style="font-size: 26px; font-weight: 700; color: #dc2626;">${totalSucataKg.toFixed(3)}</div>
                    <div style="font-size: 11px; color: #991b1b;">Total Sucata (kg)</div>
                </div>
                <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 15px; text-align: center;">
                    <div style="font-size: 26px; font-weight: 700; color: #dc2626;">${sucataData.length}</div>
                    <div style="font-size: 11px; color: #991b1b;">Lançamentos Sucata</div>
                </div>
            </div>
            
            <div class="section">
                <h2 style="font-size: 15px; color: ${config.colorDark}; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid ${config.color}40;">🏭 Borra por Máquina</h2>
                <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                    <thead><tr style="background: ${config.color}15;"><th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Máquina</th><th style="padding: 8px; border: 1px solid #ddd; text-align: right;">Peso (kg)</th><th style="padding: 8px; border: 1px solid #ddd; text-align: center;">Lançamentos</th><th style="padding: 8px; border: 1px solid #ddd; text-align: right;">%</th></tr></thead>
                    <tbody>${Object.entries(borraByMachine).sort((a,b) => b[1].kg - a[1].kg).map(([m,v]) => `<tr><td style="padding: 6px; border: 1px solid #ddd; font-weight: 600;">${m}</td><td style="padding: 6px; border: 1px solid #ddd; text-align: right;">${v.kg.toFixed(3)}</td><td style="padding: 6px; border: 1px solid #ddd; text-align: center;">${v.count}</td><td style="padding: 6px; border: 1px solid #ddd; text-align: right;">${totalBorraKg > 0 ? (v.kg/totalBorraKg*100).toFixed(1) : 0}%</td></tr>`).join('')}</tbody>
                </table>
            </div>
            
            <div class="section" style="margin-top: 20px;">
                <h2 style="font-size: 15px; color: ${config.colorDark}; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid ${config.color}40;">📋 Lançamentos de Borra (${borraData.length})</h2>
                <div style="overflow-x: auto; max-height: 300px; overflow-y: auto;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                        <thead style="position: sticky; top: 0; background: white;"><tr style="background: ${config.color}15;"><th style="padding: 6px; border: 1px solid #ddd;">Data</th><th style="padding: 6px; border: 1px solid #ddd;">Máquina</th><th style="padding: 6px; border: 1px solid #ddd; text-align: right;">Peso (kg)</th><th style="padding: 6px; border: 1px solid #ddd;">Operador</th><th style="padding: 6px; border: 1px solid #ddd;">Hora</th></tr></thead>
                        <tbody>${borraData.slice(0, 100).map(b => `<tr><td style="padding: 5px; border: 1px solid #ddd;">${b.date || '-'}</td><td style="padding: 5px; border: 1px solid #ddd;">${b.machine || '-'}</td><td style="padding: 5px; border: 1px solid #ddd; text-align: right;">${(b.quantityKg || 0).toFixed(3)}</td><td style="padding: 5px; border: 1px solid #ddd;">${b.operatorName || b.operator || '-'}</td><td style="padding: 5px; border: 1px solid #ddd;">${b.hour || '-'}</td></tr>`).join('')}</tbody>
                    </table>
                </div>
            </div>
            
            ${sucataData.length > 0 ? `
            <div class="section" style="margin-top: 20px;">
                <h2 style="font-size: 15px; color: #dc2626; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid #fecaca;">📋 Lançamentos de Sucata (${sucataData.length})</h2>
                <div style="overflow-x: auto; max-height: 300px; overflow-y: auto;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                        <thead style="position: sticky; top: 0; background: white;"><tr style="background: #fef2f2;"><th style="padding: 6px; border: 1px solid #ddd;">Data</th><th style="padding: 6px; border: 1px solid #ddd;">Máquina</th><th style="padding: 6px; border: 1px solid #ddd;">Tipo</th><th style="padding: 6px; border: 1px solid #ddd; text-align: right;">Peso (kg)</th><th style="padding: 6px; border: 1px solid #ddd;">Operador</th></tr></thead>
                        <tbody>${sucataData.slice(0, 100).map(s => `<tr><td style="padding: 5px; border: 1px solid #ddd;">${s.date || '-'}</td><td style="padding: 5px; border: 1px solid #ddd;">${s.machine || '-'}</td><td style="padding: 5px; border: 1px solid #ddd;">${s.type || s.tipo || '-'}</td><td style="padding: 5px; border: 1px solid #ddd; text-align: right;">${(s.quantityKg || s.weight || 0).toFixed(3)}</td><td style="padding: 5px; border: 1px solid #ddd;">${s.operatorName || '-'}</td></tr>`).join('')}</tbody>
                    </table>
                </div>
            </div>` : ''}
        </div>`;
    }
    
    // Relatório Consolidado Inline
    async function generateInlineConsolidado(filters) {
        const { startDate, endDate, machine, shift, order } = filters;
        const config = reportTypeConfig.consolidado;
        
        // Buscar planos se houver filtro de OP (para obter IDs correspondentes)
        let matchingPlanIds = null;
        if (order && order.length > 0) {
            // OTIMIZAÇÃO: Usar cache para planning
            const allPlans = await getPlanningCached();
            const orderSearch = order.toLowerCase();
            matchingPlanIds = allPlans
                .filter(plan => {
                    const orderNum = String(plan.order_number || plan.orderNumber || '').toLowerCase();
                    return orderNum.includes(orderSearch);
                })
                .map(plan => plan.id);
            if (matchingPlanIds.length === 0) throw new Error('Nenhuma OP encontrada com o número digitado');
        }
        
        let [productionData, lossesData, downtimeData] = await Promise.all([
            getFilteredData('production', startDate, endDate, machine, shift),
            getFilteredData('losses', startDate, endDate, machine, shift),
            getFilteredData('downtime', startDate, endDate, machine, shift)
        ]);
        
        // Filtrar por OP se digitado (usando IDs dos planos encontrados)
        if (matchingPlanIds) {
            productionData = productionData.filter(d => matchingPlanIds.includes(d.raw?.planId));
            lossesData = lossesData.filter(d => matchingPlanIds.includes(d.raw?.planId));
            downtimeData = downtimeData.filter(d => matchingPlanIds.includes(d.raw?.planId) || matchingPlanIds.includes(d.raw?.order_id));
        }
        
        const totalProduced = productionData.reduce((s, i) => s + (i.quantity || 0), 0);
        const totalLossKg = lossesData.reduce((s, i) => s + (i.scrapKg || 0), 0);
        const totalLossPcs = lossesData.reduce((s, i) => s + (i.scrapPcs || 0), 0);
        const totalDowntimeMin = downtimeData.reduce((s, i) => s + (i.duration || 0), 0);
        const lossPercent = totalProduced > 0 ? (totalLossPcs / totalProduced * 100) : 0;
        
        // Top motivos de perda
        const lossReasons = {};
        lossesData.forEach(i => {
            const r = i.reason || 'N/A';
            lossReasons[r] = (lossReasons[r] || 0) + (i.scrapKg || 0);
        });
        const topLossReasons = Object.entries(lossReasons).sort((a,b) => b[1] - a[1]).slice(0, 5);
        
        // Top motivos de parada
        const dtReasons = {};
        downtimeData.forEach(i => {
            const r = i.reason || 'N/A';
            dtReasons[r] = (dtReasons[r] || 0) + (i.duration || 0);
        });
        const topDtReasons = Object.entries(dtReasons).sort((a,b) => b[1] - a[1]).slice(0, 5);
        
        // Produção por máquina
        const prodByMachine = {};
        productionData.forEach(i => {
            const m = i.machine || 'N/A';
            prodByMachine[m] = (prodByMachine[m] || 0) + (i.quantity || 0);
        });
        
        // Obter label da OP se filtrada
        const orderLabel = order && order.length > 0 ? order : null;
        
        return `
        <div class="p-6" style="font-family: 'Segoe UI', sans-serif;">
            <div class="report-header" style="background: linear-gradient(135deg, ${config.color}, ${config.colorDark}); color: white; padding: 20px 25px; border-radius: 12px; margin-bottom: 20px;">
                <h1 style="font-size: 20px; margin-bottom: 5px;">📊 ${config.title}</h1>
                <p style="opacity: 0.9; font-size: 13px;">Período: ${startDate} a ${endDate} | Máquina: ${machine === 'all' ? 'Todas' : machine} | Turno: ${shift === 'all' ? 'Todos' : 'T' + shift}${orderLabel ? ` | OP: ${orderLabel}` : ''}</p>
                <p style="opacity: 0.7; font-size: 11px; margin-top: 5px;">Gerado em: ${new Date().toLocaleString('pt-BR')}</p>
            </div>
            
            <div class="kpi-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; margin-bottom: 20px;">
                <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px; text-align: center;">
                    <div style="font-size: 22px; font-weight: 700; color: #16a34a;">${totalProduced.toLocaleString('pt-BR')}</div>
                    <div style="font-size: 10px; color: #166534;">Peças Produzidas</div>
                </div>
                <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px; text-align: center;">
                    <div style="font-size: 22px; font-weight: 700; color: #dc2626;">${totalLossPcs.toLocaleString('pt-BR')}</div>
                    <div style="font-size: 10px; color: #991b1b;">Peças Perdidas</div>
                </div>
                <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px; text-align: center;">
                    <div style="font-size: 22px; font-weight: 700; color: #dc2626;">${totalLossKg.toFixed(3)}</div>
                    <div style="font-size: 10px; color: #991b1b;">Refugo (kg)</div>
                </div>
                <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px; text-align: center;">
                    <div style="font-size: 22px; font-weight: 700; color: #dc2626;">${lossPercent.toFixed(1)}%</div>
                    <div style="font-size: 10px; color: #991b1b;">% Perda</div>
                </div>
                <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 12px; text-align: center;">
                    <div style="font-size: 22px; font-weight: 700; color: #ea580c;">${(totalDowntimeMin / 60).toFixed(1)}h</div>
                    <div style="font-size: 10px; color: #9a3412;">Tempo Parado</div>
                </div>
                <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 12px; text-align: center;">
                    <div style="font-size: 22px; font-weight: 700; color: #ea580c;">${downtimeData.length}</div>
                    <div style="font-size: 10px; color: #9a3412;">Paradas</div>
                </div>
                <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 12px; text-align: center;">
                    <div style="font-size: 22px; font-weight: 700; color: #2563eb;">${productionData.length}</div>
                    <div style="font-size: 10px; color: #1e40af;">Lançamentos Prod.</div>
                </div>
                <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 12px; text-align: center;">
                    <div style="font-size: 22px; font-weight: 700; color: #2563eb;">${lossesData.length}</div>
                    <div style="font-size: 10px; color: #1e40af;">Lançamentos Perda</div>
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 20px;">
                <div class="section">
                    <h2 style="font-size: 15px; color: ${config.colorDark}; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid ${config.color}40;">🏭 Produção por Máquina</h2>
                    <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                        <thead><tr style="background: ${config.color}15;"><th style="padding: 6px; border: 1px solid #ddd; text-align: left;">Máquina</th><th style="padding: 6px; border: 1px solid #ddd; text-align: right;">Peças</th><th style="padding: 6px; border: 1px solid #ddd; text-align: right;">%</th></tr></thead>
                        <tbody>${Object.entries(prodByMachine).sort((a,b) => b[1] - a[1]).map(([m,v]) => `<tr><td style="padding: 5px; border: 1px solid #ddd; font-weight: 600;">${m}</td><td style="padding: 5px; border: 1px solid #ddd; text-align: right;">${v.toLocaleString('pt-BR')}</td><td style="padding: 5px; border: 1px solid #ddd; text-align: right;">${totalProduced > 0 ? (v/totalProduced*100).toFixed(1) : 0}%</td></tr>`).join('')}</tbody>
                    </table>
                </div>
                
                <div class="section">
                    <h2 style="font-size: 15px; color: #dc2626; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid #fecaca;">⚠️ Top 5 Motivos de Perda</h2>
                    <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                        <thead><tr style="background: #fef2f2;"><th style="padding: 6px; border: 1px solid #ddd; text-align: left;">Motivo</th><th style="padding: 6px; border: 1px solid #ddd; text-align: right;">Peso (kg)</th><th style="padding: 6px; border: 1px solid #ddd; text-align: right;">%</th></tr></thead>
                        <tbody>${topLossReasons.map(([r,v]) => `<tr><td style="padding: 5px; border: 1px solid #ddd;">${r}</td><td style="padding: 5px; border: 1px solid #ddd; text-align: right;">${v.toFixed(3)}</td><td style="padding: 5px; border: 1px solid #ddd; text-align: right;">${totalLossKg > 0 ? (v/totalLossKg*100).toFixed(1) : 0}%</td></tr>`).join('')}</tbody>
                    </table>
                </div>
                
                <div class="section">
                    <h2 style="font-size: 15px; color: #ea580c; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid #fed7aa;">⏸ Top 5 Motivos de Parada</h2>
                    <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                        <thead><tr style="background: #fff7ed;"><th style="padding: 6px; border: 1px solid #ddd; text-align: left;">Motivo</th><th style="padding: 6px; border: 1px solid #ddd; text-align: right;">Tempo (min)</th><th style="padding: 6px; border: 1px solid #ddd; text-align: right;">%</th></tr></thead>
                        <tbody>${topDtReasons.map(([r,v]) => `<tr><td style="padding: 5px; border: 1px solid #ddd;">${r}</td><td style="padding: 5px; border: 1px solid #ddd; text-align: right;">${v.toFixed(0)}</td><td style="padding: 5px; border: 1px solid #ddd; text-align: right;">${totalDowntimeMin > 0 ? (v/totalDowntimeMin*100).toFixed(1) : 0}%</td></tr>`).join('')}</tbody>
                    </table>
                </div>
            </div>
        </div>`;
    }

    // Relatório de Produção (Quantitativo ou Eficiência)
    // MELHORADO: Agora aceita parâmetro de data e busca dados diretamente
    window.generateProductionReport = async function(type, selectedDate) {
        // Usar data selecionada no card ou data atual
        const date = selectedDate || getProductionDateString();
        
        if (!date) {
            showNotification('Selecione uma data para gerar o relatório.', 'warning');
            return;
        }
        
        showNotification('⏳ Gerando relatório...', 'info');
        
        try {
            // OTIMIZAÇÃO: Usar cache para planning
            const allPlans = await getPlanningCached();
            const plans = allPlans.filter(isPlanActive);
            
            if (plans.length === 0) {
                showNotification('Nenhum plano ativo encontrado.', 'warning');
                return;
            }
            
            // OTIMIZADO Fase 2: Usar cache
            const productions = await cachedInlineQuery(`prod_${date}_${date}`, () =>
                getDb().collection('production_entries').where('data', '==', date).get()
            );
            
            const downtimes = await cachedInlineQuery(`down_${date}_${date}`, () =>
                getDb().collection('downtime_entries').where('date', '==', date).get()
            );
            
            // Processar dados usando função existente
            const reportData = processResumoData(plans, productions, downtimes);
            
            if (reportData.length === 0) {
                showNotification('Nenhum dado encontrado para a data selecionada.', 'warning');
                return;
            }
            
            // Abrir nova janela para o relatório
            const reportWindow = window.open('', '_blank');
            if (!reportWindow) {
                showNotification('Popup bloqueado. Permita popups para gerar o relatório.', 'warning');
                return;
            }
            
            const title = type === 'quant' ? 'Relatório Quantitativo de Produção' : 'Relatório de Eficiência (OEE)';
            const color = type === 'quant' ? '#10B981' : '#8B5CF6';
            const dateFormatted = new Date(date.replace(/-/g, '/')).toLocaleDateString('pt-BR');
            
            // Gerar conteúdo do relatório
            let tableContent = '';
            if (type === 'quant') {
                tableContent = generateQuantitativeTableHTML(reportData, color);
            } else {
                tableContent = generateEfficiencyTableHTML(reportData, color);
            }
            
            reportWindow.document.write(`<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><title>${title}</title>
<style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', sans-serif; color: #333; padding: 20px; background: #fff; }
    .header { background: linear-gradient(135deg, ${color}, ${color}dd); color: white; padding: 20px 25px; border-radius: 10px; margin-bottom: 20px; }
    .header h1 { font-size: 20px; margin-bottom: 3px; }
    .header p { opacity: 0.9; font-size: 12px; }
    .print-btn { position: fixed; top: 10px; right: 10px; background: ${color}; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 15px; }
    th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: center; }
    th { background: #f8f9fa; font-weight: 600; font-size: 10px; text-transform: uppercase; }
    tr:nth-child(even) { background: #fafafa; }
    .text-left { text-align: left; }
    .font-bold { font-weight: 600; }
    .text-success { color: #10B981; }
    .text-warning { color: #F59E0B; }
    .text-error { color: #EF4444; }
    .legend { margin: 15px 0; padding: 10px; background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 6px; font-size: 11px; }
    .legend span { margin-right: 15px; }
    @media print { 
        .print-btn { display: none; } 
        body { padding: 10px; }
        .header { padding: 15px 20px; }
    }
</style></head><body>
    <button class="print-btn" onclick="window.print()">🖨️ Imprimir</button>
    <div class="header">
        <h1>📊 ${title}</h1>
        <p>HokkaidoMES - Data: ${dateFormatted}</p>
        <p style="margin-top:5px;opacity:0.8;">Gerado em: ${new Date().toLocaleString('pt-BR')}</p>
    </div>
    ${tableContent}
</body></html>`);
            reportWindow.document.close();
            showNotification('📊 Relatório gerado com sucesso!', 'success');
            
        } catch (error) {
            console.error('Erro ao gerar relatório:', error);
            showNotification('Erro ao gerar relatório. Tente novamente.', 'error');
        }
    };
    
    // Função auxiliar para gerar tabela HTML do relatório quantitativo
    function generateQuantitativeTableHTML(data, color) {
        let rows = data.map(item => {
            const plannedTotal = coerceToNumber(item.planned_quantity, 0);
            const producedTotal = coerceToNumber(item.total_produzido, 0);
            const faltante = plannedTotal - producedTotal;
            const faltanteClass = faltante > 0 ? 'text-error' : 'text-success';
            
            return `<tr>
                <td class="text-left font-bold">${item.machine || '-'}</td>
                <td class="text-left">${item.product || '-'}</td>
                <td>${(item.T1.produzido || 0).toLocaleString('pt-BR')}</td>
                <td>${(item.T1.refugo_kg || 0).toFixed(2)}</td>
                <td>${(item.T2.produzido || 0).toLocaleString('pt-BR')}</td>
                <td>${(item.T2.refugo_kg || 0).toFixed(2)}</td>
                <td>${(item.T3.produzido || 0).toLocaleString('pt-BR')}</td>
                <td>${(item.T3.refugo_kg || 0).toFixed(2)}</td>
                <td class="font-bold">${plannedTotal.toLocaleString('pt-BR')}</td>
                <td class="font-bold">${producedTotal.toLocaleString('pt-BR')}</td>
                <td class="font-bold ${faltanteClass}">${faltante.toLocaleString('pt-BR')}</td>
            </tr>`;
        }).join('');
        
        return `
        <table>
            <thead>
                <tr>
                    <th rowspan="2" class="text-left">Máquina</th>
                    <th rowspan="2" class="text-left">Produto</th>
                    <th colspan="2" style="background:#dcfce7;">Turno 1</th>
                    <th colspan="2" style="background:#dbeafe;">Turno 2</th>
                    <th colspan="2" style="background:#fef3c7;">Turno 3</th>
                    <th rowspan="2">Planejado</th>
                    <th rowspan="2">Total Dia</th>
                    <th rowspan="2">Faltante</th>
                </tr>
                <tr>
                    <th style="background:#dcfce7;">Prod.</th><th style="background:#dcfce7;">Refugo(kg)</th>
                    <th style="background:#dbeafe;">Prod.</th><th style="background:#dbeafe;">Refugo(kg)</th>
                    <th style="background:#fef3c7;">Prod.</th><th style="background:#fef3c7;">Refugo(kg)</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>`;
    }
    
    // Função auxiliar para gerar tabela HTML do relatório de eficiência
    function generateEfficiencyTableHTML(data, color) {
        const formatPercent = (val) => {
            const pct = (val * 100).toFixed(1);
            let cls = 'text-success';
            if (val < 0.7) cls = 'text-error';
            else if (val < 0.85) cls = 'text-warning';
            return `<span class="${cls}">${pct}%</span>`;
        };
        
        let rows = data.map(item => {
            const oeeValues = [item.T1.oee, item.T2.oee, item.T3.oee].filter(v => v > 0);
            const avgOee = oeeValues.length > 0 ? oeeValues.reduce((a, b) => a + b, 0) / oeeValues.length : 0;
            
            return `<tr>
                <td class="text-left font-bold">${item.machine || '-'}</td>
                <td class="text-left">${item.product || '-'}</td>
                <td>${formatPercent(item.T1.disponibilidade || 0)}</td>
                <td>${formatPercent(item.T1.performance || 0)}</td>
                <td>${formatPercent(item.T1.qualidade || 0)}</td>
                <td class="font-bold">${formatPercent(item.T1.oee || 0)}</td>
                <td>${formatPercent(item.T2.disponibilidade || 0)}</td>
                <td>${formatPercent(item.T2.performance || 0)}</td>
                <td>${formatPercent(item.T2.qualidade || 0)}</td>
                <td class="font-bold">${formatPercent(item.T2.oee || 0)}</td>
                <td>${formatPercent(item.T3.disponibilidade || 0)}</td>
                <td>${formatPercent(item.T3.performance || 0)}</td>
                <td>${formatPercent(item.T3.qualidade || 0)}</td>
                <td class="font-bold">${formatPercent(item.T3.oee || 0)}</td>
                <td class="font-bold" style="font-size:13px;">${formatPercent(avgOee)}</td>
            </tr>`;
        }).join('');
        
        return `
        <div class="legend">
            <strong>Legenda OEE:</strong>
            <span class="text-success">★ ≥85% - Excelente</span>
            <span class="text-warning">★ 70-84% - Aceitável</span>
            <span class="text-error">★ <70% - Crítico</span>
        </div>
        <table>
            <thead>
                <tr>
                    <th rowspan="2" class="text-left">Máquina</th>
                    <th rowspan="2" class="text-left">Produto</th>
                    <th colspan="4" style="background:#dcfce7;">Turno 1</th>
                    <th colspan="4" style="background:#dbeafe;">Turno 2</th>
                    <th colspan="4" style="background:#fef3c7;">Turno 3</th>
                    <th rowspan="2">OEE Médio</th>
                </tr>
                <tr>
                    <th style="background:#dcfce7;">Disp.</th><th style="background:#dcfce7;">Perf.</th>
                    <th style="background:#dcfce7;">Qual.</th><th style="background:#dcfce7;">OEE</th>
                    <th style="background:#dbeafe;">Disp.</th><th style="background:#dbeafe;">Perf.</th>
                    <th style="background:#dbeafe;">Qual.</th><th style="background:#dbeafe;">OEE</th>
                    <th style="background:#fef3c7;">Disp.</th><th style="background:#fef3c7;">Perf.</th>
                    <th style="background:#fef3c7;">Qual.</th><th style="background:#fef3c7;">OEE</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>`;
    }
    ===== FIM CÓDIGO REMOVIDO (ABA RELATÓRIOS) ===== */

    // Relatório de Paradas
    // MELHORADO: Agora aceita parâmetros de data diretamente do card
    window.generateDowntimeReport = async function(startDateParam, endDateParam) {
        // Usar datas do parâmetro ou do filtro global ou data atual
        const today = getProductionDateString();
        const startDate = startDateParam || currentAnalysisFilters?.startDate || today;
        const endDate = endDateParam || currentAnalysisFilters?.endDate || startDate;
        const machine = currentAnalysisFilters?.machine || 'all';
        const shift = currentAnalysisFilters?.shift || 'all';
        
        if (!startDate) {
            showNotification('Selecione uma data inicial para gerar o relatório.', 'warning');
            return;
        }
        
        showNotification('⏳ Gerando relatório de paradas...', 'info');
        
        try {
            // Buscar dados diretamente do Firebase com range de datas
            let query = getDb().collection('downtime_entries');
            
            if (startDate === endDate) {
                // Data única
                query = query.where('date', '==', startDate);
            } else {
                // Range de datas
                query = query.where('date', '>=', startDate).where('date', '<=', endDate);
            }
            
            const snapshot = await query.get();
            let downtimeData = snapshot.docs.map(doc => {
                const data = doc.data();
                // Calcular duração se não estiver presente
                let duration = data.duration || 0;
                if (!duration && data.startTime && data.endTime && data.date) {
                    const start = new Date(`${data.date}T${data.startTime}`);
                    const end = new Date(`${data.date}T${data.endTime}`);
                    duration = end > start ? Math.round((end - start) / 60000) : 0;
                }
                return {
                    ...data,
                    duration,
                    raw: data
                };
            });
            
            // Filtrar por máquina se necessário
            if (machine && machine !== 'all') {
                downtimeData = downtimeData.filter(d => d.machine === machine);
            }
            
            // Filtrar por turno se necessário
            if (shift && shift !== 'all') {
                downtimeData = downtimeData.filter(d => String(d.shift) === String(shift));
            }
            
            if (downtimeData.length === 0) {
                showNotification('Nenhum dado de paradas para o período selecionado.', 'warning');
                return;
            }
            
            // Calcular estatísticas
            let totalMin = 0;
            const byMachine = {}, byReason = {}, byShift = {};
            
            downtimeData.forEach(item => {
                const dur = item.duration || 0;
                const machId = item.machine || 'N/A';
                const reason = item.reason || 'N/A';
                const sh = item.shift || 'N/A';
                
                totalMin += dur;
                
                if (!byMachine[machId]) byMachine[machId] = { min: 0, count: 0 };
                byMachine[machId].min += dur;
                byMachine[machId].count++;
                
                if (!byReason[reason]) byReason[reason] = { min: 0, count: 0 };
                byReason[reason].min += dur;
                byReason[reason].count++;
                
                if (!byShift[sh]) byShift[sh] = { min: 0, count: 0 };
                byShift[sh].min += dur;
                byShift[sh].count++;
            });
            
            const sortedMachines = Object.entries(byMachine).sort((a,b) => b[1].min - a[1].min);
            const sortedReasons = Object.entries(byReason).sort((a,b) => b[1].min - a[1].min);
            
            const reportWindow = window.open('', '_blank');
            if (!reportWindow) { showNotification('Popup bloqueado.', 'warning'); return; }
            
            reportWindow.document.write(`<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><title>Relatório de Paradas</title>
<style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', sans-serif; color: #333; padding: 30px; background: #f8f9fa; }
    .header { background: linear-gradient(135deg, #f97316, #ea580c); color: white; padding: 25px 30px; border-radius: 12px; margin-bottom: 25px; }
    .header h1 { font-size: 22px; } .header p { opacity: 0.85; font-size: 13px; }
    .meta-info { display: flex; gap: 15px; flex-wrap: wrap; margin-top: 10px; }
    .meta-item { background: rgba(255,255,255,0.15); padding: 5px 12px; border-radius: 8px; font-size: 12px; }
    .section { background: white; border-radius: 10px; padding: 20px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
    .section h2 { font-size: 16px; color: #f97316; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid #fed7aa; }
    .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-bottom: 20px; }
    .kpi-card { background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 12px; text-align: center; }
    .kpi-card .value { font-size: 24px; font-weight: 700; color: #ea580c; }
    .kpi-card .label { font-size: 11px; color: #9a3412; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    thead th { background: #fff7ed; color: #9a3412; padding: 8px 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #fed7aa; }
    tbody td { padding: 6px 12px; border-bottom: 1px solid #f3f4f6; }
    tbody tr:hover { background: #fffbeb; }
    .text-right { text-align: right; } .text-center { text-align: center; }
    .footer { text-align: center; color: #9ca3af; font-size: 11px; margin-top: 30px; padding-top: 15px; border-top: 1px solid #e5e7eb; }
    .print-btn { position: fixed; top: 15px; right: 15px; background: #f97316; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: 600; }
    @media print { .print-btn { display: none; } body { padding: 15px; background: white; } .section { box-shadow: none; border: 1px solid #e5e7eb; } }
</style></head><body>
    <button class="print-btn" onclick="window.print()">🖨️ Imprimir</button>
    <div class="header">
        <h1>⏸ Relatório de Paradas</h1>
        <p>HokkaidoMES - Sistema de Execução da Manufatura</p>
        <div class="meta-info">
            <div class="meta-item">📅 ${startDate || '-'} a ${endDate || '-'}</div>
            <div class="meta-item">🏭 ${machine === 'all' ? 'Todas' : machine}</div>
            <div class="meta-item">⏰ ${shift === 'all' ? 'Todos' : 'T' + shift}</div>
            <div class="meta-item">📋 ${new Date().toLocaleString('pt-BR')}</div>
        </div>
    </div>
    <div class="kpi-grid">
        <div class="kpi-card"><div class="value">${downtimeData.length}</div><div class="label">Total de Paradas</div></div>
        <div class="kpi-card"><div class="value">${(totalMin / 60).toFixed(1)}h</div><div class="label">Tempo Total Parado</div></div>
        <div class="kpi-card"><div class="value">${downtimeData.length > 0 ? (totalMin / downtimeData.length).toFixed(0) : 0}min</div><div class="label">Duração Média</div></div>
        <div class="kpi-card"><div class="value">${sortedMachines.length}</div><div class="label">Máquinas Afetadas</div></div>
    </div>
    <div class="section">
        <h2>🏭 Paradas por Máquina</h2>
        <table>
            <thead><tr><th>Máquina</th><th class="text-right">Tempo (min)</th><th class="text-right">Tempo (h)</th><th class="text-center">Ocorrências</th><th class="text-right">% do Total</th></tr></thead>
            <tbody>${sortedMachines.map(([m,v]) => `<tr><td><strong>${m}</strong></td><td class="text-right">${v.min.toFixed(0)}</td><td class="text-right">${(v.min/60).toFixed(1)}</td><td class="text-center">${v.count}</td><td class="text-right">${totalMin > 0 ? (v.min/totalMin*100).toFixed(1) : 0}%</td></tr>`).join('')}</tbody>
        </table>
    </div>
    <div class="section">
        <h2>⚠️ Paradas por Motivo</h2>
        <table>
            <thead><tr><th>Motivo</th><th class="text-right">Tempo (min)</th><th class="text-right">Tempo (h)</th><th class="text-center">Ocorrências</th><th class="text-right">% do Total</th></tr></thead>
            <tbody>${sortedReasons.map(([r,v]) => `<tr><td>${r}</td><td class="text-right">${v.min.toFixed(0)}</td><td class="text-right">${(v.min/60).toFixed(1)}</td><td class="text-center">${v.count}</td><td class="text-right">${totalMin > 0 ? (v.min/totalMin*100).toFixed(1) : 0}%</td></tr>`).join('')}</tbody>
        </table>
    </div>
    <div class="section">
        <h2>⏰ Paradas por Turno</h2>
        <table>
            <thead><tr><th>Turno</th><th class="text-right">Tempo (min)</th><th class="text-center">Ocorrências</th></tr></thead>
            <tbody>${Object.entries(byShift).sort((a,b) => String(a[0]).localeCompare(String(b[0]))).map(([s,v]) => `<tr><td>Turno ${s}</td><td class="text-right">${v.min.toFixed(0)}</td><td class="text-center">${v.count}</td></tr>`).join('')}</tbody>
        </table>
    </div>
    <div class="section">
        <h2>📋 Listagem Completa (${downtimeData.length} registros)</h2>
        <div style="overflow-x:auto;"><table>
            <thead><tr><th>Data</th><th>Máquina</th><th>Motivo</th><th class="text-right">Duração (min)</th><th class="text-center">Turno</th><th>Início</th><th>Fim</th></tr></thead>
            <tbody>${downtimeData.slice(0, 500).map(item => {
                const raw = item.raw || {};
                return `<tr><td>${item.date || '-'}</td><td>${item.machine || '-'}</td><td>${item.reason || '-'}</td><td class="text-right">${(item.duration || 0).toFixed(0)}</td><td class="text-center">T${item.shift || '-'}</td><td>${raw.startTime || '-'}</td><td>${raw.endTime || '-'}</td></tr>`;
            }).join('')}
            ${downtimeData.length > 500 ? '<tr><td colspan="7" style="text-align:center;color:#9ca3af;padding:12px;">... truncado</td></tr>' : ''}
            </tbody>
        </table></div>
    </div>
    <div class="footer"><p>HokkaidoMES &copy; ${new Date().getFullYear()}</p></div>
</body></html>`);
            reportWindow.document.close();
            showNotification('📊 Relatório de paradas gerado!', 'success');
        } catch (error) {
            console.error('Erro ao gerar relatório de paradas:', error);
            showNotification('Erro ao gerar relatório. Verifique o console.', 'error');
        }
    };

    // Relatório de Borra e Sucata
    // MELHORADO: Agora aceita parâmetros de data diretamente do card
    window.generateBorraSucataReport = async function(startDateParam, endDateParam) {
        // Usar datas do parâmetro ou do filtro global ou data atual
        const today = getProductionDateString();
        const startDate = startDateParam || currentAnalysisFilters?.startDate || today;
        const endDate = endDateParam || currentAnalysisFilters?.endDate || startDate;
        const machine = currentAnalysisFilters?.machine || 'all';
        const shift = currentAnalysisFilters?.shift || 'all';
        
        if (!startDate) {
            showNotification('Selecione uma data para gerar o relatório.', 'warning');
            return;
        }
        
        showNotification('⏳ Gerando relatório de borra e sucata...', 'info');
        
        try {
            // Buscar dados de borra do PMP
            let borraData = [];
            const pmpSnap = await getDb().collection('pmp_borra')
                .where('date', '>=', startDate)
                .where('date', '<=', endDate)
                .get();
            
            pmpSnap.forEach(doc => {
                const d = doc.data();
                borraData.push({ id: doc.id, ...d, machine: normalizeMachineId(d.machine || '') });
            });
            
            if (machine !== 'all') {
                borraData = borraData.filter(b => b.machine === normalizeMachineId(machine));
            }
            
            // Buscar sucata
            let sucataData = [];
            try {
                const sucSnap = await getDb().collection('pmp_sucata')
                    .where('date', '>=', startDate)
                    .where('date', '<=', endDate)
                    .get();
                sucSnap.forEach(doc => {
                    const d = doc.data();
                    sucataData.push({ id: doc.id, ...d, machine: normalizeMachineId(d.machine || '') });
                });
                if (machine !== 'all') {
                    sucataData = sucataData.filter(s => s.machine === normalizeMachineId(machine));
                }
            } catch(e) { console.warn('Sem dados de sucata:', e); }
            
            if (borraData.length === 0 && sucataData.length === 0) {
                showNotification('Nenhum dado de borra/sucata para o período.', 'warning');
                return;
            }
            
            const totalBorraKg = borraData.reduce((s, b) => s + (b.quantityKg || 0), 0);
            const totalSucataKg = sucataData.reduce((s, b) => s + (b.quantityKg || b.weight || 0), 0);
            
            const borraByMachine = {};
            borraData.forEach(b => {
                if (!borraByMachine[b.machine]) borraByMachine[b.machine] = { kg: 0, count: 0 };
                borraByMachine[b.machine].kg += b.quantityKg || 0;
                borraByMachine[b.machine].count++;
            });
            
            const reportWindow = window.open('', '_blank');
            if (!reportWindow) { showNotification('Popup bloqueado.', 'warning'); return; }
            
            reportWindow.document.write(`<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><title>Relatório de Borra e Sucata</title>
<style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', sans-serif; color: #333; padding: 30px; background: #f8f9fa; }
    .header { background: linear-gradient(135deg, #f59e0b, #d97706); color: white; padding: 25px 30px; border-radius: 12px; margin-bottom: 25px; }
    .header h1 { font-size: 22px; } .header p { opacity: 0.85; font-size: 13px; }
    .section { background: white; border-radius: 10px; padding: 20px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
    .section h2 { font-size: 16px; color: #d97706; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid #fde68a; }
    .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-bottom: 20px; }
    .kpi-card { background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 12px; text-align: center; }
    .kpi-card .value { font-size: 24px; font-weight: 700; color: #d97706; }
    .kpi-card .label { font-size: 11px; color: #92400e; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    thead th { background: #fffbeb; color: #92400e; padding: 8px 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #fde68a; }
    tbody td { padding: 6px 12px; border-bottom: 1px solid #f3f4f6; }
    .text-right { text-align: right; } .text-center { text-align: center; }
    .footer { text-align: center; color: #9ca3af; font-size: 11px; margin-top: 30px; padding-top: 15px; border-top: 1px solid #e5e7eb; }
    .print-btn { position: fixed; top: 15px; right: 15px; background: #f59e0b; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: 600; }
    @media print { .print-btn { display: none; } body { padding: 15px; background: white; } }
</style></head><body>
    <button class="print-btn" onclick="window.print()">🖨️ Imprimir</button>
    <div class="header">
        <h1>🗑️ Relatório de Borra e Sucata</h1>
        <p>HokkaidoMES | ${startDate || '-'} a ${endDate || '-'} | ${machine === 'all' ? 'Todas' : machine} | ${new Date().toLocaleString('pt-BR')}</p>
    </div>
    <div class="kpi-grid">
        <div class="kpi-card"><div class="value">${totalBorraKg.toFixed(3)}</div><div class="label">Total Borra (kg)</div></div>
        <div class="kpi-card"><div class="value">${borraData.length}</div><div class="label">Lançamentos Borra</div></div>
        <div class="kpi-card"><div class="value">${totalSucataKg.toFixed(3)}</div><div class="label">Total Sucata (kg)</div></div>
        <div class="kpi-card"><div class="value">${sucataData.length}</div><div class="label">Lançamentos Sucata</div></div>
    </div>
    <div class="section">
        <h2>🏭 Borra por Máquina</h2>
        <table>
            <thead><tr><th>Máquina</th><th class="text-right">Peso (kg)</th><th class="text-center">Lançamentos</th><th class="text-right">% do Total</th></tr></thead>
            <tbody>${Object.entries(borraByMachine).sort((a,b) => b[1].kg - a[1].kg).map(([m,v]) => `<tr><td><strong>${m}</strong></td><td class="text-right">${v.kg.toFixed(3)}</td><td class="text-center">${v.count}</td><td class="text-right">${totalBorraKg > 0 ? (v.kg/totalBorraKg*100).toFixed(1) : 0}%</td></tr>`).join('')}</tbody>
        </table>
    </div>
    <div class="section">
        <h2>📋 Lançamentos de Borra (${borraData.length})</h2>
        <div style="overflow-x:auto;"><table>
            <thead><tr><th>Data</th><th>Máquina</th><th class="text-right">Peso (kg)</th><th>Operador</th><th>Hora</th></tr></thead>
            <tbody>${borraData.slice(0,300).map(b => `<tr><td>${b.date || '-'}</td><td>${b.machine || '-'}</td><td class="text-right">${(b.quantityKg || 0).toFixed(3)}</td><td>${b.operatorName || b.operator || '-'}</td><td>${b.hour || '-'}</td></tr>`).join('')}</tbody>
        </table></div>
    </div>
    ${sucataData.length > 0 ? `<div class="section">
        <h2>📋 Lançamentos de Sucata (${sucataData.length})</h2>
        <div style="overflow-x:auto;"><table>
            <thead><tr><th>Data</th><th>Máquina</th><th>Tipo</th><th class="text-right">Peso (kg)</th><th>Operador</th></tr></thead>
            <tbody>${sucataData.slice(0,300).map(s => `<tr><td>${s.date || '-'}</td><td>${s.machine || '-'}</td><td>${s.type || s.tipo || '-'}</td><td class="text-right">${(s.quantityKg || s.weight || 0).toFixed(3)}</td><td>${s.operatorName || '-'}</td></tr>`).join('')}</tbody>
        </table></div>
    </div>` : ''}
    <div class="footer"><p>HokkaidoMES &copy; ${new Date().getFullYear()}</p></div>
</body></html>`);
            reportWindow.document.close();
            showNotification('📊 Relatório de borra/sucata gerado!', 'success');
        } catch (error) {
            console.error('Erro ao gerar relatório borra/sucata:', error);
            showNotification('Erro ao gerar relatório. Verifique o console.', 'error');
        }
    };

    // Relatório Consolidado (Executivo)
    window.generateConsolidatedReport = async function() {
        const { startDate, endDate, machine, shift } = currentAnalysisFilters || {};
        
        showNotification('⏳ Gerando relatório consolidado...', 'info');
        
        try {
            const [productionData, lossesData, downtimeData] = await Promise.all([
                getFilteredData('production', startDate, endDate, machine, shift),
                getFilteredData('losses', startDate, endDate, machine, shift),
                getFilteredData('downtime', startDate, endDate, machine, shift)
            ]);
            
            const totalProduced = productionData.reduce((s, i) => s + (i.quantity || 0), 0);
            const totalLossKg = lossesData.reduce((s, i) => s + (i.scrapKg || 0), 0);
            const totalLossPcs = lossesData.reduce((s, i) => s + (i.scrapPcs || 0), 0);
            const totalDowntimeMin = downtimeData.reduce((s, i) => s + (i.duration || 0), 0);
            const lossPercent = totalProduced > 0 ? (totalLossPcs / totalProduced * 100) : 0;
            
            // Top motivos de perda
            const lossReasons = {};
            lossesData.forEach(i => {
                const r = i.reason || 'N/A';
                lossReasons[r] = (lossReasons[r] || 0) + (i.scrapKg || 0);
            });
            const topLossReasons = Object.entries(lossReasons).sort((a,b) => b[1] - a[1]).slice(0, 5);
            
            // Top motivos de parada
            const dtReasons = {};
            downtimeData.forEach(i => {
                const r = i.reason || 'N/A';
                dtReasons[r] = (dtReasons[r] || 0) + (i.duration || 0);
            });
            const topDtReasons = Object.entries(dtReasons).sort((a,b) => b[1] - a[1]).slice(0, 5);
            
            // Produção por máquina
            const prodByMachine = {};
            productionData.forEach(i => {
                const m = i.machine || 'N/A';
                prodByMachine[m] = (prodByMachine[m] || 0) + (i.quantity || 0);
            });
            
            const reportWindow = window.open('', '_blank');
            if (!reportWindow) { showNotification('Popup bloqueado.', 'warning'); return; }
            
            reportWindow.document.write(`<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><title>Relatório Consolidado</title>
<style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', sans-serif; color: #333; padding: 30px; background: #f8f9fa; }
    .header { background: linear-gradient(135deg, #2563EB, #1d4ed8); color: white; padding: 25px 30px; border-radius: 12px; margin-bottom: 25px; }
    .header h1 { font-size: 22px; } .header p { opacity: 0.85; font-size: 13px; }
    .section { background: white; border-radius: 10px; padding: 20px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
    .section h2 { font-size: 16px; color: #2563EB; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid #bfdbfe; }
    .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 20px; }
    .kpi-card { border-radius: 8px; padding: 12px; text-align: center; }
    .kpi-card .value { font-size: 22px; font-weight: 700; }
    .kpi-card .label { font-size: 11px; margin-top: 4px; }
    .kpi-green { background: #f0fdf4; border: 1px solid #bbf7d0; } .kpi-green .value { color: #16a34a; } .kpi-green .label { color: #166534; }
    .kpi-red { background: #fef2f2; border: 1px solid #fecaca; } .kpi-red .value { color: #dc2626; } .kpi-red .label { color: #991b1b; }
    .kpi-orange { background: #fff7ed; border: 1px solid #fed7aa; } .kpi-orange .value { color: #ea580c; } .kpi-orange .label { color: #9a3412; }
    .kpi-blue { background: #eff6ff; border: 1px solid #bfdbfe; } .kpi-blue .value { color: #2563eb; } .kpi-blue .label { color: #1e40af; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    thead th { background: #eff6ff; color: #1e40af; padding: 8px 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #bfdbfe; }
    tbody td { padding: 6px 12px; border-bottom: 1px solid #f3f4f6; }
    .text-right { text-align: right; } .text-center { text-align: center; }
    .footer { text-align: center; color: #9ca3af; font-size: 11px; margin-top: 30px; padding-top: 15px; border-top: 1px solid #e5e7eb; }
    .print-btn { position: fixed; top: 15px; right: 15px; background: #2563eb; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: 600; }
    @media print { .print-btn { display: none; } body { padding: 15px; background: white; } }
</style></head><body>
    <button class="print-btn" onclick="window.print()">🖨️ Imprimir</button>
    <div class="header">
        <h1>📊 Relatório Consolidado - Visão Executiva</h1>
        <p>HokkaidoMES | ${startDate || '-'} a ${endDate || '-'} | ${machine === 'all' ? 'Todas as máquinas' : machine} | Turno: ${shift === 'all' ? 'Todos' : 'T' + shift} | Gerado: ${new Date().toLocaleString('pt-BR')}</p>
    </div>
    <div class="kpi-grid">
        <div class="kpi-card kpi-green"><div class="value">${totalProduced.toLocaleString()}</div><div class="label">Peças Produzidas</div></div>
        <div class="kpi-card kpi-red"><div class="value">${totalLossPcs.toLocaleString()}</div><div class="label">Peças Perdidas</div></div>
        <div class="kpi-card kpi-red"><div class="value">${totalLossKg.toFixed(3)}</div><div class="label">Refugo (kg)</div></div>
        <div class="kpi-card kpi-red"><div class="value">${lossPercent.toFixed(1)}%</div><div class="label">% Perda</div></div>
        <div class="kpi-card kpi-orange"><div class="value">${(totalDowntimeMin / 60).toFixed(1)}h</div><div class="label">Tempo Parado</div></div>
        <div class="kpi-card kpi-orange"><div class="value">${downtimeData.length}</div><div class="label">Paradas</div></div>
        <div class="kpi-card kpi-blue"><div class="value">${productionData.length}</div><div class="label">Lançamentos Prod.</div></div>
        <div class="kpi-card kpi-blue"><div class="value">${lossesData.length}</div><div class="label">Lançamentos Perda</div></div>
    </div>
    <div class="section">
        <h2>🏭 Produção por Máquina</h2>
        <table>
            <thead><tr><th>Máquina</th><th class="text-right">Peças Produzidas</th><th class="text-right">% do Total</th></tr></thead>
            <tbody>${Object.entries(prodByMachine).sort((a,b) => b[1] - a[1]).map(([m,v]) => `<tr><td><strong>${m}</strong></td><td class="text-right">${v.toLocaleString()}</td><td class="text-right">${totalProduced > 0 ? (v/totalProduced*100).toFixed(1) : 0}%</td></tr>`).join('')}</tbody>
        </table>
    </div>
    <div class="section">
        <h2>⚠️ Top 5 Motivos de Perda</h2>
        <table>
            <thead><tr><th>Motivo</th><th class="text-right">Peso (kg)</th><th class="text-right">% do Total</th></tr></thead>
            <tbody>${topLossReasons.map(([r,v]) => `<tr><td>${r}</td><td class="text-right">${v.toFixed(3)}</td><td class="text-right">${totalLossKg > 0 ? (v/totalLossKg*100).toFixed(1) : 0}%</td></tr>`).join('')}</tbody>
        </table>
    </div>
    <div class="section">
        <h2>⏸ Top 5 Motivos de Parada</h2>
        <table>
            <thead><tr><th>Motivo</th><th class="text-right">Tempo (min)</th><th class="text-right">% do Total</th></tr></thead>
            <tbody>${topDtReasons.map(([r,v]) => `<tr><td>${r}</td><td class="text-right">${v.toFixed(0)}</td><td class="text-right">${totalDowntimeMin > 0 ? (v/totalDowntimeMin*100).toFixed(1) : 0}%</td></tr>`).join('')}</tbody>
        </table>
    </div>
    <div class="footer"><p>HokkaidoMES &copy; ${new Date().getFullYear()} - Relatório Consolidado</p></div>
</body></html>`);
            reportWindow.document.close();
            showNotification('📊 Relatório consolidado gerado!', 'success');
        } catch (error) {
            console.error('Erro ao gerar relatório consolidado:', error);
            showNotification('Erro ao gerar relatório. Verifique o console.', 'error');
        }
    };

    // Gerar gráfico de perdas por tipo de matéria-prima
    async function generateLossesByMaterialChart(lossesData) {
        const ctx = document.getElementById('losses-by-material-chart');
        if (!ctx) return;

        destroyChart('losses-by-material-chart');

        if (lossesData.length === 0) {
            showNoDataMessage('losses-by-material-chart', 'Nenhuma perda com tipo de MP registrada');
            return;
        }
        
        clearNoDataMessage('losses-by-material-chart');

        // Agrupar perdas por tipo de MP
        const materialLosses = {};
        lossesData.forEach(item => {
            const mpType = item.mp_type || 'Não especificado';
            // Usar refugo_kg para perdas em kg, não quantity (que é em peças)
            materialLosses[mpType] = (materialLosses[mpType] || 0) + (item.raw?.refugo_kg || item.quantity || 0);
        });

        const labels = Object.keys(materialLosses);
        const data = Object.values(materialLosses);

        // Se não houver dados com mp_type, mostrar mensagem
        if (labels.length === 0 || (labels.length === 1 && labels[0] === 'Não especificado')) {
            showNoDataMessage('losses-by-material-chart', 'Configure o tipo de MP no planejamento para visualizar esta análise');
            return;
        }

        const isMobile = window.innerWidth < 768;

        // Cores para diferentes tipos de MP
        const colors = [
            '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'
        ];
        const totalLosses = data.reduce((sum, value) => sum + value, 0);

        renderModernDonutChart({
            canvasId: 'losses-by-material-chart',
            labels,
            data,
            colors,
            datasetLabel: 'Perdas (kg)',
            legendPosition: isMobile ? 'bottom' : 'right',
            tooltipFormatter: (context) => {
                const value = Number(context.parsed || 0);
                const percentage = totalLosses > 0 ? ((value / totalLosses) * 100).toFixed(1) : '0.0';
                return `${context.label}: ${value.toFixed(3)} kg (${percentage}%)`;
            }
        });
    }

    // ✅ NOVO: Gerar gráfico de perdas diárias
    async function generateLossesDailyChart(lossesData) {
        const ctx = document.getElementById('losses-daily-chart');
        if (!ctx) return;

        destroyChart('losses-daily-chart');

        if (!lossesData || lossesData.length === 0) {
            showNoDataMessage('losses-daily-chart', 'Nenhuma perda registrada no período');
            return;
        }
        
        clearNoDataMessage('losses-daily-chart');

        // Agrupar perdas por data
        const dailyLosses = {};
        lossesData.forEach(item => {
            // Tentar extrair a data do item
            let dateStr = item.date || item.raw?.date || item.raw?.data || '';
            
            // Se não tem data direta, tentar extrair do timestamp
            if (!dateStr && item.raw?.timestamp) {
                const ts = item.raw.timestamp?.toDate ? item.raw.timestamp.toDate() : new Date(item.raw.timestamp);
                if (ts instanceof Date && !isNaN(ts)) {
                    dateStr = ts.toISOString().split('T')[0];
                }
            }
            
            // Se ainda não tem data, usar data atual como fallback
            if (!dateStr) {
                dateStr = new Date().toISOString().split('T')[0];
            }
            
            // Usar refugo_kg para perdas em kg
            const lossKg = item.raw?.refugo_kg || item.quantity || 0;
            dailyLosses[dateStr] = (dailyLosses[dateStr] || 0) + lossKg;
        });

        // Ordenar as datas
        const sortedDates = Object.keys(dailyLosses).sort((a, b) => new Date(a) - new Date(b));
        
        // Formatar labels para exibição (DD/MM)
        const labels = sortedDates.map(date => {
            const parts = date.split('-');
            if (parts.length === 3) {
                return `${parts[2]}/${parts[1]}`;
            }
            return date;
        });
        
        const data = sortedDates.map(date => dailyLosses[date]);

        // Calcular média para linha de referência
        const avgLoss = data.length > 0 ? data.reduce((sum, val) => sum + val, 0) / data.length : 0;
        const avgLine = data.map(() => avgLoss);

        const isMobile = window.innerWidth < 768;

        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Perdas (kg)',
                        data: data,
                        backgroundColor: 'rgba(59, 130, 246, 0.7)',
                        borderColor: '#3B82F6',
                        borderWidth: 1,
                        borderRadius: 4,
                        order: 2
                    },
                    {
                        label: `Média (${avgLoss.toFixed(2)} kg)`,
                        data: avgLine,
                        type: 'line',
                        borderColor: '#EF4444',
                        borderWidth: 2,
                        borderDash: [5, 5],
                        pointRadius: 0,
                        fill: false,
                        order: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            font: {
                                size: isMobile ? 9 : 11
                            },
                            maxRotation: 45,
                            minRotation: 0
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        },
                        ticks: {
                            font: {
                                size: isMobile ? 10 : 12
                            },
                            callback: function(value) {
                                return value.toFixed(1) + ' kg';
                            }
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            padding: 15,
                            font: {
                                size: isMobile ? 10 : 12
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleFont: { size: 13 },
                        bodyFont: { size: 12 },
                        padding: 12,
                        callbacks: {
                            label: function(context) {
                                const value = context.parsed.y;
                                if (context.dataset.label.includes('Média')) {
                                    return `Média: ${value.toFixed(2)} kg`;
                                }
                                return `Perdas: ${value.toFixed(3)} kg`;
                            }
                        }
                    }
                }
            }
        });
    }

    // Variável para armazenar dados de downtime e modo atual do gráfico
    let cachedDowntimeDataForChart = [];
    let downtimeChartMode = 'category'; // 'category' ou 'reason'

    // Gerar gráfico de paradas por CATEGORIA ou MOTIVO
    async function generateDowntimeReasonsChart(downtimeData, mode = null) {
        const ctx = document.getElementById('downtime-reasons-chart');
        if (!ctx) return;

        // Se recebeu novos dados, SUBSTITUIR o cache (nunca mesclar com dados antigos)
        if (downtimeData !== null && downtimeData !== undefined) {
            cachedDowntimeDataForChart = Array.isArray(downtimeData) ? [...downtimeData] : [];
            console.log('[generateDowntimeReasonsChart] Cache atualizado com', cachedDowntimeDataForChart.length, 'eventos');
        }
        
        // Usar modo passado ou o modo atual
        if (mode) {
            downtimeChartMode = mode;
        }

        destroyChart('downtime-reasons-chart');

        if (cachedDowntimeDataForChart.length === 0) {
            showNoDataMessage('downtime-reasons-chart');
            return;
        }
        
        clearNoDataMessage('downtime-reasons-chart');

        let labels, data, colors;
        const isMobile = window.innerWidth < 768;
        
        // Cores para cada categoria - Sincronizadas com status do Dashboard TV
        // Usar cores do database.js se disponíveis
        const dbColors = window.databaseModule?.downtimeReasonColors || {};
        const categoryColors = {
            'FERRAMENTARIA': '#ff1744',      // Status Critical - Vermelho
            'PROCESSO': '#7c4dff',            // Status Maintenance - Roxo
            'COMPRAS': '#ffab00',             // Status Warning - Amarelo
            'PREPARAÇÃO': '#ffab00',          // Status Warning - Amarelo
            'QUALIDADE': '#7c4dff',           // Status Maintenance - Roxo
            'MANUTENÇÃO': '#ff1744',          // Status Critical - Vermelho
            'PRODUÇÃO': '#00e676',            // Status Running - Verde
            'SETUP': '#ffab00',               // Status Warning - Amarelo
            'ADMINISTRATIVO': '#78909c',      // Status Idle - Cinza
            'PCP': '#78909c',                 // Status Idle - Cinza
            'COMERCIAL': '#00bcd4',           // Status Comercial - Ciano
            'OUTROS': '#9e9e9e'               // Status Outros - Cinza médio
        };

        if (downtimeChartMode === 'category') {
            // Agrupar por CATEGORIA
            const categoryDurations = {};
            cachedDowntimeDataForChart.forEach(item => {
                const reason = item.reason || 'Sem motivo';
                const category = getDowntimeCategory(reason);
                categoryDurations[category] = (categoryDurations[category] || 0) + (item.duration || 0);
            });

            labels = Object.keys(categoryDurations);
            data = Object.values(categoryDurations).map(d => Number(((d || 0) / 60).toFixed(2)));
            colors = labels.map(label => categoryColors[label] || '#6B7280');
        } else {
            // Agrupar por MOTIVO individual
            const reasonDurations = {};
            cachedDowntimeDataForChart.forEach(item => {
                const reason = item.reason || 'Sem motivo';
                reasonDurations[reason] = (reasonDurations[reason] || 0) + (item.duration || 0);
            });

            // Ordenar por duração (maior primeiro) e pegar os top 12
            const sortedReasons = Object.entries(reasonDurations)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 12);
            
            labels = sortedReasons.map(([reason]) => reason);
            data = sortedReasons.map(([, duration]) => Number(((duration || 0) / 60).toFixed(2)));
            
            // Atribuir cores baseadas na categoria de cada motivo
            colors = labels.map(reason => {
                const category = getDowntimeCategory(reason);
                return categoryColors[category] || '#6B7280';
            });
        }

        const totalHours = data.reduce((sum, value) => sum + value, 0);

        renderModernDonutChart({
            canvasId: 'downtime-reasons-chart',
            labels,
            data,
            colors: colors,
            datasetLabel: 'Paradas (h)',
            legendPosition: isMobile ? 'bottom' : 'right',
            tooltipFormatter: (context) => {
                const value = Number(context.parsed || 0);
                const percentage = totalHours > 0 ? ((value / totalHours) * 100).toFixed(1) : '0.0';
                return `${context.label}: ${value.toFixed(1)} h (${percentage}%)`;
            }
        });
    }

    // Setup dos botões de toggle do gráfico de paradas
    function setupDowntimeChartToggle() {
        const btnCategory = document.getElementById('btn-chart-category');
        const btnReason = document.getElementById('btn-chart-reason');
        
        if (!btnCategory || !btnReason) return;
        
        const updateToggleStyles = (activeBtn, inactiveBtn) => {
            activeBtn.classList.remove('text-gray-500', 'hover:text-gray-700');
            activeBtn.classList.add('bg-white', 'text-gray-800', 'shadow-sm');
            inactiveBtn.classList.remove('bg-white', 'text-gray-800', 'shadow-sm');
            inactiveBtn.classList.add('text-gray-500', 'hover:text-gray-700');
        };
        
        btnCategory.onclick = () => {
            if (downtimeChartMode === 'category') return;
            updateToggleStyles(btnCategory, btnReason);
            generateDowntimeReasonsChart(null, 'category');
        };
        
        btnReason.onclick = () => {
            if (downtimeChartMode === 'reason') return;
            updateToggleStyles(btnReason, btnCategory);
            generateDowntimeReasonsChart(null, 'reason');
        };
    }

    // Gerar gráfico de paradas por máquina
    async function generateDowntimeByMachineChart(downtimeData) {
        const ctx = document.getElementById('downtime-by-machine-chart');
        if (!ctx) return;

        destroyChart('downtime-by-machine-chart');

        if (downtimeData.length === 0) {
            showNoDataMessage('downtime-by-machine-chart');
            return;
        }
        
        clearNoDataMessage('downtime-by-machine-chart');

        const machineDowntime = {};
        downtimeData.forEach(item => {
            const machine = item.machine || 'Sem máquina';
            machineDowntime[machine] = (machineDowntime[machine] || 0) + (item.duration || 0);
        });

        const labels = Object.keys(machineDowntime);
        const data = Object.values(machineDowntime).map(d => (d / 60).toFixed(1)); // Converter para horas

        const isMobile = window.innerWidth < 768;

        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Tempo de Parada (h)',
                    data: data,
                    backgroundColor: 'rgba(239, 68, 68, 0.8)',
                    borderColor: '#EF4444',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,

                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            font: {
                                size: isMobile ? 10 : 12
                            },
                            callback: function(value) {
                                return value + 'h';
                            }
                        }
                    },
                    x: {
                        ticks: {
                            font: {
                                size: isMobile ? 10 : 12
                            }
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    }

    // Gerar timeline de paradas
    async function generateDowntimeTimelineChart(downtimeData) {
        const ctx = document.getElementById('downtime-timeline-chart');
        if (!ctx) {
            console.error('[TIMELINE] Canvas não encontrado: downtime-timeline-chart');
            return;
        }

        destroyChart('downtime-timeline-chart');

        console.log('[TIMELINE] Dados recebidos:', downtimeData.length, 'registros');
        
        if (downtimeData.length === 0) {
            console.warn('[TIMELINE] Nenhum dado de parada para mostrar');
            showNoDataMessage('downtime-timeline-chart');
            return;
        }
        
        // Log amostra de dados para debug
        if (downtimeData.length > 0) {
            console.log('[TIMELINE] Amostra de dados:', JSON.stringify(downtimeData.slice(0, 3), null, 2));
        }
        
        clearNoDataMessage('downtime-timeline-chart');

        // Limitar aos últimos 20 eventos para visualização
        const recentDowntimes = downtimeData.slice(-20).reverse();
        
        console.log('[TIMELINE] Paradas recentes:', recentDowntimes.length);
        
        const labels = recentDowntimes.map((item, index) => {
            const dateStr = item.date || item.workDay || '';
            let dateLabel;
            try {
                const date = dateStr ? new Date(dateStr) : new Date();
                dateLabel = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
            } catch (e) {
                dateLabel = dateStr;
            }
            return `${dateLabel} - ${item.machine || 'Máq'}`;
        });
        
        const data = recentDowntimes.map(item => item.duration || 0);
        
        console.log('[TIMELINE] Labels:', labels);
        console.log('[TIMELINE] Durações:', data);

        const isMobile = window.innerWidth < 768;

        try {
            new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Duração (min)',
                        data: data,
                        backgroundColor: recentDowntimes.map(item => {
                            const duration = item.duration || 0;
                            if (duration > 120) return '#EF4444'; // Vermelho para >2h
                            if (duration > 60) return '#F59E0B'; // Amarelo para >1h
                            return '#10B981'; // Verde para <1h
                        }),
                        borderWidth: 1,
                        borderColor: '#fff'
                    }]
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: {
                            beginAtZero: true,
                            ticks: {
                                font: {
                                    size: isMobile ? 10 : 12
                                }
                            }
                        },
                        y: {
                            ticks: {
                                font: {
                                    size: isMobile ? 8 : 10
                                }
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const item = recentDowntimes[context.dataIndex];
                                    return [
                                        `Duração: ${context.parsed.x} min`,
                                        `Motivo: ${item.reason || 'Não informado'}`
                                    ];
                                }
                            }
                        }
                    }
                }
            });
            console.log('[TIMELINE] Gráfico criado com sucesso');
        } catch (error) {
            console.error('[TIMELINE] Erro ao criar gráfico:', error);
        }
    }

    // Gerar gráfico de borra por motivo
    async function generateBorraByReasonChart(borraData) {
        const ctx = document.getElementById('borra-by-reason-chart');
        if (!ctx) return;

        destroyChart('borra-by-reason-chart');

        if (borraData.length === 0) {
            showNoDataMessage('borra-by-reason-chart');
            return;
        }
        
        clearNoDataMessage('borra-by-reason-chart');

        const reasonCounts = {};
        borraData.forEach(item => {
            let reason = item.reason || item.raw?.perdas || 'Não especificado';
            // Remover prefixo "BORRA - " se existir
            reason = reason.replace(/^BORRA\s*-\s*/i, '');
            const weight = item.raw?.refugo_kg || item.raw?.quantityKg || item.scrapKg || item.quantity || 0;
            reasonCounts[reason] = (reasonCounts[reason] || 0) + weight;
        });

        const sortedReasons = Object.entries(reasonCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 8); // Top 8 motivos

        const labels = sortedReasons.map(([reason]) => reason);
        const data = sortedReasons.map(([,weight]) => weight);

        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Borra (kg)',
                    data: data,
                    backgroundColor: 'rgba(251, 191, 36, 0.8)',
                    borderColor: '#F59E0B',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: {
                            font: { size: window.innerWidth < 768 ? 10 : 12 }
                        }
                    },
                    y: {
                        ticks: {
                            font: { size: window.innerWidth < 768 ? 9 : 11 }
                        }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.parsed.x.toFixed(1)} kg`;
                            }
                        }
                    }
                }
            }
        });
    }

    // Gerar gráfico de borra por máquina
    async function generateBorraByMachineChart(borraData) {
        const ctx = document.getElementById('borra-by-machine-chart');
        if (!ctx) return;

        destroyChart('borra-by-machine-chart');

        if (borraData.length === 0) {
            showNoDataMessage('borra-by-machine-chart');
            return;
        }
        
        clearNoDataMessage('borra-by-machine-chart');

        const machineCounts = {};
        borraData.forEach(item => {
            const machine = item.machine || 'Não especificado';
            const weight = item.raw?.refugo_kg || item.raw?.quantityKg || item.scrapKg || item.quantity || 0;
            machineCounts[machine] = (machineCounts[machine] || 0) + weight;
        });

        const labels = Object.keys(machineCounts);
        const data = Object.values(machineCounts);

        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Borra (kg)',
                    data: data,
                    backgroundColor: 'rgba(251, 191, 36, 0.8)',
                    borderColor: '#F59E0B',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            font: { size: window.innerWidth < 768 ? 10 : 12 }
                        }
                    },
                    x: {
                        ticks: {
                            font: { size: window.innerWidth < 768 ? 10 : 12 }
                        }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.parsed.y.toFixed(1)} kg`;
                            }
                        }
                    }
                }
            }
        });
    }

    // Gerar gráfico de borra mensal com acumulado
    async function generateBorraMonthlyChart(borraData) {
        const ctx = document.getElementById('borra-monthly-chart');
        if (!ctx) return;

        destroyChart('borra-monthly-chart');

        if (borraData.length === 0) {
            showNoDataMessage('borra-monthly-chart');
            return;
        }
        
        clearNoDataMessage('borra-monthly-chart');

        // Agrupar por mês
        const monthlyData = {};
        const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        
        borraData.forEach(item => {
            const raw = item.raw || {};
            let date = null;
            
            // Extrair data do registro
            if (raw.date?.toDate) {
                date = raw.date.toDate();
            } else if (raw.datetime?.toDate) {
                date = raw.datetime.toDate();
            } else if (raw.timestamp?.toDate) {
                date = raw.timestamp.toDate();
            } else if (typeof raw.date === 'string') {
                date = new Date(raw.date);
            } else if (typeof raw.datetime === 'string') {
                date = new Date(raw.datetime);
            }
            
            if (!date || isNaN(date.getTime())) {
                date = new Date(); // Fallback para data atual
            }
            
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            const weight = raw.refugo_kg || raw.quantityKg || item.scrapKg || item.quantity || 0;
            
            if (!monthlyData[monthKey]) {
                monthlyData[monthKey] = {
                    month: monthNames[date.getMonth()],
                    year: date.getFullYear(),
                    total: 0
                };
            }
            monthlyData[monthKey].total += weight;
        });

        // Ordenar por data e pegar últimos 6 meses
        const sortedMonths = Object.keys(monthlyData).sort().slice(-6);
        const labels = sortedMonths.map(key => `${monthlyData[key].month}/${String(monthlyData[key].year).slice(-2)}`);
        const monthlyTotals = sortedMonths.map(key => monthlyData[key].total);
        
        // Calcular acumulado
        const accumulated = [];
        let runningTotal = 0;
        monthlyTotals.forEach(val => {
            runningTotal += val;
            accumulated.push(runningTotal);
        });

        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Mensal (kg)',
                        data: monthlyTotals,
                        backgroundColor: 'rgba(251, 191, 36, 0.8)',
                        borderColor: '#F59E0B',
                        borderWidth: 1,
                        order: 2
                    },
                    {
                        label: 'Acumulado (kg)',
                        data: accumulated,
                        type: 'line',
                        borderColor: '#DC2626',
                        backgroundColor: 'rgba(220, 38, 38, 0.1)',
                        borderWidth: 2,
                        fill: false,
                        tension: 0.3,
                        pointRadius: 4,
                        pointBackgroundColor: '#DC2626',
                        yAxisID: 'y1',
                        order: 1
                    },
                    {
                        label: 'Meta (450 kg)',
                        data: labels.map(() => 450),
                        type: 'line',
                        borderColor: '#EF4444',
                        borderWidth: 2,
                        borderDash: [5, 5],
                        pointRadius: 0,
                        fill: false,
                        order: 0
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: 'Mensal (kg)',
                            font: { size: 10 }
                        },
                        ticks: {
                            font: { size: window.innerWidth < 768 ? 9 : 10 }
                        }
                    },
                    y1: {
                        beginAtZero: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Acumulado (kg)',
                            font: { size: 10 }
                        },
                        grid: {
                            drawOnChartArea: false
                        },
                        ticks: {
                            font: { size: window.innerWidth < 768 ? 9 : 10 }
                        }
                    },
                    x: {
                        ticks: {
                            font: { size: window.innerWidth < 768 ? 9 : 10 }
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            boxWidth: 12,
                            font: { size: 10 }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.dataset.label}: ${context.parsed.y.toFixed(1)} kg`;
                            }
                        }
                    }
                }
            }
        });
    }

    // Variáveis globais para paginação da tabela de borra
    let borraTableData = [];
    let borraTableCurrentPage = 1;
    const borraTablePageSize = 10;

    // Função para preencher a tabela de apontamentos de borra
    async function populateBorraApontamentosTable(borraData) {
        const tableBody = document.getElementById('borra-apontamentos-table');
        if (!tableBody) return;

        // Preparar dados da tabela
        borraTableData = borraData.map(item => {
            const raw = item.raw || {};
            
            // Extrair data/hora
            let dateTime = '---';
            if (raw.date || raw.datetime) {
                const dateStr = raw.date || raw.datetime;
                if (dateStr?.toDate) {
                    const d = dateStr.toDate();
                    dateTime = `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
                } else if (typeof dateStr === 'string') {
                    dateTime = dateStr;
                }
            } else if (raw.timestamp?.toDate) {
                const d = raw.timestamp.toDate();
                dateTime = `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
            }

            // Extrair motivo (removendo prefixo BORRA)
            let reason = item.reason || raw.perdas || raw.motivo || 'Não especificado';
            reason = reason.replace(/^BORRA\s*-\s*/i, '');

            return {
                dateTime: dateTime,
                machine: item.machine || raw.machine_id || raw.maquina || '---',
                reason: reason,
                material: item.material || raw.mp || raw.materia_prima || '---',
                quantity: raw.refugo_kg || raw.quantityKg || item.scrapKg || item.quantity || 0,
                operator: raw.operator || raw.operador || raw.user || '---',
                shift: raw.turno || raw.shift || '---'
            };
        }).sort((a, b) => {
            // Ordenar por data mais recente primeiro
            if (a.dateTime === '---') return 1;
            if (b.dateTime === '---') return -1;
            return b.dateTime.localeCompare(a.dateTime);
        });

        borraTableCurrentPage = 1;
        renderBorraTable();
    }

    // Função para renderizar a tabela de borra
    function renderBorraTable() {
        const tableBody = document.getElementById('borra-apontamentos-table');
        if (!tableBody) return;

        const totalItems = borraTableData.length;
        const totalPages = Math.ceil(totalItems / borraTablePageSize);
        const startIndex = (borraTableCurrentPage - 1) * borraTablePageSize;
        const endIndex = Math.min(startIndex + borraTablePageSize, totalItems);
        const pageData = borraTableData.slice(startIndex, endIndex);

        if (totalItems === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="4" class="px-4 py-8 text-center text-gray-400">
                        <i data-lucide="inbox" class="w-8 h-8 mx-auto mb-2"></i>
                        <p>Nenhum apontamento de borra encontrado no período</p>
                    </td>
                </tr>
            `;
            if (typeof lucide !== "undefined") lucide.createIcons();
        } else {
            tableBody.innerHTML = pageData.map((row, idx) => `
                <tr class="hover:bg-amber-50/50 transition ${idx % 2 === 0 ? 'bg-white' : 'bg-amber-50/30'}">
                    <td class="px-4 py-3 text-gray-700 text-xs">${row.dateTime}</td>
                    <td class="px-4 py-3">
                        <span class="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">${row.machine}</span>
                    </td>
                    <td class="px-4 py-3 text-center">
                        <span class="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs font-semibold">${parseFloat(row.quantity).toFixed(3)}</span>
                    </td>
                    <td class="px-4 py-3">
                        <span class="px-2 py-1 ${getTurnoColor(row.shift)} rounded text-xs font-medium">${row.shift}</span>
                    </td>
                </tr>
            `).join('');
        }

        // Atualizar informações de paginação
        const showingEl = document.getElementById('borra-table-showing');
        const totalEl = document.getElementById('borra-table-total');
        const pageEl = document.getElementById('borra-table-page');
        const prevBtn = document.getElementById('borra-table-prev');
        const nextBtn = document.getElementById('borra-table-next');

        if (showingEl) showingEl.textContent = totalItems > 0 ? `${startIndex + 1}-${endIndex}` : '0';
        if (totalEl) totalEl.textContent = totalItems;
        if (pageEl) pageEl.textContent = `Página ${borraTableCurrentPage} de ${totalPages || 1}`;
        if (prevBtn) prevBtn.disabled = borraTableCurrentPage <= 1;
        if (nextBtn) nextBtn.disabled = borraTableCurrentPage >= totalPages;

        // Reinicializar ícones Lucide
        if (typeof lucide !== 'undefined') {
            if (typeof lucide !== "undefined") lucide.createIcons();
        }
    }

    // Função auxiliar para cor do turno
    function getTurnoColor(turno) {
        const turnoLower = (turno || '').toString().toLowerCase();
        if (turnoLower.includes('a') || turnoLower.includes('1') || turnoLower.includes('manhã') || turnoLower.includes('manha')) {
            return 'bg-green-100 text-green-700';
        } else if (turnoLower.includes('b') || turnoLower.includes('2') || turnoLower.includes('tarde')) {
            return 'bg-blue-100 text-blue-700';
        } else if (turnoLower.includes('c') || turnoLower.includes('3') || turnoLower.includes('noite')) {
            return 'bg-purple-100 text-purple-700';
        }
        return 'bg-gray-100 text-gray-700';
    }

    // Funções de navegação da tabela
    function borraTableNextPage() {
        const totalPages = Math.ceil(borraTableData.length / borraTablePageSize);
        if (borraTableCurrentPage < totalPages) {
            borraTableCurrentPage++;
            renderBorraTable();
        }
    }

    function borraTablePrevPage() {
        if (borraTableCurrentPage > 1) {
            borraTableCurrentPage--;
            renderBorraTable();
        }
    }

    // Função para exportar tabela de borra
    function exportBorraTable() {
        if (borraTableData.length === 0) {
            showNotification('Não há dados para exportar', 'warning');
            return;
        }

        const headers = ['Data/Hora', 'Máquina', 'Quantidade (kg)', 'Turno'];
        const csvContent = [
            headers.join(';'),
            ...borraTableData.map(row => [
                row.dateTime,
                row.machine,
                parseFloat(row.quantity).toFixed(3).replace('.', ','),
                row.shift
            ].join(';'))
        ].join('\n');

        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `apontamentos_borra_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showNotification('Exportação concluída!', 'success');
    }

    // Função para calcular OEE detalhado
    async function calculateDetailedOEE(startDate, endDate, machine, shift) {
        try {
            // Normalizar shift: se não está definido ou é null, usar 'all'
            const normalizedShift = shift === undefined || shift === null || shift === '' ? 'all' : shift;
            
            console.log('[TRACE][calculateDetailedOEE] Buscando dados para:', { startDate, endDate, machine, shift: normalizedShift });
            
            const [productionData, lossesData, downtimeData, planData] = await Promise.all([
                getFilteredData('production', startDate, endDate, machine, 'all'),
                getFilteredData('losses', startDate, endDate, machine, 'all'),
                getFilteredData('downtime', startDate, endDate, machine, 'all'),
                getFilteredData('plan', startDate, endDate, machine, 'all')
            ]);

            console.log('[TRACE][calculateDetailedOEE] Dados recebidos:', {
                production: productionData.length,
                losses: lossesData.length,
                downtime: downtimeData.length,
                plan: planData.length
            });

            if (productionData.length === 0 && lossesData.length === 0 && downtimeData.length === 0) {
                console.warn('[TRACE][calculateDetailedOEE] PROBLEMA: Nenhum dado encontrado para o período!');
                return { availability: 0, performance: 0, quality: 0, oee: 0 };
            }

            const { filtered, groups } = aggregateOeeMetrics(
                productionData,
                lossesData,
                downtimeData,
                planData,
                normalizedShift  // <-- usar normalizedShift em vez de shift
            );

            console.log('[TRACE][calculateDetailedOEE] Resultado da agregação:', {
                gruposProcessados: groups.length,
                disponibilidade: (filtered.disponibilidade * 100).toFixed(1),
                performance: (filtered.performance * 100).toFixed(1),
                qualidade: (filtered.qualidade * 100).toFixed(1),
                oee: (filtered.oee * 100).toFixed(1)
            });

            // CORREÇÃO: Se todos os valores estão zero mas há dados, algo está errado
            if (filtered.disponibilidade === 0 && filtered.performance === 0 && filtered.qualidade === 0 && productionData.length > 0) {
                console.error('[TRACE][calculateDetailedOEE] PROBLEMA CRÍTICO: Valores zerados com dados disponíveis!');
                console.log('[TRACE][calculateDetailedOEE] Amostra production:', productionData.slice(0, 3));
                console.log('[TRACE][calculateDetailedOEE] Amostra plan:', planData.slice(0, 3));
            }

            const availability = filtered.disponibilidade * 100;
            const performance = filtered.performance * 100;
            const quality = filtered.qualidade * 100;

            return {
                availability: availability,
                performance: performance,
                quality: quality,
                oee: filtered.oee * 100  // Média ponderada dos OEEs individuais
            };
        } catch (error) {
            console.error('Erro ao calcular OEE detalhado:', error);
            return { availability: 0, performance: 0, quality: 0, oee: 0 };
        }
    }

    // Função de comparação por máquinas
    async function compareByMachines(metric, startDate, endDate) {
        const machineIds = machines.map(m => m.id);
        const results = [];

        for (const machineId of machineIds) {
            const data = await getFilteredData('production', startDate, endDate, machineId, 'all');
            const value = data.reduce((sum, item) => sum + item.quantity, 0);
            
            results.push({
                name: machines.find(m => m.id === machineId)?.name || machineId,
                value: value
            });
        }

        return results.sort((a, b) => b.value - a.value);
    }

    // Gerar gráfico de comparação
    async function generateComparisonChart(data, metric) {
        const ctx = document.getElementById('comparison-chart');
        if (!ctx) return;

        destroyChart('comparison-chart');

        if (!data || data.length === 0) {
            showNoDataMessage('comparison-chart');
            return;
        }
        
        clearNoDataMessage('comparison-chart');

        const labels = data.map(item => item.name);
        const values = data.map(item => item.value);

        const isMobile = window.innerWidth < 768;

        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: metric.toUpperCase(),
                    data: values,
                    backgroundColor: 'rgba(59, 130, 246, 0.8)',
                    borderColor: '#3B82F6',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,

                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            font: {
                                size: isMobile ? 10 : 12
                            }
                        }
                    },
                    x: {
                        ticks: {
                            maxRotation: isMobile ? 45 : 0,
                            minRotation: isMobile ? 45 : 0,
                            font: {
                                size: isMobile ? 10 : 12
                            }
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    }

    // Gerar ranking de comparação
    function generateComparisonRanking(data) {
        const container = document.getElementById('comparison-ranking');
        if (!container) return;

        const html = data.slice(0, 5).map((item, index) => `
            <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div class="flex items-center gap-3">
                    <span class="w-6 h-6 bg-primary-blue text-white rounded-full text-sm flex items-center justify-center font-bold">
                        ${index + 1}
                    </span>
                    <span class="font-medium">${item.name}</span>
                </div>
                <span class="text-lg font-bold text-gray-800">${item.value.toLocaleString()}</span>
            </div>
        `).join('');

        container.innerHTML = html;
    }

    // Gerar estatísticas de comparação
    function generateComparisonStats(data) {
        const container = document.getElementById('comparison-stats');
        if (!container) return;

        const values = data.map(item => item.value);
        const max = Math.max(...values);
        const min = Math.min(...values);
        const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
        const range = max - min;

        const html = `
            <div class="space-y-3">
                <div class="flex justify-between">
                    <span class="text-gray-600">Maior valor:</span>
                    <span class="font-bold">${max.toLocaleString()}</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-gray-600">Menor valor:</span>
                    <span class="font-bold">${min.toLocaleString()}</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-gray-600">Média:</span>
                    <span class="font-bold">${avg.toFixed(0).toLocaleString()}</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-gray-600">Amplitude:</span>
                    <span class="font-bold">${range.toLocaleString()}</span>
                </div>
            </div>
        `;

        container.innerHTML = html;
    }

    // Implementações faltantes para análise completa

    // Gerar timeline de componentes OEE
    async function generateOEEComponentsTimeline(startDate, endDate, machine) {
        const ctx = document.getElementById('oee-components-timeline');
        if (!ctx) return;

        destroyChart('oee-components-timeline');

        // Buscar dados para calcular componentes OEE ao longo do tempo
        const productionData = await getFilteredData('production', startDate, endDate, machine);
        const downtimeData = await getFilteredData('downtime', startDate, endDate, machine);
        const planDataTimeline = await getFilteredData('plan', startDate, endDate, machine);

        if (productionData.length === 0) {
            showNoDataMessage('oee-components-timeline');
            return;
        }
        
        clearNoDataMessage('oee-components-timeline');

        // Agrupar por data
        const dataByDate = {};
        
        productionData.forEach(item => {
            const date = item.date || '';
            if (!dataByDate[date]) {
                dataByDate[date] = {
                    produced: 0,
                    scrap: 0,
                    planned: 0,
                    downtime: 0
                };
            }
            dataByDate[date].produced += item.quantity || 0;
            dataByDate[date].scrap += item.scrap || 0;
            dataByDate[date].planned += item.planned || item.quantity || 0;
        });

        // Obter categorias excluídas do OEE
        const oeeExcludedCategoriesTimeline = window.databaseModule?.oeeExcludedCategories || [];

        downtimeData.forEach(item => {
            const date = item.date || '';
            if (dataByDate[date]) {
                // Verificar se a categoria deve ser excluída do cálculo de OEE
                const reason = item.reason || '';
                const category = getDowntimeCategory(reason);
                if (oeeExcludedCategoriesTimeline.includes(category)) {
                    // Parada de categoria excluída - NÃO contabilizar no OEE
                    return;
                }
                dataByDate[date].downtime += item.duration || 0;
            }
        });

        // Ordenar datas
        const sortedDates = Object.keys(dataByDate).sort();
        const dates = sortedDates.map(date => {
            const [year, month, day] = date.split('-');
            return `${day}/${month}`;
        });
        
        const availabilityData = [];
        const performanceData = [];
        const qualityData = [];

        sortedDates.forEach(date => {
            const data = dataByDate[date];
            
            // Disponibilidade: tempo disponível / tempo planejado
            const plannedMinutes = 480; // 8 horas por turno
            const availability = Math.max(0, Math.min(100, ((plannedMinutes - data.downtime) / plannedMinutes) * 100));
            
            // Performance: capacidade teórica baseada em ciclo/cavidades (FIX: era prod/planned)
            const datePlan = (planDataTimeline || []).find(p => p.date === date || p.workDay === date);
            const rawPlan = datePlan?.raw || datePlan || {};
            const ciclo = Number(rawPlan.budgeted_cycle) || 30;
            const cav = Number(rawPlan.mold_cavities) || 2;
            const tempoDisp = Math.max(0, plannedMinutes - data.downtime);
            const capTeorica = (ciclo > 0 && cav > 0) ? (tempoDisp * 60 / ciclo) * cav : 0;
            const performance = capTeorica > 0 ? Math.min(100, (data.produced / capTeorica) * 100) : (data.produced > 0 ? 100 : 0);
            
            // Qualidade: produzido / (produzido + refugo) — consistente com calculateShiftOEE
            const totalProduzido = data.produced + Math.max(0, data.scrap || 0);
            const quality = totalProduzido > 0 ? (data.produced / totalProduzido) * 100 : 100;
            
            availabilityData.push(availability.toFixed(1));
            performanceData.push(performance.toFixed(1));
            qualityData.push(quality.toFixed(1));
        });

        const isMobile = window.innerWidth < 768;

        new Chart(ctx, {
            type: 'line',
            data: {
                labels: dates,
                datasets: [{
                    label: 'Disponibilidade %',
                    data: availabilityData,
                    borderColor: '#10B981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 2,
                    fill: false,
                    pointRadius: isMobile ? 2 : 4,
                    pointHoverRadius: isMobile ? 4 : 6,
                    tension: 0.3
                }, {
                    label: 'Performance %',
                    data: performanceData,
                    borderColor: '#3B82F6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 2,
                    fill: false,
                    pointRadius: isMobile ? 2 : 4,
                    pointHoverRadius: isMobile ? 4 : 6,
                    tension: 0.3
                }, {
                    label: 'Qualidade %',
                    data: qualityData,
                    borderColor: '#F59E0B',
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    borderWidth: 2,
                    fill: false,
                    pointRadius: isMobile ? 2 : 4,
                    pointHoverRadius: isMobile ? 4 : 6,
                    tension: 0.3
                }]
            },
            options: {
                responsive: true,

                scales: {
                    y: {
                        beginAtZero: false,
                        min: 0,
                        max: 100,
                        ticks: {
                            font: {
                                size: isMobile ? 10 : 12
                            },
                            callback: function(value) {
                                return value + '%';
                            }
                        }
                    },
                    x: {
                        ticks: {
                            maxRotation: isMobile ? 45 : 0,
                            minRotation: isMobile ? 45 : 0,
                            font: {
                                size: isMobile ? 9 : 11
                            }
                        }
                    }
                },
                plugins: {
                    legend: {
                        position: isMobile ? 'bottom' : 'top',
                        labels: {
                            font: {
                                size: isMobile ? 10 : 12
                            },
                            padding: isMobile ? 8 : 10
                        }
                    }
                }
            }
        });
    }

    // Gerar mapa de calor OEE
    async function generateOEEHeatmap(startDate, endDate, machineFilter = 'all') {
        const container = document.getElementById('oee-heatmap');
        if (!container) return;

        const normalizedMachine = (machineFilter && machineFilter !== 'all') ? machineFilter : 'all';

        try {
            const [productionData, lossesData, downtimeData, planData] = await Promise.all([
                getFilteredData('production', startDate, endDate, normalizedMachine, 'all'),
                getFilteredData('losses', startDate, endDate, normalizedMachine, 'all'),
                getFilteredData('downtime', startDate, endDate, normalizedMachine, 'all'),
                getFilteredData('plan', startDate, endDate, normalizedMachine, 'all')
            ]);

            const { groups } = aggregateOeeMetrics(
                productionData,
                lossesData,
                downtimeData,
                planData,
                'all'
            );

            if (!Array.isArray(groups) || groups.length === 0) {
                container.innerHTML = `
                    <div class="p-6 text-center text-sm text-slate-500 bg-slate-100 rounded-lg">
                        Nenhum dado de OEE encontrado para o período selecionado.
                    </div>
                `;
                return;
            }

            const shiftLabels = [
                { key: 1, label: '1º Turno' },
                { key: 2, label: '2º Turno' },
                { key: 3, label: '3º Turno' }
            ];

            const machineMap = new Map();
            const groupsMap = new Map();

            groups.forEach(item => {
                const machineId = item.machine || 'Sem máquina';
                machineMap.set(machineId, machineId);
                const groupKey = `${machineId}__${item.shift}`;
                groupsMap.set(groupKey, {
                    oee: Number(item.oee) * 100,
                    disponibilidade: Number(item.disponibilidade) * 100,
                    performance: Number(item.performance) * 100,
                    qualidade: Number(item.qualidade) * 100
                });
            });

            let machinesSorted = Array.from(machineMap.values());
            const hasMachineFilter = normalizedMachine !== 'all';
            if (!hasMachineFilter) {
                machinesSorted.sort((a, b) => a.localeCompare(b));
            }

            const resolveColorClass = (value) => {
                if (!Number.isFinite(value)) return 'bg-slate-200 text-slate-500';
                if (value >= 80) return 'bg-emerald-500 text-white';
                if (value >= 70) return 'bg-yellow-400 text-slate-900';
                if (value >= 60) return 'bg-orange-500 text-white';
                return 'bg-red-500 text-white';
            };

            let html = `
                <div class="overflow-x-auto">
                    <table class="min-w-full">
                        <thead>
                            <tr>
                                <th class="px-4 py-2 text-left">Máquina / Turno</th>
                                ${shiftLabels.map(shift => `<th class="px-4 py-2 text-center">${shift.label}</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>
            `;

            machinesSorted.forEach(machineId => {
                html += `<tr><td class="px-4 py-2 font-semibold text-slate-800">${machineId}</td>`;

                shiftLabels.forEach(({ key }) => {
                    const metric = groupsMap.get(`${machineId}__${key}`);
                    if (metric) {
                        const value = Number.isFinite(metric.oee) ? metric.oee : 0;
                        const colorClass = resolveColorClass(value);
                        const title = `Disponibilidade: ${metric.disponibilidade.toFixed(1)}%\nPerformance: ${metric.performance.toFixed(1)}%\nQualidade: ${metric.qualidade.toFixed(1)}%`;
                        html += `
                            <td class="px-4 py-2 text-center">
                                <div class="heatmap-cell ${colorClass} rounded-lg p-2 m-1 cursor-pointer transition-all hover:scale-105" title="${title}">
                                    ${value.toFixed(1)}%
                                </div>
                            </td>
                        `;
                    } else {
                        html += `
                            <td class="px-4 py-2 text-center">
                                <div class="heatmap-cell bg-slate-100 text-slate-400 rounded-lg p-2 m-1">
                                    --
                                </div>
                            </td>
                        `;
                    }
                });

                html += '</tr>';
            });

            html += `
                        </tbody>
                    </table>
                </div>
                <div class="mt-4 flex items-center justify-center gap-4 text-sm">
                    <div class="flex items-center gap-2">
                        <div class="w-4 h-4 bg-emerald-500 rounded"></div>
                        <span>≥ 80%</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <div class="w-4 h-4 bg-yellow-400 rounded"></div>
                        <span>70-79%</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <div class="w-4 h-4 bg-orange-500 rounded"></div>
                        <span>60-69%</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <div class="w-4 h-4 bg-red-500 rounded"></div>
                        <span>&lt; 60%</span>
                    </div>
                </div>
            `;

            container.innerHTML = html;
        } catch (error) {
            console.error('[OEE][HEATMAP] Erro ao gerar mapa de calor', error);
            container.innerHTML = `
                <div class="p-6 text-center text-sm text-red-600 bg-red-50 rounded-lg">
                    Erro ao carregar mapa de calor. Tente novamente.
                </div>
            `;
        }
    }

    // Funções de comparação faltantes
    async function compareByShifts(metric, startDate, endDate) {
        const shifts = ['1º Turno', '2º Turno', '3º Turno'];
        const results = [];

        for (let i = 1; i <= 3; i++) {
            const data = await getFilteredData('production', startDate, endDate, 'all', i.toString());
            const value = data.reduce((sum, item) => sum + item.quantity, 0);
            
            results.push({
                name: shifts[i - 1],
                value: value
            });
        }

        return results.sort((a, b) => b.value - a.value);
    }

    async function compareByPeriods(metric) {
        const today = new Date();
        const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        const lastMonth = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

        const periods = [
            { name: 'Últimos 7 dias', start: lastWeek, end: today },
            { name: 'Últimos 30 dias', start: lastMonth, end: today },
            { name: 'Este mês', start: new Date(today.getFullYear(), today.getMonth(), 1), end: today }
        ];

        const results = [];

        for (const period of periods) {
            const startDate = period.start.toISOString().split('T')[0];
            const endDate = period.end.toISOString().split('T')[0];
            const data = await getFilteredData('production', startDate, endDate, 'all', 'all');
            const value = data.reduce((sum, item) => sum + item.quantity, 0);
            
            results.push({
                name: period.name,
                value: value
            });
        }

        return results;
    }

    async function compareByProducts(metric, startDate, endDate) {
        const productionData = await getFilteredData('production', startDate, endDate, 'all', 'all');
        const planData = await getFilteredData('plan', startDate, endDate, 'all', 'all');
        
        const productData = {};
        
        // Agrupar por produto da produção
        productionData.forEach(item => {
            const product = item.product || 'Produto Não Informado';
            productData[product] = (productData[product] || 0) + item.quantity;
        });

        const results = Object.entries(productData).map(([name, value]) => ({
            name: name,
            value: value
        }));

        return results.sort((a, b) => b.value - a.value);
    }

    // Expor o serviço de dados analíticos para módulos externos (ex.: predictive-analytics)
    if (!window.analyticsDataService) {
        window.analyticsDataService = {};
    }
    window.analyticsDataService.getFilteredData = getFilteredData;

    // Compatibilidade: garantir que outros módulos (Advanced KPIs, SPC, etc.) encontrem a versão completa
    window.getFilteredData = getFilteredData;
    
    // Expor funções da tabela de borra
    window.borraTableNextPage = borraTableNextPage;
    window.borraTablePrevPage = borraTablePrevPage;
    window.exportBorraTable = exportBorraTable;
        

// --- Entry point ---
let _analiseInitialized = false;
export function setupAnalisePage() {
    if (_analiseInitialized) {
        console.debug('[Anal-mod] Já inicializado — apenas recarregando view ativa');
        // Invalidar cache de dados para forçar refresh ao revisitar a aba
        _invalidateFilteredDataCache();
        const activeView = document.querySelector('.analysis-tab-btn.active')?.getAttribute('data-view') || 'overview';
        loadAnalysisData(activeView).catch(err => {
            console.error('[Anal-mod] Erro ao recarregar dados:', err);
        });
        return;
    }
    _analiseInitialized = true;
    console.log('[Anal-mod] Controller modular carregado');
    setupAnalysisTab();

    // Exportar refreshAnalysisIfActive para window (substitui versão legada do script.js)
    window.refreshAnalysisIfActive = refreshAnalysisIfActive;
}
