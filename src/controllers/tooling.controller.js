/**
 * HokkaidoMES — Ferramentaria Controller (Módulo ES6)
 * Fase 2: Extração #2 — Controle de Moldes
 *
 * Migrado de script.js (linhas ~48215-50383).
 * Zero alteração de lógica — apenas encapsulamento.
 */

import { getDb, serverTimestamp } from '../services/firebase-client.js';
import { EventBus } from '../core/event-bus.js';

// ─── Estado do módulo ────────────────────────────────
const ferramentariaState = {
    moldes: [],
    manutencoes: [],
    filtros: { cliente: '', status: '', busca: '' },
    initialized: false
};

// ─── Helpers ─────────────────────────────────────────
function db() { return getDb(); }

// ── Cache simples para ferramentaria (evita leituras repetidas) ──
let _moldesCache = null;
let _moldesCacheTs = 0;
const _moldesCacheTTL = 300000; // 5 min

function notify(msg, type) {
    if (typeof window.showNotification === 'function') window.showNotification(msg, type);
}

// ─── Setup principal ─────────────────────────────────
export function setupFerramentariaPage() {
    if (ferramentariaState.initialized) {
        console.debug('[Ferram·mod] Já inicializado — recarregando moldes');
        carregarMoldesFerramentaria();
        return;
    }
    console.log('[Ferram·mod] Inicializando módulo...');

    carregarMoldesFerramentaria();

    const filtroCliente = document.getElementById('ferram-filtro-cliente');
    const filtroStatus = document.getElementById('ferram-filtro-status');
    const buscaMolde = document.getElementById('ferram-busca-molde');
    const btnBuscar = document.getElementById('btn-buscar-moldes');

    if (filtroCliente) {
        popularClientesFerramentaria();
        filtroCliente.addEventListener('change', () => { ferramentariaState.filtros.cliente = filtroCliente.value; });
    }
    if (filtroStatus) filtroStatus.addEventListener('change', () => { ferramentariaState.filtros.status = filtroStatus.value; });
    if (buscaMolde) buscaMolde.addEventListener('input', () => { ferramentariaState.filtros.busca = buscaMolde.value; });
    if (btnBuscar) btnBuscar.addEventListener('click', () => renderizarTabelaMoldes());

    const btnNovoMolde = document.getElementById('btn-novo-molde');
    const btnRegistrarManutencao = document.getElementById('btn-registrar-manutencao');
    if (btnNovoMolde) btnNovoMolde.addEventListener('click', abrirModalNovoMolde);
    if (btnRegistrarManutencao) btnRegistrarManutencao.addEventListener('click', abrirModalManutencao);

    setupModalNovoMolde();
    setupModalManutencao();

    ferramentariaState.initialized = true;

    // Expor globais para onclick inline
    window.registrarManutencaoMolde = registrarManutencaoMolde;
    window.editarMolde = editarMolde;
    window.adicionarBatidasManual = adicionarBatidasManual;
    window.atualizarBatidasPorProducao = atualizarBatidasPorProducao;

    EventBus.emit('ferramentaria:initialized');
    console.log('[Ferram·mod] Módulo inicializado com sucesso!');
}

// ─── Popular clientes ────────────────────────────────
function popularClientesFerramentaria() {
    const select = document.getElementById('ferram-filtro-cliente');
    if (!select || !window.ferramentariaDatabase) return;
    const clientes = [...new Set(window.ferramentariaDatabase.map(m => m.client))].sort();
    select.innerHTML = '<option value="">Todos os clientes</option>';
    clientes.forEach(c => { const o = document.createElement('option'); o.value = c; o.textContent = c; select.appendChild(o); });
}

