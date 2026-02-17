/**
 * HokkaidoMES — Setup de Máquinas Controller (Módulo ES6)
 * Fase 2: Extração #3 — Registro e análise de setups
 *
 * Migrado de script.js (linhas ~47087-48213).
 * Zero alteração de lógica — apenas encapsulamento.
 */

import { getDb, serverTimestamp } from '../services/firebase-client.js';
import { EventBus } from '../core/event-bus.js';

// ─── Estado do módulo ────────────────────────────────
let setupEmEdicao = null;
let setupPaginaAtual = 1;
const SETUP_POR_PAGINA = 20;
let setupDadosAtuais = [];

let setupCharts = {
    tipo: null,
    maquina: null,
    tempoMaquina: null,
    diario: null,
    distribuicaoTempo: null
};

// ─── Helpers ─────────────────────────────────────────
function db() { return getDb(); }

function setupShowToast(message, type = 'info') {
    if (typeof window.showToast === 'function') {
        window.showToast(message, type);
    } else if (window.authSystem && typeof window.authSystem.showToast === 'function') {
        window.authSystem.showToast(message, type);
    } else {
        const toast = document.createElement('div');
        toast.className = `fixed bottom-4 right-4 px-4 py-3 rounded-lg shadow-lg z-[9999] text-white font-medium ${
            type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500'
        }`;
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }
}

