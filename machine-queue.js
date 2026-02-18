/**
 * MACHINE QUEUE MODULE - Fila de Ordens de Produção por Máquina (PCP)
 * Usa ordens importadas via Excel (collection: production_orders)
 * Visualização em formato de lista com reordenação
 * 
 * Funcionalidades:
 * - Agrupamento de ordens por machine_id (campo da OP importada)
 * - Visualização em lista compacta agrupada por máquina
 * - Reordenação via botões (cima/baixo/topo/fim)
 * - Drag-and-drop dentro da mesma máquina
 * - Filtro por máquina e status
 * - Persistência de queue_position no Firebase
 */

(function() {
    'use strict';

    // =================== CONSTANTES ===================
    const COLLECTION = 'production_orders';
    const QUEUE_FIELD = 'queue_position';
    
    // Status considerados ativos (não finalizados)
    const ACTIVE_STATUSES = ['planejada', 'ativa', 'em_andamento', 'suspensa'];
    const FINISHED_STATUSES = ['concluida', 'concluída', 'finalizada', 'cancelada', 'cancelado', 'encerrada'];
    
    // Máquinas excluídas da fila (desativadas ou não são máquinas reais)
    const EXCLUDED_MACHINES = ['H11', 'MONTAGEM', 'ROMI EN'];
    
    // =================== VARIÁVEIS DE ESTADO ===================
    let machineQueues = {};
    let allOrders = [];
    let draggedItem = null;
    let isLoading = false;
    let currentFilters = { machine: '', status: '' };
    let expandedMachines = new Set(); // Máquinas com fila expandida

    // =================== INICIALIZAÇÃO ===================
    
    function initMachineQueue() {
        console.log('[MACHINE-QUEUE] Inicializando módulo (PCP - production_orders)...');
        
        if (typeof db === 'undefined') {
            console.error('[MACHINE-QUEUE] Firebase não disponível');
            return;
        }
        
        setupEventListeners();
        
        // Carregar automaticamente quando aba PCP é aberta
        document.addEventListener('click', function(e) {
            const navBtn = e.target.closest('[data-page="pcp"]');
            if (navBtn) {
                setTimeout(() => loadOrderQueue(), 300);
            }
        });
        
        console.log('[MACHINE-QUEUE] Módulo inicializado');
    }

    // =================== CARREGAMENTO ===================

    /**
     * Carrega todas as ordens ativas da collection production_orders
     * e organiza em filas por máquina
     */
    async function loadOrderQueue() {
        if (isLoading) return;
        isLoading = true;
        
        updateLoadingState(true);
        
        try {
            console.log('[MACHINE-QUEUE] Carregando production_orders...');
            
            let orders = [];
            
            // Usar cache se disponível
            if (typeof getProductionOrdersCached === 'function') {
                orders = await getProductionOrdersCached();
            } else if (typeof window.getProductionOrdersCached === 'function') {
                orders = await window.getProductionOrdersCached();
            } else {
                const snapshot = await db.collection(COLLECTION).get();
                orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            }
            
            allOrders = orders;
            
            // Filtrar apenas ordens com máquina atribuída e não finalizadas
            // Também exclui máquinas que não fazem parte da lista real (DISABLED/EXCLUDED)
            const validMachineIds = new Set(
                (window.databaseModule?.machineDatabase || []).map(m => m.id.toUpperCase())
            );
            
            const activeOrders = orders.filter(order => {
                const machineId = (order.machine_id || '').trim().toUpperCase();
                if (!machineId) return false;
                
                // Excluir máquinas na lista de excluídas
                if (EXCLUDED_MACHINES.includes(machineId)) return false;
                
                // Se temos a lista de máquinas, validar contra ela
                if (validMachineIds.size > 0 && !validMachineIds.has(machineId)) return false;
                
                const status = (order.status || 'planejada').toLowerCase();
                return !FINISHED_STATUSES.includes(status);
            });
            
            // Agrupar por máquina
            machineQueues = {};
            
            activeOrders.forEach(order => {
                const machineId = (order.machine_id || '').trim().toUpperCase();
                
                if (!machineQueues[machineId]) {
                    machineQueues[machineId] = [];
                }
                
                machineQueues[machineId].push({
                    ...order,
                    queue_position: order.queue_position || 999
                });
            });
            
            // Ordenar cada fila por posição
            Object.keys(machineQueues).forEach(machineId => {
                machineQueues[machineId].sort((a, b) => {
                    const posA = a.queue_position || 999;
                    const posB = b.queue_position || 999;
                    if (posA !== posB) return posA - posB;
                    // Fallback: ordenar por order_number
                    return (a.order_number || '').localeCompare(b.order_number || '');
                });
            });
            
            // Calcular totais para KPIs (incluindo concluídas)
            const totalWithMachine = orders.filter(o => (o.machine_id || '').trim()).length;
            const totalActive = activeOrders.length;
            const totalCompleted = orders.filter(o => {
                const s = (o.status || '').toLowerCase();
                return ['concluida', 'concluída', 'finalizada'].includes(s) && (o.machine_id || '').trim();
            }).length;
            const totalMachines = Object.keys(machineQueues).length;
            
            updateKPIs(totalWithMachine, totalMachines, totalActive, totalCompleted);
            
            renderQueueList(machineQueues);
            
            console.log(`[MACHINE-QUEUE] ${totalActive} ordens ativas em ${totalMachines} máquinas`);
            
        } catch (error) {
            console.error('[MACHINE-QUEUE] Erro ao carregar:', error);
            showNotification('Erro ao carregar fila de ordens', 'error');
        } finally {
            isLoading = false;
            updateLoadingState(false);
        }
    }

    // =================== RENDERIZAÇÃO EM LISTA ===================

    /**
     * Renderiza as filas agrupadas por máquina em formato de lista
     */
    function renderQueueList(queues) {
        const container = document.getElementById('machine-queue-container');
        if (!container) return;
        
        const machineFilter = currentFilters.machine.toUpperCase().trim();
        const statusFilter = currentFilters.status.toLowerCase().trim();
        
        // Filtrar máquinas
        let machineIds = Object.keys(queues).sort();
        
        if (machineFilter) {
            machineIds = machineIds.filter(id => id.includes(machineFilter));
        }
        
        // Filtrar por status dentro de cada máquina
        let filteredQueues = {};
        machineIds.forEach(id => {
            let items = queues[id] || [];
            if (statusFilter) {
                items = items.filter(o => (o.status || 'planejada').toLowerCase() === statusFilter);
            }
            if (items.length > 0) {
                filteredQueues[id] = items;
            }
        });
        
        machineIds = Object.keys(filteredQueues).sort();
        
        if (machineIds.length === 0) {
            container.innerHTML = `
                <div class="text-center py-12">
                    <i data-lucide="inbox" class="w-12 h-12 text-gray-300 mx-auto mb-3"></i>
                    <p class="text-gray-500 font-medium">Nenhuma ordem encontrada</p>
                    <p class="text-gray-400 text-sm mt-1">${machineFilter || statusFilter ? 'Ajuste os filtros ou ' : ''}Importe ordens na aba "Ordens de Produção"</p>
                </div>
            `;
            if (typeof lucide !== 'undefined') lucide.createIcons();
            return;
        }
        
        let html = '<div class="space-y-4">';
        
        machineIds.forEach(machineId => {
            const queue = filteredQueues[machineId];
            const machineInfo = window.databaseModule?.machineById?.get(machineId);
            const machineModel = machineInfo ? machineInfo.model : '';
            const isExpanded = expandedMachines.has(machineId);
            const chevronIcon = isExpanded ? 'chevron-up' : 'chevron-down';
            const firstOrder = queue[0];
            const previewText = firstOrder ? `1ª: OP ${firstOrder.order_number || '-'} - ${(firstOrder.product || '').substring(0, 30)}` : '';
            
            html += `
            <div class="border border-gray-200 rounded-xl overflow-hidden" data-machine-group="${machineId}">
                <!-- Cabeçalho da Máquina (clicável para expandir) -->
                <div class="bg-gradient-to-r from-slate-600 to-slate-700 px-4 py-3 flex items-center justify-between cursor-pointer select-none hover:from-slate-500 hover:to-slate-600 transition-all"
                     onclick="window.MachineQueue.toggle('${machineId}')">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-lg bg-white/15 flex items-center justify-center">
                            <span class="text-white font-bold text-sm">${machineId}</span>
                        </div>
                        <div>
                            <p class="text-white font-semibold text-sm">${machineModel || 'Máquina ' + machineId}</p>
                            <div class="flex items-center gap-2">
                                <p class="text-slate-300 text-xs">${queue.length} ${queue.length === 1 ? 'ordem na fila' : 'ordens na fila'}</p>
                                ${!isExpanded && previewText ? `<span class="text-slate-400 text-[10px] hidden sm:inline">| ${escapeHtml(previewText)}</span>` : ''}
                            </div>
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="bg-white/10 text-white text-[10px] px-2 py-1 rounded-full font-medium">${queue.length} OPs</span>
                        <i data-lucide="${chevronIcon}" class="w-5 h-5 text-white/70"></i>
                    </div>
                </div>
                
                <!-- Lista de Ordens (expansível) -->
                <div class="queue-items-container divide-y divide-gray-100 bg-white ${isExpanded ? '' : 'hidden'}" data-machine="${machineId}">
            `;
            
            queue.forEach((item, index) => {
                html += renderListItem(item, index, queue.length, machineId);
            });
            
            html += `
                </div>
            </div>
            `;
        });
        
        html += '</div>';
        container.innerHTML = html;
        
        if (typeof lucide !== 'undefined') lucide.createIcons();
        setupDragAndDrop();
    }

    /**
     * Renderiza um item individual no formato de lista
     */
    function renderListItem(item, index, totalItems, machineId) {
        const position = index + 1;
        const isFirst = index === 0;
        const isLast = index === totalItems - 1;
        
        const orderNumber = item.order_number || '-';
        const productName = item.product || item.part_name || '-';
        const partCode = item.part_code || '-';
        const customer = item.customer || '-';
        const lotSize = Number(item.lot_size) || 0;
        const totalProduced = Number(item.total_produzido || item.total_produced) || 0;
        const remaining = Math.max(0, lotSize - totalProduced);
        const progress = lotSize > 0 ? Math.min(Math.round((totalProduced / lotSize) * 100), 100) : 0;
        
        const status = (item.status || 'planejada').toLowerCase();
        const statusCfg = getStatusConfig(status);
        const positionBadge = getPositionBadge(position);
        
        // Cor da barra de progresso
        const progressColor = progress >= 100 ? 'bg-emerald-500' : progress >= 70 ? 'bg-blue-500' : progress >= 40 ? 'bg-amber-500' : 'bg-red-400';
        
        // Highlight para 1ª posição
        const rowBg = isFirst ? 'bg-blue-50/50' : 'bg-white';
        const leftBorder = isFirst ? 'border-l-4 border-l-blue-500' : '';
        
        return `
            <div class="queue-item ${rowBg} ${leftBorder} px-4 py-3 hover:bg-gray-50 transition-colors cursor-move group"
                 data-item-id="${item.id}" data-position="${position}" data-machine="${machineId}" draggable="true">
                <div class="flex items-center gap-3">
                    
                    <!-- Posição -->
                    <div class="flex-shrink-0 w-9 text-center">
                        ${positionBadge}
                    </div>
                    
                    <!-- Infos principais -->
                    <div class="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-12 gap-x-3 gap-y-1 items-center">
                        
                        <!-- OP + Status -->
                        <div class="sm:col-span-2 flex items-center gap-2">
                            <span class="font-bold text-gray-800 text-sm">${escapeHtml(orderNumber)}</span>
                            <span class="px-1.5 py-0.5 rounded text-[10px] font-semibold ${statusCfg.classes}">${statusCfg.label}</span>
                        </div>
                        
                        <!-- Produto -->
                        <div class="sm:col-span-4 truncate">
                            <p class="text-sm text-gray-700 truncate" title="${escapeHtml(productName)}">${escapeHtml(productName)}</p>
                            <p class="text-[10px] text-gray-400">Cód: ${escapeHtml(partCode)}</p>
                        </div>
                        
                        <!-- Cliente -->
                        <div class="sm:col-span-2 hidden sm:block">
                            <p class="text-xs text-gray-500 truncate" title="${escapeHtml(customer)}">${escapeHtml(customer)}</p>
                        </div>
                        
                        <!-- Lote / Progresso -->
                        <div class="sm:col-span-3">
                            <div class="flex items-center gap-2">
                                <div class="flex-1">
                                    <div class="flex justify-between text-[10px] mb-0.5">
                                        <span class="text-gray-500">${totalProduced.toLocaleString('pt-BR')} / ${lotSize.toLocaleString('pt-BR')}</span>
                                        <span class="font-semibold ${progress >= 100 ? 'text-emerald-600' : 'text-gray-700'}">${progress}%</span>
                                    </div>
                                    <div class="w-full bg-gray-200 rounded-full h-1.5">
                                        <div class="${progressColor} h-1.5 rounded-full transition-all" style="width: ${progress}%"></div>
                                    </div>
                                </div>
                                <span class="text-[10px] text-gray-400 whitespace-nowrap hidden lg:inline">Falta: ${remaining.toLocaleString('pt-BR')}</span>
                            </div>
                        </div>
                        
                        <!-- Ações -->
                        <div class="sm:col-span-1 flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button class="p-1 rounded hover:bg-blue-100 text-gray-400 hover:text-blue-600 transition disabled:opacity-20"
                                    onclick="event.stopPropagation(); window.MachineQueue.moveToTop('${machineId}', '${item.id}')"
                                    ${isFirst ? 'disabled' : ''} title="Topo">
                                <i data-lucide="chevrons-up" class="w-3.5 h-3.5"></i>
                            </button>
                            <button class="p-1 rounded hover:bg-blue-100 text-gray-400 hover:text-blue-600 transition disabled:opacity-20"
                                    onclick="event.stopPropagation(); window.MachineQueue.moveUp('${machineId}', '${item.id}')"
                                    ${isFirst ? 'disabled' : ''} title="Subir">
                                <i data-lucide="chevron-up" class="w-3.5 h-3.5"></i>
                            </button>
                            <button class="p-1 rounded hover:bg-blue-100 text-gray-400 hover:text-blue-600 transition disabled:opacity-20"
                                    onclick="event.stopPropagation(); window.MachineQueue.moveDown('${machineId}', '${item.id}')"
                                    ${isLast ? 'disabled' : ''} title="Descer">
                                <i data-lucide="chevron-down" class="w-3.5 h-3.5"></i>
                            </button>
                            <button class="p-1 rounded hover:bg-blue-100 text-gray-400 hover:text-blue-600 transition disabled:opacity-20"
                                    onclick="event.stopPropagation(); window.MachineQueue.moveToBottom('${machineId}', '${item.id}')"
                                    ${isLast ? 'disabled' : ''} title="Final">
                                <i data-lucide="chevrons-down" class="w-3.5 h-3.5"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // =================== REORDENAÇÃO ===================

    async function moveQueueItem(machineId, itemId, newPosition) {
        if (!machineId || !itemId) return false;
        
        try {
            const queue = machineQueues[machineId];
            if (!queue) return false;
            
            const oldIndex = queue.findIndex(item => item.id === itemId);
            if (oldIndex === -1) return false;
            
            const newIndex = Math.max(0, Math.min(newPosition - 1, queue.length - 1));
            if (oldIndex === newIndex) return false;
            
            // Reordenar localmente
            const [movedItem] = queue.splice(oldIndex, 1);
            queue.splice(newIndex, 0, movedItem);
            
            // Atualizar posições no Firebase (batch)
            const batch = db.batch();
            
            queue.forEach((item, index) => {
                const newPos = index + 1;
                if (item.queue_position !== newPos) {
                    const docRef = db.collection(COLLECTION).doc(item.id);
                    batch.update(docRef, { 
                        queue_position: newPos,
                        queue_updated_at: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    item.queue_position = newPos;
                }
            });
            
            await batch.commit();
            
            console.log(`[MACHINE-QUEUE] ${itemId} movido para posição ${newPosition} em ${machineId}`);
            showNotification('Fila atualizada', 'success');
            
            renderQueueList(machineQueues);
            return true;
            
        } catch (error) {
            console.error('[MACHINE-QUEUE] Erro ao mover:', error);
            showNotification('Erro ao reordenar', 'error');
            return false;
        }
    }

    async function moveUp(machineId, itemId) {
        const queue = machineQueues[machineId] || [];
        const idx = queue.findIndex(i => i.id === itemId);
        if (idx > 0) return moveQueueItem(machineId, itemId, idx);
    }

    async function moveDown(machineId, itemId) {
        const queue = machineQueues[machineId] || [];
        const idx = queue.findIndex(i => i.id === itemId);
        if (idx >= 0 && idx < queue.length - 1) return moveQueueItem(machineId, itemId, idx + 3);
    }

    async function moveToTop(machineId, itemId) {
        return moveQueueItem(machineId, itemId, 1);
    }

    async function moveToBottom(machineId, itemId) {
        const queue = machineQueues[machineId] || [];
        return moveQueueItem(machineId, itemId, queue.length);
    }

    // =================== KPIs ===================

    function updateKPIs(total, machines, active, completed) {
        const el = (id, val) => {
            const e = document.getElementById(id);
            if (e) e.textContent = val.toLocaleString('pt-BR');
        };
        el('queue-kpi-total', total);
        el('queue-kpi-machines', machines);
        el('queue-kpi-active', active);
        el('queue-kpi-completed', completed);
    }

    // =================== HELPERS DE UI ===================

    function getStatusConfig(status) {
        const configs = {
            'planejada': { label: 'Planejada', classes: 'bg-slate-100 text-slate-600 border border-slate-200' },
            'ativa': { label: 'Ativa', classes: 'bg-blue-100 text-blue-700 border border-blue-200' },
            'em_andamento': { label: 'Andamento', classes: 'bg-amber-100 text-amber-700 border border-amber-200' },
            'suspensa': { label: 'Suspensa', classes: 'bg-orange-100 text-orange-700 border border-orange-200' },
            'concluida': { label: 'Concluída', classes: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
            'finalizada': { label: 'Finalizada', classes: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
            'cancelada': { label: 'Cancelada', classes: 'bg-red-100 text-red-700 border border-red-200' }
        };
        return configs[status] || { label: status || 'N/A', classes: 'bg-gray-100 text-gray-600' };
    }

    function getPositionBadge(position) {
        if (position === 1) {
            return `<div class="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center text-white font-bold text-xs shadow-sm">1º</div>`;
        } else if (position === 2) {
            return `<div class="w-8 h-8 rounded-lg bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center text-white font-bold text-xs shadow-sm">2º</div>`;
        } else if (position === 3) {
            return `<div class="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-300 to-orange-400 flex items-center justify-center text-white font-bold text-xs shadow-sm">3º</div>`;
        } else {
            return `<div class="w-8 h-8 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-500 font-bold text-xs">${position}º</div>`;
        }
    }

    function updateLoadingState(loading) {
        const container = document.getElementById('machine-queue-container');
        if (!container) return;
        
        if (loading) {
            container.innerHTML = `
                <div class="text-center py-12">
                    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600 mx-auto mb-3"></div>
                    <p class="text-gray-500 text-sm">Carregando fila de ordens...</p>
                </div>
            `;
        }
    }

    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // =================== DRAG AND DROP ===================

    function setupDragAndDrop() {
        document.querySelectorAll('.queue-item').forEach(item => {
            item.addEventListener('dragstart', handleDragStart);
            item.addEventListener('dragend', handleDragEnd);
        });
        
        document.querySelectorAll('.queue-items-container').forEach(container => {
            container.addEventListener('dragover', handleDragOver);
            container.addEventListener('drop', handleDrop);
            container.addEventListener('dragleave', handleDragLeave);
        });
    }

    function handleDragStart(e) {
        draggedItem = e.target.closest('.queue-item');
        if (!draggedItem) return;
        draggedItem.classList.add('opacity-40', 'scale-[0.98]');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', JSON.stringify({
            itemId: draggedItem.dataset.itemId,
            machineId: draggedItem.dataset.machine,
            position: parseInt(draggedItem.dataset.position)
        }));
    }

    function handleDragEnd() {
        if (draggedItem) {
            draggedItem.classList.remove('opacity-40', 'scale-[0.98]');
            draggedItem = null;
        }
        document.querySelectorAll('.queue-items-container').forEach(c => c.classList.remove('bg-blue-50/50'));
        document.querySelectorAll('.queue-item').forEach(i => i.classList.remove('border-t-2', 'border-t-blue-500'));
    }

    function handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const container = e.target.closest('.queue-items-container');
        if (container) container.classList.add('bg-blue-50/50');
        
        const afterEl = getDragAfterElement(container, e.clientY);
        document.querySelectorAll('.queue-item').forEach(i => i.classList.remove('border-t-2', 'border-t-blue-500'));
        if (afterEl) afterEl.classList.add('border-t-2', 'border-t-blue-500');
    }

    function handleDragLeave(e) {
        const container = e.target.closest('.queue-items-container');
        if (container) container.classList.remove('bg-blue-50/50');
    }

    async function handleDrop(e) {
        e.preventDefault();
        const container = e.target.closest('.queue-items-container');
        if (!container) return;
        
        try {
            const data = JSON.parse(e.dataTransfer.getData('text/plain'));
            const targetMachine = container.dataset.machine;
            
            if (data.machineId !== targetMachine) {
                showNotification('Não é possível mover ordens entre máquinas', 'warning');
                return;
            }
            
            const afterEl = getDragAfterElement(container, e.clientY);
            const queue = machineQueues[targetMachine] || [];
            let newPosition = afterEl ? (parseInt(afterEl.dataset.position) || 1) : queue.length;
            
            await moveQueueItem(targetMachine, data.itemId, newPosition);
        } catch (err) {
            console.error('[MACHINE-QUEUE] Erro no drop:', err);
        }
    }

    function getDragAfterElement(container, y) {
        if (!container) return null;
        const items = [...container.querySelectorAll('.queue-item:not(.opacity-40)')];
        
        return items.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset, element: child };
            }
            return closest;
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    // =================== EXPAND/COLLAPSE ===================

    function toggleMachine(machineId) {
        if (expandedMachines.has(machineId)) {
            expandedMachines.delete(machineId);
        } else {
            expandedMachines.add(machineId);
        }
        renderQueueList(machineQueues);
    }

    function expandAll() {
        Object.keys(machineQueues).forEach(id => expandedMachines.add(id));
        renderQueueList(machineQueues);
    }

    function collapseAll() {
        expandedMachines.clear();
        renderQueueList(machineQueues);
    }

    // =================== EVENT LISTENERS ===================

    function setupEventListeners() {
        // Filtro de máquina (busca por texto)
        let machineFilterTimeout = null;
        document.addEventListener('input', function(e) {
            if (e.target.id === 'queue-machine-filter') {
                clearTimeout(machineFilterTimeout);
                machineFilterTimeout = setTimeout(() => {
                    currentFilters.machine = e.target.value;
                    renderQueueList(machineQueues);
                }, 200);
            }
        });
        
        // Filtro de status (select)
        document.addEventListener('change', function(e) {
            if (e.target.id === 'queue-status-filter') {
                currentFilters.status = e.target.value;
                renderQueueList(machineQueues);
            }
        });
        
        // Botão refresh + expand/collapse
        document.addEventListener('click', function(e) {
            if (e.target.closest('#refresh-machine-queue')) {
                loadOrderQueue().then(() => {
                    showNotification('Fila atualizada', 'success');
                });
            }
            if (e.target.closest('#queue-expand-all')) {
                expandAll();
            }
            if (e.target.closest('#queue-collapse-all')) {
                collapseAll();
            }
        });
    }

    // =================== UTILITÁRIOS ===================

    function showNotification(message, type) {
        if (typeof window.showNotification === 'function') {
            window.showNotification(message, type);
        } else {
            console.log(`[${type}] ${message}`);
        }
    }

    // =================== API PÚBLICA ===================

    /**
     * Retorna contagem de ordens na fila por máquina (para uso na tabela PCP)
     */
    function getQueueCounts() {
        const counts = {};
        Object.keys(machineQueues).forEach(machineId => {
            counts[machineId] = (machineQueues[machineId] || []).length;
        });
        return counts;
    }

    window.MachineQueue = {
        init: initMachineQueue,
        load: loadOrderQueue,
        render: renderQueueList,
        toggle: toggleMachine,
        expandAll: expandAll,
        collapseAll: collapseAll,
        moveUp: moveUp,
        moveDown: moveDown,
        moveToTop: moveToTop,
        moveToBottom: moveToBottom,
        getQueues: () => machineQueues,
        getQueueCounts: getQueueCounts
    };

    // Inicializar
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initMachineQueue);
    } else {
        setTimeout(initMachineQueue, 500);
    }

    console.log('[MACHINE-QUEUE] Módulo carregado (PCP - production_orders)');

})();
