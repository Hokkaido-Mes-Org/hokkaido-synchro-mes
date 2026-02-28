/**
 * HokkaidoMES — Triage Controller (Triagem / Quarentena)
 * 
 * Controla a aba de Qualidade → sub-aba Triagem.
 * Responsável por: UI de quarentena, formulários de triagem,
 * dashboard de KPIs, e tabela de histórico.
 */

import { triageService, TRIAGE_STATUS } from '../services/triage.service.js';
import { showNotification } from '../components/notification.js';

// ---------- Estado do módulo ----------
let _initialized = false;
let _currentFilter = 'all'; // all | QUARENTENA | EM_TRIAGEM | CONCLUIDA
let _triageData = [];

// ---------- Referências DOM (lazy) ----------
const el = (id) => document.getElementById(id);

// ======================================================================
//  SETUP — ponto de entrada chamado pelo _controllerRegistry
// ======================================================================
export async function setupQualidadePage() {
    if (_initialized) {
        await refreshTriageData();
        return;
    }

    setupSubTabs();
    setupTriageForm();
    setupTriageFilters();
    setupTriageResultModal();
    setupTriageEditModal();
    setupWeightMode();

    await refreshTriageData();
    _initialized = true;

    console.log('[Triage] Qualidade page initialized');
}

// ======================================================================
//  SUB-TABS (Triagem | Histórico)
// ======================================================================
function setupSubTabs() {
    const tabs = document.querySelectorAll('.qualidade-tab-btn');
    const panes = document.querySelectorAll('.qualidade-tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active', 'bg-amber-50', 'text-amber-700', 'border-amber-500'));
            panes.forEach(p => p.classList.add('hidden'));

            tab.classList.add('active', 'bg-amber-50', 'text-amber-700', 'border-amber-500');
            const target = tab.dataset.qualidadeTab;
            const pane = document.getElementById(`qualidade-tab-${target}`);
            if (pane) pane.classList.remove('hidden');
        });
    });
}

// ======================================================================
//  FORMULÁRIO — Enviar peças para quarentena
// ======================================================================
let _selectedProduct = null;
let _selectedUser = null;

function setupTriageForm() {
    const form = el('triage-quarantine-form');
    if (!form) return;

    // Popular selects de máquina, motivo de defeito
    populateMachineSelect('triage-machine-select');
    populateDefectReasonSelect('triage-defect-select');

    // Setup auto-search de produto e usuário
    setupProductSearch();
    setupUserSearch();

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = form.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.textContent = 'Enviando...';

        try {
            const machineId    = el('triage-machine-select')?.value;
            const orderNumber  = el('triage-order-input')?.value?.trim();
            const productCode  = _selectedProduct ? String(_selectedProduct.cod) : (el('triage-product-input')?.value?.trim() || '');
            const defectReason = el('triage-defect-select')?.value;
            const turno        = el('triage-turno-select')?.value;
            const notes        = el('triage-notes-input')?.value?.trim();

            // Calcular quantidade — modo peso converte para peças
            let quantity = 0;
            let weightKg = null;

            if (_inputMode === 'weight') {
                weightKg = parseFloat(el('triage-weight-input')?.value);
                if (!weightKg || weightKg <= 0) {
                    showNotification('Informe o peso em gramas', 'error');
                    return;
                }
                if (!_selectedProduct || !_selectedProduct.weight || _selectedProduct.weight <= 0) {
                    showNotification('Selecione um produto com peso cadastrado para converter peso → peças', 'error');
                    return;
                }
                quantity = Math.floor(weightKg / _selectedProduct.weight);
                if (quantity <= 0) {
                    showNotification('Peso insuficiente para ao menos 1 peça', 'error');
                    return;
                }
            } else {
                quantity = parseInt(el('triage-quantity-input')?.value, 10);
            }

            if (!machineId || !quantity || quantity <= 0) {
                showNotification('Preencha máquina e quantidade', 'error');
                return;
            }

            // Resolver produto
            let product = '';
            if (_selectedProduct) {
                product = _selectedProduct.name || '';
            } else if (productCode && window.productByCode) {
                const p = window.productByCode.get(Number(productCode));
                if (p) product = p.name || '';
            }

            // Extrair categoria do motivo
            let defectCategory = '';
            if (defectReason && window.lossReasonsDatabase) {
                const found = window.lossReasonsDatabase.find(lr => lr.name === defectReason);
                if (found) defectCategory = found.category;
            }

            // Resolver operador
            let operador = '';
            if (_selectedUser) {
                operador = `${_selectedUser.cod} - ${_selectedUser.nomeCompleto}`;
            } else {
                const userInput = el('triage-user-input')?.value?.trim();
                if (userInput) {
                    operador = userInput;
                } else {
                    operador = window.authSystem?.getCurrentUser?.()?.name || '';
                }
            }

            await triageService.sendToQuarantine({
                machineId,
                orderNumber,
                product,
                productCode,
                defectReason,
                defectCategory,
                quantity,
                turno,
                notes,
                operador,
                operadorCod: _selectedUser ? _selectedUser.cod : null,
                inputMode: _inputMode,
                weightKg: weightKg,
                pieceWeight: _selectedProduct?.weight || null
            });

            showNotification(`${quantity} peças enviadas para quarentena`, 'success');
            form.reset();
            _selectedProduct = null;
            _selectedUser = null;
            _inputMode = 'pieces';
            const infoPanel = el('triage-product-info');
            if (infoPanel) infoPanel.classList.add('hidden');
            const userResolved = el('triage-user-resolved');
            if (userResolved) { userResolved.classList.add('hidden'); userResolved.textContent = ''; }
            const conversionInfo = el('triage-weight-conversion');
            if (conversionInfo) conversionInfo.classList.add('hidden');
            // Resetar modo visual
            const piecesGroup = el('triage-pieces-group');
            const weightGroup = el('triage-weight-group');
            if (piecesGroup) piecesGroup.classList.remove('hidden');
            if (weightGroup) weightGroup.classList.add('hidden');
            const modeBtns = document.querySelectorAll('.triage-mode-btn');
            modeBtns.forEach(b => {
                b.classList.remove('bg-amber-100', 'text-amber-800');
                b.classList.add('text-gray-600');
            });
            const piecesModeBtn = el('triage-mode-pieces');
            if (piecesModeBtn) { piecesModeBtn.classList.add('bg-amber-100', 'text-amber-800'); piecesModeBtn.classList.remove('text-gray-600'); }
            await refreshTriageData();
        } catch (err) {
            console.error('[Triage] Erro ao enviar para quarentena:', err);
            showNotification('Erro ao registrar quarentena: ' + err.message, 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Enviar para Quarentena';
        }
    });
}