function getSetupDateString(date) {
    const d = date || new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getSetupCurrentUserName() {
    if (window.authSystem && window.authSystem.currentUser) {
        return window.authSystem.currentUser.nome || window.authSystem.currentUser.usuario || 'Sistema';
    }
    const userData = localStorage.getItem('userSession');
    if (userData) {
        try { const user = JSON.parse(userData); return user.nome || user.usuario || 'Sistema'; } catch (e) {}
    }
    return 'Sistema';
}

// ─── Setup principal ─────────────────────────────────
export function setupSetupMaquinasPage() {
    console.log('[Setup·mod] Inicializando módulo de Setup de Máquinas');

    const page = document.getElementById('setup-maquinas-page');
    if (!page) return;

    const periodoSelect = document.getElementById('setup-periodo');
    const customDateRange = document.getElementById('setup-custom-date-range');
    const dataInicio = document.getElementById('setup-data-inicio');
    const dataFim = document.getElementById('setup-data-fim');

    if (periodoSelect) {
        periodoSelect.addEventListener('change', () => {
            if (periodoSelect.value === 'custom') customDateRange?.classList.remove('hidden');
            else customDateRange?.classList.add('hidden');
        });
        periodoSelect.value = '7days';
    }

    if (dataInicio && dataFim) {
        const hoje = new Date();
        const seteDiasAtras = new Date();
        seteDiasAtras.setDate(hoje.getDate() - 7);
        dataFim.value = getSetupDateString(hoje);
        dataInicio.value = getSetupDateString(seteDiasAtras);
    }

    popularSelectMaquinas();
    setupNovoSetupModal();
    setupChartsToggle();
    setupPaginacaoEventos();

    const btnBuscar = document.getElementById('btn-buscar-setups');
    if (btnBuscar) btnBuscar.addEventListener('click', loadSetups);

    loadSetups();

    // Expor globais para onclick inline
    window.editarSetup = editarSetup;
    window.excluirSetup = excluirSetup;
    window.setupSetupMaquinasPage = setupSetupMaquinasPage;
    window.renderSetupCharts = renderSetupCharts;

    EventBus.emit('setup:initialized');
    console.log('[Setup·mod] Módulo inicializado com sucesso!');
}

// ─── Paginação ──────────────────────────────────────
function setupPaginacaoEventos() {
    const btnPrimeira = document.getElementById('setup-pag-primeira');
    const btnAnterior = document.getElementById('setup-pag-anterior');
    const btnProxima = document.getElementById('setup-pag-proxima');
    const btnUltima = document.getElementById('setup-pag-ultima');

    if (btnPrimeira) btnPrimeira.addEventListener('click', () => { if (setupPaginaAtual > 1) { setupPaginaAtual = 1; renderSetupTabelaPaginada(); } });
    if (btnAnterior) btnAnterior.addEventListener('click', () => { if (setupPaginaAtual > 1) { setupPaginaAtual--; renderSetupTabelaPaginada(); } });
    if (btnProxima) btnProxima.addEventListener('click', () => { const tp = Math.ceil(setupDadosAtuais.length / SETUP_POR_PAGINA); if (setupPaginaAtual < tp) { setupPaginaAtual++; renderSetupTabelaPaginada(); } });
    if (btnUltima) btnUltima.addEventListener('click', () => { const tp = Math.ceil(setupDadosAtuais.length / SETUP_POR_PAGINA); if (setupPaginaAtual < tp) { setupPaginaAtual = tp; renderSetupTabelaPaginada(); } });
}

function renderSetupTabelaPaginada() {
    const totalRegistros = setupDadosAtuais.length;
    const totalPaginas = Math.ceil(totalRegistros / SETUP_POR_PAGINA) || 1;
    if (setupPaginaAtual > totalPaginas) setupPaginaAtual = totalPaginas;
    if (setupPaginaAtual < 1) setupPaginaAtual = 1;
    const inicio = (setupPaginaAtual - 1) * SETUP_POR_PAGINA;
    const fim = Math.min(inicio + SETUP_POR_PAGINA, totalRegistros);
    renderSetupTabelaInterno(setupDadosAtuais.slice(inicio, fim));
    atualizarControlesPaginacao(inicio + 1, fim, totalRegistros, totalPaginas);
}

function atualizarControlesPaginacao(inicio, fim, total, totalPaginas) {
    const elInicio = document.getElementById('setup-pag-inicio');
    const elFim = document.getElementById('setup-pag-fim');
    const elTotal = document.getElementById('setup-pag-total');
    const elPagAtual = document.getElementById('setup-pag-atual');
    const elTotalPaginas = document.getElementById('setup-pag-total-paginas');
    if (elInicio) elInicio.textContent = total > 0 ? inicio : 0;
    if (elFim) elFim.textContent = fim;
    if (elTotal) elTotal.textContent = total;
    if (elPagAtual) elPagAtual.textContent = setupPaginaAtual;
    if (elTotalPaginas) elTotalPaginas.textContent = totalPaginas;

    const btnPrimeira = document.getElementById('setup-pag-primeira');
    const btnAnterior = document.getElementById('setup-pag-anterior');
    const btnProxima = document.getElementById('setup-pag-proxima');
    const btnUltima = document.getElementById('setup-pag-ultima');
    const naPrimeira = setupPaginaAtual <= 1;
    const naUltima = setupPaginaAtual >= totalPaginas;
    if (btnPrimeira) btnPrimeira.disabled = naPrimeira;
    if (btnAnterior) btnAnterior.disabled = naPrimeira;
    if (btnProxima) btnProxima.disabled = naUltima;
    if (btnUltima) btnUltima.disabled = naUltima;
}

// ─── Popular máquinas ───────────────────────────────
function popularSelectMaquinas() {
    const selectModal = document.getElementById('novo-setup-maquina');
    const selectFiltro = document.getElementById('setup-filtro-maquina');
    const machines = window.machineDatabase || [];
    const options = machines.map(m => `<option value="${m.id}">${m.id} - ${m.model}</option>`).join('');
    if (selectModal) selectModal.innerHTML = '<option value="">Selecione a máquina</option>' + options;
    if (selectFiltro) selectFiltro.innerHTML = '<option value="">Todas as máquinas</option>' + options;
}

// ─── Modal novo setup ───────────────────────────────
function setupNovoSetupModal() {
    const modal = document.getElementById('novo-setup-modal');
    const btnNovo = document.getElementById('btn-novo-setup');
    const btnClose = document.getElementById('novo-setup-close');
    const btnCancel = document.getElementById('novo-setup-cancel');
    const btnSave = document.getElementById('novo-setup-save');
    const horaInicio = document.getElementById('novo-setup-hora-inicio');
    const horaFim = document.getElementById('novo-setup-hora-fim');
    if (!modal) return;

    if (btnNovo) {
        btnNovo.addEventListener('click', () => {
            setupEmEdicao = null;
            document.getElementById('setup-modal-titulo').textContent = 'Novo Registro de Setup';
            document.getElementById('novo-setup-form').reset();
            document.getElementById('novo-setup-data').value = getSetupDateString();
            document.getElementById('novo-setup-duracao').textContent = '';
            modal.classList.remove('hidden');
            if (typeof lucide !== 'undefined') lucide.createIcons();
        });
    }

    const fecharModal = () => { modal.classList.add('hidden'); setupEmEdicao = null; };
    if (btnClose) btnClose.addEventListener('click', fecharModal);
    if (btnCancel) btnCancel.addEventListener('click', fecharModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) fecharModal(); });

    const calcularDuracao = () => {
        const inicio = horaInicio?.value;
        const fim = horaFim?.value;
        const duracaoSpan = document.getElementById('novo-setup-duracao');
        if (inicio && fim && duracaoSpan) {
            const [hI, mI] = inicio.split(':').map(Number);
            const [hF, mF] = fim.split(':').map(Number);
            let minutos = (hF * 60 + mF) - (hI * 60 + mI);
            if (minutos < 0) minutos += 24 * 60;
            const horas = Math.floor(minutos / 60);
            const mins = minutos % 60;
            duracaoSpan.textContent = horas > 0 ? `Duração: ${horas}h ${mins}min` : `Duração: ${mins} minutos`;
        }
    };
    if (horaInicio) horaInicio.addEventListener('change', calcularDuracao);
    if (horaFim) horaFim.addEventListener('change', calcularDuracao);
    if (btnSave) btnSave.addEventListener('click', salvarSetup);
}

