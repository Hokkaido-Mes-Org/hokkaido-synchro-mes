/**
 * HokkaidoMES — Extended Downtime Controller
 * Fase 12: Extraído de script.js
 *
 * Gerencia paradas longas (fim de semana, manutenção programada, etc.):
 *   - Tab setup & batch downtime (setupExtendedDowntimeTab, setupParadaEmLote)
 *   - Modal open/submit (openExtendedDowntimeModal, handleExtendedDowntimeFormSubmit)
 *   - List management with filters & cache (loadExtendedDowntimeList, renderFilteredDowntimeList)
 *   - Edit modal (openEditDowntimeModal, handleEditDowntimeSubmit)
 *   - Analysis rendering (loadExtendedDowntimeAnalysis)
 *   - Auto-update timer (updateActiveExtendedDowntimes)
 *
 * Dependências via window.*:
 *   db, firebase, showNotification, openModal, closeModal,
 *   selectedMachineData, getGroupedDowntimeReasons, getDowntimeCategory,
 *   getAllMachinesDowntimeStatus, renderMachineCards, registrarLogSistema,
 *   getExtendedDowntimesCached, currentAnalysisFilters, lucide,
 *   showPermissionDeniedNotification, machineDatabase, normalizeMachineId
 */

import { getActiveUser, isUserGestorOrAdmin } from '../utils/auth.utils.js';
import { getCurrentShift } from '../utils/date.utils.js';
import { getGroupedDowntimeReasons, getDowntimeCategory } from '../utils/color.utils.js';

// ─── Internal State ────────────────────────────────────────────
let extendedDowntimeUpdateTimer = null;
const EXTENDED_DOWNTIME_UPDATE_INTERVAL = 30 * 60 * 1000; // 30 min

let extendedDowntimeListCache = {
    data: [],
    lastLoad: 0,
    isLoading: false
};

// ─── Helpers (window forwarding) ───────────────────────────────
const db = () => window.db;
const showNotification = (...a) => window.showNotification?.(...a);
const openModal = (...a) => window.openModal?.(...a);
const closeModal = (...a) => window.closeModal?.(...a);
const getAllMachinesDowntimeStatus = () => window.getAllMachinesDowntimeStatus?.();
const renderMachineCards = (...a) => window.renderMachineCards?.(...a);
const registrarLogSistema = (...a) => window.registrarLogSistema?.(...a);
const getExtendedDowntimesCached = (...a) => window.getExtendedDowntimesCached?.(...a);
const showPermissionDeniedNotification = (...a) => window.showPermissionDeniedNotification?.(...a);
const normalizeMachineId = (id) => window.normalizeMachineId?.(id) || id;

// ════════════════════════════════════════════════════════════════
// BLOCK 5 — Tab Init + Batch Downtime
// ════════════════════════════════════════════════════════════════

/**
 * Popula o select de motivos de parada longa com optgroups.
 */
function populateExtendedDowntimeReasons() {
    const reasonSelect = document.getElementById('extended-downtime-reason');
    if (!reasonSelect) return;

    const groupedReasons = getGroupedDowntimeReasons();
    let options = '<option value="">Selecione o motivo...</option>';

    Object.entries(groupedReasons).forEach(([group, reasons]) => {
        options += `<optgroup label="${group}">`;
        reasons.forEach(reason => {
            options += `<option value="${reason}">${reason}</option>`;
        });
        options += '</optgroup>';
    });

    reasonSelect.innerHTML = options;
    console.log('[PARADAS-LONGAS] Motivos carregados:', Object.keys(groupedReasons).length, 'grupos');
}

/**
 * Popula o select de máquinas de parada longa.
 */
function populateExtendedDowntimeMachines() {
    const machineSelect = document.getElementById('extended-downtime-machine');
    if (!machineSelect) {
        console.warn('[PARADAS-LONGAS] Select de máquina não encontrado');
        return;
    }

    const validMachines = ['H01', 'H02', 'H03', 'H04', 'H05', 'H06', 'H07', 'H08', 'H09', 'H10',
                           'H12', 'H13', 'H14', 'H15', 'H16', 'H17', 'H18', 'H19', 'H20',
                           'H26', 'H27', 'H28', 'H29', 'H30', 'H31', 'H32'];

    machineSelect.innerHTML = '<option value="">Todas as máquinas</option>' +
        validMachines.map(m => `<option value="${m}">${m}</option>`).join('');
    
    console.log('[PARADAS-LONGAS] Máquinas carregadas:', validMachines.length);
}

/**
 * Configura a aba de paradas longas (formulário, data/hora padrão).
 */
function setupExtendedDowntimeTab() {
    console.log('[PARADAS-LONGAS] Configurando aba...');
    
    populateExtendedDowntimeReasons();
    populateExtendedDowntimeMachines();
    
    // Configurar data e hora padrão
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().slice(0, 5);
    
    const startDateInput = document.getElementById('extended-downtime-start-date');
    const startTimeInput = document.getElementById('extended-downtime-start-time');
    const endDateInput = document.getElementById('extended-downtime-end-date');
    const endTimeInput = document.getElementById('extended-downtime-end-time');
    
    if (startDateInput) startDateInput.value = dateStr;
    if (startTimeInput) startTimeInput.value = timeStr;
    if (endDateInput) endDateInput.value = '';
    if (endTimeInput) endTimeInput.value = '';
    
    // Limpar campos
    const reasonSelect = document.getElementById('extended-downtime-reason');
    if (reasonSelect) reasonSelect.value = '';
    
    const machineSelect = document.getElementById('extended-downtime-machine');
    if (machineSelect) machineSelect.value = '';
    
    // Status
    const statusDiv = document.getElementById('extended-downtime-status');
    if (statusDiv) {
        statusDiv.textContent = '';
        statusDiv.className = 'text-sm font-semibold h-5';
    }
    
    // Limpar campo de duração prevista
    const durationPreview = document.getElementById('extended-downtime-duration-preview');
    if (durationPreview) durationPreview.textContent = '';
    
    // Configurar form submit handler
    const extendedDowntimeForm = document.getElementById('extended-downtime-form');
    if (extendedDowntimeForm) {
        // Remover listeners antigos
        const newForm = extendedDowntimeForm.cloneNode(true);
        extendedDowntimeForm.parentNode.replaceChild(newForm, extendedDowntimeForm);
        newForm.addEventListener('submit', handleExtendedDowntimeFormSubmit);
    }
    
    // Configurar Parada em Lote
    setupParadaEmLote();
    
    // Carregar lista de paradas atuais
    loadExtendedDowntimeList();
    
    console.log('[PARADAS-LONGAS] Aba configurada com sucesso');
}

/**
 * Configura o formulário de parada em lote para múltiplas máquinas.
 */
