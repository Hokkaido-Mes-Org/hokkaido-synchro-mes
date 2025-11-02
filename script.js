// This file contains the full and correct JavaScript code for the Hokkaido Synchro MES application.
// All functionalities, including the new database with product codes, are implemented here.

document.addEventListener('DOMContentLoaded', function() {
    console.log('🔍 [DEBUG] script.js DOMContentLoaded iniciado');
    console.log('🔍 [DEBUG] window.authSystem disponível?', window.authSystem);
    if (window.authSystem) {
        console.log('🔍 [DEBUG] currentUser:', window.authSystem.getCurrentUser?.());
    }
    
    // Firebase Configuration
    if (typeof firebase === 'undefined' || typeof firebase.firestore === 'undefined') {
        alert("Erro Crítico: A biblioteca da base de dados não conseguiu ser carregada.");
        return;
    }

    const firebaseConfig = {
        apiKey: "AIzaSyB1YrMK07_7QROsCJQqE0MFsmJncfjphmI",
        authDomain: "hokkaido-synchro.firebaseapp.com",
        projectId: "hokkaido-synchro",
        storageBucket: "hokkaido-synchro.firebasestorage.app",
        messagingSenderId: "635645564631",
        appId: "1:635645564631:web:1e19be7957e39d1adc8292"
    };

    let db;
    let storage = null;
    try {
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        db = firebase.firestore();
        if (typeof firebase.storage === 'function') {
            storage = firebase.storage();
            console.log('Firebase Storage inicializado com sucesso');
        } else {
            console.warn('Firebase Storage não disponível. Upload de fotos será desativado.');
        }
        
        // Testar conexão com Firebase
        console.log('Firebase inicializado com sucesso');
        console.log('Firestore instance:', db);
        
        // Teste de conectividade básica
        db.collection('test').doc('connection-test').set({
            timestamp: new Date().toISOString(),
            test: true
        }).then(() => {
            console.log('✅ Teste de conexão Firebase bem-sucedido');
            
            // Testar específicamente as coleções que vamos usar
            return Promise.all([
                db.collection('production').doc('test').set({ test: true, timestamp: new Date() }),
                db.collection('losses').doc('test').set({ test: true, timestamp: new Date() }),
                db.collection('downtime').doc('test').set({ test: true, timestamp: new Date() })
            ]);
        }).then(() => {
            console.log('✅ Teste de escrita nas coleções principais bem-sucedido');
            
            // Limpar documentos de teste
            return Promise.all([
                db.collection('production').doc('test').delete(),
                db.collection('losses').doc('test').delete(),
                db.collection('downtime').doc('test').delete()
            ]);
        }).then(() => {
            console.log('✅ Limpeza dos documentos de teste concluída');
        }).catch((error) => {
            console.error('❌ Erro no teste de conexão Firebase:', error);
            console.error('Código do erro:', error.code);
            console.error('Mensagem do erro:', error.message);
            
            if (error.code === 'permission-denied') {
                console.error('🚨 PROBLEMA DE PERMISSÃO DETECTADO!');
                console.error('Verifique as regras de segurança do Firestore.');
                alert('Erro de permissão: Verifique as regras de segurança do Firebase Firestore. O banco pode estar configurado para bloquear escritas.');
            }
        });
        
    } catch (error) {
        console.error("Erro ao inicializar Firebase: ", error);
        alert("Erro fatal: Não foi possível conectar à base de dados.");
        return;
    }

    // --- Configuration Lists ---
    // Normalização de IDs de máquina: H01, H02, ...
    function normalizeMachineId(id) {
        if (!id) return null;
        const s = String(id).toUpperCase().replace(/\s+/g, '');
        // Aceita H-01, H01, h01 etc.; mantém dois dígitos
        const match = s.match(/^H[-_]?(\d{1,2})$/);
        if (match) {
            return `H${match[1].padStart(2, '0')}`;
        }
        // Se vier apenas dígitos (ex.: 1, 01), prefixa H
        const n = s.match(/^(\d{1,2})$/);
        if (n) {
            return `H${n[1].padStart(2, '0')}`;
        }
        // Fallback: remove hífens e tenta novamente
        const cleaned = s.replace(/-/g, '');
        const m2 = cleaned.match(/^H(\d{1,2})$/);
        if (m2) return `H${m2[1].padStart(2, '0')}`;
        return s; // devolve como veio se não reconhecer
    }

    // Lista de máquinas padronizada via database.js quando disponível
    const machineList = (window.databaseModule && window.databaseModule.machineDatabase)
        ? window.databaseModule.machineDatabase.map(m => normalizeMachineId(m.id))
        : [
            "H01", "H02", "H03", "H04", "H05", "H06", "H07", "H08", "H09", "H10",
            "H11", "H12", "H13", "H14", "H15", "H16", "H17", "H18", "H19", "H20",
            "H26", "H27", "H28", "H29", "H30", "H31", "H32"
        ];

    // Base de dados de máquinas com seus modelos (usa database.js se disponível)
    const machineDatabase = (window.databaseModule && window.databaseModule.machineDatabase) ? window.databaseModule.machineDatabase : [
        { id: "H-01", model: "SANDRETTO OTTO" },
        { id: "H-02", model: "SANDRETTO SERIE 200" },
        { id: "H-03", model: "LS LTE280" },
        { id: "H-04", model: "LS LTE 330" },
        { id: "H-05", model: "LS LTE 170" },
        { id: "H-06", model: "HAITIAN MA2000" },
        { id: "H-07", model: "CHEN HSONG JM 178 A" },
        { id: "H-08", model: "REED 200 TG II" },
        { id: "H-09", model: "REED 200 TG II" },
        { id: "H-10", model: "HAITIAN MA 3200" },
        { id: "H-11", model: "ROMI 300 TGR" },
        { id: "H-12", model: "BORCHE BH 120" },
        { id: "H-13", model: "HAITIAN MA 2000 770G" },
        { id: "H-14", model: "SANDRETTO SB UNO" },
        { id: "H-15", model: "ROMI EN 260 CM 10" },
        { id: "H-16", model: "HAITIAN MA 2000 III" },
        { id: "H-17", model: "ROMI EN 260 CM 10" },
        { id: "H-18", model: "HAITIAN MA 2000 III" },
        { id: "H-19", model: "HAITIAN MA 2000 III" },
        { id: "H-20", model: "HAITIAN PL 200J" },
        { id: "H-26", model: "ROMI PRIMAX CM9" },
        { id: "H-27", model: "ROMI PRIMAX CM8" },
        { id: "H-28", model: "ROMI PRIMAX CM8" },
        { id: "H-29", model: "ROMI PRIMAX CM8" },
        { id: "H-30", model: "ROMI PRIMAX CM8" },
        { id: "H-31", model: "ROMI PRÁTICA CM8" },
        { id: "H-32", model: "ROMI PRÁTICA CM8" }
    ];

    // Motivos de Refugo e Parada: preferir database.js se disponível (senão usa fallback agrupado)
    // Observação: o app usa funções getGrouped* abaixo para popular selects/relatórios

    const preparadores = ['Daniel', 'João', 'Luis', 'Manaus', 'Rafael', 'Stanley', 'Wagner', 'Yohan'].sort();
    
    // Global Variables
    let activeListenerUnsubscribe = null;
    let currentAnalysisView = 'resumo';
    let docIdToDelete = null;
    let collectionToDelete = null;
    let fullDashboardData = { perdas: [] };
    let paretoChartInstance, productionTimelineChartInstance, oeeByShiftChartInstance, oeeTrendChartInstance;
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
        }
    };
    const DEFAULT_DONUT_COLORS = ['#10B981', '#3B82F6', '#F97316', '#8B5CF6', '#F59E0B', '#EC4899', '#14B8A6', '#EF4444'];
    let currentReportData = [];
    
    // Variáveis do novo painel de lançamento
    let selectedMachineData = null;
    let hourlyChartInstance = null;
    let opChartInstance = null;
    // Evitar concorrência/reentrância na atualização dos gráficos de Lançamento
    let isRefreshingLaunchCharts = false;
    let analysisHourlyChartInstance = null;
    let machineProductionTimelineInstance = null;
    let productionTimer = null;
    let productionTimerBaseSeconds = 0;
    let productionTimerResumeTimestamp = null;
    let currentDowntimeStart = null;
    let downtimeTimer = null;
    let machineStatus = 'running'; // 'running' ou 'stopped'
    let recentEntriesCache = new Map();
    let allRecentEntries = []; // Armazenar todas as entradas para filtro
    let currentEntryFilter = 'all'; // Filtro atual: 'all', 'production', 'downtime', 'loss'
    let currentEditContext = null;
    let machineCardData = {};
    const machineCardCharts = {};
    let activeMachineCard = null;

    let cachedProductionDataset = {
        productionData: [],
        planData: [],
        startDate: null,
        endDate: null,
        shift: 'all',
        machine: 'all'
    };
    let productionRateMode = 'day';

    // Variáveis globais para análise
    let machines = [];
    let currentAnalysisFilters = {};

    let productionOrdersUnsubscribe = null;
    let productionOrdersCache = [];
    let currentSelectedOrderForAnalysis = null;
    let currentActiveOrder = null;
    let currentOrderProgress = { executed: 0, planned: 0, expected: 0 };

    // DOM Element Selectors
    const navButtons = document.querySelectorAll('.nav-btn');
    const pageContents = document.querySelectorAll('.page-content');
    const pageTitle = document.getElementById('page-title');
    const confirmModal = document.getElementById('confirm-modal');
    
    const sidebar = document.getElementById('sidebar');
    const sidebarOpenBtn = document.getElementById('sidebar-open-btn');
    const sidebarCloseBtn = document.getElementById('sidebar-close-btn');
    const sidebarOverlay = document.getElementById('sidebar-overlay');

    const planningDateSelector = document.getElementById('planning-date-selector');
    const planningForm = document.getElementById('planning-form');
    const planningOrderSelect = document.getElementById('planning-order-select');
    const planningOrderInfo = document.getElementById('planning-order-info');
    const planningTableBody = document.getElementById('planning-table-body');
    const planningMachineSelect = document.getElementById('planning-machine');
    const planningMpInput = document.getElementById('planning-mp');
    const leaderLaunchPanel = document.getElementById('leader-launch-panel');
    const leaderModal = document.getElementById('leader-entry-modal');
    const leaderModalForm = document.getElementById('leader-entry-form');
    const leaderModalTitle = document.getElementById('leader-modal-title');
    
    const launchPanelContainer = document.getElementById('launch-panel-container');
    const productionModal = document.getElementById('production-entry-modal');
    const productionModalForm = document.getElementById('production-entry-form');
    const productionModalTitle = document.getElementById('production-modal-title');
    // Elementos do novo painel de lançamento
    const machineSelector = document.getElementById('machine-selector');
    const machineCardGrid = document.getElementById('machine-card-grid');
    const machineCardEmptyState = document.getElementById('machine-card-empty');
    const productionControlPanel = document.getElementById('production-control-panel');
    const hourlyProductionChart = document.getElementById('hourly-production-chart');
    const opProductionChart = document.getElementById('op-production-chart');
    const launchChartModeHourlyBtn = document.getElementById('launch-chart-mode-hourly');
    const launchChartModeOpBtn = document.getElementById('launch-chart-mode-op');
    let launchChartMode = 'hourly'; // 'hourly' | 'op'
    const analysisHourlyProductionChart = document.getElementById('analysis-hourly-production-chart');
    const analysisMachineProductionTimelineChart = document.getElementById('analysis-machine-production-timeline');
    const currentShiftDisplay = document.getElementById('current-shift-display');
    const machineIcon = document.getElementById('machine-icon');
    const machineName = document.getElementById('machine-name');
    const productName = document.getElementById('product-name');
    const productMp = document.getElementById('product-mp');
    const finalizeOrderBtn = document.getElementById('finalize-order-btn');
    const activateOrderBtn = document.getElementById('activate-order-btn');
    const shiftTarget = document.getElementById('shift-target');
    const productionTimeDisplay = document.getElementById('production-time');
    const producedToday = document.getElementById('produced-today');
    const efficiencyToday = document.getElementById('efficiency-today');
    const lossesToday = document.getElementById('losses-today');
    const downtimeToday = document.getElementById('downtime-today');
    const recentEntriesList = document.getElementById('recent-entries-list');
    const recentEntriesLoading = document.getElementById('recent-entries-loading');
    const recentEntriesEmpty = document.getElementById('recent-entries-empty');
    const refreshRecentEntriesBtn = document.getElementById('refresh-recent-entries');

    // Elementos da aba de Ordens de Produção
    const productionOrderForm = document.getElementById('production-order-form');
    const productionOrderStatusMessage = document.getElementById('production-order-status-message');
    const productionOrderTableBody = document.getElementById('production-order-table-body');
    const productionOrderEmptyState = document.getElementById('production-order-empty');
    const productionOrderCodeInput = document.getElementById('order-part-code');
    const productionOrderCodeDatalist = document.getElementById('order-product-code-list');
    const productionOrderFeedback = document.getElementById('order-product-feedback');
    const productionOrderProductInput = document.getElementById('order-product');
    const productionOrderCustomerInput = document.getElementById('order-customer');
    const productionOrderRawMaterialInput = document.getElementById('order-raw-material');

    updateRecentEntriesEmptyMessage('Selecione uma máquina para visualizar os lançamentos.');
    setRecentEntriesState({ loading: false, empty: true });
    
    const analysisTabButtons = document.querySelectorAll('.analysis-tab-btn');
    const analysisViews = document.querySelectorAll('.analysis-view');
    const resumoDateSelector = document.getElementById('resumo-date-selector');
    const printReportBtn = document.getElementById('print-report-btn');
    const reportQuantBtn = document.getElementById('report-quant-btn');
    const reportEfficBtn = document.getElementById('report-effic-btn');
    const resumoContentContainer = document.getElementById('resumo-content-container');
    const startDateSelector = document.getElementById('start-date-selector');
    const endDateSelector = document.getElementById('end-date-selector');
    const dateRangeButtons = document.querySelectorAll('.date-range-btn');
    const machineFilter = document.getElementById('machine-filter');
    const refreshDashboardBtn = document.getElementById('refresh-dashboard-btn');
    
    const graphMachineFilter = document.getElementById('graph-machine-filter');

    // --- FUNÇÕES UTILITÁRIAS ---

    // Carregar OPs abertas para o formulário de planejamento
    async function loadPlanningOrders() {
        if (!planningOrderSelect) return;
        planningOrderSelect.innerHTML = '<option value="">Selecione...</option>';

        try {
            const snapshot = await db.collection('production_orders').get();
            const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const blocked = ['concluida','cancelada','finalizada','encerrada'];
            const openOrders = orders.filter(o => !blocked.includes(String(o.status||'').toLowerCase()));

            openOrders.sort((a,b) => {
                const toNum = (v) => { const n = parseInt(String(v||'').replace(/\D/g,''), 10); return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY; };
                return toNum(a.order_number) - toNum(b.order_number);
            });

            const options = openOrders.map(o => {
                const lot = Number(o.lot_size)||0;
                const label = `${o.order_number || o.id} • Cod ${o.part_code || '-'} • Lote ${lot.toLocaleString('pt-BR')}`;
                const opt = document.createElement('option');
                opt.value = o.id;
                opt.textContent = label;
                opt.dataset.partCode = String(o.part_code||'');
                opt.dataset.product = String(o.product||'');
                opt.dataset.customer = String(o.customer||'');
                opt.dataset.lotSize = String(lot);
                opt.dataset.orderNumber = String(o.order_number||o.id);
                opt.dataset.machineId = String(o.machine_id||'');
                return opt;
            });

            options.forEach(opt => planningOrderSelect.appendChild(opt));
        } catch (err) {
            console.error('Erro ao carregar OPs:', err);
        }
    }

    function onPlanningOrderChange() {
        if (!planningOrderSelect) return;
        const selected = planningOrderSelect.selectedOptions[0];
        if (!selected || !selected.value) {
            if (planningOrderInfo) planningOrderInfo.style.display = 'none';
            return;
        }

        const partCode = selected.dataset.partCode || '';
        const product = selected.dataset.product || '';
        const customer = selected.dataset.customer || '';
        const lotSize = Number(selected.dataset.lotSize || '0');
        const orderNumber = selected.dataset.orderNumber || selected.value;
        const machineId = selected.dataset.machineId || '';

        // Preencher produto
        const productCodInput = document.getElementById('planning-product-cod');
        if (productCodInput) {
            productCodInput.value = partCode;
            productCodInput.dispatchEvent(new Event('change'));
        }

        // Sugerir máquina atribuída
        if (planningMachineSelect && machineId) {
            const hasOption = Array.from(planningMachineSelect.options).some(opt => opt.value === machineId);
            if (hasOption) planningMachineSelect.value = machineId;
        }

        // Mostrar info da OP
        if (planningOrderInfo) {
            planningOrderInfo.style.display = 'block';
            planningOrderInfo.textContent = `OP ${orderNumber} • ${product} (${customer}) • Cod ${partCode} • Lote ${lotSize.toLocaleString('pt-BR')}${machineId ? ' • Máquina ' + machineId : ''}`;
        }
    }
    
    // Recupera sessão diretamente do armazenamento (sessionStorage > localStorage)
    function getStoredUserSession() {
        const storageSources = [() => sessionStorage, () => localStorage];
        for (const getStorage of storageSources) {
            try {
                const storage = getStorage();
                if (!storage) continue;
                const data = storage.getItem('synchro_user');
                if (data) {
                    const parsed = JSON.parse(data);
                    console.log('🔍 [DEBUG] getStoredUserSession() encontrou:', parsed);
                    return parsed;
                }
            } catch (error) {
                console.warn('⚠️ [DEBUG] Erro ao ler sessão armazenada:', error);
            }
        }
        console.warn('⚠️ [DEBUG] getStoredUserSession() não encontrou dados');
        return null;
    }

    // Obtém usuário ativo com fallback para sessão armazenada
    function getActiveUser() {
        const authUser = window.authSystem?.getCurrentUser?.();
        if (authUser && (authUser.username || authUser.name)) {
            return authUser;
        }

        const storedUser = getStoredUserSession();
        if (storedUser) {
            if (window.authSystem?.setCurrentUser) {
                window.authSystem.setCurrentUser(storedUser);
            } else if (window.authSystem) {
                window.authSystem.currentUser = storedUser;
            }
            return storedUser;
        }

        return {};
    }

    // Função para obter o nome do usuário com fallback seguro
    function getCurrentUserName() {
        const currentUser = getActiveUser();
        
        console.log('🔍 [DEBUG] getCurrentUserName() - currentUser:', currentUser);
        
        // Tentar obter o nome do usuário atual
        if (currentUser.name && currentUser.name.trim()) {
            console.log('✅ [DEBUG] Nome obtido da sessão:', currentUser.name);
            return currentUser.name;
        }
        
        // Fallback: tentar extrair do username
        if (currentUser.username) {
            // Se o username tem ponto, dividir e pegar a primeira palavra capitalizada
            if (currentUser.username.includes('.')) {
                const parts = currentUser.username.split('.');
                const resultado = parts.map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
                console.log('✅ [DEBUG] Nome extraído do username:', resultado);
                return resultado;
            }
            // Caso contrário, retornar capitalizado
            const resultado = currentUser.username.charAt(0).toUpperCase() + currentUser.username.slice(1);
            console.log('✅ [DEBUG] Username capitalizado:', resultado);
            return resultado;
        }
        
        console.warn('⚠️ [DEBUG] Nenhum nome encontrado, retornando "Desconhecido"');
        // Último recurso
        return 'Desconhecido';
    }
    
    // Funções para normalizar datas conforme o ciclo de trabalho (7h a 7h do dia seguinte)
    // Turno 1: 07:00 - 15:00 | Turno 2: 15:00 - 23:00 | Turno 3: 23:00 - 07:00

    function getWorkDay(dateStr, timeStr) {
        if (!dateStr) return null;

        let hours = 12; // padrão neutro (meio-dia)
        if (typeof timeStr === 'string' && timeStr.includes(':')) {
            const [timeHours] = timeStr.split(':').map(Number);
            if (!Number.isNaN(timeHours)) {
                hours = timeHours;
            }
        }

        if (hours >= 7) {
            return dateStr;
        }

        const [year, month, day] = dateStr.split('-').map(Number);
        if ([year, month, day].some(n => Number.isNaN(n))) return dateStr;

        const baseDate = new Date(year, (month || 1) - 1, day || 1);
        baseDate.setDate(baseDate.getDate() - 1);
        return baseDate.toISOString().split('T')[0];
    }

    // Wrapper para compatibilidade com chamadas antigas
    function getWorkDayFromDate(dateStr, timeStr) {
        return getWorkDay(dateStr, timeStr);
    }

    function normalizeToDate(value) {
        if (!value) return null;
        if (value instanceof Date) {
            return Number.isNaN(value.getTime()) ? null : value;
        }
        if (value && typeof value.toDate === 'function') {
            const converted = value.toDate();
            return converted instanceof Date && !Number.isNaN(converted.getTime()) ? converted : null;
        }
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    function resolveProductionDateTime(raw) {
        if (!raw || typeof raw !== 'object') return null;

        const candidates = [];

        if (raw.dataHoraInformada) {
            candidates.push(raw.dataHoraInformada);
        }

        if (raw.horaInformada && (raw.data || raw.date)) {
            candidates.push(`${raw.data || raw.date}T${raw.horaInformada}`);
        }

        if (raw.datetime) {
            candidates.push(raw.datetime);
        }

        candidates.push(raw.timestamp);
        candidates.push(raw.createdAt);
        candidates.push(raw.updatedAt);

        for (const candidate of candidates) {
            const dateObj = normalizeToDate(candidate);
            if (dateObj) {
                return dateObj;
            }
        }

        return null;
    }

    function getWorkDayFromTimestamp(timestamp) {
        const dateObj = normalizeToDate(timestamp);
        if (!(dateObj instanceof Date)) return null;
        if (Number.isNaN(dateObj.getTime())) return null;
        const isoString = new Date(dateObj.getTime() - dateObj.getTimezoneOffset() * 60000).toISOString();
        const [datePart, timePart] = isoString.split('T');
        return getWorkDay(datePart, timePart?.substring(0, 5));
    }

    const PRODUCTION_DAY_START_HOUR = 7;
    const HOURS_IN_PRODUCTION_DAY = 24;

    const PROGRESS_PALETTE = {
        danger: { start: '#ef4444', end: '#f87171', textClass: 'text-red-600' },
        warning: { start: '#f59e0b', end: '#fbbf24', textClass: 'text-amber-500' },
        success: { start: '#10b981', end: '#34d399', textClass: 'text-emerald-600' }
    };
    const ANALYSIS_LINE_COLORS = [
        { border: '#2563EB', fill: 'rgba(37, 99, 235, 0.15)' },
        { border: '#10B981', fill: 'rgba(16, 185, 129, 0.15)' },
        { border: '#F59E0B', fill: 'rgba(245, 158, 11, 0.15)' },
        { border: '#9333EA', fill: 'rgba(147, 51, 234, 0.15)' },
        { border: '#EC4899', fill: 'rgba(236, 72, 153, 0.15)' },
        { border: '#0EA5E9', fill: 'rgba(14, 165, 233, 0.15)' },
        { border: '#22C55E', fill: 'rgba(34, 197, 94, 0.15)' },
        { border: '#F97316', fill: 'rgba(249, 115, 22, 0.15)' }
    ];

    function hexToRgb(hex) {
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

    function rgbToHex({ r, g, b }) {
        const clamp = (value) => Math.max(0, Math.min(255, Math.round(value)));
        const toHex = (value) => clamp(value).toString(16).padStart(2, '0');
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }

    function mixHexColors(hexA, hexB, factor = 0) {
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

    function resolveProgressPalette(percent = 0) {
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

    function hexWithAlpha(hex, alpha) {
        const { r, g, b } = hexToRgb(hex);
        return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
    }

    function formatHourLabel(hourValue) {
        const normalized = ((hourValue % 24) + 24) % 24;
        return `${String(normalized).padStart(2, '0')}:00`;
    }

    function formatShortDateLabel(dateStr) {
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

    function getProductionHoursOrder() {
        const ordered = [];
        for (let hour = PRODUCTION_DAY_START_HOUR; hour < 24; hour++) {
            ordered.push(formatHourLabel(hour));
        }
        for (let hour = 0; hour < PRODUCTION_DAY_START_HOUR; hour++) {
            ordered.push(formatHourLabel(hour));
        }
        return ordered;
    }

    function getProductionHourLabel(date = new Date()) {
        return formatHourLabel(date.getHours());
    }

    function getHoursElapsedInProductionDay(date = new Date()) {
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

    function normalizeShiftValue(value) {
        if (value === undefined || value === null) return null;
        if (typeof value === 'number' && Number.isFinite(value)) {
            return `T${value}`;
        }
        const str = String(value).toUpperCase();
        const match = str.match(/T?\s*(\d)/);
        return match ? `T${match[1]}` : null;
    }

    function formatShiftLabel(shiftKey) {
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

    function getGroupedLossReasons() {
        if (window.databaseModule && window.databaseModule.groupedLossReasons) {
            return window.databaseModule.groupedLossReasons;
        }
        return {
            "PROCESSO": [
                "BOLHA", "CHUPAGEM", "CONTAMINAÇÃO", "DEGRADAÇÃO", "EMPENAMENTO", "FALHA", 
                "FIAPO", "FORA DE COR", "INÍCIO/REÍNICIO", "JUNÇÃO", "MANCHAS", 
                "MEDIDA FORA DO ESPECIFICADO", "MOÍDO", "PEÇAS PERDIDAS", "QUEIMA", "REBARBA"
            ],
            "FERRAMENTARIA": [
                "DEFORMAÇÃO", "GALHO PRESO", "MARCA D'ÁGUA", "MARCA EXTRATOR", "RISCOS", "SUJIDADE"
            ],
            "QUALIDADE": [
                "INSPEÇÃO DE LINHA"
            ]
        };
    }

    function getGroupedDowntimeReasons() {
        if (window.databaseModule && window.databaseModule.groupedDowntimeReasons) {
            return window.databaseModule.groupedDowntimeReasons;
        }
        return {
            "FERRAMENTARIA": ["CORRETIVA DE MOLDE", "PREVENTIVA DE MOLDE", "TROCA DE VERSÃO"],
            "PROCESSO": ["ABERTURA DE CAVIDADE", "AJUSTE DE PROCESSO", "TRY OUT"],
            "COMPRAS": ["FALTA DE INSUMO PLANEJADA", "FALTA DE INSUMO NÃO PLANEJADA"],
            "PREPARAÇÃO": ["AGUARDANDO PREPARAÇÃO DE MATERIAL"],
            "QUALIDADE": ["AGUARDANDO CLIENTE/FORNECEDOR", "LIBERAÇÃO"],
            "MANUTENÇÃO": ["MANUTENÇÃO CORRETIVA", "MANUTENÇÃO PREVENTIVA"],
            "PRODUÇÃO": ["FALTA DE OPERADOR", "TROCA DE COR"],
            "SETUP": ["INSTALAÇÃO DE MOLDE", "RETIRADA DE MOLDE"],
            "ADMINISTRATIVO": ["FALTA DE ENERGIA"],
            "PCP": ["SEM PROGRAMAÇÃO"],
            "COMERCIAL": ["SEM PEDIDO"]
        };
    }

    function populateLossOptions() {
        const perdasSelect = document.getElementById('production-entry-perdas');
        if (!perdasSelect) return;
        
        const groupedReasons = getGroupedLossReasons();
        let options = '<option value="">Nenhum</option>';
        
        // Adicionar opções agrupadas
        Object.entries(groupedReasons).forEach(([group, reasons]) => {
            options += `<optgroup label="${group}">`;
            reasons.forEach(reason => {
                options += `<option value="${reason}">${reason}</option>`;
            });
            options += `</optgroup>`;
        });
        
        perdasSelect.innerHTML = options;
    }

    function showLoadingState(panel, isLoading, noData = false) {
        const loadingEl = document.getElementById(`${panel}-loading`);
        const noDataEl = document.getElementById(`${panel}-no-data`);
        const contentEl = panel === 'leader-panel' ? leaderLaunchPanel : 
                        panel === 'launch-panel' ? launchPanelContainer : 
                        panel === 'resumo' ? resumoContentContainer :
                        document.getElementById('dashboard-content');

        if (isLoading) {
            if (loadingEl) loadingEl.style.display = 'block';
            if (noDataEl) noDataEl.style.display = 'none';
            if (contentEl) contentEl.style.display = 'none';
        } else {
            if (loadingEl) loadingEl.style.display = 'none';
            if (noData) {
                if (noDataEl) noDataEl.style.display = 'block';
                if (contentEl) contentEl.style.display = 'none';
            } else {
                if (noDataEl) noDataEl.style.display = 'none';
                if (contentEl) {
                    if (panel.includes('dashboard') || panel.includes('resumo') || panel.includes('list')) {
                        contentEl.style.display = 'block';
                    } else {
                        contentEl.style.display = 'grid';
                    }
                }
            }
        }
    }

    function showConfirmModal(id, collection) {
        docIdToDelete = id;
        collectionToDelete = collection;
        const confirmText = document.getElementById('confirm-modal-text');
        if (confirmText) {
            if (collection === 'downtime_entries') {
                confirmText.textContent = 'Tem a certeza de que deseja excluir este registro de parada? Esta ação não pode ser desfeita.'
            } else {
                confirmText.textContent = 'Tem a certeza de que deseja excluir este item? Todos os lançamentos associados também serão removidos.'
            }
        }
        if (confirmModal) confirmModal.classList.remove('hidden');
    }
    
    function hideConfirmModal() {
        docIdToDelete = null;
        collectionToDelete = null;
        if (confirmModal) confirmModal.classList.add('hidden');
    }
    
    async function executeDelete() {
        if (!docIdToDelete || !collectionToDelete) return;
        
        const docRef = db.collection(collectionToDelete).doc(docIdToDelete);

        try {
            if (collectionToDelete === 'planning') {
                const prodEntriesSnapshot = await db.collection('production_entries').where('planId', '==', docIdToDelete).get();
                const batch = db.batch();
                prodEntriesSnapshot.docs.forEach(doc => {
                    batch.delete(doc.ref);
                });
                await batch.commit();
            }

            await docRef.delete();
            
            if (pageTitle && pageTitle.textContent === 'Análise' && currentAnalysisView === 'resumo') {
                loadResumoData();
            }

            if (collectionToDelete === 'production_entries' || collectionToDelete === 'downtime_entries' || collectionToDelete === 'rework_entries') {
                recentEntriesCache.delete(docIdToDelete);
                await loadRecentEntries(false);
            }


        } catch (error) {
            console.error("Erro ao excluir: ", error);
            alert("Não foi possível excluir o item e/ou seus dados associados.");
        } finally {
            hideConfirmModal();
        }
    }

    // --- BANCO DE DADOS DE CAIXAS DE TARA ---
    const taraBoxesDatabase = {
        "H-01": { "peso": 0, "descricao": "caixa plastica" },
        "H-02": { "peso": 0, "descricao": "caixa plastica" },
        "H-03": { "peso": 0, "descricao": "caixa plastica" },
        "H-04": { "peso": 0, "descricao": "caixa plastica" },
        "H-05": { "peso": 0, "descricao": "caixa plastica" },
        "H-06": { "peso": 0, "descricao": "caixa plastica" },
        "H-07": { "peso": 0, "descricao": "caixa plastica" },
        "H-08": { "peso": 0, "descricao": "caixa plastica" },
        "H-09": { "peso": 0, "descricao": "caixa plastica" },
        "H-10": { "peso": 0, "descricao": "caixa plastica" },
        "H-11": { "peso": 0, "descricao": "caixa plastica" },
        "H-12": { "peso": 0, "descricao": "caixa plastica" },
        "H-13": { "peso": 0, "descricao": "caixa plastica" },
        "H-14": { "peso": 0, "descricao": "caixa plastica" },
        "H-15": { "peso": 0, "descricao": "caixa plastica" },
        "H-16": { "peso": 0, "descricao": "caixa plastica" },
        "H-17": { "peso": 0, "descricao": "caixa plastica" },
        "H-18": { "peso": 0, "descricao": "caixa plastica" },
        "H-19": { "peso": 0, "descricao": "caixa plastica" },
        "H-20": { "peso": 0, "descricao": "caixa plastica" },
        "H-26": { "peso": 0, "descricao": "caixa plastica" },
        "H-27": { "peso": 0, "descricao": "caixa plastica" },
        "H-28": { "peso": 0, "descricao": "caixa plastica" },
        "H-29": { "peso": 0, "descricao": "caixa plastica" },
        "H-30": { "peso": 0, "descricao": "caixa plastica" },
        "H-31": { "peso": 0, "descricao": "caixa plastica" },
        "H-32": { "peso": 0, "descricao": "caixa plastica" }
    };

    // --- FUNÇÕES DO NOVO SISTEMA DE LANÇAMENTOS POR HORA ---

    // Função para carregar lançamentos por hora
    async function loadHourlyEntries(planId, turno) {
        const entriesRef = db.collection('hourly_production_entries');
        const q = entriesRef.where('planId', '==', planId).where('turno', '==', turno);
        const querySnapshot = await q.get();
        
        const entriesContainer = document.getElementById('hourly-entries-container');
        if (!entriesContainer) return;
        
        entriesContainer.innerHTML = '';
        
        const hours = [
            '08:00', '09:00', '10:00', '11:00', '12:00',
            '13:00', '14:00', '15:00', '16:00', '17:00', '18:00',
            '19:00', '20:00', '21:00', '22:00', '23:00', '00:00',
            '01:00', '02:00', '03:00', '04:00', '05:00', '06:00', '07:00'
        ];
        
        const existingEntries = {};
        querySnapshot.forEach(doc => {
            const data = doc.data();
            existingEntries[data.hora] = { id: doc.id, ...data };
        });
        
        hours.forEach(hora => {
            const entry = existingEntries[hora] || { hora, peso_bruto: '', usar_tara: false, embalagem_fechada: '' };
            const entryElement = createHourlyEntryElement(entry, planId, turno);
            entriesContainer.appendChild(entryElement);
        });
        
        updateTotalCalculation();
        lucide.createIcons();
            // Atualizar aba de análise se estiver aberta
            await refreshAnalysisIfActive();
    }

    // Função para criar elemento de lançamento por hora
    function createHourlyEntryElement(entry, planId, turno) {
        const div = document.createElement('div');
        div.className = 'hourly-entry grid grid-cols-13 gap-2 items-center p-2 border-b text-sm';
        div.innerHTML = `
            <div class="col-span-2 font-medium">${entry.hora}</div>
            <div class="col-span-3">
                <input type="number" step="0.01" 
                       value="${entry.peso_bruto || ''}" 
                       placeholder="Peso bruto (kg)"
                       class="peso-bruto-input w-full p-1 border rounded"
                       data-hora="${entry.hora}">
            </div>
            <div class="col-span-2 flex items-center">
                <input type="checkbox" ${entry.usar_tara ? 'checked' : ''} 
                       class="usar-tara-checkbox mr-1"
                       data-hora="${entry.hora}">
                <span class="text-xs">Usar Tara</span>
            </div>
            <div class="col-span-2">
                <input type="number" 
                       value="${entry.embalagem_fechada || ''}" 
                       placeholder="Embalagens"
                       class="embalagem-fechada-input w-full p-1 border rounded"
                       data-hora="${entry.hora}">
            </div>
            <div class="col-span-3">
                <span class="pecas-calculadas text-sm font-semibold">0 peças</span>
            </div>
            <div class="col-span-1">
                ${entry.id ? 
                    `<button type="button" class="delete-hourly-entry text-red-600 hover:text-red-800" data-id="${entry.id}">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>` : 
                    ''
                }
            </div>
        `;
        return div;
    }

    // Função para buscar peso da peça do planejamento
    async function getPieceWeightFromPlan(planId) {
        try {
            const planDoc = await db.collection('planning').doc(planId).get();
            if (planDoc.exists) {
                return planDoc.data().piece_weight || 0;
            }
        } catch (error) {
            console.error("Erro ao buscar peso da peça:", error);
        }
        return 0;
    }

    // Função para calcular totais
    async function updateTotalCalculation() {
        const planId = document.getElementById('production-entry-plan-id').value;
        const pieceWeight = await getPieceWeightFromPlan(planId);
        const useTara = document.getElementById('use-tara-box').checked;
        const taraWeight = parseFloat(document.getElementById('tara-box-weight').value) || 0;
        
        let totalPesoLiquido = 0;
        let totalPecas = 0;
        
        // Calcular totais de cada hora
        document.querySelectorAll('.hourly-entry').forEach(entry => {
            const pesoBruto = parseFloat(entry.querySelector('.peso-bruto-input').value) || 0;
            const usarTara = entry.querySelector('.usar-tara-checkbox').checked;
            const embalagemFechada = parseInt(entry.querySelector('.embalagem-fechada-input').value) || 0;
            
            const pesoLiquido = usarTara && useTara ? 
                Math.max(0, pesoBruto - taraWeight) : pesoBruto;
            
            // Calcular peças: por peso + por embalagem fechada
            const pecasPorPeso = pieceWeight > 0 ? Math.round((pesoLiquido * 1000) / pieceWeight) : 0;
            const pecasPorEmbalagem = embalagemFechada; // Assumindo 1 embalagem = 1 peça
            
            const pecasTotal = pecasPorPeso + pecasPorEmbalagem;
            
            if (entry.querySelector('.pecas-calculadas')) {
                entry.querySelector('.pecas-calculadas').textContent = `${pecasTotal} peças`;
            }
            
            totalPesoLiquido += pesoLiquido;
            totalPecas += pecasTotal;
        });
        
        // Atualizar totais
        const totalPesoLiquidoEl = document.getElementById('total-peso-liquido');
        const totalPecasEl = document.getElementById('total-pecas');
        const produzidoInput = document.getElementById('production-entry-produzido');
        
        if (totalPesoLiquidoEl) totalPesoLiquidoEl.textContent = `${totalPesoLiquido.toFixed(2)} kg`;
        if (totalPecasEl) totalPecasEl.textContent = totalPecas.toLocaleString('pt-BR');
        if (produzidoInput) produzidoInput.value = totalPecas;
    }

    // Função para salvar lançamentos por hora
    async function saveHourlyEntries(planId, turno) {
        const entries = [];
        
        document.querySelectorAll('.hourly-entry').forEach(entry => {
            const hora = entry.querySelector('.peso-bruto-input').dataset.hora;
            const pesoBruto = parseFloat(entry.querySelector('.peso-bruto-input').value) || 0;
            const usarTara = entry.querySelector('.usar-tara-checkbox').checked;
            const embalagemFechada = parseInt(entry.querySelector('.embalagem-fechada-input').value) || 0;
            
            if (pesoBruto > 0 || embalagemFechada > 0) {
                entries.push({
                    planId,
                    turno,
                    hora,
                    peso_bruto: pesoBruto,
                    usar_tara: usarTara,
                    embalagem_fechada: embalagemFechada,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
        });
        
        // Salvar no Firestore
        const batch = db.batch();
        entries.forEach(entry => {
            const docRef = db.collection('hourly_production_entries').doc();
            batch.set(docRef, entry);
        });
        
        await batch.commit();
    }

    // --- INITIALIZATION ---
    function init() {
        // Verificar autenticação primeiro (com pequeno delay para garantir carregamento)
        setTimeout(() => {
            if (!window.authSystem || !window.authSystem.getCurrentUser()) {
                console.warn('⚠️ Autenticação não encontrada. Redirecionando para login...');
                window.location.href = 'login.html';
                return;
            }
            
            console.log('✅ Usuário autenticado. Inicializando interface...');
            
            // Atualizar interface com informações do usuário
            if (window.authSystem && typeof window.authSystem.updateUserInterface === 'function') {
                window.authSystem.updateUserInterface();
            }
            
            setTodayDate();
            setupEventListeners();
            setupPlanningTab();
            setupProductionOrdersTab();
            setupLaunchTab();
            setupAnalysisTab();
            populateLossOptions();
            
            // Inicializar dados básicos
            loadAnalysisMachines();
            populateQuickFormOptions();
            populateLaunchMachineSelector();
            
            // Verificar se os elementos críticos existem
            setTimeout(() => {
                console.log('🔍 Verificando elementos críticos...');
                console.log('machine-selector:', !!document.getElementById('machine-selector'));
                console.log('quick-production-form:', !!document.getElementById('quick-production-form'));
                console.log('quick-losses-form:', !!document.getElementById('quick-losses-form'));
                console.log('quick-downtime-form:', !!document.getElementById('quick-downtime-form'));
                console.log('btn-losses:', !!document.getElementById('btn-losses'));
                console.log('btn-downtime:', !!document.getElementById('btn-downtime'));
            }, 1000);
            
            if (productionModalForm && !document.getElementById('production-entry-plan-id')) {
                const planIdInput = document.createElement('input');
                planIdInput.type = 'hidden';
                planIdInput.id = 'production-entry-plan-id';
                planIdInput.name = 'planId';
                productionModalForm.prepend(planIdInput);
            }
            
            // Iniciar atualização automática de OEE em tempo real (a cada 5 minutos)
            setInterval(updateRealTimeOeeData, 5 * 60 * 1000);
            
            // Iniciar atualização automática da timeline (a cada minuto)
            setInterval(updateTimelineIfVisible, 60 * 1000);
            
            // Atualizar imediatamente se estivermos na aba de dashboard ou análise
            setTimeout(updateRealTimeOeeData, 2000);
            
            // Adicionar listener para redimensionar gráficos
            window.addEventListener('resize', debounce(handleWindowResize, 250));
            
            // Final da inicialização - carregar aba de lançamento por padrão
            loadLaunchPanel();
            lucide.createIcons();
        }, 300); // Fim do setTimeout da autenticação
    }
    
    // Função para atualizar dados de OEE em tempo real
    async function updateRealTimeOeeData() {
        try {
            // Verificar se estamos na aba de dashboard ou análise
            const currentPage = document.querySelector('.nav-btn.active')?.dataset.page;
            if (currentPage !== 'analise') {
                return;
            }
            
            // Verificar se estamos visualizando dados de hoje
            const today = getProductionDateString();
            const selectedDate = resumoDateSelector ? resumoDateSelector.value : today;
            
            if (selectedDate !== today) {
                return;
            }
            
            // Recarregar dados apenas se estiver na visualização atual
            const currentView = document.querySelector('.analysis-tab-btn.active')?.dataset.view;
            
            if (currentView === 'dashboard') {
                // Atualizar dados do dashboard sem mostrar loading
                const startDate = startDateSelector ? startDateSelector.value : today;
                const endDate = endDateSelector ? endDateSelector.value : today;
                
                if (startDate === today && endDate === today) {
                    const prodSnapshot = await db.collection('production_entries')
                        .where('data', '==', today)
                        .get();
                    const productions = prodSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    
                    if (productions.length > 0) {
                        const planIds = [...new Set(productions.map(p => p.planId))];
                        const plans = {};
                        
                        for (let i = 0; i < planIds.length; i += 10) {
                            const batchIds = planIds.slice(i, i + 10);
                            if (batchIds.length > 0) {
                                const planBatchSnapshot = await db.collection('planning')
                                    .where(firebase.firestore.FieldPath.documentId(), 'in', batchIds)
                                    .get();
                                planBatchSnapshot.docs.forEach(doc => {
                                    plans[doc.id] = doc.data();
                                });
                            }
                        }
                        
                        const combinedData = productions.filter(prod => plans[prod.planId])
                            .map(prod => ({ ...prod, ...plans[prod.planId] }));
                        
                        fullDashboardData = { perdas: combinedData };
                        processAndRenderDashboard(fullDashboardData);
                    }
                }
            } else if (currentView === 'resumo') {
                // Atualizar dados do resumo silenciosamente
                loadResumoData(false); // false = não mostrar loading
            }
            
        } catch (error) {
            console.error("Erro ao atualizar dados OEE em tempo real: ", error);
        }
    }
    
    // Função para configurar a aba de lançamento
    // Configuração da aba de análise avançada
    function setupAnalysisTab() {
        console.log('🔧 Configurando aba de análise...');
        
        // Event listeners para as abas de análise
        document.querySelectorAll('.analysis-tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const view = e.target.getAttribute('data-view');
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
        // Atualizar botões
        document.querySelectorAll('.analysis-tab-btn').forEach(btn => {
            btn.classList.remove('active', 'border-primary-blue', 'text-primary-blue');
            btn.classList.add('border-transparent', 'text-gray-500');
        });
        
        const activeBtn = document.querySelector(`[data-view="${viewName}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active', 'border-primary-blue', 'text-primary-blue');
            activeBtn.classList.remove('border-transparent', 'text-gray-500');
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
        currentAnalysisFilters = { startDate, endDate, machine, shift };
        
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
        const machineFilter = document.getElementById('orders-machine-filter');
        if (!machineFilter) return;

        // Coletar máquinas únicas das ordens
        const uniqueMachines = new Set();
        orders.forEach(order => {
            if (order.machine_id) {
                uniqueMachines.add(order.machine_id);
            }
        });

        // Preservar valor atual
        const currentValue = machineFilter.value;

        // Recriar opções
        machineFilter.innerHTML = '<option value="">Todas as Máquinas</option>';
        
        // Adicionar máquinas em ordem alfabética
        Array.from(uniqueMachines).sort().forEach(machineId => {
            const option = document.createElement('option');
            option.value = machineId;
            option.textContent = machineId;
            machineFilter.appendChild(option);
        });

        // Restaurar valor anterior
        machineFilter.value = currentValue;
    }

    async function loadOrdersAnalysis() {
        console.log('📋 Carregando análise de ordens de produção', {
            cacheLength: productionOrdersCache?.length || 0,
            cache: productionOrdersCache
        });

        let ordersDataset = Array.isArray(productionOrdersCache) ? [...productionOrdersCache] : [];

        if (ordersDataset.length === 0) {
            try {
                const snapshot = await db.collection('production_orders').orderBy('createdAt', 'desc').get();
                ordersDataset = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                productionOrdersCache = ordersDataset;
            } catch (error) {
                console.error('Erro ao recuperar ordens de produção para análise:', error);
            }
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

        // Mapear produção por ID de ordem (só conta produção para ordens ativas)
        const productionTotalsByOrderId = new Map();

        try {
            const productionSnapshot = await db.collection('production_entries')
                .where('data', '>=', startDateStr)
                .where('data', '<=', endDateStr)
                .get();

            productionSnapshot.docs.forEach(doc => {
                const data = doc.data();
                const orderId = data.order_id || data.orderId;
                
                if (!orderId) return;

                const producedQty = Number(data.produzido || data.quantity || 0);
                if (!Number.isFinite(producedQty) || producedQty <= 0) {
                    return;
                }

                productionTotalsByOrderId.set(
                    orderId,
                    (productionTotalsByOrderId.get(orderId) || 0) + producedQty
                );
            });
        } catch (error) {
            console.error('Erro ao carregar lançamentos para análise de ordens:', error);
        }

        // Preencher dropdown de máquinas com máquinas usadas nas ordens
        populateOrdersMachineFilter(normalizedOrders);

        const ordersWithProgress = normalizedOrders
            .map(order => {
                const lotSize = Number(order.lot_size) || 0;
                // Buscar produção por ID da ordem (não por part_code)
                const totalProduced = productionTotalsByOrderId.get(order.id) || 0;
                const progress = lotSize > 0 ? Math.min((totalProduced / lotSize) * 100, 100) : 0;
                const remaining = Math.max(0, lotSize - totalProduced);
                const status = (order.status || '').toLowerCase();

                return {
                    ...order,
                    totalProduced,
                    progress,
                    remaining,
                    isComplete: lotSize > 0 ? totalProduced >= lotSize : ['concluida'].includes(status),
                    hasProduction: totalProduced > 0
                };
            });

        // Aplicar filtros de status e pesquisa
        const ordersStatusFilter = document.getElementById('orders-status-filter')?.value || '';
        const ordersMachineFilter = document.getElementById('orders-machine-filter')?.value || '';
        const ordersSearchQuery = document.getElementById('orders-search')?.value.toLowerCase() || '';

        let filteredOrders = ordersWithProgress;

        // Filtro por status
        if (ordersStatusFilter) {
            filteredOrders = filteredOrders.filter(order => {
                const status = (order.status || '').toLowerCase();
                if (ordersStatusFilter === 'planejada') return status === 'planejada';
                if (ordersStatusFilter === 'em_andamento') return status === 'em_andamento';
                if (ordersStatusFilter === 'concluida') return status === 'concluida';
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

        if (ordersSearchQuery) {
            filteredOrders = filteredOrders.filter(order => 
                (order.order_number || '').toLowerCase().includes(ordersSearchQuery) ||
                (order.product || '').toLowerCase().includes(ordersSearchQuery) ||
                (order.part_code || '').toLowerCase().includes(ordersSearchQuery)
            );
        }

        const ordersHtml = filteredOrders.map(order => {
            const progressColor = order.progress >= 100 ? 'bg-emerald-500' : order.progress >= 50 ? 'bg-amber-500' : 'bg-red-500';
            const lotSizeNumeric = Number(order.lot_size) || 0;
            const status = (order.status || '').toLowerCase();

            // Mapa de cores para status
            const statusColorMap = {
                'planejada': { badge: 'bg-sky-100 text-sky-700', label: 'Planejada' },
                'em_andamento': { badge: 'bg-amber-100 text-amber-700', label: 'Em andamento' },
                'ativa': { badge: 'bg-blue-100 text-blue-700', label: 'Ativa' },
                'concluida': { badge: 'bg-emerald-100 text-emerald-700', label: 'Concluída' },
                'cancelada': { badge: 'bg-red-100 text-red-700', label: 'Cancelada' }
            };

            const statusDisplay = statusColorMap[status] || statusColorMap['planejada'];
            const isActive = status === 'ativa';

            // Buscar modelo da máquina
            const machineInfo = machineDatabase.find(m => m.id === order.machine_id);
            const machineDisplay = machineInfo 
                ? `<br><strong>Máquina:</strong> ${escapeHtml(order.machine_id)} - ${escapeHtml(machineInfo.model)}`
                : '';

            return `
                <div class="bg-white p-6 rounded-lg shadow border-l-4 border-primary-blue ${isActive ? 'ring-2 ring-blue-400' : ''}">
                    <div class="flex items-start justify-between mb-4">
                        <div class="flex-1">
                            <h3 class="text-lg font-bold text-gray-800">${escapeHtml(order.order_number)}</h3>
                            <p class="text-sm text-gray-600 mt-1">
                                <strong>Produto:</strong> ${escapeHtml(order.product || 'N/A')} 
                                <br><strong>Cliente:</strong> ${escapeHtml(order.customer || 'N/A')}
                                <br><strong>Código:</strong> ${escapeHtml(order.part_code || 'N/A')}
                                ${machineDisplay}
                            </p>
                        </div>
                        <span class="px-3 py-1 rounded-full text-xs font-semibold ${statusDisplay.badge}">
                            ${statusDisplay.label}
                        </span>
                    </div>

                    <div class="mt-4 space-y-3">
                        <div>
                            <div class="flex justify-between items-center mb-1">
                                <span class="text-sm font-medium text-gray-700">Progresso do Lote</span>
                                <span class="text-sm font-bold text-gray-800">${order.totalProduced.toLocaleString('pt-BR')} / ${lotSizeNumeric.toLocaleString('pt-BR')} un</span>
                            </div>
                            <div class="w-full bg-gray-200 rounded-full h-2.5">
                                <div class="${progressColor} h-2.5 rounded-full transition-all duration-500" style="width: ${order.progress}%"></div>
                            </div>
                            <div class="mt-1 text-xs text-gray-500">
                                Faltam: <strong>${order.remaining.toLocaleString('pt-BR')} un</strong>
                            </div>
                        </div>

                        <div class="grid grid-cols-2 gap-3">
                            <div class="bg-gray-50 p-3 rounded">
                                <div class="text-xs text-gray-600">Tamanho do Lote</div>
                                <div class="text-lg font-bold text-gray-800">${lotSizeNumeric.toLocaleString('pt-BR')}</div>
                            </div>
                            <div class="bg-gray-50 p-3 rounded">
                                <div class="text-xs text-gray-600">Produzido até agora</div>
                                <div class="text-lg font-bold text-emerald-600">${order.totalProduced.toLocaleString('pt-BR')}</div>
                            </div>
                        </div>

                        ${order.raw_material ? `<div class="bg-blue-50 p-2 rounded text-xs"><strong>MP:</strong> ${escapeHtml(order.raw_material)}</div>` : ''}
                    </div>
                </div>
            `;
        }).join('');

        if (filteredOrders.length === 0) {
            ordersGrid.innerHTML = `
                <div class="col-span-full text-center py-12">
                    <i data-lucide="inbox" class="w-12 h-12 text-gray-400 mx-auto mb-3"></i>
                    <p class="text-gray-600">Nenhuma ordem encontrada com os filtros selecionados</p>
                </div>
            `;
        } else {
            ordersGrid.innerHTML = ordersHtml;
        }

        try {
            lucide.createIcons();
        } catch (iconError) {
            console.warn('Falha ao renderizar ícones lucide na aba de ordens:', iconError);
        }

        const noDataContainer = document.getElementById('analysis-no-data');
        if (filteredOrders.length > 0 && noDataContainer) {
            noDataContainer.classList.add('hidden');
        }

        // Configurar event listeners para filtros
        const ordersStatusFilterBtn = document.getElementById('orders-status-filter');
        const ordersMachineFilterBtn = document.getElementById('orders-machine-filter');
        const ordersSearchInput = document.getElementById('orders-search');
        
        if (ordersStatusFilterBtn && !ordersStatusFilterBtn.dataset.listenerAttached) {
            ordersStatusFilterBtn.addEventListener('change', () => loadOrdersAnalysis());
            ordersStatusFilterBtn.dataset.listenerAttached = 'true';
        }

        if (ordersMachineFilterBtn && !ordersMachineFilterBtn.dataset.listenerAttached) {
            ordersMachineFilterBtn.addEventListener('change', () => loadOrdersAnalysis());
            ordersMachineFilterBtn.dataset.listenerAttached = 'true';
        }
        
        if (ordersSearchInput && !ordersSearchInput.dataset.listenerAttached) {
            ordersSearchInput.addEventListener('input', () => loadOrdersAnalysis());
            ordersSearchInput.dataset.listenerAttached = 'true';
        }

        lucide.createIcons();
    }

    // Função para carregar visão geral
    async function loadOverviewData() {
        const { startDate, endDate, machine, shift } = currentAnalysisFilters;
        console.log('[TRACE][loadOverviewData] fetching data', { startDate, endDate, machine, shift });
        
        if (!startDate || !endDate) {
            console.warn('[TRACE][loadOverviewData] missing date filters, initializing defaults');
            setAnalysisDefaultDates();
            return;
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
    const downtimeData = filterByShift(downtimeAll);
    const planFiltered = filterByShift(planData);

        // Calcular KPIs básicos
        const totalProduction = productionData.reduce((sum, item) => sum + item.quantity, 0);
        const totalLosses = lossesData.reduce((sum, item) => sum + item.quantity, 0);
        const totalDowntime = downtimeData.reduce((sum, item) => sum + (item.duration || 0), 0);
        
        // Calcular OEE real usando disponibilidade × performance × qualidade
        const { overallOee, filteredOee } = calculateOverviewOEE(
            productionAll,
            lossesAll,
            downtimeAll,
            planData,
            appliedShift
        );
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
        if (overviewLosses) overviewLosses.textContent = totalLosses.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        if (overviewDowntime) overviewDowntime.textContent = `${(totalDowntime / 60).toFixed(1)}h`;

        console.log('[TRACE][loadOverviewData] KPIs calculated', { 
            overallOee: (overallOee * 100).toFixed(1) + '%',
            filteredOee: (filteredOee * 100).toFixed(1) + '%',
            totalProduction, 
            totalLosses, 
            totalDowntime 
        });

        // Gerar gráficos
    await generateOEEDistributionChart(productionData, lossesData, downtimeData);
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
            if (!Number.isFinite(hours)) return null;
            if (hours >= 7 && hours < 15) return 1;
            if (hours >= 15 && hours < 23) return 2;
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
                    lossesKg: 0,
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
            group.lossesKg += item.quantity || 0;
        });

        downtimeData.forEach(item => {
            const group = getOrCreateGroup(item);
            if (!group) return;
            group.downtimeMin += item.duration || 0;
        });

        const clamp01 = (value) => Math.max(0, Math.min(1, value));
        const groupsWithMetrics = [];

        console.log('[TRACE][aggregateOeeMetrics] grupos criados:', Object.keys(grouped).length);

        Object.values(grouped).forEach(group => {
            // CORREÇÃO: Buscar planos por máquina e data também
            const planCandidates = planData.filter(p => p && p.raw && p.machine === group.machine);
            
            if (!planCandidates.length) {
                console.log('[TRACE][aggregateOeeMetrics] sem plano para máquina', group.machine, 'usando valores padrão');
                // CORREÇÃO: Usar valores padrão quando não há plano disponível
                const metrics = calculateShiftOEE(
                    group.production,
                    group.downtimeMin,
                    0, // refugoPcs
                    30, // ciclo padrão de 30 segundos
                    2   // 2 cavidades padrão
                );

                groupsWithMetrics.push({
                    machine: group.machine,
                    shift: group.shift,
                    workDay: group.workDay,
                    disponibilidade: clamp01(metrics.disponibilidade),
                    performance: clamp01(metrics.performance),
                    qualidade: clamp01(metrics.qualidade),
                    oee: clamp01(metrics.oee)
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

            const shiftKey = `t${group.shift}`;
            const cicloReal = plan.raw[`real_cycle_${shiftKey}`] || plan.raw.budgeted_cycle || 30;
            const cavAtivas = plan.raw[`active_cavities_${shiftKey}`] || plan.raw.mold_cavities || 2;
            const pieceWeight = plan.raw.piece_weight || 0.1; // peso padrão de 100g

            const refugoPcs = pieceWeight > 0 ? Math.round((group.lossesKg * 1000) / pieceWeight) : 0;

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
                cicloReal,
                cavAtivas,
                metrics
            });

            groupsWithMetrics.push({
                machine: group.machine,
                shift: group.shift,
                workDay: group.workDay,
                disponibilidade: clamp01(metrics.disponibilidade),
                performance: clamp01(metrics.performance),
                qualidade: clamp01(metrics.qualidade),
                oee: clamp01(metrics.oee)
            });
        });

        const averageMetric = (items, selector) => {
            if (!items.length) return 0;
            const total = items.reduce((sum, item) => sum + selector(item), 0);
            return total / items.length;
        };

        const normalizedShift = shiftFilter === 'all' ? 'all' : toShiftNumber(shiftFilter);
        const filteredGroups = normalizedShift === 'all'
            ? groupsWithMetrics
            : groupsWithMetrics.filter(item => item.shift === normalizedShift);

        console.log('[TRACE][aggregateOeeMetrics] grupos com métricas:', groupsWithMetrics.length);
        console.log('[TRACE][aggregateOeeMetrics] grupos filtrados:', filteredGroups.length);

        const overall = {
            disponibilidade: averageMetric(groupsWithMetrics, item => item.disponibilidade),
            performance: averageMetric(groupsWithMetrics, item => item.performance),
            qualidade: averageMetric(groupsWithMetrics, item => item.qualidade),
            oee: averageMetric(groupsWithMetrics, item => item.oee)
        };

        const filtered = {
            disponibilidade: averageMetric(filteredGroups, item => item.disponibilidade),
            performance: averageMetric(filteredGroups, item => item.performance),
            qualidade: averageMetric(filteredGroups, item => item.qualidade),
            oee: averageMetric(filteredGroups, item => item.oee)
        };

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

    // Função para calcular OEE real do overview agregando todos os turnos/máquinas
    function calculateOverviewOEE(productionData, lossesData, downtimeData, planData, shiftFilter = 'all') {
        const { overall, filtered } = aggregateOeeMetrics(
            productionData,
            lossesData,
            downtimeData,
            planData,
            shiftFilter
        );

        // Padrão A: OEE = Disponibilidade × Performance × Qualidade (produto das médias dos componentes)
        const safeMul = (...vals) => vals.reduce((acc, v) => acc * (Number.isFinite(v) ? v : 0), 1);

        const overallOee = safeMul(
            overall?.disponibilidade || 0,
            overall?.performance || 0,
            overall?.qualidade || 0
        );

        const filteredOee = safeMul(
            filtered?.disponibilidade || 0,
            filtered?.performance || 0,
            filtered?.qualidade || 0
        );

        return { overallOee, filteredOee };
    }

    // Função para carregar análise de produção
    async function loadProductionAnalysis() {
        const { startDate, endDate, machine, shift } = currentAnalysisFilters;
        console.log('[TRACE][loadProductionAnalysis] fetching data', { startDate, endDate, machine, shift });
        
        const productionData = await getFilteredData('production', startDate, endDate, machine, shift);
        const planData = await getFilteredData('plan', startDate, endDate, machine, shift);

        console.log('[TRACE][loadProductionAnalysis] datasets received', {
            productionCount: productionData.length,
            planCount: planData.length
        });
        
        // Calcular métricas
        const totalProduction = productionData.reduce((sum, item) => sum + item.quantity, 0);
        const totalPlan = planData.reduce((sum, item) => sum + item.quantity, 0);
        const targetVsActual = totalPlan > 0 ? (totalProduction / totalPlan * 100) : 0;
        
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

        // Atualizar interface
        document.getElementById('production-target-vs-actual').textContent = `${targetVsActual.toFixed(1)}%`;
        document.getElementById('top-machine').textContent = topMachine;
        updateProductionRateDisplay();

        // Gerar gráficos
        await generateHourlyProductionChart(productionData, {
            canvas: analysisHourlyProductionChart,
            targetCanvasId: 'analysis-hourly-production-chart',
            chartContext: 'analysis',
            dailyTargetOverride: totalPlan,
            updateTimeline: false
        });
        await generateShiftProductionChart(productionData);
        await generateMachineProductionTimeline(productionData, {
            canvas: analysisMachineProductionTimelineChart,
            targetCanvasId: 'analysis-machine-production-timeline'
        });
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
                subtextEl.textContent = `${modeLabel} • Sem registros no período selecionado.`;
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
                subtextEl.textContent = `Modo dia • ${totalProduction.toLocaleString('pt-BR')} peças em ${daysLabel}${dataDaysLabel}.`;
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
            subtextEl.textContent = `Modo turno • ${detailParts.join(' • ')} • ${daysLabel} analisado(s).`;
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

        const result = aggregateOeeMetrics(productionData, lossesData, downtimeData, planData, shift);
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
        const { startDate, endDate, machine, shift } = currentAnalysisFilters;
        console.log('[TRACE][loadEfficiencyAnalysis] calculating', { startDate, endDate, machine, shift });
        
        const oeeData = await calculateDetailedOEE(startDate, endDate, machine, shift);

        console.log('[TRACE][loadEfficiencyAnalysis] oeeData', oeeData);
        
        // Atualizar gauges
        updateGauge('availability-gauge', oeeData.availability);
        updateGauge('performance-gauge', oeeData.performance);
        updateGauge('quality-gauge', oeeData.quality);
        
        document.getElementById('availability-value').textContent = `${oeeData.availability.toFixed(1)}%`;
        document.getElementById('performance-value').textContent = `${oeeData.performance.toFixed(1)}%`;
        document.getElementById('quality-value').textContent = `${oeeData.quality.toFixed(1)}%`;

        // Gerar gráficos
    await generateOEEComponentsTimeline(startDate, endDate, machine);
    await generateOEEHeatmap(startDate, endDate, machine);
    }

    // Função para carregar análise de perdas
    async function loadLossesAnalysis() {
        const { startDate, endDate, machine, shift } = currentAnalysisFilters;
        console.log('[TRACE][loadLossesAnalysis] fetching data', { startDate, endDate, machine, shift });
        
        const lossesData = await getFilteredData('losses', startDate, endDate, machine, shift);
        const productionData = await getFilteredData('production', startDate, endDate, machine, shift);

        console.log('[TRACE][loadLossesAnalysis] datasets received', {
            lossesCount: lossesData.length,
            productionCount: productionData.length
        });
        
        const totalLosses = lossesData.reduce((sum, item) => sum + item.quantity, 0);
        const totalProduction = productionData.reduce((sum, item) => sum + item.quantity, 0);
        const lossesPercentage = totalProduction > 0 ? (totalLosses / totalProduction * 100) : 0;
        
        // Calcular principal motivo
        const reasonCounts = {};
        lossesData.forEach(item => {
            reasonCounts[item.reason] = (reasonCounts[item.reason] || 0) + item.quantity;
        });
        const mainReason = Object.keys(reasonCounts).reduce((a, b) => 
            reasonCounts[a] > reasonCounts[b] ? a : b, '---'
        );
        
        // Separar dados de borra
        const borraData = lossesData.filter(item => {
            const reasonStr = (item.reason || item.raw?.perdas || '').toString().toLowerCase();
            const isTagged = (item.raw && item.raw.tipo_lancamento === 'borra');
            return isTagged || reasonStr.includes('borra');
        });
        const regularLossesData = lossesData.filter(item => !borraData.includes(item));
        console.log('[TRACE][loadLossesAnalysis] borra split', {
            borraCount: borraData.length,
            regularLossesCount: regularLossesData.length,
            borraSample: borraData.slice(0, 3)
        });
        
        // Calcular total de borra em kg
        const totalBorraKg = borraData.reduce((sum, item) => {
            // Para borra, usar preferencialmente o peso em kg
            const weight = item.raw?.refugo_kg || item.quantity || 0;
            return sum + weight;
        }, 0);
        if (lossesData.length > 0 && borraData.length === 0) {
            console.warn('[TRACE][loadLossesAnalysis] Atenção: há perdas mas nenhuma BORRA detectada. Verifique se os lançamentos de borra possuem tipo_lancamento="borra" ou motivo contendo "borra".');
        }

        // Calcular MP mais perdida
        const materialCounts = {};
        lossesData.forEach(item => {
            const mpType = item.mp_type || 'Não especificado';
            materialCounts[mpType] = (materialCounts[mpType] || 0) + item.quantity;
        });
        const mainMaterial = Object.keys(materialCounts).length > 0 
            ? Object.keys(materialCounts).reduce((a, b) => 
                materialCounts[a] > materialCounts[b] ? a : b, '---'
            ) 
            : '---';

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
        document.getElementById('total-borra').textContent = `${totalBorraKg.toFixed(1)}`;
        document.getElementById('main-loss-reason').textContent = mainReason;
        document.getElementById('main-loss-material').textContent = mainMaterial;
        
        // Atualizar dados específicos de borra
        const topBorraMPElement = document.getElementById('top-borra-mp');
        const topBorraReasonElement = document.getElementById('top-borra-reason');
        const topBorraMachineElement = document.getElementById('top-borra-machine');
        
        if (topBorraMPElement) topBorraMPElement.textContent = topBorraMP;
        if (topBorraReasonElement) topBorraReasonElement.textContent = topBorraReason.replace('BORRA - ', '');
        if (topBorraMachineElement) topBorraMachineElement.textContent = topBorraMachine;

        // Gerar gráficos
        await generateLossesParetoChart(lossesData);
        await generateLossesByMachineChart(lossesData);
        await generateLossesByMaterialChart(lossesData);
        await generateLossesTrendChart(lossesData, startDate, endDate);
        
        // Gerar gráficos específicos de borra
        await generateBorraByMPChart(borraData);
        await generateBorraByReasonChart(borraData);
        await generateBorraByMachineChart(borraData);
    }

    // Função para carregar análise de paradas
    async function loadDowntimeAnalysis() {
        const { startDate, endDate, machine, shift } = currentAnalysisFilters;
        console.log('[TRACE][loadDowntimeAnalysis] fetching data', { startDate, endDate, machine, shift });
        
        const downtimeData = await getFilteredData('downtime', startDate, endDate, machine, shift);

        console.log('[TRACE][loadDowntimeAnalysis] dataset received', { downtimeCount: downtimeData.length });
        
        const totalDowntime = downtimeData.reduce((sum, item) => sum + (item.duration || 0), 0);
        const downtimeCount = downtimeData.length;
        const avgDowntime = downtimeCount > 0 ? (totalDowntime / downtimeCount) : 0;
        
        // Calcular MTBF (Mean Time Between Failures)
        const hoursInPeriod = calculateHoursInPeriod(startDate, endDate);
        const mtbf = downtimeCount > 0 ? (hoursInPeriod / downtimeCount) : 0;

        // Atualizar interface
        document.getElementById('total-downtime').textContent = `${(totalDowntime / 60).toFixed(1)}h`;
        document.getElementById('downtime-count').textContent = downtimeCount.toString();
        document.getElementById('avg-downtime').textContent = `${avgDowntime.toFixed(0)}min`;
        document.getElementById('mtbf-value').textContent = `${mtbf.toFixed(1)}h`;

        // Gerar gráficos
        await generateDowntimeReasonsChart(downtimeData);
        await generateDowntimeByMachineChart(downtimeData);
        await generateDowntimeTimelineChart(downtimeData);
    }

    // Função para carregar análise comparativa
    async function loadComparativeAnalysis() {
        console.log('[TRACE][loadComparativeAnalysis] Carregando view comparativa');
        // A view comparativa é carregada sob demanda quando o usuário clica em "Gerar Comparação"
        // Não precisa carregar dados automaticamente
        
        // Limpar gráfico anterior se existir
        const ctx = document.getElementById('comparison-chart');
        if (ctx) {
            clearNoDataMessage('comparison-chart');
            destroyChart('comparison-chart');
        }
        
        // Mostrar mensagem inicial
        showNoDataMessage('comparison-chart', 'Selecione os filtros e clique em "Gerar Comparação"');
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
        console.log('🔍 [DIAGNOSTIC] Iniciando diagnóstico de dados do Firestore...');
        
        try {
            // Verificar production_entries
            const prodSnapshot = await db.collection('production_entries').limit(5).get();
            console.log('🔍 [DIAGNOSTIC] production_entries:', {
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
            const downtimeSnapshot = await db.collection('downtime_entries').limit(5).get();
            console.log('🔍 [DIAGNOSTIC] downtime_entries:', {
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
            const planningSnapshot = await db.collection('planning').limit(5).get();
            console.log('🔍 [DIAGNOSTIC] planning:', {
                size: planningSnapshot.size,
                samples: planningSnapshot.docs.map(d => ({
                    id: d.id,
                    date: d.data().date,
                    machine: d.data().machine,
                    mp: d.data().mp
                }))
            });
            
        } catch (error) {
            console.error('🔍 [DIAGNOSTIC] Erro ao buscar dados:', error);
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
            { name: 'OEE Components Timeline', canvasId: 'oee-components-timeline', view: 'efficiency' },
            { name: 'Losses Pareto', canvasId: 'losses-pareto-chart', view: 'losses' },
            { name: 'Losses by Machine', canvasId: 'losses-by-machine-chart', view: 'losses' },
            { name: 'Losses by Material', canvasId: 'losses-by-material-chart', view: 'losses' },
            { name: 'Losses Trend', canvasId: 'losses-trend-chart', view: 'losses' },
            { name: 'Downtime Reasons', canvasId: 'downtime-reasons-chart', view: 'downtime' },
            { name: 'Downtime by Machine', canvasId: 'downtime-by-machine-chart', view: 'downtime' },
            { name: 'Downtime Timeline', canvasId: 'downtime-timeline-chart', view: 'downtime' },
            { name: 'Comparison', canvasId: 'comparison-chart', view: 'comparative' }
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
                        return {
                            id,
                            date: mappedDate,
                            machine: normalizeMachineId(raw.machine || raw.machineRef || raw.machine_id || null),
                            quantity: Number(raw.produzido ?? raw.quantity ?? 0) || 0,
                            shift: normalizeShift(raw.turno ?? raw.shift),
                            datetime: isoDateTime,
                            mp: raw.mp || '',
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
                        return {
                            id,
                            date: dateValue,
                            machine: normalizeMachineId(raw.machine || raw.machineRef || raw.machine_id || null),
                            quantity: Number(raw.refugo_qty ?? raw.refugo_kg ?? raw.quantity ?? 0) || 0,
                            shift: normalizeShift(raw.turno ?? raw.shift),
                            reason: raw.perdas || raw.reason || '',
                            mp: raw.mp || '',
                            mp_type: raw.mp_type || raw.mp || '',
                            workDay: workDay || dateValue,
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
                    mapper: (id, raw) => ({
                        id,
                        date: raw.date || '',
                        machine: normalizeMachineId(raw.machine || null),
                        quantity: Number(raw.planned_quantity ?? raw.quantity ?? 0) || 0,
                        shift: normalizeShift(raw.shift ?? raw.turno),
                        product: raw.product || '',
                        mp: raw.mp || '',
                        workDay: raw.date || '',
                        raw
                    })
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

            let query = db.collection(config.collection);
            
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
                console.warn('[TRACE][getFilteredData] snapshot vazio com filtro de datas, reconsultando sem faixa para aplicar filtro no cliente');
                snapshot = await db.collection(config.collection).get();
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

    function parseTimeToMinutes(dateStr, timeStr) {
        // FIX: utilitário para converter HH:MM em minutos absolutos para cálculos de duração
        if (!dateStr || !timeStr) return null;
        const [hours, minutes] = timeStr.split(':').map(Number);
        if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
        const date = new Date(`${dateStr}T${timeStr}:00`);
        return Math.floor(date.getTime() / 60000);
    }

    function combineDateAndTime(dateStr, timeStr) {
        if (!dateStr || !timeStr) return null;
        const [year, month, day] = dateStr.split('-').map(Number);
        const [hour, minute] = timeStr.split(':').map(Number);
        if ([year, month, day, hour, minute].some(value => Number.isNaN(value))) {
            return null;
        }
        return new Date(year, (month || 1) - 1, day || 1, hour || 0, minute || 0, 0, 0);
    }

    // Helpers para lidar com paradas multi-dia
    function pad2(n) { return String(n).padStart(2, '0'); }
    function formatDateYMD(d) {
        return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    }
    function formatTimeHM(d) { return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; }

    function splitDowntimeIntoDailySegments(startDateStr, startTimeStr, endDateStr, endTimeStr) {
        const segments = [];
        const start = new Date(`${startDateStr}T${startTimeStr}:00`);
        const end = new Date(`${endDateStr}T${endTimeStr}:00`);
        if (!(start instanceof Date) || !(end instanceof Date) || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
            return segments;
        }

        let cursor = new Date(start);
        while (true) {
            const dayEnd = new Date(cursor);
            dayEnd.setHours(23, 59, 0, 0); // usamos 23:59 para compatibilidade com inputs tipo time

            const segmentEnd = (end <= dayEnd) ? end : dayEnd;
            const durationMin = Math.max(1, Math.floor((segmentEnd.getTime() - cursor.getTime()) / 60000));

            segments.push({
                date: formatDateYMD(cursor),
                startTime: formatTimeHM(cursor),
                endTime: formatTimeHM(segmentEnd),
                duration: durationMin
            });

            if (end <= dayEnd) break;
            // avançar para próximo dia 00:00
            const nextDay = new Date(cursor);
            nextDay.setDate(nextDay.getDate() + 1);
            nextDay.setHours(0, 0, 0, 0);
            cursor = nextDay;
        }
        return segments;
    }

    // Inferir turno a partir de um segmento (usa o ponto médio do intervalo)
    function inferShiftFromSegment(dateStr, startTimeStr, endTimeStr) {
        const toMinutes = (t) => {
            if (!t || !t.includes(':')) return null;
            const [h, m] = t.split(':').map(Number);
            if (Number.isNaN(h) || Number.isNaN(m)) return null;
            return h * 60 + m;
        };
        const startMin = toMinutes(startTimeStr);
        const endMin = toMinutes(endTimeStr);
        // Se não houver ambos, tenta classificar pelo horário disponível
        const refMin = (startMin !== null && endMin !== null)
            ? Math.floor((startMin + endMin) / 2)
            : (startMin !== null ? startMin : endMin);
        if (refMin === null) return null;

        // Turno 1: 07:00–14:59 | Turno 2: 15:00–22:59 | Turno 3: 23:00–06:59
        if (refMin >= (7 * 60) && refMin < (15 * 60)) return 1;
        if (refMin >= (15 * 60) && refMin < (23 * 60)) return 2;
        return 3; // 23:00–23:59 ou 00:00–06:59
    }

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

    function showAnalysisLoading(show) {
        const loading = document.getElementById('analysis-loading');
        const noData = document.getElementById('analysis-no-data');
        
        if (show) {
            loading.classList.remove('hidden');
            noData.classList.add('hidden');
        } else {
            loading.classList.add('hidden');
        }
    }

    function showAnalysisError() {
        const loading = document.getElementById('analysis-loading');
        const noData = document.getElementById('analysis-no-data');
        
        loading.classList.add('hidden');
        noData.classList.remove('hidden');
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
        machines = machineDatabase.map(machine => ({ 
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
            
            machineDatabase.forEach(machine => {
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

    function setAnalysisDefaultDates() {
    const today = getProductionDateString();
        const startDateInput = document.getElementById('analysis-start-date');
        const endDateInput = document.getElementById('analysis-end-date');
        
        if (startDateInput) startDateInput.value = today;
        if (endDateInput) endDateInput.value = today;
        
        // Configurar filtros padrão
        currentAnalysisFilters = {
            startDate: today,
            endDate: today,
            machine: 'all',
            shift: 'all'
        };
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
    async function generateOEEDistributionChart(productionData, lossesData, downtimeData) {
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
            const performance = 0.85; // aproximação conservadora até termos cálculo por máquina

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
            if (!item?.datetime) return;
            const eventDate = new Date(item.datetime);
            if (Number.isNaN(eventDate.getTime())) return;
            const label = formatHourLabel(eventDate.getHours());
            executedByHour[label] = (executedByHour[label] || 0) + (Number(item.quantity) || 0);
        });

        const overrideTarget = Number(dailyTargetOverride);
        let dailyTarget = Number.isFinite(overrideTarget) && overrideTarget > 0 ? overrideTarget : Number(selectedMachineData?.daily_target) || 1000;
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

        if (!selectedMachineData) {
            alert('Selecione uma máquina antes de ativar a OP.');
            return;
        }

        // Se já houver ordem ativa, não fazer nada
        if (currentActiveOrder && String(currentActiveOrder.status || '').toLowerCase() === 'ativa') {
            showNotification('Esta OP já está ativa nesta máquina.', 'info');
            return;
        }

        const machineId = selectedMachineData.machine;
        let targetOrder = currentActiveOrder;

        // Caso não exista uma ordem resolvida no contexto, localizar pela part_code atual
        if (!targetOrder || !targetOrder.id) {
            try {
                const partCode = selectedMachineData.product_cod || selectedMachineData.product_code;
                if (partCode) {
                    const lotsSnapshot = await db.collection('production_orders')
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
            const planId = selectedMachineData?.id;
            if (planId) {
                try {
                    await db.collection('planning').doc(planId).update({
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
            if (selectedMachineData?.machine) {
                await onMachineSelected(selectedMachineData.machine);
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
            await db.collection('production_orders').doc(orderId).update(updatePayload);

            if (planId) {
                try {
                    await db.collection('planning').doc(planId).update({
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
                const stillSelected = selectedMachineData?.machine === machine;
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
        const timelineElement = document.getElementById('timeline-progress');
        if (!timelineElement || timelineElement.offsetParent === null) {
            return; // Timeline não está visível
        }

        // Recarregar dados de produção atuais
        try {
            if (!selectedMachineData) {
                updateTimelineProgress(0, 0, 0);
                return;
            }

            const today = new Date().toISOString().split('T')[0];
            const productionData = await getFilteredData('production', today, today, selectedMachineData.machine || 'all');

            const totalExecuted = productionData.reduce((sum, item) => sum + (item.quantity || 0), 0);
            const totalPlanned = Number(selectedMachineData.planned_quantity) || 0;
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

        const shiftData = [0, 0, 0]; // 1º, 2º, 3º turno
        const shiftLabels = ['1º Turno', '2º Turno', '3º Turno'];

        productionData.forEach(item => {
            if (item.shift) {
                shiftData[item.shift - 1] += item.quantity;
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
            type: 'bar',
            data: {
                labels,
                datasets: [
                    {
                        type: 'bar',
                        label: 'Executado por Hora',
                        data: executed,
                        backgroundColor: barBackground,
                        borderRadius: 8,
                        borderSkipped: false,
                        maxBarThickness: 22,
                        order: 2,
                        yAxisID: 'y'
                    },
                    {
                        type: 'line',
                        label: 'Planejado por Hora',
                        data: planned,
                        borderColor: '#3B82F6',
                        backgroundColor: 'transparent',
                        borderWidth: 2.5,
                        tension: 0.35,
                        pointRadius: 2,
                        pointHoverRadius: 5,
                        pointBackgroundColor: '#ffffff',
                        pointBorderColor: '#3B82F6',
                        yAxisID: 'y',
                        order: 3,
                        fill: false,
                        borderDash: [6, 6]
                    },
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
            const quantity = Number(item?.quantity) || 0;
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
            machineLosses[machine] = (machineLosses[machine] || 0) + (item.quantity || 0);
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
            materialLosses[mpType] = (materialLosses[mpType] || 0) + (item.quantity || 0);
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
                return `${context.label}: ${value.toFixed(2)} kg (${percentage}%)`;
            }
        });
    }

    // Gerar gráfico de tendência de perdas
    async function generateLossesTrendChart(lossesData, startDate, endDate) {
        const ctx = document.getElementById('losses-trend-chart');
        if (!ctx) return;

        destroyChart('losses-trend-chart');

        if (lossesData.length === 0) {
            showNoDataMessage('losses-trend-chart');
            return;
        }
        
        clearNoDataMessage('losses-trend-chart');

        // Agrupar perdas por data
        const lossesByDate = {};
        lossesData.forEach(item => {
            const date = item.date || '';
            lossesByDate[date] = (lossesByDate[date] || 0) + (item.quantity || 0);
        });

        // Ordenar datas
        const sortedDates = Object.keys(lossesByDate).sort();
        const labels = sortedDates.map(date => {
            const [year, month, day] = date.split('-');
            return `${day}/${month}`;
        });
        const data = sortedDates.map(date => lossesByDate[date]);

        const isMobile = window.innerWidth < 768;

        new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Perdas (kg)',
                    data: data,
                    borderColor: '#EF4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.2)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointRadius: isMobile ? 2 : 4,
                    pointHoverRadius: isMobile ? 4 : 6
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
                                size: isMobile ? 9 : 11
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

    // Gerar gráfico de paradas por motivo
    async function generateDowntimeReasonsChart(downtimeData) {
        const ctx = document.getElementById('downtime-reasons-chart');
        if (!ctx) return;

        destroyChart('downtime-reasons-chart');

        if (downtimeData.length === 0) {
            showNoDataMessage('downtime-reasons-chart');
            return;
        }
        
        clearNoDataMessage('downtime-reasons-chart');

        const reasonDurations = {};
        downtimeData.forEach(item => {
            const reason = item.reason || 'Sem motivo';
            reasonDurations[reason] = (reasonDurations[reason] || 0) + (item.duration || 0);
        });

        const labels = Object.keys(reasonDurations);
        const data = Object.values(reasonDurations).map(d => Number(((d || 0) / 60).toFixed(2))); // Converter para horas

        const isMobile = window.innerWidth < 768;
        const totalHours = data.reduce((sum, value) => sum + value, 0);

        renderModernDonutChart({
            canvasId: 'downtime-reasons-chart',
            labels,
            data,
            colors: ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'],
            datasetLabel: 'Paradas (h)',
            legendPosition: isMobile ? 'bottom' : 'right',
            tooltipFormatter: (context) => {
                const value = Number(context.parsed || 0);
                const percentage = totalHours > 0 ? ((value / totalHours) * 100).toFixed(1) : '0.0';
                return `${context.label}: ${value.toFixed(1)} h (${percentage}%)`;
            }
        });
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
        if (!ctx) return;

        destroyChart('downtime-timeline-chart');

        if (downtimeData.length === 0) {
            showNoDataMessage('downtime-timeline-chart');
            return;
        }
        
        clearNoDataMessage('downtime-timeline-chart');

        // Limitar aos últimos 20 eventos para visualização
        const recentDowntimes = downtimeData.slice(-20).reverse();
        
        const labels = recentDowntimes.map((item, index) => {
            const date = item.date ? new Date(item.date) : new Date();
            return `${date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} - ${item.machine || 'Máq'}`;
        });
        
        const data = recentDowntimes.map(item => (item.duration || 0));

        const isMobile = window.innerWidth < 768;

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
    }

    // Gerar gráfico de borra por MP
    async function generateBorraByMPChart(borraData) {
        const ctx = document.getElementById('borra-by-mp-chart');
        if (!ctx) return;

        destroyChart('borra-by-mp-chart');

        if (borraData.length === 0) {
            showNoDataMessage('borra-by-mp-chart');
            return;
        }
        
        clearNoDataMessage('borra-by-mp-chart');

        const mpCounts = {};
        borraData.forEach(item => {
            const mpType = item.mp_type || item.raw?.mp_type || 'Não especificado';
            const weight = item.raw?.refugo_kg || item.quantity || 0;
            mpCounts[mpType] = (mpCounts[mpType] || 0) + weight;
        });

        const labels = Object.keys(mpCounts);
        const data = Object.values(mpCounts);
        const colors = ['#FCD34D', '#F59E0B', '#D97706', '#B45309', '#92400E'];

        new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: colors.slice(0, labels.length),
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            font: { size: window.innerWidth < 768 ? 10 : 12 },
                            padding: 15
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.label}: ${context.parsed.toFixed(1)} kg`;
                            }
                        }
                    }
                }
            }
        });
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
            const weight = item.raw?.refugo_kg || item.quantity || 0;
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
            const weight = item.raw?.refugo_kg || item.quantity || 0;
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

    // Função para calcular OEE detalhado
    async function calculateDetailedOEE(startDate, endDate, machine, shift) {
        try {
            console.log('[TRACE][calculateDetailedOEE] Buscando dados para:', { startDate, endDate, machine, shift });
            
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
                shift
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

            return {
                availability: (filtered.disponibilidade * 100),
                performance: (filtered.performance * 100),
                quality: (filtered.qualidade * 100),
                oee: (filtered.oee * 100)
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

        downtimeData.forEach(item => {
            const date = item.date || '';
            if (dataByDate[date]) {
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
            const plannedMinutes = 480; // 8 horas
            const availability = Math.max(0, Math.min(100, ((plannedMinutes - data.downtime) / plannedMinutes) * 100));
            
            // Performance: produzido / planejado
            const performance = data.planned > 0 ? Math.min(100, (data.produced / data.planned) * 100) : 100;
            
            // Qualidade: (produzido - refugo) / produzido
            const quality = data.produced > 0 ? ((data.produced - data.scrap) / data.produced) * 100 : 100;
            
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
        
    // Final da inicialização  
    init();

    function getProductionDateString(date = new Date()) {
        const localDate = new Date(date);
        if (localDate.getHours() < 7) {
            localDate.setDate(localDate.getDate() - 1);
        }
        return new Date(localDate.getTime() - (localDate.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    }

    function setTodayDate() {
        const todayString = getProductionDateString();
        if (planningDateSelector) planningDateSelector.value = todayString;
        if (resumoDateSelector) resumoDateSelector.value = todayString;
        
        if (startDateSelector) startDateSelector.value = todayString;
        if (endDateSelector) endDateSelector.value = todayString;
    }

    function setupEventListeners() {
        navButtons.forEach(button => button.addEventListener('click', handleNavClick));
        analysisTabButtons.forEach(button => button.addEventListener('click', handleAnalysisTabClick));
        
        if (sidebarOpenBtn) sidebarOpenBtn.addEventListener('click', openSidebar);
        if (sidebarCloseBtn) sidebarCloseBtn.addEventListener('click', closeSidebar);
        if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeSidebar);

    if (planningForm) planningForm.addEventListener('submit', handlePlanningFormSubmit);
    if (planningOrderSelect) planningOrderSelect.addEventListener('change', onPlanningOrderChange);
        if (planningDateSelector) planningDateSelector.addEventListener('change', (e) => listenToPlanningChanges(e.target.value));
        if (productionOrderForm) productionOrderForm.addEventListener('submit', handleProductionOrderFormSubmit);
        
        // Adicionar listener para código do produto
        const productCodInput = document.getElementById('planning-product-cod');
        if (productCodInput) {
            ['change', 'blur'].forEach(evt => {
                productCodInput.addEventListener(evt, onPlanningProductCodChange);
            });
            productCodInput.addEventListener('input', onPlanningProductCodChange);
        }
        
        if (planningTableBody) planningTableBody.addEventListener('click', handlePlanningTableClick);
        
        if (leaderLaunchPanel) leaderLaunchPanel.addEventListener('click', handleLeaderPanelClick);
        if (leaderModal) leaderModal.querySelector('#leader-modal-close-btn').addEventListener('click', hideLeaderModal);
        if (leaderModalForm) leaderModalForm.addEventListener('submit', handleLeaderEntrySubmit);
        
        if (launchPanelContainer) launchPanelContainer.addEventListener('click', handleLaunchPanelClick);
        if (productionModal) {
            productionModal.querySelector('#production-modal-close-btn').addEventListener('click', hideProductionModal);
            productionModal.querySelector('#production-modal-cancel-btn').addEventListener('click', hideProductionModal);
        }
        if (productionModalForm) productionModalForm.addEventListener('submit', handleProductionEntrySubmit);
        if (refreshRecentEntriesBtn) refreshRecentEntriesBtn.addEventListener('click', () => loadRecentEntries());
        if (recentEntriesList) recentEntriesList.addEventListener('click', handleRecentEntryAction);
        if (finalizeOrderBtn) finalizeOrderBtn.addEventListener('click', handleFinalizeOrderClick);
    if (activateOrderBtn) activateOrderBtn.addEventListener('click', handleActivateOrderFromPanel);
        
        // Event listeners para filtros de lançamentos recentes
        const filterButtons = document.querySelectorAll('.filter-entry-btn');
        filterButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const filter = btn.dataset.filter;
                applyEntryFilter(filter);
            });
        });
        
    if (resumoDateSelector) resumoDateSelector.addEventListener('change', loadResumoData);
        if (printReportBtn) printReportBtn.addEventListener('click', handlePrintReport);
    if (reportQuantBtn) reportQuantBtn.addEventListener('click', () => switchReportView('quant'));

    // Carregar OPs para o formulário de planejamento
    loadPlanningOrders().catch(err => console.warn('Erro ao carregar OPs para planejamento:', err));
        if (reportEfficBtn) reportEfficBtn.addEventListener('click', () => switchReportView('effic'));
        if (resumoContentContainer) resumoContentContainer.addEventListener('click', handleResumoTableClick);
        
        if (refreshDashboardBtn) refreshDashboardBtn.addEventListener('click', loadDashboardData);
        if (machineFilter) machineFilter.addEventListener('change', () => processAndRenderDashboard(fullDashboardData));
        if (graphMachineFilter) graphMachineFilter.addEventListener('change', () => processAndRenderDashboard(fullDashboardData));
        
        dateRangeButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                dateRangeButtons.forEach(btn => btn.classList.remove('active'));
                e.currentTarget.classList.add('active');
                setDateRange(e.currentTarget.dataset.range);
            });
        });


        if (confirmModal) {
            document.getElementById('confirm-modal-cancel-btn').addEventListener('click', hideConfirmModal);
            document.getElementById('confirm-modal-ok-btn').addEventListener('click', executeDelete);
        }

        // NOVOS EVENT LISTENERS PARA O SISTEMA DE LANÇAMENTOS POR HORA
        document.addEventListener('input', function(e) {
            if (e.target.classList.contains('peso-bruto-input') || 
                e.target.classList.contains('embalagem-fechada-input')) {
                updateTotalCalculation();
            }
        });

        document.addEventListener('change', function(e) {
            if (e.target.classList.contains('usar-tara-checkbox') || e.target.id === 'use-tara-box') {
                updateTotalCalculation();
            }
        });

        // Event listener para deletar lançamentos por hora
        document.addEventListener('click', async function(e) {
            if (e.target.closest('.delete-hourly-entry')) {
                const button = e.target.closest('.delete-hourly-entry');
                const entryId = button.dataset.id;
                
                try {
                    await db.collection('hourly_production_entries').doc(entryId).delete();
                    button.closest('.hourly-entry').remove();
                    updateTotalCalculation();
                } catch (error) {
                    console.error("Erro ao deletar lançamento:", error);
                    alert("Erro ao deletar lançamento.");
                }
            }
        });
    }

    // --- GESTÃO DE LISTENERS ---
    function detachActiveListener() {
        if (activeListenerUnsubscribe) {
            if (typeof activeListenerUnsubscribe === 'function') {
                activeListenerUnsubscribe();
            } else if (typeof activeListenerUnsubscribe === 'object') {
                Object.values(activeListenerUnsubscribe).forEach(unsub => {
                    if (typeof unsub === 'function') unsub();
                });
            }
            activeListenerUnsubscribe = null;
        }
    }

    // --- NAVEGAÇÃO ---
    function handleNavClick(e) {
        e.preventDefault();
        const page = e.currentTarget.dataset.page;
        
        // Verificar se o usuário tem permissão para acessar esta aba
        if (!window.authSystem.canAccessTab(page)) {
            window.authSystem.showPermissionError();
            return;
        }
        
        navButtons.forEach(btn => btn.classList.remove('active'));
        e.currentTarget.classList.add('active');
        
        pageContents.forEach(content => {
            content.classList.toggle('hidden', content.id !== `${page}-page`);
        });
        
        if (pageTitle) {
            pageTitle.textContent = e.currentTarget.querySelector('span').textContent;
        }
        
        detachActiveListener();

        if (page === 'lancamento') loadLaunchPanel();
        if (page === 'planejamento') listenToPlanningChanges(getProductionDateString());
        if (page === 'ordens') {
            setupProductionOrdersTab();
            listenToProductionOrders();
        }
        if (page === 'analise') {
            console.log('📊 Abrindo aba de análise');
            
            // Garantir que o listener de ordens de produção está ativo
            setupProductionOrdersTab();
            listenToProductionOrders();
            
            // Executar diagnóstico (apenas em desenvolvimento)
            diagnosticFirestoreData();
            
            // Garantir que os filtros estão configurados
            if (!currentAnalysisFilters.startDate || !currentAnalysisFilters.endDate) {
                setAnalysisDefaultDates();
            }
            // Carregar dados da view ativa
            const activeView = document.querySelector('.analysis-tab-btn.active')?.getAttribute('data-view') || 'overview';
            console.log('📊 View ativa:', activeView);
            loadAnalysisData(activeView);
        }

        if (window.innerWidth < 768) {
            closeSidebar();
        }
    }
    
    function openSidebar() {
        if (sidebar && sidebarOverlay) {
            sidebar.classList.remove('-translate-x-full');
            sidebarOverlay.classList.remove('hidden');
            if (sidebarOpenBtn) {
                sidebarOpenBtn.classList.add('is-active');
                sidebarOpenBtn.setAttribute('aria-expanded', 'true');
            }
        }
    }

    function closeSidebar() {
        if (sidebar && sidebarOverlay) {
            sidebar.classList.add('-translate-x-full');
            sidebarOverlay.classList.add('hidden');
            if (sidebarOpenBtn) {
                sidebarOpenBtn.classList.remove('is-active');
                sidebarOpenBtn.setAttribute('aria-expanded', 'false');
            }
        }
    }

    function handleAnalysisTabClick(e) {
        const view = e.currentTarget.dataset.view;
        if (view) {
            switchAnalysisView(view);
        }
    }

    function setDateRange(range) {
        const end = new Date();
        const start = new Date();
        
        switch(range) {
            case '7':
                start.setDate(start.getDate() - 7);
                break;
            case '30':
                start.setDate(start.getDate() - 30);
                break;
            case 'month':
                start.setDate(1);
                break;
            default:
                start.setDate(start.getDate() - 7);
        }
        
        if (startDateSelector) startDateSelector.value = start.toISOString().split('T')[0];
        if (endDateSelector) endDateSelector.value = end.toISOString().split('T')[0];
    }
    
    // --- ABA DE PLANEJAMENTO ---
    function setupPlanningTab() {
        if (!planningMachineSelect) return;
        
        const machineOptions = machineDatabase.map(m => {
            const mid = normalizeMachineId(m.id);
            return `<option value="${mid}">${mid} - ${m.model}</option>`;
        }).join('');
        planningMachineSelect.innerHTML = `<option value="">Selecione...</option>${machineOptions}`;

        // Configurar select de código do produto
        const productCodInput = document.getElementById('planning-product-cod');
        const productCodDatalist = document.getElementById('planning-product-cod-list');
        if (productCodInput && productCodDatalist) {
            const sortedProducts = [...productDatabase].sort((a, b) => a.cod - b.cod);
            const escapeOptionLabel = (str = '') => String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
            productCodDatalist.innerHTML = sortedProducts.map(p => {
                const label = `${p.cod} - ${p.name} (${p.client})`;
                const escapedLabel = escapeOptionLabel(label);
                return `<option value="${p.cod}" label="${escapedLabel}">${escapedLabel}</option>`;
            }).join('');
        }
    }

    // --- ABA DE ORDENS DE PRODUÇÃO ---
    function setupProductionOrdersTab() {
        if (!productionOrderCodeInput) return;

        // Popular lista de códigos disponíveis
        if (productionOrderCodeDatalist) {
            const sortedProducts = [...productDatabase].sort((a, b) => a.cod - b.cod);
            const escapeOptionLabel = (str = '') => String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');

            productionOrderCodeDatalist.innerHTML = sortedProducts.map(product => {
                const label = `${product.cod} - ${product.name} (${product.client})`;
                const escaped = escapeOptionLabel(label);
                return `<option value="${product.cod}" label="${escaped}">${escaped}</option>`;
            }).join('');
        }

        // Popular select de máquinas no formulário
        populateOrderMachineSelect();

        productionOrderCodeInput.addEventListener('input', handleProductionOrderCodeInput);
        productionOrderCodeInput.addEventListener('change', handleProductionOrderCodeSelection);

        listenToProductionOrders();
    }

    function populatePlanningOrderSelect() {
        if (!planningOrderSelect || !Array.isArray(productionOrdersCache)) return;

        const currentValue = planningOrderSelect.value;

        planningOrderSelect.innerHTML = '<option value="">Selecione uma OP...</option>';
        productionOrdersCache.forEach(order => {
            const option = document.createElement('option');
            option.value = order.id;
            option.textContent = `${order.order_number} - ${order.product || 'N/A'} (${order.customer || 'N/A'})`;
            planningOrderSelect.appendChild(option);
        });

        planningOrderSelect.value = currentValue;
        planningOrderSelect.addEventListener('change', handlePlanningOrderSelection);
    }

    function handlePlanningOrderSelection(e) {
        const selectedOrderId = e.target.value;

        if (!selectedOrderId) {
            if (planningOrderInfo) {
                planningOrderInfo.style.display = 'none';
                planningOrderInfo.innerHTML = '';
            }
            return;
        }

        const selectedOrder = productionOrdersCache.find(o => o.id === selectedOrderId);
        if (!selectedOrder) return;

        const productCode = selectedOrder.part_code || selectedOrder.product_cod || '';
        const product = productCode ? productDatabase.find(p => String(p.cod) === productCode) : null;

        if (planningOrderInfo) {
            const infoText = `OP: ${selectedOrder.order_number} | Produto: ${selectedOrder.product || 'N/A'} | Cliente: ${selectedOrder.customer || 'N/A'} | Lote: ${selectedOrder.lot_size || 'N/A'}`;
            planningOrderInfo.textContent = infoText;
            planningOrderInfo.style.display = 'block';
        }

        if (productCode) {
            const planningProductCodInput = document.getElementById('planning-product-cod');
            if (planningProductCodInput) {
                planningProductCodInput.value = productCode;
                planningProductCodInput.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }
    }

    function handleProductionOrderCodeInput(e) {
        const rawCode = (e.target.value || '').trim();

        if (!rawCode) {
            clearProductionOrderAutoFields();
            setProductionOrderFeedback();
            return;
        }

        // Enquanto o usuário digita, ocultar mensagens para evitar falso negativo
        setProductionOrderFeedback();
    }

    function handleProductionOrderCodeSelection(e) {
        const rawCode = (e.target.value || '').trim();

        if (!rawCode) {
            clearProductionOrderAutoFields();
            setProductionOrderFeedback();
            return;
        }

        const product = productDatabase.find(item => String(item.cod) === rawCode);

        if (product) {
            fillProductionOrderFields(product);
            const clientLabel = product.client ? ` • ${product.client}` : '';
            setProductionOrderFeedback(`Produto carregado: ${product.name}${clientLabel}`, 'success');
            return;
        }

        clearProductionOrderAutoFields();
        setProductionOrderFeedback('Produto não encontrado na base. Preencha manualmente.', 'error');
    }

    function fillProductionOrderFields(product) {
        if (!product) return;

        if (productionOrderProductInput) {
            productionOrderProductInput.value = product.name || '';
        }

        if (productionOrderCustomerInput) {
            productionOrderCustomerInput.value = product.client || '';
        }

        if (productionOrderRawMaterialInput) {
            productionOrderRawMaterialInput.value = product.mp || '';
        }
    }

    function clearProductionOrderAutoFields() {
        if (productionOrderProductInput) productionOrderProductInput.value = '';
        if (productionOrderCustomerInput) productionOrderCustomerInput.value = '';
        if (productionOrderRawMaterialInput) productionOrderRawMaterialInput.value = '';
    }

    function setProductionOrderFeedback(message = '', type = 'info') {
        if (!productionOrderFeedback) return;

        if (!message) {
            productionOrderFeedback.textContent = '';
            productionOrderFeedback.style.display = 'none';
            productionOrderFeedback.className = 'mt-2 text-sm font-medium text-primary-blue';
            return;
        }

        const baseClasses = 'mt-2 text-sm font-medium';
        const typeClass = type === 'success'
            ? 'text-emerald-600'
            : type === 'error'
                ? 'text-red-600'
                : 'text-primary-blue';

        productionOrderFeedback.textContent = message;
        productionOrderFeedback.style.display = 'block';
        productionOrderFeedback.className = `${baseClasses} ${typeClass}`;
    }

    function escapeHtml(str = '') {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function parseOptionalNumber(value) {
        if (value === null || value === undefined || value === '') return null;
        const num = Number(value);
        return Number.isFinite(num) ? num : null;
    }

    function getProductionOrderStatusBadge(status = 'planejada') {
        const statusMap = {
            'planejada': { label: 'Planejada', className: 'bg-sky-100 text-sky-700' },
            'em_andamento': { label: 'Em andamento', className: 'bg-amber-100 text-amber-700' },
            'concluida': { label: 'Concluída', className: 'bg-emerald-100 text-emerald-700' },
            'cancelada': { label: 'Cancelada', className: 'bg-red-100 text-red-700' }
        };

        const safeStatus = statusMap[status] || statusMap['planejada'];
        return `<span class="px-2 py-1 rounded-full text-xs font-semibold ${safeStatus.className}">${safeStatus.label}</span>`;
    }

    function setProductionOrderStatus(message = '', type = 'info') {
        if (!productionOrderStatusMessage) return;

        if (!message) {
            productionOrderStatusMessage.textContent = '';
            productionOrderStatusMessage.className = 'text-sm font-semibold h-5 text-center';
            return;
        }

        const baseClasses = 'text-sm font-semibold h-5 text-center';
        const typeClass = type === 'success'
            ? 'text-status-success'
            : type === 'error'
                ? 'text-status-error'
                : 'text-gray-600';

        productionOrderStatusMessage.textContent = message;
        productionOrderStatusMessage.className = `${baseClasses} ${typeClass}`;
    }

    function renderProductionOrdersTable(orders = []) {
        if (!productionOrderTableBody) return;

        if (!Array.isArray(orders) || orders.length === 0) {
            productionOrderTableBody.innerHTML = '';
            if (productionOrderEmptyState) {
                productionOrderEmptyState.style.display = 'block';
            }
            return;
        }

        const rows = orders.map(order => {
            const orderNumber = escapeHtml(order.order_number || order.orderNumber || '-');
            const productName = escapeHtml(order.product || order.product_name || '-');
            const customer = escapeHtml(order.customer || order.client || '-');
            const productCode = escapeHtml(order.part_code || order.product_cod || '-');
            const lotSizeNumber = parseOptionalNumber(order.lot_size || order.lotSize);
            const lotSizeDisplay = Number.isFinite(lotSizeNumber) && lotSizeNumber > 0
                ? lotSizeNumber.toLocaleString('pt-BR')
                : '-';
            const statusBadge = getProductionOrderStatusBadge(order.status);
            const createdAt = order.createdAt?.toDate ? order.createdAt.toDate() : null;
            const createdAtLabel = createdAt ? createdAt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-';

            return `
                <tr class="odd:bg-white even:bg-gray-50" data-order-id="${escapeHtml(order.id || '')}">
                    <td class="px-3 py-2 text-sm border align-middle font-semibold text-gray-800">${orderNumber}</td>
                    <td class="px-3 py-2 text-sm border align-middle text-gray-700">${productName}</td>
                    <td class="px-3 py-2 text-sm border align-middle text-gray-700">${customer}</td>
                    <td class="px-3 py-2 text-sm border align-middle text-gray-700">${productCode}</td>
                    <td class="px-3 py-2 text-sm border align-middle text-center text-gray-700">${lotSizeDisplay}</td>
                    <td class="px-3 py-2 text-sm border align-middle text-center">${statusBadge}</td>
                    <td class="px-3 py-2 text-sm border align-middle">
                        <div class="flex items-center justify-center gap-2 text-gray-400">
                            <i data-lucide="clock" class="w-4 h-4"></i>
                            <span class="text-xs font-medium">${createdAtLabel}</span>
                        </div>
                    </td>
                    <td class="px-3 py-2 text-sm border align-middle">
                        <div class="flex items-center justify-center gap-1 flex-wrap">
                            <button type="button" class="edit-production-order p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors" data-order-id="${escapeHtml(order.id || '')}" title="Editar ordem">
                                <i data-lucide="edit-2" class="w-4 h-4"></i>
                            </button>
                            ${order.status === 'ativa' ? `
                                <button type="button" class="finish-production-order p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors" data-order-id="${escapeHtml(order.id || '')}" title="Finalizar OP">
                                    <i data-lucide="check-circle" class="w-4 h-4"></i>
                                </button>
                            ` : order.status !== 'concluida' ? `
                                <button type="button" class="activate-production-order p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors" data-order-id="${escapeHtml(order.id || '')}" data-machine-id="${escapeHtml(order.machine_id || '')}" title="Ativar OP">
                                    <i data-lucide="play-circle" class="w-4 h-4"></i>
                                </button>
                            ` : ''}
                            <button type="button" class="adjust-quantity-order p-1.5 text-yellow-600 hover:bg-yellow-50 rounded transition-colors" data-order-id="${escapeHtml(order.id || '')}" title="Ajustar quantidade">
                                <i data-lucide="package-minus" class="w-4 h-4"></i>
                            </button>
                            ${order.status !== 'ativa' ? `
                                <button type="button" class="delete-production-order p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors" data-order-id="${escapeHtml(order.id || '')}" title="Excluir ordem">
                                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                                </button>
                            ` : ''}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        productionOrderTableBody.innerHTML = rows;
        if (productionOrderEmptyState) {
            productionOrderEmptyState.style.display = 'none';
        }

        // Adicionar listeners para todos os botões da tabela
        document.querySelectorAll('.edit-production-order').forEach(btn => {
            btn.addEventListener('click', handleEditProductionOrder);
        });
        document.querySelectorAll('.activate-production-order').forEach(btn => {
            btn.addEventListener('click', handleActivateProductionOrder);
        });
        document.querySelectorAll('.finish-production-order').forEach(btn => {
            btn.addEventListener('click', handleFinishProductionOrder);
        });
        document.querySelectorAll('.adjust-quantity-order').forEach(btn => {
            btn.addEventListener('click', handleAdjustQuantityOrder);
        });
        document.querySelectorAll('.delete-production-order').forEach(btn => {
            btn.addEventListener('click', handleDeleteProductionOrder);
        });

        lucide.createIcons();
    }

    function handleEditProductionOrder(e) {
        const orderId = e.currentTarget.dataset.orderId;
        const order = productionOrdersCache.find(o => o.id === orderId);
        if (!order) return;

        // Preencher form com dados da ordem para edição
        if (productionOrderForm) {
            document.getElementById('order-number').value = order.order_number || '';
            document.getElementById('order-product').value = order.product || '';
            document.getElementById('order-lot-size').value = order.lot_size || '';
            document.getElementById('order-batch').value = order.batch_number || '';
            document.getElementById('order-customer-order').value = order.customer_order || '';
            document.getElementById('order-customer').value = order.customer || '';
            document.getElementById('order-part-code').value = order.part_code || '';
            document.getElementById('order-packaging-qty').value = order.packaging_qty || '';
            document.getElementById('order-internal-packaging-qty').value = order.internal_packaging_qty || '';
            document.getElementById('order-raw-material').value = order.raw_material || '';

            // Salvar ID para update
            productionOrderForm.dataset.editingOrderId = orderId;

            // Mudar texto do botão
            const submitButton = productionOrderForm.querySelector('button[type="submit"]');
            if (submitButton) {
                submitButton.innerHTML = `<i data-lucide="save"></i><span>Salvar Alterações</span>`;
            }

            // Scroll para o formulário
            productionOrderForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
            lucide.createIcons();
        }
    }

    async function handleActivateProductionOrder(e) {
        e.preventDefault();
        const orderId = e.currentTarget.dataset.orderId;
        const order = productionOrdersCache.find(o => o.id === orderId);
        let machineId = e.currentTarget.dataset.machineId || order?.machine_id || selectedMachineData?.machine || '';

        if (!order) {
            alert('Dados da ordem não encontrados.');
            return;
        }

        if (!machineId) {
            const input = prompt('Informe a máquina para ativar esta OP (ex.: H-01):');
            if (!input) return;
            machineId = input.trim();
        }

        try {
            setProductionOrderStatus('Ativando ordem...', 'info');
            const success = await setOrderAsActive(orderId, machineId);
            
            if (success) {
                setProductionOrderStatus('Ordem ativada com sucesso!', 'success');
                // Atualizar listas e painel
                if (typeof loadProductionOrders === 'function') {
                    await loadProductionOrders();
                }
                await populateMachineSelector();
                if (selectedMachineData?.machine) {
                    await onMachineSelected(selectedMachineData.machine);
                }
                setTimeout(() => setProductionOrderStatus('', 'info'), 2000);
            } else {
                setProductionOrderStatus('Operação cancelada ou erro.', 'error');
            }
        } catch (error) {
            console.error('Erro ao ativar ordem:', error);
            setProductionOrderStatus('Erro ao ativar ordem. Tente novamente.', 'error');
        }
    }

    async function handleFinishProductionOrder(e) {
        e.preventDefault();
        const orderId = e.currentTarget.dataset.orderId;
        const order = productionOrdersCache.find(o => o.id === orderId);

        if (!order) {
            alert('Ordem não encontrada.');
            return;
        }

        try {
            setProductionOrderStatus('Finalizando ordem...', 'info');
            const success = await finishActiveOrder(orderId);
            
            if (success) {
                setProductionOrderStatus('Ordem finalizada com sucesso!', 'success');
                setTimeout(() => setProductionOrderStatus('', 'info'), 2000);
            } else {
                setProductionOrderStatus('Operação cancelada.', 'info');
            }
        } catch (error) {
            console.error('Erro ao finalizar ordem:', error);
            setProductionOrderStatus('Erro ao finalizar ordem. Tente novamente.', 'error');
        }
    }

    async function handleDeleteProductionOrder(e) {
        e.preventDefault();
        const orderId = e.currentTarget.dataset.orderId;
        const order = productionOrdersCache.find(o => o.id === orderId);

        if (!order) return;

        if (order.status === 'ativa') {
            alert('Não é possível excluir uma OP ativa. Finalize a OP primeiro.');
            return;
        }

        if (!confirm(`Tem certeza que deseja excluir a OP "${order.order_number}"?`)) {
            return;
        }

        try {
            setProductionOrderStatus('Excluindo ordem...', 'info');
            await db.collection('production_orders').doc(orderId).delete();
            setProductionOrderStatus('Ordem excluída com sucesso!', 'success');
            setTimeout(() => setProductionOrderStatus('', 'info'), 2000);
        } catch (error) {
            console.error('Erro ao excluir ordem:', error);
            setProductionOrderStatus('Erro ao excluir ordem. Tente novamente.', 'error');
        }
    }

    function handleAdjustQuantityOrder(e) {
        e.preventDefault();
        const orderId = e.currentTarget.dataset.orderId;
        const order = productionOrdersCache.find(o => o.id === orderId);

        if (!order) {
            alert('Ordem de produção não encontrada.');
            return;
        }

        showAdjustQuantityModal(order);
    }

    function showAdjustQuantityModal(order) {
        const modal = document.getElementById('adjust-quantity-modal');
        const opNumberSpan = document.getElementById('adjust-op-number');
        const opProductSpan = document.getElementById('adjust-op-product');
        const opOriginalQtySpan = document.getElementById('adjust-op-original-qty');
        const reductionInput = document.getElementById('adjust-reduction-qty');
        const reasonSelect = document.getElementById('adjust-reason');
        const observationsInput = document.getElementById('adjust-observations');
        const finalQtySpan = document.getElementById('adjust-final-qty');
        const statusDiv = document.getElementById('adjust-quantity-status');

        if (!modal) return;

        // Preencher informações da OP
        if (opNumberSpan) opNumberSpan.textContent = order.order_number || '-';
        if (opProductSpan) opProductSpan.textContent = order.product || '-';
        
        const originalQty = parseOptionalNumber(order.lot_size || order.lotSize) || 0;
        if (opOriginalQtySpan) opOriginalQtySpan.textContent = originalQty.toLocaleString('pt-BR');

        // Limpar campos
        if (reductionInput) reductionInput.value = '';
        if (reasonSelect) reasonSelect.value = '';
        if (observationsInput) observationsInput.value = '';
        if (finalQtySpan) finalQtySpan.textContent = originalQty.toLocaleString('pt-BR');
        if (statusDiv) statusDiv.textContent = '';

        // Armazenar dados da ordem para uso posterior
        modal.dataset.orderId = order.id;
        modal.dataset.originalQty = originalQty.toString();

        // Listener para cálculo em tempo real da quantidade final
        if (reductionInput) {
            reductionInput.addEventListener('input', updateFinalQuantity);
        }

        modal.classList.remove('hidden');
    }

    function updateFinalQuantity() {
        const modal = document.getElementById('adjust-quantity-modal');
        const reductionInput = document.getElementById('adjust-reduction-qty');
        const finalQtySpan = document.getElementById('adjust-final-qty');

        if (!modal || !reductionInput || !finalQtySpan) return;

        const originalQty = parseInt(modal.dataset.originalQty || '0');
        const adjustmentQty = parseInt(reductionInput.value || '0');
        const newQty = originalQty + adjustmentQty;

        // Mostrar a nova quantidade após o ajuste
        if (adjustmentQty !== 0) {
            const sign = adjustmentQty > 0 ? '+' : '';
            finalQtySpan.textContent = `${newQty.toLocaleString('pt-BR')} (${sign}${adjustmentQty.toLocaleString('pt-BR')})`;
        } else {
            finalQtySpan.textContent = originalQty.toLocaleString('pt-BR');
        }
        
        // Validação visual - não permitir quantidade final negativa
        if (newQty < 0) {
            finalQtySpan.className = 'text-lg font-bold text-red-600';
            reductionInput.style.borderColor = '#DC2626';
        } else if (adjustmentQty > 0) {
            finalQtySpan.className = 'text-lg font-bold text-green-600';
            reductionInput.style.borderColor = '#10B981';
        } else if (adjustmentQty < 0) {
            finalQtySpan.className = 'text-lg font-bold text-orange-600';
            reductionInput.style.borderColor = '#F59E0B';
        } else {
            finalQtySpan.className = 'text-lg font-bold text-blue-800';
            reductionInput.style.borderColor = '#D1D5DB';
        }
    }

    function closeAdjustQuantityModal() {
        const modal = document.getElementById('adjust-quantity-modal');
        const reductionInput = document.getElementById('adjust-reduction-qty');
        
        if (modal) {
            modal.classList.add('hidden');
            modal.removeAttribute('data-order-id');
            modal.removeAttribute('data-original-qty');
        }
        
        // Remover listener temporário
        if (reductionInput) {
            reductionInput.removeEventListener('input', updateFinalQuantity);
        }
    }

    async function handleAdjustQuantitySubmit(e) {
        e.preventDefault();

        const modal = document.getElementById('adjust-quantity-modal');
        const orderId = modal?.dataset.orderId;
        const originalQty = parseInt(modal?.dataset.originalQty || '0');
        
        const reductionInput = document.getElementById('adjust-reduction-qty');
        const reasonSelect = document.getElementById('adjust-reason');
        const observationsInput = document.getElementById('adjust-observations');
        const statusDiv = document.getElementById('adjust-quantity-status');
        const submitButton = document.getElementById('adjust-quantity-save');

        if (!orderId) {
            alert('Erro interno: ID da ordem não encontrado.');
            return;
        }

        const adjustmentQty = parseInt(reductionInput?.value || '0');
        const reason = reasonSelect?.value || '';
        const observations = (observationsInput?.value || '').trim();

        // Validações
        if (!adjustmentQty || adjustmentQty === 0) {
            alert('Informe um valor válido para o ajuste (positivo para aumentar, negativo para reduzir).');
            if (reductionInput) reductionInput.focus();
            return;
        }

        const finalQty = originalQty + adjustmentQty;

        if (finalQty < 0) {
            alert('A quantidade final não pode ser negativa. Ajuste inválido.');
            if (reductionInput) reductionInput.focus();
            return;
        }

        if (!reason) {
            alert('Selecione o motivo do ajuste.');
            if (reasonSelect) reasonSelect.focus();
            return;
        }

        try {
            if (statusDiv) statusDiv.textContent = 'Aplicando ajuste...';
            if (submitButton) {
                submitButton.disabled = true;
                submitButton.textContent = 'Aplicando...';
            }

            // Criar registro do ajuste (para o array, sem serverTimestamp)
            const adjustmentRecordForArray = {
                orderId: orderId,
                originalQuantity: originalQty,
                adjustmentQuantity: adjustmentQty,
                finalQuantity: finalQty,
                adjustmentType: adjustmentQty > 0 ? 'increase' : 'decrease',
                reason: reason,
                observations: observations,
                adjustedBy: getActiveUser()?.name || 'Sistema',
                adjustedAt: new Date().toISOString(),
                workDay: new Date().toISOString().split('T')[0]
            };

            // Criar registro do ajuste (para coleção separada, com serverTimestamp)
            const adjustmentRecordForCollection = {
                ...adjustmentRecordForArray,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            };

            // Salvar registro do ajuste na coleção
            await db.collection('quantity_adjustments').add(adjustmentRecordForCollection);

            // Atualizar a quantidade do lote (lot_size) da OP
            const currentOrder = await db.collection('production_orders').doc(orderId).get();
            const orderData = currentOrder.data();
            const currentAdjustments = orderData.quantity_adjustments || [];
            
            await db.collection('production_orders').doc(orderId).update({
                lot_size: finalQty,
                quantity_adjustments: [...currentAdjustments, adjustmentRecordForArray],
                total_adjustments: (orderData.total_adjustments || 0) + adjustmentQty,
                lastQuantityAdjustment: adjustmentRecordForArray,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            if (statusDiv) {
                statusDiv.className = 'text-sm font-semibold h-5 text-center mt-2 text-green-600';
                statusDiv.textContent = 'Ajuste aplicado com sucesso!';
            }
            
            // Recarregar a lista de ordens se estiver visível
            if (typeof loadProductionOrders === 'function') {
                await loadProductionOrders();
            }
            
            setTimeout(() => {
                closeAdjustQuantityModal();
            }, 1500);

        } catch (error) {
            console.error('Erro ao aplicar ajuste de quantidade:', error);
            if (statusDiv) {
                statusDiv.className = 'text-sm font-semibold h-5 text-center mt-2 text-red-600';
                statusDiv.textContent = 'Erro ao aplicar ajuste. Tente novamente.';
            }
        } finally {
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = 'Aplicar Ajuste';
            }
        }
    }

    // Funções para controle de OP ativa na máquina
    async function checkActiveOrderOnMachine(machineId) {
        try {
            const snapshot = await db.collection('production_orders')
                .where('machine_id', '==', machineId)
                .where('status', '==', 'ativa')
                .limit(1)
                .get();
            
            return snapshot.empty ? null : { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
        } catch (error) {
            console.error('Erro ao verificar OP ativa na máquina:', error);
            return null;
        }
    }

    async function setOrderAsActive(orderId, machineId) {
        try {
            // Verificar se já existe OP ativa na máquina
            const activeOrder = await checkActiveOrderOnMachine(machineId);
            
            if (activeOrder && activeOrder.id !== orderId) {
                const confirmChange = confirm(
                    `A máquina ${machineId} já possui a OP "${activeOrder.order_number}" ativa.\n\n` +
                    `Deseja finalizar a OP atual e ativar a nova OP?\n\n` +
                    `⚠️ IMPORTANTE: Certifique-se de que todas as quantidades da OP atual estão corretas antes de continuar.`
                );
                
                if (!confirmChange) {
                    return false;
                }
                
                // Finalizar OP atual
                await db.collection('production_orders').doc(activeOrder.id).update({
                    status: 'concluida',
                    finishedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    finishedBy: getActiveUser()?.name || 'Sistema'
                });
            }
            
            // Ativar nova OP
            await db.collection('production_orders').doc(orderId).update({
                status: 'ativa',
                machine_id: machineId,
                startedAt: firebase.firestore.FieldValue.serverTimestamp(),
                startedBy: getActiveUser()?.name || 'Sistema'
            });
            
            return true;
        } catch (error) {
            console.error('Erro ao ativar OP na máquina:', error);
            return false;
        }
    }

    async function finishActiveOrder(orderId) {
        try {
            const confirmFinish = confirm(
                `Deseja finalizar esta Ordem de Produção?\n\n` +
                `⚠️ IMPORTANTE: Certifique-se de que todas as quantidades produzidas estão corretas.\n` +
                `Após finalizar, uma nova OP poderá ser ativada na máquina.`
            );
            
            if (!confirmFinish) {
                return false;
            }
            
            await db.collection('production_orders').doc(orderId).update({
                status: 'concluida',
                finishedAt: firebase.firestore.FieldValue.serverTimestamp(),
                finishedBy: getActiveUser()?.name || 'Sistema'
            });
            
            return true;
        } catch (error) {
            console.error('Erro ao finalizar OP:', error);
            return false;
        }
    }

    // Função para verificar e restaurar paradas ativas do Firebase
    async function checkActiveDowntimes() {
        if (!db || !selectedMachineData) return;
        
        try {
            const activeDowntimeDoc = await db.collection('active_downtimes').doc(selectedMachineData.machine).get();
            
            if (activeDowntimeDoc.exists) {
                const activeDowntime = activeDowntimeDoc.data();
                console.log('[TRACE] Parada ativa encontrada no Firebase:', activeDowntime);
                
                // Restaurar estado da parada
                const startDate = activeDowntime.startDate || '';
                const startTime = activeDowntime.startTime || '';
                
                currentDowntimeStart = {
                    machine: activeDowntime.machine,
                    date: startDate,
                    startTime: startTime,
                    startTimestamp: activeDowntime.startTimestamp?.toDate() || new Date()
                };
                
                machineStatus = 'stopped';
                updateMachineStatus();
                freezeProductionTimer();
                startDowntimeTimer();
                
                // Calcular tempo desde o início da parada
                const now = new Date();
                const startDateTime = activeDowntime.startTimestamp?.toDate() || new Date();
                const elapsedHours = ((now - startDateTime) / (1000 * 60 * 60)).toFixed(1);
                
                showNotification(`Parada ativa restaurada! Tempo decorrido: ${elapsedHours}h`, 'warning');
                
                console.log('[TRACE] Estado da parada restaurado com sucesso');
            } else {
                console.log('[TRACE] Nenhuma parada ativa encontrada para a máquina', selectedMachineData.machine);
            }
        } catch (error) {
            console.error('Erro ao verificar paradas ativas:', error);
        }
    }

    function listenToProductionOrders() {
        if (!db || !productionOrderTableBody) return;

        if (typeof productionOrdersUnsubscribe === 'function') {
            productionOrdersUnsubscribe();
        }

        try {
            productionOrdersUnsubscribe = db.collection('production_orders')
                .orderBy('createdAt', 'desc')
                .onSnapshot(snapshot => {
                    productionOrdersCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    renderProductionOrdersTable(productionOrdersCache);
                    populatePlanningOrderSelect();
                    if (productionOrderStatusMessage && productionOrderStatusMessage.className.includes('text-status-error')) {
                        setProductionOrderStatus('', 'info');
                    }
                }, error => {
                    console.error('Erro ao carregar ordens de produção:', error);
                    renderProductionOrdersTable([]);
                    setProductionOrderStatus('Não foi possível carregar as ordens de produção.', 'error');
                });
        } catch (error) {
            console.error('Erro ao inicializar listener de ordens de produção:', error);
            setProductionOrderStatus('Erro ao iniciar monitoramento das ordens.', 'error');
        }
    }

    async function handleProductionOrderFormSubmit(event) {
        event.preventDefault();

        if (!productionOrderForm) return;

        if (!window.authSystem.checkPermissionForAction('create_production_order')) {
            return;
        }

        const formData = new FormData(productionOrderForm);
        const rawData = Object.fromEntries(formData.entries());

        const orderNumber = (rawData.order_number || '').trim();
        if (!orderNumber) {
            setProductionOrderStatus('Informe o número da OP antes de salvar.', 'error');
            return;
        }

        const normalizedOrderNumber = orderNumber.toUpperCase();

        const partCode = (rawData.part_code || '').trim();
        const matchedProduct = partCode ? productDatabase.find(item => String(item.cod) === partCode) : null;

        const submitButton = productionOrderForm.querySelector('button[type="submit"]');
        const originalButtonContent = submitButton ? submitButton.innerHTML : '';

        try {
            if (submitButton) {
                submitButton.disabled = true;
                submitButton.innerHTML = `<i data-lucide="loader-2" class="animate-spin"></i><span>Salvando...</span>`;
                lucide.createIcons();
            }

            setProductionOrderStatus('Salvando ordem de produção...', 'info');

            const existingSnapshot = await db.collection('production_orders')
                .where('order_number', '==', normalizedOrderNumber)
                .limit(1)
                .get();

            if (!existingSnapshot.empty && !productionOrderForm.dataset.editingOrderId) {
                setProductionOrderStatus('Já existe uma ordem com este número.', 'error');
                return;
            }

            // Se estamos editando, deletar ordem antiga se o número mudou
            const editingOrderId = productionOrderForm.dataset.editingOrderId;
            if (editingOrderId && !existingSnapshot.empty && existingSnapshot.docs[0].id !== editingOrderId) {
                setProductionOrderStatus('Já existe uma ordem com este número.', 'error');
                return;
            }

            const docData = {
                order_number: normalizedOrderNumber,
                order_number_original: orderNumber,
                customer_order: (rawData.customer_order || '').trim(),
                customer: (rawData.customer || matchedProduct?.client || '').trim(),
                client: (rawData.customer || matchedProduct?.client || '').trim(),
                product: (rawData.product || matchedProduct?.name || '').trim(),
                part_code: partCode,
                product_cod: partCode,
                lot_size: parseOptionalNumber(rawData.lot_size),
                batch_number: (rawData.batch_number || '').trim(),
                packaging_qty: parseOptionalNumber(rawData.packaging_qty),
                internal_packaging_qty: parseOptionalNumber(rawData.internal_packaging_qty),
                raw_material: (rawData.raw_material || matchedProduct?.mp || '').trim(),
                machine_id: (rawData.machine_id || '').trim() || null,
                status: 'planejada',
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            if (!editingOrderId) {
                docData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            }

            if (matchedProduct) {
                docData.product_snapshot = {
                    cod: matchedProduct.cod,
                    client: matchedProduct.client || '',
                    name: matchedProduct.name || '',
                    cavities: parseOptionalNumber(matchedProduct.cavities),
                    cycle: parseOptionalNumber(matchedProduct.cycle),
                    weight: parseOptionalNumber(matchedProduct.weight),
                    mp: matchedProduct.mp || ''
                };
            }

            if (editingOrderId) {
                await db.collection('production_orders').doc(editingOrderId).update(docData);
                setProductionOrderStatus('Ordem atualizada com sucesso!', 'success');
            } else {
                await db.collection('production_orders').add(docData);
                setProductionOrderStatus('Ordem cadastrada com sucesso!', 'success');
            }

            productionOrderForm.reset();
            delete productionOrderForm.dataset.editingOrderId;
            clearProductionOrderAutoFields();
            setProductionOrderFeedback();

            if (submitButton) {
                submitButton.innerHTML = `<i data-lucide="plus-circle"></i><span>Cadastrar OP</span>`;
            }

            setTimeout(() => setProductionOrderStatus('', 'info'), 3000);
        } catch (error) {
            console.error('Erro ao cadastrar ordem de produção:', error);
            setProductionOrderStatus('Erro ao cadastrar ordem. Tente novamente.', 'error');
        } finally {
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.innerHTML = originalButtonContent;
                lucide.createIcons();
            }
        }
    }

    function onPlanningProductCodChange(e) {
        const input = e?.target;
        if (!input) return;

        const rawCode = (input.value || '').trim();
        const product = productDatabase.find(p => String(p.cod) === rawCode);

        const cycleInput = document.getElementById('budgeted-cycle');
        const cavitiesInput = document.getElementById('mold-cavities');
        const weightInput = document.getElementById('piece-weight');
        const plannedQtyInput = document.getElementById('planned-quantity');
        const productNameDisplay = document.getElementById('product-name-display');
        const mpInput = planningMpInput || document.getElementById('planning-mp');

        const resetFields = () => {
            if (cycleInput) cycleInput.value = '';
            if (cavitiesInput) cavitiesInput.value = '';
            if (weightInput) weightInput.value = '';
            if (plannedQtyInput) plannedQtyInput.value = '';
            if (mpInput) mpInput.value = '';
        };

        const hideDisplay = () => {
            if (productNameDisplay) {
                productNameDisplay.textContent = '';
                productNameDisplay.style.display = 'none';
                productNameDisplay.classList.remove('text-red-600', 'bg-red-50');
                productNameDisplay.classList.add('text-primary-blue', 'bg-gray-50');
            }
        };

        if (product) {
            if (cycleInput) cycleInput.value = product.cycle || '';
            if (cavitiesInput) cavitiesInput.value = product.cavities || '';
            if (weightInput) weightInput.value = typeof product.weight === 'number' ? product.weight : '';
            if (mpInput) mpInput.value = product.mp || '';

            const cycle = Number(product.cycle) || 0;
            const cavities = Number(product.cavities) || 0;
            const plannedQty = cycle > 0 ? Math.floor((86400 / cycle) * cavities * 0.85) : 0;
            if (plannedQtyInput) plannedQtyInput.value = plannedQty;

            if (productNameDisplay) {
                productNameDisplay.textContent = `${product.name} (${product.client})`;
                productNameDisplay.style.display = 'block';
                productNameDisplay.classList.remove('text-red-600', 'bg-red-50');
                productNameDisplay.classList.add('text-primary-blue', 'bg-gray-50');
            }
            return;
        }

        // Caso sem produto encontrado
        resetFields();

        if (!rawCode) {
            hideDisplay();
            return;
        }

        if (productNameDisplay && e.type !== 'input') {
            productNameDisplay.textContent = 'Produto não encontrado';
            productNameDisplay.style.display = 'block';
            productNameDisplay.classList.remove('text-primary-blue', 'bg-gray-50');
            productNameDisplay.classList.add('text-red-600', 'bg-red-50');
        } else if (productNameDisplay && e.type === 'input') {
            hideDisplay();
        }
    }

    async function handlePlanningFormSubmit(e) {
        e.preventDefault();
        
        // Verificar permissão
        if (!window.authSystem.checkPermissionForAction('create_planning')) {
            return;
        }
        
        const form = e.target;
    const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        
        // Buscar dados completos do produto selecionado
        const productCod = data.product_cod;
        const product = productDatabase.find(p => p.cod == productCod);
        
        if (!product) {
            alert('Produto não encontrado!');
            return;
        }

        const statusMessage = document.getElementById('planning-status-message');
        const submitButton = document.getElementById('planning-submit-button');
        
        if (!submitButton) return;
        
        submitButton.disabled = true;
        submitButton.innerHTML = `<i data-lucide="loader-2" class="animate-spin"></i><span>A Adicionar...</span>`;
        lucide.createIcons();
        
        try {
            const mpValue = (data.mp || product.mp || '').trim();
            product.mp = mpValue;
            const docData = {
                date: data.date,
                machine: data.machine,
                production_order_id: data.production_order_id || null,
                product_cod: product.cod,
                client: product.client,
                product: product.name,
                budgeted_cycle: product.cycle,
                mold_cavities: product.cavities,
                piece_weight: parseFloat(data.piece_weight) || product.weight,
                planned_quantity: parseInt(data.planned_quantity, 10) || 0,
                mp: mpValue,
                mp_type: data.mp_type || '',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            };
            await db.collection('planning').add(docData);
            
            if (statusMessage) {
                statusMessage.textContent = 'Item adicionado com sucesso!';
                statusMessage.className = 'text-status-success text-sm font-semibold h-5 text-center';
            }
            form.reset();
            document.getElementById('budgeted-cycle').value = '';
            document.getElementById('mold-cavities').value = '';
            document.getElementById('piece-weight').value = '';
            document.getElementById('planned-quantity').value = '';
            if (planningMpInput) planningMpInput.value = '';
            if (planningOrderSelect) planningOrderSelect.value = '';
            const productNameDisplay = document.getElementById('product-name-display');
            if (productNameDisplay) {
                productNameDisplay.textContent = '';
                productNameDisplay.style.display = 'none';
            }
            const orderInfo = document.getElementById('planning-order-info');
            if (orderInfo) {
                orderInfo.style.display = 'none';
                orderInfo.textContent = '';
            }
        } catch (error) {
            console.error("Erro ao adicionar planejamento: ", error);
            if (statusMessage) {
                statusMessage.textContent = 'Erro ao adicionar. Tente novamente.';
                statusMessage.className = 'text-status-error text-sm font-semibold h-5 text-center';
            }
        } finally {
            submitButton.disabled = false;
            submitButton.innerHTML = `<i data-lucide="plus-circle"></i><span>Adicionar ao Plano</span>`;
            lucide.createIcons();
            if (statusMessage) {
                setTimeout(() => statusMessage.textContent = '', 3000);
            }
        }
    }

    function listenToPlanningChanges(date) {
        if (!date) return;
        
        detachActiveListener();
        showLoadingState('leader-panel', true);
        
        let planningItems = [];
        let productionEntries = [];
        let downtimeEntries = [];

        const render = () => {
            const combinedData = planningItems.map(plan => {
                const shifts = { T1: 0, T2: 0, T3: 0 };

                productionEntries.forEach(entry => {
                    if (!entry || entry.planId !== plan.id) return;
                    const shiftKey = normalizeShiftValue(entry.turno);
                    if (!shiftKey || !shifts.hasOwnProperty(shiftKey)) return;
                    const produced = Number(entry.produzido) || 0;
                    shifts[shiftKey] += produced;
                });

                return {
                    ...plan,
                    T1: { produzido: shifts.T1 },
                    T2: { produzido: shifts.T2 },
                    T3: { produzido: shifts.T3 },
                    total_produzido: shifts.T1 + shifts.T2 + shifts.T3
                };
            });

            renderPlanningTable(combinedData);
            renderLeaderPanel(planningItems);
        const activePlans = planningItems.filter(isPlanActive);
        renderMachineCards(activePlans, productionEntries, downtimeEntries);
            showLoadingState('leader-panel', false, planningItems.length === 0);
        };

        const planningListener = db.collection('planning').where('date', '==', date)
            .onSnapshot(snapshot => {
                planningItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                planningItems.sort((a, b) => (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0));
                if (machineSelector) {
                    machineSelector.machineData = {};
                    planningItems.forEach(item => {
                        if (isPlanActive(item)) {
                            machineSelector.machineData[item.machine] = { id: item.id, ...item };
                        }
                    });
                }
                if (selectedMachineData) {
                    const updatedSelected = planningItems.find(item => item.id === selectedMachineData.id);
                    if (updatedSelected) {
                        selectedMachineData = { ...selectedMachineData, ...updatedSelected };
                        if (productName) {
                            productName.textContent = selectedMachineData.product || 'Produto não definido';
                        }
                        if (shiftTarget) {
                            const currentShift = getCurrentShift();
                            const target = selectedMachineData.planned_quantity || 0;
                            shiftTarget.textContent = Math.round(target / 3) || 0;
                        }
                        if (productMp) {
                            productMp.textContent = selectedMachineData.mp ? `MP: ${selectedMachineData.mp}` : 'Matéria-prima não definida';
                        }
                    }
                }
                render();
            }, error => {
                console.error("Erro ao carregar planejamentos:", error);
                if(leaderLaunchPanel) leaderLaunchPanel.innerHTML = `<div class="col-span-full text-center text-red-600">Erro ao carregar dados.</div>`;
                showLoadingState('leader-panel', false, true);
            });

        const entriesListener = db.collection('production_entries').where('data', '==', date)
            .onSnapshot(snapshot => {
                productionEntries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                render();
            }, error => console.error("Erro ao carregar lançamentos de produção:", error));
        // Listener de paradas do dia selecionado e próximo dia (para cobrir T3 após 00:00)
        const base = new Date(`${date}T12:00:00`);
        const next = new Date(base); next.setDate(next.getDate() + 1);
        const nextStr = new Date(next.getTime() - next.getTimezoneOffset()*60000).toISOString().split('T')[0];
        const downtimeListener = db.collection('downtime_entries')
            .where('date', 'in', [date, nextStr])
            .onSnapshot(snapshot => {
                downtimeEntries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                render();
            }, error => console.error('Erro ao carregar paradas:', error));

        activeListenerUnsubscribe = { planningListener, entriesListener, downtimeListener };
    }

    function renderPlanningTable(items) {
        if (!planningTableBody) return;
        const orDash = (value) => value || '-';
        const orDashNum = (value) => value ? value.toLocaleString('pt-BR') : '-';
        const cycleClass = (realCycle, budgetedCycle) => {
            if (!realCycle || !budgetedCycle) return '';
            return realCycle > budgetedCycle ? 'text-status-error font-bold' : '';
        };

        planningTableBody.innerHTML = items.map(item => `
            <tr class="hover:bg-gray-50 text-center text-sm">
                <td class="px-2 py-2 whitespace-nowrap border text-left">${item.machine}</td>
                <td class="px-2 py-2 whitespace-nowrap border text-left">${item.product}</td>
                <td class="px-2 py-2 whitespace-nowrap border text-left">${orDash(item.mp)}</td>
                <td class="px-2 py-2 whitespace-nowrap border">${orDash(item.budgeted_cycle)}</td>
                <td class="px-2 py-2 whitespace-nowrap border">${orDash(item.mold_cavities)}</td>
                <td class="px-2 py-2 whitespace-nowrap border">${orDash(item.piece_weight)}</td>
                
                <td class="px-2 py-2 whitespace-nowrap border bg-blue-50 ${cycleClass(item.real_cycle_t1, item.budgeted_cycle)}">${orDash(item.real_cycle_t1)}</td>
                <td class="px-2 py-2 whitespace-nowrap border bg-blue-50">${orDash(item.active_cavities_t1)}</td>
                <td class="px-2 py-2 whitespace-nowrap border bg-blue-50">${orDashNum(item.T1?.produzido)}</td>

                <td class="px-2 py-2 whitespace-nowrap border bg-yellow-50 ${cycleClass(item.real_cycle_t2, item.budgeted_cycle)}">${orDash(item.real_cycle_t2)}</td>
                <td class="px-2 py-2 whitespace-nowrap border bg-yellow-50">${orDash(item.active_cavities_t2)}</td>
                <td class="px-2 py-2 whitespace-nowrap border bg-yellow-50">${orDashNum(item.T2?.produzido)}</td>

                <td class="px-2 py-2 whitespace-nowrap border bg-purple-50 ${cycleClass(item.real_cycle_t3, item.budgeted_cycle)}">${orDash(item.real_cycle_t3)}</td>
                <td class="px-2 py-2 whitespace-nowrap border bg-purple-50">${orDash(item.active_cavities_t3)}</td>
                <td class="px-2 py-2 whitespace-nowrap border bg-purple-50">${orDashNum(item.T3?.produzido)}</td>

                <td class="px-2 py-2 whitespace-nowrap border font-bold">${orDashNum(item.total_produzido)}</td>
                <td class="px-2 py-2 whitespace-nowrap border">${item.machine}</td>
                <td class="px-2 py-2 whitespace-nowrap border no-print">
                    <button data-id="${item.id}" class="delete-plan-btn text-status-error hover:text-red-700 p-1 mx-auto flex"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                </td>
            </tr>
        `).join('');
        lucide.createIcons();
    }

    function handlePlanningTableClick(e) {
        const deleteButton = e.target.closest('.delete-plan-btn');
        if (deleteButton) {
            const docId = deleteButton.dataset.id;
            showConfirmModal(docId, 'planning');
        }
    }
    
    // --- PAINEL DO LÍDER ---
    function renderLeaderPanel(planItems) {
        if (!leaderLaunchPanel) return;

        leaderLaunchPanel.innerHTML = planItems.map(item => {
            const turnos = ['T1', 'T2', 'T3'];
            const statusHtml = turnos.map(turno => {
                const isComplete = item[`real_cycle_${turno.toLowerCase()}`] && item[`active_cavities_${turno.toLowerCase()}`];
                const statusClass = isComplete ? 'bg-green-100 text-status-success' : 'bg-yellow-100 text-status-warning';
                const statusIcon = isComplete ? `<i data-lucide="check-circle-2" class="w-4 h-4"></i>` : `<i data-lucide="alert-circle" class="w-4 h-4"></i>`;
                return `<div class="flex items-center justify-center gap-2 p-1 rounded-md text-xs font-semibold ${statusClass}">${statusIcon} ${turno}</div>`;
            }).join('');
            
            const btnClasses = turnos.map(turno => {
                 const isComplete = item[`real_cycle_${turno.toLowerCase()}`] && item[`active_cavities_${turno.toLowerCase()}`];
                 return isComplete ? 'bg-status-success hover:bg-green-700' : 'bg-gray-500 hover:bg-gray-600';
            });
            const mpLabel = item.mp ? `<p class="text-xs text-gray-500 mt-1">MP: ${item.mp}</p>` : '';

            return `
                <div class="border rounded-lg p-4 shadow-md flex flex-col justify-between bg-white">
                    <div>
                        <h3 class="font-bold text-lg">${item.machine}</h3>
                        <p class="text-sm text-gray-600">${item.product}</p>
                        ${mpLabel}
                        <div class="grid grid-cols-3 gap-2 mt-2">
                           ${statusHtml}
                        </div>
                    </div>
                    <div class="grid grid-cols-3 gap-2 mt-4">
                        <button data-id="${item.id}" data-turno="T1" class="setup-btn ${btnClasses[0]} text-white font-bold py-2 px-3 rounded-lg text-sm">1º Turno</button>
                        <button data-id="${item.id}" data-turno="T2" class="setup-btn ${btnClasses[1]} text-white font-bold py-2 px-3 rounded-lg text-sm">2º Turno</button>
                        <button data-id="${item.id}" data-turno="T3" class="setup-btn ${btnClasses[2]} text-white font-bold py-2 px-3 rounded-lg text-sm">3º Turno</button>
                    </div>
                </div>
            `;
        }).join('');
        lucide.createIcons();
    }
    
    function handleLeaderPanelClick(e) {
        const setupButton = e.target.closest('.setup-btn');
        if (setupButton) {
            const docId = setupButton.dataset.id;
            const turno = setupButton.dataset.turno;
            showLeaderModal(docId, turno);
        }
    }

    async function showLeaderModal(docId, turno) {
        if (!leaderModalForm || !leaderModalTitle) return;
        
        console.log('[TRACE][showLeaderModal] opening', { docId, turno });

        leaderModalForm.querySelector('#leader-modal-cancel-btn')?.remove();
        
        leaderModalForm.innerHTML = `
            <input type="hidden" id="leader-entry-doc-id" name="docId">
            <input type="hidden" id="leader-entry-turno" name="turno">
            <div>
                <label for="leader-entry-real-cycle" class="block text-sm font-medium">Ciclo Real (${turno})</label>
                <input type="number" id="leader-entry-real-cycle" name="real_cycle" step="0.1" class="mt-1 w-full p-2 border-gray-300 rounded-md">
            </div>
            <div>
                <label for="leader-entry-active-cavities" class="block text-sm font-medium">Cavidades Ativas (${turno})</label>
                <input type="number" id="leader-entry-active-cavities" name="active_cavities" step="1" class="mt-1 w-full p-2 border-gray-300 rounded-md">
            </div>
            <div class="mt-6 flex justify-end gap-3 pt-4 border-t">
                <button type="button" id="leader-modal-cancel-btn" class="bg-gray-200 hover:bg-gray-300 font-bold py-2 px-6 rounded-lg">Cancelar</button>
                <button type="submit" class="bg-primary-blue hover:bg-blue-800 text-white font-bold py-2 px-6 rounded-lg">Salvar</button>
            </div>`;
        
        leaderModal.querySelector('#leader-modal-cancel-btn').addEventListener('click', hideLeaderModal);
        
        document.getElementById('leader-entry-doc-id').value = docId;
        document.getElementById('leader-entry-turno').value = turno;

        try {
            const docRef = db.collection('planning').doc(docId);
            const doc = await docRef.get();
            if (doc.exists) {
                const data = doc.data();
                console.log('[TRACE][showLeaderModal] planning data', data);
                leaderModalTitle.textContent = `Lançamento: ${data.machine} - ${turno}`;
                
                document.getElementById('leader-entry-real-cycle').value = data[`real_cycle_${turno.toLowerCase()}`] || '';
                document.getElementById('leader-entry-active-cavities').value = data[`active_cavities_${turno.toLowerCase()}`] || '';
            }
            
        } catch (error) {
            console.error("Erro ao buscar dados do setup: ", error);
        }
        
        leaderModal.classList.remove('hidden');
        console.log('[TRACE][showLeaderModal] modal displayed');
    }
    
    function hideLeaderModal() {
        if (leaderModal) leaderModal.classList.add('hidden');
    }

    async function handleLeaderEntrySubmit(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const docId = formData.get('docId');
        const turno = formData.get('turno');
        const realCycle = parseFloat(formData.get('real_cycle')) || null;
        const activeCavities = parseInt(formData.get('active_cavities')) || null;

        console.log('[TRACE][handleLeaderEntrySubmit] submission data', {
            docId,
            turno,
            realCycle,
            activeCavities
        });

        const planDataToUpdate = {
            [`real_cycle_${turno.toLowerCase()}`]: realCycle,
            [`active_cavities_${turno.toLowerCase()}`]: activeCavities,
        };

        console.log('[TRACE][handleLeaderEntrySubmit] updating planning document', planDataToUpdate);

        try {
            await db.collection('planning').doc(docId).update(planDataToUpdate);

            hideLeaderModal();
            console.log('[TRACE][handleLeaderEntrySubmit] completed successfully');
        } catch (error) {
            console.error("Erro ao salvar dados do líder: ", error);
            alert("Não foi possível salvar os dados. Tente novamente.");
        }
    }

    // --- PAINEL DO OPERADOR ---
    function listenToCurrentProductionPlan() {
        detachActiveListener();
        const date = getProductionDateString();
        showLoadingState('launch-panel', true);

        let planningItems = [];
        let launchedEntries = new Set();
        let productionEntries = [];

        const render = () => {
            renderLaunchPanel(planningItems, launchedEntries, productionEntries);
            showLoadingState('launch-panel', false, planningItems.length === 0);
        };

        const planningListener = db.collection('planning')
            .where('date', '==', date)
            .onSnapshot(snapshot => {
                planningItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                planningItems.sort((a, b) => (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0));
                render();
            }, error => {
                 console.error("Erro ao carregar plano de produção: ", error);
                 if (launchPanelContainer) {
                    launchPanelContainer.innerHTML = `<div class="col-span-full text-center text-red-600 bg-red-50 p-4 rounded-lg"><p class="font-bold">Falha ao carregar dados.</p></div>`;
                 }
            });
        
        const entriesListener = db.collection('production_entries')
            .where('data', '==', date)
            .onSnapshot(snapshot => {
                launchedEntries = new Set();
                productionEntries = snapshot.docs.map(doc => doc.data());
                snapshot.forEach(doc => {
                    const entry = doc.data();
                    if(entry.produzido > 0 || entry.refugo_kg > 0) {
                        launchedEntries.add(`${entry.planId}-${entry.turno}`);
                    }
                });
                render();
            }, error => {
                console.error("Erro ao carregar lançamentos de produção: ", error);
            });

        activeListenerUnsubscribe = { planningListener, entriesListener };
    }

    function renderLaunchPanel(planItems, launchedEntries, productionEntries) {
        if (!launchPanelContainer) return;
        launchPanelContainer.innerHTML = planItems.map(item => {
            const t1Launched = launchedEntries.has(`${item.id}-T1`);
            const t2Launched = launchedEntries.has(`${item.id}-T2`);
            const t3Launched = launchedEntries.has(`${item.id}-T3`);

            const t1Class = t1Launched ? 'bg-status-success hover:bg-green-700' : 'bg-gray-500 hover:bg-gray-600';
            const t2Class = t2Launched ? 'bg-status-success hover:bg-green-700' : 'bg-gray-500 hover:bg-gray-600';
            const t3Class = t3Launched ? 'bg-status-success hover:bg-green-700' : 'bg-gray-500 hover:bg-gray-600';
            
            const totalProduzido = productionEntries
                .filter(p => p.planId === item.id)
                .reduce((sum, p) => sum + (p.produzido || 0), 0);
            
            const meta = item.planned_quantity || 0;
            const progresso = meta > 0 ? (totalProduzido / meta) * 100 : 0;
            const progressoCor = progresso < 50 ? 'bg-status-error' : progresso < 90 ? 'bg-status-warning' : 'bg-status-success';

            return `
            <div class="bg-gray-50 border rounded-lg p-4 shadow-sm flex flex-col justify-between">
                <div>
                    <div class="flex justify-between items-start">
                        <div>
                            <h3 class="font-bold text-lg">${item.machine}</h3>
                            <p class="text-sm text-gray-600">${item.product}</p>
                            <p class="text-xs text-gray-500 mt-1">${item.mp ? `MP: ${item.mp}` : 'MP não definida'}</p>
                        </div>
                        <span class="text-xs font-bold text-gray-500">${totalProduzido.toLocaleString('pt-BR')} / ${meta.toLocaleString('pt-BR')}</span>
                    </div>
                    <div class="w-full bg-gray-200 rounded-full h-2.5 mt-2">
                        <div class="${progressoCor} h-2.5 rounded-full" style="width: ${Math.min(progresso, 100)}%"></div>
                    </div>
                </div>
                <div class="grid grid-cols-3 gap-2 mt-4">
                    <button data-id="${item.id}" data-turno="T1" class="launch-btn ${t1Class} text-white font-bold py-2 rounded-md">Turno 1</button>
                    <button data-id="${item.id}" data-turno="T2" class="launch-btn ${t2Class} text-white font-bold py-2 rounded-md">Turno 2</button>
                    <button data-id="${item.id}" data-turno="T3" class="launch-btn ${t3Class} text-white font-bold py-2 rounded-md">Turno 3</button>
                </div>
            </div>
        `}).join('');
        lucide.createIcons();
    }
    
    async function handleLaunchPanelClick(e) {
        const launchButton = e.target.closest('.launch-btn');
        if (launchButton) {
            const planId = launchButton.dataset.id;
            const turno = launchButton.dataset.turno;
            showProductionModal(planId, turno);
        }
    }

    async function showProductionModal(planId, turno) {
        if (!productionModalForm || !productionModalTitle) return;
        
        productionModalForm.reset();
        document.getElementById('production-entry-plan-id').value = planId;
        document.getElementById('production-entry-turno').value = turno;

        try {
            const planDoc = await db.collection('planning').doc(planId).get();
            if (planDoc.exists) {
                const planData = planDoc.data();
                productionModalTitle.textContent = `Lançamento: ${planData.machine} - ${turno}`;
                
                // Configurar informações do produto
                const productWeightInfo = document.getElementById('product-weight-info');
                if (productWeightInfo) {
                    const infoParts = [`Peso da peça: ${planData.piece_weight || 0}g`];
                    if (planData.mp) infoParts.push(`MP: ${planData.mp}`);
                    productWeightInfo.textContent = infoParts.join(' • ');
                }
                
                // Configurar caixa de tara
                const taraCheckbox = document.getElementById('use-tara-box');
                const taraWeightInput = document.getElementById('tara-box-weight');
                const taraInfo = document.getElementById('tara-box-info');
                
                const taraData = taraBoxesDatabase[planData.machine];
                if (taraData) {
                    taraWeightInput.value = taraData.peso;
                    taraInfo.textContent = taraData.descricao;
                }
            } else { throw new Error("Plano não encontrado."); }
            
            // Carregar lançamentos existentes
            await loadHourlyEntries(planId, turno);
            
            productionModal.classList.remove('hidden');

        } catch(error) {
            console.error("Erro ao abrir modal de produção:", error);
            alert("Não foi possível carregar os dados. Tente novamente.");
        }
    }

    function hideProductionModal() {
        if (productionModal) productionModal.classList.add('hidden');
    }

    async function handleProductionEntrySubmit(e) {
        e.preventDefault();
        const statusMessage = document.getElementById('production-modal-status');
        const saveButton = document.getElementById('production-modal-save-btn');
        
        if (!saveButton) return;
        
        saveButton.disabled = true;
        saveButton.textContent = 'Salvando...';

        const formData = new FormData(productionModalForm);
        const planId = formData.get('planId');
        const turno = formData.get('turno');
        
        console.log('[TRACE][handleProductionEntrySubmit] submission started', { planId, turno });

        const produzido = parseInt(formData.get('produzido')) || 0;
        const refugoKg = parseFloat(formData.get('refugo')) || 0;
        const borrasKg = parseFloat(formData.get('borras')) || 0;
        const motivoRefugo = formData.get('perdas');

        console.log('[TRACE][handleProductionEntrySubmit] parsed form values', {
            produzido,
            refugoKg,
            borrasKg,
            motivoRefugo
        });

        try {
            // Salvar lançamentos por hora
            await saveHourlyEntries(planId, turno);
            console.log('[TRACE][handleProductionEntrySubmit] hourly entries saved');

            // Salvar registro principal de produção
            const entriesRef = db.collection('production_entries');
            const q = entriesRef.where('planId', '==', planId).where('turno', '==', turno).limit(1);
            const querySnapshot = await q.get();
            const planDoc = await db.collection('planning').doc(planId).get();
            const planData = planDoc.exists ? planDoc.data() : {};
            const planMachine = planData.machine || selectedMachineData?.machine || null;
            const planDate = planData.date || getProductionDateString();
            const planMp = planData.mp || '';
            const planMpType = planData.mp_type || '';

            console.log('[TRACE][handleProductionEntrySubmit] resolved plan info', {
                planMachine,
                planDate,
                planMp,
                planMpType
            });

            const entryPayload = {
                produzido,
                duracao_min: 0,
                refugo_kg: refugoKg,
                borras_kg: borrasKg,
                motivo_refugo: motivoRefugo,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                machine: planMachine, // FIX: vincula a máquina correta para análise e filtros
                mp: planMp,
                mp_type: planMpType
            };

            console.log('[TRACE][handleProductionEntrySubmit] entry payload', entryPayload);
            
            if(querySnapshot.empty){
                console.log('[TRACE][handleProductionEntrySubmit] creating production entry');
                await entriesRef.add({
                    ...entryPayload,
                    planId,
                    turno,
                    data: planDate,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                }); // FIX: inclui data/createdAt para uso futuro
            } else {
                console.log('[TRACE][handleProductionEntrySubmit] updating existing production entry');
                await querySnapshot.docs[0].ref.update({
                    ...entryPayload,
                    data: planDate
                });
            }

            if (statusMessage) {
                statusMessage.textContent = 'Lançamentos salvos com sucesso!';
                statusMessage.className = 'text-green-600 text-sm font-semibold h-5 text-center';
            }
            // Atualizar aba de análise se estiver aberta
            await refreshAnalysisIfActive();
            setTimeout(() => {
                hideProductionModal();
                if (statusMessage) statusMessage.textContent = '';
            }, 1500);
        } catch (error) {
            console.error("Erro ao salvar lançamentos: ", error);
            if (statusMessage) {
                statusMessage.textContent = 'Erro ao salvar. Tente novamente.';
                statusMessage.className = 'text-red-600 text-sm font-semibold h-5 text-center';
            }
        } finally {
            saveButton.disabled = false;
            saveButton.textContent = 'Salvar Lançamentos';
        }
    }
    // --- ABA DE LANÇAMENTO INTERATIVO ---
    
    function setupLaunchTab() {
        populateMachineSelector();

        if (machineCardGrid && !machineCardGrid.dataset.listenerAttached) {
            machineCardGrid.addEventListener('click', async (event) => {
                // Ações de botões dentro do card
                const finalizeBtn = event.target.closest('.card-finalize-btn');
                if (finalizeBtn) {
                    event.preventDefault();
                    event.stopPropagation();
                    await handleCardFinalizeClick(finalizeBtn);
                    return;
                }
                const activateNextBtn = event.target.closest('.card-activate-next-btn');
                if (activateNextBtn) {
                    event.preventDefault();
                    event.stopPropagation();
                    await handleCardActivateNextClick(activateNextBtn);
                    return;
                }

                // Seleção do card da máquina
                const card = event.target.closest('.machine-card');
                if (!card) return;
                const machine = card.dataset.machine;
                if (!machine) return;
                await onMachineSelected(machine);
            });
            machineCardGrid.dataset.listenerAttached = 'true';
        }

        setupActionButtons();
        updateCurrentShift();
        setInterval(updateCurrentShift, 60000);

        // Toggle modo do gráfico (Por hora / OP)
        if (launchChartModeHourlyBtn && !launchChartModeHourlyBtn.dataset.listenerAttached) {
            launchChartModeHourlyBtn.addEventListener('click', async () => {
                if (launchChartMode === 'hourly') return;
                launchChartMode = 'hourly';
                launchChartModeHourlyBtn.classList.add('bg-white','text-blue-600','shadow-sm');
                launchChartModeOpBtn?.classList.remove('bg-white','text-blue-600','shadow-sm');
                if (opProductionChart) opProductionChart.classList.add('hidden');
                if (hourlyProductionChart) hourlyProductionChart.classList.remove('hidden');
                await refreshLaunchCharts();
            });
            launchChartModeHourlyBtn.dataset.listenerAttached = 'true';
        }
        if (launchChartModeOpBtn && !launchChartModeOpBtn.dataset.listenerAttached) {
            launchChartModeOpBtn.addEventListener('click', async () => {
                if (launchChartMode === 'op') return;
                launchChartMode = 'op';
                launchChartModeOpBtn.classList.add('bg-white','text-blue-600','shadow-sm');
                launchChartModeHourlyBtn?.classList.remove('bg-white','text-blue-600','shadow-sm');
                if (hourlyProductionChart) hourlyProductionChart.classList.add('hidden');
                if (opProductionChart) opProductionChart.classList.remove('hidden');
                await refreshLaunchCharts();
            });
            launchChartModeOpBtn.dataset.listenerAttached = 'true';
        }
    }

    function updateCurrentShift() {
        const now = new Date();
        const hour = now.getHours();
        let currentShift;
        
        if (hour >= 7 && hour < 15) {
            currentShift = 'T1';
        } else if (hour >= 15 && hour < 23) {
            currentShift = 'T2';
        } else {
            currentShift = 'T3';
        }
        
        if (currentShiftDisplay) {
            currentShiftDisplay.textContent = currentShift;
        }
    }
    
    function updateMachineInfo() {
        if (!selectedMachineData) return;
        
        if (machineIcon) machineIcon.textContent = selectedMachineData.machine;
        if (machineName) machineName.textContent = `Máquina ${selectedMachineData.machine}`;
        if (productName) productName.textContent = selectedMachineData.product || 'Produto não definido';
        if (shiftTarget) {
            // Usar APENAS lot_size, não planned_quantity (meta diária)
            const totalPlanned = selectedMachineData.order_lot_size || selectedMachineData.lot_size || 0;
            const totalExecuted = selectedMachineData.total_produzido || 0;
            
            if (!totalPlanned) {
                shiftTarget.textContent = `${totalExecuted.toLocaleString('pt-BR')} / N/A`;
            } else {
                shiftTarget.textContent = `${totalExecuted.toLocaleString('pt-BR')} / ${totalPlanned.toLocaleString('pt-BR')}`;
            }
        }
    }
    
    
    
    // Carregar gráfico da OP (acumulado por DIA ao longo da ordem)
    async function loadOpProductionChart() {
        if (!selectedMachineData || !opProductionChart) return;
        try {
            const orderId = selectedMachineData.order_id || selectedMachineData.orderId || null;
            const planId = selectedMachineData.id;
            let query = db.collection('production_entries');
            if (orderId) {
                query = query.where('orderId', '==', orderId);
            } else {
                query = query.where('planId', '==', planId);
            }
            const snap = await query.get();
            const entries = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            if (entries.length === 0) {
                if (opChartInstance) { opChartInstance.destroy(); opChartInstance = null; }
                const ctx = opProductionChart.getContext('2d');
                ctx.clearRect(0,0,opProductionChart.width, opProductionChart.height);
                return;
            }
            const parseDate = (e) => {
                try {
                    if (e.timestamp?.toDate) return e.timestamp.toDate();
                } catch (_) {}
                if (e.dataHoraInformada) return new Date(e.dataHoraInformada);
                if (e.data && e.horaInformada) return new Date(`${e.data}T${e.horaInformada}:00`);
                if (e.data) return new Date(`${e.data}T12:00:00`);
                return new Date();
            };
            // Agrupar por DIA de produção
            const toDateKey = (e) => {
                if (e.data) return e.data; // já deve estar em YYYY-MM-DD
                const d = parseDate(e);
                const y = d.getFullYear();
                const m = String(d.getMonth()+1).padStart(2,'0');
                const day = String(d.getDate()).padStart(2,'0');
                return `${y}-${m}-${day}`;
            };
            const dailyTotals = {};
            entries.forEach(e => {
                const key = toDateKey(e);
                const qty = Number(e.produzido || e.quantity || 0) || 0;
                dailyTotals[key] = (dailyTotals[key] || 0) + qty;
            });
            const dayKeys = Object.keys(dailyTotals).sort(); // YYYY-MM-DD ordena lexicograficamente por data
            let cumulative = 0;
            const labels = [];
            const values = [];
            const fmtDay = (k) => {
                // k: YYYY-MM-DD -> DD/MM
                const [yy, mm, dd] = k.split('-');
                return `${dd}/${mm}`;
            };
            dayKeys.forEach(k => {
                cumulative += dailyTotals[k];
                labels.push(fmtDay(k));
                values.push(cumulative);
            });
            if (opChartInstance) { opChartInstance.destroy(); opChartInstance = null; }
            opChartInstance = new Chart(opProductionChart.getContext('2d'), {
                type: 'line',
                data: {
                    labels,
                    datasets: [
                        {
                            label: 'Acumulado da OP (por dia)',
                            data: values,
                            borderColor: '#10B981',
                            backgroundColor: 'rgba(16,185,129,0.15)',
                            borderWidth: 2,
                            fill: true,
                            tension: 0.2,
                            pointRadius: 0
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: { grid: { display: false } },
                        y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } }
                    },
                    plugins: {
                        legend: { display: true },
                        tooltip: {
                            callbacks: {
                                label: (ctx) => ` ${ctx.parsed.y?.toLocaleString('pt-BR')} peças`
                            }
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Erro ao carregar gráfico da OP:', error);
        }
    }

    async function refreshLaunchCharts() {
        // Guard para evitar atualizações concorrentes sobrescrevendo o gráfico
        if (isRefreshingLaunchCharts) return;
        isRefreshingLaunchCharts = true;
        try {
            if (launchChartMode === 'op') {
                await loadOpProductionChart();
            } else {
                await loadHourlyProductionChart();
            }
        } finally {
            isRefreshingLaunchCharts = false;
        }
    }
    
    async function loadTodayStats() {
        if (!selectedMachineData) return;
        
        try {
            const today = getProductionDateString();
            // Calcular janela do dia de produção atual [07:00 de hoje, 07:00 de amanhã)
            const windowStart = combineDateAndTime(today, '07:00');
            const nextDay = new Date(windowStart);
            nextDay.setDate(nextDay.getDate() + 1);
            const tomorrow = nextDay.toISOString().split('T')[0];
            const windowEnd = combineDateAndTime(tomorrow, '07:00');
            
            // Carregar produção do dia para a MÁQUINA (somando todas as OPs do dia)
            const prodSnapshot = await db.collection('production_entries')
                .where('data', '==', today)
                .where('machine', '==', selectedMachineData.machine)
                .get();
            const prodDocs = prodSnapshot.docs;
            let totalProduced = 0;
            let totalLosses = 0;
            prodDocs.forEach(doc => {
                const data = doc.data();
                totalProduced += Number(data.produzido || data.quantity || 0) || 0;
                totalLosses += Number(data.refugo_kg || 0) || 0;
            });
            
            // Carregar paradas (duas consultas por data para evitar índice composto)
            const [dtSnapToday, dtSnapTomorrow] = await Promise.all([
                db.collection('downtime_entries')
                  .where('machine', '==', selectedMachineData.machine)
                  .where('date', '==', today)
                  .get(),
                db.collection('downtime_entries')
                  .where('machine', '==', selectedMachineData.machine)
                  .where('date', '==', tomorrow)
                  .get()
            ]);
            const dtDocs = [...dtSnapToday.docs, ...dtSnapTomorrow.docs];
            let totalDowntime = 0;
            dtDocs.forEach(doc => {
                const data = doc.data();
                const start = combineDateAndTime(data.date, data.startTime);
                const end = combineDateAndTime(data.date, data.endTime);
                if (!(start instanceof Date) || Number.isNaN(start.getTime())) return;
                if (!(end instanceof Date) || Number.isNaN(end.getTime())) return;
                const overlapStart = start > windowStart ? start : windowStart;
                const overlapEnd = end < windowEnd ? end : windowEnd;
                if (overlapEnd > overlapStart) {
                    totalDowntime += Math.round((overlapEnd - overlapStart) / 60000);
                }
            });
            
            // Calcular eficiência (mantém referência do alvo atual)
            const target = Number(selectedMachineData.order_lot_size || selectedMachineData.lot_size || selectedMachineData.planned_quantity || 0);
            const efficiency = target > 0 ? (totalProduced / target * 100) : 0;
            
            // Atualizar display
            if (producedToday) producedToday.textContent = totalProduced.toLocaleString('pt-BR');
            if (efficiencyToday) efficiencyToday.textContent = efficiency.toFixed(1) + '%';
            if (lossesToday) lossesToday.textContent = totalLosses.toFixed(2);
            if (downtimeToday) downtimeToday.textContent = totalDowntime;
            
        } catch (error) {
            console.error("Erro ao carregar estatísticas: ", error);
        }
    }
    
    function setupActionButtons() {
        // Botão de produção
        const btnProduction = document.getElementById('btn-production');
        if (btnProduction && !btnProduction.dataset.listenerAttached) {
            btnProduction.addEventListener('click', openProductionModal);
            btnProduction.dataset.listenerAttached = 'true';
        }

        // Botão de perdas
        const btnLosses = document.getElementById('btn-losses');
        if (btnLosses && !btnLosses.dataset.listenerAttached) {
            btnLosses.addEventListener('click', openLossesModal);
            btnLosses.dataset.listenerAttached = 'true';
        }
        
        // Botão de parada
        const btnDowntime = document.getElementById('btn-downtime');
        if (btnDowntime && !btnDowntime.dataset.listenerAttached) {
            btnDowntime.addEventListener('click', toggleDowntime);
            btnDowntime.dataset.listenerAttached = 'true';
        }
        
        // Botão de produção manual
        const btnManualProduction = document.getElementById('btn-manual-production');
        if (btnManualProduction && !btnManualProduction.dataset.listenerAttached) {
            btnManualProduction.addEventListener('click', openManualProductionModal);
            btnManualProduction.dataset.listenerAttached = 'true';
        }

        const btnManualLosses = document.getElementById('btn-manual-losses');
        if (btnManualLosses && !btnManualLosses.dataset.listenerAttached) {
            btnManualLosses.addEventListener('click', openManualLossesModal);
            btnManualLosses.dataset.listenerAttached = 'true';
        }

        // Botão de lançamento manual de parada
        const btnManualDowntime = document.getElementById('btn-manual-downtime');
        if (btnManualDowntime && !btnManualDowntime.dataset.listenerAttached) {
            btnManualDowntime.addEventListener('click', openManualDowntimeModal);
            btnManualDowntime.dataset.listenerAttached = 'true';
        }
        
        // Botão de retrabalho
        const btnRework = document.getElementById('btn-rework');
        if (btnRework && !btnRework.dataset.listenerAttached) {
            btnRework.addEventListener('click', openReworkModal);
            btnRework.dataset.listenerAttached = 'true';
        }
        
        // Botão de borra
        const btnManualBorra = document.getElementById('btn-manual-borra');
        if (btnManualBorra && !btnManualBorra.dataset.listenerAttached) {
            btnManualBorra.addEventListener('click', openManualBorraModal);
            btnManualBorra.dataset.listenerAttached = 'true';
        }
        
        // Setup modals
        setupModals();
    }

    async function handleFinalizeOrderClick(event) {
        event?.preventDefault?.();

        if (!currentActiveOrder || !currentActiveOrder.id) {
            showNotification('Nenhuma ordem ativa identificada para esta máquina.', 'warning');
            return;
        }

        if (!selectedMachineData) {
            alert('Selecione uma máquina antes de finalizar a ordem.');
            return;
        }

        if (typeof window.authSystem?.checkPermissionForAction === 'function') {
            const hasPermission = window.authSystem.checkPermissionForAction('close_production_order');
            if (hasPermission === false) {
                return;
            }
        }

        const orderLabel = currentActiveOrder.order_number || currentActiveOrder.order_number_original || currentActiveOrder.id;
        const confirmMessage = `Confirma a finalização da OP ${orderLabel || ''}? Esta ação marcará o lote como concluído.`;
        if (!window.confirm(confirmMessage)) {
            return;
        }

        const button = finalizeOrderBtn;
        const originalContent = button ? button.innerHTML : '';

        try {
            if (button) {
                button.disabled = true;
                button.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i><span>Finalizando...</span>`;
                lucide.createIcons();
            }

        const currentUser = getActiveUser();
            const progressSnapshot = {
                executed: Number(currentOrderProgress.executed) || 0,
                planned: Number(currentOrderProgress.planned) || 0,
                expected: Number(currentOrderProgress.expected) || 0
            };

            const updatePayload = {
                status: 'concluida',
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                completedAt: firebase.firestore.FieldValue.serverTimestamp(),
                completedBy: currentUser.username || null,
                completedByName: currentUser.name || null,
                last_progress: {
                    ...progressSnapshot,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                }
            };

            await db.collection('production_orders').doc(currentActiveOrder.id).update(updatePayload);

            const planId = selectedMachineData?.id;
            if (planId) {
                const planUpdate = {
                    status: 'concluida',
                    finishedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    finishedBy: currentUser.name || currentUser.username || null
                };

                try {
                    await db.collection('planning').doc(planId).update(planUpdate);
                } catch (planError) {
                    console.warn('Não foi possível atualizar status do planejamento:', planError);
                }
            }

            showNotification(`OP ${orderLabel} finalizada com sucesso!`, 'success');

            if (button) {
                button.classList.add('hidden');
            }

            currentActiveOrder = { ...currentActiveOrder, status: 'concluida' };

            await Promise.allSettled([
                loadTodayStats(),
                refreshAnalysisIfActive()
            ]);

            currentActiveOrder = null;
            selectedMachineData = null;
            setActiveMachineCard(null);
            resetProductionTimer();
            if (productionControlPanel) {
                productionControlPanel.classList.add('hidden');
            }
            if (recentEntriesList) {
                recentEntriesList.innerHTML = '';
            }
            updateRecentEntriesEmptyMessage('Selecione uma máquina para visualizar os lançamentos.');
            setRecentEntriesState({ loading: false, empty: true });

            await populateMachineSelector();
        } catch (error) {
            console.error('Erro ao finalizar ordem de produção:', error);
            alert('Não foi possível finalizar a ordem. Tente novamente.');
        } finally {
            if (button) {
                button.disabled = false;
                button.innerHTML = originalContent;
                lucide.createIcons();
            }
        }
    }
    
    function setupModals() {
        // Modal de produção
        const quickProductionModal = document.getElementById('quick-production-modal');
        const quickProductionClose = document.getElementById('quick-production-close');
        const quickProductionCancel = document.getElementById('quick-production-cancel');
        const quickProductionForm = document.getElementById('quick-production-form');
        
        if (quickProductionClose) quickProductionClose.addEventListener('click', () => closeModal('quick-production-modal'));
        if (quickProductionCancel) quickProductionCancel.addEventListener('click', () => closeModal('quick-production-modal'));
        if (quickProductionForm) quickProductionForm.addEventListener('submit', handleProductionSubmit);
        
        // Modal de perdas
        const quickLossesClose = document.getElementById('quick-losses-close');
        const quickLossesCancel = document.getElementById('quick-losses-cancel');
        const quickLossesForm = document.getElementById('quick-losses-form');
        
        if (quickLossesClose) quickLossesClose.addEventListener('click', () => closeModal('quick-losses-modal'));
        if (quickLossesCancel) quickLossesCancel.addEventListener('click', () => closeModal('quick-losses-modal'));
        if (quickLossesForm) quickLossesForm.addEventListener('submit', handleLossesSubmit);
        
        // Modal de parada
        const quickDowntimeClose = document.getElementById('quick-downtime-close');
        const quickDowntimeCancel = document.getElementById('quick-downtime-cancel');
        const quickDowntimeForm = document.getElementById('quick-downtime-form');
        
        if (quickDowntimeClose) quickDowntimeClose.addEventListener('click', () => closeModal('quick-downtime-modal'));
        if (quickDowntimeCancel) quickDowntimeCancel.addEventListener('click', () => closeModal('quick-downtime-modal'));
        if (quickDowntimeForm) quickDowntimeForm.addEventListener('submit', handleDowntimeSubmit);
        
        // Modal de produção manual
        const manualProductionClose = document.getElementById('manual-production-close');
        const manualProductionCancel = document.getElementById('manual-production-cancel');
        const manualProductionForm = document.getElementById('manual-production-form');

        if (manualProductionClose) manualProductionClose.addEventListener('click', () => closeModal('manual-production-modal'));
        if (manualProductionCancel) manualProductionCancel.addEventListener('click', () => closeModal('manual-production-modal'));
        if (manualProductionForm) manualProductionForm.addEventListener('submit', handleManualProductionSubmit);

        // Modal de perdas manual
        const manualLossesClose = document.getElementById('manual-losses-close');
        const manualLossesCancel = document.getElementById('manual-losses-cancel');
        const manualLossesForm = document.getElementById('manual-losses-form');

        if (manualLossesClose) manualLossesClose.addEventListener('click', () => closeModal('manual-losses-modal'));
        if (manualLossesCancel) manualLossesCancel.addEventListener('click', () => closeModal('manual-losses-modal'));
        if (manualLossesForm) manualLossesForm.addEventListener('submit', handleManualLossesSubmit);

        // Modal de parada manual
        const manualDowntimeClose = document.getElementById('manual-downtime-close');
        const manualDowntimeCancel = document.getElementById('manual-downtime-cancel');
        const manualDowntimeForm = document.getElementById('manual-downtime-form');
        
        if (manualDowntimeClose) manualDowntimeClose.addEventListener('click', () => closeModal('manual-downtime-modal'));
        if (manualDowntimeCancel) manualDowntimeCancel.addEventListener('click', () => closeModal('manual-downtime-modal'));
        if (manualDowntimeForm) manualDowntimeForm.addEventListener('submit', handleManualDowntimeSubmit);

        // Modal de retrabalho
        const quickReworkClose = document.getElementById('quick-rework-close');
        const quickReworkCancel = document.getElementById('quick-rework-cancel');
        const quickReworkForm = document.getElementById('quick-rework-form');

        if (quickReworkClose) quickReworkClose.addEventListener('click', () => closeModal('quick-rework-modal'));
        if (quickReworkCancel) quickReworkCancel.addEventListener('click', () => closeModal('quick-rework-modal'));
        if (quickReworkForm) quickReworkForm.addEventListener('submit', handleReworkSubmit);

        // Modal de borra
        const manualBorraClose = document.getElementById('manual-borra-close');
        const manualBorraCancel = document.getElementById('manual-borra-cancel');
        const manualBorraForm = document.getElementById('manual-borra-form');

        if (manualBorraClose) manualBorraClose.addEventListener('click', () => closeModal('manual-borra-modal'));
        if (manualBorraCancel) manualBorraCancel.addEventListener('click', () => closeModal('manual-borra-modal'));
        if (manualBorraForm) manualBorraForm.addEventListener('submit', handleManualBorraSubmit);

        // Modal de ajuste de quantidade
        const adjustQuantityClose = document.getElementById('adjust-quantity-close');
        const adjustQuantityCancel = document.getElementById('adjust-quantity-cancel');
        const adjustQuantityForm = document.getElementById('adjust-quantity-form');

        if (adjustQuantityClose) adjustQuantityClose.addEventListener('click', closeAdjustQuantityModal);
        if (adjustQuantityCancel) adjustQuantityCancel.addEventListener('click', closeAdjustQuantityModal);
        if (adjustQuantityForm) adjustQuantityForm.addEventListener('submit', handleAdjustQuantitySubmit);
    }
    
    // Funções para abrir/fechar modais
    function openProductionModal() {
        currentEditContext = null;
        if (!selectedMachineData) {
            alert('Selecione uma máquina primeiro.');
            return;
        }
        document.getElementById('quick-production-modal').classList.remove('hidden');
    }
    
    function openLossesModal() {
        currentEditContext = null;
        if (!selectedMachineData) {
            alert('Selecione uma máquina primeiro.');
            return;
        }
        document.getElementById('quick-losses-modal').classList.remove('hidden');
    }
    
    function openReworkModal() {
        currentEditContext = null;
        if (!selectedMachineData) {
            alert('Selecione uma máquina primeiro.');
            return;
        }
        document.getElementById('quick-rework-modal').classList.remove('hidden');
    }
    
    function openManualProductionModal() {
        currentEditContext = null;
        if (!selectedMachineData) {
            alert('Selecione uma máquina primeiro.');
            return;
        }

        const dateInput = document.getElementById('manual-production-date');
        if (dateInput) {
            dateInput.value = getProductionDateString();
        }

        const shiftSelect = document.getElementById('manual-production-shift');
        if (shiftSelect) {
            shiftSelect.value = String(getCurrentShift());
        }

        const hourInput = document.getElementById('manual-production-hour');
        if (hourInput) {
            const now = new Date();
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            hourInput.value = `${hours}:${minutes}`;
        }

        openModal('manual-production-modal');
    }

    function openManualLossesModal() {
        currentEditContext = null;
        if (!selectedMachineData) {
            alert('Selecione uma máquina primeiro.');
            return;
        }

        const dateInput = document.getElementById('manual-losses-date');
        if (dateInput) {
            dateInput.value = getProductionDateString();
        }

        const shiftSelect = document.getElementById('manual-losses-shift');
        if (shiftSelect) {
            shiftSelect.value = String(getCurrentShift());
        }

        const hourInput = document.getElementById('manual-losses-hour');
        if (hourInput) {
            const now = new Date();
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            hourInput.value = `${hours}:${minutes}`;
        }

        openModal('manual-losses-modal');
    }

    function openManualBorraModal() {
        currentEditContext = null;
        if (!selectedMachineData) {
            alert('Selecione uma máquina primeiro.');
            return;
        }

        // Popular os selects do modal com máquinas e motivos do database.js
        populateBorraModal();

        const dateInput = document.getElementById('manual-borra-date');
        if (dateInput) {
            dateInput.value = getProductionDateString();
        }

        const shiftSelect = document.getElementById('manual-borra-shift');
        if (shiftSelect) {
            shiftSelect.value = String(getCurrentShift());
        }

        const machineSelect = document.getElementById('manual-borra-machine');
        if (machineSelect && selectedMachineData) {
            machineSelect.value = normalizeMachineId(selectedMachineData.machine);
        }

        const hourInput = document.getElementById('manual-borra-hour');
        if (hourInput) {
            const now = new Date();
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            hourInput.value = `${hours}:${minutes}`;
        }

        openModal('manual-borra-modal');
    }

    function closeModal(modalId) {
        document.getElementById(modalId).classList.add('hidden');
        // Limpar formulários
        const form = document.querySelector(`#${modalId} form`);
        if (form) form.reset();
        if (['quick-production-modal', 'quick-losses-modal', 'quick-downtime-modal', 'quick-rework-modal', 'manual-borra-modal'].includes(modalId)) {
            currentEditContext = null;
        }
    }

    function openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;
        modal.classList.remove('hidden');
    }

    async function uploadEvidencePhoto(file, folder = 'evidences') {
        if (!file) {
            return { url: null, path: null };
        }

        if (!storage) {
            throw new Error('storage-not-configured');
        }

        const baseFolder = folder
            .replace(/^\/+/g, '')
            .replace(/\/+$/g, '')
            .replace(/^\.+/, '')
            .replace(/\\+/g, '/');
        const sanitizedFolder = (baseFolder || 'evidences').replace(/\s+/g, '_');
        const inferredExt = (file.type && file.type.split('/')[1]) || (file.name.split('.').pop() || 'jpg');
        const extension = (inferredExt || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
        const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        const storagePath = `${sanitizedFolder}/${uniqueSuffix}.${extension}`;
        const metadata = { contentType: file.type || 'image/jpeg' };

        console.log('[TRACE][uploadEvidencePhoto] iniciando upload', { storagePath, contentType: metadata.contentType });

        const snapshot = await storage.ref().child(storagePath).put(file, metadata);
        const downloadURL = await snapshot.ref.getDownloadURL();

        console.log('[TRACE][uploadEvidencePhoto] upload concluído', { storagePath, downloadURL });
        return { url: downloadURL, path: storagePath };
    }

    async function deleteEvidencePhoto(storagePath) {
        if (!storagePath || !storage) {
            return;
        }

        try {
            console.log('[TRACE][deleteEvidencePhoto] removendo arquivo antigo', { storagePath });
            await storage.ref().child(storagePath).delete();
        } catch (error) {
            if (error?.code === 'storage/object-not-found') {
                console.warn('[TRACE][deleteEvidencePhoto] arquivo já inexistente', storagePath);
            } else {
                console.warn('[TRACE][deleteEvidencePhoto] falha ao remover arquivo', { storagePath, error });
            }
        }
    }
    
    // Função para toggle de parada (stop/start)
    function toggleDowntime() {
        if (!selectedMachineData) {
            alert('Selecione uma máquina primeiro.');
            return;
        }
        
        if (machineStatus === 'running') {
            // Parar máquina - registrar início da parada
            startMachineDowntime();
        } else {
            // Retomar máquina - solicitar motivo e finalizar parada
            openDowntimeReasonModal();
        }
    }
    
    // Função para abrir modal de lançamento manual de parada passada
    function openManualDowntimeModal() {
        if (!selectedMachineData) {
            alert('Selecione uma máquina primeiro.');
            return;
        }
        // Preencher datas padrão
        const today = getProductionDateString();
        const ds = document.getElementById('manual-downtime-date-start');
        const de = document.getElementById('manual-downtime-date-end');
        if (ds && !ds.value) ds.value = today;
        if (de && !de.value) de.value = today;
        openModal('manual-downtime-modal');
    }
    
    // Função para iniciar parada da máquina
    async function startMachineDowntime() {
        const now = new Date();
        currentDowntimeStart = {
            machine: selectedMachineData.machine,
            date: getProductionDateString(),
            startTime: now.toTimeString().substr(0, 5),
            startTimestamp: now
        };
        
        console.log('[TRACE][startMachineDowntime] parada iniciada', currentDowntimeStart);
        
        // Salvar parada ativa no Firebase para persistência
        try {
            const activeDowntimeData = {
                machine: selectedMachineData.machine,
                startDate: getProductionDateString(),
                startTime: now.toTimeString().substr(0, 5),
                startTimestamp: firebase.firestore.FieldValue.serverTimestamp(),
                startedBy: getActiveUser()?.name || 'Sistema',
                isActive: true,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            // Salvar na coleção active_downtimes (uma por máquina)
            await db.collection('active_downtimes').doc(selectedMachineData.machine).set(activeDowntimeData);
            
            console.log('[TRACE] Parada ativa salva no Firebase:', activeDowntimeData);
        } catch (error) {
            console.error('Erro ao salvar parada ativa no Firebase:', error);
        }
        
        machineStatus = 'stopped';
        updateMachineStatus();
        freezeProductionTimer();
        startDowntimeTimer();
        
        showNotification('Máquina parada! Clique em START quando retomar.', 'warning');
    }
    
    // Função para abrir modal solicitando motivo da parada ao retomar
    function openDowntimeReasonModal() {
        if (!currentDowntimeStart) {
            console.warn('Nenhuma parada ativa para finalizar.');
            machineStatus = 'running';
            updateMachineStatus();
            resumeProductionTimer();
            return;
        }
        openModal('quick-downtime-modal');
    }
    
    // Handlers dos formulários
    async function handleManualProductionSubmit(e) {
        e.preventDefault();

        if (!window.authSystem.checkPermissionForAction('add_production')) {
            return;
        }

        if (!selectedMachineData) {
            alert('Nenhuma máquina selecionada. Selecione uma máquina para registrar a produção.');
            return;
        }

        const dateInput = document.getElementById('manual-production-date');
        const shiftSelect = document.getElementById('manual-production-shift');
        const hourInput = document.getElementById('manual-production-hour');
        const qtyInput = document.getElementById('manual-production-qty');
        const weightInput = document.getElementById('manual-production-weight');
        const obsInput = document.getElementById('manual-production-obs');

        const dateValue = dateInput?.value || '';
        const shiftRaw = shiftSelect?.value || '';
        const hourValue = hourInput?.value || '';
        const quantityValue = parseInt(qtyInput?.value || '0', 10);
        const weightValue = parseFloat(weightInput?.value || '0');
        const observations = (obsInput?.value || '').trim();

        if (!dateValue) {
            alert('Informe a data referente à produção.');
            if (dateInput) dateInput.focus();
            return;
        }

        // Aceitar quantidade OU peso (um ou outro)
        const hasQty = Number.isFinite(quantityValue) && quantityValue > 0;
        const hasWeight = Number.isFinite(weightValue) && weightValue > 0;
        if (!hasQty && !hasWeight) {
            alert('Informe a quantidade produzida OU o peso bruto (um dos dois).');
            if (qtyInput && (!qtyInput.value || qtyInput.value === '')) {
                qtyInput.focus();
            } else if (weightInput) {
                weightInput.focus();
            }
            return;
        }

        const shiftNumeric = parseInt(shiftRaw, 10);
        const turno = [1, 2, 3].includes(shiftNumeric) ? shiftNumeric : getCurrentShift();

        const planId = selectedMachineData?.id || null;
        if (!planId) {
            alert('Não foi possível identificar o planejamento associado a esta máquina.');
            return;
        }

    const currentUser = getActiveUser();
        const horaInformada = hourValue && /^\d{2}:\d{2}$/.test(hourValue) ? hourValue : null;

        // Se só o peso foi informado, tentar converter para peças usando peso médio da peça
        let finalQuantity = hasQty ? quantityValue : 0;
        let finalWeightKg = hasWeight ? Number(weightValue) : 0;
        if (!hasQty && hasWeight) {
            const resolveAveragePieceWeight = () => {
                if (!selectedMachineData) return 0;
                const candidates = [
                    selectedMachineData.piece_weight,
                    selectedMachineData.weight,
                    selectedMachineData.produto?.weight,
                    selectedMachineData.mp_weight
                ];
                for (const candidate of candidates) {
                    const parsed = parseFloat(candidate);
                    if (Number.isFinite(parsed) && parsed > 0) return parsed;
                }
                return 0;
            };
            const pieceWeightGrams = resolveAveragePieceWeight();
            if (pieceWeightGrams > 0) {
                finalQuantity = Math.max(1, Math.round((finalWeightKg * 1000) / pieceWeightGrams));
                showNotification(`Convertido: ${finalWeightKg}kg = ${finalQuantity} peças`, 'info');
            } else {
                alert('Não foi possível converter o peso em peças porque o peso médio não está configurado. Informe a quantidade manualmente.');
                if (qtyInput) qtyInput.focus();
                return;
            }
        }

        const payloadBase = {
            planId,
            data: dateValue,
            turno,
            produzido: finalQuantity,
            peso_bruto: Number.isFinite(finalWeightKg) ? finalWeightKg : 0,
            refugo_kg: 0,
            perdas: '',
            observacoes: observations,
            machine: selectedMachineData.machine || null,
            mp: selectedMachineData.mp || '',
            orderId: selectedMachineData.order_id || null,
            orderNumber: selectedMachineData.order_number || null,
            manual: true,
            horaInformada,
            dataHoraInformada: horaInformada ? `${dateValue}T${horaInformada}` : null,
            registradoPor: currentUser.username || null,
            registradoPorNome: getCurrentUserName()
        };

        try {
            await db.collection('production_entries').add({
                ...payloadBase,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            closeModal('manual-production-modal');
            await populateMachineSelector();
            
            // Atualizar selectedMachineData com os dados mais recentes
            if (selectedMachineData && selectedMachineData.machine && machineCardData[selectedMachineData.machine]) {
                selectedMachineData = machineCardData[selectedMachineData.machine];
                updateMachineInfo();
            }
            
            await refreshLaunchCharts();
            await loadTodayStats();
            await loadRecentEntries(false);
            // Atualizar aba de análise se estiver ativa (para refletir barra de progresso da OP)
            await refreshAnalysisIfActive();

            showNotification('Produção manual registrada com sucesso!', 'success');
        } catch (error) {
            console.error('Erro ao registrar produção manual: ', error);
            alert('Erro ao registrar produção manual. Tente novamente.');
        }
    }

    async function handleManualLossesSubmit(e) {
        e.preventDefault();

        if (!window.authSystem.checkPermissionForAction('add_losses')) {
            return;
        }

        if (!selectedMachineData) {
            alert('Nenhuma máquina selecionada. Selecione uma máquina para registrar as perdas.');
            return;
        }

        const dateInput = document.getElementById('manual-losses-date');
        const shiftSelect = document.getElementById('manual-losses-shift');
        const hourInput = document.getElementById('manual-losses-hour');
        const qtyInput = document.getElementById('manual-losses-qty');
        const weightInput = document.getElementById('manual-losses-weight');
        const reasonSelect = document.getElementById('manual-losses-reason');
        const obsInput = document.getElementById('manual-losses-obs');
        const photoInput = document.getElementById('manual-losses-photo');

        const dateValue = (dateInput?.value || '').trim();
        const shiftRaw = shiftSelect?.value || '';
        const hourValue = (hourInput?.value || '').trim();
        const quantityValue = parseInt(qtyInput?.value || '0', 10);
        const weightValue = parseFloat(weightInput?.value || '0');
        const reasonValue = reasonSelect?.value || '';
        const observations = (obsInput?.value || '').trim();
        const photoFile = photoInput?.files?.[0] || null;

        if (!dateValue) {
            alert('Informe a data referente à perda.');
            if (dateInput) dateInput.focus();
            return;
        }

        const hasQuantity = Number.isFinite(quantityValue) && quantityValue > 0;
        const hasWeight = Number.isFinite(weightValue) && weightValue > 0;

        // CORREÇÃO: Aceitar pelo menos um dos campos (quantidade OU peso)
        if (!hasQuantity && !hasWeight) {
            alert('Informe pelo menos a quantidade de peças perdidas OU o peso em borras (kg). Não é necessário preencher ambos.');
            if (qtyInput && (!qtyInput.value || qtyInput.value === '')) {
                qtyInput.focus();
            } else if (weightInput) {
                weightInput.focus();
            }
            return;
        }

        if (!reasonValue) {
            alert('Selecione o motivo da perda.');
            if (reasonSelect) reasonSelect.focus();
            return;
        }

        const planId = selectedMachineData?.id || null;
        if (!planId) {
            alert('Não foi possível identificar o planejamento associado a esta máquina.');
            return;
        }

        const resolveAveragePieceWeight = () => {
            if (!selectedMachineData) return 0;
            const candidates = [
                selectedMachineData.piece_weight,
                selectedMachineData.weight,
                selectedMachineData.produto?.weight,
                selectedMachineData.mp_weight
            ];
            for (const candidate of candidates) {
                const parsed = parseFloat(candidate);
                if (Number.isFinite(parsed) && parsed > 0) {
                    return parsed;
                }
            }
            return 0;
        };

        let refugoQty = hasQuantity ? quantityValue : 0;
        let pesoTotalKg = hasWeight ? weightValue : 0;
        const pieceWeightGrams = resolveAveragePieceWeight();

        if (refugoQty <= 0 && pesoTotalKg > 0) {
            if (pieceWeightGrams > 0) {
                refugoQty = Math.max(1, Math.round((pesoTotalKg * 1000) / pieceWeightGrams));
                showNotification(`Convertido: ${pesoTotalKg}kg = ${refugoQty} peças`, 'info');
            } else {
                alert('Não foi possível converter o peso em peças porque o peso médio não está configurado. Informe a quantidade manualmente.');
                return;
            }
        }

        if (pesoTotalKg <= 0 && refugoQty > 0 && pieceWeightGrams > 0) {
            pesoTotalKg = (refugoQty * pieceWeightGrams) / 1000;
        }

        if (refugoQty <= 0) {
            alert('Não foi possível determinar a quantidade de peças perdidas. Verifique os valores informados.');
            return;
        }

        let photoUrl = null;
        let photoStoragePath = null;
        if (photoFile) {
            try {
                const uploadResult = await uploadEvidencePhoto(photoFile, `losses/${planId}`);
                photoUrl = uploadResult?.url || null;
                photoStoragePath = uploadResult?.path || null;
            } catch (error) {
                console.error('Erro ao enviar foto da perda manual:', error);
                if (error?.message === 'storage-not-configured') {
                    alert('Não foi possível salvar a foto porque o armazenamento não está configurado.');
                } else {
                    alert('Erro ao enviar a foto. O registro não foi salvo.');
                }
                return;
            }
        }

        const shiftNumeric = parseInt(shiftRaw, 10);
        const turno = [1, 2, 3].includes(shiftNumeric) ? shiftNumeric : getCurrentShift();
        const horaInformada = hourValue && /^\d{2}:\d{2}$/.test(hourValue) ? hourValue : null;
        const dataHoraInformada = horaInformada ? `${dateValue}T${horaInformada}` : null;
    const currentUser = getActiveUser();

        const payloadBase = {
            planId,
            data: dateValue,
            turno,
            produzido: 0,
            peso_bruto: 0,
            refugo_kg: Number.isFinite(pesoTotalKg) && pesoTotalKg > 0 ? Number(pesoTotalKg) : 0,
            refugo_qty: refugoQty,
            perdas: reasonValue,
            observacoes: observations,
            machine: selectedMachineData.machine || null,
            mp: selectedMachineData.mp || '',
            orderId: selectedMachineData.order_id || null,
            orderNumber: selectedMachineData.order_number || null,
            manual: true,
            horaInformada,
            dataHoraInformada,
            registradoPor: currentUser.username || null,
            registradoPorNome: getCurrentUserName(),
            photoUrl,
            photoStoragePath
        };

        console.log('[TRACE][handleManualLossesSubmit] prepared payload', payloadBase);

        try {
            await db.collection('production_entries').add({
                ...payloadBase,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            closeModal('manual-losses-modal');
            await populateMachineSelector();
            
            // Atualizar selectedMachineData com os dados mais recentes
            if (selectedMachineData && selectedMachineData.machine && machineCardData[selectedMachineData.machine]) {
                selectedMachineData = machineCardData[selectedMachineData.machine];
                updateMachineInfo();
            }
            
            await refreshLaunchCharts();
            await loadTodayStats();
            await loadRecentEntries(false);
            await refreshAnalysisIfActive();

            showNotification('Perda manual registrada com sucesso!', 'success');
        } catch (error) {
            console.error('Erro ao registrar perda manual: ', error);
            alert('Erro ao registrar perda manual. Tente novamente.');
        }
    }

    async function handleProductionSubmit(e) {
        e.preventDefault();
        
        // Verificar permissão
        if (!window.authSystem.checkPermissionForAction('add_production')) {
            return;
        }
        
        console.log('[TRACE][handleProductionSubmit] triggered', {
            selectedMachineData,
            currentEditContext
        });

    const qty = parseInt(document.getElementById('quick-production-qty').value, 10) || 0;
    const weight = parseFloat(document.getElementById('quick-production-weight').value) || 0;
        const obs = (document.getElementById('quick-production-obs').value || '').trim();
        
        console.log('[TRACE][handleProductionSubmit] parsed form values', { qty, weight, obs });

        // Aceitar quantidade OU peso (um ou outro)
        const hasQty = Number.isFinite(qty) && qty > 0;
        const hasWeight = Number.isFinite(weight) && weight > 0;
        if (!hasQty && !hasWeight) {
            alert('Informe a quantidade produzida OU o peso bruto (um dos dois).');
            return;
        }

        const isEditing = currentEditContext && currentEditContext.type === 'production' && currentEditContext.id;
        const originalData = isEditing ? currentEditContext.original : null;

        console.log('[TRACE][handleProductionSubmit] context info', { isEditing, originalData });

        const fallbackPlan = selectedMachineData ? selectedMachineData.id : originalData?.planId;
        const planId = isEditing ? (originalData?.planId || fallbackPlan) : fallbackPlan;

        console.log('[TRACE][handleProductionSubmit] resolved plan', { fallbackPlan, planId });

        if (!planId) {
            alert('Não foi possível identificar o planejamento associado ao lançamento.');
            return;
        }

        const currentShift = getCurrentShift();
        const turno = isEditing ? (originalData?.turno || currentShift) : currentShift;
        const dataReferencia = isEditing ? (originalData?.data || getProductionDateString()) : getProductionDateString();
        const machineRef = isEditing ? (originalData?.machine || selectedMachineData?.machine) : selectedMachineData?.machine;
        const mpValue = isEditing ? (originalData?.mp || selectedMachineData?.mp || '') : (selectedMachineData?.mp || '');

        // Se apenas peso foi informado, tentar converter para peças (usar peso médio da peça)
        let finalQty = hasQty ? qty : 0;
        let finalWeight = hasWeight ? weight : 0;
        if (!hasQty && hasWeight) {
            let pesoMedio = 0;
            if (selectedMachineData) {
                pesoMedio = parseFloat(selectedMachineData.piece_weight) || 0;
                if (!pesoMedio) pesoMedio = parseFloat(selectedMachineData.weight) || 0;
                if (!pesoMedio && selectedMachineData.produto) pesoMedio = parseFloat(selectedMachineData.produto.weight) || 0;
                if (!pesoMedio && selectedMachineData.mp_weight) pesoMedio = parseFloat(selectedMachineData.mp_weight) || 0;
            }
            if (pesoMedio > 0) {
                finalQty = Math.max(1, Math.round((finalWeight * 1000) / pesoMedio));
                console.log(`[TRACE][handleProductionSubmit] Conversão: ${finalWeight}kg ÷ ${pesoMedio}g/peça = ${finalQty} peças`);
                showNotification(`Convertido: ${finalWeight}kg = ${finalQty} peças`, 'info');
            } else {
                alert('Não foi possível converter peso para peças. O peso médio da peça não está configurado. Informe a quantidade diretamente.');
                return;
            }
        }

        const payloadBase = {
            planId,
            data: dataReferencia,
            turno,
            produzido: finalQty,
            peso_bruto: finalWeight,
            refugo_kg: 0,
            perdas: '',
            observacoes: obs,
            machine: machineRef || null,
            mp: mpValue,
            orderId: selectedMachineData?.order_id || null,
            orderNumber: selectedMachineData?.order_number || null
        };
        
        console.log('[TRACE][handleProductionSubmit] payloadBase prepared', payloadBase);

        const collectionRef = db.collection('production_entries');
        const successMessage = isEditing ? 'Produção atualizada com sucesso!' : 'Produção registrada com sucesso!';

        try {
            if (isEditing) {
                console.log('[TRACE][handleProductionSubmit] updating existing entry', currentEditContext.id);
                await collectionRef.doc(currentEditContext.id).update({
                    ...payloadBase,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            } else {
                console.log('[TRACE][handleProductionSubmit] creating new entry');
                await collectionRef.add({
                    ...payloadBase,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }

            closeModal('quick-production-modal');
            await populateMachineSelector();
            
            // Atualizar selectedMachineData com os dados mais recentes
            if (selectedMachineData && selectedMachineData.machine && machineCardData[selectedMachineData.machine]) {
                selectedMachineData = machineCardData[selectedMachineData.machine];
                updateMachineInfo();
            }
            
            await refreshLaunchCharts();
            await loadTodayStats();
            await loadRecentEntries(false);
            // Atualizar aba de análise se estiver ativa (para refletir barra de progresso da OP)
            await refreshAnalysisIfActive();
            showNotification(successMessage, 'success');

            console.log('[TRACE][handleProductionSubmit] success path completed');
        } catch (error) {
            console.error('Erro ao registrar produção: ', error);
            alert('Erro ao registrar produção. Tente novamente.');
        }
    }
    
    async function handleLossesSubmit(e) {
        e.preventDefault();
        
        // Verificar permissão
        if (!window.authSystem.checkPermissionForAction('add_losses')) {
            return;
        }
        
        console.log('[TRACE][handleLossesSubmit] triggered', {
            selectedMachineData,
            currentEditContext
        });

        const quantityInput = document.getElementById('quick-losses-qty');
        const weightInput = document.getElementById('quick-losses-weight');
        const quantity = parseInt(quantityInput.value, 10) || 0;
        const weight = parseFloat(weightInput.value) || 0;
        const reason = document.getElementById('quick-losses-reason').value;
        const obs = (document.getElementById('quick-losses-obs').value || '').trim();
        const lossesPhotoInput = document.getElementById('quick-losses-photo');
        const lossesPhotoFile = lossesPhotoInput?.files?.[0] || null;

        console.log('[TRACE][handleLossesSubmit] parsed form values', { quantity, weight, reason, obs });

        if (quantity <= 0 && weight <= 0) {
            alert('Informe a quantidade ou o peso da perda.');
            if (quantityInput) quantityInput.focus();
            else if (weightInput) weightInput.focus();
            return;
        }

        if (!reason) {
            alert('Por favor, selecione o motivo da perda.');
            return;
        }

        // ========================================
        // CONVERSÃO DE PESO PARA PEÇAS
        // ========================================
        let refugoQty = quantity;
        
        // Se quantidade foi informada, usar ela
        if (quantity > 0) {
            refugoQty = quantity;
        }
        // Se só o peso foi informado, converter para peças
        else if (weight > 0) {
            let pesoMedio = 0;
            
            // Tentar encontrar peso médio em múltiplas fontes
            if (selectedMachineData) {
                // Tentar campo piece_weight
                pesoMedio = parseFloat(selectedMachineData.piece_weight) || 0;
                
                // Tentar campo weight
                if (!pesoMedio) {
                    pesoMedio = parseFloat(selectedMachineData.weight) || 0;
                }
                
                // Tentar campo no produto
                if (!pesoMedio && selectedMachineData.produto) {
                    pesoMedio = parseFloat(selectedMachineData.produto.weight) || 0;
                }
                
                // Tentar campo mp_weight
                if (!pesoMedio && selectedMachineData.mp_weight) {
                    pesoMedio = parseFloat(selectedMachineData.mp_weight) || 0;
                }
            }
            
            // Se achou peso médio, converter kg para peças (1kg = 1000g)
            if (pesoMedio > 0) {
                refugoQty = Math.round((weight * 1000) / pesoMedio);
                console.log(`[TRACE][handleLossesSubmit] Conversão: ${weight}kg ÷ ${pesoMedio}g/peça = ${refugoQty} peças`);
                
                // Mostrar na tela para o usuário confirmar
                showNotification(`Convertido: ${weight}kg = ${refugoQty} peças`, 'info');
            } else {
                alert('Não foi possível converter peso para peças. O peso médio da peça não está configurado. Informe a quantidade diretamente.');
                console.warn('[TRACE][handleLossesSubmit] Peso médio não encontrado: selectedMachineData =', selectedMachineData);
                return;
            }
        }
        
        console.log('[TRACE][handleLossesSubmit] Perda em peças:', { quantity, weight, refugoQty, pesoMedio: weight > 0 ? (weight * 1000 / refugoQty) : 0 });

        const isEditing = currentEditContext && currentEditContext.type === 'loss' && currentEditContext.id;
        const originalData = isEditing ? currentEditContext.original : null;

        console.log('[TRACE][handleLossesSubmit] context info', { isEditing, originalData });

        const fallbackPlan = selectedMachineData ? selectedMachineData.id : originalData?.planId;
        const planId = isEditing ? (originalData?.planId || fallbackPlan) : fallbackPlan;

        console.log('[TRACE][handleLossesSubmit] resolved plan', { fallbackPlan, planId });

        if (!planId) {
            alert('Não foi possível identificar o planejamento associado ao lançamento.');
            return;
        }

        let photoUrl = isEditing ? (originalData?.photoUrl || null) : null;
        let photoStoragePath = isEditing ? (originalData?.photoStoragePath || null) : null;

        if (lossesPhotoFile) {
            try {
                const uploadResult = await uploadEvidencePhoto(lossesPhotoFile, `losses/${planId}`);
                if (uploadResult?.url) {
                    if (photoStoragePath && photoStoragePath !== uploadResult.path) {
                        await deleteEvidencePhoto(photoStoragePath);
                    }
                    photoUrl = uploadResult.url;
                    photoStoragePath = uploadResult.path;
                }
            } catch (error) {
                console.error('Erro ao enviar foto da perda:', error);
                if (error?.message === 'storage-not-configured') {
                    alert('Não foi possível salvar a foto porque o armazenamento não está configurado.');
                } else {
                    alert('Erro ao enviar a foto. O registro não foi salvo.');
                }
                return;
            }
        }

        const currentShift = getCurrentShift();
        const turno = isEditing ? (originalData?.turno || currentShift) : currentShift;
        const dataReferencia = isEditing ? (originalData?.data || getProductionDateString()) : getProductionDateString();
        const machineRef = isEditing ? (originalData?.machine || selectedMachineData?.machine) : selectedMachineData?.machine;
        const mpValue = isEditing ? (originalData?.mp || selectedMachineData?.mp || '') : (selectedMachineData?.mp || '');

        // Calcular peso total se necessário (peças × peso médio)
        let pesoTotalKg = weight;
        if (!weight && refugoQty > 0 && selectedMachineData) {
            let pesoMedio = parseFloat(selectedMachineData.piece_weight) 
                || parseFloat(selectedMachineData.weight) 
                || (selectedMachineData.produto?.weight ? parseFloat(selectedMachineData.produto.weight) : 0)
                || 0;
            if (pesoMedio > 0) {
                pesoTotalKg = (refugoQty * pesoMedio) / 1000;
            }
        }

        const payloadBase = {
            planId,
            data: dataReferencia,
            turno,
            produzido: 0,
            peso_bruto: 0,
            refugo_kg: pesoTotalKg,
            refugo_qty: refugoQty,  // SEMPRE em peças
            perdas: reason,
            observacoes: obs,
            machine: machineRef || null,
            mp: mpValue,
            orderId: selectedMachineData?.order_id || null,
            orderNumber: selectedMachineData?.order_number || null,
            photoUrl: photoUrl || null,
            photoStoragePath: photoStoragePath || null
        };

        console.log('[TRACE][handleLossesSubmit] payloadBase prepared', payloadBase);

        const collectionRef = db.collection('production_entries');
        const successMessage = isEditing ? 'Perda atualizada com sucesso!' : 'Perda registrada com sucesso!';

        try {
            if (isEditing) {
                console.log('[TRACE][handleLossesSubmit] updating existing entry', currentEditContext.id);
                await collectionRef.doc(currentEditContext.id).update({
                    ...payloadBase,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            } else {
                console.log('[TRACE][handleLossesSubmit] creating new entry');
                await collectionRef.add({
                    ...payloadBase,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }

            closeModal('quick-losses-modal');
            await populateMachineSelector();
            
            // Atualizar selectedMachineData com os dados mais recentes
            if (selectedMachineData && selectedMachineData.machine && machineCardData[selectedMachineData.machine]) {
                selectedMachineData = machineCardData[selectedMachineData.machine];
                updateMachineInfo();
            }
            
            await loadTodayStats();
            await loadHourlyProductionChart();
            await loadRecentEntries(false);
            // Atualizar aba de análise se estiver aberta
            await refreshAnalysisIfActive();
            showNotification(successMessage, 'success');

            console.log('[TRACE][handleLossesSubmit] success path completed');
        } catch (error) {
            console.error('Erro ao registrar perda: ', error);
            alert('Erro ao registrar perda. Tente novamente.');
        }
    }
    
    async function handleDowntimeSubmit(e) {
        e.preventDefault();
        
        // Verificar permissão
        if (!window.authSystem.checkPermissionForAction('add_downtime')) {
            return;
        }
        
        console.log('[TRACE][handleDowntimeSubmit] triggered', {
            selectedMachineData,
            currentDowntimeStart,
            machineStatus
        });

    const reason = document.getElementById('quick-downtime-reason').value;
    const obs = (document.getElementById('quick-downtime-obs').value || '').trim();
        const downtimePhotoInput = document.getElementById('quick-downtime-photo');
        const downtimePhotoFile = downtimePhotoInput?.files?.[0] || null;
        
        console.log('[TRACE][handleDowntimeSubmit] parsed form values', { reason, obs });

        if (!reason) {
            alert('Por favor, selecione o motivo da parada.');
            return;
        }

        if (!currentDowntimeStart) {
            alert('Nenhuma parada ativa para finalizar.');
            closeModal('quick-downtime-modal');
            return;
        }
        
        try {
            const now = new Date();
            const endTime = now.toTimeString().substr(0, 5);
            
            let photoUrl = null;
            let photoStoragePath = null;
            if (downtimePhotoFile) {
                try {
                    const folder = `downtime/${currentDowntimeStart.machine || 'geral'}`;
                    const uploadResult = await uploadEvidencePhoto(downtimePhotoFile, folder);
                    photoUrl = uploadResult?.url || null;
                    photoStoragePath = uploadResult?.path || null;
                } catch (error) {
                    console.error('Erro ao enviar foto da parada:', error);
                    if (error?.message === 'storage-not-configured') {
                        alert('Não foi possível salvar a foto porque o armazenamento não está configurado.');
                    } else {
                        alert('Erro ao enviar a foto. O registro não foi salvo.');
                    }
                    return;
                }
            }

            // Determinar datas de início e fim (fim = data atual de produção)
            const startDateStr = currentDowntimeStart.date || formatDateYMD(currentDowntimeStart.startTimestamp || new Date());
            const endDateStr = getProductionDateString();

            // Quebrar em segmentos por dia
            const segments = splitDowntimeIntoDailySegments(startDateStr, currentDowntimeStart.startTime, endDateStr, endTime);
            if (!segments.length) {
                alert('Intervalo de parada inválido. Verifique os horários.');
                return;
            }

            const currentUser = getActiveUser();

            for (const seg of segments) {
                const downtimeData = {
                    machine: currentDowntimeStart.machine,
                    date: seg.date,
                    startTime: seg.startTime,
                    endTime: seg.endTime,
                    duration: seg.duration,
                    reason: reason,
                    observations: obs,
                    registradoPor: currentUser.username || null,
                    registradoPorNome: getCurrentUserName(),
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    photoUrl,
                    photoStoragePath
                };

                console.log('[TRACE][handleDowntimeSubmit] saving segment', downtimeData);
                await db.collection('downtime_entries').add(downtimeData);
            }
            // Remover parada ativa dessa máquina (evita restauração automática na troca de máquina/reload)
            try {
                if (currentDowntimeStart?.machine) {
                    await db.collection('active_downtimes').doc(currentDowntimeStart.machine).delete();
                    console.log('[TRACE][handleDowntimeSubmit] active_downtime removed for machine', currentDowntimeStart.machine);
                }
            } catch (err) {
                console.warn('[WARN][handleDowntimeSubmit] failed to delete active_downtime doc', err);
                // Não bloquear o fluxo do usuário se a exclusão falhar
            }
            
            // Resetar status
            currentDowntimeStart = null;
            machineStatus = 'running';
            updateMachineStatus();
            stopDowntimeTimer();
            resumeProductionTimer();
            
            closeModal('quick-downtime-modal');
            
            // Atualizar dados
            await loadTodayStats();
            await loadRecentEntries(false);
            // Atualizar aba de análise se estiver aberta
            await refreshAnalysisIfActive();
            
            // Mostrar sucesso
            showNotification('Parada finalizada e registrada com sucesso!', 'success');

            console.log('[TRACE][handleDowntimeSubmit] success path completed');
            
        } catch (error) {
            console.error("Erro ao registrar parada: ", error);
            alert('Erro ao registrar parada. Tente novamente.');
        }
    }

    async function handleManualBorraSubmit(e) {
        e.preventDefault();

        if (!window.authSystem.checkPermissionForAction('add_losses')) {
            return;
        }

        if (!selectedMachineData) {
            alert('Nenhuma máquina selecionada. Selecione uma máquina para registrar a borra.');
            return;
        }

        const dateInput = document.getElementById('manual-borra-date');
        const shiftSelect = document.getElementById('manual-borra-shift');
        const hourInput = document.getElementById('manual-borra-hour');
        const machineSelect = document.getElementById('manual-borra-machine');
        const weightInput = document.getElementById('manual-borra-weight');
        const mpTypeSelect = document.getElementById('manual-borra-mp-type');
        const reasonInput = document.getElementById('manual-borra-reason');
        const obsInput = document.getElementById('manual-borra-obs');

        const dateValue = (dateInput?.value || '').trim();
        const shiftRaw = shiftSelect?.value || '';
        const hourValue = (hourInput?.value || '').trim();
    const machineValue = machineSelect?.value || '';
        const weightValue = parseFloat(weightInput?.value || '0');
        const mpTypeValue = mpTypeSelect?.value || '';
        const reasonValue = (reasonInput?.value || '').trim();
        const observations = (obsInput?.value || '').trim();

        if (!dateValue) {
            alert('Informe a data de geração da borra.');
            if (dateInput) dateInput.focus();
            return;
        }

        if (!machineValue) {
            alert('Selecione a máquina que gerou a borra.');
            if (machineSelect) machineSelect.focus();
            return;
        }

        if (!Number.isFinite(weightValue) || weightValue <= 0) {
            alert('Informe o peso da borra em kg (valor deve ser maior que zero).');
            if (weightInput) weightInput.focus();
            return;
        }

        if (!mpTypeValue) {
            alert('Selecione o tipo de matéria-prima da borra.');
            if (mpTypeSelect) mpTypeSelect.focus();
            return;
        }

        if (!reasonValue) {
            alert('Informe o motivo da geração da borra.');
            if (reasonInput) reasonInput.focus();
            return;
        }

        const statusDiv = document.getElementById('manual-borra-status');
        const submitButton = document.getElementById('manual-borra-save');

        try {
            if (statusDiv) statusDiv.textContent = 'Salvando borra...';
            if (submitButton) {
                submitButton.disabled = true;
                submitButton.textContent = 'Salvando...';
            }

            const currentUser = getActiveUser();
            const workDay = getWorkDayFromDate(dateValue, hourValue);
            const normalizedMachine = normalizeMachineId(machineValue || selectedMachineData.machine || '');
            const resolvedPlanId = selectedMachineData?.id || selectedMachineData?.planId || selectedMachineData?.planningRef || null;
            if (!resolvedPlanId) {
                console.warn('[WARN][handleManualBorraSubmit] planId não encontrado para BORRA, registro será salvo sem vínculo de plano.', {
                    selectedMachineData
                });
            }
            
            // Preparar dados da borra (salvar como perda especial)
            const borraData = {
                data: dateValue,
                workDay: workDay,
                machine: normalizedMachine,
                planId: resolvedPlanId || null,
                planningRef: resolvedPlanId || null,
                refugo_kg: weightValue, // Salvar como refugo em kg
                perdas: `BORRA - ${reasonValue}`,
                mp: '',
                mp_type: mpTypeValue,
                turno: parseInt(shiftRaw, 10) || 1,
                horaInformada: hourValue || null,
                observacoes: observations || '',
                tipo_lancamento: 'borra', // Identificador especial
                planningRef: selectedMachineData.id,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                createdBy: currentUser.username || 'sistema',
                createdByName: currentUser.name || 'Sistema'
            };

            console.log('[TRACE][handleManualBorraSubmit] prepared borra data', borraData);

            // Salvar na coleção production_entries (como outras perdas)
            const docRef = await db.collection('production_entries').add(borraData);
            
            console.log('[TRACE][handleManualBorraSubmit] borra saved successfully', { docId: docRef.id });

            if (statusDiv) statusDiv.textContent = 'Borra registrada com sucesso!';
            showNotification(`Borra de ${weightValue}kg registrada com sucesso!`, 'success');

            // Fechar modal e atualizar dados
            setTimeout(() => {
                closeModal('manual-borra-modal');
                if (typeof updateOverviewData === 'function') {
                    updateOverviewData();
                }
                if (typeof refreshRecentEntries === 'function') {
                    refreshRecentEntries();
                }
            }, 1500);

        } catch (error) {
            console.error('[ERROR][handleManualBorraSubmit] falha ao salvar borra', error);
            
            if (statusDiv) statusDiv.textContent = 'Erro ao registrar borra. Tente novamente.';
            showNotification('Erro ao registrar borra. Verifique os dados e tente novamente.', 'error');
        } finally {
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = 'Registrar Borra';
            }
        }
    }
    
    // Função para lançamento manual de parada passada
    async function handleManualDowntimeSubmit(e) {
        e.preventDefault();
        
        console.log('[TRACE][handleManualDowntimeSubmit] triggered', { selectedMachineData });
        const dateStartInput = document.getElementById('manual-downtime-date-start');
        const dateEndInput = document.getElementById('manual-downtime-date-end');
        const startTime = document.getElementById('manual-downtime-start').value;
        const endTime = document.getElementById('manual-downtime-end').value;
        const reason = document.getElementById('manual-downtime-reason').value;
        const obs = (document.getElementById('manual-downtime-obs').value || '').trim();
        const manualDowntimePhotoInput = document.getElementById('manual-downtime-photo');
        const manualDowntimePhotoFile = manualDowntimePhotoInput?.files?.[0] || null;
        
        console.log('[TRACE][handleManualDowntimeSubmit] parsed form values', { startTime, endTime, reason, obs });

        if (!startTime || !endTime) {
            alert('Por favor, informe os horários de início e fim da parada.');
            return;
        }

        if (!reason) {
            alert('Por favor, selecione o motivo da parada.');
            return;
        }

        if (!selectedMachineData) {
            alert('Nenhuma máquina selecionada.');
            return;
        }

        // Datas (opcionais). Se não informadas, assume a data de produção atual
        const todayStr = getProductionDateString();
        const dateStartStr = (dateStartInput?.value || todayStr);
        const dateEndStr = (dateEndInput?.value || dateStartStr);

        // Validar coerência temporal
        const dtStart = new Date(`${dateStartStr}T${startTime}:00`);
        const dtEnd = new Date(`${dateEndStr}T${endTime}:00`);
        if (Number.isNaN(dtStart.getTime()) || Number.isNaN(dtEnd.getTime()) || dtEnd <= dtStart) {
            alert('Intervalo de parada inválido. Verifique as datas/horas informadas.');
            return;
        }
        
        try {
            // Quebrar em segmentos por dia
            const segments = splitDowntimeIntoDailySegments(dateStartStr, startTime, dateEndStr, endTime);
            if (!segments.length) {
                alert('Não foi possível interpretar o período informado.');
                return;
            }

            let photoUrl = null;
            let photoStoragePath = null;
            if (manualDowntimePhotoFile) {
                try {
                    const folder = `downtime/${selectedMachineData.machine || 'manual'}`;
                    const uploadResult = await uploadEvidencePhoto(manualDowntimePhotoFile, folder);
                    photoUrl = uploadResult?.url || null;
                    photoStoragePath = uploadResult?.path || null;
                } catch (error) {
                    console.error('Erro ao enviar foto da parada manual:', error);
                    if (error?.message === 'storage-not-configured') {
                        alert('Não foi possível salvar a foto porque o armazenamento não está configurado.');
                    } else {
                        alert('Erro ao enviar a foto. O registro não foi salvo.');
                    }
                    return;
                }
            }

            // Persistir cada segmento
            const currentUser = getActiveUser();
            for (const seg of segments) {
                const downtimeData = {
                    machine: selectedMachineData.machine,
                    date: seg.date,
                    startTime: seg.startTime,
                    endTime: seg.endTime,
                    duration: seg.duration,
                    reason: reason,
                    observations: obs,
                    registradoPor: currentUser.username || null,
                    registradoPorNome: getCurrentUserName(),
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    photoUrl,
                    photoStoragePath
                };
                console.log('[TRACE][handleManualDowntimeSubmit] saving segment', downtimeData);
                await db.collection('downtime_entries').add(downtimeData);
            }
            
            closeModal('manual-downtime-modal');
            
            // Atualizar dados
            await loadTodayStats();
            await loadRecentEntries(false);
            
            // Mostrar sucesso
            showNotification('Parada manual registrada com sucesso! (período possivelmente multi-dia)', 'success');

            console.log('[TRACE][handleManualDowntimeSubmit] success path completed');
            
        } catch (error) {
            console.error("Erro ao registrar parada manual: ", error);
            alert('Erro ao registrar parada. Tente novamente.');
        }
    }
    
    async function finishDowntime() {
        try {
            console.log('[TRACE][finishDowntime] invoked', { currentDowntimeStart, machineStatus });
            if (!currentDowntimeStart) {
                console.warn('Nenhuma parada ativa para finalizar.');
                return;
            }

            const now = new Date();
            const endTime = now.toTimeString().substr(0, 5);

            const startDateStr = currentDowntimeStart.date || formatDateYMD(currentDowntimeStart.startTimestamp || now);
            const endDateStr = formatDateYMD(now);

            const segments = splitDowntimeIntoDailySegments(startDateStr, currentDowntimeStart.startTime, endDateStr, endTime);
            console.log('[TRACE][finishDowntime] segments', segments);

            if (!segments.length) {
                // fallback simples
                const downtimeData = {
                    ...currentDowntimeStart,
                    endTime,
                    duration: 1,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                };
                await db.collection('downtime_entries').add(downtimeData);
            } else {
                for (const seg of segments) {
                    const downtimeData = {
                        machine: currentDowntimeStart.machine,
                        date: seg.date,
                        startTime: seg.startTime,
                        endTime: seg.endTime,
                        duration: seg.duration,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    };
                    await db.collection('downtime_entries').add(downtimeData);
                }
            }
            
            // Remover parada ativa do Firebase
            try {
                await db.collection('active_downtimes').doc(currentDowntimeStart.machine).delete();
                console.log('[TRACE] Parada ativa removida do Firebase');
            } catch (error) {
                console.error('Erro ao remover parada ativa do Firebase:', error);
            }
            
            // Resetar status
            currentDowntimeStart = null;
            machineStatus = 'running';
            updateMachineStatus();
            stopDowntimeTimer();
            resumeProductionTimer();
            
            loadTodayStats();
            await loadRecentEntries(false);
            
            // Mostrar sucesso
            showNotification('Parada finalizada!', 'success');

            console.log('[TRACE][finishDowntime] successfully persisted and reset state');
            
        } catch (error) {
            console.error("Erro ao finalizar parada: ", error);
            alert('Erro ao finalizar parada. Tente novamente.');
        }
    }
    
    // Handler para registrar retrabalho
    async function handleReworkSubmit(e) {
        e.preventDefault();
        
        // Verificar permissão
        if (!window.authSystem.checkPermissionForAction('add_rework')) {
            return;
        }
        
        console.log('[TRACE][handleReworkSubmit] triggered', { selectedMachineData });

        if (!selectedMachineData) {
            alert('Nenhuma máquina selecionada. Selecione uma máquina para registrar o retrabalho.');
            return;
        }

        const qtyInput = document.getElementById('quick-rework-qty');
        const weightInput = document.getElementById('quick-rework-weight');
        const reasonSelect = document.getElementById('quick-rework-reason');
        const obsInput = document.getElementById('quick-rework-obs');
        const reworkPhotoInput = document.getElementById('quick-rework-photo');

        const quantity = parseInt(qtyInput?.value, 10) || 0;
        const weight = parseFloat(weightInput?.value) || 0;
        const reason = reasonSelect?.value || '';
        const observations = (obsInput?.value || '').trim();
        const reworkPhotoFile = reworkPhotoInput?.files?.[0] || null;

        if (quantity <= 0) {
            alert('Informe uma quantidade válida de peças para retrabalho.');
            if (qtyInput) qtyInput.focus();
            return;
        }

        if (!reason) {
            alert('Selecione o motivo do retrabalho.');
            if (reasonSelect) reasonSelect.focus();
            return;
        }

        const planId = selectedMachineData?.id || null;
        if (!planId) {
            alert('Não foi possível identificar o planejamento associado a esta máquina.');
            return;
        }

        let photoUrl = null;
        let photoStoragePath = null;
        if (reworkPhotoFile) {
            try {
                const uploadResult = await uploadEvidencePhoto(reworkPhotoFile, `rework/${planId}`);
                photoUrl = uploadResult?.url || null;
                photoStoragePath = uploadResult?.path || null;
            } catch (error) {
                console.error('Erro ao enviar foto do retrabalho:', error);
                if (error?.message === 'storage-not-configured') {
                    alert('Não foi possível salvar a foto porque o armazenamento não está configurado.');
                } else {
                    alert('Erro ao enviar a foto. O registro não foi salvo.');
                }
                return;
            }
        }

        const currentShift = getCurrentShift();
        const dataReferencia = getProductionDateString();
    const currentUser = getActiveUser();

        const reworkData = {
            planId,
            data: dataReferencia,
            turno: currentShift,
            quantidade: quantity,
            peso_kg: weight > 0 ? weight : null,
            motivo: reason,
            observacoes: observations,
            machine: selectedMachineData.machine || null,
            mp: selectedMachineData.mp || '',
            photoUrl: photoUrl || null,
            photoStoragePath: photoStoragePath || null,
            registradoPor: currentUser.username || null,
            registradoPorNome: getCurrentUserName(),
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        console.log('[TRACE][handleReworkSubmit] prepared rework data', reworkData);

        try {
            await db.collection('rework_entries').add(reworkData);

            closeModal('quick-rework-modal');
            await loadRecentEntries(false);
            await refreshAnalysisIfActive();

            showNotification('Retrabalho registrado com sucesso!', 'success');
            console.log('[TRACE][handleReworkSubmit] success path completed');
        } catch (error) {
            console.error('Erro ao registrar retrabalho:', error);
            alert('Erro ao registrar retrabalho. Tente novamente.');
        }
    }
    
    // Funções auxiliares
    function getCurrentShift(reference = new Date()) {
        const hour = reference.getHours();
        
        if (hour >= 7 && hour < 15) {
            return 1; // 1º Turno
        } else if (hour >= 15 && hour < 23) {
            return 2; // 2º Turno
        } else {
            return 3; // 3º Turno
        }
    }

    function getShiftStartDateTime(reference = new Date()) {
        const shift = getCurrentShift(reference);
        const productionDay = getProductionDateString(reference);
        const shiftStartMap = {
            1: '07:00',
            2: '15:00',
            3: '23:00'
        };
        const startTime = shiftStartMap[shift] || '07:00';
        const startDate = combineDateAndTime(productionDay, startTime);
        if (startDate instanceof Date && !Number.isNaN(startDate.getTime())) {
            return startDate;
        }
        return null;
    }
    
    function updateMachineStatus() {
        const btnDowntime = document.getElementById('btn-downtime');
        const downtimeIcon = document.getElementById('downtime-icon');
        const downtimeText = document.getElementById('downtime-text');
        const downtimeSubtitle = document.getElementById('downtime-subtitle');
        
        if (machineStatus === 'stopped') {
            // Máquina parada - mostrar botão START (verde)
            btnDowntime.classList.remove('from-red-500', 'to-red-600', 'hover:from-red-600', 'hover:to-red-700');
            btnDowntime.classList.add('from-green-500', 'to-green-600', 'hover:from-green-600', 'hover:to-green-700');
            downtimeIcon.setAttribute('data-lucide', 'play-circle');
            downtimeText.textContent = 'START';
            
            // Mostrar tempo da parada atual se disponível
            if (currentDowntimeStart) {
                const now = new Date();
                const startDateTime = combineDateAndTime(currentDowntimeStart.date, currentDowntimeStart.startTime);
                if (startDateTime instanceof Date && !Number.isNaN(startDateTime.getTime())) {
                    const elapsedHours = ((now - startDateTime) / (1000 * 60 * 60)).toFixed(1);
                    downtimeSubtitle.textContent = `PARADA ATIVA - ${elapsedHours}h`;
                } else {
                    downtimeSubtitle.textContent = 'PARADA ATIVA - Retomar produção';
                }
            } else {
                downtimeSubtitle.textContent = 'Retomar produção';
            }
            
            downtimeSubtitle.classList.remove('text-red-100');
            downtimeSubtitle.classList.add('text-green-100');
        } else {
            // Máquina rodando - mostrar botão STOP (vermelho)
            btnDowntime.classList.remove('from-green-500', 'to-green-600', 'hover:from-green-600', 'hover:to-green-700');
            btnDowntime.classList.add('from-red-500', 'to-red-600', 'hover:from-red-600', 'hover:to-red-700');
            downtimeIcon.setAttribute('data-lucide', 'pause-circle');
            downtimeText.textContent = 'STOP';
            downtimeSubtitle.textContent = 'Parar máquina';
            downtimeSubtitle.classList.remove('text-green-100');
            downtimeSubtitle.classList.add('text-red-100');
        }
        
        lucide.createIcons();
    }
    
    function startDowntimeTimer() {
        const downtimeTimer = document.getElementById('downtime-timer');
        if (downtimeTimer) {
            downtimeTimer.classList.remove('hidden');
            
            const updateTimer = () => {
                if (!currentDowntimeStart) return;
                const now = new Date();
                const start = combineDateAndTime(currentDowntimeStart.date, currentDowntimeStart.startTime);
                if (!(start instanceof Date) || Number.isNaN(start.getTime())) {
                    downtimeTimer.textContent = '00:00:00';
                    return;
                }
                let diffSec = Math.floor((now - start) / 1000); // segundos
                if (diffSec < 0) diffSec = 0;
                const hours = Math.floor(diffSec / 3600);
                const minutes = Math.floor((diffSec % 3600) / 60);
                const seconds = diffSec % 60;
                
                const timeDisplay = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
                downtimeTimer.textContent = timeDisplay;
                
                // Alertas visuais baseados na duração da parada
                downtimeTimer.classList.remove('bg-red-300', 'bg-orange-300', 'bg-yellow-300', 'text-red-800', 'text-orange-800', 'text-yellow-800');
                
                if (hours >= 24) {
                    // 24+ horas - Vermelho crítico
                    downtimeTimer.classList.add('bg-red-300', 'text-red-800');
                    downtimeTimer.title = `PARADA CRÍTICA: ${hours}h - Verificar urgentemente!`;
                } else if (hours >= 8) {
                    // 8+ horas - Laranja (turno completo)
                    downtimeTimer.classList.add('bg-orange-300', 'text-orange-800');
                    downtimeTimer.title = `Parada longa: ${hours}h - Verificar motivo`;
                } else if (hours >= 2) {
                    // 2+ horas - Amarelo
                    downtimeTimer.classList.add('bg-yellow-300', 'text-yellow-800');
                    downtimeTimer.title = `Parada em andamento: ${hours}h${minutes > 0 ? `${minutes}m` : ''}`;
                } else {
                    // < 2 horas - Padrão vermelho
                    downtimeTimer.classList.add('bg-red-300', 'text-red-800');
                    downtimeTimer.title = `Parada ativa: ${timeDisplay}`;
                }
            };
            updateTimer();
            downtimeTimer.interval = setInterval(updateTimer, 1000);
        }
    }
    
    function stopDowntimeTimer() {
        const downtimeTimer = document.getElementById('downtime-timer');
        if (downtimeTimer) {
            downtimeTimer.classList.add('hidden');
            if (downtimeTimer.interval) {
                clearInterval(downtimeTimer.interval);
            }
        }
    }

    function formatSecondsToClock(totalSeconds) {
        const safeSeconds = Math.max(0, Math.floor(totalSeconds || 0));
        const hours = Math.floor(safeSeconds / 3600);
        const minutes = Math.floor((safeSeconds % 3600) / 60);
        const seconds = safeSeconds % 60;
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    function updateProductionTimeDisplay(seconds) {
        if (!productionTimeDisplay) return;
        productionTimeDisplay.textContent = formatSecondsToClock(seconds);
    }

    function clearProductionTimerInterval() {
        if (productionTimer) {
            clearInterval(productionTimer);
            productionTimer = null;
        }
    }

    function resetProductionTimer() {
        productionTimerBaseSeconds = 0;
        productionTimerResumeTimestamp = null;
        clearProductionTimerInterval();
        updateProductionTimeDisplay(0);
    }

    function freezeProductionTimer() {
        if (productionTimerResumeTimestamp) {
            const elapsed = Math.floor((Date.now() - productionTimerResumeTimestamp) / 1000);
            productionTimerBaseSeconds += Math.max(elapsed, 0);
            productionTimerResumeTimestamp = null;
        }
        clearProductionTimerInterval();
        updateProductionTimeDisplay(productionTimerBaseSeconds);
    }

    function resumeProductionTimer() {
        if (productionTimerResumeTimestamp) {
            return;
        }
        productionTimerResumeTimestamp = Date.now();
        clearProductionTimerInterval();
        updateProductionTimeDisplay(productionTimerBaseSeconds);
        productionTimer = setInterval(() => {
            const elapsed = Math.floor((Date.now() - productionTimerResumeTimestamp) / 1000);
            updateProductionTimeDisplay(productionTimerBaseSeconds + Math.max(elapsed, 0));
        }, 1000);
    }

    function synchronizeProductionTimer(elapsedSeconds, shouldRun) {
        productionTimerBaseSeconds = Math.max(0, Math.floor(elapsedSeconds || 0));
        productionTimerResumeTimestamp = shouldRun ? Date.now() : null;
        clearProductionTimerInterval();
        updateProductionTimeDisplay(productionTimerBaseSeconds);

        if (!shouldRun) {
            return;
        }

        productionTimer = setInterval(() => {
            if (!productionTimerResumeTimestamp) {
                clearProductionTimerInterval();
                return;
            }
            const elapsed = Math.floor((Date.now() - productionTimerResumeTimestamp) / 1000);
            updateProductionTimeDisplay(productionTimerBaseSeconds + Math.max(elapsed, 0));
        }, 1000);
    }

    // Calcula o tempo de produção efetivo do turno atual desconsiderando paradas registradas.
    function calculateProductionRuntimeSeconds({ shiftStart, now, downtimes = [], activeDowntime = null }) {
        if (!(shiftStart instanceof Date) || Number.isNaN(shiftStart.getTime())) {
            return 0;
        }

        const referenceNow = now instanceof Date ? now : new Date();
        if (referenceNow <= shiftStart) {
            return 0;
        }

        const shiftStartMs = shiftStart.getTime();
        const nowMs = referenceNow.getTime();
        let downtimeMillis = 0;

        downtimes.forEach(dt => {
            if (!dt) return;
            const start = combineDateAndTime(dt.date, dt.startTime);
            const end = dt.endTime ? combineDateAndTime(dt.date, dt.endTime) : null;
            if (!(start instanceof Date) || Number.isNaN(start.getTime())) {
                return;
            }

            let effectiveEnd = end;
            if (!(effectiveEnd instanceof Date) || Number.isNaN(effectiveEnd.getTime()) || effectiveEnd <= start) {
                const durationMinutes = Number(dt.duration) || 0;
                effectiveEnd = new Date(start.getTime() + Math.max(durationMinutes, 0) * 60000);
            }

            const windowStart = Math.max(start.getTime(), shiftStartMs);
            const windowEnd = Math.min(effectiveEnd.getTime(), nowMs);
            if (windowEnd > windowStart) {
                downtimeMillis += windowEnd - windowStart;
            }
        });

        if (activeDowntime && activeDowntime.startTime && activeDowntime.date) {
            const activeStart = combineDateAndTime(activeDowntime.date, activeDowntime.startTime);
            if (activeStart instanceof Date && !Number.isNaN(activeStart.getTime())) {
                const windowStart = Math.max(activeStart.getTime(), shiftStartMs);
                if (nowMs > windowStart) {
                    downtimeMillis += nowMs - windowStart;
                }
            }
        }

        const elapsedMillis = nowMs - shiftStartMs;
        const runtimeMillis = Math.max(0, elapsedMillis - downtimeMillis);
        return Math.floor(runtimeMillis / 1000);
    }
    
    function setRecentEntriesState({ loading = false, empty = false }) {
        if (recentEntriesLoading) {
            recentEntriesLoading.classList.toggle('hidden', !loading);
        }
        if (recentEntriesEmpty) {
            recentEntriesEmpty.classList.toggle('hidden', !empty);
        }
        if (recentEntriesList) {
            recentEntriesList.classList.toggle('hidden', empty);
        }
    }

    function updateRecentEntriesEmptyMessage(message) {
        if (recentEntriesEmpty) {
            recentEntriesEmpty.innerHTML = `<p class="text-sm text-gray-500">${message}</p>`;
        }
    }

    function formatEntryTimestamp(date) {
        if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
        return new Intl.DateTimeFormat('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        }).format(date);
    }

    function buildRecentEntryMarkup(entry) {
        const typeConfig = {
            production: { label: 'Produção', badge: 'bg-green-100 text-green-700 border border-green-200' },
            loss: { label: 'Perda', badge: 'bg-orange-100 text-orange-700 border border-orange-200' },
            downtime: { label: 'Parada', badge: 'bg-red-100 text-red-700 border border-red-200' },
            rework: { label: 'Retrabalho', badge: 'bg-purple-100 text-purple-700 border border-purple-200' }
        };

        const config = typeConfig[entry.type] || { label: 'Lançamento', badge: 'bg-gray-100 text-gray-600 border border-gray-200' };
        const turnoLabel = entry.data.turno ? `Turno ${entry.data.turno}` : null;
        const timeLabel = formatEntryTimestamp(entry.timestamp);
        const registradoPorNome = entry.data.registradoPorNome || 'Desconhecido';
        const details = [];
        const parseNumber = (value) => {
            if (typeof value === 'number') return value;
            const parsed = parseFloat(value);
            return Number.isFinite(parsed) ? parsed : 0;
        };

        if (entry.data.mp) {
            details.push(`MP: ${entry.data.mp}`);
        }

        if (entry.type === 'production') {
            const produzido = parseInt(entry.data.produzido ?? entry.data.quantity ?? 0, 10) || 0;
            details.push(`<span class="font-semibold text-gray-800">${produzido} peça(s)</span>`);
            const pesoBruto = parseNumber(entry.data.peso_bruto ?? entry.data.weight ?? 0);
            if (pesoBruto > 0) {
                details.push(`${pesoBruto.toFixed(2)} kg`);
            }
        } else if (entry.type === 'loss') {
            const refugoKg = parseNumber(entry.data.refugo_kg ?? entry.data.weight ?? 0);
            details.push(`<span class="font-semibold text-gray-800">${refugoKg.toFixed(2)} kg</span>`);
            if (entry.data.perdas) {
                details.push(`Motivo: ${entry.data.perdas}`);
            }
        } else if (entry.type === 'downtime') {
            const start = entry.data.startTime ? `${entry.data.startTime}` : '';
            const end = entry.data.endTime ? ` - ${entry.data.endTime}` : '';
            details.push(`Período: ${start}${end}`);
            if (entry.data.reason) {
                details.push(`Motivo: ${entry.data.reason}`);
            }
        } else if (entry.type === 'rework') {
            const quantidade = parseInt(entry.data.quantidade ?? entry.data.quantity ?? 0, 10) || 0;
            details.push(`<span class="font-semibold text-gray-800">${quantidade} peça(s)</span>`);
            const pesoKg = parseNumber(entry.data.peso_kg ?? entry.data.weight ?? 0);
            if (pesoKg > 0) {
                details.push(`${pesoKg.toFixed(2)} kg`);
            }
            if (entry.data.motivo) {
                details.push(`Motivo: ${entry.data.motivo}`);
            }
        }

        const observations = entry.data.observacoes || entry.data.observations || entry.data.notes;
        const canEdit = entry.type === 'production' || entry.type === 'loss';
        const actions = [];

        if (canEdit) {
            actions.push(`
                <button class="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50"
                        data-action="edit" data-entry-id="${entry.id}" data-entry-type="${entry.type}">
                    <i data-lucide="pencil" class="w-4 h-4"></i>
                    Editar
                </button>
            `);
        }

        actions.push(`
            <button class="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
                    data-action="delete" data-entry-id="${entry.id}" data-entry-type="${entry.type}">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
                Excluir
            </button>
        `);

        const metaChips = [config.label];
        if (turnoLabel) metaChips.push(turnoLabel);
        if (timeLabel) metaChips.push(timeLabel);

        return `
            <div class="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
                <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div class="space-y-2">
                        <div class="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                            <span class="px-2 py-1 rounded-full ${config.badge}">${config.label}</span>
                            ${turnoLabel ? `<span class="px-2 py-1 rounded-full bg-gray-100 text-gray-600 border border-gray-200">${turnoLabel}</span>` : ''}
                            ${timeLabel ? `<span>${timeLabel}</span>` : ''}
                            <span class="px-2 py-1 rounded-full bg-blue-50 text-blue-600 border border-blue-200">👤 ${registradoPorNome}</span>
                        </div>
                        <div class="text-sm text-gray-700 space-x-2">
                            ${details.join('<span class="text-gray-300">•</span>')}
                        </div>
                        ${observations ? `<div class="text-xs text-gray-500">Obs.: ${observations}</div>` : ''}
                    </div>
                    <div class="flex items-center gap-2">
                        ${actions.join('')}
                    </div>
                </div>
            </div>
        `;
    }

    function renderRecentEntries(entries) {
        if (!recentEntriesList) return;
        recentEntriesList.innerHTML = entries.map(buildRecentEntryMarkup).join('');
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    async function loadRecentEntries(showLoading = true) {
        if (!recentEntriesList) return;

        if (showLoading) {
            setRecentEntriesState({ loading: true, empty: false });
        }

        if (!selectedMachineData) {
            recentEntriesCache = new Map();
            if (recentEntriesList) recentEntriesList.innerHTML = '';
            updateRecentEntriesEmptyMessage('Selecione uma máquina para visualizar os lançamentos.');
            setRecentEntriesState({ loading: false, empty: true });
            return;
        }

        try {
            const date = getProductionDateString();
            const planId = selectedMachineData.id;

            const productionSnapshot = await db.collection('production_entries')
                .where('planId', '==', planId)
                .where('data', '==', date)
                .get();

            const entries = [];
            recentEntriesCache = new Map();

            productionSnapshot.forEach(doc => {
                const data = doc.data();
                const type = (data.refugo_kg && data.refugo_kg > 0) || data.perdas ? 'loss' : 'production';
                const resolvedTimestamp = resolveProductionDateTime(data) || data.updatedAt?.toDate?.() || data.timestamp?.toDate?.() || data.createdAt?.toDate?.() || (data.datetime ? new Date(data.datetime) : null);

                const entry = {
                    id: doc.id,
                    type,
                    collection: 'production_entries',
                    data,
                    timestamp: resolvedTimestamp
                };

                entries.push(entry);
                recentEntriesCache.set(doc.id, entry);
            });

            // Fallback: buscar lançamentos da máquina (ex. BORRA) que não possuem planId associado
            const machineId = normalizeMachineId(selectedMachineData.machine || '');
            if (machineId) {
                const machineSnapshot = await db.collection('production_entries')
                    .where('machine', '==', machineId)
                    .where('data', '==', date)
                    .get();

                machineSnapshot.forEach(doc => {
                    if (recentEntriesCache.has(doc.id)) return;
                    const data = doc.data();
                    const type = (data.refugo_kg && data.refugo_kg > 0) || data.perdas ? 'loss' : 'production';
                    const resolvedTimestamp = resolveProductionDateTime(data) || data.updatedAt?.toDate?.() || data.timestamp?.toDate?.() || data.createdAt?.toDate?.() || (data.datetime ? new Date(data.datetime) : null);

                    const entry = {
                        id: doc.id,
                        type,
                        collection: 'production_entries',
                        data,
                        timestamp: resolvedTimestamp
                    };

                    entries.push(entry);
                    recentEntriesCache.set(doc.id, entry);
                });
            }

            const downtimeSnapshot = await db.collection('downtime_entries')
                .where('machine', '==', selectedMachineData.machine)
                .where('date', '==', date)
                .get();

            downtimeSnapshot.forEach(doc => {
                const data = doc.data();
                const timestamp = data.createdAt?.toDate?.() || data.timestamp?.toDate?.() || resolveProductionDateTime(data) || (data.startTime ? new Date(`${data.date}T${data.startTime}`) : null);

                const entry = {
                    id: doc.id,
                    type: 'downtime',
                    collection: 'downtime_entries',
                    data,
                    timestamp
                };

                entries.push(entry);
                recentEntriesCache.set(doc.id, entry);
            });

            const reworkSnapshot = await db.collection('rework_entries')
                .where('planId', '==', planId)
                .where('data', '==', date)
                .get();

            reworkSnapshot.forEach(doc => {
                const data = doc.data();
                const timestamp = data.createdAt?.toDate?.() || data.timestamp?.toDate?.() || (data.data ? new Date(`${data.data}T12:00:00`) : null);

                const entry = {
                    id: doc.id,
                    type: 'rework',
                    collection: 'rework_entries',
                    data,
                    timestamp
                };

                entries.push(entry);
                recentEntriesCache.set(doc.id, entry);
            });

            entries.sort((a, b) => {
                const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : 0;
                const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : 0;
                return timeB - timeA;
            });

            // Armazenar todas as entradas para filtro
            allRecentEntries = entries;

            if (!entries.length) {
                updateRecentEntriesEmptyMessage('Ainda não há lançamentos para esta máquina.');
                setRecentEntriesState({ loading: false, empty: true });
            } else {
                applyEntryFilter(currentEntryFilter);
                setRecentEntriesState({ loading: false, empty: false });
            }
        } catch (error) {
            console.error('Erro ao carregar lançamentos recentes: ', error);
            updateRecentEntriesEmptyMessage('Não foi possível carregar os lançamentos. Tente novamente.');
            setRecentEntriesState({ loading: false, empty: true });
        }
    }

    function refreshRecentEntries(showLoading = false) {
        loadRecentEntries(showLoading);
    }
    window.refreshRecentEntries = refreshRecentEntries;

    // Função para aplicar filtro de tipo de entrada
    function applyEntryFilter(filter) {
        currentEntryFilter = filter;
        
        let filteredEntries = allRecentEntries;
        
        if (filter !== 'all') {
            filteredEntries = allRecentEntries.filter(entry => entry.type === filter);
        }
        
        if (filteredEntries.length === 0) {
            const filterLabels = {
                all: 'lançamentos',
                production: 'lançamentos de produção',
                downtime: 'paradas',
                loss: 'perdas',
                rework: 'retrabalhos'
            };
            updateRecentEntriesEmptyMessage(`Não há ${filterLabels[filter]} para exibir.`);
            setRecentEntriesState({ loading: false, empty: true });
        } else {
            renderRecentEntries(filteredEntries);
            setRecentEntriesState({ loading: false, empty: false });
        }
        
        // Atualizar estado visual dos botões de filtro
        updateFilterButtons(filter);
    }
    
    // Função para atualizar estado visual dos botões de filtro
    function updateFilterButtons(activeFilter) {
        const filterButtons = document.querySelectorAll('.filter-entry-btn');
        filterButtons.forEach(btn => {
            const btnFilter = btn.dataset.filter;
            if (btnFilter === activeFilter) {
                btn.classList.add('active', 'bg-white', 'text-blue-600', 'shadow-sm');
                btn.classList.remove('text-gray-600', 'hover:text-gray-900', 'hover:bg-gray-50');
            } else {
                btn.classList.remove('active', 'bg-white', 'text-blue-600', 'shadow-sm');
                btn.classList.add('text-gray-600', 'hover:text-gray-900', 'hover:bg-gray-50');
            }
        });
    }

    function handleRecentEntryAction(event) {
        const actionButton = event.target.closest('[data-action]');
        if (!actionButton) return;

        const action = actionButton.dataset.action;
        const entryId = actionButton.dataset.entryId;
        const entryType = actionButton.dataset.entryType;

        if (!entryId || !entryType) return;

        if (action === 'edit') {
            openEntryForEditing(entryType, entryId);
        } else if (action === 'delete') {
            let collection = 'production_entries';
            if (entryType === 'downtime') {
                collection = 'downtime_entries';
            } else if (entryType === 'rework') {
                collection = 'rework_entries';
            }
            showConfirmModal(entryId, collection);
        }
    }

    function openEntryForEditing(entryType, entryId) {
        const entry = recentEntriesCache.get(entryId);
        if (!entry) {
            console.warn('Registro para edição não encontrado:', entryId);
            return;
        }

        currentEditContext = {
            type: entryType,
            id: entryId,
            collection: entry.collection,
            original: entry.data
        };

        if (entryType === 'production') {
            document.getElementById('quick-production-qty').value = entry.data.produzido || 0;
            document.getElementById('quick-production-weight').value = entry.data.peso_bruto || 0;
            document.getElementById('quick-production-obs').value = entry.data.observacoes || '';
            openModal('quick-production-modal');
        } else if (entryType === 'loss') {
            document.getElementById('quick-losses-qty').value = entry.data.refugo_qty || entry.data.quantity || 0;
            document.getElementById('quick-losses-weight').value = entry.data.refugo_kg || 0;
            document.getElementById('quick-losses-reason').value = entry.data.perdas || '';
            document.getElementById('quick-losses-obs').value = entry.data.observacoes || '';
            openModal('quick-losses-modal');
        } else {
            alert('Edição deste tipo de lançamento ainda não está disponível.');
        }
    }

    function showNotification(message, type = 'info') {
        console.log('🔔 Mostrando notificação:', { message, type });
        // Criar notificação toast
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg ${
            type === 'success' ? 'bg-green-100 text-green-800 border-green-200' :
            type === 'warning' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
            type === 'error' ? 'bg-red-100 text-red-800 border-red-200' :
            'bg-blue-100 text-blue-800 border-blue-200'
        } border`;
        
        notification.innerHTML = `
            <div class="flex items-center gap-2">
                <i data-lucide="${
                    type === 'success' ? 'check-circle' :
                    type === 'warning' ? 'alert-triangle' :
                    type === 'error' ? 'x-circle' : 'info'
                }" class="w-5 h-5"></i>
                <span>${message}</span>
            </div>
        `;
        
        document.body.appendChild(notification);
        lucide.createIcons();
        
        // Remover após 3 segundos
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
    }
    
    // Função para carregar o painel de lançamento
    async function loadLaunchPanel() {
        try {
            showLoadingState('launch-panel', true);
            await populateMachineSelector();
            updateCurrentShiftDisplay();
            showLoadingState('launch-panel', false, false);
        } catch (error) {
            console.error("Erro ao carregar painel de lançamento: ", error);
            showLoadingState('launch-panel', false, true);
        }
    }
    
    function setActiveMachineCard(machine) {
        if (!machineCardGrid) return;

        // Remove seleção anterior
        const previousSelected = machineCardGrid.querySelector('.machine-card.selected');
        if (previousSelected) {
            previousSelected.classList.remove('selected');
        }

        if (!machine) {
            activeMachineCard = null;
            return;
        }

        // Adiciona seleção no novo card
        const nextCard = machineCardGrid.querySelector(`[data-machine="${machine}"]`);
        if (nextCard) {
            nextCard.classList.add('selected');
            activeMachineCard = nextCard;
            
            // Scroll suave para o card selecionado se necessário
            nextCard.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'nearest',
                inline: 'nearest'
            });
        } else {
            activeMachineCard = null;
        }
    }

    function isPlanActive(plan) {
        if (!plan) return false;
        const status = String(plan.status || '').toLowerCase();
        const inactiveStatuses = ['concluida', 'concluido', 'finalizada', 'finalizado', 'cancelada', 'cancelado', 'encerrada', 'encerrado'];
        if (status && inactiveStatuses.includes(status)) {
            return false;
        }
        // Não esconder automaticamente quando atingir a meta.
        // O card só deve sair quando for explicitamente finalizado (status atualizado para concluída).
        return true;
    }

    function renderMachineCards(plans = [], productionEntries = [], downtimeEntries = []) {
        if (!machineCardGrid) {
            if (machineSelector) {
                machineSelector.machineData = {};
                machineSelector.innerHTML = '<option value="">Selecione uma máquina...</option>';
            }
            return;
        }

        if (machineCardEmptyState) {
            machineCardEmptyState.textContent = 'Nenhuma máquina planejada para hoje.';
            machineCardEmptyState.classList.add('hidden');
            machineCardEmptyState.classList.remove('text-red-100');
        }

        const activePlans = Array.isArray(plans) ? plans.filter(isPlanActive) : [];

        if (activePlans.length === 0) {
            machineCardData = {};
            machineCardGrid.innerHTML = '';
            if (machineSelector) {
                machineSelector.machineData = {};
                machineSelector.innerHTML = '<option value="">Selecione uma máquina...</option>';
            }
            if (machineCardEmptyState) {
                machineCardEmptyState.textContent = 'Nenhuma OP ativa no momento.';
                machineCardEmptyState.classList.remove('hidden');
            }
            setActiveMachineCard(null);
            return;
        }

        machineCardData = {};
        if (machineSelector) {
            machineSelector.machineData = {};
        }

        const planById = {};
        const machineOrder = [];

        activePlans.forEach(plan => {
            if (!plan || !plan.machine) return;
            const enrichedPlan = { id: plan.id, ...plan };
            machineCardData[plan.machine] = enrichedPlan;
            planById[plan.id] = enrichedPlan;
            machineOrder.push(plan.machine);
        });

        machineOrder.sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));

        if (machineSelector) {
            const selectorOptions = ['<option value="">Selecione uma máquina...</option>']
                .concat(machineOrder.map(machine => `<option value="${machine}">${machine}</option>`));
            machineSelector.innerHTML = selectorOptions.join('');
            machineOrder.forEach(machine => {
                machineSelector.machineData[machine] = machineCardData[machine];
            });
        }

        const aggregated = {};
        machineOrder.forEach(machine => {
            aggregated[machine] = {
                plan: machineCardData[machine],
                totalProduced: 0,
                totalLossesKg: 0,
                entries: [],
                byShift: { T1: 0, T2: 0, T3: 0 }
            };
        });

        const planIdSet = new Set(activePlans.map(plan => plan.id));
        const machineSet = new Set(machineOrder);
        const filteredProductionEntries = Array.isArray(productionEntries)
            ? productionEntries.filter(entry => entry && planIdSet.has(entry.planId))
            : [];
        const filteredDowntimeEntries = Array.isArray(downtimeEntries)
            ? downtimeEntries.filter(entry => entry && machineSet.has(entry.machine))
            : [];
        const combinedEntries = [];
        const fallbackShiftKey = `T${getCurrentShift()}`;

        filteredProductionEntries.forEach(entry => {
            if (!entry || !planIdSet.has(entry.planId)) return;
            const plan = planById[entry.planId];
            if (!plan) return;
            const machine = plan.machine;
            const produced = Number(entry.produzido) || 0;
            const turno = normalizeShiftValue(entry.turno);

            aggregated[machine].totalProduced += produced;
            aggregated[machine].totalLossesKg += Number(entry.refugo_kg) || 0;
            if (turno) {
                aggregated[machine].byShift[turno] = (aggregated[machine].byShift[turno] || 0) + produced;
            }

            const entryForOee = {
                machine,
                turno,
                produzido: produced,
                duracao_min: Number(entry.duracao_min ?? entry.duration_min ?? entry.duration ?? 0) || 0,
                refugo_kg: Number(entry.refugo_kg) || 0,
                piece_weight: plan.piece_weight,
                real_cycle_t1: plan.real_cycle_t1,
                real_cycle_t2: plan.real_cycle_t2,
                real_cycle_t3: plan.real_cycle_t3,
                budgeted_cycle: plan.budgeted_cycle,
                active_cavities_t1: plan.active_cavities_t1,
                active_cavities_t2: plan.active_cavities_t2,
                active_cavities_t3: plan.active_cavities_t3,
                mold_cavities: plan.mold_cavities
            };

            aggregated[machine].entries.push(entryForOee);
            combinedEntries.push(entryForOee);
        });

        Object.keys(machineCardCharts).forEach(machine => {
            if (machineCardCharts[machine]) {
                machineCardCharts[machine].destroy();
            }
            delete machineCardCharts[machine];
        });

        if (machineOrder.length === 0) {
            machineCardGrid.innerHTML = '';
            if (machineCardEmptyState) {
                machineCardEmptyState.classList.remove('hidden');
            }
            setActiveMachineCard(null);
            return;
        }

    const oeeSummary = combinedEntries.length > 0 ? calculateRealTimeOEE(combinedEntries) : null;
    const oeeByMachine = oeeSummary?.oeeByMachine || {};
    const currentShiftKey = oeeSummary?.currentShift || fallbackShiftKey;

        const formatQty = (value) => Number(value || 0).toLocaleString('pt-BR');
        const machineProgressInfo = {};

        machineCardGrid.innerHTML = machineOrder.map(machine => {
            const data = aggregated[machine];
            const plan = data.plan || {};
            // Usar APENAS lot_size da OP (quantidade total planejada da ordem)
            // Não use planned_quantity - esse é apenas meta diária
            const plannedQty = Number(plan.order_lot_size) || Number(plan.lot_size) || 0;
            
            // Calcular produção total acumulada da OP (não apenas do dia atual)
            const totalAccumulatedProduced = Number(plan.total_produzido) || data.totalProduced || 0;
            const lossesKg = Number(data.totalLossesKg) || 0;
            const pieceWeight = Number(plan.piece_weight) || 0;
            const scrapPcs = pieceWeight > 0 ? Math.round((lossesKg * 1000) / pieceWeight) : 0;
            const goodProduction = Math.max(0, totalAccumulatedProduced - scrapPcs); // Executado = produção boa total
            const progressPercentRaw = plannedQty > 0 ? (goodProduction / plannedQty) * 100 : 0;
            
            console.log(`Card ${machine} - Lot Size: ${plan.order_lot_size}, Planned Qty: ${plan.planned_quantity}, Planejado Final: ${plannedQty}, Total Produzido: ${totalAccumulatedProduced}, Produção Boa: ${goodProduction}`);
            const normalizedProgress = Math.max(0, Math.min(progressPercentRaw, 100));
            const progressPalette = resolveProgressPalette(progressPercentRaw);
            const progressTextClass = progressPalette.textClass || 'text-slate-600';
            const progressText = `${Math.max(0, progressPercentRaw).toFixed(progressPercentRaw >= 100 ? 0 : 1)}%`;
            const remainingQty = Math.max(0, plannedQty - goodProduction); // Restante baseado na produção boa
            const lotCompleted = plannedQty > 0 && goodProduction >= plannedQty;

            machineProgressInfo[machine] = {
                normalizedProgress,
                progressPercent: progressPercentRaw,
                palette: progressPalette
            };

            const oeeShiftData = oeeByMachine[machine]?.[currentShiftKey];
            const oeePercent = Math.max(0, Math.min((oeeShiftData?.oee || 0) * 100, 100));
            const oeePercentText = oeePercent ? oeePercent.toFixed(1) : '0.0';
            const oeeColorClass = oeePercent >= 85 ? 'text-emerald-600' : oeePercent >= 70 ? 'text-amber-500' : 'text-red-500';
            // Cálculos de KPIs (Tempo rodando/paradas, Qualidade/Perdas)
            const nowRef = new Date();
            const shiftStart = getShiftStartDateTime(nowRef);
            let runtimeHours = 0, downtimeHours = 0;
            if (shiftStart instanceof Date && !Number.isNaN(shiftStart.getTime())) {
                const elapsedSec = Math.max(0, Math.floor((nowRef.getTime() - shiftStart.getTime()) / 1000));
                if (elapsedSec > 0) {
                    const dts = filteredDowntimeEntries.filter(dt => dt && dt.machine === machine);
                    const runtimeSec = calculateProductionRuntimeSeconds({ shiftStart, now: nowRef, downtimes: dts });
                    runtimeHours = Math.max(0, runtimeSec / 3600);
                    downtimeHours = Math.max(0, (elapsedSec / 3600) - runtimeHours);
                }
            }
            let qualityPct = 100;
            if (data.totalProduced > 0) {
                qualityPct = Math.max(0, Math.min(100, (goodProduction / data.totalProduced) * 100));
            } else if (lossesKg > 0) {
                qualityPct = 0;
            }
            const qualityColorClass = qualityPct >= 98 ? 'text-emerald-600' : (qualityPct >= 95 ? 'text-amber-600' : 'text-red-600');
            const productLine = plan.product ? `<p class="mt-1 text-sm text-slate-600">${plan.product}</p>` : '<p class="mt-1 text-sm text-slate-400">Produto não definido</p>';
            const mpLine = plan.mp ? `<p class="text-xs text-slate-400 mt-1">MP: ${plan.mp}</p>` : '';
            const shiftProduced = data.byShift[currentShiftKey] ?? data.byShift[fallbackShiftKey] ?? 0;

            return `
                <div class="machine-card group relative bg-white rounded-lg border border-slate-200 hover:border-blue-300 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer p-3 ${lotCompleted && String(plan.status||'').toLowerCase()!=='concluida' ? 'completed-blink' : ''}" data-machine="${machine}" data-plan-id="${plan.id}" data-order-id="${plan.order_id||''}" data-part-code="${plan.product_cod||''}">
                    <!-- Header compacto -->
                    <div class="flex items-center justify-between mb-2">
                        <div class="flex items-center gap-2">
                            <div class="machine-identifier w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                                ${machine.slice(-2)}
                            </div>
                            <div>
                                <h3 class="text-sm font-bold text-slate-900">${machine}</h3>
                                <p class="text-xs text-slate-500 truncate max-w-[120px]" title="${plan.product || 'Produto não definido'}">${plan.product || 'Produto não definido'}</p>
                            </div>
                        </div>
                        <div class="text-right">
                            <div class="text-xs font-semibold ${oeeColorClass}">${oeePercentText}%</div>
                            <div class="text-[10px] text-slate-400 uppercase">OEE</div>
                        </div>
                    </div>

                    <!-- Indicadores principais em linha -->
                    <div class="grid grid-cols-3 gap-2 mb-3">
                        <div class="text-center">
                            <div class="text-sm font-semibold text-slate-900">${formatQty(goodProduction)}</div>
                            <div class="text-[10px] text-slate-500 uppercase">Exec. OP</div>
                        </div>
                        <div class="text-center">
                            <div class="text-sm font-semibold ${qualityColorClass}">${qualityPct.toFixed(0)}%</div>
                            <div class="text-[10px] text-slate-500 uppercase">Qualidade</div>
                        </div>
                        <div class="text-center">
                            <div class="text-sm font-semibold text-slate-900">${formatQty(remainingQty)}</div>
                            <div class="text-[10px] text-slate-500 uppercase">Faltante</div>
                        </div>
                    </div>

                    <!-- Barra de progresso compacta -->
                    <div class="mb-2">
                        <div class="flex items-center justify-between mb-1">
                            <span class="text-xs text-slate-500">OP Total (${formatQty(plannedQty)})</span>
                            <span class="text-xs font-semibold ${progressTextClass}">${progressText}</span>
                        </div>
                        <div class="w-full bg-slate-100 rounded-full h-2">
                            <div class="h-2 rounded-full transition-all duration-300 ${progressPalette.bgClass || 'bg-blue-500'}" style="width: ${normalizedProgress}%"></div>
                        </div>
                    </div>

                    <!-- Status compacto -->
                    <div class="flex items-center justify-between text-xs">
                        <div class="flex gap-1">
                            <span class="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px]" title="Tempo rodando">${runtimeHours.toFixed(1)}h</span>
                            ${downtimeHours > 0 ? `<span class="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px]" title="Tempo parado">${downtimeHours.toFixed(1)}h</span>` : ''}
                        </div>
                        <div class="text-slate-500">
                            <span class="font-medium">${formatShiftLabel(currentShiftKey)}</span>
                        </div>
                    </div>

                    <!-- Indicador visual de status (máquina ativa/parada) -->
                    <div class="absolute top-2 right-2 w-2 h-2 rounded-full ${downtimeHours > runtimeHours ? 'bg-red-400' : 'bg-green-400'}" title="${downtimeHours > runtimeHours ? 'Máquina com paradas' : 'Máquina produzindo'}"></div>

                                        ${lotCompleted ? `
                                            <div class="card-actions flex gap-2 mt-3">
                                                ${String(plan.status||'').toLowerCase()!=='concluida' && plan.order_id ? `
                                                    <button type="button" class="btn btn-finalize card-finalize-btn" data-plan-id="${plan.id}" data-order-id="${plan.order_id}" title="Finalizar OP">
                                                         <i data-lucide="check-circle"></i>
                                                         <span>Finalizar OP</span>
                                                    </button>
                                                ` : ''}
                                                ${String(plan.status||'').toLowerCase()==='concluida' ? `
                                                    <button type="button" class="btn btn-activate card-activate-next-btn" data-plan-id="${plan.id}" data-machine="${machine}" data-part-code="${plan.product_cod||''}" title="Ativar próxima OP">
                                                         <i data-lucide="play-circle"></i>
                                                         <span>Ativar próxima OP</span>
                                                    </button>
                                                ` : ''}
                                            </div>
                                        ` : ''}
                </div>
            `;
        }).join('');

        machineOrder.forEach(machine => {
            renderMachineCardProgress(machine, machineProgressInfo[machine]);
        });

        if (selectedMachineData && selectedMachineData.machine && machineCardData[selectedMachineData.machine]) {
            setActiveMachineCard(selectedMachineData.machine);
        } else {
            selectedMachineData = null;
            setActiveMachineCard(null);
            if (productionControlPanel) {
                productionControlPanel.classList.add('hidden');
            }
            updateRecentEntriesEmptyMessage('Selecione uma máquina para visualizar os lançamentos.');
            setRecentEntriesState({ loading: false, empty: true });
        }

        // Recriar ícones (por causa dos botões novos)
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    function renderMachineCardProgress(machine, progressInfo) {
        if (!machine || !progressInfo) return;

        const canvasId = `progress-donut-${machine}`;
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            return;
        }

        if (machineCardCharts[machine]) {
            try {
                machineCardCharts[machine].destroy();
            } catch (error) {
                console.warn('[TRACE][renderMachineCardProgress] falha ao destruir gráfico anterior', { machine, error });
            }
        }

        const executed = Math.max(0, Math.min(progressInfo.normalizedProgress ?? 0, 100));
        const remainder = Math.max(0, 100 - executed);
        const primaryColor = progressInfo.palette?.start || '#2563EB';
        const secondaryColor = hexWithAlpha(primaryColor, 0.18);

        machineCardCharts[machine] = new Chart(canvas, {
            type: 'doughnut',
            data: {
                datasets: [{
                    data: [executed, remainder],
                    backgroundColor: [primaryColor, secondaryColor],
                    borderWidth: 0,
                    hoverOffset: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                rotation: -90,
                plugins: {
                    legend: { display: false },
                    tooltip: { enabled: false }
                },
                animation: {
                    animateRotate: executed > 0,
                    duration: 600
                }
            }
        });
    }

    // Função para popular o seletor de máquinas (e cards)
    async function populateMachineSelector() {
        try {
            const today = getProductionDateString();
            const planSnapshot = await db.collection('planning').where('date', '==', today).get();
            let plans = planSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Enriquecer planos com dados da OP (lot size, execução acumulada)
            const orderCacheByPartCode = new Map();
            const orderCacheById = new Map();
            const productionTotalsByOrderId = new Map();

            for (const plan of plans) {
                const partCode = String(plan.product_cod || plan.product_code || plan.part_code || '').trim();
                let resolvedOrder = null;

                // Priorizar vínculo direto com a OP se existir no planejamento
                const linkedOrderId = plan.production_order_id || plan.production_order || plan.order_id || null;
                if (linkedOrderId) {
                    try {
                        if (!orderCacheById.has(linkedOrderId)) {
                            const doc = await db.collection('production_orders').doc(linkedOrderId).get();
                            if (doc.exists) {
                                orderCacheById.set(linkedOrderId, { id: doc.id, ...doc.data() });
                            } else {
                                orderCacheById.set(linkedOrderId, null);
                            }
                        }
                        resolvedOrder = orderCacheById.get(linkedOrderId);
                    } catch (e) {
                        console.warn('Falha ao carregar OP vinculada ao plano', plan.id, linkedOrderId, e);
                    }
                }

                if (!resolvedOrder && partCode) {
                    if (!orderCacheByPartCode.has(partCode)) {
                        try {
                            const ordersSnapshot = await db.collection('production_orders')
                                .where('part_code', '==', partCode)
                                .get();

                            const orders = ordersSnapshot.docs
                                .map(doc => ({ id: doc.id, ...doc.data() }))
                                .sort((a, b) => {
                                    // Ordenar da mais antiga para a mais recente para priorizar a OP antiga
                                    const aTs = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?._seconds ? a.createdAt._seconds * 1000 : 0);
                                    const bTs = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?._seconds ? b.createdAt._seconds * 1000 : 0);
                                    if (aTs && bTs && aTs !== bTs) return aTs - bTs; // mais antiga primeiro
                                    // Fallback por número da OP (numérico ascendente)
                                    const toNum = (v) => { const n = parseInt(String(v||'').replace(/\D/g,''), 10); return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY; };
                                    return toNum(a.order_number) - toNum(b.order_number);
                                });

                            orderCacheByPartCode.set(partCode, orders);
                        } catch (orderError) {
                            console.warn('Não foi possível recuperar OPs para o código', partCode, orderError);
                            orderCacheByPartCode.set(partCode, []);
                        }
                    }

                    const cachedOrders = orderCacheByPartCode.get(partCode) || [];
                    if (cachedOrders.length > 0) {
                        // Preferir OP ativa/andamento na mesma máquina do plano
                        const sameMachine = cachedOrders.filter(o => (o.machine_id || o.machine) === plan.machine);
                        const isOpen = (o) => !['concluida','cancelada','finalizada','encerrada'].includes(String(o.status||'').toLowerCase());
                        resolvedOrder = sameMachine.find(o => ['ativa','em_andamento'].includes(String(o.status||'').toLowerCase()))
                            || sameMachine.find(isOpen)
                            || cachedOrders.find(isOpen)
                            || cachedOrders[0];
                    }
                }

                if (resolvedOrder) {
                    const resolvedLotSize = Number(resolvedOrder.lot_size) || 0;
                    plan.order_lot_size = resolvedLotSize;
                    plan.order_id = resolvedOrder.id;
                    plan.order_number = resolvedOrder.order_number || resolvedOrder.order_number_original || resolvedOrder.id;

                    // Buscar produção acumulada da OP se ainda não calculada
                    if (!productionTotalsByOrderId.has(resolvedOrder.id)) {
                        try {
                            const prodSnapshot = await db.collection('production_entries')
                                .where('orderId', '==', resolvedOrder.id)
                                .get();

                            const totalProduced = prodSnapshot.docs.reduce((sum, doc) => {
                                const entry = doc.data();
                                return sum + (Number(entry.produzido || entry.quantity || 0) || 0);
                            }, 0);

                            productionTotalsByOrderId.set(resolvedOrder.id, totalProduced);
                        } catch (prodError) {
                            console.warn('Não foi possível recuperar lançamentos da OP', resolvedOrder.id, prodError);
                            productionTotalsByOrderId.set(resolvedOrder.id, 0);
                        }
                    }

                    const accumulated = productionTotalsByOrderId.get(resolvedOrder.id) || 0;
                    const resolvedOrderTotal = Number(resolvedOrder.total_produzido || resolvedOrder.totalProduced || 0);
                    const planAccumulated = Number(plan.total_produzido) || 0;
                    plan.total_produzido = resolvedOrderTotal > 0
                        ? resolvedOrderTotal
                        : (accumulated > 0 ? accumulated : planAccumulated);

                    console.log('[MachineCard][OP]', {
                        machine: plan.machine,
                        partCode,
                        orderId: resolvedOrder.id,
                        lotSize: plan.order_lot_size,
                        accumulated: plan.total_produzido
                    });
                } else {
                    // Caso não exista OP vinculada, manter total produzido local e sinalizar lot size zerado
                    plan.order_lot_size = Number(plan.lot_size) || 0;
                    if (!Number.isFinite(plan.total_produzido)) {
                        plan.total_produzido = 0;
                    }
                    console.warn('[MachineCard][OP] Nenhuma OP encontrada para o plano', plan.id, 'partCode:', partCode);
                }
            }

            const activePlans = plans.filter(isPlanActive);

            let productionEntries = [];
            let downtimeEntries = [];
            if (activePlans.length > 0) {
                const productionSnapshot = await db.collection('production_entries').where('data', '==', today).get();
                const planIdSet = new Set(activePlans.map(plan => plan.id));
                productionEntries = productionSnapshot.docs
                    .map(doc => ({ id: doc.id, ...doc.data() }))
                    .filter(entry => planIdSet.has(entry.planId));

                // Paradas do dia (inclui dia anterior para cobrir T3 após 00:00)
                const base = new Date(`${today}T12:00:00`);
                const prev = new Date(base); prev.setDate(prev.getDate() - 1);
                const prevStr = new Date(prev.getTime() - prev.getTimezoneOffset()*60000).toISOString().split('T')[0];
                const dtSnapshot = await db.collection('downtime_entries')
                    .where('date', 'in', [prevStr, today])
                    .get();
                const machineSet = new Set(activePlans.map(p => p.machine));
                downtimeEntries = dtSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
                    .filter(dt => machineSet.has(dt.machine));
            }

            renderMachineCards(activePlans, productionEntries, downtimeEntries);
        } catch (error) {
            console.error('Erro ao carregar máquinas: ', error);
            if (machineCardGrid) {
                machineCardGrid.innerHTML = '';
            }
            if (machineCardEmptyState) {
                machineCardEmptyState.textContent = 'Erro ao carregar máquinas. Tente novamente.';
                machineCardEmptyState.classList.remove('hidden');
                machineCardEmptyState.classList.add('text-red-100');
            }
            if (machineSelector) {
                machineSelector.innerHTML = '<option value="">Erro ao carregar máquinas</option>';
                machineSelector.machineData = {};
            }
        }
    }
    
    // Função para atualizar display do turno atual
    function updateCurrentShiftDisplay() {
        if (!currentShiftDisplay) return;
        
        const currentShift = getCurrentShift();
        currentShiftDisplay.textContent = `T${currentShift}`;
    }
    
    // Função para quando uma máquina é selecionada
    async function onMachineSelected(machine) {
        const previousMachine = selectedMachineData ? selectedMachineData.machine : null;
        const machineData = machineCardData[machine] || machineSelector?.machineData?.[machine];

        if (!machine || !machineData) {
            productionControlPanel.classList.add('hidden');
            selectedMachineData = null;
            setActiveMachineCard(null);
            resetProductionTimer();
            if (recentEntriesList) {
                recentEntriesList.innerHTML = '';
            }
            updateRecentEntriesEmptyMessage('Selecione uma máquina para visualizar os lançamentos.');
            setRecentEntriesState({ loading: false, empty: true });
            if (productMp) productMp.textContent = 'Matéria-prima não definida';
            return;
        }
        
        selectedMachineData = machineData;
        if (machineSelector) {
            machineSelector.value = machine;
        }
        setActiveMachineCard(machine);

        if (previousMachine !== selectedMachineData.machine) {
            resetProductionTimer();
        }
        
        // Atualizar informações da máquina
        if (machineIcon) machineIcon.textContent = machine;
        if (machineName) machineName.textContent = `Máquina ${machine}`;
        if (productName) productName.textContent = selectedMachineData.product || 'Produto não definido';
        if (productMp) {
            productMp.textContent = selectedMachineData.mp ? `MP: ${selectedMachineData.mp}` : 'Matéria-prima não definida';
        }
        if (shiftTarget) {
            // Mostrar dados da OP: executado acumulado vs quantidade total da OP
            // Usar APENAS lot_size, não planned_quantity (meta diária)
            const totalPlanned = selectedMachineData.order_lot_size || selectedMachineData.lot_size || 0;
            const totalExecuted = selectedMachineData.total_produzido || 0;
            
            if (!totalPlanned) {
                shiftTarget.textContent = `${totalExecuted.toLocaleString('pt-BR')} / N/A`;
                console.warn('Lot size não encontrado para máquina selecionada');
            } else {
                shiftTarget.textContent = `${totalExecuted.toLocaleString('pt-BR')} / ${totalPlanned.toLocaleString('pt-BR')}`;
            }
        }
        
        // Mostrar painel
        productionControlPanel.classList.remove('hidden');
        
        // Carregar dados
    await refreshLaunchCharts();
        await loadTodayStats();
        await loadRecentEntries(false);
        
        // Reset machine status (mas verificar se há parada ativa primeiro)
        machineStatus = 'running';
        updateMachineStatus();
        
        // Verificar se há parada ativa para esta máquina
        await checkActiveDowntimes();
    }
    
    // Função para carregar gráfico de produção por hora
    async function loadHourlyProductionChart() {
        if (!selectedMachineData || !hourlyProductionChart) return;

        currentActiveOrder = null;
        currentOrderProgress = { executed: 0, planned: 0, expected: 0 };

        try {
            const today = getProductionDateString();
            const productionSnapshot = await db.collection('production_entries')
                .where('data', '==', today)
                .where('planId', '==', selectedMachineData.id)
                .get();

            const hourlyData = {};
            for (let i = 7; i < 31; i++) {
                const hour = i >= 24 ? i - 24 : i;
                const hourStr = `${String(hour).padStart(2, '0')}:00`;
                hourlyData[hourStr] = { planned: 0, actual: 0 };
            }

            const partCode = selectedMachineData.product_cod || selectedMachineData.product_code;
            let matchedOrder = null;
            let lotSize = Number(selectedMachineData.planned_quantity) || 0;

            // Preferir a OP vinculada ao planejamento, se existir
            if (selectedMachineData.order_id) {
                try {
                    const doc = await db.collection('production_orders').doc(selectedMachineData.order_id).get();
                    if (doc.exists) {
                        matchedOrder = { id: doc.id, ...doc.data() };
                        const orderLotSize = Number(matchedOrder.lot_size);
                        if (Number.isFinite(orderLotSize) && orderLotSize > 0) {
                            lotSize = orderLotSize;
                        }
                    }
                } catch (e) {
                    console.warn('Falha ao recuperar OP vinculada ao plano:', e);
                }
            }

            // Fallback por código da peça, mantendo prioridade da mesma máquina
            if (!matchedOrder && partCode) {
                try {
                    const lotsSnapshot = await db.collection('production_orders')
                        .where('part_code', '==', String(partCode))
                        .get();

                    if (!lotsSnapshot.empty) {
                        const orderDocs = lotsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                        const toNum = (v) => { const n = parseInt(String(v||'').replace(/\D/g,''), 10); return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY; };
                        const isOpen = (o) => !['concluida','cancelada','finalizada','encerrada'].includes(String(o.status||'').toLowerCase());
                        const sameMachine = orderDocs.filter(o => (o.machine_id || o.machine) === selectedMachineData.machine);
                        matchedOrder = sameMachine.find(o => ['ativa','em_andamento'].includes(String(o.status||'').toLowerCase()))
                            || sameMachine.filter(isOpen).sort((a,b) => toNum(a.order_number) - toNum(b.order_number))[0]
                            || orderDocs.filter(isOpen).sort((a,b) => toNum(a.order_number) - toNum(b.order_number))[0]
                            || orderDocs.sort((a,b) => toNum(a.order_number) - toNum(b.order_number))[0];

                        if (matchedOrder) {
                            const orderLotSize = Number(matchedOrder.lot_size);
                            if (Number.isFinite(orderLotSize) && orderLotSize > 0) {
                                lotSize = orderLotSize;
                            }
                        }
                    }
                } catch (lotError) {
                    console.warn('Não foi possível recuperar informações da ordem vinculada:', lotError);
                }
            }

            // Usar META DIÁRIA (planned_quantity) para o gráfico "planejado" por hora
            const dailyTarget = Number(selectedMachineData.planned_quantity) || Number(selectedMachineData.daily_target) || 0;
            const hourlyTarget = HOURS_IN_PRODUCTION_DAY > 0 ? (dailyTarget / HOURS_IN_PRODUCTION_DAY) : 0;

            Object.keys(hourlyData).forEach(hour => {
                hourlyData[hour].planned = hourlyTarget;
            });

            productionSnapshot.forEach(doc => {
                const data = doc.data();
                const prodDate = resolveProductionDateTime(data);
                if (!prodDate) {
                    return;
                }
                const hour = `${String(prodDate.getHours()).padStart(2, '0')}:00`;
                if (!hourlyData[hour]) {
                    hourlyData[hour] = { planned: hourlyTarget, actual: 0 };
                }
                hourlyData[hour].actual += data.produzido || 0;
            });

            const totalExecuted = Object.values(hourlyData).reduce((sum, entry) => sum + (entry.actual || 0), 0);
            const hoursElapsed = getHoursElapsedInProductionDay(new Date());
            const expectedByNow = Math.min(dailyTarget, hoursElapsed * hourlyTarget);

            if (matchedOrder) {
                currentActiveOrder = { ...matchedOrder };
            }
            currentOrderProgress = {
                executed: totalExecuted,
                planned: dailyTarget,
                expected: expectedByNow
            };

            updateTimelineProgress(totalExecuted, dailyTarget, expectedByNow);

            if (hourlyChartInstance) {
                hourlyChartInstance.destroy();
                hourlyChartInstance = null;
            }

            const hours = Object.keys(hourlyData);
            const plannedData = hours.map(hour => Number(hourlyData[hour].planned || 0));
            const actualData = hours.map(hour => Number(hourlyData[hour].actual || 0));

            hourlyChartInstance = createHourlyProductionChart({
                canvas: hourlyProductionChart,
                labels: hours,
                executedPerHour: actualData,
                plannedPerHour: plannedData,
                highlightCurrentHour: true
            });

        } catch (error) {
            console.error('Erro ao carregar dados do gráfico: ', error);
        }
    }
    
    // Função para carregar estatísticas do dia (janela de produção 07:00 -> 07:00)
    async function loadTodayStats() {
        if (!selectedMachineData) return;
        
        try {
            const today = getProductionDateString();
            // Janela do dia de produção atual: [hoje 07:00, amanhã 07:00)
            const windowStart = combineDateAndTime(today, '07:00');
            const nextDay = new Date(windowStart);
            nextDay.setDate(nextDay.getDate() + 1);
            const tomorrow = nextDay.toISOString().split('T')[0];
            const windowEnd = combineDateAndTime(tomorrow, '07:00');
            
            // Buscar dados de produção
            const prodSnapshot = await db.collection('production_entries')
                .where('machine', '==', selectedMachineData.machine)
                .where('data', '==', today)
                .get();
            
            const productions = prodSnapshot.docs.map(doc => doc.data());
            
                        // Buscar paradas de hoje e de amanhã (duas consultas simples)
                        const [dtSnapToday, dtSnapTomorrow] = await Promise.all([
                                db.collection('downtime_entries')
                                    .where('machine', '==', selectedMachineData.machine)
                                    .where('date', '==', today)
                                    .get(),
                                db.collection('downtime_entries')
                                    .where('machine', '==', selectedMachineData.machine)
                                    .where('date', '==', tomorrow)
                                    .get()
                        ]);
                        const downtimes = [...dtSnapToday.docs, ...dtSnapTomorrow.docs].map(doc => doc.data());
            
            // Calcular totais
            const totalProduced = productions.reduce((sum, prod) => sum + (prod.produzido || 0), 0);
            const totalLosses = productions.reduce((sum, prod) => sum + (prod.refugo_kg || 0), 0);
            
            // Somar apenas a interseção com a janela de produção (evita inflar com 00:00-07:00 que pertence ao dia anterior)
            let totalDowntime = 0;
            downtimes.forEach(dt => {
                const start = combineDateAndTime(dt.date, dt.startTime);
                const end = combineDateAndTime(dt.date, dt.endTime);
                if (!(start instanceof Date) || Number.isNaN(start.getTime())) return;
                if (!(end instanceof Date) || Number.isNaN(end.getTime())) return;
                // Overlap com [windowStart, windowEnd)
                const overlapStart = start > windowStart ? start : windowStart;
                const overlapEnd = end < windowEnd ? end : windowEnd;
                if (overlapEnd > overlapStart) {
                    totalDowntime += Math.round((overlapEnd - overlapStart) / 60000);
                }
            });
            
            // Calcular eficiência
            const target = Number(selectedMachineData.order_lot_size || selectedMachineData.lot_size || selectedMachineData.planned_quantity || 0);
            const efficiency = target > 0 ? (totalProduced / target * 100) : 0;
            
            // Atualizar displays
            if (producedToday) producedToday.textContent = totalProduced.toLocaleString('pt-BR');
            if (efficiencyToday) efficiencyToday.textContent = `${efficiency.toFixed(1)}%`;
            if (lossesToday) lossesToday.textContent = totalLosses.toFixed(2);
            if (downtimeToday) downtimeToday.textContent = totalDowntime;

            const shiftReference = new Date();
            const shiftStart = getShiftStartDateTime(shiftReference);
            const activeDowntime = (machineStatus === 'stopped' && currentDowntimeStart && currentDowntimeStart.machine === selectedMachineData.machine)
                ? currentDowntimeStart
                : null;

            if (shiftStart) {
                const runtimeSeconds = calculateProductionRuntimeSeconds({
                    shiftStart,
                    now: shiftReference,
                    downtimes,
                    activeDowntime
                });
                synchronizeProductionTimer(runtimeSeconds, machineStatus === 'running');
            } else {
                resetProductionTimer();
            }
            
        } catch (error) {
            console.error("Erro ao carregar estatísticas: ", error);
        }
    }



    // --- ABA DE ANÁLISE: RESUMO ---
    async function loadResumoData(showLoading = true) {
        const date = resumoDateSelector ? resumoDateSelector.value : getProductionDateString();
        if (!date) return;

        if (showLoading) showLoadingState('resumo', true);

        try {
            const planSnapshot = await db.collection('planning').where('date', '==', date).get();
            const plans = planSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            if (plans.length === 0) {
                showLoadingState('resumo', false, true);
                return;
            }
            
            const productionSnapshot = await db.collection('production_entries').where('data', '==', date).get();
            const productions = productionSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            const downtimeSnapshot = await db.collection('downtime_entries').where('date', '==', date).get();
            const downtimes = downtimeSnapshot.docs.map(doc => doc.data());

            currentReportData = processResumoData(plans, productions, downtimes);
            
            const currentView = reportQuantBtn && reportQuantBtn.classList.contains('active') ? 'quant' : 'effic';
            switchReportView(currentView);

            showLoadingState('resumo', false, false);

        } catch (error) {
            console.error("Erro ao carregar dados de resumo: ", error);
            showLoadingState('resumo', false, true);
        }
    }
    
    function processResumoData(plans, productions, downtimes) {
        return plans.map(plan => {
            const data = { ...plan, T1: {}, T2: {}, T3: {} };
            const turnos = ['T1', 'T2', 'T3'];

            turnos.forEach(turno => {
                const entries = productions.filter(p => p.planId === plan.id && p.turno === turno);
                const produzido = entries.reduce((sum, item) => sum + item.produzido, 0);
                
                const machineDowntimes = downtimes.filter(d => d.machine === plan.machine);
                const totalParadas = machineDowntimes.reduce((sum, item) => {
                    const start = new Date(`${item.date}T${item.startTime}`);
                    const end = new Date(`${item.date}T${item.endTime}`);
                    return sum + (end > start ? Math.round((end - start) / 60000) : 0);
                }, 0);

                const refugo_kg = entries.reduce((sum, item) => sum + item.refugo_kg, 0);
                const refugo_pcs = plan.piece_weight > 0 ? Math.round((refugo_kg * 1000) / plan.piece_weight) : 0;
                
                const ciclo_real = plan[`real_cycle_${turno.toLowerCase()}`] || plan.budgeted_cycle;
                const cav_ativas = plan[`active_cavities_${turno.toLowerCase()}`] || plan.mold_cavities;
                
                const oee = calculateShiftOEE(produzido, totalParadas / 3, refugo_pcs, ciclo_real, cav_ativas);

                data[turno] = { produzido, paradas: totalParadas, refugo_kg, refugo_pcs, ...oee };
                
                // Salvar histórico de OEE para este turno
                const dateStr = resumoDateSelector ? resumoDateSelector.value : getProductionDateString();
                saveOeeHistory(plan.machine, turno, dateStr, oee);
            });
            
            data.total_produzido = (data.T1.produzido || 0) + (data.T2.produzido || 0) + (data.T3.produzido || 0);
            return data;
        });
    }
    
    function calculateShiftOEE(produzido, tempoParadaMin, refugoPcs, cicloReal, cavAtivas) {
        const tempoTurnoMin = 480;
        
        const tempoProgramado = tempoTurnoMin;
        const tempoProduzindo = Math.max(0, tempoProgramado - Math.max(0, tempoParadaMin));
        const disponibilidade = tempoProgramado > 0 ? (tempoProduzindo / tempoProgramado) : 0;

        const producaoTeorica = cicloReal > 0 && cavAtivas > 0 ? (tempoProduzindo * 60 / cicloReal) * cavAtivas : 0;
        const performance = producaoTeorica > 0 ? Math.min(1, produzido / producaoTeorica) : (produzido > 0 ? 1 : 0);
        
        const totalProduzido = Math.max(0, produzido) + Math.max(0, refugoPcs);
        const qualidade = totalProduzido > 0 ? (Math.max(0, produzido) / totalProduzido) : (produzido > 0 ? 1 : 0);
        
        const oee = disponibilidade * performance * qualidade;

        const result = {
            disponibilidade: isNaN(disponibilidade) || !isFinite(disponibilidade) ? 0 : Math.max(0, Math.min(1, disponibilidade)),
            performance: isNaN(performance) || !isFinite(performance) ? 0 : Math.max(0, Math.min(1, performance)),
            qualidade: isNaN(qualidade) || !isFinite(qualidade) ? 0 : Math.max(0, Math.min(1, qualidade)),
            oee: isNaN(oee) || !isFinite(oee) ? 0 : Math.max(0, Math.min(1, oee))
        };

        console.log('[TRACE][calculateShiftOEE]', {
            inputs: { produzido, tempoParadaMin, refugoPcs, cicloReal, cavAtivas },
            calculations: { tempoProgramado, tempoProduzindo, producaoTeorica, totalProduzido },
            result
        });

        return result;
    }

    // --- FUNÇÕES PARA OEE EM TEMPO REAL ---
    
    // Função para calcular OEE em tempo real baseado nos dados atuais
    function calculateRealTimeOEE(data) {
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        
        // Determinar turno atual
        let currentShift;
        if (currentHour >= 7 && currentHour < 15) {
            currentShift = 'T1';
        } else if (currentHour >= 15 && currentHour < 23) {
            currentShift = 'T2';
        } else {
            currentShift = 'T3';
        }
        
        // Calcular tempo decorrido no turno atual
        let tempoDecorridoMin;
        if (currentShift === 'T1') {
            tempoDecorridoMin = (currentHour - 7) * 60 + currentMinute;
        } else if (currentShift === 'T2') {
            tempoDecorridoMin = (currentHour - 15) * 60 + currentMinute;
        } else { // T3
            if (currentHour >= 23) {
                tempoDecorridoMin = (currentHour - 23) * 60 + currentMinute;
            } else {
                tempoDecorridoMin = (currentHour + 1) * 60 + currentMinute; // Para horas 0-6
            }
        }
        
        // Limitar o tempo decorrido ao máximo do turno
        tempoDecorridoMin = Math.min(tempoDecorridoMin, 480);
        
        const oeeByShift = {};
        const oeeByMachine = {};
        
        // Agrupar dados por máquina e turno
        const groupedData = {};
        data.forEach(item => {
            const key = `${item.machine}_${item.turno}`;
            if (!groupedData[key]) {
                groupedData[key] = {
                    machine: item.machine,
                    turno: item.turno,
                    produzido: 0,
                    paradas: 0,
                    refugo_pcs: 0,
                    ciclo_real: item.real_cycle_t1 || item.real_cycle_t2 || item.real_cycle_t3 || item.budgeted_cycle,
                    cav_ativas: item.active_cavities_t1 || item.active_cavities_t2 || item.active_cavities_t3 || item.mold_cavities
                };
            }
            
            groupedData[key].produzido += item.produzido || 0;
            groupedData[key].paradas += item.duracao_min || 0;
            
            if (item.piece_weight > 0) {
                groupedData[key].refugo_pcs += Math.round(((item.refugo_kg || 0) * 1000) / item.piece_weight);
            }
        });
        
        // Calcular OEE para cada grupo
        Object.values(groupedData).forEach(group => {
            const tempoParadaMin = group.paradas;
            const oeeCalc = calculateShiftOEE(
                group.produzido,
                tempoParadaMin,
                group.refugo_pcs,
                group.ciclo_real,
                group.cav_ativas
            );
            
            // Ajustar cálculo para tempo real se for o turno atual
            if (group.turno === currentShift) {
                const tempoProgramadoReal = tempoDecorridoMin;
                const tempoProduzindoReal = Math.max(0, tempoProgramadoReal - tempoParadaMin);
                const disponibilidadeReal = tempoProgramadoReal > 0 ? (tempoProduzindoReal / tempoProgramadoReal) : 0;
                
                const producaoTeoricaReal = group.ciclo_real > 0 && group.cav_ativas > 0 ? 
                    (tempoProduzindoReal * 60 / group.ciclo_real) * group.cav_ativas : 0;
                const performanceReal = producaoTeoricaReal > 0 ? (group.produzido / producaoTeoricaReal) : 0;
                
                const totalProduzidoReal = group.produzido + group.refugo_pcs;
                const qualidadeReal = totalProduzidoReal > 0 ? (group.produzido / totalProduzidoReal) : 0;
                
                const oeeReal = disponibilidadeReal * performanceReal * qualidadeReal;
                
                oeeCalc.disponibilidade = isNaN(disponibilidadeReal) || !isFinite(disponibilidadeReal) ? 0 : disponibilidadeReal;
                oeeCalc.performance = isNaN(performanceReal) || !isFinite(performanceReal) ? 0 : performanceReal;
                oeeCalc.qualidade = isNaN(qualidadeReal) || !isFinite(qualidadeReal) ? 0 : qualidadeReal;
                oeeCalc.oee = isNaN(oeeReal) || !isFinite(oeeReal) ? 0 : oeeReal;
                oeeCalc.isRealTime = true;
                oeeCalc.tempoDecorrido = tempoDecorridoMin;
            }
            
            // Armazenar por turno
            if (!oeeByShift[group.turno]) {
                oeeByShift[group.turno] = [];
            }
            oeeByShift[group.turno].push({
                machine: group.machine,
                ...oeeCalc
            });
            
            // Armazenar por máquina
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
    
    // Função para salvar histórico de OEE
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
            
            // Usar ID único baseado em máquina, turno e data para evitar duplicatas
            const docId = `${machine}_${turno}_${data}`;
            await db.collection('oee_history').doc(docId).set(historyEntry, { merge: true });
            
        } catch (error) {
            console.error("Erro ao salvar histórico de OEE: ", error);
        }
    }
    
    // Função para carregar histórico de OEE
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
    
    // Função para agrupar OEE por períodos (hora, dia, semana)
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
            
            // Agrupar por máquina
            if (!grouped[key].machines[entry.machine]) {
                grouped[key].machines[entry.machine] = {
                    disponibilidade: [],
                    performance: [],
                    qualidade: [],
                    oee: []
                };
            }
            
            // Agrupar por turno
            if (!grouped[key].shifts[entry.turno]) {
                grouped[key].shifts[entry.turno] = {
                    disponibilidade: [],
                    performance: [],
                    qualidade: [],
                    oee: []
                };
            }
            
            // Adicionar valores
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
            
            // Médias por máquina
            Object.values(group.machines).forEach(machine => {
                machine.avgDisponibilidade = calculateAverage(machine.disponibilidade);
                machine.avgPerformance = calculateAverage(machine.performance);
                machine.avgQualidade = calculateAverage(machine.qualidade);
                machine.avgOee = calculateAverage(machine.oee);
            });
            
            // Médias por turno
            Object.values(group.shifts).forEach(shift => {
                shift.avgDisponibilidade = calculateAverage(shift.disponibilidade);
                shift.avgPerformance = calculateAverage(shift.performance);
                shift.avgQualidade = calculateAverage(shift.qualidade);
                shift.avgOee = calculateAverage(shift.oee);
            });
            
            // Médias gerais
            group.overall.avgDisponibilidade = calculateAverage(group.overall.disponibilidade);
            group.overall.avgPerformance = calculateAverage(group.overall.performance);
            group.overall.avgQualidade = calculateAverage(group.overall.qualidade);
            group.overall.avgOee = calculateAverage(group.overall.oee);
        });
        
        return grouped;
    }

    function switchReportView(view) {
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
        if (!resumoContentContainer) return;
        
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
                        const faltante = (item.planned_quantity || 0) - item.total_produzido;
                        return `
                        <tr>
                            <td class="px-2 py-2 whitespace-nowrap">${item.machine}</td><td class="px-2 py-2 whitespace-nowrap">${item.product}</td>
                            <td class="px-2 py-2 text-center">${(item.T1.produzido || 0).toLocaleString('pt-BR')}</td><td class="px-2 py-2 text-center">${(item.T1.refugo_kg || 0).toFixed(2)}</td>
                            <td class="px-2 py-2 text-center border-l">${(item.T2.produzido || 0).toLocaleString('pt-BR')}</td><td class="px-2 py-2 text-center">${(item.T2.refugo_kg || 0).toFixed(2)}</td>
                            <td class="px-2 py-2 text-center border-l">${(item.T3.produzido || 0).toLocaleString('pt-BR')}</td><td class="px-2 py-2 text-center">${(item.T3.refugo_kg || 0).toFixed(2)}</td>
                            <td class="px-2 py-2 text-center border-l">${(item.planned_quantity || 0).toLocaleString('pt-BR')}</td>
                            <td class="px-2 py-2 text-center font-bold border-l">${item.total_produzido.toLocaleString('pt-BR')}</td>
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
        if (!resumoContentContainer) return;
        
        const formatPercent = (val, isRealTime = false) => {
            const colorClass = val < 0.7 ? 'text-status-error' : val < 0.85 ? 'text-status-warning' : 'text-status-success';
            const realtimeIndicator = isRealTime ? ' ⚡' : '';
            return `<span class="${colorClass}" title="${isRealTime ? 'OEE em Tempo Real' : 'OEE Calculado'}">${(val * 100).toFixed(1)}%${realtimeIndicator}</span>`;
        };
        
        const date = resumoDateSelector ? resumoDateSelector.value : getProductionDateString();
        const today = getProductionDateString();
        const isToday = date === today;
        
        // Se for hoje, calcular OEE em tempo real para cada item
        let realTimeData = {};
        if (isToday) {
            data.forEach(async (item) => {
                const combinedData = [{
                    machine: item.machine,
                    turno: 'T1',
                    produzido: item.T1.produzido || 0,
                    duracao_min: item.T1.paradas || 0,
                    refugo_kg: item.T1.refugo_kg || 0,
                    piece_weight: item.piece_weight,
                    real_cycle_t1: item.real_cycle_t1,
                    active_cavities_t1: item.active_cavities_t1,
                    budgeted_cycle: item.budgeted_cycle,
                    mold_cavities: item.mold_cavities
                }];
                
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
                    <span class="text-status-success">● ≥85% - Excelente</span>
                    <span class="text-status-warning">● 70-84% - Aceitável</span>
                    <span class="text-status-error">● <70% - Crítico</span>
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
                        // Calcular OEE médio
                        const oeeValues = [item.T1.oee, item.T2.oee, item.T3.oee].filter(v => v > 0);
                        const avgOee = oeeValues.length > 0 ? oeeValues.reduce((a, b) => a + b, 0) / oeeValues.length : 0;
                        
                        // Verificar se há dados em tempo real para esta máquina
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

    // --- ABA DE ANÁLISE: DASHBOARD ---
    
    async function loadDashboardData() {
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
            
            for (let i = 0; i < planIds.length; i += 10) {
                const batchIds = planIds.slice(i, i + 10);
                if (batchIds.length > 0) {
                    const planBatchSnapshot = await db.collection('planning').where(firebase.firestore.FieldPath.documentId(), 'in', batchIds).get();
                    planBatchSnapshot.docs.forEach(doc => {
                        plans[doc.id] = doc.data();
                    });
                }
            }
            
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

    function processAndRenderDashboard({ perdas }) {
        const mainFilterMachine = machineFilter ? machineFilter.value : 'total';
        const graphFilterMachine = graphMachineFilter ? graphMachineFilter.value : null;

        const filteredDataForKpis = mainFilterMachine === 'total' ? perdas : perdas.filter(p => p.machine === mainFilterMachine);
        const filteredDataForGraphs = graphFilterMachine ? perdas.filter(p => p.machine === graphFilterMachine && p.data >= startDateSelector.value && p.data <= endDateSelector.value) : [];
        
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
            if (hourA >= 7 && hourB < 7) return -1;
            if (hourA < 7 && hourB >= 7) return 1;
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
        const viewingToday = (endDateSelector.value === todayString && startDateSelector.value === todayString);

        if (viewingToday) {
            const currentHour = new Date().getHours();
            let currentHourIndex = sortedHours.findIndex(h => parseInt(h.split(':')[0]) === currentHour);
            
            if (currentHourIndex === -1 && currentHour < 7) {
                currentHourIndex = 17 + currentHour;
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
        
        if (oeeTrendChartInstance) oeeTrendChartInstance.destroy();
        
        if (!selectedMachine || selectedMachine === 'total') {
            return;
        }
        
        try {
            // Carregar histórico de OEE dos últimos 7 dias
            const endDate = endDateSelector.value;
            const startDateObj = new Date(endDate);
            startDateObj.setDate(startDateObj.getDate() - 6);
            const startDate = startDateObj.toISOString().split('T')[0];
            
            const oeeHistory = await loadOeeHistory(startDate, endDate, selectedMachine);
            
            if (oeeHistory.length === 0) {
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
        const machines = [...new Set(data.map(item => item.machine))].sort();
        const mainOptions = '<option value="total">Visão Geral (Total)</option>' + machines.map(m => `<option value="${m}">${m}</option>`).join('');
        const graphOptions = '<option value="">Selecione...</option>' + machines.map(m => `<option value="${m}">${m}</option>`).join('');
        if (machineFilter) machineFilter.innerHTML = mainOptions;
        if (graphMachineFilter) graphMachineFilter.innerHTML = graphOptions;
    }

    init();
    // Função para popular opções dos formulários rápidos
    function populateQuickFormOptions() {
        // Popular motivos de perda
        const lossReasonSelect = document.getElementById('quick-losses-reason');
        if (lossReasonSelect) {
            lossReasonSelect.innerHTML = '<option value="">Selecione o motivo...</option>';
            
            // Grupo PROCESSO
            const processoGroup = document.createElement('optgroup');
            processoGroup.label = 'PROCESSO';
            ["BOLHA", "CHUPAGEM", "CONTAMINAÇÃO", "DEGRADAÇÃO", "EMPENAMENTO", "FALHA", 
             "FIAPO", "FORA DE COR", "INÍCIO/REÍNICIO", "JUNÇÃO", "MANCHAS", 
             "MEDIDA FORA DO ESPECIFICADO", "MOÍDO", "PEÇAS PERDIDAS", "QUEIMA", "REBARBA"].forEach(reason => {
                const option = document.createElement('option');
                option.value = reason;
                option.textContent = reason;
                processoGroup.appendChild(option);
            });
            lossReasonSelect.appendChild(processoGroup);
            
            // Grupo FERRAMENTARIA
            const ferramentariaGroup = document.createElement('optgroup');
            ferramentariaGroup.label = 'FERRAMENTARIA';
            ["DEFORMAÇÃO", "GALHO PRESO", "MARCA D'ÁGUA", "MARCA EXTRATOR", "RISCOS", "SUJIDADE"].forEach(reason => {
                const option = document.createElement('option');
                option.value = reason;
                option.textContent = reason;
                ferramentariaGroup.appendChild(option);
            });
            lossReasonSelect.appendChild(ferramentariaGroup);
            
            // Grupo QUALIDADE
            const qualidadeGroup = document.createElement('optgroup');
            qualidadeGroup.label = 'QUALIDADE';
            const option = document.createElement('option');
            option.value = "INSPEÇÃO DE LINHA";
            option.textContent = "INSPEÇÃO DE LINHA";
            qualidadeGroup.appendChild(option);
            lossReasonSelect.appendChild(qualidadeGroup);
        }
        
        // Popular motivos de parada
        const downtimeReasonSelect = document.getElementById('quick-downtime-reason');
        if (downtimeReasonSelect) {
            downtimeReasonSelect.innerHTML = '<option value="">Selecione o motivo...</option>';
            
            const downtimeReasons = {
                'FERRAMENTARIA': ["CORRETIVA DE MOLDE", "PREVENTIVA DE MOLDE", "TROCA DE VERSÃO"],
                'PROCESSO': ["ABERTURA DE CAVIDADE", "AJUSTE DE PROCESSO", "TRY OUT"],
                'COMPRAS': ["FALTA DE INSUMO PLANEJADA", "FALTA DE INSUMO NÃO PLANEJADA"],
                'PREPARAÇÃO': ["AGUARDANDO PREPARAÇÃO DE MATERIAL"],
                'QUALIDADE': ["AGUARDANDO CLIENTE/FORNECEDOR", "LIBERAÇÃO"],
                'MANUTENÇÃO': ["MANUTENÇÃO CORRETIVA", "MANUTENÇÃO PREVENTIVA"],
                'PRODUÇÃO': ["FALTA DE OPERADOR", "TROCA DE COR"],
                'SETUP': ["INSTALAÇÃO DE MOLDE", "RETIRADA DE MOLDE"],
                'ADMINISTRATIVO': ["FALTA DE ENERGIA"],
                'PCP': ["SEM PROGRAMAÇÃO"],
                'COMERCIAL': ["SEM PEDIDO"]
            };
            
            Object.entries(downtimeReasons).forEach(([groupName, reasons]) => {
                const group = document.createElement('optgroup');
                group.label = groupName;
                reasons.forEach(reason => {
                    const option = document.createElement('option');
                    option.value = reason;
                    option.textContent = reason;
                    group.appendChild(option);
                });
                downtimeReasonSelect.appendChild(group);
            });
        }
    }

    // Função para popular o seletor de máquinas da aba de lançamento
    function populateLaunchMachineSelector() {
        const launchMachineSelector = document.getElementById('machine-selector');
        if (launchMachineSelector) {
            console.log('🔧 Populando seletor de máquinas da aba de lançamento');
            
            launchMachineSelector.innerHTML = '<option value="">Selecione uma máquina...</option>';
            
            machineDatabase.forEach(machine => {
                const option = document.createElement('option');
                const mid = normalizeMachineId(machine.id);
                option.value = mid;
                option.textContent = `${mid} - ${machine.model}`;
                launchMachineSelector.appendChild(option);
            });
            
            console.log('✅ Seletor de máquinas populado com', machineDatabase.length, 'máquinas');
        } else {
            console.log('❌ Elemento machine-selector não encontrado');
        }
    }

    // Função para popular o modal de BORRA com máquinas e motivos do database.js
    function populateBorraModal() {
        // Popular máquinas no modal de BORRA
        const borraMachineSelect = document.getElementById('manual-borra-machine');
        if (borraMachineSelect) {
            borraMachineSelect.innerHTML = '<option value="">Selecione...</option>';
            machineDatabase.forEach(machine => {
                const option = document.createElement('option');
                const mid = normalizeMachineId(machine.id);
                option.value = mid;
                option.textContent = `${mid} - ${machine.model}`;
                borraMachineSelect.appendChild(option);
            });
            console.log('✅ Máquinas do modal de BORRA populadas');
        }

        // Popular motivos no modal de BORRA usando database.js
        const borraReasonSelect = document.getElementById('manual-borra-reason');
        if (borraReasonSelect) {
            borraReasonSelect.innerHTML = '<option value="">Selecione o motivo...</option>';
            
            const groupedReasons = getGroupedLossReasons();
            Object.entries(groupedReasons).forEach(([groupName, reasons]) => {
                const group = document.createElement('optgroup');
                group.label = groupName;
                reasons.forEach(reason => {
                    const option = document.createElement('option');
                    option.value = reason;
                    option.textContent = reason;
                    group.appendChild(option);
                });
                borraReasonSelect.appendChild(group);
            });
            console.log('✅ Motivos do modal de BORRA populados via database.js');
        }
    }

});
