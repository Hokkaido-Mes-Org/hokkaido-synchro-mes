/**
 * HokkaidoMES — Ordens de Produção Controller (Módulo ES6)
 * Fase 3B: Migração completa do controlador de Ordens (Region 1)
 *
 * Escopo: Página administrativa de Ordens de Produção
 *   - Listagem (cards + tabela), KPIs, filtros, busca
 *   - CRUD de ordens (criar, editar, ativar, finalizar, suspender, retomar, reativar)
 *   - Rastreabilidade de lançamentos por OP
 *   - Recálculo de totais
 *   - Modal de criação/edição de ordens
 *
 * Funções migradas: 25 (Region 1: L14654–15839)
 * Funções window.*: 16 exposições para onclick handlers no HTML
 *
 * NÃO inclui Region 2 (setupProductionOrdersTab / aba operador)
 * pois é inicializada em app startup (L4548), fora do gate de Ordens.
 *
 * Flag: USE_MODULAR_ORDERS
 */

import { getDb } from '../services/firebase-client.js';
import { escapeHtml, normalizeMachineId, debounce } from '../utils/dom.utils.js';
import { showNotification } from '../components/notification.js';
import { registrarLogSistema } from '../utils/logger.js';
import { getActiveUser } from '../utils/auth.utils.js';

// ─── State ───────────────────────────────────────────────────────────
let ordersCache = [];

// ─── Helpers ─────────────────────────────────────────────────────────
function db() {
    return getDb();
}

/**
 * Obtém ordens de produção do cache ou Firebase via função global.
 * Delega para window.getProductionOrdersCached (definida no script.js)
 * para reutilizar a cadeia de cache: memory → DataStore → CacheManager → Firebase.
 */