// ======================================================================
//  FILTROS (status)
// ======================================================================
function setupTriageFilters() {
    const filterBtns = document.querySelectorAll('.triage-filter-btn');
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active', 'bg-amber-100', 'text-amber-800'));
            btn.classList.add('active', 'bg-amber-100', 'text-amber-800');
            _currentFilter = btn.dataset.triageFilter || 'all';
            renderTriageTable();
        });
    });
}

// ======================================================================
//  MODAL — Registrar resultado da triagem
// ======================================================================
let _resultInputMode = 'pieces'; // 'pieces' | 'weight'
let _resultPieceWeight = 0; // peso unitário em gramas do lote sendo triado

function setupTriageResultModal() {
    // Fechar modal
    const closeBtn = el('triage-modal-close');
    const modal = el('triage-result-modal');
    if (closeBtn && modal) {
        closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.add('hidden');
        });
    }

    // Toggle modo peças / peso
    const modeBtns = document.querySelectorAll('.triage-result-mode-btn');
    modeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            modeBtns.forEach(b => {
                b.classList.remove('bg-amber-100', 'text-amber-800');
                b.classList.add('text-gray-600');
            });
            btn.classList.add('bg-amber-100', 'text-amber-800');
            btn.classList.remove('text-gray-600');

            _resultInputMode = btn.dataset.mode;
            const piecesGroup = el('triage-result-pieces-group');
            const weightGroup = el('triage-result-weight-group');

            if (_resultInputMode === 'weight') {
                if (piecesGroup) piecesGroup.classList.add('hidden');
                if (weightGroup) weightGroup.classList.remove('hidden');
            } else {
                if (piecesGroup) piecesGroup.classList.remove('hidden');
                if (weightGroup) weightGroup.classList.add('hidden');
            }
        });
    });

    // Conversão em tempo real peso → peças
    const wApproved = el('triage-result-weight-approved');
    const wRejected = el('triage-result-weight-rejected');
    const convInfo = el('triage-result-weight-conversion');

    function updateWeightConversion() {
        if (!_resultPieceWeight || _resultPieceWeight <= 0) {
            if (convInfo) { convInfo.textContent = 'Produto sem peso cadastrado'; convInfo.classList.remove('hidden'); }
            return;
        }
        const wa = parseFloat(wApproved?.value) || 0;
        const wr = parseFloat(wRejected?.value) || 0;
        const pcsApproved = Math.floor(wa / _resultPieceWeight);
        const pcsRejected = Math.floor(wr / _resultPieceWeight);
        if (convInfo) {
            convInfo.textContent = `≈ ${pcsApproved} aprovadas + ${pcsRejected} refugadas (peso unit.: ${_resultPieceWeight}g)`;
            convInfo.classList.remove('hidden');
        }
    }
    if (wApproved) wApproved.addEventListener('input', updateWeightConversion);
    if (wRejected) wRejected.addEventListener('input', updateWeightConversion);

    // Submit do formulário de resultado
    const resultForm = el('triage-result-form');
    if (resultForm) {
        resultForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = el('triage-result-id')?.value;
            let approved, rejected;

            if (_resultInputMode === 'weight') {
                const wa = parseFloat(el('triage-result-weight-approved')?.value) || 0;
                const wr = parseFloat(el('triage-result-weight-rejected')?.value) || 0;
                if (wa <= 0 && wr <= 0) {
                    showNotification('Informe ao menos um peso aprovado ou refugado', 'error');
                    return;
                }
                if (!_resultPieceWeight || _resultPieceWeight <= 0) {
                    showNotification('Produto sem peso cadastrado — use o modo Peças', 'error');
                    return;
                }
                approved = Math.floor(wa / _resultPieceWeight);
                rejected = Math.floor(wr / _resultPieceWeight);
                if (approved <= 0 && rejected <= 0) {
                    showNotification('Peso insuficiente para ao menos 1 peça', 'error');
                    return;
                }
            } else {
                approved = parseInt(el('triage-result-approved')?.value || '0', 10);
                rejected = parseInt(el('triage-result-rejected')?.value || '0', 10);
            }

            const notes    = el('triage-result-notes')?.value?.trim();
            const currentUser = window.authSystem?.getCurrentUser?.()?.name || '';

            if (approved <= 0 && rejected <= 0) {
                showNotification('Informe ao menos 1 peça aprovada ou refugada', 'error');
                return;
            }

            try {
                const triageResult = await triageService.recordTriageResult(id, {
                    approved,
                    rejected,
                    operator: currentUser,
                    notes
                });

                // ✅ RETORNO À PRODUÇÃO: peças aprovadas voltam como produção da OP de origem
                if (approved > 0 && triageResult.doc) {
                    const returnResult = await triageService.returnToProduction(triageResult.doc, approved, currentUser);
                    if (returnResult.success) {
                        showNotification(`Triagem: ${approved} aprovadas (retornaram à produção), ${rejected} refugadas`, 'success');
                    } else {
                        showNotification(`Triagem registrada: ${approved} aprovadas, ${rejected} refugadas (retorno à produção falhou)`, 'warning');
                    }
                } else {
                    showNotification(`Triagem registrada: ${approved} aprovadas, ${rejected} refugadas`, 'success');
                }

                modal.classList.add('hidden');
                resultForm.reset();
                _resultInputMode = 'pieces';
                _resetResultMode();
                await refreshTriageData();
            } catch (err) {
                console.error('[Triage] Erro ao registrar resultado:', err);
                showNotification('Erro: ' + err.message, 'error');
            }
        });
    }
}

