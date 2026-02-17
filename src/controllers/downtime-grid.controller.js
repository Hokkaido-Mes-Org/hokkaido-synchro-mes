// =============================================
// DOWNTIME GRID CONTROLLER
// Parada Avulsa (Sem OP) + Finalizar Parada via Card + Parada em Lote
// Extraído de script.js – Phase 13
// =============================================

import { getActiveUser, getCurrentUserName } from '../utils/auth.utils.js';

// ─── Window-forwarded dependencies (closure functions from script.js) ───
const db = (() => { try { return firebase.firestore(); } catch { return null; } })();
const showNotification = (...args) => window.showNotification?.(...args);
const closeModal = (...args) => window.closeModal?.(...args);
const normalizeMachineId = (...args) => window.normalizeMachineId?.(...args);
const setupUserCodeInput = (...args) => window.setupUserCodeInput?.(...args);
const updateUserNameDisplay = (...args) => window.updateUserNameDisplay?.(...args);
const invalidateDowntimeCache = (...args) => window.invalidateDowntimeCache?.(...args);
const getAllMachinesDowntimeStatus = (...args) => window.getAllMachinesDowntimeStatus?.(...args);
const populateMachineSelector = (...args) => window.populateMachineSelector?.(...args);
const loadTodayStats = (...args) => window.loadTodayStats?.(...args);
const loadRecentEntries = (...args) => window.loadRecentEntries?.(...args);
const logSystemAction = (...args) => window.logSystemAction?.(...args);
const getShiftForDateTime = (...args) => window.getShiftForDateTime?.(...args);
const getWorkdayForDateTime = (...args) => window.getWorkdayForDateTime?.(...args);
const splitDowntimeIntoDailySegments = (...args) => window.splitDowntimeIntoDailySegments?.(...args);
const formatTimeHM = (...args) => window.formatTimeHM?.(...args);

// ─── Module State ───
let _standaloneActiveDowntimes = {};
let _standaloneSelectedMachine = null;
let _standaloneTimerInterval = null;
let _cardFinishDowntimeMachine = null;
let _batchSelectedMachines = new Set();

// =============================================
// PARADA AVULSA (SEM OP) - Grid Start/Stop
// =============================================

/**
 * Abre o modal com grid de máquinas para start/stop de parada
 */
