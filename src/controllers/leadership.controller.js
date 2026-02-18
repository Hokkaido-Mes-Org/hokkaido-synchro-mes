/**
 * HokkaidoMES — Liderança Produção Controller (Módulo ES6)
 * Fase 2: Extração #4 — Escalas de operadores + Absenteísmo
 *
 * Migrado de script.js (linhas ~44014-47087).
 * Zero alteração de lógica — apenas encapsulamento.
 */

import { getDb, serverTimestamp } from '../services/firebase-client.js';
import { EventBus } from '../core/event-bus.js';

// ─── Estado do módulo ────────────────────────────────
let liderancaProducaoInitialized = false;
let escalaEmEdicao = null;
let escalasAdicionadasSessao = 0;

// Absenteísmo
let absenteismoInitialized = false;
let absChartTipo = null;
let absChartEvolucao = null;
let absChartTurno = null;
let absChartDiaSemana = null;

const TIPOS_AUSENCIA = {
    'falta_nao_justificada': { label: 'Falta não justificada', color: '#ef4444', bgColor: 'bg-red-100 text-red-700' },
    'atestado': { label: 'Atestado Médico', color: '#eab308', bgColor: 'bg-yellow-100 text-yellow-700' },
    'folga_aniversario': { label: 'Folga Aniversário', color: '#a855f7', bgColor: 'bg-purple-100 text-purple-700' },
    'ferias': { label: 'Férias', color: '#10b981', bgColor: 'bg-emerald-100 text-emerald-700' },
    'atraso': { label: 'Atraso', color: '#f97316', bgColor: 'bg-orange-100 text-orange-700' },
    'hokkaido_day': { label: 'Dia Hokkaido', color: '#0ea5e9', bgColor: 'bg-sky-100 text-sky-700' },
    'outros': { label: 'Outros', color: '#6b7280', bgColor: 'bg-gray-100 text-gray-700' }
};

const USUARIOS_ABSENTEISMO_AUTORIZADOS = [
    'leandro.camargo', 'leandro camargo', 'leandro de camargo',
    'linaldo', 'luciano',
    'tiago.oliveira', 'tiago oliveira',
    'michelle.benjamin', 'michelle benjamim', 'michelle benjamin',
    'davi.batista', 'davi batista'
];

// ─── Helpers ─────────────────────────────────────────
function db() { return getDb(); }

function getLiderancaDateString(date = new Date()) {
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

function liderancaDebounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => { clearTimeout(timeout); func(...args); };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function getLiderancaCurrentUserName() {
    if (window.authSystem && window.authSystem.getCurrentUser()) {
        return window.authSystem.getCurrentUser().name || 'Sistema';
    }
    return 'Sistema';
}

function liderancaShowToast(message, type = 'info') {
    if (typeof window.showNotification === 'function') { window.showNotification(message, type); return; }
    const toast = document.createElement('div');
    const bgColor = type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500';
    toast.className = `fixed bottom-4 right-4 ${bgColor} text-white px-6 py-3 rounded-lg shadow-lg z-50 transition-all transform translate-y-0 opacity-100`;
    toast.innerHTML = `<div class="flex items-center gap-2"><span>${message}</span></div>`;
    document.body.appendChild(toast);
    setTimeout(() => { toast.classList.add('opacity-0', 'translate-y-4'); setTimeout(() => toast.remove(), 300); }, 4000);
}

function formatarDataBR(dataStr) {
    if (!dataStr) return '';
    const [ano, mes, dia] = dataStr.split('-');
    return `${dia}/${mes}/${ano}`;
}

// ─── Setup principal ─────────────────────────────────
export function setupLiderancaProducaoPage() {
    if (liderancaProducaoInitialized) {
        console.log('[Lid·mod] Página já inicializada');
        loadEscalas();
        return;
    }
    console.log('[Lid·mod] Inicializando página...');

    const escalaDataInput = document.getElementById('escala-data');
    if (escalaDataInput) escalaDataInput.value = getLiderancaDateString();

    const btnNovaEscala = document.getElementById('btn-nova-escala');
    if (btnNovaEscala) btnNovaEscala.addEventListener('click', openNovaEscalaModal);
    const btnBuscarEscalas = document.getElementById('btn-buscar-escalas');
    if (btnBuscarEscalas) btnBuscarEscalas.addEventListener('click', loadEscalas);

    setupNovaEscalaModal();
    loadEscalas();
    liderancaProducaoInitialized = true;
    if (typeof lucide !== 'undefined') lucide.createIcons();

    // Expor globais
    window.editarEscala = editarEscala;
    window.excluirEscala = excluirEscala;
    window.switchLiderancaTab = switchLiderancaTab;
    window.switchAbsenteismoSubTab = switchAbsenteismoSubTab;
    window.buscarHistoricoAbsenteismo = buscarHistoricoAbsenteismo;
    window.excluirAbsenteismo = excluirAbsenteismo;
    window.atualizarDashboardAbsenteismo = atualizarDashboardAbsenteismo;
    window.togglePeriodoPersonalizado = togglePeriodoPersonalizado;
    window.verificarAcessoAbsenteismo = verificarAcessoAbsenteismo;
    window.updateMaquinasCount = updateMaquinasCount;

    // Ocultar aba absenteísmo se sem permissão
    setTimeout(ocultarAbaAbsenteismoNaoAutorizado, 500);

    EventBus.emit('lideranca:initialized');
    console.log('[Lid·mod] Página inicializada com sucesso');
}

// ═══════════════════════════════════════
//  ESCALAS
// ═══════════════════════════════════════

function setupNovaEscalaModal() {
    const modal = document.getElementById('nova-escala-modal');
    const codOperadorInput = document.getElementById('nova-escala-cod-operador');
    const selectAllBtn = document.getElementById('nova-escala-select-all');
    const clearAllBtn = document.getElementById('nova-escala-clear-all');
    const closeBtn = document.getElementById('nova-escala-close');
    const cancelBtn = document.getElementById('nova-escala-cancel');
    const saveBtn = document.getElementById('nova-escala-save');
    const saveContinueBtn = document.getElementById('nova-escala-save-continue');

    populateNovaEscalaMaquinasGrid();
    if (codOperadorInput) {
        codOperadorInput.addEventListener('input', liderancaDebounce(buscarOperadorEscala, 300));
        codOperadorInput.addEventListener('change', buscarOperadorEscala);
    }
    if (closeBtn) closeBtn.addEventListener('click', closeNovaEscalaModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeNovaEscalaModal);
    if (saveBtn) saveBtn.addEventListener('click', () => salvarNovaEscala(false));
    if (saveContinueBtn) saveContinueBtn.addEventListener('click', () => salvarNovaEscala(true));
    if (selectAllBtn) selectAllBtn.addEventListener('click', () => { document.querySelectorAll('#nova-escala-maquinas-grid input[type="checkbox"]').forEach(cb => cb.checked = true); updateMaquinasCount(); });
    if (clearAllBtn) clearAllBtn.addEventListener('click', () => { document.querySelectorAll('#nova-escala-maquinas-grid input[type="checkbox"]').forEach(cb => cb.checked = false); updateMaquinasCount(); });
    if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) closeNovaEscalaModal(); });
}