// ─── Carregar moldes ─────────────────────────────────
async function carregarMoldesFerramentaria() {
    console.log('[Ferram·mod] Carregando moldes...');
    try {
        if (!window.ferramentariaDatabase) { console.warn('[Ferram·mod] ferramentariaDatabase não encontrado!'); return; }

        ferramentariaState.moldes = window.ferramentariaDatabase.map((m, i) => ({
            id: `local_${i}`, client: m.client, molde: m.molde,
            batidas_preventiva: m.batidas_preventiva, batidas_atuais: 0, ultima_manutencao: null
        }));

        // OTIMIZADO Fase 2: usar cache para ferramentaria_moldes (full collection, TTL 5min)
        let moldesDocs;
        if (_moldesCache && Date.now() - _moldesCacheTs < _moldesCacheTTL) {
            console.debug('📦 [Ferram·cache] hit: ferramentaria_moldes');
            moldesDocs = _moldesCache;
        } else {
            console.debug('🔥 [Ferram·cache] miss: ferramentaria_moldes');
            const moldesSnapshot = await db().collection('ferramentaria_moldes').get();
            moldesDocs = moldesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            _moldesCache = moldesDocs;
            _moldesCacheTs = Date.now();
        }
        moldesDocs.forEach(data => {
            const local = ferramentariaState.moldes.find(m => m.molde.toLowerCase() === data.molde?.toLowerCase());
            if (local) { local.id = data.id; local.batidas_atuais = data.batidas_atuais || 0; local.ultima_manutencao = data.ultima_manutencao || null; }
        });

        const manutencoesSnapshot = await db().collection('ferramentaria_manutencoes').orderBy('data', 'desc').limit(20).get();
        ferramentariaState.manutencoes = manutencoesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        renderizarTabelaMoldes();
        renderizarHistoricoManutencoes();
    } catch (error) {
        console.error('[Ferram·mod] Erro ao carregar moldes:', error);
        notify('Erro ao carregar moldes', 'error');
    }
}