function setupParadaEmLote() {
    console.log('[PARADA-EM-LOTE] Configurando...');
    
    // Popular grid de máquinas para seleção múltipla
    const machineGrid = document.getElementById('batch-machine-grid');
    if (!machineGrid) {
        console.warn('[PARADA-EM-LOTE] Grid de máquinas não encontrado');
        return;
    }
    
    const validMachines = ['H01', 'H02', 'H03', 'H04', 'H05', 'H06', 'H07', 'H08', 'H09', 'H10',
                           'H12', 'H13', 'H14', 'H15', 'H16', 'H17', 'H18', 'H19', 'H20',
                           'H26', 'H27', 'H28', 'H29', 'H30', 'H31', 'H32'];
    
    // Verificar quais máquinas já têm parada ativa
    const checkActiveDowntimes = async () => {
        let activeMap = {};
        try {
            const snapshot = await db().collection('extended_downtime_logs')
                .where('status', '==', 'active')
                .get();
            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.machine_id) {
                    activeMap[data.machine_id] = true;
                }
            });
        } catch (err) {
            console.warn('[PARADA-EM-LOTE] Erro ao verificar paradas ativas:', err);
        }
        return activeMap;
    };
    
    // Renderizar grid com timer para garantir DOM pronto
    const renderGrid = async () => {
        const activeMap = await checkActiveDowntimes();
        
        machineGrid.innerHTML = validMachines.map(m => {
            const isActive = activeMap[m];
            return `
                <label class="flex items-center gap-2 p-2 rounded-lg border ${isActive ? 'border-red-300 bg-red-50' : 'border-gray-200 hover:bg-blue-50'} cursor-pointer transition-all">
                    <input type="checkbox" value="${m}" class="batch-machine-checkbox rounded border-gray-300 text-blue-600 focus:ring-blue-500" ${isActive ? 'disabled' : ''}>
                    <span class="text-sm font-medium ${isActive ? 'text-red-500 line-through' : 'text-gray-700'}">${m}</span>
                    ${isActive ? '<span class="text-xs text-red-500 ml-auto">⏸️ Ativa</span>' : ''}
                </label>
            `;
        }).join('');
        
        console.log('[PARADA-EM-LOTE] Grid renderizado, máquinas com parada ativa:', Object.keys(activeMap));
    };
    
    // Renderizar após um pequeno delay para garantir DOM
    setTimeout(renderGrid, 100);
    
    // Botões de seleção rápida
    const selectAllBtn = document.getElementById('batch-select-all');
    const clearAllBtn = document.getElementById('batch-clear-all');
    
    if (selectAllBtn) {
        selectAllBtn.addEventListener('click', () => {
            document.querySelectorAll('.batch-machine-checkbox:not(:disabled)').forEach(cb => cb.checked = true);
        });
    }
    
    if (clearAllBtn) {
        clearAllBtn.addEventListener('click', () => {
            document.querySelectorAll('.batch-machine-checkbox').forEach(cb => cb.checked = false);
        });
    }
    
    // Popular motivos
    const batchReasonSelect = document.getElementById('batch-downtime-reason');
    if (batchReasonSelect) {
        const groupedReasons = getGroupedDowntimeReasons();
        let options = '<option value="">Selecione o motivo...</option>';
        Object.entries(groupedReasons).forEach(([group, reasons]) => {
            options += `<optgroup label="${group}">`;
            reasons.forEach(reason => {
                options += `<option value="${reason}">${reason}</option>`;
            });
            options += '</optgroup>';
        });
        batchReasonSelect.innerHTML = options;
    }
    
    // Data/hora padrão
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().slice(0, 5);
    
    const batchStartDate = document.getElementById('batch-start-date');
    const batchStartTime = document.getElementById('batch-start-time');
    if (batchStartDate) batchStartDate.value = dateStr;
    if (batchStartTime) batchStartTime.value = timeStr;
    
    // Submit do formulário em lote
    const batchForm = document.getElementById('batch-downtime-form');
    if (batchForm) {
        // Remover listeners antigos clonando
        const newBatchForm = batchForm.cloneNode(true);
        batchForm.parentNode.replaceChild(newBatchForm, batchForm);
        
        newBatchForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const selectedMachines = [];
            document.querySelectorAll('.batch-machine-checkbox:checked').forEach(cb => {
                selectedMachines.push(cb.value);
            });
            
            if (selectedMachines.length === 0) {
                showNotification('Selecione pelo menos uma máquina', 'warning');
                return;
            }
            
            const reason = document.getElementById('batch-downtime-reason')?.value;
            const startDate = document.getElementById('batch-start-date')?.value;
            const startTime = document.getElementById('batch-start-time')?.value;
            
            if (!reason || !startDate || !startTime) {
                showNotification('Preencha todos os campos obrigatórios', 'warning');
                return;
            }
            
            const statusDiv = document.getElementById('batch-downtime-status');
            const submitBtn = document.getElementById('batch-submit-btn');
            
            try {
                if (submitBtn) submitBtn.disabled = true;
                if (statusDiv) {
                    statusDiv.textContent = `⏳ Registrando parada para ${selectedMachines.length} máquinas...`;
                    statusDiv.className = 'text-sm font-semibold text-blue-600';
                }
                
                const startDateTime = new Date(`${startDate}T${startTime}`);
                const userName = getActiveUser()?.name || 'Sistema';
                const category = getDowntimeCategory(reason);
                const shift = getCurrentShift(startDateTime);
                
                // Criar batch de registros
                const batch = db().batch();
                
                selectedMachines.forEach(machine => {
                    const ref = db().collection('extended_downtime_logs').doc();
                    batch.set(ref, {
                        machine_id: machine,
                        type: reason,
                        reason: reason,
                        category: category,
                        start_date: startDate,
                        start_time: startTime,
                        start_datetime: firebase.firestore.Timestamp.fromDate(startDateTime),
                        end_date: null,
                        end_time: null,
                        end_datetime: null,
                        status: 'active',
                        duration_minutes: 0,
                        shift: shift,
                        registered_by: userName,
                        created_by: userName,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                });
                
                await batch.commit();
                
                console.log('[PARADA-EM-LOTE] Paradas criadas para:', selectedMachines);
                
                registrarLogSistema('PARADA EM LOTE', 'parada', {
                    machines: selectedMachines,
                    reason: reason,
                    startDate: startDate,
                    startTime: startTime
                });
                
                if (statusDiv) {
                    statusDiv.textContent = `✅ Parada registrada para ${selectedMachines.length} máquinas!`;
                    statusDiv.className = 'text-sm font-semibold text-green-600';
                }
                
                showNotification(`Parada registrada para ${selectedMachines.length} máquinas`, 'success');
                
                // Limpar seleção
                document.querySelectorAll('.batch-machine-checkbox').forEach(cb => cb.checked = false);
                
                // Recarregar lista e grid
                await loadExtendedDowntimeList();
                setupParadaEmLote();
                
                // Atualizar cards
                const machinesDowntime = await getAllMachinesDowntimeStatus();
                await renderMachineCards([], [], [], new Set(), machinesDowntime);
                
            } catch (error) {
                console.error('[PARADA-EM-LOTE] Erro:', error);
                if (statusDiv) {
                    statusDiv.textContent = `❌ Erro: ${error.message}`;
                    statusDiv.className = 'text-sm font-semibold text-red-600';
                }
                showNotification('Erro ao registrar parada em lote', 'error');
            } finally {
                if (submitBtn) submitBtn.disabled = false;
            }
        });
    }
    
    console.log('[PARADA-EM-LOTE] Configurado com sucesso');
}

// ════════════════════════════════════════════════════════════════
// BLOCK 6 — Modal Open + Submit + Auto-update
// ════════════════════════════════════════════════════════════════

/**
 * Abre o modal de parada longa para a máquina atualmente selecionada.
 */
function openExtendedDowntimeModal() {
    const machineData = window.selectedMachineData;
    if (!machineData || !machineData.machine) {
        showNotification('Selecione uma máquina primeiro', 'warning');
        return;
    }

    const modal = document.getElementById('extended-downtime-modal');
    if (!modal) return;

    // Preencher máquina
    const machineDisplay = modal.querySelector('.machine-display, #extended-downtime-machine-display');
    if (machineDisplay) machineDisplay.textContent = machineData.machine;

    const machineInput = document.getElementById('extended-downtime-machine-input');
    if (machineInput) machineInput.value = machineData.machine;

    // Preencher data/hora atuais
    const now = new Date();
    const dateInput = document.getElementById('extended-downtime-modal-date');
    const timeInput = document.getElementById('extended-downtime-modal-time');
    if (dateInput) dateInput.value = now.toISOString().split('T')[0];
    if (timeInput) timeInput.value = now.toTimeString().slice(0, 5);

    // Popular motivos
    const reasonSelect = document.getElementById('extended-downtime-modal-reason');
    if (reasonSelect) {
        const groupedReasons = getGroupedDowntimeReasons();
        let options = '<option value="">Selecione o motivo...</option>';
        Object.entries(groupedReasons).forEach(([group, reasons]) => {
            options += `<optgroup label="${group}">`;
            reasons.forEach(r => {
                options += `<option value="${r}">${r}</option>`;
            });
            options += '</optgroup>';
        });
        reasonSelect.innerHTML = options;
    }

    openModal('extended-downtime-modal');
}

/**
 * Handler do submit de parada longa via modal.
 */