function populateNovaEscalaMaquinasGrid() {
    const grid = document.getElementById('nova-escala-maquinas-grid');
    if (!grid) return;
    const machines = window.machineDatabase || [];
    grid.innerHTML = machines.map(machine => `<label class="flex items-center gap-2 p-2 bg-white rounded-lg border border-gray-200 hover:border-violet-400 hover:bg-violet-50 cursor-pointer transition-all"><input type="checkbox" name="escala-maquina" value="${machine.id}" class="rounded border-gray-300 text-violet-600 focus:ring-violet-500" onchange="updateMaquinasCount()"><span class="text-sm font-medium text-gray-700">${machine.id}</span></label>`).join('');
}

function updateMaquinasCount() {
    const countEl = document.getElementById('nova-escala-count');
    if (!countEl) return;
    const checkboxes = document.querySelectorAll('#nova-escala-maquinas-grid input[type="checkbox"]:checked');
    countEl.textContent = `${checkboxes.length} máquinas selecionadas`;
}

function buscarOperadorEscala() {
    const codInput = document.getElementById('nova-escala-cod-operador');
    const nomeInput = document.getElementById('nova-escala-nome-operador');
    const infoEl = document.getElementById('nova-escala-operador-info');
    const erroEl = document.getElementById('nova-escala-operador-erro');
    if (!codInput || !nomeInput || !infoEl || !erroEl) return;
    const codigo = parseInt(codInput.value);
    if (isNaN(codigo)) { nomeInput.value = ''; infoEl.classList.add('hidden'); erroEl.classList.add('hidden'); return; }
    const users = window.userDatabase || [];
    const operador = users.find(u => u.cod === codigo);
    if (operador) { nomeInput.value = operador.nomeCompleto || operador.nomeUsuario; infoEl.classList.remove('hidden'); erroEl.classList.add('hidden'); }
    else { nomeInput.value = ''; infoEl.classList.add('hidden'); erroEl.classList.remove('hidden'); }
}

