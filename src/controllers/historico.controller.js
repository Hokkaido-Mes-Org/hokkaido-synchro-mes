/**
 * HokkaidoMES — Histórico do Sistema Controller (Módulo ES6)
 * Fase 3: Completamente extraído de script.js (linhas 30157-30525)
 *
 * Coleção Firestore: system_logs
 * Funcionalidades: visualização de logs, filtragem por tipo/usuário/máquina,
 *                  ordenação por timestamp, geração de dados de teste.
 */

import { getDb, serverTimestamp } from '../services/firebase-client.js';
import { showNotification } from '../components/notification.js';
import { EventBus } from '../core/event-bus.js';

// ── Estado do módulo ──
let historicoCurrentPage = 0;
let historicoPageSize = 50;
let historicoLastDoc = null;
let historicoFirstDoc = null;
let historicoDataSelecionada = null;
let historicoSetupDone = false;
let historicoCache = [];          // cache dos registros carregados do Firestore
let historicoCacheDate = null;     // data usada na última query

/** Atalho para Firestore */
function db() { return getDb(); }

// ═══════════════════════════════════════════════
// ENTRY POINT
// ═══════════════════════════════════════════════

export function setupHistoricoPage() {
    console.log('[Historico·mod] Controller modular carregado');
    setupHistoricoSistema();
    EventBus.emit('historico:initialized');
}

// ═══════════════════════════════════════════════
// SETUP
// ═══════════════════════════════════════════════

