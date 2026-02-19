/**
 * HokkaidoMES — Relatórios Controller (Módulo ES6)
 * Fase 2: Extração #5 — Relatórios de produção/perdas/paradas
 *
 * Este módulo encapsula DUAS implementações legadas:
 *  1. ReportsModule IIFE (window.ReportsModule) — relatórios PDF/avançados
 *  2. Funções standalone rel* — relatórios inline (tabelas + CSV)
 *
 * Migrado de script.js (linhas ~41981-43152 + 44094-45452).
 * Zero alteração de lógica — apenas encapsulamento.
 */

import { getDb, serverTimestamp } from '../services/firebase-client.js';
import { EventBus } from '../core/event-bus.js';

// ─── Estado do módulo ────────────────────────────────
let relatoriosSetupDone = false;
let relProducaoDados = [];
let relPerdasDados = [];
let relParadasDados = [];
let relParadasPaginaAtual = 1;
const REL_PARADAS_POR_PAGINA = 20;
let relOPsCache = new Map();
let relOPsCacheLoaded = false;

// ─── Helpers ─────────────────────────────────────────
function db() { return getDb(); }

// ── Cache de consultas para relatórios (evita leituras repetidas) ──
const _relQueryCache = new Map();
const _relQueryCacheTTL = 300000; // 5 min

async function cachedRelQuery(key, queryFn) {
    const entry = _relQueryCache.get(key);
    if (entry && Date.now() - entry.ts < _relQueryCacheTTL) {
        console.debug(`📦 [Rel·cache] hit: ${key}`);
        return entry.snapshot;
    }
    console.debug(`🔥 [Rel·cache] miss: ${key}`);
    const snapshot = await queryFn();
    _relQueryCache.set(key, { snapshot, ts: Date.now() });
    return snapshot;
}

function notify(msg, type) {
    if (typeof window.showNotification === 'function') window.showNotification(msg, type);
}

