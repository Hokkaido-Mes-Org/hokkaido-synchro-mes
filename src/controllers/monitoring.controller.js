/**
 * HokkaidoMES — Monitoramento/Acompanhamento Controller (Módulo ES6)
 * Fase 3: Completamente extraído de script.js (linhas 24974-26251)
 *
 * Sub-módulos:
 *   1. Acompanhamento de Turno — CEDOC vs Hokkaido MES (produção por máquina/turno)
 *   2. Acompanhamento de Perdas — OP vs MES (refugo por máquina/turno)
 *   3. Acompanhamento de Paradas — Timeline visual de paradas por máquina
 *
 * Coleções Firestore:
 *   - production_entries (leitura)
 *   - downtime_entries (leitura)
 *   - planejamento (leitura)
 *   - acompanhamento_turno (leitura/escrita)
 *   - acompanhamento_perdas (leitura/escrita)
 *   - system_logs (escrita via registrarLogSistema)
 */

import { getDb, serverTimestamp } from '../services/firebase-client.js';
import { getProductionDateString } from '../utils/date.utils.js';
import { showNotification } from '../components/notification.js';
import { registrarLogSistema } from '../utils/logger.js';
import { normalizeMachineId } from '../utils/dom.utils.js';
import { EventBus } from '../core/event-bus.js';

// ── Estado do módulo ──
let acompanhamentoInitialized = false;
let acompanhamentoPerdasSetupDone = false;
let acompanhamentoPerdasDataAtual = {};
let acompanhamentoParadasSetupDone = false;
let acompanhamentoParadasDataAtual = {};

/** Atalho para Firestore */
function db() { return getDb(); }

// ── Cache de consultas por data (evita leituras repetidas ao navegar entre sub-abas) ──
const _queryCache = new Map();
const _queryCacheTTL = 300000; // 5 min

/**
 * Executa query Firestore com cache por chave.
 * @param {string} key - Chave única do cache
 * @param {Function} queryFn - Função que retorna a Promise do .get()
 * @returns {Promise<Array>} Array de docs { id, ...data }
 */
async function cachedQuery(key, queryFn) {
    const entry = _queryCache.get(key);
    if (entry && Date.now() - entry.ts < _queryCacheTTL) {
        console.debug(`📦 [Monit·cache] hit: ${key}`);
        return entry.data;
    }
    console.debug(`🔥 [Monit·cache] miss: ${key}`);
    const snapshot = await queryFn();
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    _queryCache.set(key, { data, ts: Date.now() });
    return data;
}

// ═══════════════════════════════════════════════
// ENTRY POINT — chamado pelo feature flag gate
// ═══════════════════════════════════════════════

/**
 * Inicializa as 3 sub-abas de acompanhamento.
 */
export function setupAcompanhamentoPage() {
    console.log('[Monit·mod] Controller modular carregado');
    setupAcompanhamentoTurno();
    setupAcompanhamentoPerdas();
    setupAcompanhamentoParadas();
    EventBus.emit('monitoring:initialized');
}

// ═══════════════════════════════════════════════
// 1. ACOMPANHAMENTO DE TURNO
// ═══════════════════════════════════════════════

