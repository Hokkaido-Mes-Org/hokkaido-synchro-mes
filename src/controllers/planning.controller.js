// ============================================================
// src/controllers/planning.controller.js - Phase 3B: Planning module
// Extracted from script.js (~2700 lines, 19+ Planning functions)
// ============================================================
import { getDb } from '../services/firebase-client.js';
import { escapeHtml, normalizeMachineId } from '../utils/dom.utils.js';
import { showNotification } from '../components/notification.js';
import { logSystemAction, registrarLogSistema } from '../utils/logger.js';
import { getActiveUser, isUserGestorOrAdmin, showPermissionDeniedNotification, getCurrentUserName } from '../utils/auth.utils.js';
import { getProductionDateString, getCurrentShift, formatDateBR, formatDateYMD, getShiftForDateTime, pad2 } from '../utils/date.utils.js';
import { coerceToNumber, parseOptionalNumber, normalizeNumericString } from '../utils/number.utils.js';
import { getProductByCode } from '../utils/product.utils.js';
import { getProductionOrderStatusBadge } from '../utils/plan.utils.js';

// --- Closure-scoped functions accessed via window forwarding ---
const detachActiveListener = (...args) => window.detachActiveListener?.(...args);
const showLoadingState = (...args) => window.showLoadingState?.(...args);
const showConfirmModal = (...args) => window.showConfirmModal?.(...args);
const onMachineSelected = (...args) => window.onMachineSelected?.(...args);
const loadProductionOrders = (...args) => window.loadProductionOrders?.(...args);
// setOrderAsActive: definida localmente no modulo (L~1120+), sem forwarding
const populateMachineSelector = (...args) => window.populateMachineSelector?.(...args);
const getPlanningCached = (...args) => window.getPlanningCached?.(...args);
const getExtendedDowntimesCached = (...args) => window.getExtendedDowntimesCached?.(...args);
const getProductionOrdersCached = (...args) => window.getProductionOrdersCached?.(...args);
const getActiveDowntimesCached = (...args) => window.getActiveDowntimesCached?.(...args);
const getAllMachinesDowntimeStatus = (...args) => window.getAllMachinesDowntimeStatus?.(...args);
const loadLaunchPanel = (...args) => window.loadLaunchPanel?.(...args);
// checkActiveDowntimes: definida localmente no modulo (L~1190+), sem forwarding
const renderMachineCards = (...args) => window.renderMachineCards?.(...args);

// listenerManager — instância gerenciada pelo script.js (lazy para garantir disponibilidade)
const listenerManager = {
    subscribe: (...args) => window.listenerManager?.subscribe?.(...args),
    unsubscribe: (...args) => window.listenerManager?.unsubscribe?.(...args)
};

// --- DOM element references (re-queried, not closure-shared) ---
const planningTableBody = document.getElementById('planning-table-body');
const planningMachineSelect = document.getElementById('planning-machine');
const planningMpInput = document.getElementById('planning-mp');
const leaderLaunchPanel = document.getElementById('leader-launch-panel');
const leaderModal = document.getElementById('leader-entry-modal');
const leaderModalForm = document.getElementById('leader-entry-form');
const leaderModalTitle = document.getElementById('leader-modal-title');
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

// --- machineCardProductionCache (shared via window) ---
const machineCardProductionCache = (() => {
    if (!window.machineCardProductionCache) window.machineCardProductionCache = new Map();
    return window.machineCardProductionCache;
})();