// ─── Renderizar tabela ──────────────────────────────
function renderizarTabelaMoldes() {
    const tbody = document.getElementById('ferram-tabela-body');
    if (!tbody) return;

    let moldesFiltrados = [...ferramentariaState.moldes];
    if (ferramentariaState.filtros.cliente) moldesFiltrados = moldesFiltrados.filter(m => m.client === ferramentariaState.filtros.cliente);
    if (ferramentariaState.filtros.busca) {
        const b = ferramentariaState.filtros.busca.toLowerCase();
        moldesFiltrados = moldesFiltrados.filter(m => m.molde.toLowerCase().includes(b) || m.client.toLowerCase().includes(b));
    }

    moldesFiltrados = moldesFiltrados.map(m => {
        const progresso = (m.batidas_atuais / m.batidas_preventiva) * 100;
        let status = 'ok'; if (progresso >= 90) status = 'critico'; else if (progresso >= 70) status = 'atencao';
        return { ...m, progresso, status };
    });
    if (ferramentariaState.filtros.status) moldesFiltrados = moldesFiltrados.filter(m => m.status === ferramentariaState.filtros.status);
    moldesFiltrados.sort((a, b) => b.progresso - a.progresso);

    // Stats
    const total = ferramentariaState.moldes.length;
    const criticos = ferramentariaState.moldes.filter(m => (m.batidas_atuais / m.batidas_preventiva) >= 0.9).length;
    const atencao = ferramentariaState.moldes.filter(m => { const p = m.batidas_atuais / m.batidas_preventiva; return p >= 0.7 && p < 0.9; }).length;
    document.getElementById('ferram-total-moldes').textContent = total;
    document.getElementById('ferram-moldes-criticos').textContent = criticos;
    document.getElementById('ferram-moldes-atencao').textContent = atencao;
    document.getElementById('ferram-moldes-ok').textContent = total - criticos - atencao;

    if (moldesFiltrados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center py-12 text-gray-400"><i data-lucide="inbox" class="w-12 h-12 mx-auto mb-2 opacity-50"></i><p>Nenhum molde encontrado com os filtros aplicados</p></td></tr>`;
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }

    tbody.innerHTML = moldesFiltrados.map(m => {
        let statusClass = 'bg-green-100 text-green-700', statusText = 'Normal', statusIcon = 'check-circle', progressColor = 'bg-green-500';
        if (m.status === 'critico') { statusClass = 'bg-red-100 text-red-700'; statusText = 'Crítico'; statusIcon = 'alert-triangle'; progressColor = 'bg-red-500'; }
        else if (m.status === 'atencao') { statusClass = 'bg-yellow-100 text-yellow-700'; statusText = 'Atenção'; statusIcon = 'alert-circle'; progressColor = 'bg-yellow-500'; }
        const ultimaManutencao = m.ultima_manutencao ? new Date(m.ultima_manutencao).toLocaleDateString('pt-BR') : '-';

        return `<tr class="hover:bg-gray-50 transition-colors">
            <td class="px-4 py-3 text-gray-700 font-medium">${m.client}</td>
            <td class="px-4 py-3 text-gray-900 font-semibold">${m.molde}</td>
            <td class="px-4 py-3 text-center font-mono text-gray-700">${m.batidas_atuais.toLocaleString('pt-BR')}</td>
            <td class="px-4 py-3 text-center font-mono text-gray-500">${m.batidas_preventiva.toLocaleString('pt-BR')}</td>
            <td class="px-4 py-3"><div class="w-full bg-gray-200 rounded-full h-4 overflow-hidden"><div class="${progressColor} h-4 rounded-full transition-all flex items-center justify-end pr-1" style="width:${Math.min(m.progresso, 100).toFixed(1)}%"><span class="text-[10px] text-white font-bold">${m.progresso.toFixed(1)}%</span></div></div></td>
            <td class="px-4 py-3 text-center"><span class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${statusClass}"><i data-lucide="${statusIcon}" class="w-3 h-3"></i>${statusText}</span></td>
            <td class="px-4 py-3 text-center text-gray-600 text-sm">${ultimaManutencao}</td>
            <td class="px-4 py-3 text-center"><div class="flex justify-center gap-1">
                <button onclick="registrarManutencaoMolde('${m.molde}')" class="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition" title="Registrar Manutenção"><i data-lucide="check-circle" class="w-4 h-4"></i></button>
                <button onclick="editarMolde('${m.id}')" class="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Editar"><i data-lucide="edit-2" class="w-4 h-4"></i></button>
                <button onclick="adicionarBatidasManual('${m.molde}')" class="p-1.5 text-orange-600 hover:bg-orange-50 rounded-lg transition" title="Adicionar Batidas"><i data-lucide="plus" class="w-4 h-4"></i></button>
            </div></td></tr>`;
    }).join('');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ─── Histórico manutenções ──────────────────────────
function renderizarHistoricoManutencoes() {
    const container = document.getElementById('ferram-historico');
    if (!container) return;
    if (ferramentariaState.manutencoes.length === 0) {
        container.innerHTML = `<div class="text-center py-6 text-gray-400"><i data-lucide="clipboard-list" class="w-8 h-8 mx-auto mb-2 opacity-50"></i><p class="text-sm">Nenhuma manutenção registrada</p></div>`;
        if (typeof lucide !== 'undefined') lucide.createIcons(); return;
    }
    container.innerHTML = ferramentariaState.manutencoes.map(m => {
        const data = m.data ? new Date(m.data).toLocaleDateString('pt-BR') : '-';
        const tipoClass = m.tipo === 'preventiva' ? 'bg-blue-100 text-blue-700' : m.tipo === 'corretiva' ? 'bg-orange-100 text-orange-700' : 'bg-purple-100 text-purple-700';
        return `<div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100"><div class="p-2 bg-green-100 rounded-full"><i data-lucide="check" class="w-4 h-4 text-green-600"></i></div><div class="flex-1 min-w-0"><p class="font-semibold text-gray-800 truncate">${m.molde || '-'}</p><p class="text-xs text-gray-500">${m.responsavel || '-'} • ${data}</p></div><span class="px-2 py-1 rounded text-xs font-semibold ${tipoClass}">${(m.tipo || 'preventiva').toUpperCase()}</span></div>`;
    }).join('');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ─── Modais ─────────────────────────────────────────
function setupModalNovoMolde() {
    const modal = document.getElementById('novo-molde-modal');
    const btnClose = document.getElementById('novo-molde-close');
    const btnCancel = document.getElementById('novo-molde-cancel');
    const btnSave = document.getElementById('novo-molde-save');
    if (btnClose) btnClose.addEventListener('click', fecharModalNovoMolde);
    if (btnCancel) btnCancel.addEventListener('click', fecharModalNovoMolde);
    if (btnSave) btnSave.addEventListener('click', salvarMolde);
    if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) fecharModalNovoMolde(); });
}