function setupAcompanhamentoTurno() {
    if (acompanhamentoInitialized) return;
    acompanhamentoInitialized = true;

    console.log('[ACOMPANHAMENTO] Inicializando aba de acompanhamento de turno...');

    // Setup das tabs de acompanhamento (Produção vs Perdas vs Paradas)
    document.querySelectorAll('.acompanhamento-tab-btn').forEach(btn => {
        if (btn.dataset.tabListenerAttached) return;
        btn.dataset.tabListenerAttached = 'true';

        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const tab = e.currentTarget.dataset.acompanhamentoTab;

            document.querySelectorAll('.acompanhamento-tab-btn').forEach(b => {
                b.classList.remove('border-blue-600', 'border-red-600', 'border-amber-600', 'bg-blue-50', 'bg-red-50', 'bg-amber-50', 'text-blue-700', 'text-red-700', 'text-amber-700');
                b.classList.add('border-transparent', 'text-gray-500');
            });

            if (tab === 'producao') {
                e.currentTarget.classList.add('border-blue-600', 'bg-blue-50', 'text-blue-700');
            } else if (tab === 'perdas') {
                e.currentTarget.classList.add('border-red-600', 'bg-red-50', 'text-red-700');
            } else if (tab === 'paradas') {
                e.currentTarget.classList.add('border-amber-600', 'bg-amber-50', 'text-amber-700');
            }
            e.currentTarget.classList.remove('border-transparent', 'text-gray-500');

            document.querySelectorAll('.acompanhamento-tab-content').forEach(content => {
                content.classList.add('hidden');
            });
            const tabContent = document.getElementById(`acompanhamento-tab-${tab}`);
            if (tabContent) tabContent.classList.remove('hidden');

            if (typeof lucide !== 'undefined') lucide.createIcons();
        });
    });

    // Data padrão = hoje (dia de produção)
    const dataInput = document.getElementById('acompanhamento-data');
    if (dataInput && !dataInput.value) {
        dataInput.value = getProductionDateString();
    }

    // Status de conexão
    const statusEl = document.getElementById('acompanhamento-status');
    if (statusEl) {
        statusEl.textContent = '✅ Conectado';
        statusEl.classList.remove('text-blue-600', 'bg-blue-100');
        statusEl.classList.add('text-green-600', 'bg-green-100');
    }

    // Botões
    const btnCarregar = document.getElementById('acompanhamento-carregar');
    const btnLimpar = document.getElementById('acompanhamento-limpar');
    const btnImprimir = document.getElementById('acompanhamento-imprimir');
    const btnSalvar = document.getElementById('acompanhamento-salvar');

    if (btnCarregar && !btnCarregar.dataset.listenerAttached) {
        btnCarregar.addEventListener('click', carregarDadosAcompanhamento);
        btnCarregar.dataset.listenerAttached = 'true';
    }
    if (btnLimpar && !btnLimpar.dataset.listenerAttached) {
        btnLimpar.addEventListener('click', limparCedocAcompanhamento);
        btnLimpar.dataset.listenerAttached = 'true';
    }
    if (btnImprimir && !btnImprimir.dataset.listenerAttached) {
        btnImprimir.addEventListener('click', () => window.print());
        btnImprimir.dataset.listenerAttached = 'true';
    }
    if (btnSalvar && !btnSalvar.dataset.listenerAttached) {
        btnSalvar.addEventListener('click', salvarDadosAcompanhamento);
        btnSalvar.dataset.listenerAttached = 'true';
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function carregarDadosAcompanhamento() {
    const data = document.getElementById('acompanhamento-data')?.value;
    if (!data) { showNotification('⚠️ Selecione a data!', 'warning'); return; }

    const tbody = document.getElementById('acompanhamento-tbody');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="10" class="px-4 py-10 text-center text-gray-400">
        <i data-lucide="loader-2" class="w-10 h-10 mx-auto mb-3 animate-spin opacity-50"></i>
        <p>Carregando dados do Hokkaido Mes...</p></td></tr>`;
    if (typeof lucide !== 'undefined') lucide.createIcons();

    try {
        const producaoPorMaquina = new Map();
        const docsProcessados = new Set();

        // OTIMIZADO Fase 2: executar as duas queries em paralelo COM cache
        const [docsData, docsDate] = await Promise.all([
            cachedQuery(`prod_data_${data}`, () => db().collection('production_entries').where('data', '==', data).get()),
            cachedQuery(`prod_date_${data}`, () => db().collection('production_entries').where('date', '==', data).get())
        ]);

        const processarDoc = (d, docId) => {
            if (docsProcessados.has(docId)) return;
            docsProcessados.add(docId);
            const machine = normalizeMachineId(d.machine || d.machine_id || d.maquina || '');
            if (!machine || machine === 'N/A') return;
            const quantidade = parseInt(d.produzido || d.quantity || 0, 10);
            const turno = parseInt(d.turno || d.shift || 0, 10);
            if (turno < 1 || turno > 3) return;
            if (quantidade <= 0) return;
            if (!producaoPorMaquina.has(machine)) {
                producaoPorMaquina.set(machine, { t1: 0, t2: 0, t3: 0 });
            }
            producaoPorMaquina.get(machine)[`t${turno}`] += quantidade;
        };

        docsData.forEach(d => processarDoc(d, d.id));
        docsDate.forEach(d => processarDoc(d, d.id));

        tbody.innerHTML = '';

        if (producaoPorMaquina.size === 0) {
            tbody.innerHTML = `<tr><td colspan="10" class="px-4 py-10 text-center text-gray-400">
                <i data-lucide="inbox" class="w-12 h-12 mx-auto mb-3 opacity-50"></i>
                <p>Nenhum lançamento encontrado para esta data</p></td></tr>`;
            document.getElementById('acompanhamento-resumo')?.classList.add('hidden');
            if (typeof lucide !== 'undefined') lucide.createIcons();
            return;
        }

        const maquinasOrdenadas = Array.from(producaoPorMaquina.entries()).sort((a, b) => a[0].localeCompare(b[0]));

        // Carregar dados salvos dos 3 turnos
        let dadosSalvos = {};
        try {
            for (const t of ['1', '2', '3']) {
                const docId = `${data}_T${t}`;
                const docSalvo = await db().collection('acompanhamento_turno').doc(docId).get();
                if (docSalvo.exists) {
                    const saved = docSalvo.data();
                    if (saved.registros) {
                        saved.registros.forEach(r => {
                            dadosSalvos[`${r.maquina}_T${t}`] = { cedoc: r.cedoc };
                        });
                    }
                }
            }
        } catch (e) {
            console.warn('[ACOMPANHAMENTO] Não foi possível carregar dados salvos:', e);
        }

        maquinasOrdenadas.forEach(([maquina, hokkaidos]) => {
            const salvoT1 = dadosSalvos[`${maquina}_T1`] || {};
            const salvoT2 = dadosSalvos[`${maquina}_T2`] || {};
            const salvoT3 = dadosSalvos[`${maquina}_T3`] || {};

            const linha = document.createElement('tr');
            linha.className = 'hover:bg-gray-50 transition-colors';
            linha.innerHTML = `
                <td class="px-3 py-2 border-r border-gray-200"><strong class="text-blue-600 text-sm">${maquina}</strong></td>
                <td class="px-1 py-2 text-center bg-blue-50/30"><input type="number" class="acompanhamento-cedoc w-20 p-1.5 border border-gray-200 rounded text-center text-xs focus:ring-1 focus:ring-blue-500" data-maquina="${maquina}" data-turno="1" placeholder="0" value="${salvoT1.cedoc || ''}"></td>
                <td class="px-1 py-2 text-center bg-blue-50/30"><span class="text-xs font-semibold acompanhamento-hokkaido" data-turno="1">${hokkaidos.t1}</span></td>
                <td class="px-1 py-2 text-center border-r border-gray-200 bg-blue-50/30"><span class="acompanhamento-diferenca text-xs font-bold" data-maquina="${maquina}" data-turno="1">0</span></td>
                <td class="px-1 py-2 text-center bg-purple-50/30"><input type="number" class="acompanhamento-cedoc w-20 p-1.5 border border-gray-200 rounded text-center text-xs focus:ring-1 focus:ring-purple-500" data-maquina="${maquina}" data-turno="2" placeholder="0" value="${salvoT2.cedoc || ''}"></td>
                <td class="px-1 py-2 text-center bg-purple-50/30"><span class="text-xs font-semibold acompanhamento-hokkaido" data-turno="2">${hokkaidos.t2}</span></td>
                <td class="px-1 py-2 text-center border-r border-gray-200 bg-purple-50/30"><span class="acompanhamento-diferenca text-xs font-bold" data-maquina="${maquina}" data-turno="2">0</span></td>
                <td class="px-1 py-2 text-center bg-orange-50/30"><input type="number" class="acompanhamento-cedoc w-20 p-1.5 border border-gray-200 rounded text-center text-xs focus:ring-1 focus:ring-orange-500" data-maquina="${maquina}" data-turno="3" placeholder="0" value="${salvoT3.cedoc || ''}"></td>
                <td class="px-1 py-2 text-center bg-orange-50/30"><span class="text-xs font-semibold acompanhamento-hokkaido" data-turno="3">${hokkaidos.t3}</span></td>
                <td class="px-1 py-2 text-center bg-orange-50/30"><span class="acompanhamento-diferenca text-xs font-bold" data-maquina="${maquina}" data-turno="3">0</span></td>
            `;
            linha.querySelectorAll('.acompanhamento-cedoc').forEach(input => {
                input.addEventListener('input', calcularDiferencasAcompanhamento);
            });
            tbody.appendChild(linha);
        });

        document.getElementById('acompanhamento-resumo')?.classList.remove('hidden');
        calcularDiferencasAcompanhamento();
        if (typeof lucide !== 'undefined') lucide.createIcons();

    } catch (error) {
        console.error('[ACOMPANHAMENTO] Erro ao carregar dados:', error);
        tbody.innerHTML = `<tr><td colspan="6" class="px-4 py-10 text-center text-red-400">
            <i data-lucide="alert-circle" class="w-12 h-12 mx-auto mb-3 opacity-50"></i>
            <p>Erro ao carregar: ${error.message}</p></td></tr>`;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
}

function calcularDiferencasAcompanhamento() {
    let celulasComDiferenca = 0;

    document.querySelectorAll('#acompanhamento-tbody tr').forEach(row => {
        row.querySelectorAll('.acompanhamento-cedoc').forEach(cedocInput => {
            const turno = cedocInput.dataset.turno;
            const hokaidoSpan = row.querySelector(`.acompanhamento-hokkaido[data-turno="${turno}"]`);
            const diferencaCell = row.querySelector(`.acompanhamento-diferenca[data-turno="${turno}"]`);

            if (cedocInput && hokaidoSpan && diferencaCell) {
                const cedoc = parseFloat(cedocInput.value) || 0;
                const hokkaido = parseFloat(hokaidoSpan.textContent) || 0;
                const diferenca = cedoc - hokkaido;

                diferencaCell.textContent = Math.round(diferenca);
                diferencaCell.classList.remove('text-red-600', 'bg-red-100', 'text-yellow-600', 'bg-yellow-100', 'text-green-600', 'bg-green-100', 'rounded', 'px-1');

                if (diferenca > 0) {
                    diferencaCell.classList.add('text-red-600', 'bg-red-100', 'rounded', 'px-1');
                    celulasComDiferenca++;
                } else if (diferenca < 0) {
                    diferencaCell.classList.add('text-yellow-600', 'bg-yellow-100', 'rounded', 'px-1');
                    celulasComDiferenca++;
                } else if (cedoc > 0) {
                    diferencaCell.classList.add('text-green-600', 'bg-green-100', 'rounded', 'px-1');
                }
            }
        });
    });

    const maquinasDiffEl = document.getElementById('acompanhamento-maquinas-diff');
    if (maquinasDiffEl) maquinasDiffEl.textContent = celulasComDiferenca;
}

function limparCedocAcompanhamento() {
    if (!confirm('⚠️ Limpar todos os valores CEDOC?')) return;
    document.querySelectorAll('.acompanhamento-cedoc').forEach(input => { input.value = ''; });
    calcularDiferencasAcompanhamento();
    showNotification('✅ Campos limpos!', 'success');
}

async function salvarDadosAcompanhamento() {
    const data = document.getElementById('acompanhamento-data')?.value;
    if (!data) { showNotification('⚠️ Selecione a data primeiro!', 'warning'); return; }

    const registrosPorTurno = { 1: [], 2: [], 3: [] };
    let temDados = false;

    document.querySelectorAll('#acompanhamento-tbody tr').forEach(row => {
        row.querySelectorAll('.acompanhamento-cedoc').forEach(cedocInput => {
            const maquina = cedocInput.dataset.maquina;
            const turnoLinha = parseInt(cedocInput.dataset.turno);
            const synchroSpan = row.querySelector(`.acompanhamento-synchro[data-turno="${turnoLinha}"]`);
            const diferencaCell = row.querySelector(`.acompanhamento-diferenca[data-turno="${turnoLinha}"]`);

            const cedoc = parseFloat(cedocInput.value) || 0;
            const synchro = parseFloat(synchroSpan?.textContent) || 0;
            const diferenca = parseFloat(diferencaCell?.textContent) || 0;

            if (cedoc > 0) temDados = true;

            registrosPorTurno[turnoLinha].push({ maquina, cedoc, synchro, diferenca });
        });
    });

    if (!temDados) { showNotification('⚠️ Preencha ao menos um valor CEDOC!', 'warning'); return; }

    try {
        const usuario = window.authSystem?.getCurrentUser()?.name || 'Desconhecido';
        for (const t of [1, 2, 3]) {
            if (registrosPorTurno[t].length > 0) {
                const docId = `${data}_T${t}`;
                await db().collection('acompanhamento_turno').doc(docId).set({
                    data, turno: t, registros: registrosPorTurno[t],
                    salvoEm: serverTimestamp(),
                    salvoEmLocal: new Date().toLocaleString('pt-BR'),
                    usuario
                }, { merge: true });
            }
        }
        showNotification('✅ Acompanhamento salvo com sucesso!', 'success');
        registrarLogSistema('SALVAMENTO DE ACOMPANHAMENTO', 'acompanhamento', {
            data,
            turnosRegistrados: Object.keys(registrosPorTurno).filter(t => registrosPorTurno[t].length > 0).length,
            totalRegistros: registrosPorTurno[1].length + registrosPorTurno[2].length + registrosPorTurno[3].length
        });
    } catch (error) {
        console.error('[ACOMPANHAMENTO] Erro ao salvar:', error);
        showNotification('❌ Erro ao salvar: ' + error.message, 'error');
    }
}

// ═══════════════════════════════════════════════
// 2. ACOMPANHAMENTO DE PERDAS
// ═══════════════════════════════════════════════

function setupAcompanhamentoPerdas() {
    if (acompanhamentoPerdasSetupDone) {
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }
    acompanhamentoPerdasSetupDone = true;

    const today = new Date().toISOString().split('T')[0];
    const dataInput = document.getElementById('acompanhamento-perdas-data');
    if (dataInput) dataInput.value = today;

    const btnCarregar = document.getElementById('acompanhamento-perdas-carregar');
    const btnLimpar = document.getElementById('acompanhamento-perdas-limpar');
    const btnSalvar = document.getElementById('acompanhamento-perdas-salvar');
    const btnImprimir = document.getElementById('acompanhamento-perdas-imprimir');

    if (btnCarregar) btnCarregar.addEventListener('click', carregarDadosAcompanhamentoPerdas);
    if (btnLimpar) btnLimpar.addEventListener('click', limparOpAcompanhamentoPerdas);
    if (btnSalvar) btnSalvar.addEventListener('click', salvarDadosAcompanhamentoPerdas);
    if (btnImprimir) btnImprimir.addEventListener('click', imprimirAcompanhamentoPerdas);

    const status = document.getElementById('acompanhamento-perdas-status');
    if (status) {
        status.textContent = '✅ Pronto';
        status.classList.remove('text-red-600', 'bg-red-100');
        status.classList.add('text-green-600', 'bg-green-100');
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function carregarDadosAcompanhamentoPerdas() {
    const data = document.getElementById('acompanhamento-perdas-data')?.value;
    if (!data) { showNotification('⚠️ Selecione a data!', 'warning'); return; }

    const tbody = document.getElementById('acompanhamento-perdas-tbody');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="10" class="px-4 py-10 text-center text-gray-400">
        <i data-lucide="loader-2" class="w-10 h-10 mx-auto mb-3 animate-spin opacity-50"></i>
        <p>Carregando dados de perdas do Hokkaido Mes...</p></td></tr>`;
    if (typeof lucide !== 'undefined') lucide.createIcons();

    try {
        const perdasPorMaquina = new Map();
        const docsProcessados = new Set();

        // OTIMIZAÇÃO Fase 2: executar todas as 6 queries em paralelo COM cache (3 turnos x 2 campos)
        const queryPromises = [];
        for (const t of [1, 2, 3]) {
            queryPromises.push(
                cachedQuery(`prod_data_${data}_turno_${t}`, () =>
                    db().collection('production_entries').where('data', '==', data).where('turno', '==', t).get()
                ).then(docs => ({ turno: t, docs }))
            );
            queryPromises.push(
                cachedQuery(`prod_data_${data}_shift_${t}`, () =>
                    db().collection('production_entries').where('data', '==', data).where('shift', '==', t).get()
                ).then(docs => ({ turno: t, docs }))
            );
        }
        const results = await Promise.all(queryPromises);

        results.forEach(({ turno: t, docs }) => {
            docs.forEach(d => {
                if (docsProcessados.has(d.id)) return;
                docsProcessados.add(d.id);
                const machine = d.machine || d.machine_id || d.maquina || 'N/A';
                const refugo = parseFloat(d.refugo_kg || d.refugo || 0);
                if (refugo <= 0) return;
                if (!perdasPorMaquina.has(machine)) perdasPorMaquina.set(machine, { t1: 0, t2: 0, t3: 0 });
                perdasPorMaquina.get(machine)[`t${t}`] += refugo;
            });
        });

        tbody.innerHTML = '';

        if (perdasPorMaquina.size === 0) {
            tbody.innerHTML = `<tr><td colspan="10" class="px-4 py-10 text-center text-gray-400">
                <i data-lucide="inbox" class="w-12 h-12 mx-auto mb-3 opacity-50"></i>
                <p>Nenhum lançamento de perdas encontrado para esta data</p></td></tr>`;
            document.getElementById('acompanhamento-perdas-resumo')?.classList.add('hidden');
            if (typeof lucide !== 'undefined') lucide.createIcons();
            return;
        }

        const maquinasOrdenadas = Array.from(perdasPorMaquina.entries()).sort((a, b) => a[0].localeCompare(b[0]));

        let dadosSalvos = {};
        try {
            for (const t of ['1', '2', '3']) {
                const docId = `${data}_T${t}`;
                const docSalvo = await db().collection('acompanhamento_perdas').doc(docId).get();
                if (docSalvo.exists) {
                    const saved = docSalvo.data();
                    if (saved.registros) {
                        saved.registros.forEach(r => { dadosSalvos[`${r.maquina}_T${t}`] = { op: r.op }; });
                    }
                }
            }
        } catch (e) {
            console.warn('[ACOMPANHAMENTO-PERDAS] Não foi possível carregar dados salvos:', e);
        }

        acompanhamentoPerdasDataAtual = { data, maquinas: {} };

        maquinasOrdenadas.forEach(([maquina, perdasMes]) => {
            const salvoT1 = dadosSalvos[`${maquina}_T1`] || {};
            const salvoT2 = dadosSalvos[`${maquina}_T2`] || {};
            const salvoT3 = dadosSalvos[`${maquina}_T3`] || {};

            acompanhamentoPerdasDataAtual.maquinas[maquina] = {
                mes: perdasMes,
                op: { t1: salvoT1.op || 0, t2: salvoT2.op || 0, t3: salvoT3.op || 0 }
            };

            const linha = document.createElement('tr');
            linha.className = 'hover:bg-gray-50 transition-colors';
            linha.dataset.maquina = maquina;
            linha.innerHTML = `
                <td class="px-3 py-2 border-r border-gray-200"><strong class="text-red-600 text-sm">${maquina}</strong></td>
                <td class="px-1 py-2 text-center bg-red-50/30"><input type="number" step="0.01" class="acompanhamento-op-perdas w-20 p-1.5 border border-gray-200 rounded text-center text-xs focus:ring-1 focus:ring-red-500" data-maquina="${maquina}" data-turno="1" placeholder="0" value="${salvoT1.op || ''}"></td>
                <td class="px-1 py-2 text-center bg-red-50/30"><span class="text-xs font-semibold acompanhamento-mes-perdas" data-turno="1">${perdasMes.t1.toFixed(2)}</span></td>
                <td class="px-1 py-2 text-center border-r border-gray-200 bg-red-50/30"><span class="acompanhamento-diferenca-perdas text-xs font-bold" data-maquina="${maquina}" data-turno="1">0</span></td>
                <td class="px-1 py-2 text-center bg-purple-50/30"><input type="number" step="0.01" class="acompanhamento-op-perdas w-20 p-1.5 border border-gray-200 rounded text-center text-xs focus:ring-1 focus:ring-purple-500" data-maquina="${maquina}" data-turno="2" placeholder="0" value="${salvoT2.op || ''}"></td>
                <td class="px-1 py-2 text-center bg-purple-50/30"><span class="text-xs font-semibold acompanhamento-mes-perdas" data-turno="2">${perdasMes.t2.toFixed(2)}</span></td>
                <td class="px-1 py-2 text-center border-r border-gray-200 bg-purple-50/30"><span class="acompanhamento-diferenca-perdas text-xs font-bold" data-maquina="${maquina}" data-turno="2">0</span></td>
                <td class="px-1 py-2 text-center bg-orange-50/30"><input type="number" step="0.01" class="acompanhamento-op-perdas w-20 p-1.5 border border-gray-200 rounded text-center text-xs focus:ring-1 focus:ring-orange-500" data-maquina="${maquina}" data-turno="3" placeholder="0" value="${salvoT3.op || ''}"></td>
                <td class="px-1 py-2 text-center bg-orange-50/30"><span class="text-xs font-semibold acompanhamento-mes-perdas" data-turno="3">${perdasMes.t3.toFixed(2)}</span></td>
                <td class="px-1 py-2 text-center bg-orange-50/30"><span class="acompanhamento-diferenca-perdas text-xs font-bold" data-maquina="${maquina}" data-turno="3">0</span></td>
            `;
            linha.querySelectorAll('.acompanhamento-op-perdas').forEach(input => {
                input.addEventListener('input', calcularDiferencasPerdas);
            });
            tbody.appendChild(linha);
        });

        calcularDiferencasPerdas();
        document.getElementById('acompanhamento-perdas-resumo')?.classList.remove('hidden');
        showNotification(`✅ Dados de perdas carregados: ${maquinasOrdenadas.length} máquinas`, 'success');
        if (typeof lucide !== 'undefined') lucide.createIcons();

    } catch (error) {
        console.error('[ACOMPANHAMENTO-PERDAS] Erro ao carregar:', error);
        showNotification('❌ Erro ao carregar dados de perdas: ' + error.message, 'error');
        tbody.innerHTML = `<tr><td colspan="10" class="px-4 py-10 text-center text-red-500">
            <i data-lucide="alert-circle" class="w-12 h-12 mx-auto mb-3 opacity-50"></i>
            <p>Erro ao carregar dados. Tente novamente.</p></td></tr>`;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
}

function calcularDiferencasPerdas() {
    const tbody = document.getElementById('acompanhamento-perdas-tbody');
    if (!tbody) return;

    let totalOp = 0, totalMes = 0, maquinasComDiferenca = 0;

    tbody.querySelectorAll('tr[data-maquina]').forEach(row => {
        const maquina = row.dataset.maquina;
        const dados = acompanhamentoPerdasDataAtual.maquinas?.[maquina];
        if (!dados) return;

        const mes = dados.mes;
        const inputs = row.querySelectorAll('.acompanhamento-op-perdas');
        const diferencas = row.querySelectorAll('.acompanhamento-diferenca-perdas');
        let temDiferenca = false;

        inputs.forEach((input, idx) => {
            const turno = input.dataset.turno;
            const opValue = parseFloat(input.value) || 0;
            const mesValue = mes[`t${turno}`] || 0;
            const diff = opValue - mesValue;

            const diffSpan = diferencas[idx];
            if (diffSpan) {
                if (Math.abs(diff) < 0.01) {
                    diffSpan.innerHTML = '<span class="text-green-600">0</span>';
                } else if (diff > 0) {
                    diffSpan.innerHTML = `<span class="text-orange-600">+${diff.toFixed(2)}</span>`;
                    temDiferenca = true;
                } else {
                    diffSpan.innerHTML = `<span class="text-red-600">${diff.toFixed(2)}</span>`;
                    temDiferenca = true;
                }
            }

            totalOp += opValue;
            totalMes += mesValue;
            dados.op[`t${turno}`] = opValue;
        });

        if (temDiferenca) { row.classList.add('bg-red-50'); maquinasComDiferenca++; }
        else { row.classList.remove('bg-red-50'); }
    });

    const maqDiffEl = document.getElementById('acompanhamento-perdas-maquinas-diff');
    const totalOpEl = document.getElementById('acompanhamento-perdas-total-op');
    const totalMesEl = document.getElementById('acompanhamento-perdas-total-mes');

    if (maqDiffEl) maqDiffEl.textContent = maquinasComDiferenca;
    if (totalOpEl) totalOpEl.textContent = totalOp.toFixed(2);
    if (totalMesEl) totalMesEl.textContent = totalMes.toFixed(2);
}

function limparOpAcompanhamentoPerdas() {
    if (!confirm('Limpar todos os valores de OP? Esta ação não pode ser desfeita.')) return;
    document.querySelectorAll('.acompanhamento-op-perdas').forEach(input => { input.value = ''; });
    if (acompanhamentoPerdasDataAtual.maquinas) {
        Object.keys(acompanhamentoPerdasDataAtual.maquinas).forEach(maquina => {
            acompanhamentoPerdasDataAtual.maquinas[maquina].op = { t1: 0, t2: 0, t3: 0 };
        });
    }
    calcularDiferencasPerdas();
    showNotification('🗑️ Valores de OP limpos', 'info');
}

async function salvarDadosAcompanhamentoPerdas() {
    if (!acompanhamentoPerdasDataAtual.data) {
        showNotification('⚠️ Carregue os dados primeiro', 'warning'); return;
    }

    try {
        const data = acompanhamentoPerdasDataAtual.data;
        const usuario = window.authSystem?.getCurrentUser();

        for (const t of ['1', '2', '3']) {
            const registros = [];
            document.querySelectorAll(`.acompanhamento-op-perdas[data-turno="${t}"]`).forEach(input => {
                const maquina = input.dataset.maquina;
                const opValue = parseFloat(input.value) || 0;
                const mesValue = acompanhamentoPerdasDataAtual.maquinas?.[maquina]?.mes?.[`t${t}`] || 0;
                registros.push({ maquina, op: opValue, mes: mesValue, diferenca: opValue - mesValue });
            });

            const docId = `${data}_T${t}`;
            await db().collection('acompanhamento_perdas').doc(docId).set({
                data, turno: parseInt(t), registros,
                atualizadoEm: serverTimestamp(),
                atualizadoPor: usuario?.name || 'Desconhecido'
            });
        }

        showNotification('✅ Dados de perdas salvos com sucesso!', 'success');
    } catch (error) {
        console.error('[ACOMPANHAMENTO-PERDAS] Erro ao salvar:', error);
        showNotification('❌ Erro ao salvar: ' + error.message, 'error');
    }
}

function imprimirAcompanhamentoPerdas() {
    const tabela = document.getElementById('acompanhamento-perdas-tabela');
    const data = acompanhamentoPerdasDataAtual.data || 'Não selecionada';
    const totalOp = document.getElementById('acompanhamento-perdas-total-op')?.textContent || '0';
    const totalMes = document.getElementById('acompanhamento-perdas-total-mes')?.textContent || '0';
    const maquinasDiff = document.getElementById('acompanhamento-perdas-maquinas-diff')?.textContent || '0';

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`<!DOCTYPE html><html><head><title>Acompanhamento de Perdas - ${data}</title>
    <style>body{font-family:Arial,sans-serif;padding:20px}h1{text-align:center;color:#dc2626;margin-bottom:5px}.subtitle{text-align:center;color:#666;margin-bottom:20px}.resumo{display:flex;justify-content:space-around;margin-bottom:20px;padding:15px;background:#fef2f2;border-radius:8px}.resumo-item{text-align:center}.resumo-item label{display:block;font-size:12px;color:#666}.resumo-item span{font-size:24px;font-weight:bold;color:#dc2626}table{width:100%;border-collapse:collapse;font-size:11px}th{background:#dc2626;color:white;padding:8px 4px;border:1px solid #b91c1c}td{padding:6px 4px;border:1px solid #ddd;text-align:center}tr:nth-child(even){background:#f9f9f9}@media print{body{padding:0}}</style></head>
    <body><h1>Acompanhamento de Perdas</h1><p class="subtitle">Data: ${data} | Validação Perdas vs OP</p>
    <div class="resumo"><div class="resumo-item"><label>Máquinas c/ Diferença</label><span>${maquinasDiff}</span></div>
    <div class="resumo-item"><label>Total OP (kg)</label><span>${totalOp}</span></div>
    <div class="resumo-item"><label>Total MES (kg)</label><span>${totalMes}</span></div></div>
    ${tabela.outerHTML.replace(/class="[^"]*"/g, '').replace(/<input[^>]*value="([^"]*)"[^>]*>/g, '$1').replace(/<input[^>]*>/g, '0')}
    <p style="text-align:center;margin-top:20px;color:#888;font-size:11px">Impresso em: ${new Date().toLocaleString('pt-BR')} | Hokkaido MES</p></body></html>`);
    printWindow.document.close();
    printWindow.print();
}

// ═══════════════════════════════════════════════
// 3. ACOMPANHAMENTO DE PARADAS (TIMELINE)
// ═══════════════════════════════════════════════

function setupAcompanhamentoParadas() {
    if (acompanhamentoParadasSetupDone) {
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }
    acompanhamentoParadasSetupDone = true;

    const today = new Date().toISOString().split('T')[0];
    const dataInput = document.getElementById('acompanhamento-paradas-data');
    if (dataInput) dataInput.value = today;

    const btnCarregar = document.getElementById('acompanhamento-paradas-carregar');
    const btnImprimir = document.getElementById('acompanhamento-paradas-imprimir');
    const btnExportar = document.getElementById('acompanhamento-paradas-exportar');

    if (btnCarregar) btnCarregar.addEventListener('click', carregarTimelineParadas);
    if (btnImprimir) btnImprimir.addEventListener('click', imprimirTimelineParadas);
    if (btnExportar) btnExportar.addEventListener('click', exportarTimelineParadas);

    const status = document.getElementById('acompanhamento-paradas-status');
    if (status) {
        status.textContent = '✅ Pronto';
        status.classList.remove('text-amber-600', 'bg-amber-100');
        status.classList.add('text-green-600', 'bg-green-100');
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function carregarTimelineParadas() {
    const data = document.getElementById('acompanhamento-paradas-data')?.value;
    const turnoFiltro = document.getElementById('acompanhamento-paradas-turno')?.value || 'all';
    const container = document.getElementById('acompanhamento-paradas-timeline');
    const escalaEl = document.getElementById('paradas-escala-tempo');

    if (!data) { showNotification('⚠️ Selecione uma data!', 'warning'); return; }

    container.innerHTML = `<div class="text-center py-10 text-gray-400">
        <div class="animate-spin w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full mx-auto mb-3"></div>
        <p>Carregando timeline de paradas...</p></div>`;

    try {
        let horaInicio, horaFim, escalaMarcas;
        if (turnoFiltro === '1') {
            horaInicio = 7; horaFim = 15;
            escalaMarcas = ['07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00'];
        } else if (turnoFiltro === '2') {
            horaInicio = 15; horaFim = 23;
            escalaMarcas = ['15:00','16:00','17:00','18:00','19:00','20:00','21:00','22:00','23:00'];
        } else if (turnoFiltro === '3') {
            horaInicio = 23; horaFim = 31;
            escalaMarcas = ['23:00','00:00','01:00','02:00','03:00','04:00','05:00','06:00','07:00'];
        } else {
            horaInicio = 7; horaFim = 31;
            escalaMarcas = ['07:00','10:00','13:00','16:00','19:00','22:00','01:00','04:00','07:00'];
        }

        escalaEl.innerHTML = escalaMarcas.map(h => `<span>${h}</span>`).join('');

        const maquinasPlanejamento = new Set();
        // OTIMIZADO Fase 2: usar cache para planning
        const planejamentoDocs = await cachedQuery(`planning_${data}`, () =>
            db().collection('planning').where('date', '==', data).get()
        );
        planejamentoDocs.forEach(d => {
            if (d.machine || d.maquina) maquinasPlanejamento.add(normalizeMachineId(d.machine || d.maquina));
        });

        if (maquinasPlanejamento.size === 0) {
            const producaoDocs = await cachedQuery(`prod_data_${data}`, () =>
                db().collection('production_entries').where('data', '==', data).get()
            );
            producaoDocs.forEach(d => {
                if (d.machine) maquinasPlanejamento.add(d.machine);
            });
        }

        if (maquinasPlanejamento.size === 0) {
            ['H31','H32','H33','H34','H35','H36','H37','H38','H39','H40'].forEach(m => maquinasPlanejamento.add(m));
        }

        const maquinasOrdenadas = Array.from(maquinasPlanejamento).sort((a, b) => {
            const numA = parseInt(a.replace(/\D/g, '')) || 0;
            const numB = parseInt(b.replace(/\D/g, '')) || 0;
            return numA - numB;
        });

        const paradasPorMaquina = new Map();
        // OTIMIZADO Fase 2: usar cache para downtime_entries
        const paradasDocs = await cachedQuery(`downtime_${data}`, () =>
            db().collection('downtime_entries').where('date', '==', data).get()
        );

        paradasDocs.forEach(d => {
            const machine = normalizeMachineId(d.machine || d.maquina || '');
            if (!machine || !maquinasPlanejamento.has(machine)) return;
            if (turnoFiltro !== 'all') {
                const turnoParada = d.turno || d.shift;
                if (String(turnoParada) !== turnoFiltro) return;
            }
            if (!paradasPorMaquina.has(machine)) paradasPorMaquina.set(machine, []);
            // duration é armazenado em MINUTOS no Firestore — converter para horas para a timeline
            const durationMinutes = parseFloat(d.duration || d.duracao || 0);
            paradasPorMaquina.get(machine).push({
                inicio: d.startTime || d.horaInicio || d.hora_inicio,
                fim: d.endTime || d.horaFim || d.hora_fim,
                duracao: durationMinutes / 60,
                motivo: d.reason || d.motivo || d.observacao || 'Não informado',
                tipo: (d.tipo || d.type || '').toLowerCase()
            });
        });

        let tempoTotalParado = 0, totalParadas = 0;
        paradasPorMaquina.forEach(paradas => {
            paradas.forEach(p => { tempoTotalParado += p.duracao; totalParadas++; });
        });

        const tempoTurno = turnoFiltro === 'all' ? 24 * maquinasOrdenadas.length : 8 * maquinasOrdenadas.length;
        const tempoProducao = tempoTurno - tempoTotalParado;
        const disponibilidade = tempoTurno > 0 ? ((tempoProducao / tempoTurno) * 100) : 0;

        const resumoEl = document.getElementById('acompanhamento-paradas-resumo');
        if (resumoEl) {
            resumoEl.classList.remove('hidden');
            document.getElementById('acompanhamento-paradas-tempo-prod').textContent = `${tempoProducao.toFixed(1)}h`;
            document.getElementById('acompanhamento-paradas-tempo-parado').textContent = `${tempoTotalParado.toFixed(1)}h`;
            document.getElementById('acompanhamento-paradas-total').textContent = totalParadas;
            document.getElementById('acompanhamento-paradas-disponibilidade').textContent = `${disponibilidade.toFixed(1)}%`;
        }

        acompanhamentoParadasDataAtual = { data, turno: turnoFiltro, maquinas: maquinasOrdenadas, paradas: paradasPorMaquina, horaInicio, horaFim };

        container.innerHTML = '';
        maquinasOrdenadas.forEach(maquina => {
            const paradas = paradasPorMaquina.get(maquina) || [];
            container.appendChild(criarLinhaTimelineParadas(maquina, paradas, horaInicio, horaFim));
        });

        showNotification(`✅ Timeline carregada: ${maquinasOrdenadas.length} máquinas, ${totalParadas} paradas`, 'success');
        if (typeof lucide !== 'undefined') lucide.createIcons();

    } catch (error) {
        console.error('[ACOMPANHAMENTO-PARADAS] Erro:', error);
        showNotification('❌ Erro ao carregar timeline: ' + error.message, 'error');
        container.innerHTML = `<div class="text-center py-10 text-red-500">
            <i data-lucide="alert-circle" class="w-12 h-12 mx-auto mb-3 opacity-50"></i>
            <p>Erro ao carregar dados. Tente novamente.</p></div>`;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
}

function criarLinhaTimelineParadas(maquina, paradas, horaInicio, horaFim) {
    const row = document.createElement('div');
    row.className = 'flex items-center gap-2 py-2 border-b border-gray-100 hover:bg-gray-50 transition-colors';

    const labelDiv = document.createElement('div');
    labelDiv.className = 'w-24 flex-shrink-0 font-bold text-sm text-gray-700';
    labelDiv.textContent = maquina;
    row.appendChild(labelDiv);

    const timelineDiv = document.createElement('div');
    timelineDiv.className = 'flex-1 h-8 bg-green-400 rounded-lg relative overflow-hidden';
    timelineDiv.title = `${maquina} - Clique para ver detalhes`;

    const duracaoTotal = horaFim - horaInicio;

    paradas.forEach(parada => {
        let horaInicioParada = 0;
        if (parada.inicio) {
            const parts = parada.inicio.split(':');
            horaInicioParada = parseInt(parts[0]) + (parseInt(parts[1] || 0) / 60);
            if (horaInicioParada < 7 && horaInicio >= 23) horaInicioParada += 24;
        }
        const duracao = parada.duracao || 1;
        const posicaoInicio = ((horaInicioParada - horaInicio) / duracaoTotal) * 100;
        const largura = (duracao / duracaoTotal) * 100;

        const blocoParada = document.createElement('div');
        const isSetup = parada.tipo && (parada.tipo.includes('setup') || parada.tipo.includes('troca'));
        blocoParada.className = `absolute top-0 h-full ${isSetup ? 'bg-yellow-500' : 'bg-red-500'} cursor-pointer hover:opacity-80 transition-opacity`;
        blocoParada.style.left = `${Math.max(0, Math.min(posicaoInicio, 100))}%`;
        blocoParada.style.width = `${Math.max(0.5, Math.min(largura, 100 - posicaoInicio))}%`;
        blocoParada.title = `${parada.inicio || '?'} - ${parada.fim || '?'}\n${parada.motivo}\nDuração: ${duracao.toFixed(1)}h`;

        if (largura > 8) {
            blocoParada.innerHTML = `<span class="text-white text-xs font-semibold truncate px-1 leading-8">${parada.motivo.substring(0, 15)}</span>`;
        }
        timelineDiv.appendChild(blocoParada);
    });

    if (paradas.length === 0) timelineDiv.title = `${maquina} - Sem paradas registradas`;
    row.appendChild(timelineDiv);

    const statsDiv = document.createElement('div');
    statsDiv.className = 'w-20 flex-shrink-0 text-right';
    const tempoParado = paradas.reduce((acc, p) => acc + (p.duracao || 0), 0);
    statsDiv.innerHTML = `<span class="text-xs font-semibold ${tempoParado > 0 ? 'text-red-600' : 'text-green-600'}">${tempoParado.toFixed(1)}h</span>`;
    row.appendChild(statsDiv);

    return row;
}

function imprimirTimelineParadas() {
    const data = acompanhamentoParadasDataAtual.data || 'Não selecionada';
    const turno = acompanhamentoParadasDataAtual.turno || 'all';
    const turnoLabel = turno === 'all' ? 'Todos' : `T${turno}`;

    const tempoProd = document.getElementById('acompanhamento-paradas-tempo-prod')?.textContent || '0h';
    const tempoParado = document.getElementById('acompanhamento-paradas-tempo-parado')?.textContent || '0h';
    const totalParadas = document.getElementById('acompanhamento-paradas-total')?.textContent || '0';
    const disponibilidade = document.getElementById('acompanhamento-paradas-disponibilidade')?.textContent || '0%';

    let linhasHtml = '';
    acompanhamentoParadasDataAtual.maquinas?.forEach(maquina => {
        const paradas = acompanhamentoParadasDataAtual.paradas?.get(maquina) || [];
        const tempoParadoMaq = paradas.reduce((acc, p) => acc + (p.duracao || 0), 0);
        linhasHtml += `<tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold">${maquina}</td>
            <td style="padding:8px;border:1px solid #ddd;text-align:center">${paradas.length}</td>
            <td style="padding:8px;border:1px solid #ddd;text-align:center;color:${tempoParadoMaq > 0 ? '#dc2626' : '#16a34a'}">${tempoParadoMaq.toFixed(1)}h</td>
            <td style="padding:8px;border:1px solid #ddd;font-size:11px">${paradas.map(p => p.motivo).join(', ') || '-'}</td></tr>`;
    });

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`<!DOCTYPE html><html><head><title>Timeline de Paradas - ${data}</title>
    <style>body{font-family:Arial,sans-serif;padding:20px}h1{text-align:center;color:#d97706;margin-bottom:5px}.subtitle{text-align:center;color:#666;margin-bottom:20px}.resumo{display:flex;justify-content:space-around;margin-bottom:20px;padding:15px;background:#fffbeb;border-radius:8px}.resumo-item{text-align:center}.resumo-item label{display:block;font-size:12px;color:#666}.resumo-item span{font-size:20px;font-weight:bold}.resumo-item.green span{color:#16a34a}.resumo-item.red span{color:#dc2626}.resumo-item.amber span{color:#d97706}.resumo-item.blue span{color:#2563eb}table{width:100%;border-collapse:collapse;margin-top:20px}th{background:#d97706;color:white;padding:10px;border:1px solid #b45309}td{padding:8px;border:1px solid #ddd}tr:nth-child(even){background:#f9f9f9}@media print{body{padding:0}}</style></head>
    <body><h1>Timeline de Paradas</h1><p class="subtitle">Data: ${data} | Turno: ${turnoLabel}</p>
    <div class="resumo"><div class="resumo-item green"><label>Tempo Produzindo</label><span>${tempoProd}</span></div>
    <div class="resumo-item red"><label>Tempo Parado</label><span>${tempoParado}</span></div>
    <div class="resumo-item amber"><label>Total Paradas</label><span>${totalParadas}</span></div>
    <div class="resumo-item blue"><label>Disponibilidade</label><span>${disponibilidade}</span></div></div>
    <table><thead><tr><th>Máquina</th><th>Qtd Paradas</th><th>Tempo Parado</th><th>Motivos</th></tr></thead>
    <tbody>${linhasHtml}</tbody></table>
    <p style="text-align:center;margin-top:20px;color:#888;font-size:11px">Impresso em: ${new Date().toLocaleString('pt-BR')} | Hokkaido MES</p></body></html>`);
    printWindow.document.close();
    printWindow.print();
}

function exportarTimelineParadas() {
    if (!acompanhamentoParadasDataAtual.maquinas) {
        showNotification('⚠️ Carregue os dados primeiro', 'warning'); return;
    }

    let csv = 'Máquina;Qtd Paradas;Tempo Parado (h);Motivos\n';
    acompanhamentoParadasDataAtual.maquinas.forEach(maquina => {
        const paradas = acompanhamentoParadasDataAtual.paradas?.get(maquina) || [];
        const tempoParado = paradas.reduce((acc, p) => acc + (p.duracao || 0), 0);
        const motivos = paradas.map(p => p.motivo).join(' | ');
        csv += `${maquina};${paradas.length};${tempoParado.toFixed(2)};"${motivos}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `timeline-paradas-${acompanhamentoParadasDataAtual.data}.csv`;
    link.click();

    showNotification('✅ Arquivo CSV exportado!', 'success');
}