function _resetResultMode() {
    const piecesGroup = el('triage-result-pieces-group');
    const weightGroup = el('triage-result-weight-group');
    const convInfo = el('triage-result-weight-conversion');
    if (piecesGroup) piecesGroup.classList.remove('hidden');
    if (weightGroup) weightGroup.classList.add('hidden');
    if (convInfo) convInfo.classList.add('hidden');
    const modeBtns = document.querySelectorAll('.triage-result-mode-btn');
    modeBtns.forEach(b => {
        b.classList.remove('bg-amber-100', 'text-amber-800');
        b.classList.add('text-gray-600');
    });
    if (modeBtns[0]) { modeBtns[0].classList.add('bg-amber-100', 'text-amber-800'); modeBtns[0].classList.remove('text-gray-600'); }
}

// ======================================================================
//  DADOS & RENDERIZAÇÃO
// ======================================================================
async function refreshTriageData() {
    try {
        _triageData = await triageService.getAll({}, true);
        renderKPIs();
        renderTriageTable();
    } catch (err) {
        console.error('[Triage] Erro ao carregar dados:', err);
    }
}

function renderKPIs() {
    const quarantine = _triageData.filter(e => e.status === TRIAGE_STATUS.QUARENTENA);
    const inTriage   = _triageData.filter(e => e.status === TRIAGE_STATUS.EM_TRIAGEM);
    const completed  = _triageData.filter(e => e.status === TRIAGE_STATUS.CONCLUIDA);

    const totalPieces   = _triageData.reduce((s, e) => s + (e.quantity || 0), 0);
    const totalApproved = _triageData.reduce((s, e) => s + (e.quantityApproved || 0), 0);
    const totalRejected = _triageData.reduce((s, e) => s + (e.quantityRejected || 0), 0);
    const totalPending  = _triageData.reduce((s, e) => s + (e.quantityPending || 0), 0);

    const rate = totalPieces > 0 ? ((totalApproved / totalPieces) * 100).toFixed(1) : '0.0';

    setKPI('triage-kpi-quarantine', quarantine.length);
    setKPI('triage-kpi-in-triage', inTriage.length);
    setKPI('triage-kpi-completed', completed.length);
    setKPI('triage-kpi-pending-pieces', totalPending);
    setKPI('triage-kpi-approved', totalApproved);
    setKPI('triage-kpi-rejected', totalRejected);
    setKPI('triage-kpi-approval-rate', rate + '%');

    // Impacto OEE: total pendentes + rejeitadas
    const oeeImpact = totalPending + totalRejected;
    setKPI('triage-kpi-oee-impact', oeeImpact);
}