function setupHistoricoSistema() {
    if (historicoSetupDone) {
        // Já inicializado — mantém estado atual (search-first)
        return;
    }
    historicoSetupDone = true;

    const btnHoje = document.getElementById('historico-hoje');
    const btnOntem = document.getElementById('historico-ontem');
    const dataEspecifica = document.getElementById('historico-data-especifica');
    const btnRefresh = document.getElementById('historico-refresh');
    const btnPrev = document.getElementById('historico-prev');
    const btnNext = document.getElementById('historico-next');

    function atualizarBotaoAtivo(ativo) {
        if (btnHoje) {
            btnHoje.className = ativo === 'hoje'
                ? 'flex-1 px-3 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition'
                : 'flex-1 px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 transition';
        }
        if (btnOntem) {
            btnOntem.className = ativo === 'ontem'
                ? 'flex-1 px-3 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition'
                : 'flex-1 px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 transition';
        }
        if (dataEspecifica && ativo !== 'hoje' && ativo !== 'ontem') {
            dataEspecifica.classList.add('ring-2', 'ring-blue-500');
        } else if (dataEspecifica) {
            dataEspecifica.classList.remove('ring-2', 'ring-blue-500');
        }
    }

    historicoDataSelecionada = new Date().toISOString().split('T')[0];
    atualizarBotaoAtivo('hoje');

    // Botão Buscar (principal — dispara query server-side)
    const btnBuscar = document.getElementById('historico-buscar');
    if (btnBuscar) btnBuscar.addEventListener('click', () => carregarHistorico());

    if (btnHoje) btnHoje.addEventListener('click', () => {
        historicoDataSelecionada = new Date().toISOString().split('T')[0];
        if (dataEspecifica) dataEspecifica.value = '';
        atualizarBotaoAtivo('hoje');
        historicoCurrentPage = 0;
        historicoLastDoc = null;
        // Data mudou → nova query server-side
        carregarHistorico();
    });

    if (btnOntem) btnOntem.addEventListener('click', () => {
        const ontem = new Date();
        ontem.setDate(ontem.getDate() - 1);
        historicoDataSelecionada = ontem.toISOString().split('T')[0];
        if (dataEspecifica) dataEspecifica.value = '';
        atualizarBotaoAtivo('ontem');
        historicoCurrentPage = 0;
        historicoLastDoc = null;
        // Data mudou → nova query server-side
        carregarHistorico();
    });

    if (dataEspecifica) dataEspecifica.addEventListener('change', () => {
        if (dataEspecifica.value) {
            historicoDataSelecionada = dataEspecifica.value;
            atualizarBotaoAtivo('especifica');
            historicoCurrentPage = 0;
            historicoLastDoc = null;
            // Data mudou → nova query server-side
            carregarHistorico();
        }
    });

    if (btnPrev) btnPrev.addEventListener('click', () => {
        if (historicoCurrentPage > 0) {
            historicoCurrentPage--;
            carregarHistorico('prev');
        }
    });

    if (btnNext) btnNext.addEventListener('click', () => {
        historicoCurrentPage++;
        carregarHistorico('next');
    });

    const tipoAcaoSelect = document.getElementById('historico-tipo-acao');
    const usuarioInput = document.getElementById('historico-usuario');
    const maquinaInput = document.getElementById('historico-maquina');

    // Tipo, Usuário, Máquina → filtram client-side (sem re-query)
    if (tipoAcaoSelect) {
        tipoAcaoSelect.addEventListener('change', () => {
            if (historicoCache.length > 0) aplicarFiltrosClientSide();
        });
    }

    let debounceTimer = null;
    const debounceClientFilter = () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            if (historicoCache.length > 0) aplicarFiltrosClientSide();
        }, 300);
    };

    if (usuarioInput) usuarioInput.addEventListener('input', debounceClientFilter);
    if (maquinaInput) maquinaInput.addEventListener('input', debounceClientFilter);

    // Botão de dados de teste
    const btnTeste = document.getElementById('historico-teste');
    if (btnTeste) btnTeste.addEventListener('click', async () => {
        try {
            btnTeste.disabled = true;
            btnTeste.textContent = 'Gerando...';

            const usuario = window.authSystem?.getCurrentUser();
            const now = new Date();
            const dataHoje = now.toISOString().split('T')[0];

            const testeLogs = [
                { acao: 'LANÇAMENTO DE PRODUÇÃO', tipo: 'producao', descricao: 'Produção de teste - 500 peças', maquina: 'H-01', detalhes: { quantidade: 500, turno: 1 } },
                { acao: 'ATIVAÇÃO DE ORDEM', tipo: 'ordem', descricao: 'Ordem OP-12345 ativada', maquina: 'H-05', detalhes: { orderNumber: 'OP-12345' } },
                { acao: 'LANÇAMENTO DE PERDA', tipo: 'perda', descricao: 'Perda registrada - 20 peças', maquina: 'H-11', detalhes: { quantidade: 20, motivo: 'Material fora de especificação' } },
                { acao: 'REGISTRO DE PARADA', tipo: 'parada', descricao: 'Parada por manutenção - 45min', maquina: 'H-01', detalhes: { duracao: 45, motivo: 'Manutenção preventiva' } },
            ];

            for (const log of testeLogs) {
                await db().collection('system_logs').add({
                    ...log,
                    usuario: usuario?.name || 'Teste',
                    userId: usuario?.id || null,
                    timestamp: serverTimestamp(),
                    timestampLocal: now.toISOString(),
                    data: dataHoje,
                    hora: now.toTimeString().split(' ')[0]
                });
            }

            showNotification('✅ 4 registros de teste criados!', 'success');
            carregarHistorico();
        } catch (error) {
            console.error('Erro ao gerar teste:', error);
            showNotification('Erro ao gerar dados de teste', 'error');
        } finally {
            btnTeste.disabled = false;
            btnTeste.innerHTML = '<i data-lucide="plus" class="w-4 h-4"></i> Gerar Teste';
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
    });

    // Não carrega dados ao abrir a aba — mostra empty state (search-first)
    atualizarEstatisticasHistorico([]);
}

// ═══════════════════════════════════════════════
// DATA LOADING
// ═══════════════════════════════════════════════

/**
 * Carrega registros do Firestore (query server-side por data).
 * Resultados são cacheados em historicoCache para filtros client-side.
 */