// ─── CRUD ───────────────────────────────────────────
async function salvarSetup() {
    const data = document.getElementById('novo-setup-data')?.value;
    const maquina = document.getElementById('novo-setup-maquina')?.value;
    const molde = document.getElementById('novo-setup-molde')?.value?.trim();
    const tipo = document.querySelector('input[name="setup-tipo"]:checked')?.value;
    const horaInicio = document.getElementById('novo-setup-hora-inicio')?.value;
    const horaFim = document.getElementById('novo-setup-hora-fim')?.value;
    const observacao = document.getElementById('novo-setup-obs')?.value?.trim() || '';

    if (!data || !maquina || !molde || !tipo || !horaInicio || !horaFim) {
        setupShowToast('Preencha todos os campos obrigatórios', 'error'); return;
    }

    const [hI, mI] = horaInicio.split(':').map(Number);
    const [hF, mF] = horaFim.split(':').map(Number);
    let duracaoMinutos = (hF * 60 + mF) - (hI * 60 + mI);
    if (duracaoMinutos < 0) duracaoMinutos += 24 * 60;

    try {
        const dadosSetup = { data, maquina, molde, tipo, horaInicio, horaFim, duracaoMinutos, observacao, criadoPor: getSetupCurrentUserName(), atualizadoEm: serverTimestamp() };
        if (setupEmEdicao) {
            await db().collection('setups_maquinas').doc(setupEmEdicao).update(dadosSetup);
            setupShowToast('Setup atualizado com sucesso!', 'success');
        } else {
            dadosSetup.criadoEm = serverTimestamp();
            await db().collection('setups_maquinas').add(dadosSetup);
            setupShowToast('Setup registrado com sucesso!', 'success');
        }
        document.getElementById('novo-setup-modal').classList.add('hidden');
        setupEmEdicao = null;
        loadSetups();
    } catch (error) {
        console.error('[Setup·mod] Erro ao salvar:', error);
        setupShowToast('Erro ao salvar setup', 'error');
    }
}

