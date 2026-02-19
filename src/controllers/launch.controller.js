// ============================================================
// src/controllers/launch.controller.js - Phase 3B: Launch module
// Extracted from script.js lines ~34548-38696 (~4148 lines)
// Core Launch runtime: downtime, production, machine cards
// ============================================================
import { getDb } from '../services/firebase-client.js';
import { escapeHtml, normalizeMachineId, debounce } from '../utils/dom.utils.js';
import { showNotification } from '../components/notification.js';
import { logSystemAction, registrarLogSistema } from '../utils/logger.js';
import { getActiveUser, isUserGestorOrAdmin, showPermissionDeniedNotification, getCurrentUserName } from '../utils/auth.utils.js';
import { getProductionDateString, getCurrentShift, formatDateBR, formatDateYMD, formatTimeHM, getShiftForDateTime, pad2 } from '../utils/date.utils.js';
import { coerceToNumber, parseOptionalNumber, normalizeNumericString } from '../utils/number.utils.js';
import { getProductByCode } from '../utils/product.utils.js';
import { isPlanActive, normalizeShiftValue, getProductionOrderStatusBadge } from '../utils/plan.utils.js';
import { HOURS_IN_PRODUCTION_DAY, hexWithAlpha, resolveProgressPalette, getProductionHoursOrder, getHoursElapsedInProductionDay, formatShiftLabel } from '../utils/color.utils.js';

// --- Closure-scoped functions accessed via window forwarding ---
const showLoadingState = (...args) => window.showLoadingState?.(...args);
const showConfirmModal = (...args) => window.showConfirmModal?.(...args);
const detachActiveListener = (...args) => window.detachActiveListener?.(...args);
const updateMachineInfo = (...args) => window.updateMachineInfo?.(...args);
const loadOpProductionChart = (...args) => window.loadOpProductionChart?.(...args);
const finalizarParada = (...args) => window.finalizarParada?.(...args);
const loadProductionOrders = (...args) => window.loadProductionOrders?.(...args);
const loadExtendedDowntimeList = (...args) => window.loadExtendedDowntimeList?.(...args);
const setOrderAsActive = (...args) => window.setOrderAsActive?.(...args);
const openEditDowntimeModal = (...args) => window.openEditDowntimeModal?.(...args);
const isPageVisible = () => window.isPageVisible?.();
const getAllMachinesDowntimeStatus = (...args) => window.getAllMachinesDowntimeStatus?.(...args);
const invalidateDowntimeCache = (...args) => { if (typeof window.invalidateDowntimeCache === 'function') window.invalidateDowntimeCache(...args); };
const checkActiveDowntimes = (...args) => window.checkActiveDowntimes?.(...args);
const syncSelectedMachineWithActiveOrder = (...args) => window.syncSelectedMachineWithActiveOrder?.(...args);
const refreshLaunchCharts = (...args) => window.refreshLaunchCharts?.(...args);
const openModal = (...args) => window.openModal?.(...args);
const resolveProductionDateTime = (...args) => window.resolveProductionDateTime?.(...args);
const combineDateAndTime = (...args) => window.combineDateAndTime?.(...args);
const splitDowntimeIntoDailySegments = (...args) => window.splitDowntimeIntoDailySegments?.(...args);
const inferShiftFromSegment = (...args) => window.inferShiftFromSegment?.(...args);
const getWorkdayForDateTime = (...args) => window.getWorkdayForDateTime?.(...args);
const validateOrderActivated = () => window.validateOrderActivated?.();
const validateCycleCavityLaunched = () => window.validateCycleCavityLaunched?.();
const isOrderActiveForCurrentMachine = (...args) => window.isOrderActiveForCurrentMachine?.(...args);
const setupUserCodeInput = (...args) => window.setupUserCodeInput?.(...args);
const updateUserNameDisplay = (...args) => window.updateUserNameDisplay?.(...args);
const loadTareStateForAllForms = (...args) => window.loadTareStateForAllForms?.(...args);
const updateTareDisplay = (...args) => window.updateTareDisplay?.(...args);
const updateQuickProductionPieceWeightUI = (...args) => window.updateQuickProductionPieceWeightUI?.(...args);
const createHourlyProductionChart = (...args) => window.createHourlyProductionChart?.(...args);
const updateTimelineProgress = (...args) => window.updateTimelineProgress?.(...args);
const refreshAnalysisIfActive = (...args) => { if (typeof window.refreshAnalysisIfActive === 'function') window.refreshAnalysisIfActive(...args); };
const parseDateTime = (...args) => window.parseDateTime?.(...args);
const listenToPlanningChanges = (...args) => { if (typeof window.listenToPlanningChanges === 'function') window.listenToPlanningChanges(...args); };

// --- Shared mutable state ---
let currentDowntimeStart = null;
let downtimeTimer = null;
let downtimeNotificationSent = false;
let machineStatus = 'running';
let productionTimer = null;
let productionTimerBaseSeconds = 0;
let productionTimerResumeTimestamp = null;
let hourlyChartInstance = null;
let opChartInstance = null;
let isRefreshingLaunchCharts = false;
let launchChartMode = 'hourly';
let machineCardData = [];
let activeMachineCard = null;