function openNovaEscalaModal() {
    const modal = document.getElementById('nova-escala-modal');
    if (!modal) return;
    escalaEmEdicao = null;
    escalasAdicionadasSessao = 0;
    atualizarContadorEscalasSessao();
    const modalTitle = modal.querySelector('h3');
    if (modalTitle) modalTitle.textContent = 'Nova Escala de Operador';
    const dataInput = document.getElementById('nova-escala-data');
    const escalaDataInput = document.getElementById('escala-data');
    const form = document.getElementById('nova-escala-form');
    if (form) form.reset();
    document.querySelectorAll('#nova-escala-maquinas-grid input[type="checkbox"]').forEach(cb => cb.checked = false);
    updateMaquinasCount();
    const nomeInput = document.getElementById('nova-escala-nome-operador');
    const infoEl = document.getElementById('nova-escala-operador-info');
    const erroEl = document.getElementById('nova-escala-operador-erro');
    if (nomeInput) nomeInput.value = '';
    if (infoEl) infoEl.classList.add('hidden');
    if (erroEl) erroEl.classList.add('hidden');
    if (dataInput) dataInput.value = escalaDataInput?.value || getLiderancaDateString();
    modal.classList.remove('hidden');
    setTimeout(() => { document.getElementById('nova-escala-cod-operador')?.focus(); }, 100);
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function atualizarContadorEscalasSessao() {
    const infoEl = document.getElementById('nova-escala-sessao-info');
    const contadorEl = document.getElementById('nova-escala-contador');
    if (infoEl && contadorEl) {
        if (escalasAdicionadasSessao > 0) { infoEl.classList.remove('hidden'); contadorEl.textContent = escalasAdicionadasSessao; }
        else { infoEl.classList.add('hidden'); }
    }
}

function limparFormularioParaProximaEscala() {
    const codInput = document.getElementById('nova-escala-cod-operador');
    const nomeInput = document.getElementById('nova-escala-nome-operador');
    const infoEl = document.getElementById('nova-escala-operador-info');
    const erroEl = document.getElementById('nova-escala-operador-erro');
    const obsInput = document.getElementById('nova-escala-obs');
    if (codInput) codInput.value = '';
    if (nomeInput) nomeInput.value = '';
    if (infoEl) infoEl.classList.add('hidden');
    if (erroEl) erroEl.classList.add('hidden');
    if (obsInput) obsInput.value = '';
    document.querySelectorAll('#nova-escala-maquinas-grid input[type="checkbox"]').forEach(cb => cb.checked = false);
    updateMaquinasCount();
    setTimeout(() => { document.getElementById('nova-escala-cod-operador')?.focus(); }, 100);
}

async function editarEscala(escalaId) {
    const modal = document.getElementById('nova-escala-modal');
    if (!modal) return;
    try {
        const doc = await db().collection('escalas_operadores').doc(escalaId).get();
        if (!doc.exists) { liderancaShowToast('Escala não encontrada', 'error'); return; }
        const escala = doc.data();
        escalaEmEdicao = escalaId;
        const modalTitle = modal.querySelector('h3');
        if (modalTitle) modalTitle.textContent = 'Editar Escala de Operador';
        document.getElementById('nova-escala-data').value = escala.data;
        document.getElementById('nova-escala-turno').value = escala.turno;
        document.getElementById('nova-escala-cod-operador').value = escala.operadorCod;
        document.getElementById('nova-escala-nome-operador').value = escala.operadorNome || escala.operadorUser;
        document.getElementById('nova-escala-obs').value = escala.observacoes || '';
        document.getElementById('nova-escala-operador-info')?.classList.remove('hidden');
        document.getElementById('nova-escala-operador-erro')?.classList.add('hidden');
        document.querySelectorAll('#nova-escala-maquinas-grid input[type="checkbox"]').forEach(cb => { cb.checked = (escala.maquinas || []).includes(cb.value); });
        updateMaquinasCount();
        modal.classList.remove('hidden');
        if (typeof lucide !== 'undefined') lucide.createIcons();
    } catch (error) {
        console.error('[Lid·mod] Erro ao carregar escala para edição:', error);
        liderancaShowToast('Erro ao carregar escala', 'error');
    }
}

function closeNovaEscalaModal() {
    const modal = document.getElementById('nova-escala-modal');
    if (modal) modal.classList.add('hidden');
    escalaEmEdicao = null;
    if (escalasAdicionadasSessao > 0) loadEscalas();
    escalasAdicionadasSessao = 0;
}

async function salvarNovaEscala(continuarAdicionando = false) {
    const dataInput = document.getElementById('nova-escala-data');
    const turnoInput = document.getElementById('nova-escala-turno');
    const codOperadorInput = document.getElementById('nova-escala-cod-operador');
    const obsInput = document.getElementById('nova-escala-obs');

    if (!dataInput?.value) { liderancaShowToast('Selecione a data da escala', 'error'); return; }
    if (!turnoInput?.value) { liderancaShowToast('Selecione o turno', 'error'); return; }
    if (!codOperadorInput?.value) { liderancaShowToast('Informe o código do operador', 'error'); return; }

    const codigo = parseInt(codOperadorInput.value);
    const users = window.userDatabase || [];
    const operador = users.find(u => u.cod === codigo);
    if (!operador) { liderancaShowToast('Operador não encontrado no sistema', 'error'); return; }

    const maquinasSelecionadas = Array.from(document.querySelectorAll('#nova-escala-maquinas-grid input[type="checkbox"]:checked')).map(cb => cb.value);
    if (maquinasSelecionadas.length === 0) { liderancaShowToast('Selecione pelo menos uma máquina', 'error'); return; }

    const escalaData = {
        data: dataInput.value, turno: parseInt(turnoInput.value),
        operadorCod: operador.cod, operadorNome: operador.nomeCompleto || operador.nomeUsuario,
        operadorUser: operador.nomeUsuario, maquinas: maquinasSelecionadas,
        observacoes: obsInput?.value || '', atualizadoEm: serverTimestamp()
    };
    if (!escalaEmEdicao) { escalaData.criadoPor = getLiderancaCurrentUserName(); escalaData.criadoEm = serverTimestamp(); }
    else { escalaData.editadoPor = getLiderancaCurrentUserName(); }

    try {
        if (escalaEmEdicao) {
            await db().collection('escalas_operadores').doc(escalaEmEdicao).update(escalaData);
            liderancaShowToast(`Escala atualizada com sucesso! ${operador.nomeUsuario} → ${maquinasSelecionadas.join(', ')}`, 'success');
            closeNovaEscalaModal(); loadEscalas();
        } else {
            await db().collection('escalas_operadores').add(escalaData);
            escalasAdicionadasSessao++;
            atualizarContadorEscalasSessao();
            liderancaShowToast(`✓ Escala salva! ${operador.nomeUsuario} → ${maquinasSelecionadas.join(', ')}`, 'success');
            if (continuarAdicionando) limparFormularioParaProximaEscala();
            else { closeNovaEscalaModal(); loadEscalas(); }
        }
    } catch (error) {
        console.error('[Lid·mod] Erro ao salvar escala:', error);
        liderancaShowToast('Erro ao salvar escala: ' + error.message, 'error');
    }
}

async function loadEscalas() {
    const dataInput = document.getElementById('escala-data');
    const turnoSelect = document.getElementById('escala-turno');
    const data = dataInput?.value || getLiderancaDateString();
    const turnoFiltro = turnoSelect?.value || '';
    console.log('[Lid·mod] Carregando escalas:', { data, turno: turnoFiltro });
    try {
        let query = db().collection('escalas_operadores').where('data', '==', data);
        if (turnoFiltro) query = query.where('turno', '==', parseInt(turnoFiltro));
        const snapshot = await query.get();
        const escalas = [];
        snapshot.forEach(doc => { escalas.push({ id: doc.id, ...doc.data() }); });
        console.log('[Lid·mod] Escalas encontradas:', escalas.length);
        updateEscalaStats(escalas);
        renderEscalaFluxograma(escalas);
        renderEscalaLista(escalas);
    } catch (error) {
        console.error('[Lid·mod] Erro ao carregar escalas:', error);
        liderancaShowToast('Erro ao carregar escalas', 'error');
    }
}

function updateEscalaStats(escalas) {
    const totalOperadores = document.getElementById('escala-total-operadores');
    const totalMaquinas = document.getElementById('escala-total-maquinas');
    const operadoresUnicos = new Set(escalas.map(e => e.operadorCod));
    if (totalOperadores) totalOperadores.textContent = operadoresUnicos.size;
    const maquinasCobertas = new Set();
    escalas.forEach(e => { if (e.maquinas && Array.isArray(e.maquinas)) e.maquinas.forEach(m => maquinasCobertas.add(m)); });
    if (totalMaquinas) totalMaquinas.textContent = maquinasCobertas.size;
}

function renderEscalaFluxograma(escalas) {
    const container = document.getElementById('escala-fluxograma');
    if (!container) return;
    if (escalas.length === 0) {
        container.innerHTML = `<div class="text-center py-12 text-gray-400 col-span-full"><i data-lucide="calendar-search" class="w-12 h-12 mx-auto mb-2 opacity-50"></i><p>Nenhuma escala cadastrada para esta data</p></div>`;
        if (typeof lucide !== 'undefined') lucide.createIcons(); return;
    }
    const turnoColors = { 1: { bg: 'bg-amber-50', border: 'border-amber-300', badge: 'bg-amber-500', text: 'text-amber-700' }, 2: { bg: 'bg-sky-50', border: 'border-sky-300', badge: 'bg-sky-500', text: 'text-sky-700' }, 3: { bg: 'bg-violet-50', border: 'border-violet-300', badge: 'bg-violet-500', text: 'text-violet-700' } };
    const turnoLabels = { 1: '1º Turno', 2: '2º Turno', 3: '3º Turno' };
    const operadoresMap = {};
    escalas.forEach(escala => {
        const key = `${escala.operadorCod}-${escala.turno}`;
        if (!operadoresMap[key]) operadoresMap[key] = { cod: escala.operadorCod, nome: escala.operadorNome || escala.operadorUser, user: escala.operadorUser, turno: escala.turno, maquinas: [] };
        operadoresMap[key].maquinas.push(...(escala.maquinas || []));
    });
    Object.values(operadoresMap).forEach(op => { op.maquinas = [...new Set(op.maquinas)].sort((a, b) => parseInt(a.replace(/\D/g, '')) - parseInt(b.replace(/\D/g, ''))); });
    const operadoresOrdenados = Object.values(operadoresMap).sort((a, b) => a.turno !== b.turno ? a.turno - b.turno : a.nome.localeCompare(b.nome));
    container.innerHTML = operadoresOrdenados.map(op => {
        const colors = turnoColors[op.turno] || turnoColors[1];
        return `<div class="p-4 rounded-2xl border-2 ${colors.bg} ${colors.border} transition-all hover:shadow-lg hover:-translate-y-1"><div class="flex items-center gap-3 mb-3"><div class="w-12 h-12 rounded-xl ${colors.badge} flex items-center justify-center shadow-md"><i data-lucide="user" class="w-6 h-6 text-white"></i></div><div class="flex-1 min-w-0"><div class="font-bold text-gray-800 text-base truncate">${op.nome}</div><div class="flex items-center gap-2"><span class="text-xs text-gray-500">Cód: ${op.cod}</span><span class="px-2 py-0.5 text-[10px] font-bold rounded-full ${colors.badge} text-white">${turnoLabels[op.turno]}</span></div></div></div><div class="flex flex-wrap gap-2">${op.maquinas.map(maq => `<div class="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-lg border border-gray-200 shadow-sm"><div class="w-5 h-5 rounded bg-emerald-500 flex items-center justify-center"><i data-lucide="cpu" class="w-3 h-3 text-white"></i></div><span class="font-semibold text-gray-700 text-sm">${maq}</span></div>`).join('')}</div><div class="mt-3 pt-2 border-t ${colors.border} border-opacity-50 text-xs ${colors.text} font-medium flex items-center gap-1"><i data-lucide="check-circle" class="w-3.5 h-3.5"></i>${op.maquinas.length} máquina${op.maquinas.length > 1 ? 's' : ''} atribuída${op.maquinas.length > 1 ? 's' : ''}</div></div>`;
    }).join('');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function renderEscalaLista(escalas) {
    const container = document.getElementById('escala-lista');
    if (!container) return;
    if (escalas.length === 0) {
        container.innerHTML = `<div class="text-center py-8 text-gray-400"><i data-lucide="inbox" class="w-12 h-12 mx-auto mb-2 opacity-50"></i><p>Nenhuma escala cadastrada para esta data</p></div>`;
        if (typeof lucide !== 'undefined') lucide.createIcons(); return;
    }
    const turnoLabels = { 1: '1º Turno', 2: '2º Turno', 3: '3º Turno' };
    const turnoColors = { 1: 'bg-yellow-100 text-yellow-800', 2: 'bg-blue-100 text-blue-800', 3: 'bg-purple-100 text-purple-800' };
    container.innerHTML = escalas.map(escala => `<div class="p-4 bg-white rounded-xl border border-gray-200 hover:shadow-md transition-all"><div class="flex items-start justify-between gap-4"><div class="flex-1"><div class="flex items-center gap-3 mb-2"><div class="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center"><i data-lucide="user" class="w-5 h-5 text-violet-600"></i></div><div><div class="font-semibold text-gray-800">${escala.operadorNome || escala.operadorUser}</div><div class="text-xs text-gray-500">Código: ${escala.operadorCod}</div></div></div><div class="flex flex-wrap gap-2 mt-3"><span class="px-2 py-1 text-xs font-medium rounded-full ${turnoColors[escala.turno] || 'bg-gray-100 text-gray-700'}">${turnoLabels[escala.turno] || 'Turno ' + escala.turno}</span>${(escala.maquinas || []).map(m => `<span class="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">${m}</span>`).join('')}</div>${escala.observacoes ? `<div class="mt-2 text-xs text-gray-500 italic">${escala.observacoes}</div>` : ''}</div><div class="flex flex-col gap-2"><button onclick="editarEscala('${escala.id}')" class="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Editar escala"><i data-lucide="pencil" class="w-4 h-4"></i></button><button onclick="excluirEscala('${escala.id}')" class="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Excluir escala"><i data-lucide="trash-2" class="w-4 h-4"></i></button></div></div></div>`).join('');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function excluirEscala(escalaId) {
    if (!confirm('Tem certeza que deseja excluir esta escala?')) return;
    try {
        await db().collection('escalas_operadores').doc(escalaId).delete();
        liderancaShowToast('Escala excluída com sucesso', 'success');
        loadEscalas();
    } catch (error) {
        console.error('[Lid·mod] Erro ao excluir escala:', error);
        liderancaShowToast('Erro ao excluir escala', 'error');
    }
}

// ═══════════════════════════════════════
//  TAB SWITCHING
// ═══════════════════════════════════════

function switchLiderancaTab(tab) {
    if (tab === 'absenteismo' && !verificarAcessoAbsenteismo()) { liderancaShowToast('Você não tem permissão para acessar o módulo de Absenteísmo', 'error'); return; }
    document.querySelectorAll('.lideranca-tab').forEach(t => { t.classList.remove('border-violet-600', 'text-violet-600', 'bg-white', '-mb-px', 'border-b-2'); t.classList.add('text-gray-500'); });
    document.querySelectorAll('.lideranca-content').forEach(c => c.classList.add('hidden'));
    const activeTab = document.getElementById(`tab-${tab}`);
    if (activeTab) { activeTab.classList.add('border-b-2', 'border-violet-600', 'text-violet-600', 'bg-white', '-mb-px'); activeTab.classList.remove('text-gray-500'); }
    const content = document.getElementById(`content-${tab}`);
    if (content) content.classList.remove('hidden');
    if (tab === 'absenteismo' && !absenteismoInitialized) initAbsenteismoModule();
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function switchAbsenteismoSubTab(subtab) {
    document.querySelectorAll('.absenteismo-subtab').forEach(t => { t.classList.remove('border-orange-500', 'text-orange-600', 'bg-white', '-mb-px', 'border-b-2'); t.classList.add('text-gray-500'); });
    document.querySelectorAll('.absenteismo-subcontent').forEach(c => c.classList.add('hidden'));
    const activeSubTab = document.getElementById(`subtab-${subtab}`);
    if (activeSubTab) { activeSubTab.classList.add('border-b-2', 'border-orange-500', 'text-orange-600', 'bg-white', '-mb-px'); activeSubTab.classList.remove('text-gray-500'); }
    const subcontent = document.getElementById(`subcontent-${subtab}`);
    if (subcontent) subcontent.classList.remove('hidden');
    if (subtab === 'historico') initHistoricoFiltros();
    else if (subtab === 'dashboard') atualizarDashboardAbsenteismo();
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ═══════════════════════════════════════
//  ABSENTEÍSMO
// ═══════════════════════════════════════

function verificarAcessoAbsenteismo() {
    try {
        const userSession = localStorage.getItem('synchro_user') || sessionStorage.getItem('synchro_user');
        if (!userSession) return false;
        const user = JSON.parse(userSession);
        const userName = (user.name || user.username || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const userLogin = (user.username || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return USUARIOS_ABSENTEISMO_AUTORIZADOS.some(autorizado => {
            const autNorm = autorizado.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            return userName.includes(autNorm) || userLogin.includes(autNorm) || autNorm.includes(userLogin);
        });
    } catch (e) { return false; }
}

function ocultarAbaAbsenteismoNaoAutorizado() {
    const tabAbsenteismo = document.getElementById('tab-absenteismo');
    if (tabAbsenteismo && !verificarAcessoAbsenteismo()) { tabAbsenteismo.style.display = 'none'; }
}

function initAbsenteismoModule() {
    const codInput = document.getElementById('abs-cod-operador');
    if (codInput) { codInput.addEventListener('input', liderancaDebounce(buscarOperadorAbsenteismo, 300)); codInput.addEventListener('change', buscarOperadorAbsenteismo); }
    const dataInput = document.getElementById('abs-data');
    if (dataInput) dataInput.value = getLiderancaDateString();

    document.querySelectorAll('input[name="abs-tipo"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const atrasoContainer = document.getElementById('abs-atraso-container');
            const feriasContainer = document.getElementById('abs-ferias-container');
            const dataContainer = document.getElementById('abs-data')?.parentElement;
            if (atrasoContainer) atrasoContainer.classList.toggle('hidden', e.target.value !== 'atraso');
            if (feriasContainer) feriasContainer.classList.toggle('hidden', e.target.value !== 'ferias');
            if (dataContainer) { dataContainer.style.opacity = e.target.value === 'ferias' ? '0.5' : '1'; dataContainer.querySelector('input').disabled = e.target.value === 'ferias'; }
        });
    });

    const form = document.getElementById('form-absenteismo');
    if (form) {
        form.addEventListener('submit', async (e) => { e.preventDefault(); await registrarAbsenteismo(); });
        form.addEventListener('reset', () => {
            const nomeInput = document.getElementById('abs-nome-operador');
            const erroEl = document.getElementById('abs-operador-erro');
            const atrasoContainer = document.getElementById('abs-atraso-container');
            const feriasContainer = document.getElementById('abs-ferias-container');
            const dataContainer = document.getElementById('abs-data')?.parentElement;
            if (nomeInput) nomeInput.value = '';
            if (erroEl) erroEl.classList.add('hidden');
            if (atrasoContainer) atrasoContainer.classList.add('hidden');
            if (feriasContainer) feriasContainer.classList.add('hidden');
            if (dataContainer) { dataContainer.style.opacity = '1'; dataContainer.querySelector('input').disabled = false; }
        });
    }
    absenteismoInitialized = true;
}

function buscarOperadorAbsenteismo() {
    const codInput = document.getElementById('abs-cod-operador');
    const nomeInput = document.getElementById('abs-nome-operador');
    const erroEl = document.getElementById('abs-operador-erro');
    if (!codInput || !nomeInput || !erroEl) return;
    const codigo = parseInt(codInput.value);
    if (isNaN(codigo) || codigo <= 0) { nomeInput.value = ''; erroEl.classList.add('hidden'); return; }
    const users = window.userDatabase || [];
    const operador = users.find(u => u.cod === codigo);
    if (operador) { nomeInput.value = operador.nomeCompleto || operador.nomeUsuario; erroEl.classList.add('hidden'); }
    else { nomeInput.value = ''; erroEl.classList.remove('hidden'); }
}

async function registrarAbsenteismo() {
    const codOperador = parseInt(document.getElementById('abs-cod-operador').value);
    const nomeOperador = document.getElementById('abs-nome-operador').value;
    const data = document.getElementById('abs-data').value;
    const turno = document.getElementById('abs-turno').value;
    const tipoRadio = document.querySelector('input[name="abs-tipo"]:checked');
    const tempoAtraso = document.getElementById('abs-tempo-atraso')?.value;
    const observacoes = document.getElementById('abs-observacoes').value.trim();
    const feriasInicio = document.getElementById('abs-ferias-inicio')?.value;
    const feriasFim = document.getElementById('abs-ferias-fim')?.value;

    if (!codOperador || !nomeOperador) { liderancaShowToast('Operador inválido ou não encontrado', 'error'); return; }
    if (!tipoRadio) { liderancaShowToast('Selecione o tipo de ausência', 'error'); return; }
    const tipo = tipoRadio.value;

    if (tipo === 'ferias') {
        if (!feriasInicio || !feriasFim) { liderancaShowToast('Informe o período de férias (início e fim)', 'error'); return; }
        if (feriasInicio > feriasFim) { liderancaShowToast('Data de início deve ser anterior à data de fim', 'error'); return; }
        if (!turno) { liderancaShowToast('Selecione o turno', 'error'); return; }
        await registrarFeriasMultiplosDias(codOperador, nomeOperador, turno, feriasInicio, feriasFim, observacoes);
        return;
    }

    if (!data || !turno) { liderancaShowToast('Preencha todos os campos obrigatórios', 'error'); return; }

    try {
        const existente = await db().collection('absenteismo').where('operadorCod', '==', codOperador).where('data', '==', data).where('turno', '==', parseInt(turno)).get();
        if (!existente.empty) { liderancaShowToast('Já existe registro de ausência para este operador nesta data/turno', 'error'); return; }
        const registro = { operadorCod: codOperador, operadorNome: nomeOperador, data, turno: parseInt(turno), tipo, tipoLabel: TIPOS_AUSENCIA[tipo]?.label || tipo, tempoAtraso: tipo === 'atraso' ? (parseInt(tempoAtraso) || 0) : null, observacoes: observacoes || null, registradoPor: getLiderancaCurrentUserName(), criadoEm: serverTimestamp(), atualizadoEm: serverTimestamp() };
        await db().collection('absenteismo').add(registro);
        liderancaShowToast('Ausência registrada com sucesso!', 'success');
        document.getElementById('form-absenteismo').reset();
        document.getElementById('abs-data').value = getLiderancaDateString();
    } catch (error) { console.error('[Lid·mod] Erro ao registrar:', error); liderancaShowToast('Erro ao registrar ausência', 'error'); }
}

async function registrarFeriasMultiplosDias(codOperador, nomeOperador, turno, dataInicio, dataFim, observacoes) {
    try {
        const batch = db().batch();
        const inicio = new Date(dataInicio + 'T00:00:00');
        const fim = new Date(dataFim + 'T00:00:00');
        const diasRegistrados = [], diasExistentes = [];
        const currentDate = new Date(inicio);
        while (currentDate <= fim) {
            const diaSemana = currentDate.getDay();
            if (diaSemana !== 0 && diaSemana !== 6) {
                const dataStr = currentDate.toISOString().split('T')[0];
                const existente = await db().collection('absenteismo').where('operadorCod', '==', codOperador).where('data', '==', dataStr).where('turno', '==', parseInt(turno)).get();
                if (existente.empty) {
                    const docRef = db().collection('absenteismo').doc();
                    batch.set(docRef, { operadorCod: codOperador, operadorNome: nomeOperador, data: dataStr, turno: parseInt(turno), tipo: 'ferias', tipoLabel: TIPOS_AUSENCIA['ferias'].label, feriasInicio: dataInicio, feriasFim: dataFim, observacoes: observacoes || `Férias de ${formatarDataBR(dataInicio)} a ${formatarDataBR(dataFim)}`, registradoPor: getLiderancaCurrentUserName(), criadoEm: serverTimestamp(), atualizadoEm: serverTimestamp() });
                    diasRegistrados.push(dataStr);
                } else { diasExistentes.push(dataStr); }
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }
        if (diasRegistrados.length > 0) await batch.commit();
        let mensagem = '';
        if (diasRegistrados.length > 0) mensagem = `Férias registradas para ${diasRegistrados.length} dia(s) útil(eis)`;
        if (diasExistentes.length > 0) { mensagem += mensagem ? '. ' : ''; mensagem += `${diasExistentes.length} dia(s) já possuíam registro`; }
        if (diasRegistrados.length > 0) liderancaShowToast(mensagem, 'success');
        else liderancaShowToast('Nenhum dia foi registrado (todos já possuem registro)', 'warning');
        document.getElementById('form-absenteismo').reset();
        document.getElementById('abs-data').value = getLiderancaDateString();
        document.getElementById('abs-ferias-container')?.classList.add('hidden');
    } catch (error) { console.error('[Lid·mod] Erro ao registrar férias:', error); liderancaShowToast('Erro ao registrar férias', 'error'); }
}

function initHistoricoFiltros() {
    const dataInicio = document.getElementById('abs-hist-data-inicio');
    const dataFim = document.getElementById('abs-hist-data-fim');
    if (dataInicio && dataFim) {
        const hoje = new Date();
        const trintaDiasAtras = new Date();
        trintaDiasAtras.setDate(hoje.getDate() - 30);
        dataFim.value = getLiderancaDateString(hoje);
        dataInicio.value = getLiderancaDateString(trintaDiasAtras);
    }
}

async function buscarHistoricoAbsenteismo() {
    const dataInicio = document.getElementById('abs-hist-data-inicio').value;
    const dataFim = document.getElementById('abs-hist-data-fim').value;
    const tipo = document.getElementById('abs-hist-tipo').value;
    const codOperador = document.getElementById('abs-hist-cod').value;
    if (!dataInicio || !dataFim) { liderancaShowToast('Selecione o período', 'error'); return; }
    try {
        let query = db().collection('absenteismo').where('data', '>=', dataInicio).where('data', '<=', dataFim).orderBy('data', 'desc');
        const snapshot = await query.get();
        let registros = [];
        snapshot.forEach(doc => { const data = { id: doc.id, ...doc.data() }; if (tipo && data.tipo !== tipo) return; if (codOperador && data.operadorCod !== parseInt(codOperador)) return; registros.push(data); });
        atualizarEstatisticasHistorico(registros);
        renderizarListaHistorico(registros);
    } catch (error) { console.error('[Lid·mod] Erro ao buscar histórico:', error); liderancaShowToast('Erro ao buscar histórico', 'error'); }
}

function atualizarEstatisticasHistorico(registros) {
    const stats = { falta: 0, atestado: 0, aniversario: 0, ferias: 0, atraso: 0, hokkaido: 0, total: registros.length };
    registros.forEach(r => { switch (r.tipo) { case 'falta_nao_justificada': stats.falta++; break; case 'atestado': stats.atestado++; break; case 'folga_aniversario': stats.aniversario++; break; case 'ferias': stats.ferias++; break; case 'atraso': stats.atraso++; break; case 'hokkaido_day': stats.hokkaido++; break; } });
    const el = (id) => document.getElementById(id);
    if (el('abs-stat-falta')) el('abs-stat-falta').textContent = stats.falta;
    if (el('abs-stat-atestado')) el('abs-stat-atestado').textContent = stats.atestado;
    if (el('abs-stat-aniversario')) el('abs-stat-aniversario').textContent = stats.aniversario;
    if (el('abs-stat-ferias')) el('abs-stat-ferias').textContent = stats.ferias;
    if (el('abs-stat-atraso')) el('abs-stat-atraso').textContent = stats.atraso;
    if (el('abs-stat-hokkaido')) el('abs-stat-hokkaido').textContent = stats.hokkaido;
    if (el('abs-stat-total')) el('abs-stat-total').textContent = stats.total;
}

function renderizarListaHistorico(registros) {
    const tbody = document.getElementById('abs-historico-lista');
    if (!tbody) return;
    if (registros.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-12 text-gray-400"><i data-lucide="inbox" class="w-12 h-12 mx-auto mb-2 opacity-50"></i><p>Nenhum registro encontrado para o período</p></td></tr>`;
        if (typeof lucide !== 'undefined') lucide.createIcons(); return;
    }
    const turnoLabels = { 1: '1º Turno', 2: '2º Turno', 3: '3º Turno' };
    tbody.innerHTML = registros.map(r => {
        const tipoInfo = TIPOS_AUSENCIA[r.tipo] || { label: r.tipo, bgColor: 'bg-gray-100 text-gray-700' };
        const dataFormatada = r.data.split('-').reverse().join('/');
        return `<tr class="border-b border-gray-100 hover:bg-gray-50"><td class="p-3 font-medium">${dataFormatada}</td><td class="p-3"><div class="font-medium text-gray-800">${r.operadorNome}</div><div class="text-xs text-gray-500">Cód: ${r.operadorCod}</div></td><td class="p-3 text-sm">${turnoLabels[r.turno] || r.turno}</td><td class="p-3"><span class="px-2 py-1 text-xs font-medium rounded-full ${tipoInfo.bgColor}">${tipoInfo.label}</span>${r.tipo === 'atraso' && r.tempoAtraso ? `<span class="ml-1 text-xs text-gray-500">(${r.tempoAtraso} min)</span>` : ''}</td><td class="p-3 text-sm text-gray-600 max-w-xs truncate">${r.observacoes || '-'}</td><td class="p-3 text-center"><button onclick="excluirAbsenteismo('${r.id}')" class="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition" title="Excluir"><i data-lucide="trash-2" class="w-4 h-4"></i></button></td></tr>`;
    }).join('');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function excluirAbsenteismo(id) {
    if (!confirm('Tem certeza que deseja excluir este registro?')) return;
    try { await db().collection('absenteismo').doc(id).delete(); liderancaShowToast('Registro excluído com sucesso', 'success'); buscarHistoricoAbsenteismo(); }
    catch (error) { console.error('[Lid·mod] Erro ao excluir:', error); liderancaShowToast('Erro ao excluir registro', 'error'); }
}

// ─── Dashboard Absenteísmo ──────────────────────────
async function atualizarDashboardAbsenteismo() {
    const periodoSelect = document.getElementById('abs-dash-periodo')?.value;
    const filtroTurno = document.getElementById('abs-dash-turno')?.value;
    const filtroTipo = document.getElementById('abs-dash-tipo')?.value;
    let dataInicioStr, dataFimStr, periodo;

    if (periodoSelect === 'custom') {
        dataInicioStr = document.getElementById('abs-dash-custom-inicio')?.value;
        dataFimStr = document.getElementById('abs-dash-custom-fim')?.value;
        if (!dataInicioStr || !dataFimStr) { liderancaShowToast('Selecione as datas do período personalizado', 'error'); return; }
        periodo = Math.ceil((new Date(dataFimStr) - new Date(dataInicioStr)) / (1000 * 60 * 60 * 24)) + 1;
    } else {
        periodo = parseInt(periodoSelect || 30);
        const dataFim = new Date(); const dataInicio = new Date(); dataInicio.setDate(dataInicio.getDate() - periodo);
        dataInicioStr = getLiderancaDateString(dataInicio); dataFimStr = getLiderancaDateString(dataFim);
    }

    try {
        const snapshot = await db().collection('absenteismo').where('data', '>=', dataInicioStr).where('data', '<=', dataFimStr).orderBy('data', 'asc').get();
        let registros = []; snapshot.forEach(doc => registros.push({ id: doc.id, ...doc.data() }));
        if (filtroTurno) registros = registros.filter(r => r.turno === parseInt(filtroTurno));
        if (filtroTipo) registros = registros.filter(r => r.tipo === filtroTipo);

        const totalOperadores = (window.userDatabase || []).length;
        const colaboradoresAfetados = new Set(registros.map(r => r.operadorCod)).size;
        const totalOcorrencias = registros.length;
        const mediaDiaria = periodo > 0 ? (totalOcorrencias / periodo).toFixed(1) : 0;
        const taxaAbsenteismo = totalOperadores > 0 ? ((colaboradoresAfetados / totalOperadores) * 100).toFixed(1) : 0;

        const el = (id) => document.getElementById(id);
        if (el('abs-dash-taxa')) el('abs-dash-taxa').textContent = `${taxaAbsenteismo}%`;
        if (el('abs-dash-total')) el('abs-dash-total').textContent = totalOcorrencias;
        if (el('abs-dash-colaboradores')) el('abs-dash-colaboradores').textContent = colaboradoresAfetados;
        if (el('abs-dash-media')) el('abs-dash-media').textContent = mediaDiaria;

        gerarGraficoPorTipo(registros);
        gerarGraficoEvolucao(registros, periodo, dataInicioStr);
        gerarGraficoPorTurno(registros);
        gerarGraficoDiaSemana(registros);
        gerarTopOperadores(registros);
    } catch (error) { console.error('[Lid·mod] Erro ao atualizar dashboard:', error); liderancaShowToast('Erro ao carregar dashboard', 'error'); }
}

function togglePeriodoPersonalizado() {
    const periodo = document.getElementById('abs-dash-periodo')?.value;
    const inicioContainer = document.getElementById('abs-dash-custom-inicio-container');
    const fimContainer = document.getElementById('abs-dash-custom-fim-container');
    const isCustom = periodo === 'custom';
    if (inicioContainer) inicioContainer.classList.toggle('hidden', !isCustom);
    if (fimContainer) fimContainer.classList.toggle('hidden', !isCustom);
    if (!isCustom) atualizarDashboardAbsenteismo();
}

// ─── Gráficos Absenteísmo (Chart.js) ────────────────
function gerarGraficoPorTipo(registros) {
    const ctx = document.getElementById('abs-chart-tipo');
    if (!ctx) return;
    const contagem = {};
    Object.keys(TIPOS_AUSENCIA).forEach(tipo => contagem[tipo] = 0);
    registros.forEach(r => { if (contagem.hasOwnProperty(r.tipo)) contagem[r.tipo]++; });
    const labels = [], data = [], colors = [];
    Object.entries(TIPOS_AUSENCIA).forEach(([key, info]) => { if (contagem[key] > 0) { labels.push(info.label); data.push(contagem[key]); colors.push(info.color); } });
    if (absChartTipo) absChartTipo.destroy();
    if (data.length === 0) { ctx.parentElement.innerHTML = '<div class="h-64 flex items-center justify-center text-gray-400">Sem dados para o período</div>'; return; }
    absChartTipo = new Chart(ctx, { type: 'doughnut', data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: '#fff' }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { font: { size: 11 } } } } } });
}

function gerarGraficoEvolucao(registros, periodo, dataInicioStr = null) {
    const ctx = document.getElementById('abs-chart-evolucao');
    if (!ctx) return;
    const contagemDiaria = {};
    registros.forEach(r => { contagemDiaria[r.data] = (contagemDiaria[r.data] || 0) + 1; });
    const labels = [], data = [];
    const startDate = dataInicioStr ? new Date(dataInicioStr + 'T00:00:00') : (() => { const d = new Date(); d.setDate(d.getDate() - periodo + 1); return d; })();
    for (let i = 0; i < periodo; i++) {
        const date = new Date(startDate); date.setDate(startDate.getDate() + i);
        const dateStr = getLiderancaDateString(date);
        labels.push(date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));
        data.push(contagemDiaria[dateStr] || 0);
    }
    if (absChartEvolucao) absChartEvolucao.destroy();
    absChartEvolucao = new Chart(ctx, { type: 'line', data: { labels, datasets: [{ label: 'Ausências', data, borderColor: '#8b5cf6', backgroundColor: 'rgba(139,92,246,0.1)', fill: true, tension: 0.3, pointRadius: periodo > 30 ? 0 : 3, pointHoverRadius: 5 }] }, options: { responsive: true, maintainAspectRatio: false, scales: { x: { ticks: { maxTicksLimit: 15, font: { size: 10 } } }, y: { beginAtZero: true, ticks: { stepSize: 1 } } }, plugins: { legend: { display: false } } } });
}

function gerarGraficoPorTurno(registros) {
    const ctx = document.getElementById('abs-chart-turno');
    if (!ctx) return;
    const contagem = { 1: 0, 2: 0, 3: 0 };
    registros.forEach(r => { if (contagem.hasOwnProperty(r.turno)) contagem[r.turno]++; });
    if (absChartTurno) absChartTurno.destroy();
    absChartTurno = new Chart(ctx, { type: 'bar', data: { labels: ['1º Turno', '2º Turno', '3º Turno'], datasets: [{ label: 'Ausências', data: [contagem[1], contagem[2], contagem[3]], backgroundColor: ['#fbbf24', '#3b82f6', '#8b5cf6'], borderRadius: 8 }] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }, plugins: { legend: { display: false } } } });
}