async function carregarHistorico(direction = 'first') {
    const tbody = document.getElementById('historico-tbody');
    if (!tbody) return;

    const btnBuscar = document.getElementById('historico-buscar');

    tbody.innerHTML = `<tr><td colspan="6" class="px-4 py-10 text-center text-gray-400">
        <i data-lucide="loader-2" class="w-10 h-10 mx-auto mb-3 animate-spin opacity-50"></i>
        <p>Carregando histórico...</p></td></tr>`;
    if (typeof lucide !== 'undefined') lucide.createIcons();

    // UI loading no botão
    if (btnBuscar) {
        btnBuscar.disabled = true;
        btnBuscar.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Buscando...';
    }

    try {
        const dataSelecionada = historicoDataSelecionada || new Date().toISOString().split('T')[0];

        let query = db().collection('system_logs')
            .where('data', '==', dataSelecionada)
            .limit(500);

        const snapshot = await query.get();
        console.log(`[Historico·mod] ${snapshot.size} registros carregados para ${dataSelecionada}`);

        if (snapshot.empty) {
            historicoCache = [];
            historicoCacheDate = dataSelecionada;
            tbody.innerHTML = `<tr><td colspan="6" class="px-4 py-10 text-center text-gray-400">
                <i data-lucide="inbox" class="w-12 h-12 mx-auto mb-3 opacity-50"></i>
                <p>Nenhum registro encontrado para a data selecionada</p></td></tr>`;
            if (typeof lucide !== 'undefined') lucide.createIcons();
            atualizarEstatisticasHistorico([]);
            return;
        }

        // Armazena em cache e ordena por timestamp (mais recente primeiro)
        historicoCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        historicoCacheDate = dataSelecionada;
        historicoCache.sort((a, b) => {
            const tsA = a.timestamp?.toDate?.() || new Date(a.timestampLocal || 0);
            const tsB = b.timestamp?.toDate?.() || new Date(b.timestampLocal || 0);
            return tsB - tsA;
        });

        // Aplicar filtros client-side nos dados carregados
        aplicarFiltrosClientSide();

    } catch (error) {
        console.error('[HISTORICO] Erro ao carregar:', error);
        tbody.innerHTML = `<tr><td colspan="6" class="px-4 py-10 text-center text-red-400">
            <i data-lucide="alert-circle" class="w-12 h-12 mx-auto mb-3 opacity-50"></i>
            <p>Erro ao carregar: ${error.message}</p></td></tr>`;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    } finally {
        if (btnBuscar) {
            btnBuscar.disabled = false;
            btnBuscar.innerHTML = '<i data-lucide="search" class="w-4 h-4"></i> Buscar';
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
    }
}

/**
 * Aplica filtros (tipo, usuário, máquina) nos dados já carregados (client-side).
 * NÃO faz nova query ao Firestore.
 */
function aplicarFiltrosClientSide() {
    const tbody = document.getElementById('historico-tbody');
    if (!tbody || historicoCache.length === 0) return;

    const tipoAcao = document.getElementById('historico-tipo-acao')?.value;
    const usuarioFiltro = document.getElementById('historico-usuario')?.value?.toLowerCase();
    const maquinaFiltro = document.getElementById('historico-maquina')?.value?.toLowerCase();

    let registros = [...historicoCache];

    if (tipoAcao) {
        registros = registros.filter(r => r.tipo === tipoAcao);
    }
    if (usuarioFiltro) {
        registros = registros.filter(r => (r.usuario || '').toLowerCase().includes(usuarioFiltro));
    }
    if (maquinaFiltro) {
        registros = registros.filter(r => (r.maquina || '').toLowerCase().includes(maquinaFiltro));
    }

    atualizarEstatisticasHistorico(registros);

    tbody.innerHTML = '';

    if (registros.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="px-4 py-10 text-center text-gray-400">
            <i data-lucide="filter-x" class="w-12 h-12 mx-auto mb-3 opacity-50"></i>
            <p>Nenhum registro corresponde aos filtros aplicados</p></td></tr>`;
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }

    registros.forEach(log => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50 transition-colors';

        const tipoInfo = getTipoInfo(log.tipo);
        const dataHora = formatarDataHoraLog(log);
        const detalhesStr = formatarDetalhes(log.detalhes);

        row.innerHTML = `
            <td class="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">${dataHora}</td>
            <td class="px-4 py-3">
                <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${tipoInfo.class}">
                    ${tipoInfo.icon} ${tipoInfo.label}
                </span>
            </td>
            <td class="px-4 py-3 text-sm text-gray-800">${log.descricao || log.acao || '-'}</td>
            <td class="px-4 py-3 text-sm font-medium text-blue-600">${log.maquina || '-'}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${log.usuario || '-'}</td>
            <td class="px-4 py-3 text-xs text-gray-500 max-w-xs truncate" title="${(detalhesStr || '').replace(/<[^>]*>/g, '')}">${detalhesStr || '-'}</td>
        `;
        tbody.appendChild(row);
    });

    const info = document.getElementById('historico-info');
    if (info) info.textContent = `Mostrando ${registros.length} registros`;

    const btnPrev = document.getElementById('historico-prev');
    const btnNext = document.getElementById('historico-next');
    if (btnPrev) btnPrev.style.display = 'none';
    if (btnNext) btnNext.style.display = 'none';

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ═══════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════

function getTipoInfo(tipo) {
    const tipos = {
        'producao': { label: 'Produção', icon: '📦', class: 'bg-green-100 text-green-800' },
        'perda': { label: 'Perda', icon: '⚠️', class: 'bg-orange-100 text-orange-800' },
        'parada': { label: 'Parada', icon: '⏸️', class: 'bg-red-100 text-red-800' },
        'ordem': { label: 'Ordem', icon: '📋', class: 'bg-blue-100 text-blue-800' },
        'ordem_ativada': { label: 'Ordem Ativada', icon: '✅', class: 'bg-blue-100 text-blue-800' },
        'ordem_finalizada': { label: 'Ordem Finalizada', icon: '🏁', class: 'bg-purple-100 text-purple-800' },
        'ordem_criada': { label: 'Ordem Criada', icon: '📋', class: 'bg-indigo-100 text-indigo-800' },
        'exclusao': { label: 'Exclusão', icon: '🗑️', class: 'bg-red-100 text-red-800' },
        'edicao': { label: 'Edição', icon: '✏️', class: 'bg-yellow-100 text-yellow-800' },
        'login': { label: 'Login', icon: '🔐', class: 'bg-emerald-100 text-emerald-800' },
        'logout': { label: 'Logout', icon: '🚪', class: 'bg-gray-100 text-gray-800' },
        'ciclo_cavidade': { label: 'Ciclo/Cavidade', icon: '⚙️', class: 'bg-cyan-100 text-cyan-800' },
        'acompanhamento': { label: 'Acompanhamento', icon: '📊', class: 'bg-violet-100 text-violet-800' },
        'planejamento': { label: 'Planejamento', icon: '📅', class: 'bg-teal-100 text-teal-800' },
        'qualidade': { label: 'Qualidade', icon: '✔', class: 'bg-sky-100 text-sky-800' },
        'retrabalho': { label: 'Retrabalho', icon: '🔄', class: 'bg-amber-100 text-amber-800' }
    };
    return tipos[tipo] || { label: tipo || 'Outro', icon: '📝', class: 'bg-gray-100 text-gray-800' };
}

function formatarDataHoraLog(log) {
    if (log.timestamp?.toDate) {
        const d = log.timestamp.toDate();
        return d.toLocaleString('pt-BR');
    }
    if (log.timestampLocal) {
        return new Date(log.timestampLocal).toLocaleString('pt-BR');
    }
    return `${log.data || ''} ${log.hora || ''}`;
}

function formatarDetalhes(detalhes) {
    if (!detalhes || typeof detalhes !== 'object') return '';

    const partes = [];
    
    // FIX: Exibição obrigatória do Nº OP — verificar múltiplos nomes de campo
    const opValue = detalhes.op || detalhes.orderNumber || detalhes.order_number || detalhes.opNumber || detalhes.op_number || detalhes.numeroOP || detalhes.ordem || null;
    if (opValue) {
        partes.push(`<strong>OP: ${opValue}</strong>`);
    }
    
    if (detalhes.quantidade != null && detalhes.quantidade !== '') partes.push(`Qtd: ${detalhes.quantidade}`);
    if (detalhes.produto) partes.push(`Prod: ${detalhes.produto}`);
    if (detalhes.motivo) partes.push(`Motivo: ${detalhes.motivo}`);
    if (detalhes.duracao) partes.push(`Dur: ${detalhes.duracao}min`);
    if (detalhes.turno) partes.push(`T${detalhes.turno}`);

    return partes.join(' | ') || JSON.stringify(detalhes).substring(0, 100);
}

function atualizarEstatisticasHistorico(registros) {
    const total = document.getElementById('historico-total');
    const producao = document.getElementById('historico-producao-count');
    const paradas = document.getElementById('historico-paradas-count');
    const ordens = document.getElementById('historico-ordens-count');
    const exclusoes = document.getElementById('historico-exclusoes-count');

    if (total) total.textContent = registros.length;
    if (producao) producao.textContent = registros.filter(r => r.tipo === 'producao').length;
    if (paradas) paradas.textContent = registros.filter(r => r.tipo === 'parada').length;
    if (ordens) ordens.textContent = registros.filter(r => r.tipo === 'ordem' || r.tipo?.startsWith('ordem')).length;
    if (exclusoes) exclusoes.textContent = registros.filter(r => r.tipo === 'exclusao' || (r.acao && r.acao.includes('EXCLUSÃO'))).length;
}