function setKPI(id, value) {
    const elem = document.getElementById(id);
    if (elem) elem.textContent = value;
}

function renderTriageTable() {
    const tbody = el('triage-table-body');
    if (!tbody) return;

    let filtered = _triageData;
    if (_currentFilter !== 'all') {
        filtered = filtered.filter(e => e.status === _currentFilter);
    }

    // Ordenar: quarentena primeiro, depois em triagem, depois concluída (mais recente primeiro)
    const statusOrder = { QUARENTENA: 0, EM_TRIAGEM: 1, CONCLUIDA: 2 };
    filtered.sort((a, b) => {
        const sa = statusOrder[a.status] ?? 3;
        const sb = statusOrder[b.status] ?? 3;
        if (sa !== sb) return sa - sb;
        return (b.quarantineDate || '').localeCompare(a.quarantineDate || '');
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="10" class="px-4 py-8 text-center text-gray-400">
                    Nenhum lote encontrado para o filtro selecionado.
                </td>
            </tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(entry => {
        const statusBadge = getStatusBadge(entry.status);
        const canTriage = entry.status === TRIAGE_STATUS.QUARENTENA || entry.status === TRIAGE_STATUS.EM_TRIAGEM;

        // Barra de progresso da triagem
        const total = entry.quantity || 0;
        const processed = (entry.quantityApproved || 0) + (entry.quantityRejected || 0);
        const progressPct = total > 0 ? Math.round((processed / total) * 100) : 0;
        const progressColor = progressPct >= 100 ? 'bg-green-500' : progressPct > 50 ? 'bg-amber-400' : 'bg-blue-400';

        // Nome do produto (código + nome se disponível)
        const productDisplay = entry.product
            ? `<span class="font-medium">${escHtml(entry.productCode || '-')}</span><br><span class="text-[11px] text-gray-400">${escHtml(entry.product)}</span>`
            : escHtml(entry.productCode || '-');

        return `
            <tr class="hover:bg-gray-50 border-b border-gray-100">
                <td class="px-3 py-2.5 text-sm font-medium text-gray-800">${escHtml(entry.machineId || '-')}</td>
                <td class="px-3 py-2.5 text-sm text-gray-600">${escHtml(entry.orderNumber || '-')}</td>
                <td class="px-3 py-2.5 text-sm text-gray-600 max-w-[180px]" title="${escHtml(entry.product || '')}">${productDisplay}</td>
                <td class="px-3 py-2.5 text-sm text-gray-600">${escHtml(entry.defectReason || '-')}</td>
                <td class="px-3 py-2.5 text-xs text-center text-gray-500">${escHtml(entry.turno || '-')}</td>
                <td class="px-3 py-2.5 text-sm text-center font-semibold text-gray-800">${total}</td>
                <td class="px-3 py-2.5 text-sm text-center">
                    <div class="flex items-center justify-center gap-1 text-xs">
                        <span class="text-green-600 font-medium" title="Aprovadas">${entry.quantityApproved || 0}</span> /
                        <span class="text-red-500 font-medium" title="Refugadas">${entry.quantityRejected || 0}</span> /
                        <span class="text-amber-500 font-medium" title="Pendentes">${entry.quantityPending || 0}</span>
                    </div>
                    <div class="w-full bg-gray-200 rounded-full h-1 mt-1">
                        <div class="${progressColor} rounded-full h-1 transition-all" style="width: ${progressPct}%"></div>
                    </div>
                </td>
                <td class="px-3 py-2.5 text-sm">${statusBadge}</td>
                <td class="px-3 py-2.5 text-sm text-gray-500">${formatDate(entry.quarantineDate)}</td>
                <td class="px-3 py-2.5 text-sm whitespace-nowrap">
                    <div class="flex items-center gap-1">
                        ${canTriage ? `
                            <button onclick="window._triageOpenResult('${entry.id}')" 
                                    class="px-2 py-1 text-xs font-medium text-white bg-amber-500 hover:bg-amber-600 rounded-lg transition-colors"
                                    title="Registrar triagem">
                                Triar
                            </button>
                            <button onclick="window._triageFinalize('${entry.id}')" 
                                    class="px-2 py-1 text-xs font-medium text-red-600 border border-red-300 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Finalizar — refugar peças pendentes">
                                Finalizar
                            </button>
                        ` : ''}
                        <button onclick="window._triageEdit('${entry.id}')"
                                class="px-2 py-1 text-xs font-medium text-blue-600 border border-blue-300 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Editar lote">
                            <i data-lucide="pencil" class="w-3 h-3 inline-block"></i>
                        </button>
                        <button onclick="window._triageDelete('${entry.id}')"
                                class="px-2 py-1 text-xs font-medium text-red-500 border border-red-200 hover:bg-red-50 rounded-lg transition-colors"
                                title="Excluir lote">
                            <i data-lucide="trash-2" class="w-3 h-3 inline-block"></i>
                        </button>
                    </div>
                </td>
            </tr>`;
    }).join('');

    // Re-renderizar ícones Lucide nos novos botões
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function getStatusBadge(status) {
    switch (status) {
        case TRIAGE_STATUS.QUARENTENA:
            return '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800"><span class="w-1.5 h-1.5 rounded-full bg-yellow-500"></span>Quarentena</span>';
        case TRIAGE_STATUS.EM_TRIAGEM:
            return '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"><span class="w-1.5 h-1.5 rounded-full bg-blue-500"></span>Em Triagem</span>';
        case TRIAGE_STATUS.CONCLUIDA:
            return '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"><span class="w-1.5 h-1.5 rounded-full bg-green-500"></span>Concluída</span>';
        default:
            return `<span class="text-xs text-gray-400">${status}</span>`;
    }
}

// ======================================================================
//  MODAL — Editar lote de triagem
// ======================================================================
function setupTriageEditModal() {
    const modal = el('triage-edit-modal');
    const closeBtn = el('triage-edit-modal-close');
    const editForm = el('triage-edit-form');

    if (closeBtn && modal) {
        closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.add('hidden');
        });
    }

    // Popular selects do modal de edição
    populateMachineSelect('triage-edit-machine');
    populateDefectReasonSelect('triage-edit-defect');

    if (editForm) {
        editForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = el('triage-edit-id')?.value;
            if (!id) return;

            const entry = _triageData.find(e => e.id === id);
            if (!entry) return;

            const newQuantity = parseInt(el('triage-edit-quantity')?.value, 10);
            const oldQuantity = entry.quantity || 0;
            const alreadyProcessed = (entry.quantityApproved || 0) + (entry.quantityRejected || 0);

            if (newQuantity < alreadyProcessed) {
                showNotification(`Quantidade não pode ser menor que ${alreadyProcessed} (já processadas)`, 'error');
                return;
            }

            // Resolver produto pelo código
            const productCode = el('triage-edit-product')?.value?.trim() || '';
            let product = entry.product || '';
            if (productCode && window.productByCode) {
                const p = window.productByCode.get(Number(productCode));
                if (p) product = p.name || '';
            }

            try {
                await triageService.update(id, {
                    machineId:       el('triage-edit-machine')?.value || entry.machineId,
                    orderNumber:     el('triage-edit-order')?.value?.trim() || '',
                    productCode:     productCode,
                    product:         product,
                    quantity:        newQuantity,
                    quantityPending: newQuantity - alreadyProcessed,
                    defectReason:    el('triage-edit-defect')?.value || '',
                    turno:           el('triage-edit-turno')?.value || '',
                    notes:           el('triage-edit-notes')?.value?.trim() || ''
                });

                showNotification('Lote atualizado com sucesso', 'success');
                modal.classList.add('hidden');
                await refreshTriageData();
            } catch (err) {
                console.error('[Triage] Erro ao editar:', err);
                showNotification('Erro ao salvar: ' + err.message, 'error');
            }
        });
    }
}