// --- Extracted Planning & Orders Region 2 Functions ---

    function setupPlanningTab() {
        if (!planningMachineSelect) return;
        
        const machineOptions = window.machineDatabase.map(m => {
            const mid = normalizeMachineId(m.id);
            return `<option value="${mid}">${mid} - ${m.model}</option>`;
        }).join('');
        planningMachineSelect.innerHTML = `<option value="">Selecione...</option>${machineOptions}`;

        // Configurar select de código do produto
        const productCodInput = document.getElementById('planning-product-cod');
        const productCodDatalist = document.getElementById('planning-product-cod-list');
        if (productCodInput && productCodDatalist) {
            const prodDatabase = (window.databaseModule && window.databaseModule.productDatabase) 
                ? window.databaseModule.productDatabase 
                : (typeof window.productDatabase !== 'undefined' ? window.productDatabase : []);
            const sortedProducts = [...prodDatabase].sort((a, b) => a.cod - b.cod);
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
            const sortedProducts = [...window.productDatabase].sort((a, b) => a.cod - b.cod);
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

        initOrdersFilters();
        listenToProductionOrders();
    }

    function populatePlanningOrderSelect() {
        // Função mantida para compatibilidade - agora a busca usa o cache productionOrdersCache
        // Não é mais necessário popular um select com options
        if (!Array.isArray(productionOrdersCache)) return;
        
        console.log(`[Planejamento] Cache atualizado com ${productionOrdersCache.length} OPs`);
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

        // Usar função helper com fallback seguro
        const product = getProductByCode(rawCode);

        if (product) {
            fillProductionOrderFields(product);
            const clientLabel = product.client ? ` – ${product.client}` : '';
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

    // escapeHtml: removido - importado de dom.utils.js
    // normalizeNumericString, parseOptionalNumber, coerceToNumber: removidos - importados de number.utils.js
    // getProductionOrderStatusBadge: removido - importado de plan.utils.js

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

    function populateOrdersFilterMachine() {
        if (!ordersFilterMachine) return;

        const machineSet = new Set();
        if (Array.isArray(productionOrdersCache)) {
            productionOrdersCache.forEach(order => {
                const machineId = (order.machine_id || order.machine || '').trim();
                if (machineId) machineSet.add(machineId);
            });
        }

        const currentValue = ordersFilterMachine.value;
        ordersFilterMachine.innerHTML = '<option value="">Todas as máquinas</option>';

        Array.from(machineSet).sort().forEach(machineId => {
            const option = document.createElement('option');
            option.value = machineId;
            option.textContent = machineId;
            ordersFilterMachine.appendChild(option);
        });

        if (currentValue && Array.from(ordersFilterMachine.options).some(opt => opt.value === currentValue)) {
            ordersFilterMachine.value = currentValue;
        }
    }

    function applyOrdersFilters() {
        if (!Array.isArray(productionOrdersCache)) {
            renderProductionOrdersTable([]);
            return;
        }

        const machineFilter = (ordersFilterMachine?.value || '').trim();
        const statusFilter = (ordersFilterStatus?.value || '').trim();
        const searchFilter = (ordersFilterSearch?.value || '').trim().toLowerCase();

        let result = [...productionOrdersCache];

        if (machineFilter) {
            result = result.filter(order => {
                const machineId = (order.machine_id || order.machine || '').trim();
                return machineId === machineFilter;
            });
        }

        if (statusFilter) {
            result = result.filter(order => (order.status || '').trim() === statusFilter);
        }

        if (searchFilter) {
            result = result.filter(order => {
                const parts = [
                    order.order_number || order.orderNumber || '',
                    order.product || order.product_name || '',
                    order.customer || order.client || '',
                    order.part_code || order.product_cod || ''
                ];
                return parts.some(p => String(p).toLowerCase().includes(searchFilter));
            });
        }

        filteredProductionOrders = result;
        populateOrdersFilterMachine();
        renderProductionOrdersTable(filteredProductionOrders);
    }

    function initOrdersFilters() {
        if (!ordersFilterMachine && !ordersFilterStatus && !ordersFilterSearch) return;

        if (ordersFilterMachine) {
            ordersFilterMachine.addEventListener('change', () => {
                applyOrdersFilters();
            });
        }

        if (ordersFilterStatus) {
            ordersFilterStatus.addEventListener('change', () => {
                applyOrdersFilters();
            });
        }

        if (ordersFilterSearch) {
            let searchTimeout;
            ordersFilterSearch.addEventListener('input', () => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    applyOrdersFilters();
                }, 250);
            });
        }

        applyOrdersFilters();
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

        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    function handleEditProductionOrder(e) {
        // ⚠️ VERIFICAÇÃO DE PERMISSÃO: Apenas gestores podem editar ordens
        if (!isUserGestorOrAdmin()) {
            showPermissionDeniedNotification('editar ordens de produção');
            return;
        }
        
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
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
    }

    async function handleActivateProductionOrder(e) {
        e.preventDefault();
        const orderId = e.currentTarget.dataset.orderId;
        const order = productionOrdersCache.find(o => o.id === orderId);
        let machineId = e.currentTarget.dataset.machineId || order?.machine_id || window.selectedMachineData?.machine || '';

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
                
                // Registrar log
                registrarLogSistema('ATIVAÇÃO DE ORDEM', 'ordem', {
                    orderId: orderId,
                    orderNumber: order.order_number || order.codigoOP,
                    machine: machineId
                });
                
                // Atualizar listas e painel
                if (typeof loadProductionOrders === 'function') {
                    await loadProductionOrders();
                }
                await populateMachineSelector();
                if (window.selectedMachineData?.machine) {
                    await onMachineSelected(window.selectedMachineData.machine);
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
                
                // Registrar log
                registrarLogSistema('FINALIZAÇÃO DE ORDEM', 'ordem', {
                    orderId: orderId,
                    codigoOP: order.codigoOP || order.opNumber,
                    produto: order.produto || order.productName
                });
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
        
        // ⚠️ VERIFICAÇÃO DE PERMISSÃO: Apenas gestores podem excluir ordens
        if (!isUserGestorOrAdmin()) {
            showPermissionDeniedNotification('excluir ordens de produção');
            return;
        }
        
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
            await getDb().collection('production_orders').doc(orderId).delete();
            setProductionOrderStatus('Ordem excluída com sucesso!', 'success');
            setTimeout(() => setProductionOrderStatus('', 'info'), 2000);
            
            // Registrar log
            registrarLogSistema('EXCLUSÃO DE ORDEM', 'ordem', {
                orderId: orderId,
                orderNumber: order.order_number,
                produto: order.produto || order.productName
            });
        } catch (error) {
            console.error('Erro ao excluir ordem:', error);
            setProductionOrderStatus('Erro ao excluir ordem. Tente novamente.', 'error');
        }
    }

    // =========================================================================
    // AJUSTE DE QUANTIDADE EXECUTADA DO PLANEJAMENTO
    // =========================================================================
    
    function openAdjustExecutedModal() {
        if (!window.selectedMachineData) {
            alert('Selecione uma máquina primeiro.');
            return;
        }

        // Verificar permissão
        if (!window.authSystem?.checkPermissionForAction('adjust_executed')) {
            showPermissionDeniedNotification('ajustar quantidade executada');
            return;
        }

        const modal = document.getElementById('adjust-executed-modal');
        if (!modal) return;

        const machineSpan = document.getElementById('adjust-exec-machine');
        const productSpan = document.getElementById('adjust-exec-product');
        const plannedSpan = document.getElementById('adjust-exec-planned');
        const currentSpan = document.getElementById('adjust-exec-current');
        const newQtyInput = document.getElementById('adjust-exec-new-qty');
        const diffDiv = document.getElementById('adjust-exec-diff');
        const reasonSelect = document.getElementById('adjust-exec-reason');
        const obsInput = document.getElementById('adjust-exec-obs');
        const statusDiv = document.getElementById('adjust-executed-status');

        // Calcular quantidade atual baseado nos entries (fonte única de verdade)
        const planId = window.selectedMachineData.id;
        const currentExecuted = Math.round(coerceToNumber(window.selectedMachineData.totalProduced, 0));
        // CORREÇÃO: Usar planned_quantity (meta diária) primeiro, não lot_size (tamanho total OP)
        const plannedQty = Math.round(coerceToNumber(
            window.selectedMachineData.planned_quantity ?? window.selectedMachineData.planned_qty ?? window.selectedMachineData.meta, 0
        ));

        // Preencher informações
        if (machineSpan) machineSpan.textContent = window.selectedMachineData.machine || '-';
        if (productSpan) productSpan.textContent = window.selectedMachineData.product || '-';
        if (plannedSpan) plannedSpan.textContent = plannedQty.toLocaleString('pt-BR');
        if (currentSpan) currentSpan.textContent = currentExecuted.toLocaleString('pt-BR');
        
        // Limpar campos
        if (newQtyInput) {
            newQtyInput.value = currentExecuted;
            newQtyInput.dataset.currentQty = currentExecuted.toString();
            newQtyInput.dataset.planId = planId;
        }
        if (diffDiv) diffDiv.textContent = '';
        if (reasonSelect) reasonSelect.value = '';
        if (obsInput) obsInput.value = '';
        if (statusDiv) statusDiv.textContent = '';

        // Listener para mostrar diferença em tempo real
        if (newQtyInput) {
            newQtyInput.removeEventListener('input', updateAdjustExecutedDiff);
            newQtyInput.addEventListener('input', updateAdjustExecutedDiff);
        }

        modal.classList.remove('hidden');
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    function updateAdjustExecutedDiff() {
        const newQtyInput = document.getElementById('adjust-exec-new-qty');
        const diffDiv = document.getElementById('adjust-exec-diff');
        
        if (!newQtyInput || !diffDiv) return;

        const currentQty = parseInt(newQtyInput.dataset.currentQty || '0');
        const newQty = parseInt(newQtyInput.value || '0');
        const diff = newQty - currentQty;

        if (diff === 0) {
            diffDiv.textContent = 'Sem alteração';
            diffDiv.className = 'mt-1 text-xs text-gray-500';
        } else if (diff > 0) {
            diffDiv.textContent = `+${diff.toLocaleString('pt-BR')} peças (aumento)`;
            diffDiv.className = 'mt-1 text-xs text-green-600 font-medium';
        } else {
            diffDiv.textContent = `${diff.toLocaleString('pt-BR')} peças (redução)`;
            diffDiv.className = 'mt-1 text-xs text-orange-600 font-medium';
        }
    }

    function closeAdjustExecutedModal() {
        const modal = document.getElementById('adjust-executed-modal');
        if (modal) modal.classList.add('hidden');
    }

    async function handleAdjustExecutedSubmit(e) {
        e.preventDefault();

        const newQtyInput = document.getElementById('adjust-exec-new-qty');
        const reasonSelect = document.getElementById('adjust-exec-reason');
        const obsInput = document.getElementById('adjust-exec-obs');
        const statusDiv = document.getElementById('adjust-executed-status');
        const submitBtn = document.getElementById('adjust-executed-save');

        const planId = newQtyInput?.dataset.planId;
        const currentQty = parseInt(newQtyInput?.dataset.currentQty || '0');
        const newQty = parseInt(newQtyInput?.value || '0');
        const reason = reasonSelect?.value;
        const observations = obsInput?.value?.trim() || '';

        if (!planId) {
            alert('Erro interno: planejamento não identificado.');
            return;
        }

        if (newQty < 0) {
            alert('A quantidade executada não pode ser negativa.');
            return;
        }

        if (!reason) {
            alert('Por favor, selecione o motivo do ajuste.');
            return;
        }

        const diff = newQty - currentQty;
        if (diff === 0) {
            alert('A quantidade informada é igual à atual. Nenhuma alteração necessária.');
            return;
        }

        // Confirmar alteração
        const confirmMsg = diff > 0
            ? `Confirma o AUMENTO de ${diff.toLocaleString('pt-BR')} peças?\n\nDe: ${currentQty.toLocaleString('pt-BR')}\nPara: ${newQty.toLocaleString('pt-BR')}`
            : `Confirma a REDUÇÃO de ${Math.abs(diff).toLocaleString('pt-BR')} peças?\n\nDe: ${currentQty.toLocaleString('pt-BR')}\nPara: ${newQty.toLocaleString('pt-BR')}`;
        
        if (!confirm(confirmMsg)) return;

        try {
            if (submitBtn) submitBtn.disabled = true;
            if (statusDiv) {
                statusDiv.textContent = 'Processando ajuste...';
                statusDiv.className = 'text-sm font-semibold h-5 text-center mt-2 text-blue-600';
            }

            const currentUser = getActiveUser();
            const now = new Date();

            // Criar registro de ajuste como entry especial
            const adjustmentEntry = {
                type: 'adjustment',
                planId: planId,
                machine: window.selectedMachineData.machine,
                product: window.selectedMachineData.product || '',
                product_cod: window.selectedMachineData.product_cod || '',
                previousQuantity: currentQty,
                newQuantity: newQty,
                adjustmentQty: diff,
                reason: reason,
                observations: observations,
                turno: getCurrentShift(),
                data: now.toISOString().split('T')[0],
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                adjustedBy: currentUser?.username || 'desconhecido',
                adjustedByName: currentUser?.name || 'Desconhecido',
                isManualAdjustment: true
            };

            // Salvar registro do ajuste na collection de entries
            await getDb().collection('production_entries').add(adjustmentEntry);

            // Atualizar o planejamento com a nova quantidade
            await getDb().collection('planning').doc(planId).update({
                total_produzido: newQty,
                totalProduced: newQty,
                lastManualAdjustment: {
                    previousValue: currentQty,
                    newValue: newQty,
                    diff: diff,
                    reason: reason,
                    observations: observations,
                    adjustedBy: currentUser?.username || 'desconhecido',
                    adjustedByName: currentUser?.name || 'Desconhecido',
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                },
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            console.log(`[AUDIT] ${currentUser?.name || 'Desconhecido'} ajustou quantidade executada do planejamento ${planId}: ${currentQty} → ${newQty} (${diff > 0 ? '+' : ''}${diff}) - Motivo: ${reason}`);

            // Registrar log do ajuste
            registrarLogSistema('AJUSTE DE QUANTIDADE EXECUTADA', 'planejamento', {
                planId: planId,
                machine: window.selectedMachineData?.machine,
                previousQty: currentQty,
                newQty: newQty,
                diff: diff,
                motivo: reason,
                observacoes: observations
            });

            if (statusDiv) {
                statusDiv.textContent = 'Ajuste aplicado com sucesso!';
                statusDiv.className = 'text-sm font-semibold h-5 text-center mt-2 text-green-600';
            }

            showNotification(`Quantidade ajustada: ${currentQty.toLocaleString('pt-BR')} → ${newQty.toLocaleString('pt-BR')}`, 'success');

            // Fechar modal após 1.5 segundos
            setTimeout(() => {
                closeAdjustExecutedModal();
                // Forçar atualização do dashboard
                if (typeof updateDashboard === 'function') {
                    updateDashboard();
                }
            }, 1500);

        } catch (error) {
            console.error('Erro ao ajustar quantidade executada:', error);
            if (statusDiv) {
                statusDiv.textContent = 'Erro ao aplicar ajuste. Tente novamente.';
                statusDiv.className = 'text-sm font-semibold h-5 text-center mt-2 text-red-600';
            }
            showNotification('Erro ao aplicar ajuste', 'error');
        } finally {
            if (submitBtn) submitBtn.disabled = false;
        }
    }

    // Inicializar listeners do modal de ajuste de quantidade executada
    function initAdjustExecutedModal() {
        const closeBtn = document.getElementById('adjust-executed-close');
        const cancelBtn = document.getElementById('adjust-executed-cancel');
        const form = document.getElementById('adjust-executed-form');

        if (closeBtn) closeBtn.addEventListener('click', closeAdjustExecutedModal);
        if (cancelBtn) cancelBtn.addEventListener('click', closeAdjustExecutedModal);
        if (form) form.addEventListener('submit', handleAdjustExecutedSubmit);
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
            await getDb().collection('quantity_adjustments').add(adjustmentRecordForCollection);

            // Atualizar a quantidade do lote (lot_size) da OP
            const currentOrder = await getDb().collection('production_orders').doc(orderId).get();
            const orderData = currentOrder.data();
            const currentAdjustments = orderData.quantity_adjustments || [];
            
            await getDb().collection('production_orders').doc(orderId).update({
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
            
            // Após ajuste de quantidade, garantir que os cards de máquina e o painel de lançamento
            // reflitam o novo tamanho de lote da OP
            listenToProductionOrders();
            await populateMachineSelector();

            if (window.selectedMachineData && window.selectedMachineData.machine) {
                const machine = window.selectedMachineData.machine;
                // machineCardData agora é array - pegar primeiro plano para compatibilidade
                const machineDataArray = machineCardData[machine];
                const updatedMachineData = Array.isArray(machineDataArray) ? machineDataArray[0] : (machineDataArray || machineSelector?.machineData?.[machine]);
                if (updatedMachineData) {
                    window.selectedMachineData = updatedMachineData;
                    updateMachineInfo();
                }
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
            if (!machineId) return null;

            const snapshot = await getDb().collection('production_orders')
                .where('machine_id', '==', machineId)
                .where('status', '==', 'ativa')
                .limit(1)
                .get();

            if (snapshot.empty) return null;

            const doc = snapshot.docs[0];
            const data = doc.data();

            return { id: doc.id, ...data };
        } catch (error) {
            console.error('Erro ao verificar OP ativa na máquina:', error);
            return null;
        }
    }

    // Sincronizar window.selectedMachineData com a OP ativa antes de atualizar o card
    async function syncSelectedMachineWithActiveOrder() {
        try {
            if (!window.selectedMachineData || !window.selectedMachineData.machine) return;

            const activeOrder = await checkActiveOrderOnMachine(window.selectedMachineData.machine);
            if (!activeOrder) {
                return;
            }
            // Carregar lançamentos desta OP para aplicar a mesma regra da análise
            const productionSnapshot = await getDb().collection('production_entries')
                .where('orderId', '==', activeOrder.id)
                .get();

            const productionTotalsByOrderId = new Map();
            let aggregate = 0;
            productionSnapshot.docs.forEach(doc => {
                const data = doc.data();
                const producedQty = coerceToNumber(data.produzido ?? data.quantity, 0);
                if (Number.isFinite(producedQty) && producedQty > 0) {
                    aggregate += producedQty;
                }
            });
            productionTotalsByOrderId.set(activeOrder.id, aggregate);

            const metrics = computeOrderExecutionMetrics(activeOrder, productionTotalsByOrderId);

            window.selectedMachineData = {
                ...window.selectedMachineData,
                order_id: activeOrder.id || activeOrder.order_id || window.selectedMachineData.order_id,
                orderId: activeOrder.id || activeOrder.orderId || window.selectedMachineData.orderId,
                order_lot_size: metrics.lotSize,
                lot_size: metrics.lotSize,
                total_produzido: metrics.totalProduced,
                totalProduced: metrics.totalProduced
            };

            console.log('[SYNC-ORDER] window.selectedMachineData sincronizado com OP ativa', {
                machine: window.selectedMachineData.machine,
                order_id: window.selectedMachineData.order_id,
                lot_size: window.selectedMachineData.order_lot_size,
                total_produzido: window.selectedMachineData.total_produzido
            });
        } catch (error) {
            console.error('Erro ao sincronizar máquina com OP ativa:', error);
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
                await getDb().collection('production_orders').doc(activeOrder.id).update({
                    status: 'concluida',
                    finishedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    finishedBy: getActiveUser()?.name || 'Sistema'
                });
            }
            
            // Ativar nova OP
            await getDb().collection('production_orders').doc(orderId).update({
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
            
            await getDb().collection('production_orders').doc(orderId).update({
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

    /**
     * Verifica e restaura paradas ativas do Firebase
     * Chamada ao selecionar uma máquina ou ao recarregar a página
     */
    async function checkActiveDowntimes() {
        if (!getDb() || !window.selectedMachineData) {
            console.log('[DOWNTIME][CHECK] Nenhuma máquina selecionada ou DB indisponível');
            return;
        }
        
        try {
            const activeDowntimeDoc = await getDb().collection('active_downtimes').doc(window.selectedMachineData.machine).get();
            
            if (activeDowntimeDoc.exists) {
                const activeDowntime = activeDowntimeDoc.data();
                console.log('[DOWNTIME][CHECK] Parada ativa encontrada:', activeDowntime);
                
                // Validar dados mínimos
                if (!activeDowntime.machine || !activeDowntime.startDate || !activeDowntime.startTime) {
                    console.warn('[DOWNTIME][CHECK] Dados de parada ativa incompletos, removendo...');
                    const normalizedMachineForDelete = normalizeMachineId(window.selectedMachineData.machine);
                    await getDb().collection('active_downtimes').doc(normalizedMachineForDelete).delete();
                    if (typeof invalidateDowntimeCache === 'function') invalidateDowntimeCache(normalizedMachineForDelete);
                    return;
                }
                
                // Reconstruir timestamp de início
                let startTimestamp;
                if (activeDowntime.startTimestamp?.toDate) {
                    startTimestamp = activeDowntime.startTimestamp.toDate();
                } else if (activeDowntime.startTimestampLocal) {
                    startTimestamp = new Date(activeDowntime.startTimestampLocal);
                } else {
                    // Fallback: reconstruir a partir de date + time
                    startTimestamp = parseDateTime(activeDowntime.startDate, activeDowntime.startTime);
                }
                
                if (!startTimestamp || isNaN(startTimestamp.getTime())) {
                    console.warn('[DOWNTIME][CHECK] Timestamp de início inválido, removendo parada...');
                    const normalizedMachineForDelete = normalizeMachineId(window.selectedMachineData.machine);
                    await getDb().collection('active_downtimes').doc(normalizedMachineForDelete).delete();
                    if (typeof invalidateDowntimeCache === 'function') invalidateDowntimeCache(normalizedMachineForDelete);
                    return;
                }
                
                // Verificar se a parada é muito antiga (mais de 7 dias)
                const now = new Date();
                const elapsedMs = now.getTime() - startTimestamp.getTime();
                const elapsedDays = elapsedMs / (1000 * 60 * 60 * 24);
                
                if (elapsedDays > 7) {
                    console.warn(`[DOWNTIME][CHECK] Parada muito antiga (${elapsedDays.toFixed(1)} dias), requer atenção especial`);
                    // Mostrar alerta para o usuário
                    const confirmar = confirm(
                        `⚠️ Parada Muito Longa Detectada!\n\n` +
                        `Máquina: ${activeDowntime.machine}\n` +
                        `Iniciada em: ${activeDowntime.startDate} às ${activeDowntime.startTime}\n` +
                        `Duração: ${elapsedDays.toFixed(1)} dias\n\n` +
                        `Deseja restaurar esta parada? Se não, ela será removida.`
                    );
                    
                    if (!confirmar) {
                        const normalizedMachineForDelete = normalizeMachineId(window.selectedMachineData.machine);
                        await getDb().collection('active_downtimes').doc(normalizedMachineForDelete).delete();
                        if (typeof invalidateDowntimeCache === 'function') invalidateDowntimeCache(normalizedMachineForDelete);
                        console.log('[DOWNTIME][CHECK] Parada antiga removida pelo usuário');
                        return;
                    }
                }
                
                // Restaurar estado da parada
                currentDowntimeStart = {
                    machine: activeDowntime.machine,
                    date: activeDowntime.startDate,
                    startTime: activeDowntime.startTime,
                    startTimestamp: startTimestamp,
                    startTimestampLocal: startTimestamp.toISOString(),
                    startShift: activeDowntime.startShift || getShiftForDateTime(startTimestamp),
                    // Motivo e observações
                    reason: activeDowntime.reason || null,
                    observations: activeDowntime.observations || '',
                    // Dados do operador
                    userCod: activeDowntime.userCod ?? null,
                    nomeUsuario: activeDowntime.nomeUsuario || null,
                    // Contexto de produção
                    product: activeDowntime.product || null,
                    productCod: activeDowntime.productCod || null,
                    orderId: activeDowntime.orderId || null,
                    orderNumber: activeDowntime.orderNumber || null
                };
                
                machineStatus = 'stopped';
                updateMachineStatus();
                freezeProductionTimer();
                startDowntimeTimer();
                
                // Calcular tempo decorrido para exibição
                const elapsedHours = (elapsedMs / (1000 * 60 * 60)).toFixed(1);
                const elapsedMinutes = Math.floor((elapsedMs / 60000) % 60);
                
                let durationText;
                if (elapsedDays >= 1) {
                    durationText = `${Math.floor(elapsedDays)}d ${Math.floor((elapsedMs / 3600000) % 24)}h`;
                } else if (parseFloat(elapsedHours) >= 1) {
                    durationText = `${elapsedHours}h`;
                } else {
                    durationText = `${elapsedMinutes} min`;
                }
                
                showNotification(`⏱️ Parada ativa restaurada! Tempo decorrido: ${durationText}`, 'warning');
                
                console.log('[DOWNTIME][CHECK] Estado da parada restaurado:', {
                    machine: activeDowntime.machine,
                    duration: durationText,
                    startedAt: activeDowntime.startDate + ' ' + activeDowntime.startTime
                });
            } else {
                console.log('[DOWNTIME][CHECK] Nenhuma parada ativa para:', window.selectedMachineData.machine);
            }
        } catch (error) {
            console.error('[DOWNTIME][CHECK] Erro ao verificar paradas ativas:', error);
        }
    }

    function listenToProductionOrders() {
        if (!getDb() || !productionOrderTableBody) return;

        try {
            const query = getDb().collection('production_orders').orderBy('createdAt', 'desc');
            listenerManager.subscribe('productionOrders', query,
                (snapshot) => {
                    productionOrdersCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    
                    // Alimentar DataStore para evitar leituras repetidas
                    if (window.DataStore) {
                        window.DataStore.set('productionOrders', productionOrdersCache);
                    }
                    
                    applyOrdersFilters();
                    populatePlanningOrderSelect();
                    if (productionOrderStatusMessage && productionOrderStatusMessage.className.includes('text-status-error')) {
                        setProductionOrderStatus('', 'info');
                    }
                },
                (error) => {
                    console.error('Erro ao carregar ordens de produção:', error);
                    renderProductionOrdersTable([]);
                    setProductionOrderStatus('Não foi possível carregar as ordens de produção.', 'error');
                }
            );
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
        // Usar função helper com fallback seguro
        const matchedProduct = partCode ? getProductByCode(partCode) : null;

        const submitButton = productionOrderForm.querySelector('button[type="submit"]');
        const originalButtonContent = submitButton ? submitButton.innerHTML : '';

        try {
            if (submitButton) {
                submitButton.disabled = true;
                submitButton.innerHTML = `<i data-lucide="loader-2" class="animate-spin"></i><span>Salvando...</span>`;
                if (typeof lucide !== 'undefined') lucide.createIcons();
            }

            setProductionOrderStatus('Salvando ordem de produção...', 'info');

            // CORREÇÃO: Validação de ordem duplicada considera agora apenas ordens ATIVAS
            // Uma ordem pode ser reutilizada em datas diferentes ou após finalização
            const existingSnapshot = await getDb().collection('production_orders')
                .where('order_number', '==', normalizedOrderNumber)
                .where('status', 'in', ['planejada', 'ativa', 'em_andamento'])  // Apenas ordens ativas
                .limit(1)
                .get();

            const editingOrderId = productionOrderForm.dataset.editingOrderId;

            if (!existingSnapshot.empty && !editingOrderId) {
                setProductionOrderStatus('Já existe uma ordem ATIVA com este número. Finalize-a ou use outro número.', 'error');
                return;
            }

            // Se estamos editando, validar se outro documento já tem esse número
            if (editingOrderId && !existingSnapshot.empty && existingSnapshot.docs[0].id !== editingOrderId) {
                setProductionOrderStatus('Já existe uma ordem ATIVA com este número.', 'error');
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
                await getDb().collection('production_orders').doc(editingOrderId).update(docData);
                setProductionOrderStatus('Ordem atualizada com sucesso!', 'success');
                
                // Registrar log de edição
                registrarLogSistema('EDIÇÃO DE ORDEM DE PRODUÇÃO', 'ordem', {
                    orderId: editingOrderId,
                    orderNumber: normalizedOrderNumber,
                    product: docData.product,
                    lotSize: docData.lot_size
                });
            } else {
                const docRef = await getDb().collection('production_orders').add(docData);
                setProductionOrderStatus('Ordem cadastrada com sucesso!', 'success');
                
                // Registrar log de criação
                registrarLogSistema('CRIAÇÃO DE ORDEM DE PRODUÇÃO', 'ordem', {
                    orderId: docRef.id,
                    orderNumber: normalizedOrderNumber,
                    product: docData.product,
                    lotSize: docData.lot_size
                });
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
                if (typeof lucide !== 'undefined') lucide.createIcons();
            }
        }
    }

    function onPlanningProductCodChange(e) {
        const input = e?.target;
        if (!input) return;

        const rawCode = (input.value || '').trim();
        // Usar função helper com fallback seguro
        const product = getProductByCode(rawCode);

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
        const productionOrderId = (data.production_order_id || '').trim();
        
        // Validar data - usar data do input ou data atual
        if (!data.date) {
            const dateInput = document.getElementById('planning-date-selector');
            if (dateInput && dateInput.value) {
                data.date = dateInput.value;
            } else {
                // Fallback para data atual
                const hoje = new Date();
                data.date = hoje.getFullYear() + '-' + 
                           String(hoje.getMonth() + 1).padStart(2, '0') + '-' + 
                           String(hoje.getDate()).padStart(2, '0');
            }
        }
        
        // Validar máquina
        if (!data.machine) {
            alert('Por favor, selecione uma máquina!');
            return;
        }
        
        // Buscar dados completos do produto selecionado
        const productCod = data.product_cod;
        // Usar função helper com fallback seguro
        const product = getProductByCode(productCod);
        
        if (!product) {
            alert('Produto não encontrado!');
            return;
        }

        const statusMessage = document.getElementById('planning-status-message');
        const submitButton = document.getElementById('planning-submit-button');
        
        if (!submitButton) return;
        
        submitButton.disabled = true;
        submitButton.innerHTML = `<i data-lucide="loader-2" class="animate-spin"></i><span>A Adicionar...</span>`;
        if (typeof lucide !== 'undefined') lucide.createIcons();
        
        try {
            let linkedOrder = null;
            if (productionOrderId) {
                linkedOrder = Array.isArray(productionOrdersCache)
                    ? productionOrdersCache.find(order => order && order.id === productionOrderId)
                    : null;

                if (!linkedOrder) {
                    try {
                        const orderDoc = await getDb().collection('production_orders').doc(productionOrderId).get();
                        if (orderDoc.exists) {
                            linkedOrder = { id: orderDoc.id, ...orderDoc.data() };
                        }
                    } catch (orderError) {
                        console.warn('Falha ao carregar dados da OP vinculada:', orderError);
                    }
                }
            }

            const snapshot = linkedOrder?.product_snapshot || {};
            const resolvedProductName = linkedOrder?.product || product.name;
            const resolvedClient = linkedOrder?.customer || linkedOrder?.client || product.client || '';
            const resolvedMp = (data.mp || linkedOrder?.raw_material || snapshot.mp || product.mp || '').trim();
            const resolvedCycle = parseFloat(data.budgeted_cycle) || Number(product.cycle) || Number(snapshot.cycle) || 0;
            const resolvedCavities = parseFloat(data.mold_cavities) || Number(product.cavities) || Number(snapshot.cavities) || 0;
            
            // Converter peso da peça usando parser específico para peças (não converte kg->g)
            let resolvedWeight = 0;
            if (data.piece_weight) {
                resolvedWeight = parsePieceWeightInput(data.piece_weight);
                console.log('[PLANNING] piece_weight from input:', { raw: data.piece_weight, converted: resolvedWeight });
            }
            // Se não tiver peso, usar fallback do produto/snapshot
            if (!resolvedWeight && (snapshot.weight || product.weight)) {
                resolvedWeight = parsePieceWeightInput(snapshot.weight || product.weight);
                console.log('[PLANNING] piece_weight from fallback:', { snapshot: snapshot.weight, product: product.weight, resolved: resolvedWeight });
            }
            const resolvedQuantidadeEmbalagem = parseFloat(data.quantidade_da_embalagem) || null;
            const resolvedPlannedQuantity = (() => {
                const parsed = parseInt(data.planned_quantity, 10);
                return Number.isFinite(parsed) ? parsed : 0;
            })();

            product.mp = resolvedMp;

            const docData = {
                date: data.date,
                machine: data.machine,
                production_order_id: productionOrderId || null,
                product_cod: product.cod,
                client: resolvedClient,
                product: resolvedProductName,
                budgeted_cycle: resolvedCycle || null,
                mold_cavities: resolvedCavities || null,
                piece_weight: resolvedWeight || null,
                piece_weight_grams: resolvedWeight || null,
                quantidade_da_embalagem: resolvedQuantidadeEmbalagem,
                planned_quantity: resolvedPlannedQuantity,
                mp: resolvedMp,
                mp_type: data.mp_type || linkedOrder?.mp_type || '',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                // ✅ DISTRIBUIÇÃO POR TURNO (Opção 3 - Híbrido)
                shift_distribution: {
                    t1: {
                        planned_qty: parseInt(data.planned_qty_t1) || 0,
                        cycle: parseFloat(data.cycle_t1) || resolvedCycle || null,
                        cavities: parseInt(data.cavities_t1) || resolvedCavities || null,
                        customized: shiftDistributionData?.t1?.customized || false
                    },
                    t2: {
                        planned_qty: parseInt(data.planned_qty_t2) || 0,
                        cycle: parseFloat(data.cycle_t2) || resolvedCycle || null,
                        cavities: parseInt(data.cavities_t2) || resolvedCavities || null,
                        customized: shiftDistributionData?.t2?.customized || false
                    },
                    t3: {
                        planned_qty: parseInt(data.planned_qty_t3) || 0,
                        cycle: parseFloat(data.cycle_t3) || resolvedCycle || null,
                        cavities: parseInt(data.cavities_t3) || resolvedCavities || null,
                        customized: shiftDistributionData?.t3?.customized || false
                    }
                }
            };
            console.log('[PLANNING] docData to be saved:', { piece_weight: docData.piece_weight, piece_weight_grams: docData.piece_weight_grams, shift_distribution: docData.shift_distribution });

            if (linkedOrder) {
                docData.order_id = linkedOrder.id;
                docData.order_number = linkedOrder.order_number || linkedOrder.order_number_original || linkedOrder.id;
                docData.order_customer = resolvedClient;
                const linkedLotSize = parseOptionalNumber(linkedOrder.lot_size);
                if (typeof linkedLotSize === 'number' && Number.isFinite(linkedLotSize)) {
                    docData.order_lot_size = linkedLotSize;
                }
                const linkedPartCode = linkedOrder.part_code || linkedOrder.product_cod;
                if (linkedPartCode) {
                    docData.order_part_code = String(linkedPartCode);
                }
                // ✅ CORREÇÃO: Herdar total_produzido da ordem para manter consistência com aba Ordens
                const linkedTotalProduzido = parseOptionalNumber(linkedOrder.total_produzido);
                if (typeof linkedTotalProduzido === 'number' && linkedTotalProduzido > 0) {
                    docData.total_produzido = linkedTotalProduzido;
                    console.log('[PLANNING] Herdando total_produzido da ordem:', linkedTotalProduzido);
                }
            }
            
            // ✅ POKA-YOKE: Verificar se já existe planejamento ATIVO com mesma OP na mesma máquina e data
            // CORREÇÃO: Excluir planejamentos finalizados/cancelados da verificação
            if (docData.order_number) {
                const duplicateCheck = await getDb().collection('planning')
                    .where('date', '==', docData.date)
                    .where('machine', '==', docData.machine)
                    .where('order_number', '==', docData.order_number)
                    .get();
                
                // Filtrar apenas planejamentos ATIVOS (não finalizados/cancelados)
                const activeduplicates = duplicateCheck.docs.filter(doc => {
                    const planData = doc.data();
                    const status = (planData.status || '').toLowerCase();
                    // Se status não existe ou está vazio, considerar como ativo
                    // Se status é 'concluida', 'finalizada', 'cancelada', ignorar
                    return !['concluida', 'concluída', 'finalizada', 'cancelada', 'cancelado'].includes(status);
                });
                
                console.log('[PLANNING-DEBUG] Verificação de duplicata OP:', {
                    order_number: docData.order_number,
                    date: docData.date,
                    machine: docData.machine,
                    total_encontrados: duplicateCheck.docs.length,
                    ativos_encontrados: activeduplicates.length,
                    docs: duplicateCheck.docs.map(d => ({ id: d.id, status: d.data().status, product: d.data().product }))
                });
                
                if (activeduplicates.length > 0) {
                    const existingPlan = activeduplicates[0].data();
                    alert(`⚠️ DUPLICATA DETECTADA!\n\nJá existe um planejamento ATIVO para a OP ${docData.order_number} na máquina ${docData.machine} nesta data.\n\nProduto existente: ${existingPlan.product || '-'}\nStatus: ${existingPlan.status || 'ativo'}\n\nSe deseja adicionar outro produto do mesmo molde, use uma OP diferente.`);
                    submitButton.disabled = false;
                    submitButton.innerHTML = `<i data-lucide="plus"></i><span>Adicionar</span>`;
                    if (typeof lucide !== 'undefined') lucide.createIcons();
                    return;
                }
            }
            
            // Verificar também por product_cod na mesma máquina/data (mesmo produto sem OP)
            // CORREÇÃO: Excluir planejamentos finalizados/cancelados
            if (docData.product_cod) {
                const productDuplicateCheck = await getDb().collection('planning')
                    .where('date', '==', docData.date)
                    .where('machine', '==', docData.machine)
                    .where('product_cod', '==', docData.product_cod)
                    .get();
                
                // Filtrar apenas planejamentos ATIVOS
                const activeProductDuplicates = productDuplicateCheck.docs.filter(doc => {
                    const planData = doc.data();
                    const status = (planData.status || '').toLowerCase();
                    return !['concluida', 'concluída', 'finalizada', 'cancelada', 'cancelado'].includes(status);
                });
                
                console.log('[PLANNING-DEBUG] Verificação de duplicata Produto:', {
                    product_cod: docData.product_cod,
                    date: docData.date,
                    machine: docData.machine,
                    total_encontrados: productDuplicateCheck.docs.length,
                    ativos_encontrados: activeProductDuplicates.length,
                    docs: productDuplicateCheck.docs.map(d => ({ id: d.id, status: d.data().status, order_number: d.data().order_number }))
                });
                
                if (activeProductDuplicates.length > 0) {
                    const existingPlan = activeProductDuplicates[0].data();
                    const confirmAdd = confirm(`⚠️ ATENÇÃO: Produto possivelmente duplicado!\n\nJá existe um planejamento ATIVO para o produto ${docData.product_cod} na máquina ${docData.machine} nesta data.\n\nOP existente: ${existingPlan.order_number || 'Sem OP'}\nOP atual: ${docData.order_number || 'Sem OP'}\nStatus: ${existingPlan.status || 'ativo'}\n\nDeseja adicionar mesmo assim?`);
                    if (!confirmAdd) {
                        submitButton.disabled = false;
                        submitButton.innerHTML = `<i data-lucide="plus"></i><span>Adicionar</span>`;
                        if (typeof lucide !== 'undefined') lucide.createIcons();
                        return;
                    }
                }
            }
            
            await getDb().collection('planning').add(docData);
            
            // Registrar log
            registrarLogSistema('CRIAÇÃO DE PLANEJAMENTO', 'planejamento', {
                machine: data.machine,
                date: data.date,
                product: resolvedProductName,
                productCod: product.cod,
                plannedQuantity: resolvedPlannedQuantity,
                orderNumber: linkedOrder?.order_number || null
            });
            
            if (statusMessage) {
                statusMessage.textContent = 'Item adicionado com sucesso!';
                statusMessage.className = 'text-status-success text-sm font-semibold h-5 text-center';
            }
            form.reset();
            
            // Limpar campos com verificação de existência
            const budgetedCycleEl = document.getElementById('budgeted-cycle');
            const moldCavitiesEl = document.getElementById('mold-cavities');
            const pieceWeightEl = document.getElementById('piece-weight');
            const quantidadeEmbalagemEl = document.getElementById('quantidade-embalagem');
            const plannedQuantityEl = document.getElementById('planned-quantity');
            
            if (budgetedCycleEl) budgetedCycleEl.value = '';
            if (moldCavitiesEl) moldCavitiesEl.value = '';
            if (pieceWeightEl) pieceWeightEl.value = '';
            if (quantidadeEmbalagemEl) quantidadeEmbalagemEl.value = '';
            if (plannedQuantityEl) plannedQuantityEl.value = '';
            if (planningMpInput) planningMpInput.value = '';
            if (planningOrderSelect) {
                planningOrderSelect.value = '';
                planningOrderSelect.dispatchEvent(new Event('change', { bubbles: true }));
            }
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
            
            // Ocultar e limpar seção de distribuição por turno
            hideShiftDistribution();
        } catch (error) {
            console.error("Erro ao adicionar planejamento: ", error);
            if (statusMessage) {
                statusMessage.textContent = 'Erro ao adicionar. Tente novamente.';
                statusMessage.className = 'text-status-error text-sm font-semibold h-5 text-center';
            }
        } finally {
            submitButton.disabled = false;
            submitButton.innerHTML = `<i data-lucide="plus-circle"></i><span>Adicionar ao Plano</span>`;
            if (typeof lucide !== 'undefined') lucide.createIcons();
            if (statusMessage) {
                setTimeout(() => statusMessage.textContent = '', 3000);
            }
        }
    }

    // Função para atualizar KPIs do Planejamento
    function updatePlanningKPIs(planningItems, combinedData) {
        const kpiItems = document.getElementById('planning-kpi-items');
        const kpiMachines = document.getElementById('planning-kpi-machines');
        const kpiProduced = document.getElementById('planning-kpi-produced');
        const kpiProducts = document.getElementById('planning-kpi-products');
        
        if (!kpiItems || !kpiMachines || !kpiProduced || !kpiProducts) return;
        
        // Total de itens planejados
        const totalItems = planningItems?.length || 0;
        kpiItems.textContent = totalItems.toLocaleString('pt-BR');
        
        // Máquinas únicas ativas
        const uniqueMachines = new Set((planningItems || []).map(p => p.machine).filter(Boolean));
        kpiMachines.textContent = uniqueMachines.size.toLocaleString('pt-BR');
        
        // Produção total do dia
        const totalProduced = (combinedData || []).reduce((sum, item) => {
            // CORREÇÃO: Usar producao_dia para KPIs da tabela de planejamento
            return sum + (Number(item.producao_dia) || Number(item.total_produzido) || 0);
        }, 0);
        kpiProduced.textContent = totalProduced.toLocaleString('pt-BR');
        
        // Produtos únicos
        const uniqueProducts = new Set((planningItems || []).map(p => p.product_cod || p.product).filter(Boolean));
        kpiProducts.textContent = uniqueProducts.size.toLocaleString('pt-BR');
    }

    // Função para atualizar dados do planejamento (botão refresh)
    window.refreshPlanningData = function() {
        const dateSelector = document.getElementById('planning-date-selector');
        if (dateSelector && dateSelector.value) {
            listenToPlanningChanges(dateSelector.value);
        }
    };

    // Sub-abas do Planejamento: Planejamento de Produção vs Ciclo/Cavidade
    window.switchPlanningSubTab = function(tab) {
        document.querySelectorAll('.planning-subtab-content').forEach(el => el.classList.add('hidden'));
        document.querySelectorAll('.planning-subtab-btn').forEach(btn => {
            btn.classList.remove('bg-indigo-600', 'text-white', 'shadow-md');
            btn.classList.add('bg-white', 'text-gray-600', 'border', 'border-gray-200');
        });
        const target = document.getElementById('planning-subtab-' + tab);
        if (target) target.classList.remove('hidden');
        const activeBtn = document.querySelector(`.planning-subtab-btn[data-planning-subtab="${tab}"]`);
        if (activeBtn) {
            activeBtn.classList.remove('bg-white', 'text-gray-600', 'border', 'border-gray-200');
            activeBtn.classList.add('bg-indigo-600', 'text-white', 'shadow-md');
        }
        if (typeof lucide !== 'undefined') lucide.createIcons();
    };

    // Função para imprimir relatório de planejamento
    window.printPlanningReport = function() {
        window.print();
    };

    // Função para exportar tabela de planejamento para Excel (XLS)
    window.exportPlanningTable = function() {
        const table = document.getElementById('planning-table-body');
        if (!table) {
            alert('Tabela não encontrada!');
            return;
        }
        
        const rows = table.querySelectorAll('tr');
        if (rows.length === 0) {
            alert('Nenhum dado para exportar.');
            return;
        }
        
        const date = document.getElementById('planning-date-selector')?.value || 'export';
        
        // Criar HTML com estilos para Excel
        let html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
        <meta charset="UTF-8">
        <!--[if gte mso 9]>
        <xml>
            <x:ExcelWorkbook>
                <x:ExcelWorksheets>
                    <x:ExcelWorksheet>
                        <x:Name>Controle Ciclo Cavidade</x:Name>
                        <x:WorksheetOptions>
                            <x:DisplayGridlines/>
                        </x:WorksheetOptions>
                    </x:ExcelWorksheet>
                </x:ExcelWorksheets>
            </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        <style>
            table { border-collapse: collapse; width: 100%; }
            th, td { border: 1px solid #333; padding: 6px; text-align: center; }
            th { background-color: #475569; color: white; font-weight: bold; }
            .title { font-size: 16px; font-weight: bold; background-color: #334155; color: white; }
            .header-plan { background-color: #f1f5f9; color: #374151; font-weight: bold; }
            .header-t1 { background-color: #DBEAFE; color: #1D4ED8; font-weight: bold; }
            .header-t2 { background-color: #FEF3C7; color: #B45309; font-weight: bold; }
            .header-t3 { background-color: #F3E8FF; color: #7E22CE; font-weight: bold; }
            .header-total { background-color: #D1FAE5; color: #065F46; font-weight: bold; }
            .text-left { text-align: left; }
            .text-red { color: #dc2626; font-weight: bold; }
            .text-green { color: #16a34a; font-weight: bold; }
            .text-amber { color: #d97706; font-weight: bold; }
            .total-cell { background-color: #ECFDF5; font-weight: bold; }
        </style>
    </head>
    <body>
        <table>
            <tr>
                <td colspan="16" class="title">Controle de Ciclo/Cavidade por Turno | Data: ${date}</td>
            </tr>
            <tr>
                <th rowspan="2">Máq.</th>
                <th rowspan="2">Produto</th>
                <th rowspan="2">MP</th>
                <th colspan="3" class="header-plan">Planejado</th>
                <th colspan="3" class="header-t1">1º Turno</th>
                <th colspan="3" class="header-t2">2º Turno</th>
                <th colspan="3" class="header-t3">3º Turno</th>
                <th rowspan="2" class="header-total">Total</th>
            </tr>
            <tr>
                <th class="header-plan">Ciclo</th>
                <th class="header-plan">Cav.</th>
                <th class="header-plan">Peso</th>
                <th class="header-t1">Ciclo</th>
                <th class="header-t1">Cav.</th>
                <th class="header-t1">Qtd.</th>
                <th class="header-t2">Ciclo</th>
                <th class="header-t2">Cav.</th>
                <th class="header-t2">Qtd.</th>
                <th class="header-t3">Ciclo</th>
                <th class="header-t3">Cav.</th>
                <th class="header-t3">Qtd.</th>
            </tr>`;
        
        // Dados da tabela
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 15) {
                const maquina = cells[0]?.textContent.trim() || '';
                const produto = cells[1]?.textContent.trim() || '';
                const mp = cells[2]?.textContent.trim() || '';
                const cicloPlan = cells[3]?.textContent.trim() || '';
                const cavPlan = cells[4]?.textContent.trim() || '';
                const peso = cells[5]?.textContent.trim() || '';
                const cicloT1 = cells[6]?.textContent.trim() || '';
                const cavT1 = cells[7]?.textContent.trim() || '';
                const qtdT1 = cells[8]?.textContent.trim() || '';
                const cicloT2 = cells[9]?.textContent.trim() || '';
                const cavT2 = cells[10]?.textContent.trim() || '';
                const qtdT2 = cells[11]?.textContent.trim() || '';
                const cicloT3 = cells[12]?.textContent.trim() || '';
                const cavT3 = cells[13]?.textContent.trim() || '';
                const qtdT3 = cells[14]?.textContent.trim() || '';
                const total = cells[15]?.textContent.trim() || '';
                
                html += `
            <tr>
                <td style="font-weight: bold;">${maquina}</td>
                <td class="text-left">${produto}</td>
                <td>${mp}</td>
                <td>${cicloPlan}</td>
                <td>${cavPlan}</td>
                <td>${peso}</td>
                <td>${cicloT1}</td>
                <td>${cavT1}</td>
                <td>${qtdT1}</td>
                <td>${cicloT2}</td>
                <td>${cavT2}</td>
                <td>${qtdT2}</td>
                <td>${cicloT3}</td>
                <td>${cavT3}</td>
                <td>${qtdT3}</td>
                <td class="total-cell">${total}</td>
            </tr>`;
            }
        });
        
        html += `
        </table>
    </body>
    </html>`;
        
        // Criar e baixar arquivo XLS
        const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `controle_ciclo_cavidade_${date}.xls`;
        link.click();
        URL.revokeObjectURL(link.href);
    };

    // Função para imprimir tabela de Controle de Ciclo/Cavidade por Turno
    window.printPlanningTable = function() {
        const table = document.getElementById('planning-table-body');
        if (!table) {
            alert('Tabela não encontrada!');
            return;
        }
        
        const rows = table.querySelectorAll('tr');
        if (rows.length === 0) {
            alert('Nenhum dado para imprimir.');
            return;
        }
        
        const date = document.getElementById('planning-date-selector')?.value || new Date().toISOString().split('T')[0];
        
        // Criar HTML para impressão
        let html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Controle de Ciclo/Cavidade por Turno - ${date}</title>
    <style>
        @page { size: landscape; margin: 10mm; }
        * { box-sizing: border-box; }
        body { font-family: Arial, sans-serif; font-size: 10px; margin: 0; padding: 10px; }
        .header { text-align: center; margin-bottom: 15px; }
        .header h1 { font-size: 16px; margin: 0 0 5px 0; color: #334155; }
        .header p { font-size: 11px; color: #64748b; margin: 0; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #cbd5e1; padding: 4px 6px; text-align: center; }
        th { background-color: #475569; color: white; font-weight: bold; font-size: 9px; }
        .header-plan { background-color: #f1f5f9 !important; color: #374151 !important; }
        .header-t1 { background-color: #DBEAFE !important; color: #1D4ED8 !important; }
        .header-t2 { background-color: #FEF3C7 !important; color: #B45309 !important; }
        .header-t3 { background-color: #F3E8FF !important; color: #7E22CE !important; }
        .header-total { background-color: #D1FAE5 !important; color: #065F46 !important; }
        .text-left { text-align: left; }
        .total-cell { background-color: #ECFDF5; font-weight: bold; }
        .machine { font-weight: bold; }
        tr:nth-child(even) { background-color: #f8fafc; }
        .footer { text-align: center; margin-top: 15px; font-size: 9px; color: #94a3b8; }
        @media print {
            body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Controle de Ciclo/Cavidade por Turno</h1>
        <p>Data: ${date} | Impresso em: ${new Date().toLocaleString('pt-BR')}</p>
    </div>
    <table>
        <thead>
            <tr>
                <th rowspan="2">Máq.</th>
                <th rowspan="2">Produto</th>
                <th rowspan="2">MP</th>
                <th colspan="3" class="header-plan">Planejado</th>
                <th colspan="3" class="header-t1">1º Turno</th>
                <th colspan="3" class="header-t2">2º Turno</th>
                <th colspan="3" class="header-t3">3º Turno</th>
                <th rowspan="2" class="header-total">Total</th>
            </tr>
            <tr>
                <th class="header-plan">Ciclo</th>
                <th class="header-plan">Cav.</th>
                <th class="header-plan">Peso</th>
                <th class="header-t1">Ciclo</th>
                <th class="header-t1">Cav.</th>
                <th class="header-t1">Qtd.</th>
                <th class="header-t2">Ciclo</th>
                <th class="header-t2">Cav.</th>
                <th class="header-t2">Qtd.</th>
                <th class="header-t3">Ciclo</th>
                <th class="header-t3">Cav.</th>
                <th class="header-t3">Qtd.</th>
            </tr>
        </thead>
        <tbody>`;
        
        // Dados da tabela
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 15) {
                const maquina = cells[0]?.textContent.trim() || '';
                const produto = cells[1]?.textContent.trim() || '';
                const mp = cells[2]?.textContent.trim() || '';
                const cicloPlan = cells[3]?.textContent.trim() || '';
                const cavPlan = cells[4]?.textContent.trim() || '';
                const peso = cells[5]?.textContent.trim() || '';
                const cicloT1 = cells[6]?.textContent.trim() || '';
                const cavT1 = cells[7]?.textContent.trim() || '';
                const qtdT1 = cells[8]?.textContent.trim() || '';
                const cicloT2 = cells[9]?.textContent.trim() || '';
                const cavT2 = cells[10]?.textContent.trim() || '';
                const qtdT2 = cells[11]?.textContent.trim() || '';
                const cicloT3 = cells[12]?.textContent.trim() || '';
                const cavT3 = cells[13]?.textContent.trim() || '';
                const qtdT3 = cells[14]?.textContent.trim() || '';
                const total = cells[15]?.textContent.trim() || '';
                
                html += `
            <tr>
                <td class="machine">${maquina}</td>
                <td class="text-left">${produto}</td>
                <td>${mp}</td>
                <td>${cicloPlan}</td>
                <td>${cavPlan}</td>
                <td>${peso}</td>
                <td>${cicloT1}</td>
                <td>${cavT1}</td>
                <td>${qtdT1}</td>
                <td>${cicloT2}</td>
                <td>${cavT2}</td>
                <td>${qtdT2}</td>
                <td>${cicloT3}</td>
                <td>${cavT3}</td>
                <td>${qtdT3}</td>
                <td class="total-cell">${total}</td>
            </tr>`;
            }
        });
        
        html += `
        </tbody>
    </table>
    <div class="footer">Hokkaido MES - Sistema de Gestão de Produção</div>
</body>
</html>`;
        
        // Abrir janela de impressão
        const printWindow = window.open('', '_blank', 'width=1200,height=800');
        if (printWindow) {
            printWindow.document.write(html);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => {
                printWindow.print();
            }, 500);
        } else {
            alert('Não foi possível abrir a janela de impressão. Verifique se popups estão habilitados.');
        }
    };

    // Setup de busca na tabela de planejamento
    function setupPlanningTableSearch() {
        const searchInput = document.getElementById('planning-table-search');
        if (!searchInput) return;
        
        let debounceTimer;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                const searchTerm = e.target.value.toLowerCase().trim();
                const tableBody = document.getElementById('planning-table-body');
                if (!tableBody) return;
                
                const rows = tableBody.querySelectorAll('tr');
                rows.forEach(row => {
                    const text = row.textContent.toLowerCase();
                    row.style.display = text.includes(searchTerm) ? '' : 'none';
                });
            }, 300);
        });
    }

    // Inicializar busca na tabela
    setTimeout(setupPlanningTableSearch, 1000);

    function listenToPlanningChanges(date) {
        if (!date) return;
        
        // AÇÃO 3: Salvar referência para Visibility API poder retomar
        window._currentListenerSetup = () => listenToPlanningChanges(date);
        
        detachActiveListener();
        showLoadingState('leader-panel', true);
        
        // Limpar cache de produção ao mudar de data (evita valores antigos)
        if (typeof machineCardProductionCache !== 'undefined' && machineCardProductionCache.clear) {
            machineCardProductionCache.clear();
        }
        
        let planningItems = [];
        let productionEntries = [];
        let downtimeEntries = [];
        let activeDowntimeSet = new Set();
        
        // Cache de total_produzido das OPs vinculadas (para consistência com aba Ordens)
        const orderTotalCache = new Map();

        const render = async () => {
            // OTIMIZAÇÃO: Buscar todas as OPs em paralelo (era sequencial — N reads)
            // CORREÇÃO CONSISTÊNCIA: Enriquecer plannings com total_produzido da OP vinculada
            const plansWithOrders = planningItems.filter(plan => 
                plan.production_order_id || plan.production_order || plan.order_id
            );
            const uniqueOrderIds = [...new Set(plansWithOrders.map(plan => 
                plan.production_order_id || plan.production_order || plan.order_id
            ))];

            // Buscar todas as OPs em paralelo via Promise.all
            const orderResults = await Promise.all(
                uniqueOrderIds.map(async (orderId) => {
                    try {
                        // Tentar cache global primeiro (evita Firestore se já temos)
                        if (typeof window.findProductionOrderCached === 'function') {
                            const cached = await window.findProductionOrderCached(orderId);
                            if (cached) return { orderId, data: cached, exists: true };
                        }
                        const orderDoc = await getDb().collection('production_orders').doc(orderId).get();
                        return { orderId, data: orderDoc.exists ? orderDoc.data() : null, exists: orderDoc.exists };
                    } catch (e) {
                        console.warn('[SYNC-CONSISTENCIA] Erro ao buscar OP:', orderId, e);
                        return { orderId, data: null, exists: false };
                    }
                })
            );

            // Aplicar resultados a cada planning
            const orderDataMap = new Map(orderResults.map(r => [r.orderId, r]));
            for (const plan of planningItems) {
                const orderId = plan.production_order_id || plan.production_order || plan.order_id;
                if (!orderId) continue;
                const result = orderDataMap.get(orderId);
                if (result && result.exists && result.data) {
                    const orderData = result.data;
                    const orderTotal = coerceToNumber(orderData.total_produzido ?? orderData.totalProduced, 0);
                    orderTotalCache.set(orderId, orderTotal);
                    
                    const planTotal = coerceToNumber(plan.total_produzido, 0);
                    
                    if (orderTotal !== planTotal) {
                        console.log(`[SYNC-CONSISTENCIA] Planning ${plan.id} tem total_produzido (${planTotal}) diferente da OP ${orderId} (${orderTotal}). Sincronizando...`);
                        plan.total_produzido = orderTotal;
                        plan.totalProduced = orderTotal;
                        getDb().collection('planning').doc(plan.id).update({
                            total_produzido: orderTotal,
                            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                        }).catch(e => console.warn('[SYNC-CONSISTENCIA] Falha ao sincronizar planning:', e));
                    } else {
                        plan.total_produzido = orderTotal;
                        plan.totalProduced = orderTotal;
                    }
                } else {
                    orderTotalCache.set(orderId, 0);
                }
            }
            
            const combinedData = planningItems.map(plan => {
                const shifts = { T1: 0, T2: 0, T3: 0 };

                productionEntries.forEach(entry => {
                    if (!entry || entry.planId !== plan.id) return;
                    const shiftKey = normalizeShiftValue(entry.turno);
                    if (!shiftKey || !shifts.hasOwnProperty(shiftKey)) return;
                    const produced = Number(entry.produzido) || 0;
                    shifts[shiftKey] += produced;
                });

                // CORREÇÃO: Calcular produção do dia (para referência)
                const producao_dia = shifts.T1 + shifts.T2 + shifts.T3;
                
                // CORREÇÃO CONSISTÊNCIA COM ADMIN:
                // O Admin mostra o total_produzido da OP (production_orders)
                // Os cards devem mostrar o MESMO valor para evitar divergências
                // Prioridade: 1) valor da OP (orderTotal), 2) valor do planning (storedTotal), 3) produção do dia
                const storedTotal = coerceToNumber(plan.total_produzido, 0);
                const orderId = plan.production_order_id || plan.production_order || plan.order_id;
                const orderTotal = orderId ? (orderTotalCache.get(orderId) || 0) : 0;
                
                // Se existe OP vinculada, usar o valor dela (igual ao Admin)
                // Senão, usar o valor do planning ou produção do dia (o que for maior)
                let total_produzido_final;
                if (orderId && orderTotal > 0) {
                    // Tem OP vinculada - usar valor da OP (mesmo que Admin)
                    total_produzido_final = orderTotal;
                } else {
                    // Sem OP vinculada - usar maior entre planning e produção do dia
                    total_produzido_final = Math.max(storedTotal, producao_dia);
                }

                return {
                    ...plan,
                    T1: { produzido: shifts.T1 },
                    T2: { produzido: shifts.T2 },
                    T3: { produzido: shifts.T3 },
                    producao_dia: producao_dia,  // Produção apenas do dia (para tabela)
                    total_produzido: total_produzido_final  // Total acumulado da OP (maior valor)
                };
            });

            // Atualizar KPIs do Planejamento
            updatePlanningKPIs(planningItems, combinedData);
            
            renderPlanningTable(combinedData);
            renderLeaderPanel(planningItems);
            
            // CORREÇÃO: Usar combinedData ao invés de planningItems para garantir
            // que os cards das máquinas tenham o total_produzido correto (igual ao Admin)
            const activePlansEnriched = combinedData.filter(isPlanActive);
            
            // NOVO: Carregar paradas ativas para mostrar no painel de máquinas
            const machinesDowntime = await getAllMachinesDowntimeStatus();
            renderMachineCards(activePlansEnriched, productionEntries, downtimeEntries, activeDowntimeSet, machinesDowntime);
            showLoadingState('leader-panel', false, planningItems.length === 0);
            
            // Atualizar contagem no painel
            const panelCount = document.getElementById('planning-panel-count');
            if (panelCount) {
                panelCount.textContent = `${planningItems.length} ${planningItems.length === 1 ? 'item' : 'itens'}`;
            }
        };

        // AÇÃO 2: Debounce para consolidar renders de múltiplos listeners
        // Evita múltiplas chamadas render() quando vários listeners disparam quase simultaneamente
        let renderDebounceTimer = null;
        const scheduleRender = () => {
            if (renderDebounceTimer) {
                clearTimeout(renderDebounceTimer);
            }
            renderDebounceTimer = setTimeout(() => {
                requestAnimationFrame(() => render().catch(e => console.error('Erro em render:', e)));
            }, 200); // 200ms de debounce (aumentado para evitar oscilações)
        };

        // Limpar listeners anteriores se existirem
        listenerManager.unsubscribe('planning');
        listenerManager.unsubscribe('productionEntries');
        listenerManager.unsubscribe('downtime');
        // activeDowntimes agora usa polling (AÇÃO 4)

        // Filtrar planejamentos pela data selecionada (dia de trabalho inicia às 7h)
        // Busca planejamentos onde a data do planejamento é igual à data selecionada
        const planningQuery = getDb().collection('planning').where('date', '==', date);
        listenerManager.subscribe('planning', planningQuery,
            (snapshot) => {
                // Filtrar apenas planejamentos ativos (não concluídos/finalizados/cancelados)
                planningItems = snapshot.docs
                    .map(doc => ({ id: doc.id, ...doc.data() }))
                    .filter(isPlanActive);
                planningItems.sort((a, b) => (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0));
                
                // Alimentar DataStore para evitar leituras repetidas
                if (window.DataStore) {
                    window.DataStore.set('planning', planningItems);
                }
                
                if (machineSelector) {
                    machineSelector.machineData = {};
                    planningItems.forEach(item => {
                        if (isPlanActive(item)) {
                            machineSelector.machineData[item.machine] = { id: item.id, ...item };
                        }
                    });
                }
                if (window.selectedMachineData) {
                    const updatedSelected = planningItems.find(item => item.id === window.selectedMachineData.id);
                    if (updatedSelected) {
                        window.selectedMachineData = { ...window.selectedMachineData, ...updatedSelected };
                        updateQuickProductionPieceWeightUI();
                        if (productName) {
                            productName.textContent = window.selectedMachineData.product || 'Produto não definido';
                        }
                        if (shiftTarget) {
                            // Usar lot_size (tamanho do lote OP), não planned_quantity/3
                            const totalPlanned = coerceToNumber(window.selectedMachineData.order_lot_size ?? window.selectedMachineData.lot_size, 0);
                            const totalExecuted = coerceToNumber(window.selectedMachineData.total_produzido, 0);
                            if (!totalPlanned) {
                                shiftTarget.textContent = `${totalExecuted.toLocaleString('pt-BR')} / N/A`;
                            } else {
                                shiftTarget.textContent = `${totalExecuted.toLocaleString('pt-BR')} / ${totalPlanned.toLocaleString('pt-BR')}`;
                            }
                        }
                        if (productMp) {
                            productMp.textContent = window.selectedMachineData.mp ? `MP: ${window.selectedMachineData.mp}` : 'Matéria-prima não definida';
                        }
                    }
                }
                scheduleRender();
            },
            (error) => {
                console.error("Erro ao carregar planejamentos:", error);
                if(leaderLaunchPanel) leaderLaunchPanel.innerHTML = `<div class="col-span-full text-center text-red-600">Erro ao carregar dados.</div>`;
                showLoadingState('leader-panel', false, true);
            }
        );

        const entriesQuery = getDb().collection('production_entries').where('data', '==', date);
        listenerManager.subscribe('productionEntries', entriesQuery,
            (snapshot) => {
                productionEntries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                
                // Alimentar DataStore para evitar leituras repetidas
                if (window.DataStore) {
                    window.DataStore.set('productionEntries', productionEntries);
                }
                
                scheduleRender();
            },
            (error) => console.error("Erro ao carregar lançamentos de produção:", error)
        );

        // Listener de paradas do dia selecionado e próximo dia (para cobrir T3 após 00:00)
        const base = new Date(`${date}T12:00:00`);
        const next = new Date(base);
        next.setDate(next.getDate() + 1);
        const nextStr = new Date(next.getTime() - next.getTimezoneOffset()*60000).toISOString().split('T')[0];
        
        const downtimeQuery = getDb().collection('downtime_entries')
            .where('date', 'in', [date, nextStr]);
        listenerManager.subscribe('downtime', downtimeQuery,
            (snapshot) => {
                downtimeEntries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                scheduleRender();
            },
            (error) => console.error('Erro ao carregar paradas:', error)
        );

        // AÇÃO 4: Polling para paradas ativas (cards vermelhos) - substituído listener por polling 5s
        // Função de polling para active_downtimes
        // IMPORTANTE: Filtrar apenas máquinas válidas do window.machineDatabase para evitar contagem incorreta
        const validMachineIdsSet = new Set(window.machineDatabase.map(m => normalizeMachineId(m.id)));
        const pollActiveDowntimes = async () => {
            try {
                // OTIMIZAÇÃO: Usar função com cache (TTL 30s para dados em tempo real)
                const downtimes = await getActiveDowntimesCached(false);
                // CORREÇÃO CRÍTICA: Filtrar apenas máquinas que existem no window.machineDatabase
                // E que têm isActive !== false (paradas realmente ativas)
                // FIX: Set de máquinas com plano ativo (para filtrar parada fantasma "SEM PROGRAMAÇÃO")
                const _planMachines = new Set(
                    (planningItems || []).filter(isPlanActive).map(p => normalizeMachineId(p.machine))
                );
                const validDowntimeIds = downtimes
                    .filter(d => {
                        // CORREÇÃO: Ignorar documentos com isActive explicitamente false
                        if (d.isActive === false) return false;
                        // FIX: Filtrar paradas "SEM PROGRAMAÇÃO" para máquinas com plano ativo
                        const reason = (d.reason || '').toLowerCase();
                        const isSemProg = reason.includes('sem programa') || reason.includes('sem programacao');
                        if (isSemProg && _planMachines.has(normalizeMachineId(d.id))) {
                            console.log(`[pollActiveDowntimes] Removida parada fantasma "SEM PROGRAMAÇÃO" de ${d.id} (máquina com plano ativo)`);
                            return false;
                        }
                        return true;
                    })
                    .map(d => d.id)
                    .filter(id => {
                        const normalizedId = normalizeMachineId(id);
                        const isValid = validMachineIdsSet.has(normalizedId);
                        if (!isValid) {
                            console.warn(`[pollActiveDowntimes] Máquina "${id}" em active_downtimes não existe no window.machineDatabase`);
                        }
                        return isValid;
                    });
                activeDowntimeSet = new Set(validDowntimeIds);
                scheduleRender();
            } catch (error) {
                console.error('Erro ao buscar paradas ativas:', error);
            }
        };
        
        // Executar imediatamente na primeira vez
        pollActiveDowntimes();
        
        // Configurar polling a cada 300 segundos (otimizado Fase 2 — era 60s, reduz 80% leituras active_downtimes)
        window._startActiveDowntimesPolling = () => {
            if (window._activeDowntimesPolling) {
                clearInterval(window._activeDowntimesPolling);
            }
            window._activeDowntimesPolling = setInterval(pollActiveDowntimes, 300000);
        };
        window._startActiveDowntimesPolling();
        
        // Pausar polling quando aba não está visível (economia de leituras Firebase)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                console.log('[POLLING] Pausando polling - aba oculta');
                if (window._activeDowntimesPolling) {
                    clearInterval(window._activeDowntimesPolling);
                    window._activeDowntimesPolling = null;
                }
            } else {
                console.log('[POLLING] Retomando polling - aba visível');
                pollActiveDowntimes(); // Atualiza imediatamente ao voltar
                window._startActiveDowntimesPolling();
            }
        });
    }

    function renderPlanningTable(items) {
        if (!planningTableBody) return;
        // Helper: exibe valor ou traço se nulo/undefined/vazio (aceita 0 como valor válido)
        const orDash = (value) => (value !== null && value !== undefined && value !== '') ? value : '-';
        const orDashNum = (value) => {
            const parsed = parseOptionalNumber(value);
            return parsed !== null ? parsed.toLocaleString('pt-BR') : '-';
        };
        const cycleClass = (realCycle, budgetedCycle) => {
            if (realCycle === null || realCycle === undefined || budgetedCycle === null || budgetedCycle === undefined) return '';
            return Number(realCycle) > Number(budgetedCycle) ? 'text-status-error font-bold' : '';
        };

        // Agrupar por Máquina + Produto (independente da OP)
        const grouped = new Map();
        
        // Helper para extrair valor numérico de ciclo/cavidade (aceita 0, rejeita null/undefined/string vazia)
        const extractCycleCavity = (value) => {
            if (value === null || value === undefined || value === '') return null;
            const num = Number(value);
            return isNaN(num) ? null : num;
        };
        
        (items || []).forEach(item => {
            const key = `${item.machine}||${item.product_cod || item.product || ''}`;
            if (!grouped.has(key)) {
                grouped.set(key, {
                    id: item.id, // Guardar ID do primeiro item do grupo
                    machine: item.machine,
                    product: item.product,
                    product_cod: item.product_cod,
                    mp: item.mp,
                    budgeted_cycle: item.budgeted_cycle,
                    mold_cavities: item.mold_cavities,
                    piece_weight: item.piece_weight,
                    // Ciclos/Cavidades reais por turno (pega o primeiro valor informado)
                    real_cycle_t1: extractCycleCavity(item.real_cycle_t1),
                    active_cavities_t1: extractCycleCavity(item.active_cavities_t1),
                    real_cycle_t2: extractCycleCavity(item.real_cycle_t2),
                    active_cavities_t2: extractCycleCavity(item.active_cavities_t2),
                    real_cycle_t3: extractCycleCavity(item.real_cycle_t3),
                    active_cavities_t3: extractCycleCavity(item.active_cavities_t3),
                    // Produção por turno acumulada
                    T1: { produzido: Number(item.T1?.produzido) || 0 },
                    T2: { produzido: Number(item.T2?.produzido) || 0 },
                    T3: { produzido: Number(item.T3?.produzido) || 0 },
                    // CORREÇÃO: Na tabela usar produção do dia (T1+T2+T3), não total acumulado da OP
                    producao_dia: coerceToNumber(item.producao_dia, 0) || (Number(item.T1?.produzido) || 0) + (Number(item.T2?.produzido) || 0) + (Number(item.T3?.produzido) || 0),
                    total_produzido: coerceToNumber(item.total_produzido, 0)
                });
            } else {
                const agg = grouped.get(key);
                // Manter primeiro valor de ciclo/cavidades reais informado; se vazio, assumir do item atual
                if (agg.real_cycle_t1 === null) agg.real_cycle_t1 = extractCycleCavity(item.real_cycle_t1);
                if (agg.active_cavities_t1 === null) agg.active_cavities_t1 = extractCycleCavity(item.active_cavities_t1);
                if (agg.real_cycle_t2 === null) agg.real_cycle_t2 = extractCycleCavity(item.real_cycle_t2);
                if (agg.active_cavities_t2 === null) agg.active_cavities_t2 = extractCycleCavity(item.active_cavities_t2);
                if (agg.real_cycle_t3 === null) agg.real_cycle_t3 = extractCycleCavity(item.real_cycle_t3);
                if (agg.active_cavities_t3 === null) agg.active_cavities_t3 = extractCycleCavity(item.active_cavities_t3);
                // Atualizar campos básicos se estiverem vazios
                if (!agg.mp && item.mp) agg.mp = item.mp;
                if (!agg.budgeted_cycle && item.budgeted_cycle) agg.budgeted_cycle = item.budgeted_cycle;
                if (!agg.mold_cavities && item.mold_cavities) agg.mold_cavities = item.mold_cavities;
                if (!agg.piece_weight && item.piece_weight) agg.piece_weight = item.piece_weight;
                // Somar produção por turno e total
                agg.T1.produzido += Number(item.T1?.produzido) || 0;
                agg.T2.produzido += Number(item.T2?.produzido) || 0;
                agg.T3.produzido += Number(item.T3?.produzido) || 0;
                // CORREÇÃO: Somar produção do dia separadamente
                agg.producao_dia += coerceToNumber(item.producao_dia, 0) || (Number(item.T1?.produzido) || 0) + (Number(item.T2?.produzido) || 0) + (Number(item.T3?.produzido) || 0);
                agg.total_produzido += coerceToNumber(item.total_produzido, 0);
            }
        });

        // Ordenar por máquina em ordem crescente (numérica se possível)
        const sortedItems = Array.from(grouped.values()).sort((a, b) => {
            const machineA = a.machine || '';
            const machineB = b.machine || '';
            // Tentar extrair número da máquina para ordenação numérica
            const numA = parseInt(machineA.replace(/\D/g, ''), 10);
            const numB = parseInt(machineB.replace(/\D/g, ''), 10);
            if (!isNaN(numA) && !isNaN(numB)) {
                return numA - numB;
            }
            return machineA.localeCompare(machineB, 'pt-BR', { numeric: true });
        });

        const rows = sortedItems.map(item => `
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

                <td class="px-3 py-2 whitespace-nowrap bg-emerald-50 font-bold text-emerald-700 text-base">${orDashNum(item.producao_dia)}</td>
                <td class="px-2 py-2 whitespace-nowrap no-print text-center">
                    <button class="delete-plan-btn bg-red-100 hover:bg-red-200 text-red-600 hover:text-red-700 p-1.5 rounded-lg transition-all" data-id="${item.id}" title="Deletar planejamento">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </td>
            </tr>
        `).join('');

        planningTableBody.innerHTML = rows;
        
        // Mostrar/ocultar estado vazio
        const emptyState = document.getElementById('planning-table-empty');
        if (emptyState) {
            emptyState.classList.toggle('hidden', sortedItems.length > 0);
        }
        
        if (typeof lucide !== 'undefined') lucide.createIcons();
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

        // Helper para extrair valor numérico de ciclo/cavidade (aceita 0, rejeita null/undefined/string vazia)
        const extractCycleCavity = (value) => {
            if (value === null || value === undefined || value === '') return null;
            const num = Number(value);
            return isNaN(num) ? null : num;
        };

        // Agrupar por Máquina + Produto (consolidar itens de OPs diferentes do mesmo produto)
        const groups = new Map();
        (planItems || []).forEach(item => {
            const key = `${item.machine}||${item.product_cod || item.product || ''}`;
            if (!groups.has(key)) {
                groups.set(key, {
                    ids: [item.id],
                    machine: item.machine,
                    product: item.product,
                    product_cod: item.product_cod,
                    mp: item.mp || '',
                    real_cycle_t1: extractCycleCavity(item.real_cycle_t1),
                    active_cavities_t1: extractCycleCavity(item.active_cavities_t1),
                    real_cycle_t2: extractCycleCavity(item.real_cycle_t2),
                    active_cavities_t2: extractCycleCavity(item.active_cavities_t2),
                    real_cycle_t3: extractCycleCavity(item.real_cycle_t3),
                    active_cavities_t3: extractCycleCavity(item.active_cavities_t3)
                });
            } else {
                const g = groups.get(key);
                g.ids.push(item.id);
                // Manter o primeiro valor informado para ciclo/cavidades de cada turno
                if (g.real_cycle_t1 === null) g.real_cycle_t1 = extractCycleCavity(item.real_cycle_t1);
                if (g.active_cavities_t1 === null) g.active_cavities_t1 = extractCycleCavity(item.active_cavities_t1);
                if (g.real_cycle_t2 === null) g.real_cycle_t2 = extractCycleCavity(item.real_cycle_t2);
                if (g.active_cavities_t2 === null) g.active_cavities_t2 = extractCycleCavity(item.active_cavities_t2);
                if (g.real_cycle_t3 === null) g.real_cycle_t3 = extractCycleCavity(item.real_cycle_t3);
                if (g.active_cavities_t3 === null) g.active_cavities_t3 = extractCycleCavity(item.active_cavities_t3);
                if (!g.mp && item.mp) g.mp = item.mp;
            }
        });

        leaderLaunchPanel.innerHTML = Array.from(groups.values()).map(group => {
            const turnos = ['T1', 'T2', 'T3'];
            const statusHtml = turnos.map(turno => {
                const rc = group[`real_cycle_${turno.toLowerCase()}`];
                const cav = group[`active_cavities_${turno.toLowerCase()}`];
                // Considerar preenchido se ambos tiverem valor numérico (incluindo 0)
                const isComplete = rc !== null && cav !== null;
                const statusClass = isComplete ? 'bg-green-100 text-status-success' : 'bg-yellow-100 text-status-warning';
                const statusIcon = isComplete ? `<i data-lucide="check-circle-2" class="w-4 h-4"></i>` : `<i data-lucide="alert-circle" class="w-4 h-4"></i>`;
                return `<div class="flex items-center justify-center gap-2 p-1 rounded-md text-xs font-semibold ${statusClass}">${statusIcon} ${turno}</div>`;
            }).join('');

            const btnClasses = turnos.map(turno => {
                const rc = group[`real_cycle_${turno.toLowerCase()}`];
                const cav = group[`active_cavities_${turno.toLowerCase()}`];
                // Considerar preenchido se ambos tiverem valor numérico (incluindo 0)
                const isComplete = rc !== null && cav !== null;
                return isComplete ? 'bg-status-success hover:bg-green-700' : 'bg-gray-500 hover:bg-gray-600';
            });
            const mpLabel = group.mp ? `<p class="text-xs text-gray-500 mt-1">MP: ${group.mp}</p>` : '';
            const idsCsv = group.ids.join(',');

            return `
                <div class="border rounded-lg p-4 shadow-md flex flex-col justify-between bg-white">
                    <div>
                        <h3 class="font-bold text-lg">${group.machine}</h3>
                        <p class="text-sm text-gray-600">${group.product}</p>
                        ${mpLabel}
                        <div class="grid grid-cols-3 gap-2 mt-2">
                           ${statusHtml}
                        </div>
                    </div>
                    <div class="grid grid-cols-3 gap-2 mt-4">
                        <button data-id="${idsCsv}" data-turno="T1" class="setup-btn ${btnClasses[0]} text-white font-bold py-2 px-3 rounded-lg text-sm">1º Turno</button>
                        <button data-id="${idsCsv}" data-turno="T2" class="setup-btn ${btnClasses[1]} text-white font-bold py-2 px-3 rounded-lg text-sm">2º Turno</button>
                        <button data-id="${idsCsv}" data-turno="T3" class="setup-btn ${btnClasses[2]} text-white font-bold py-2 px-3 rounded-lg text-sm">3º Turno</button>
                    </div>
                </div>
            `;
        }).join('');
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

// --- Entry point ---
let _planejamentoInitialized = false;
export function setupPlanejamentoPage() {
    if (!_planejamentoInitialized) {
        console.log('[Plan-mod] Controller modular carregado');
        setupPlanningTab();
        _planejamentoInitialized = true;
    } else {
        console.debug('[Plan-mod] Já inicializado — apenas recarregando dados');
    }
    listenToPlanningChanges(getProductionDateString());
}