function relGetProductionDateString(date = new Date()) {
    const dateObj = date instanceof Date ? date : new Date(date);
    const hour = dateObj.getHours();
    const minute = dateObj.getMinutes();
    if (hour < 6 || (hour === 6 && minute < 30)) {
        const prevDay = new Date(dateObj);
        prevDay.setDate(prevDay.getDate() - 1);
        return new Date(prevDay.getTime() - (prevDay.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    }
    return new Date(dateObj.getTime() - (dateObj.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
}

function relNormalizeMachineId(id) {
    if (!id) return '';
    const str = String(id).trim().toUpperCase().replace(/[\s_-]/g, '');
    const match = str.match(/^([A-Z]+)(\d{1,2})$/);
    if (match) return `${match[1]}${match[2].padStart(2, '0')}`;
    return str;
}

function getProductNameByCode(code) {
    if (!code) return '';
    const codNum = Number(code);
    const codStr = String(code).trim();
    if (typeof window.productDatabase !== 'undefined') {
        let product = window.productDatabase.find(p => p.cod === codNum);
        if (!product) product = window.productDatabase.find(p => String(p.cod || p.code || p.codigo || p.product_code || '').trim() === codStr);
        if (product) return product.name || product.nome || product.description || product.descricao || '';
    }
    if (typeof window.productByCode !== 'undefined' && window.productByCode.has(codStr)) {
        const product = window.productByCode.get(codStr);
        return product.name || product.nome || product.description || product.descricao || '';
    }
    return '';
}

// ─── Cache de OPs ───────────────────────────────────
async function relLoadOPsCache() {
    if (relOPsCacheLoaded) return;
    try {
        // OTIMIZADO: usa cache global ao invés de leitura direta
        const ordersData = typeof window.getProductionOrdersCached === 'function'
            ? await window.getProductionOrdersCached()
            : (await db().collection('production_orders').limit(2000).get()).docs.map(doc => ({id: doc.id, ...doc.data()}));
        ordersData.forEach(d => {
            relOPsCache.set(d.id, {
                orderNumber: d.order_number || d.order_number_original || d.id,
                partCode: d.part_code || d.product_cod || d.product_code || ''
            });
        });
        relOPsCacheLoaded = true;
        console.log('[Rel·mod] Cache de OPs carregado:', relOPsCache.size, 'registros');
    } catch (e) { console.warn('[Rel·mod] Erro ao carregar cache de OPs:', e.message); }
}

function relGetOrderNumber(orderId) {
    if (!orderId || orderId === '-') return '-';
    if (/^\d+$/.test(orderId)) return orderId;
    const cached = relOPsCache.get(orderId);
    return cached?.orderNumber || orderId;
}

function relGetProductCode(orderId) {
    if (!orderId || orderId === '-') return '';
    const cached = relOPsCache.get(orderId);
    return cached?.partCode || '';
}

// ─── Setup principal ─────────────────────────────────
export function setupRelatoriosPage() {
    if (relatoriosSetupDone) {
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }
    relatoriosSetupDone = true;
    console.log('[Rel·mod] Inicializando página de relatórios...');

    // Tabs
    document.querySelectorAll('.rel-tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => switchRelTab(e.currentTarget.dataset.relTab));
    });

    // Selects máquinas
    populateRelMaquinasSelect('rel-producao-maquina');
    populateRelMaquinasSelect('rel-perdas-maquina');
    populateRelMaquinasSelect('rel-paradas-maquina');

    // Botões busca
    document.getElementById('rel-btn-buscar-producao')?.addEventListener('click', relBuscarProducao);
    document.getElementById('rel-btn-buscar-perdas')?.addEventListener('click', relBuscarPerdas);
    document.getElementById('rel-paradas-buscar')?.addEventListener('click', relBuscarParadas);

    // Exportação CSV
    document.getElementById('rel-btn-exportar-producao')?.addEventListener('click', relExportarProducaoCSV);
    document.getElementById('rel-btn-exportar-perdas')?.addEventListener('click', relExportarPerdasCSV);
    document.getElementById('rel-btn-exportar-paradas')?.addEventListener('click', relExportarParadasCSV);

    // Exportação Tabela
    document.getElementById('rel-btn-exportar-producao-tabela')?.addEventListener('click', relExportarProducaoTabela);
    document.getElementById('rel-btn-exportar-perdas-tabela')?.addEventListener('click', relExportarPerdasTabela);
    document.getElementById('rel-btn-exportar-paradas-tabela')?.addEventListener('click', relExportarParadasTabela);

    // Períodos customizados
    ['producao', 'perdas', 'paradas'].forEach(tipo => {
        document.getElementById(`rel-${tipo}-periodo`)?.addEventListener('change', (e) => {
            const custom = e.target.value === 'custom';
            document.getElementById(`rel-${tipo}-custom-dates`)?.classList.toggle('hidden', !custom);
            document.getElementById(`rel-${tipo}-custom-dates-fim`)?.classList.toggle('hidden', !custom);
        });
    });

    // Paginação paradas
    document.getElementById('rel-paradas-pag-anterior')?.addEventListener('click', () => { if (relParadasPaginaAtual > 1) { relParadasPaginaAtual--; relRenderParadasTabela(); } });
    document.getElementById('rel-paradas-pag-proxima')?.addEventListener('click', () => { const tp = Math.ceil(relParadasDados.length / REL_PARADAS_POR_PAGINA); if (relParadasPaginaAtual < tp) { relParadasPaginaAtual++; relRenderParadasTabela(); } });

    if (typeof lucide !== 'undefined') lucide.createIcons();
    EventBus.emit('relatorios:initialized');
}

// ─── Tabs ───────────────────────────────────────────
function switchRelTab(tab) {
    document.querySelectorAll('.rel-tab-btn').forEach(btn => { btn.classList.remove('active', 'bg-blue-500', 'text-white'); btn.classList.add('bg-gray-100', 'text-gray-600'); });
    const activeBtn = document.querySelector(`.rel-tab-btn[data-rel-tab="${tab}"]`);
    if (activeBtn) { activeBtn.classList.add('active', 'bg-blue-500', 'text-white'); activeBtn.classList.remove('bg-gray-100', 'text-gray-600'); }
    document.querySelectorAll('.rel-tab-content').forEach(c => c.classList.add('hidden'));
    const content = document.getElementById(`rel-tab-${tab}`);
    if (content) content.classList.remove('hidden');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ─── Selects máquinas ───────────────────────────────
function populateRelMaquinasSelect(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;
    select.innerHTML = '<option value="">Todas</option>';
    if (typeof window.machineDatabase !== 'undefined') {
        window.machineDatabase.forEach(m => { const opt = document.createElement('option'); opt.value = m.id; opt.textContent = `${m.id} - ${m.model}`; select.appendChild(opt); });
    }
}

// ─── Helper: calcular datas do período ──────────────
function getDateRange(prefix) {
    const periodo = document.getElementById(`rel-${prefix}-periodo`)?.value || 'today';
    const hoje = relGetProductionDateString();
    let dataInicio, dataFim;

    switch (periodo) {
        case 'today': dataInicio = dataFim = hoje; break;
        case 'yesterday': { const o = new Date(); o.setDate(o.getDate() - 1); dataInicio = dataFim = relGetProductionDateString(o); break; }
        case '7days': { const d = new Date(); d.setDate(d.getDate() - 7); dataInicio = relGetProductionDateString(d); dataFim = hoje; break; }
        case '30days': { const d = new Date(); d.setDate(d.getDate() - 30); dataInicio = relGetProductionDateString(d); dataFim = hoje; break; }
        case 'month': { const n = new Date(); dataInicio = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-01`; dataFim = hoje; break; }
        case 'custom':
            dataInicio = document.getElementById(`rel-${prefix}-data-inicio`)?.value;
            dataFim = document.getElementById(`rel-${prefix}-data-fim`)?.value;
            if (!dataInicio || !dataFim) { notify('Selecione as datas do período', 'warning'); return null; }
            break;
        default: dataInicio = dataFim = hoje;
    }
    return { dataInicio, dataFim };
}

// ─── Buscar Produção ────────────────────────────────
async function relBuscarProducao() {
    const range = getDateRange('producao');
    if (!range) return;
    const maquina = document.getElementById('rel-producao-maquina')?.value;
    const turno = document.getElementById('rel-producao-turno')?.value;
    const tbody = document.getElementById('rel-producao-tbody');
    const loading = document.getElementById('rel-producao-loading');
    const empty = document.getElementById('rel-producao-empty');
    const stats = document.getElementById('rel-producao-stats');

    if (loading) loading.classList.remove('hidden');
    if (tbody) tbody.innerHTML = '';
    if (empty) empty.classList.add('hidden');
    if (stats) stats.classList.add('hidden');

    try {
        await relLoadOPsCache();
        // OTIMIZADO Fase 2: usar cache para queries de relatórios
        let query = db().collection('production_entries').where('data', '>=', range.dataInicio).where('data', '<=', range.dataFim).orderBy('data', 'desc');
        const snapshot = await cachedRelQuery(`prod_${range.dataInicio}_${range.dataFim}`, () => query.get());
        let dados = [];
        snapshot.forEach(doc => {
            const d = typeof doc.data === 'function' ? doc.data() : doc;
            if (maquina && relNormalizeMachineId(d.machine || d.machineRef || d.machine_id) !== relNormalizeMachineId(maquina)) return;
            const shiftVal = String(d.turno ?? d.shift ?? '');
            if (turno && shiftVal !== turno) return;
            const qty = Number(d.produzido ?? d.pecasBoas ?? d.quantity ?? d.produced ?? 0) || 0;
            const scrapPcs = Number(d.refugo_qty ?? d.refugo_qtd ?? d.scrap_qty ?? d.scrap_qtd ?? 0) || 0;
            const productCode = d.product_cod || d.product_code || d.cod_produto || d.product || relGetProductCode(d.order_id || d.orderId);
            const machineId = relNormalizeMachineId(d.machine || d.machineRef || d.machine_id);
            const dateVal = d.data || d.date || '';
            dados.push({
                id: doc.id, ...d,
                _machine: machineId, _date: dateVal, _shift: shiftVal,
                _qty: qty, _scrap: scrapPcs,
                _scrapKg: Number(d.refugo_kg ?? d.refugoKg ?? d.scrap_kg ?? d.scrapKg ?? 0) || 0,
                _productName: getProductNameByCode(productCode),
                _orderNumber: relGetOrderNumber(d.order_id || d.orderId),
                _productCode: productCode,
                _userCod: d.userCod ?? d.user_cod ?? '',
                _user: d.nomeUsuario || d.registradoPorNome || d.registradoPor || d.createdByName || d.createdBy || d.adjustedByName || d.adjustedBy || d.user || d.operador || '-'
            });
        });

        relProducaoDados = dados;
        if (loading) loading.classList.add('hidden');

        if (dados.length === 0) { if (empty) empty.classList.remove('hidden'); return; }
        if (stats) stats.classList.remove('hidden');

        // Estatísticas
        const totalPecas = dados.reduce((s, d) => s + d._qty, 0);
        const totalPerdas = dados.reduce((s, d) => s + d._scrap, 0);
        const totalPeso = dados.reduce((s, d) => s + (Number(d.peso_bruto ?? d.peso ?? 0) || 0), 0);
        const totalRefugoKg = dados.reduce((s, d) => s + (Number(d.refugo_kg ?? d.refugoKg ?? 0) || 0), 0);
        const el = (id) => document.getElementById(id);
        if (el('rel-prod-total')) el('rel-prod-total').textContent = dados.length.toLocaleString('pt-BR');
        if (el('rel-prod-pecas')) el('rel-prod-pecas').textContent = totalPecas.toLocaleString('pt-BR');
        if (el('rel-prod-peso')) el('rel-prod-peso').textContent = totalPeso.toLocaleString('pt-BR', {minimumFractionDigits: 1, maximumFractionDigits: 1});
        if (el('rel-prod-refugo')) el('rel-prod-refugo').textContent = totalRefugoKg.toLocaleString('pt-BR', {minimumFractionDigits: 1, maximumFractionDigits: 1});

        // Tabela
        if (tbody) {
            tbody.innerHTML = dados.map(d => {
                const dataFmt = d._date ? d._date.split('-').reverse().join('/') : '-';
                const perdaKg = d._scrapKg > 0 ? d._scrapKg : 0;
                const perdaKgFmt = perdaKg > 0 ? perdaKg.toLocaleString('pt-BR', {minimumFractionDigits: 3, maximumFractionDigits: 3}) + ' kg' : '-';
                return `<tr class="border-b border-gray-100 hover:bg-gray-50"><td class="p-2 text-sm">${dataFmt}</td><td class="p-2 text-sm font-medium">${d._machine || '-'}</td><td class="p-2 text-sm">${d._shift || '-'}</td><td class="p-2 text-sm">${d._orderNumber}</td><td class="p-2 text-sm">${d._productCode}</td><td class="p-2 text-sm truncate max-w-xs" title="${d._productName}">${d._productName || '-'}</td><td class="p-2 text-sm text-right font-medium">${d._qty.toLocaleString('pt-BR')}</td><td class="p-2 text-sm text-right ${perdaKg > 0 ? 'text-red-600 font-medium' : ''}">${perdaKgFmt}</td><td class="p-2 text-sm text-center" title="${d._user}">${d._userCod !== '' ? d._userCod + ' - ' + d._user : (d._user !== '-' ? d._user : '-')}</td></tr>`;
            }).join('');
        }
    } catch (error) {
        console.error('[Rel·mod] Erro ao buscar produção:', error);
        if (loading) loading.classList.add('hidden');
        notify('Erro ao buscar dados de produção', 'error');
    }
}

// ─── Buscar Perdas ──────────────────────────────────
async function relBuscarPerdas() {
    const range = getDateRange('perdas');
    if (!range) return;
    const maquina = document.getElementById('rel-perdas-maquina')?.value;
    const turno = document.getElementById('rel-perdas-turno')?.value;
    const tbody = document.getElementById('rel-perdas-tbody');
    const loading = document.getElementById('rel-perdas-loading');
    const empty = document.getElementById('rel-perdas-empty');

    if (loading) loading.classList.remove('hidden');
    if (tbody) tbody.innerHTML = '';
    if (empty) empty.classList.add('hidden');

    try {
        await relLoadOPsCache();
        // OTIMIZADO Fase 2: usar cache para queries de relatórios
        let query = db().collection('production_entries').where('data', '>=', range.dataInicio).where('data', '<=', range.dataFim).orderBy('data', 'desc');
        const snapshot = await cachedRelQuery(`prod_${range.dataInicio}_${range.dataFim}`, () => query.get());
        let dados = [];
        snapshot.forEach(doc => {
            const d = typeof doc.data === 'function' ? doc.data() : doc;
            const scrapPcs = Number(d.refugo_qty ?? d.refugo_qtd ?? d.scrap_qty ?? d.scrap_qtd ?? 0) || 0;
            const scrapKg = Number(d.refugo_kg ?? d.refugoKg ?? d.scrap_kg ?? d.scrapKg ?? 0) || 0;
            if (scrapPcs <= 0 && scrapKg <= 0) return;
            if (maquina && relNormalizeMachineId(d.machine || d.machineRef || d.machine_id) !== relNormalizeMachineId(maquina)) return;
            const shiftVal = String(d.turno ?? d.shift ?? '');
            if (turno && shiftVal !== turno) return;
            const productCode = d.product_cod || d.product_code || d.cod_produto || d.product || relGetProductCode(d.order_id || d.orderId);
            const machineId = relNormalizeMachineId(d.machine || d.machineRef || d.machine_id);
            const dateVal = d.data || d.date || '';
            const lossReason = d.perdas || d.loss_reason || d.defect_reason || '';
            dados.push({
                id: doc.id, ...d,
                _machine: machineId, _date: dateVal, _shift: shiftVal,
                _scrap: scrapPcs, _scrapKg: scrapKg,
                _lossReason: lossReason,
                _productName: getProductNameByCode(productCode),
                _orderNumber: relGetOrderNumber(d.order_id || d.orderId),
                _productCode: productCode,
                _userCod: d.userCod ?? d.user_cod ?? '',
                _user: d.nomeUsuario || d.registradoPorNome || d.registradoPor || d.createdByName || d.createdBy || d.adjustedByName || d.adjustedBy || d.user || d.operador || '-'
            });
        });

        relPerdasDados = dados;
        if (loading) loading.classList.add('hidden');
        if (dados.length === 0) { if (empty) empty.classList.remove('hidden'); return; }

        // Estatísticas de perdas
        const elP = (id) => document.getElementById(id);
        const totalPesoKg = dados.reduce((s, d) => s + (d._scrapKg || 0), 0);
        const borraKg = dados.filter(d => (d.tipo_lancamento === 'borra') || (d._lossReason && d._lossReason.toUpperCase().startsWith('BORRA'))).reduce((s, d) => s + (d._scrapKg || 0), 0);
        const sucataKg = dados.filter(d => (d.tipo_lancamento === 'sucata') || (d._lossReason && d._lossReason.toUpperCase().startsWith('SUCATA'))).reduce((s, d) => s + (d._scrapKg || 0), 0);
        const refugoKg = totalPesoKg - borraKg - sucataKg;
        if (elP('rel-perdas-total')) elP('rel-perdas-total').textContent = dados.length.toLocaleString('pt-BR');
        if (elP('rel-perdas-peso')) elP('rel-perdas-peso').textContent = totalPesoKg.toLocaleString('pt-BR', {minimumFractionDigits: 1, maximumFractionDigits: 1});
        if (elP('rel-perdas-borra')) elP('rel-perdas-borra').textContent = borraKg.toLocaleString('pt-BR', {minimumFractionDigits: 1, maximumFractionDigits: 1});
        if (elP('rel-perdas-refugo')) elP('rel-perdas-refugo').textContent = refugoKg.toLocaleString('pt-BR', {minimumFractionDigits: 1, maximumFractionDigits: 1});
        if (elP('rel-perdas-sucata')) elP('rel-perdas-sucata').textContent = sucataKg.toLocaleString('pt-BR', {minimumFractionDigits: 1, maximumFractionDigits: 1});

        if (tbody) {
            tbody.innerHTML = dados.map(d => {
                const dataFmt = d._date ? d._date.split('-').reverse().join('/') : '-';
                const perdaKg = d._scrapKg > 0 ? d._scrapKg : 0;
                const perdaKgFmt = perdaKg > 0 ? perdaKg.toLocaleString('pt-BR', {minimumFractionDigits: 3, maximumFractionDigits: 3}) + ' kg' : (d._scrap > 0 ? d._scrap.toLocaleString('pt-BR') + ' pç' : '-');
                return `<tr class="border-b border-gray-100 hover:bg-gray-50"><td class="p-2 text-sm">${dataFmt}</td><td class="p-2 text-sm font-medium">${d._machine || '-'}</td><td class="p-2 text-sm">${d._shift || '-'}</td><td class="p-2 text-sm">${d._orderNumber}</td><td class="p-2 text-sm">${d._productCode}</td><td class="p-2 text-sm truncate max-w-xs">${d._productName || '-'}</td><td class="p-2 text-sm text-right text-red-600 font-bold">${perdaKgFmt}</td><td class="p-2 text-sm text-gray-500">${d._lossReason || '-'}</td><td class="p-2 text-sm text-center" title="${d._user}">${d._userCod !== '' ? d._userCod + ' - ' + d._user : (d._user !== '-' ? d._user : '-')}</td></tr>`;
            }).join('');
        }
    } catch (error) {
        console.error('[Rel·mod] Erro ao buscar perdas:', error);
        if (loading) loading.classList.add('hidden');
        notify('Erro ao buscar dados de perdas', 'error');
    }
}

// ─── Buscar Paradas ─────────────────────────────────
async function relBuscarParadas() {
    const range = getDateRange('paradas');
    if (!range) return;
    const maquina = document.getElementById('rel-paradas-maquina')?.value;
    const loading = document.getElementById('rel-paradas-loading');
    const empty = document.getElementById('rel-paradas-empty');

    if (loading) loading.classList.remove('hidden');
    if (empty) empty.classList.add('hidden');

    try {
        // OTIMIZADO Fase 2: usar cache para queries de relatórios
        let query = db().collection('downtime_entries').where('date', '>=', range.dataInicio).where('date', '<=', range.dataFim).orderBy('date', 'desc');
        const snapshot = await cachedRelQuery(`down_${range.dataInicio}_${range.dataFim}`, () => query.get());
        let dados = [];
        snapshot.forEach(doc => {
            const d = typeof doc.data === 'function' ? doc.data() : doc;
            const machineId = relNormalizeMachineId(d.machine || d.machineRef || d.machine_id);
            if (maquina && machineId !== relNormalizeMachineId(maquina)) return;
            const duration = Number(d.duration ?? d.duration_min ?? d.duracao_min ?? 0) || 0;
            dados.push({ id: doc.id, ...d, _machine: machineId, _date: d.date || '', _duration: duration });
        });

        relParadasDados = dados;
        relParadasPaginaAtual = 1;
        if (loading) loading.classList.add('hidden');
        if (dados.length === 0) { if (empty) empty.classList.remove('hidden'); return; }

        relRenderParadasStats();
        relRenderParadasTabela();
    } catch (error) {
        console.error('[Rel·mod] Erro ao buscar paradas:', error);
        if (loading) loading.classList.add('hidden');
        notify('Erro ao buscar dados de paradas', 'error');
    }
}

function relRenderParadasStats() {
    const dados = relParadasDados;
    const totalMinutos = dados.reduce((s, d) => s + (d._duration || 0), 0);
    const horas = Math.floor(totalMinutos / 60);
    const mins = Math.round(totalMinutos % 60);
    const ativas = dados.filter(d => !d.endTime && !d.end_time).length;
    const finalizadas = dados.length - ativas;
    const el = (id) => document.getElementById(id);
    if (el('rel-paradas-stat-total')) el('rel-paradas-stat-total').textContent = dados.length;
    if (el('rel-paradas-stat-ativas')) el('rel-paradas-stat-ativas').textContent = ativas;
    if (el('rel-paradas-stat-finalizadas')) el('rel-paradas-stat-finalizadas').textContent = finalizadas;
    if (el('rel-paradas-stat-tempo')) el('rel-paradas-stat-tempo').textContent = `${horas}h ${mins}m`;
    if (el('rel-paradas-stat-medio')) el('rel-paradas-stat-medio').textContent = dados.length > 0 ? `${Math.round(totalMinutos / dados.length)}min` : '0min';
}

function relRenderParadasTabela() {
    const tbody = document.getElementById('rel-paradas-tbody');
    if (!tbody) return;
    const total = relParadasDados.length;
    const totalPaginas = Math.ceil(total / REL_PARADAS_POR_PAGINA) || 1;
    if (relParadasPaginaAtual > totalPaginas) relParadasPaginaAtual = totalPaginas;
    const inicio = (relParadasPaginaAtual - 1) * REL_PARADAS_POR_PAGINA;
    const fim = Math.min(inicio + REL_PARADAS_POR_PAGINA, total);
    const pagina = relParadasDados.slice(inicio, fim);

    tbody.innerHTML = pagina.map(d => {
        const dataFmt = d._date ? d._date.split('-').reverse().join('/') : '-';
        const duracao = d._duration || 0;
        const startTime = d.startTime || d.start_time || '-';
        const endTime = d.endTime || d.end_time || '-';
        const isActive = !endTime || endTime === '-';
        const statusLabel = isActive ? '<span class="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-bold">Ativa</span>' : '<span class="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-bold">Finalizada</span>';
        const produto = d.product || d.produto || d.mp || '-';
        return `<tr class="border-b border-gray-100 hover:bg-gray-50"><td class="px-3 py-2 text-sm">${dataFmt}</td><td class="px-3 py-2 text-sm font-medium">${d._machine || '-'}</td><td class="px-3 py-2 text-sm">${produto}</td><td class="px-3 py-2 text-sm">${d.reason || '-'}</td><td class="px-3 py-2 text-sm text-center">${startTime}</td><td class="px-3 py-2 text-sm text-center">${endTime}</td><td class="px-3 py-2 text-sm text-center"><span class="px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs font-bold">${duracao}min</span></td><td class="px-3 py-2 text-sm text-center">${statusLabel}</td></tr>`;
    }).join('');

    const el = (id) => document.getElementById(id);
    if (el('rel-paradas-pag-inicio')) el('rel-paradas-pag-inicio').textContent = total > 0 ? inicio + 1 : 0;
    if (el('rel-paradas-pag-fim')) el('rel-paradas-pag-fim').textContent = fim;
    if (el('rel-paradas-pag-total')) el('rel-paradas-pag-total').textContent = total;
    if (el('rel-paradas-pag-atual')) el('rel-paradas-pag-atual').textContent = relParadasPaginaAtual;
    if (el('rel-paradas-pag-total-paginas')) el('rel-paradas-pag-total-paginas').textContent = totalPaginas;
    if (el('rel-paradas-pag-anterior')) el('rel-paradas-pag-anterior').disabled = relParadasPaginaAtual <= 1;
    if (el('rel-paradas-pag-proxima')) el('rel-paradas-pag-proxima').disabled = relParadasPaginaAtual >= totalPaginas;
}

// ─── Exportação CSV ─────────────────────────────────
function exportToCSV(filename, headers, rows) {
    const csvContent = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
}

function relExportarProducaoCSV() {
    if (relProducaoDados.length === 0) { notify('Nenhum dado para exportar', 'warning'); return; }
    const headers = ['Data', 'Máquina', 'Turno', 'OP', 'Código', 'Produto', 'Quantidade', 'Refugo (kg)', 'Cód Usuário', 'Usuário'];
    const rows = relProducaoDados.map(d => [d._date, d._machine, d._shift, d._orderNumber, d._productCode, `"${d._productName}"`, d._qty, (d._scrapKg || 0).toFixed(3), d._userCod, `"${d._user}"`]);
    exportToCSV(`producao_${new Date().toISOString().split('T')[0]}.csv`, headers, rows);
    notify('CSV de produção exportado', 'success');
}

function relExportarPerdasCSV() {
    if (relPerdasDados.length === 0) { notify('Nenhum dado para exportar', 'warning'); return; }
    const headers = ['Data', 'Máquina', 'Turno', 'OP', 'Código', 'Produto', 'Perdas (kg)', 'Motivo', 'Cód Usuário', 'Usuário'];
    const rows = relPerdasDados.map(d => {
        const perdaKg = d._scrapKg > 0 ? d._scrapKg.toFixed(3) : (d._scrap > 0 ? d._scrap + ' pç' : '0');
        return [d._date, d._machine, d._shift, d._orderNumber, d._productCode, `"${d._productName}"`, perdaKg, `"${d._lossReason || ''}"`, d._userCod, `"${d._user}"`];
    });
    exportToCSV(`perdas_${new Date().toISOString().split('T')[0]}.csv`, headers, rows);
    notify('CSV de perdas exportado', 'success');
}

function relExportarParadasCSV() {
    if (relParadasDados.length === 0) { notify('Nenhum dado para exportar', 'warning'); return; }
    const headers = ['Data', 'Máquina', 'Motivo', 'Sub-motivo', 'Duração (min)', 'Observações'];
    const rows = relParadasDados.map(d => [d._date, d._machine, `"${d.reason || ''}"`, `"${d.sub_reason || d.subReason || ''}"`, d._duration, `"${d.observations || d.obs || ''}"`]);
    exportToCSV(`paradas_${new Date().toISOString().split('T')[0]}.csv`, headers, rows);
    notify('CSV de paradas exportado', 'success');
}

// ─── Exportação Tabela (HTML formatado) ──────────────
function openPrintableTable(title, html) {
    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head><title>${title}</title><style>body{font-family:Arial,sans-serif;padding:20px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:8px;text-align:left;font-size:12px}th{background-color:#f5f5f5;font-weight:bold}tr:nth-child(even){background-color:#fafafa}h2{margin-bottom:10px}@media print{body{padding:5mm}}</style></head><body><h2>${title}</h2><p style="color:#666;font-size:12px">Gerado em ${new Date().toLocaleString('pt-BR')}</p>${html}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 500);
}

function relExportarProducaoTabela() {
    if (relProducaoDados.length === 0) { notify('Nenhum dado para exportar', 'warning'); return; }
    let html = '<table><thead><tr><th>Data</th><th>Máquina</th><th>Turno</th><th>OP</th><th>Código</th><th>Produto</th><th>Qtd</th><th>Refugo (kg)</th><th>Cód</th><th>Usuário</th></tr></thead><tbody>';
    relProducaoDados.forEach(d => { const perdaKg = (d._scrapKg || 0); html += `<tr><td>${d._date}</td><td>${d._machine}</td><td>${d._shift}</td><td>${d._orderNumber}</td><td>${d._productCode}</td><td>${d._productName}</td><td style="text-align:right">${d._qty.toLocaleString('pt-BR')}</td><td style="text-align:right">${perdaKg > 0 ? perdaKg.toLocaleString('pt-BR', {minimumFractionDigits:3, maximumFractionDigits:3}) : '-'}</td><td>${d._userCod !== '' ? d._userCod : '-'}</td><td>${d._user}</td></tr>`; });
    html += '</tbody></table>';
    openPrintableTable('Relatório de Produção', html);
}

function relExportarPerdasTabela() {
    if (relPerdasDados.length === 0) { notify('Nenhum dado para exportar', 'warning'); return; }
    let html = '<table><thead><tr><th>Data</th><th>Máquina</th><th>Turno</th><th>OP</th><th>Código</th><th>Produto</th><th>Perdas (kg)</th><th>Motivo</th><th>Cód</th><th>Usuário</th></tr></thead><tbody>';
    relPerdasDados.forEach(d => { const perdaKg = d._scrapKg > 0 ? d._scrapKg : 0; const perdaFmt = perdaKg > 0 ? perdaKg.toLocaleString('pt-BR', {minimumFractionDigits:3, maximumFractionDigits:3}) + ' kg' : (d._scrap > 0 ? d._scrap.toLocaleString('pt-BR') + ' pç' : '-'); html += `<tr><td>${d._date}</td><td>${d._machine}</td><td>${d._shift}</td><td>${d._orderNumber}</td><td>${d._productCode}</td><td>${d._productName}</td><td style="text-align:right;color:red">${perdaFmt}</td><td>${d._lossReason || '-'}</td><td>${d._userCod !== '' ? d._userCod : '-'}</td><td>${d._user}</td></tr>`; });
    html += '</tbody></table>';
    openPrintableTable('Relatório de Perdas', html);
}

function relExportarParadasTabela() {
    if (relParadasDados.length === 0) { notify('Nenhum dado para exportar', 'warning'); return; }
    let html = '<table><thead><tr><th>Data</th><th>Máquina</th><th>Motivo</th><th>Sub-motivo</th><th>Duração</th><th>Obs</th></tr></thead><tbody>';
    relParadasDados.forEach(d => { html += `<tr><td>${d._date}</td><td>${d._machine}</td><td>${d.reason || '-'}</td><td>${d.sub_reason || d.subReason || '-'}</td><td style="text-align:right">${d._duration}min</td><td>${d.observations || d.obs || '-'}</td></tr>`; });
    html += '</tbody></table>';
    openPrintableTable('Relatório de Paradas', html);
}