function setupModalManutencao() {
    const modal = document.getElementById('manutencao-molde-modal');
    const btnClose = document.getElementById('manutencao-molde-close');
    const btnCancel = document.getElementById('manutencao-molde-cancel');
    const btnSave = document.getElementById('manutencao-molde-save');
    const selectMolde = document.getElementById('manutencao-molde-select');
    if (btnClose) btnClose.addEventListener('click', fecharModalManutencao);
    if (btnCancel) btnCancel.addEventListener('click', fecharModalManutencao);
    if (btnSave) btnSave.addEventListener('click', salvarManutencao);
    if (selectMolde) selectMolde.addEventListener('change', () => atualizarInfoMoldeManutencao(selectMolde.value));
    if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) fecharModalManutencao(); });
}

function abrirModalNovoMolde() {
    const modal = document.getElementById('novo-molde-modal');
    const titulo = document.getElementById('novo-molde-titulo');
    const form = document.getElementById('novo-molde-form');
    if (titulo) titulo.textContent = 'Cadastrar Novo Molde';
    if (form) form.reset();
    document.getElementById('edit-molde-id').value = '';
    if (modal) { modal.classList.remove('hidden'); if (typeof lucide !== 'undefined') lucide.createIcons(); }
}

function fecharModalNovoMolde() { const m = document.getElementById('novo-molde-modal'); if (m) m.classList.add('hidden'); }

function abrirModalManutencao(moldeNome = null) {
    const modal = document.getElementById('manutencao-molde-modal');
    const form = document.getElementById('manutencao-molde-form');
    const selectMolde = document.getElementById('manutencao-molde-select');
    const dataInput = document.getElementById('manutencao-data');
    if (form) form.reset();
    if (selectMolde) {
        selectMolde.innerHTML = '<option value="">Selecione o molde</option>';
        ferramentariaState.moldes.forEach(m => { const o = document.createElement('option'); o.value = m.molde; o.textContent = `${m.client} - ${m.molde}`; selectMolde.appendChild(o); });
        if (moldeNome) { selectMolde.value = moldeNome; atualizarInfoMoldeManutencao(moldeNome); }
    }
    if (dataInput) dataInput.value = new Date().toISOString().split('T')[0];
    if (modal) { modal.classList.remove('hidden'); if (typeof lucide !== 'undefined') lucide.createIcons(); }
}

function fecharModalManutencao() { const m = document.getElementById('manutencao-molde-modal'); if (m) m.classList.add('hidden'); }

function atualizarInfoMoldeManutencao(moldeNome) {
    const infoContainer = document.getElementById('manutencao-info-molde');
    const molde = ferramentariaState.moldes.find(m => m.molde === moldeNome);
    if (!molde || !infoContainer) { if (infoContainer) infoContainer.classList.add('hidden'); return; }
    const progresso = (molde.batidas_atuais / molde.batidas_preventiva) * 100;
    let progressoClass = 'text-green-600';
    if (progresso >= 90) progressoClass = 'text-red-600 font-bold';
    else if (progresso >= 70) progressoClass = 'text-yellow-600';
    document.getElementById('manutencao-info-cliente').textContent = molde.client;
    document.getElementById('manutencao-info-batidas').textContent = molde.batidas_atuais.toLocaleString('pt-BR');
    document.getElementById('manutencao-info-limite').textContent = molde.batidas_preventiva.toLocaleString('pt-BR');
    const el = document.getElementById('manutencao-info-progresso');
    el.textContent = `${progresso.toFixed(1)}%`; el.className = `font-semibold ml-1 ${progressoClass}`;
    infoContainer.classList.remove('hidden');
}

