/**
 * HokkaidoMES — PCP Controller (Módulo ES6)
 * Fase 2: Extração #1 — Planejamento e Controle da Produção
 * 
 * Migrado de script.js (linhas ~48220-49604).
 * Zero alteração de lógica — apenas encapsulamento em módulo.
 * 
 * Dependências legacy (via window.*):
 *   - window.authSystem, window.machineSchedule, window.MachineQueue
 *   - window.DISABLED_MACHINES, window.productByCode
 *   - window.getMachinePrioritiesCached, window.getProductionDateString
 *   - window.showNotification, window.lucide
 */

import { getDb, serverTimestamp } from '../services/firebase-client.js';
import { EventBus } from '../core/event-bus.js';

// ─── Estado do módulo (era global) ───────────────────
const pcpState = {
    initialized: false,
    currentDate: null,
    data: [],
    machinePriorities: {}
};

// Cache de observações PCP
let pcpObservationsCache = {};
let pcpObservationsLoaded = false;

// ─── Helpers ─────────────────────────────────────────

/** Acesso seguro ao Firestore */
function db() {
    return getDb();
}

/** Lista de máquinas desativadas */
function getDisabledMachines() {
    return window.DISABLED_MACHINES || [];
}

/** Map produto por código (do databaseModule) */
function getProductByCode() {
    return window.productByCode || new Map();
}

/**
 * Data de produção considerando turno noturno (antes de 6:30 = dia anterior)
 */
function getPCPProductionDateString(date = new Date()) {
    const d = date instanceof Date ? date : new Date(date);
    const hour = d.getHours();
    const minute = d.getMinutes();
    if (hour < 6 || (hour === 6 && minute < 30)) {
        d.setDate(d.getDate() - 1);
    }
    return d.toISOString().split('T')[0];
}

/**
 * Turno atual: T1=06:30-15:00, T2=15:00-23:30, T3=23:30-06:30
 */
function getCurrentShift() {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const currentMinutes = hours * 60 + minutes;
    if (currentMinutes >= 390 && currentMinutes < 900) return '1';
    if (currentMinutes >= 900 && currentMinutes < 1410) return '2';
    return '3';
}

/**
 * Escapa texto para uso seguro em atributos HTML
 */
function escapeHtmlAttr(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ─── Sub-abas PCP ───────────────────────────────────

function setupPCPSubTabs() {
    const buttons = document.querySelectorAll('.pcp-subtab-btn');
    const contents = document.querySelectorAll('.pcp-subtab-content');

    if (!buttons.length) {
        console.warn('[PCP·mod] Sub-tab buttons not found');
        return;
    }

    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.dataset.subtab;

            // Atualizar botões
            buttons.forEach(b => {
                b.classList.remove('border-indigo-600', 'text-indigo-700', 'bg-white');
                b.classList.add('border-transparent', 'text-gray-500');
            });
            btn.classList.remove('border-transparent', 'text-gray-500');
            btn.classList.add('border-indigo-600', 'text-indigo-700', 'bg-white');

            // Atualizar conteúdo
            contents.forEach(c => c.classList.add('hidden'));
            const target = document.getElementById(`pcp-subtab-${targetId}`);
            if (target) target.classList.remove('hidden');

            // Carregar dados sob demanda — Agendamento
            if (targetId === 'pcp-agendamento') {
                if (window.machineSchedule && !window.machineSchedule.getState().initialized) {
                    window.machineSchedule.getState().currentWeekStart = window.machineSchedule._getMonday
                        ? window.machineSchedule._getMonday(new Date())
                        : new Date();
                    if (typeof window.machineSchedule._loadAndRender === 'function') {
                        window.machineSchedule._loadAndRender();
                    }
                    window.machineSchedule.getState().initialized = true;
                }
            }

            if (typeof lucide !== 'undefined') lucide.createIcons();
            console.log('[PCP·mod] Sub-aba ativa:', targetId);
        });
    });

    console.log('[PCP·mod] Sub-abas configuradas:', buttons.length, 'abas');
}

// ─── Sistema de Prioridade ──────────────────────────

async function loadMachinePriorities() {
    try {
        console.log('[PCP·mod] Carregando prioridades das máquinas...');
        const priorities = await window.getMachinePrioritiesCached(false);
        pcpState.machinePriorities = priorities;
        console.log('[PCP·mod] Prioridades carregadas:', Object.keys(pcpState.machinePriorities).length, 'máquinas');
    } catch (error) {
        console.error('[PCP·mod] Erro ao carregar prioridades:', error);
        pcpState.machinePriorities = {};
    }
}

async function saveMachinePriority(machineId, priority) {
    try {
        console.log('[PCP·mod] Salvando prioridade:', machineId, '=', priority);
        await db().collection('machine_priorities').doc(machineId).set({
            priority: priority,
            updatedAt: serverTimestamp(),
            updatedBy: window.authSystem?.getCurrentUser?.()?.name || 'Sistema'
        }, { merge: true });

        pcpState.machinePriorities[machineId] = priority;
        EventBus.emit('pcp:priority-changed', { machineId, priority });
        console.log('[PCP·mod] Prioridade salva com sucesso!');
        return true;
    } catch (error) {
        console.error('[PCP·mod] Erro ao salvar prioridade:', error);
        return false;
    }
}

function getMachinePriority(machineId) {
    return pcpState.machinePriorities[machineId];
}

function setupPCPPriorityModal() {
    const modal = document.getElementById('modal-pcp-priority');
    if (!modal) return;

    const btnClose = document.getElementById('btn-close-priority-modal');
    const btnCancel = document.getElementById('btn-cancel-priority');
    const btnSave = document.getElementById('btn-save-priority');

    if (btnClose) btnClose.addEventListener('click', closePCPPriorityModal);
    if (btnCancel) btnCancel.addEventListener('click', closePCPPriorityModal);

    // Botões de prioridade
    const priorityBtns = modal.querySelectorAll('.priority-btn');
    priorityBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            priorityBtns.forEach(b => {
                b.classList.remove('border-amber-500', 'bg-amber-50');
                b.classList.add('border-gray-200');
            });
            btn.classList.remove('border-gray-200');
            btn.classList.add('border-amber-500', 'bg-amber-50');
            document.getElementById('pcp-priority-value').value = btn.dataset.priority;
        });
    });

    if (btnSave) {
        btnSave.addEventListener('click', async () => {
            const machineSelect = document.getElementById('pcp-priority-machine');
            const priorityValue = document.getElementById('pcp-priority-value').value;

            if (!machineSelect.value) { alert('Selecione uma máquina!'); return; }
            if (priorityValue === '') { alert('Selecione uma prioridade!'); return; }

            btnSave.disabled = true;
            btnSave.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Salvando...';

            const success = await saveMachinePriority(machineSelect.value, parseInt(priorityValue));

            if (success) {
                closePCPPriorityModal();
                const date = document.getElementById('pcp-date-selector')?.value || getPCPProductionDateString();
                const shiftFilter = document.getElementById('pcp-shift-selector')?.value || 'current';
                loadPCPData(date, shiftFilter);
            } else {
                alert('Erro ao salvar prioridade. Tente novamente.');
            }

            btnSave.disabled = false;
            btnSave.innerHTML = '<i data-lucide="save" class="w-4 h-4"></i> Salvar';
            if (typeof lucide !== 'undefined') lucide.createIcons();
        });
    }

    modal.addEventListener('click', (e) => {
        if (e.target === modal) closePCPPriorityModal();
    });
}

