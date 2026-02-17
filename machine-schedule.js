// =====================================================================
// ============ AGENDAMENTO SEMANAL DE MÁQUINAS ========================
// =====================================================================

(function() {
    'use strict';

    // ============ ESTADO DO AGENDAMENTO ============
    const scheduleState = {
        initialized: false,
        expanded: false,
        currentWeekStart: null, // Date (segunda-feira)
        scheduleData: {},       // { 'YYYY-MM-DD': { 'H01': true, 'H02': false, ... } }
        isDirty: false,
        saving: false,
        cache: {},              // Cache para getMachineScheduleForDate
        cacheExpiry: {}         // TTL do cache
    };

    // Constantes
    const DAYS_PT = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
    const DAYS_IDS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'];
    const CACHE_TTL = 30000; // 30 segundos

    // ============ UTILITÁRIOS DE DATA ============

    /**
     * Retorna a segunda-feira da semana de uma data
     */
    function getMonday(d) {
        const date = new Date(d);
        const day = date.getDay();
        const diff = date.getDate() - day + (day === 0 ? -6 : 1);
        date.setDate(diff);
        date.setHours(0, 0, 0, 0);
        return date;
    }

    /**
     * Formata data como YYYY-MM-DD
     */
    function formatDateISO(d) {
        const date = new Date(d);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    /**
     * Formata data como DD/MM
     */
    function formatDateBR(d) {
        const date = new Date(d);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        return `${day}/${month}`;
    }

    /**
     * Formata data como DD/MM/YYYY
     */
    function formatDateBRFull(d) {
        const date = new Date(d);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    }

    /**
     * Obtém array com as 7 datas da semana a partir de segunda
     */
    function getWeekDates(monday) {
        const dates = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(monday);
            d.setDate(d.getDate() + i);
            dates.push(d);
        }
        return dates;
    }

    /**
     * Gera ID do documento Firestore: "week_YYYY-MM-DD" usando a segunda-feira
     */
    function getWeekDocId(monday) {
        return `week_${formatDateISO(monday)}`;
    }

    // ============ OBTER LISTA DE MÁQUINAS ============
    function getScheduleMachines() {
        // Usar machineDatabase do database.js
        if (typeof machineDatabase !== 'undefined' && Array.isArray(machineDatabase)) {
            return machineDatabase.map(m => ({
                id: m.id,
                model: m.model
            }));
        }
        // Fallback hardcoded
        console.warn('[SCHEDULE] machineDatabase não encontrado, usando fallback');
        return [
            { id: 'H01', model: 'SANDRETTO OTTO' }, { id: 'H02', model: 'SANDRETTO SERIE 200' },
            { id: 'H03', model: 'LS LTE280' }, { id: 'H04', model: 'LS LTE 330' },
            { id: 'H05', model: 'LS LTE 170' }, { id: 'H06', model: 'HAITIAN MA2000' },
            { id: 'H07', model: 'CHEN HSONG JM 178 A' }, { id: 'H08', model: 'REED 200 TG II' },
            { id: 'H09', model: 'REED 200 TG II' }, { id: 'H10', model: 'HAITIAN MA 3200' },
            { id: 'H12', model: 'BORCHE BH 120' }, { id: 'H13', model: 'HAITIAN MA 2000 770G' },
            { id: 'H14', model: 'SANDRETTO SB UNO' }, { id: 'H15', model: 'ROMI EN 260 CM 10' },
            { id: 'H16', model: 'HAITIAN MA 2000 III' }, { id: 'H17', model: 'ROMI EN 260 CM 10' },
            { id: 'H18', model: 'HAITIAN MA 2000 III' }, { id: 'H19', model: 'HAITIAN MA 2000 III' },
            { id: 'H20', model: 'HAITIAN PL 200J' }, { id: 'H26', model: 'ROMI PRIMAX CM9' },
            { id: 'H27', model: 'ROMI PRIMAX CM8' }, { id: 'H28', model: 'ROMI PRIMAX CM8' },
            { id: 'H29', model: 'ROMI PRIMAX CM8' }, { id: 'H30', model: 'ROMI PRIMAX CM8' },
            { id: 'H31', model: 'ROMI PRÁTICA CM8' }, { id: 'H32', model: 'ROMI PRÁTICA CM8' }
        ];
    }

    // ============ FIRESTORE: CARREGAR SEMANA ============
    async function loadWeekSchedule(monday) {
        const docId = getWeekDocId(monday);
        console.log('[SCHEDULE] Carregando semana:', docId);

        try {
            const doc = await db.collection('machine_schedule').doc(docId).get();

            if (doc.exists) {
                const data = doc.data();
                scheduleState.scheduleData = data.schedule || {};
                const savedBy = data.updatedBy || data.createdBy || 'Desconhecido';
                const savedAt = data.updatedAt?.toDate?.() || data.createdAt?.toDate?.();
                const savedText = savedAt
                    ? `Último salvamento: ${formatDateBRFull(savedAt)} às ${savedAt.toLocaleTimeString('pt-BR')} por ${savedBy}`
                    : `Salvo por ${savedBy}`;

                const el = document.getElementById('schedule-last-saved');
                if (el) {
                    el.innerHTML = `<i data-lucide="check-circle" class="w-3 h-3 inline mr-1 text-green-500"></i> ${savedText}`;
                }
                console.log('[SCHEDULE] Dados carregados:', Object.keys(scheduleState.scheduleData).length, 'dias');
            } else {
                scheduleState.scheduleData = {};
                const el = document.getElementById('schedule-last-saved');
                if (el) {
                    el.innerHTML = `<i data-lucide="info" class="w-3 h-3 inline mr-1"></i> Nenhum agendamento salvo para esta semana`;
                }
                console.log('[SCHEDULE] Nenhum agendamento encontrado para:', docId);
            }

            scheduleState.isDirty = false;
            // Invalidar cache para esta semana
            const weekDates = getWeekDates(monday);
            weekDates.forEach(d => {
                const key = formatDateISO(d);
                delete scheduleState.cache[key];
                delete scheduleState.cacheExpiry[key];
            });

        } catch (error) {
            console.error('[SCHEDULE] Erro ao carregar semana:', error);
            scheduleState.scheduleData = {};
            const el = document.getElementById('schedule-last-saved');
            if (el) {
                el.innerHTML = `<i data-lucide="alert-circle" class="w-3 h-3 inline mr-1 text-red-500"></i> Erro ao carregar: ${error.message}`;
            }
        }
    }

    // ============ FIRESTORE: SALVAR SEMANA ============
    async function saveWeekSchedule() {
        if (scheduleState.saving) return;

        const monday = scheduleState.currentWeekStart;
        const docId = getWeekDocId(monday);
        const user = window.authSystem?.getCurrentUser?.();
        const userName = user?.name || 'Sistema';

        console.log('[SCHEDULE] Salvando semana:', docId);
        scheduleState.saving = true;

        const statusEl = document.getElementById('schedule-save-status');
        const saveBtn = document.getElementById('btn-schedule-save');

        if (statusEl) {
            statusEl.classList.remove('hidden');
            statusEl.className = 'text-xs font-semibold text-amber-600';
            statusEl.textContent = '⏳ Salvando...';
        }
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i> Salvando...';
        }

        try {
            await db.collection('machine_schedule').doc(docId).set({
                weekStart: formatDateISO(monday),
                schedule: scheduleState.scheduleData,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedBy: userName,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                createdBy: userName
            }, { merge: true });

            scheduleState.isDirty = false;

            // Invalidar cache
            const weekDates = getWeekDates(monday);
            weekDates.forEach(d => {
                const key = formatDateISO(d);
                delete scheduleState.cache[key];
                delete scheduleState.cacheExpiry[key];
            });

            const now = new Date();
            const el = document.getElementById('schedule-last-saved');
            if (el) {
                el.innerHTML = `<i data-lucide="check-circle" class="w-3 h-3 inline mr-1 text-green-500"></i> Salvo em ${formatDateBRFull(now)} às ${now.toLocaleTimeString('pt-BR')} por ${userName}`;
            }

            if (statusEl) {
                statusEl.className = 'text-xs font-semibold text-green-600';
                statusEl.textContent = '✅ Salvo com sucesso!';
                setTimeout(() => { statusEl.classList.add('hidden'); }, 3000);
            }

            console.log('[SCHEDULE] Semana salva com sucesso!');

            // Recriar ícones lucide
            if (typeof lucide !== 'undefined') lucide.createIcons();

        } catch (error) {
            console.error('[SCHEDULE] Erro ao salvar:', error);
            if (statusEl) {
                statusEl.className = 'text-xs font-semibold text-red-600';
                statusEl.textContent = `❌ Erro: ${error.message}`;
            }
        } finally {
            scheduleState.saving = false;
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i data-lucide="save" class="w-3.5 h-3.5"></i> Salvar Semana';
                if (typeof lucide !== 'undefined') lucide.createIcons();
            }
        }
    }

    // ============ COPIAR SEMANA ANTERIOR ============
    async function copyPreviousWeek() {
        const prevMonday = new Date(scheduleState.currentWeekStart);
        prevMonday.setDate(prevMonday.getDate() - 7);

        const docId = getWeekDocId(prevMonday);
        console.log('[SCHEDULE] Copiando semana anterior:', docId);

        try {
            const doc = await db.collection('machine_schedule').doc(docId).get();

            if (!doc.exists) {
                alert('Não há agendamento salvo na semana anterior para copiar.');
                return;
            }

            const prevData = doc.data().schedule || {};
            const prevDates = getWeekDates(prevMonday);
            const currentDates = getWeekDates(scheduleState.currentWeekStart);
            const machines = getScheduleMachines();

            // Mapear: para cada dia da semana anterior, copiar o estado para o dia correspondente da semana atual
            for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
                const prevDateKey = formatDateISO(prevDates[dayIndex]);
                const currDateKey = formatDateISO(currentDates[dayIndex]);

                if (prevData[prevDateKey]) {
                    scheduleState.scheduleData[currDateKey] = {};
                    machines.forEach(m => {
                        scheduleState.scheduleData[currDateKey][m.id] = prevData[prevDateKey][m.id] || false;
                    });
                }
            }

            scheduleState.isDirty = true;
            renderScheduleGrid();
            updateScheduleKPIs();

            const statusEl = document.getElementById('schedule-save-status');
            if (statusEl) {
                statusEl.classList.remove('hidden');
                statusEl.className = 'text-xs font-semibold text-indigo-600';
                statusEl.textContent = '📋 Semana anterior copiada! Clique em "Salvar Semana" para confirmar.';
                setTimeout(() => { statusEl.classList.add('hidden'); }, 5000);
            }

            console.log('[SCHEDULE] Semana anterior copiada com sucesso!');

        } catch (error) {
            console.error('[SCHEDULE] Erro ao copiar semana anterior:', error);
            alert('Erro ao copiar semana anterior: ' + error.message);
        }
    }

    // ============ RENDERIZAR GRID ============
    function renderScheduleGrid() {
        const tbody = document.getElementById('schedule-grid-body');
        if (!tbody) return;

        const machines = getScheduleMachines();
        const weekDates = getWeekDates(scheduleState.currentWeekStart);

        // Atualizar cabeçalho com datas
        weekDates.forEach((date, i) => {
            const dateSpan = document.querySelector(`.schedule-day-date[data-day="${i}"]`);
            if (dateSpan) {
                dateSpan.textContent = formatDateBR(date);
            }
        });

        // Atualizar label da semana
        const weekLabel = document.getElementById('schedule-week-label');
        const weekRange = document.getElementById('schedule-week-range');
        if (weekLabel) {
            // Calcular número da semana
            const oneJan = new Date(weekDates[0].getFullYear(), 0, 1);
            const weekNum = Math.ceil(((weekDates[0] - oneJan) / 86400000 + oneJan.getDay() + 1) / 7);
            weekLabel.textContent = `Semana ${weekNum}`;
        }
        if (weekRange) {
            weekRange.textContent = `${formatDateBRFull(weekDates[0])} a ${formatDateBRFull(weekDates[6])}`;
        }

        // Verificar se hoje está na semana exibida
        const today = formatDateISO(new Date());

        // Renderizar linhas
        let html = '';
        machines.forEach((machine, mIdx) => {
            const rowBg = mIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50';

            html += `<tr class="${rowBg} hover:bg-teal-50/50 transition-colors border-b border-gray-100">`;

            // Coluna máquina
            html += `<td class="px-3 py-2 sticky left-0 ${rowBg} z-10 border-r border-gray-100">
                        <div class="flex items-center gap-2">
                            <span class="text-xs font-bold text-gray-800">${machine.id}</span>
                            <span class="text-[10px] text-gray-400 hidden sm:inline truncate max-w-[90px]" title="${machine.model}">${machine.model}</span>
                        </div>
                     </td>`;

            // Colunas dos dias
            let machineTotal = 0;
            weekDates.forEach((date, dayIndex) => {
                const dateKey = formatDateISO(date);
                const isActive = scheduleState.scheduleData[dateKey]?.[machine.id] || false;
                const isToday = dateKey === today;
                const isWeekend = dayIndex >= 5;

                if (isActive) machineTotal++;

                let cellBg = '';
                if (isToday) cellBg = 'bg-teal-50';
                else if (isWeekend && dayIndex === 5) cellBg = 'bg-blue-50/30';
                else if (isWeekend && dayIndex === 6) cellBg = 'bg-red-50/30';

                const checkedAttr = isActive ? 'checked' : '';
                const activeClass = isActive ? 'border-teal-500 bg-teal-100' : 'border-gray-300 bg-white';

                html += `<td class="text-center px-2 py-1.5 ${cellBg}">
                            <label class="inline-flex items-center justify-center cursor-pointer">
                                <input type="checkbox" 
                                       class="schedule-checkbox w-5 h-5 rounded border-2 ${activeClass} text-teal-600 focus:ring-teal-500 focus:ring-2 cursor-pointer transition-all"
                                       data-machine="${machine.id}" 
                                       data-date="${dateKey}" 
                                       data-day="${dayIndex}"
                                       ${checkedAttr}>
                            </label>
                         </td>`;
            });

            // Coluna total
            const totalColor = machineTotal === 7 ? 'text-emerald-600' :
                               machineTotal === 0 ? 'text-red-400' :
                               machineTotal >= 5 ? 'text-teal-600' : 'text-amber-600';

            html += `<td class="text-center px-2 py-1.5 border-l border-gray-100">
                        <span class="text-xs font-bold ${totalColor}" id="schedule-row-total-${machine.id}">${machineTotal}/7</span>
                     </td>`;

            html += '</tr>';
        });

        tbody.innerHTML = html;

        // Adicionar event listeners aos checkboxes
        tbody.querySelectorAll('.schedule-checkbox').forEach(cb => {
            cb.addEventListener('change', (e) => {
                const machineId = e.target.dataset.machine;
                const dateKey = e.target.dataset.date;
                const checked = e.target.checked;

                // Atualizar estado
                if (!scheduleState.scheduleData[dateKey]) {
                    scheduleState.scheduleData[dateKey] = {};
                }
                scheduleState.scheduleData[dateKey][machineId] = checked;
                scheduleState.isDirty = true;

                // Atualizar visual do checkbox
                if (checked) {
                    e.target.classList.remove('border-gray-300', 'bg-white');
                    e.target.classList.add('border-teal-500', 'bg-teal-100');
                } else {
                    e.target.classList.remove('border-teal-500', 'bg-teal-100');
                    e.target.classList.add('border-gray-300', 'bg-white');
                }

                // Atualizar totais
                updateScheduleTotals();
                updateScheduleKPIs();
                updateRowTotal(machineId);
            });
        });

        // Atualizar totais
        updateScheduleTotals();
        updateScheduleKPIs();

        // Recriar ícones
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    // ============ ATUALIZAR TOTAL POR LINHA (MÁQUINA) ============
    function updateRowTotal(machineId) {
        const weekDates = getWeekDates(scheduleState.currentWeekStart);
        let total = 0;
        weekDates.forEach(d => {
            const key = formatDateISO(d);
            if (scheduleState.scheduleData[key]?.[machineId]) total++;
        });

        const el = document.getElementById(`schedule-row-total-${machineId}`);
        if (el) {
            el.textContent = `${total}/7`;
            el.className = 'text-xs font-bold ' + (
                total === 7 ? 'text-emerald-600' :
                total === 0 ? 'text-red-400' :
                total >= 5 ? 'text-teal-600' : 'text-amber-600'
            );
        }
    }

    // ============ ATUALIZAR TOTAIS POR COLUNA ============
    function updateScheduleTotals() {
        const machines = getScheduleMachines();
        const weekDates = getWeekDates(scheduleState.currentWeekStart);
        let weekTotal = 0;

        weekDates.forEach((date, i) => {
            const dateKey = formatDateISO(date);
            let dayCount = 0;

            machines.forEach(m => {
                if (scheduleState.scheduleData[dateKey]?.[m.id]) dayCount++;
            });

            const el = document.getElementById(`schedule-total-${DAYS_IDS[i]}`);
            if (el) el.textContent = dayCount;

            weekTotal += dayCount;
        });

        const weekEl = document.getElementById('schedule-total-week');
        if (weekEl) weekEl.textContent = weekTotal;
    }

    // ============ ATUALIZAR KPIs DO AGENDAMENTO ============
    function updateScheduleKPIs() {
        const machines = getScheduleMachines();
        const weekDates = getWeekDates(scheduleState.currentWeekStart);
        const today = formatDateISO(new Date());

        // Total máquinas
        const totalEl = document.getElementById('schedule-kpi-total');
        if (totalEl) totalEl.textContent = machines.length;

        // Agendadas hoje
        let todayCount = 0;
        machines.forEach(m => {
            if (scheduleState.scheduleData[today]?.[m.id]) todayCount++;
        });
        const todayEl = document.getElementById('schedule-kpi-today');
        if (todayEl) todayEl.textContent = todayCount;

        // Média da semana
        let totalScheduled = 0;
        let activeDays = 0;
        weekDates.forEach(d => {
            const key = formatDateISO(d);
            let dayCount = 0;
            machines.forEach(m => {
                if (scheduleState.scheduleData[key]?.[m.id]) dayCount++;
            });
            totalScheduled += dayCount;
            if (dayCount > 0) activeDays++;
        });
        const avg = activeDays > 0 ? Math.round(totalScheduled / activeDays) : 0;
        const avgEl = document.getElementById('schedule-kpi-avg');
        if (avgEl) avgEl.textContent = avg;

        // Utilização (máquinas·dia agendadas / máquinas·dia possíveis)
        const maxPossible = machines.length * 7;
        const usage = maxPossible > 0 ? Math.round((totalScheduled / maxPossible) * 100) : 0;
        const usageEl = document.getElementById('schedule-kpi-usage');
        if (usageEl) usageEl.textContent = `${usage}%`;
    }

    // ============ MARCAR/DESMARCAR TUDO ============
    function setAllSchedule(value) {
        const machines = getScheduleMachines();
        const weekDates = getWeekDates(scheduleState.currentWeekStart);

        weekDates.forEach(d => {
            const key = formatDateISO(d);
            if (!scheduleState.scheduleData[key]) scheduleState.scheduleData[key] = {};
            machines.forEach(m => {
                scheduleState.scheduleData[key][m.id] = value;
            });
        });

        scheduleState.isDirty = true;
        renderScheduleGrid();
    }

    // ============ MARCAR/DESMARCAR COLUNA (DIA) ============
    function toggleColumn(dayIndex) {
        const machines = getScheduleMachines();
        const weekDates = getWeekDates(scheduleState.currentWeekStart);
        const dateKey = formatDateISO(weekDates[dayIndex]);

        if (!scheduleState.scheduleData[dateKey]) scheduleState.scheduleData[dateKey] = {};

        // Verificar se todos estão marcados
        const allChecked = machines.every(m => scheduleState.scheduleData[dateKey]?.[m.id]);
        const newValue = !allChecked;

        machines.forEach(m => {
            scheduleState.scheduleData[dateKey][m.id] = newValue;
        });

        scheduleState.isDirty = true;
        renderScheduleGrid();
    }

    // ============ NAVEGAR SEMANAS ============
    function navigateWeek(direction) {
        if (scheduleState.isDirty) {
            if (!confirm('Existem alterações não salvas. Deseja continuar e perder as alterações?')) {
                return;
            }
        }

        const monday = new Date(scheduleState.currentWeekStart);
        monday.setDate(monday.getDate() + (direction * 7));
        scheduleState.currentWeekStart = monday;

        loadAndRender();
    }

    function goToCurrentWeek() {
        if (scheduleState.isDirty) {
            if (!confirm('Existem alterações não salvas. Deseja continuar e perder as alterações?')) {
                return;
            }
        }

        scheduleState.currentWeekStart = getMonday(new Date());
        loadAndRender();
    }

    async function loadAndRender() {
        await loadWeekSchedule(scheduleState.currentWeekStart);
        renderScheduleGrid();
        updateScheduleKPIs();
    }

    // ============ INICIALIZAÇÃO ============
    function initMachineSchedule() {
        console.log('[SCHEDULE] Inicializando Agendamento Semanal...');

        // Navegação de semana
        const btnPrev = document.getElementById('btn-schedule-prev-week');
        const btnNext = document.getElementById('btn-schedule-next-week');
        const btnToday = document.getElementById('btn-schedule-today');

        if (btnPrev) btnPrev.addEventListener('click', () => navigateWeek(-1));
        if (btnNext) btnNext.addEventListener('click', () => navigateWeek(1));
        if (btnToday) btnToday.addEventListener('click', goToCurrentWeek);

        // Ações rápidas
        const btnCopyPrev = document.getElementById('btn-schedule-copy-prev');
        const btnSelectAll = document.getElementById('btn-schedule-select-all');
        const btnClearAll = document.getElementById('btn-schedule-clear-all');
        const btnSave = document.getElementById('btn-schedule-save');

        if (btnCopyPrev) btnCopyPrev.addEventListener('click', copyPreviousWeek);
        if (btnSelectAll) btnSelectAll.addEventListener('click', () => setAllSchedule(true));
        if (btnClearAll) btnClearAll.addEventListener('click', () => {
            if (confirm('Desmarcar todas as máquinas de todos os dias da semana?')) {
                setAllSchedule(false);
            }
        });
        if (btnSave) btnSave.addEventListener('click', saveWeekSchedule);

        // Botões de toggle de coluna (nos cabeçalhos)
        document.querySelectorAll('.schedule-col-toggle').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const dayIndex = parseInt(e.target.dataset.day);
                toggleColumn(dayIndex);
            });
        });

        // Auto-carregar dados da semana atual
        scheduleState.currentWeekStart = getMonday(new Date());
        loadAndRender();
        scheduleState.initialized = true;

        // Recriar ícones
        if (typeof lucide !== 'undefined') lucide.createIcons();

        console.log('[SCHEDULE] ✅ Agendamento Semanal inicializado!');
    }

    // ============ API PÚBLICA: getMachineScheduleForDate ============
    /**
     * Retorna se uma máquina está agendada para operar em determinada data
     * @param {string} machineId - Ex: 'H01'
     * @param {string|Date} date - Data no formato 'YYYY-MM-DD' ou objeto Date
     * @returns {Promise<{operational: boolean, scheduled: boolean}>}
     *   - operational: true se a máquina está agendada para trabalhar
     *   - scheduled: true se existe agendamento para aquela semana (false = sem dados)
     */
    async function getMachineScheduleForDate(machineId, date) {
        const dateStr = date instanceof Date ? formatDateISO(date) : date;

        // Verificar cache
        const cacheKey = dateStr;
        if (scheduleState.cache[cacheKey] && Date.now() < scheduleState.cacheExpiry[cacheKey]) {
            const dayData = scheduleState.cache[cacheKey];
            return {
                operational: dayData[machineId] || false,
                scheduled: true
            };
        }

        // Buscar do Firestore
        const monday = getMonday(new Date(dateStr + 'T12:00:00'));
        const docId = getWeekDocId(monday);

        try {
            const doc = await db.collection('machine_schedule').doc(docId).get();

            if (doc.exists) {
                const data = doc.data().schedule || {};

                // Cachear todos os dias da semana
                const weekDates = getWeekDates(monday);
                weekDates.forEach(d => {
                    const key = formatDateISO(d);
                    scheduleState.cache[key] = data[key] || {};
                    scheduleState.cacheExpiry[key] = Date.now() + CACHE_TTL;
                });

                const dayData = data[dateStr] || {};
                return {
                    operational: dayData[machineId] || false,
                    scheduled: true
                };
            } else {
                // Sem agendamento = todas operando (comportamento retrocompatível)
                return {
                    operational: true,
                    scheduled: false
                };
            }
        } catch (error) {
            console.error('[SCHEDULE] Erro ao consultar agendamento:', error);
            // Em caso de erro, assume operacional (não penalizar OEE)
            return {
                operational: true,
                scheduled: false
            };
        }
    }

    /**
     * Retorna TODAS as máquinas com status de agendamento para uma data
     * @param {string|Date} date - Data no formato 'YYYY-MM-DD' ou objeto Date
     * @returns {Promise<Object>} - { 'H01': true, 'H02': false, ... }
     */
    async function getAllMachinesScheduleForDate(date) {
        const dateStr = date instanceof Date ? formatDateISO(date) : date;
        const monday = getMonday(new Date(dateStr + 'T12:00:00'));
        const docId = getWeekDocId(monday);

        try {
            const doc = await db.collection('machine_schedule').doc(docId).get();

            if (doc.exists) {
                const data = doc.data().schedule || {};
                return data[dateStr] || {};
            } else {
                // Sem agendamento: retorna objeto vazio (caller decide o default)
                return {};
            }
        } catch (error) {
            console.error('[SCHEDULE] Erro ao consultar agendamento completo:', error);
            return {};
        }
    }

    // ============ EXPOR API GLOBAL ============
    window.machineSchedule = {
        init: initMachineSchedule,
        getMachineScheduleForDate: getMachineScheduleForDate,
        getAllMachinesScheduleForDate: getAllMachinesScheduleForDate,
        getState: () => scheduleState,
        _getMonday: getMonday,
        _loadAndRender: loadAndRender
    };

    // Expor função global para facilitar uso em outros módulos
    window.getMachineScheduleForDate = getMachineScheduleForDate;
    window.getAllMachinesScheduleForDate = getAllMachinesScheduleForDate;

    console.log('[SCHEDULE] Módulo de Agendamento Semanal carregado.');

})();