// --- Extracted Launch Functions ---

    async function handleManualDowntimeSubmit(e) {
        e.preventDefault();
        e.stopPropagation();
        
        // ✅ POKA-YOKE: Bloquear lançamento se OP não estiver ativada
        if (!validateOrderActivated()) {
            return;
        }
        
        if (!window.authSystem || !window.authSystem.checkPermissionForAction) {
            showNotification('Erro de permissão', 'error');
            return;
        }

        if (!window.authSystem.checkPermissionForAction('add_downtime')) {
            showNotification('Permissão negada para registrar paradas', 'error');
            return;
        }

        if (!window.selectedMachineData) {
            showNotification('Selecione uma máquina', 'warning');
            return;
        }

        // ✅ POKA-YOKE: Operador obrigatório
        const userInput = document.getElementById('manual-downtime-user');
        const userCod = userInput ? parseInt(userInput.value, 10) : null;
        if (userCod === null || isNaN(userCod) || userInput.value === '') {
            alert('⚠️ Operador obrigatório!\n\nPor favor, digite o código do operador responsável.');
            if (userInput) userInput.focus();
            return;
        }
        const userData = getUserByCode ? getUserByCode(userCod) : null;
        if (!userData) {
            alert('⚠️ Código inválido!\n\nO código digitado não foi encontrado no sistema.\nVerifique e tente novamente.');
            if (userInput) userInput.focus();
            return;
        }
        const nomeUsuario = userData.nomeUsuario;

        const dateStartInput = document.getElementById('manual-downtime-date-start');
        const dateEndInput = document.getElementById('manual-downtime-date-end');
        const startTimeInput = document.getElementById('manual-downtime-start');
        const endTimeInput = document.getElementById('manual-downtime-end');
        const reasonSelect = document.getElementById('manual-downtime-reason');
        const obsInput = document.getElementById('manual-downtime-obs');

        const dateStartStr = (dateStartInput?.value || '').trim();
        const dateEndStr = (dateEndInput?.value || '').trim();
        const startTime = (startTimeInput?.value || '').trim();
        const endTime = (endTimeInput?.value || '').trim();
        const reason = reasonSelect?.value || '';
        const obs = (obsInput?.value || '').trim();

        if (!dateStartStr || !startTime || !endTime || !reason) {
            showNotification('Preencha data inicial, horários e motivo', 'warning');
            return;
        }

        try {
            const todayStr = getProductionDateString();
            const finalDateEnd = dateEndStr || dateStartStr;

            // Validar coerência temporal
            const dtStart = new Date(`${dateStartStr}T${startTime}:00`);
            const dtEnd = new Date(`${finalDateEnd}T${endTime}:00`);
            
            if (Number.isNaN(dtStart.getTime()) || Number.isNaN(dtEnd.getTime()) || dtEnd <= dtStart) {
                showNotification('Intervalo de parada inválido', 'warning');
                return;
            }

            // Quebrar em segmentos por dia
            const segments = splitDowntimeIntoDailySegments(dateStartStr, startTime, finalDateEnd, endTime);
            if (!segments.length) {
                showNotification('Não foi possível processar o período informado', 'error');
                return;
            }

            // Persistir cada segmento
            const currentUser = getActiveUser();
            for (const seg of segments) {
                // Inferir turno do segmento
                const segShift = typeof inferShiftFromSegment === 'function' 
                    ? inferShiftFromSegment(seg.date, seg.startTime, seg.endTime) 
                    : null;
                const downtimeData = {
                    machine: window.selectedMachineData.machine,
                    date: seg.date,
                    startTime: seg.startTime,
                    endTime: seg.endTime,
                    duration: seg.duration,
                    reason: reason,
                    observations: obs,
                    shift: segShift,
                    turno: segShift,
                    // Dados do operador
                    userCod: userCod,
                    nomeUsuario: nomeUsuario,
                    registradoPor: currentUser?.username || null,
                    registradoPorNome: getCurrentUserName(),
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                };

                await getDb().collection('downtime_entries').add(downtimeData);
            }

            // Calcular duração total para o log
            const totalDuration = segments.reduce((sum, seg) => sum + (seg.duration || 0), 0);

            // Registrar no histórico do sistema
            if (typeof logSystemAction === 'function') {
                logSystemAction('parada', `Parada manual registrada: ${reason}`, {
                    maquina: window.selectedMachineData?.machine,
                    motivo: reason,
                    inicio: startTime,
                    fim: endTime,
                    duracao: totalDuration,
                    dataInicio: dateStartStr,
                    dataFim: finalDateEnd
                });
            }

            closeModal('manual-downtime-modal');
            
            // Salvar posição do scroll antes de atualizar
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
            
            await Promise.all([
                loadTodayStats(),
                loadRecentEntries(false)
            ]);
            
            // Restaurar posição do scroll após atualizações
            requestAnimationFrame(() => {
                window.scrollTo({ left: scrollLeft, top: scrollTop, behavior: 'instant' });
            });

            showNotification('✅ Parada manual registrada com sucesso!', 'success');
        } catch (error) {
            console.error('Erro ao registrar parada:', error);
            showNotification('❌ Erro ao registrar parada: ' + error.message, 'error');
        }
    }

    // =============================================
    // PARADA AVULSA (SEM OP) - Grid Start/Stop
    // =============================================

    // Cache de estado das paradas ativas sem OP
    let _standaloneActiveDowntimes = {};
    let _standaloneSelectedMachine = null;
    let _standaloneTimerInterval = null;

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
            const snapshot = await getDb().collection('active_downtimes').where('semOP', '==', true).get();
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
                    : (await getDb().collection('active_downtimes').get()).docs.map(d => ({id: d.id, ...d.data()}));
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
        if (typeof machineCardData !== 'undefined' && machineCardData) {
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
        const userData = getUserByCode ? getUserByCode(userCod) : null;
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

            await getDb().collection('active_downtimes').doc(normalizedId).set(activeDowntimeData, { merge: true });
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
            const shiftFallback = activeData.startShift || activeData.shift || activeData.turno || null;
            for (const seg of segments) {
                // FIX: Usar turno do SEGMENTO para correta exibição cross-turno
                const segShift = seg.shift || shiftFallback;
                const downtimeData = {
                    machine: machineId,
                    date: seg.date,
                    startTime: seg.startTime,
                    endTime: seg.endTime,
                    duration: seg.duration,
                    reason: activeData.reason || '',
                    observations: activeData.observations || '',
                    shift: segShift,
                    turno: segShift,
                    semOP: true,
                    batchDowntime: activeData.batchDowntime || false,
                    userCod: activeData.userCod || null,
                    nomeUsuario: activeData.nomeUsuario || null,
                    registradoPor: currentUser?.username || null,
                    registradoPorNome: getCurrentUserName(),
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                };
                await getDb().collection('downtime_entries').add(downtimeData);
            }

            // Remover de active_downtimes
            const docId = activeData.docId || normalizedId;
            await getDb().collection('active_downtimes').doc(docId).delete();
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

    // Expor no escopo global para uso no onclick do HTML
    window.openStandaloneDowntimeModal = openStandaloneDowntimeModal;
    window.closeStandaloneModal = function() {
        stopStandaloneTimerUpdate();
        closeModal('standalone-downtime-modal');
    };

    // =============================================
    // FINALIZAR PARADA VIA CARD (Aba Lançamento)
    // =============================================
    
    // Armazena dados da parada sendo finalizada via card
    let _cardFinishDowntimeMachine = null;
    
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
            const doc = await getDb().collection('active_downtimes').doc(_cardFinishDowntimeMachine).get();
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
                const doc = await getDb().collection('active_downtimes').doc(normalizedId).get();
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
    
    // Expor funções globalmente
    window.openCardFinishDowntimeModal = openCardFinishDowntimeModal;
    window.closeCardFinishDowntimeModal = closeCardFinishDowntimeModal;
    window.confirmCardFinishDowntime = confirmCardFinishDowntime;

    // =============================================
    // PARADA EM LOTE - Múltiplas Máquinas ao Mesmo Tempo
    // =============================================

    // Cache de máquinas selecionadas para parada em lote
    let _batchSelectedMachines = new Set();

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

        const machines = window.machineDatabase || window.databaseModule?.window.machineDatabase || [];
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
        const machines = window.machineDatabase || window.databaseModule?.window.machineDatabase || [];
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
        const userData = getUserByCode ? getUserByCode(userCod) : null;
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
            const batch = getDb().batch();
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

                    batch.set(getDb().collection('active_downtimes').doc(normalizedId), activeDowntimeData, { merge: true });

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

    // Expor funções de parada em lote globalmente
    window.openBatchDowntimeModal = openBatchDowntimeModal;
    window.closeBatchDowntimeModal = closeBatchDowntimeModal;
    window.toggleBatchMachine = toggleBatchMachine;
    window.toggleBatchMachineClick = toggleBatchMachineClick;
    window.batchSelectAllMachines = batchSelectAllMachines;
    window.batchDeselectAllMachines = batchDeselectAllMachines;

    // =============================================
    // FIM - PARADA EM LOTE
    // =============================================
    
    async function finishDowntime() {
        try {
            console.log('[TRACE][finishDowntime] invoked', { currentDowntimeStart, machineStatus });
            if (!currentDowntimeStart) {
                console.warn('Nenhuma parada ativa para finalizar.');
                return;
            }

            const now = new Date();
            const endTime = now.toTimeString().substr(0, 5);

            const startDateStr = currentDowntimeStart.date || formatDateYMD(currentDowntimeStart.startTimestamp || now);
            const endDateStr = formatDateYMD(now);

            const segments = splitDowntimeIntoDailySegments(startDateStr, currentDowntimeStart.startTime, endDateStr, endTime);
            console.log('[TRACE][finishDowntime] segments', segments);

            if (!segments.length) {
                // fallback simples - validar motivo antes de salvar
                if (!currentDowntimeStart.reason || currentDowntimeStart.reason.trim() === '') {
                    console.error('[DOWNTIME][FINISH] Tentativa de salvar parada sem motivo');
                    alert('⚠️ Erro: Motivo da parada não foi informado.\n\nEsta parada não pode ser finalizada sem um motivo válido.');
                    return;
                }
                const downtimeData = {
                    ...currentDowntimeStart,
                    endTime,
                    duration: 1,
                    shift: currentDowntimeStart.startShift || currentDowntimeStart.shift || currentDowntimeStart.turno || null,
                    turno: currentDowntimeStart.startShift || currentDowntimeStart.shift || currentDowntimeStart.turno || null,
                    batchDowntime: currentDowntimeStart.batchDowntime || false,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                };
                await getDb().collection('downtime_entries').add(downtimeData);
            } else {
                // Validar motivo antes de salvar os segmentos
                if (!currentDowntimeStart.reason || currentDowntimeStart.reason.trim() === '') {
                    console.error('[DOWNTIME][FINISH] Tentativa de salvar parada sem motivo');
                    alert('⚠️ Erro: Motivo da parada não foi informado.\n\nEsta parada não pode ser finalizada sem um motivo válido.');
                    return;
                }
                const shiftFallback = currentDowntimeStart.startShift || currentDowntimeStart.shift || currentDowntimeStart.turno || null;
                for (const seg of segments) {
                    // FIX: Usar turno do SEGMENTO para correta exibição cross-turno
                    const segShift = seg.shift || shiftFallback;
                    const downtimeData = {
                        machine: currentDowntimeStart.machine,
                        date: seg.date,
                        startTime: seg.startTime,
                        endTime: seg.endTime,
                        duration: seg.duration,
                        reason: currentDowntimeStart.reason,
                        observations: currentDowntimeStart.observations || '',
                        shift: segShift,
                        turno: segShift,
                        batchDowntime: currentDowntimeStart.batchDowntime || false,
                        userCod: currentDowntimeStart.userCod ?? null,
                        nomeUsuario: currentDowntimeStart.nomeUsuario || null,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    };
                    await getDb().collection('downtime_entries').add(downtimeData);
                }
            }
            
            // Remover parada ativa do Firebase
            try {
                const normalizedMachineForDelete = normalizeMachineId(currentDowntimeStart.machine);
                await getDb().collection('active_downtimes').doc(normalizedMachineForDelete).delete();
                console.log('[TRACE] Parada ativa removida do Firebase');
            } catch (error) {
                console.error('Erro ao remover parada ativa do Firebase:', error);
            }
            
            // Resetar status
            currentDowntimeStart = null;
            machineStatus = 'running';
            updateMachineStatus();
            stopDowntimeTimer();
            resumeProductionTimer();
            
            loadTodayStats();
            await loadRecentEntries(false);
            
            // Mostrar sucesso
            showNotification('Parada finalizada!', 'success');

            console.log('[TRACE][finishDowntime] successfully persisted and reset state');
            
        } catch (error) {
            console.error("Erro ao finalizar parada: ", error);
            alert('Erro ao finalizar parada. Tente novamente.');
        }
    }
    
    // Handler para registrar retrabalho
    async function handleReworkSubmit(e) {
        e.preventDefault();
        
        // ✅ POKA-YOKE: Bloquear lançamento se OP não estiver ativada
        if (!isOrderActiveForCurrentMachine()) {
            showNotification('⚠️ Ative uma OP antes de fazer lançamentos. Vá em "Ordens" e clique em "Ativar" na OP desejada.', 'warning');
            return;
        }

        // ✅ POKA-YOKE: Bloquear lançamento se ciclo/cavidades não foram informados
        if (!validateCycleCavityLaunched()) {
            return;
        }
        
        // Verificar permissão
        if (!window.authSystem.checkPermissionForAction('add_rework')) {
            return;
        }
        
        console.log('[TRACE][handleReworkSubmit] triggered', { selectedMachineData: window.selectedMachineData });

        if (!window.selectedMachineData) {
            alert('Nenhuma máquina selecionada. Selecione uma máquina para registrar o retrabalho.');
            return;
        }

        const qtyInput = document.getElementById('quick-rework-qty');
        const weightInput = document.getElementById('quick-rework-weight');
        const reasonSelect = document.getElementById('quick-rework-reason');
        const obsInput = document.getElementById('quick-rework-obs');

        const quantity = parseInt(qtyInput?.value, 10) || 0;
        const weight = parseFloat(weightInput?.value) || 0;
        const reason = reasonSelect?.value || '';
        const observations = (obsInput?.value || '').trim();

        if (quantity <= 0) {
            alert('Informe uma quantidade válida de peças para retrabalho.');
            if (qtyInput) qtyInput.focus();
            return;
        }

        if (!reason) {
            alert('Selecione o motivo do retrabalho.');
            if (reasonSelect) reasonSelect.focus();
            return;
        }

        const planId = window.selectedMachineData?.id || null;
        if (!planId) {
            alert('Não foi possível identificar o planejamento associado a esta máquina.');
            return;
        }

        const currentShift = getCurrentShift();
        const dataReferencia = getProductionDateString();
        const currentUser = getActiveUser();

        console.log('[TRACE][handleReworkSubmit] starting rework submission');

        try {
            const machineId = window.selectedMachineData.machine || '';
            const shiftKey = `T${currentShift}`;
            const productionDocsMap = new Map();
            const dateFields = ['data', 'workDay'];
            const shiftVariants = [currentShift, shiftKey, String(currentShift)];

            for (const field of dateFields) {
                for (const shiftVariant of shiftVariants) {
                    try {
                        const snapshot = await getDb().collection('production_entries')
                            .where('machine', '==', machineId)
                            .where(field, '==', dataReferencia)
                            .where('turno', '==', shiftVariant)
                            .get();

                        if (!snapshot.empty) {
                            console.log(`[TRACE][handleReworkSubmit] found ${snapshot.size} production entries via ${field}/${shiftVariant}`);
                            snapshot.docs.forEach((doc) => productionDocsMap.set(doc.id, doc));
                        }
                    } catch (queryError) {
                        console.warn(`[TRACE][handleReworkSubmit] query failed for ${field}/${shiftVariant}`, queryError);
                    }
                }
            }

            const productionDocs = Array.from(productionDocsMap.values());
            console.log(`[TRACE][handleReworkSubmit] total candidate production docs: ${productionDocs.length}`);

            const transactionResult = await getDb().runTransaction(async (transaction) => {
                const reworkRef = getDb().collection('rework_entries').doc();
                let totalDeducted = 0;
                let adjustedDocs = 0;

                for (const doc of productionDocs) {
                    const freshSnapshot = await transaction.get(doc.ref);
                    if (!freshSnapshot.exists) {
                        console.warn(`[TRACE][handleReworkSubmit] skipping missing production doc ${doc.id}`);
                        continue;
                    }

                    const prodData = freshSnapshot.data() || {};
                    const docShiftKey = normalizeShiftValue(prodData.turno);
                    if (docShiftKey && docShiftKey !== shiftKey) {
                        console.log(`[TRACE][handleReworkSubmit] skipping production doc ${doc.id} for shift ${docShiftKey}`);
                        continue;
                    }

                    const currentQty = Number(prodData.produzido ?? prodData.quantity ?? prodData.quantidade ?? 0) || 0;
                    if (currentQty <= 0) {
                        console.log(`[TRACE][handleReworkSubmit] skipping production doc ${doc.id} (current quantity <= 0)`);
                        continue;
                    }

                    const newQty = Math.max(0, currentQty - quantity);
                    const deducted = currentQty - newQty;
                    if (deducted <= 0) {
                        console.log(`[TRACE][handleReworkSubmit] no deduction applied to doc ${doc.id} (current=${currentQty}, requested=${quantity})`);
                        continue;
                    }

                    totalDeducted += deducted;
                    adjustedDocs += 1;

                    const updatePayload = {
                        produzido: newQty,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                        lastAdjustment: {
                            type: 'rework_deduction',
                            requestedQty: quantity,
                            appliedQty: deducted,
                            previousQty: currentQty,
                            newQty,
                            shift: shiftKey,
                            reworkTurn: currentShift,
                            reworkWorkDay: dataReferencia,
                            adjustedBy: currentUser.username || currentUser.email || 'sistema',
                            adjustedByName: getCurrentUserName(),
                            adjustedAt: firebase.firestore.FieldValue.serverTimestamp(),
                            reason: reason,
                            observations: observations
                        }
                    };

                    const aliasFields = ['quantity', 'quantidade', 'executed', 'executedQty', 'executedQuantity', 'finalQuantity'];
                    aliasFields.forEach((field) => {
                        if (Object.prototype.hasOwnProperty.call(prodData, field)) {
                            updatePayload[field] = newQty;
                        }
                    });

                    transaction.update(doc.ref, updatePayload);
                    console.log(`[TRACE][handleReworkSubmit] adjusted production doc ${doc.id}: ${currentQty} -> ${newQty} (deducted ${deducted})`);
                }

                if (totalDeducted > 0) {
                    try {
                        const planRef = getDb().collection('planning').doc(planId);
                        const planSnapshot = await transaction.get(planRef);
                        if (planSnapshot.exists) {
                            const planData = planSnapshot.data() || {};
                            const planUpdate = {};
                            const planShiftData = planData[shiftKey];

                            if (planShiftData && typeof planShiftData === 'object') {
                                const planShiftCurrent = Number(planShiftData.produzido ?? planShiftData.quantity ?? planShiftData.quantidade ?? 0) || 0;
                                const planShiftNew = Math.max(0, planShiftCurrent - totalDeducted);
                                planUpdate[`${shiftKey}.produzido`] = planShiftNew;
                                if (Object.prototype.hasOwnProperty.call(planShiftData, 'quantity')) {
                                    planUpdate[`${shiftKey}.quantity`] = planShiftNew;
                                }
                                if (Object.prototype.hasOwnProperty.call(planShiftData, 'quantidade')) {
                                    planUpdate[`${shiftKey}.quantidade`] = planShiftNew;
                                }
                            }

                            ['total_produzido', 'totalProduced', 'executed_total', 'produzido_total'].forEach((field) => {
                                if (planData[field] !== undefined) {
                                    const currentTotal = Number(planData[field]) || 0;
                                    planUpdate[field] = Math.max(0, currentTotal - totalDeducted);
                                }
                            });

                            if (Object.keys(planUpdate).length > 0) {
                                planUpdate.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
                                transaction.update(planRef, planUpdate);
                                console.log(`[TRACE][handleReworkSubmit] plan ${planId} updated (deducted ${totalDeducted})`);
                            }
                        }
                    } catch (planError) {
                        console.warn('[TRACE][handleReworkSubmit] failed to update plan totals during rework', planError);
                    }

                    const resolveOrderId = () => {
                        const candidates = [
                            window.selectedMachineData.order_id,
                            window.selectedMachineData.production_order_id,
                            window.selectedMachineData.production_order,
                            window.selectedMachineData.orderId
                        ];
                        for (const candidate of candidates) {
                            if (!candidate) continue;
                            const trimmed = String(candidate).trim();
                            if (trimmed) return trimmed;
                        }
                        return null;
                    };

                    const linkedOrderId = resolveOrderId();
                    if (linkedOrderId) {
                        try {
                            const orderRef = getDb().collection('production_orders').doc(linkedOrderId);
                            const orderSnapshot = await transaction.get(orderRef);
                            if (orderSnapshot.exists) {
                                const orderData = orderSnapshot.data() || {};
                                const orderUpdate = {};
                                const currentOrderTotal = Number(orderData.total_produzido ?? orderData.totalProduced ?? 0) || 0;
                                const newOrderTotal = Math.max(0, currentOrderTotal - totalDeducted);

                                if ('total_produzido' in orderData || !('totalProduced' in orderData)) {
                                    orderUpdate.total_produzido = newOrderTotal;
                                }
                                if ('totalProduced' in orderData) {
                                    orderUpdate.totalProduced = newOrderTotal;
                                }

                                if (orderData.last_progress && typeof orderData.last_progress === 'object') {
                                    const lastProgressExecuted = Number(orderData.last_progress.executed ?? orderData.last_progress.total ?? 0) || 0;
                                    const newLastExecuted = Math.max(0, lastProgressExecuted - totalDeducted);
                                    orderUpdate['last_progress.executed'] = newLastExecuted;
                                    orderUpdate['last_progress.updatedAt'] = firebase.firestore.FieldValue.serverTimestamp();
                                }

                                if (Object.keys(orderUpdate).length > 0) {
                                    orderUpdate.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
                                    transaction.update(orderRef, orderUpdate);
                                    console.log(`[TRACE][handleReworkSubmit] production order ${linkedOrderId} updated (deducted ${totalDeducted})`);
                                }
                            }
                        } catch (orderError) {
                            console.warn('[TRACE][handleReworkSubmit] failed to update production order totals during rework', orderError);
                        }
                    }
                }

                const reworkData = {
                    planId,
                    data: dataReferencia,
                    turno: currentShift,
                    shiftKey,
                    quantidade: quantity,
                    appliedQuantity: totalDeducted,
                    documentosAjustados: adjustedDocs,
                    peso_kg: weight > 0 ? weight : null,
                    motivo: reason,
                    observacoes: observations,
                    machine: window.selectedMachineData.machine || null,
                    mp: window.selectedMachineData.mp || '',
                    registradoPor: currentUser.username || null,
                    registradoPorNome: getCurrentUserName(),
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                };

                transaction.set(reworkRef, reworkData);
                console.log(`[TRACE][handleReworkSubmit] rework document prepared (adjustedDocs=${adjustedDocs}, totalDeducted=${totalDeducted})`);

                return { totalDeducted, adjustedDocs };
            });

            closeModal('quick-rework-modal');
            await populateMachineSelector();
            await Promise.all([
                loadTodayStats(),
                refreshLaunchCharts(),
                loadRecentEntries(false),
                refreshAnalysisIfActive()
            ]);

            if (transactionResult?.totalDeducted > 0) {
                showNotification('Retrabalho registrado e quantidade ajustada com sucesso!', 'success');
            } else {
                showNotification('Retrabalho registrado. Nenhum lançamento de produção foi ajustado para este turno.', 'warning');
            }
            
            // Registrar log de retrabalho
            registrarLogSistema('LANÇAMENTO DE RETRABALHO', 'retrabalho', {
                machine: window.selectedMachineData?.machine,
                quantidade: quantity,
                peso_kg: weight,
                motivo: reason,
                observacoes: observations
            });

            console.log('[TRACE][handleReworkSubmit] success path completed', transactionResult);
        } catch (error) {
            console.error('Erro ao registrar retrabalho:', error);
            alert('Erro ao registrar retrabalho. Tente novamente.');
        }
    }

    // Função utilitária para retry com backoff exponencial (para erros 429)
    async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
        let lastError;
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error;
                const is429 = error.message?.includes('429') || error.code === 'resource-exhausted';
                if (!is429 || attempt === maxRetries) {
                    throw error;
                }
                const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 500;
                console.log(`[RETRY] Tentativa ${attempt + 1} falhou com 429, aguardando ${Math.round(delay)}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        throw lastError;
    }
    
    // Funções auxiliares (getCurrentShift importado de date.utils.js)

    function getShiftStartDateTime(reference = new Date()) {
        const shift = getCurrentShift(reference);
        const productionDay = getProductionDateString(reference);
        const shiftStartMap = {
            1: '07:00',
            2: '15:00',
            3: '23:20'
        };
        const startTime = shiftStartMap[shift] || '07:00';
        const startDate = combineDateAndTime(productionDay, startTime);
        if (startDate instanceof Date && !Number.isNaN(startDate.getTime())) {
            return startDate;
        }
        return null;
    }
    
    function updateMachineStatus() {
        // Notificação Web Push se máquina parada > 10 minutos
        if (machineStatus === 'stopped' && currentDowntimeStart) {
            const now = new Date();
            const startDateTime = combineDateAndTime(currentDowntimeStart.date, currentDowntimeStart.startTime);
            if (startDateTime instanceof Date && !Number.isNaN(startDateTime.getTime())) {
                const elapsedMs = now - startDateTime;
                if (elapsedMs > 10 * 60 * 1000 && !downtimeNotificationSent) {
                    sendDowntimeNotification();
                    downtimeNotificationSent = true;
                }
                if (elapsedMs <= 10 * 60 * 1000) {
                    downtimeNotificationSent = false;
                }
            }
        } else {
            downtimeNotificationSent = false;
        }
// Envia notificação Web Push se permitido
function sendDowntimeNotification() {
    if ('serviceWorker' in navigator && 'Notification' in window && Notification.permission === 'granted') {
        navigator.serviceWorker.getRegistration().then(function(reg) {
            if (reg) {
                reg.showNotification('Atenção: Máquina parada', {
                    body: 'Uma máquina está parada há mais de 10 minutos.',
                    icon: 'https://i.postimg.cc/5jdHwhF9/hokkaido-logo-110.png',
                    badge: 'https://i.postimg.cc/5jdHwhF9/hokkaido-logo-110.png',
                    data: '/'
                });
            }
        });
    }
}
    console.log('[DEBUG] updateMachineStatus: machineStatus=', machineStatus, 'currentDowntimeStart=', currentDowntimeStart);
    console.log('[DEBUG] toggleDowntime: chamado, machineStatus=', machineStatus, 'currentDowntimeStart=', currentDowntimeStart);
    console.log('[DEBUG] handleDowntimeSubmit: início, machineStatus=', machineStatus, 'currentDowntimeStart=', currentDowntimeStart);
        const btnDowntime = document.getElementById('btn-downtime');
        const downtimeIcon = document.getElementById('downtime-icon');
        const downtimeText = document.getElementById('downtime-text');
        const downtimeSubtitle = document.getElementById('downtime-subtitle');
        
        if (machineStatus === 'stopped') {
            // Máquina parada - mostrar botão START (verde)
            btnDowntime.classList.remove('from-red-500', 'to-red-600', 'hover:from-red-600', 'hover:to-red-700');
            btnDowntime.classList.add('from-green-500', 'to-green-600', 'hover:from-green-600', 'hover:to-green-700');
            downtimeIcon.setAttribute('data-lucide', 'play-circle');
            downtimeText.textContent = 'START';
            
            // Mostrar tempo da parada atual se disponível
            if (currentDowntimeStart) {
                const now = new Date();
                const startDateTime = combineDateAndTime(currentDowntimeStart.date, currentDowntimeStart.startTime);
                if (startDateTime instanceof Date && !Number.isNaN(startDateTime.getTime())) {
                    const elapsedHours = ((now - startDateTime) / (1000 * 60 * 60)).toFixed(1);
                    downtimeSubtitle.textContent = `PARADA ATIVA - ${elapsedHours}h`;
                } else {
                    downtimeSubtitle.textContent = 'PARADA ATIVA - Retomar produção';
                }
            } else {
                downtimeSubtitle.textContent = 'Retomar produção';
            }
            
            downtimeSubtitle.classList.remove('text-red-100');
            downtimeSubtitle.classList.add('text-green-100');
        } else {
            // Máquina rodando - mostrar botão STOP (vermelho)
            btnDowntime.classList.remove('from-green-500', 'to-green-600', 'hover:from-green-600', 'hover:to-green-700');
            btnDowntime.classList.add('from-red-500', 'to-red-600', 'hover:from-red-600', 'hover:to-red-700');
            downtimeIcon.setAttribute('data-lucide', 'pause-circle');
            downtimeText.textContent = 'STOP';
            downtimeSubtitle.textContent = 'Parar máquina';
            downtimeSubtitle.classList.remove('text-green-100');
            downtimeSubtitle.classList.add('text-red-100');
        }
        
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
    
    /**
     * Timer visual de parada - atualiza a cada segundo
     * Usa múltiplas fontes de timestamp para robustez
     */
    function startDowntimeTimer() {
        const downtimeTimer = document.getElementById('downtime-timer');
        if (!downtimeTimer) return;
        
        downtimeTimer.classList.remove('hidden');
        
        const updateTimer = () => {
            if (!currentDowntimeStart) {
                downtimeTimer.textContent = '00:00:00';
                return;
            }
            
            const now = new Date();
            
            // Tentar obter o timestamp de início de múltiplas fontes
            let start = null;
            
            // Prioridade 1: Timestamp direto (objeto Date)
            if (currentDowntimeStart.startTimestamp instanceof Date && !isNaN(currentDowntimeStart.startTimestamp.getTime())) {
                start = currentDowntimeStart.startTimestamp;
            }
            // Prioridade 2: Timestamp ISO local
            else if (currentDowntimeStart.startTimestampLocal) {
                start = new Date(currentDowntimeStart.startTimestampLocal);
            }
            // Prioridade 3: Combinar data + hora
            else if (currentDowntimeStart.date && currentDowntimeStart.startTime) {
                start = parseDateTime(currentDowntimeStart.date, currentDowntimeStart.startTime);
            }
            // Prioridade 4: Fallback para combineDateAndTime
            else {
                start = combineDateAndTime(currentDowntimeStart.date, currentDowntimeStart.startTime);
            }
            
            if (!(start instanceof Date) || isNaN(start.getTime())) {
                downtimeTimer.textContent = '--:--:--';
                downtimeTimer.title = 'Erro ao calcular duração';
                return;
            }
            
            let diffMs = now.getTime() - start.getTime();
            if (diffMs < 0) diffMs = 0;
            
            const diffSec = Math.floor(diffMs / 1000);
            const days = Math.floor(diffSec / 86400);
            const hours = Math.floor((diffSec % 86400) / 3600);
            const minutes = Math.floor((diffSec % 3600) / 60);
            const seconds = diffSec % 60;
            
            // Formatar exibição baseada na duração
            let timeDisplay;
            if (days >= 1) {
                timeDisplay = `${days}d ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
            } else {
                timeDisplay = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            }
            downtimeTimer.textContent = timeDisplay;
            
            // Limpar classes anteriores
            downtimeTimer.classList.remove(
                'bg-red-300', 'bg-red-500', 'bg-orange-300', 'bg-yellow-300', 'bg-purple-300',
                'text-red-800', 'text-orange-800', 'text-yellow-800', 'text-purple-800', 'text-white',
                'animate-pulse'
            );
            
            // Alertas visuais baseados na duração
            const totalHours = diffMs / (1000 * 60 * 60);
            
            if (days >= 1) {
                // 1+ dia - Roxo/Crítico com animação
                downtimeTimer.classList.add('bg-purple-300', 'text-purple-800', 'animate-pulse');
                downtimeTimer.title = `⚠️ PARADA CRÍTICA: ${days} dia(s) e ${hours}h - Verificar urgentemente!`;
            } else if (totalHours >= 8) {
                // 8+ horas - Vermelho escuro (turno completo)
                downtimeTimer.classList.add('bg-red-500', 'text-white');
                downtimeTimer.title = `⚠️ Parada muito longa: ${hours}h${minutes}m - Atenção!`;
            } else if (totalHours >= 4) {
                // 4+ horas - Laranja
                downtimeTimer.classList.add('bg-orange-300', 'text-orange-800');
                downtimeTimer.title = `Parada longa: ${hours}h${minutes}m`;
            } else if (totalHours >= 1) {
                // 1+ hora - Amarelo
                downtimeTimer.classList.add('bg-yellow-300', 'text-yellow-800');
                downtimeTimer.title = `Parada em andamento: ${hours}h${minutes}m`;
            } else {
                // < 1 hora - Vermelho padrão
                downtimeTimer.classList.add('bg-red-300', 'text-red-800');
                downtimeTimer.title = `Parada ativa: ${timeDisplay}`;
            }
        };
        
        // Executar imediatamente e depois a cada segundo
        updateTimer();
        
        // Limpar intervalo anterior se existir
        if (downtimeTimer.interval) {
            clearInterval(downtimeTimer.interval);
        }
        downtimeTimer.interval = setInterval(updateTimer, 1000);
    }
    
    function stopDowntimeTimer() {
        const downtimeTimer = document.getElementById('downtime-timer');
        if (downtimeTimer) {
            downtimeTimer.classList.add('hidden');
            if (downtimeTimer.interval) {
                clearInterval(downtimeTimer.interval);
            }
        }
    }

    function formatSecondsToClock(totalSeconds) {
        const safeSeconds = Math.max(0, Math.floor(totalSeconds || 0));
        const hours = Math.floor(safeSeconds / 3600);
        const minutes = Math.floor((safeSeconds % 3600) / 60);
        const seconds = safeSeconds % 60;
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    function updateProductionTimeDisplay(seconds) {
        if (!productionTimeDisplay) return;
        productionTimeDisplay.textContent = formatSecondsToClock(seconds);
    }

    function clearProductionTimerInterval() {
        if (productionTimer) {
            clearInterval(productionTimer);
            productionTimer = null;
        }
    }

    function resetProductionTimer() {
        productionTimerBaseSeconds = 0;
        productionTimerResumeTimestamp = null;
        clearProductionTimerInterval();
        updateProductionTimeDisplay(0);
    }

    function freezeProductionTimer() {
        if (productionTimerResumeTimestamp) {
            const elapsed = Math.floor((Date.now() - productionTimerResumeTimestamp) / 1000);
            productionTimerBaseSeconds += Math.max(elapsed, 0);
            productionTimerResumeTimestamp = null;
        }
        clearProductionTimerInterval();
        updateProductionTimeDisplay(productionTimerBaseSeconds);
    }

    function resumeProductionTimer() {
        if (productionTimerResumeTimestamp) {
            return;
        }
        productionTimerResumeTimestamp = Date.now();
        clearProductionTimerInterval();
        updateProductionTimeDisplay(productionTimerBaseSeconds);
        productionTimer = setInterval(() => {
            const elapsed = Math.floor((Date.now() - productionTimerResumeTimestamp) / 1000);
            updateProductionTimeDisplay(productionTimerBaseSeconds + Math.max(elapsed, 0));
        }, 1000);
    }

    function synchronizeProductionTimer(elapsedSeconds, shouldRun) {
        productionTimerBaseSeconds = Math.max(0, Math.floor(elapsedSeconds || 0));
        productionTimerResumeTimestamp = shouldRun ? Date.now() : null;
        clearProductionTimerInterval();
        updateProductionTimeDisplay(productionTimerBaseSeconds);

        if (!shouldRun) {
            return;
        }

        productionTimer = setInterval(() => {
            if (!productionTimerResumeTimestamp) {
                clearProductionTimerInterval();
                return;
            }
            const elapsed = Math.floor((Date.now() - productionTimerResumeTimestamp) / 1000);
            updateProductionTimeDisplay(productionTimerBaseSeconds + Math.max(elapsed, 0));
        }, 1000);
    }

    // Calcula o tempo de produção efetivo do turno atual desconsiderando paradas registradas.
    function calculateProductionRuntimeSeconds({ shiftStart, now, downtimes = [], activeDowntime = null }) {
        if (!(shiftStart instanceof Date) || Number.isNaN(shiftStart.getTime())) {
            return 0;
        }

        const referenceNow = now instanceof Date ? now : new Date();
        if (referenceNow <= shiftStart) {
            return 0;
        }

        const shiftStartMs = shiftStart.getTime();
        const nowMs = referenceNow.getTime();
        let downtimeMillis = 0;

        // Helper function to extract start time with multiple field name support
        const extractStartTime = (dt) => {
            // Try multiple date field names
            const dateStr = dt.date || dt.start_date || dt.data_inicio;
            
            // Try multiple start time field names
            const timeStr = dt.startTime || dt.start_time || dt.hora_inicio || dt.horaInicio;
            
            if (dateStr && timeStr) {
                const combined = combineDateAndTime(dateStr, timeStr);
                if (combined instanceof Date && !Number.isNaN(combined.getTime())) {
                    return combined;
                }
            }
            
            // Try parsing as a full datetime
            if (dt.start_datetime) {
                const asDate = dt.start_datetime?.toDate?.() || new Date(dt.start_datetime);
                if (asDate instanceof Date && !Number.isNaN(asDate.getTime())) {
                    return asDate;
                }
            }
            
            return null;
        };

        // Helper function to extract end time with multiple field name support
        const extractEndTime = (dt) => {
            // Try multiple date field names
            const dateStr = dt.date || dt.end_date || dt.data_fim;
            
            // Try multiple end time field names
            const timeStr = dt.endTime || dt.end_time || dt.hora_fim || dt.horaFim;
            
            if (dateStr && timeStr) {
                const combined = combineDateAndTime(dateStr, timeStr);
                if (combined instanceof Date && !Number.isNaN(combined.getTime())) {
                    return combined;
                }
            }
            
            // Try parsing as a full datetime
            if (dt.end_datetime) {
                const asDate = dt.end_datetime?.toDate?.() || new Date(dt.end_datetime);
                if (asDate instanceof Date && !Number.isNaN(asDate.getTime())) {
                    return asDate;
                }
            }
            
            return null;
        };

        downtimes.forEach(dt => {
            if (!dt) return;
            
            const start = extractStartTime(dt);
            if (!(start instanceof Date) || Number.isNaN(start.getTime())) {
                return;
            }

            let effectiveEnd = extractEndTime(dt);
            
            // If no explicit end time, try to calculate from duration
            if (!(effectiveEnd instanceof Date) || Number.isNaN(effectiveEnd.getTime()) || effectiveEnd <= start) {
                // Try multiple duration field names
                const durationMinutes = Number(dt.duration || dt.duracao || dt.duration_minutes || dt.duracao_minutos || 0);
                effectiveEnd = new Date(start.getTime() + Math.max(durationMinutes, 0) * 60000);
            }

            const windowStart = Math.max(start.getTime(), shiftStartMs);
            const windowEnd = Math.min(effectiveEnd.getTime(), nowMs);
            if (windowEnd > windowStart) {
                downtimeMillis += windowEnd - windowStart;
            }
        });

        if (activeDowntime) {
            const activeStart = extractStartTime(activeDowntime);
            if (activeStart instanceof Date && !Number.isNaN(activeStart.getTime())) {
                const windowStart = Math.max(activeStart.getTime(), shiftStartMs);
                if (nowMs > windowStart) {
                    downtimeMillis += nowMs - windowStart;
                }
            }
        }

        const elapsedMillis = nowMs - shiftStartMs;
        const runtimeMillis = Math.max(0, elapsedMillis - downtimeMillis);
        return Math.floor(runtimeMillis / 1000);
    }
    
    function setRecentEntriesState({ loading = false, empty = false }) {
        if (recentEntriesLoading) {
            recentEntriesLoading.classList.toggle('hidden', !loading);
        }
        if (recentEntriesEmpty) {
            recentEntriesEmpty.classList.toggle('hidden', !empty);
        }
        if (recentEntriesList) {
            recentEntriesList.classList.toggle('hidden', empty);
        }
    }

    function updateRecentEntriesEmptyMessage(message) {
        if (recentEntriesEmpty) {
            recentEntriesEmpty.innerHTML = `<p class="text-sm text-gray-500">${message}</p>`;
        }
    }

    function formatEntryTimestamp(date) {
        if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
        return new Intl.DateTimeFormat('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        }).format(date);
    }

    function buildRecentEntryMarkup(entry) {
        const typeConfig = {
            production: { label: 'Produção', badge: 'bg-green-100 text-green-700 border border-green-200' },
            loss: { label: 'Perda', badge: 'bg-orange-100 text-orange-700 border border-orange-200' },
            downtime: { label: 'Parada', badge: 'bg-red-100 text-red-700 border border-red-200' },
            rework: { label: 'Retrabalho', badge: 'bg-purple-100 text-purple-700 border border-purple-200' }
        };

        const config = typeConfig[entry.type] || { label: 'Lançamento', badge: 'bg-gray-100 text-gray-600 border border-gray-200' };
        const turnoLabel = entry.data.turno ? `Turno ${entry.data.turno}` : null;
        const timeLabel = formatEntryTimestamp(entry.timestamp);
        // Operador que fez o lançamento (código + nome)
        const operadorNome = entry.data.nomeUsuario || null;
        const operadorCod = entry.data.userCod !== undefined ? entry.data.userCod : null;
        const details = [];
        const parseNumber = (value) => {
            const parsed = parseOptionalNumber(value);
            return parsed !== null ? parsed : 0;
        };

        if (entry.data.mp) {
            details.push(`MP: ${entry.data.mp}`);
        }

        if (entry.type === 'production') {
            const produzido = parseInt(entry.data.produzido ?? entry.data.quantity ?? 0, 10) || 0;
            
            details.push(`<span class="font-semibold text-gray-800">${produzido} peça(s)</span>`);
            const pesoBruto = parseNumber(entry.data.peso_bruto ?? entry.data.weight ?? 0);
            if (pesoBruto > 0) {
                details.push(`${pesoBruto.toFixed(3)} kg`);
            }
        } else if (entry.type === 'loss') {
            const refugoKg = parseNumber(entry.data.refugo_kg ?? entry.data.weight ?? 0);
            const quantidade = parseInt(entry.data.quantidade ?? 0, 10) || 0;
            
            if (quantidade > 0) {
                details.push(`<span class="font-semibold text-gray-800">${quantidade} peça(s)</span>`);
            }
            if (refugoKg > 0) {
                details.push(`<span class="font-semibold text-gray-800">${refugoKg.toFixed(3)} kg</span>`);
            }
            if (entry.data.perdas || entry.data.motivo) {
                details.push(`Motivo: ${entry.data.perdas || entry.data.motivo}`);
            }
        } else if (entry.type === 'downtime') {
            const start = entry.data.startTime ? `${entry.data.startTime}` : '';
            const end = entry.data.endTime ? ` - ${entry.data.endTime}` : '';
            details.push(`Período: ${start}${end}`);
            
            // Calcular duração da parada
            if (entry.data.startTime && entry.data.endTime) {
                const [startHour, startMin] = entry.data.startTime.split(':').map(Number);
                const [endHour, endMin] = entry.data.endTime.split(':').map(Number);
                
                let startTotalMin = startHour * 60 + startMin;
                let endTotalMin = endHour * 60 + endMin;
                
                // Se fim é menor que inicio, passou da meia noite
                if (endTotalMin < startTotalMin) {
                    endTotalMin += 24 * 60;
                }
                
                const durationMin = endTotalMin - startTotalMin;
                const durationHours = Math.floor(durationMin / 60);
                const durationMins = durationMin % 60;
                
                let durationStr = '';
                if (durationHours > 0) {
                    durationStr = `${durationHours}h`;
                }
                if (durationMins > 0) {
                    durationStr += durationStr ? ` ${durationMins}min` : `${durationMins}min`;
                }
                if (durationMin === 0) {
                    durationStr = '0min';
                }
                
                details.push(`<span class="font-semibold text-red-600">⏱️ Duração: ${durationStr}</span>`);
            }
            
            if (entry.data.reason) {
                details.push(`Motivo: ${entry.data.reason}`);
            }
        } else if (entry.type === 'rework') {
            const quantidade = parseInt(entry.data.quantidade ?? entry.data.quantity ?? 0, 10) || 0;
            details.push(`<span class="font-semibold text-gray-800">${quantidade} peça(s)</span>`);
            const pesoKg = parseNumber(entry.data.peso_kg ?? entry.data.weight ?? 0);
            if (pesoKg > 0) {
                details.push(`${pesoKg.toFixed(3)} kg`);
            }
            if (entry.data.motivo) {
                details.push(`Motivo: ${entry.data.motivo}`);
            }
        }

        const observations = entry.data.observacoes || entry.data.observations || entry.data.notes;
        const canEdit = entry.type === 'production' || entry.type === 'loss';
        const actions = [];

        if (canEdit) {
            actions.push(`
                <button class="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50"
                        data-action="edit" data-entry-id="${entry.id}" data-entry-type="${entry.type}">
                    <i data-lucide="pencil" class="w-4 h-4"></i>
                    Editar
                </button>
            `);
        }

        actions.push(`
            <button class="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
                    data-action="delete" data-entry-id="${entry.id}" data-entry-type="${entry.type}">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
                Excluir
            </button>
        `);

        const metaChips = [config.label];
        if (turnoLabel) metaChips.push(turnoLabel);
        if (timeLabel) metaChips.push(timeLabel);
        
        // Construir badge do operador (somente se tiver nome)
        let operadorBadge = '';
        if (operadorNome) {
            operadorBadge = `<span class="px-2 py-1 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-200" title="Código: ${operadorCod}">👤 ${operadorNome}</span>`;
        }

        return `
            <div class="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
                <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div class="space-y-2 flex-1">
                        <div class="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                            <span class="px-2 py-1 rounded-full ${config.badge}">${config.label}</span>
                            ${turnoLabel ? `<span class="px-2 py-1 rounded-full bg-gray-100 text-gray-600 border border-gray-200">${turnoLabel}</span>` : ''}
                            ${timeLabel ? `<span>${timeLabel}</span>` : ''}
                            ${operadorBadge}
                        </div>
                        <div class="text-sm text-gray-700 space-x-2">
                            ${details.join('<span class="text-gray-300">–</span>')}
                        </div>
                        ${observations ? `<div class="text-xs text-gray-500">Obs.: ${observations}</div>` : ''}
                    </div>
                    <div class="flex items-center gap-2 flex-shrink-0">
                        ${actions.join('')}
                    </div>
                </div>
            </div>
        `;
    }

    function renderRecentEntries(entries) {
        if (!recentEntriesList) return;
        recentEntriesList.innerHTML = entries.map(buildRecentEntryMarkup).join('');
        if (typeof lucide !== 'undefined') {
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
    }

    async function loadRecentEntries(showLoading = true, filterDate = null) {
        if (!recentEntriesList) return;

        if (showLoading) {
            setRecentEntriesState({ loading: true, empty: false });
        }

        if (!window.selectedMachineData) {
            recentEntriesCache = new Map();
            if (recentEntriesList) recentEntriesList.innerHTML = '';
            updateRecentEntriesEmptyMessage('Selecione uma máquina para visualizar os lançamentos.');
            setRecentEntriesState({ loading: false, empty: true });
            return;
        }

        try {
            const date = filterDate || window.lancamentoFilterDate || getProductionDateString();
            const planId = window.selectedMachineData.id;

            const productionSnapshot = await getDb().collection('production_entries')
                .where('planId', '==', planId)
                .where('data', '==', date)
                .get();

            const entries = [];
            recentEntriesCache = new Map();

            productionSnapshot.forEach(doc => {
                const data = doc.data();
                const type = (data.refugo_kg && data.refugo_kg > 0) || data.perdas ? 'loss' : 'production';
                const resolvedTimestamp = resolveProductionDateTime(data) || data.updatedAt?.toDate?.() || data.timestamp?.toDate?.() || data.createdAt?.toDate?.() || (data.datetime ? new Date(data.datetime) : null);

                const entry = {
                    id: doc.id,
                    type,
                    collection: 'production_entries',
                    data,
                    timestamp: resolvedTimestamp
                };

                entries.push(entry);
                recentEntriesCache.set(doc.id, entry);
            });

            // Fallback: buscar lançamentos da máquina (ex. BORRA) que não possuem planId associado
            const machineId = normalizeMachineId(window.selectedMachineData.machine || '');
            if (machineId) {
                const machineSnapshot = await getDb().collection('production_entries')
                    .where('machine', '==', machineId)
                    .where('data', '==', date)
                    .get();

                machineSnapshot.forEach(doc => {
                    if (recentEntriesCache.has(doc.id)) return;
                    const data = doc.data();
                    const type = (data.refugo_kg && data.refugo_kg > 0) || data.perdas ? 'loss' : 'production';
                    const resolvedTimestamp = resolveProductionDateTime(data) || data.updatedAt?.toDate?.() || data.timestamp?.toDate?.() || data.createdAt?.toDate?.() || (data.datetime ? new Date(data.datetime) : null);

                    const entry = {
                        id: doc.id,
                        type,
                        collection: 'production_entries',
                        data,
                        timestamp: resolvedTimestamp
                    };

                    entries.push(entry);
                    recentEntriesCache.set(doc.id, entry);
                });
            }

            const downtimeSnapshot = await getDb().collection('downtime_entries')
                .where('machine', '==', window.selectedMachineData.machine)
                .where('date', '==', date)
                .get();

            downtimeSnapshot.forEach(doc => {
                const data = doc.data();
                const timestamp = data.createdAt?.toDate?.() || data.timestamp?.toDate?.() || resolveProductionDateTime(data) || (data.startTime ? new Date(`${data.date}T${data.startTime}`) : null);

                const entry = {
                    id: doc.id,
                    type: 'downtime',
                    collection: 'downtime_entries',
                    data,
                    timestamp
                };

                entries.push(entry);
                recentEntriesCache.set(doc.id, entry);
            });

            const reworkSnapshot = await getDb().collection('rework_entries')
                .where('planId', '==', planId)
                .where('data', '==', date)
                .get();

            reworkSnapshot.forEach(doc => {
                const data = doc.data();
                const timestamp = data.createdAt?.toDate?.() || data.timestamp?.toDate?.() || (data.data ? new Date(`${data.data}T12:00:00`) : null);

                const entry = {
                    id: doc.id,
                    type: 'rework',
                    collection: 'rework_entries',
                    data,
                    timestamp
                };

                entries.push(entry);
                recentEntriesCache.set(doc.id, entry);
            });

            entries.sort((a, b) => {
                const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : 0;
                const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : 0;
                return timeB - timeA;
            });

            // Armazenar todas as entradas para filtro
            allRecentEntries = entries;

            if (!entries.length) {
                updateRecentEntriesEmptyMessage('Ainda não há lançamentos para esta máquina.');
                setRecentEntriesState({ loading: false, empty: true });
            } else {
                applyEntryFilter(currentEntryFilter);
                setRecentEntriesState({ loading: false, empty: false });
            }
        } catch (error) {
            console.error('Erro ao carregar lançamentos recentes: ', error);
            updateRecentEntriesEmptyMessage('Não foi possível carregar os lançamentos. Tente novamente.');
            setRecentEntriesState({ loading: false, empty: true });
        }
    }

    function refreshRecentEntries(showLoading = false) {
        loadRecentEntries(showLoading);
    }
    window.refreshRecentEntries = refreshRecentEntries;

    // Funções auxiliares para indicador de data de lançamentos
    // Funções auxiliares para indicador de filtros de lançamentos
    function updateEntriesFilterIndicator() {
        const indicator = document.getElementById('entries-filter-indicator');
        const display = document.getElementById('entries-filter-display');
        const today = getProductionDateString();
        const filterDate = window.lancamentoFilterDate;
        const filterMachine = window.lancamentoFilterMachine;
        
        if (indicator && display) {
            const parts = [];
            
            if (filterDate && filterDate !== today) {
                const [year, month, day] = filterDate.split('-');
                parts.push(`Data: ${day}/${month}/${year}`);
            }
            
            if (filterMachine) {
                parts.push(`Máquina: ${filterMachine}`);
            }
            
            if (parts.length > 0) {
                display.textContent = parts.join(' | ');
                indicator.classList.remove('hidden');
            } else {
                indicator.classList.add('hidden');
            }
        }
    }
    
    function hideEntriesFilterIndicator() {
        const indicator = document.getElementById('entries-filter-indicator');
        if (indicator) {
            indicator.classList.add('hidden');
        }
    }
    
    // Função para carregar lançamentos com filtros de data e máquina
    async function loadRecentEntriesWithFilters() {
        if (!recentEntriesList) return;
        
        setRecentEntriesState({ loading: true, empty: false });
        
        const filterDate = window.lancamentoFilterDate || getProductionDateString();
        const filterMachine = window.lancamentoFilterMachine;
        
        // Se tiver máquina específica selecionada, buscar por ela
        const machineToSearch = filterMachine || (window.selectedMachineData ? window.selectedMachineData.machine : null);
        
        if (!machineToSearch) {
            updateRecentEntriesEmptyMessage('Selecione uma máquina para visualizar os lançamentos.');
            setRecentEntriesState({ loading: false, empty: true });
            return;
        }
        
        try {
            const entries = [];
            recentEntriesCache = new Map();
            
            // Buscar lançamentos de produção pela máquina
            const productionSnapshot = await getDb().collection('production_entries')
                .where('machine', '==', machineToSearch)
                .where('data', '==', filterDate)
                .get();
            
            productionSnapshot.forEach(doc => {
                const data = doc.data();
                // Verificar se é borra
                const isBorra = data.tipo_lancamento === 'BORRA' || data.lote === 'BORRA' || (data.observacoes && data.observacoes.toUpperCase().includes('BORRA'));
                const type = isBorra ? 'borra' : ((data.refugo_kg && data.refugo_kg > 0) || data.perdas ? 'loss' : 'production');
                const resolvedTimestamp = resolveProductionDateTime(data) || data.updatedAt?.toDate?.() || data.timestamp?.toDate?.() || data.createdAt?.toDate?.() || (data.datetime ? new Date(data.datetime) : null);

                const entry = {
                    id: doc.id,
                    type,
                    collection: 'production_entries',
                    data,
                    timestamp: resolvedTimestamp
                };

                entries.push(entry);
                recentEntriesCache.set(doc.id, entry);
            });
            
            // Buscar paradas
            const downtimeSnapshot = await getDb().collection('downtime_entries')
                .where('machine', '==', machineToSearch)
                .where('date', '==', filterDate)
                .get();

            downtimeSnapshot.forEach(doc => {
                const data = doc.data();
                const timestamp = data.createdAt?.toDate?.() || data.timestamp?.toDate?.() || resolveProductionDateTime(data) || (data.startTime ? new Date(`${data.date}T${data.startTime}`) : null);

                const entry = {
                    id: doc.id,
                    type: 'downtime',
                    collection: 'downtime_entries',
                    data,
                    timestamp
                };

                entries.push(entry);
                recentEntriesCache.set(doc.id, entry);
            });
            
            // Buscar retrabalhos
            const reworkSnapshot = await getDb().collection('rework_entries')
                .where('machine', '==', machineToSearch)
                .where('data', '==', filterDate)
                .get();

            reworkSnapshot.forEach(doc => {
                const data = doc.data();
                const timestamp = data.createdAt?.toDate?.() || data.timestamp?.toDate?.() || (data.data ? new Date(`${data.data}T12:00:00`) : null);

                const entry = {
                    id: doc.id,
                    type: 'rework',
                    collection: 'rework_entries',
                    data,
                    timestamp
                };

                entries.push(entry);
                recentEntriesCache.set(doc.id, entry);
            });
            
            // Ordenar por timestamp
            entries.sort((a, b) => {
                const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : 0;
                const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : 0;
                return timeB - timeA;
            });

            allRecentEntries = entries;

            if (!entries.length) {
                updateRecentEntriesEmptyMessage(`Nenhum lançamento encontrado para ${machineToSearch} em ${filterDate.split('-').reverse().join('/')}.`);
                setRecentEntriesState({ loading: false, empty: true });
            } else {
                applyEntryFilter(currentEntryFilter);
                setRecentEntriesState({ loading: false, empty: false });
            }
        } catch (error) {
            console.error('Erro ao carregar lançamentos com filtros:', error);
            updateRecentEntriesEmptyMessage('Erro ao carregar lançamentos. Tente novamente.');
            setRecentEntriesState({ loading: false, empty: true });
        }
    }

    // Função para aplicar filtro de tipo de entrada
    function applyEntryFilter(filter) {
        currentEntryFilter = filter;
        
        let filteredEntries = allRecentEntries;
        
        if (filter !== 'all') {
            filteredEntries = allRecentEntries.filter(entry => entry.type === filter);
        }
        
        if (filteredEntries.length === 0) {
            const filterLabels = {
                all: 'lançamentos',
                production: 'lançamentos de produção',
                downtime: 'paradas',
                loss: 'perdas',
                rework: 'retrabalhos'
            };
            updateRecentEntriesEmptyMessage(`Não há ${filterLabels[filter]} para exibir.`);
            setRecentEntriesState({ loading: false, empty: true });
        } else {
            renderRecentEntries(filteredEntries);
            setRecentEntriesState({ loading: false, empty: false });
        }
        
        // Atualizar estado visual dos botões de filtro
        updateFilterButtons(filter);
    }
    
    // Função para atualizar estado visual dos botões de filtro
    function updateFilterButtons(activeFilter) {
        const filterButtons = document.querySelectorAll('.filter-entry-btn');
        filterButtons.forEach(btn => {
            const btnFilter = btn.dataset.filter;
            if (btnFilter === activeFilter) {
                btn.classList.add('active', 'bg-white', 'text-blue-600', 'shadow-sm');
                btn.classList.remove('text-gray-600', 'hover:text-gray-900', 'hover:bg-gray-50');
            } else {
                btn.classList.remove('active', 'bg-white', 'text-blue-600', 'shadow-sm');
                btn.classList.add('text-gray-600', 'hover:text-gray-900', 'hover:bg-gray-50');
            }
        });
    }

    function handleRecentEntryAction(event) {
        const actionButton = event.target.closest('[data-action]');
        if (!actionButton) return;

        const action = actionButton.dataset.action;
        const entryId = actionButton.dataset.entryId;
        const entryType = actionButton.dataset.entryType;

        if (!entryId || !entryType) return;

        if (action === 'edit') {
            // ⚠️ VERIFICAÇÃO DE PERMISSÃO: Apenas gestores podem editar lançamentos
            if (!isUserGestorOrAdmin()) {
                showPermissionDeniedNotification('editar lançamentos');
                return;
            }
            openEntryForEditing(entryType, entryId);
        } else if (action === 'delete') {
            // A verificação de permissão é feita dentro de showConfirmModal
            let collection = 'production_entries';
            if (entryType === 'downtime') {
                collection = 'downtime_entries';
            } else if (entryType === 'rework') {
                collection = 'rework_entries';
            }
            showConfirmModal(entryId, collection);
        }
    }

    function openEntryForEditing(entryType, entryId) {
        const entry = recentEntriesCache.get(entryId);
        if (!entry) {
            console.warn('Registro para edição não encontrado:', entryId);
            return;
        }

        currentEditContext = {
            type: entryType,
            id: entryId,
            collection: entry.collection,
            original: entry.data
        };

        if (entryType === 'production') {
            document.getElementById('quick-production-qty').value = entry.data.produzido || 0;
            document.getElementById('quick-production-weight').value = entry.data.peso_bruto || 0;
            document.getElementById('quick-production-obs').value = entry.data.observacoes || '';
            openModal('quick-production-modal');
        } else if (entryType === 'loss') {
            document.getElementById('quick-losses-qty').value = entry.data.refugo_qty || entry.data.quantity || 0;
            document.getElementById('quick-losses-weight').value = entry.data.refugo_kg || 0;
            document.getElementById('quick-losses-reason').value = entry.data.perdas || '';
            document.getElementById('quick-losses-obs').value = entry.data.observacoes || '';
            const quickLossesDeleteBtn = document.getElementById('quick-losses-delete-btn');
            if (quickLossesDeleteBtn) quickLossesDeleteBtn.classList.remove('hidden');
            openModal('quick-losses-modal');
        } else {
            alert('Edição deste tipo de lançamento ainda não está disponível.');
        }
    }

    // showNotification importado de notification.js
    
    // Função para carregar o painel de lançamento
    async function loadLaunchPanel() {
        try {
            showLoadingState('launch-panel', true);
            await populateMachineSelector();
            updateCurrentShiftDisplay();
            showLoadingState('launch-panel', false, false);
        } catch (error) {
            console.error("Erro ao carregar painel de lançamento: ", error);
            showLoadingState('launch-panel', false, true);
        }
    }
    
    function setActiveMachineCard(machine) {
        if (!machineCardGrid) return;

        // Remove seleção anterior
        const previousSelected = machineCardGrid.querySelector('.machine-card.selected');
        if (previousSelected) {
            previousSelected.classList.remove('selected');
        }

        if (!machine) {
            activeMachineCard = null;
            return;
        }

        // Adiciona seleção no novo card
        const nextCard = machineCardGrid.querySelector(`[data-machine="${machine}"]`);
        if (nextCard) {
            nextCard.classList.add('selected');
            activeMachineCard = nextCard;
            
            // Scroll suave para o card selecionado se necessário
            nextCard.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'nearest',
                inline: 'nearest'
            });
        } else {
            activeMachineCard = null;
        }
    }

    // isPlanActive importado de plan.utils.js

    /**
     * Renderiza a barra de status das máquinas (estilo Excel)
     * Mostra todas as máquinas como células coloridas de acordo com o status
     */
    function renderMachineStatusBar(activePlans = [], activeDowntimeSet = new Set(), machinesDowntime = {}) {
        const statusBar = document.getElementById('machine-status-cells');
        if (!statusBar) return;
        
        // Criar set de máquinas com planejamento ativo
        const machinesWithPlan = new Set();
        activePlans.forEach(plan => {
            if (plan && plan.machine) {
                machinesWithPlan.add(normalizeMachineId(plan.machine));
            }
        });
        
        // Ordenar todas as máquinas do banco
        const sortedMachines = [...window.machineDatabase].sort((a, b) => 
            normalizeMachineId(a.id).localeCompare(normalizeMachineId(b.id), 'pt-BR', { numeric: true })
        );
        
        // Renderizar células
        statusBar.innerHTML = sortedMachines.map(machine => {
            const mid = normalizeMachineId(machine.id);
            const hasActiveDowntime = activeDowntimeSet.has(mid);
            const hasPlan = machinesWithPlan.has(mid);
            
            // Determinar status e cor
            let statusClass = '';
            let statusTitle = '';
            
            if (hasActiveDowntime) {
                // Máquina parada
                statusClass = 'bg-red-500 text-white border-red-600';
                statusTitle = `${mid} - PARADA`;
            } else if (hasPlan) {
                // Máquina produzindo (tem OP ativa)
                statusClass = 'bg-emerald-500 text-white border-emerald-600';
                statusTitle = `${mid} - Produzindo`;
            } else {
                // Máquina sem OP
                statusClass = 'bg-slate-600 text-slate-300 border-slate-500';
                statusTitle = `${mid} - Sem OP`;
            }
            
            // Extrair número da máquina para exibição compacta
            const machineNumber = mid.replace(/[^\d]/g, '') || mid.slice(-2);
            
            return `
                <div class="machine-status-cell ${statusClass} w-8 h-8 flex items-center justify-center 
                            text-xs font-bold rounded border cursor-pointer transition-all duration-200
                            hover:scale-110 hover:shadow-lg hover:z-10"
                     data-machine="${mid}"
                     title="${statusTitle}">
                    ${machineNumber}
                </div>
            `;
        }).join('');
        
        // Adicionar evento de clique nas células
        statusBar.querySelectorAll('.machine-status-cell').forEach(cell => {
            cell.addEventListener('click', () => {
                const machineId = cell.dataset.machine;
                // Scroll para o card da máquina se existir
                const machineCard = document.querySelector(`.machine-card[data-machine="${machineId}"]`);
                if (machineCard) {
                    machineCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    machineCard.classList.add('ring-2', 'ring-blue-500', 'ring-offset-2');
                    setTimeout(() => {
                        machineCard.classList.remove('ring-2', 'ring-blue-500', 'ring-offset-2');
                    }, 2000);
                    // Simular clique no card
                    machineCard.click();
                    
                    // NOVO: Scroll automático para painel de lançamento após seleção
                    setTimeout(() => {
                        const productionPanel = document.getElementById('production-control-panel');
                        if (productionPanel && !productionPanel.classList.contains('hidden')) {
                            productionPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }
                    }, 500);
                }
            });
        });
    }

    // Cache para evitar que valores de produção diminuam entre renders (anti-oscilação)
    const machineCardProductionCache = new Map();
    
    function renderMachineCards(plans = [], productionEntries = [], downtimeEntries = [], activeDowntimeMachines = new Set(), machinesDowntime = {}) {
        if (!machineCardGrid) {
            if (machineSelector) {
                machineSelector.machineData = {};
                machineSelector.innerHTML = '<option value="">Selecione uma máquina...</option>';
            }
            return;
        }

        if (machineCardEmptyState) {
            machineCardEmptyState.textContent = 'Nenhuma máquina com planejamento ativo.';
            machineCardEmptyState.classList.add('hidden');
            machineCardEmptyState.classList.remove('text-red-100');
        }
        
        // Converter para Set para busca rápida (pode ser array ou Set)
        let activeDowntimeSet = activeDowntimeMachines instanceof Set 
            ? activeDowntimeMachines 
            : new Set(Array.isArray(activeDowntimeMachines) ? activeDowntimeMachines : []);

        // Normalizar IDs do activeDowntimeSet para garantir consistência (H01 formato)
        const normalizedActiveDowntimeSet = new Set();
        activeDowntimeSet.forEach(id => {
            const nid = normalizeMachineId(id);
            if (nid) normalizedActiveDowntimeSet.add(nid);
        });
        activeDowntimeSet = normalizedActiveDowntimeSet;

        // NOVO: Cache de status de paradas para cronômetro
        downtimeStatusCache = machinesDowntime;

        const activePlans = Array.isArray(plans) ? plans.filter(isPlanActive) : [];
        
        // NOVO: Renderizar barra de status das máquinas (estilo Excel)
        renderMachineStatusBar(activePlans, activeDowntimeSet, machinesDowntime);

        // NOVO: Criar set de máquinas válidas do banco de dados
        const validMachineIds = new Set(window.machineDatabase.map(m => normalizeMachineId(m.id)));

        // NOVO: Mostrar TODAS as máquinas (planejadas + paradas + inativas)
        // Filtrar APENAS máquinas que existem no window.machineDatabase (evita contagem incorreta)
        const allMachineIds = new Set();
        
        // Adicionar máquinas com planejamento (somente se existir no window.machineDatabase)
        activePlans.forEach(plan => {
            if (plan && plan.machine) {
                const mid = normalizeMachineId(plan.machine);
                if (validMachineIds.has(mid)) {
                    allMachineIds.add(mid);
                } else {
                    console.warn(`[renderMachineCards] Máquina "${plan.machine}" do planejamento não existe no window.machineDatabase`);
                }
            }
        });
        
        // Paradas longas removidas - máquinas com parada longa não são mais adicionadas automaticamente
        
        // NOVO: Adicionar máquinas com parada ativa (sem OP) ao grid
        activeDowntimeSet.forEach(mid => {
            const normalized = normalizeMachineId(mid);
            if (validMachineIds.has(normalized)) {
                allMachineIds.add(normalized);
            }
        });
        
        // Se nenhuma máquina, mostrar todas do window.machineDatabase
        if (allMachineIds.size === 0) {
            window.machineDatabase.forEach(m => {
                allMachineIds.add(normalizeMachineId(m.id));
            });
        }

        machineCardData = {};
        if (machineSelector) {
            machineSelector.machineData = {};
        }

        const planById = {};
        const machineOrder = Array.from(allMachineIds).sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));

        // Mapear plans por máquina - AGORA SUPORTA MÚLTIPLOS PLANOS (ARRAY)
        activePlans.forEach(plan => {
            if (!plan || !plan.machine) return;
            const mid = normalizeMachineId(plan.machine);
            const enrichedPlan = { id: plan.id, ...plan };
            // Armazenar como array para suportar múltiplas ordens na mesma máquina
            if (!machineCardData[mid]) {
                machineCardData[mid] = [];
            }
            machineCardData[mid].push(enrichedPlan);
            planById[plan.id] = enrichedPlan;
        });

        if (machineSelector) {
            const selectorOptions = ['<option value="">Selecione uma máquina...</option>']
                .concat(machineOrder.map(machine => `<option value="${machine}">${machine}</option>`));
            machineSelector.innerHTML = selectorOptions.join('');
            machineOrder.forEach(machine => {
                // Retornar o primeiro plano ou array completo no seletor
                machineSelector.machineData[machine] = machineCardData[machine] ? machineCardData[machine][0] : null;
            });
        }

        // IMPORTANTE: Inicializar aggregated para TODAS as máquinas (mesmo sem planejamento)
        // Agora suporta múltiplos planos por máquina
        const aggregated = {};
        machineOrder.forEach(machine => {
            const plans = machineCardData[machine] || [];
            aggregated[machine] = {
                plans: plans,  // Array de todos os planos da máquina
                plan: plans[0] || {},  // Primeiro plano para compatibilidade
                totalProduced: 0,
                totalLossesKg: 0,
                entries: [],
                byShift: { T1: 0, T2: 0, T3: 0 },
                byPlan: {}  // Produção separada por plano
            };
            // Inicializar byPlan para cada plano
            plans.forEach(p => {
                aggregated[machine].byPlan[p.id] = {
                    totalProduced: 0,
                    totalLossesKg: 0,
                    byShift: { T1: 0, T2: 0, T3: 0 }
                };
            });
        });

        const planIdSet = new Set(activePlans.map(plan => plan.id));
        const machineSet = new Set(machineOrder);
        const filteredProductionEntries = Array.isArray(productionEntries)
            ? productionEntries.filter(entry => entry && planIdSet.has(entry.planId))
            : [];
        const filteredDowntimeEntries = Array.isArray(downtimeEntries)
            ? downtimeEntries.filter(entry => entry && machineSet.has(entry.machine))
            : [];
        const combinedEntries = [];
        const fallbackShiftKey = `T${getCurrentShift()}`;

        filteredProductionEntries.forEach(entry => {
            if (!entry || !planIdSet.has(entry.planId)) return;
            const plan = planById[entry.planId];
            if (!plan) return;
            const machine = plan.machine;
            const produced = coerceToNumber(entry.produzido ?? entry.quantity, 0);
            const turno = normalizeShiftValue(entry.turno);
            const lossKg = coerceToNumber(entry.refugo_kg, 0);

            aggregated[machine].totalProduced += produced;
            aggregated[machine].totalLossesKg += lossKg;
            if (turno) {
                aggregated[machine].byShift[turno] = (aggregated[machine].byShift[turno] || 0) + produced;
            }
            
            // Agregar também por plano individual
            if (aggregated[machine].byPlan[entry.planId]) {
                aggregated[machine].byPlan[entry.planId].totalProduced += produced;
                aggregated[machine].byPlan[entry.planId].totalLossesKg += lossKg;
                if (turno) {
                    aggregated[machine].byPlan[entry.planId].byShift[turno] = 
                        (aggregated[machine].byPlan[entry.planId].byShift[turno] || 0) + produced;
                }
            }

            const entryForOee = {
                machine,
                turno,
                produzido: produced,
                duracao_min: coerceToNumber(entry.duracao_min ?? entry.duration_min ?? entry.duration, 0),
                refugo_kg: lossKg,
                piece_weight: plan.piece_weight,
                real_cycle_t1: plan.real_cycle_t1,
                real_cycle_t2: plan.real_cycle_t2,
                real_cycle_t3: plan.real_cycle_t3,
                budgeted_cycle: plan.budgeted_cycle,
                active_cavities_t1: plan.active_cavities_t1,
                active_cavities_t2: plan.active_cavities_t2,
                active_cavities_t3: plan.active_cavities_t3,
                mold_cavities: plan.mold_cavities
            };

            aggregated[machine].entries.push(entryForOee);
            combinedEntries.push(entryForOee);
        });

        Object.keys(machineCardCharts).forEach(machine => {
            if (machineCardCharts[machine]) {
                machineCardCharts[machine].destroy();
            }
            delete machineCardCharts[machine];
        });

        if (machineOrder.length === 0) {
            machineCardGrid.innerHTML = '';
            if (machineCardEmptyState) {
                machineCardEmptyState.classList.remove('hidden');
            }
            setActiveMachineCard(null);
            return;
        }

    const oeeSummary = combinedEntries.length > 0 ? calculateRealTimeOEE(combinedEntries) : null;
    const oeeByMachine = oeeSummary?.oeeByMachine || {};
    const currentShiftKey = oeeSummary?.currentShift || fallbackShiftKey;

    const resolvePackagingMultiple = (plan) => {
        if (!plan || typeof plan !== 'object') return 0;

        const flatCandidates = [
            'bag_capacity', 'bagCapacity', 'package_quantity', 'packageQuantity',
            'package_qty', 'packaging_qty', 'packagingQuantity', 'packagingQty',
            'units_per_bag', 'unitsPerBag', 'unit_per_bag', 'unitPerBag',
            'units_per_package', 'unitsPerPackage', 'pieces_per_bag', 'piecesPerBag',
            'pecas_por_saco', 'quantidade_por_saco', 'quantidadePorSaco',
            'qtd_por_saco', 'qtdPorSaco', 'quantidade_saco', 'quantidadeSaco',
            'capacidade_saco', 'capacidadeSaco', 'capacidade_embalagem', 'capacidadeEmbalagem'
        ];

        for (const key of flatCandidates) {
            if (Object.prototype.hasOwnProperty.call(plan, key)) {
                const value = parseOptionalNumber(plan[key]);
                if (Number.isFinite(value) && value > 0) {
                    return Math.round(value);
                }
            }
        }

        const nestedCandidates = [
            plan.packaging,
            plan.packaging_info,
            plan.packagingInfo,
            plan.embalagem,
            plan.embalagem_info,
            plan.embalagemInfo
        ];

        for (const nested of nestedCandidates) {
            if (!nested || typeof nested !== 'object') continue;
            for (const key of flatCandidates) {
                if (Object.prototype.hasOwnProperty.call(nested, key)) {
                    const value = parseOptionalNumber(nested[key]);
                    if (Number.isFinite(value) && value > 0) {
                        return Math.round(value);
                    }
                }
            }
            if (Object.prototype.hasOwnProperty.call(nested, 'quantity') || Object.prototype.hasOwnProperty.call(nested, 'quantidade')) {
                const fallbackValue = parseOptionalNumber(nested.quantity ?? nested.quantidade);
                if (Number.isFinite(fallbackValue) && fallbackValue > 0) {
                    return Math.round(fallbackValue);
                }
            }
        }

        return 0;
    };

    const formatQty = (value) => {
        const parsed = coerceToNumber(value, 0);
        return Math.round(parsed).toLocaleString('pt-BR');
    };
    const machineProgressInfo = {};

    machineCardGrid.innerHTML = machineOrder.map(machine => {
        const data = aggregated[machine];
        const plans = data.plans || [];
        const plan = data.plan || {};  // Primeiro plano (para compatibilidade)

        // ===== CARD ESPECIAL: Máquina SEM OP mas COM parada ativa =====
        const hasActiveDowntime = activeDowntimeSet.has(machine);
        if (plans.length === 0 && hasActiveDowntime) {
            const dtInfo = machinesDowntime ? machinesDowntime[machine] : null;
            const reasonText = dtInfo?.reason || 'Parada ativa';
            const startTime = dtInfo?.startDate || dtInfo?.startTime || '';
            machineProgressInfo[machine] = { normalizedProgress: 0, progressPercent: 0, palette: {} };
            return `
                <div class="machine-card group relative bg-white rounded-lg border-2 border-red-400 shadow-sm hover:shadow-lg transition-all duration-200 p-3 machine-stopped cursor-pointer" 
                     data-machine="${machine}" data-plan-id="" data-order-id="" data-part-code="" data-multi-plan="false"
                     data-downtime-reason="${reasonText}" data-downtime-start="${startTime}">
                    <div class="flex items-center justify-between mb-3">
                        <div class="flex items-center gap-2">
                            <div class="machine-identifier w-8 h-8 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                                ${machine.slice(-2)}
                            </div>
                            <div>
                                <h3 class="text-sm font-bold text-slate-900">${machine}</h3>
                                <p class="text-xs text-red-600 font-medium">SEM OP</p>
                            </div>
                        </div>
                        <div class="text-right">
                            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold">
                                <span class="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                                PARADA ATIVA
                            </span>
                        </div>
                    </div>
                    <div class="p-3 rounded-lg bg-red-50 border border-red-200 mb-2">
                        <div class="flex items-center gap-2 mb-2">
                            <i data-lucide="alert-circle" class="w-4 h-4 text-red-600 animate-pulse"></i>
                            <span class="text-xs font-bold text-red-700">MÁQUINA PARADA</span>
                        </div>
                        <div class="text-sm font-semibold text-red-800 mb-1">${reasonText}</div>
                    </div>
                    <button type="button" class="card-finish-downtime-btn w-full py-2 px-3 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-lg text-xs font-bold shadow-md hover:shadow-lg hover:from-emerald-600 hover:to-green-700 transition-all flex items-center justify-center gap-2">
                        <i data-lucide="check-circle" class="w-4 h-4"></i>
                        Finalizar Parada
                    </button>
                </div>
            `;
        }

        const hasMultiplePlans = plans.length > 1;
        
        // Resolver nome do produto - priorizar nome sobre código
        const resolveProductName = (p) => {
            if (!p) return 'Produto não definido';
            
            // 1. Tentar buscar no database de produtos pelo código
            const productCode = p.product_cod || p.product_code || p.part_code;
            if (productCode) {
                const dbProduct = getProductByCode(productCode);
                if (dbProduct?.name) {
                    return dbProduct.name.trim();
                }
            }
            
            // 2. Tentar campos de nome explícitos
            const nameFields = [
                p.product_name,
                p.productName,
                p.produto_nome,
                p.produtoNome,
                p.part_name,
                p.partName,
                p.product_snapshot?.name,
                p.product_snapshot?.product_name
            ];
            for (const name of nameFields) {
                if (name && typeof name === 'string' && name.trim()) {
                    return name.trim();
                }
            }
            
            // 3. Se product não parece ser um código (tem espaço ou mais de 15 chars), usar
            if (p.product && typeof p.product === 'string') {
                const prod = p.product.trim();
                if (prod.includes(' ') || prod.length > 15) {
                    return prod;
                }
            }
            
            // 4. Fallback para product mesmo que pareça código
            return p.product || 'Produto não definido';
        };
        
        // Calcular dados combinados de todos os planos
        // CORREÇÃO: Usar total_produzido acumulado da OP (não apenas produção do dia)
        // Isso garante consistência com a aba Admin > Dados > Ordens
        let totalPlannedQty = 0;
        let totalProducedAllPlans = 0;
        const plansWithData = plans.map(p => {
            const planData = data.byPlan[p.id] || { totalProduced: 0, totalLossesKg: 0, byShift: { T1: 0, T2: 0, T3: 0 } };
            const plannedQtyPrimary = parseOptionalNumber(p.order_lot_size);
            const plannedQtyFallback = parseOptionalNumber(p.lot_size);
            const plannedQty = Math.round(plannedQtyPrimary ?? plannedQtyFallback ?? 0);
            
            // CORREÇÃO CONSISTÊNCIA COM ADMIN:
            // Usar APENAS o total_produzido armazenado no planning/ordem
            // Esse é o mesmo valor exibido em Admin > Dados > Ordens
            const storedTotal = coerceToNumber(p.total_produzido ?? p.totalProduced, 0);
            const produced = Math.round(storedTotal);
            
            // Atualizar cache (mantido para referência, mas não usado na lógica principal)
            machineCardProductionCache.set(p.id, produced);
            
            const lossKg = Math.round(planData.totalLossesKg ?? 0);
            const pieceWeight = coerceToNumber(p.piece_weight, 0);
            const scrapPcs = pieceWeight > 0 ? Math.round((lossKg * 1000) / pieceWeight) : 0;
            
            // MUDANÇA: Usar 'produced' diretamente para cálculos (igual ao Admin)
            // Não subtrair refugo aqui - o Admin mostra o total_produzido bruto
            const progressPct = plannedQty > 0 ? (produced / plannedQty) * 100 : 0;
            
            totalPlannedQty += plannedQty;
            totalProducedAllPlans += produced; // Usar produced direto, não goodProd
            
            return {
                ...p,
                displayName: resolveProductName(p),
                plannedQty,
                produced,
                goodProd: produced, // Manter igual a produced para consistência
                lossKg,
                progressPct,
                isCompleted: plannedQty > 0 && produced >= plannedQty
            };
        });
        
        // Dados agregados da máquina
        const totalAccumulatedProduced = Math.round(data.totalProduced ?? 0);
        const lossesKg = Math.round(coerceToNumber(data.totalLossesKg, 0));
        const pieceWeight = coerceToNumber(plan.piece_weight, 0);
        const scrapPcs = pieceWeight > 0 ? Math.round((lossesKg * 1000) / pieceWeight) : 0;
        const goodProductionRaw = Math.max(0, totalAccumulatedProduced - scrapPcs);
        const goodProduction = Math.round(goodProductionRaw);
        
        // Progresso geral da máquina (combinado de todos os planos)
        const progressPercentRaw = totalPlannedQty > 0 ? (totalProducedAllPlans / totalPlannedQty) * 100 : 0;
        const normalizedProgress = Math.max(0, Math.min(progressPercentRaw, 100));
        const progressPalette = resolveProgressPalette(progressPercentRaw);
        const progressTextClass = progressPalette.textClass || 'text-slate-600';
        const progressText = `${Math.max(0, progressPercentRaw).toFixed(progressPercentRaw >= 100 ? 0 : 1)}%`;
        const allCompleted = plansWithData.length > 0 && plansWithData.every(p => p.isCompleted);

        machineProgressInfo[machine] = {
            normalizedProgress,
            progressPercent: progressPercentRaw,
            palette: progressPalette
        };

        const oeeShiftData = oeeByMachine[machine]?.[currentShiftKey];
        const oeePercent = Math.max(0, Math.min((oeeShiftData?.oee || 0) * 100, 100));
        const oeePercentText = oeePercent ? oeePercent.toFixed(1) : '0.0';
        const oeeColorClass = oeePercent >= 85 ? 'text-emerald-600' : oeePercent >= 70 ? 'text-amber-500' : 'text-red-500';
        const nowRef = new Date();
        const shiftStart = getShiftStartDateTime(nowRef);
        let runtimeHours = 0, downtimeHours = 0;
        if (shiftStart instanceof Date && !Number.isNaN(shiftStart.getTime())) {
            const elapsedSec = Math.max(0, Math.floor((nowRef.getTime() - shiftStart.getTime()) / 1000));
            if (elapsedSec > 0) {
                const dts = filteredDowntimeEntries.filter(dt => dt && dt.machine === machine);
                const runtimeSec = calculateProductionRuntimeSeconds({ shiftStart, now: nowRef, downtimes: dts });
                runtimeHours = Math.max(0, runtimeSec / 3600);
                downtimeHours = Math.max(0, (elapsedSec / 3600) - runtimeHours);
            }
        }

        // Lógica de cor do card: vermelho se houver parada ativa
        let cardColorClass = '';
        if (hasActiveDowntime) {
            cardColorClass = 'machine-stopped'; // vermelho para parada ativa
        }
        
        // Gerar HTML para múltiplos produtos
        const generateMultiProductSection = () => {
            if (!hasMultiplePlans) return '';
            
            return `
                <div class="mb-2 p-2 rounded-lg bg-purple-50 border border-purple-200">
                    <div class="flex items-center gap-2 mb-2">
                        <i data-lucide="layers" class="w-4 h-4 text-purple-600"></i>
                        <span class="text-xs font-bold text-purple-700">MOLDE MULTI-PRODUTO (${plans.length} OPs)</span>
                    </div>
                    <div class="space-y-2 max-h-40 overflow-y-auto">
                        ${plansWithData.map((p, idx) => `
                            <div class="p-2 rounded bg-white border border-purple-100 ${p.isCompleted ? 'opacity-60' : ''}">
                                <div class="flex items-center justify-between mb-1">
                                    <span class="text-xs font-semibold text-slate-700 truncate max-w-[100px]" title="${p.displayName}">${p.displayName}</span>
                                    <span class="text-xs font-mono text-purple-600">${p.order_number || '-'}</span>
                                </div>
                                <div class="flex items-center justify-between text-[10px]">
                                    <span class="text-slate-500">${formatQty(p.goodProd)}/${formatQty(p.plannedQty)}</span>
                                    <span class="${p.progressPct >= 100 ? 'text-emerald-600 font-bold' : 'text-slate-600'}">${p.progressPct.toFixed(1)}%</span>
                                </div>
                                <div class="w-full bg-slate-100 rounded-full h-1 mt-1">
                                    <div class="h-1 rounded-full transition-all duration-300 ${p.isCompleted ? 'bg-emerald-500' : 'bg-purple-500'}" style="width: ${Math.min(p.progressPct, 100)}%"></div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        };
        
        // Determinar nome do produto para exibição principal
        const displayProductName = hasMultiplePlans 
            ? `${plans.length} produtos` 
            : resolveProductName(plan);
        
        // Determinar número da OP para exibição
        const displayOrderNumber = hasMultiplePlans 
            ? `${plans.length} OPs`
            : (plan.order_number || plan.order_number_original || '-');

        return `
            <div class="machine-card group relative bg-white rounded-lg border border-slate-200 hover:border-blue-300 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer p-3 ${allCompleted && String(plan.status||'').toLowerCase()!=='concluida' ? 'completed-blink' : ''} ${cardColorClass} ${hasMultiplePlans ? 'ring-2 ring-purple-300' : ''}" data-machine="${machine}" data-plan-id="${plan.id}" data-order-id="${plan.order_id||''}" data-part-code="${plan.product_cod||''}" data-multi-plan="${hasMultiplePlans}">
                <!-- Header compacto -->
                <div class="flex items-center justify-between mb-2">
                    <div class="flex items-center gap-2">
                        <div class="machine-identifier w-8 h-8 bg-gradient-to-br ${hasMultiplePlans ? 'from-purple-500 to-purple-600' : 'from-blue-500 to-blue-600'} rounded-full flex items-center justify-center text-white text-xs font-bold">
                            ${machine.slice(-2)}
                        </div>
                        <div>
                            <h3 class="text-sm font-bold text-slate-900">${machine}</h3>
                            <p class="text-xs ${hasMultiplePlans ? 'text-purple-600 font-medium' : 'text-slate-500'} truncate max-w-[120px]" title="${displayProductName}">${displayProductName}</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <div class="text-xs font-semibold ${hasMultiplePlans ? 'text-purple-600' : 'text-blue-600'}">${displayOrderNumber}</div>
                        <div class="text-[10px] text-slate-400 uppercase">OP</div>
                    </div>
                </div>
                
                ${generateMultiProductSection()}

                <!-- Indicadores principais em linha -->
                <div class="grid grid-cols-2 gap-2 mb-3">
                    <div class="text-center">
                        <div class="text-sm font-semibold text-slate-900">${formatQty(totalProducedAllPlans)}</div>
                        <div class="text-[10px] text-slate-500 uppercase">Exec. Total</div>
                    </div>
                    <div class="text-center">
                        <div class="text-sm font-semibold text-slate-900">${formatQty(Math.max(0, totalPlannedQty - totalProducedAllPlans))}</div>
                        <div class="text-[10px] text-slate-500 uppercase">Faltante</div>
                    </div>
                </div>

                <!-- Barra de progresso compacta -->
                <div class="mb-2">
                    <div class="flex items-center justify-between mb-1">
                        <span class="text-xs text-slate-500">${hasMultiplePlans ? 'Progresso Geral' : 'OP Total'} (${formatQty(totalPlannedQty)})</span>
                        <span class="text-xs font-semibold ${progressTextClass}">${progressText}</span>
                    </div>
                    <div class="w-full bg-slate-100 rounded-full h-2">
                        <div class="h-2 rounded-full transition-all duration-300 ${hasMultiplePlans ? 'bg-purple-500' : (progressPalette.bgClass || 'bg-blue-500')}" style="width: ${normalizedProgress}%"></div>
                    </div>
                </div>

                <!-- Status compacto -->
                <div class="flex items-center justify-between text-xs mb-2">
                    <div class="flex gap-1">
                        <span class="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px]" title="Tempo rodando">${runtimeHours.toFixed(1)}h</span>
                        ${downtimeHours > 0 ? `<span class="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px]" title="Tempo parado">${downtimeHours.toFixed(1)}h</span>` : ''}
                    </div>
                    <div class="text-slate-500">
                        <span class="font-medium">${formatShiftLabel(currentShiftKey)}</span>
                    </div>
                </div>

                <!-- Indicador de Parada Longa removido - Unificação 02/2026 -->

                <!-- Mini card de parada ativa -->
                ${(() => {
                    // CORREÇÃO COMPLETA: Verificar se realmente há parada ATIVA
                    // Priorizar activeDowntimeSet (fonte de verdade)
                    const hasActiveDowntimeFromSet = activeDowntimeSet.has(machine);
                    
                    // Se não está no activeDowntimeSet E não está em machinesDowntime, não tem parada
                    const downtimeInfo = machinesDowntime ? machinesDowntime[machine] : null;
                    
                    // IMPORTANTE: Só considerar parada ativa se:
                    // 1. Está no activeDowntimeSet (parada confirmada) OU
                    // 2. Tem downtimeInfo com status explicitamente 'active'
                    const isDowntimeInfoActive = downtimeInfo && 
                        (downtimeInfo.status === 'active' || downtimeInfo.isActive === true);
                    
                    // Se não tem parada ativa confirmada, não mostrar o card
                    if (!hasActiveDowntimeFromSet && !isDowntimeInfoActive) return '';
                    
                    // Obter motivo da parada
                    let reasonText = downtimeInfo?.reason || '';
                    
                    // Se não tiver motivo em machinesDowntime, tentar buscar nas entradas
                    if (!reasonText && filteredDowntimeEntries) {
                        const dtEntry = filteredDowntimeEntries.find(dt => {
                            if (!dt || dt.machine !== machine) return false;
                            const hasEndTime = dt.endTime || dt.end_time;
                            const statusFinished = ['inactive', 'finalizada', 'finished', 'closed'].includes(String(dt.status || '').toLowerCase());
                            return !hasEndTime && !statusFinished;
                        });
                        reasonText = dtEntry?.reason || dtEntry?.motivo || dtEntry?.downtime_reason || '';
                    }
                    
                    return `
                        <div class="mb-2 p-2 rounded-lg bg-red-50 border border-red-200">
                            <div class="flex items-center gap-2 mb-1">
                                <i data-lucide="alert-circle" class="w-4 h-4 text-red-600 animate-pulse"></i>
                                <span class="text-xs font-bold text-red-700">PARADA ATIVA</span>
                            </div>
                            ${reasonText ? `<div class="text-xs text-red-600 font-medium pl-6">${reasonText}</div>` : ''}
                        </div>
                    `;
                })()}                ${allCompleted ? `
                    <div class="card-actions flex gap-2 mt-3">
                        ${String(plan.status||'').toLowerCase()!=='concluida' && plan.order_id ? `
                            <button type="button" class="btn btn-finalize card-finalize-btn" data-plan-id="${plan.id}" data-order-id="${plan.order_id}" title="Finalizar OP">
                                 <i data-lucide="check-circle"></i>
                                 <span>Finalizar OP</span>
                            </button>
                        ` : ''}
                        ${String(plan.status||'').toLowerCase()==='concluida' ? `
                            <button type="button" class="btn btn-activate card-activate-next-btn" data-plan-id="${plan.id}" data-machine="${machine}" data-part-code="${plan.product_cod||''}" title="Ativar próxima OP">
                                 <i data-lucide="play-circle"></i>
                                 <span>Ativar próxima OP</span>
                            </button>
                        ` : ''}
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');

        machineOrder.forEach(machine => {
            renderMachineCardProgress(machine, machineProgressInfo[machine]);
        });

        // NOVO: Iniciar cronômetros para máquinas paradas
        machineOrder.forEach(machine => {
            if (machinesDowntime && machinesDowntime[machine]) {
                const cardElement = machineCardGrid.querySelector(`[data-machine="${machine}"]`);
                if (cardElement) {
                    startDowntimeTimer(machine, cardElement);
                }
            }
        });

        // machineCardData agora é array - verificar se tem dados
        const machineHasPlans = window.selectedMachineData && window.selectedMachineData.machine && 
            machineCardData[window.selectedMachineData.machine] && 
            machineCardData[window.selectedMachineData.machine].length > 0;
        if (machineHasPlans) {
            setActiveMachineCard(window.selectedMachineData.machine);
        } else {
            window.selectedMachineData = null;
            setActiveMachineCard(null);
            if (productionControlPanel) {
                productionControlPanel.classList.add('hidden');
            }
            updateRecentEntriesEmptyMessage('Selecione uma máquina para visualizar os lançamentos.');
            setRecentEntriesState({ loading: false, empty: true });
        }

        // Recriar ícones (por causa dos botões novos)
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    function renderMachineCardProgress(machine, progressInfo) {
        if (!machine || !progressInfo) return;

        const canvasId = `progress-donut-${machine}`;
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            return;
        }

        if (machineCardCharts[machine]) {
            try {
                machineCardCharts[machine].destroy();
            } catch (error) {
                console.warn('[TRACE][renderMachineCardProgress] falha ao destruir gráfico anterior', { machine, error });
            }
        }

        const executed = Math.max(0, Math.min(progressInfo.normalizedProgress ?? 0, 100));
        const remainder = Math.max(0, 100 - executed);
        const primaryColor = progressInfo.palette?.start || '#2563EB';
        const secondaryColor = hexWithAlpha(primaryColor, 0.18);

        machineCardCharts[machine] = new Chart(canvas, {
            type: 'doughnut',
            data: {
                datasets: [{
                    data: [executed, remainder],
                    backgroundColor: [primaryColor, secondaryColor],
                    borderWidth: 0,
                    hoverOffset: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                rotation: -90,
                plugins: {
                    legend: { display: false },
                    tooltip: { enabled: false }
                },
                animation: {
                    animateRotate: executed > 0,
                    duration: 600
                }
            }
        });
    }

    // Função para popular o seletor de máquinas (e cards)
    async function populateMachineSelector(filterDate = null) {
        try {
            const today = filterDate || window.lancamentoFilterDate || getProductionDateString();
            const planSnapshot = await getDb().collection('planning').where('date', '==', today).get();
            let plans = planSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // OTIMIZAÇÃO FIREBASE: Carregar todas as OPs do cache em vez de N+1 queries individuais
            const allCachedOrders = typeof window.getProductionOrdersCached === 'function'
                ? await window.getProductionOrdersCached()
                : (await getDb().collection('production_orders').get()).docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const orderCacheById = new Map(allCachedOrders.map(o => [o.id, o]));
            const orderCacheByPartCode = new Map();
            allCachedOrders.forEach(o => {
                const pc = String(o.part_code || '').trim();
                if (pc) {
                    if (!orderCacheByPartCode.has(pc)) orderCacheByPartCode.set(pc, []);
                    orderCacheByPartCode.get(pc).push(o);
                }
            });
            // Pré-carregar production entries do dia para evitar N queries por orderId
            const todayProdEntries = typeof window.getProductionEntriesCached === 'function'
                ? await window.getProductionEntriesCached(today)
                : (await getDb().collection('production_entries').where('data', '==', today).get()).docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const productionTotalsByOrderId = new Map();

            for (const plan of plans) {
                const partCode = String(plan.product_cod || plan.product_code || plan.part_code || '').trim();
                let resolvedOrder = null;

                // Priorizar vínculo direto com a OP se existir no planejamento
                const linkedOrderId = plan.production_order_id || plan.production_order || plan.order_id || null;
                if (linkedOrderId) {
                    resolvedOrder = orderCacheById.get(linkedOrderId) || null;
                }

                if (!resolvedOrder && partCode) {
                    let cachedOrders = orderCacheByPartCode.get(partCode) || [];
                    if (cachedOrders.length > 1) {
                        // Ordenar da mais antiga para a mais recente para priorizar a OP antiga
                        cachedOrders = [...cachedOrders].sort((a, b) => {
                            const aTs = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?._seconds ? a.createdAt._seconds * 1000 : 0);
                            const bTs = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?._seconds ? b.createdAt._seconds * 1000 : 0);
                            if (aTs && bTs && aTs !== bTs) return aTs - bTs;
                            const toNum = (v) => { const n = parseInt(String(v||'').replace(/\D/g,''), 10); return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY; };
                            return toNum(a.order_number) - toNum(b.order_number);
                        });
                    }

                    if (cachedOrders.length > 0) {
                        // Preferir OP ativa/andamento na mesma máquina do plano
                        const sameMachine = cachedOrders.filter(o => (o.machine_id || o.machine) === plan.machine);
                        const isOpen = (o) => !['concluida','cancelada','finalizada','encerrada'].includes(String(o.status||'').toLowerCase());
                        resolvedOrder = sameMachine.find(o => ['ativa','em_andamento'].includes(String(o.status||'').toLowerCase()))
                            || sameMachine.find(isOpen)
                            || cachedOrders.find(isOpen)
                            || cachedOrders[0];
                    }
                }

                if (resolvedOrder) {
                    const resolvedLotSize = Number(resolvedOrder.lot_size) || 0;
                    plan.order_lot_size = resolvedLotSize;
                    plan.order_id = resolvedOrder.id;
                    plan.order_number = resolvedOrder.order_number || resolvedOrder.order_number_original || resolvedOrder.id;

                    // OTIMIZAÇÃO FIREBASE: Calcular produção acumulada da OP a partir dos entries já carregados
                    if (!productionTotalsByOrderId.has(resolvedOrder.id)) {
                        const totalProduced = todayProdEntries
                            .filter(e => e.orderId === resolvedOrder.id)
                            .reduce((sum, entry) => sum + (Number(entry.produzido || entry.quantity || 0) || 0), 0);
                        productionTotalsByOrderId.set(resolvedOrder.id, totalProduced);
                    }

                    const accumulated = productionTotalsByOrderId.get(resolvedOrder.id) || 0;
                    const resolvedOrderTotal = coerceToNumber(resolvedOrder.total_produzido ?? resolvedOrder.totalProduced, 0);
                    const planAccumulated = coerceToNumber(plan.total_produzido, 0);
                    
                    // CORREÇÃO CONSISTÊNCIA COM ADMIN:
                    // O Admin mostra APENAS o total_produzido da OP
                    // Usar o mesmo valor para garantir que cards e Admin mostrem o mesmo número
                    // Prioridade: valor da OP > soma dos entries > valor do planning
                    if (resolvedOrderTotal > 0) {
                        plan.total_produzido = resolvedOrderTotal;
                    } else if (accumulated > 0) {
                        plan.total_produzido = accumulated;
                    } else {
                        plan.total_produzido = planAccumulated;
                    }

                    console.log('[MachineCard][OP]', {
                        machine: plan.machine,
                        partCode,
                        orderId: resolvedOrder.id,
                        lotSize: plan.order_lot_size,
                        accumulated: plan.total_produzido,
                        fromOrder: resolvedOrderTotal,
                        fromEntries: accumulated
                    });
                } else {
                    // Caso não exista OP vinculada, manter total produzido local e sinalizar lot size zerado
                    plan.order_lot_size = Number(plan.lot_size) || 0;
                    if (!Number.isFinite(plan.total_produzido)) {
                        plan.total_produzido = 0;
                    }
                    console.warn('[MachineCard][OP] Nenhuma OP encontrada para o plano', plan.id, 'partCode:', partCode);
                }
            }

            const activePlans = plans.filter(isPlanActive);

            let productionEntries = [];
            let downtimeEntries = [];
            if (activePlans.length > 0) {
                const productionSnapshot = await getDb().collection('production_entries').where('data', '==', today).get();
                const planIdSet = new Set(activePlans.map(plan => plan.id));
                productionEntries = productionSnapshot.docs
                    .map(doc => ({ id: doc.id, ...doc.data() }))
                    .filter(entry => planIdSet.has(entry.planId));

                // Paradas do dia (inclui dia anterior para cobrir T3 após 00:00)
                const base = new Date(`${today}T12:00:00`);
                const prev = new Date(base); prev.setDate(prev.getDate() - 1);
                const prevStr = new Date(prev.getTime() - prev.getTimezoneOffset()*60000).toISOString().split('T')[0];
                const dtSnapshot = await getDb().collection('downtime_entries')
                    .where('date', 'in', [prevStr, today])
                    .get();
                const machineSet = new Set(activePlans.map(p => p.machine));
                downtimeEntries = dtSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
                    .filter(dt => machineSet.has(dt.machine));
            }

            // Buscar paradas ativas para colorir cards de vermelho
            // IMPORTANTE: Filtrar apenas máquinas válidas do window.machineDatabase
            const validMachineIdsSet = new Set(window.machineDatabase.map(m => normalizeMachineId(m.id)));
            let activeDowntimeSet = new Set();
            try {
                // OTIMIZADO: usa cache global ao invés de leitura direta
                const activeData = typeof window.getActiveDowntimesCached === 'function'
                    ? await window.getActiveDowntimesCached()
                    : (await getDb().collection('active_downtimes').get()).docs.map(d => ({id: d.id, ...d.data()}));
                const validDowntimeIds = activeData
                    // FIX: Aceitar paradas onde isActive NÃO seja explicitamente false
                    // (undefined, null, true = parada válida; apenas false = inativa)
                    .filter(d => {
                        if (d.isActive === false) {
                            console.debug(`[loadMachineCards] Parada ${d.id} com isActive=false, ignorando`);
                            return false;
                        }
                        return true;
                    })
                    .map(d => d.id)
                    .filter(id => {
                        const normalizedId = normalizeMachineId(id);
                        if (!validMachineIdsSet.has(normalizedId)) {
                            console.warn(`[loadMachineCards] Máquina "${id}" não existe no machineDatabase — ignorando (SEM deletar)`);
                            return false;
                        }
                        // REMOVIDO: Lógica que deletava parada se máquina tinha plano ativo
                        // Uma máquina PODE ter plano ativo E estar parada (parada mid-production)
                        return true;
                    });
                activeDowntimeSet = new Set(validDowntimeIds);
            } catch (e) {
                console.warn('Erro ao buscar paradas ativas:', e);
            }
            // NOTA: Auto-limpeza REMOVIDA — era causa de sumiço de paradas ativas

            // NOVO: Carregar paradas longas para mostrar no painel de máquinas
            const machinesDowntime = await getAllMachinesDowntimeStatus();
            renderMachineCards(activePlans, productionEntries, downtimeEntries, activeDowntimeSet, machinesDowntime);
            
            // Disparar evento para sinalizar que dados foram atualizados
            document.dispatchEvent(new CustomEvent('machineDataUpdated', { detail: { machineCardData, activePlans } }));
        } catch (error) {
            console.error('Erro ao carregar máquinas: ', error);
            if (machineCardGrid) {
                machineCardGrid.innerHTML = '';
            }
            if (machineCardEmptyState) {
                machineCardEmptyState.textContent = 'Erro ao carregar máquinas. Tente novamente.';
                machineCardEmptyState.classList.remove('hidden');
                machineCardEmptyState.classList.add('text-red-100');
            }
            if (machineSelector) {
                machineSelector.innerHTML = '<option value="">Erro ao carregar máquinas</option>';
                machineSelector.machineData = {};
            }
        }
    }
    
    // Função para atualizar display do turno atual
    function updateCurrentShiftDisplay() {
        if (!currentShiftDisplay) return;
        
        const currentShift = getCurrentShift();
        currentShiftDisplay.textContent = `T${currentShift}`;
    }
    
    // ========== SISTEMA DE SCROLL LOCK PARA PAINEL DE APONTAMENTO ==========
    let scrollLockActive = false;
    let scrollLockTimeout = null;
    let scrollLockPosition = null;
    
    // Função para ativar o lock de scroll (mantém a posição atual)
    function activateScrollLock(duration = 3000) {
        scrollLockActive = true;
        scrollLockPosition = window.pageYOffset;
        
        // Limpar timeout anterior se existir
        if (scrollLockTimeout) {
            clearTimeout(scrollLockTimeout);
        }
        
        // Listener para manter a posição durante o lock
        const maintainPosition = () => {
            if (scrollLockActive && scrollLockPosition !== null) {
                // Verificar se a página tentou subir (scroll < posição travada)
                if (window.pageYOffset < scrollLockPosition - 50) {
                    window.scrollTo({
                        top: scrollLockPosition,
                        behavior: 'instant'
                    });
                }
            }
        };
        
        // Adicionar listener temporário
        window.addEventListener('scroll', maintainPosition, { passive: true });
        
        // Desativar após o tempo especificado
        scrollLockTimeout = setTimeout(() => {
            scrollLockActive = false;
            scrollLockPosition = null;
            window.removeEventListener('scroll', maintainPosition);
            console.log('[SCROLL-LOCK] Desbloqueado após', duration, 'ms');
        }, duration);
        
        console.log('[SCROLL-LOCK] Ativado por', duration, 'ms na posição', scrollLockPosition);
    }
    
    // Função para fazer scroll para o painel de apontamento e ativar lock
    function scrollToPanelWithLock() {
        const scrollTarget = document.getElementById('production-control-panel');
        if (!scrollTarget) return;
        
        // Calcular posição ideal (deixar um pequeno espaço no topo)
        const targetRect = scrollTarget.getBoundingClientRect();
        const absoluteTop = window.pageYOffset + targetRect.top;
        const offsetTop = Math.max(0, absoluteTop - 80); // 80px de margem no topo
        
        // Scroll suave para a posição calculada
        window.scrollTo({
            top: offsetTop,
            behavior: 'smooth'
        });
        
        // Adicionar destaque visual temporário
        scrollTarget.classList.add('ring-2', 'ring-blue-400', 'ring-offset-2');
        setTimeout(() => {
            scrollTarget.classList.remove('ring-2', 'ring-blue-400', 'ring-offset-2');
        }, 1500);
        
        // Aguardar o scroll terminar e então ativar o lock
        setTimeout(() => {
            activateScrollLock(4000); // Lock por 4 segundos após o scroll
        }, 500); // Aguardar 500ms para o scroll suave terminar
    }
    // ========== FIM SISTEMA DE SCROLL LOCK ==========

    // Função para quando uma máquina é selecionada
    // @param {string} machine - ID da máquina
    // @param {object} options - Opções: { scrollToPanel: boolean } - se true, faz scroll para o painel de apontamento
    async function onMachineSelected(machine, options = {}) {
        const { scrollToPanel = false } = options;
        const previousMachine = window.selectedMachineData ? window.selectedMachineData.machine : null;
        // machineCardData agora é array - pegar primeiro plano para compatibilidade
        const machineDataArray = machineCardData[machine];
        const machineData = Array.isArray(machineDataArray) ? machineDataArray[0] : (machineDataArray || machineSelector?.machineData?.[machine]);

        if (!machine || !machineData) {
            productionControlPanel.classList.add('hidden');
            window.selectedMachineData = null;
            setActiveMachineCard(null);
            resetProductionTimer();
            if (recentEntriesList) {
                recentEntriesList.innerHTML = '';
            }
            updateRecentEntriesEmptyMessage('Selecione uma máquina para visualizar os lançamentos.');
            setRecentEntriesState({ loading: false, empty: true });
            if (productMp) productMp.textContent = 'Matéria-prima não definida';
            return;
        }
        
        window.selectedMachineData = machineData;
        if (machineSelector) {
            machineSelector.value = machine;
        }
        setActiveMachineCard(machine);
        updateQuickProductionPieceWeightUI({ forceUpdateInput: true });
        
        // Carregar estado persistente da tara
        loadTareStateForAllForms(window.selectedMachineData.machine);
        
        // Atualizar informações de tara nos formulários
        updateTareDisplay('quick', document.getElementById('quick-production-use-tare')?.checked || false);
        updateTareDisplay('manual', document.getElementById('manual-production-use-tare')?.checked || false);
        updateTareDisplay('losses', document.getElementById('quick-losses-use-tare')?.checked || false);

        if (previousMachine !== window.selectedMachineData.machine) {
            resetProductionTimer();
        }
        
        // Atualizar informações da máquina
        if (machineIcon) machineIcon.textContent = machine;
        if (machineName) machineName.textContent = `Máquina ${machine}`;
        if (productName) productName.textContent = window.selectedMachineData.product || 'Produto não definido';
        if (productMp) {
            productMp.textContent = window.selectedMachineData.mp ? `MP: ${window.selectedMachineData.mp}` : 'Matéria-prima não definida';
        }

        // Sincronizar com OP ativa (se existir) antes de atualizar o card principal
        await syncSelectedMachineWithActiveOrder();
        // Centralizar atualização do card principal (inclui shiftTarget)
        updateMachineInfo();
        
        // Mostrar painel
        productionControlPanel.classList.remove('hidden');
        
        // Scroll automático para o painel de apontamento (apenas quando solicitado - click direto no card)
        if (scrollToPanel) {
            // Usar requestAnimationFrame para garantir que o DOM foi atualizado
            requestAnimationFrame(() => {
                scrollToPanelWithLock();
            });
        }
        
        // Alerta de parada longa removido - Unificação 02/2026
        
        // Carregar dados
        await refreshLaunchCharts();
        await loadTodayStats();
        await loadRecentEntries(false);
        
        // Reset machine status (mas verificar se há parada ativa primeiro)
        machineStatus = 'running';
        updateMachineStatus();
        
        // Verificar se há parada ativa para esta máquina
        await checkActiveDowntimes();
    }
    
    // Função para carregar gráfico de produção por hora
    async function loadHourlyProductionChart() {
        if (!window.selectedMachineData || !hourlyProductionChart) return;

        currentActiveOrder = null;
        currentOrderProgress = { executed: 0, planned: 0, expected: 0 };

        try {
            const today = getProductionDateString();
            // 1) Recuperar todos os lançamentos de produção da MÁQUINA no dia atual
            //    (filtraremos em memória pelos planos do MESMO PRODUTO)
            const productionSnapshot = await getDb().collection('production_entries')
                .where('data', '==', today)
                .where('machine', '==', window.selectedMachineData.machine)
                .get();

            const hourlyData = {};
            for (let i = 7; i < 31; i++) {
                const hour = i >= 24 ? i - 24 : i;
                const hourStr = `${String(hour).padStart(2, '0')}:00`;
                hourlyData[hourStr] = { planned: 0, actual: 0 };
            }

            const partCode = window.selectedMachineData.product_cod || window.selectedMachineData.product_code;
            let matchedOrder = null;
            let lotSize = Number(window.selectedMachineData.planned_quantity) || 0;

            // 2) Identificar todos os planos de HOJE para esta máquina e MESMO PRODUTO
            //    para consolidar entre trocas de OP do mesmo produto
            let relevantPlans = [];
            try {
                const planSnap = await getDb().collection('planning')
                    .where('date', '==', today)
                    .where('machine', '==', window.selectedMachineData.machine)
                    .get();
                const partMatcher = String(partCode || '').trim().toLowerCase();
                relevantPlans = planSnap.docs
                    .map(doc => ({ id: doc.id, ...doc.data() }))
                    .filter(plan => {
                        const code = String(plan.product_cod || plan.product_code || plan.part_code || '').trim().toLowerCase();
                        return partMatcher && code && code === partMatcher;
                    });
            } catch (e) {
                console.warn('[HOUR-CHART] Falha ao recuperar planos do dia para consolidação', e);
                relevantPlans = [];
            }

            // Preferir a OP vinculada ao planejamento, se existir
            if (window.selectedMachineData.order_id) {
                try {
                    const doc = await getDb().collection('production_orders').doc(window.selectedMachineData.order_id).get();
                    if (doc.exists) {
                        matchedOrder = { id: doc.id, ...doc.data() };
                        const orderLotSize = Number(matchedOrder.lot_size);
                        if (Number.isFinite(orderLotSize) && orderLotSize > 0) {
                            lotSize = orderLotSize;
                        }
                    }
                } catch (e) {
                    console.warn('Falha ao recuperar OP vinculada ao plano:', e);
                }
            }

            // Fallback por código da peça, mantendo prioridade da mesma máquina
            if (!matchedOrder && partCode) {
                try {
                    const lotsSnapshot = await getDb().collection('production_orders')
                        .where('part_code', '==', String(partCode))
                        .get();

                    if (!lotsSnapshot.empty) {
                        const orderDocs = lotsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                        const toNum = (v) => { const n = parseInt(String(v||'').replace(/\D/g,''), 10); return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY; };
                        const isOpen = (o) => !['concluida','cancelada','finalizada','encerrada'].includes(String(o.status||'').toLowerCase());
                        const sameMachine = orderDocs.filter(o => (o.machine_id || o.machine) === window.selectedMachineData.machine);
                        matchedOrder = sameMachine.find(o => ['ativa','em_andamento'].includes(String(o.status||'').toLowerCase()))
                            || sameMachine.filter(isOpen).sort((a,b) => toNum(a.order_number) - toNum(b.order_number))[0]
                            || orderDocs.filter(isOpen).sort((a,b) => toNum(a.order_number) - toNum(b.order_number))[0]
                            || orderDocs.sort((a,b) => toNum(a.order_number) - toNum(b.order_number))[0];

                        if (matchedOrder) {
                            const orderLotSize = Number(matchedOrder.lot_size);
                            if (Number.isFinite(orderLotSize) && orderLotSize > 0) {
                                lotSize = orderLotSize;
                            }
                        }
                    }
                } catch (lotError) {
                    console.warn('Não foi possível recuperar informações da ordem vinculada:', lotError);
                }
            }

            // 3) Calcular META DIÁRIA consolidada por MÁQUINA + PRODUTO (somatório dos planos do dia)
            let dailyTarget = 0;
            if (Array.isArray(relevantPlans) && relevantPlans.length > 0) {
                dailyTarget = relevantPlans.reduce((sum, p) => {
                    const pq = Number(p.planned_quantity || p.daily_target || 0) || 0;
                    return sum + pq;
                }, 0);
            }
            // Fallback: manter meta do plano selecionado se não houver agrupamento
            if (!Number.isFinite(dailyTarget) || dailyTarget <= 0) {
                dailyTarget = Number(window.selectedMachineData.planned_quantity) || Number(window.selectedMachineData.daily_target) || 0;
            }
            const hourlyTarget = HOURS_IN_PRODUCTION_DAY > 0 ? (dailyTarget / HOURS_IN_PRODUCTION_DAY) : 0;

            Object.keys(hourlyData).forEach(hour => {
                hourlyData[hour].planned = hourlyTarget;
            });

            // 4) Somar EXECUTADO por hora somente para lançamentos pertencentes aos planos do mesmo produto
            const relevantPlanIdSet = new Set((relevantPlans || []).map(p => p.id));
            // Se não encontramos planos relevantes (edge), considerar ao menos o plano atual como elegível
            if (relevantPlanIdSet.size === 0 && window.selectedMachineData.id) {
                relevantPlanIdSet.add(window.selectedMachineData.id);
            }

            productionSnapshot.forEach(doc => {
                const data = doc.data();
                // Filtrar por plano relevante (mesmo produto)
                if (data.planId && !relevantPlanIdSet.has(data.planId)) {
                    return;
                }
                const prodDate = resolveProductionDateTime(data);
                if (!prodDate) {
                    return;
                }
                const hour = `${String(prodDate.getHours()).padStart(2, '0')}:00`;
                if (!hourlyData[hour]) {
                    hourlyData[hour] = { planned: hourlyTarget, actual: 0 };
                }
                hourlyData[hour].actual += data.produzido || 0;
            });

            const totalExecuted = Object.values(hourlyData).reduce((sum, entry) => sum + (entry.actual || 0), 0);
            const hoursElapsed = getHoursElapsedInProductionDay(new Date());
            const expectedByNow = Math.min(dailyTarget, hoursElapsed * hourlyTarget);

            if (matchedOrder) {
                currentActiveOrder = { ...matchedOrder };
            }
            currentOrderProgress = {
                executed: totalExecuted,
                planned: dailyTarget,
                expected: expectedByNow
            };

            updateTimelineProgress(totalExecuted, dailyTarget, expectedByNow);

            if (hourlyChartInstance) {
                hourlyChartInstance.destroy();
                hourlyChartInstance = null;
            }

            const hours = Object.keys(hourlyData);
            const plannedData = hours.map(hour => Number(hourlyData[hour].planned || 0));
            const actualData = hours.map(hour => Number(hourlyData[hour].actual || 0));

            hourlyChartInstance = createHourlyProductionChart({
                canvas: hourlyProductionChart,
                labels: hours,
                executedPerHour: actualData,
                plannedPerHour: plannedData,
                highlightCurrentHour: true
            });

        } catch (error) {
            console.error('Erro ao carregar dados do gráfico: ', error);
        }
    }
    
    // Função para carregar estatísticas do dia (janela de produção 07:00 -> 07:00)
    async function loadTodayStats(filterDate = null) {
        if (!window.selectedMachineData) return;
        
        try {
            const today = filterDate || window.lancamentoFilterDate || getProductionDateString();
            // Janela do dia de produção atual: [hoje 07:00, amanhã 07:00)
            const windowStart = combineDateAndTime(today, '07:00');
            const nextDay = new Date(windowStart);
            nextDay.setDate(nextDay.getDate() + 1);
            const tomorrow = nextDay.toISOString().split('T')[0];
            const windowEnd = combineDateAndTime(tomorrow, '07:00');
            
            // Buscar dados de produção
            const prodSnapshot = await getDb().collection('production_entries')
                .where('machine', '==', window.selectedMachineData.machine)
                .where('data', '==', today)
                .get();
            
            const productions = prodSnapshot.docs.map(doc => doc.data());
            
                        // Buscar paradas de hoje e de amanhã (duas consultas simples)
                        const [dtSnapToday, dtSnapTomorrow] = await Promise.all([
                                getDb().collection('downtime_entries')
                                    .where('machine', '==', window.selectedMachineData.machine)
                                    .where('date', '==', today)
                                    .get(),
                                getDb().collection('downtime_entries')
                                    .where('machine', '==', window.selectedMachineData.machine)
                                    .where('date', '==', tomorrow)
                                    .get()
                        ]);
                        const downtimes = [...dtSnapToday.docs, ...dtSnapTomorrow.docs].map(doc => doc.data());
            
            // Calcular totais e produção por turno
            let totalProduced = 0;
            let totalLosses = 0;
            let producedT1 = 0;
            let producedT2 = 0;
            let producedT3 = 0;
            
            productions.forEach(prod => {
                const quantidade = Number(prod.produzido || prod.quantity || 0) || 0;
                const turno = Number(prod.turno || prod.shift || 0);
                
                totalProduced += quantidade;
                totalLosses += Number(prod.refugo_kg || 0) || 0;
                
                // Separar por turno
                if (turno === 1) {
                    producedT1 += quantidade;
                } else if (turno === 2) {
                    producedT2 += quantidade;
                } else if (turno === 3) {
                    producedT3 += quantidade;
                }
            });
            
            // Somar apenas a interseção com a janela de produção (evita inflar com 00:00-07:00 que pertence ao dia anterior)
            let totalDowntime = 0;
            downtimes.forEach(dt => {
                const start = combineDateAndTime(dt.date, dt.startTime);
                const end = combineDateAndTime(dt.date, dt.endTime);
                if (!(start instanceof Date) || Number.isNaN(start.getTime())) return;
                if (!(end instanceof Date) || Number.isNaN(end.getTime())) return;
                // Overlap com [windowStart, windowEnd)
                const overlapStart = start > windowStart ? start : windowStart;
                const overlapEnd = end < windowEnd ? end : windowEnd;
                if (overlapEnd > overlapStart) {
                    totalDowntime += Math.round((overlapEnd - overlapStart) / 60000);
                }
            });
            
            // Calcular eficiência baseado na meta diária (com fallback para planned_quantity)
            const dailyTarget = Number(window.selectedMachineData.daily_target || window.selectedMachineData.planned_quantity || 0);
            const efficiency = dailyTarget > 0 ? (totalProduced / dailyTarget * 100) : 0;
            
            // Atualizar display - produção por turno
            const producedT1El = document.getElementById('produced-t1');
            const producedT2El = document.getElementById('produced-t2');
            const producedT3El = document.getElementById('produced-t3');
            if (producedT1El) producedT1El.textContent = producedT1.toLocaleString('pt-BR');
            if (producedT2El) producedT2El.textContent = producedT2.toLocaleString('pt-BR');
            if (producedT3El) producedT3El.textContent = producedT3.toLocaleString('pt-BR');
            
            // Atualizar displays - totais
            if (producedToday) producedToday.textContent = totalProduced.toLocaleString('pt-BR');
            if (efficiencyToday) efficiencyToday.textContent = `${efficiency.toFixed(1)}%`;
            if (lossesToday) lossesToday.textContent = totalLosses.toFixed(2);
            if (downtimeToday) downtimeToday.textContent = totalDowntime;

            const shiftReference = new Date();
            const shiftStart = getShiftStartDateTime(shiftReference);
            const activeDowntime = (machineStatus === 'stopped' && currentDowntimeStart && currentDowntimeStart.machine === window.selectedMachineData.machine)
                ? currentDowntimeStart
                : null;

            if (shiftStart) {
                const runtimeSeconds = calculateProductionRuntimeSeconds({
                    shiftStart,
                    now: shiftReference,
                    downtimes,
                    activeDowntime
                });
                synchronizeProductionTimer(runtimeSeconds, machineStatus === 'running');
            } else {
                resetProductionTimer();
            }
            
        } catch (error) {
            console.error("Erro ao carregar estatísticas: ", error);
        }
    }




// --- Entry point ---
let _lancamentoInitialized = false;
export function setupLancamentoPage() {
    if (_lancamentoInitialized) {
        console.debug('[Launch-mod] Já inicializado — apenas recarregando dados');
        loadLaunchPanel();
        return;
    }
    _lancamentoInitialized = true;
    console.log('[Launch-mod] Controller modular carregado');
    loadLaunchPanel();
}