// ======================================================================
//  MODO PESO → PEÇAS (conversão automática)
// ======================================================================
let _inputMode = 'pieces'; // 'pieces' | 'weight'

function setupWeightMode() {
    const modeBtns = document.querySelectorAll('.triage-mode-btn');
    const piecesGroup = el('triage-pieces-group');
    const weightGroup = el('triage-weight-group');
    const weightInput = el('triage-weight-input');
    const quantityInput = el('triage-quantity-input');
    const conversionInfo = el('triage-weight-conversion');

    modeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            modeBtns.forEach(b => {
                b.classList.remove('bg-amber-100', 'text-amber-800');
                b.classList.add('text-gray-600');
            });
            btn.classList.add('bg-amber-100', 'text-amber-800');
            btn.classList.remove('text-gray-600');

            _inputMode = btn.dataset.mode;

            if (_inputMode === 'weight') {
                if (piecesGroup) piecesGroup.classList.add('hidden');
                if (weightGroup) weightGroup.classList.remove('hidden');
                if (quantityInput) { quantityInput.required = false; quantityInput.value = ''; }
                if (weightInput) weightInput.required = true;
            } else {
                if (piecesGroup) piecesGroup.classList.remove('hidden');
                if (weightGroup) weightGroup.classList.add('hidden');
                if (quantityInput) quantityInput.required = true;
                if (weightInput) { weightInput.required = false; weightInput.value = ''; }
                if (conversionInfo) conversionInfo.classList.add('hidden');
            }
        });
    });

    // Conversão automática peso → peças ao digitar
    if (weightInput) {
        weightInput.addEventListener('input', () => {
            const weightKg = parseFloat(weightInput.value);
            if (!weightKg || weightKg <= 0 || !_selectedProduct || !_selectedProduct.weight) {
                if (conversionInfo) conversionInfo.classList.add('hidden');
                if (quantityInput) quantityInput.value = '';
                return;
            }

            const pieceWeightG = _selectedProduct.weight; // peso em gramas
            const pieces = Math.floor(weightKg / pieceWeightG);

            if (quantityInput) quantityInput.value = pieces;
            if (conversionInfo) {
                conversionInfo.textContent = `≈ ${pieces} peças (peso unitário: ${pieceWeightG}g)`;
                conversionInfo.classList.remove('hidden');
            }
        });
    }
}