async function handleExtendedDowntimeSubmit(e) {
    e.preventDefault();
    
    const machineData = window.selectedMachineData;
    if (!machineData?.machine) {
        showNotification('Máquina não selecionada', 'error');
        return;
    }
    
    const reason = document.getElementById('extended-downtime-modal-reason')?.value;
    const startDate = document.getElementById('extended-downtime-modal-date')?.value;
    const startTime = document.getElementById('extended-downtime-modal-time')?.value;
    
    if (!reason) {
        showNotification('Selecione um motivo', 'warning');
        return;
    }
    
    try {
        const startDateTime = new Date(`${startDate}T${startTime}`);
        const userName = getActiveUser()?.name || 'Sistema';
        const category = getDowntimeCategory(reason);
        const shift = getCurrentShift(startDateTime);
        
        await db().collection('extended_downtime_logs').add({
            machine_id: machineData.machine,
            type: reason,
            reason: reason,
            category: category,
            start_date: startDate,
            start_time: startTime,
            start_datetime: firebase.firestore.Timestamp.fromDate(startDateTime),
            status: 'active',
            duration_minutes: 0,
            shift: shift,
            registered_by: userName,
            created_by: userName,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        closeModal('extended-downtime-modal');
        showNotification(`Parada longa registrada para ${machineData.machine}`, 'success');
        
        // Atualizar cards
        const machinesDowntime = await getAllMachinesDowntimeStatus();
        await renderMachineCards([], [], [], new Set(), machinesDowntime);
        
    } catch (error) {
        console.error('[EXTENDED-DOWNTIME] Erro ao registrar:', error);
        showNotification('Erro ao registrar parada', 'error');
    }
}

/**
 * Atualiza duração de paradas longas ativas no Firebase.
 * (Chamado periodicamente pelo auto-update timer)
 */
async function updateActiveExtendedDowntimes() {
    try {
        const snapshot = await db().collection('extended_downtime_logs')
            .where('status', '==', 'active')
            .get();
        
        if (snapshot.empty) return;
        
        const now = new Date();
        const batch = db().batch();
        let count = 0;
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const startTime = data.start_datetime?.toDate?.() || new Date(data.start_date);
            const durationMin = Math.floor((now - startTime) / (1000 * 60));
            
            batch.update(doc.ref, {
                duration_minutes: durationMin,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            count++;
        });
        
        await batch.commit();
        console.log(`[EXTENDED-DOWNTIME] Atualizadas ${count} paradas ativas`);
        
    } catch (error) {
        console.error('[EXTENDED-DOWNTIME] Erro ao atualizar paradas ativas:', error);
    }
}

/**
 * Para o timer de auto-update de paradas longas.
 */
function stopExtendedDowntimeAutoUpdate() {
    if (extendedDowntimeUpdateTimer) {
        clearInterval(extendedDowntimeUpdateTimer);
        extendedDowntimeUpdateTimer = null;
        console.log('[EXTENDED-DOWNTIME] Auto-update parado');
    }
}

/**
 * Handler do submit do formulário de parada longa (aba).
 */
async function handleExtendedDowntimeFormSubmit(e) {
    e.preventDefault();
    
    const machine = document.getElementById('extended-downtime-machine')?.value;
    const reason = document.getElementById('extended-downtime-reason')?.value;
    const startDate = document.getElementById('extended-downtime-start-date')?.value;
    const startTime = document.getElementById('extended-downtime-start-time')?.value;
    const endDate = document.getElementById('extended-downtime-end-date')?.value;
    const endTime = document.getElementById('extended-downtime-end-time')?.value;
    
    const statusDiv = document.getElementById('extended-downtime-status');
    const submitBtn = document.querySelector('#extended-downtime-form button[type="submit"]');
    
    // Validações
    if (!machine || !reason || !startDate || !startTime) {
        if (statusDiv) {
            statusDiv.textContent = '❌ Preencha todos os campos obrigatórios';
            statusDiv.className = 'text-sm font-semibold h-5 text-red-600';
        }
        return;
    }

    try {
        if (submitBtn) submitBtn.disabled = true;
        if (statusDiv) {
            statusDiv.textContent = '⏳ Registrando parada...';
            statusDiv.className = 'text-sm font-semibold h-5 text-blue-600';
        }

        const startDateTime = new Date(`${startDate}T${startTime}`);
        let endDateTime = null;
        let durationMinutes = 0;
        let status = 'active';

        if (endDate && endTime) {
            endDateTime = new Date(`${endDate}T${endTime}`);
            durationMinutes = Math.floor((endDateTime - startDateTime) / (1000 * 60));
            status = 'finished';
        }

        const userName = getActiveUser()?.name || 'Sistema';
        const category = getDowntimeCategory(reason);
        const shift = getCurrentShift(startDateTime);

        // Verificar se é edição (campo oculto com ID) ou novo registro
        const editId = document.getElementById('extended-downtime-edit-id')?.value;
        
        if (editId) {
            // Atualizar registro existente
            await db().collection('extended_downtime_logs').doc(editId).update({
                machine_id: machine,
                type: reason,
                reason: reason,
                category: category,
                start_date: startDate,
                start_time: startTime,
                start_datetime: firebase.firestore.Timestamp.fromDate(startDateTime),
                end_date: endDate || null,
                end_time: endTime || null,
                end_datetime: endDateTime ? firebase.firestore.Timestamp.fromDate(endDateTime) : null,
                status: status,
                duration_minutes: durationMinutes,
                shift: shift,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedBy: userName
            });
            
            if (statusDiv) {
                statusDiv.textContent = '✅ Parada atualizada com sucesso!';
                statusDiv.className = 'text-sm font-semibold h-5 text-green-600';
            }
        } else {
            // Criar novo registro
            await db().collection('extended_downtime_logs').add({
                machine_id: machine,
                type: reason,
                reason: reason,
                category: category,
                start_date: startDate,
                start_time: startTime,
                start_datetime: firebase.firestore.Timestamp.fromDate(startDateTime),
                end_date: endDate || null,
                end_time: endTime || null,
                end_datetime: endDateTime ? firebase.firestore.Timestamp.fromDate(endDateTime) : null,
                status: status,
                duration_minutes: durationMinutes,
                shift: shift,
                registered_by: userName,
                created_by: userName,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            if (statusDiv) {
                statusDiv.textContent = '✅ Parada registrada com sucesso!';
                statusDiv.className = 'text-sm font-semibold h-5 text-green-600';
            }
        }

        registrarLogSistema('REGISTRO DE PARADA LONGA', 'parada', {
            machine: machine,
            reason: reason,
            startDate: startDate,
            endDate: endDate,
            status: status,
            isEdit: !!editId
        });

        showNotification(`Parada ${editId ? 'atualizada' : 'registrada'} com sucesso!`, 'success');

        // Resetar formulário
        setupExtendedDowntimeTab();

        // Atualizar cards de máquinas
        const machinesDowntime = await getAllMachinesDowntimeStatus();
        await renderMachineCards([], [], [], new Set(), machinesDowntime);

    } catch (error) {
        console.error('[PARADAS-LONGAS] Erro ao salvar:', error);
        if (statusDiv) {
            statusDiv.textContent = `❌ Erro: ${error.message}`;
            statusDiv.className = 'text-sm font-semibold h-5 text-red-600';
        }
        showNotification('Erro ao salvar parada', 'error');
    } finally {
        if (submitBtn) submitBtn.disabled = false;
    }
}

// ════════════════════════════════════════════════════════════════
// BLOCK 7 — List Management (filters, cache, rendering)
// ════════════════════════════════════════════════════════════════

/**
 * Inicializa filtros da lista de paradas longas.
 */
function initExtendedDowntimeListFilters() {
    const statusFilter = document.getElementById('downtime-filter-status');
    const machineFilter = document.getElementById('downtime-filter-machine');
    const searchInput = document.getElementById('downtime-search');

    if (statusFilter) {
        statusFilter.addEventListener('change', renderFilteredDowntimeList);
    }
    if (machineFilter) {
        machineFilter.addEventListener('change', renderFilteredDowntimeList);
    }
    if (searchInput) {
        searchInput.addEventListener('input', renderFilteredDowntimeList);
    }
}

/**
 * Popula o filtro de máquinas baseado nas paradas existentes.
 */
function populateDowntimeMachineFilter() {
    const machineFilter = document.getElementById('downtime-filter-machine');
    if (!machineFilter) return;

    const machines = new Set(extendedDowntimeListCache.data.map(d => d.machine_id).filter(Boolean));
    const sorted = [...machines].sort();

    machineFilter.innerHTML = '<option value="">Todas</option>' +
        sorted.map(m => `<option value="${m}">${m}</option>`).join('');
}

/**
 * Atualiza o resumo de paradas (total, ativas, finalizadas).
 */
function updateDowntimeSummary() {
    const data = extendedDowntimeListCache.data;
    const total = data.length;
    const active = data.filter(d => d.status === 'active').length;
    const finished = total - active;

    const totalEl = document.getElementById('downtime-total-count');
    const activeEl = document.getElementById('downtime-active-count');
    const finishedEl = document.getElementById('downtime-finished-count');

    if (totalEl) totalEl.textContent = total;
    if (activeEl) activeEl.textContent = active;
    if (finishedEl) finishedEl.textContent = finished;
}

/**
 * Renderiza a lista filtrada de paradas longas.
 */
function renderFilteredDowntimeList() {
    const statusFilter = document.getElementById('downtime-filter-status')?.value || '';
    const machineFilter = document.getElementById('downtime-filter-machine')?.value || '';
    const searchTerm = (document.getElementById('downtime-search')?.value || '').toLowerCase();

    let filtered = [...extendedDowntimeListCache.data];

    if (statusFilter) {
        filtered = filtered.filter(d => d.status === statusFilter);
    }
    if (machineFilter) {
        filtered = filtered.filter(d => d.machine_id === machineFilter);
    }
    if (searchTerm) {
        filtered = filtered.filter(d =>
            (d.machine_id || '').toLowerCase().includes(searchTerm) ||
            (d.reason || '').toLowerCase().includes(searchTerm) ||
            (d.type || '').toLowerCase().includes(searchTerm) ||
            (d.category || '').toLowerCase().includes(searchTerm)
        );
    }

    renderDowntimeListItems(filtered);
}

/**
 * Renderiza os itens da lista de paradas longas.
 */
function renderDowntimeListItems(items) {
    const container = document.getElementById('extended-downtime-list');
    if (!container) return;

    if (items.length === 0) {
        container.innerHTML = '<div class="text-center py-8 text-gray-400"><p>Nenhuma parada encontrada</p></div>';
        return;
    }

    container.innerHTML = items.map(item => createDowntimeListItemHTML(item)).join('');
    attachExtendedDowntimeEventListeners();

    // Atualizar ícones Lucide
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

/**
 * Cria o HTML de um item da lista de paradas longas.
 */
function createDowntimeListItemHTML(item) {
    const isActive = item.status === 'active';
    
    // Calcular duração
    let durationText = '';
    if (isActive) {
        let startTime;
        if (item.start_datetime?.toDate) {
            startTime = item.start_datetime.toDate();
        } else if (item.start_date && item.start_time) {
            startTime = new Date(`${item.start_date}T${item.start_time}`);
        } else {
            startTime = new Date(item.start_date || Date.now());
        }
        const now = new Date();
        const diffMin = Math.max(0, Math.floor((now - startTime) / (1000 * 60)));
        const days = Math.floor(diffMin / (24 * 60));
        const hours = Math.floor((diffMin % (24 * 60)) / 60);
        const mins = diffMin % 60;
        durationText = days > 0 ? `${days}d ${hours}h ${mins}min` : hours > 0 ? `${hours}h ${mins}min` : `${mins}min`;
        durationText += ' (em andamento)';
    } else {
        const mins = item.duration_minutes || 0;
        const days = Math.floor(mins / (24 * 60));
        const hours = Math.floor((mins % (24 * 60)) / 60);
        const m = mins % 60;
        durationText = days > 0 ? `${days}d ${hours}h ${m}min` : hours > 0 ? `${hours}h ${m}min` : `${m}min`;
    }

    // Determinar cor da categoria
    const categoryColors = {
        'FERRAMENTARIA': 'bg-red-100 text-red-700',
        'PROCESSO': 'bg-purple-100 text-purple-700',
        'COMPRAS': 'bg-yellow-100 text-yellow-700',
        'PREPARAÇÃO': 'bg-orange-100 text-orange-700',
        'QUALIDADE': 'bg-indigo-100 text-indigo-700',
        'MANUTENÇÃO': 'bg-blue-100 text-blue-700',
        'PRODUÇÃO': 'bg-green-100 text-green-700',
        'SETUP': 'bg-amber-100 text-amber-700',
        'ADMINISTRATIVO': 'bg-gray-100 text-gray-700',
        'PCP': 'bg-slate-100 text-slate-700',
        'COMERCIAL': 'bg-cyan-100 text-cyan-700'
    };
    const catColor = categoryColors[item.category] || 'bg-gray-100 text-gray-700';

    // Registrado por
    const registeredBy = item.registered_by || item.registeredBy || item.created_by || '-';
    
    // Período
    const startInfo = `${item.start_date || ''} ${item.start_time || ''}`.trim();
    const endInfo = isActive ? 'em andamento' : `${item.end_date || ''} ${item.end_time || ''}`.trim();

    return `
        <div class="p-4 ${isActive ? 'bg-red-50 border-2 border-red-300 shadow-md' : 'bg-white border border-gray-200'} rounded-xl hover:shadow-lg transition-all">
            <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 ${isActive ? 'bg-gradient-to-br from-red-500 to-red-600' : 'bg-gradient-to-br from-gray-500 to-gray-600'} rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-sm">
                        ${(item.machine_id || '-').slice(-3)}
                    </div>
                    <div>
                        <span class="font-bold text-gray-800">${item.machine_id || '-'}</span>
                        <div class="flex items-center gap-2 mt-0.5">
                            <span class="text-xs px-2 py-0.5 rounded font-medium ${catColor}">${item.category || item.type || '-'}</span>
                            ${isActive 
                                ? '<span class="text-xs px-2 py-0.5 rounded bg-red-100 text-red-700 font-semibold animate-pulse">🔴 Ativa</span>'
                                : '<span class="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700 font-semibold">✅ Finalizada</span>'
                            }
                        </div>
                    </div>
                </div>
                <div class="text-right">
                    <div class="text-sm font-bold ${isActive ? 'text-red-600' : 'text-gray-700'}">${durationText}</div>
                    <div class="text-xs text-gray-400 mt-0.5">${registeredBy}</div>
                </div>
            </div>
            
            <div class="flex items-center justify-between">
                <div class="text-xs text-gray-500">
                    <span class="font-medium">Motivo:</span> ${item.reason || item.type || '-'} |
                    <span class="font-medium">Início:</span> ${startInfo} |
                    <span class="font-medium">Fim:</span> ${endInfo}
                </div>
                <div class="flex items-center gap-1.5">
                    ${isActive ? `
                        <button class="btn-finish-extended-downtime bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm flex items-center gap-1" 
                            data-id="${item.id}" data-machine="${item.machine_id}">
                            <i data-lucide="check-circle" class="w-3.5 h-3.5"></i>
                            <span>Finalizar</span>
                        </button>
                    ` : ''}
                    <button class="btn-edit-extended-downtime bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm flex items-center gap-1"
                        data-id="${item.id}" data-machine="${item.machine_id}">
                        <i data-lucide="edit-2" class="w-3.5 h-3.5"></i>
                        <span>Editar</span>
                    </button>
                    <button class="btn-delete-extended-downtime bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm flex items-center gap-1"
                        data-id="${item.id}" data-machine="${item.machine_id}">
                        <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                        <span>Excluir</span>
                    </button>
                </div>
            </div>
        </div>
    `;
}

/**
 * Handler para finalizar uma parada longa ativa.
 */
async function handleFinishExtendedDowntime(e) {
    // ⚠️ VERIFICAÇÃO DE PERMISSÃO: Apenas gestores podem finalizar
    if (!isUserGestorOrAdmin()) {
        showPermissionDeniedNotification('finalizar paradas longas');
        return;
    }
    
    const btn = e.currentTarget;
    const recordId = btn.dataset.id;
    const machine = btn.dataset.machine;
    
    if (!confirm(`Finalizar a parada da máquina ${machine}?`)) return;
    
    try {
        btn.disabled = true;
        btn.textContent = 'Finalizando...';
        
        const doc = await db().collection('extended_downtime_logs').doc(recordId).get();
        if (!doc.exists) {
            showNotification('Registro não encontrado', 'error');
            return;
        }
        
        const data = doc.data();
        const now = new Date();
        const startTime = data.start_datetime?.toDate?.() || new Date(data.start_date);
        const durationMin = Math.floor((now - startTime) / (1000 * 60));
        
        const userName = getActiveUser()?.name || 'Sistema';
        
        await db().collection('extended_downtime_logs').doc(recordId).update({
            status: 'finished',
            end_date: now.toISOString().split('T')[0],
            end_time: now.toTimeString().slice(0, 5),
            end_datetime: firebase.firestore.Timestamp.fromDate(now),
            duration_minutes: durationMin,
            finished_by: userName,
            finishedBy: userName,
            finishedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        registrarLogSistema('FINALIZAÇÃO DE PARADA LONGA', 'parada', {
            recordId: recordId,
            machine: machine,
            durationMinutes: durationMin
        });
        
        showNotification(`Parada da ${machine} finalizada (${durationMin} min)`, 'success');
        
        // Recarregar lista
        await loadExtendedDowntimeList();
        
        // Atualizar cards
        const machinesDowntime = await getAllMachinesDowntimeStatus();
        await renderMachineCards([], [], [], new Set(), machinesDowntime);
        
    } catch (error) {
        console.error('[EXTENDED-DOWNTIME] Erro ao finalizar:', error);
        showNotification('Erro ao finalizar parada', 'error');
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="check-circle" class="w-3.5 h-3.5"></i><span>Finalizar</span>';
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
}

/**
 * Carrega a lista completa de paradas longas do Firebase.
 */
async function loadExtendedDowntimeList() {
    if (extendedDowntimeListCache.isLoading) return;
    extendedDowntimeListCache.isLoading = true;

    try {
        console.log('[EXTENDED-DOWNTIME] Carregando lista...');
        
        const snapshot = await db().collection('extended_downtime_logs')
            .orderBy('createdAt', 'desc')
            .limit(100)
            .get();

        const seenIds = new Set();
        const data = [];
        
        snapshot.forEach(doc => {
            if (!seenIds.has(doc.id)) {
                seenIds.add(doc.id);
                data.push({ id: doc.id, ...doc.data() });
            }
        });

        extendedDowntimeListCache.data = data;
        extendedDowntimeListCache.lastLoad = Date.now();

        console.log('[EXTENDED-DOWNTIME] Lista carregada:', data.length, 'registros');

        // Atualizar UI
        updateDowntimeSummary();
        populateDowntimeMachineFilter();
        renderFilteredDowntimeList();
        initExtendedDowntimeListFilters();

    } catch (error) {
        console.error('[EXTENDED-DOWNTIME] Erro ao carregar lista:', error);
    } finally {
        extendedDowntimeListCache.isLoading = false;
    }
}

/**
 * Anexa event listeners aos botões de ação da lista de paradas.
 */
function attachExtendedDowntimeEventListeners() {
    // Finalizar
    document.querySelectorAll('.btn-finish-extended-downtime').forEach(btn => {
        btn.addEventListener('click', handleFinishExtendedDowntime);
    });
    
    // Editar
    document.querySelectorAll('.btn-edit-extended-downtime').forEach(btn => {
        btn.addEventListener('click', handleEditExtendedDowntime);
    });
    
    // Excluir
    document.querySelectorAll('.btn-delete-extended-downtime').forEach(btn => {
        btn.addEventListener('click', handleDeleteExtendedDowntime);
    });
}

// ════════════════════════════════════════════════════════════════
// BLOCK 8 — Edit Modal + Edit/Delete Handlers
// ════════════════════════════════════════════════════════════════

/**
 * Inicializa o modal de edição completa de paradas longas.
 */
function initEditExtendedDowntimeModal() {
    const modal = document.getElementById('edit-extended-downtime-modal');
    if (!modal) return;
    
    const closeBtn = document.getElementById('edit-extended-downtime-close');
    const cancelBtn = document.getElementById('edit-downtime-cancel');
    const form = document.getElementById('edit-extended-downtime-form');
    const isActiveCheckbox = document.getElementById('edit-downtime-is-active');
    const categorySelect = document.getElementById('edit-downtime-category');
    
    // Fechar modal
    if (closeBtn) {
        closeBtn.addEventListener('click', () => closeEditDowntimeModal());
    }
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => closeEditDowntimeModal());
    }
    
    // Fechar ao clicar fora
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeEditDowntimeModal();
    });
    
    // Toggle campos de fim quando checkbox "ativa" mudar
    if (isActiveCheckbox) {
        isActiveCheckbox.addEventListener('change', () => {
            toggleEndFields(isActiveCheckbox.checked);
            calculateEditDuration();
        });
    }
    
    // Atualizar duração quando datas/horas mudarem
    ['edit-downtime-start-date', 'edit-downtime-start-time', 'edit-downtime-end-date', 'edit-downtime-end-time'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', calculateEditDuration);
    });
    
    // Atualizar motivos quando categoria mudar
    if (categorySelect) {
        categorySelect.addEventListener('change', () => {
            updateEditDowntimeReasons(categorySelect.value);
        });
    }
    
    // Submit do formulário
    if (form) {
        form.addEventListener('submit', handleEditDowntimeSubmit);
    }
    
    // Popular select de máquinas
    populateEditDowntimeMachines();
    
    console.log('[EDIT-DOWNTIME-MODAL] Modal inicializado');
}

/**
 * Popula o select de máquinas no modal de edição.
 */
function populateEditDowntimeMachines() {
    const machineSelect = document.getElementById('edit-downtime-machine');
    if (!machineSelect) return;
    
    const validMachines = ['H01', 'H02', 'H03', 'H04', 'H05', 'H06', 'H07', 'H08', 'H09', 'H10', 
                           'H12', 'H13', 'H14', 'H15', 'H16', 'H17', 'H18', 'H19', 'H20', 
                           'H26', 'H27', 'H28', 'H29', 'H30', 'H31', 'H32'];
    
    machineSelect.innerHTML = '<option value="">Selecione a máquina...</option>' +
        validMachines.map(m => `<option value="${m}">${m}</option>`).join('');
}

/**
 * Atualiza os motivos baseado na categoria selecionada.
 */
function updateEditDowntimeReasons(category) {
    const reasonSelect = document.getElementById('edit-downtime-reason');
    if (!reasonSelect) return;
    
    const motivosPorCategoria = {
        'FERRAMENTARIA': ['CORRETIVA DE MOLDE', 'PREVENTIVA DE MOLDE', 'TROCA DE VERSÃO', 'AJUSTE DE MOLDE'],
        'PROCESSO': ['ABERTURA DE CAVIDADE', 'AJUSTE DE PROCESSO', 'TRY OUT', 'TESTE DE PROCESSO'],
        'COMPRAS': ['FALTA DE INSUMO PLANEJADA', 'FALTA DE INSUMO NÃO PLANEJADA', 'ATRASO FORNECEDOR', 'FALTA DE MATÉRIA PRIMA'],
        'PREPARAÇÃO': ['AGUARDANDO PREPARAÇÃO DE MATERIAL', 'SECAGEM DE MATERIAL', 'PREPARAÇÃO DE PIGMENTO'],
        'QUALIDADE': ['AGUARDANDO CLIENTE/FORNECEDOR', 'LIBERAÇÃO', 'INSPEÇÃO', 'ANÁLISE DE DEFEITO'],
        'MANUTENÇÃO': ['MANUTENÇÃO CORRETIVA', 'MANUTENÇÃO PREVENTIVA', 'MANUTENÇÃO PROGRAMADA', 'MANUTENÇÃO EMERGENCIAL'],
        'PRODUÇÃO': ['FALTA DE OPERADOR', 'TROCA DE COR', 'LIMPEZA', 'ORGANIZAÇÃO'],
        'SETUP': ['INSTALAÇÃO DE MOLDE', 'RETIRADA DE MOLDE', 'TROCA DE MOLDE', 'AQUECIMENTO'],
        'ADMINISTRATIVO': ['FALTA DE ENERGIA', 'FALTA DE ÁGUA', 'QUEDA DE ENERGIA', 'FERIADO', 'FIM DE SEMANA'],
        'PCP': ['SEM PROGRAMAÇÃO', 'SEM PROGRAMAÇÃO-FIM DE SEMANA', 'ESTRATÉGIA PCP', 'AGUARDANDO OP'],
        'COMERCIAL': ['SEM PEDIDO', 'BAIXA DEMANDA', 'PARADA COMERCIAL']
    };
    
    const motivos = motivosPorCategoria[category] || [];
    reasonSelect.innerHTML = '<option value="">Selecione o motivo...</option>' +
        motivos.map(m => `<option value="${m}">${m}</option>`).join('');
}

/**
 * Toggle dos campos de fim (habilita/desabilita baseado no checkbox "ativa").
 */
function toggleEndFields(isActive) {
    const endFields = document.getElementById('edit-downtime-end-fields');
    const activeMsg = document.getElementById('edit-downtime-active-msg');
    const endDateInput = document.getElementById('edit-downtime-end-date');
    const endTimeInput = document.getElementById('edit-downtime-end-time');
    
    if (isActive) {
        endFields?.classList.add('opacity-50', 'pointer-events-none');
        activeMsg?.classList.remove('hidden');
        if (endDateInput) endDateInput.required = false;
        if (endTimeInput) endTimeInput.required = false;
    } else {
        endFields?.classList.remove('opacity-50', 'pointer-events-none');
        activeMsg?.classList.add('hidden');
        if (endDateInput) endDateInput.required = true;
        if (endTimeInput) endTimeInput.required = true;
    }
}

/**
 * Calcula e exibe a duração da parada no modal de edição.
 */
function calculateEditDuration() {
    const startDate = document.getElementById('edit-downtime-start-date')?.value;
    const startTime = document.getElementById('edit-downtime-start-time')?.value;
    const endDate = document.getElementById('edit-downtime-end-date')?.value;
    const endTime = document.getElementById('edit-downtime-end-time')?.value;
    const isActive = document.getElementById('edit-downtime-is-active')?.checked;
    const durationEl = document.getElementById('edit-downtime-duration');
    
    if (!durationEl) return;
    
    if (!startDate || !startTime) {
        durationEl.textContent = '--';
        return;
    }
    
    const start = new Date(`${startDate}T${startTime}`);
    let end;
    
    if (isActive) {
        end = new Date(); // Usar agora como fim
    } else if (endDate && endTime) {
        end = new Date(`${endDate}T${endTime}`);
    } else {
        durationEl.textContent = '--';
        return;
    }
    
    const diffMs = end - start;
    if (diffMs < 0) {
        durationEl.textContent = '⚠️ Inválido';
        durationEl.classList.add('text-red-600');
        return;
    }
    
    durationEl.classList.remove('text-red-600');
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const days = Math.floor(diffMinutes / (24 * 60));
    const hours = Math.floor((diffMinutes % (24 * 60)) / 60);
    const minutes = diffMinutes % 60;
    
    let text = '';
    if (days > 0) text += `${days}d `;
    if (hours > 0 || days > 0) text += `${hours}h `;
    text += `${minutes}min`;
    
    if (isActive) text += ' (até agora)';
    
    durationEl.textContent = text.trim();
}

/**
 * Abre o modal de edição com os dados da parada.
 */
async function openEditDowntimeModal(recordId) {
    const modal = document.getElementById('edit-extended-downtime-modal');
    if (!modal) {
        console.error('[EDIT-DOWNTIME] Modal não encontrado');
        return;
    }
    
    try {
        // Buscar dados atuais do Firebase
        const doc = await db().collection('extended_downtime_logs').doc(recordId).get();
        if (!doc.exists) {
            alert('Registro não encontrado!');
            return;
        }
        
        const data = doc.data();
        console.log('[EDIT-DOWNTIME] Dados carregados:', data);
        
        // Preencher campos
        document.getElementById('edit-downtime-id').value = recordId;
        document.getElementById('edit-downtime-machine').value = data.machine_id || '';
        document.getElementById('edit-downtime-machine-display').textContent = data.machine_id || '-';
        
        // Categoria e motivo
        const categorySelect = document.getElementById('edit-downtime-category');
        if (categorySelect) {
            categorySelect.value = data.category || '';
            updateEditDowntimeReasons(data.category || '');
        }
        
        // Aguardar um pouco para os motivos serem carregados
        setTimeout(() => {
            const reasonSelect = document.getElementById('edit-downtime-reason');
            if (reasonSelect) reasonSelect.value = data.reason || data.type || '';
        }, 100);
        
        // Datas e horas de início
        document.getElementById('edit-downtime-start-date').value = data.start_date || '';
        document.getElementById('edit-downtime-start-time').value = data.start_time || '00:00';
        
        // Status (ativa ou finalizada)
        const isActive = data.status === 'active';
        const isActiveCheckbox = document.getElementById('edit-downtime-is-active');
        const statusBadge = document.getElementById('edit-downtime-status-badge');
        
        if (isActiveCheckbox) isActiveCheckbox.checked = isActive;
        if (statusBadge) {
            if (isActive) {
                statusBadge.textContent = '🔴 ATIVA';
                statusBadge.className = 'text-xs px-2 py-1 rounded bg-red-100 text-red-700 font-semibold animate-pulse';
            } else {
                statusBadge.textContent = '✅ FINALIZADA';
                statusBadge.className = 'text-xs px-2 py-1 rounded bg-green-100 text-green-700 font-semibold';
            }
        }
        
        // Datas e horas de fim
        document.getElementById('edit-downtime-end-date').value = data.end_date || '';
        document.getElementById('edit-downtime-end-time').value = data.end_time || '';
        
        // Atualizar estado dos campos de fim
        toggleEndFields(isActive);
        
        // Calcular duração
        calculateEditDuration();
        
        // Mostrar modal
        modal.classList.remove('hidden');
        lucide.createIcons();
        
    } catch (error) {
        console.error('[EDIT-DOWNTIME] Erro ao carregar dados:', error);
        alert('Erro ao carregar dados da parada: ' + error.message);
    }
}

/**
 * Fecha o modal de edição.
 */
function closeEditDowntimeModal() {
    const modal = document.getElementById('edit-extended-downtime-modal');
    if (modal) modal.classList.add('hidden');
    
    // Limpar status
    const statusDiv = document.getElementById('edit-downtime-status');
    if (statusDiv) {
        statusDiv.textContent = '';
        statusDiv.className = 'text-sm font-semibold h-5 text-center';
    }
}

/**
 * Handler do submit do formulário de edição.
 */
async function handleEditDowntimeSubmit(e) {
    e.preventDefault();
    
    const recordId = document.getElementById('edit-downtime-id')?.value;
    const machine = document.getElementById('edit-downtime-machine')?.value;
    const category = document.getElementById('edit-downtime-category')?.value;
    const reason = document.getElementById('edit-downtime-reason')?.value;
    const startDate = document.getElementById('edit-downtime-start-date')?.value;
    const startTime = document.getElementById('edit-downtime-start-time')?.value;
    const endDate = document.getElementById('edit-downtime-end-date')?.value;
    const endTime = document.getElementById('edit-downtime-end-time')?.value;
    const isActive = document.getElementById('edit-downtime-is-active')?.checked;
    
    const statusDiv = document.getElementById('edit-downtime-status');
    const submitBtn = document.getElementById('edit-downtime-submit');
    
    // Validações
    if (!machine || !category || !reason || !startDate || !startTime) {
        if (statusDiv) {
            statusDiv.textContent = '❌ Preencha todos os campos obrigatórios';
            statusDiv.className = 'text-sm font-semibold h-5 text-center text-red-600';
        }
        return;
    }
    
    // Se não está ativa, precisa de data/hora de fim
    if (!isActive && (!endDate || !endTime)) {
        if (statusDiv) {
            statusDiv.textContent = '❌ Informe a data/hora de fim ou marque como ativa';
            statusDiv.className = 'text-sm font-semibold h-5 text-center text-red-600';
        }
        return;
    }
    
    // Validar que fim é depois do início (se não está ativa)
    if (!isActive) {
        const start = new Date(`${startDate}T${startTime}`);
        const end = new Date(`${endDate}T${endTime}`);
        if (end <= start) {
            if (statusDiv) {
                statusDiv.textContent = '❌ Data/hora de fim deve ser posterior ao início';
                statusDiv.className = 'text-sm font-semibold h-5 text-center text-red-600';
            }
            return;
        }
    }
    
    try {
        if (submitBtn) submitBtn.disabled = true;
        if (statusDiv) {
            statusDiv.textContent = '⏳ Salvando alterações...';
            statusDiv.className = 'text-sm font-semibold h-5 text-center text-blue-600';
        }
        
        const startDateTime = new Date(`${startDate}T${startTime}`);
        let endDateTime = null;
        let durationMinutes = 0;
        
        if (!isActive && endDate && endTime) {
            endDateTime = new Date(`${endDate}T${endTime}`);
            durationMinutes = Math.floor((endDateTime - startDateTime) / (1000 * 60));
        } else if (isActive) {
            // Para paradas ativas, calcular duração até agora
            durationMinutes = Math.floor((new Date() - startDateTime) / (1000 * 60));
        }
        
        const userName = getActiveUser()?.name || 'Sistema';
        
        const updateData = {
            machine_id: machine,
            category: category,
            type: reason,
            reason: reason,
            start_date: startDate,
            start_time: startTime,
            start_datetime: firebase.firestore.Timestamp.fromDate(startDateTime),
            end_date: isActive ? null : endDate,
            end_time: isActive ? null : endTime,
            end_datetime: isActive ? null : (endDateTime ? firebase.firestore.Timestamp.fromDate(endDateTime) : null),
            status: isActive ? 'active' : 'finished',
            duration_minutes: durationMinutes,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: userName,
            shift: getCurrentShift(startDateTime)
        };
        
        // Se estava ativa e foi finalizada agora
        if (!isActive && endDateTime) {
            updateData.finishedAt = firebase.firestore.FieldValue.serverTimestamp();
            updateData.finishedBy = userName;
        }
        
        await db().collection('extended_downtime_logs').doc(recordId).update(updateData);
        
        console.log('[EDIT-DOWNTIME] Parada atualizada:', recordId, updateData);
        
        // Registrar log
        registrarLogSistema('EDIÇÃO DE PARADA LONGA', 'parada', {
            recordId: recordId,
            machine: machine,
            startDate: startDate,
            endDate: endDate,
            status: isActive ? 'active' : 'finished'
        });
        
        if (statusDiv) {
            statusDiv.textContent = '✅ Parada atualizada com sucesso!';
            statusDiv.className = 'text-sm font-semibold h-5 text-center text-green-600';
        }
        
        // Fechar modal após 1.5s
        setTimeout(async () => {
            closeEditDowntimeModal();
            
            // Recarregar listas
            if (typeof loadExtendedDowntimeList === 'function') {
                await loadExtendedDowntimeList();
            }
            
            // Se análise está visível, recarregar
            if (document.querySelector('#extended-downtime-analysis-list')) {
                const filters = (window.currentAnalysisFilters) || {};
                await loadExtendedDowntimeAnalysis(filters.startDate, filters.endDate, filters.machine);
            }
            
            // Recarregar cards de máquinas
            const machinesDowntime = await getAllMachinesDowntimeStatus();
            await renderMachineCards([], [], [], new Set(), machinesDowntime);
            
        }, 1500);
        
    } catch (error) {
        console.error('[EDIT-DOWNTIME] Erro ao salvar:', error);
        if (statusDiv) {
            statusDiv.textContent = `❌ Erro: ${error.message}`;
            statusDiv.className = 'text-sm font-semibold h-5 text-center text-red-600';
        }
    } finally {
        if (submitBtn) submitBtn.disabled = false;
    }
}

/**
 * Handler para editar parada longa — ABRE O MODAL COMPLETO.
 */
async function handleEditExtendedDowntime(e) {
    // ⚠️ VERIFICAÇÃO DE PERMISSÃO: Apenas gestores podem editar
    if (!isUserGestorOrAdmin()) {
        showPermissionDeniedNotification('editar paradas longas');
        return;
    }
    
    const btn = e.currentTarget;
    const recordId = btn.dataset.id;
    
    console.log('[EXTENDED-DOWNTIME] Abrindo modal de edição para:', recordId);
    
    // Abrir o novo modal completo
    await openEditDowntimeModal(recordId);
}

/**
 * Handler para excluir parada longa.
 */
async function handleDeleteExtendedDowntime(e) {
    // ⚠️ VERIFICAÇÃO DE PERMISSÃO: Apenas gestores podem excluir
    if (!isUserGestorOrAdmin()) {
        showPermissionDeniedNotification('excluir paradas longas');
        return;
    }
    
    const btn = e.currentTarget;
    const recordId = btn.dataset.id;
    const machine = btn.dataset.machine;

    console.log('[EXTENDED-DOWNTIME] Deletando registro:', recordId);

    if (!confirm(`Tem certeza que deseja excluir a parada da máquina ${machine}?`)) {
        return;
    }

    try {
        btn.disabled = true;
        btn.textContent = 'Excluindo...';

        await db().collection('extended_downtime_logs').doc(recordId).delete();

        console.log('[EXTENDED-DOWNTIME] Registro excluído com sucesso');
        
        // Registrar log
        registrarLogSistema('EXCLUSÃO DE PARADA ESTENDIDA', 'parada', {
            recordId: recordId,
            machine: machine
        });
        
        // Recarregar lista e análise
        await loadExtendedDowntimeList();
        
        // Se estiver na análise, recarregar também
        if (document.querySelector('#extended-downtime-analysis-list')) {
            const filters = window.currentAnalysisFilters || {};
            await loadExtendedDowntimeAnalysis(filters.startDate, filters.endDate, filters.machine);
        }

    } catch (error) {
        console.error('[EXTENDED-DOWNTIME] Erro ao excluir:', error);
        alert('Erro ao excluir parada: ' + error.message);
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="trash-2" class="w-4 h-4"></i><span>Excluir</span>';
        lucide.createIcons();
    }
}

// ════════════════════════════════════════════════════════════════
// BLOCK 3 — Analysis Rendering (loadExtendedDowntimeAnalysis)
// ════════════════════════════════════════════════════════════════

/**
 * Carrega e renderiza paradas longas na aba de análise.
 */
async function loadExtendedDowntimeAnalysis(startDate, endDate, machine) {
    console.log('[EXTENDED-DOWNTIME] Carregando paradas longas para análise', { startDate, endDate, machine });
    
    try {
        // ✅ OTIMIZADO: Usar cache em vez de buscar diretamente do Firebase
        const allData = await getExtendedDowntimesCached();
        
        let data = [];
        const seenAnalysisIds = new Set();
        
        console.log('[EXTENDED-DOWNTIME] Total de registros (cache):', allData.length);
        
        allData.forEach(item => {
            const d = item;
            if (!item.id) return;
            if (seenAnalysisIds.has(item.id)) return;
            
            // Pegar data do registro (pode estar em diferentes campos)
            const recordDate = d.start_date || d.date || '';
            
            // Verificar se está no período OU se está ativa (paradas ativas sempre aparecem)
            const isActive = d.status === 'active';
            const isInPeriod = recordDate >= startDate && recordDate <= endDate;
            
            if (!isActive && !isInPeriod) {
                return;
            }
            
            // Filtrar por máquina se selecionada
            const machineId = d.machine_id || d.machine || '';
            if (machine && machine !== 'all' && machine !== '' && machineId !== machine) {
                return;
            }
            
            seenAnalysisIds.add(item.id);
            data.push({ id: item.id, ...d, machine_id: machineId });
            
            if (isActive) {
                console.log('[EXTENDED-DOWNTIME] Incluindo ATIVA:', machineId, recordDate, d.status);
            }
        });

        console.log('[EXTENDED-DOWNTIME] Registros filtrados:', data.length);
        console.log('[EXTENDED-DOWNTIME] Máquinas:', [...new Set(data.map(d => d.machine_id))].join(', '));
        
        data.forEach((d, i) => {
            console.log(`[EXTENDED-DOWNTIME] [${i+1}] ${d.machine_id} | ${d.start_date || d.date} | status: ${d.status || 'N/A'} | type: ${d.type}`);
        });

        // Mapear tipos antigos para motivos reconhecíveis por getDowntimeCategory
        const oldTypeToReason = {
            'weekend': 'FIM DE SEMANA',
            'maintenance': 'MANUTENÇÃO PROGRAMADA',
            'preventive': 'MANUTENÇÃO PREVENTIVA',
            'holiday': 'FERIADO',
            'no_order': 'SEM PEDIDO',
            'commercial': 'PARADA COMERCIAL',
            'setup': 'SETUP/TROCA',
            'other': ''
        };

        // Agrupar horas por CATEGORIA real usando getDowntimeCategory
        const categoryHours = {};

        data.forEach(item => {
            let hours = 0;
            if (item.status === 'active' && item.start_datetime) {
                const startTime = item.start_datetime?.toDate?.() || new Date(item.start_date);
                const now = new Date();
                const durationMin = Math.floor((now - startTime) / (1000 * 60));
                hours = durationMin / 60;
            } else {
                hours = (item.duration_minutes || 0) / 60;
            }
            
            let reasonForCategory = (item.reason || '').trim();
            
            if (!reasonForCategory) {
                const typeKey = (item.type || '').toLowerCase();
                reasonForCategory = oldTypeToReason[typeKey] || item.type || '';
            }
            
            let assignedCategory;
            if (item.category && item.category.trim()) {
                assignedCategory = item.category.trim().toUpperCase();
            } else {
                assignedCategory = getDowntimeCategory(reasonForCategory);
            }
            
            categoryHours[assignedCategory] = (categoryHours[assignedCategory] || 0) + hours;
            
            console.log(`[EXTENDED-DOWNTIME] ${item.machine_id} | reason="${item.reason}" | category="${item.category}" | type="${item.type}" => ${assignedCategory} (${hours.toFixed(1)}h)`);
        });

        console.log('[EXTENDED-DOWNTIME] Distribuição por categoria:', categoryHours);

        // Cores e estilos por categoria
        const categoryStyles = {
            'FERRAMENTARIA': { bg: 'bg-red-50', border: 'border-red-100', text: 'text-red-700', textSub: 'text-red-600', label: 'moldes' },
            'PROCESSO':      { bg: 'bg-purple-50', border: 'border-purple-100', text: 'text-purple-700', textSub: 'text-purple-600', label: 'técnico' },
            'COMPRAS':       { bg: 'bg-yellow-50', border: 'border-yellow-100', text: 'text-yellow-700', textSub: 'text-yellow-600', label: 'insumos' },
            'PREPARAÇÃO':    { bg: 'bg-orange-50', border: 'border-orange-100', text: 'text-orange-700', textSub: 'text-orange-600', label: 'material' },
            'QUALIDADE':     { bg: 'bg-indigo-50', border: 'border-indigo-100', text: 'text-indigo-700', textSub: 'text-indigo-600', label: 'inspeção' },
            'MANUTENÇÃO':    { bg: 'bg-blue-50', border: 'border-blue-100', text: 'text-blue-700', textSub: 'text-blue-600', label: 'planejada' },
            'PRODUÇÃO':      { bg: 'bg-green-50', border: 'border-green-100', text: 'text-green-700', textSub: 'text-green-600', label: 'operação' },
            'SETUP':         { bg: 'bg-amber-50', border: 'border-amber-100', text: 'text-amber-700', textSub: 'text-amber-600', label: 'troca' },
            'ADMINISTRATIVO':{ bg: 'bg-gray-50', border: 'border-gray-100', text: 'text-gray-700', textSub: 'text-gray-600', label: 'feriado/energia' },
            'PCP':           { bg: 'bg-slate-50', border: 'border-slate-100', text: 'text-slate-700', textSub: 'text-slate-600', label: 'programação' },
            'COMERCIAL':     { bg: 'bg-cyan-50', border: 'border-cyan-100', text: 'text-cyan-700', textSub: 'text-cyan-600', label: 'sem pedido' },
            'OUTROS':        { bg: 'bg-stone-50', border: 'border-stone-100', text: 'text-stone-700', textSub: 'text-stone-600', label: 'diversos' }
        };

        const defaultStyle = { bg: 'bg-gray-50', border: 'border-gray-100', text: 'text-gray-700', textSub: 'text-gray-600', label: '' };

        // Gerar cards dinamicamente
        const cardsContainer = document.getElementById('extended-downtime-category-cards');
        if (cardsContainer) {
            const sortedCategories = Object.entries(categoryHours)
                .filter(([, h]) => h > 0)
                .sort((a, b) => b[1] - a[1]);

            if (sortedCategories.length === 0) {
                cardsContainer.innerHTML = '<div class="col-span-full text-center py-4 text-gray-400 text-sm">Nenhuma parada no período</div>';
            } else {
                cardsContainer.innerHTML = sortedCategories.map(([cat, hours]) => {
                    const style = categoryStyles[cat] || defaultStyle;
                    return `
                        <div class="${style.bg} rounded-xl p-4 text-center shadow-sm border ${style.border} hover:shadow-md transition">
                            <p class="text-xs ${style.text} font-medium mb-2">${cat}</p>
                            <p class="text-2xl font-bold ${style.text}">${hours.toFixed(1)}h</p>
                            <p class="text-xs ${style.textSub} mt-1">${style.label}</p>
                        </div>
                    `;
                }).join('');
            }
        }

        document.getElementById('extended-downtime-total').textContent = `${data.length} registros`;

        // Renderizar lista
        const listContainer = document.getElementById('extended-downtime-analysis-list');
        if (data.length === 0) {
            listContainer.innerHTML = '<p class="text-sm text-gray-500 text-center py-4">Nenhuma parada longa no período selecionado.</p>';
        } else {
            listContainer.innerHTML = data.map(item => {
                let hours;
                const isActive = item.status === 'active';
                
                if (isActive) {
                    let startTime;
                    if (item.start_datetime?.toDate) {
                        startTime = item.start_datetime.toDate();
                    } else if (item.start_date && item.start_time) {
                        startTime = new Date(`${item.start_date}T${item.start_time}`);
                    } else if (item.start_date) {
                        startTime = new Date(item.start_date);
                    } else {
                        startTime = new Date();
                    }
                    const now = new Date();
                    const durationMin = Math.max(0, Math.floor((now - startTime) / (1000 * 60)));
                    hours = (durationMin / 60).toFixed(1);
                } else {
                    hours = ((item.duration_minutes || 0) / 60).toFixed(1);
                }
                
                const type = (item.type || '').toUpperCase();
                const reason = (item.reason || '').toUpperCase();
                const category = (item.category || '').toUpperCase();
                
                let typeLabel = item.reason || item.type || 'Outro';
                let typeColor = 'bg-gray-100 text-gray-700';
                
                if (type === 'weekend' || reason.includes('FIM DE SEMANA') || reason.includes('SEM PROGRAMAÇÃO-FIM DE SEMANA')) {
                    typeColor = 'bg-gray-200 text-gray-800';
                } else if (type === 'maintenance' || type === 'preventive' || 
                    reason.includes('MANUTENÇÃO') || category === 'MANUTENÇÃO') {
                    typeColor = 'bg-blue-100 text-blue-700';
                } else if (type === 'holiday' || reason.includes('FERIADO')) {
                    typeColor = 'bg-amber-100 text-amber-700';
                } else if (category === 'COMERCIAL' || reason.includes('SEM PEDIDO') || reason.includes('PARADA COMERCIAL')) {
                    typeColor = 'bg-cyan-100 text-cyan-700';
                } else if (category === 'PCP') {
                    typeColor = 'bg-slate-100 text-slate-700';
                } else {
                    typeColor = 'bg-red-100 text-red-700';
                }
                
                let statusBadge;
                if (isActive) {
                    statusBadge = '<span class="text-xs px-2 py-1 rounded bg-red-100 text-red-700 font-semibold animate-pulse">🔴 ATIVA</span>';
                } else if (item.status === 'inactive' || item.status === 'registered' || item.status === 'finished') {
                    statusBadge = '<span class="text-xs px-2 py-1 rounded bg-green-100 text-green-700 font-semibold">✅ FINALIZADA</span>';
                } else {
                    statusBadge = `<span class="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700 font-semibold">${item.status || 'N/A'}</span>`;
                }
                
                const startTimeStr = item.start_time || '00:00';
                const endTimeStr = item.end_time || '23:59';
                let periodText;
                if (isActive) {
                    periodText = `Início: ${item.start_date || ''} às ${startTimeStr} (em andamento)`;
                } else {
                    periodText = `${item.start_date || ''} ${startTimeStr} → ${item.end_date || ''} ${endTimeStr}`;
                }
                
                const registeredBy = item.registered_by || item.registeredBy || item.created_by || '-';
                const finishedBy = item.finished_by || item.finishedBy || '-';
                const createdAt = item.createdAt?.toDate?.() 
                    ? item.createdAt.toDate().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                    : '-';
                const finishedAt = item.finishedAt?.toDate?.()
                    ? item.finishedAt.toDate().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                    : (isActive ? '-' : (item.end_date || '-'));
                
                return `
                    <div class="p-4 ${isActive ? 'bg-red-50 border-2 border-red-300' : 'bg-gray-50 border border-gray-200'} rounded-xl hover:shadow-md transition-all">
                        <!-- Header com máquina e status -->
                        <div class="flex items-center justify-between mb-3">
                            <div class="flex items-center gap-3">
                                <div class="w-10 h-10 bg-gradient-to-br ${isActive ? 'from-red-500 to-red-600' : 'from-gray-500 to-gray-600'} rounded-lg flex items-center justify-center text-white font-bold text-sm">
                                    ${(item.machine_id || '-').slice(-2)}
                                </div>
                                <div>
                                    <span class="font-bold text-base text-gray-800">${item.machine_id || '-'}</span>
                                    <div class="flex items-center gap-2 mt-0.5">
                                        <span class="text-xs px-2 py-0.5 rounded ${typeColor}">${typeLabel}</span>
                                        ${statusBadge}
                                    </div>
                                </div>
                            </div>
                            <div class="flex items-center gap-2">
                                <span class="text-xl font-bold ${isActive ? 'text-red-600' : 'text-gray-700'}">${hours}h</span>
                                <button class="btn-edit-extended-downtime-analysis bg-blue-500 hover:bg-blue-600 text-white px-2.5 py-1.5 rounded-lg text-xs font-semibold transition shadow-sm" data-id="${item.id}" data-machine="${item.machine_id}" data-type="${item.type}" data-start-date="${item.start_date}" data-end-date="${item.end_date || ''}" data-reason="${item.reason}" data-start-time="${startTimeStr}" data-end-time="${endTimeStr}">
                                    <i data-lucide="edit-2" class="w-3.5 h-3.5"></i>
                                </button>
                                <button class="btn-delete-extended-downtime-analysis bg-red-500 hover:bg-red-600 text-white px-2.5 py-1.5 rounded-lg text-xs font-semibold transition shadow-sm" data-id="${item.id}" data-machine="${item.machine_id}">
                                    <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                                </button>
                            </div>
                        </div>
                        
                        <!-- Motivo -->
                        <div class="mb-3 p-2 bg-white rounded-lg border ${isActive ? 'border-red-200' : 'border-gray-200'}">
                            <p class="text-xs text-gray-500 mb-1 font-medium">MOTIVO:</p>
                            <p class="text-sm text-gray-800">${item.reason || 'Não informado'}</p>
                        </div>
                        
                        <!-- Grid de informações detalhadas -->
                        <div class="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                            <div class="bg-white p-2 rounded-lg border ${isActive ? 'border-red-100' : 'border-gray-100'}">
                                <span class="text-gray-500 block">Período</span>
                                <span class="font-semibold text-gray-700">${periodText}</span>
                            </div>
                            <div class="bg-white p-2 rounded-lg border ${isActive ? 'border-red-100' : 'border-gray-100'}">
                                <span class="text-gray-500 block">Registrado por</span>
                                <span class="font-semibold text-gray-700">${registeredBy}</span>
                            </div>
                            <div class="bg-white p-2 rounded-lg border ${isActive ? 'border-red-100' : 'border-gray-100'}">
                                <span class="text-gray-500 block">Registro em</span>
                                <span class="font-semibold text-gray-700">${createdAt}</span>
                            </div>
                            <div class="bg-white p-2 rounded-lg border ${isActive ? 'border-red-100' : 'border-gray-100'}">
                                <span class="text-gray-500 block">${isActive ? 'Status' : 'Finalizado por'}</span>
                                <span class="font-semibold ${isActive ? 'text-red-600' : 'text-gray-700'}">${isActive ? 'Em andamento' : finishedBy}</span>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
            
            // Listeners de edição/exclusão — delegados ao controller de análise
            if (typeof handleEditExtendedDowntimeFromAnalysis === 'function') {
                document.querySelectorAll('.btn-edit-extended-downtime-analysis').forEach(btn => {
                    btn.addEventListener('click', handleEditExtendedDowntimeFromAnalysis);
                });
            }
            if (typeof handleDeleteExtendedDowntimeFromAnalysis === 'function') {
                document.querySelectorAll('.btn-delete-extended-downtime-analysis').forEach(btn => {
                    btn.addEventListener('click', handleDeleteExtendedDowntimeFromAnalysis);
                });
            }
            
            lucide.createIcons();
        }

    } catch (error) {
        console.error('[EXTENDED-DOWNTIME] Erro ao carregar paradas longas:', error);
    }
}

// ════════════════════════════════════════════════════════════════
// Public API
// ════════════════════════════════════════════════════════════════

/**
 * Inicializa o controller de paradas longas.
 * Chamado via dynamic import no handleNavClick.
 */
let _extendedDowntimeInitialized = false;
export function setupExtendedDowntimePage() {
    if (_extendedDowntimeInitialized) {
        console.debug('[EXTENDED-DOWNTIME-CTRL] Já inicializado — recarregando lista');
        if (typeof loadExtendedDowntimeList === 'function') loadExtendedDowntimeList();
        return;
    }
    _extendedDowntimeInitialized = true;
    console.log('[EXTENDED-DOWNTIME-CTRL] Inicializando controller...');
    setupExtendedDowntimeTab();
    initEditExtendedDowntimeModal();
    console.log('[EXTENDED-DOWNTIME-CTRL] Controller inicializado');
}

// Expor globalmente para callers do closure
window.loadExtendedDowntimeList = loadExtendedDowntimeList;
window.openEditDowntimeModal = openEditDowntimeModal;
window.openExtendedDowntimeModal = openExtendedDowntimeModal;
window.loadExtendedDowntimeAnalysis = loadExtendedDowntimeAnalysis;
window.setupExtendedDowntimeTab = setupExtendedDowntimeTab;
window.handleEditExtendedDowntime = handleEditExtendedDowntime;
window.handleDeleteExtendedDowntime = handleDeleteExtendedDowntime;