function openPCPPriorityModal() {
    const modal = document.getElementById('modal-pcp-priority');
    if (!modal) return;

    const machineSelect = document.getElementById('pcp-priority-machine');
    if (machineSelect) {
        let optionsHTML = '<option value="">-- Selecione uma máquina --</option>';
        const disabled = getDisabledMachines();
        for (let i = 1; i <= 32; i++) {
            const machineId = `H${i.toString().padStart(2, '0')}`;
            if (disabled.includes(machineId)) continue;
            const currentPriority = getMachinePriority(machineId);
            const priorityLabel = currentPriority > 0 ? ` (Prioridade: ${currentPriority})` : '';
            optionsHTML += `<option value="${machineId}">${machineId}${priorityLabel}</option>`;
        }
        machineSelect.innerHTML = optionsHTML;
    }

    // Resetar seleção de prioridade
    const priorityBtns = modal.querySelectorAll('.priority-btn');
    priorityBtns.forEach(btn => {
        btn.classList.remove('border-amber-500', 'bg-amber-50');
        btn.classList.add('border-gray-200');
    });
    document.getElementById('pcp-priority-value').value = '';

    modal.classList.remove('hidden');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function closePCPPriorityModal() {
    const modal = document.getElementById('modal-pcp-priority');
    if (modal) modal.classList.add('hidden');
}

function renderPriorityBadge(priority) {
    const priorityNum = parseInt(priority);
    if (isNaN(priorityNum)) return '';

    let bgColor, textColor, borderColor, label;
    if (priorityNum === 0) {
        bgColor = 'bg-red-100'; textColor = 'text-red-700'; borderColor = 'border-red-300'; label = 'URGENTE';
    } else if (priorityNum === 1) {
        bgColor = 'bg-orange-100'; textColor = 'text-orange-700'; borderColor = 'border-orange-300'; label = 'Alta';
    } else if (priorityNum === 2) {
        bgColor = 'bg-amber-100'; textColor = 'text-amber-700'; borderColor = 'border-amber-300'; label = 'Média-Alta';
    } else if (priorityNum === 3) {
        bgColor = 'bg-yellow-100'; textColor = 'text-yellow-700'; borderColor = 'border-yellow-300'; label = 'Média';
    } else if (priorityNum === 4) {
        bgColor = 'bg-lime-100'; textColor = 'text-lime-700'; borderColor = 'border-lime-300'; label = 'Baixa';
    } else {
        bgColor = 'bg-gray-100'; textColor = 'text-gray-600'; borderColor = 'border-gray-300'; label = 'Mínima';
    }

    return `<span class="inline-flex items-center justify-center px-2 py-0.5 rounded border ${bgColor} ${textColor} ${borderColor} font-semibold text-sm" title="Prioridade ${priorityNum} - ${label}">${priorityNum}</span>`;
}

// ─── Observações PCP ────────────────────────────────

async function loadPCPObservations(date) {
    try {
        const docRef = db().collection('pcp_observations').doc(date);
        const doc = await docRef.get();
        if (doc.exists) {
            pcpObservationsCache = doc.data().machines || {};
        } else {
            pcpObservationsCache = {};
        }
        pcpObservationsLoaded = true;
        console.log('[PCP·mod] Observações carregadas:', Object.keys(pcpObservationsCache).length, 'máquinas');
    } catch (err) {
        console.error('[PCP·mod] Erro ao carregar observações:', err);
        pcpObservationsCache = {};
    }
}

async function savePCPObservation(machineId, text) {
    try {
        const dateEl = document.getElementById('pcp-date-selector');
        const date = dateEl ? dateEl.value : new Date().toISOString().split('T')[0];

        pcpObservationsCache[machineId] = text;

        const docRef = db().collection('pcp_observations').doc(date);
        await docRef.set({
            machines: pcpObservationsCache,
            updatedAt: serverTimestamp()
        }, { merge: true });

        console.log(`[PCP·mod] Observação salva: ${machineId} = "${text}"`);
    } catch (err) {
        console.error('[PCP·mod] Erro ao salvar observação:', err);
        if (typeof window.showNotification === 'function') window.showNotification('Erro ao salvar observação', 'error');
    }
}

// ─── Carregamento de Dados Principal ────────────────

async function loadPCPData(date, shiftFilter = 'current') {
    console.log('[PCP·mod] Carregando dados para:', date, 'Turno:', shiftFilter);

    const loadingEl = document.getElementById('pcp-loading');
    const tableContainer = document.getElementById('pcp-table-container');
    const emptyState = document.getElementById('pcp-empty-state');

    if (loadingEl) loadingEl.classList.remove('hidden');
    if (tableContainer) tableContainer.classList.add('hidden');
    if (emptyState) emptyState.classList.add('hidden');

    const DISABLED = getDisabledMachines();
    const productByCode = getProductByCode();

    try {
        const effectiveShift = shiftFilter === 'current' ? getCurrentShift() : shiftFilter;
        console.log('[PCP·mod] Turno efetivo para filtro:', effectiveShift);

        // 0. Observações
        await loadPCPObservations(date);

        // 1. Planejamentos da data
        const planningSnapshot = await db().collection('planning')
            .where('date', '==', date)
            .get();

        const planningByMachine = new Map();
        const machinesWithPlanning = new Set();

        planningSnapshot.forEach(doc => {
            const data = { id: doc.id, ...doc.data() };
            const machineId = (data.machine || '').toUpperCase().trim();
            if (!machineId) return;
            if (DISABLED.includes(machineId)) {
                console.log(`[PCP·mod] Ignorando máquina desativada: ${machineId}`);
                return;
            }

            machinesWithPlanning.add(machineId);
            const planShift = String(data.shift || data.turno || '1');

            if (!planningByMachine.has(machineId)) {
                planningByMachine.set(machineId, []);
            }

            if (shiftFilter === 'all') {
                planningByMachine.get(machineId).push(data);
            } else {
                if (planShift === effectiveShift) {
                    planningByMachine.get(machineId).push({ ...data, _isCorrectShift: true });
                } else {
                    planningByMachine.get(machineId).push({ ...data, _isFallback: true });
                }
            }
        });

        // Multi-produto: dedup
        const planningItems = [];
        const addedPlanKeys = new Set();

        planningByMachine.forEach((plans, machineId) => {
            const correctShiftPlans = plans.filter(p => p._isCorrectShift);
            const fallbackPlans = plans.filter(p => p._isFallback);
            const normalPlans = plans.filter(p => !p._isCorrectShift && !p._isFallback);

            const addPlanIfNotDuplicate = (plan) => {
                const planShift = String(plan.shift || plan.turno || '1');
                const productCode = plan.product_code || plan.productCode || plan.product || plan.product_cod || '';
                const key = `${machineId}_T${planShift}_${productCode}`;
                if (!addedPlanKeys.has(key)) {
                    addedPlanKeys.add(key);
                    planningItems.push(plan);
                    return true;
                }
                console.log(`[PCP·mod] Ignorando planejamento duplicado: ${key} (id: ${plan.id})`);
                return false;
            };

            if (shiftFilter === 'all') {
                normalPlans.forEach(p => addPlanIfNotDuplicate(p));
            } else if (correctShiftPlans.length > 0) {
                correctShiftPlans.forEach(p => addPlanIfNotDuplicate(p));
            } else if (fallbackPlans.length > 0) {
                console.log(`[PCP·mod] Máquina ${machineId} não tem planejamento para turno ${effectiveShift}, usando 1 fallback de ${fallbackPlans.length} disponíveis`);
                addPlanIfNotDuplicate(fallbackPlans[0]);
            }
        });

        console.log('[PCP·mod] Planejamentos após processamento:', planningItems.length, 'máquinas únicas:', machinesWithPlanning.size, 'chaves únicas:', addedPlanKeys.size);

        // 2. Paradas ativas (OTIMIZADO: usa cache global, TTL 30s)
        const activeDowntimesData = typeof window.getActiveDowntimesCached === 'function'
            ? await window.getActiveDowntimesCached()
            : (await db().collection('active_downtimes').get()).docs.map(doc => ({id: doc.id, ...doc.data()}));
        const activeDowntimes = new Map();
        activeDowntimesData.forEach(d => {
            if (d && d.isActive === true) {
                const machineId = d.id.toUpperCase().trim();
                if (DISABLED.includes(machineId)) return;
                activeDowntimes.set(machineId, { ...d, source: 'active_live' });
            }
        });
        console.log('[PCP·mod] Paradas ativas (active_downtimes):', activeDowntimes.size, [...activeDowntimes.keys()]);

        // 3. Paradas normais em andamento
        const downtimeEntriesSnapshot = await db().collection('downtime_entries')
            .where('date', '==', date)
            .get();

        const now = new Date();
        const currentTime = now.toTimeString().slice(0, 5);
        const normalDowntimes = new Map();
        downtimeEntriesSnapshot.forEach(doc => {
            const data = doc.data();
            const machineId = (data.machine || '').toUpperCase().trim();
            if (!machineId) return;
            if (DISABLED.includes(machineId)) return;

            const hasNoEndTime = !data.endTime || data.endTime === '';
            const endTimeNotPassed = data.endTime && currentTime < data.endTime;
            if (hasNoEndTime || endTimeNotPassed) {
                normalDowntimes.set(machineId, { ...data, source: 'downtime_entries' });
            }
        });
        console.log('[PCP·mod] Paradas normais em andamento (downtime_entries):', normalDowntimes.size, [...normalDowntimes.keys()]);

        // Buscar último planejamento para máquinas sem planning hoje
        const machinesNeedingData = new Set();
        activeDowntimes.forEach((_, machineId) => {
            if (!machinesWithPlanning.has(machineId)) machinesNeedingData.add(machineId);
        });
        normalDowntimes.forEach((_, machineId) => {
            if (!machinesWithPlanning.has(machineId)) machinesNeedingData.add(machineId);
        });

        const lastPlanningByMachine = new Map();
        if (machinesNeedingData.size > 0) {
            const machineArray = [...machinesNeedingData];
            console.log('[PCP·mod] Buscando último planejamento para máquinas:', machineArray);

            // OTIMIZAÇÃO Fase 2: executar todas as queries de último planejamento em paralelo
            const planQueries = machineArray.map(machineId =>
                db().collection('planning')
                    .where('machine', '==', machineId)
                    .orderBy('date', 'desc')
                    .limit(1)
                    .get()
                    .then(snap => ({ machineId, snap }))
                    .catch(e => {
                        console.warn('[PCP·mod] Erro ao buscar último planejamento para', machineId, e);
                        return { machineId, snap: null };
                    })
            );
            const planResults = await Promise.all(planQueries);

            for (const { machineId, snap: lastPlanSnapshot } of planResults) {
                if (!lastPlanSnapshot || lastPlanSnapshot.empty) continue;
                try {
                    const planData = lastPlanSnapshot.docs[0].data();
                    const productCode = planData.product_code || planData.productCode || planData.product || '';
                    const productInfo = productByCode?.get(productCode) || {};

                    let realCavidades = null;
                    let realCiclo = null;
                    for (const shiftKey of ['t1', 't2', 't3']) {
                        if (realCavidades === null) {
                            const cavValue = Number(planData[`active_cavities_${shiftKey}`]) ||
                                Number(planData[`active_cavities_${shiftKey.toUpperCase()}`]);
                            if (cavValue > 0) realCavidades = cavValue;
                        }
                        if (realCiclo === null) {
                            const cycleValue = Number(planData[`real_cycle_${shiftKey}`]) ||
                                Number(planData[`real_cycle_${shiftKey.toUpperCase()}`]);
                            if (cycleValue > 0) realCiclo = cycleValue;
                        }
                        if (realCavidades !== null && realCiclo !== null) break;
                    }

                    lastPlanningByMachine.set(machineId, {
                        cavidades: realCavidades || Number(planData.cavities) || Number(planData.cavidade) || Number(productInfo.cavidades) || 0,
                        ciclo: realCiclo || Number(planData.cycle) || Number(planData.cycle_time) || Number(productInfo.ciclo) || 0,
                        cliente: planData.client || planData.cliente || productInfo.cliente || '-',
                        produto: planData.product_name || planData.productName || productInfo.descricao || productCode || '-'
                    });
                } catch (e) {
                    console.warn('[PCP·mod] Erro ao processar planejamento para', machineId, e);
                }
            }
            console.log('[PCP·mod] Últimos planejamentos encontrados:', lastPlanningByMachine.size);
        }

        // Sem dados?
        if (planningItems.length === 0 && activeDowntimes.size === 0 && normalDowntimes.size === 0) {
            if (loadingEl) loadingEl.classList.add('hidden');
            if (emptyState) emptyState.classList.remove('hidden');
            updatePCPKPIs([], []);
            return;
        }

        // 5. Produção do dia
        const productionSnapshot = await db().collection('production_entries')
            .where('data', '==', date)
            .get();

        const productionByPlan = new Map();
        productionSnapshot.forEach(doc => {
            const data = doc.data();
            const planId = data.planId;
            if (planId) {
                const current = productionByPlan.get(planId) || 0;
                productionByPlan.set(planId, current + (Number(data.produzido) || 0));
            }
        });

        // Processar dados para tabela — máquinas COM planejamento
        const tableData = planningItems.map(plan => {
            const machineId = (plan.machine || '').toUpperCase().trim();
            const productCode = plan.product_code || plan.productCode || plan.product || '';
            const productInfo = productByCode?.get(productCode) || {};

            let status = 'Produzindo';
            let downtimeReason = '-';

            const activeDowntime = activeDowntimes.get(machineId);
            if (activeDowntime) {
                status = 'Parada';
                downtimeReason = activeDowntime.motivo || activeDowntime.reason || 'Não informado';
            }
            const normalDowntime = normalDowntimes.get(machineId);
            if (normalDowntime && !activeDowntime) {
                status = 'Parada';
                downtimeReason = normalDowntime.reason || normalDowntime.motivo || 'Não informado';
            }

            // Turno atual para buscar ciclo/cavidades reais
            const nowD = new Date();
            const currentMinutes = nowD.getHours() * 60 + nowD.getMinutes();
            let currentShiftKey = 't3';
            if (currentMinutes >= 390 && currentMinutes < 900) currentShiftKey = 't1';
            else if (currentMinutes >= 900 && currentMinutes < 1410) currentShiftKey = 't2';

            const shiftKeys = [currentShiftKey, 't1', 't2', 't3'];
            let realCavidades = null;
            let realCiclo = null;

            for (const shiftKey of shiftKeys) {
                if (realCavidades === null) {
                    const cavValue = Number(plan[`active_cavities_${shiftKey}`]) ||
                        Number(plan[`active_cavities_${shiftKey.toUpperCase()}`]) ||
                        Number(plan[`activeCavities${shiftKey.toUpperCase()}`]);
                    if (cavValue > 0) realCavidades = cavValue;
                }
                if (realCiclo === null) {
                    const cycleValue = Number(plan[`real_cycle_${shiftKey}`]) ||
                        Number(plan[`real_cycle_${shiftKey.toUpperCase()}`]) ||
                        Number(plan[`realCycle${shiftKey.toUpperCase()}`]);
                    if (cycleValue > 0) realCiclo = cycleValue;
                }
                if (realCavidades !== null && realCiclo !== null) break;
            }

            console.log(`[PCP·mod] Máquina ${machineId}: realCav=${realCavidades}, realCiclo=${realCiclo}`);
            console.log(`[PCP·mod] Máquina ${machineId} campos:`, {
                active_cavities_t1: plan.active_cavities_t1,
                active_cavities_t2: plan.active_cavities_t2,
                active_cavities_t3: plan.active_cavities_t3,
                real_cycle_t1: plan.real_cycle_t1,
                real_cycle_t2: plan.real_cycle_t2,
                real_cycle_t3: plan.real_cycle_t3,
                cavities: plan.cavities,
                mold_cavities: plan.mold_cavities,
                cycle: plan.cycle,
                budgeted_cycle: plan.budgeted_cycle
            });

            const cavidadesPlanejadas = Number(plan.mold_cavities) || Number(plan.cavities) || Number(plan.cavidade) || Number(productInfo.cavidades) || 0;
            const cicloPlanejado = Number(plan.budgeted_cycle) || Number(plan.cycle) || Number(plan.cycle_time) || Number(productInfo.ciclo) || 0;

            const cavidades = realCavidades || cavidadesPlanejadas;
            const ciclo = realCiclo || cicloPlanejado;

            const planejado = Number(plan.planned_quantity) || Number(plan.planned_qty) || Number(plan.quantity) || 0;
            const executado = productionByPlan.get(plan.id) || Number(plan.total_produzido) || 0;
            const faltante = Math.max(0, planejado - executado);

            const cliente = plan.client || plan.cliente || productInfo.cliente || '-';
            const produto = plan.product_name || plan.productName || productInfo.descricao || productCode || '-';

            console.log(`[PCP·mod] ${machineId} - Ciclo: real=${realCiclo}, planejado=${cicloPlanejado}, exibido=${ciclo}`);
            console.log(`[PCP·mod] ${machineId} - Cavidades: real=${realCavidades}, planejadas=${cavidadesPlanejadas}, exibido=${cavidades}`);

            const planShift = String(plan.shift || plan.turno || '1');

            return {
                machine: machineId,
                turno: planShift,
                cavidades,
                ciclo,
                cavidadesPlanejadas,
                cicloPlanejado,
                isRealCavidades: realCavidades !== null,
                isRealCiclo: realCiclo !== null,
                status,
                cliente,
                produto,
                motivoParada: downtimeReason,
                planejado,
                executado,
                faltante,
                hasPlanning: true
            };
        });

        // Máquinas com parada ativa SEM planejamento
        activeDowntimes.forEach((downtimeData, machineId) => {
            if (!machinesWithPlanning.has(machineId)) {
                const reason = downtimeData.motivo || downtimeData.reason || 'Não informado';
                const lastPlan = lastPlanningByMachine.get(machineId) || {};
                tableData.push({
                    machine: machineId, turno: '-',
                    cavidades: lastPlan.cavidades || '-', ciclo: lastPlan.ciclo || '-',
                    status: 'Parada', cliente: lastPlan.cliente || '-',
                    produto: lastPlan.produto || '-', motivoParada: reason,
                    planejado: 0, executado: 0, faltante: 0, hasPlanning: false
                });
            }
        });

        // Paradas normais em andamento SEM planejamento e SEM parada ativa
        normalDowntimes.forEach((downtimeData, machineId) => {
            if (!machinesWithPlanning.has(machineId) && !activeDowntimes.has(machineId)) {
                const reason = downtimeData.reason || downtimeData.motivo || 'Não informado';
                const lastPlan = lastPlanningByMachine.get(machineId) || {};
                tableData.push({
                    machine: machineId, turno: '-',
                    cavidades: lastPlan.cavidades || '-', ciclo: lastPlan.ciclo || '-',
                    status: 'Parada', cliente: lastPlan.cliente || '-',
                    produto: lastPlan.produto || '-', motivoParada: reason,
                    planejado: 0, executado: 0, faltante: 0, hasPlanning: false
                });
            }
        });

        tableData.sort((a, b) => a.machine.localeCompare(b.machine, undefined, { numeric: true }));

        updatePCPKPIs(tableData, activeDowntimes);

        // Carregar fila de ordens
        if (window.MachineQueue && typeof window.MachineQueue.load === 'function') {
            await window.MachineQueue.load().catch(err => console.error('[PCP·mod] Erro ao carregar fila:', err));
        }

        renderPCPTable(tableData);

        if (loadingEl) loadingEl.classList.add('hidden');
        if (tableContainer) tableContainer.classList.remove('hidden');

        if (typeof lucide !== 'undefined') lucide.createIcons();

        EventBus.emit('pcp:data-loaded', { date, shiftFilter, count: tableData.length });

    } catch (error) {
        console.error('[PCP·mod] Erro ao carregar dados:', error);
        if (loadingEl) loadingEl.classList.add('hidden');
        if (emptyState) {
            emptyState.classList.remove('hidden');
            emptyState.querySelector('h3').textContent = 'Erro ao carregar dados';
            emptyState.querySelector('p').textContent = error.message;
        }
    }
}

// ─── KPIs ───────────────────────────────────────────

function updatePCPKPIs(tableData, activeDowntimes) {
    const uniqueMachines = new Set(tableData.map(d => d.machine));
    const totalMachines = uniqueMachines.size;

    const stoppedMachinesSet = new Set();
    tableData.forEach(d => {
        if (d.status !== 'Produzindo') stoppedMachinesSet.add(d.machine);
    });
    const stoppedMachines = stoppedMachinesSet.size;
    const producingMachines = totalMachines - stoppedMachines;

    document.getElementById('pcp-kpi-machines').textContent = totalMachines.toLocaleString('pt-BR');
    document.getElementById('pcp-kpi-producing').textContent = producingMachines.toLocaleString('pt-BR');
    document.getElementById('pcp-kpi-stopped').textContent = stoppedMachines.toLocaleString('pt-BR');
}

// ─── Renderização da Tabela ─────────────────────────

function renderPCPTable(data) {
    const tableBody = document.getElementById('pcp-table-body');
    if (!tableBody) return;

    const queueCounts = (window.MachineQueue && typeof window.MachineQueue.getQueueCounts === 'function')
        ? window.MachineQueue.getQueueCounts() : {};

    // Multi-produto: agrupar por máquina+turno
    const machineShiftProducts = new Map();
    const machineShiftCount = new Map();

    data.forEach(row => {
        const key = `${row.machine}_${row.turno || '1'}`;
        const count = machineShiftCount.get(key) || 0;
        machineShiftCount.set(key, count + 1);
        if (!machineShiftProducts.has(key)) machineShiftProducts.set(key, new Set());
        machineShiftProducts.get(key).add(row.produto || '-');
    });

    const machineShiftIndex = new Map();

    machineShiftProducts.forEach((products, key) => {
        const count = machineShiftCount.get(key) || 0;
        if (count > 1 || products.size > 1) {
            console.log(`[PCP·mod-MULTI] ${key}: ${count} entradas, ${products.size} produtos únicos: [${[...products].join(', ')}] -> ${count > 1 && products.size > 1 ? 'MULTI-PRODUTO' : 'NÃO é multi-produto'}`);
        }
    });

    tableBody.innerHTML = data.map(row => {
        const statusColors = getPCPStatusColor(row.status, row.motivoParada);

        const key = `${row.machine}_${row.turno || '1'}`;
        const productSet = machineShiftProducts.get(key) || new Set();
        const productCount = machineShiftCount.get(key) || 1;
        const isMultiProduct = productCount > 1 && productSet.size > 1;

        const currentIndex = (machineShiftIndex.get(key) || 0) + 1;
        machineShiftIndex.set(key, currentIndex);

        const cicloDisplay = (typeof row.ciclo === 'number' && row.ciclo > 0) ? row.ciclo.toFixed(1) : '-';
        const cavidadesDisplay = (typeof row.cavidades === 'number' && row.cavidades > 0) ? row.cavidades : '-';

        const cicloNum = typeof row.ciclo === 'number' ? row.ciclo : 0;
        const cicloPlanNum = typeof row.cicloPlanejado === 'number' ? row.cicloPlanejado : 0;

        console.log(`[PCP·mod-RENDER] ${row.machine}: ciclo=${cicloNum}, planejado=${cicloPlanNum}, isReal=${row.isRealCiclo}`);

        let cicloClass = 'text-gray-700';
        if (cicloNum > 0 && cicloPlanNum > 0) {
            const percentualDiferenca = ((cicloNum - cicloPlanNum) / cicloPlanNum) * 100;
            if (percentualDiferenca > 10) cicloClass = 'text-red-600 font-bold';
            else if (percentualDiferenca > 0) cicloClass = 'text-amber-600 font-semibold';
            else cicloClass = 'text-green-600 font-semibold';
        }

        const cavNum = typeof row.cavidades === 'number' ? row.cavidades : 0;
        const cavPlanNum = typeof row.cavidadesPlanejadas === 'number' ? row.cavidadesPlanejadas : 0;

        console.log(`[PCP·mod-RENDER] ${row.machine}: cavidades=${cavNum}, planejadas=${cavPlanNum}, isReal=${row.isRealCavidades}`);

        let cavidadesClass = 'text-gray-700';
        if (cavNum > 0 && cavPlanNum > 0) {
            if (cavNum < cavPlanNum) cavidadesClass = 'text-red-600 font-bold';
            else cavidadesClass = 'text-green-600 font-semibold';
        }

        const cicloTitle = cicloPlanNum > 0 ? `Planejado: ${cicloPlanNum.toFixed(1)}s | Atual: ${cicloNum > 0 ? cicloNum.toFixed(1) + 's' : '-'}` : '';
        const cavTitle = cavPlanNum > 0 ? `Planejado: ${cavPlanNum} | Atual: ${cavNum > 0 ? cavNum : '-'}` : '';

        const machinePriority = getMachinePriority(row.machine);
        const priorityBadge = renderPriorityBadge(machinePriority);

        const multiProductStyle = isMultiProduct ? 'bg-purple-50' : '';
        const multiProductBadge = isMultiProduct
            ? `<span class="ml-1 px-1 py-0.5 text-[9px] font-bold bg-purple-200 text-purple-700 rounded">${currentIndex}/${productCount}</span>`
            : '';

        const machineDisplay = isMultiProduct && currentIndex === 1
            ? `${row.machine} <span class="text-purple-600 text-xs font-semibold">(Multi)</span>`
            : row.machine;

        return `
            <tr class="border-b border-gray-200 hover:bg-gray-100 ${multiProductStyle}">
                <td class="px-2 py-2 text-center font-bold text-gray-900 whitespace-nowrap border border-gray-300">${machineDisplay}</td>
                <td class="px-2 py-2 text-center border border-gray-300">${priorityBadge}</td>
                <td class="px-2 py-2 text-center border border-gray-300 ${cavidadesClass}" title="${cavTitle}">${cavidadesDisplay}</td>
                <td class="px-2 py-2 text-center border border-gray-300 ${cicloClass}" title="${cicloTitle}">${cicloDisplay}</td>
                <td class="px-2 py-2 text-center font-semibold border border-gray-300" style="background-color: ${statusColors.bg}; color: ${statusColors.text}; border-color: ${statusColors.border};">
                    ${statusColors.label}
                </td>
                <td class="px-2 py-2 text-left text-gray-700 whitespace-nowrap border border-gray-300">${row.cliente}</td>
                <td class="px-2 py-2 text-left text-gray-700 border border-gray-300">${row.produto}${multiProductBadge}</td>
                <td class="px-2 py-2 text-left border border-gray-300 ${row.status !== 'Produzindo' ? 'text-red-600 font-semibold' : 'text-gray-500'}">${row.motivoParada}</td>
                <td class="px-2 py-2 text-center border border-gray-300">${(() => {
                    const machId = (row.machine || '').toUpperCase().trim();
                    const count = queueCounts[machId] || 0;
                    if (count === 0) return '<span class="text-gray-300">-</span>';
                    const color = count >= 5 ? 'bg-red-100 text-red-700 border-red-200' : count >= 3 ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-blue-100 text-blue-700 border-blue-200';
                    return '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border ' + color + '">' + count + ' <span class="text-[9px] font-normal">OPs</span></span>';
                })()}</td>
                <td class="px-1 py-1 border border-gray-300">
                    <input type="text" 
                        class="w-full px-2 py-1 text-xs border border-gray-200 rounded focus:ring-1 focus:ring-blue-400 focus:border-blue-400 bg-white hover:bg-gray-50 transition placeholder-gray-300"
                        placeholder="Escrever obs..."
                        value="${escapeHtmlAttr(pcpObservationsCache[(row.machine || '').toUpperCase().trim()] || '')}"
                        data-machine="${(row.machine || '').toUpperCase().trim()}"
                        onchange="window.savePCPObservation(this.dataset.machine, this.value)"
                    />
                </td>
            </tr>
        `;
    }).join('');
}

// ─── Status Color (igual Dashboard TV) ──────────────

function getPCPStatusColor(status, motivoParada) {
    if (status === 'Produzindo') {
        return { bg: 'rgba(34, 197, 94, 0.3)', text: '#16A34A', border: '#22C55E', label: 'Produzindo' };
    }

    const reason = (motivoParada || '').toLowerCase();

    if (reason.includes('preparação') || reason.includes('preparacao') ||
        reason.includes('estufagem') || reason.includes('fora de cor') || reason.includes('teste de cor')) {
        return { bg: 'rgba(233, 30, 99, 0.25)', text: '#E91E63', border: '#E91E63', label: 'Preparação' };
    }
    if (reason.includes('setup') || reason.includes('instalação') || reason.includes('instalacao') ||
        reason.includes('retirada de molde') || reason.includes('aguardando setup')) {
        return { bg: 'rgba(3, 169, 244, 0.25)', text: '#03A9F4', border: '#03A9F4', label: 'Setup' };
    }
    if (reason.includes('compra') ||
        (reason.includes('falta') && (reason.includes('matéria') || reason.includes('materia') ||
            reason.includes('prima') || reason.includes('saco') || reason.includes('caixa') || reason.includes('master')))) {
        return { bg: 'rgba(121, 85, 72, 0.25)', text: '#795548', border: '#795548', label: 'Compras' };
    }
    if (reason.includes('ferramentaria') || reason.includes('corretiva de molde') ||
        reason.includes('preventiva de molde') || reason.includes('troca de versão') || reason.includes('versão')) {
        return { bg: 'rgba(255, 152, 0, 0.25)', text: '#FF9800', border: '#FF9800', label: 'Ferrament.' };
    }
    if (reason.includes('processo') || reason.includes('ajuste') || reason.includes('cavidade') ||
        reason.includes('try out') || reason.includes('prendendo')) {
        return { bg: 'rgba(156, 39, 176, 0.25)', text: '#9C27B0', border: '#9C27B0', label: 'Processo' };
    }
    if (reason.includes('manutenção') || reason.includes('manutencao') || reason.includes('maintenance')) {
        return { bg: 'rgba(255, 235, 59, 0.3)', text: '#F59E0B', border: '#FFEB3B', label: 'Manutenção' };
    }
    if (reason.includes('qualidade') || reason.includes('liberação') || reason.includes('aguardando cliente') ||
        reason.includes('aguardando fornecedor') || reason.includes('disposição')) {
        return { bg: 'rgba(244, 67, 54, 0.25)', text: '#F44336', border: '#F44336', label: 'Qualidade' };
    }
    if (reason.includes('operador') || reason.includes('troca de cor') ||
        reason.includes('revezamento') || reason.includes('almoço') || reason.includes('janta') ||
        reason.includes('inicio') || reason.includes('reinicio')) {
        return { bg: 'rgba(187, 247, 208, 0.5)', text: '#064e3b', border: '#86EFAC', label: 'Produção' };
    }
    if (reason.includes('comercial') || reason.includes('sem pedido')) {
        return { bg: 'rgba(97, 97, 97, 0.3)', text: '#616161', border: '#616161', label: 'Comercial' };
    }
    if (reason.includes('pcp') || reason.includes('estratégia') || reason.includes('estrategia') ||
        reason.includes('sem programação') || reason.includes('sem programacao')) {
        return { bg: 'rgba(33, 33, 33, 0.8)', text: '#BDBDBD', border: '#212121', label: 'PCP' };
    }
    if (reason.includes('energia') || reason.includes('falta de água') || reason.includes('queda') || reason.includes('análise administrativa')) {
        return { bg: 'rgba(158, 158, 158, 0.3)', text: '#424242', border: '#9E9E9E', label: 'Admin.' };
    }

    return { bg: 'rgba(120, 144, 156, 0.25)', text: '#78909C', border: '#78909C', label: 'Outros' };
}

// ─── Excel Export ───────────────────────────────────

function exportPCPToExcel() {
    const table = document.getElementById('pcp-table');
    if (!table) { alert('Tabela não encontrada!'); return; }

    const date = document.getElementById('pcp-date-selector')?.value || getPCPProductionDateString();
    const shiftFilter = document.getElementById('pcp-shift-selector')?.value || 'current';

    let shiftName = 'Atual';
    if (shiftFilter === 'all') shiftName = 'Todos';
    else if (shiftFilter === '1') shiftName = 'T1';
    else if (shiftFilter === '2') shiftName = 'T2';
    else if (shiftFilter === '3') shiftName = 'T3';
    else if (shiftFilter === 'current') shiftName = `T${getCurrentShift()}`;

    const totalMachines = document.getElementById('pcp-kpi-machines')?.textContent || '0';
    const producingMachines = document.getElementById('pcp-kpi-producing')?.textContent || '0';
    const stoppedMachines = document.getElementById('pcp-kpi-stopped')?.textContent || '0';

    let html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
        <meta charset="UTF-8">
        <!--[if gte mso 9]>
        <xml>
            <x:ExcelWorkbook>
                <x:ExcelWorksheets>
                    <x:ExcelWorksheet>
                        <x:Name>PCP Dashboard</x:Name>
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
            th, td { border: 1px solid #333; padding: 8px; text-align: center; }
            th { background-color: #334155; color: white; font-weight: bold; }
            .title { font-size: 16px; font-weight: bold; background-color: #1e293b; color: white; }
            .kpi-header { background-color: #f1f5f9; font-weight: bold; }
            .kpi-value { font-weight: bold; }
            .kpi-machines { color: #2563eb; }
            .kpi-producing { color: #16a34a; }
            .kpi-stopped { color: #dc2626; }
            .text-left { text-align: left; }
            .text-red { color: #dc2626; font-weight: bold; }
            .text-green { color: #16a34a; font-weight: bold; }
            .text-amber { color: #d97706; font-weight: bold; }
        </style>
    </head>
    <body>
        <table>
            <tr>
                <td colspan="10" class="title">PCP Dashboard - Produção | Data: ${date} | Turno: ${shiftName}</td>
            </tr>
            <tr>
                <td colspan="3" class="kpi-header">Máquinas Planejadas</td>
                <td colspan="3" class="kpi-header">Produzindo</td>
                <td colspan="4" class="kpi-header">Paradas</td>
            </tr>
            <tr>
                <td colspan="3" class="kpi-value kpi-machines">${totalMachines}</td>
                <td colspan="3" class="kpi-value kpi-producing">${producingMachines}</td>
                <td colspan="4" class="kpi-value kpi-stopped">${stoppedMachines}</td>
            </tr>
            <tr><td colspan="10"></td></tr>
            <tr>
                <th>Máquina</th>
                <th>Prioridade</th>
                <th>Cavidade</th>
                <th>Ciclo (s)</th>
                <th>Status</th>
                <th>Cliente</th>
                <th>Produto</th>
                <th>Motivo Parada</th>
                <th>Fila</th>
                <th>Observação</th>
            </tr>`;

    const tbody = table.querySelector('tbody');
    if (tbody) {
        const trs = tbody.querySelectorAll('tr');
        trs.forEach(tr => {
            const tds = tr.querySelectorAll('td');
            if (tds.length >= 8) {
                const maquina = tds[0].textContent.trim();
                const prioridade = tds[1].textContent.trim();
                const cavidade = tds[2].textContent.trim();
                const ciclo = tds[3].textContent.trim();
                const statusCell = tds[4];
                const statusText = statusCell.textContent.trim();
                const cliente = tds[5].textContent.trim();
                const produto = tds[6].textContent.trim();
                const motivoParada = tds[7].textContent.trim();

                const fila = tds[8] ? tds[8].textContent.trim().replace('OPs', '').trim() : '-';
                const observacaoInput = tds[9] ? tds[9].querySelector('input') : null;
                const observacao = observacaoInput ? observacaoInput.value.trim() : (tds[9] ? tds[9].textContent.trim() : '');

                const bgColor = statusCell.style.backgroundColor || 'transparent';
                const textColor = statusCell.style.color || '#000';

                const cavClass = tds[2].classList.contains('text-red-600') ? 'text-red' :
                    tds[2].classList.contains('text-green-600') ? 'text-green' : '';
                const cicloClass = tds[3].classList.contains('text-red-600') ? 'text-red' :
                    tds[3].classList.contains('text-amber-600') ? 'text-amber' :
                    tds[3].classList.contains('text-green-600') ? 'text-green' : '';

                const prioridadeNum = parseInt(prioridade);
                let prioridadeStyle = '';
                if (prioridadeNum === 0) prioridadeStyle = 'background-color: #FEE2E2; color: #B91C1C; font-weight: bold;';
                else if (prioridadeNum === 1) prioridadeStyle = 'background-color: #FFEDD5; color: #C2410C; font-weight: bold;';
                else if (prioridadeNum === 2) prioridadeStyle = 'background-color: #FEF3C7; color: #B45309; font-weight: bold;';
                else if (prioridadeNum === 3) prioridadeStyle = 'background-color: #FEF9C3; color: #A16207; font-weight: bold;';
                else if (prioridadeNum === 4) prioridadeStyle = 'background-color: #ECFCCB; color: #65A30D;';
                else if (prioridadeNum === 5) prioridadeStyle = 'background-color: #F3F4F6; color: #6B7280;';

                const motivoClass = tds[7].classList.contains('text-red-600') ? 'text-red' : '';

                html += `
            <tr>
                <td style="font-weight: bold;">${maquina}</td>
                <td style="${prioridadeStyle}">${prioridade || '-'}</td>
                <td class="${cavClass}">${cavidade}</td>
                <td class="${cicloClass}">${ciclo}</td>
                <td style="background-color: ${bgColor}; color: ${textColor}; font-weight: bold;">${statusText}</td>
                <td class="text-left">${cliente}</td>
                <td class="text-left">${produto}</td>
                <td class="text-left ${motivoClass}">${motivoParada}</td>
                <td style="text-align: center;">${fila}</td>
                <td class="text-left">${observacao}</td>
            </tr>`;
            }
        });
    }

    html += `
        </table>
        <br/>
        <table>
            <tr><td colspan="10" style="font-size: 10px; color: #666;">Legenda de Status:</td></tr>
            <tr>
                <td style="background-color: rgba(34, 197, 94, 0.3); color: #16A34A; font-weight: bold;">Produzindo</td>
                <td style="background-color: rgba(233, 30, 99, 0.25); color: #E91E63; font-weight: bold;">Preparação</td>
                <td style="background-color: rgba(3, 169, 244, 0.25); color: #03A9F4; font-weight: bold;">Setup</td>
                <td style="background-color: rgba(255, 152, 0, 0.25); color: #FF9800; font-weight: bold;">Ferramentaria</td>
                <td style="background-color: rgba(156, 39, 176, 0.25); color: #9C27B0; font-weight: bold;">Processo</td>
                <td style="background-color: rgba(255, 235, 59, 0.3); color: #F59E0B; font-weight: bold;">Manutenção</td>
                <td style="background-color: rgba(244, 67, 54, 0.25); color: #F44336; font-weight: bold;">Qualidade</td>
                <td></td>
            </tr>
            <tr>
                <td style="background-color: rgba(187, 247, 208, 0.5); color: #064e3b; font-weight: bold;">Produção</td>
                <td style="background-color: rgba(121, 85, 72, 0.25); color: #795548; font-weight: bold;">Compras</td>
                <td style="background-color: rgba(97, 97, 97, 0.3); color: #616161; font-weight: bold;">Comercial</td>
                <td style="background-color: rgba(33, 33, 33, 0.8); color: #BDBDBD; font-weight: bold;">PCP</td>
                <td style="background-color: rgba(158, 158, 158, 0.3); color: #424242; font-weight: bold;">Admin.</td>
                <td style="background-color: rgba(120, 144, 156, 0.25); color: #78909C; font-weight: bold;">Outros</td>
                <td colspan="4"></td>
            </tr>
        </table>
        <br/>
        <table>
            <tr><td colspan="10" style="font-size: 10px; color: #666;">Legenda de Prioridade:</td></tr>
            <tr>
                <td style="background-color: #FEE2E2; color: #B91C1C; font-weight: bold;">5 - Urgência Máxima</td>
                <td style="background-color: #FFEDD5; color: #C2410C; font-weight: bold;">4 - Alta</td>
                <td style="background-color: #FEF3C7; color: #B45309; font-weight: bold;">3 - Média</td>
                <td style="background-color: #FEF9C3; color: #A16207; font-weight: bold;">2 - Baixa</td>
                <td style="background-color: #F3F4F6; color: #4B5563;">1 - Mínima</td>
                <td style="color: #9CA3AF;">0 - Sem prioridade</td>
                <td colspan="4"></td>
            </tr>
        </table>
        <br/>
        <p style="font-size: 10px; color: #666;">Exportado em: ${new Date().toLocaleString('pt-BR')}</p>
    </body>
    </html>`;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `PCP_Dashboard_${date}_${shiftName}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    console.log('[PCP·mod] Excel exportado com formatação:', `PCP_Dashboard_${date}_${shiftName}.xls`);
}

// ─── Entry Point ────────────────────────────────────

/**
 * Inicializa a página PCP.
 * Substituição direta de setupPCPPage() do script.js.
 */
export function setupPCPPage() {
    if (pcpState.initialized) {
        console.debug('[PCP·mod] Já inicializado — recarregando dados');
        const shiftFilter = document.getElementById('pcp-shift-selector')?.value || 'current';
        loadPCPData(pcpState.currentDate || getPCPProductionDateString(), shiftFilter);
        return;
    }
    console.log('[PCP·mod] Inicializando página de Planejamento e Controle da Produção...');

    try {
        const user = window.authSystem?.getCurrentUser?.();
        const allowedUsers = ['leandro camargo', 'roberto fernandes', 'elaine', 'daniel rocha'];
        const userNameLower = (user?.name || '').toLowerCase().trim();

        if (!allowedUsers.includes(userNameLower)) {
            console.warn('[PCP·mod] Acesso não autorizado para este usuário');
            return;
        }

        setupPCPSubTabs();

        const dateSelector = document.getElementById('pcp-date-selector');
        if (dateSelector) {
            const today = getPCPProductionDateString();
            dateSelector.value = today;
            pcpState.currentDate = today;
            dateSelector.addEventListener('change', (e) => {
                pcpState.currentDate = e.target.value;
                const shiftFilter = document.getElementById('pcp-shift-selector')?.value || 'current';
                loadPCPData(e.target.value, shiftFilter);
            });
        }

        const shiftSelector = document.getElementById('pcp-shift-selector');
        if (shiftSelector) {
            pcpState.currentShift = 'current';
            shiftSelector.addEventListener('change', (e) => {
                pcpState.currentShift = e.target.value;
                const date = document.getElementById('pcp-date-selector')?.value || getPCPProductionDateString();
                loadPCPData(date, e.target.value);
            });
        }

        const btnRefresh = document.getElementById('btn-pcp-refresh');
        if (btnRefresh) {
            btnRefresh.addEventListener('click', () => {
                console.log('[PCP·mod] Atualizando dados...');
                const date = document.getElementById('pcp-date-selector')?.value || getPCPProductionDateString();
                const shiftFilter = document.getElementById('pcp-shift-selector')?.value || 'current';
                loadPCPData(date, shiftFilter);
            });
        }

        const btnExportExcel = document.getElementById('btn-pcp-export-excel');
        if (btnExportExcel) {
            btnExportExcel.addEventListener('click', () => {
                console.log('[PCP·mod] Exportando para Excel...');
                exportPCPToExcel();
            });
        }

        const btnPriority = document.getElementById('btn-pcp-priority');
        if (btnPriority) {
            btnPriority.addEventListener('click', () => openPCPPriorityModal());
        }

        setupPCPPriorityModal();
        loadMachinePriorities();

        if (window.machineSchedule && typeof window.machineSchedule.init === 'function') {
            window.machineSchedule.init();
            console.log('[PCP·mod] Agendamento Semanal inicializado.');
        } else {
            console.warn('[PCP·mod] Módulo machineSchedule não encontrado.');
        }

        if (typeof lucide !== 'undefined') lucide.createIcons();

        const initialShiftFilter = document.getElementById('pcp-shift-selector')?.value || 'current';
        loadPCPData(pcpState.currentDate || getPCPProductionDateString(), initialShiftFilter);

        pcpState.initialized = true;

        // Expor savePCPObservation globalmente (usado no onclick inline do input)
        window.savePCPObservation = savePCPObservation;

        EventBus.emit('pcp:initialized');
        console.log('[PCP·mod] Página inicializada com sucesso!');
    } catch (e) {
        console.error('[PCP·mod] Erro ao inicializar página:', e);
    }
}