async function getProductionOrdersCached(forceRefresh = false) {
    if (typeof window.getProductionOrdersCached === 'function') {
        return window.getProductionOrdersCached(forceRefresh);
    }
    // Fallback direto ao Firebase se a função global não estiver disponível
    const snapshot = await db().collection('production_orders').orderBy('createdAt', 'desc').limit(500).get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// ─── Funções Principais ──────────────────────────────────────────────

/**
 * Busca ordens com filtros server-side (status, máquina) + client-side (texto).
 * Otimização: Não carrega todas as ordens ao abrir a aba — só quando o
 * utilizador clica "Buscar" (padrão search-first como aba Relatórios).
 */
async function searchProductionOrders() {
    console.log('[Ordens·mod] Buscando ordens com filtros...');
    
    const countEl = document.getElementById('orders-count');
    const searchInput = document.getElementById('orders-search');
    const statusFilter = document.getElementById('orders-status-filter');
    const machineFilter = document.getElementById('orders-machine-filter');
    const sortFilter = document.getElementById('orders-sort-filter');
    const emptyState = document.getElementById('orders-empty-state');
    const grid = document.getElementById('orders-grid');
    const tableContainer = document.getElementById('orders-table-container');
    const buscarBtn = document.getElementById('orders-btn-buscar');
    
    // UI loading
    if (buscarBtn) {
        buscarBtn.disabled = true;
        buscarBtn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Buscando...';
    }
    if (countEl) countEl.textContent = 'Buscando...';
    
    const statusValue = (statusFilter?.value || '').toLowerCase();
    const machineValue = machineFilter?.value || '';
    const textQuery = (searchInput?.value || '').toLowerCase().trim();
    const sortValue = sortFilter?.value || 'recent';
    
    try {
        let query = db().collection('production_orders');
        
        // Filtro server-side: status (reduz docs lidos significativamente)
        if (statusValue) {
            if (statusValue === 'concluida') {
                // 'concluida' e 'finalizada' são tratados como sinônimos
                query = query.where('status', 'in', ['concluida', 'finalizada', 'Concluída', 'Finalizada']);
            } else {
                query = query.where('status', '==', statusValue);
            }
        }
        
        // Filtro server-side: máquina
        if (machineValue) {
            query = query.where('machine_id', '==', machineValue);
        }
        
        // Ordenação + limite
        // Nota: quando usamos 'in' ou '==' no status, podemos combinar com orderBy
        // apenas se houver índice composto. Usar orderBy simples como fallback seguro.
        if (!statusValue || statusValue !== 'concluida') {
            query = query.orderBy('createdAt', 'desc');
        }
        query = query.limit(200);
        
        const snapshot = await query.get();
        ordersCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        console.log(`[Ordens·mod] ${ordersCache.length} ordens carregadas (filtro: status=${statusValue || 'todos'}, maq=${machineValue || 'todas'})`);
        
        // Filtro client-side: texto (busca em campos textuais)
        let filtered = [...ordersCache];
        if (textQuery) {
            filtered = filtered.filter(o =>
                (o.order_number || '').toLowerCase().includes(textQuery) ||
                (o.product || '').toLowerCase().includes(textQuery) ||
                (o.part_code || '').toLowerCase().includes(textQuery) ||
                (o.customer || '').toLowerCase().includes(textQuery) ||
                (o.client || '').toLowerCase().includes(textQuery)
            );
        }
        
        // Ordenação client-side
        filtered.sort((a, b) => {
            const lotA = Number(a.lot_size) || 0;
            const lotB = Number(b.lot_size) || 0;
            const prodA = Number(a.total_produzido ?? a.totalProduced ?? a.total_produced) || 0;
            const prodB = Number(b.total_produzido ?? b.totalProduced ?? b.total_produced) || 0;
            const progressA = lotA > 0 ? (prodA / lotA) : 0;
            const progressB = lotB > 0 ? (prodB / lotB) : 0;
            switch (sortValue) {
                case 'recent':
                    return (b.createdAt?.toDate?.() || new Date(0)) - (a.createdAt?.toDate?.() || new Date(0));
                case 'progress-desc': return progressB - progressA;
                case 'progress-asc': return progressA - progressB;
                case 'lot-desc': return lotB - lotA;
                case 'alpha': return (a.order_number || '').localeCompare(b.order_number || '');
                default: return 0;
            }
        });
        
        // Esconder empty state, mostrar resultados
        if (emptyState) emptyState.classList.add('hidden');
        
        updateOrdersKPIs(filtered);
        renderOrders(filtered);
        
    } catch (error) {
        console.error('[Ordens·mod] Erro ao buscar:', error);
        if (countEl) countEl.textContent = 'Erro ao buscar ordens';
        
        // Se erro for de índice composto, tentar fallback sem orderBy
        if (error.code === 'failed-precondition' || (error.message && error.message.includes('index'))) {
            console.warn('[Ordens·mod] Tentando fallback sem orderBy...');
            try {
                let fallbackQuery = db().collection('production_orders');
                if (statusValue && statusValue !== 'concluida') {
                    fallbackQuery = fallbackQuery.where('status', '==', statusValue);
                }
                if (machineValue) {
                    fallbackQuery = fallbackQuery.where('machine_id', '==', machineValue);
                }
                fallbackQuery = fallbackQuery.limit(200);
                const snapshot = await fallbackQuery.get();
                ordersCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                
                // Ordenar client-side
                ordersCache.sort((a, b) => (b.createdAt?.toDate?.() || new Date(0)) - (a.createdAt?.toDate?.() || new Date(0)));
                
                let filtered = [...ordersCache];
                if (textQuery) {
                    filtered = filtered.filter(o =>
                        (o.order_number || '').toLowerCase().includes(textQuery) ||
                        (o.product || '').toLowerCase().includes(textQuery) ||
                        (o.part_code || '').toLowerCase().includes(textQuery) ||
                        (o.customer || '').toLowerCase().includes(textQuery)
                    );
                }
                
                if (emptyState) emptyState.classList.add('hidden');
                updateOrdersKPIs(filtered);
                renderOrders(filtered);
                if (countEl) countEl.textContent = `${filtered.length} ordens encontradas`;
            } catch (e2) {
                console.error('[Ordens·mod] Fallback também falhou:', e2);
            }
        }
    } finally {
        if (buscarBtn) {
            buscarBtn.disabled = false;
            buscarBtn.innerHTML = '<i data-lucide="search" class="w-4 h-4"></i> Buscar';
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
    }
}

/**
 * Carregamento legado (mantido para compatibilidade com chamadas pós-CRUD).
 * Agora delega para searchProductionOrders quando já inicializado,
 * ou faz carga mínima para popular caches internos.
 */
async function loadProductionOrders() {
    if (_ordensInitialized) {
        // Se já inicializado, usar search com filtros atuais
        return searchProductionOrders();
    }
    // Fallback legado: carga direta (usado por funções que chamam loadProductionOrders após CRUD)
    console.log('[Ordens·mod] Carregando ordens (fallback)...');
    try {
        ordersCache = await getProductionOrdersCached();
        updateOrdersKPIs(ordersCache);
        renderOrders(ordersCache);
    } catch (error) {
        console.error('[Ordens·mod] Erro ao carregar:', error);
    }
}

function updateOrdersKPIs(orders) {
    const total = orders.length;
    const active = orders.filter(o => ['ativa', 'em_andamento'].includes((o.status || '').toLowerCase())).length;
    const suspended = orders.filter(o => (o.status || '').toLowerCase() === 'suspensa').length;
    const completed = orders.filter(o => ['concluida', 'finalizada'].includes((o.status || '').toLowerCase())).length;

    let totalProducedAll = 0;
    let totalLossesAll = 0;
    orders.forEach(o => {
        const produced = Number(o.total_produzido ?? o.totalProduced ?? o.total_produced) || 0;
        const losses = Number(o.total_perdas ?? o.totalLosses ?? o.total_losses ?? o.refugo ?? o.scrap) || 0;
        totalProducedAll += produced;
        totalLossesAll += losses;
    });

    const kpiTotal = document.getElementById('orders-kpi-total');
    const kpiActive = document.getElementById('orders-kpi-active');
    const kpiSuspended = document.getElementById('orders-kpi-suspended');
    const kpiCompleted = document.getElementById('orders-kpi-completed');
    const kpiTotalProduced = document.getElementById('orders-kpi-total-produced');
    const kpiTotalLosses = document.getElementById('orders-kpi-total-losses');

    if (kpiTotal) kpiTotal.textContent = total;
    if (kpiActive) kpiActive.textContent = active;
    if (kpiSuspended) kpiSuspended.textContent = suspended;
    if (kpiCompleted) kpiCompleted.textContent = completed;
    if (kpiTotalProduced) kpiTotalProduced.textContent = totalProducedAll.toLocaleString('pt-BR');
    if (kpiTotalLosses) kpiTotalLosses.textContent = totalLossesAll.toLocaleString('pt-BR');
}

function renderOrders(orders) {
    const grid = document.getElementById('orders-grid');
    const tableBody = document.getElementById('orders-table-body');
    const emptyState = document.getElementById('orders-empty-state');
    const countEl = document.getElementById('orders-count');

    if (countEl) countEl.textContent = orders.length + ' ordem' + (orders.length !== 1 ? 's' : '') + ' encontrada' + (orders.length !== 1 ? 's' : '');

    if (orders.length === 0) {
        if (grid) grid.innerHTML = '';
        if (tableBody) tableBody.innerHTML = '';
        if (emptyState) emptyState.classList.remove('hidden');
        return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    if (grid) {
        grid.innerHTML = orders.map(order => renderOrderCard(order)).join('');
    }

    if (tableBody) {
        tableBody.innerHTML = orders.map(order => renderOrderTableRow(order)).join('');
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function renderOrderCard(order) {
    const status = (order.status || 'planejada').toLowerCase();
    const lotSize = Number(order.lot_size) || 0;
    const produced = Number(order.total_produzido ?? order.totalProduced ?? order.total_produced) || 0;
    const losses = Number(order.total_perdas ?? order.totalLosses ?? order.total_losses ?? order.refugo ?? order.scrap) || 0;
    const progress = lotSize > 0 ? Math.min((produced / lotSize) * 100, 100) : 0;

    const statusConfig = {
        'planejada': { bg: 'bg-slate-100', text: 'text-slate-700', label: 'Planejada', icon: 'calendar' },
        'ativa': { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Ativa', icon: 'zap' },
        'em_andamento': { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Em Andamento', icon: 'play-circle' },
        'suspensa': { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Suspensa', icon: 'pause-circle' },
        'concluida': { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Concluída', icon: 'check-circle-2' },
        'finalizada': { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Finalizada', icon: 'check-circle-2' },
        'cancelada': { bg: 'bg-red-100', text: 'text-red-700', label: 'Cancelada', icon: 'x-circle' }
    };

    const sc = statusConfig[status] || statusConfig['planejada'];
    const progressColor = progress >= 100 ? 'bg-emerald-500' : progress >= 50 ? 'bg-blue-500' : 'bg-amber-500';
    const isActive = ['ativa', 'em_andamento'].includes(status);
    const isSuspended = status === 'suspensa';
    const canActivate = status === 'planejada';
    const canReactivate = ['concluida', 'finalizada'].includes(status);
    const canSuspend = isActive;
    const canResume = isSuspended;
    const canFinalize = isActive;

    return '<div class="bg-white rounded-xl border ' + (isActive ? 'border-blue-300 ring-2 ring-blue-100' : isSuspended ? 'border-orange-300 ring-2 ring-orange-100' : 'border-gray-200') + ' shadow-sm hover:shadow-md transition-all overflow-hidden">' +
        '<div class="p-4 border-b border-gray-100 ' + (isActive ? 'bg-blue-50' : isSuspended ? 'bg-orange-50' : 'bg-gray-50') + '">' +
            '<div class="flex items-start justify-between gap-2">' +
                '<div class="flex-1 min-w-0">' +
                    '<h4 class="font-bold text-gray-800 truncate">OP ' + escapeHtml(order.order_number || '') + '</h4>' +
                    '<p class="text-sm text-gray-600 truncate">' + escapeHtml(order.product || order.part_code || 'Produto não definido') + '</p>' +
                '</div>' +
                '<span class="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ' + sc.bg + ' ' + sc.text + '">' +
                    '<i data-lucide="' + sc.icon + '" class="w-3 h-3"></i>' +
                    sc.label +
                '</span>' +
            '</div>' +
        '</div>' +
        '<div class="p-4 space-y-3">' +
            '<div class="grid grid-cols-2 gap-2 text-sm">' +
                '<div class="flex items-center gap-2 text-gray-600">' +
                    '<i data-lucide="user" class="w-4 h-4 text-gray-400"></i>' +
                    '<span class="truncate">' + escapeHtml(order.customer || 'N/A') + '</span>' +
                '</div>' +
                '<div class="flex items-center gap-2 text-gray-600">' +
                    '<i data-lucide="settings" class="w-4 h-4 text-gray-400"></i>' +
                    '<span class="truncate">' + escapeHtml(order.machine_id || 'N/A') + '</span>' +
                '</div>' +
            '</div>' +
            '<div class="bg-gray-50 rounded-lg p-3">' +
                '<div class="flex items-center justify-between text-xs text-gray-500 mb-1">' +
                    '<span>Progresso</span>' +
                    '<span class="font-semibold">' + Math.round(progress) + '%</span>' +
                '</div>' +
                '<div class="w-full bg-gray-200 rounded-full h-2">' +
                    '<div class="' + progressColor + ' h-2 rounded-full transition-all" style="width: ' + progress + '%"></div>' +
                '</div>' +
                '<div class="grid grid-cols-3 text-xs text-gray-500 mt-2">' +
                    '<span class="text-center"><span class="font-semibold text-green-600">' + produced.toLocaleString('pt-BR') + '</span><br>Produzido</span>' +
                    '<span class="text-center"><span class="font-semibold text-blue-600">' + lotSize.toLocaleString('pt-BR') + '</span><br>Planejado</span>' +
                    '<span class="text-center"><span class="font-semibold text-red-600">' + losses.toLocaleString('pt-BR') + '</span><br>Perdas</span>' +
                '</div>' +
            '</div>' +
        '</div>' +
        '<div class="px-4 pb-4 grid grid-cols-2 gap-2">' +
            (canActivate ? '<button onclick="activateOrder(\'' + order.id + '\', \'' + (order.machine_id || '') + '\')" class="flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition"><i data-lucide="play" class="w-4 h-4"></i>Ativar</button>' : '') +
            (canFinalize ? '<button onclick="finalizeOrder(\'' + order.id + '\')" class="flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition"><i data-lucide="check-circle-2" class="w-4 h-4"></i>Finalizar</button>' : '') +
            (canSuspend ? '<button onclick="suspendOrder(\'' + order.id + '\')" class="flex items-center justify-center gap-1.5 px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition"><i data-lucide="pause" class="w-4 h-4"></i>Suspender</button>' : '') +
            (canResume ? '<button onclick="resumeOrder(\'' + order.id + '\')" class="flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition"><i data-lucide="play" class="w-4 h-4"></i>Retomar</button>' : '') +
            (canReactivate ? '<button onclick="reactivateOrder(\'' + order.id + '\')" class="flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition"><i data-lucide="rotate-ccw" class="w-4 h-4"></i>Reativar</button>' : '') +
            '<button onclick="openOrderTraceability(\'' + order.id + '\')" class="flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition"><i data-lucide="file-search" class="w-4 h-4"></i>Rastrear</button>' +
            '<button onclick="editOrder(\'' + order.id + '\')" class="flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition"><i data-lucide="edit-3" class="w-4 h-4"></i>Editar</button>' +
        '</div>' +
    '</div>';
}

function renderOrderTableRow(order) {
    const status = (order.status || 'planejada').toLowerCase();
    const lotSize = Number(order.lot_size) || 0;
    const produced = Number(order.total_produzido ?? order.totalProduced ?? order.total_produced) || 0;
    const losses = Number(order.total_perdas ?? order.totalLosses ?? order.total_losses ?? order.refugo ?? order.scrap) || 0;
    const progress = lotSize > 0 ? Math.min((produced / lotSize) * 100, 100) : 0;

    const statusBadge = {
        'planejada': '<span class="px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">Planejada</span>',
        'ativa': '<span class="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">Ativa</span>',
        'em_andamento': '<span class="px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">Em Andamento</span>',
        'suspensa': '<span class="px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">Suspensa</span>',
        'concluida': '<span class="px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">Concluída</span>',
        'finalizada': '<span class="px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">Finalizada</span>',
        'cancelada': '<span class="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">Cancelada</span>'
    };

    const isActive = ['ativa', 'em_andamento'].includes(status);
    const isSuspended = status === 'suspensa';
    const canActivate = status === 'planejada';
    const canReactivate = ['concluida', 'finalizada'].includes(status);
    const canSuspend = isActive;
    const canResume = isSuspended;
    const canFinalize = isActive;

    let actions = '';
    if (canActivate) {
        actions += '<button onclick="activateOrder(\'' + order.id + '\', \'' + (order.machine_id || '') + '\')" class="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-medium mr-1" title="Ativar"><i data-lucide="play" class="w-3 h-3 inline"></i></button>';
    }
    if (canFinalize) {
        actions += '<button onclick="finalizeOrder(\'' + order.id + '\')" class="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-medium mr-1" title="Finalizar"><i data-lucide="check-circle-2" class="w-3 h-3 inline"></i></button>';
    }
    if (canSuspend) {
        actions += '<button onclick="suspendOrder(\'' + order.id + '\')" class="px-2 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded text-xs font-medium mr-1" title="Suspender"><i data-lucide="pause" class="w-3 h-3 inline"></i></button>';
    }
    if (canResume) {
        actions += '<button onclick="resumeOrder(\'' + order.id + '\')" class="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-medium mr-1" title="Retomar"><i data-lucide="play" class="w-3 h-3 inline"></i></button>';
    }
    if (canReactivate) {
        actions += '<button onclick="reactivateOrder(\'' + order.id + '\')" class="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium mr-1" title="Reativar"><i data-lucide="rotate-ccw" class="w-3 h-3 inline"></i></button>';
    }
    actions += '<button onclick="openOrderTraceability(\'' + order.id + '\')" class="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-medium mr-1" title="Rastrear"><i data-lucide="file-search" class="w-3 h-3 inline"></i></button>';
    actions += '<button onclick="editOrder(\'' + order.id + '\')" class="px-2 py-1 bg-gray-500 hover:bg-gray-600 text-white rounded text-xs font-medium" title="Editar"><i data-lucide="edit-3" class="w-3 h-3 inline"></i></button>';

    const progressBar = '<div class="w-full bg-gray-200 rounded-full h-2"><div class="bg-blue-500 h-2 rounded-full" style="width: ' + progress + '%"></div></div><span class="text-xs text-gray-500">' + Math.round(progress) + '%</span>';

    return '<tr class="hover:bg-gray-50">' +
        '<td class="px-4 py-3 font-medium">' + escapeHtml(order.order_number || '') + '</td>' +
        '<td class="px-4 py-3">' + escapeHtml(order.product || order.part_code || '-') + '</td>' +
        '<td class="px-4 py-3">' + escapeHtml(order.machine_id || '-') + '</td>' +
        '<td class="px-4 py-3 text-center">' + lotSize.toLocaleString('pt-BR') + '</td>' +
        '<td class="px-4 py-3 text-center text-green-600 font-semibold">' + produced.toLocaleString('pt-BR') + '</td>' +
        '<td class="px-4 py-3 text-center text-red-600 font-semibold">' + losses.toLocaleString('pt-BR') + '</td>' +
        '<td class="px-4 py-3 text-center"><div class="flex flex-col items-center gap-1">' + progressBar + '</div></td>' +
        '<td class="px-4 py-3 text-center">' + (statusBadge[status] || statusBadge['planejada']) + '</td>' +
        '<td class="px-4 py-3 text-center whitespace-nowrap">' + actions + '</td>' +
    '</tr>';
}

function populateOrdersMachineFilter() {
    const machineFilter = document.getElementById('orders-machine-filter');
    if (!machineFilter) return;

    machineFilter.innerHTML = '<option value="">Todas Máquinas</option>';

    if (typeof window.machineDatabase !== 'undefined' && window.machineDatabase.length > 0) {
        window.machineDatabase.forEach(function (machine) {
            const mid = normalizeMachineId(machine.id);
            machineFilter.innerHTML += '<option value="' + mid + '">' + mid + ' - ' + machine.model + '</option>';
        });
    }
}

function setupOrdersFilters() {
    const searchInput = document.getElementById('orders-search');
    const statusFilter = document.getElementById('orders-status-filter');
    const machineFilter = document.getElementById('orders-machine-filter');
    const sortFilter = document.getElementById('orders-sort-filter');
    const clearBtn = document.getElementById('orders-clear-filters');
    const buscarBtn = document.getElementById('orders-btn-buscar');

    // Buscar: clique no botão ou Enter no campo de texto
    if (buscarBtn) buscarBtn.addEventListener('click', searchProductionOrders);
    if (searchInput) searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            searchProductionOrders();
        }
    });
    
    // Filtros de ordenação aplicam client-side nos dados já carregados
    function applyClientFilters() {
        if (ordersCache.length === 0) return; // sem dados carregados
        
        let filtered = [...ordersCache];
        
        const query = (searchInput?.value || '').toLowerCase().trim();
        if (query) {
            filtered = filtered.filter(o =>
                (o.order_number || '').toLowerCase().includes(query) ||
                (o.product || '').toLowerCase().includes(query) ||
                (o.part_code || '').toLowerCase().includes(query) ||
                (o.customer || '').toLowerCase().includes(query)
            );
        }

        const sort = sortFilter?.value || 'recent';
        filtered.sort((a, b) => {
            const lotA = Number(a.lot_size) || 0;
            const lotB = Number(b.lot_size) || 0;
            const prodA = Number(a.total_produzido ?? a.totalProduced ?? a.total_produced) || 0;
            const prodB = Number(b.total_produzido ?? b.totalProduced ?? b.total_produced) || 0;
            const progressA = lotA > 0 ? (prodA / lotA) : 0;
            const progressB = lotB > 0 ? (prodB / lotB) : 0;

            switch (sort) {
                case 'recent':
                    return (b.createdAt?.toDate?.() || new Date(0)) - (a.createdAt?.toDate?.() || new Date(0));
                case 'progress-desc':
                    return progressB - progressA;
                case 'progress-asc':
                    return progressA - progressB;
                case 'lot-desc':
                    return lotB - lotA;
                case 'alpha':
                    return (a.order_number || '').localeCompare(b.order_number || '');
                default:
                    return 0;
            }
        });

        updateOrdersKPIs(filtered);
        renderOrders(filtered);
    }

    // Text search e sort aplicam client-side (filtram dados já carregados)
    if (searchInput) searchInput.addEventListener('input', debounce(applyClientFilters, 300));
    if (sortFilter) sortFilter.addEventListener('change', applyClientFilters);
    
    // Status e máquina mudam a query server-side → requer nova busca
    if (statusFilter) statusFilter.addEventListener('change', () => {
        // Se já tem dados, refaz a busca com novo filtro server-side
        if (ordersCache.length > 0 || statusFilter.value || machineFilter?.value) {
            searchProductionOrders();
        }
    });
    if (machineFilter) machineFilter.addEventListener('change', () => {
        if (ordersCache.length > 0 || statusFilter?.value || machineFilter.value) {
            searchProductionOrders();
        }
    });

    if (clearBtn) {
        clearBtn.addEventListener('click', function () {
            if (searchInput) searchInput.value = '';
            if (statusFilter) statusFilter.value = '';
            if (machineFilter) machineFilter.value = '';
            if (sortFilter) sortFilter.value = 'recent';
            // Limpar dados e mostrar empty state
            ordersCache = [];
            const grid = document.getElementById('orders-grid');
            const tableBody = document.getElementById('orders-table-body');
            const emptyState = document.getElementById('orders-empty-state');
            const countEl = document.getElementById('orders-count');
            if (grid) grid.innerHTML = '';
            if (tableBody) tableBody.innerHTML = '';
            if (emptyState) {
                emptyState.classList.remove('hidden');
                emptyState.classList.add('flex');
            }
            if (countEl) countEl.textContent = '0 ordens encontradas';
            updateOrdersKPIs([]);
        });
    }
}

function setupOrdersViewToggle() {
    const gridBtn = document.getElementById('orders-view-grid-btn');
    const tableBtn = document.getElementById('orders-view-table-btn');
    const grid = document.getElementById('orders-grid');
    const tableContainer = document.getElementById('orders-table-container');

    if (gridBtn && tableBtn && grid && tableContainer) {
        gridBtn.addEventListener('click', function () {
            grid.classList.remove('hidden');
            tableContainer.classList.add('hidden');
            gridBtn.classList.add('bg-white', 'shadow-sm', 'text-primary-blue');
            gridBtn.classList.remove('text-gray-500');
            tableBtn.classList.remove('bg-white', 'shadow-sm', 'text-primary-blue');
            tableBtn.classList.add('text-gray-500');
        });

        tableBtn.addEventListener('click', function () {
            grid.classList.add('hidden');
            tableContainer.classList.remove('hidden');
            tableBtn.classList.add('bg-white', 'shadow-sm', 'text-primary-blue');
            tableBtn.classList.remove('text-gray-500');
            gridBtn.classList.remove('bg-white', 'shadow-sm', 'text-primary-blue');
            gridBtn.classList.add('text-gray-500');
        });
    }
}

// ─── window.* exposures (onclick handlers no HTML) ───────────────────

window.activateOrder = async function (orderId, machineId) {
    if (!machineId) {
        showNotification('Esta ordem não tem máquina definida. Edite primeiro.', 'warning');
        return;
    }
    if (!confirm('Ativar ordem na máquina ' + machineId + '?')) return;
    try {
        await db().collection('production_orders').doc(orderId).update({
            status: 'ativa',
            activatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        showNotification('Ordem ativada!', 'success');
        loadProductionOrders();
    } catch (e) {
        showNotification('Erro ao ativar ordem', 'error');
    }
};

window.reactivateOrder = async function (orderId) {
    if (!confirm('Reativar esta ordem?')) return;
    try {
        await db().collection('production_orders').doc(orderId).update({ status: 'ativa' });
        showNotification('Ordem reativada!', 'success');
        loadProductionOrders();
    } catch (e) {
        showNotification('Erro ao reativar ordem', 'error');
    }
};

window.editOrder = function (orderId) {
    const order = ordersCache.find(o => o.id === orderId);
    if (!order) {
        showNotification('Ordem não encontrada', 'error');
        return;
    }
    openNewOrderModal(order);
};

window.finalizeOrder = async function (orderId) {
    const order = ordersCache.find(o => o.id === orderId);
    if (!order) {
        showNotification('Ordem não encontrada', 'error');
        return;
    }

    const orderNum = order.order_number || orderId;
    const lotSize = Number(order.lot_size) || 0;
    const produced = Number(order.total_produzido ?? order.totalProduced ?? order.total_produced) || 0;
    const losses = Number(order.total_perdas ?? order.totalLosses ?? order.total_losses ?? order.refugo ?? order.scrap) || 0;
    const progress = lotSize > 0 ? Math.min((produced / lotSize) * 100, 100) : 0;

    const progressInfo = lotSize > 0
        ? '\n\nProgresso: ' + produced.toLocaleString('pt-BR') + ' / ' + lotSize.toLocaleString('pt-BR') + ' (' + Math.round(progress) + '%)' +
          '\nPerdas: ' + losses.toLocaleString('pt-BR') + ' peças'
        : '';

    const warningMsg = progress < 100
        ? '\n\n⚠️ ATENÇÃO: Esta ordem ainda NÃO atingiu 100% do lote planejado!'
        : '';

    if (!confirm('Deseja finalizar a ordem OP ' + orderNum + '?' + progressInfo + warningMsg + '\n\nEsta ação mudará o status para CONCLUÍDA.')) return;

    let observacao = '';
    if (progress < 100) {
        observacao = prompt('Informe o motivo da finalização antes de atingir 100%:');
        if (observacao === null) {
            showNotification('Finalização cancelada', 'info');
            return;
        }
    }

    try {
        const updateData = {
            status: 'concluida',
            completedAt: firebase.firestore.FieldValue.serverTimestamp(),
            completedProgress: Math.round(progress * 100) / 100,
            previousStatus: order.status || 'ativa'
        };
        if (observacao) {
            updateData.completionNotes = observacao;
        }

        await db().collection('production_orders').doc(orderId).update(updateData);
        showNotification('Ordem OP ' + orderNum + ' finalizada com sucesso! (' + Math.round(progress) + '%)', 'success');

        if (typeof registrarLogSistema === 'function') {
            registrarLogSistema('FINALIZAÇÃO DE ORDEM', 'ordem', {
                orderId: orderId,
                orderNumber: orderNum,
                product: order.product || order.part_code || '',
                progress: Math.round(progress) + '%',
                produced: produced,
                lotSize: lotSize,
                losses: losses,
                notes: observacao || ''
            });
        }

        loadProductionOrders();
    } catch (e) {
        console.error('Erro ao finalizar ordem:', e);
        showNotification('Erro ao finalizar ordem', 'error');
    }
};

window.suspendOrder = async function (orderId) {
    const order = ordersCache.find(o => o.id === orderId);
    const orderNum = order?.order_number || orderId;

    const motivo = prompt('Informe o motivo da suspensão da OP ' + orderNum + ':');
    if (!motivo) {
        showNotification('Suspensão cancelada - motivo não informado', 'info');
        return;
    }

    try {
        await db().collection('production_orders').doc(orderId).update({
            status: 'suspensa',
            suspendedAt: firebase.firestore.FieldValue.serverTimestamp(),
            suspendedReason: motivo,
            previousStatus: order?.status || 'ativa'
        });
        showNotification('Ordem OP ' + orderNum + ' suspensa!', 'warning');
        loadProductionOrders();
    } catch (e) {
        console.error('Erro ao suspender ordem:', e);
        showNotification('Erro ao suspender ordem', 'error');
    }
};

window.resumeOrder = async function (orderId) {
    const order = ordersCache.find(o => o.id === orderId);
    const orderNum = order?.order_number || orderId;

    if (!confirm('Retomar ordem OP ' + orderNum + '?')) return;

    try {
        const previousStatus = order?.previousStatus || 'ativa';
        await db().collection('production_orders').doc(orderId).update({
            status: previousStatus,
            resumedAt: firebase.firestore.FieldValue.serverTimestamp(),
            suspendedReason: firebase.firestore.FieldValue.delete()
        });
        showNotification('Ordem OP ' + orderNum + ' retomada!', 'success');
        loadProductionOrders();
    } catch (e) {
        console.error('Erro ao retomar ordem:', e);
        showNotification('Erro ao retomar ordem', 'error');
    }
};

window.deleteOrder = async function (orderId) {
    if (!confirm('Deseja excluir esta ordem? Esta ação não pode ser desfeita.')) return;
    try {
        const order = ordersCache.find(o => o.id === orderId);
        await db().collection('production_orders').doc(orderId).delete();
        showNotification('Ordem excluída com sucesso!', 'success');
        registrarLogSistema('EXCLUSÃO DE ORDEM', 'ordem', {
            orderId: orderId,
            orderNumber: order?.order_number || 'N/A'
        });
        loadProductionOrders();
    } catch (error) {
        console.error('Erro ao excluir ordem:', error);
        showNotification('Erro ao excluir ordem', 'error');
    }
};

window.openOrderTraceability = async function (orderId) {
    const order = ordersCache.find(o => o.id === orderId);
    if (!order) {
        showNotification('Ordem não encontrada', 'error');
        return;
    }

    const modal = document.getElementById('order-traceability-modal');
    if (!modal) {
        showNotification('Modal de rastreabilidade não encontrado', 'error');
        return;
    }

    const orderNumEl = document.getElementById('order-trace-number');
    if (orderNumEl) orderNumEl.textContent = 'OP #' + (order.order_number || 'N/A') + ' - ' + (order.product || order.part_code || 'Sem produto');

    const entriesContainer = document.getElementById('order-trace-entries');
    if (entriesContainer) entriesContainer.innerHTML = '<div class="p-4 text-center text-gray-500"><i data-lucide="loader-2" class="w-6 h-6 animate-spin mx-auto"></i><p class="mt-2">Carregando lançamentos...</p></div>';

    modal.classList.remove('hidden');
    if (typeof lucide !== 'undefined') lucide.createIcons();

    try {
        let entries = [];

        console.log('[TRACE] Buscando lançamentos para orderId:', orderId);

        // Query 1: por orderId
        try {
            const snapshot1 = await db().collection('production_entries')
                .where('orderId', '==', orderId)
                .limit(500)
                .get();
            console.log('[TRACE] Query orderId retornou:', snapshot1.size, 'documentos');
            snapshot1.forEach(doc => {
                entries.push({ id: doc.id, ...doc.data() });
            });
        } catch (e) {
            console.warn('[TRACE] Query orderId falhou:', e);
        }

        // Query 2: por order_id (alternativo)
        if (entries.length === 0) {
            try {
                const snapshot2 = await db().collection('production_entries')
                    .where('order_id', '==', orderId)
                    .limit(500)
                    .get();
                console.log('[TRACE] Query order_id retornou:', snapshot2.size, 'documentos');
                snapshot2.forEach(doc => {
                    if (!entries.find(e => e.id === doc.id)) {
                        entries.push({ id: doc.id, ...doc.data() });
                    }
                });
            } catch (e) {
                console.warn('[TRACE] Query order_id falhou:', e);
            }
        }

        // Query 3: via planejamento
        if (entries.length === 0 && order.order_number) {
            try {
                console.log('[TRACE] Buscando planejamentos para order_number:', order.order_number);
                const planSnapshot = await db().collection('planning')
                    .where('order_number', '==', order.order_number)
                    .get();

                const planIds = planSnapshot.docs.map(d => d.id);
                console.log('[TRACE] Encontrados', planIds.length, 'planejamentos');

                if (planIds.length > 0) {
                    for (let i = 0; i < planIds.length; i += 10) {
                        const chunk = planIds.slice(i, i + 10);
                        const snapshot3 = await db().collection('production_entries')
                            .where('planId', 'in', chunk)
                            .limit(500)
                            .get();
                        console.log('[TRACE] Query planId chunk retornou:', snapshot3.size, 'documentos');
                        snapshot3.forEach(doc => {
                            if (!entries.find(e => e.id === doc.id)) {
                                entries.push({ id: doc.id, ...doc.data() });
                            }
                        });
                    }
                }
            } catch (e) {
                console.warn('[TRACE] Query planId falhou:', e);
            }
        }

        // Remover duplicatas e ordenar
        const uniqueEntries = [];
        const seenIds = new Set();
        entries.forEach(e => {
            if (!seenIds.has(e.id)) {
                seenIds.add(e.id);
                uniqueEntries.push(e);
            }
        });

        uniqueEntries.sort((a, b) => {
            const tsA = a.timestamp?.toMillis ? a.timestamp.toMillis() : (a.timestamp?.seconds || 0) * 1000;
            const tsB = b.timestamp?.toMillis ? b.timestamp.toMillis() : (b.timestamp?.seconds || 0) * 1000;
            return tsB - tsA;
        });

        let totalProduced = 0;
        let totalLosses = 0;
        const processedEntries = [];

        uniqueEntries.forEach(data => {
            const qty = Number(data.produzido || data.quantity || data.qty || 0);
            const lossKg = Number(data.refugo_kg || data.refugo || 0);
            const lossQty = Number(data.refugo_qty || 0);
            const loss = lossQty > 0 ? lossQty : lossKg;

            if (qty > 0) {
                totalProduced += qty;
            }
            totalLosses += loss;

            processedEntries.push({
                ...data,
                qty: qty,
                loss: loss,
                lossKg: lossKg
            });
        });

        console.log('[TRACE] Encontrados', uniqueEntries.length, 'lançamentos. Total:', totalProduced, 'peças,', totalLosses, 'perdas');

        const lotSize = Number(order.lot_size) || 0;
        const progress = lotSize > 0 ? Math.min((totalProduced / lotSize) * 100, 100) : 0;

        const plannedEl = document.getElementById('order-trace-planned');
        const producedEl = document.getElementById('order-trace-produced');
        const lossesEl = document.getElementById('order-trace-losses');
        const progressEl = document.getElementById('order-trace-progress');
        const countEl = document.getElementById('order-trace-entries-count');

        if (plannedEl) plannedEl.textContent = lotSize.toLocaleString('pt-BR');
        if (producedEl) producedEl.textContent = totalProduced.toLocaleString('pt-BR');
        if (lossesEl) lossesEl.textContent = totalLosses.toLocaleString('pt-BR');
        if (progressEl) progressEl.textContent = Math.round(progress) + '%';
        if (countEl) countEl.textContent = processedEntries.length + ' registro(s)';

        if (processedEntries.length === 0) {
            entriesContainer.innerHTML = '<div class="p-8 text-center text-gray-400"><i data-lucide="inbox" class="w-12 h-12 mx-auto mb-3"></i><p>Nenhum lançamento encontrado para esta ordem</p></div>';
        } else {
            entriesContainer.innerHTML = processedEntries.map(entry => {
                let timestamp;
                if (entry.timestamp?.toDate) {
                    timestamp = entry.timestamp.toDate();
                } else if (entry.timestamp?.seconds) {
                    timestamp = new Date(entry.timestamp.seconds * 1000);
                } else if (entry.createdAt?.toDate) {
                    timestamp = entry.createdAt.toDate();
                } else {
                    timestamp = new Date();
                }

                const dateStr = timestamp.toLocaleDateString('pt-BR');
                const timeStr = timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                const turno = entry.turno || entry.shift || '-';
                const operador = entry.nomeUsuario || entry.operador || entry.operator || entry.registradoPorNome || 'N/A';
                const maquina = entry.machine || entry.machine_id || entry.machineId || 'N/A';

                let icon = 'package-check';
                let bgColor = 'bg-green-100';
                let iconColor = 'text-green-600';

                if (entry.qty <= 0 && entry.loss > 0) {
                    icon = 'trash-2';
                    bgColor = 'bg-red-100';
                    iconColor = 'text-red-600';
                }

                return '<div class="flex items-center justify-between px-4 py-3 border-b border-gray-100 hover:bg-gray-50">' +
                    '<div class="flex items-center gap-3">' +
                        '<div class="p-2 ' + bgColor + ' rounded-lg"><i data-lucide="' + icon + '" class="w-4 h-4 ' + iconColor + '"></i></div>' +
                        '<div>' +
                            '<p class="text-sm font-medium text-gray-800">' + maquina + ' <span class="text-xs text-gray-400">T' + turno + '</span></p>' +
                            '<p class="text-xs text-gray-500">' + dateStr + ' às ' + timeStr + '</p>' +
                            '<p class="text-xs text-gray-400">' + operador + '</p>' +
                        '</div>' +
                    '</div>' +
                    '<div class="flex items-center gap-4 text-sm">' +
                        (entry.qty > 0 ? '<div class="text-right"><span class="font-semibold text-green-600">+' + entry.qty.toLocaleString('pt-BR') + '</span><p class="text-xs text-gray-500">Peças</p></div>' : '') +
                        (entry.loss > 0 ? '<div class="text-right"><span class="font-semibold text-red-600">-' + entry.loss.toLocaleString('pt-BR') + '</span><p class="text-xs text-gray-500">' + (entry.lossKg > 0 ? 'kg' : 'pç') + '</p></div>' : '') +
                    '</div>' +
                '</div>';
            }).join('');
        }

        if (typeof lucide !== 'undefined') lucide.createIcons();

    } catch (error) {
        console.error('Erro ao carregar rastreabilidade:', error);
        entriesContainer.innerHTML = '<div class="p-8 text-center text-red-500"><i data-lucide="alert-circle" class="w-12 h-12 mx-auto mb-3"></i><p>Erro ao carregar dados de rastreabilidade</p><p class="text-xs mt-2">' + error.message + '</p></div>';
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
};

window.recalculateAllOrdersTotals = async function () {
    if (!confirm('Recalcular totais de produção e perdas para todas as ordens?\n\nIsso pode levar alguns segundos.')) return;

    showNotification('Recalculando totais...', 'info');

    try {
        const ordersData = await getProductionOrdersCached(true);
        let updated = 0;
        let errors = 0;

        for (const orderDoc of ordersData) {
            const orderId = orderDoc.id;

            try {
                const entriesSnapshot = await db().collection('production_entries')
                    .where('orderId', '==', orderId)
                    .get();

                let totalProduced = 0;
                let totalLosses = 0;

                entriesSnapshot.forEach(entryDoc => {
                    const data = entryDoc.data();
                    totalProduced += Number(data.produzido || data.quantity || data.qty) || 0;
                    totalLosses += Number(data.refugo_kg || data.refugo_qty || data.refugo || data.losses) || 0;
                });

                await db().collection('production_orders').doc(orderId).update({
                    total_produzido: totalProduced,
                    total_perdas: totalLosses,
                    lastRecalculated: firebase.firestore.FieldValue.serverTimestamp()
                });

                updated++;
            } catch (entryError) {
                console.error('Erro ao recalcular ordem ' + orderId + ':', entryError);
                errors++;
            }
        }

        if (window.DataStore) window.DataStore.set('productionOrders', null);

        showNotification('✅ Recalculado! ' + updated + ' ordens atualizadas' + (errors > 0 ? ', ' + errors + ' erros' : ''), 'success');
        loadProductionOrders();

    } catch (error) {
        console.error('Erro ao recalcular totais:', error);
        showNotification('Erro ao recalcular totais', 'error');
    }
};

window.refreshOrdersList = function () {
    searchProductionOrders();
    showNotification('Lista de ordens atualizada!', 'success');
};

window.searchMP = function () {
    const searchTerm = prompt('Digite o código ou descrição da MP:');
    if (!searchTerm) return;

    const mpSelect = document.getElementById('order-form-mp');
    if (!mpSelect || typeof window.materiaPrimaDatabase === 'undefined') {
        showNotification('Database de MP não disponível', 'error');
        return;
    }

    const term = searchTerm.toLowerCase();
    const found = window.materiaPrimaDatabase.find(mp =>
        mp.codigo.toLowerCase().includes(term) ||
        mp.descricao.toLowerCase().includes(term)
    );

    if (found) {
        mpSelect.value = found.codigo;
        mpSelect.dispatchEvent(new Event('change'));
        showNotification(`✅ MP encontrada: ${found.codigo} - ${found.descricao}`, 'success');
    } else {
        showNotification(`❌ MP não encontrada para: ${searchTerm}`, 'warning');
    }
};

window.saveOrderForm = async function () {
    console.log('📝 [saveOrderForm·mod] Iniciando salvamento...');

    try {
        const id = document.getElementById('order-form-id')?.value;
        const orderData = {
            order_number: document.getElementById('order-form-number')?.value.trim() || '',
            part_code: document.getElementById('order-form-part-code')?.value.trim() || '',
            product: document.getElementById('order-form-product')?.value.trim() || '',
            lot_size: Number(document.getElementById('order-form-lot-size')?.value) || 0,
            batch_number: document.getElementById('order-form-batch')?.value.trim() || '',
            packaging_qty: Number(document.getElementById('order-form-packaging')?.value) || 0,
            customer: document.getElementById('order-form-customer')?.value.trim() || '',
            machine_id: document.getElementById('order-form-machine')?.value || '',
            raw_material: document.getElementById('order-form-mp')?.value || ''
        };

        console.log('📝 [saveOrderForm·mod] Dados:', orderData);

        if (!orderData.order_number) {
            showNotification('Informe o número da OP', 'warning');
            return;
        }

        if (!orderData.lot_size || orderData.lot_size <= 0) {
            showNotification('Informe o tamanho do lote', 'warning');
            return;
        }

        if (id) {
            console.log('📝 [saveOrderForm·mod] Atualizando ordem:', id);
            await db().collection('production_orders').doc(id).update(orderData);
            showNotification('Ordem atualizada com sucesso!', 'success');

            registrarLogSistema('EDIÇÃO DE ORDEM DE PRODUÇÃO', 'ordem', {
                orderId: id,
                orderNumber: orderData.order_number,
                product: orderData.product,
                lotSize: orderData.lot_size
            });
        } else {
            console.log('📝 [saveOrderForm·mod] Criando nova ordem...');
            orderData.status = 'planejada';
            orderData.total_produced = 0;
            orderData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            const docRef = await db().collection('production_orders').add(orderData);
            console.log('✅ [saveOrderForm·mod] Ordem criada com ID:', docRef.id);
            showNotification('Ordem cadastrada com sucesso!', 'success');

            registrarLogSistema('CRIAÇÃO DE ORDEM DE PRODUÇÃO', 'ordem', {
                orderId: docRef.id,
                orderNumber: orderData.order_number,
                product: orderData.product,
                lotSize: orderData.lot_size
            });
        }

        closeOrderFormModal();

        loadProductionOrders();

    } catch (error) {
        console.error('❌ [saveOrderForm·mod] Erro:', error);
        showNotification('Erro ao salvar: ' + error.message, 'error');
    }
};

function openNewOrderModal(order) {
    const modal = document.getElementById('order-form-modal');
    if (!modal) return;

    const title = document.getElementById('order-form-title');
    if (title) title.textContent = order ? 'Editar Ordem de Produção' : 'Nova Ordem de Produção';

    // Popular select de máquinas
    const machineSelect = document.getElementById('order-form-machine');
    if (machineSelect) {
        machineSelect.innerHTML = '<option value="">Selecione uma máquina</option>';
        if (typeof window.machineDatabase !== 'undefined' && window.machineDatabase.length > 0) {
            window.machineDatabase.forEach(function (machine) {
                const mid = normalizeMachineId(machine.id);
                machineSelect.innerHTML += '<option value="' + mid + '">' + mid + ' - ' + machine.model + '</option>';
            });
        }
    }

    // Popular select de Matéria-Prima
    const mpSelect = document.getElementById('order-form-mp');
    if (mpSelect) {
        mpSelect.innerHTML = '<option value="">Selecione a MP...</option>';
        if (typeof window.materiaPrimaDatabase !== 'undefined' && window.materiaPrimaDatabase.length > 0) {
            window.materiaPrimaDatabase.forEach(function (mp) {
                mpSelect.innerHTML += '<option value="' + mp.codigo + '">' + mp.codigo + ' - ' + mp.descricao + '</option>';
            });
        }
    }

    // Preencher campos básicos
    document.getElementById('order-form-id').value = order?.id || '';
    document.getElementById('order-form-number').value = order?.order_number || '';
    document.getElementById('order-form-part-code').value = order?.part_code || '';
    document.getElementById('order-form-product').value = order?.product || '';
    document.getElementById('order-form-lot-size').value = order?.lot_size || '';
    document.getElementById('order-form-batch').value = order?.batch_number || '';
    document.getElementById('order-form-packaging').value = order?.packaging_qty || '';
    document.getElementById('order-form-customer').value = order?.customer || '';
    if (machineSelect) machineSelect.value = order?.machine_id || '';
    if (mpSelect) mpSelect.value = order?.mp || order?.raw_material || '';

    // Preencher campos do produto
    const cavitiesField = document.getElementById('order-form-cavities');
    const cycleField = document.getElementById('order-form-cycle');
    const weightField = document.getElementById('order-form-weight');
    const goalField = document.getElementById('order-form-goal');

    if (cavitiesField) cavitiesField.value = order?.cavities || '';
    if (cycleField) cycleField.value = order?.cycle || '';
    if (weightField) weightField.value = order?.weight || '';
    if (goalField) goalField.value = order?.pieces_per_hour_goal || '';

    modal.classList.remove('hidden');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

window.openNewOrderModal = openNewOrderModal;

function closeOrderFormModal() {
    const modal = document.getElementById('order-form-modal');
    if (modal) modal.classList.add('hidden');
}

window.closeOrderFormModal = closeOrderFormModal;

window.onPartCodeChange = function (code) {
    if (!code || code.trim() === '') return;

    const partCode = code.trim();
    console.log('📍 Buscando produto pelo código:', partCode);

    if (typeof window.productDatabase !== 'undefined' && window.productDatabase.length > 0) {
        let product = window.productDatabase.find(p => String(p.cod) === partCode);

        if (!product) {
            product = window.productDatabase.find(p =>
                p.name && p.name.toLowerCase().includes(partCode.toLowerCase())
            );
        }

        if (product) {
            console.log('✅ Produto encontrado:', product);

            const productField = document.getElementById('order-form-product');
            const customerField = document.getElementById('order-form-customer');
            const cavitiesField = document.getElementById('order-form-cavities');
            const cycleField = document.getElementById('order-form-cycle');
            const weightField = document.getElementById('order-form-weight');
            const goalField = document.getElementById('order-form-goal');

            if (productField) {
                productField.value = product.name || '';
                productField.classList.add('bg-green-50', 'border-green-300');
            }

            if (customerField) {
                customerField.value = product.client || '';
                customerField.classList.add('bg-green-50', 'border-green-300');
            }

            if (cavitiesField) {
                cavitiesField.value = product.cavities || '';
                cavitiesField.classList.add('bg-green-50', 'border-green-300');
            }

            if (cycleField) {
                cycleField.value = product.cycle || '';
                cycleField.classList.add('bg-green-50', 'border-green-300');
            }

            if (weightField) {
                weightField.value = product.weight || '';
                weightField.classList.add('bg-green-50', 'border-green-300');
            }

            if (goalField) {
                goalField.value = product.pieces_per_hour_goal || '';
                goalField.classList.add('bg-green-50', 'border-green-300');
            }

            // Preencher MP automaticamente
            const mpSelect = document.getElementById('order-form-mp');
            const mpInfoDiv = document.getElementById('order-form-mp-info');
            const mpDisplay = document.getElementById('order-form-mp-display');

            if (mpSelect && product.mp) {
                mpSelect.value = product.mp;
                mpSelect.classList.add('bg-green-50', 'border-green-300');

                if (mpInfoDiv && mpDisplay && typeof window.materiaPrimaDatabase !== 'undefined') {
                    const mpInfo = window.materiaPrimaDatabase.find(m => m.codigo === product.mp);
                    if (mpInfo) {
                        mpDisplay.textContent = `${mpInfo.codigo} - ${mpInfo.descricao}`;
                        mpInfoDiv.classList.remove('hidden');
                    }
                }
            }

            showNotification(`✅ Produto encontrado: ${product.name} (${product.client})`, 'success');
        } else {
            console.log('❌ Produto não encontrado para o código:', partCode);
            showNotification(`❌ Produto não encontrado para o código: ${partCode}`, 'warning');

            const fields = ['order-form-product', 'order-form-customer', 'order-form-cavities', 'order-form-cycle', 'order-form-weight', 'order-form-goal', 'order-form-mp'];
            fields.forEach(fieldId => {
                const field = document.getElementById(fieldId);
                if (field) {
                    field.value = '';
                    field.classList.remove('bg-green-50', 'border-green-300');
                }
            });

            const mpInfoDiv = document.getElementById('order-form-mp-info');
            if (mpInfoDiv) {
                mpInfoDiv.classList.add('hidden');
            }
        }
    } else {
        console.log('❌ productDatabase não disponível');
        showNotification('❌ Database de produtos não carregado', 'error');
    }
};

// ─── Setup dos listeners do formulário de ordens ─────────────────────

function setupOrderFormListeners() {
    // Listener para auto-fill pelo código da peça
    const partCodeInput = document.getElementById('order-form-part-code');
    if (partCodeInput) {
        partCodeInput.addEventListener('blur', function () {
            window.onPartCodeChange(this.value);
        });
        partCodeInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                window.onPartCodeChange(this.value);
            }
        });
    }

    // Listener para o select de MP
    const mpSelect = document.getElementById('order-form-mp');
    if (mpSelect) {
        mpSelect.addEventListener('change', function () {
            const mpInfoDiv = document.getElementById('order-form-mp-info');
            const mpDisplay = document.getElementById('order-form-mp-display');

            if (this.value && typeof window.materiaPrimaDatabase !== 'undefined') {
                const mpInfo = window.materiaPrimaDatabase.find(m => m.codigo === this.value);
                if (mpInfo && mpInfoDiv && mpDisplay) {
                    mpDisplay.textContent = `${mpInfo.codigo} - ${mpInfo.descricao}`;
                    mpInfoDiv.classList.remove('hidden');
                }
            } else if (mpInfoDiv) {
                mpInfoDiv.classList.add('hidden');
            }
        });
    }

    // Listener para submit do formulário
    const form = document.getElementById('order-form-modal-form');
    if (form) {
        form.addEventListener('submit', async function (e) {
            e.preventDefault();

            const id = document.getElementById('order-form-id')?.value;
            const orderData = {
                order_number: document.getElementById('order-form-number')?.value.trim() || '',
                part_code: document.getElementById('order-form-part-code')?.value.trim() || '',
                product: document.getElementById('order-form-product')?.value.trim() || '',
                lot_size: Number(document.getElementById('order-form-lot-size')?.value) || 0,
                batch_number: document.getElementById('order-form-batch')?.value.trim() || '',
                packaging_qty: Number(document.getElementById('order-form-packaging')?.value) || 0,
                customer: document.getElementById('order-form-customer')?.value.trim() || '',
                machine_id: document.getElementById('order-form-machine')?.value || '',
                raw_material: document.getElementById('order-form-mp')?.value || ''
            };

            if (!orderData.order_number || !orderData.lot_size) {
                showNotification('Preencha os campos obrigatórios', 'warning');
                return;
            }

            try {
                if (id) {
                    await db().collection('production_orders').doc(id).update(orderData);
                    showNotification('Ordem atualizada!', 'success');

                    registrarLogSistema('EDIÇÃO DE ORDEM DE PRODUÇÃO', 'ordem', {
                        orderId: id,
                        orderNumber: orderData.order_number,
                        product: orderData.product,
                        lotSize: orderData.lot_size
                    });
                } else {
                    orderData.status = 'planejada';
                    orderData.total_produced = 0;
                    orderData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                    const docRef = await db().collection('production_orders').add(orderData);
                    showNotification('Ordem cadastrada!', 'success');

                    registrarLogSistema('CRIAÇÃO DE ORDEM DE PRODUÇÃO', 'ordem', {
                        orderId: docRef.id,
                        orderNumber: orderData.order_number,
                        product: orderData.product,
                        lotSize: orderData.lot_size
                    });
                }
                closeOrderFormModal();
                loadProductionOrders();
            } catch (error) {
                showNotification('Erro ao salvar', 'error');
            }
        });
    }
}

// ─── Entry Point ─────────────────────────────────────────────────────

/**
 * Ponto de entrada do módulo de Ordens.
 * Substitui a chamada legada loadProductionOrders() no gate de feature flag.
 */
let _ordensInitialized = false;
export function setupOrdensPage() {
    if (_ordensInitialized) {
        console.debug('[Ordens·mod] Já inicializado — mantendo estado atual');
        return;
    }
    _ordensInitialized = true;
    console.log('[Ordens·mod] Controller modular carregado (search-first)');
    // Não carrega dados ao abrir a aba — mostra empty state e aguarda clique em "Buscar"
    populateOrdersMachineFilter();
    setupOrdersFilters();
    setupOrdersViewToggle();
    setupOrderFormListeners();
    updateOrdersKPIs([]);
}