// ======================================================================
//  WINDOW HANDLERS (onclick p/ HTML)
// ======================================================================
window._triageOpenResult = function(id) {
    const entry = _triageData.find(e => e.id === id);
    if (!entry) return;

    // Se está em quarentena, iniciar triagem primeiro
    if (entry.status === TRIAGE_STATUS.QUARENTENA) {
        const currentUser = window.authSystem?.getCurrentUser?.()?.name || '';
        triageService.startTriage(id, currentUser).then(() => {
            refreshTriageData();
        });
    }

    const modal = el('triage-result-modal');
    if (!modal) return;

    el('triage-result-id').value = id;
    el('triage-result-machine').textContent = entry.machineId || '-';
    el('triage-result-order').textContent = entry.orderNumber || '-';
    el('triage-result-defect').textContent = entry.defectReason || '-';
    el('triage-result-total').textContent = entry.quantity || 0;
    el('triage-result-remaining').textContent = entry.quantityPending || 0;

    // Exibir produto e turno
    const productEl = el('triage-result-product');
    if (productEl) productEl.textContent = entry.product ? `${entry.productCode} — ${entry.product}` : (entry.productCode || '-');
    const turnoEl = el('triage-result-turno');
    if (turnoEl) turnoEl.textContent = entry.turno || '-';

    // Nota sobre impacto OEE
    const oeeNoteEl = el('triage-result-oee-note');
    if (oeeNoteEl) {
        const pendingPcs = entry.quantityPending || 0;
        if (pendingPcs > 0) {
            oeeNoteEl.textContent = `${pendingPcs} peças pendentes impactam a qualidade no OEE. Peças aprovadas retornam como produção da OP de origem.`;
            oeeNoteEl.classList.remove('hidden');
        } else {
            oeeNoteEl.classList.add('hidden');
        }
    }

    // Resolver peso unitário do produto para conversão peso→peças
    _resultPieceWeight = 0;
    if (entry.pieceWeight) {
        _resultPieceWeight = entry.pieceWeight;
    } else if (entry.productCode && window.productByCode) {
        const prod = window.productByCode.get(Number(entry.productCode));
        if (prod && prod.weight) _resultPieceWeight = prod.weight;
    }
    const pwEl = el('triage-result-piece-weight');
    const pwValEl = el('triage-result-pw-value');
    if (_resultPieceWeight > 0 && pwEl && pwValEl) {
        pwValEl.textContent = _resultPieceWeight;
        pwEl.classList.remove('hidden');
    } else if (pwEl) {
        pwEl.classList.add('hidden');
    }

    // Limpar campos e resetar modo
    el('triage-result-approved').value = '';
    el('triage-result-rejected').value = '';
    el('triage-result-notes').value = '';
    const wAppr = el('triage-result-weight-approved');
    const wRej = el('triage-result-weight-rejected');
    if (wAppr) wAppr.value = '';
    if (wRej) wRej.value = '';
    _resultInputMode = 'pieces';
    _resetResultMode();

    // Setar máximo
    const pending = entry.quantityPending || 0;
    el('triage-result-approved').max = pending;
    el('triage-result-rejected').max = pending;

    modal.classList.remove('hidden');
};