// ─── CRUD ───────────────────────────────────────────
async function salvarMolde() {
    const cliente = document.getElementById('novo-molde-cliente').value.trim();
    const nome = document.getElementById('novo-molde-nome').value.trim();
    const batidasLimite = parseInt(document.getElementById('novo-molde-batidas-limite').value) || 0;
    const batidasAtuais = parseInt(document.getElementById('novo-molde-batidas-atuais').value) || 0;
    const editId = document.getElementById('edit-molde-id').value;
    if (!cliente || !nome || batidasLimite < 1000) { notify('Preencha todos os campos obrigatórios', 'warning'); return; }
    try {
        const dados = { client: cliente, molde: nome, batidas_preventiva: batidasLimite, batidas_atuais: batidasAtuais, atualizado_em: new Date().toISOString() };
        if (editId && !editId.startsWith('local_')) { await db().collection('ferramentaria_moldes').doc(editId).update(dados); notify('Molde atualizado com sucesso!', 'success'); }
        else { await db().collection('ferramentaria_moldes').add(dados); notify('Molde cadastrado com sucesso!', 'success'); }
        fecharModalNovoMolde(); carregarMoldesFerramentaria();
    } catch (error) { console.error('[Ferram·mod] Erro ao salvar molde:', error); notify('Erro ao salvar molde', 'error'); }
}

async function salvarManutencao() {
    const moldeNome = document.getElementById('manutencao-molde-select').value;
    const data = document.getElementById('manutencao-data').value;
    const tipo = document.getElementById('manutencao-tipo').value;
    const responsavel = document.getElementById('manutencao-responsavel').value.trim();
    const obs = document.getElementById('manutencao-obs').value.trim();
    if (!moldeNome || !data || !responsavel) { notify('Preencha todos os campos obrigatórios', 'warning'); return; }
    const molde = ferramentariaState.moldes.find(m => m.molde === moldeNome);
    if (!molde) { notify('Molde não encontrado', 'error'); return; }
    try {
        await db().collection('ferramentaria_manutencoes').add({ molde: moldeNome, cliente: molde.client, data, tipo, responsavel, observacao: obs, batidas_zeradas: molde.batidas_atuais, registrado_em: new Date().toISOString() });
        const query = await db().collection('ferramentaria_moldes').where('molde', '==', moldeNome).get();
        if (query.empty) { await db().collection('ferramentaria_moldes').add({ client: molde.client, molde: moldeNome, batidas_preventiva: molde.batidas_preventiva, batidas_atuais: 0, ultima_manutencao: data }); }
        else { query.forEach(async (doc) => { await doc.ref.update({ batidas_atuais: 0, ultima_manutencao: data }); }); }
        notify('Manutenção registrada! Contador zerado.', 'success');
        fecharModalManutencao(); carregarMoldesFerramentaria();
    } catch (error) { console.error('[Ferram·mod] Erro ao salvar manutenção:', error); notify('Erro ao registrar manutenção', 'error'); }
}

function registrarManutencaoMolde(moldeNome) { abrirModalManutencao(moldeNome); }

function editarMolde(moldeId) {
    const molde = ferramentariaState.moldes.find(m => m.id === moldeId);
    if (!molde) return;
    document.getElementById('edit-molde-id').value = moldeId;
    document.getElementById('novo-molde-cliente').value = molde.client;
    document.getElementById('novo-molde-nome').value = molde.molde;
    document.getElementById('novo-molde-batidas-limite').value = molde.batidas_preventiva;
    document.getElementById('novo-molde-batidas-atuais').value = molde.batidas_atuais;
    const titulo = document.getElementById('novo-molde-titulo'); if (titulo) titulo.textContent = 'Editar Molde';
    const modal = document.getElementById('novo-molde-modal');
    if (modal) { modal.classList.remove('hidden'); if (typeof lucide !== 'undefined') lucide.createIcons(); }
}