async function loadSetups() {
    const periodoSelect = document.getElementById('setup-periodo')?.value || '7days';
    let dataInicio = document.getElementById('setup-data-inicio')?.value;
    let dataFim = document.getElementById('setup-data-fim')?.value;
    const filtroMaquina = document.getElementById('setup-filtro-maquina')?.value;
    const filtroTipo = document.getElementById('setup-filtro-tipo')?.value;
    const filtroTurno = document.getElementById('setup-filtro-turno')?.value;

    const hoje = new Date();
    const hojeStr = getSetupDateString(hoje);

    switch (periodoSelect) {
        case 'today': dataInicio = hojeStr; dataFim = hojeStr; break;
        case 'yesterday': { const o = new Date(hoje); o.setDate(o.getDate() - 1); dataInicio = getSetupDateString(o); dataFim = getSetupDateString(o); break; }
        case '7days': { const d = new Date(hoje); d.setDate(d.getDate() - 7); dataInicio = getSetupDateString(d); dataFim = hojeStr; break; }
        case '30days': { const d = new Date(hoje); d.setDate(d.getDate() - 30); dataInicio = getSetupDateString(d); dataFim = hojeStr; break; }
        case 'month': dataInicio = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`; dataFim = hojeStr; break;
        case 'lastmonth': { const mp = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1); const ud = new Date(hoje.getFullYear(), hoje.getMonth(), 0); dataInicio = getSetupDateString(mp); dataFim = getSetupDateString(ud); break; }
        case 'custom': if (!dataInicio || !dataFim) { setupShowToast('Selecione as datas do período personalizado', 'error'); return; } break;
    }

    try {
        let query = db().collection('setups_maquinas').where('data', '>=', dataInicio).where('data', '<=', dataFim).orderBy('data', 'desc');
        const snapshot = await query.get();
        let setups = [];

        snapshot.forEach(doc => {
            const data = doc.data();
            if (filtroMaquina && data.maquina !== filtroMaquina) return;
            if (filtroTipo && data.tipo !== filtroTipo) return;
            if (filtroTurno && data.horaInicio) {
                const hora = parseInt(data.horaInicio.split(':')[0], 10);
                let turnoDoSetup = '';
                if (hora >= 6 && hora < 14) turnoDoSetup = '1';
                else if (hora >= 14 && hora < 22) turnoDoSetup = '2';
                else turnoDoSetup = '3';
                if (turnoDoSetup !== filtroTurno) return;
            }
            setups.push({ id: doc.id, ...data });
        });

        setups.sort((a, b) => { if (a.data !== b.data) return b.data.localeCompare(a.data); return b.horaInicio.localeCompare(a.horaInicio); });
        renderSetupStats(setups);
        renderSetupCharts(setups);
        renderSetupTabela(setups);
    } catch (error) {
        console.error('[Setup·mod] Erro ao carregar:', error);
        setupShowToast('Erro ao carregar setups', 'error');
    }
}

// ─── Estatísticas ───────────────────────────────────
function renderSetupStats(setups) {
    const totalEl = document.getElementById('setup-total');
    const planejadosEl = document.getElementById('setup-planejados');
    const naoPlanejadosEl = document.getElementById('setup-nao-planejados');
    const tempoMedioEl = document.getElementById('setup-tempo-medio');
    const tempoTotalEl = document.getElementById('setup-tempo-total');

    const planejados = setups.filter(s => s.tipo === 'planejado');
    const naoPlanejados = setups.filter(s => s.tipo === 'nao_planejado');
    const tempoTotal = setups.reduce((acc, s) => acc + (s.duracaoMinutos || 0), 0);
    const tempoMedio = setups.length > 0 ? Math.round(tempoTotal / setups.length) : 0;
    const horasTotal = Math.floor(tempoTotal / 60);
    const minsTotal = tempoTotal % 60;
    const tempoTotalFormatado = horasTotal > 0 ? `${horasTotal}h${minsTotal > 0 ? ` ${minsTotal}m` : ''}` : `${minsTotal}min`;

    if (totalEl) totalEl.textContent = setups.length;
    if (planejadosEl) planejadosEl.textContent = planejados.length;
    if (naoPlanejadosEl) naoPlanejadosEl.textContent = naoPlanejados.length;
    if (tempoMedioEl) tempoMedioEl.textContent = `${tempoMedio}min`;
    if (tempoTotalEl) tempoTotalEl.textContent = tempoTotalFormatado;
}

// ─── Tabela ─────────────────────────────────────────
function renderSetupTabela(setups) {
    setupDadosAtuais = setups;
    setupPaginaAtual = 1;
    renderSetupTabelaPaginada();
}

function renderSetupTabelaInterno(setups) {
    const tbody = document.getElementById('setup-tabela-body');
    if (!tbody) return;

    if (setups.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="text-center py-12 text-gray-400"><i data-lucide="inbox" class="w-12 h-12 mx-auto mb-2 opacity-50"></i><p>Nenhum registro de setup encontrado</p></td></tr>`;
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }

    tbody.innerHTML = setups.map(setup => {
        const dataFormatada = setup.data ? setup.data.split('-').reverse().join('/') : '';
        const tipoLabel = setup.tipo === 'planejado' ? 'Planejado' : 'Não Planejado';
        const tipoClass = setup.tipo === 'planejado' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
        const horas = Math.floor((setup.duracaoMinutos || 0) / 60);
        const mins = (setup.duracaoMinutos || 0) % 60;
        const duracaoFormatada = horas > 0 ? `${horas}h ${mins}min` : `${mins}min`;

        return `<tr class="hover:bg-gray-50 transition-colors">
            <td class="px-4 py-3 text-sm font-medium text-gray-800">${dataFormatada}</td>
            <td class="px-4 py-3"><span class="inline-flex items-center gap-1.5 px-2 py-1 bg-blue-100 text-blue-800 rounded-lg text-xs font-bold"><i data-lucide="cpu" class="w-3 h-3"></i>${setup.maquina}</span></td>
            <td class="px-4 py-3 text-sm text-gray-700">${setup.molde || '-'}</td>
            <td class="px-4 py-3 text-center"><span class="px-2 py-1 rounded-full text-xs font-semibold ${tipoClass}">${tipoLabel}</span></td>
            <td class="px-4 py-3 text-center text-sm font-medium text-gray-700">${setup.horaInicio || '-'}</td>
            <td class="px-4 py-3 text-center text-sm font-medium text-gray-700">${setup.horaFim || '-'}</td>
            <td class="px-4 py-3 text-center"><span class="px-2 py-1 bg-orange-100 text-orange-700 rounded-lg text-xs font-bold">${duracaoFormatada}</span></td>
            <td class="px-4 py-3 text-sm text-gray-600 max-w-xs truncate" title="${setup.observacao || ''}">${setup.observacao || '-'}</td>
            <td class="px-4 py-3 text-center"><div class="flex items-center justify-center gap-1">
                <button onclick="editarSetup('${setup.id}')" class="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition" title="Editar"><i data-lucide="pencil" class="w-4 h-4"></i></button>
                <button onclick="excluirSetup('${setup.id}')" class="p-1.5 text-red-600 hover:bg-red-100 rounded-lg transition" title="Excluir"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
            </div></td></tr>`;
    }).join('');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ─── Editar / Excluir ───────────────────────────────
async function editarSetup(setupId) {
    try {
        const doc = await db().collection('setups_maquinas').doc(setupId).get();
        if (!doc.exists) { setupShowToast('Setup não encontrado', 'error'); return; }
        const setup = doc.data();
        setupEmEdicao = setupId;
        document.getElementById('setup-modal-titulo').textContent = 'Editar Registro de Setup';
        document.getElementById('novo-setup-data').value = setup.data || '';
        document.getElementById('novo-setup-maquina').value = setup.maquina || '';
        document.getElementById('novo-setup-molde').value = setup.molde || '';
        document.getElementById('novo-setup-hora-inicio').value = setup.horaInicio || '';
        document.getElementById('novo-setup-hora-fim').value = setup.horaFim || '';
        document.getElementById('novo-setup-obs').value = setup.observacao || '';
        const tipoRadio = document.querySelector(`input[name="setup-tipo"][value="${setup.tipo}"]`);
        if (tipoRadio) tipoRadio.checked = true;
        const horas = Math.floor((setup.duracaoMinutos || 0) / 60);
        const mins = (setup.duracaoMinutos || 0) % 60;
        const duracaoSpan = document.getElementById('novo-setup-duracao');
        if (duracaoSpan) duracaoSpan.textContent = horas > 0 ? `Duração: ${horas}h ${mins}min` : `Duração: ${mins} minutos`;
        document.getElementById('novo-setup-modal').classList.remove('hidden');
        if (typeof lucide !== 'undefined') lucide.createIcons();
    } catch (error) {
        console.error('[Setup·mod] Erro ao carregar para edição:', error);
        setupShowToast('Erro ao carregar setup', 'error');
    }
}

async function excluirSetup(setupId) {
    if (!confirm('Tem certeza que deseja excluir este registro de setup?')) return;
    try {
        await db().collection('setups_maquinas').doc(setupId).delete();
        setupShowToast('Setup excluído com sucesso', 'success');
        loadSetups();
    } catch (error) {
        console.error('[Setup·mod] Erro ao excluir:', error);
        setupShowToast('Erro ao excluir setup', 'error');
    }
}

// ─── Toggle de Gráficos ─────────────────────────────
function setupChartsToggle() {
    const toggleBtn = document.getElementById('toggle-setup-charts');
    const container = document.getElementById('setup-charts-container');
    const icon = document.getElementById('setup-charts-toggle-icon');
    const text = document.getElementById('setup-charts-toggle-text');
    if (!toggleBtn || !container) return;

    toggleBtn.addEventListener('click', () => {
        const isHidden = container.classList.contains('hidden');
        if (isHidden) {
            container.classList.remove('hidden');
            if (icon) icon.setAttribute('data-lucide', 'chevron-up');
            if (text) text.textContent = 'Ocultar Gráficos';
        } else {
            container.classList.add('hidden');
            if (icon) icon.setAttribute('data-lucide', 'chevron-down');
            if (text) text.textContent = 'Mostrar Gráficos';
        }
        if (typeof lucide !== 'undefined') lucide.createIcons();
    });
}

// ─── Gráficos (Chart.js) ────────────────────────────
function renderSetupCharts(setups) {
    if (typeof Chart === 'undefined') { console.error('[Setup·mod] Chart.js não está carregado!'); return; }
    if (!setups || setups.length === 0) {
        Object.keys(setupCharts).forEach(key => { if (setupCharts[key]) { setupCharts[key].destroy(); setupCharts[key] = null; } });
        return;
    }
    try {
        renderSetupTipoChart(setups);
        renderSetupMaquinaChart(setups);
        renderSetupTempoMaquinaChart(setups);
        renderSetupDiarioChart(setups);
        renderSetupDistribuicaoTempoChart(setups);
    } catch (error) { console.error('[Setup·mod] Erro ao renderizar gráficos:', error); }
}

function renderSetupTipoChart(setups) {
    const canvas = document.getElementById('setup-chart-tipo');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const existing = Chart.getChart(canvas);
    if (existing) existing.destroy();
    const planejados = setups.filter(s => s.tipo === 'planejado').length;
    const naoPlanejados = setups.filter(s => s.tipo === 'nao_planejado').length;
    setupCharts.tipo = new Chart(ctx, {
        type: 'doughnut',
        data: { labels: ['Planejados', 'Não Planejados'], datasets: [{ data: [planejados, naoPlanejados], backgroundColor: ['rgba(34,197,94,0.8)', 'rgba(239,68,68,0.8)'], borderColor: ['rgba(34,197,94,1)', 'rgba(239,68,68,1)'], borderWidth: 2, hoverOffset: 10 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { padding: 20, usePointStyle: true, font: { size: 12, weight: '500' } } }, tooltip: { callbacks: { label: (ctx) => { const t = planejados + naoPlanejados; return `${ctx.label}: ${ctx.raw} (${t > 0 ? ((ctx.raw / t) * 100).toFixed(1) : 0}%)`; } } } }, cutout: '60%' }
    });
}

function renderSetupMaquinaChart(setups) {
    const canvas = document.getElementById('setup-chart-maquina');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const existing = Chart.getChart(canvas); if (existing) existing.destroy();
    const maquinaCount = {}, maquinaPlanejado = {}, maquinaNaoPlanejado = {};
    setups.forEach(s => { const m = s.maquina || 'N/A'; maquinaCount[m] = (maquinaCount[m] || 0) + 1; if (s.tipo === 'planejado') maquinaPlanejado[m] = (maquinaPlanejado[m] || 0) + 1; else maquinaNaoPlanejado[m] = (maquinaNaoPlanejado[m] || 0) + 1; });
    const labels = Object.keys(maquinaCount).sort((a, b) => maquinaCount[b] - maquinaCount[a]);
    setupCharts.maquina = new Chart(ctx, {
        type: 'bar',
        data: { labels, datasets: [{ label: 'Planejados', data: labels.map(m => maquinaPlanejado[m] || 0), backgroundColor: 'rgba(34,197,94,0.7)', borderColor: 'rgba(34,197,94,1)', borderWidth: 1, borderRadius: 4 }, { label: 'Não Planejados', data: labels.map(m => maquinaNaoPlanejado[m] || 0), backgroundColor: 'rgba(239,68,68,0.7)', borderColor: 'rgba(239,68,68,1)', borderWidth: 1, borderRadius: 4 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top', labels: { usePointStyle: true, font: { size: 11 } } } }, scales: { x: { stacked: true, grid: { display: false }, ticks: { font: { size: 10 } } }, y: { stacked: true, beginAtZero: true, ticks: { stepSize: 1, font: { size: 10 } }, grid: { color: 'rgba(0,0,0,0.05)' } } } }
    });
}

function renderSetupTempoMaquinaChart(setups) {
    const canvas = document.getElementById('setup-chart-tempo-maquina');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const existing = Chart.getChart(canvas); if (existing) existing.destroy();
    const maquinaTempo = {};
    setups.forEach(s => { const m = s.maquina || 'N/A'; maquinaTempo[m] = (maquinaTempo[m] || 0) + (s.duracaoMinutos || 0); });
    const labels = Object.keys(maquinaTempo).sort((a, b) => maquinaTempo[b] - maquinaTempo[a]);
    const data = labels.map(m => maquinaTempo[m]);
    const colors = labels.map((_, i) => `hsla(${(i * 35) % 360}, 70%, 55%, 0.8)`);
    setupCharts.tempoMaquina = new Chart(ctx, {
        type: 'bar',
        data: { labels, datasets: [{ label: 'Tempo Total (min)', data, backgroundColor: colors, borderColor: colors.map(c => c.replace('0.8', '1')), borderWidth: 1, borderRadius: 4 }] },
        options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => { const m = ctx.raw; const h = Math.floor(m / 60); const r = m % 60; return h > 0 ? `${h}h ${r}min` : `${m}min`; } } } }, scales: { x: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { font: { size: 10 } } }, y: { grid: { display: false }, ticks: { font: { size: 10 } } } } }
    });
}