async function openStandaloneDowntimeModal() {
    console.log('[STANDALONE] Abrindo modal de parada sem OP');

    // Permissão
    if (window.authSystem && window.authSystem.checkPermissionForAction) {
        if (!window.authSystem.checkPermissionForAction('add_downtime')) {
            showNotification('Permissão negada para registrar paradas', 'error');
            return;
        }
    }

    // Carregar paradas ativas do Firebase
    await loadStandaloneActiveDowntimes();

    // Renderizar grid
    renderStandaloneMachineGrid();

    // Abrir modal
    const modal = document.getElementById('standalone-downtime-modal');
    if (modal) {
        modal.classList.remove('hidden');
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    // Iniciar timer de atualização dos cronômetros
    startStandaloneTimerUpdate();
}

/**
 * Carrega paradas ativas da coleção active_downtimes que tenham semOP=true
 */
async function loadStandaloneActiveDowntimes() {
    try {
        const snapshot = await db.collection('active_downtimes').where('semOP', '==', true).get();
        _standaloneActiveDowntimes = {};
        snapshot.forEach(doc => {
            const data = doc.data();
            const machineId = data.machine || doc.id;
            _standaloneActiveDowntimes[machineId] = { ...data, docId: doc.id };
        });
        console.log('[STANDALONE] Paradas ativas carregadas:', Object.keys(_standaloneActiveDowntimes));
    } catch (error) {
        console.error('[STANDALONE] Erro ao carregar paradas ativas:', error);
        // Tentar carregar todas via cache e filtrar (OTIMIZADO)
        try {
            const allData = typeof window.getActiveDowntimesCached === 'function'
                ? await window.getActiveDowntimesCached()
                : (await db.collection('active_downtimes').get()).docs.map(d => ({id: d.id, ...d.data()}));
            _standaloneActiveDowntimes = {};
            allData.forEach(d => {
                if (d.semOP === true) {
                    const machineId = d.machine || d.id;
                    _standaloneActiveDowntimes[machineId] = { ...d, docId: d.id };
                }
            });
        } catch (e2) {
            console.error('[STANDALONE] Erro no fallback:', e2);
        }
    }
}

/**
 * Identifica quais máquinas têm OP ativa (não devem ser controladas aqui)
 */
function getMachinesWithActiveOP() {
    const machinesWithOP = new Set();
    // machineCardData é populado pelo sistema para máquinas com plano ativo
    const machineCardData = window.machineCardData || {};
    if (machineCardData) {
        Object.keys(machineCardData).forEach(mid => {
            if (machineCardData[mid]) {
                machinesWithOP.add(mid);
                // Normalizar: adicionar tanto "H01" quanto "H-01"
                const normalized = normalizeMachineId(mid);
                machinesWithOP.add(normalized);
            }
        });
    }
    return machinesWithOP;
}

/**
 * Renderiza o grid de máquinas no modal
 */
function renderStandaloneMachineGrid() {
    const grid = document.getElementById('standalone-machine-grid');
    if (!grid) return;

    const machines = window.machineDatabase || [];
    const machinesWithOP = getMachinesWithActiveOP();

    grid.innerHTML = '';

    machines.forEach(m => {
        const mid = m.id;
        const normalizedId = normalizeMachineId(mid);
        const hasOP = machinesWithOP.has(mid) || machinesWithOP.has(normalizedId);
        const activeDowntime = _standaloneActiveDowntimes[mid] || _standaloneActiveDowntimes[normalizedId];
        const isActive = !!activeDowntime;

        const card = document.createElement('div');
        card.className = 'relative rounded-xl p-3 text-center cursor-pointer transition-all duration-200 border-2 select-none';
        card.dataset.machineId = mid;

        if (hasOP) {
            // Máquina com OP ativa — bloqueada
            card.className += ' bg-emerald-50 border-emerald-300 opacity-60 cursor-not-allowed';
            card.innerHTML = `
                <div class="text-sm font-bold text-emerald-700">${mid}</div>
                <div class="text-[10px] text-emerald-500 mt-0.5 truncate">${m.model}</div>
                <div class="text-[10px] text-emerald-600 mt-1 font-medium">Com OP</div>
            `;
            card.title = 'Máquina com OP ativa - controle pela tela principal';
        } else if (isActive) {
            // Máquina com parada ativa — clique para FINALIZAR
            const startInfo = getStandaloneElapsedText(activeDowntime);
            card.className += ' bg-red-50 border-red-400 hover:bg-red-100 hover:shadow-md ring-2 ring-red-200';
            card.innerHTML = `
                <div class="text-sm font-bold text-red-700">${mid}</div>
                <div class="text-[10px] text-red-500 mt-0.5 truncate">${activeDowntime.reason || '-'}</div>
                <div class="text-[10px] text-red-600 mt-1 font-mono font-semibold standalone-timer" data-machine="${mid}">${startInfo}</div>
                <div class="absolute top-1 right-1">
                    <span class="relative flex h-2.5 w-2.5">
                        <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                    </span>
                </div>
            `;
            card.title = 'Clique para FINALIZAR parada';
            card.onclick = () => finalizeStandaloneDowntime(mid);
        } else {
            // Máquina disponível — clique para INICIAR parada
            card.className += ' bg-slate-50 border-slate-200 hover:bg-orange-50 hover:border-orange-300 hover:shadow-md';
            card.innerHTML = `
                <div class="text-sm font-bold text-slate-700">${mid}</div>
                <div class="text-[10px] text-slate-400 mt-0.5 truncate">${m.model}</div>
                <div class="text-[10px] text-slate-500 mt-1">Disponível</div>
            `;
            card.title = 'Clique para INICIAR parada';
            card.onclick = () => openStandaloneReasonModal(mid, m.model);
        }

        grid.appendChild(card);
    });
}

/**
 * Calcula texto de tempo decorrido para uma parada ativa
 */
function getStandaloneElapsedText(downtimeData) {
    let startDate;
    if (downtimeData.startTimestampLocal) {
        startDate = new Date(downtimeData.startTimestampLocal);
    } else if (downtimeData.startTimestamp && downtimeData.startTimestamp.toDate) {
        startDate = downtimeData.startTimestamp.toDate();
    } else if (downtimeData.startDate && downtimeData.startTime) {
        startDate = new Date(`${downtimeData.startDate}T${downtimeData.startTime}:00`);
    } else {
        return '--:--';
    }

    const now = new Date();
    const diffMs = now - startDate;
    if (diffMs < 0) return '00:00';

    const totalMin = Math.floor(diffMs / 60000);
    const hours = Math.floor(totalMin / 60);
    const mins = totalMin % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

/**
 * Atualiza os cronômetros a cada 30 segundos
 */
function startStandaloneTimerUpdate() {
    stopStandaloneTimerUpdate();
    _standaloneTimerInterval = setInterval(() => {
        const timers = document.querySelectorAll('.standalone-timer');
        timers.forEach(el => {
            const mid = el.dataset.machine;
            const normalizedMid = normalizeMachineId(mid);
            const downtimeData = _standaloneActiveDowntimes[mid] || _standaloneActiveDowntimes[normalizedMid];
            if (downtimeData) {
                el.textContent = getStandaloneElapsedText(downtimeData);
            }
        });
    }, 30000);
}

function stopStandaloneTimerUpdate() {
    if (_standaloneTimerInterval) {
        clearInterval(_standaloneTimerInterval);
        _standaloneTimerInterval = null;
    }
}

/**
 * Abre o sub-modal de motivo para iniciar uma parada
 */
function openStandaloneReasonModal(machineId, machineModel) {
    _standaloneSelectedMachine = machineId;

    // Atualizar label
    const label = document.getElementById('standalone-reason-machine-label');
    if (label) label.textContent = `Máquina: ${machineId} - ${machineModel || ''}`;

    // Limpar campos
    const userInput = document.getElementById('standalone-downtime-user');
    const reason = document.getElementById('standalone-downtime-reason');
    const obs = document.getElementById('standalone-downtime-obs');
    if (userInput) { userInput.value = ''; updateUserNameDisplay('standalone-downtime-user', ''); }
    if (obs) obs.value = '';

    // Popular motivos a partir de groupedDowntimeReasons
    if (reason) {
        reason.innerHTML = '<option value="">Selecione o motivo...</option>';
        const groups = window.groupedDowntimeReasons || {};
        Object.keys(groups).forEach(groupName => {
            const optgroup = document.createElement('optgroup');
            optgroup.label = groupName;
            groups[groupName].forEach(motivo => {
                const opt = document.createElement('option');
                opt.value = motivo;
                opt.textContent = motivo;
                optgroup.appendChild(opt);
            });
            reason.appendChild(optgroup);
        });
    }

    // Configurar input do operador
    setupUserCodeInput('standalone-downtime-user');

    // Bind form
    const form = document.getElementById('standalone-reason-form');
    if (form) {
        form.removeEventListener('submit', handleStandaloneStartSubmit);
        form.addEventListener('submit', handleStandaloneStartSubmit);
    }

    // Abrir sub-modal
    const modal = document.getElementById('standalone-reason-modal');
    if (modal) {
        modal.classList.remove('hidden');
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
}

/**
 * INICIAR parada: salva em active_downtimes com semOP=true
 */
async function handleStandaloneStartSubmit(e) {
    e.preventDefault();
    e.stopPropagation();

    const machineId = _standaloneSelectedMachine;
    if (!machineId) {
        showNotification('Nenhuma máquina selecionada', 'error');
        return;
    }

    // Validar operador
    const userInput = document.getElementById('standalone-downtime-user');
    const userCod = userInput ? parseInt(userInput.value, 10) : null;
    if (userCod === null || isNaN(userCod) || userInput.value === '') {
        alert('⚠️ Operador obrigatório!\n\nPor favor, digite o código do operador responsável.');
        if (userInput) userInput.focus();
        return;
    }
    const userData = typeof getUserByCode === 'function' ? getUserByCode(userCod) : null;
    if (!userData) {
        alert('⚠️ Código inválido!\n\nO código digitado não foi encontrado no sistema.\nVerifique e tente novamente.');
        if (userInput) userInput.focus();
        return;
    }

    const reason = document.getElementById('standalone-downtime-reason')?.value || '';
    const obs = document.getElementById('standalone-downtime-obs')?.value || '';

    if (!reason) {
        showNotification('Selecione o motivo da parada', 'warning');
        return;
    }

    try {
        const now = new Date();
        const currentShift = getShiftForDateTime(now);
        const workday = getWorkdayForDateTime(now);
        const normalizedId = normalizeMachineId(machineId);

        const activeDowntimeData = {
            machine: machineId,
            startDate: workday,
            startTime: formatTimeHM(now),
            startTimestamp: firebase.firestore.FieldValue.serverTimestamp(),
            startTimestampLocal: now.toISOString(),
            startShift: currentShift,
            reason: reason,
            observations: obs,
            userCod: userCod,
            nomeUsuario: userData.nomeUsuario,
            semOP: true,
            isActive: true,
            startedBy: getActiveUser()?.name || 'Sistema',
            startedByUsername: getActiveUser()?.username || null,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            systemVersion: '2.1'
        };

        await db.collection('active_downtimes').doc(normalizedId).set(activeDowntimeData, { merge: true });
        console.log('[STANDALONE] Parada iniciada:', machineId, reason);

        // Atualizar cache local
        _standaloneActiveDowntimes[machineId] = {
            ...activeDowntimeData,
            startTimestampLocal: now.toISOString(),
            docId: normalizedId
        };

        // Fechar sub-modal e atualizar grid
        closeModal('standalone-reason-modal');
        renderStandaloneMachineGrid();
        if (typeof lucide !== 'undefined') lucide.createIcons();

        // CORREÇÃO: Invalidar caches e atualizar cards principais imediatamente
        if (typeof invalidateDowntimeCache === 'function') {
            invalidateDowntimeCache(machineId);
        }
        
        // Invalidar DataStore para forçar reload
        if (window.DataStore) {
            window.DataStore.invalidate('activeDowntimes');
        }
        
        // Atualizar cards principais - AWAIT para garantir atualização imediata
        if (typeof populateMachineSelector === 'function') {
            await populateMachineSelector();
        }

        showNotification(`⏸️ Parada iniciada: ${machineId} - ${reason}`, 'warning');

        // Log
        if (typeof logSystemAction === 'function') {
            logSystemAction('parada', `Parada sem OP iniciada: ${machineId} - ${reason}`, {
                maquina: machineId,
                motivo: reason,
                turno: currentShift,
                semOP: true
            });
        }
    } catch (error) {
        console.error('[STANDALONE] Erro ao iniciar parada:', error);
        showNotification('❌ Erro ao iniciar parada: ' + error.message, 'error');
    }
}

/**
 * FINALIZAR parada: calcula duração, salva em downtime_entries, remove de active_downtimes
 * @param {string} machineId - ID da máquina
 * @param {boolean} skipConfirm - Se true, pula a confirmação (usado quando chamado de modal que já confirmou)
 */
async function finalizeStandaloneDowntime(machineId, skipConfirm = false) {
    const normalizedId = normalizeMachineId(machineId);
    const activeData = _standaloneActiveDowntimes[machineId] || _standaloneActiveDowntimes[normalizedId];

    if (!activeData) {
        showNotification('Nenhuma parada ativa encontrada para esta máquina', 'warning');
        return;
    }

    // Confirmar finalização (pular se skipConfirm for true)
    if (!skipConfirm) {
        const elapsed = getStandaloneElapsedText(activeData);
        const confirmMsg = `Finalizar parada da máquina ${machineId}?\n\nMotivo: ${activeData.reason || '-'}\nTempo: ${elapsed}\n\nDeseja finalizar?`;
        if (!confirm(confirmMsg)) return;
    }

    try {
        const now = new Date();
        const endTime = formatTimeHM(now);
        const endWorkday = getWorkdayForDateTime(now);

        // Reconstruir data de início
        let startDateTime;
        if (activeData.startTimestampLocal) {
            startDateTime = new Date(activeData.startTimestampLocal);
        } else if (activeData.startTimestamp && activeData.startTimestamp.toDate) {
            startDateTime = activeData.startTimestamp.toDate();
        } else if (activeData.startDate && activeData.startTime) {
            startDateTime = new Date(`${activeData.startDate}T${activeData.startTime}:00`);
        }

        if (!startDateTime || isNaN(startDateTime.getTime())) {
            showNotification('Erro: data de início inválida', 'error');
            return;
        }

        const startDateStr = activeData.startDate || getWorkdayForDateTime(startDateTime);
        const startTimeStr = activeData.startTime || formatTimeHM(startDateTime);

        // Quebrar em segmentos por dia
        const segments = splitDowntimeIntoDailySegments(startDateStr, startTimeStr, endWorkday, endTime);
        if (!segments.length) {
            showNotification('Erro ao processar período da parada', 'error');
            return;
        }

        // Salvar cada segmento na coleção downtime_entries
        const currentUser = getActiveUser();
        const shiftValue = activeData.startShift || activeData.shift || activeData.turno || null;
        for (const seg of segments) {
            const downtimeData = {
                machine: machineId,
                date: seg.date,
                startTime: seg.startTime,
                endTime: seg.endTime,
                duration: seg.duration,
                reason: activeData.reason || '',
                observations: activeData.observations || '',
                shift: shiftValue,
                turno: shiftValue,
                semOP: true,
                batchDowntime: activeData.batchDowntime || false,
                userCod: activeData.userCod || null,
                nomeUsuario: activeData.nomeUsuario || null,
                registradoPor: currentUser?.username || null,
                registradoPorNome: getCurrentUserName(),
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            await db.collection('downtime_entries').add(downtimeData);
        }

        // Remover de active_downtimes
        const docId = activeData.docId || normalizedId;
        await db.collection('active_downtimes').doc(docId).delete();
        console.log('[STANDALONE] Parada finalizada e salva:', machineId);

        // Calcular duração ANTES de mostrar notificação de sucesso
        const totalDuration = segments.reduce((s, seg) => s + (seg.duration || 0), 0);
        const totalMinutes = Math.round(totalDuration);

        // ====== ATUALIZAR CACHES IMEDIATAMENTE ======
        // Atualizar cache local standalone
        delete _standaloneActiveDowntimes[machineId];
        delete _standaloneActiveDowntimes[normalizedId];
        
        // Invalidar TODOS os caches de downtime antes de atualizar UI
        if (typeof invalidateDowntimeCache === 'function') {
            invalidateDowntimeCache(machineId);
        }
        
        // Invalidar DataStore para forçar reload
        if (window.DataStore) {
            window.DataStore.invalidate('activeDowntimes');
        }

        // ====== ATUALIZAR UI IMEDIATAMENTE (ANTES da notificação) ======
        try {
            // Re-renderizar grid standalone
            renderStandaloneMachineGrid();
            if (typeof lucide !== 'undefined') lucide.createIcons();

            // Atualizar cards principais - AWAIT para garantir atualização imediata
            if (typeof populateMachineSelector === 'function') {
                await populateMachineSelector();
            }
        } catch (uiError) {
            console.warn('[STANDALONE] Erro ao atualizar UI:', uiError);
        }

        // ====== SUCESSO CONFIRMADO - Mostrar notificação ======
        showNotification(`✅ Parada finalizada: ${machineId} - ${totalMinutes} min registrados`, 'success');

        // ====== OPERAÇÕES EM BACKGROUND (não bloqueia) ======
        Promise.all([
            loadTodayStats?.() || Promise.resolve(),
            loadRecentEntries?.(false) || Promise.resolve()
        ]).catch(() => {});

        // Log em background
        try {
            if (typeof logSystemAction === 'function') {
                logSystemAction('parada', `Parada sem OP finalizada: ${machineId}`, {
                    maquina: machineId,
                    motivo: activeData.reason,
                    duracao: totalDuration,
                    semOP: true
                });
            }
        } catch (logError) {
            console.warn('[STANDALONE] Erro ao registrar log:', logError);
        }
    } catch (error) {
        console.error('[STANDALONE] Erro ao finalizar parada:', error);
        showNotification('❌ Erro ao finalizar parada: ' + error.message, 'error');
    }
}

// =============================================
// FINALIZAR PARADA VIA CARD (Aba Lançamento)
// =============================================

/**
 * Abre o modal de finalização de parada clicando no card
 */
async function openCardFinishDowntimeModal(machineId, reason, startTime) {
    console.log('[CARD-FINISH-DOWNTIME] Abrindo modal para:', machineId);
    _cardFinishDowntimeMachine = normalizeMachineId(machineId);
    
    const modal = document.getElementById('card-finish-downtime-modal');
    if (!modal) {
        console.error('[CARD-FINISH-DOWNTIME] Modal não encontrado');
        return;
    }
    
    // Buscar dados atualizados da parada no Firebase
    let downtimeData = null;
    try {
        const doc = await db.collection('active_downtimes').doc(_cardFinishDowntimeMachine).get();
        if (doc.exists) {
            downtimeData = doc.data();
        }
    } catch (e) {
        console.warn('[CARD-FINISH-DOWNTIME] Erro ao buscar parada:', e);
    }
    
    // Preencher dados no modal
    const machineEl = document.getElementById('card-finish-downtime-machine');
    const reasonEl = document.getElementById('card-finish-downtime-reason');
    const startEl = document.getElementById('card-finish-downtime-start');
    const durationEl = document.getElementById('card-finish-downtime-duration');
    
    if (machineEl) machineEl.textContent = _cardFinishDowntimeMachine;
    if (reasonEl) reasonEl.textContent = downtimeData?.reason || reason || 'Não informado';
    
    // Calcular início e duração
    let startTimestamp = null;
    if (downtimeData?.startTimestampLocal) {
        startTimestamp = new Date(downtimeData.startTimestampLocal);
    } else if (downtimeData?.startDate && downtimeData?.startTime) {
        startTimestamp = new Date(`${downtimeData.startDate}T${downtimeData.startTime}:00`);
    } else if (startTime) {
        startTimestamp = new Date(startTime);
    }
    
    if (startEl) {
        if (startTimestamp && !isNaN(startTimestamp.getTime())) {
            startEl.textContent = startTimestamp.toLocaleString('pt-BR', { 
                day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' 
            });
        } else {
            startEl.textContent = downtimeData?.startTime || '-';
        }
    }
    
    if (durationEl) {
        if (startTimestamp && !isNaN(startTimestamp.getTime())) {
            const now = new Date();
            const diffMs = now - startTimestamp;
            const diffMin = Math.floor(diffMs / 60000);
            const hours = Math.floor(diffMin / 60);
            const mins = diffMin % 60;
            durationEl.textContent = hours > 0 ? `${hours}h ${mins}min` : `${mins}min`;
        } else {
            durationEl.textContent = '-';
        }
    }
    
    // Mostrar modal
    modal.classList.remove('hidden');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

/**
 * Fecha o modal de finalização via card
 */
function closeCardFinishDowntimeModal() {
    const modal = document.getElementById('card-finish-downtime-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
    _cardFinishDowntimeMachine = null;
}

/**
 * Confirma e executa a finalização da parada via card
 */
async function confirmCardFinishDowntime() {
    if (!_cardFinishDowntimeMachine) {
        showNotification('Nenhuma máquina selecionada', 'error');
        return;
    }
    
    const machineId = _cardFinishDowntimeMachine;
    const normalizedId = normalizeMachineId(machineId);
    console.log('[CARD-FINISH-DOWNTIME] Finalizando parada:', machineId);
    
    // Verificar se existe no cache standalone
    let activeData = _standaloneActiveDowntimes[machineId] || _standaloneActiveDowntimes[normalizedId];
    
    // Se não estiver no cache, buscar do Firebase
    if (!activeData) {
        console.log('[CARD-FINISH-DOWNTIME] Buscando dados do Firebase...');
        try {
            const doc = await db.collection('active_downtimes').doc(normalizedId).get();
            if (doc.exists) {
                activeData = { ...doc.data(), docId: doc.id };
                // Adicionar ao cache para a função finalizeStandaloneDowntime funcionar
                _standaloneActiveDowntimes[normalizedId] = activeData;
            }
        } catch (e) {
            console.warn('[CARD-FINISH-DOWNTIME] Erro ao buscar Firebase:', e);
        }
    }
    
    if (!activeData) {
        showNotification('Parada não encontrada no sistema', 'warning');
        closeCardFinishDowntimeModal();
        // Atualizar cards mesmo assim
        if (typeof invalidateDowntimeCache === 'function') invalidateDowntimeCache(machineId);
        if (typeof populateMachineSelector === 'function') populateMachineSelector();
        return;
    }
    
    // Fechar modal ANTES de finalizar (evita erro se algo falhar no meio)
    closeCardFinishDowntimeModal();
    
    // Usar a função existente de finalização standalone (skipConfirm=true pois modal já confirma)
    // A função tem seu próprio tratamento de erros e mostra notificações
    await finalizeStandaloneDowntime(machineId, true);
}

// =============================================
// PARADA EM LOTE - Múltiplas Máquinas ao Mesmo Tempo
// =============================================

/**
 * Abre o modal de parada em lote
 */
async function openBatchDowntimeModal() {
    console.log('[BATCH-DOWNTIME] Abrindo modal de parada em lote');

    // Limpar seleções anteriores
    _batchSelectedMachines.clear();

    // Limpar cache de paradas ativas e recarregar
    _standaloneActiveDowntimes = {};
    
    // Carregar paradas ativas de TODAS as máquinas
    try {
        const allDowntimeStatus = await getAllMachinesDowntimeStatus(true); // forceRefresh
        console.log('[BATCH-DOWNTIME] Paradas ativas carregadas:', Object.keys(allDowntimeStatus).length);
        // Copiar apenas paradas ATIVAS para o cache
        Object.keys(allDowntimeStatus).forEach(mid => {
            const status = allDowntimeStatus[mid];
            if (status && status.status === 'active') {
                _standaloneActiveDowntimes[mid] = status;
            }
        });
    } catch (e) {
        console.warn('[BATCH-DOWNTIME] Erro ao carregar status de paradas:', e);
    }

    // Resetar campos do formulário
    const userInput = document.getElementById('batch-downtime-user');
    const reason = document.getElementById('batch-downtime-reason');
    const obs = document.getElementById('batch-downtime-obs');
    if (userInput) { userInput.value = ''; updateUserNameDisplay('batch-downtime-user', ''); }
    if (obs) obs.value = '';

    // Popular motivos a partir de groupedDowntimeReasons
    if (reason) {
        reason.innerHTML = '<option value="">Selecione o motivo...</option>';
        // Popular motivos do database.js
        const groups = window.groupedDowntimeReasons || {};
        Object.keys(groups).forEach(groupName => {
            const optgroup = document.createElement('optgroup');
            optgroup.label = groupName;
            groups[groupName].forEach(motivo => {
                const opt = document.createElement('option');
                opt.value = motivo;
                opt.textContent = motivo;
                // Pré-selecionar FALTA DE ENERGIA como opção padrão
                if (motivo === 'FALTA DE ENERGIA') {
                    opt.selected = true;
                }
                optgroup.appendChild(opt);
            });
            reason.appendChild(optgroup);
        });
    }

    // Configurar input do operador
    setupUserCodeInput('batch-downtime-user');

    // Renderizar grid de máquinas
    renderBatchMachineGrid();

    // Bind form
    const form = document.getElementById('batch-downtime-form');
    if (form) {
        form.removeEventListener('submit', handleBatchDowntimeSubmit);
        form.addEventListener('submit', handleBatchDowntimeSubmit);
    }

    // Abrir modal
    const modal = document.getElementById('batch-downtime-modal');
    if (modal) {
        modal.classList.remove('hidden');
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    updateBatchSelectedCount();
}

/**
 * Fechar modal de parada em lote
 */
function closeBatchDowntimeModal() {
    closeModal('batch-downtime-modal');
    _batchSelectedMachines.clear();
}

/**
 * Renderiza o grid de máquinas com checkboxes para seleção
 * Parada em lote permite selecionar QUALQUER máquina (ex: queda de energia afeta toda fábrica)
 */
function renderBatchMachineGrid() {
    const grid = document.getElementById('batch-machine-grid');
    if (!grid) {
        console.error('[BATCH-DOWNTIME] Grid batch-machine-grid não encontrado!');
        return;
    }

    const machines = window.machineDatabase || window.databaseModule?.machineDatabase || [];
    const machinesWithOP = getMachinesWithActiveOP();
    
    console.log('[BATCH-DOWNTIME] Renderizando grid:', {
        totalMachines: machines.length,
        machinesWithOP: machinesWithOP.size,
        paradasAtivas: Object.keys(_standaloneActiveDowntimes).length
    });

    grid.innerHTML = '';

    if (machines.length === 0) {
        grid.innerHTML = '<div class="col-span-full text-center text-gray-500 py-4">Nenhuma máquina encontrada</div>';
        return;
    }

    machines.forEach(m => {
        const mid = m.id;
        const normalizedId = normalizeMachineId(mid);
        const hasOP = machinesWithOP.has(mid) || machinesWithOP.has(normalizedId);
        const hasActiveDowntime = _standaloneActiveDowntimes[mid] || _standaloneActiveDowntimes[normalizedId];
        
        // Parada em lote: disponível se NÃO tem parada ativa (independente de ter OP)
        const isAvailable = !hasActiveDowntime;

        const card = document.createElement('div');
        card.className = 'relative rounded-lg p-1.5 sm:p-2 text-center transition-all duration-200 border-2 select-none flex flex-col items-center justify-center min-h-[50px] sm:min-h-[60px]';
        card.dataset.machineId = mid;

        if (hasActiveDowntime) {
            // Máquina já com parada ativa - não pode selecionar
            card.className += ' bg-red-50 border-red-200 opacity-60 cursor-not-allowed';
            card.innerHTML = `
                <div class="text-xs sm:text-sm font-bold text-red-500">${mid}</div>
                <div class="text-[8px] sm:text-[10px] text-red-400 mt-0.5">⏸ Parada</div>
            `;
        } else {
            // Máquina disponível para seleção
            const isSelected = _batchSelectedMachines.has(mid);
            const bgClass = hasOP 
                ? (isSelected ? 'bg-amber-100 border-amber-400 ring-2 ring-amber-200' : 'bg-emerald-50 border-emerald-300 hover:bg-amber-50 hover:border-amber-300')
                : (isSelected ? 'bg-amber-100 border-amber-400 ring-2 ring-amber-200' : 'bg-gray-50 border-gray-300 hover:bg-amber-50 hover:border-amber-300');
            const textClass = hasOP 
                ? (isSelected ? 'text-amber-700' : 'text-emerald-700')
                : (isSelected ? 'text-amber-700' : 'text-gray-600');
            const statusText = hasOP ? (isSelected ? '✓' : '▶') : (isSelected ? '✓' : '○');
            
            card.className += ` ${bgClass} cursor-pointer`;
            card.innerHTML = `
                <div class="text-xs sm:text-sm font-bold ${textClass}">${mid}</div>
                <div class="text-[8px] sm:text-[10px] ${isSelected ? 'text-amber-600 font-semibold' : (hasOP ? 'text-emerald-600' : 'text-gray-500')} mt-0.5 batch-status-text">${statusText}</div>
                <div class="absolute top-0.5 right-0.5 sm:top-1 sm:right-1 w-3 h-3 sm:w-4 sm:h-4 border ${isSelected ? 'bg-amber-500 border-amber-500' : (hasOP ? 'border-emerald-400' : 'border-gray-400')} rounded flex items-center justify-center">
                    ${isSelected ? '<svg class="w-2 h-2 sm:w-3 sm:h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>' : ''}
                </div>
            `;
            card.onclick = () => toggleBatchMachineClick(mid);
        }

        grid.appendChild(card);
    });
}

/**
 * Toggle de máquina via click direto (sem checkbox)
 */
function toggleBatchMachineClick(machineId) {
    console.log('[BATCH-DOWNTIME] Toggle máquina:', machineId, 'Atual:', _batchSelectedMachines.has(machineId));
    if (_batchSelectedMachines.has(machineId)) {
        _batchSelectedMachines.delete(machineId);
    } else {
        _batchSelectedMachines.add(machineId);
    }
    console.log('[BATCH-DOWNTIME] Selecionadas após toggle:', _batchSelectedMachines.size);
    // Re-renderizar grid para atualizar visual
    renderBatchMachineGrid();
    updateBatchSelectedCount();
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

/**
 * Toggle seleção de uma máquina (mantido para compatibilidade)
 */
function toggleBatchMachine(machineId) {
    toggleBatchMachineClick(machineId);
}

/**
 * Selecionar todas as máquinas disponíveis (sem parada ativa)
 */
function batchSelectAllMachines() {
    const machines = window.machineDatabase || window.databaseModule?.machineDatabase || [];
    console.log('[BATCH-DOWNTIME] Selecionando todas:', machines.length, 'máquinas');
    
    machines.forEach(m => {
        const mid = m.id;
        const normalizedId = normalizeMachineId(mid);
        const hasActiveDowntime = _standaloneActiveDowntimes[mid] || _standaloneActiveDowntimes[normalizedId];
        // Selecionar apenas máquinas SEM parada ativa
        const isAvailable = !hasActiveDowntime;
        
        if (isAvailable && !_batchSelectedMachines.has(mid)) {
            _batchSelectedMachines.add(mid);
        }
    });
    
    console.log('[BATCH-DOWNTIME] Total selecionadas:', _batchSelectedMachines.size);
    renderBatchMachineGrid();
    updateBatchSelectedCount();
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

/**
 * Desmarcar todas as máquinas
 */
function batchDeselectAllMachines() {
    _batchSelectedMachines.clear();
    renderBatchMachineGrid();
    updateBatchSelectedCount();
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

/**
 * Atualizar contador de máquinas selecionadas
 */
function updateBatchSelectedCount() {
    const countEl = document.getElementById('batch-selected-count');
    const submitBtn = document.getElementById('batch-downtime-submit-btn');
    const count = _batchSelectedMachines.size;

    console.log('[BATCH-DOWNTIME] Atualizando contador:', count, 'Botão encontrado:', !!submitBtn);

    if (countEl) countEl.textContent = count;
    if (submitBtn) {
        submitBtn.disabled = count === 0;
        console.log('[BATCH-DOWNTIME] Botão disabled:', submitBtn.disabled);
        submitBtn.innerHTML = count > 0 
            ? `<i data-lucide="zap" class="w-3 h-3 sm:w-4 sm:h-4 inline mr-1"></i> Iniciar ${count} Parada${count > 1 ? 's' : ''}`
            : '<i data-lucide="zap" class="w-3 h-3 sm:w-4 sm:h-4 inline mr-1"></i> Iniciar Paradas';
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
}

/**
 * Submeter parada em lote
 */
async function handleBatchDowntimeSubmit(e) {
    e.preventDefault();
    e.stopPropagation();

    if (_batchSelectedMachines.size === 0) {
        showNotification('Selecione pelo menos uma máquina', 'warning');
        return;
    }

    // Validar operador
    const userInput = document.getElementById('batch-downtime-user');
    const userCod = userInput ? parseInt(userInput.value, 10) : null;
    if (userCod === null || isNaN(userCod) || userInput.value === '') {
        alert('⚠️ Operador obrigatório!\n\nPor favor, digite o código do operador responsável.');
        if (userInput) userInput.focus();
        return;
    }
    const userData = typeof getUserByCode === 'function' ? getUserByCode(userCod) : null;
    if (!userData) {
        alert('⚠️ Código inválido!\n\nO código digitado não foi encontrado no sistema.\nVerifique e tente novamente.');
        if (userInput) userInput.focus();
        return;
    }

    const reason = document.getElementById('batch-downtime-reason')?.value || '';
    const obs = document.getElementById('batch-downtime-obs')?.value || '';

    if (!reason) {
        showNotification('Selecione o motivo da parada', 'warning');
        return;
    }

    // Confirmar ação
    const machinesList = Array.from(_batchSelectedMachines).join(', ');
    const confirmMsg = `⚠️ PARADA EM LOTE\n\nVocê está prestes a iniciar parada em ${_batchSelectedMachines.size} máquina(s):\n${machinesList}\n\nMotivo: ${reason}\n\nDeseja continuar?`;
    if (!confirm(confirmMsg)) return;

    // Desabilitar botão durante processamento
    const submitBtn = document.getElementById('batch-downtime-submit-btn');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 inline mr-1 animate-spin"></i> Processando...';
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    try {
        const now = new Date();
        const currentShift = getShiftForDateTime(now);
        const workday = getWorkdayForDateTime(now);
        const batch = db.batch();
        const machinesArray = Array.from(_batchSelectedMachines);
        
        // CORREÇÃO: Verificar novamente quais máquinas já estão paradas
        const currentDowntimes = await getAllMachinesDowntimeStatus(true);
        const machinesDisponiveis = machinesArray.filter(machineId => {
            const normalizedId = normalizeMachineId(machineId);
            return !currentDowntimes[machineId] && !currentDowntimes[normalizedId];
        });
        
        const machinesJaParadas = machinesArray.length - machinesDisponiveis.length;
        
        if (machinesDisponiveis.length === 0) {
            showNotification('Todas as máquinas selecionadas já estão paradas', 'warning');
            if (submitBtn) {
                submitBtn.disabled = false;
                updateBatchSelectedCount();
            }
            return;
        }
        
        if (machinesJaParadas > 0) {
            console.log(`[BATCH-DOWNTIME] ${machinesJaParadas} máquinas já estavam paradas, ignorando...`);
        }
        
        let successCount = 0;
        let errorCount = 0;

        for (const machineId of machinesDisponiveis) {
            try {
                const normalizedId = normalizeMachineId(machineId);

                const activeDowntimeData = {
                    machine: machineId,
                    startDate: workday,
                    startTime: formatTimeHM(now),
                    startTimestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    startTimestampLocal: now.toISOString(),
                    startShift: currentShift,
                    reason: reason,
                    observations: obs + (obs ? ' | ' : '') + '[Parada em Lote]',
                    userCod: userCod,
                    nomeUsuario: userData.nomeUsuario,
                    semOP: false, // Máquinas COM OP (produzindo)
                    isActive: true,
                    batchDowntime: true,
                    batchTimestamp: now.toISOString(),
                    startedBy: getActiveUser()?.name || 'Sistema',
                    startedByUsername: getActiveUser()?.username || null,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    systemVersion: '2.1'
                };

                batch.set(db.collection('active_downtimes').doc(normalizedId), activeDowntimeData, { merge: true });

                // Atualizar cache local
                _standaloneActiveDowntimes[machineId] = {
                    ...activeDowntimeData,
                    startTimestampLocal: now.toISOString(),
                    docId: normalizedId
                };

                successCount++;
            } catch (machineError) {
                console.error(`[BATCH-DOWNTIME] Erro ao processar ${machineId}:`, machineError);
                errorCount++;
            }
        }

        // Executar batch
        await batch.commit();
        console.log(`[BATCH-DOWNTIME] Parada em lote concluída: ${successCount} sucesso, ${errorCount} erros, ${machinesJaParadas} já paradas`);

        // Log
        if (typeof logSystemAction === 'function') {
            logSystemAction('parada_lote', `Parada em lote iniciada: ${machinesDisponiveis.join(', ')} - ${reason}`, {
                maquinas: machinesDisponiveis,
                motivo: reason,
                turno: currentShift,
                batchDowntime: true,
                totalMaquinas: machinesDisponiveis.length,
                maquinasJaParadas: machinesJaParadas
            });
        }

        // Fechar modal e atualizar UI
        closeBatchDowntimeModal();
        await loadStandaloneActiveDowntimes();
        renderStandaloneMachineGrid();
        
        // Atualizar grid principal de máquinas para refletir as paradas
        if (typeof populateMachineSelector === 'function') {
            populateMachineSelector();
        }
        
        if (typeof lucide !== 'undefined') lucide.createIcons();

        // Notificação de sucesso
        if (errorCount === 0) {
            let msg = `⚡ Parada em lote iniciada com sucesso em ${successCount} máquina(s)!`;
            if (machinesJaParadas > 0) {
                msg += ` (${machinesJaParadas} já estavam paradas)`;
            }
            showNotification(msg, 'success');
        } else {
            showNotification(`⚠️ Parada em lote: ${successCount} sucesso, ${errorCount} erros`, 'warning');
        }

    } catch (error) {
        console.error('[BATCH-DOWNTIME] Erro ao executar parada em lote:', error);
        showNotification('❌ Erro ao executar parada em lote: ' + error.message, 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            updateBatchSelectedCount();
        }
    }
}

// =============================================
// WINDOW EXPORTS
// =============================================

// Standalone Downtime
window.openStandaloneDowntimeModal = openStandaloneDowntimeModal;
window.closeStandaloneModal = function() {
    stopStandaloneTimerUpdate();
    closeModal('standalone-downtime-modal');
};

// Card Finish Downtime
window.openCardFinishDowntimeModal = openCardFinishDowntimeModal;
window.closeCardFinishDowntimeModal = closeCardFinishDowntimeModal;
window.confirmCardFinishDowntime = confirmCardFinishDowntime;

// Batch Downtime
window.openBatchDowntimeModal = openBatchDowntimeModal;
window.closeBatchDowntimeModal = closeBatchDowntimeModal;
window.toggleBatchMachine = toggleBatchMachine;
window.toggleBatchMachineClick = toggleBatchMachineClick;
window.batchSelectAllMachines = batchSelectAllMachines;
window.batchDeselectAllMachines = batchDeselectAllMachines;

// =============================================
// INIT
// =============================================

export function initDowntimeGrid() {
    console.log('[DOWNTIME-GRID] Controller inicializado');
}