window._triageEdit = function(id) {
    const entry = _triageData.find(e => e.id === id);
    if (!entry) return;

    const modal = el('triage-edit-modal');
    if (!modal) return;

    el('triage-edit-id').value = id;

    // Preencher campos com dados atuais
    const machineSelect = el('triage-edit-machine');
    if (machineSelect) machineSelect.value = entry.machineId || '';

    const turnoSelect = el('triage-edit-turno');
    if (turnoSelect) turnoSelect.value = entry.turno || '';

    const orderInput = el('triage-edit-order');
    if (orderInput) orderInput.value = entry.orderNumber || '';

    const productInput = el('triage-edit-product');
    if (productInput) productInput.value = entry.productCode || '';

    const quantityInput = el('triage-edit-quantity');
    if (quantityInput) quantityInput.value = entry.quantity || '';

    const defectSelect = el('triage-edit-defect');
    if (defectSelect) defectSelect.value = entry.defectReason || '';

    const notesInput = el('triage-edit-notes');
    if (notesInput) notesInput.value = entry.notes || '';

    modal.classList.remove('hidden');
    if (typeof lucide !== 'undefined') lucide.createIcons();
};

window._triageDelete = async function(id) {
    const entry = _triageData.find(e => e.id === id);
    if (!entry) return;

    const msg = `Deseja excluir este lote?\n\nMáquina: ${entry.machineId}\nOrdem: ${entry.orderNumber || '-'}\nQuantidade: ${entry.quantity} peças\n\nEsta ação não pode ser desfeita.`;
    if (!confirm(msg)) return;

    try {
        await triageService.delete(id);
        showNotification('Lote excluído com sucesso', 'info');
        await refreshTriageData();
    } catch (err) {
        console.error('[Triage] Erro ao excluir:', err);
        showNotification('Erro ao excluir: ' + err.message, 'error');
    }
};

window._triageFinalize = async function(id) {
    if (!confirm('Deseja finalizar a triagem? Todas as peças pendentes serão refugadas.')) return;
    try {
        const currentUser = window.authSystem?.getCurrentUser?.()?.name || '';
        await triageService.finalizeTriage(id, currentUser, 'Triagem finalizada manualmente');
        showNotification('Triagem finalizada — peças pendentes refugadas', 'info');
        await refreshTriageData();
    } catch (err) {
        showNotification('Erro: ' + err.message, 'error');
    }
};

window._triageRefresh = async function() {
    await refreshTriageData();
    showNotification('Dados atualizados', 'info');
};

// ======================================================================
//  BUSCA DE PRODUTO (auto-complete do database.js)
// ======================================================================
function setupProductSearch() {
    const input = el('triage-product-input');
    const suggestionsBox = el('triage-product-suggestions');
    const infoPanel = el('triage-product-info');
    const clearBtn = el('triage-product-clear');
    if (!input || !suggestionsBox) return;

    let debounceTimer = null;

    input.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        const query = input.value.trim();
        if (query.length < 1) {
            suggestionsBox.classList.add('hidden');
            return;
        }
        debounceTimer = setTimeout(() => showProductSuggestions(query), 200);
    });

    input.addEventListener('focus', () => {
        const query = input.value.trim();
        if (query.length >= 1) showProductSuggestions(query);
    });

    // Fechar sugestões ao clicar fora
    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !suggestionsBox.contains(e.target)) {
            suggestionsBox.classList.add('hidden');
        }
    });

    // Botão limpar produto
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            _selectedProduct = null;
            input.value = '';
            input.readOnly = false;
            if (infoPanel) infoPanel.classList.add('hidden');
        });
    }

    function showProductSuggestions(query) {
        if (!window.productDatabase) return;
        const q = query.toLowerCase();
        const isNumeric = /^\d+$/.test(query);

        const matches = window.productDatabase.filter(p => {
            if (isNumeric) return String(p.cod).includes(query);
            return (p.name || '').toLowerCase().includes(q) ||
                   String(p.cod).includes(q) ||
                   (p.client || '').toLowerCase().includes(q);
        }).slice(0, 15);

        if (matches.length === 0) {
            suggestionsBox.innerHTML = '<div class="px-3 py-2 text-xs text-gray-400">Nenhum produto encontrado</div>';
            suggestionsBox.classList.remove('hidden');
            return;
        }

        suggestionsBox.innerHTML = matches.map(p => `
            <div class="triage-product-option px-3 py-2 hover:bg-amber-50 cursor-pointer border-b border-gray-50 last:border-0 transition-colors" data-cod="${p.cod}">
                <div class="flex items-center justify-between">
                    <span class="text-xs font-bold text-amber-700">Cód: ${p.cod}</span>
                    <span class="text-[10px] text-gray-400">${escHtml(p.client || '')}</span>
                </div>
                <p class="text-xs text-gray-700 truncate mt-0.5">${escHtml(p.name || '')}</p>
            </div>
        `).join('');

        suggestionsBox.querySelectorAll('.triage-product-option').forEach(opt => {
            opt.addEventListener('click', () => {
                const cod = Number(opt.dataset.cod);
                const product = window.productByCode?.get(cod);
                if (product) selectProduct(product);
                suggestionsBox.classList.add('hidden');
            });
        });

        suggestionsBox.classList.remove('hidden');
    }

    function selectProduct(product) {
        _selectedProduct = product;
        input.value = String(product.cod);
        input.readOnly = true;

        if (infoPanel) {
            infoPanel.classList.remove('hidden');
            const nameEl = el('triage-product-name');
            const clientEl = el('triage-product-client');
            const cavitiesEl = el('triage-product-cavities');
            const weightEl = el('triage-product-weight');
            if (nameEl) nameEl.textContent = product.name || '-';
            if (clientEl) clientEl.textContent = product.client || '-';
            if (cavitiesEl) cavitiesEl.textContent = product.cavities || '-';
            if (weightEl) weightEl.textContent = product.weight || '-';
        }
    }
}