function gerarGraficoDiaSemana(registros) {
    const ctx = document.getElementById('abs-chart-diasemana');
    if (!ctx) return;
    const diasSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const contagem = [0, 0, 0, 0, 0, 0, 0];
    registros.forEach(r => { const [ano, mes, dia] = r.data.split('-').map(Number); contagem[new Date(ano, mes - 1, dia).getDay()]++; });
    if (absChartDiaSemana) absChartDiaSemana.destroy();
    absChartDiaSemana = new Chart(ctx, { type: 'bar', data: { labels: diasSemana, datasets: [{ label: 'Ausências', data: contagem, backgroundColor: ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'], borderRadius: 6 }] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }, plugins: { legend: { display: false } } } });
}

function gerarTopOperadores(registros) {
    const table = document.getElementById('abs-top-operadores');
    if (!table) return;
    const registrosSemFerias = registros.filter(r => r.tipo !== 'ferias');
    const contagem = {};
    registrosSemFerias.forEach(r => { const key = r.operadorCod; if (!contagem[key]) contagem[key] = { cod: r.operadorCod, nome: r.operadorNome, total: 0 }; contagem[key].total++; });
    const ranking = Object.values(contagem).sort((a, b) => b.total - a.total).slice(0, 10);
    const tbody = table.querySelector('tbody');
    if (!tbody) return;
    if (ranking.length === 0) { tbody.innerHTML = '<tr><td colspan="3" class="text-center py-8 text-gray-400">Sem dados para o período</td></tr>'; return; }
    tbody.innerHTML = ranking.map((op, idx) => `<tr class="border-b border-gray-100 hover:bg-gray-50"><td class="p-2 font-bold ${idx < 3 ? 'text-red-500' : 'text-gray-500'}">${idx + 1}º</td><td class="p-2"><div class="font-medium text-gray-800">${op.nome}</div><div class="text-xs text-gray-500">Cód: ${op.cod}</div></td><td class="p-2 text-center"><span class="px-3 py-1 bg-red-100 text-red-700 font-bold rounded-full">${op.total}</span></td></tr>`).join('');
}