function renderSetupDiarioChart(setups) {
    const canvas = document.getElementById('setup-chart-diario');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const existing = Chart.getChart(canvas); if (existing) existing.destroy();
    const diaCount = {}, diaTempo = {};
    setups.forEach(s => { const d = s.data || ''; if (d) { diaCount[d] = (diaCount[d] || 0) + 1; diaTempo[d] = (diaTempo[d] || 0) + (s.duracaoMinutos || 0); } });
    const labels = Object.keys(diaCount).sort();
    const formatted = labels.map(d => d.split('-').reverse().join('/'));
    setupCharts.diario = new Chart(ctx, {
        type: 'line',
        data: { labels: formatted, datasets: [{ label: 'Quantidade', data: labels.map(d => diaCount[d]), borderColor: 'rgba(59,130,246,1)', backgroundColor: 'rgba(59,130,246,0.1)', fill: true, tension: 0.3, pointRadius: 4, pointHoverRadius: 6, yAxisID: 'y' }, { label: 'Tempo (min)', data: labels.map(d => diaTempo[d]), borderColor: 'rgba(249,115,22,1)', backgroundColor: 'rgba(249,115,22,0.1)', fill: false, tension: 0.3, pointRadius: 4, pointHoverRadius: 6, borderDash: [5, 5], yAxisID: 'y1' }] },
        options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { position: 'top', labels: { usePointStyle: true, font: { size: 11 } } } }, scales: { x: { grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 45 } }, y: { type: 'linear', display: true, position: 'left', beginAtZero: true, title: { display: true, text: 'Quantidade', font: { size: 10 } }, ticks: { stepSize: 1, font: { size: 10 } }, grid: { color: 'rgba(0,0,0,0.05)' } }, y1: { type: 'linear', display: true, position: 'right', beginAtZero: true, title: { display: true, text: 'Tempo (min)', font: { size: 10 } }, ticks: { font: { size: 10 } }, grid: { drawOnChartArea: false } } } }
    });
}