// ======================================================================
//  BUSCA DE USUÁRIO (auto-complete do database.js)
// ======================================================================
function setupUserSearch() {
    const input = el('triage-user-input');
    const suggestionsBox = el('triage-user-suggestions');
    const resolvedEl = el('triage-user-resolved');
    if (!input || !suggestionsBox) return;

    let debounceTimer = null;

    input.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        _selectedUser = null;
        if (resolvedEl) { resolvedEl.classList.add('hidden'); resolvedEl.textContent = ''; }
        const query = input.value.trim();
        if (query.length < 1) {
            suggestionsBox.classList.add('hidden');
            return;
        }
        debounceTimer = setTimeout(() => showUserSuggestions(query), 200);
    });

    input.addEventListener('focus', () => {
        const query = input.value.trim();
        if (query.length >= 1) showUserSuggestions(query);
    });

    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !suggestionsBox.contains(e.target)) {
            suggestionsBox.classList.add('hidden');
        }
    });

    function showUserSuggestions(query) {
        if (!window.userDatabase) return;
        const q = query.toLowerCase();
        const isNumeric = /^\d+$/.test(query);

        const matches = window.userDatabase.filter(u => {
            if (isNumeric) return String(u.cod).includes(query);
            return (u.nomeUsuario || '').toLowerCase().includes(q) ||
                   (u.nomeCompleto || '').toLowerCase().includes(q) ||
                   String(u.cod).includes(q);
        }).slice(0, 15);

        if (matches.length === 0) {
            suggestionsBox.innerHTML = '<div class="px-3 py-2 text-xs text-gray-400">Nenhum usuário encontrado</div>';
            suggestionsBox.classList.remove('hidden');
            return;
        }

        suggestionsBox.innerHTML = matches.map(u => `
            <div class="triage-user-option px-3 py-2 hover:bg-amber-50 cursor-pointer border-b border-gray-50 last:border-0 transition-colors" data-cod="${u.cod}">
                <div class="flex items-center justify-between">
                    <span class="text-xs font-bold text-amber-700">Cód: ${u.cod}</span>
                    <span class="text-[10px] text-gray-500 uppercase">${escHtml(u.nomeUsuario || '')}</span>
                </div>
                <p class="text-xs text-gray-700 mt-0.5">${escHtml(u.nomeCompleto || '')}</p>
            </div>
        `).join('');

        suggestionsBox.querySelectorAll('.triage-user-option').forEach(opt => {
            opt.addEventListener('click', () => {
                const cod = Number(opt.dataset.cod);
                const user = window.userByCode?.get(cod);
                if (user) selectUser(user);
                suggestionsBox.classList.add('hidden');
            });
        });

        suggestionsBox.classList.remove('hidden');
    }

    function selectUser(user) {
        _selectedUser = user;
        input.value = `${user.cod} - ${user.nomeUsuario}`;
        if (resolvedEl) {
            resolvedEl.textContent = `✓ ${user.nomeCompleto}`;
            resolvedEl.classList.remove('hidden');
        }
    }
}

// ======================================================================
//  UTILITÁRIOS
// ======================================================================
function populateMachineSelect(selectId) {
    const select = document.getElementById(selectId);
    if (!select || !window.machineDatabase) return;

    select.innerHTML = '<option value="">Selecione a máquina</option>';
    window.machineDatabase.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = `${m.id} — ${m.model}`;
        select.appendChild(opt);
    });
}

function populateDefectReasonSelect(selectId) {
    const select = document.getElementById(selectId);
    if (!select || !window.groupedLossReasons) return;

    select.innerHTML = '<option value="">Selecione o motivo</option>';
    Object.entries(window.groupedLossReasons).forEach(([category, reasons]) => {
        const group = document.createElement('optgroup');
        group.label = category;
        reasons.forEach(reason => {
            const opt = document.createElement('option');
            opt.value = reason;
            opt.textContent = reason;
            group.appendChild(opt);
        });
        select.appendChild(group);
    });
}

function escHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateStr;
}