async function adicionarBatidasManual(moldeNome) {
    const quantidade = prompt(`Quantas batidas deseja adicionar ao molde "${moldeNome}"?`, '1000');
    if (!quantidade || isNaN(parseInt(quantidade))) return;
    const batidas = parseInt(quantidade);
    if (batidas <= 0) { notify('Quantidade deve ser maior que zero', 'warning'); return; }
    try {
        const molde = ferramentariaState.moldes.find(m => m.molde === moldeNome); if (!molde) return;
        const novasBatidas = molde.batidas_atuais + batidas;
        const query = await db().collection('ferramentaria_moldes').where('molde', '==', moldeNome).get();
        if (query.empty) { await db().collection('ferramentaria_moldes').add({ client: molde.client, molde: moldeNome, batidas_preventiva: molde.batidas_preventiva, batidas_atuais: novasBatidas, ultima_manutencao: null }); }
        else { query.forEach(async (doc) => { await doc.ref.update({ batidas_atuais: novasBatidas }); }); }
        notify(`${batidas.toLocaleString('pt-BR')} batidas adicionadas!`, 'success'); carregarMoldesFerramentaria();
    } catch (error) { console.error('[Ferram·mod] Erro ao adicionar batidas:', error); notify('Erro ao adicionar batidas', 'error'); }
}

// ─── Integração automática batidas por produção ─────
async function atualizarBatidasPorProducao(productCod, quantidadeProduzida) {
    try {
        if (!productCod || !quantidadeProduzida || quantidadeProduzida <= 0) return { success: false, reason: 'dados_invalidos' };
        if (!window.moldePorProduto) return { success: false, reason: 'mapeamento_nao_carregado' };
        const nomeMolde = window.moldePorProduto[productCod];
        if (!nomeMolde) return { success: false, reason: 'produto_nao_mapeado' };

        let cavidades = 1;
        if (window.productDatabase) {
            const produto = window.productDatabase.find(p => p.cod == productCod);
            if (produto && produto.cavities && produto.cavities > 0) cavidades = produto.cavities;
        }
        const batidasNovas = Math.round(quantidadeProduzida / cavidades);
        if (batidasNovas <= 0) return { success: false, reason: 'batidas_zero' };

        console.log(`[Ferram·mod] ${quantidadeProduzida} peças / ${cavidades} cav = ${batidasNovas} batidas para "${nomeMolde}"`);

        const moldesRef = db().collection('ferramentaria_moldes');
        const query = await moldesRef.where('molde', '==', nomeMolde).get();

        if (!query.empty) {
            const doc = query.docs[0];
            const batidasAtuais = doc.data().batidas_atuais || 0;
            const novoTotal = batidasAtuais + batidasNovas;
            await doc.ref.update({ batidas_atuais: novoTotal, ultima_atualizacao: serverTimestamp(), ultima_producao: { product_cod: productCod, quantidade: quantidadeProduzida, batidas: batidasNovas, data: new Date().toISOString() } });
            console.log(`[Ferram·mod] Molde "${nomeMolde}": ${batidasAtuais} → ${novoTotal} (+${batidasNovas})`);
            const moldeLocal = window.ferramentariaDatabase?.find(m => m.molde === nomeMolde);
            if (moldeLocal) {
                const pct = (novoTotal / moldeLocal.batidas_preventiva) * 100;
                if (pct >= 90) console.warn(`[Ferram·mod] ALERTA CRÍTICO: "${nomeMolde}" em ${pct.toFixed(1)}%!`);
                else if (pct >= 70) console.warn(`[Ferram·mod] ATENÇÃO: "${nomeMolde}" em ${pct.toFixed(1)}%`);
            }
            return { success: true, molde: nomeMolde, batidasAdicionadas: batidasNovas, totalBatidas: novoTotal, cavidades };
        } else {
            const moldeLocal = window.ferramentariaDatabase?.find(m => m.molde === nomeMolde);
            if (moldeLocal) {
                await moldesRef.add({ client: moldeLocal.client, molde: nomeMolde, batidas_preventiva: moldeLocal.batidas_preventiva, batidas_atuais: batidasNovas, ultima_manutencao: null, criado_em: serverTimestamp(), ultima_atualizacao: serverTimestamp(), ultima_producao: { product_cod: productCod, quantidade: quantidadeProduzida, batidas: batidasNovas, data: new Date().toISOString() } });
                return { success: true, molde: nomeMolde, batidasAdicionadas: batidasNovas, totalBatidas: batidasNovas, cavidades, novo: true };
            }
            return { success: false, reason: 'molde_nao_encontrado' };
        }
    } catch (error) {
        console.error('[Ferram·mod] Erro ao atualizar batidas:', error);
        return { success: false, reason: 'erro', error: error.message };
    }
}