function renderSetupDistribuicaoTempoChart(setups) {
    const canvas = document.getElementById('setup-chart-distribuicao-tempo');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const existing = Chart.getChart(canvas); if (existing) existing.destroy();
    const faixas = [
        { label: '0-15 min', min: 0, max: 15 }, { label: '15-30 min', min: 15, max: 30 },
        { label: '30-45 min', min: 30, max: 45 }, { label: '45-60 min', min: 45, max: 60 },
        { label: '1-2 horas', min: 60, max: 120 }, { label: '2-3 horas', min: 120, max: 180 },
        { label: '3+ horas', min: 180, max: Infinity }
    ];
    const counts = faixas.map(f => setups.filter(s => { const d = s.duracaoMinutos || 0; return d >= f.min && d < f.max; }).length);
    const colors = ['rgba(34,197,94,0.7)', 'rgba(132,204,22,0.7)', 'rgba(250,204,21,0.7)', 'rgba(251,146,60,0.7)', 'rgba(249,115,22,0.7)', 'rgba(239,68,68,0.7)', 'rgba(220,38,38,0.7)'];
    setupCharts.distribuicaoTempo = new Chart(ctx, {
        type: 'bar',
        data: { labels: faixas.map(f => f.label), datasets: [{ label: 'Quantidade de Setups', data: counts, backgroundColor: colors, borderColor: colors.map(c => c.replace('0.7', '1')), borderWidth: 1, borderRadius: 6 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => { const t = setups.length; return `${ctx.raw} setups (${t > 0 ? ((ctx.raw / t) * 100).toFixed(1) : 0}%)`; } } } }, scales: { x: { grid: { display: false }, ticks: { font: { size: 10 } } }, y: { beginAtZero: true, ticks: { stepSize: 1, font: { size: 10 } }, grid: { color: 'rgba(0,0,0,0.05)' } } } }
    });
}
