/**
 * HokkaidoMES  Admin Dados Controller (Modulo ES6)
 * Fase 3B: Migracao completa do controlador de Admin
 *
 * Escopo: Pagina administrativa de dados (Paradas, Ordens, Producao, Perdas, Planejamento, Ajustes em Lote)
 * 49 funcoes, ~3852 linhas migradas de script.js L26306-30158
 * 3 window.* exposures (adminParadasEditar, adminParadasExcluir, adminExcluirParadasPorMotivo)
 *
 * Flag: USE_MODULAR_ADMIN
 */

import { getDb } from '../services/firebase-client.js';
import { escapeHtml, normalizeMachineId } from '../utils/dom.utils.js';
import { showNotification } from '../components/notification.js';
import { registrarLogSistema } from '../utils/logger.js';
import { getActiveUser, isUserGestorOrAdmin, showPermissionDeniedNotification, getCurrentUserName } from '../utils/auth.utils.js';
import { getProductionDateString } from '../utils/date.utils.js';
import { getGroupedDowntimeReasons } from '../utils/color.utils.js';

// --- Helpers ---
function db() { return getDb(); }

    // ==================== ADMINISTRAÇÃO DE DADOS ====================
    let adminDadosSetupDone = false;
    let adminCurrentOrderDoc = null;
    let adminCurrentProductionDoc = null;
    let adminCurrentPlanningDoc = null;
    
    function setupAdminDadosPage() {
        // Verificar permissão - apenas gestores e admins
        if (!isUserGestorOrAdmin()) {
            showPermissionDeniedNotification('acessar a administração de dados');
            window.showPage('lancamento');
            return;
        }
        
        if (adminDadosSetupDone) {
            if (typeof lucide !== 'undefined') (typeof lucide !== 'undefined' && lucide.createIcons());
            return;
        }
        adminDadosSetupDone = true;
        
        console.log('[ADMIN-DADOS] Inicializando página de administração...');
        
        // Setup das abas internas
        document.querySelectorAll('.admin-tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.currentTarget.dataset.adminTab;
                switchAdminTab(tab);
            });
        });
        
        // Aba Paradas - nova gestão de paradas
        setupAdminParadasGestao();
        
        // Aba Ordens - nova estrutura simplificada
        const btnBuscarOP = document.getElementById('admin-btn-buscar-op');
        const btnSalvarOP = document.getElementById('admin-btn-salvar-op');
        const inputBuscaOP = document.getElementById('admin-ordem-busca');
        const inputNovaQtd = document.getElementById('admin-op-nova-qtd');
        
        if (btnBuscarOP) btnBuscarOP.addEventListener('click', adminBuscarOrdemSimplificado);
        if (btnSalvarOP) btnSalvarOP.addEventListener('click', adminSalvarOrdemSimplificado);
        
        // Busca ao pressionar Enter
        if (inputBuscaOP) {
            inputBuscaOP.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') adminBuscarOrdemSimplificado();
            });
        }
        
        // Preview ao digitar nova quantidade
        if (inputNovaQtd) {
            inputNovaQtd.addEventListener('input', adminPreviewAlteracao);
        }
        
        // Aba Produção - setup
        const dataProducao = document.getElementById('admin-producao-data');
        if (dataProducao) dataProducao.value = getProductionDateString();
        
        // Popular select de máquinas (Produção)
        const selectMaquina = document.getElementById('admin-producao-maquina');
        if (selectMaquina && window.databaseModule?.machineDatabase) {
            let options = '<option value="">Todas</option>';
            window.databaseModule.machineDatabase.forEach(m => {
                const id = normalizeMachineId(m.id);
                options += `<option value="${id}">${id}</option>`;
            });
            selectMaquina.innerHTML = options;
        }
        
        const btnBuscarProducao = document.getElementById('admin-btn-buscar-producao');
        if (btnBuscarProducao) btnBuscarProducao.addEventListener('click', adminBuscarProducao);

        // ===== Aba Perdas - setup =====
        const dataPerdas = document.getElementById('admin-perdas-data');
        if (dataPerdas) dataPerdas.value = getProductionDateString();
        
        // Popular select de máquinas (Perdas)
        const selectMaquinaPerdas = document.getElementById('admin-perdas-maquina');
        if (selectMaquinaPerdas && window.databaseModule?.machineDatabase) {
            let options = '<option value="">Todas</option>';
            window.databaseModule.machineDatabase.forEach(m => {
                const id = normalizeMachineId(m.id);
                options += `<option value="${id}">${id}</option>`;
            });
            selectMaquinaPerdas.innerHTML = options;
        }
        
        const btnBuscarPerdas = document.getElementById('admin-btn-buscar-perdas');
        if (btnBuscarPerdas) btnBuscarPerdas.addEventListener('click', adminBuscarPerdas);

        // Aba Planejamento - setup
        const dataPlanejamento = document.getElementById('admin-planejamento-data');
        if (dataPlanejamento) dataPlanejamento.value = getProductionDateString();
        
        // Popular select de máquinas (Planejamento)
        const selectMaquinaPlan = document.getElementById('admin-planejamento-maquina');
        if (selectMaquinaPlan && window.databaseModule?.machineDatabase) {
            let options = '<option value="">Todas</option>';
            window.databaseModule.machineDatabase.forEach(m => {
                const id = normalizeMachineId(m.id);
                options += `<option value="${id}">${id}</option>`;
            });
            selectMaquinaPlan.innerHTML = options;
        }
        
        const btnBuscarPlanejamento = document.getElementById('admin-btn-buscar-planejamento');
        if (btnBuscarPlanejamento) btnBuscarPlanejamento.addEventListener('click', adminBuscarPlanejamento);
        
        // ===== Aba Ajustes em Lote - setup =====
        const dataAjuste = document.getElementById('admin-ajuste-data');
        if (dataAjuste) dataAjuste.value = getProductionDateString();
        
        // Popular select de máquinas (Ajustes)
        const selectMaquinaAjuste = document.getElementById('admin-ajuste-maquina');
        if (selectMaquinaAjuste && window.databaseModule?.machineDatabase) {
            let options = '<option value="">Todas</option>';
            window.databaseModule.machineDatabase.forEach(m => {
                const id = normalizeMachineId(m.id);
                options += `<option value="${id}">${id}</option>`;
            });
            selectMaquinaAjuste.innerHTML = options;
        }
        
        const btnCarregarAjustes = document.getElementById('admin-btn-carregar-ajustes');
        if (btnCarregarAjustes) btnCarregarAjustes.addEventListener('click', adminCarregarAjustesLote);
        
        const btnSalvarAjustes = document.getElementById('admin-btn-salvar-ajustes');
        if (btnSalvarAjustes) btnSalvarAjustes.addEventListener('click', adminSalvarAjustesLote);
        
        const btnDescartarAjustes = document.getElementById('admin-btn-descartar-ajustes');
        if (btnDescartarAjustes) btnDescartarAjustes.addEventListener('click', adminDescartarAjustes);
        
        const btnSyncTotais = document.getElementById('admin-btn-sync-totais');
        if (btnSyncTotais) btnSyncTotais.addEventListener('click', adminSincronizarTotais);
        
        if (typeof lucide !== 'undefined') (typeof lucide !== 'undefined' && lucide.createIcons());
    }
    
    function switchAdminTab(tabName) {
        // Atualizar botões
        document.querySelectorAll('.admin-tab-btn').forEach(btn => {
            if (btn.dataset.adminTab === tabName) {
                btn.className = 'admin-tab-btn active px-4 py-2 text-sm font-semibold rounded-t-lg transition bg-blue-500 text-white whitespace-nowrap';
            } else {
                btn.className = 'admin-tab-btn px-4 py-2 text-sm font-semibold rounded-t-lg transition bg-gray-100 text-gray-600 hover:bg-gray-200 whitespace-nowrap';
            }
        });
        
        // Mostrar/ocultar conteúdo
        document.querySelectorAll('.admin-tab-content').forEach(content => {
            content.classList.add('hidden');
        });
        const activeContent = document.getElementById(`admin-tab-${tabName}`);
        if (activeContent) activeContent.classList.remove('hidden');
    }
    
    function adminLog(message, type = 'info') {
        const container = document.getElementById('admin-log-container');
        if (!container) return;
        
        const colors = {
            info: 'text-blue-400',
            warn: 'text-yellow-400',
            error: 'text-red-400',
            success: 'text-green-400'
        };
        
        const entry = document.createElement('div');
        entry.className = `${colors[type] || colors.info} py-0.5`;
        entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        container.appendChild(entry);
        container.scrollTop = container.scrollHeight;
    }
    
    // ============================================
    // NOVA GESTÃO DE PARADAS - Admin Dados
    // ============================================
    
    let adminParadasDados = [];
    let adminParadasPaginaAtual = 1;
    const ADMIN_PARADAS_POR_PAGINA = 20;
    let adminParadaEmEdicao = null;
    
    function setupAdminParadasGestao() {
        console.log('[ADMIN-PARADAS] Inicializando gestão de paradas...');
        
        // Configurar filtro de período
        const periodoSelect = document.getElementById('admin-paradas-periodo');
        const customDates = document.getElementById('admin-paradas-custom-dates');
        const customDatesFim = document.getElementById('admin-paradas-custom-dates-fim');
        
        if (periodoSelect) {
            periodoSelect.addEventListener('change', () => {
                const isCustom = periodoSelect.value === 'custom';
                customDates?.classList.toggle('hidden', !isCustom);
                customDatesFim?.classList.toggle('hidden', !isCustom);
            });
        }
        
        // Popular select de máquinas
        const selectMaquina = document.getElementById('admin-paradas-maquina');
        if (selectMaquina && window.databaseModule?.machineDatabase) {
            let options = '<option value="">Todas</option>';
            window.databaseModule.machineDatabase.forEach(m => {
                const id = normalizeMachineId(m.id);
                options += `<option value="${id}">${id}</option>`;
            });
            selectMaquina.innerHTML = options;
        }
        
        // Botão buscar
        const btnBuscar = document.getElementById('admin-paradas-buscar');
        if (btnBuscar) btnBuscar.addEventListener('click', adminParadasBuscar);
        
        // Paginação
        const btnAnterior = document.getElementById('admin-paradas-pag-anterior');
        const btnProxima = document.getElementById('admin-paradas-pag-proxima');
        if (btnAnterior) btnAnterior.addEventListener('click', () => {
            if (adminParadasPaginaAtual > 1) {
                adminParadasPaginaAtual--;
                adminParadasRenderTabela();
            }
        });
        if (btnProxima) btnProxima.addEventListener('click', () => {
            const totalPaginas = Math.ceil(adminParadasDados.length / ADMIN_PARADAS_POR_PAGINA);
            if (adminParadasPaginaAtual < totalPaginas) {
                adminParadasPaginaAtual++;
                adminParadasRenderTabela();
            }
        });
        
        // Check all
        const checkAll = document.getElementById('admin-paradas-check-all');
        if (checkAll) checkAll.addEventListener('change', adminParadasToggleAll);
        
        // Exportar
        const btnExportar = document.getElementById('admin-paradas-exportar');
        if (btnExportar) btnExportar.addEventListener('click', adminParadasExportarCSV);
        
        // Modal
        setupAdminParadasModal();
        
        // Calcular duração ao editar horários
        const editInicio = document.getElementById('admin-paradas-edit-inicio');
        const editFim = document.getElementById('admin-paradas-edit-fim');
        if (editInicio) editInicio.addEventListener('change', adminParadasCalcDuracao);
        if (editFim) editFim.addEventListener('change', adminParadasCalcDuracao);
    }
    
    function setupAdminParadasModal() {
        const modal = document.getElementById('admin-paradas-modal');
        const btnClose = document.getElementById('admin-paradas-modal-close');
        const btnCancel = document.getElementById('admin-paradas-modal-cancel');
        const form = document.getElementById('admin-paradas-form');
        
        const fecharModal = () => {
            modal?.classList.add('hidden');
            adminParadaEmEdicao = null;
        };
        
        if (btnClose) btnClose.addEventListener('click', fecharModal);
        if (btnCancel) btnCancel.addEventListener('click', fecharModal);
        if (modal) modal.addEventListener('click', (e) => {
            if (e.target === modal) fecharModal();
        });
        
        if (form) form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await adminParadasSalvar();
        });
        
        // Popular select de motivos quando o modal é aberto
        populateAdminParadasMotivos();
    }
    
    function populateAdminParadasMotivos() {
        const motivoSelect = document.getElementById('admin-paradas-edit-motivo');
        if (!motivoSelect) return;
        
        const groupedReasons = getGroupedDowntimeReasons();
        let options = '<option value="">Selecione o motivo</option>';
        
        Object.entries(groupedReasons).forEach(([group, reasons]) => {
            options += `<optgroup label="${group}">`;
            reasons.forEach(reason => {
                options += `<option value="${reason}">${reason}</option>`;
            });
            options += '</optgroup>';
        });
        
        motivoSelect.innerHTML = options;
        console.log('[ADMIN-PARADAS] Motivos carregados:', Object.keys(groupedReasons).length, 'categorias');
    }
    
    async function adminParadasBuscar() {
        const periodo = document.getElementById('admin-paradas-periodo')?.value || '7days';
        let dataInicio, dataFim;
        const hoje = new Date();
        const hojeStr = getProductionDateString(hoje);
        
        switch (periodo) {
            case 'today':
                dataInicio = dataFim = hojeStr;
                break;
            case 'yesterday':
                const ontem = new Date(hoje);
                ontem.setDate(ontem.getDate() - 1);
                dataInicio = dataFim = getProductionDateString(ontem);
                break;
            case '7days':
                const seteDias = new Date(hoje);
                seteDias.setDate(seteDias.getDate() - 7);
                dataInicio = getProductionDateString(seteDias);
                dataFim = hojeStr;
                break;
            case '30days':
                const trintaDias = new Date(hoje);
                trintaDias.setDate(trintaDias.getDate() - 30);
                dataInicio = getProductionDateString(trintaDias);
                dataFim = hojeStr;
                break;
            case 'custom':
                dataInicio = document.getElementById('admin-paradas-data-inicio')?.value;
                dataFim = document.getElementById('admin-paradas-data-fim')?.value;
                if (!dataInicio || !dataFim) {
                    alert('Selecione as datas do período personalizado');
                    return;
                }
                break;
        }
        
        const filtroMaquina = document.getElementById('admin-paradas-maquina')?.value || '';
        const filtroStatus = document.getElementById('admin-paradas-status')?.value || '';
        const filtroCodProduto = (document.getElementById('admin-paradas-cod-produto')?.value || '').trim().toUpperCase();
        
        try {
            console.log('[ADMIN-PARADAS] Buscando paradas de', dataInicio, 'a', dataFim);
            
            let query = db().collection('downtime_entries')
                .where('date', '>=', dataInicio)
                .where('date', '<=', dataFim)
                .orderBy('date', 'desc');
            
            const snapshot = await query.get();
            let paradas = [];
            
            snapshot.forEach(doc => {
                const data = doc.data();
                
                // Filtro de máquina
                const machineId = normalizeMachineId(data.machine || data.machine_id || '');
                if (filtroMaquina && machineId !== filtroMaquina) return;
                
                // Filtro de status
                const isActive = data.status === 'active' || data.isActive === true;
                if (filtroStatus === 'active' && !isActive) return;
                if (filtroStatus === 'finished' && isActive) return;
                
                // Filtro de Código de Produto
                if (filtroCodProduto) {
                    const codProd = (data.product_code || data.productCode || data.codigo || data.part_code || '').toString().toUpperCase();
                    if (!codProd.includes(filtroCodProduto)) return;
                }
                
                paradas.push({
                    id: doc.id,
                    ...data,
                    machineId: machineId,
                    isActive: isActive
                });
            });
            
            // Ordenar por data + hora de início
            paradas.sort((a, b) => {
                if (a.date !== b.date) return b.date.localeCompare(a.date);
                const horaA = a.start_time || a.startTime || '00:00';
                const horaB = b.start_time || b.startTime || '00:00';
                return horaB.localeCompare(horaA);
            });
            
            adminParadasDados = paradas;
            adminParadasPaginaAtual = 1;
            adminParadasRenderStats();
            adminParadasRenderTabela();
            
            console.log('[ADMIN-PARADAS] Encontradas', paradas.length, 'paradas');
            
        } catch (error) {
            console.error('[ADMIN-PARADAS] Erro ao buscar:', error);
            alert('Erro ao buscar paradas: ' + error.message);
        }
    }
    
    function adminParadasRenderStats() {
        const paradas = adminParadasDados;
        const ativas = paradas.filter(p => p.isActive);
        const finalizadas = paradas.filter(p => !p.isActive);
        
        let tempoTotal = 0;
        paradas.forEach(p => {
            tempoTotal += p.duration || p.durationMinutes || 0;
        });
        
        const tempoMedio = paradas.length > 0 ? Math.round(tempoTotal / paradas.length) : 0;
        const horasTotal = Math.floor(tempoTotal / 60);
        const minsTotal = tempoTotal % 60;
        
        document.getElementById('admin-paradas-stat-total').textContent = paradas.length;
        document.getElementById('admin-paradas-stat-ativas').textContent = ativas.length;
        document.getElementById('admin-paradas-stat-finalizadas').textContent = finalizadas.length;
        document.getElementById('admin-paradas-stat-tempo').textContent = horasTotal > 0 
            ? `${horasTotal}h${minsTotal > 0 ? ` ${minsTotal}m` : ''}` 
            : `${minsTotal}min`;
        document.getElementById('admin-paradas-stat-medio').textContent = `${tempoMedio}min`;
    }
    
    function adminParadasRenderTabela() {
        const tbody = document.getElementById('admin-paradas-tbody');
        if (!tbody) return;
        
        const totalRegistros = adminParadasDados.length;
        const totalPaginas = Math.ceil(totalRegistros / ADMIN_PARADAS_POR_PAGINA) || 1;
        
        if (adminParadasPaginaAtual > totalPaginas) adminParadasPaginaAtual = totalPaginas;
        if (adminParadasPaginaAtual < 1) adminParadasPaginaAtual = 1;
        
        const inicio = (adminParadasPaginaAtual - 1) * ADMIN_PARADAS_POR_PAGINA;
        const fim = Math.min(inicio + ADMIN_PARADAS_POR_PAGINA, totalRegistros);
        const paradasPagina = adminParadasDados.slice(inicio, fim);
        
        if (paradasPagina.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" class="text-center py-12 text-gray-400">
                        <i data-lucide="pause-circle" class="w-12 h-12 mx-auto mb-2 opacity-50"></i>
                        <p>Nenhuma parada encontrada</p>
                    </td>
                </tr>
            `;
            if (typeof lucide !== 'undefined') (typeof lucide !== 'undefined' && lucide.createIcons());
            adminParadasAtualizarPaginacao(0, 0, 0, 1);
            return;
        }
        
        tbody.innerHTML = paradasPagina.map(p => {
            const dataFormatada = p.date ? p.date.split('-').reverse().join('/') : '-';
            const horaInicio = p.start_time || p.startTime || '-';
            const horaFim = p.end_time || p.endTime || '-';
            const duracao = p.duration || p.durationMinutes || 0;
            const duracaoFormatada = duracao >= 60 ? `${Math.floor(duracao/60)}h ${duracao%60}m` : `${duracao}min`;
            const motivo = p.reason || p.motivo || 'Não informado';
            const statusClass = p.isActive ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800';
            const statusLabel = p.isActive ? 'Ativa' : 'Finalizada';
            
            return `
                <tr class="hover:bg-gray-50 transition-colors" data-id="${p.id}">
                    <td class="px-3 py-2.5">
                        <input type="checkbox" class="admin-paradas-check rounded border-gray-300 text-blue-600 focus:ring-blue-500" data-id="${p.id}">
                    </td>
                    <td class="px-3 py-2.5 text-sm font-medium text-gray-800">${dataFormatada}</td>
                    <td class="px-3 py-2.5">
                        <span class="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 rounded-lg text-xs font-bold">
                            ${p.machineId}
                        </span>
                    </td>
                    <td class="px-3 py-2.5 text-sm text-gray-700 max-w-xs truncate" title="${motivo}">${motivo}</td>
                    <td class="px-3 py-2.5 text-center text-sm font-medium text-gray-600">${horaInicio}</td>
                    <td class="px-3 py-2.5 text-center text-sm font-medium text-gray-600">${horaFim}</td>
                    <td class="px-3 py-2.5 text-center">
                        <span class="px-2 py-1 bg-orange-100 text-orange-700 rounded-lg text-xs font-bold">${duracaoFormatada}</span>
                    </td>
                    <td class="px-3 py-2.5 text-center">
                        <span class="px-2 py-1 rounded-full text-xs font-semibold ${statusClass}">${statusLabel}</span>
                    </td>
                    <td class="px-3 py-2.5 text-center">
                        <div class="flex items-center justify-center gap-1">
                            <button onclick="adminParadasEditar('${p.id}')" class="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition" title="Editar">
                                <i data-lucide="pencil" class="w-4 h-4"></i>
                            </button>
                            <button onclick="adminParadasExcluir('${p.id}')" class="p-1.5 text-red-600 hover:bg-red-100 rounded-lg transition" title="Excluir">
                                <i data-lucide="trash-2" class="w-4 h-4"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
        
        if (typeof lucide !== 'undefined') (typeof lucide !== 'undefined' && lucide.createIcons());
        adminParadasAtualizarPaginacao(inicio + 1, fim, totalRegistros, totalPaginas);
        adminParadasAtualizarContagem();
    }
    
    function adminParadasAtualizarPaginacao(inicio, fim, total, totalPaginas) {
        document.getElementById('admin-paradas-pag-inicio').textContent = total > 0 ? inicio : 0;
        document.getElementById('admin-paradas-pag-fim').textContent = fim;
        document.getElementById('admin-paradas-pag-total').textContent = total;
        document.getElementById('admin-paradas-pag-atual').textContent = adminParadasPaginaAtual;
        document.getElementById('admin-paradas-pag-total-paginas').textContent = totalPaginas;
        
        const btnAnterior = document.getElementById('admin-paradas-pag-anterior');
        const btnProxima = document.getElementById('admin-paradas-pag-proxima');
        if (btnAnterior) btnAnterior.disabled = adminParadasPaginaAtual <= 1;
        if (btnProxima) btnProxima.disabled = adminParadasPaginaAtual >= totalPaginas;
    }
    
    function adminParadasToggleAll(e) {
        const checked = e.target.checked;
        document.querySelectorAll('.admin-paradas-check').forEach(cb => {
            cb.checked = checked;
        });
        adminParadasAtualizarContagem();
    }
    
    function adminParadasAtualizarContagem() {
        const selecionados = document.querySelectorAll('.admin-paradas-check:checked').length;
        const el = document.getElementById('admin-paradas-selecionados');
        if (el) el.textContent = selecionados;
    }
    
    window.adminParadasEditar = async function(id) {
        const parada = adminParadasDados.find(p => p.id === id);
        if (!parada) {
            alert('Parada não encontrada');
            return;
        }
        
        adminParadaEmEdicao = id;
        
        document.getElementById('admin-paradas-edit-id').value = id;
        document.getElementById('admin-paradas-edit-maquina').value = parada.machineId || '';
        document.getElementById('admin-paradas-edit-data').value = parada.date || '';
        document.getElementById('admin-paradas-edit-motivo').value = parada.reason || '';
        document.getElementById('admin-paradas-edit-motivo-custom').value = parada.reason || '';
        document.getElementById('admin-paradas-edit-inicio').value = parada.start_time || parada.startTime || '';
        document.getElementById('admin-paradas-edit-fim').value = parada.end_time || parada.endTime || '';
        
        adminParadasCalcDuracao();
        
        const modal = document.getElementById('admin-paradas-modal');
        modal?.classList.remove('hidden');
        if (typeof lucide !== 'undefined') (typeof lucide !== 'undefined' && lucide.createIcons());
    };
    
    function adminParadasCalcDuracao() {
        const inicio = document.getElementById('admin-paradas-edit-inicio')?.value;
        const fim = document.getElementById('admin-paradas-edit-fim')?.value;
        const duracaoEl = document.getElementById('admin-paradas-edit-duracao');
        
        if (!inicio || !fim || !duracaoEl) {
            if (duracaoEl) duracaoEl.textContent = '0 min';
            return;
        }
        
        const [hI, mI] = inicio.split(':').map(Number);
        const [hF, mF] = fim.split(':').map(Number);
        
        let minInicio = hI * 60 + mI;
        let minFim = hF * 60 + mF;
        
        // Se fim < início, assumir que passou da meia-noite
        if (minFim < minInicio) minFim += 24 * 60;
        
        const duracao = minFim - minInicio;
        const horas = Math.floor(duracao / 60);
        const mins = duracao % 60;
        
        duracaoEl.textContent = horas > 0 ? `${horas}h ${mins}min` : `${mins} min`;
    }
    
    async function adminParadasSalvar() {
        const id = document.getElementById('admin-paradas-edit-id')?.value;
        if (!id) return;
        
        const motivoSelect = document.getElementById('admin-paradas-edit-motivo')?.value;
        const motivoCustom = document.getElementById('admin-paradas-edit-motivo-custom')?.value;
        const motivo = motivoSelect === 'Outro' || !motivoSelect ? motivoCustom : motivoSelect;
        
        const data = document.getElementById('admin-paradas-edit-data')?.value;
        const inicio = document.getElementById('admin-paradas-edit-inicio')?.value;
        const fim = document.getElementById('admin-paradas-edit-fim')?.value;
        
        // Calcular duração
        let duracao = 0;
        if (inicio && fim) {
            const [hI, mI] = inicio.split(':').map(Number);
            const [hF, mF] = fim.split(':').map(Number);
            let minInicio = hI * 60 + mI;
            let minFim = hF * 60 + mF;
            if (minFim < minInicio) minFim += 24 * 60;
            duracao = minFim - minInicio;
        }
        
        const updates = {
            reason: motivo,
            motivo: motivo,
            date: data,
            start_time: inicio,
            startTime: inicio,
            end_time: fim,
            endTime: fim,
            duration: duracao,
            durationMinutes: duracao,
            lastEditedAt: new Date().toISOString(),
            lastEditedBy: typeof getCurrentUserName === 'function' ? getCurrentUserName() : 'Admin'
        };
        
        // Se tem hora de fim, marcar como finalizada
        if (fim) {
            updates.status = 'finished';
            updates.isActive = false;
        }
        
        try {
            await db().collection('downtime_entries').doc(id).update(updates);
            
            // Atualizar dados locais
            const idx = adminParadasDados.findIndex(p => p.id === id);
            if (idx !== -1) {
                adminParadasDados[idx] = { ...adminParadasDados[idx], ...updates, machineId: adminParadasDados[idx].machineId };
            }
            
            // Fechar modal e atualizar
            document.getElementById('admin-paradas-modal')?.classList.add('hidden');
            adminParadaEmEdicao = null;
            adminParadasRenderStats();
            adminParadasRenderTabela();
            
            alert('Parada atualizada com sucesso!');
            
        } catch (error) {
            console.error('[ADMIN-PARADAS] Erro ao salvar:', error);
            alert('Erro ao salvar: ' + error.message);
        }
    }
    
    window.adminParadasExcluir = async function(id) {
        if (!confirm('Tem certeza que deseja excluir esta parada?')) return;
        
        try {
            await db().collection('downtime_entries').doc(id).delete();
            
            // Remover dos dados locais
            adminParadasDados = adminParadasDados.filter(p => p.id !== id);
            adminParadasRenderStats();
            adminParadasRenderTabela();
            
            // ✅ Invalidar TODOS os caches de paradas para refletir a exclusão em todas as abas
            if (typeof cachedDowntimeDetails !== "undefined") cachedDowntimeDetails = []; // Cache da tabela de detalhes Análise - Paradas
            if (typeof cachedDowntimeDataForChart !== "undefined") cachedDowntimeDataForChart = []; // Cache do gráfico Paradas por Motivo/Categoria
            if (window._recentEntriesCache) window._recentEntriesCache.delete(id); // Cache de lançamentos recentes
            
            if (typeof invalidateDowntimeCache === 'function') {
                (typeof invalidateDowntimeCache === "function" ? invalidateDowntimeCache : () => {})(); // Caches de status de máquinas
            }
            
            if (window.DataStore) {
                window.DataStore.invalidate('downtimeEntries'); // window.DataStore cache
                window.DataStore.invalidate('activeDowntimes'); 
            }
            
            if (window.CacheManager) {
                window.CacheManager.invalidate('downtime_entries'); // window.CacheManager
            }
            
            // Se estiver na aba de análise de paradas, recarregar
            if (typeof currentAnalysisView !== 'undefined' && currentAnalysisView === 'downtime') {
                await (typeof loadDowntimeAnalysis === "function" ? loadDowntimeAnalysis : () => {})();
            }
            
            // Registrar log da exclusão
            if (typeof registrarLogSistema === 'function') {
                registrarLogSistema('EXCLUSÃO DE REGISTRO', 'downtime_entries', {
                    docId: id,
                    collection: 'downtime_entries',
                    source: 'admin-paradas'
                });
            }
            
            alert('Parada excluída com sucesso!');
            
        } catch (error) {
            console.error('[ADMIN-PARADAS] Erro ao excluir:', error);
            alert('Erro ao excluir: ' + error.message);
        }
    };
    
    // 🔧 Utilidade: Excluir TODAS as paradas de um motivo específico (ex: "Fim de semana")
    window.adminExcluirParadasPorMotivo = async function(motivoBusca) {
        if (!motivoBusca) {
            alert('Informe o motivo. Ex: adminExcluirParadasPorMotivo("Fim de semana")');
            return;
        }
        
        const motivoUpper = motivoBusca.trim().toUpperCase();
        console.log(`[ADMIN] Buscando TODAS as paradas com motivo contendo "${motivoBusca}"...`);
        
        try {
            // OTIMIZAÇÃO Fase 2: limitar busca aos últimos 90 dias (ao invés de toda a coleção)
            const ninetyDaysAgo = new Date();
            ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
            const dateLimit = ninetyDaysAgo.toISOString().split('T')[0];
            console.log(`[ADMIN] Buscando paradas dos últimos 90 dias (desde ${dateLimit}) com motivo contendo "${motivoBusca}"...`);
            const snapshot = await db().collection('downtime_entries')
                .where('date', '>=', dateLimit)
                .orderBy('date', 'desc')
                .get();
            
            const encontradas = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                const reason = (data.reason || data.motivo || '').trim().toUpperCase();
                if (reason.includes(motivoUpper)) {
                    encontradas.push({
                        id: doc.id,
                        ref: doc.ref,
                        date: data.date || '',
                        machine: data.machine || data.machine_id || '',
                        reason: data.reason || data.motivo || '',
                        duration: data.duration || 0
                    });
                }
            });
            
            if (encontradas.length === 0) {
                alert(`Nenhuma parada encontrada com motivo "${motivoBusca}"`);
                console.log('[ADMIN] Nenhuma parada encontrada.');
                return;
            }
            
            // Mostrar o que será excluído
            console.table(encontradas.map(e => ({
                ID: e.id,
                Data: e.date,
                Máquina: e.machine,
                Motivo: e.reason,
                Duração: e.duration + ' min'
            })));
            
            const confirmar = confirm(
                `Encontradas ${encontradas.length} paradas com motivo "${motivoBusca}".\n\n` +
                encontradas.slice(0, 5).map(e => `• ${e.date} | ${e.machine} | ${e.reason} | ${e.duration}min`).join('\n') +
                (encontradas.length > 5 ? `\n... e mais ${encontradas.length - 5} registros` : '') +
                `\n\nDeseja EXCLUIR TODAS?`
            );
            
            if (!confirmar) {
                console.log('[ADMIN] Exclusão cancelada pelo usuário.');
                return;
            }
            
            // Excluir em batches de 500
            let excluidas = 0;
            const batchSize = 500;
            for (let i = 0; i < encontradas.length; i += batchSize) {
                const batch = db.batch();
                const chunk = encontradas.slice(i, i + batchSize);
                chunk.forEach(item => batch.delete(item.ref));
                await batch.commit();
                excluidas += chunk.length;
                console.log(`[ADMIN] Excluídas ${excluidas}/${encontradas.length}...`);
            }
            
            // Invalidar todos os caches
            if (typeof cachedDowntimeDetails !== "undefined") cachedDowntimeDetails = [];
            if (typeof cachedDowntimeDataForChart !== "undefined") cachedDowntimeDataForChart = [];
            if (typeof invalidateDowntimeCache === 'function') (typeof invalidateDowntimeCache === "function" ? invalidateDowntimeCache : () => {})();
            if (window.DataStore) {
                window.DataStore.invalidate('downtimeEntries');
                window.DataStore.invalidate('activeDowntimes');
            }
            if (window.CacheManager) window.CacheManager.invalidate('downtime_entries');
            
            // Registrar log
            if (typeof registrarLogSistema === 'function') {
                registrarLogSistema('EXCLUSÃO EM MASSA', 'downtime_entries', {
                    motivo: motivoBusca,
                    quantidade: excluidas
                });
            }
            
            alert(`✅ ${excluidas} paradas "${motivoBusca}" excluídas com sucesso!\n\nRecarregue a aba de análise.`);
            console.log(`[ADMIN] ✅ ${excluidas} paradas excluídas com sucesso!`);
            
            // Recarregar se estiver no admin
            if (typeof adminParadasBuscar === 'function') {
                await adminParadasBuscar();
            }
            
        } catch (error) {
            console.error('[ADMIN] Erro ao excluir paradas:', error);
            alert('Erro: ' + error.message);
        }
    };

    function adminParadasExportarCSV() {
        if (adminParadasDados.length === 0) {
            alert('Nenhum dado para exportar');
            return;
        }
        
        const headers = ['Data', 'Máquina', 'Motivo', 'Hora Início', 'Hora Fim', 'Duração (min)', 'Status'];
        const rows = adminParadasDados.map(p => [
            p.date || '',
            p.machineId || '',
            (p.reason || p.motivo || '').replace(/"/g, '""'),
            p.start_time || p.startTime || '',
            p.end_time || p.endTime || '',
            p.duration || p.durationMinutes || 0,
            p.isActive ? 'Ativa' : 'Finalizada'
        ]);
        
        let csv = headers.join(';') + '\n';
        rows.forEach(row => {
            csv += row.map(cell => `"${cell}"`).join(';') + '\n';
        });
        
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `paradas_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    }
    
    // ============================================
    // FIM - NOVA GESTÃO DE PARADAS
    // ============================================

    async function adminAnalyzeDowntimeProblems() {
        adminLog('Iniciando análise de registros de paradas...', 'info');
        
        const stats = { total: 0, problems: 0, fixed: 0, deleted: 0 };
        
        try {
            // OTIMIZAÇÃO Fase 2: orderBy desc + limit para analisar os mais recentes
            const snapshot = await db().collection('downtime_entries')
                .orderBy('date', 'desc')
                .limit(1000)
                .get();
            stats.total = snapshot.size;
            
            adminLog(`Total de registros: ${stats.total}`, 'info');
            
            let problemCount = 0;
            snapshot.forEach(doc => {
                const data = doc.data();
                const problems = [];
                
                // Verificar problemas comuns
                if (!data.end_timestamp && !data.endTimestamp && data.status !== 'active') {
                    problems.push('Sem timestamp de fim (não ativo)');
                }
                if (!data.start_timestamp && !data.startTimestamp && !data.originalStartTimestamp) {
                    problems.push('Sem timestamp de início');
                }
                if (!data.machine && !data.machine_id) {
                    problems.push('Sem ID de máquina');
                }
                if ((data.duration || data.duration_minutes || 0) > 1440) {
                    problems.push(`Duração muito alta: ${data.duration || data.duration_minutes}min`);
                }
                
                if (problems.length > 0) {
                    problemCount++;
                    adminLog(`⚠️ ${doc.id}: ${problems.join(', ')}`, 'warn');
                }
            });
            
            stats.problems = problemCount;
            
            // Atualizar estatísticas na UI
            document.getElementById('admin-stat-total').textContent = stats.total;
            document.getElementById('admin-stat-problems').textContent = stats.problems;
            document.getElementById('admin-stat-fixed').textContent = stats.fixed;
            document.getElementById('admin-stat-deleted').textContent = stats.deleted;
            
            adminLog(`✅ Análise completa: ${stats.problems} registros com problemas de ${stats.total}`, 'success');
            
            // Habilitar botão de correção se houver problemas
            const btnFix = document.getElementById('admin-btn-fix');
            if (btnFix) btnFix.disabled = stats.problems === 0;
            
        } catch (error) {
            adminLog(`❌ Erro na análise: ${error.message}`, 'error');
        }
    }
    
    async function adminFixDowntimeRecords() {
        const isDryRun = document.getElementById('admin-chk-dry-run')?.checked ?? true;
        const deleteInvalid = document.getElementById('admin-chk-delete-invalid')?.checked ?? false;
        
        adminLog(`🔧 Iniciando correção (Simulação: ${isDryRun ? 'SIM' : 'NÃO'})...`, 'info');
        
        const stats = { fixed: 0, deleted: 0 };
        
        try {
            // OTIMIZAÇÃO Fase 2: orderBy desc + limit para corrigir os mais recentes
            const snapshot = await db().collection('downtime_entries')
                .orderBy('date', 'desc')
                .limit(500)
                .get();
            const batch = db.batch();
            let batchCount = 0;
            
            for (const doc of snapshot.docs) {
                const data = doc.data();
                const updates = {};
                let shouldDelete = false;
                
                // Tentar corrigir timestamp de início
                if (!data.start_timestamp && !data.startTimestamp) {
                    if (data.originalStartTimestamp) {
                        updates.start_timestamp = data.originalStartTimestamp;
                        adminLog(`Corrigindo início de ${doc.id} usando originalStartTimestamp`, 'info');
                    } else if (data.date && data.start_time) {
                        try {
                            const startDate = new Date(`${data.date}T${data.start_time}:00`);
                            if (!isNaN(startDate.getTime())) {
                                updates.start_timestamp = firebase.firestore.Timestamp.fromDate(startDate);
                                adminLog(`Corrigindo início de ${doc.id} usando date+start_time`, 'info');
                            }
                        } catch (e) {}
                    } else {
                        adminLog(`⚠️ ${doc.id}: Não foi possível recuperar timestamp de início`, 'warn');
                        if (deleteInvalid) shouldDelete = true;
                    }
                }
                
                // Tentar corrigir timestamp de fim
                if (!data.end_timestamp && !data.endTimestamp && data.status !== 'active') {
                    if (data.originalEndTimestamp) {
                        updates.end_timestamp = data.originalEndTimestamp;
                        adminLog(`Corrigindo fim de ${doc.id} usando originalEndTimestamp`, 'info');
                    } else if (data.date && data.end_time) {
                        try {
                            const endDate = new Date(`${data.date}T${data.end_time}:00`);
                            if (!isNaN(endDate.getTime())) {
                                updates.end_timestamp = firebase.firestore.Timestamp.fromDate(endDate);
                                adminLog(`Corrigindo fim de ${doc.id} usando date+end_time`, 'info');
                            }
                        } catch (e) {}
                    }
                }
                
                // Aplicar correções ou deletar
                if (!isDryRun) {
                    if (shouldDelete) {
                        batch.delete(doc.ref);
                        stats.deleted++;
                        batchCount++;
                    } else if (Object.keys(updates).length > 0) {
                        batch.update(doc.ref, updates);
                        stats.fixed++;
                        batchCount++;
                    }
                } else {
                    if (shouldDelete) {
                        adminLog(`[SIMULAÇÃO] Deletaria: ${doc.id}`, 'warn');
                        stats.deleted++;
                    } else if (Object.keys(updates).length > 0) {
                        adminLog(`[SIMULAÇÃO] Corrigiria: ${doc.id} - ${JSON.stringify(updates)}`, 'info');
                        stats.fixed++;
                    }
                }
                
                // Commit batch a cada 400 operações
                if (batchCount >= 400) {
                    if (!isDryRun) await batch.commit();
                    batchCount = 0;
                }
            }
            
            // Commit final
            if (!isDryRun && batchCount > 0) {
                await batch.commit();
            }
            
            // Atualizar UI
            document.getElementById('admin-stat-fixed').textContent = stats.fixed;
            document.getElementById('admin-stat-deleted').textContent = stats.deleted;
            
            adminLog(`✅ Correção ${isDryRun ? '(simulação)' : ''} completa: ${stats.fixed} corrigidos, ${stats.deleted} excluídos`, 'success');
            
        } catch (error) {
            adminLog(`❌ Erro na correção: ${error.message}`, 'error');
        }
    }
    
    // ===== Funções de Ajuste de Ordens - NOVA ESTRUTURA SIMPLIFICADA =====
    // Variável para armazenar a ordem atual sendo editada
    let adminOrdemAtual = null;
    
    function adminOrdemLog(message, type = 'info') {
        const logDiv = document.getElementById('admin-ordem-log');
        if (!logDiv) return;
        
        const colors = {
            info: 'text-blue-400',
            success: 'text-green-400',
            warn: 'text-yellow-400',
            error: 'text-red-400'
        };
        
        const entry = document.createElement('div');
        entry.className = `${colors[type] || colors.info} py-0.5`;
        entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        logDiv.appendChild(entry);
        logDiv.scrollTop = logDiv.scrollHeight;
    }
    
    async function adminBuscarOrdemSimplificado() {
        const numeroOP = document.getElementById('admin-ordem-busca')?.value?.trim();
        const cardOrdem = document.getElementById('admin-ordem-card');
        const emptyState = document.getElementById('admin-ordem-empty');
        
        if (!numeroOP) {
            alert('Digite o número da OP para buscar');
            return;
        }
        
        try {
            adminOrdemAtual = null;
            
            // Buscar ordem - tentar vários formatos
            let foundDoc = null;
            
            // Busca exata string
            const snapshot1 = await db().collection('production_orders')
                .where('order_number', '==', numeroOP)
                .limit(1)
                .get();
            
            if (!snapshot1.empty) {
                foundDoc = snapshot1.docs[0];
            }
            
            // Tentar busca numérica
            if (!foundDoc) {
                const numerico = parseInt(numeroOP);
                if (!isNaN(numerico)) {
                    const snapshot2 = await db().collection('production_orders')
                        .where('order_number', '==', numerico)
                        .limit(1)
                        .get();
                    
                    if (!snapshot2.empty) {
                        foundDoc = snapshot2.docs[0];
                    }
                }
            }
            
            if (!foundDoc) {
                alert(`OP ${numeroOP} não encontrada`);
                adminOrdemLog(`❌ OP ${numeroOP} não encontrada`, 'error');
                return;
            }
            
            adminOrdemAtual = { id: foundDoc.id, ...foundDoc.data() };
            const data = adminOrdemAtual;
            
            // IMPORTANTE: Usar os MESMOS campos que os cards de máquina usam
            // Cards usam: order_lot_size || lot_size para planejado
            // Cards usam: total_produzido para executado
            const planejado = Number(data.order_lot_size ?? data.lot_size ?? data.planned_quantity) || 0;
            const executado = Number(data.total_produzido ?? data.totalProduced ?? data.total_produced) || 0;
            const faltante = Math.max(0, planejado - executado);
            const progresso = planejado > 0 ? (executado / planejado * 100) : 0;
            
            // Resolver nome do produto (igual ao card de máquina)
            let productName = data.product || data.product_name || data.part_code || data.product_code || 'Produto não definido';
            
            // Preencher card
            document.getElementById('admin-op-numero').textContent = data.order_number || '-';
            document.getElementById('admin-op-produto').textContent = productName;
            document.getElementById('admin-op-maquina').textContent = (data.machine || data.machine_id) ? `Máquina: ${data.machine || data.machine_id}` : '';
            document.getElementById('admin-op-status').textContent = (data.status || 'planejada').toUpperCase();
            
            // Indicadores (mesmos valores dos cards)
            document.getElementById('admin-op-planejado').textContent = planejado.toLocaleString('pt-BR');
            document.getElementById('admin-op-executado').textContent = executado.toLocaleString('pt-BR');
            document.getElementById('admin-op-faltante').textContent = faltante.toLocaleString('pt-BR');
            
            // Progresso
            document.getElementById('admin-op-progresso-pct').textContent = progresso.toFixed(1) + '%';
            document.getElementById('admin-op-progresso-bar').style.width = Math.min(progresso, 100) + '%';
            
            // Cor da barra de progresso
            const barEl = document.getElementById('admin-op-progresso-bar');
            if (progresso >= 100) {
                barEl.className = 'h-4 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 transition-all duration-500';
            } else if (progresso >= 50) {
                barEl.className = 'h-4 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500';
            } else {
                barEl.className = 'h-4 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-500';
            }
            
            // Pré-preencher campo de edição
            document.getElementById('admin-op-nova-qtd').value = executado;
            document.getElementById('admin-op-preview').classList.add('hidden');
            
            // Mostrar card, esconder empty state
            if (cardOrdem) cardOrdem.classList.remove('hidden');
            if (emptyState) emptyState.classList.add('hidden');
            
            // Recriar ícones
            if (typeof lucide !== 'undefined') (typeof lucide !== 'undefined' && lucide.createIcons());
            
            adminOrdemLog(`✅ OP ${data.order_number} carregada - Exec: ${executado.toLocaleString('pt-BR')} / Plan: ${planejado.toLocaleString('pt-BR')}`, 'success');
            
        } catch (error) {
            console.error('[ADMIN] Erro ao buscar ordem:', error);
            alert('Erro ao buscar ordem: ' + error.message);
            adminOrdemLog(`❌ Erro: ${error.message}`, 'error');
        }
    }
    
    function adminPreviewAlteracao() {
        if (!adminOrdemAtual) return;
        
        const novaQtd = parseInt(document.getElementById('admin-op-nova-qtd')?.value) || 0;
        const executadoAtual = Number(adminOrdemAtual.total_produzido ?? adminOrdemAtual.totalProduced ?? adminOrdemAtual.total_produced) || 0;
        const previewDiv = document.getElementById('admin-op-preview');
        
        if (novaQtd !== executadoAtual) {
            previewDiv.classList.remove('hidden');
            document.getElementById('admin-op-preview-atual').textContent = executadoAtual.toLocaleString('pt-BR');
            document.getElementById('admin-op-preview-novo').textContent = novaQtd.toLocaleString('pt-BR');
            
            const diff = novaQtd - executadoAtual;
            const diffEl = document.getElementById('admin-op-preview-diff');
            diffEl.textContent = (diff > 0 ? '+' : '') + diff.toLocaleString('pt-BR');
            diffEl.className = diff > 0 ? 'text-lg font-bold text-green-600' : diff < 0 ? 'text-lg font-bold text-red-600' : 'text-lg font-bold text-gray-600';
        } else {
            previewDiv.classList.add('hidden');
        }
    }
    
    async function adminSalvarOrdemSimplificado() {
        if (!adminOrdemAtual) {
            alert('Nenhuma ordem selecionada. Busque uma OP primeiro.');
            return;
        }
        
        const novaQtd = parseInt(document.getElementById('admin-op-nova-qtd')?.value);
        
        if (isNaN(novaQtd) || novaQtd < 0) {
            alert('Digite uma quantidade válida');
            return;
        }
        
        const executadoAtual = Number(adminOrdemAtual.total_produzido ?? adminOrdemAtual.totalProduced ?? adminOrdemAtual.total_produced) || 0;
        const planejado = Number(adminOrdemAtual.order_lot_size ?? adminOrdemAtual.lot_size ?? adminOrdemAtual.planned_quantity) || 0;
        
        if (novaQtd === executadoAtual) {
            alert('A quantidade não foi alterada.');
            return;
        }
        
        const diff = novaQtd - executadoAtual;
        const diffTexto = diff > 0 ? `+${diff.toLocaleString('pt-BR')}` : diff.toLocaleString('pt-BR');
        
        if (!confirm(`Confirma alteração?\n\nOP: ${adminOrdemAtual.order_number}\n\nExecutado atual: ${executadoAtual.toLocaleString('pt-BR')}\nNovo valor: ${novaQtd.toLocaleString('pt-BR')}\nDiferença: ${diffTexto}`)) {
            return;
        }
        
        try {
            // Atualizar ordem - usando os MESMOS campos que o sistema usa
            await db().collection('production_orders').doc(adminOrdemAtual.id).update({
                total_produzido: novaQtd,
                totalProduced: novaQtd,
                last_manual_adjustment: firebase.firestore.FieldValue.serverTimestamp(),
                adjusted_by: getActiveUser()?.name || 'Admin'
            });
            
            // CORREÇÃO: Os cards de máquina usam a collection 'planning', não 'daily_planning'
            // Atualizar planejamentos na collection PLANNING (usada pelos cards de máquina)
            let planningsAtualizados = 0;
            try {
                // Buscar por order_id
                let planningDocs = await db().collection('planning')
                    .where('order_id', '==', adminOrdemAtual.id)
                    .get();
                
                // Se não encontrar, tentar por production_order_id
                if (planningDocs.empty) {
                    planningDocs = await db().collection('planning')
                        .where('production_order_id', '==', adminOrdemAtual.id)
                        .get();
                }
                
                // Se não encontrar, tentar pelo order_number
                if (planningDocs.empty && adminOrdemAtual.order_number) {
                    planningDocs = await db().collection('planning')
                        .where('order_number', '==', adminOrdemAtual.order_number)
                        .get();
                }
                
                if (!planningDocs.empty) {
                    const batch = db.batch();
                    planningDocs.forEach(doc => {
                        batch.update(doc.ref, {
                            total_produzido: novaQtd,
                            totalProduced: novaQtd,
                            lastSyncedAt: firebase.firestore.FieldValue.serverTimestamp()
                        });
                    });
                    await batch.commit();
                    planningsAtualizados = planningDocs.size;
                    adminOrdemLog(`📋 ${planningDocs.size} planning(s) atualizado(s)`, 'info');
                    
                    // Limpar cache dos cards
                    if (typeof window._machineCardProductionCache !== 'undefined' && window._machineCardProductionCache instanceof Map) {
                        planningDocs.forEach(doc => {
                            window._machineCardProductionCache.delete(doc.id);
                        });
                    }
                } else {
                    adminOrdemLog(`⚠️ Nenhum planning encontrado para a OP`, 'warn');
                }
            } catch (e) {
                console.warn('Erro ao sincronizar planning:', e);
                adminOrdemLog(`⚠️ Erro ao sincronizar planning: ${e.message}`, 'warn');
            }
            
            // Também atualizar daily_planning (para consistência)
            try {
                const dailyPlannings = await db().collection('daily_planning')
                    .where('order_id', '==', adminOrdemAtual.id)
                    .get();
                
                if (!dailyPlannings.empty) {
                    const batch = db.batch();
                    dailyPlannings.forEach(doc => {
                        batch.update(doc.ref, {
                            total_produzido: novaQtd,
                            lastSyncedAt: firebase.firestore.FieldValue.serverTimestamp()
                        });
                    });
                    await batch.commit();
                }
            } catch (e) {
                console.warn('Erro ao sincronizar daily_planning:', e);
            }
            
            // Registrar log
            if (typeof registrarLogSistema === 'function') {
                await registrarLogSistema(
                    `AJUSTE MANUAL: OP ${adminOrdemAtual.order_number} - ${executadoAtual} → ${novaQtd}`,
                    'admin_adjustment',
                    {
                        order_id: adminOrdemAtual.id,
                        order_number: adminOrdemAtual.order_number,
                        previous: executadoAtual,
                        new_value: novaQtd,
                        difference: diff
                    }
                );
            }
            
            // Atualizar UI
            adminOrdemAtual.total_produzido = novaQtd;
            adminOrdemAtual.totalProduced = novaQtd;
            
            const faltante = Math.max(0, planejado - novaQtd);
            const progresso = planejado > 0 ? (novaQtd / planejado * 100) : 0;
            
            document.getElementById('admin-op-executado').textContent = novaQtd.toLocaleString('pt-BR');
            document.getElementById('admin-op-faltante').textContent = faltante.toLocaleString('pt-BR');
            document.getElementById('admin-op-progresso-pct').textContent = progresso.toFixed(1) + '%';
            document.getElementById('admin-op-progresso-bar').style.width = Math.min(progresso, 100) + '%';
            document.getElementById('admin-op-preview').classList.add('hidden');
            
            adminOrdemLog(`✅ OP ${adminOrdemAtual.order_number} atualizada: ${executadoAtual.toLocaleString('pt-BR')} → ${novaQtd.toLocaleString('pt-BR')} (${diffTexto})`, 'success');
            
            showNotification('Quantidade atualizada com sucesso!', 'success');
            
            // Informar que os cards serão atualizados pelos listeners
            adminOrdemLog(`🔄 Cards de máquina serão atualizados automaticamente`, 'info');
            
        } catch (error) {
            console.error('[ADMIN] Erro ao salvar:', error);
            alert('Erro ao salvar: ' + error.message);
            adminOrdemLog(`❌ Erro: ${error.message}`, 'error');
        }
    }

    // ===== Funções de Produção (CORRIGIDAS E MELHORADAS) =====
    async function adminBuscarProducao() {
        const dataFiltro = document.getElementById('admin-producao-data')?.value;
        const maquina = document.getElementById('admin-producao-maquina')?.value;
        const turno = document.getElementById('admin-producao-turno')?.value;
        const codProdutoFiltro = document.getElementById('admin-producao-cod-produto')?.value?.trim();
        const listaDiv = document.getElementById('admin-producao-lista');
        
        if (!dataFiltro && !codProdutoFiltro) {
            alert('Selecione uma data ou informe um Código de Produto');
            return;
        }
        
        console.log('[ADMIN-PRODUCAO] Buscando registros:', { dataFiltro, maquina, turno, codProdutoFiltro });
        
        try {
            listaDiv.innerHTML = '<div class="text-center py-4 text-gray-500"><div class="animate-spin inline-block w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mb-2"></div><p>Carregando registros...</p></div>';
            
            // CORREÇÃO: Campo canônico é 'data' (português) no production_entries
            const snapshot = await db().collection('production_entries').where('data', '==', dataFiltro).limit(500).get();
            
            console.log('[ADMIN-PRODUCAO] Documentos encontrados:', snapshot.size);
            
            // Montar mapa de documentos
            const allDocs = new Map();
            
            snapshot.docs.forEach(doc => {
                allDocs.set(doc.id, { id: doc.id, ...doc.data() });
            });
            
            // ===== CORREÇÃO: Buscar dados de produto e OP das coleções vinculadas =====
            // Coletar todos os orderIds e planIds únicos
            const orderIds = new Set();
            const planIds = new Set();
            
            allDocs.forEach(d => {
                const orderId = d.orderId || d.order_id || d.production_order_id;
                const planId = d.planId || d.plan_id;
                if (orderId) orderIds.add(orderId);
                if (planId) planIds.add(planId);
            });
            
            console.log('[ADMIN-PRODUCAO] Order IDs únicos:', orderIds.size, 'Plan IDs únicos:', planIds.size);
            
            // Buscar dados das OPs em lote
            const ordersCache = new Map();
            if (orderIds.size > 0) {
                const orderIdsArray = Array.from(orderIds);
                // Firestore limita "in" a 10 itens, então dividir em chunks
                const chunks = [];
                for (let i = 0; i < orderIdsArray.length; i += 10) {
                    chunks.push(orderIdsArray.slice(i, i + 10));
                }
                
                for (const chunk of chunks) {
                    try {
                        const ordersSnap = await db().collection('production_orders').where(firebase.firestore.FieldPath.documentId(), 'in', chunk).get();
                        ordersSnap.docs.forEach(doc => {
                            ordersCache.set(doc.id, doc.data());
                        });
                    } catch (err) {
                        console.warn('[ADMIN-PRODUCAO] Erro ao buscar OPs:', err);
                    }
                }
            }
            console.log('[ADMIN-PRODUCAO] OPs carregadas no cache:', ordersCache.size);
            
            // Buscar dados dos planejamentos em lote
            const plansCache = new Map();
            if (planIds.size > 0) {
                const planIdsArray = Array.from(planIds);
                const chunks = [];
                for (let i = 0; i < planIdsArray.length; i += 10) {
                    chunks.push(planIdsArray.slice(i, i + 10));
                }
                
                for (const chunk of chunks) {
                    try {
                        const plansSnap = await db().collection('planning').where(firebase.firestore.FieldPath.documentId(), 'in', chunk).get();
                        plansSnap.docs.forEach(doc => {
                            plansCache.set(doc.id, doc.data());
                        });
                    } catch (err) {
                        console.warn('[ADMIN-PRODUCAO] Erro ao buscar planejamentos:', err);
                    }
                }
            }
            console.log('[ADMIN-PRODUCAO] Planejamentos carregados no cache:', plansCache.size);
            
            // Enriquecer os documentos com dados de produto e OP
            allDocs.forEach((d, docId) => {
                const orderId = d.orderId || d.order_id || d.production_order_id;
                const planId = d.planId || d.plan_id;
                
                // Tentar obter dados da OP
                if (orderId && ordersCache.has(orderId)) {
                    const orderData = ordersCache.get(orderId);
                    d._order_number = orderData.op || orderData.order_number || orderData.op_number || '';
                    d._product_name = orderData.product_name || orderData.productName || orderData.descricao || '';
                    d._product_code = orderData.product_code || orderData.productCode || orderData.codigo || orderData.part_code || '';
                }
                
                // Se não encontrou na OP, tentar no planejamento
                if (planId && plansCache.has(planId)) {
                    const planData = plansCache.get(planId);
                    if (!d._order_number) d._order_number = planData.op || planData.order_number || '';
                    if (!d._product_name) d._product_name = planData.product_name || planData.productName || planData.description || planData.descricao || '';
                    if (!d._product_code) d._product_code = planData.product_code || planData.productCode || planData.part_code || planData.codigo || '';
                }
                
                allDocs.set(docId, d);
            });
            
            if (allDocs.size === 0) {
                listaDiv.innerHTML = `
                    <div class="text-center py-8 text-gray-400">
                        <i data-lucide="inbox" class="w-12 h-12 mx-auto mb-2 opacity-50"></i>
                        <p class="font-semibold">Nenhum registro encontrado</p>
                        <p class="text-sm">Data: ${dataFiltro}</p>
                    </div>`;
                document.getElementById('admin-prod-total').textContent = '0';
                document.getElementById('admin-prod-pecas').textContent = '0';
                document.getElementById('admin-prod-peso').textContent = '0';
                document.getElementById('admin-prod-refugo').textContent = '0';
                if (typeof lucide !== 'undefined') (typeof lucide !== 'undefined' && lucide.createIcons());
                return;
            }
            
            // Converter Map para array
            let docs = Array.from(allDocs.values());
            
            // Filtrar por máquina se especificado (normalizado)
            if (maquina) {
                const maquinaNorm = normalizeMachineId(maquina);
                docs = docs.filter(d => {
                    const docMachine = normalizeMachineId(d.machine || d.machine_id || '');
                    return docMachine === maquinaNorm;
                });
            }
            
            // Filtrar por turno se especificado (campo canônico: 'turno')
            if (turno) {
                docs = docs.filter(d => {
                    const docTurno = String(d.turno || d.shift || '');
                    return docTurno === turno;
                });
            }
            
            // Filtrar por Código de Produto se especificado
            if (codProdutoFiltro) {
                docs = docs.filter(d => {
                    const codProd = String(d._product_code || d.product_code || d.productCode || d.codigo || d.part_code || '');
                    return codProd.includes(codProdutoFiltro);
                });
            }
            
            // Ordenar por timestamp decrescente (mais recente primeiro)
            docs.sort((a, b) => {
                const tsA = a.timestamp?.toMillis ? a.timestamp.toMillis() : (a.timestamp?.seconds || 0) * 1000;
                const tsB = b.timestamp?.toMillis ? b.timestamp.toMillis() : (b.timestamp?.seconds || 0) * 1000;
                return tsB - tsA;
            });
            
            // Limitar a 100 registros
            docs = docs.slice(0, 100);
            
            console.log('[ADMIN-PRODUCAO] Registros após filtros:', docs.length);
            
            if (docs.length === 0) {
                listaDiv.innerHTML = `
                    <div class="text-center py-8 text-gray-400">
                        <i data-lucide="filter-x" class="w-12 h-12 mx-auto mb-2 opacity-50"></i>
                        <p class="font-semibold">Nenhum registro para os filtros selecionados</p>
                        <p class="text-sm">Data: ${dataFiltro}${maquina ? `, Máquina: ${maquina}` : ''}${turno ? `, Turno: ${turno}` : ''}</p>
                    </div>`;
                document.getElementById('admin-prod-total').textContent = '0';
                document.getElementById('admin-prod-pecas').textContent = '0';
                document.getElementById('admin-prod-peso').textContent = '0';
                document.getElementById('admin-prod-refugo').textContent = '0';
                if (typeof lucide !== 'undefined') (typeof lucide !== 'undefined' && lucide.createIcons());
                return;
            }
            
            let html = '';
            let totalPecas = 0;
            let totalPeso = 0;
            let totalRefugo = 0;
            
            // Usar o array docs já filtrado e ordenado
            docs.forEach(d => {
                const hora = d.timestamp?.toDate ? d.timestamp.toDate().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : (d.horaInformada || d.hora || '-');
                const qtd = d.produzido || d.quantity || 0;
                const peso = (d.peso_kg || d.peso_bruto || d.weight_kg || 0);
                const refugo = (d.refugo_kg || d.refugo || 0);
                const orderId = d.order_id || d.orderId || d.production_order_id || '';
                // CORREÇÃO: Usar campos enriquecidos do cache (_order_number, _product_name, _product_code)
                const orderNumber = d._order_number || d.order_number || d.op || '';
                const productName = d._product_name || d.product_name || d.product || '';
                const productCode = d._product_code || d.product_code || d.codigo || '';
                const turnoDoc = d.turno || d.shift || '-';
                const operador = d.operador || d.user_name || d.registradoPorNome || d.nomeUsuario || '-';
                const maquinaDoc = d.machine || d.machine_id || '-';
                
                totalPecas += Number(qtd) || 0;
                totalPeso += Number(peso) || 0;
                totalRefugo += Number(refugo) || 0;

                html += `
                    <div class="bg-white rounded-lg border border-gray-200 p-3 hover:shadow-md transition" data-doc-id="${d.id}">
                        <div class="flex items-center justify-between mb-2">
                            <div class="flex items-center gap-2 flex-wrap">
                                <span class="font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded text-sm">${maquinaDoc}</span>
                                ${orderNumber ? `<span class="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-700 font-semibold">OP ${orderNumber}</span>` : ''}
                                <span class="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">T${turnoDoc}</span>
                                <span class="text-xs text-gray-400">${hora}</span>
                            </div>
                            <div class="flex items-center gap-1">
                                <button class="admin-btn-view-producao text-gray-500 hover:text-gray-700 p-1.5 rounded hover:bg-gray-100 transition" data-id="${d.id}" title="Ver detalhes">
                                    <i data-lucide="eye" class="w-4 h-4"></i>
                                </button>
                                <button class="admin-btn-edit-producao text-blue-500 hover:text-blue-700 p-1.5 rounded hover:bg-blue-50 transition" data-id="${d.id}" title="Editar">
                                    <i data-lucide="edit-2" class="w-4 h-4"></i>
                                </button>
                                <button class="admin-btn-delete-producao text-red-500 hover:text-red-700 p-1.5 rounded hover:bg-red-50 transition" 
                                    data-id="${d.id}" 
                                    data-machine="${maquinaDoc}" 
                                    data-qty="${qtd}"
                                    data-order-id="${orderId}"
                                    title="Excluir">
                                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                                </button>
                            </div>
                        </div>
                        <div class="text-sm text-gray-600 mb-2 truncate" title="${productName || productCode || '-'}">
                            <span class="font-medium">${productName || productCode || 'Produto não definido'}</span>
                            ${productCode && productName ? `<span class="text-xs text-gray-400 ml-1">(${productCode})</span>` : ''}
                        </div>
                        <div class="grid grid-cols-4 gap-2 text-xs">
                            <div class="bg-green-50 rounded p-2 text-center">
                                <div class="font-bold text-green-600">${Number(qtd).toLocaleString('pt-BR')}</div>
                                <div class="text-green-700">Peças</div>
                            </div>
                            <div class="bg-amber-50 rounded p-2 text-center">
                                <div class="font-bold text-amber-600">${Number(peso).toFixed(2)}</div>
                                <div class="text-amber-700">Peso (kg)</div>
                            </div>
                            <div class="bg-red-50 rounded p-2 text-center">
                                <div class="font-bold text-red-600">${Number(refugo).toFixed(2)}</div>
                                <div class="text-red-700">Refugo (kg)</div>
                            </div>
                            <div class="bg-gray-50 rounded p-2 text-center">
                                <div class="font-bold text-gray-600 truncate" title="${operador}">${operador}</div>
                                <div class="text-gray-500">Operador</div>
                            </div>
                        </div>
                    </div>
                `;
            });
            
            listaDiv.innerHTML = html;
            
            // Atualizar estatísticas
            document.getElementById('admin-prod-total').textContent = docs.length;
            document.getElementById('admin-prod-pecas').textContent = totalPecas.toLocaleString('pt-BR');
            document.getElementById('admin-prod-peso').textContent = totalPeso.toFixed(2);
            document.getElementById('admin-prod-refugo').textContent = totalRefugo.toFixed(2);
            
            if (typeof lucide !== 'undefined') (typeof lucide !== 'undefined' && lucide.createIcons());
            
            // Attach handlers de visualização
            listaDiv.querySelectorAll('.admin-btn-view-producao').forEach(btn => {
                btn.addEventListener('click', () => adminVisualizarProducao(btn.dataset.id));
            });
            
            // Attach handlers de edição
            listaDiv.querySelectorAll('.admin-btn-edit-producao').forEach(btn => {
                btn.addEventListener('click', () => adminEditarProducao(btn.dataset.id));
            });
            
            // Attach handlers de exclusão
            listaDiv.querySelectorAll('.admin-btn-delete-producao').forEach(btn => {
                btn.addEventListener('click', () => adminExcluirProducao(btn));
            });
            
        } catch (error) {
            console.error('[ADMIN-PRODUCAO] Erro ao buscar:', error);
            listaDiv.innerHTML = `
                <div class="text-center py-8 text-red-500">
                    <i data-lucide="alert-circle" class="w-12 h-12 mx-auto mb-2 opacity-70"></i>
                    <p class="font-semibold">Erro ao carregar registros</p>
                    <p class="text-sm">${error.message}</p>
                </div>`;
            if (typeof lucide !== 'undefined') (typeof lucide !== 'undefined' && lucide.createIcons());
        }
    }

    // Função para visualizar detalhes completos de um registro
    async function adminVisualizarProducao(docId) {
        try {
            const docRef = db().collection('production_entries').doc(docId);
            const docSnap = await docRef.get();
            
            if (!docSnap.exists) {
                alert('Registro não encontrado');
                return;
            }
            
            const d = docSnap.data();
            
            // ===== CORREÇÃO: Buscar dados de produto e OP das coleções vinculadas =====
            const orderId = d.orderId || d.order_id || d.production_order_id;
            const planId = d.planId || d.plan_id;
            
            let orderNumber = d.order_number || d.op || '';
            let produtoDoc = d.product_name || d.product || '';
            let codigoDoc = d.product_code || d.codigo || '';
            
            // Buscar dados da OP se existe orderId
            if (orderId) {
                try {
                    const orderSnap = await db().collection('production_orders').doc(orderId).get();
                    if (orderSnap.exists) {
                        const orderData = orderSnap.data();
                        if (!orderNumber) orderNumber = orderData.op || orderData.order_number || orderData.op_number || '';
                        if (!produtoDoc || produtoDoc === '-') produtoDoc = orderData.product_name || orderData.productName || orderData.descricao || '';
                        if (!codigoDoc || codigoDoc === '-') codigoDoc = orderData.product_code || orderData.productCode || orderData.codigo || orderData.part_code || '';
                    }
                } catch (err) {
                    console.warn('[ADMIN-PRODUCAO] Erro ao buscar OP:', err);
                }
            }
            
            // Se ainda não encontrou, buscar do planejamento
            if (planId && (!produtoDoc || produtoDoc === '-')) {
                try {
                    const planSnap = await db().collection('planning').doc(planId).get();
                    if (planSnap.exists) {
                        const planData = planSnap.data();
                        if (!orderNumber) orderNumber = planData.op || planData.order_number || '';
                        if (!produtoDoc || produtoDoc === '-') produtoDoc = planData.product_name || planData.productName || planData.description || planData.descricao || '';
                        if (!codigoDoc || codigoDoc === '-') codigoDoc = planData.product_code || planData.productCode || planData.part_code || planData.codigo || '';
                    }
                } catch (err) {
                    console.warn('[ADMIN-PRODUCAO] Erro ao buscar planejamento:', err);
                }
            }
            
            // Extrair campos com fallbacks (canônico primeiro)
            const maquinaDoc = d.machine || d.machine_id || '-';
            const dataDoc = d.data || d.date || '-';
            const turnoDoc = d.turno || d.shift || '-';
            const qtdDoc = Number(d.produzido || d.quantity || 0);
            const pesoDoc = Number(d.peso_kg || d.peso_bruto || d.weight_kg || 0);
            const refugoDoc = Number(d.refugo_kg || d.refugo || 0);
            const operadorDoc = d.operador || d.user_name || d.registradoPorNome || d.nomeUsuario || '-';
            produtoDoc = produtoDoc || '-';
            codigoDoc = codigoDoc || '-';
            const obsDoc = d.observations || d.observacoes || d.obs || '';
            
            // Criar modal de visualização
            const modal = document.createElement('div');
            modal.id = 'admin-view-producao-modal';
            modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4';
            
            // Formatar timestamp
            let timestampStr = '-';
            if (d.timestamp?.toDate) {
                timestampStr = d.timestamp.toDate().toLocaleString('pt-BR');
            } else if (d.createdAt?.toDate) {
                timestampStr = d.createdAt.toDate().toLocaleString('pt-BR');
            }
            
            modal.innerHTML = `
                <div class="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">
                    <div class="bg-gradient-to-r from-gray-700 to-gray-800 px-5 py-4 flex-shrink-0">
                        <h3 class="text-lg font-bold text-white flex items-center gap-2">
                            <i data-lucide="eye" class="w-5 h-5"></i>
                            Detalhes do Registro
                        </h3>
                        <p class="text-gray-300 text-sm">ID: ${docId.substring(0, 20)}...</p>
                    </div>
                    <div class="p-5 overflow-y-auto flex-1">
                        <div class="grid grid-cols-2 gap-4 text-sm">
                            <div class="bg-gray-50 p-3 rounded-lg">
                                <div class="text-xs text-gray-500 uppercase font-semibold">Máquina</div>
                                <div class="font-bold text-gray-800">${maquinaDoc}</div>
                            </div>
                            <div class="bg-gray-50 p-3 rounded-lg">
                                <div class="text-xs text-gray-500 uppercase font-semibold">Data</div>
                                <div class="font-bold text-gray-800">${dataDoc}</div>
                            </div>
                            <div class="bg-gray-50 p-3 rounded-lg">
                                <div class="text-xs text-gray-500 uppercase font-semibold">Turno</div>
                                <div class="font-bold text-gray-800">${turnoDoc}º Turno</div>
                            </div>
                            <div class="bg-gray-50 p-3 rounded-lg">
                                <div class="text-xs text-gray-500 uppercase font-semibold">Timestamp</div>
                                <div class="font-bold text-gray-800 text-xs">${timestampStr}</div>
                            </div>
                            <div class="bg-green-50 p-3 rounded-lg">
                                <div class="text-xs text-green-600 uppercase font-semibold">Quantidade</div>
                                <div class="font-bold text-green-700">${qtdDoc.toLocaleString('pt-BR')} pç</div>
                            </div>
                            <div class="bg-amber-50 p-3 rounded-lg">
                                <div class="text-xs text-amber-600 uppercase font-semibold">Peso</div>
                                <div class="font-bold text-amber-700">${pesoDoc.toFixed(2)} kg</div>
                            </div>
                            <div class="bg-red-50 p-3 rounded-lg">
                                <div class="text-xs text-red-600 uppercase font-semibold">Refugo</div>
                                <div class="font-bold text-red-700">${refugoDoc.toFixed(2)} kg</div>
                            </div>
                            <div class="bg-blue-50 p-3 rounded-lg">
                                <div class="text-xs text-blue-600 uppercase font-semibold">Operador</div>
                                <div class="font-bold text-blue-700">${operadorDoc}</div>
                            </div>
                            <div class="col-span-2 bg-purple-50 p-3 rounded-lg">
                                <div class="text-xs text-purple-600 uppercase font-semibold">Produto</div>
                                <div class="font-bold text-purple-700">${produtoDoc}</div>
                                <div class="text-xs text-purple-500">Código: ${codigoDoc}</div>
                            </div>
                            ${orderNumber || orderId ? `
                            <div class="col-span-2 bg-indigo-50 p-3 rounded-lg">
                                <div class="text-xs text-indigo-600 uppercase font-semibold">Ordem de Produção</div>
                                <div class="font-bold text-indigo-700">${orderNumber ? `OP ${orderNumber}` : 'N/A'}</div>
                                <div class="text-xs text-indigo-500">ID: ${orderId || '-'}</div>
                            </div>
                            ` : ''}
                            ${obsDoc ? `
                            <div class="col-span-2 bg-gray-50 p-3 rounded-lg">
                                <div class="text-xs text-gray-500 uppercase font-semibold">Observações</div>
                                <div class="text-gray-700">${obsDoc}</div>
                            </div>
                            ` : ''}
                            ${d.last_edited_at ? `
                            <div class="col-span-2 bg-yellow-50 p-3 rounded-lg">
                                <div class="text-xs text-yellow-600 uppercase font-semibold">Última Edição</div>
                                <div class="text-yellow-700 text-sm">${d.last_edited_at?.toDate ? d.last_edited_at.toDate().toLocaleString('pt-BR') : '-'}</div>
                                <div class="text-xs text-yellow-600">Por: ${d.edited_by || '-'}</div>
                            </div>
                            ` : ''}
                            ${d.manual ? `
                            <div class="col-span-2 bg-cyan-50 p-3 rounded-lg">
                                <div class="text-xs text-cyan-600 uppercase font-semibold">Tipo de Lançamento</div>
                                <div class="font-bold text-cyan-700">Manual</div>
                                <div class="text-xs text-cyan-500">Registrado por: ${d.registradoPorNome || d.registradoPor || '-'}</div>
                            </div>
                            ` : ''}
                        </div>
                    </div>
                    <div class="flex gap-3 p-4 border-t bg-gray-50 flex-shrink-0">
                        <button type="button" class="admin-view-close flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-2.5 rounded-lg transition">
                            Fechar
                        </button>
                        <button type="button" class="admin-view-edit flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg transition">
                            <i data-lucide="edit-2" class="w-4 h-4 inline mr-1"></i>
                            Editar
                        </button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            if (typeof lucide !== 'undefined') (typeof lucide !== 'undefined' && lucide.createIcons());
            
            // Fechar modal
            modal.querySelector('.admin-view-close').addEventListener('click', () => modal.remove());
            modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
            
            // Editar
            modal.querySelector('.admin-view-edit').addEventListener('click', () => {
                modal.remove();
                adminEditarProducao(docId);
            });
            
        } catch (error) {
            console.error('[ADMIN-PRODUCAO] Erro ao visualizar:', error);
            alert('Erro ao carregar detalhes: ' + error.message);
        }
    }

    // Função para excluir registro com atualização de OP
    async function adminExcluirProducao(btn) {
        const docId = btn.dataset.id;
        const machine = btn.dataset.machine;
        const qty = parseInt(btn.dataset.qty) || 0;
        const orderId = btn.dataset.orderId;
        
        // Buscar dados completos do registro antes de excluir
        let entryData = null;
        try {
            const docSnap = await db().collection('production_entries').doc(docId).get();
            if (docSnap.exists) {
                entryData = docSnap.data();
            }
        } catch (e) {
            console.warn('[ADMIN-PRODUCAO] Erro ao buscar dados para exclusão:', e);
        }
        
        const confirmMsg = `⚠️ EXCLUIR REGISTRO DE PRODUÇÃO?\n\nMáquina: ${machine}\nQuantidade: ${qty} peças\n${orderId ? `OP vinculada: ${entryData?.order_number || orderId}\n` : ''}\n⚠️ Esta ação não pode ser desfeita!`;
        
        if (!confirm(confirmMsg)) return;
        
        try {
            // Se houver OP vinculada, atualizar o total
            const linkedOrderId = entryData?.order_id || entryData?.orderId || orderId;
            if (linkedOrderId && qty > 0) {
                try {
                    // Decrementar total da OP
                    const orderRef = db().collection('production_orders').doc(linkedOrderId);
                    const orderSnap = await orderRef.get();
                    
                    if (orderSnap.exists) {
                        const orderData = orderSnap.data();
                        const currentTotal = Number(orderData.total_produzido || orderData.totalProduced || 0);
                        const newTotal = Math.max(0, currentTotal - qty);
                        
                        await orderRef.update({
                            total_produzido: newTotal,
                            totalProduced: newTotal,
                            last_adjustment: firebase.firestore.FieldValue.serverTimestamp(),
                            adjustment_reason: `Exclusão de registro de produção (${qty} peças) via Admin`
                        });
                        
                        console.log('[ADMIN-PRODUCAO] OP atualizada:', linkedOrderId, currentTotal, '→', newTotal);
                    }
                } catch (orderError) {
                    console.warn('[ADMIN-PRODUCAO] Erro ao atualizar OP:', orderError);
                    // Continua com a exclusão mesmo se falhar a atualização da OP
                }
            }
            
            // Excluir o registro
            await db().collection('production_entries').doc(docId).delete();
            
            // Registrar log
            if (typeof registrarLogSistema === 'function') {
                await registrarLogSistema(
                    `EXCLUSÃO ADMIN: Registro de produção excluído - Máquina: ${machine}, Qtd: ${qty}`,
                    'admin_delete',
                    {
                        doc_id: docId,
                        machine: machine,
                        quantity: qty,
                        order_id: linkedOrderId || null,
                        deleted_by: getActiveUser()?.name || 'Admin'
                    }
                );
            }
            
            // Remover card da lista
            const cardElement = btn.closest('[data-doc-id]');
            if (cardElement) {
                cardElement.style.transition = 'all 0.3s ease';
                cardElement.style.opacity = '0';
                cardElement.style.transform = 'translateX(-100%)';
                setTimeout(() => cardElement.remove(), 300);
            }
            
            showNotification('Registro excluído com sucesso', 'success');
            
            // Recarregar lista após um pequeno delay para atualizar estatísticas
            setTimeout(() => adminBuscarProducao(), 500);
            
        } catch (err) {
            console.error('[ADMIN-PRODUCAO] Erro ao excluir:', err);
            alert('Erro ao excluir: ' + err.message);
        }
    }

    async function adminEditarProducao(docId) {
        try {
            const docRef = db().collection('production_entries').doc(docId);
            const docSnap = await docRef.get();
            
            if (!docSnap.exists) {
                alert('Registro não encontrado');
                return;
            }
            
            const data = docSnap.data();
            const oldQty = Number(data.quantity || data.produzido || 0);
            
            // ===== CORREÇÃO: Buscar dados de produto e OP das coleções vinculadas =====
            const orderId = data.orderId || data.order_id || data.production_order_id || '';
            const planId = data.planId || data.plan_id || '';
            
            let orderNumber = data.order_number || data.op || '';
            let produtoEdit = data.product_name || data.product || '';
            let codigoEdit = data.product_code || data.codigo || '';
            
            // Buscar dados da OP se existe orderId
            if (orderId) {
                try {
                    const orderSnap = await db().collection('production_orders').doc(orderId).get();
                    if (orderSnap.exists) {
                        const orderData = orderSnap.data();
                        if (!orderNumber) orderNumber = orderData.op || orderData.order_number || orderData.op_number || '';
                        if (!produtoEdit) produtoEdit = orderData.product_name || orderData.productName || orderData.descricao || '';
                        if (!codigoEdit) codigoEdit = orderData.product_code || orderData.productCode || orderData.codigo || orderData.part_code || '';
                    }
                } catch (err) {
                    console.warn('[ADMIN-PRODUCAO] Erro ao buscar OP:', err);
                }
            }
            
            // Se ainda não encontrou, buscar do planejamento
            if (planId && !produtoEdit) {
                try {
                    const planSnap = await db().collection('planning').doc(planId).get();
                    if (planSnap.exists) {
                        const planData = planSnap.data();
                        if (!orderNumber) orderNumber = planData.op || planData.order_number || '';
                        if (!produtoEdit) produtoEdit = planData.product_name || planData.productName || planData.description || planData.descricao || '';
                        if (!codigoEdit) codigoEdit = planData.product_code || planData.productCode || planData.part_code || planData.codigo || '';
                    }
                } catch (err) {
                    console.warn('[ADMIN-PRODUCAO] Erro ao buscar planejamento:', err);
                }
            }
            
            // Gerar opções de máquinas
            let machineOptions = '';
            if (typeof window.machineDatabase !== 'undefined' && window.machineDatabase.length > 0) {
                window.machineDatabase.forEach(m => {
                    const id = normalizeMachineId(m.id);
                    const currentMachine = normalizeMachineId(data.machine || data.machine_id || '');
                    const selected = id === currentMachine ? 'selected' : '';
                    machineOptions += `<option value="${id}" ${selected}>${id}</option>`;
                });
            }
            
            // Criar modal de edição
            const modal = document.createElement('div');
            modal.id = 'admin-edit-producao-modal';
            modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4';
            
            // Extrair campos com fallbacks
            const maquinaEdit = data.machine || data.machine_id || '';
            const dataEdit = data.data || data.date || '';
            const turnoEdit = String(data.turno || data.shift || '1');
            const qtdEdit = data.produzido || data.quantity || 0;
            const pesoEdit = data.peso_kg || data.peso_bruto || data.weight_kg || 0;
            const refugoEdit = data.refugo_kg || data.refugo || 0;
            const obsEdit = data.observations || data.observacoes || data.obs || '';
            
            modal.innerHTML = `
                <div class="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">
                    <div class="bg-gradient-to-r from-blue-600 to-blue-700 px-5 py-4 flex-shrink-0">
                        <h3 class="text-lg font-bold text-white flex items-center gap-2">
                            <i data-lucide="edit-3" class="w-5 h-5"></i>
                            Editar Lançamento de Produção
                        </h3>
                        <p class="text-blue-200 text-sm">${maquinaEdit || '-'} - ${dataEdit || '-'} - T${turnoEdit}</p>
                    </div>
                    <form id="admin-edit-producao-form" class="p-5 space-y-4 overflow-y-auto flex-1">
                        <input type="hidden" id="admin-edit-prod-id" value="${docId}">
                        <input type="hidden" id="admin-edit-prod-old-qty" value="${oldQty}">
                        <input type="hidden" id="admin-edit-prod-order-id" value="${orderId}">
                        
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Máquina</label>
                                <select id="admin-edit-prod-machine" class="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                                    ${machineOptions || `<option value="${maquinaEdit}">${maquinaEdit || '-'}</option>`}
                                </select>
                            </div>
                            <div>
                                <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Turno</label>
                                <select id="admin-edit-prod-turno" class="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                                    <option value="1" ${turnoEdit === '1' ? 'selected' : ''}>1º Turno</option>
                                    <option value="2" ${turnoEdit === '2' ? 'selected' : ''}>2º Turno</option>
                                    <option value="3" ${turnoEdit === '3' ? 'selected' : ''}>3º Turno</option>
                                </select>
                            </div>
                        </div>
                        
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Quantidade (peças)</label>
                                <input type="number" id="admin-edit-prod-qty" value="${qtdEdit}" min="0"
                                    class="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-lg font-semibold">
                            </div>
                            <div>
                                <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Peso (kg)</label>
                                <input type="number" step="0.01" id="admin-edit-prod-peso" value="${pesoEdit}" min="0"
                                    class="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                            </div>
                        </div>
                        
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Refugo (kg)</label>
                                <input type="number" step="0.01" id="admin-edit-prod-refugo" value="${refugoEdit}" min="0"
                                    class="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                            </div>
                            <div>
                                <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Data</label>
                                <input type="date" id="admin-edit-prod-date" value="${dataEdit}"
                                    class="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                            </div>
                        </div>
                        
                        <div>
                            <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Produto</label>
                            <input type="text" id="admin-edit-prod-product" value="${produtoEdit}" 
                                class="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Nome do produto">
                            ${codigoEdit ? `<p class="text-xs text-gray-500 mt-1">Código: ${codigoEdit}</p>` : ''}
                        </div>
                        
                        <div>
                            <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Observações</label>
                            <textarea id="admin-edit-prod-obs" rows="2" class="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Observações sobre a edição...">${obsEdit}</textarea>
                        </div>
                        
                        ${orderId || orderNumber ? `
                        <div class="bg-purple-50 border border-purple-200 rounded-lg p-3">
                            <div class="flex items-center gap-2 text-purple-700 text-sm">
                                <i data-lucide="link" class="w-4 h-4"></i>
                                <span class="font-semibold">OP Vinculada: ${orderNumber || orderId}</span>
                            </div>
                            <p class="text-xs text-purple-600 mt-1">O total da OP será ajustado automaticamente se a quantidade for alterada.</p>
                        </div>
                        ` : ''}
                    </form>
                    <div class="flex gap-3 p-4 border-t bg-gray-50 flex-shrink-0">
                        <button type="button" id="admin-edit-prod-cancel" class="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-2.5 rounded-lg transition">
                            Cancelar
                        </button>
                        <button type="button" id="admin-edit-prod-save" class="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg transition flex items-center justify-center gap-2">
                            <i data-lucide="save" class="w-4 h-4"></i>
                            Salvar Alterações
                        </button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            if (typeof lucide !== 'undefined') (typeof lucide !== 'undefined' && lucide.createIcons());
            
            // Fechar modal
            document.getElementById('admin-edit-prod-cancel').addEventListener('click', () => modal.remove());
            modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
            
            // Salvar alterações
            document.getElementById('admin-edit-prod-save').addEventListener('click', async () => {
                const novaQtd = parseInt(document.getElementById('admin-edit-prod-qty').value) || 0;
                const novoPeso = parseFloat(document.getElementById('admin-edit-prod-peso').value) || 0;
                const novoRefugo = parseFloat(document.getElementById('admin-edit-prod-refugo').value) || 0;
                const novoTurno = document.getElementById('admin-edit-prod-turno').value;
                const novaMaquina = document.getElementById('admin-edit-prod-machine').value;
                const novaData = document.getElementById('admin-edit-prod-date').value;
                const novoProduto = document.getElementById('admin-edit-prod-product').value.trim();
                const novaObs = document.getElementById('admin-edit-prod-obs').value.trim();
                const oldQtyValue = parseInt(document.getElementById('admin-edit-prod-old-qty').value) || 0;
                const orderIdSave = document.getElementById('admin-edit-prod-order-id').value;
                
                try {
                    // Preparar dados para atualização (mantendo tanto campos em inglês quanto português)
                    const updateData = {
                        // Campos em inglês
                        quantity: novaQtd,
                        peso_kg: novoPeso,
                        weight_kg: novoPeso,
                        refugo_kg: novoRefugo,
                        shift: parseInt(novoTurno),
                        machine_id: novaMaquina,
                        machine: novaMaquina,
                        observations: novaObs,
                        // Campos em português (mantidos para compatibilidade)
                        produzido: novaQtd,
                        turno: parseInt(novoTurno),
                        peso_bruto: novoPeso,
                        refugo: novoRefugo,
                        observacoes: novaObs,
                        // Metadados
                        last_edited_at: firebase.firestore.FieldValue.serverTimestamp(),
                        edited_by: getActiveUser()?.name || 'Admin'
                    };
                    
                    if (novaData) {
                        updateData.date = novaData;
                        updateData.data = novaData;  // Campo em português também
                    }
                    if (novoProduto) {
                        updateData.product_name = novoProduto;
                        updateData.product = novoProduto;
                    }
                    
                    await docRef.update(updateData);
                    
                    // Se a quantidade mudou e há OP vinculada, atualizar
                    if (orderIdSave && novaQtd !== oldQtyValue) {
                        try {
                            const diff = novaQtd - oldQtyValue;
                            const orderRef = db().collection('production_orders').doc(orderId);
                            const orderSnap = await orderRef.get();
                            
                            if (orderSnap.exists) {
                                const orderData = orderSnap.data();
                                const currentTotal = Number(orderData.total_produzido || orderData.totalProduced || 0);
                                const newTotal = Math.max(0, currentTotal + diff);
                                
                                await orderRef.update({
                                    total_produzido: newTotal,
                                    totalProduced: newTotal,
                                    last_adjustment: firebase.firestore.FieldValue.serverTimestamp()
                                });
                                
                                console.log('[ADMIN-PRODUCAO] OP atualizada após edição:', orderId, currentTotal, '→', newTotal);
                            }
                        } catch (orderError) {
                            console.warn('[ADMIN-PRODUCAO] Erro ao atualizar OP após edição:', orderError);
                        }
                    }
                    
                    modal.remove();
                    showNotification('Registro atualizado com sucesso!', 'success');
                    adminBuscarProducao();
                    
                } catch (err) {
                    console.error('[ADMIN-PRODUCAO] Erro ao atualizar:', err);
                    alert('Erro ao atualizar: ' + err.message);
                }
            });
            
        } catch (error) {
            console.error('[ADMIN-PRODUCAO] Erro ao carregar registro:', error);
            alert('Erro ao carregar registro: ' + error.message);
        }
    }

    // ===== Funções de Perdas (Lançamentos de usuários) =====
    async function adminBuscarPerdas() {
        const dataFiltro = document.getElementById('admin-perdas-data')?.value;
        const maquina = document.getElementById('admin-perdas-maquina')?.value;
        const turno = document.getElementById('admin-perdas-turno')?.value;
        const tipo = document.getElementById('admin-perdas-tipo')?.value;
        const codProdutoFiltro = document.getElementById('admin-perdas-cod-produto')?.value?.trim();
        const listaDiv = document.getElementById('admin-perdas-lista');
        
        if (!dataFiltro && !codProdutoFiltro) {
            alert('Selecione uma data ou informe um Código de Produto');
            return;
        }
        
        console.log('[ADMIN-PERDAS] Buscando registros:', { dataFiltro, maquina, turno, tipo, codProdutoFiltro });
        
        try {
            listaDiv.innerHTML = '<div class="text-center py-4 text-gray-500"><div class="animate-spin inline-block w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full mb-2"></div><p>Carregando perdas...</p></div>';
            
            // Buscar APENAS registros de produção com refugo/perdas (lançados via aba Lançamento)
            // Registros de perdas têm refugo_kg > 0 ou refugo_qty > 0
            const snapshot = await db().collection('production_entries').where('data', '==', dataFiltro).limit(500).get();
            
            console.log('[ADMIN-PERDAS] Documentos encontrados:', snapshot.size);
            
            // Filtrar apenas os que têm perdas
            const allDocs = new Map();
            
            const addIfHasLosses = (doc) => {
                const d = doc.data();
                const refugoKg = Number(d.refugo_kg || 0);
                const refugoQty = Number(d.refugo_qty || 0);
                const motivoPerda = d.perdas || '';
                
                // Considerar como perda se tem refugo_kg > 0 OU refugo_qty > 0 E tem motivo
                if ((refugoKg > 0 || refugoQty > 0) && motivoPerda) {
                    allDocs.set(doc.id, { id: doc.id, ...d });
                }
            };
            
            snapshot.docs.forEach(addIfHasLosses);
            
            console.log('[ADMIN-PERDAS] Total com perdas (sem duplicatas):', allDocs.size);
            
            if (allDocs.size === 0) {
                listaDiv.innerHTML = `
                    <div class="text-center py-8 text-gray-400">
                        <i data-lucide="trash-2" class="w-12 h-12 mx-auto mb-2 opacity-50"></i>
                        <p class="font-semibold">Nenhuma perda encontrada</p>
                        <p class="text-sm">Data: ${dataFiltro}</p>
                    </div>`;
                adminAtualizarEstatisticasPerdas([]);
                if (typeof lucide !== 'undefined') (typeof lucide !== 'undefined' && lucide.createIcons());
                return;
            }
            
            // Converter Map para array
            let docs = Array.from(allDocs.values());
            
            // Filtrar por máquina se especificado
            if (maquina) {
                const maquinaNorm = normalizeMachineId(maquina);
                docs = docs.filter(d => {
                    const docMachine = normalizeMachineId(d.machine || d.machine_id || '');
                    return docMachine === maquinaNorm;
                });
            }
            
            // Filtrar por turno se especificado
            if (turno) {
                docs = docs.filter(d => {
                    const docTurno = String(d.turno || d.shift || '');
                    return docTurno === turno;
                });
            }
            
            // Filtrar por tipo se especificado
            if (tipo) {
                docs = docs.filter(d => {
                    const motivo = (d.perdas || '').toLowerCase();
                    if (tipo === 'borra') return motivo.includes('borra');
                    if (tipo === 'refugo') return motivo.includes('refugo') || motivo.includes('setup') || motivo.includes('ajuste') || motivo.includes('qualidade');
                    if (tipo === 'sucata') return motivo.includes('sucata') || motivo.includes('descarte');
                    return true;
                });
            }
            
            // Filtrar por Código de Produto se especificado
            if (codProdutoFiltro) {
                docs = docs.filter(d => {
                    const codProd = String(d.product_code || d.productCode || d.codigo || d.part_code || '');
                    return codProd.includes(codProdutoFiltro);
                });
            }
            
            // Ordenar por timestamp decrescente
            docs.sort((a, b) => {
                const tsA = a.timestamp?.toMillis ? a.timestamp.toMillis() : (a.timestamp?.seconds || 0) * 1000;
                const tsB = b.timestamp?.toMillis ? b.timestamp.toMillis() : (b.timestamp?.seconds || 0) * 1000;
                return tsB - tsA;
            });
            
            // Limitar a 100 registros
            docs = docs.slice(0, 100);
            
            console.log('[ADMIN-PERDAS] Registros após filtros:', docs.length);
            
            if (docs.length === 0) {
                listaDiv.innerHTML = `
                    <div class="text-center py-8 text-gray-400">
                        <i data-lucide="filter-x" class="w-12 h-12 mx-auto mb-2 opacity-50"></i>
                        <p class="font-semibold">Nenhuma perda para os filtros selecionados</p>
                        <p class="text-sm">Data: ${dataFiltro}${maquina ? `, Máquina: ${maquina}` : ''}${turno ? `, Turno: ${turno}` : ''}${tipo ? `, Tipo: ${tipo}` : ''}</p>
                    </div>`;
                adminAtualizarEstatisticasPerdas([]);
                if (typeof lucide !== 'undefined') (typeof lucide !== 'undefined' && lucide.createIcons());
                return;
            }
            
            let html = '';
            
            docs.forEach(d => {
                const hora = d.timestamp?.toDate ? d.timestamp.toDate().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : (d.horaInformada || d.hora || '-');
                const pesoKg = Number(d.refugo_kg || 0);
                const qtdPecas = Number(d.refugo_qty || 0);
                const motivo = d.perdas || 'Não informado';
                const turnoDoc = d.turno || d.shift || '-';
                const operador = d.nomeUsuario || d.operador || d.user_name || '-';
                const maquinaDoc = d.machine || d.machine_id || '-';
                const obs = d.observacoes || d.observations || '';
                const mp = d.mp || '';
                const tipoMP = d.tipoMateriaPrima || '';
                
                // Determinar cor do tipo de perda
                const motivoLower = motivo.toLowerCase();
                let tipoBadge = '';
                if (motivoLower.includes('borra')) {
                    tipoBadge = '<span class="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-700 font-semibold">Borra</span>';
                } else if (motivoLower.includes('sucata') || motivoLower.includes('descarte')) {
                    tipoBadge = '<span class="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-700 font-semibold">Sucata</span>';
                } else {
                    tipoBadge = '<span class="text-xs px-2 py-0.5 rounded bg-orange-100 text-orange-700 font-semibold">Refugo</span>';
                }

                html += `
                    <div class="bg-white rounded-lg border border-gray-200 p-3 hover:shadow-md transition" data-doc-id="${d.id}">
                        <div class="flex items-center justify-between mb-2">
                            <div class="flex items-center gap-2 flex-wrap">
                                <span class="font-bold text-red-600 bg-red-50 px-2 py-1 rounded text-sm">${maquinaDoc}</span>
                                ${tipoBadge}
                                <span class="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">T${turnoDoc}</span>
                                <span class="text-xs text-gray-400">${hora}</span>
                            </div>
                            <div class="flex items-center gap-1">
                                <button class="admin-btn-view-perda text-gray-500 hover:text-gray-700 p-1.5 rounded hover:bg-gray-100 transition" data-id="${d.id}" title="Ver detalhes">
                                    <i data-lucide="eye" class="w-4 h-4"></i>
                                </button>
                                <button class="admin-btn-edit-perda text-blue-500 hover:text-blue-700 p-1.5 rounded hover:bg-blue-50 transition" data-id="${d.id}" title="Editar">
                                    <i data-lucide="edit-2" class="w-4 h-4"></i>
                                </button>
                                <button class="admin-btn-delete-perda text-red-500 hover:text-red-700 p-1.5 rounded hover:bg-red-50 transition" 
                                    data-id="${d.id}" 
                                    data-machine="${maquinaDoc}" 
                                    data-peso="${pesoKg}"
                                    data-motivo="${motivo}"
                                    title="Excluir">
                                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                                </button>
                            </div>
                        </div>
                        <div class="text-sm text-gray-700 mb-2">
                            <span class="font-medium">Motivo: ${motivo}</span>
                        </div>
                        ${obs ? `<div class="text-xs text-gray-500 mb-2 truncate" title="${obs}">📝 ${obs}</div>` : ''}
                        <div class="grid grid-cols-4 gap-2 text-xs">
                            <div class="bg-red-50 rounded p-2 text-center">
                                <div class="font-bold text-red-600">${pesoKg.toFixed(3)}</div>
                                <div class="text-red-700">Peso (kg)</div>
                            </div>
                            <div class="bg-orange-50 rounded p-2 text-center">
                                <div class="font-bold text-orange-600">${qtdPecas.toLocaleString('pt-BR')}</div>
                                <div class="text-orange-700">Qtd (pç)</div>
                            </div>
                            <div class="bg-amber-50 rounded p-2 text-center">
                                <div class="font-bold text-amber-600 truncate" title="${tipoMP || mp || '-'}">${tipoMP || mp || '-'}</div>
                                <div class="text-amber-700">MP</div>
                            </div>
                            <div class="bg-gray-50 rounded p-2 text-center">
                                <div class="font-bold text-gray-600 truncate" title="${operador}">${operador}</div>
                                <div class="text-gray-500">Operador</div>
                            </div>
                        </div>
                    </div>
                `;
            });
            
            listaDiv.innerHTML = html;
            
            // Atualizar estatísticas
            adminAtualizarEstatisticasPerdas(docs);
            
            if (typeof lucide !== 'undefined') (typeof lucide !== 'undefined' && lucide.createIcons());
            
            // Attach handlers
            listaDiv.querySelectorAll('.admin-btn-view-perda').forEach(btn => {
                btn.addEventListener('click', () => adminVisualizarPerda(btn.dataset.id));
            });
            
            listaDiv.querySelectorAll('.admin-btn-edit-perda').forEach(btn => {
                btn.addEventListener('click', () => adminEditarPerda(btn.dataset.id));
            });
            
            listaDiv.querySelectorAll('.admin-btn-delete-perda').forEach(btn => {
                btn.addEventListener('click', () => adminExcluirPerda(btn));
            });
            
        } catch (error) {
            console.error('[ADMIN-PERDAS] Erro ao buscar:', error);
            listaDiv.innerHTML = `
                <div class="text-center py-8 text-red-500">
                    <i data-lucide="alert-circle" class="w-12 h-12 mx-auto mb-2 opacity-70"></i>
                    <p class="font-semibold">Erro ao carregar perdas</p>
                    <p class="text-sm">${error.message}</p>
                </div>`;
            if (typeof lucide !== 'undefined') (typeof lucide !== 'undefined' && lucide.createIcons());
        }
    }
    
    function adminAtualizarEstatisticasPerdas(docs) {
        let totalPeso = 0;
        let pesoBorra = 0;
        let pesoRefugo = 0;
        let pesoSucata = 0;
        
        docs.forEach(d => {
            const peso = Number(d.refugo_kg || 0);
            const motivo = (d.perdas || '').toLowerCase();
            
            totalPeso += peso;
            
            if (motivo.includes('borra')) {
                pesoBorra += peso;
            } else if (motivo.includes('sucata') || motivo.includes('descarte')) {
                pesoSucata += peso;
            } else {
                pesoRefugo += peso;
            }
        });
        
        document.getElementById('admin-perdas-total').textContent = docs.length;
        document.getElementById('admin-perdas-peso').textContent = totalPeso.toFixed(2);
        document.getElementById('admin-perdas-borra').textContent = pesoBorra.toFixed(2);
        document.getElementById('admin-perdas-refugo').textContent = pesoRefugo.toFixed(2);
        document.getElementById('admin-perdas-sucata').textContent = pesoSucata.toFixed(2);
    }
    
    async function adminVisualizarPerda(docId) {
        try {
            const docRef = db().collection('production_entries').doc(docId);
            const docSnap = await docRef.get();
            
            if (!docSnap.exists) {
                alert('Registro não encontrado');
                return;
            }
            
            const d = docSnap.data();
            
            // Extrair campos
            const maquinaDoc = d.machine || d.machine_id || '-';
            const dataDoc = d.data || d.date || '-';
            const turnoDoc = d.turno || d.shift || '-';
            const pesoKg = Number(d.refugo_kg || 0);
            const qtdPecas = Number(d.refugo_qty || 0);
            const motivo = d.perdas || 'Não informado';
            const operadorDoc = d.nomeUsuario || d.operador || d.user_name || '-';
            const obsDoc = d.observacoes || d.observations || '';
            const mpDoc = d.mp || '-';
            const tipoMPDoc = d.tipoMateriaPrima || '-';
            const orderNumber = d.orderNumber || d.order_number || '';
            
            // Formatar timestamp
            let timestampStr = '-';
            if (d.timestamp?.toDate) {
                timestampStr = d.timestamp.toDate().toLocaleString('pt-BR');
            } else if (d.createdAt?.toDate) {
                timestampStr = d.createdAt.toDate().toLocaleString('pt-BR');
            }
            
            // Criar modal de visualização
            const modal = document.createElement('div');
            modal.id = 'admin-view-perda-modal';
            modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4';
            
            modal.innerHTML = `
                <div class="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">
                    <div class="bg-gradient-to-r from-red-600 to-red-700 px-5 py-4 flex-shrink-0">
                        <h3 class="text-lg font-bold text-white flex items-center gap-2">
                            <i data-lucide="eye" class="w-5 h-5"></i>
                            Detalhes da Perda
                        </h3>
                        <p class="text-red-200 text-sm">ID: ${docId.substring(0, 20)}...</p>
                    </div>
                    <div class="p-5 overflow-y-auto flex-1">
                        <div class="grid grid-cols-2 gap-4 text-sm">
                            <div class="bg-gray-50 p-3 rounded-lg">
                                <div class="text-xs text-gray-500 uppercase font-semibold">Máquina</div>
                                <div class="font-bold text-gray-800">${maquinaDoc}</div>
                            </div>
                            <div class="bg-gray-50 p-3 rounded-lg">
                                <div class="text-xs text-gray-500 uppercase font-semibold">Data</div>
                                <div class="font-bold text-gray-800">${dataDoc}</div>
                            </div>
                            <div class="bg-gray-50 p-3 rounded-lg">
                                <div class="text-xs text-gray-500 uppercase font-semibold">Turno</div>
                                <div class="font-bold text-gray-800">${turnoDoc}º Turno</div>
                            </div>
                            <div class="bg-gray-50 p-3 rounded-lg">
                                <div class="text-xs text-gray-500 uppercase font-semibold">Timestamp</div>
                                <div class="font-bold text-gray-800 text-xs">${timestampStr}</div>
                            </div>
                            <div class="col-span-2 bg-red-50 p-3 rounded-lg">
                                <div class="text-xs text-red-600 uppercase font-semibold">Motivo da Perda</div>
                                <div class="font-bold text-red-700">${motivo}</div>
                            </div>
                            <div class="bg-red-50 p-3 rounded-lg">
                                <div class="text-xs text-red-600 uppercase font-semibold">Peso</div>
                                <div class="font-bold text-red-700">${pesoKg.toFixed(3)} kg</div>
                            </div>
                            <div class="bg-orange-50 p-3 rounded-lg">
                                <div class="text-xs text-orange-600 uppercase font-semibold">Quantidade</div>
                                <div class="font-bold text-orange-700">${qtdPecas.toLocaleString('pt-BR')} pç</div>
                            </div>
                            <div class="bg-amber-50 p-3 rounded-lg">
                                <div class="text-xs text-amber-600 uppercase font-semibold">Cód. MP</div>
                                <div class="font-bold text-amber-700">${mpDoc}</div>
                            </div>
                            <div class="bg-amber-50 p-3 rounded-lg">
                                <div class="text-xs text-amber-600 uppercase font-semibold">Tipo MP</div>
                                <div class="font-bold text-amber-700">${tipoMPDoc}</div>
                            </div>
                            <div class="col-span-2 bg-blue-50 p-3 rounded-lg">
                                <div class="text-xs text-blue-600 uppercase font-semibold">Operador</div>
                                <div class="font-bold text-blue-700">${operadorDoc}</div>
                            </div>
                            ${orderNumber ? `
                            <div class="col-span-2 bg-purple-50 p-3 rounded-lg">
                                <div class="text-xs text-purple-600 uppercase font-semibold">Ordem de Produção</div>
                                <div class="font-bold text-purple-700">OP ${orderNumber}</div>
                            </div>
                            ` : ''}
                            ${obsDoc ? `
                            <div class="col-span-2 bg-gray-50 p-3 rounded-lg">
                                <div class="text-xs text-gray-500 uppercase font-semibold">Observações</div>
                                <div class="text-gray-700">${obsDoc}</div>
                            </div>
                            ` : ''}
                        </div>
                    </div>
                    <div class="flex gap-3 p-4 border-t bg-gray-50 flex-shrink-0">
                        <button type="button" class="admin-view-close flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-2.5 rounded-lg transition">
                            Fechar
                        </button>
                        <button type="button" class="admin-view-edit flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg transition">
                            <i data-lucide="edit-2" class="w-4 h-4 inline mr-1"></i>
                            Editar
                        </button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            if (typeof lucide !== 'undefined') (typeof lucide !== 'undefined' && lucide.createIcons());
            
            // Fechar modal
            modal.querySelector('.admin-view-close').addEventListener('click', () => modal.remove());
            modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
            
            // Editar
            modal.querySelector('.admin-view-edit').addEventListener('click', () => {
                modal.remove();
                adminEditarPerda(docId);
            });
            
        } catch (error) {
            console.error('[ADMIN-PERDAS] Erro ao visualizar:', error);
            alert('Erro ao carregar detalhes: ' + error.message);
        }
    }
    
    async function adminEditarPerda(docId) {
        try {
            const docRef = db().collection('production_entries').doc(docId);
            const docSnap = await docRef.get();
            
            if (!docSnap.exists) {
                alert('Registro não encontrado');
                return;
            }
            
            const data = docSnap.data();
            
            // Gerar opções de máquinas
            let machineOptions = '';
            if (typeof window.machineDatabase !== 'undefined' && window.machineDatabase.length > 0) {
                window.machineDatabase.forEach(m => {
                    const id = normalizeMachineId(m.id);
                    const currentMachine = normalizeMachineId(data.machine || data.machine_id || '');
                    const selected = id === currentMachine ? 'selected' : '';
                    machineOptions += `<option value="${id}" ${selected}>${id}</option>`;
                });
            }
            
            // Extrair campos
            const maquinaEdit = data.machine || data.machine_id || '';
            const dataEdit = data.data || data.date || '';
            const turnoEdit = String(data.turno || data.shift || '1');
            const pesoKgEdit = data.refugo_kg || 0;
            const qtdEdit = data.refugo_qty || 0;
            const motivoEdit = data.perdas || '';
            const obsEdit = data.observacoes || data.observations || '';
            
            // Lista de motivos comuns
            const motivosComuns = [
                'Borra',
                'Setup',
                'Ajuste de Processo',
                'Qualidade/Visual',
                'Dimensional',
                'Contaminação',
                'Sucata',
                'Descarte',
                'Manutenção',
                'Outros'
            ];
            
            let motivoOptions = '';
            motivosComuns.forEach(m => {
                const selected = motivoEdit.toLowerCase().includes(m.toLowerCase()) ? 'selected' : '';
                motivoOptions += `<option value="${m}" ${selected}>${m}</option>`;
            });
            if (!motivosComuns.some(m => motivoEdit.toLowerCase().includes(m.toLowerCase()))) {
                motivoOptions += `<option value="${motivoEdit}" selected>${motivoEdit}</option>`;
            }
            
            // Criar modal de edição
            const modal = document.createElement('div');
            modal.id = 'admin-edit-perda-modal';
            modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4';
            
            modal.innerHTML = `
                <div class="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">
                    <div class="bg-gradient-to-r from-red-600 to-red-700 px-5 py-4 flex-shrink-0">
                        <h3 class="text-lg font-bold text-white flex items-center gap-2">
                            <i data-lucide="edit-3" class="w-5 h-5"></i>
                            Editar Lançamento de Perda
                        </h3>
                        <p class="text-red-200 text-sm">${maquinaEdit || '-'} - ${dataEdit || '-'} - T${turnoEdit}</p>
                    </div>
                    <form id="admin-edit-perda-form" class="p-5 space-y-4 overflow-y-auto flex-1">
                        <input type="hidden" id="admin-edit-perda-id" value="${docId}">
                        
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Máquina</label>
                                <select id="admin-edit-perda-machine" class="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500">
                                    ${machineOptions || `<option value="${maquinaEdit}">${maquinaEdit || '-'}</option>`}
                                </select>
                            </div>
                            <div>
                                <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Turno</label>
                                <select id="admin-edit-perda-turno" class="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500">
                                    <option value="1" ${turnoEdit === '1' ? 'selected' : ''}>1º Turno</option>
                                    <option value="2" ${turnoEdit === '2' ? 'selected' : ''}>2º Turno</option>
                                    <option value="3" ${turnoEdit === '3' ? 'selected' : ''}>3º Turno</option>
                                </select>
                            </div>
                        </div>
                        
                        <div>
                            <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Motivo da Perda</label>
                            <select id="admin-edit-perda-motivo" class="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500">
                                ${motivoOptions}
                            </select>
                        </div>
                        
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Peso (kg)</label>
                                <input type="number" step="0.001" id="admin-edit-perda-peso" value="${pesoKgEdit}" min="0"
                                    class="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 text-lg font-semibold">
                            </div>
                            <div>
                                <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Quantidade (peças)</label>
                                <input type="number" id="admin-edit-perda-qty" value="${qtdEdit}" min="0"
                                    class="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500">
                            </div>
                        </div>
                        
                        <div>
                            <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Data</label>
                            <input type="date" id="admin-edit-perda-date" value="${dataEdit}"
                                class="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500">
                        </div>
                        
                        <div>
                            <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Observações</label>
                            <textarea id="admin-edit-perda-obs" rows="2" class="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500" placeholder="Observações sobre a edição...">${obsEdit}</textarea>
                        </div>
                    </form>
                    <div class="flex gap-3 p-4 border-t bg-gray-50 flex-shrink-0">
                        <button type="button" id="admin-edit-perda-cancel" class="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-2.5 rounded-lg transition">
                            Cancelar
                        </button>
                        <button type="button" id="admin-edit-perda-save" class="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 rounded-lg transition flex items-center justify-center gap-2">
                            <i data-lucide="save" class="w-4 h-4"></i>
                            Salvar Alterações
                        </button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            if (typeof lucide !== 'undefined') (typeof lucide !== 'undefined' && lucide.createIcons());
            
            // Fechar modal
            document.getElementById('admin-edit-perda-cancel').addEventListener('click', () => modal.remove());
            modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
            
            // Salvar alterações
            document.getElementById('admin-edit-perda-save').addEventListener('click', async () => {
                const novoPeso = parseFloat(document.getElementById('admin-edit-perda-peso').value) || 0;
                const novaQtd = parseInt(document.getElementById('admin-edit-perda-qty').value) || 0;
                const novoTurno = document.getElementById('admin-edit-perda-turno').value;
                const novaMaquina = document.getElementById('admin-edit-perda-machine').value;
                const novaData = document.getElementById('admin-edit-perda-date').value;
                const novoMotivo = document.getElementById('admin-edit-perda-motivo').value;
                const novaObs = document.getElementById('admin-edit-perda-obs').value.trim();
                
                if (novoPeso <= 0 && novaQtd <= 0) {
                    alert('Informe peso ou quantidade da perda');
                    return;
                }
                
                if (!novoMotivo) {
                    alert('Selecione o motivo da perda');
                    return;
                }
                
                try {
                    const updateData = {
                        refugo_kg: novoPeso,
                        refugo_qty: novaQtd,
                        perdas: novoMotivo,
                        shift: parseInt(novoTurno),
                        turno: parseInt(novoTurno),
                        machine_id: novaMaquina,
                        machine: novaMaquina,
                        observations: novaObs,
                        observacoes: novaObs,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                        edited_by: getActiveUser()?.name || 'Admin'
                    };
                    
                    if (novaData) {
                        updateData.date = novaData;
                        updateData.data = novaData;
                    }
                    
                    await docRef.update(updateData);
                    
                    modal.remove();
                    showNotification('Perda atualizada com sucesso!', 'success');
                    adminBuscarPerdas();
                    
                    // Registrar log
                    if (typeof registrarLogSistema === 'function') {
                        await registrarLogSistema(
                            `EDIÇÃO ADMIN: Perda editada - Máquina: ${novaMaquina}, Motivo: ${novoMotivo}`,
                            'admin_edit',
                            { doc_id: docId, machine: novaMaquina, motivo: novoMotivo, peso: novoPeso }
                        );
                    }
                    
                } catch (err) {
                    console.error('[ADMIN-PERDAS] Erro ao atualizar:', err);
                    alert('Erro ao atualizar: ' + err.message);
                }
            });
            
        } catch (error) {
            console.error('[ADMIN-PERDAS] Erro ao carregar registro:', error);
            alert('Erro ao carregar registro: ' + error.message);
        }
    }
    
    async function adminExcluirPerda(btn) {
        const docId = btn.dataset.id;
        const machine = btn.dataset.machine;
        const peso = btn.dataset.peso;
        const motivo = btn.dataset.motivo;
        
        const confirmMsg = `⚠️ EXCLUIR REGISTRO DE PERDA?\n\nMáquina: ${machine}\nPeso: ${peso} kg\nMotivo: ${motivo}\n\n⚠️ Esta ação não pode ser desfeita!`;
        
        if (!confirm(confirmMsg)) return;
        
        try {
            await db().collection('production_entries').doc(docId).delete();
            
            // Registrar log
            if (typeof registrarLogSistema === 'function') {
                await registrarLogSistema(
                    `EXCLUSÃO ADMIN: Perda excluída - Máquina: ${machine}, Peso: ${peso}kg, Motivo: ${motivo}`,
                    'admin_delete',
                    { doc_id: docId, machine, peso, motivo, deleted_by: getActiveUser()?.name || 'Admin' }
                );
            }
            
            // Remover card da lista
            const cardElement = btn.closest('[data-doc-id]');
            if (cardElement) {
                cardElement.style.transition = 'all 0.3s ease';
                cardElement.style.opacity = '0';
                cardElement.style.transform = 'translateX(-100%)';
                setTimeout(() => cardElement.remove(), 300);
            }
            
            showNotification('Perda excluída com sucesso', 'success');
            
            // Recarregar lista após um pequeno delay para atualizar estatísticas
            setTimeout(() => adminBuscarPerdas(), 500);
            
        } catch (err) {
            console.error('[ADMIN-PERDAS] Erro ao excluir:', err);
            alert('Erro ao excluir: ' + err.message);
        }
    }

    // ===== Funções de Planejamento (NOVAS) =====
    async function adminBuscarPlanejamento() {
        const data = document.getElementById('admin-planejamento-data')?.value;
        const maquina = document.getElementById('admin-planejamento-maquina')?.value;
        const codProdutoFiltro = document.getElementById('admin-planejamento-cod-produto')?.value?.trim();
        const listaDiv = document.getElementById('admin-planejamento-lista');
        
        if (!data && !codProdutoFiltro) {
            alert('Selecione uma data ou informe um Código de Produto');
            return;
        }
        
        console.log('[ADMIN-PLANEJAMENTO] Buscando registros:', { data, maquina, codProdutoFiltro });
        
        try {
            listaDiv.innerHTML = '<div class="text-center py-4 text-gray-500"><i class="animate-spin">⏳</i> Carregando...</div>';
            
            let query = db().collection('planning');
            
            // Se tiver data, filtra por data
            if (data) {
                query = query.where('date', '==', data);
            }
            
            // Se tiver máquina, filtra por máquina
            if (maquina) {
                query = query.where('machine', '==', maquina);
            }
            
            // Se tiver código de produto, busca sem data (busca mais ampla)
            if (codProdutoFiltro && !data) {
                // Buscar planejamentos dos últimos 90 dias
                const hoje = new Date();
                const antes90dias = new Date(hoje);
                antes90dias.setDate(antes90dias.getDate() - 90);
                const dataMinima = antes90dias.toISOString().split('T')[0];
                query = query.where('date', '>=', dataMinima);
            }
            
            const snapshot = await query.limit(500).get();
            
            let docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // Filtrar por Código de Produto se especificado
            if (codProdutoFiltro) {
                docs = docs.filter(d => {
                    const codProd = String(d.product_code || d.productCode || d.part_code || d.codigo || '');
                    return codProd.includes(codProdutoFiltro);
                });
            }
            
            if (docs.length === 0) {
                listaDiv.innerHTML = '<div class="text-center py-8 text-gray-400">Nenhum planejamento encontrado para os filtros selecionados.</div>';
                return;
            }
            
            let html = '';
            
            docs.forEach(d => {
                const cicloT1 = d.real_cycle_t1 || '-';
                const cavT1 = d.active_cavities_t1 || '-';
                const cicloT2 = d.real_cycle_t2 || '-';
                const cavT2 = d.active_cavities_t2 || '-';
                const cicloT3 = d.real_cycle_t3 || '-';
                const cavT3 = d.active_cavities_t3 || '-';

                html += `
                    <div class="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition">
                        <div class="flex items-center justify-between mb-3">
                            <div class="flex items-center gap-3">
                                <span class="font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg text-lg">${d.machine || '-'}</span>
                                <div>
                                    <p class="font-semibold text-gray-800">${d.product || d.product_name || '-'}</p>
                                    <p class="text-xs text-gray-500">MP: ${d.mp || '-'} | Código: ${d.product_cod || '-'}</p>
                                </div>
                            </div>
                            <button class="admin-btn-edit-planejamento bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg font-semibold transition flex items-center gap-2" data-id="${d.id}">
                                <i data-lucide="edit-2" class="w-4 h-4"></i>
                                Editar
                            </button>
                        </div>
                        
                        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                            <div class="bg-blue-50 rounded-lg p-2 text-center">
                                <div class="font-bold text-blue-600">${d.planned_quantity || d.daily_target || 0}</div>
                                <div class="text-xs text-blue-700">Meta Planejada</div>
                            </div>
                            <div class="bg-gray-50 rounded-lg p-2 text-center">
                                <div class="font-bold text-gray-600">${d.budgeted_cycle || '-'}</div>
                                <div class="text-xs text-gray-500">Ciclo Orçado</div>
                            </div>
                            <div class="bg-gray-50 rounded-lg p-2 text-center">
                                <div class="font-bold text-gray-600">${d.mold_cavities || '-'}</div>
                                <div class="text-xs text-gray-500">Cavidades Molde</div>
                            </div>
                            <div class="bg-gray-50 rounded-lg p-2 text-center">
                                <div class="font-bold text-gray-600">${d.piece_weight || '-'}</div>
                                <div class="text-xs text-gray-500">Peso Peça (g)</div>
                            </div>
                        </div>
                        
                        <div class="grid grid-cols-3 gap-2 text-center text-xs">
                            <div class="bg-blue-50 rounded-lg p-2 border border-blue-100">
                                <div class="font-semibold text-blue-800">1º Turno</div>
                                <div class="text-blue-600">Ciclo: <strong>${cicloT1}</strong> | Cav: <strong>${cavT1}</strong></div>
                            </div>
                            <div class="bg-amber-50 rounded-lg p-2 border border-amber-100">
                                <div class="font-semibold text-amber-800">2º Turno</div>
                                <div class="text-amber-600">Ciclo: <strong>${cicloT2}</strong> | Cav: <strong>${cavT2}</strong></div>
                            </div>
                            <div class="bg-purple-50 rounded-lg p-2 border border-purple-100">
                                <div class="font-semibold text-purple-800">3º Turno</div>
                                <div class="text-purple-600">Ciclo: <strong>${cicloT3}</strong> | Cav: <strong>${cavT3}</strong></div>
                            </div>
                        </div>
                    </div>
                `;
            });
            
            listaDiv.innerHTML = html;
            (typeof lucide !== 'undefined' && lucide.createIcons());
            
            // Attach handlers de edição
            listaDiv.querySelectorAll('.admin-btn-edit-planejamento').forEach(btn => {
                btn.addEventListener('click', () => adminEditarPlanejamento(btn.dataset.id));
            });
            
        } catch (error) {
            console.error('[ADMIN] Erro ao buscar planejamento:', error);
            listaDiv.innerHTML = `<div class="text-center py-4 text-red-500">Erro: ${error.message}</div>`;
        }
    }

    async function adminEditarPlanejamento(docId) {
        try {
            const docRef = db().collection('planning').doc(docId);
            const docSnap = await docRef.get();
            
            if (!docSnap.exists) {
                alert('Planejamento não encontrado');
                return;
            }
            
            const data = docSnap.data();
            
            // Criar modal de edição
            const modal = document.createElement('div');
            modal.id = 'admin-edit-planejamento-modal';
            modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4';
            modal.innerHTML = `
                <div class="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
                    <div class="bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-4 sticky top-0">
                        <h3 class="text-lg font-bold text-white flex items-center gap-2">
                            <i data-lucide="calendar-check" class="w-5 h-5"></i>
                            Editar Planejamento
                        </h3>
                        <p class="text-emerald-200 text-sm">${data.machine || '-'} - ${data.product || '-'} (${data.date || '-'})</p>
                    </div>
                    <form id="admin-edit-planejamento-form" class="p-5 space-y-4">
                        <input type="hidden" id="admin-edit-plan-id" value="${docId}">
                        
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Meta Planejada (peças)</label>
                                <input type="number" id="admin-edit-plan-meta" value="${data.planned_quantity || data.daily_target || 0}" 
                                    class="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500">
                            </div>
                            <div>
                                <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Ciclo Orçado (s)</label>
                                <input type="number" step="0.1" id="admin-edit-plan-ciclo-orc" value="${data.budgeted_cycle || ''}" 
                                    class="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500">
                            </div>
                        </div>
                        
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Cavidades do Molde</label>
                                <input type="number" id="admin-edit-plan-cav-molde" value="${data.mold_cavities || ''}" 
                                    class="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500">
                            </div>
                            <div>
                                <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Peso da Peça (g)</label>
                                <input type="number" step="0.01" id="admin-edit-plan-peso" value="${data.piece_weight || ''}" 
                                    class="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500">
                            </div>
                        </div>
                        
                        <div class="border-t pt-4 mt-4">
                            <h4 class="font-semibold text-gray-700 mb-3">Ciclo Real e Cavidades Ativas por Turno</h4>
                            <div class="grid grid-cols-3 gap-4">
                                <div class="bg-blue-50 rounded-lg p-3 border border-blue-200">
                                    <div class="font-semibold text-blue-800 text-center mb-2">1º Turno</div>
                                    <div class="space-y-2">
                                        <div>
                                            <label class="block text-xs text-blue-600 mb-1">Ciclo Real (s)</label>
                                            <input type="number" step="0.1" id="admin-edit-plan-ciclo-t1" value="${data.real_cycle_t1 || ''}" 
                                                class="w-full p-2 border border-blue-200 rounded focus:ring-2 focus:ring-blue-500 text-sm">
                                        </div>
                                        <div>
                                            <label class="block text-xs text-blue-600 mb-1">Cavidades Ativas</label>
                                            <input type="number" id="admin-edit-plan-cav-t1" value="${data.active_cavities_t1 || ''}" 
                                                class="w-full p-2 border border-blue-200 rounded focus:ring-2 focus:ring-blue-500 text-sm">
                                        </div>
                                    </div>
                                </div>
                                <div class="bg-amber-50 rounded-lg p-3 border border-amber-200">
                                    <div class="font-semibold text-amber-800 text-center mb-2">2º Turno</div>
                                    <div class="space-y-2">
                                        <div>
                                            <label class="block text-xs text-amber-600 mb-1">Ciclo Real (s)</label>
                                            <input type="number" step="0.1" id="admin-edit-plan-ciclo-t2" value="${data.real_cycle_t2 || ''}" 
                                                class="w-full p-2 border border-amber-200 rounded focus:ring-2 focus:ring-amber-500 text-sm">
                                        </div>
                                        <div>
                                            <label class="block text-xs text-amber-600 mb-1">Cavidades Ativas</label>
                                            <input type="number" id="admin-edit-plan-cav-t2" value="${data.active_cavities_t2 || ''}" 
                                                class="w-full p-2 border border-amber-200 rounded focus:ring-2 focus:ring-amber-500 text-sm">
                                        </div>
                                    </div>
                                </div>
                                <div class="bg-purple-50 rounded-lg p-3 border border-purple-200">
                                    <div class="font-semibold text-purple-800 text-center mb-2">3º Turno</div>
                                    <div class="space-y-2">
                                        <div>
                                            <label class="block text-xs text-purple-600 mb-1">Ciclo Real (s)</label>
                                            <input type="number" step="0.1" id="admin-edit-plan-ciclo-t3" value="${data.real_cycle_t3 || ''}" 
                                                class="w-full p-2 border border-purple-200 rounded focus:ring-2 focus:ring-purple-500 text-sm">
                                        </div>
                                        <div>
                                            <label class="block text-xs text-purple-600 mb-1">Cavidades Ativas</label>
                                            <input type="number" id="admin-edit-plan-cav-t3" value="${data.active_cavities_t3 || ''}" 
                                                class="w-full p-2 border border-purple-200 rounded focus:ring-2 focus:ring-purple-500 text-sm">
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="flex gap-3 pt-4 border-t">
                            <button type="button" id="admin-edit-plan-cancel" class="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-2.5 rounded-lg transition">
                                Cancelar
                            </button>
                            <button type="submit" class="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 rounded-lg transition">
                                Salvar Alterações
                            </button>
                        </div>
                    </form>
                </div>
            `;
            
            document.body.appendChild(modal);
            (typeof lucide !== 'undefined' && lucide.createIcons());
            
            // Fechar modal
            document.getElementById('admin-edit-plan-cancel').addEventListener('click', () => modal.remove());
            modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
            
            // Salvar alterações
            document.getElementById('admin-edit-planejamento-form').addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const updates = {
                    planned_quantity: parseInt(document.getElementById('admin-edit-plan-meta').value) || 0,
                    daily_target: parseInt(document.getElementById('admin-edit-plan-meta').value) || 0,
                    budgeted_cycle: parseFloat(document.getElementById('admin-edit-plan-ciclo-orc').value) || null,
                    mold_cavities: parseInt(document.getElementById('admin-edit-plan-cav-molde').value) || null,
                    piece_weight: parseFloat(document.getElementById('admin-edit-plan-peso').value) || null,
                    real_cycle_t1: parseFloat(document.getElementById('admin-edit-plan-ciclo-t1').value) || null,
                    active_cavities_t1: parseInt(document.getElementById('admin-edit-plan-cav-t1').value) || null,
                    real_cycle_t2: parseFloat(document.getElementById('admin-edit-plan-ciclo-t2').value) || null,
                    active_cavities_t2: parseInt(document.getElementById('admin-edit-plan-cav-t2').value) || null,
                    real_cycle_t3: parseFloat(document.getElementById('admin-edit-plan-ciclo-t3').value) || null,
                    active_cavities_t3: parseInt(document.getElementById('admin-edit-plan-cav-t3').value) || null,
                    last_edited_at: firebase.firestore.FieldValue.serverTimestamp(),
                    edited_by: getActiveUser()?.name || 'Admin'
                };
                
                try {
                    await docRef.update(updates);
                    
                    modal.remove();
                    showNotification('Planejamento atualizado com sucesso!', 'success');
                    adminBuscarPlanejamento();
                    
                } catch (err) {
                    alert('Erro ao atualizar: ' + err.message);
                }
            });
            
        } catch (error) {
            alert('Erro ao carregar planejamento: ' + error.message);
        }
    }

    // ===== AJUSTES EM LOTE - FUNÇÕES =====
    let ajustesLoteData = [];
    let ajustesLotePendentes = new Map(); // Armazena alterações pendentes
    
    async function adminCarregarAjustesLote() {
        const data = document.getElementById('admin-ajuste-data')?.value;
        const maquina = document.getElementById('admin-ajuste-maquina')?.value;
        const tipo = document.getElementById('admin-ajuste-tipo')?.value || 'resumo';
        const tbody = document.getElementById('admin-ajustes-body');
        const thead = document.getElementById('admin-ajustes-header');
        
        if (!data) {
            alert('Selecione uma data');
            return;
        }
        
        // Limpar alterações pendentes
        ajustesLotePendentes.clear();
        atualizarContadorAjustes();
        
        try {
            tbody.innerHTML = '<tr><td colspan="8" class="px-4 py-8 text-center text-gray-500"><i class="animate-spin inline-block">⏳</i> Carregando dados...</td></tr>';
            
            if (tipo === 'resumo') {
                await carregarResumoMaquinas(data, maquina, tbody, thead);
            } else if (tipo === 'lancamentos') {
                await carregarLancamentosIndividuais(data, maquina, tbody, thead);
            } else if (tipo === 'ordens') {
                await carregarOrdensDia(data, maquina, tbody, thead);
            }
            
            (typeof lucide !== 'undefined' && lucide.createIcons());
            
        } catch (error) {
            console.error('[ADMIN] Erro ao carregar ajustes:', error);
            tbody.innerHTML = `<tr><td colspan="8" class="px-4 py-8 text-center text-red-500">Erro: ${error.message}</td></tr>`;
        }
    }
    
    async function carregarResumoMaquinas(data, maquinaFiltro, tbody, thead) {
        // Ajustar cabeçalho para visão resumo
        thead.innerHTML = `
            <th class="px-3 py-2 text-left font-semibold text-gray-700 border-b">Máquina</th>
            <th class="px-3 py-2 text-left font-semibold text-gray-700 border-b">Produto/OP</th>
            <th class="px-3 py-2 text-right font-semibold text-blue-700 border-b bg-blue-50">Planejado (Lote)</th>
            <th class="px-3 py-2 text-right font-semibold text-green-700 border-b bg-green-50">Executado Total</th>
            <th class="px-3 py-2 text-right font-semibold text-cyan-700 border-b bg-cyan-50">Produção Dia</th>
            <th class="px-3 py-2 text-right font-semibold text-amber-700 border-b bg-amber-50">Faltante</th>
            <th class="px-3 py-2 text-center font-semibold text-gray-700 border-b">Progresso</th>
            <th class="px-3 py-2 text-center font-semibold text-gray-500 border-b w-20">Ações</th>
        `;
        
        // Buscar planejamentos do dia
        let queryPlanning = db().collection('planning').where('date', '==', data);
        if (maquinaFiltro) {
            queryPlanning = queryPlanning.where('machine', '==', maquinaFiltro);
        }
        const planningSnap = await queryPlanning.get();
        
        if (planningSnap.empty) {
            tbody.innerHTML = '<tr><td colspan="8" class="px-4 py-8 text-center text-gray-400">Nenhum planejamento encontrado para esta data.</td></tr>';
            return;
        }
        
        // Buscar production_entries do dia para calcular produção do dia
        let queryProd = db().collection('production_entries').where('data', '==', data);
        const prodSnap = await queryProd.get();
        
        // Mapear produção por planId
        const producaoPorPlan = new Map();
        prodSnap.docs.forEach(doc => {
            const d = doc.data();
            const planId = d.planId;
            if (planId) {
                const atual = producaoPorPlan.get(planId) || 0;
                producaoPorPlan.set(planId, atual + (Number(d.produzido) || Number(d.quantity) || 0));
            }
        });
        
        let html = '';
        const items = [];
        
        planningSnap.docs.forEach(doc => {
            const d = doc.data();
            const planId = doc.id;
            const planejado = Number(d.order_lot_size) || Number(d.lot_size) || 0;
            const executadoTotal = Number(d.total_produzido) || 0;
            const producaoDia = producaoPorPlan.get(planId) || 0;
            const faltante = Math.max(0, planejado - executadoTotal);
            const progresso = planejado > 0 ? Math.min(100, (executadoTotal / planejado) * 100) : 0;
            const progressoClass = progresso >= 100 ? 'text-green-600' : progresso >= 50 ? 'text-amber-600' : 'text-red-600';
            
            items.push({
                planId,
                orderId: d.order_id || d.orderId,
                machine: d.machine,
                product: d.product || d.product_name,
                orderNumber: d.order_number,
                planejado,
                executadoTotal,
                producaoDia,
                faltante,
                progresso
            });
            
            html += `
                <tr class="hover:bg-gray-50 transition" data-plan-id="${planId}" data-order-id="${d.order_id || d.orderId || ''}">
                    <td class="px-3 py-2 font-semibold text-indigo-700">${d.machine || '-'}</td>
                    <td class="px-3 py-2">
                        <div class="text-sm font-medium text-gray-800 truncate max-w-[200px]" title="${d.product || ''}">${d.product || d.product_name || '-'}</div>
                        <div class="text-xs text-gray-500">OP: ${d.order_number || '-'}</div>
                    </td>
                    <td class="px-3 py-2 text-right bg-blue-50">
                        <input type="number" class="ajuste-input-planejado w-24 text-right p-1 border border-transparent rounded hover:border-blue-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-transparent font-semibold text-blue-700" 
                            value="${planejado}" data-original="${planejado}" data-field="planejado" data-plan-id="${planId}">
                    </td>
                    <td class="px-3 py-2 text-right bg-green-50">
                        <input type="number" class="ajuste-input-executado w-24 text-right p-1 border border-transparent rounded hover:border-green-300 focus:border-green-500 focus:ring-1 focus:ring-green-500 bg-transparent font-semibold text-green-700" 
                            value="${executadoTotal}" data-original="${executadoTotal}" data-field="executado" data-plan-id="${planId}">
                    </td>
                    <td class="px-3 py-2 text-right bg-cyan-50 text-cyan-700 font-medium">${producaoDia.toLocaleString('pt-BR')}</td>
                    <td class="px-3 py-2 text-right bg-amber-50 font-semibold text-amber-700" data-faltante="${planId}">${faltante.toLocaleString('pt-BR')}</td>
                    <td class="px-3 py-2 text-center">
                        <div class="flex items-center gap-2">
                            <div class="flex-1 bg-gray-200 rounded-full h-2">
                                <div class="h-2 rounded-full ${progresso >= 100 ? 'bg-green-500' : progresso >= 50 ? 'bg-amber-500' : 'bg-red-500'}" style="width: ${Math.min(100, progresso)}%"></div>
                            </div>
                            <span class="text-xs font-semibold ${progressoClass} w-12 text-right">${progresso.toFixed(1)}%</span>
                        </div>
                    </td>
                    <td class="px-3 py-2 text-center">
                        <button class="ajuste-btn-detalhe text-gray-500 hover:text-indigo-600 p-1 rounded hover:bg-indigo-50 transition" data-plan-id="${planId}" title="Ver detalhes">
                            <i data-lucide="eye" class="w-4 h-4"></i>
                        </button>
                    </td>
                </tr>
            `;
        });
        
        tbody.innerHTML = html || '<tr><td colspan="8" class="px-4 py-8 text-center text-gray-400">Nenhum dado encontrado.</td></tr>';
        ajustesLoteData = items;
        
        // Adicionar listeners aos inputs editáveis
        tbody.querySelectorAll('.ajuste-input-planejado, .ajuste-input-executado').forEach(input => {
            input.addEventListener('change', handleAjusteInputChange);
            input.addEventListener('focus', (e) => e.target.select());
        });
        
        // Listeners para detalhes
        tbody.querySelectorAll('.ajuste-btn-detalhe').forEach(btn => {
            btn.addEventListener('click', () => mostrarDetalhePlano(btn.dataset.planId));
        });
    }
    
    async function carregarLancamentosIndividuais(data, maquinaFiltro, tbody, thead) {
        // Ajustar cabeçalho para visão de lançamentos
        thead.innerHTML = `
            <th class="px-2 py-2 text-left font-semibold text-gray-700 border-b w-8"><input type="checkbox" id="ajuste-select-all" class="rounded"></th>
            <th class="px-3 py-2 text-left font-semibold text-gray-700 border-b">Máquina</th>
            <th class="px-3 py-2 text-left font-semibold text-gray-700 border-b">Produto</th>
            <th class="px-3 py-2 text-center font-semibold text-gray-700 border-b">Turno</th>
            <th class="px-3 py-2 text-center font-semibold text-gray-700 border-b">Hora</th>
            <th class="px-3 py-2 text-right font-semibold text-green-700 border-b bg-green-50">Quantidade</th>
            <th class="px-3 py-2 text-right font-semibold text-amber-700 border-b bg-amber-50">Peso (kg)</th>
            <th class="px-3 py-2 text-center font-semibold text-gray-500 border-b w-20">Ações</th>
        `;
        
        // Buscar lançamentos do dia
        let query = db().collection('production_entries').where('data', '==', data);
        const snapshot = await query.limit(200).get();
        
        let docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Filtrar por máquina se especificado
        if (maquinaFiltro) {
            docs = docs.filter(d => d.machine === maquinaFiltro || d.machine_id === maquinaFiltro);
        }
        
        // Ordenar por máquina e timestamp
        docs.sort((a, b) => {
            const machineCompare = (a.machine || '').localeCompare(b.machine || '');
            if (machineCompare !== 0) return machineCompare;
            const tsA = a.timestamp?.toMillis ? a.timestamp.toMillis() : 0;
            const tsB = b.timestamp?.toMillis ? b.timestamp.toMillis() : 0;
            return tsB - tsA;
        });
        
        if (docs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="px-4 py-8 text-center text-gray-400">Nenhum lançamento encontrado para esta data.</td></tr>';
            return;
        }
        
        let html = '';
        
        docs.forEach(d => {
            const hora = d.timestamp?.toDate ? d.timestamp.toDate().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : d.horaInformada || '-';
            const qtd = Number(d.produzido) || Number(d.quantity) || 0;
            const peso = Number(d.peso_bruto) || Number(d.peso_kg) || 0;
            const turno = d.turno || d.shift || '-';
            
            html += `
                <tr class="hover:bg-gray-50 transition" data-entry-id="${d.id}">
                    <td class="px-2 py-2 text-center"><input type="checkbox" class="ajuste-checkbox rounded" data-id="${d.id}"></td>
                    <td class="px-3 py-2 font-semibold text-indigo-700">${d.machine || d.machine_id || '-'}</td>
                    <td class="px-3 py-2 text-sm text-gray-700 truncate max-w-[180px]" title="${d.product_name || d.product_code || ''}">${d.product_name || d.product_code || '-'}</td>
                    <td class="px-3 py-2 text-center"><span class="px-2 py-0.5 rounded text-xs font-semibold ${turno === 'T1' || turno == '1' ? 'bg-blue-100 text-blue-700' : turno === 'T2' || turno == '2' ? 'bg-amber-100 text-amber-700' : 'bg-purple-100 text-purple-700'}">${turno}</span></td>
                    <td class="px-3 py-2 text-center text-gray-600 text-sm">${hora}</td>
                    <td class="px-3 py-2 text-right bg-green-50">
                        <input type="number" class="ajuste-input-qty w-20 text-right p-1 border border-transparent rounded hover:border-green-300 focus:border-green-500 focus:ring-1 focus:ring-green-500 bg-transparent font-semibold text-green-700" 
                            value="${qtd}" data-original="${qtd}" data-field="produzido" data-entry-id="${d.id}">
                    </td>
                    <td class="px-3 py-2 text-right bg-amber-50">
                        <input type="number" step="0.01" class="ajuste-input-peso w-20 text-right p-1 border border-transparent rounded hover:border-amber-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 bg-transparent font-semibold text-amber-700" 
                            value="${peso.toFixed(2)}" data-original="${peso.toFixed(2)}" data-field="peso" data-entry-id="${d.id}">
                    </td>
                    <td class="px-3 py-2 text-center">
                        <button class="ajuste-btn-delete-entry text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition" data-entry-id="${d.id}" title="Excluir">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                    </td>
                </tr>
            `;
        });
        
        tbody.innerHTML = html;
        ajustesLoteData = docs;
        
        // Listeners
        tbody.querySelectorAll('.ajuste-input-qty, .ajuste-input-peso').forEach(input => {
            input.addEventListener('change', handleAjusteEntryChange);
            input.addEventListener('focus', (e) => e.target.select());
        });
        
        // Select all checkbox
        const selectAll = document.getElementById('ajuste-select-all');
        if (selectAll) {
            selectAll.addEventListener('change', (e) => {
                tbody.querySelectorAll('.ajuste-checkbox').forEach(cb => cb.checked = e.target.checked);
            });
        }
        
        // Delete buttons
        tbody.querySelectorAll('.ajuste-btn-delete-entry').forEach(btn => {
            btn.addEventListener('click', () => excluirLancamento(btn.dataset.entryId));
        });
    }
    
    async function carregarOrdensDia(data, maquinaFiltro, tbody, thead) {
        // Ajustar cabeçalho para visão de ordens
        thead.innerHTML = `
            <th class="px-3 py-2 text-left font-semibold text-gray-700 border-b">Nº OP</th>
            <th class="px-3 py-2 text-left font-semibold text-gray-700 border-b">Produto</th>
            <th class="px-3 py-2 text-left font-semibold text-gray-700 border-b">Máquina</th>
            <th class="px-3 py-2 text-center font-semibold text-gray-700 border-b">Status</th>
            <th class="px-3 py-2 text-right font-semibold text-blue-700 border-b bg-blue-50">Lote (Plan.)</th>
            <th class="px-3 py-2 text-right font-semibold text-green-700 border-b bg-green-50">Executado</th>
            <th class="px-3 py-2 text-center font-semibold text-gray-700 border-b">Progresso</th>
            <th class="px-3 py-2 text-center font-semibold text-gray-500 border-b w-20">Ações</th>
        `;
        
        // Buscar ordens ativas ou do dia
        let query = db().collection('production_orders')
            .where('status', 'in', ['ativa', 'em_andamento', 'planejada']);
        
        const snapshot = await query.limit(100).get();
        
        let docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Filtrar por máquina se especificado (campo canônico: machine)
        if (maquinaFiltro) {
            const maqNorm = normalizeMachineId(maquinaFiltro);
            docs = docs.filter(d => normalizeMachineId(d.machine || d.machine_id || '') === maqNorm);
        }
        
        // Ordenar por número da OP
        docs.sort((a, b) => (a.order_number || '').localeCompare(b.order_number || ''));
        
        if (docs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="px-4 py-8 text-center text-gray-400">Nenhuma ordem de produção ativa encontrada.</td></tr>';
            return;
        }
        
        let html = '';
        
        docs.forEach(d => {
            const lotSize = Number(d.lot_size) || 0;
            const executado = Number(d.total_produzido) || Number(d.totalProduced) || 0;
            const progresso = lotSize > 0 ? Math.min(100, (executado / lotSize) * 100) : 0;
            const statusClass = d.status === 'ativa' || d.status === 'em_andamento' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600';
            const progressoClass = progresso >= 100 ? 'text-green-600' : progresso >= 50 ? 'text-amber-600' : 'text-red-600';
            
            html += `
                <tr class="hover:bg-gray-50 transition" data-order-id="${d.id}">
                    <td class="px-3 py-2 font-bold text-indigo-700">${d.order_number || '-'}</td>
                    <td class="px-3 py-2 text-sm text-gray-700 truncate max-w-[180px]" title="${d.product || ''}">${d.product || '-'}</td>
                    <td class="px-3 py-2 font-medium">${d.machine || d.machine_id || '-'}</td>
                    <td class="px-3 py-2 text-center"><span class="px-2 py-0.5 rounded text-xs font-semibold ${statusClass}">${d.status || '-'}</span></td>
                    <td class="px-3 py-2 text-right bg-blue-50">
                        <input type="number" class="ajuste-input-lote w-24 text-right p-1 border border-transparent rounded hover:border-blue-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-transparent font-semibold text-blue-700" 
                            value="${lotSize}" data-original="${lotSize}" data-field="lot_size" data-order-id="${d.id}">
                    </td>
                    <td class="px-3 py-2 text-right bg-green-50">
                        <input type="number" class="ajuste-input-exec w-24 text-right p-1 border border-transparent rounded hover:border-green-300 focus:border-green-500 focus:ring-1 focus:ring-green-500 bg-transparent font-semibold text-green-700" 
                            value="${executado}" data-original="${executado}" data-field="total_produzido" data-order-id="${d.id}">
                    </td>
                    <td class="px-3 py-2 text-center">
                        <div class="flex items-center gap-2">
                            <div class="flex-1 bg-gray-200 rounded-full h-2">
                                <div class="h-2 rounded-full ${progresso >= 100 ? 'bg-green-500' : progresso >= 50 ? 'bg-amber-500' : 'bg-red-500'}" style="width: ${Math.min(100, progresso)}%"></div>
                            </div>
                            <span class="text-xs font-semibold ${progressoClass} w-12 text-right">${progresso.toFixed(1)}%</span>
                        </div>
                    </td>
                    <td class="px-3 py-2 text-center">
                        <button class="ajuste-btn-sync-ordem text-amber-500 hover:text-amber-700 p-1 rounded hover:bg-amber-50 transition" data-order-id="${d.id}" title="Recalcular total">
                            <i data-lucide="calculator" class="w-4 h-4"></i>
                        </button>
                    </td>
                </tr>
            `;
        });
        
        tbody.innerHTML = html;
        ajustesLoteData = docs;
        
        // Listeners
        tbody.querySelectorAll('.ajuste-input-lote, .ajuste-input-exec').forEach(input => {
            input.addEventListener('change', handleAjusteOrdemChange);
            input.addEventListener('focus', (e) => e.target.select());
        });
        
        // Sync buttons
        tbody.querySelectorAll('.ajuste-btn-sync-ordem').forEach(btn => {
            btn.addEventListener('click', () => recalcularTotalOrdem(btn.dataset.orderId));
        });
    }
    
    function handleAjusteInputChange(e) {
        const input = e.target;
        const planId = input.dataset.planId;
        const field = input.dataset.field;
        const original = Number(input.dataset.original);
        const newValue = Number(input.value);
        
        if (newValue !== original) {
            input.classList.add('bg-yellow-100', 'border-yellow-400');
            
            // Adicionar ao Map de pendentes
            if (!ajustesLotePendentes.has(planId)) {
                ajustesLotePendentes.set(planId, { type: 'planning', changes: {} });
            }
            ajustesLotePendentes.get(planId).changes[field] = newValue;
            
            // Atualizar faltante em tempo real
            const row = input.closest('tr');
            if (row) {
                const planejadoInput = row.querySelector('.ajuste-input-planejado');
                const executadoInput = row.querySelector('.ajuste-input-executado');
                const faltanteCell = row.querySelector(`[data-faltante="${planId}"]`);
                
                if (planejadoInput && executadoInput && faltanteCell) {
                    const planejado = Number(planejadoInput.value) || 0;
                    const executado = Number(executadoInput.value) || 0;
                    const novoFaltante = Math.max(0, planejado - executado);
                    faltanteCell.textContent = novoFaltante.toLocaleString('pt-BR');
                }
            }
        } else {
            input.classList.remove('bg-yellow-100', 'border-yellow-400');
            
            // Remover do Map se voltar ao original
            if (ajustesLotePendentes.has(planId)) {
                delete ajustesLotePendentes.get(planId).changes[field];
                if (Object.keys(ajustesLotePendentes.get(planId).changes).length === 0) {
                    ajustesLotePendentes.delete(planId);
                }
            }
        }
        
        atualizarContadorAjustes();
    }
    
    function handleAjusteEntryChange(e) {
        const input = e.target;
        const entryId = input.dataset.entryId;
        const field = input.dataset.field;
        const original = field === 'peso' ? parseFloat(input.dataset.original) : Number(input.dataset.original);
        const newValue = field === 'peso' ? parseFloat(input.value) : Number(input.value);
        
        if (newValue !== original) {
            input.classList.add('bg-yellow-100', 'border-yellow-400');
            
            if (!ajustesLotePendentes.has(entryId)) {
                ajustesLotePendentes.set(entryId, { type: 'entry', changes: {} });
            }
            ajustesLotePendentes.get(entryId).changes[field] = newValue;
        } else {
            input.classList.remove('bg-yellow-100', 'border-yellow-400');
            
            if (ajustesLotePendentes.has(entryId)) {
                delete ajustesLotePendentes.get(entryId).changes[field];
                if (Object.keys(ajustesLotePendentes.get(entryId).changes).length === 0) {
                    ajustesLotePendentes.delete(entryId);
                }
            }
        }
        
        atualizarContadorAjustes();
    }
    
    function handleAjusteOrdemChange(e) {
        const input = e.target;
        const orderId = input.dataset.orderId;
        const field = input.dataset.field;
        const original = Number(input.dataset.original);
        const newValue = Number(input.value);
        
        if (newValue !== original) {
            input.classList.add('bg-yellow-100', 'border-yellow-400');
            
            if (!ajustesLotePendentes.has(orderId)) {
                ajustesLotePendentes.set(orderId, { type: 'order', changes: {} });
            }
            ajustesLotePendentes.get(orderId).changes[field] = newValue;
        } else {
            input.classList.remove('bg-yellow-100', 'border-yellow-400');
            
            if (ajustesLotePendentes.has(orderId)) {
                delete ajustesLotePendentes.get(orderId).changes[field];
                if (Object.keys(ajustesLotePendentes.get(orderId).changes).length === 0) {
                    ajustesLotePendentes.delete(orderId);
                }
            }
        }
        
        atualizarContadorAjustes();
    }
    
    function atualizarContadorAjustes() {
        const count = ajustesLotePendentes.size;
        const countEl = document.getElementById('admin-ajustes-count');
        const btnSalvar = document.getElementById('admin-btn-salvar-ajustes');
        const btnDescartar = document.getElementById('admin-btn-descartar-ajustes');
        
        if (countEl) {
            countEl.textContent = count;
            countEl.classList.toggle('hidden', count === 0);
        }
        
        if (btnSalvar) btnSalvar.disabled = count === 0;
        if (btnDescartar) btnDescartar.disabled = count === 0;
    }
    
    async function adminSalvarAjustesLote() {
        if (ajustesLotePendentes.size === 0) {
            showNotification('Nenhuma alteração pendente', 'info');
            return;
        }
        
        if (!confirm(`Salvar ${ajustesLotePendentes.size} alteração(ões)?`)) return;
        
        const btnSalvar = document.getElementById('admin-btn-salvar-ajustes');
        if (btnSalvar) {
            btnSalvar.disabled = true;
            btnSalvar.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Salvando...';
        }
        
        let successCount = 0;
        let errorCount = 0;
        const user = getActiveUser();
        
        try {
            for (const [docId, data] of ajustesLotePendentes) {
                try {
                    let collection = '';
                    let updateData = {
                        ...data.changes,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                        editedBy: user?.name || 'Admin',
                        editedAt: firebase.firestore.FieldValue.serverTimestamp()
                    };
                    
                    if (data.type === 'planning') {
                        collection = 'planning';
                        // Se alterou executado, também atualizar total_produzido
                        if (data.changes.executado !== undefined) {
                            updateData.total_produzido = data.changes.executado;
                        }
                        // Se alterou planejado, também atualizar lot_size e order_lot_size
                        if (data.changes.planejado !== undefined) {
                            updateData.lot_size = data.changes.planejado;
                            updateData.order_lot_size = data.changes.planejado;
                        }
                    } else if (data.type === 'entry') {
                        collection = 'production_entries';
                        // Mapear campos
                        if (data.changes.produzido !== undefined) {
                            updateData.produzido = data.changes.produzido;
                            updateData.quantity = data.changes.produzido;
                        }
                        if (data.changes.peso !== undefined) {
                            updateData.peso_bruto = data.changes.peso;
                            updateData.peso_kg = data.changes.peso;
                        }
                    } else if (data.type === 'order') {
                        collection = 'production_orders';
                        // Mapear campos
                        if (data.changes.total_produzido !== undefined) {
                            updateData.total_produzido = data.changes.total_produzido;
                            updateData.totalProduced = data.changes.total_produzido;
                        }
                    }
                    
                    await db().collection(collection).doc(docId).update(updateData);
                    
                    // Marcar visualmente como salvo
                    const inputs = document.querySelectorAll(`[data-plan-id="${docId}"], [data-entry-id="${docId}"], [data-order-id="${docId}"]`);
                    inputs.forEach(input => {
                        if (input.tagName === 'INPUT') {
                            input.classList.remove('bg-yellow-100', 'border-yellow-400');
                            input.classList.add('bg-green-100', 'border-green-400');
                            input.dataset.original = input.value;
                            setTimeout(() => {
                                input.classList.remove('bg-green-100', 'border-green-400');
                            }, 2000);
                        }
                    });
                    
                    successCount++;
                } catch (err) {
                    console.error(`Erro ao salvar ${docId}:`, err);
                    errorCount++;
                    
                    // Marcar visualmente como erro
                    const inputs = document.querySelectorAll(`[data-plan-id="${docId}"], [data-entry-id="${docId}"], [data-order-id="${docId}"]`);
                    inputs.forEach(input => {
                        if (input.tagName === 'INPUT') {
                            input.classList.add('bg-red-100', 'border-red-400');
                        }
                    });
                }
            }
            
            // Limpar pendentes salvos com sucesso
            ajustesLotePendentes.clear();
            atualizarContadorAjustes();
            
            if (errorCount === 0) {
                showNotification(`${successCount} alteração(ões) salva(s) com sucesso!`, 'success');
            } else {
                showNotification(`${successCount} salva(s), ${errorCount} erro(s)`, 'warning');
            }
            
        } catch (error) {
            console.error('[ADMIN] Erro ao salvar ajustes:', error);
            showNotification('Erro ao salvar: ' + error.message, 'error');
        } finally {
            if (btnSalvar) {
                btnSalvar.disabled = false;
                btnSalvar.innerHTML = '<i data-lucide="save" class="w-4 h-4"></i> Salvar Alterações <span id="admin-ajustes-count" class="bg-green-800 px-2 py-0.5 rounded text-xs hidden">0</span>';
                (typeof lucide !== 'undefined' && lucide.createIcons());
            }
        }
    }
    
    function adminDescartarAjustes() {
        if (ajustesLotePendentes.size === 0) return;
        
        if (!confirm('Descartar todas as alterações não salvas?')) return;
        
        // Restaurar valores originais
        ajustesLotePendentes.forEach((data, docId) => {
            const inputs = document.querySelectorAll(`[data-plan-id="${docId}"], [data-entry-id="${docId}"], [data-order-id="${docId}"]`);
            inputs.forEach(input => {
                if (input.tagName === 'INPUT') {
                    input.value = input.dataset.original;
                    input.classList.remove('bg-yellow-100', 'border-yellow-400');
                }
            });
        });
        
        ajustesLotePendentes.clear();
        atualizarContadorAjustes();
        showNotification('Alterações descartadas', 'info');
    }
    
    async function adminSincronizarTotais() {
        const data = document.getElementById('admin-ajuste-data')?.value;
        
        if (!data) {
            alert('Selecione uma data primeiro');
            return;
        }
        
        if (!confirm('Isso irá recalcular os totais de todas as ordens com base nos lançamentos.\n\nContinuar?')) return;
        
        const btnSync = document.getElementById('admin-btn-sync-totais');
        if (btnSync) {
            btnSync.disabled = true;
            btnSync.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Sincronizando...';
        }
        
        try {
            // Buscar todos os lançamentos
            const prodSnap = await db().collection('production_entries').where('data', '==', data).get();
            
            // Agregar por orderId
            const totaisPorOrdem = new Map();
            prodSnap.docs.forEach(doc => {
                const d = doc.data();
                const orderId = d.orderId || d.order_id;
                if (orderId) {
                    const atual = totaisPorOrdem.get(orderId) || 0;
                    totaisPorOrdem.set(orderId, atual + (Number(d.produzido) || Number(d.quantity) || 0));
                }
            });
            
            // Atualizar cada ordem
            let updated = 0;
            for (const [orderId, total] of totaisPorOrdem) {
                try {
                    await db().collection('production_orders').doc(orderId).update({
                        total_produzido: total,
                        totalProduced: total,
                        syncedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    updated++;
                } catch (e) {
                    console.warn(`Erro ao atualizar ordem ${orderId}:`, e);
                }
            }
            
            showNotification(`${updated} ordem(ns) sincronizada(s)`, 'success');
            
            // Recarregar dados
            adminCarregarAjustesLote();
            
        } catch (error) {
            console.error('[ADMIN] Erro ao sincronizar:', error);
            showNotification('Erro: ' + error.message, 'error');
        } finally {
            if (btnSync) {
                btnSync.disabled = false;
                btnSync.innerHTML = '<i data-lucide="calculator" class="w-4 h-4"></i> Sincronizar Totais';
                (typeof lucide !== 'undefined' && lucide.createIcons());
            }
        }
    }
    
    async function excluirLancamento(entryId) {
        if (!confirm('Excluir este lançamento? Esta ação não pode ser desfeita.')) return;
        
        try {
            await db().collection('production_entries').doc(entryId).delete();
            
            // Remover da tabela
            const row = document.querySelector(`tr[data-entry-id="${entryId}"]`);
            if (row) row.remove();
            
            showNotification('Lançamento excluído', 'success');
        } catch (error) {
            showNotification('Erro ao excluir: ' + error.message, 'error');
        }
    }
    
    async function recalcularTotalOrdem(orderId) {
        try {
            // Buscar todos os lançamentos desta ordem
            const prodSnap = await db().collection('production_entries')
                .where('orderId', '==', orderId)
                .get();
            
            let total = 0;
            prodSnap.docs.forEach(doc => {
                const d = doc.data();
                total += Number(d.produzido) || Number(d.quantity) || 0;
            });
            
            // Atualizar ordem
            await db().collection('production_orders').doc(orderId).update({
                total_produzido: total,
                totalProduced: total,
                syncedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            // Atualizar input na tabela
            const input = document.querySelector(`input[data-order-id="${orderId}"][data-field="total_produzido"]`);
            if (input) {
                input.value = total;
                input.dataset.original = total;
                input.classList.add('bg-green-100');
                setTimeout(() => input.classList.remove('bg-green-100'), 2000);
            }
            
            showNotification(`Total recalculado: ${total.toLocaleString('pt-BR')} peças`, 'success');
        } catch (error) {
            showNotification('Erro: ' + error.message, 'error');
        }
    }
    
    async function mostrarDetalhePlano(planId) {
        try {
            const planDoc = await db().collection('planning').doc(planId).get();
            if (!planDoc.exists) {
                alert('Planejamento não encontrado');
                return;
            }
            
            const plan = planDoc.data();
            
            // Buscar lançamentos deste plano
            const prodSnap = await db().collection('production_entries')
                .where('planId', '==', planId)
                .get();
            
            let lancamentos = prodSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            lancamentos.sort((a, b) => {
                const tsA = a.timestamp?.toMillis ? a.timestamp.toMillis() : 0;
                const tsB = b.timestamp?.toMillis ? b.timestamp.toMillis() : 0;
                return tsB - tsA;
            });
            
            const modal = document.createElement('div');
            modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4';
            modal.innerHTML = `
                <div class="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                    <div class="bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-4 flex items-center justify-between">
                        <div>
                            <h3 class="text-lg font-bold text-white">${plan.machine || '-'} - Detalhes</h3>
                            <p class="text-indigo-200 text-sm">${plan.product || '-'} | OP: ${plan.order_number || '-'}</p>
                        </div>
                        <button class="modal-close text-white/80 hover:text-white p-1">
                            <i data-lucide="x" class="w-6 h-6"></i>
                        </button>
                    </div>
                    <div class="p-5 overflow-y-auto flex-1">
                        <div class="grid grid-cols-3 gap-3 mb-4">
                            <div class="bg-blue-50 rounded-lg p-3 text-center">
                                <div class="text-2xl font-bold text-blue-700">${(Number(plan.order_lot_size) || Number(plan.lot_size) || 0).toLocaleString('pt-BR')}</div>
                                <div class="text-xs text-blue-600">Planejado (Lote)</div>
                            </div>
                            <div class="bg-green-50 rounded-lg p-3 text-center">
                                <div class="text-2xl font-bold text-green-700">${(Number(plan.total_produzido) || 0).toLocaleString('pt-BR')}</div>
                                <div class="text-xs text-green-600">Executado Total</div>
                            </div>
                            <div class="bg-amber-50 rounded-lg p-3 text-center">
                                <div class="text-2xl font-bold text-amber-700">${Math.max(0, (Number(plan.order_lot_size) || Number(plan.lot_size) || 0) - (Number(plan.total_produzido) || 0)).toLocaleString('pt-BR')}</div>
                                <div class="text-xs text-amber-600">Faltante</div>
                            </div>
                        </div>
                        
                        <h4 class="font-semibold text-gray-700 mb-2">Lançamentos (${lancamentos.length})</h4>
                        <div class="border rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                            <table class="w-full text-sm">
                                <thead class="bg-gray-100 sticky top-0">
                                    <tr>
                                        <th class="px-3 py-2 text-left text-gray-600">Data/Hora</th>
                                        <th class="px-3 py-2 text-center text-gray-600">Turno</th>
                                        <th class="px-3 py-2 text-right text-gray-600">Quantidade</th>
                                        <th class="px-3 py-2 text-left text-gray-600">Operador</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y">
                                    ${lancamentos.length > 0 ? lancamentos.map(l => `
                                        <tr class="hover:bg-gray-50">
                                            <td class="px-3 py-2 text-gray-700">${l.data || '-'} ${l.timestamp?.toDate ? l.timestamp.toDate().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}</td>
                                            <td class="px-3 py-2 text-center"><span class="px-2 py-0.5 rounded text-xs font-semibold bg-gray-100">${l.turno || l.shift || '-'}</span></td>
                                            <td class="px-3 py-2 text-right font-semibold text-green-700">${(Number(l.produzido) || Number(l.quantity) || 0).toLocaleString('pt-BR')}</td>
                                            <td class="px-3 py-2 text-gray-600">${l.registradoPorNome || l.operador || '-'}</td>
                                        </tr>
                                    `).join('') : '<tr><td colspan="4" class="px-4 py-8 text-center text-gray-400">Nenhum lançamento encontrado</td></tr>'}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div class="border-t px-5 py-3 bg-gray-50 flex justify-end">
                        <button class="modal-close bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg font-medium transition">Fechar</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            (typeof lucide !== 'undefined' && lucide.createIcons());
            
            modal.querySelectorAll('.modal-close').forEach(btn => {
                btn.addEventListener('click', () => modal.remove());
            });
            modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
            
        } catch (error) {
            alert('Erro ao carregar detalhes: ' + error.message);
        }
    }

    // ==================== FIM ADMINISTRAÇÃO DE DADOS ====================

// --- Exports ---
export { setupAdminDadosPage };
