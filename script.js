// Função global para fechar modais (disponível imediatamente)
// ============ CONFIGURAÇÃO DE MÁQUINAS ============
// Máquinas desativadas/retiradas de uso - não aparecem nos dashboards
const DISABLED_MACHINES = ['H11'];
// ====================================================

// FUNÇÃO GLOBAL: Forçar limpeza de parada para uma máquina específica
// Definida no topo do arquivo para garantir disponibilidade imediata no console
window.forceStopDowntime = async function(machineId) {
    if (!machineId) {
        console.error('Uso: forceStopDowntime("H06")');
        return;
    }
    if (!window.db) {
        console.error('Banco de dados não inicializado. Aguarde o carregamento completo da página.');
        return;
    }
    const mid = machineId.toUpperCase().trim();
    console.log('Forçando limpeza de paradas para máquina:', mid);
    let removedCount = 0;
    try {
        // 1. Remover de active_downtimes
        const doc1 = await window.db.collection('active_downtimes').doc(mid).get();
        if (doc1.exists) {
            await window.db.collection('active_downtimes').doc(mid).delete();
            console.log('  Removido de active_downtimes:', mid);
            removedCount++;
        } else {
            console.log('  Não encontrado em active_downtimes:', mid);
        }
        // 2. Remover de extended_downtime_logs com status active
        const snap = await window.db.collection('extended_downtime_logs')
            .where('status', '==', 'active').get();
        for (const doc of snap.docs) {
            const data = doc.data();
            const docMachine = (data.machine_id || data.machine || '').toUpperCase().trim();
            if (docMachine === mid) {
                await doc.ref.update({ 
                    status: 'inactive', 
                    end_date: new Date().toISOString().split('T')[0],
                    end_time: new Date().toTimeString().substring(0, 5),
                    force_stopped: true,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                console.log('  Finalizado em extended_downtime_logs:', doc.id);
                removedCount++;
            }
        }
        // 3. Invalidar caches
        if (typeof window.invalidateDowntimeCache === 'function') {
            window.invalidateDowntimeCache(mid);
        }
        if (window.DataStore) {
            window.DataStore.invalidate('activeDowntimes');
        }
        console.log('Limpeza concluída!', removedCount, 'registro(s) afetado(s). Recarregue a página (F5).');
    } catch (error) {
        console.error('Erro ao limpar paradas:', error);
    }
};

// FUNÇÃO GLOBAL: Excluir TODAS as paradas de um motivo específico

window.closeModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) {
        console.warn('[closeModal] Modal não encontrado:', modalId);
        return;
    }
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
    modal.removeAttribute('data-modal-open');
    
    // Limpar estilos aplicados pelo modalManager se existir
    if (window.__modalManager) {
        window.__modalManager.clearStyles(modal);
        const modalContent = modal.querySelector('.bg-white, .modal-content, [class*="bg-white"]');
        if (modalContent) {
            window.__modalManager.clearContentStyles(modalContent);
        }
    }
    
    // Limpar formulários associados ao modal fechado
    const form = modal.querySelector('form');
    if (form) form.reset();
    console.log('[closeModal] Modal fechado:', modalId);
};

// Popular o select de MP no cadastro de ordem de produção
document.addEventListener('DOMContentLoaded', async function() {
    // Aguardar database estar carregado (máximo 3 segundos)
    let attempts = 0;
    while (attempts < 30 && (typeof productDatabase === 'undefined' || !productDatabase || productDatabase.length === 0)) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
    }
    
    if (typeof productDatabase === 'undefined' || !productDatabase || productDatabase.length === 0) {
        console.error('[CRÍTICO] Database não carregado após 3 segundos!');
    } else {
        console.log(`[OK] Database carregado: ${productDatabase.length} produtos, productByCode size: ${productByCode?.size || 0}`);
    }
    
    // Ocultar subaba Analytics IA para todos, exceto usuários autorizados (Leandro Camargo, Davi Batista ou role 'suporte')
    setTimeout(() => {
        try {
            const user = window.authSystem?.getCurrentUser?.();
            const analyticsBtn = document.querySelector('.analysis-tab-btn[data-view="predictive"]');
            const isAuthorizedUser = user && (
                user.name === 'Leandro Camargo' || user.username === 'leandro.camargo' ||
                user.name === 'Davi Batista' || user.username === 'davi.batista' ||
                user.role === 'suporte'
            );
            if (analyticsBtn && !isAuthorizedUser) {
                analyticsBtn.style.display = 'none';
            }
            
            // Mostrar filtro de data no lançamento para Leandro Camargo, Davi Batista ou perfis de suporte
            const lancamentoDateFilter = document.getElementById('lancamento-date-filter');
            const isLeandro = user && (
                user.name === 'Leandro Camargo' || user.username === 'leandro.camargo' ||
                user.email === 'leandro@hokkaido.com.br'
            );
            const isDavi = user && (
                user.name === 'Davi Batista' || user.username === 'davi.batista' ||
                user.email === 'davi@hokkaido.com.br'
            );
            const isSuporte = user?.role === 'suporte';
            if (lancamentoDateFilter && (isLeandro || isDavi || isSuporte)) {
                lancamentoDateFilter.classList.remove('hidden');
                setupLancamentoDateFilter();
            }
            
            // Mostrar botão de Novo Produto apenas para usuários autorizados (gestores, suporte, Leandro ou Davi)
            const btnNewProduct = document.getElementById('btn-new-product');
            const isGestorOrAdmin = user && (
                user.name === 'Leandro Camargo' || user.username === 'leandro.camargo' ||
                user.email === 'leandro@hokkaido.com.br' ||
                user.name === 'Davi Batista' || user.username === 'davi.batista' ||
                user.email === 'davi@hokkaido.com.br' ||
                user.role === 'suporte' || user.role === 'gestor'
            );
            if (btnNewProduct && !isGestorOrAdmin) {
                btnNewProduct.style.display = 'none';
            }
            
            // Mostrar/ocultar aba PMP para usuários autorizados
            const pmpNavBtn = document.querySelector('[data-page="pmp"]');
            const allowedPMPUsers = ['leandro camargo', 'manaus silva', 'daniel rocha'];
            const userNameLower = (user?.name || '').toLowerCase().trim();
            const isAllowedForPMP = user && allowedPMPUsers.includes(userNameLower);
            
            // DEBUG: Log detalhado
            console.log('[PMP-DEBUG] Verificando acesso PMP:', {
                userName: user?.name,
                userNameLower: userNameLower,
                allowedPMPUsers: allowedPMPUsers,
                isAllowedForPMP: isAllowedForPMP
            });
            
            if (pmpNavBtn) {
                if (isAllowedForPMP) {
                    pmpNavBtn.style.display = '';  // Mostrar
                    console.log('✅ Aba PMP visível para ' + user.name);
                } else {
                    pmpNavBtn.style.display = 'none';  // Ocultar
                    console.log('🔒 Aba PMP oculta para usuário: ' + (user?.name || 'desconhecido'));
                }
            } else {
                console.warn('⚠️ Botão da aba PMP não encontrado no DOM');
            }
            
            // Mostrar/ocultar aba Dashboard TV para usuários autorizados
            const dashboardTVNavBtn = document.querySelector('[data-page="dashboard-tv"]');
            const allowedDashboardTVUsers = ['daniel rocha', 'linaldo', 'luciano'];
            const isAllowedForDashboardTV = user && (allowedDashboardTVUsers.includes(userNameLower) || 
               user.name === 'Leandro Camargo' || 
               user.email === 'leandro@hokkaido.com.br' ||
               user.name === 'Davi Batista' || 
               user.email === 'davi@hokkaido.com.br' ||
               user.role === 'lider');
            
            console.log('[DASHBOARD-TV-DEBUG] Verificando acesso Dashboard TV:', {
                userName: user?.name,
                userNameLower: userNameLower,
                allowedDashboardTVUsers: allowedDashboardTVUsers,
                isAllowedForDashboardTV: isAllowedForDashboardTV
            });
            
            if (dashboardTVNavBtn) {
                if (isAllowedForDashboardTV) {
                    dashboardTVNavBtn.style.display = '';  // Mostrar
                    console.log('✅ Aba Dashboard TV visível para ' + user.name);
                } else {
                    dashboardTVNavBtn.style.display = 'none';  // Ocultar
                    console.log('🔒 Aba Dashboard TV oculta para usuário: ' + (user?.name || 'desconhecido'));
                }
            } else {
                console.warn('⚠️ Botão da aba Dashboard TV não encontrado no DOM');
            }
            
            // Mostrar/ocultar subaba Relatórios (dentro de Análise) — baseado na permissão 'relatorios' ou role gestor/suporte/lider
            const reportsTabBtn = document.querySelector('.analysis-tab-btn[data-view="reports"]');
            const userPermissions = user && user.permissions ? user.permissions : [];
            const userRole = user && user.role ? user.role : '';
            const hasRelatoriosAccess = userPermissions.includes('relatorios') || 
                                        userRole === 'gestor' || userRole === 'suporte' || userRole === 'lider';
            
            if (reportsTabBtn) {
                if (hasRelatoriosAccess) {
                    reportsTabBtn.style.display = '';  // Mostrar
                    console.log('✅ Subaba Relatórios visível para ' + user.name);
                } else {
                    reportsTabBtn.style.display = 'none';  // Ocultar
                    console.log('🔒 Subaba Relatórios oculta para usuário: ' + (user?.name || 'desconhecido'));
                }
            }
            
            // Mostrar/ocultar aba Relatórios (página principal) — baseado na permissão 'relatorios' ou role gestor/suporte/lider
            const relatoriosNavBtn = document.querySelector('[data-page="relatorios"]');
            
            console.log('[RELATORIOS-DEBUG] Verificando acesso Relatórios:', {
                userName: user?.name,
                userNameLower: userNameLower,
                role: userRole,
                permissions: userPermissions,
                hasRelatoriosAccess: hasRelatoriosAccess
            });
            
            if (relatoriosNavBtn) {
                if (hasRelatoriosAccess) {
                    relatoriosNavBtn.style.display = '';  // Mostrar
                    console.log('✅ Aba Relatórios visível para ' + user.name);
                } else {
                    relatoriosNavBtn.style.display = 'none';  // Ocultar
                    console.log('🔒 Aba Relatórios oculta para usuário: ' + (user?.name || 'desconhecido'));
                }
            } else {
                console.warn('⚠️ Botão da aba Relatórios não encontrado no DOM');
            }
        } catch (e) {
            console.warn('Erro ao aplicar restrição da aba PMP:', e);
        }
    }, 300);
    
    // Configurar filtro de data do lançamento
    function setupLancamentoDateFilter() {
        const dateInput = document.getElementById('lancamento-date-input');
        const applyBtn = document.getElementById('lancamento-date-apply');
        const resetBtn = document.getElementById('lancamento-date-reset');
        const indicator = document.getElementById('lancamento-date-indicator');
        const dateLabel = document.getElementById('lancamento-date-label');
        
        if (!dateInput) return;
        
        // Definir data atual como padrão
        const today = new Date();
        const hour = today.getHours();
        const minute = today.getMinutes();
        if (hour < 6 || (hour === 6 && minute < 30)) today.setDate(today.getDate() - 1);
        const todayStr = today.toISOString().split('T')[0];
        dateInput.value = todayStr;
        
        // Variável global para data selecionada no lançamento
        window.lancamentoFilterDate = null;
        
        applyBtn?.addEventListener('click', () => {
            const selectedDate = dateInput.value;
            if (!selectedDate) return;
            
            window.lancamentoFilterDate = selectedDate;
            
            // Mostrar indicador
            if (indicator) indicator.classList.remove('hidden');
            if (dateLabel) {
                const dateObj = new Date(selectedDate + 'T12:00:00');
                const formatted = dateObj.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
                dateLabel.textContent = `Visualizando: ${formatted}`;
            }
            
            // Recarregar dados com a nova data
            if (typeof populateMachineSelector === 'function') {
                populateMachineSelector(selectedDate);
            }
            if (typeof loadTodayStats === 'function') {
                loadTodayStats(selectedDate);
            }
            if (typeof loadRecentEntries === 'function') {
                loadRecentEntries(false, selectedDate);
            }
            
            console.log('[FILTRO DATA] Aplicado:', selectedDate);
        });
        
        resetBtn?.addEventListener('click', () => {
            window.lancamentoFilterDate = null;
            dateInput.value = todayStr;
            
            // Ocultar indicador
            if (indicator) indicator.classList.add('hidden');
            
            // Recarregar dados do dia atual
            if (typeof populateMachineSelector === 'function') {
                populateMachineSelector();
            }
            if (typeof loadTodayStats === 'function') {
                loadTodayStats();
            }
            if (typeof loadRecentEntries === 'function') {
                loadRecentEntries(false);
            }
            
            console.log('[FILTRO DATA] Resetado para hoje');
        });
        
        // Renderizar ícones
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }
    
    function popularSelectMPOrdem() {
        const select = document.getElementById('order-raw-material');
        if (!select) return;
        select.innerHTML = '<option value="">Selecione a matéria-prima...</option>';
        materiaPrimaDatabase.forEach(mp => {
            const opt = document.createElement('option');
            opt.value = mp.codigo;
            opt.textContent = `${mp.codigo} - ${mp.descricao}`;
            select.appendChild(opt);
        });
    }
    carregarBancoMateriaPrima(popularSelectMPOrdem);
});
// Utilitário para obter descrição da MP pelo código
function getDescricaoMP(codigo) {
    const cod = Number(codigo);
    const mp = materiaPrimaDatabase.find(mp => Number(mp.codigo) === cod);
    return mp ? mp.descricao : String(codigo);
}

// Exemplo de uso em análises de perda:
// Em qualquer local que exibe ou processa MP de perda, use getDescricaoMP(codigo) para mostrar a descrição padronizada.

// Exemplo para gráficos e relatórios:
// const descricao = getDescricaoMP(loss.mp_codigo);
// Popular o select de MP na tela de planejamento
document.addEventListener('DOMContentLoaded', function() {
    function popularSelectMPPlanejamento() {
        const select = document.getElementById('planning-mp');
        if (!select) return;
        select.innerHTML = '<option value="">Selecione a matéria-prima...</option>';
        materiaPrimaDatabase.forEach(mp => {
            const opt = document.createElement('option');
            opt.value = mp.codigo;
            opt.textContent = `${mp.codigo} - ${mp.descricao}`;
            select.appendChild(opt);
        });
    }
    carregarBancoMateriaPrima(popularSelectMPPlanejamento);
});
// --- Integração do banco de Matéria-prima no modal de edição de ordem ---
// Carregar banco de matéria-prima
function carregarBancoMateriaPrima(callback) {
    if (window.materiaPrimaDatabase && Array.isArray(window.materiaPrimaDatabase)) {
          if (callback) callback(); // Callback to populate the select
    }
}

function popularSelectMP() {
    const select = document.getElementById('edit-order-mp');
    if (!select) return;
    select.innerHTML = '<option value="">Selecione a matéria-prima...</option>';
    materiaPrimaDatabase.forEach(mp => {
          const opt = document.createElement('option');
          opt.value = mp.codigo;
          opt.textContent = `${mp.codigo} - ${mp.descricao}`;
          select.appendChild(opt); // Append option to select
    });
}

// Popular o select de MP ao abrir o modal de edição
document.addEventListener('DOMContentLoaded', function() {
    const editOrderModal = document.getElementById('edit-order-modal');
    // Sempre popular o select de MP ao exibir o modal
    if (editOrderModal) {
        // Usar MutationObserver para detectar exibição do modal
        const observer = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                if (mutation.attributeName === 'class') {
                    const isVisible = !editOrderModal.classList.contains('hidden');
                    if (isVisible) {
                        carregarBancoMateriaPrima(popularSelectMP);
                    }
                }
            });
        });
        observer.observe(editOrderModal, { attributes: true });
    }
    // Fallback: popular ao abrir o modal manualmente
    const btns = document.querySelectorAll('[data-edit-order]');
    btns.forEach(btn => {
        btn.addEventListener('click', function() {
            carregarBancoMateriaPrima(popularSelectMP);
        });
    });
});
// This file contains the full and correct JavaScript code for the Hokkaido Mes application.
// All functionalities, including the new database with product codes, are implemented here.

document.addEventListener('DOMContentLoaded', function() {
    console.log('📍 [DEBUG] script.js DOMContentLoaded iniciado');
    console.log('📍 [DEBUG] window.authSystem disponível?', window.authSystem);
    if (window.authSystem) {
        console.log('📍 [DEBUG] currentUser:', window.authSystem.getCurrentUser?.());
    }
    
    // Firebase Configuration
    if (typeof firebase === 'undefined' || typeof firebase.firestore === 'undefined') {
        alert("Erro Crítico: A biblioteca da base de dados não conseguiu ser carregada.");
        return;
    }

    const firebaseConfig = {
        apiKey: "AIzaSyB1YrMK07_7QROsCJQqE0MFsmJncfjphmI",
        authDomain: "hokkaido-synchro.firebaseapp.com",
        projectId: "hokkaido-synchro",
        storageBucket: "hokkaido-synchro.firebasestorage.app",
        messagingSenderId: "635645564631",
        appId: "1:635645564631:web:1e19be7957e39d1adc8292"
    };

    let db;
    let storage = null;

    // ── Fallbacks: funções exportadas por módulos ES6 (deferred) que script.js precisa antes ──
    // Os módulos ES6 sobrescrevem estes quando carregam. Padrão: if typeof !== 'function' { ... }
    const _fb = (name, fn) => { if (typeof window[name] !== 'function') window[name] = fn; };

    // color.utils.js
    _fb('resolveProgressPalette', function(percent) {
        const p = Math.max(0, percent || 0);
        if (p >= 85) return { start: '#22c55e', end: '#16a34a', textClass: 'text-green-600' };
        if (p >= 60) return { start: '#eab308', end: '#22c55e', textClass: p >= 75 ? 'text-green-600' : 'text-yellow-600' };
        if (p >= 45) return { start: '#f97316', end: '#eab308', textClass: 'text-yellow-600' };
        return { start: '#ef4444', end: '#f97316', textClass: 'text-red-600' };
    });

    _fb('hexWithAlpha', function(hex, alpha) {
        if (!hex) return 'rgba(0,0,0,0)';
        const n = hex.replace('#', '');
        const e = n.length === 3 ? n.split('').map(c => c + c).join('') : n.padEnd(6, '0');
        const v = parseInt(e, 16);
        return `rgba(${(v >> 16) & 255}, ${(v >> 8) & 255}, ${v & 255}, ${Math.max(0, Math.min(1, alpha))})`;
    });

    _fb('formatShiftLabel', function(shiftKey) {
        switch (shiftKey) { case 'T1': return '1º Turno'; case 'T2': return '2º Turno'; case 'T3': return '3º Turno'; default: return 'Turno atual'; }
    });

    _fb('getHoursElapsedInProductionDay', function(date) {
        const ref = new Date(date || Date.now());
        if (isNaN(ref.getTime())) return 0;
        const ps = new Date(ref);
        if (ps.getHours() < 7) ps.setDate(ps.getDate() - 1);
        ps.setHours(7, 0, 0, 0);
        return Math.max(0, Math.min(Math.floor(Math.max(0, ref - ps) / 3600000) + 1, 24));
    });

    _fb('getProductionHourLabel', function(date) {
        const d = date || new Date();
        const h = ((d.getHours() % 24) + 24) % 24;
        return `${String(h).padStart(2, '0')}:00`;
    });

    _fb('getGroupedLossReasons', function() {
        if (window.databaseModule && window.databaseModule.groupedLossReasons) return window.databaseModule.groupedLossReasons;
        return { "PROCESSO":["201-FALHA DE INJEÇÃO","202-CONTAMINAÇÃO","203-PONTO ALTO DE INJEÇÃO / FIAPO","204-REBARBA","205-FORA DE COR","206-FORA DE DIMENSIONAL","207-REINICIO/INICIO","208-CHUPAGEM","209-BOLHA","210-QUEIMA","211-MANCHAS","212-JUNÇÃO","213-EMPENAMENTO","214-PEÇAS SCRAP","215-PEÇAS DEFORMADAS"],"FERRAMENTARIA":["101-GALHO PRESO","102-MARCA D'AGUA","103-MARCA DE EXTRATOR","104-RISCO","105-SUJIDADE MOLDE","106-LAMINA QUEBRADA","107-TRY OUT","108-LIMPEZA DE TIPS","109-ABERTURA DE CAVIDADES"],"MAQUINA":["301-QUEDA DE ENERGIA","302-PARADA EMERGENCIAL","303-VAZAMENTO DE OLEO","304-AUSENCIA DE PERIFERICOS","305-SUJIDADE (GRAXA, AGUA, ETC)"],"MATERIA PRIMA":["401-MATERIAL NÃO CONFORME"] };
    });

    _fb('getGroupedDowntimeReasons', function() {
        if (window.databaseModule && window.databaseModule.groupedDowntimeReasons) return window.databaseModule.groupedDowntimeReasons;
        return { "FERRAMENTARIA":["CORRETIVA DE MOLDE","PREVENTIVA DE MOLDE","TROCA DE VERSÃO"],"PROCESSO":["ABERTURA DE CAVIDADE","AJUSTE DE PROCESSO","FECHAMENTO DE CAVIDADE","TRY OUT","PRENDENDO GALHO","PRENDENDO PEÇAS"],"COMPRAS":["FALTA DE MATÉRIA PRIMA","FALTA DE SACO PLÁSTICO","FALTA DE CAIXA DE PAPELÃO","FALTA DE MASTER","ANÁLISE ADMINISTRATIVA","LEAD TIME"],"PREPARAÇÃO":["AGUARDANDO PREPARAÇÃO DE MATERIAL","AGUARDANDO ESTUFAGEM DE M.P","FORA DE COR","TESTE DE COR","MATERIAL CONTAMINADO"],"QUALIDADE":["AGUARDANDO CLIENTE/FORNECEDOR","LIBERAÇÃO INÍCIAL","AGUARDANDO DISPOSIÇÃO DA QUALIDADE"],"MANUTENÇÃO":["MANUTENÇÃO CORRETIVA","MANUTENÇÃO PREVENTIVA","MANUTENÇÃO EXTERNA"],"PRODUÇÃO":["FALTA DE OPERADOR","TROCA DE COR","F.O REVEZAMENTO ALMOÇO","F.O REVEZAMENTO JANTA","INICIO/REINICIO"],"SETUP":["INSTALAÇÃO DE MOLDE","RETIRADA DE MOLDE","INSTALAÇÃO DE PERÍFÉRICOS","AGUARDANDO SETUP"],"ADMINISTRATIVO":["FALTA DE ENERGIA"],"PCP":["SEM PROGRAMAÇÃO","SEM PROGRAMAÇÃO-FIM DE SEMANA","ESTRATÉGIA PCP"],"COMERCIAL":["SEM PEDIDO","PARADA COMERCIAL","BAIXA DEMANDA"],"OUTROS":["VAZAMENTO DO BICO","QUEIMA DE RESISTÊNCIA"] };
    });

    _fb('getDowntimeCategory', function(reason) {
        if (!reason) return 'OUTROS';
        const u = reason.trim().toUpperCase();
        const sm = { 'FIM DE SEMANA':'PCP','MANUTENÇÃO PREVENTIVA':'MANUTENÇÃO','MANUTENÇÃO PROGRAMADA':'MANUTENÇÃO','FERIADO':'ADMINISTRATIVO','SETUP/TROCA':'SETUP','PARADA COMERCIAL':'COMERCIAL','SEM PEDIDO':'COMERCIAL','BAIXA DEMANDA':'COMERCIAL','PARADA LONGA':'OUTROS','OUTROS (PARADA LONGA)':'OUTROS' };
        if (sm[u]) return sm[u];
        const g = window.getGroupedDowntimeReasons();
        for (const [cat, rs] of Object.entries(g)) { if (rs.map(r => r.toUpperCase()).includes(u)) return cat; }
        return 'OUTROS';
    });

    // date.utils.js
    _fb('combineDateAndTime', function(dateStr, timeStr) {
        if (!dateStr || !timeStr) return null;
        const [year, month, day] = dateStr.split('-').map(Number);
        const [hour, minute] = timeStr.split(':').map(Number);
        if ([year, month, day, hour, minute].some(v => Number.isNaN(v))) return null;
        return new Date(year, (month || 1) - 1, day || 1, hour || 0, minute || 0, 0, 0);
    });

    const _pad2 = n => String(n).padStart(2, '0');

    _fb('formatDateYMD', function(d) {
        return `${d.getFullYear()}-${_pad2(d.getMonth() + 1)}-${_pad2(d.getDate())}`;
    });

    _fb('formatTimeHM', function(d) {
        return `${_pad2(d.getHours())}:${_pad2(d.getMinutes())}`;
    });

    // downtime-shift.service.js
    _fb('parseDateTime', function(dateStr, timeStr) {
        if (!dateStr || !timeStr) return null;
        try { const t = timeStr.length === 5 ? `${timeStr}:00` : timeStr; const d = new Date(`${dateStr}T${t}`); return isNaN(d.getTime()) ? null : d; } catch(e) { return null; }
    });

    _fb('getShiftForDateTime', function(dt) {
        if (!(dt instanceof Date) || isNaN(dt.getTime())) return null;
        const m = dt.getHours() * 60 + dt.getMinutes();
        if (m >= 390 && m < 900) return 1;
        if (m >= 900 && m < 1400) return 2;
        return 3;
    });

    _fb('getWorkdayForDateTime', function(dt) {
        if (!(dt instanceof Date) || isNaN(dt.getTime())) return window.formatDateYMD(new Date());
        const h = dt.getHours(), mi = dt.getMinutes();
        if (h < 6 || (h === 6 && mi < 30)) { const p = new Date(dt); p.setDate(p.getDate() - 1); return window.formatDateYMD(p); }
        return window.formatDateYMD(dt);
    });

    _fb('inferShiftFromSegment', function(dateStr, startTimeStr, endTimeStr) {
        const toMin = t => { if (!t || !t.includes(':')) return null; const [h, m] = t.split(':').map(Number); return (isNaN(h) || isNaN(m)) ? null : h * 60 + m; };
        const s = toMin(startTimeStr), e = toMin(endTimeStr);
        const ref = (s !== null && e !== null) ? Math.floor((s + e) / 2) : (s !== null ? s : e);
        if (ref === null) return null;
        if (ref >= 420 && ref < 900) return 1;
        if (ref >= 900 && ref < 1400) return 2;
        return 3;
    });

    _fb('calculateHoursInPeriod', function(startDate, endDate) {
        if (!startDate || !endDate) return 0;
        const s = new Date(`${startDate}T07:00:00`);
        let e = new Date(`${endDate}T07:00:00`);
        if (isNaN(s.getTime()) || isNaN(e.getTime())) return 0;
        if (e <= s) { e = new Date(s); e.setDate(e.getDate() + 1); }
        return Math.max(24, (e - s) / 3600000);
    });

    // plan.utils.js
    _fb('normalizeShiftValue', function(value) {
        if (value === undefined || value === null) return null;
        if (typeof value === 'number' && Number.isFinite(value)) return `T${value}`;
        const m = String(value).toUpperCase().match(/T?\s*(\d)/);
        return m ? `T${m[1]}` : null;
    });

    // resumo.controller.js
    _fb('calculateShiftOEE', function(produzido, tempoParadaMin, refugoPcs, cicloReal, cavAtivas) {
        const tempoTurnoMin = 480, tempoProgramado = tempoTurnoMin;
        const tempoProduzindo = Math.max(0, tempoProgramado - Math.max(0, tempoParadaMin));
        const disp = tempoProgramado > 0 ? tempoProduzindo / tempoProgramado : 0;
        const prodTeorica = cicloReal > 0 && cavAtivas > 0 ? (tempoProduzindo * 60 / cicloReal) * cavAtivas : 0;
        const perf = prodTeorica > 0 ? Math.min(1, produzido / prodTeorica) : (produzido > 0 ? 1 : 0);
        const totalProd = Math.max(0, produzido) + Math.max(0, refugoPcs);
        const qual = totalProd > 0 ? Math.max(0, produzido) / totalProd : (produzido > 0 ? 1 : 0);
        const oee = disp * perf * qual;
        const clamp = v => (isNaN(v) || !isFinite(v)) ? 0 : Math.max(0, Math.min(1, v));
        return { disponibilidade: clamp(disp), performance: clamp(perf), qualidade: clamp(qual), oee: clamp(oee) };
    });

    // consolidateDowntimeEvents e splitDowntimeIntoShiftSegments são funções grandes —
    // fallback mínimo que evita crash retornando arrays vazios / passthrough.
    // O módulo ES6 sobrescreve com a implementação completa.
    _fb('splitDowntimeIntoShiftSegments', function(startDateStr, startTimeStr, endDateStr, endTimeStr) {
        // Fallback simplificado: retorna segmento único sem split por turno
        if (!startDateStr || !startTimeStr) return [];
        const shift = window.inferShiftFromSegment(startDateStr, startTimeStr, endTimeStr);
        return [{
            date: startDateStr, startTime: startTimeStr,
            endDate: endDateStr || startDateStr, endTime: endTimeStr || startTimeStr,
            shift: shift || 1, turno: `T${shift || 1}`
        }];
    });

    _fb('splitDowntimeIntoDailySegments', function(startDateStr, startTimeStr, endDateStr, endTimeStr) {
        return window.splitDowntimeIntoShiftSegments(startDateStr, startTimeStr, endDateStr, endTimeStr);
    });

    _fb('consolidateDowntimeEvents', function(entries) {
        // Fallback simplificado: retorna as entradas como estão, sem consolidação
        return Array.isArray(entries) ? entries : [];
    });
    
    // Sistema de gerenciamento de listeners Firestore
    const listenerManager = {
        listeners: new Map(),
        
        subscribe(name, query, onSnapshot, onError) {
            // Desinscrever anterior se existir
            this.unsubscribe(name);
            
            try {
                const unsubscribe = query.onSnapshot(
                    snapshot => {
                        try {
                            onSnapshot(snapshot);
                        } catch (error) {
                            console.error(`Erro ao processar snapshot ${name}:`, error);
                        }
                    },
                    error => {
                        console.error(`Erro no listener ${name}:`, error);
                        if (onError) onError(error);
                    }
                );
                
                this.listeners.set(name, unsubscribe);
                console.debug(`[ListenerMgr] "${name}" inscrito`);
            } catch (error) {
                console.error(`Erro ao criar listener ${name}:`, error);
                if (onError) onError(error);
            }
        },
        
        unsubscribe(name) {
            const unsubscribe = this.listeners.get(name);
            if (unsubscribe) {
                try {
                    unsubscribe();
                    this.listeners.delete(name);
                    console.debug(`[ListenerMgr] "${name}" desinscrito`);
                } catch (error) {
                    console.error(`Erro ao desinscrever listener ${name}:`, error);
                }
            }
        },
        
        unsubscribeAll() {
            for (const name of this.listeners.keys()) {
                this.unsubscribe(name);
            }
        },
        
        // AÇÃO 3: Visibility API - pausar/retomar listeners
        pauseAll() {
            if (this._paused) return;
            this._paused = true;
            this._pausedListeners = new Map(this.listeners);
            for (const [name, unsubscribe] of this.listeners) {
                try {
                    unsubscribe();
                    console.debug(`[ListenerMgr] "${name}" pausado`);
                } catch (e) {
                    console.warn(`Erro ao pausar listener ${name}:`, e);
                }
            }
            this.listeners.clear();
        },
        
        resumeAll() {
            if (!this._paused) return;
            this._paused = false;
            console.debug('[ListenerMgr] Retomando listeners...');
            // Re-registrar listeners será feito ao recarregar a view atual
            if (typeof window._currentListenerSetup === 'function') {
                window._currentListenerSetup();
            }
        }
    };
    
    // Expor listenerManager no window para controllers ES6
    window.listenerManager = listenerManager;

    // AÇÃO 3: Visibility API - pausar listeners quando aba não visível
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            console.debug('[Visibility] Aba oculta — pausando listeners');
            listenerManager.pauseAll();
            // Pausar polling de downtimes ativos
            if (window._activeDowntimesPolling) {
                clearInterval(window._activeDowntimesPolling);
                window._activeDowntimesPolling = null;
            }
        } else {
            console.debug('[Visibility] Aba visível — retomando listeners');
            listenerManager.resumeAll();
            // Retomar polling de downtimes ativos
            if (typeof window._startActiveDowntimesPolling === 'function') {
                window._startActiveDowntimesPolling();
            }
        }
    });
    
    // Limpar listeners quando a página está se descarregando
    window.addEventListener('beforeunload', () => {
        listenerManager.unsubscribeAll();
        if (window._activeDowntimesPolling) {
            clearInterval(window._activeDowntimesPolling);
        }
    });
    
    // AÇÃO 5: CacheManager para relatórios - evita consultas repetidas
    const CacheManager = {
        _cache: new Map(),
        _ttl: 300000, // OTIMIZAÇÃO Fase 2: 300s de TTL padrão (era 180s)
        
        // Gera chave única para o cache
        _generateKey(collection, filters) {
            return `${collection}:${JSON.stringify(filters)}`;
        },
        
        // Verifica se cache é válido
        isValid(key) {
            const entry = this._cache.get(key);
            if (!entry) return false;
            return Date.now() - entry.timestamp < this._ttl;
        },
        
        // Obtém dados do cache
        get(key) {
            const entry = this._cache.get(key);
            if (!entry) return null;
            if (Date.now() - entry.timestamp >= this._ttl) {
                this._cache.delete(key);
                return null;
            }
            console.debug(`📦 Cache hit: ${key}`);
            return entry.data;
        },
        
        // Armazena dados no cache
        set(key, data) {
            this._cache.set(key, {
                data: data,
                timestamp: Date.now()
            });
            console.debug(`💾 Cache set: ${key}`);
        },
        
        // Consulta com cache automático
        async fetchWithCache(collection, filters = {}, ttl = null) {
            const key = this._generateKey(collection, filters);
            
            // Verificar cache
            const cached = this.get(key);
            if (cached !== null) {
                return cached;
            }
            
            // Buscar do Firestore
            let query = db.collection(collection);
            
            // Aplicar filtros
            if (filters.where) {
                for (const [field, op, value] of filters.where) {
                    query = query.where(field, op, value);
                }
            }
            if (filters.orderBy) {
                query = query.orderBy(filters.orderBy.field, filters.orderBy.direction || 'asc');
            }
            if (filters.limit) {
                query = query.limit(filters.limit);
            }
            
            const snapshot = await query.get();
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // Armazenar no cache
            const effectiveTtl = ttl || this._ttl;
            this._cache.set(key, {
                data: data,
                timestamp: Date.now(),
                ttl: effectiveTtl
            });
            
            console.debug(`🔥 Firestore fetch: ${collection} (${data.length} docs)`);
            return data;
        },
        
        // Invalida cache de uma collection
        invalidate(collection) {
            for (const key of this._cache.keys()) {
                if (key.startsWith(`${collection}:`)) {
                    this._cache.delete(key);
                    console.debug(`🗑️ Cache invalidado: ${key}`);
                }
            }
        },
        
        // Limpa todo o cache
        clear() {
            this._cache.clear();
            console.debug('🗑️ Cache completamente limpo');
        }
    };
    
    // Expor CacheManager globalmente
    window.CacheManager = CacheManager;

    // ========== DATASTORE CENTRALIZADO ==========
    // Armazena dados de listeners em memória para evitar leituras repetidas
    const DataStore = {
        _data: {
            planning: null,
            productionOrders: null,
            productionEntries: null,
            activeDowntimes: null,
            extendedDowntimeLogs: null,
            downtimeEntries: null
        },
        _timestamps: {},
        _subscribers: new Map(),
        _readCounts: {
            total: 0,
            byCollection: {}
        },
        
        // Obter dados (sempre retorna do store, nunca do Firebase diretamente)
        get(collection) {
            return this._data[collection] || null;
        },
        
        // Atualizar dados (chamado pelos listeners)
        set(collection, data) {
            this._data[collection] = data;
            this._timestamps[collection] = Date.now();
            
            // Notificar subscribers
            const subs = this._subscribers.get(collection);
            if (subs) {
                subs.forEach(callback => {
                    try {
                        callback(data);
                    } catch (e) {
                        console.warn(`Erro no subscriber de ${collection}:`, e);
                    }
                });
            }
        },
        
        // Verificar se dados estão "frescos" (recentes)
        // OTIMIZAÇÃO Fase 2: TTL aumentado para 600s (10min) para reduzir leituras Firebase entre abas
        isFresh(collection, maxAgeMs = 600000) {
            const ts = this._timestamps[collection];
            if (!ts) return false;
            return Date.now() - ts < maxAgeMs;
        },
        
        // Obter timestamp da última atualização
        getTimestamp(collection) {
            return this._timestamps[collection] || 0;
        },
        
        // Registrar subscriber para atualizações
        subscribe(collection, callback) {
            if (!this._subscribers.has(collection)) {
                this._subscribers.set(collection, new Set());
            }
            this._subscribers.get(collection).add(callback);
            
            // Retorna função de unsubscribe
            return () => {
                const subs = this._subscribers.get(collection);
                if (subs) subs.delete(callback);
            };
        },
        
        // Contar leitura para monitoramento
        trackRead(collection, source = 'unknown') {
            this._readCounts.total++;
            this._readCounts.byCollection[collection] = (this._readCounts.byCollection[collection] || 0) + 1;
        },
        
        // Obter estatísticas de leitura
        getStats() {
            return {
                ...this._readCounts,
                lastUpdates: { ...this._timestamps }
            };
        },
        
        // Resetar contadores
        resetStats() {
            this._readCounts = { total: 0, byCollection: {} };
        },
        
        // Buscar do Firebase com cache inteligente
        async fetchIfNeeded(collection, queryBuilder = null, forceRefresh = false) {
            // Se dados existem e são frescos, usar do cache
            // OTIMIZAÇÃO Fase 2: TTL aumentado para 300s (era 180s)
            if (!forceRefresh && this.isFresh(collection, 300000) && this._data[collection]) {
                console.debug(`📦 DataStore: usando cache de ${collection}`);
                return this._data[collection];
            }
            
            // Buscar do Firebase
            this.trackRead(collection, 'fetchIfNeeded');
            console.debug(`🔥 DataStore: buscando ${collection} do Firebase`);
            
            let query = db.collection(collection);
            if (queryBuilder) {
                query = queryBuilder(query);
            }
            
            const snapshot = await query.get();
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            this.set(collection, data);
            return data;
        },
        
        // Encontrar item por ID (busca no store primeiro)
        findById(collection, id) {
            const data = this._data[collection];
            if (!data) return null;
            return data.find(item => item.id === id) || null;
        },
        
        // Filtrar dados do store (sem buscar do Firebase)
        filter(collection, predicate) {
            const data = this._data[collection];
            if (!data) return [];
            return data.filter(predicate);
        },
        
        // Invalidar cache de uma collection (forçar reload na próxima leitura)
        invalidate(collection) {
            if (collection) {
                this._data[collection] = null;
                this._timestamps[collection] = 0;
                console.debug(`🗑️ DataStore: cache de ${collection} invalidado`);
            } else {
                // Invalidar tudo
                for (const key of Object.keys(this._data)) {
                    this._data[key] = null;
                    this._timestamps[key] = 0;
                }
                console.debug('🗑️ DataStore: todos os caches invalidados');
            }
        }
    };
    
    // Expor DataStore globalmente
    window.DataStore = DataStore;

    // ========== BATCH QUERY MANAGER ==========
    // Agrupa queries para reduzir número de leituras
    const BatchQueryManager = {
        _pendingQueries: new Map(),
        _batchDelay: 50, // ms para agrupar queries
        
        // Adiciona query ao batch
        async query(collection, docId) {
            return new Promise((resolve, reject) => {
                if (!this._pendingQueries.has(collection)) {
                    this._pendingQueries.set(collection, {
                        docIds: new Set(),
                        resolvers: []
                    });
                    
                    // Executar batch após delay
                    setTimeout(() => this._executeBatch(collection), this._batchDelay);
                }
                
                const batch = this._pendingQueries.get(collection);
                batch.docIds.add(docId);
                batch.resolvers.push({ docId, resolve, reject });
            });
        },
        
        // Executar batch de queries
        async _executeBatch(collection) {
            const batch = this._pendingQueries.get(collection);
            if (!batch) return;
            
            this._pendingQueries.delete(collection);
            
            const docIds = Array.from(batch.docIds);
            console.debug(`📦 Batch query: ${collection} (${docIds.length} docs)`);
            
            // Firebase limita a 10 itens por 'in' query
            const chunks = [];
            for (let i = 0; i < docIds.length; i += 10) {
                chunks.push(docIds.slice(i, i + 10));
            }
            
            const allDocs = new Map();
            
            for (const chunk of chunks) {
                try {
                    const snapshot = await db.collection(collection)
                        .where(firebase.firestore.FieldPath.documentId(), 'in', chunk)
                        .get();
                    
                    snapshot.docs.forEach(doc => {
                        allDocs.set(doc.id, { id: doc.id, ...doc.data() });
                    });
                } catch (error) {
                    console.error(`Erro no batch query ${collection}:`, error);
                }
            }
            
            // Resolver todas as promises
            batch.resolvers.forEach(({ docId, resolve }) => {
                resolve(allDocs.get(docId) || null);
            });
        }
    };
    
    window.BatchQueryManager = BatchQueryManager;

    // ========== FIREBASE USAGE MONITOR ==========
    // Monitor de uso do Firebase para acompanhar economia de leituras
    const FirebaseMonitor = {
        _startTime: Date.now(),
        _reads: 0,
        _writes: 0,
        _cacheHits: 0,
        _estimatedSavings: 0,
        
        trackRead(collection, wasFromCache = false) {
            if (wasFromCache) {
                this._cacheHits++;
                this._estimatedSavings++;
            } else {
                this._reads++;
            }
        },
        
        trackWrite(collection) {
            this._writes++;
        },
        
        getStats() {
            const runtime = Math.round((Date.now() - this._startTime) / 60000);
            const totalRequests = this._reads + this._cacheHits;
            const hitRate = totalRequests > 0 ? Math.round((this._cacheHits / totalRequests) * 100) : 0;
            
            return {
                runtime: `${runtime} min`,
                reads: this._reads,
                writes: this._writes,
                cacheHits: this._cacheHits,
                estimatedSavings: this._estimatedSavings,
                hitRate: `${hitRate}%`
            };
        },
        
        printStats() {
            const stats = this.getStats();
            console.debug('%c📊 FIREBASE USAGE STATS', 'color: #00b4d8; font-weight: bold; font-size: 14px');
            console.debug(`   ⏱️ Tempo de execução: ${stats.runtime}`);
            console.debug(`   🔥 Leituras Firebase: ${stats.reads}`);
            console.debug(`   📦 Hits de cache: ${stats.cacheHits}`);
            console.debug(`   💰 Leituras economizadas: ${stats.estimatedSavings}`);
            console.debug(`   📈 Taxa de cache: ${stats.hitRate}`);
            console.debug(`   ✏️ Escritas: ${stats.writes}`);
            return stats;
        },
        
        reset() {
            this._startTime = Date.now();
            this._reads = 0;
            this._writes = 0;
            this._cacheHits = 0;
            this._estimatedSavings = 0;
        }
    };
    
    window.FirebaseMonitor = FirebaseMonitor;
    
    // Comando rápido no console: digite fbstats() para ver estatísticas
    window.fbstats = () => FirebaseMonitor.printStats();

    // ========== CACHE DASHBOARD (F9 ou console: showCacheDashboard()) ==========
    window.showCacheDashboard = function(containerId) {
        containerId = containerId || 'cache-dashboard';
        let container = document.getElementById(containerId);
        if (container) { container.remove(); } // toggle se já aberto
        container = document.createElement('div');
        container.id = containerId;
        Object.assign(container.style, {
            position: 'fixed', bottom: '16px', right: '16px', zIndex: '99999',
            background: '#1a1a2e', color: '#e0e0e0', padding: '16px 18px',
            borderRadius: '10px', boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
            fontSize: '12px', fontFamily: 'Consolas, monospace',
            maxWidth: '380px', minWidth: '280px', maxHeight: '70vh', overflowY: 'auto',
            border: '1px solid #333'
        });
        document.body.appendChild(container);

        function fmt(ts) { return ts ? new Date(ts).toLocaleTimeString() : '-'; }
        function render() {
            var ds = DataStore.getStats ? DataStore.getStats() : {};
            var fm = FirebaseMonitor.getStats ? FirebaseMonitor.getStats() : {};
            var cmKeys = CacheManager._cache ? Array.from(CacheManager._cache.keys()) : [];
            var dsColHtml = Object.entries(ds.byCollection || {})
                .sort(function(a,b){ return b[1]-a[1]; })
                .map(function(e){ return '<tr><td style="padding:1px 6px">' + e[0] + '</td><td style="text-align:right;padding:1px 6px"><b>' + e[1] + '</b></td></tr>'; })
                .join('');
            var dsUpdatesHtml = Object.entries(ds.lastUpdates || {})
                .map(function(e){ return '<tr><td style="padding:1px 6px">' + e[0] + '</td><td style="text-align:right;padding:1px 6px">' + fmt(e[1]) + '</td></tr>'; })
                .join('');
            var cmHtml = cmKeys.map(function(k){ return '<div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:340px" title="' + k + '">• ' + k + '</div>'; }).join('');

            container.innerHTML = ''
                + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">'
                + '  <span style="font-size:14px;font-weight:bold">📊 Cache Dashboard</span>'
                + '  <button id="cache-dash-close" style="background:none;border:none;color:#aaa;cursor:pointer;font-size:16px" title="Fechar">✕</button>'
                + '</div>'
                // Firebase Monitor
                + '<div style="background:#0d1117;padding:8px;border-radius:6px;margin-bottom:8px">'
                + '  <b style="color:#58a6ff">🔥 Firebase Monitor</b><br>'
                + '  ⏱️ Runtime: ' + (fm.runtime || '-') + '<br>'
                + '  📖 Leituras: <b style="color:#f97316">' + (fm.reads || 0) + '</b> · 📦 Cache hits: <b style="color:#22c55e">' + (fm.cacheHits || 0) + '</b><br>'
                + '  💰 Economizadas: <b style="color:#22c55e">' + (fm.estimatedSavings || 0) + '</b> · Taxa: <b>' + (fm.hitRate || '0%') + '</b><br>'
                + '  ✏️ Escritas: ' + (fm.writes || 0)
                + '</div>'
                // DataStore
                + '<div style="background:#0d1117;padding:8px;border-radius:6px;margin-bottom:8px">'
                + '  <b style="color:#a78bfa">📦 DataStore</b> · Leituras: <b>' + (ds.total || 0) + '</b>'
                + '  <table style="width:100%;margin-top:4px;border-collapse:collapse">' + dsColHtml + '</table>'
                + '  <details style="margin-top:4px"><summary style="cursor:pointer;color:#888">Últimas atualizações</summary>'
                + '    <table style="width:100%;border-collapse:collapse">' + dsUpdatesHtml + '</table>'
                + '  </details>'
                + '</div>'
                // CacheManager
                + '<div style="background:#0d1117;padding:8px;border-radius:6px;margin-bottom:8px">'
                + '  <b style="color:#f59e0b">🗄️ CacheManager</b> · Entradas: <b>' + cmKeys.length + '</b>'
                + '  <div style="max-height:80px;overflow:auto;margin-top:4px;font-size:11px;color:#888">' + (cmHtml || '<i>vazio</i>') + '</div>'
                + '</div>'
                // Botões
                + '<div style="display:flex;gap:6px">'
                + '  <button id="cache-dash-reset" style="flex:1;padding:4px 8px;background:#333;color:#fff;border:1px solid #555;border-radius:4px;cursor:pointer;font-size:11px">🔄 Reset Stats</button>'
                + '  <button id="cache-dash-clear" style="flex:1;padding:4px 8px;background:#333;color:#fff;border:1px solid #555;border-radius:4px;cursor:pointer;font-size:11px">🗑️ Limpar Cache</button>'
                + '</div>';

            document.getElementById('cache-dash-close').onclick = function() { container.remove(); clearInterval(dashInterval); };
            document.getElementById('cache-dash-reset').onclick = function() { DataStore.resetStats(); FirebaseMonitor.reset(); render(); };
            document.getElementById('cache-dash-clear').onclick = function() { CacheManager.clear(); render(); };
        }
        render();
        var dashInterval = setInterval(function() {
            if (!document.body.contains(container)) { clearInterval(dashInterval); return; }
            render();
        }, 2000);
    };

    // Atalho F9 para abrir/fechar o dashboard de cache
    document.addEventListener('keydown', function(e) {
        if (e.key === 'F9' && !e.repeat) {
            e.preventDefault();
            window.showCacheDashboard();
        }
    });

    // ========== HELPER FUNCTIONS - LEITURAS OTIMIZADAS ==========
    // Funções para buscar dados de collections com cache/DataStore

    /**
     * Busca production_orders do DataStore/Cache antes de ir ao Firebase
     * @param {boolean} forceRefresh - Forçar atualização do Firebase
     * @returns {Promise<Array>} - Lista de production_orders
     */
    async function getProductionOrdersCached(forceRefresh = false) {
        // Primeiro, verificar se temos no productionOrdersCache (variável local)
        if (!forceRefresh && typeof productionOrdersCache !== 'undefined' && productionOrdersCache && productionOrdersCache.length > 0) {
            console.debug('📦 Usando productionOrdersCache local');
            return productionOrdersCache;
        }
        
        // Segundo, verificar DataStore
        if (!forceRefresh && window.DataStore) {
            const cached = window.DataStore.get('productionOrders');
            if (cached && cached.length > 0) {
                console.debug('📦 Usando DataStore.productionOrders');
                if (window.FirebaseMonitor) window.FirebaseMonitor.trackRead('production_orders', true);
                return cached;
            }
        }
        
        // Terceiro, verificar CacheManager
        const cacheKey = 'production_orders:all';
        if (!forceRefresh && window.CacheManager) {
            const cached = window.CacheManager.get(cacheKey);
            if (cached) {
                console.debug('📦 Usando CacheManager.production_orders');
                if (window.FirebaseMonitor) window.FirebaseMonitor.trackRead('production_orders', true);
                return cached;
            }
        }
        
        // Se não encontrou em nenhum cache, buscar do Firebase
        console.debug('🔥 Buscando production_orders do Firebase');
        if (window.FirebaseMonitor) window.FirebaseMonitor.trackRead('production_orders', false);
        const snapshot = await db.collection('production_orders').get();
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Armazenar em todos os caches
        if (window.DataStore) {
            window.DataStore.set('productionOrders', data);
        }
        if (window.CacheManager) {
            window.CacheManager.set(cacheKey, data);
        }
        
        return data;
    }
    
    /**
     * Busca planning do DataStore/Cache antes de ir ao Firebase
     * @param {string} date - Data opcional para filtrar
     * @param {boolean} forceRefresh - Forçar atualização do Firebase
     * @returns {Promise<Array>} - Lista de plannings
     */
    async function getPlanningCached(date = null, forceRefresh = false) {
        // Se não precisa filtrar por data e temos no DataStore
        if (!forceRefresh && window.DataStore) {
            const cached = window.DataStore.get('planning');
            if (cached && cached.length > 0) {
                if (!date) {
                    console.debug('📦 Usando DataStore.planning');
                    if (window.FirebaseMonitor) window.FirebaseMonitor.trackRead('planning', true);
                    return cached;
                }
                // Filtrar por data localmente
                const filtered = cached.filter(p => p.date === date);
                if (filtered.length > 0) {
                    console.debug('📦 Usando DataStore.planning (filtrado por data)');
                    if (window.FirebaseMonitor) window.FirebaseMonitor.trackRead('planning', true);
                    return filtered;
                }
            }
        }
        
        // Buscar do Firebase
        console.debug('🔥 Buscando planning do Firebase');
        if (window.FirebaseMonitor) window.FirebaseMonitor.trackRead('planning', false);
        let query = db.collection('planning');
        if (date) {
            query = query.where('date', '==', date);
        }
        const snapshot = await query.get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
    
    /**
     * Encontra uma production_order por ID usando cache
     * @param {string} orderId - ID do documento ou número da OP
     * @returns {Promise<Object|null>}
     */
    async function findProductionOrderCached(orderId) {
        const allOrders = await getProductionOrdersCached();
        
        // Buscar por ID do documento
        let order = allOrders.find(o => o.id === orderId);
        if (order) return order;
        
        // Buscar por número da ordem
        const normalized = String(orderId).toUpperCase().trim();
        order = allOrders.find(o => 
            String(o.order_number || '').toUpperCase().trim() === normalized ||
            String(o.orderNumber || '').toUpperCase().trim() === normalized
        );
        
        return order || null;
    }
    
    /**
     * Busca production_entries do DataStore/Cache antes de ir ao Firebase
     * @param {string} date - Data para filtrar (workDay)
     * @param {boolean} forceRefresh - Forçar atualização do Firebase
     * @returns {Promise<Array>} - Lista de production_entries
     */
    async function getProductionEntriesCached(date = null, forceRefresh = false) {
        // Verificar DataStore primeiro
        if (!forceRefresh && window.DataStore) {
            const cached = window.DataStore.get('productionEntries');
            if (cached && cached.length > 0) {
                if (!date) {
                    console.debug('📦 Usando DataStore.productionEntries');
                    if (window.FirebaseMonitor) window.FirebaseMonitor.trackRead('production_entries', true);
                    return cached;
                }
                // Filtrar por data localmente
                const filtered = cached.filter(e => e.workDay === date || e.data === date);
                if (filtered.length >= 0) { // Retorna mesmo se vazio (pode não ter dados nessa data)
                    console.debug('📦 Usando DataStore.productionEntries (filtrado por data)');
                    if (window.FirebaseMonitor) window.FirebaseMonitor.trackRead('production_entries', true);
                    return filtered;
                }
            }
        }
        
        // Buscar do Firebase
        console.debug('🔥 Buscando production_entries do Firebase');
        if (window.FirebaseMonitor) window.FirebaseMonitor.trackRead('production_entries', false);
        let query = db.collection('production_entries');
        if (date) {
            query = query.where('data', '==', date);
        } else {
            // OTIMIZAÇÃO Fase 2: se sem data, filtrar pelo dia atual em vez de ler tudo
            const today = getProductionDateString();
            if (today) query = query.where('data', '==', today);
        }
        const snapshot = await query.get();
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Armazenar no DataStore se buscou todos
        if (!date && window.DataStore) {
            window.DataStore.set('productionEntries', data);
        }
        
        return data;
    }
    
    /**
     * Busca extended_downtime_logs do DataStore/Cache antes de ir ao Firebase
     * @param {boolean} forceRefresh - Forçar atualização do Firebase
     * @param {boolean} activeOnly - Filtrar apenas ativos
     * @returns {Promise<Array>} - Lista de extended_downtime_logs
     */
    async function getExtendedDowntimesCached(forceRefresh = false, activeOnly = false) {
        // Verificar DataStore primeiro
        if (!forceRefresh && window.DataStore) {
            const cached = window.DataStore.get('extendedDowntimeLogs');
            if (cached && cached.length >= 0) {
                if (activeOnly) {
                    const filtered = cached.filter(d => d.status === 'active');
                    console.debug('📦 Usando DataStore.extendedDowntimeLogs (ativos)');
                    if (window.FirebaseMonitor) window.FirebaseMonitor.trackRead('extended_downtime_logs', true);
                    return filtered;
                }
                console.debug('📦 Usando DataStore.extendedDowntimeLogs');
                if (window.FirebaseMonitor) window.FirebaseMonitor.trackRead('extended_downtime_logs', true);
                return cached;
            }
        }
        
        // Buscar do Firebase — OTIMIZAÇÃO Fase 2: filtrar apenas status=active por padrão
        console.debug('🔥 Buscando extended_downtime_logs do Firebase');
        if (window.FirebaseMonitor) window.FirebaseMonitor.trackRead('extended_downtime_logs', false);
        let edQuery = db.collection('extended_downtime_logs');
        if (activeOnly) {
            edQuery = edQuery.where('status', '==', 'active');
        }
        const snapshot = await edQuery.get();
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Armazenar no DataStore
        if (window.DataStore) {
            window.DataStore.set('extendedDowntimeLogs', data);
        }
        
        if (activeOnly) {
            return data.filter(d => d.status === 'active');
        }
        return data;
    }

    /**
     * Busca active_downtimes com cache inteligente
     * OTIMIZAÇÃO: Evita leituras repetidas do Firebase
     * @param {boolean} forceRefresh - Se true, ignora cache
     * @returns {Array} Lista de paradas ativas
     */
    async function getActiveDowntimesCached(forceRefresh = false) {
        // Verificar DataStore primeiro
        if (!forceRefresh && window.DataStore) {
            const cached = window.DataStore.get('activeDowntimes');
            // OTIMIZAÇÃO Fase 2: TTL de active_downtimes aumentado para 300s (era 120s)
            if (cached && window.DataStore.isFresh('activeDowntimes', 300000)) {
                console.debug('📦 Usando DataStore.activeDowntimes');
                if (window.FirebaseMonitor) window.FirebaseMonitor.trackRead('active_downtimes', true);
                return cached;
            }
        }
        
        // Buscar do Firebase
        console.debug('🔥 Buscando active_downtimes do Firebase');
        if (window.FirebaseMonitor) window.FirebaseMonitor.trackRead('active_downtimes', false);
        const snapshot = await db.collection('active_downtimes').get();
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Armazenar no DataStore
        if (window.DataStore) {
            window.DataStore.set('activeDowntimes', data);
        }
        
        return data;
    }

    /**
     * Busca downtime_entries com cache
     * @param {string|null} date - Data para filtrar (YYYY-MM-DD). Se null, usa hoje.
     * @param {boolean} forceRefresh - Se true, ignora cache
     * @returns {Array} Lista de downtime entries
     */
    async function getDowntimeEntriesCached(date = null, forceRefresh = false) {
        // Se não informou data, usar hoje para evitar leitura completa
        const filterDate = date || getProductionDateString();
        const cacheKey = `downtimeEntries_${filterDate}`;
        
        if (!forceRefresh && window.DataStore) {
            const cached = window.DataStore.get(cacheKey);
            if (cached && window.DataStore.isFresh(cacheKey, 300000)) { // 5 min TTL (otimizado Fase 2 — era 2 min)
                console.debug('📦 Usando cache downtime_entries');
                return cached;
            }
        }
        
        console.debug(`🔥 Buscando downtime_entries do Firebase (date=${filterDate})`);
        // OTIMIZAÇÃO Fase 2: sempre filtrar por data — colecão cresce sem limite
        const prevDay = (() => {
            const d = new Date(`${filterDate}T12:00:00`);
            d.setDate(d.getDate() - 1);
            return d.toISOString().split('T')[0];
        })();
        const snapshot = await db.collection('downtime_entries')
            .where('date', 'in', [prevDay, filterDate])
            .get();
        const data = snapshot.docs.map(doc => ({ id: doc.id, docRef: doc.ref, ...doc.data() }));
        
        if (window.DataStore) {
            window.DataStore.set(cacheKey, data);
        }
        
        return data;
    }

    /**
     * Busca machine_priorities com cache
     * @param {boolean} forceRefresh - Se true, ignora cache
     * @returns {Object} Mapa de prioridades por máquina
     */
    async function getMachinePrioritiesCached(forceRefresh = false) {
        const cacheKey = 'machinePriorities';
        
        if (!forceRefresh && window.DataStore) {
            const cached = window.DataStore.get(cacheKey);
            if (cached && window.DataStore.isFresh(cacheKey, 300000)) { // 5 min TTL
                console.debug('📦 Usando cache machine_priorities');
                return cached;
            }
        }
        
        console.debug('🔥 Buscando machine_priorities do Firebase');
        const snapshot = await db.collection('machine_priorities').get();
        const priorities = {};
        snapshot.docs.forEach(doc => {
            const p = doc.data().priority;
            priorities[doc.id] = (p !== null && p !== undefined && !isNaN(p)) ? Number(p) : 99;
        });
        
        if (window.DataStore) {
            window.DataStore.set(cacheKey, priorities);
        }
        
        return priorities;
    }
    
    // Expor globalmente
    window.getProductionOrdersCached = getProductionOrdersCached;
    window.getPlanningCached = getPlanningCached;
    window.findProductionOrderCached = findProductionOrderCached;
    window.getProductionEntriesCached = getProductionEntriesCached;
    window.getExtendedDowntimesCached = getExtendedDowntimesCached;
    window.getActiveDowntimesCached = getActiveDowntimesCached;
    window.getDowntimeEntriesCached = getDowntimeEntriesCached;
    window.getMachinePrioritiesCached = getMachinePrioritiesCached;
    
    
    try {
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        
        // Configurações de Firestore para melhorar estabilidade
    db = firebase.firestore();
    window.db = db;
        
        // Tentar desabilitar QUIC se disponível (evita ERR_QUIC_PROTOCOL_ERROR)
        if (db.settings) {
            try {
                db.settings({
                    experimentalForceLongPolling: true
                });
                console.log('✅ Firestore: Long polling forçado (QUIC desabilitado)');
            } catch (e) {
                console.warn('⚠️ Não foi possível configurar long polling:', e.message);
            }
        }
        
        if (typeof firebase.storage === 'function') {
            // Nota: Fotos foram removidas do sistema; Storage não é utilizado.
            console.log('Firebase Storage detectado (não utilizado: fotos removidas)');
        } else {
            console.log('Firebase Storage indisponível (irrelevante: fotos removidas).');
        }
        
        // Firebase inicializado (teste de conexão removido para otimização)
        console.log('Firebase inicializado com sucesso');
        console.log('Firestore instance:', db);
        
    } catch (error) {
        console.error("Erro ao inicializar Firebase: ", error);
        alert("Erro fatal: Não foi possível conectar à base de dados.");
        return;
    }

    // Monitor global para erros de rede (inclui QUIC)
    window.addEventListener('error', (event) => {
        if (event.message && event.message.includes('QUIC')) {
            console.warn('⚠️ QUIC Protocol Error detectado - tentando reconectar...');
            console.warn('Detalhes:', {
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno
            });
        }
    });

    // Monitor para erros não capturados de Promise
    window.addEventListener('unhandledrejection', (event) => {
        if (event.reason && (event.reason.message?.includes('QUIC') || event.reason.code?.includes('QUIC'))) {
            console.warn('⚠️ QUIC Promise Rejection detectada');
            console.warn('Reason:', event.reason);
            // Não preventar o erro - deixar prosseguir normalmente
        }
    });

    // --- Configuration Lists ---
    
    // Função centralizada para extrair quantidade planejada de um plano
    // Usada para garantir consistência entre Dashboard TV e Aba Análise
    // CORREÇÃO: Priorizar planned_quantity (meta diária calculada) sobre lot_size (tamanho total OP)
    function getPlanQuantity(raw) {
        if (!raw) return 0;
        // Prioridade: planned_quantity (meta diária) > planned_qty > quantidade > meta > target > qtdPlanejada
        // NÃO USAR lot_size/order_lot_size aqui - esses são o tamanho total da OP, não a meta diária!
        const qty = raw.planned_quantity || 
                    raw.planned_qty || 
                    raw.quantidade || 
                    raw.meta || 
                    raw.target || 
                    raw.qtdPlanejada || 
                    0;
        return Math.round(Number(qty) || 0);
    }
    
    // Normalização de IDs de máquina: H01, H02, ...
    function normalizeMachineId(id) {
        if (!id) return null;
        const s = String(id).toUpperCase().replace(/\s+/g, '');
        // Aceita H-01, H01, h01 etc.; mantém dois dígitos
        const match = s.match(/^H[-_]?(\d{1,2})$/);
        if (match) {
            return `H${match[1].padStart(2, '0')}`;
        }
        // Se vier apenas dígitos (ex.: 1, 01), prefixa H
        const n = s.match(/^(\d{1,2})$/);
        if (n) {
            return `H${n[1].padStart(2, '0')}`;
        }
        // Fallback: remove hífens e tenta novamente
        const cleaned = s.replace(/-/g, '');
        const m2 = cleaned.match(/^H(\d{1,2})$/);
        if (m2) return `H${m2[1].padStart(2, '0')}`;
        return s; // devolve como veio se não reconhecer
    }

    // ================================
    // FUNÇÕES DE TARA E PESOS - TUDO EM GRAMAS
    // ================================
    
    // Obter peso da tara para uma máquina específica (retorna em GRAMAS)
    function getTareWeightForMachine(machine) {
        if (!machine) return 0;
        
        const normalizedMachine = normalizeMachineId(machine);
        const tareWeightKg = window.databaseModule?.tareByMachine?.get(normalizedMachine);
        
        if (!tareWeightKg) return 0;
        
        // Converter kg para gramas - sempre retornar em gramas!
        return Math.round(tareWeightKg * 1000);
    }
    
    // Converter kg para gramas com validação
    function kgToGrams(kg) {
        const num = parseFloat(kg);
        if (!Number.isFinite(num) || num < 0) return 0;
        return Math.round(num * 1000);
    }
    
    // Converter gramas para kg com precisão
    function gramsToKg(grams) {
        const num = parseFloat(grams);
        if (!Number.isFinite(num) || num < 0) return 0;
        return num / 1000;
    }
    
    // Calcular quantidade de peças baseado em peso em gramas
    // Retorna { quantity: número, remainder: gramas restantes, error: null | string }
    function calculateQuantityFromGrams(weightGrams, pieceWeightGrams) {
        const weight = parseFloat(weightGrams) || 0;
        const pieceWeight = parseFloat(pieceWeightGrams) || 0;
        
        if (weight <= 0 || pieceWeight <= 0) {
            return { quantity: 0, remainder: weight, error: 'Peso da peça ou peso total inválido' };
        }
        
        const quantity = Math.floor(weight / pieceWeight);
        const remainder = weight % pieceWeight;
        
        return { 
            quantity: Math.max(0, quantity), 
            remainder: Math.max(0, remainder),
            error: null 
        };
    }
    
    // Calcular peso total esperado para quantidade de peças em gramas
    function calculateExpectedWeightGrams(quantity, pieceWeightGrams) {
        const qty = parseInt(quantity) || 0;
        const pieceWeight = parseFloat(pieceWeightGrams) || 0;
        
        if (qty < 0 || pieceWeight <= 0) return 0;
        
        return qty * pieceWeight;
    }
    
    // Validar consistência: se tem quantidade E peso, verificar se são coerentes
    // Retorna { valid: boolean, message: string, suggestedQty: number }
    function validateWeightQuantityConsistency(weightGrams, quantity, pieceWeightGrams, tolerancePercent = 5) {
        const weight = parseFloat(weightGrams) || 0;
        const qty = parseInt(quantity) || 0;
        const pieceWeight = parseFloat(pieceWeightGrams) || 0;
        
        if (weight <= 0 || qty <= 0 || pieceWeight <= 0) {
            return { valid: true, message: '', suggestedQty: qty };
        }
        
        const expectedWeight = qty * pieceWeight;
        const tolerance = (expectedWeight * tolerancePercent) / 100;
        const difference = Math.abs(weight - expectedWeight);
        
        const suggestedQty = Math.round(weight / pieceWeight);
        
        if (difference > tolerance) {
            return {
                valid: false,
                message: `⚠️ Inconsistência detectada! Peso: ${(weight/1000).toFixed(3)}kg | Peças: ${qty} | Peso esperado: ${(expectedWeight/1000).toFixed(3)}kg | Sugestão: ${suggestedQty} peças`,
                suggestedQty: suggestedQty
            };
        }
        
        return { valid: true, message: '', suggestedQty: qty };
    }
    
    // Configurar campos de tara nos formulários
    function setupTareControls() {
        // Limpar estados antigos na inicialização
        cleanOldTareStates();
        
        // Formulário de produção rápida
        const quickUseTareCheckbox = document.getElementById('quick-production-use-tare');
        const quickTareInfo = document.getElementById('quick-production-tare-info');
        const quickTareWeight = document.getElementById('quick-production-tare-weight');
        
        if (quickUseTareCheckbox) {
            quickUseTareCheckbox.addEventListener('change', function() {
                updateTareDisplay('quick', this.checked);
                // Salvar estado quando mudado
                if (selectedMachineData?.machine) {
                    saveTareState(selectedMachineData.machine, this.checked);
                }
            });
        }
        
        // Formulário de produção manual
        const manualUseTareCheckbox = document.getElementById('manual-production-use-tare');
        const manualTareInfo = document.getElementById('manual-production-tare-info');
        const manualTareWeight = document.getElementById('manual-production-tare-weight');
        
        if (manualUseTareCheckbox) {
            manualUseTareCheckbox.addEventListener('change', function() {
                updateTareDisplay('manual', this.checked);
                // Salvar estado quando mudado
                if (selectedMachineData?.machine) {
                    saveTareState(selectedMachineData.machine, this.checked);
                }
            });
        }
        
        // Formulário de perdas
        const lossesUseTareCheckbox = document.getElementById('quick-losses-use-tare');
        const lossesTareInfo = document.getElementById('quick-losses-tare-info');
        const lossesTareWeight = document.getElementById('quick-losses-tare-weight');
        
        if (lossesUseTareCheckbox) {
            lossesUseTareCheckbox.addEventListener('change', function() {
                updateTareDisplay('losses', this.checked);
                // Salvar estado quando mudado
                if (selectedMachineData?.machine) {
                    saveTareState(selectedMachineData.machine, this.checked);
                }
            });
        }
    }
    
    // Verificar se a máquina tem tara cadastrada
    function machineHasTare(machine) {
        return getTareWeightForMachine(machine) > 0;
    }
    
    // ================================
    // SISTEMA DE PERSISTÊNCIA DA TARA
    // ================================
    
    // Obter data atual no formato YYYY-MM-DD
    function getCurrentDateString() {
        const today = new Date();
        return today.getFullYear() + '-' + 
               String(today.getMonth() + 1).padStart(2, '0') + '-' + 
               String(today.getDate()).padStart(2, '0');
    }
    
    // Salvar estado da tara para uma máquina específica
    function saveTareState(machine, useTare) {
        if (!machine) return;
        
        const dateKey = getCurrentDateString();
        const storageKey = `tare_state_${dateKey}`;
        
        try {
            let tareStates = JSON.parse(localStorage.getItem(storageKey) || '{}');
            tareStates[machine] = {
                useTare: useTare,
                timestamp: Date.now()
            };
            localStorage.setItem(storageKey, JSON.stringify(tareStates));
            
            console.log(`[TARE] Estado salvo para ${machine}: ${useTare}`);
        } catch (error) {
            console.error('[TARE] Erro ao salvar estado:', error);
        }
    }
    
    // Recuperar estado da tara para uma máquina específica
    function loadTareState(machine) {
        if (!machine) return false;
        
        const dateKey = getCurrentDateString();
        const storageKey = `tare_state_${dateKey}`;
        
        try {
            const tareStates = JSON.parse(localStorage.getItem(storageKey) || '{}');
            const machineState = tareStates[machine];
            
            if (machineState && machineState.useTare !== undefined) {
                console.log(`[TARE] Estado recuperado para ${machine}: ${machineState.useTare}`);
                return machineState.useTare;
            }
        } catch (error) {
            console.error('[TARE] Erro ao carregar estado:', error);
        }
        
        return false;
    }
    
    // Limpar estados de tara de dias anteriores (limpeza automática)
    function cleanOldTareStates() {
        try {
            const currentDate = getCurrentDateString();
            const keysToRemove = [];
            
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('tare_state_') && !key.includes(currentDate)) {
                    keysToRemove.push(key);
                }
            }
            
            keysToRemove.forEach(key => {
                localStorage.removeItem(key);
                console.log(`[TARE] Estado antigo removido: ${key}`);
            });
        } catch (error) {
            console.error('[TARE] Erro na limpeza de estados antigos:', error);
        }
    }
    
    // ================================
    // FUNÇÕES DE USUÁRIOS
    // ================================
    
    // Popular select de usuários ordenados por código (COD)
    // Configura o campo de código do operador com validação em tempo real
    function setupUserCodeInput(inputId) {
        const input = document.getElementById(inputId);
        if (!input) return;
        
        // Verificar se já foi configurado para evitar duplicação de listeners
        if (input.dataset.userCodeSetup === 'true') {
            return;
        }
        input.dataset.userCodeSetup = 'true';
        
        // Adicionar event listener para mostrar o nome enquanto digita
        input.addEventListener('input', function() {
            updateUserNameDisplay(inputId, this.value);
        });
        
        // Também atualizar ao perder o foco (blur)
        input.addEventListener('blur', function() {
            updateUserNameDisplay(inputId, this.value);
        });
        
        console.log(`[USER] Input ${inputId} configurado para validação`);
    }
    
    // Atualiza a exibição do nome do usuário baseado no código digitado
    function updateUserNameDisplay(inputId, userCod) {
        // Mapear o inputId para o elemento de exibição do nome
        const displayIdMap = {
            'quick-production-user': 'quick-production-user-name',
            'quick-losses-user': 'quick-losses-user-name',
            'quick-downtime-user': 'quick-downtime-user-name',
            'manual-production-user': 'manual-production-user-name',
            'manual-losses-user': 'manual-losses-user-name',
            'manual-downtime-user': 'manual-downtime-user-name',
            'batch-downtime-user': 'batch-downtime-user-name',
            'standalone-downtime-user': 'standalone-downtime-user-name'
        };
        
        const displayElement = document.getElementById(displayIdMap[inputId]);
        if (!displayElement) return;
        
        if (!userCod || userCod === '') {
            displayElement.textContent = 'Digite o código para ver o nome';
            displayElement.className = 'text-xs text-gray-400 mt-1';
            return;
        }
        
        const user = window.getUserByCode ? window.getUserByCode(parseInt(userCod)) : null;
        if (user) {
            displayElement.textContent = `✅ ${user.nomeUsuario} - ${user.nomeCompleto}`;
            displayElement.className = 'text-xs text-green-600 font-medium mt-1';
        } else {
            displayElement.textContent = '❌ Código não encontrado';
            displayElement.className = 'text-xs text-red-500 mt-1';
        }
    }
    
    // Configura todos os campos de código de usuário nos modais
    function setupAllUserCodeInputs() {
        const userInputIds = [
            'quick-production-user',
            'quick-losses-user',
            'quick-downtime-user',
            'manual-production-user',
            'manual-losses-user',
            'manual-downtime-user'
        ];
        
        userInputIds.forEach(inputId => {
            setupUserCodeInput(inputId);
        });
        
        console.log('[USER] Todos os inputs de código de usuário configurados');
    }
    
    // Mantém compatibilidade - função antiga redirecionada
    function populateUserSelect(selectId) {
        setupUserCodeInput(selectId);
    }
    
    function populateAllUserSelects() {
        setupAllUserCodeInputs();
    }
    
    // ================================
    // SISTEMA DE AUTO-PREENCHIMENTO DE OPERADOR POR ESCALA
    // ================================
    
    /**
     * Busca o operador escalado para uma máquina/turno/data específica
     * @param {string} maquina - Identificador da máquina (ex: "H31", "H15")
     * @param {number} turno - Número do turno (1, 2 ou 3)
     * @param {string} data - Data no formato "YYYY-MM-DD"
     * @returns {Promise<{cod: number, nome: string, user: string}|null>} - Dados do operador ou null
     */
    async function getOperadorEscalado(maquina, turno, data) {
        if (!maquina || !turno || !data) {
            console.log('[ESCALA] Parâmetros inválidos:', { maquina, turno, data });
            return null;
        }
        
        try {
            const db = firebase.firestore();
            
            // Buscar escalas para a data e turno especificados
            const snapshot = await db.collection('escalas_operadores')
                .where('data', '==', data)
                .where('turno', '==', parseInt(turno))
                .get();
            
            if (snapshot.empty) {
                console.log('[ESCALA] Nenhuma escala encontrada para:', { data, turno });
                return null;
            }
            
            // Procurar qual escala contém a máquina especificada
            for (const doc of snapshot.docs) {
                const escala = doc.data();
                const maquinas = escala.maquinas || [];
                
                // Verificar se a máquina está na lista (case-insensitive)
                const maquinaEncontrada = maquinas.some(m => 
                    m.toLowerCase() === maquina.toLowerCase()
                );
                
                if (maquinaEncontrada) {
                    console.log('[ESCALA] Operador encontrado:', {
                        maquina,
                        turno,
                        data,
                        operador: escala.operadorNome,
                        cod: escala.operadorCod
                    });
                    
                    return {
                        cod: escala.operadorCod,
                        nome: escala.operadorNome || escala.operadorUser,
                        user: escala.operadorUser
                    };
                }
            }
            
            console.log('[ESCALA] Máquina não encontrada em nenhuma escala:', maquina);
            return null;
            
        } catch (error) {
            console.error('[ESCALA] Erro ao buscar operador escalado:', error);
            return null;
        }
    }
    
    /**
     * Obtém o turno atual baseado na hora
     * @returns {number} - Número do turno (1, 2 ou 3)
     */
    function getTurnoAtual() {
        const now = new Date();
        const hour = now.getHours();
        const min = now.getMinutes();
        
        // Turno 1: 06:30 - 14:59
        if ((hour === 6 && min >= 30) || (hour >= 7 && hour < 15)) return 1;
        // Turno 2: 15:00 - 23:19
        if (hour >= 15 && (hour < 23 || (hour === 23 && min < 20))) return 2;
        // Turno 3: 23:20 - 06:29
        return 3;
    }
    
    /**
     * Obtém a data de produção atual (considera que antes das 7h é do dia anterior)
     * @returns {string} - Data no formato "YYYY-MM-DD"
     */
    function getDataProducaoAtual() {
        const now = new Date();
        const hour = now.getHours();
        const minute = now.getMinutes();
        
        // Se for antes das 6h30, pertence ao dia de trabalho anterior
        if (hour < 6 || (hour === 6 && minute < 30)) {
            const prevDay = new Date(now);
            prevDay.setDate(prevDay.getDate() - 1);
            return new Date(prevDay.getTime() - (prevDay.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
        }
        
        return new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    }
    
    /**
     * Auto-preenche o campo de código de operador baseado na escala da máquina selecionada
     * @param {string} inputId - ID do campo de input do código do operador
     * @param {string} maquina - Identificador da máquina (ex: "H31")
     * @param {number} turno - Turno (opcional, usa atual se não informado)
     * @param {string} data - Data (opcional, usa atual se não informado)
     */
    async function autoPreencherOperadorPorEscala(inputId, maquina, turno = null, data = null) {
        const input = document.getElementById(inputId);
        if (!input) {
            console.log('[ESCALA] Input não encontrado:', inputId);
            return;
        }
        
        // Usar turno e data atuais se não informados
        const turnoEfetivo = turno || getTurnoAtual();
        const dataEfetiva = data || getDataProducaoAtual();
        
        console.log('[ESCALA] Buscando operador para:', { maquina, turno: turnoEfetivo, data: dataEfetiva });
        
        // Mostrar estado de carregamento
        updateUserNameDisplay(inputId, '');
        const displayMap = {
            'quick-production-user': 'quick-production-user-name',
            'quick-losses-user': 'quick-losses-user-name',
            'quick-downtime-user': 'quick-downtime-user-name',
            'manual-production-user': 'manual-production-user-name',
            'manual-losses-user': 'manual-losses-user-name',
            'manual-downtime-user': 'manual-downtime-user-name'
        };
        const displayEl = document.getElementById(displayMap[inputId]);
        if (displayEl) {
            displayEl.textContent = '🔍 Buscando operador na escala...';
            displayEl.className = 'text-xs text-blue-500 mt-1';
        }
        
        try {
            const operador = await getOperadorEscalado(maquina, turnoEfetivo, dataEfetiva);
            
            if (operador && operador.cod) {
                // Preencher automaticamente o código
                input.value = operador.cod;
                
                // Atualizar exibição do nome
                if (displayEl) {
                    displayEl.textContent = `✅ ${operador.user || operador.nome} (Escala: ${maquina} - T${turnoEfetivo})`;
                    displayEl.className = 'text-xs text-green-600 font-medium mt-1';
                }
                
                // Marcar que foi preenchido automaticamente
                input.dataset.autoPreenchido = 'true';
                input.dataset.escalaMaquina = maquina;
                input.dataset.escalaTurno = turnoEfetivo;
                
                console.log('[ESCALA] Operador auto-preenchido:', operador);
            } else {
                // Nenhum operador escalado - limpar e permitir digitação manual
                input.value = '';
                input.dataset.autoPreenchido = 'false';
                
                if (displayEl) {
                    displayEl.textContent = '⚠️ Nenhum operador escalado - digite o código manualmente';
                    displayEl.className = 'text-xs text-amber-600 mt-1';
                }
                
                console.log('[ESCALA] Nenhum operador encontrado na escala');
            }
        } catch (error) {
            console.error('[ESCALA] Erro ao auto-preencher operador:', error);
            
            if (displayEl) {
                displayEl.textContent = '❌ Erro ao buscar escala - digite o código manualmente';
                displayEl.className = 'text-xs text-red-500 mt-1';
            }
        }
    }
    
    // Expor funções para uso global
    window.getOperadorEscalado = getOperadorEscalado;
    window.autoPreencherOperadorPorEscala = autoPreencherOperadorPorEscala;
    window.getTurnoAtual = getTurnoAtual;
    window.getDataProducaoAtual = getDataProducaoAtual;
    
    // Carregar estado persistente da tara para todos os formulários
    function loadTareStateForAllForms(machine) {
        if (!machine) return;
        
        const savedState = loadTareState(machine);
        const hasTare = machineHasTare(machine);
        
        // Aplicar estado salvo apenas se a máquina tem tara cadastrada
        if (hasTare && savedState) {
            const formTypes = ['quick-production', 'manual-production', 'quick-losses'];
            
            formTypes.forEach(formType => {
                const checkbox = document.getElementById(`${formType}-use-tare`);
                if (checkbox) {
                    checkbox.checked = savedState;
                    console.log(`[TARE] Estado restaurado para ${formType}: ${savedState}`);
                }
            });
        }
    }
    
    // Atualizar exibição das informações de tara
    function updateTareDisplay(formType, useTare) {
        // Determinar IDs corretos baseado no tipo de formulário
        const isLosses = formType === 'losses';
        const prefix = isLosses ? 'quick-losses' : `${formType}-production`;
        
        const tareCheckbox = document.getElementById(`${prefix}-use-tare`);
        const tareInfo = document.getElementById(`${prefix}-tare-info`);
        const tareWeightSpan = document.getElementById(`${prefix}-tare-weight`);
        
        if (!tareInfo || !tareWeightSpan || !tareCheckbox) return;
        
        // Mostrar/esconder checkbox baseado na disponibilidade de tara
        const hasTare = selectedMachineData?.machine && machineHasTare(selectedMachineData.machine);
        const tareContainer = tareCheckbox.closest('div');
        
        if (tareContainer) {
            if (hasTare) {
                tareContainer.style.display = 'block';
            } else {
                tareContainer.style.display = 'none';
                tareCheckbox.checked = false;
                useTare = false;
            }
        }
        
        if (useTare && hasTare) {
            const tareWeightGrams = getTareWeightForMachine(selectedMachineData.machine);
            // Exibir em gramas (getTareWeightForMachine retorna gramas)
            tareWeightSpan.textContent = `${tareWeightGrams}`;
            tareInfo.classList.remove('hidden');
        } else {
            tareInfo.classList.add('hidden');
        }
    }

    // Lista de máquinas padronizada via database.js quando disponível
    const machineList = (window.databaseModule && window.databaseModule.machineDatabase)
        ? window.databaseModule.machineDatabase.map(m => normalizeMachineId(m.id))
        : [
            "H01", "H02", "H03", "H04", "H05", "H06", "H07", "H08", "H09", "H10",
            "H12", "H13", "H14", "H15", "H16", "H17", "H18", "H19", "H20",
            "H26", "H27", "H28", "H29", "H30", "H31", "H32"
        ];

    // Base de dados de máquinas com seus modelos (usa database.js se disponível)
    const machineDatabase = (window.databaseModule && window.databaseModule.machineDatabase) ? window.databaseModule.machineDatabase : [
        { id: "H-01", model: "SANDRETTO OTTO" },
        { id: "H-02", model: "SANDRETTO SERIE 200" },
        { id: "H-03", model: "LS LTE280" },
        { id: "H-04", model: "LS LTE 330" },
        { id: "H-05", model: "LS LTE 170" },
        { id: "H-06", model: "HAITIAN MA2000" },
        { id: "H-07", model: "CHEN HSONG JM 178 A" },
        { id: "H-08", model: "REED 200 TG II" },
        { id: "H-09", model: "REED 200 TG II" },
        { id: "H-10", model: "HAITIAN MA 3200" },
        { id: "H-11", model: "ROMI 300 TGR" },
        { id: "H-12", model: "BORCHE BH 120" },
        { id: "H-13", model: "HAITIAN MA 2000 770G" },
        { id: "H-14", model: "SANDRETTO SB UNO" },
        { id: "H-15", model: "ROMI EN 260 CM 10" },
        { id: "H-16", model: "HAITIAN MA 2000 III" },
        { id: "H-17", model: "ROMI EN 260 CM 10" },
        { id: "H-18", model: "HAITIAN MA 2000 III" },
        { id: "H-19", model: "HAITIAN MA 2000 III" },
        { id: "H-20", model: "HAITIAN PL 200J" },
        { id: "H-26", model: "ROMI PRIMAX CM9" },
        { id: "H-27", model: "ROMI PRIMAX CM8" },
        { id: "H-28", model: "ROMI PRIMAX CM8" },
        { id: "H-29", model: "ROMI PRIMAX CM8" },
        { id: "H-30", model: "ROMI PRIMAX CM8" },
        { id: "H-31", model: "ROMI PRÁTICA CM8" },
        { id: "H-32", model: "ROMI PRÁTICA CM8" }
    ];

    // Motivos de Refugo e Parada: preferir database.js se disponível (senão usa fallback agrupado)
    // Observação: o app usa funções getGrouped* abaixo para popular selects/relatórios

    const preparadores = ['Daniel', 'João', 'Luis', 'Manaus', 'Rafael', 'Stanley', 'Wagner', 'Yohan'].sort();

    /**
     * Função helper para buscar produto por código com fallback seguro
     * Evita erros de "Cannot read properties of undefined"
     * @param {string|number} code - Código do produto
     * @returns {object|null} - Produto encontrado ou null
     */
    function getProductByCode(code) {
        if (!code && code !== 0) return null;
        
        const numericCode = Number(code);
        const stringCode = String(code).trim();
        let product = null;

        // 1. Tentar via window.productByCode (exposto diretamente pelo database.js)
        if (window.productByCode instanceof Map && window.productByCode.size > 0) {
            product = window.productByCode.get(numericCode) || window.productByCode.get(stringCode);
            if (product) return product;
        }

        // 2. Tentar via window.databaseModule.productByCode
        const moduleIndex = window.databaseModule?.productByCode;
        if (moduleIndex instanceof Map && moduleIndex.size > 0) {
            product = moduleIndex.get(numericCode) || moduleIndex.get(stringCode);
            if (product) return product;
        }

        // 3. Fallback: window.productDatabase (exposto diretamente pelo database.js)
        if (Array.isArray(window.productDatabase) && window.productDatabase.length > 0) {
            product = window.productDatabase.find(p => Number(p.cod) === numericCode || String(p.cod) === stringCode);
            if (product) return product;
        }

        // 4. Fallback: buscar no array do databaseModule
        const dbArray = window.databaseModule?.productDatabase;
        if (Array.isArray(dbArray) && dbArray.length > 0) {
            product = dbArray.find(p => Number(p.cod) === numericCode || String(p.cod) === stringCode);
            if (product) return product;
        }

        // Debug: logar se não encontrou
        console.warn(`[getProductByCode] Produto ${code} não encontrado. Status:`, {
            windowProductByCodeSize: window.productByCode?.size || 0,
            windowProductDatabaseLength: window.productDatabase?.length || 0,
            databaseModuleExists: !!window.databaseModule
        });

        return null;
    }
    
    // Global Variables
    let currentAnalysisView = 'resumo';
    let docIdToDelete = null;
    let collectionToDelete = null;
    const gaugeChartInstances = {};
    const gaugeChartStyles = {
        'availability-gauge': {
            color: '#10B981',
            warningColor: '#F59E0B',
            dangerColor: '#EF4444'
        },
        'performance-gauge': {
            color: '#3B82F6',
            warningColor: '#8B5CF6',
            dangerColor: '#EF4444'
        },
        'quality-gauge': {
            color: '#F59E0B',
            warningColor: '#F97316',
            dangerColor: '#EF4444'
        }
    };
    const DEFAULT_DONUT_COLORS = ['#10B981', '#3B82F6', '#F97316', '#8B5CF6', '#F59E0B', '#EC4899', '#14B8A6', '#EF4444'];
    
    // Variáveis do novo painel de lançamento
    let selectedMachineData = null;
    // Expor selectedMachineData via getter/setter para módulos ES6
    Object.defineProperty(window, 'selectedMachineData', {
        get: () => selectedMachineData,
        set: (val) => { selectedMachineData = val; },
        configurable: true
    });
    let hourlyChartInstance = null;
    let opChartInstance = null;
    // Evitar concorrência/reentrncia na atualização dos gráficos de Lançamento
    let isRefreshingLaunchCharts = false;
    let analysisHourlyChartInstance = null;
    let machineProductionTimelineInstance = null;
    let productionTimer = null;
    let productionTimerBaseSeconds = 0;
    let productionTimerResumeTimestamp = null;
    let currentDowntimeStart = null;
    let downtimeTimer = null;
    let downtimeNotificationSent = false;
    let machineStatus = 'running'; // 'running' ou 'stopped'
    let recentEntriesCache = new Map();
    let allRecentEntries = []; // Armazenar todas as entradas para filtro
    let currentEntryFilter = 'all'; // Filtro atual: 'all', 'production', 'downtime', 'loss'
    let currentEditContext = null;
    let machineCardData = {};
    const machineCardCharts = {};
    let activeMachineCard = null;

    // Flags de configuração
    const QUALITY_AUTOFILL_ENABLED = false;
    const PIECE_WEIGHT_TOLERANCE_PERCENT = 1;

    // Estados auxiliares
    let quickProductionUpdateFeedback = null;

    function parseWeightInputToGrams(value) {
        if (value === undefined || value === null || value === '') return 0;
        let numValue = parseFloat(String(value).replace(',', '.'));
        if (!Number.isFinite(numValue) || numValue <= 0) return 0;
        // Entrada é sempre em GRAMAS - não faz mais conversão automática
        return Math.round(numValue);
    }

    function parsePieceWeightInput(value) {
        // Parser específico para peso da peça no planejamento
        // Admite que o usuário pode digitar em gramas (como 0,194 ou 194)
        // NÃO converte valores para evitar ambiguidade
        if (value === undefined || value === null || value === '') return 0;
        const normalized = typeof normalizeNumericString === 'function' 
            ? normalizeNumericString(value)
            : String(value).replace(',', '.');
        const parsed = parseFloat(normalized);
        if (!Number.isFinite(parsed) || parsed <= 0) return 0;
        // Retornar como-está (assumir que já está em gramas)
        return parsed;
    }

    function parsePieceWeightGrams(value) {
        if (value === undefined || value === null || value === '') return 0;
        const parsed = parseFloat(value);
        if (!Number.isFinite(parsed) || parsed <= 0) return 0;
        // Retornar diretamente - espera-se que o valor já esteja em GRAMAS
        return parsed;
    }

    function resolvePieceWeightGrams(...sources) {
        for (const source of sources) {
            const grams = parsePieceWeightGrams(source);
            if (grams > 0) {
                return grams;
            }
        }
        return 0;
    }

    function getPlanPieceWeightInfo(machineData = selectedMachineData) {
        const latestMeasured = parsePieceWeightGrams(machineData?.latest_piece_weight_grams);
        if (latestMeasured > 0) {
            return {
                grams: latestMeasured,
                source: 'quality_release',
                label: 'Última liberação da qualidade',
                updatedAt: machineData?.latest_piece_weight_updated_at || null,
                updatedBy: machineData?.latest_piece_weight_user || null
            };
        }

        const planningWeight = resolvePieceWeightGrams(
            machineData?.piece_weight_grams,
            machineData?.piece_weight,
            machineData?.weight,
            machineData?.produto?.weight
        );
        if (planningWeight > 0) {
            return {
                grams: planningWeight,
                source: 'planning',
                label: 'Peso planejado',
                updatedAt: null,
                updatedBy: null
            };
        }

        return { grams: 0, source: 'undefined', label: 'Indefinido', updatedAt: null, updatedBy: null };
    }

    function formatPieceWeightInfo(info) {
        if (!info || !info.grams) return 'Peso da peça não definido';
        const parts = [`${(info.grams).toFixed(3)} g`];
        if (info.source === 'quality_release') {
            parts.push('(Qualidade)');
        } else if (info.source === 'planning') {
            parts.push('(Planejamento)');
        }
        return parts.join(' ');
    }

    function getCatalogPieceWeight(machineData = selectedMachineData) {
        if (!machineData) {
            return 0;
        }

        const codeCandidates = [
            machineData.product_cod,
            machineData.product_code,
            machineData.part_code,
            machineData.cod,
            machineData.codigo
        ];

        for (const candidate of codeCandidates) {
            if (candidate === undefined || candidate === null || candidate === '') continue;
            const catalogEntry = getProductByCode(candidate);
            if (catalogEntry && catalogEntry.weight !== undefined && catalogEntry.weight !== null) {
                let weightGrams = parseFloat(catalogEntry.weight);
                if (Number.isFinite(weightGrams) && weightGrams > 0) {
                    // Se o peso for menor que 1, considerar como MILIGRAMAS e converter para gramas
                    // Ex: 0.19 no database = 0.19mg = 0.00019g (mas na verdade queremos 0.19g)
                    // Ajuste: valores < 1 já estão em gramas, não precisa converter
                    // Valores >= 1 também estão em gramas
                    // O database.js usa gramas como unidade padrão
                    return weightGrams;
                }
            }
        }

        return 0;
    }

    function getActivePieceWeightGrams(machineData = selectedMachineData) {
        if (!machineData) return 0;

        // Buscar peso do catálogo para comparação/validação
        const catalogWeight = getCatalogPieceWeight(machineData);

        const planInfo = getPlanPieceWeightInfo(machineData);
        if (planInfo.grams > 0) {
            // Se o catálogo tem peso e o planejamento tem peso muito diferente,
            // preferir o catálogo (pode ser erro de unidade no planejamento)
            if (catalogWeight > 0 && planInfo.grams > catalogWeight * 100) {
                console.warn(`[PESO] Peso do planejamento (${planInfo.grams}g) parece muito alto comparado ao catálogo (${catalogWeight}g). Usando catálogo.`);
                return catalogWeight;
            }
            return planInfo.grams;
        }

        const fallbackWeight = resolvePieceWeightGrams(
            machineData.latest_piece_weight_grams,
            machineData.latest_piece_weight,
            machineData.piece_weight_grams,
            machineData.piece_weight,
            machineData.weight,
            machineData.produto?.piece_weight,
            machineData.produto?.peso_unitario,
            machineData.produto?.weight,
            machineData.product?.piece_weight,
            machineData.product?.peso_unitario,
            machineData.product?.weight,
            machineData.order?.piece_weight,
            machineData.order?.peso_unitario,
            machineData.mp_weight
        );
        if (fallbackWeight > 0) {
            // Mesma validação para fallback
            if (catalogWeight > 0 && fallbackWeight > catalogWeight * 100) {
                console.warn(`[PESO] Peso fallback (${fallbackWeight}g) parece muito alto comparado ao catálogo (${catalogWeight}g). Usando catálogo.`);
                return catalogWeight;
            }
            return fallbackWeight;
        }

        if (catalogWeight > 0) {
            return catalogWeight;
        }

        return 0;
    }

    function updateQuickProductionPieceWeightUI({ forceUpdateInput = false } = {}) {
        const info = getPlanPieceWeightInfo();
        const sourceLabel = document.getElementById('quick-production-weight-source');
        const historyInfo = document.getElementById('quick-production-weight-history');

        if (sourceLabel) {
            sourceLabel.textContent = formatPieceWeightInfo(info);
        }

        if (historyInfo) {
            if (info.updatedAt) {
                const updatedDate = typeof info.updatedAt.toDate === 'function'
                    ? info.updatedAt.toDate()
                    : new Date(info.updatedAt);
                historyInfo.textContent = `Atualizado em ${updatedDate.toLocaleString('pt-BR')} por ${info.updatedBy || 'Qualidade'}`;
                historyInfo.classList.remove('hidden');
            } else {
                historyInfo.textContent = '';
                historyInfo.classList.add('hidden');
            }
        }

        if (typeof quickProductionUpdateFeedback === 'function') {
            quickProductionUpdateFeedback();
        }
    }

    let cachedProductionDataset = {
        productionData: [],
        planData: [],
        startDate: null,
        endDate: null,
        shift: 'all',
        machine: 'all'
    };
    let productionRateMode = 'day';

    // Variáveis globais para análise
    let machines = [];
    let currentAnalysisFilters = {};

    let productionOrdersCache = [];
    let filteredProductionOrders = [];
    let currentSelectedOrderForAnalysis = null;
    let currentActiveOrder = null;
    let currentOrderProgress = { executed: 0, planned: 0, expected: 0 };

    // DOM Element Selectors
    const navButtons = document.querySelectorAll('.nav-btn');
    const pageContents = document.querySelectorAll('.page-content');
    const pageTitle = document.getElementById('page-title');
    const confirmModal = document.getElementById('confirm-modal');
    
    const sidebar = document.getElementById('sidebar');
    const sidebarOpenBtn = document.getElementById('sidebar-open-btn');
    const sidebarCloseBtn = document.getElementById('sidebar-close-btn');
    const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
    const sidebarOverlay = document.getElementById('sidebar-overlay');

    // ── Sidebar: open / close / collapse / restore ──
    function openSidebar() {
        if (!sidebar) return;
        sidebar.classList.add('sidebar-open');
        sidebar.classList.add('translate-x-0');
        sidebar.classList.remove('-translate-x-full');
        sidebar.setAttribute('aria-hidden', 'false');
        if (sidebarOverlay) {
            sidebarOverlay.classList.add('active');
            sidebarOverlay.classList.remove('hidden');
        }
        document.body.classList.add('sidebar-is-open');
    }

    function closeSidebar() {
        if (!sidebar) return;
        sidebar.classList.remove('sidebar-open');
        sidebar.classList.remove('translate-x-0');
        sidebar.classList.add('-translate-x-full');
        sidebar.setAttribute('aria-hidden', 'true');
        if (sidebarOverlay) {
            sidebarOverlay.classList.remove('active');
            sidebarOverlay.classList.add('hidden');
        }
        document.body.classList.remove('sidebar-is-open');
    }

    function toggleSidebarCollapse() {
        if (!sidebar) return;
        const isCollapsed = sidebar.classList.contains('sidebar-collapsed');
        if (isCollapsed) {
            sidebar.classList.remove('sidebar-collapsed');
            sidebar.classList.add('sidebar-expanded');
            sidebar.setAttribute('data-state', 'expanded');
        } else {
            sidebar.classList.remove('sidebar-expanded');
            sidebar.classList.add('sidebar-collapsed');
            sidebar.setAttribute('data-state', 'collapsed');
        }
        try { localStorage.setItem('sidebarState', isCollapsed ? 'expanded' : 'collapsed'); } catch (_) {}
    }

    function restoreSidebarState() {
        if (!sidebar) return;
        try {
            const saved = localStorage.getItem('sidebarState');
            if (saved === 'collapsed') {
                sidebar.classList.remove('sidebar-expanded');
                sidebar.classList.add('sidebar-collapsed');
                sidebar.setAttribute('data-state', 'collapsed');
            }
        } catch (_) {}
    }

    // ── Swipe gesture para abrir/fechar sidebar no mobile ──
    (function initTouchSwipe() {
        let touchStartX = 0;
        let touchStartY = 0;
        let swiping = false;
        const SWIPE_THRESHOLD = 60;
        const EDGE_ZONE = 30; // pixels da borda esquerda para iniciar swipe

        document.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
            // Só detectar swipe para abrir se começou na borda esquerda
            const isSidebarOpen = sidebar && sidebar.classList.contains('sidebar-open');
            swiping = isSidebarOpen || touchStartX < EDGE_ZONE;
        }, { passive: true });

        document.addEventListener('touchend', (e) => {
            if (!swiping || window.innerWidth >= 768) return;
            const touchEndX = e.changedTouches[0].clientX;
            const touchEndY = e.changedTouches[0].clientY;
            const deltaX = touchEndX - touchStartX;
            const deltaY = Math.abs(touchEndY - touchStartY);
            // Ignorar se o movimento vertical for maior que horizontal
            if (deltaY > Math.abs(deltaX)) return;

            if (deltaX > SWIPE_THRESHOLD) {
                openSidebar();
            } else if (deltaX < -SWIPE_THRESHOLD) {
                closeSidebar();
            }
            swiping = false;
        }, { passive: true });
    })();

    const planningDateSelector = document.getElementById('planning-date-selector');
    const planningForm = document.getElementById('planning-form');
    const planningOrderSelect = document.getElementById('planning-order-select');
    const planningOrderSearch = document.getElementById('planning-order-search');
    const planningOrderResults = document.getElementById('planning-order-results');
    const planningOrderSearchLoading = document.getElementById('planning-order-search-loading');
    const planningOrderInfo = document.getElementById('planning-order-info');
    const planningTableBody = document.getElementById('planning-table-body');
    const planningMachineSelect = document.getElementById('planning-machine');
    const planningMpInput = document.getElementById('planning-mp');
    const leaderLaunchPanel = document.getElementById('leader-launch-panel');
    const leaderModal = document.getElementById('leader-entry-modal');
    const leaderModalForm = document.getElementById('leader-entry-form');
    const leaderModalTitle = document.getElementById('leader-modal-title');
    
    const launchPanelContainer = document.getElementById('launch-panel-container');
    const productionModal = document.getElementById('production-entry-modal');
    const productionModalForm = document.getElementById('production-entry-form');
    const productionModalTitle = document.getElementById('production-modal-title');
    // Elementos do novo painel de lançamento
    const machineSelector = document.getElementById('machine-selector');
    const machineCardGrid = document.getElementById('machine-card-grid');
    const machineCardEmptyState = document.getElementById('machine-card-empty');
    const productionControlPanel = document.getElementById('production-control-panel');
    const hourlyProductionChart = document.getElementById('hourly-production-chart');
    const opProductionChart = document.getElementById('op-production-chart');
    const launchChartModeHourlyBtn = document.getElementById('launch-chart-mode-hourly');
    const launchChartModeOpBtn = document.getElementById('launch-chart-mode-op');
    let launchChartMode = 'hourly'; // 'hourly' | 'op'
    const analysisHourlyProductionChart = document.getElementById('analysis-hourly-production-chart');
    const analysisMachineProductionTimelineChart = document.getElementById('analysis-machine-production-timeline');
    const currentShiftDisplay = document.getElementById('current-shift-display');
    const machineIcon = document.getElementById('machine-icon');
    const machineName = document.getElementById('machine-name');
    const productName = document.getElementById('product-name');
    const productMp = document.getElementById('product-mp');
    const finalizeOrderBtn = document.getElementById('finalize-order-btn');
    const activateOrderBtn = document.getElementById('activate-order-btn');
    const shiftTarget = document.getElementById('shift-target');
    const productionTimeDisplay = document.getElementById('production-time');
    const producedToday = document.getElementById('produced-today');
    const efficiencyToday = document.getElementById('efficiency-today');
    const lossesToday = document.getElementById('losses-today');
    const downtimeToday = document.getElementById('downtime-today');
    const recentEntriesList = document.getElementById('recent-entries-list');
    const recentEntriesLoading = document.getElementById('recent-entries-loading');
    const recentEntriesEmpty = document.getElementById('recent-entries-empty');
    const refreshRecentEntriesBtn = document.getElementById('refresh-recent-entries');

    // Elementos da aba de Ordens de Produção
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

    // Filtros da aba de Ordens de Produção
    const ordersFilterMachine = document.getElementById('orders-filter-machine');
    const ordersFilterStatus = document.getElementById('orders-filter-status');
    const ordersFilterSearch = document.getElementById('orders-filter-search');
    



    updateRecentEntriesEmptyMessage('Selecione uma máquina para visualizar os lançamentos.');
    setRecentEntriesState({ loading: false, empty: true });
    
    const analysisTabButtons = document.querySelectorAll('.analysis-tab-btn');
    const analysisViews = document.querySelectorAll('.analysis-view');
    const resumoDateSelector = document.getElementById('resumo-date-selector');
    const printReportBtn = document.getElementById('print-report-btn');
    const reportQuantBtn = document.getElementById('report-quant-btn');
    const reportEfficBtn = document.getElementById('report-effic-btn');
    const resumoContentContainer = document.getElementById('resumo-content-container');
    const startDateSelector = document.getElementById('start-date-selector');
    const endDateSelector = document.getElementById('end-date-selector');
    const dateRangeButtons = document.querySelectorAll('.date-range-btn');
    const machineFilter = document.getElementById('machine-filter');
    const refreshDashboardBtn = document.getElementById('refresh-dashboard-btn');
    
    const graphMachineFilter = document.getElementById('graph-machine-filter');

    let qualityTabInitialized = false;
    let currentQualityContext = null;
    let qualityPlansCache = {
        lastDate: null,
        plans: []
    };

    // Gerenciador centralizado para garantir que todos os modais fiquem visíveis mesmo com conflitos de CSS.
    const MODAL_FORCE_PROPS = [
        'display',
        'opacity',
        'visibility',
        'pointer-events',
        'position',
        'inset',
        'background-color',
        'z-index',
        'width',
        'height',
        'transform'
    ];
    const MODAL_CONTENT_FORCE_PROPS = [
        'display',
        'opacity',
        'visibility',
        'pointer-events',
        'position',
        'z-index',
        'transform'
    ];

    const modalManager = (() => {
        const rootId = 'global-modal-root';
        let root = document.getElementById(rootId);
        if (!root) {
            root = document.createElement('div');
            root.id = rootId;
            root.style.position = 'relative';
            root.style.zIndex = '2147483600';
            document.body.appendChild(root);
        }

        const portalize = (modal) => {
            if (!modal) return modal;
            if (modal.parentElement !== root) {
                root.appendChild(modal);
            }
            if (!modal.dataset.portalized) {
                modal.dataset.portalized = 'true';
            }
            return modal;
        };

        const applyStyles = (modal) => {
            if (!modal) return;
            const pairs = [
                ['display', 'flex'],
                ['opacity', '1'],
                ['visibility', 'visible'],
                ['pointer-events', 'auto'],
                ['position', 'fixed'],
                ['inset', '0'],
                ['background-color', 'rgba(0, 0, 0, 0.6)'],
                ['z-index', '2147483601'],
                ['width', '100vw'],
                ['height', '100vh'],
                ['transform', 'none']
            ];
            pairs.forEach(([prop, value]) => modal.style.setProperty(prop, value, 'important'));
        };

        const clearStyles = (modal) => {
            if (!modal) return;
            MODAL_FORCE_PROPS.forEach((prop) => modal.style.removeProperty(prop));
        };

        const applyContentStyles = (content) => {
            if (!content) return;
            const pairs = [
                ['display', 'block'],
                ['opacity', '1'],
                ['visibility', 'visible'],
                ['pointer-events', 'auto'],
                ['position', 'relative'],
                ['z-index', '2147483602'],
                ['transform', 'none']
            ];
            pairs.forEach(([prop, value]) => content.style.setProperty(prop, value, 'important'));
        };

        const clearContentStyles = (content) => {
            if (!content) return;
            MODAL_CONTENT_FORCE_PROPS.forEach((prop) => content.style.removeProperty(prop));
        };

        const verify = (modal) => {
            if (!modal) return;
            const computed = window.getComputedStyle(modal);
            const rect = modal.getBoundingClientRect();
            if (computed.visibility !== 'visible' || computed.display === 'none' || rect.width < 1 || rect.height < 1) {
                console.warn('⚠️ [ModalManager] Modal ainda não visível após forçar estilos', {
                    id: modal.id,
                    visibility: computed.visibility,
                    display: computed.display,
                    rect
                });
                modal.style.setProperty('z-index', '2147483647', 'important');
                modal.style.setProperty('visibility', 'visible', 'important');
                modal.style.setProperty('opacity', '1', 'important');
                modal.style.setProperty('pointer-events', 'auto', 'important');
                modal.style.setProperty('transform', 'none', 'important');
            }
        };

        return { root, portalize, applyStyles, clearStyles, applyContentStyles, clearContentStyles, verify };
    })();

    window.__modalManager = modalManager;

    // Portalizar todos os modais logo no carregamento evita que fiquem presos a containers com overflow ou z-index baixo.
    document.querySelectorAll('div[id$="-modal"]').forEach((modal) => {
        modalManager.portalize(modal);
        if (!modal.classList.contains('hidden')) {
            modal.classList.add('hidden');
        }
        modalManager.clearStyles(modal);
        const content = modal.querySelector('.bg-white, .modal-content, [class*="bg-white"]');
        if (content) {
            modalManager.clearContentStyles(content);
        }
    });

    // --- FUNÇÕES UTILITÁRIAS ---

    // Carregar OPs abertas para o cache (usado na busca)
    async function loadPlanningOrders() {
        try {
            // Usar função cacheada para economizar leituras do Firebase
            const orders = await getProductionOrdersCached();
            
            // Salvar no cache para uso posterior
            productionOrdersCache = orders;
            
            console.log(`[Planejamento] ${orders.length} OPs carregadas (cache/Firebase)`);
        } catch (err) {
            console.error('Erro ao carregar OPs:', err);
        }
    }

    // Buscar OP pelo número digitado
    function searchPlanningOrder(searchTerm) {
        const resultsContainer = document.getElementById('planning-order-results');
        
        if (!searchTerm || searchTerm.trim() === '') {
            if (resultsContainer) resultsContainer.classList.add('hidden');
            return;
        }

        const term = searchTerm.trim().toLowerCase();
        const blocked = ['concluida','cancelada','finalizada','encerrada'];
        
        console.log(`[Planejamento] Buscando OP com termo: "${term}", cache tem ${productionOrdersCache?.length || 0} OPs`);
        
        // Se o cache está vazio, tentar recarregar
        if (!productionOrdersCache || productionOrdersCache.length === 0) {
            console.warn('[Planejamento] Cache vazio, recarregando OPs...');
            loadPlanningOrders().then(() => {
                searchPlanningOrder(searchTerm);
            });
            return;
        }
        
        // Filtrar OPs abertas que correspondem ao termo de busca
        const matchedOrders = productionOrdersCache.filter(o => {
            if (blocked.includes(String(o.status||'').toLowerCase())) return false;
            
            const orderNum = String(o.order_number || o.order_number_original || o.id || '').toLowerCase();
            const productName = String(o.product || o.product_snapshot?.name || '').toLowerCase();
            const partCode = String(o.part_code || o.product_cod || o.product_snapshot?.cod || '').toLowerCase();
            
            return orderNum.includes(term) || productName.includes(term) || partCode.includes(term);
        });
        
        console.log(`[Planejamento] Encontradas ${matchedOrders.length} OPs`);

        // Ordenar por número da OP
        matchedOrders.sort((a,b) => {
            const toNum = (v) => { const n = parseInt(String(v||'').replace(/\D/g,''), 10); return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY; };
            return toNum(a.order_number || a.order_number_original || a.id) - toNum(b.order_number || b.order_number_original || b.id);
        });

        // Limitar a 10 resultados
        const limitedResults = matchedOrders.slice(0, 10);

        // Renderizar resultados
        renderPlanningOrderResults(limitedResults);
    }

    // Renderizar resultados da busca de OP
    function renderPlanningOrderResults(orders) {
        const resultsContainer = document.getElementById('planning-order-results');
        if (!resultsContainer) {
            console.error('[Planejamento] Container de resultados não encontrado!');
            return;
        }

        if (orders.length === 0) {
            resultsContainer.innerHTML = `
                <div class="p-3 text-center text-gray-500 text-sm">
                    <i data-lucide="search-x" class="w-5 h-5 mx-auto mb-1 text-gray-400"></i>
                    <p>Nenhuma OP encontrada</p>
                </div>
            `;
            resultsContainer.classList.remove('hidden');
            if (typeof lucide !== 'undefined') lucide.createIcons();
            return;
        }

        const html = orders.map(o => {
            const orderNum = o.order_number || o.order_number_original || o.id;
            const productName = o.product || o.product_snapshot?.name || '';
            const snapshotData = o.product_snapshot || {};
            const lot = Number(o.lot_size)||0;
            
            return `
                <div class="planning-order-result p-2 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors"
                    data-order-id="${o.id}"
                    data-part-code="${o.part_code||o.product_cod||snapshotData.cod||''}"
                    data-product="${o.product||snapshotData.name||''}"
                    data-customer="${o.customer||o.client||snapshotData.client||''}"
                    data-lot-size="${lot > 0 ? lot : ''}"
                    data-order-number="${orderNum}"
                    data-machine-id="${o.machine_id||o.machine||''}"
                    data-raw-material="${o.raw_material || snapshotData.mp || ''}"
                    data-mp-type="${o.mp_type || ''}">
                    <div class="flex items-center justify-between">
                        <div>
                            <span class="font-bold text-blue-600 text-sm">${orderNum}</span>
                            <span class="text-gray-400 mx-1">–</span>
                            <span class="text-gray-700 text-xs">${productName || 'Sem produto'}</span>
                        </div>
                        ${lot > 0 ? `<span class="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">${lot.toLocaleString('pt-BR')} pcs</span>` : ''}
                    </div>
                </div>
            `;
        }).join('');

        resultsContainer.innerHTML = html;
        resultsContainer.classList.remove('hidden');
        
        console.log(`[Planejamento] Renderizados ${orders.length} resultados`);

        // Adicionar eventos de clique nos resultados
        resultsContainer.querySelectorAll('.planning-order-result').forEach(item => {
            item.addEventListener('click', () => selectPlanningOrderFromSearch(item));
        });
    }

    // Selecionar OP da lista de resultados
    function selectPlanningOrderFromSearch(item) {
        const dataset = item.dataset;
        const orderId = dataset.orderId;
        const orderNumber = dataset.orderNumber;
        
        const searchInput = document.getElementById('planning-order-search');
        const hiddenSelect = document.getElementById('planning-order-select');
        const resultsContainer = document.getElementById('planning-order-results');
        const machineSelect = document.getElementById('planning-machine');

        console.log('[Planejamento] Dataset do item clicado:', dataset);
        console.log('[Planejamento] orderId:', orderId, 'orderNumber:', orderNumber);

        // Atualizar campo de busca com o número da OP selecionada
        if (searchInput) {
            searchInput.value = orderNumber;
        }

        // Atualizar campo hidden com o ID da OP
        if (hiddenSelect) {
            hiddenSelect.value = orderId;
        }

        // Ocultar resultados
        if (resultsContainer) {
            resultsContainer.classList.add('hidden');
        }

        // Converter dataset para objeto simples (dataset usa camelCase)
        const datasetObj = {
            partCode: dataset.partCode || '',
            product: dataset.product || '',
            customer: dataset.customer || '',
            lotSize: dataset.lotSize || '',
            orderNumber: dataset.orderNumber || '',
            machineId: dataset.machineId || '',
            rawMaterial: dataset.rawMaterial || '',
            mpType: dataset.mpType || ''
        };

        console.log('[Planejamento] OP selecionada via busca:', { orderId, orderNumber, datasetObj });

        const productCodInput = document.getElementById('planning-product-cod');
        if (productCodInput && datasetObj.partCode) {
            if (productCodInput.value !== datasetObj.partCode) {
                productCodInput.value = datasetObj.partCode;
            }
            productCodInput.dispatchEvent(new Event('change', { bubbles: true }));
        }

        if (machineSelect && datasetObj.machineId) {
            const hasOption = Array.from(machineSelect.options).some(opt => opt.value === datasetObj.machineId);
            if (hasOption) machineSelect.value = datasetObj.machineId;
        }

        const selectedOrder = Array.isArray(productionOrdersCache)
            ? productionOrdersCache.find(order => order && order.id === orderId)
            : null;
        
        console.log('[Planejamento] Ordem encontrada no cache:', selectedOrder);

        fillPlanningFormWithOrder(selectedOrder || null, datasetObj);
    }

    // Debounce para busca
    let planningSearchTimeout = null;
    function onPlanningOrderSearchInput(e) {
        const searchTerm = e.target.value;
        const loadingEl = document.getElementById('planning-order-search-loading');
        const resultsContainer = document.getElementById('planning-order-results');
        const hiddenSelect = document.getElementById('planning-order-select');
        
        // Mostrar loading
        if (loadingEl) {
            loadingEl.classList.remove('hidden');
        }

        // Cancelar busca anterior
        if (planningSearchTimeout) {
            clearTimeout(planningSearchTimeout);
        }

        // Se campo vazio, limpar formulário
        if (!searchTerm || searchTerm.trim() === '') {
            if (loadingEl) loadingEl.classList.add('hidden');
            if (resultsContainer) resultsContainer.classList.add('hidden');
            if (hiddenSelect) hiddenSelect.value = '';
            
            const productCodInput = document.getElementById('planning-product-cod');
            if (productCodInput) {
                productCodInput.value = '';
                productCodInput.dispatchEvent(new Event('change', { bubbles: true }));
            }
            fillPlanningFormWithOrder(null);
            return;
        }

        // Aguardar 300ms antes de buscar (debounce)
        planningSearchTimeout = setTimeout(() => {
            searchPlanningOrder(searchTerm);
            if (loadingEl) {
                loadingEl.classList.add('hidden');
            }
        }, 300);
    }

    // Fechar resultados ao clicar fora
    function onPlanningOrderSearchBlur(e) {
        const resultsContainer = document.getElementById('planning-order-results');
        // Delay para permitir clique no resultado antes de fechar
        setTimeout(() => {
            if (resultsContainer && !resultsContainer.contains(document.activeElement)) {
                resultsContainer.classList.add('hidden');
            }
        }, 200);
    }

    function onPlanningOrderChange() {
        // Função mantida para compatibilidade, mas agora o fluxo principal é pela busca
        const hiddenSelect = document.getElementById('planning-order-select');
        if (!hiddenSelect || !hiddenSelect.value) {
            const productCodInput = document.getElementById('planning-product-cod');
            if (productCodInput) {
                productCodInput.value = '';
                productCodInput.dispatchEvent(new Event('change', { bubbles: true }));
            }
            fillPlanningFormWithOrder(null);
            return;
        }
        // O preenchimento é feito pela função selectPlanningOrderFromSearch
    }

    function fillPlanningFormWithOrder(order, dataset = {}) {
        const infoElement = planningOrderInfo;
        const productNameDisplay = document.getElementById('product-name-display');
        const productNameText = document.getElementById('product-name-text');
        const orderNumberDisplay = document.getElementById('planning-order-number');
        const orderCustomerDisplay = document.getElementById('planning-order-customer');
        const mpInput = planningMpInput || document.getElementById('planning-mp');
        const mpTypeSelect = document.getElementById('planning-mp-type');
        const cycleInput = document.getElementById('budgeted-cycle');
        const cavitiesInput = document.getElementById('mold-cavities');
        const weightInput = document.getElementById('piece-weight');
        const plannedQtyInput = document.getElementById('planned-quantity');
        const lotSizeInput = document.getElementById('planning-lot-size');

        // Limpar todos os campos se não houver ordem
        if (!order) {
            if (infoElement) {
                infoElement.style.display = 'none';
            }
            if (orderNumberDisplay) orderNumberDisplay.textContent = '-';
            if (orderCustomerDisplay) orderCustomerDisplay.textContent = '-';
            if (mpInput) mpInput.value = '';
            if (mpTypeSelect) mpTypeSelect.value = '';
            if (cycleInput) cycleInput.value = '';
            if (cavitiesInput) cavitiesInput.value = '';
            if (weightInput) weightInput.value = '';
            if (plannedQtyInput) plannedQtyInput.value = '';
            if (lotSizeInput) lotSizeInput.value = '';
            if (productNameDisplay) {
                productNameDisplay.style.display = 'none';
            }
            if (productNameText) productNameText.textContent = '';
            return;
        }

        // === SEÇÃO 1: Dados da OP (do Excel/Firebase) ===
        const resolvedOrderNumber = order.order_number || order.order_number_original || dataset.orderNumber || order.id || '';
        const partCode = dataset.partCode || order.part_code || order.product_cod || '';
        const productName = order.product || dataset.product || order.product_snapshot?.name || '';
        const customer = order.customer || order.client || dataset.customer || order.product_snapshot?.client || '';
        const machineId = dataset.machineId || order.machine_id || order.machine || '';
        
        // Tamanho do lote (da OP)
        const lotSize = (() => {
            if (dataset.lotSize) {
                const dsValue = Number(dataset.lotSize);
                if (Number.isFinite(dsValue) && dsValue > 0) return dsValue;
            }
            const fromOrder = parseOptionalNumber(order.lot_size);
            return typeof fromOrder === 'number' && Number.isFinite(fromOrder) && fromOrder > 0 ? fromOrder : 0;
        })();

        // Preencher campos da OP
        if (lotSizeInput) {
            lotSizeInput.value = lotSize > 0 ? lotSize : '';
        }

        // Exibir info da OP
        if (infoElement) {
            infoElement.style.display = 'block';
        }
        if (orderNumberDisplay) {
            orderNumberDisplay.textContent = resolvedOrderNumber || '-';
        }
        if (orderCustomerDisplay) {
            orderCustomerDisplay.textContent = customer || '-';
        }

        // === SEÇÃO 2: Dados do Produto (do productDatabase via databaseModule) ===
        // Buscar produto no database pelo código usando a função helper getProductByCode
        const partCodeStr = String(partCode || '').trim();
        const productCode = parseInt(partCodeStr, 10);
        
        console.log(`[Planejamento] Buscando produto com código: "${partCodeStr}" (parseado: ${productCode})`);
        
        // Usar função helper com fallback seguro
        const productFromDatabase = getProductByCode(partCodeStr);

        let resolvedCycle = 0;
        let resolvedCavities = 0;
        let resolvedWeight = 0;
        let resolvedProductName = productName;
        let resolvedClient = customer;

        if (productFromDatabase) {
            // Usar dados do database de produtos (prioridade)
            resolvedCycle = Number(productFromDatabase.cycle) || 0;
            resolvedCavities = Number(productFromDatabase.cavities) || 0;
            resolvedWeight = Number(productFromDatabase.weight) || 0;
            resolvedProductName = productFromDatabase.name || productName;
            resolvedClient = productFromDatabase.client || customer;
            
            console.log(`[Planejamento] ✅ Produto encontrado no database:`, {
                codigo: productCode,
                nome: resolvedProductName,
                ciclo: resolvedCycle,
                cavidades: resolvedCavities,
                peso: resolvedWeight,
                cliente: resolvedClient
            });
        } else {
            // Fallback: usar dados do snapshot da OP ou do dataset
            console.warn(`[Planejamento] ⚠️ Produto Cod ${productCode} NÃO encontrado no database. Usando dados da OP.`, {
                partCode,
                productCode,
                databaseModuleExists: !!window.databaseModule,
                productByCodeExists: !!(window.databaseModule?.productByCode),
                productDatabaseLength: window.databaseModule?.productDatabase?.length || 0
            });
            
            resolvedCycle = (() => {
                if (dataset.cycle) {
                    const parsed = Number(dataset.cycle);
                    if (Number.isFinite(parsed) && parsed > 0) return parsed;
                }
                const snapshotCycle = Number(order.product_snapshot?.cycle);
                if (Number.isFinite(snapshotCycle) && snapshotCycle > 0) return snapshotCycle;
                const orderCycle = Number(order.budgeted_cycle);
                if (Number.isFinite(orderCycle) && orderCycle > 0) return orderCycle;
                return 0;
            })();

            resolvedCavities = (() => {
                if (dataset.cavities) {
                    const parsed = Number(dataset.cavities);
                    if (Number.isFinite(parsed) && parsed > 0) return parsed;
                }
                const snapshotCavities = Number(order.product_snapshot?.cavities);
                if (Number.isFinite(snapshotCavities) && snapshotCavities > 0) return snapshotCavities;
                const orderCavities = Number(order.mold_cavities);
                if (Number.isFinite(orderCavities) && orderCavities > 0) return orderCavities;
                return 0;
            })();

            resolvedWeight = (() => {
                if (dataset.weight) {
                    const parsed = Number(dataset.weight);
                    if (Number.isFinite(parsed) && parsed > 0) return parsed;
                }
                const snapshotWeight = Number(order.product_snapshot?.weight);
                if (Number.isFinite(snapshotWeight) && snapshotWeight > 0) return snapshotWeight;
                const orderWeight = Number(order.piece_weight);
                if (Number.isFinite(orderWeight) && orderWeight > 0) return orderWeight;
                return 0;
            })();
            
            if (partCode) {
                console.warn(`[Planejamento] Produto Cod ${partCode} não encontrado no database. Usando dados da OP.`);
            }
        }

        console.log('[Planejamento] Valores resolvidos:', {
            resolvedCycle,
            resolvedCavities,
            resolvedWeight,
            resolvedProductName
        });

        // Preencher campos do produto
        console.log('[Planejamento] Inputs encontrados:', {
            cycleInput: !!cycleInput,
            cavitiesInput: !!cavitiesInput,
            weightInput: !!weightInput
        });

        if (cycleInput) {
            cycleInput.value = resolvedCycle > 0 ? resolvedCycle : '';
            console.log('[Planejamento] Ciclo preenchido:', cycleInput.value);
        }
        if (cavitiesInput) {
            cavitiesInput.value = resolvedCavities > 0 ? resolvedCavities : '';
            console.log('[Planejamento] Cavidades preenchido:', cavitiesInput.value);
        }
        if (weightInput) {
            weightInput.value = resolvedWeight > 0 ? resolvedWeight : '';
            console.log('[Planejamento] Peso preenchido:', weightInput.value);
        }

        // Exibir nome do produto
        if (productNameDisplay && productNameText) {
            const displayName = resolvedProductName || '';
            if (displayName) {
                productNameText.textContent = displayName;
                productNameDisplay.style.display = 'block';
            } else {
                productNameDisplay.style.display = 'none';
            }
        } else if (productNameDisplay) {
            // Fallback para estrutura antiga
            const label = [resolvedProductName, resolvedClient ? `(${resolvedClient})` : ''].filter(Boolean).join(' ');
            productNameDisplay.textContent = label;
            productNameDisplay.style.display = label ? 'block' : 'none';
        }

        // === SEÇÃO 3: Matéria-prima ===
        const rawMaterial = (dataset.rawMaterial || order.raw_material || order.product_snapshot?.mp || '').trim();
        if (mpInput && rawMaterial) {
            mpInput.value = rawMaterial;
        }

        if (mpTypeSelect) {
            const mpTypeValue = dataset.mpType || order.mp_type || '';
            mpTypeSelect.value = mpTypeValue;
        }

        // === Calcular Quantidade Planejada ===
        if (plannedQtyInput) {
            const cycle = resolvedCycle;
            const cavities = resolvedCavities;
            const plannedQty = cycle > 0 && cavities > 0
                ? Math.floor((86400 / cycle) * cavities * 0.85)
                : 0;
            if (plannedQty > 0) {
                plannedQtyInput.value = plannedQty;
                // Calcular e mostrar distribuição por turno
                updateShiftDistribution(plannedQty, cycle, cavities);
            } else {
                plannedQtyInput.value = '';
                hideShiftDistribution();
            }
        }
    }
    
    // ========================================
    // DISTRIBUIÇÃO POR TURNO - OPÇÃO 3 (HÍBRIDO)
    // ========================================
    
    // Configuração de horas por turno (para cálculo proporcional)
    const SHIFT_CONFIG = {
        t1: { name: '1º Turno', hours: 8.5, percent: 0.35, start: '06:30', end: '15:00' },  // 35%
        t2: { name: '2º Turno', hours: 8.33, percent: 0.35, start: '15:00', end: '23:20' }, // 35%
        t3: { name: '3º Turno', hours: 7.17, percent: 0.30, start: '23:20', end: '06:29' }  // 30%
    };
    
    // Armazena os dados de distribuição por turno atual
    let shiftDistributionData = {
        totalQty: 0,
        baseCycle: 0,
        baseCavities: 0,
        t1: { cycle: 0, cavities: 0, qty: 0, customized: false },
        t2: { cycle: 0, cavities: 0, qty: 0, customized: false },
        t3: { cycle: 0, cavities: 0, qty: 0, customized: false }
    };
    
    /**
     * Calcula a quantidade planejada para um turno específico
     * @param {number} cycle - Ciclo em segundos
     * @param {number} cavities - Número de cavidades
     * @param {number} hoursAvailable - Horas disponíveis no turno
     * @param {number} efficiency - Eficiência (padrão 0.85 = 85%)
     */
    function calculateShiftQuantity(cycle, cavities, hoursAvailable, efficiency = 0.85) {
        if (!cycle || !cavities || cycle <= 0 || cavities <= 0) return 0;
        const secondsAvailable = hoursAvailable * 3600;
        return Math.floor((secondsAvailable / cycle) * cavities * efficiency);
    }
    
    /**
     * Atualiza a distribuição por turno e exibe a seção
     */
    function updateShiftDistribution(totalQty, cycle, cavities) {
        console.log('[SHIFT DISTRIBUTION] updateShiftDistribution chamada:', { totalQty, cycle, cavities });
        const section = document.getElementById('shift-distribution-section');
        if (!section) {
            console.warn('[SHIFT DISTRIBUTION] Seção não encontrada no DOM');
            return;
        }
        
        // Armazenar dados base
        shiftDistributionData.totalQty = totalQty;
        shiftDistributionData.baseCycle = cycle;
        shiftDistributionData.baseCavities = cavities;
        
        // Calcular para cada turno usando o mesmo ciclo/cavidades (distribuição proporcional)
        const t1Qty = Math.round(totalQty * SHIFT_CONFIG.t1.percent);
        const t2Qty = Math.round(totalQty * SHIFT_CONFIG.t2.percent);
        const t3Qty = totalQty - t1Qty - t2Qty; // Garantir que soma = total
        
        // Atualizar dados
        shiftDistributionData.t1 = { cycle, cavities, qty: t1Qty, customized: false };
        shiftDistributionData.t2 = { cycle, cavities, qty: t2Qty, customized: false };
        shiftDistributionData.t3 = { cycle, cavities, qty: t3Qty, customized: false };
        
        // Atualizar UI
        updateShiftDistributionUI();
        
        // Mostrar seção
        section.style.display = 'block';
        
        // Atualizar campos ocultos do formulário
        updateShiftHiddenFields();
    }
    
    /**
     * Oculta a seção de distribuição por turno
     */
    function hideShiftDistribution() {
        const section = document.getElementById('shift-distribution-section');
        if (section) {
            section.style.display = 'none';
        }
        // Limpar dados
        shiftDistributionData = {
            totalQty: 0, baseCycle: 0, baseCavities: 0,
            t1: { cycle: 0, cavities: 0, qty: 0, customized: false },
            t2: { cycle: 0, cavities: 0, qty: 0, customized: false },
            t3: { cycle: 0, cavities: 0, qty: 0, customized: false }
        };
    }
    
    /**
     * Atualiza a UI da seção de distribuição por turno
     */
    function updateShiftDistributionUI() {
        // T1
        const t1El = document.getElementById('shift-t1-qty');
        const t1Input = document.getElementById('planned-qty-t1');
        if (t1El) t1El.textContent = shiftDistributionData.t1.qty.toLocaleString('pt-BR');
        if (t1Input) t1Input.value = shiftDistributionData.t1.qty;
        
        // T2
        const t2El = document.getElementById('shift-t2-qty');
        const t2Input = document.getElementById('planned-qty-t2');
        if (t2El) t2El.textContent = shiftDistributionData.t2.qty.toLocaleString('pt-BR');
        if (t2Input) t2Input.value = shiftDistributionData.t2.qty;
        
        // T3
        const t3El = document.getElementById('shift-t3-qty');
        const t3Input = document.getElementById('planned-qty-t3');
        if (t3El) t3El.textContent = shiftDistributionData.t3.qty.toLocaleString('pt-BR');
        if (t3Input) t3Input.value = shiftDistributionData.t3.qty;
    }
    
    /**
     * Atualiza os campos ocultos do formulário de planejamento
     */
    function updateShiftHiddenFields() {
        // Ciclo por turno
        const cycleT1 = document.getElementById('cycle-t1');
        const cycleT2 = document.getElementById('cycle-t2');
        const cycleT3 = document.getElementById('cycle-t3');
        if (cycleT1) cycleT1.value = shiftDistributionData.t1.cycle;
        if (cycleT2) cycleT2.value = shiftDistributionData.t2.cycle;
        if (cycleT3) cycleT3.value = shiftDistributionData.t3.cycle;
        
        // Cavidades por turno
        const cavitiesT1 = document.getElementById('cavities-t1');
        const cavitiesT2 = document.getElementById('cavities-t2');
        const cavitiesT3 = document.getElementById('cavities-t3');
        if (cavitiesT1) cavitiesT1.value = shiftDistributionData.t1.cavities;
        if (cavitiesT2) cavitiesT2.value = shiftDistributionData.t2.cavities;
        if (cavitiesT3) cavitiesT3.value = shiftDistributionData.t3.cavities;
    }
    
    /**
     * Abre o modal de customização por turno
     */
    function openShiftCustomizeModal() {
        console.log('[SHIFT DISTRIBUTION] Abrindo modal de customização');
        const modal = document.getElementById('shift-customize-modal');
        if (!modal) {
            console.warn('[SHIFT DISTRIBUTION] Modal não encontrado');
            return;
        }
        
        // Preencher campos com valores atuais
        document.getElementById('custom-cycle-t1').value = shiftDistributionData.t1.cycle || shiftDistributionData.baseCycle;
        document.getElementById('custom-cavities-t1').value = shiftDistributionData.t1.cavities || shiftDistributionData.baseCavities;
        document.getElementById('custom-qty-t1').value = shiftDistributionData.t1.qty;
        
        document.getElementById('custom-cycle-t2').value = shiftDistributionData.t2.cycle || shiftDistributionData.baseCycle;
        document.getElementById('custom-cavities-t2').value = shiftDistributionData.t2.cavities || shiftDistributionData.baseCavities;
        document.getElementById('custom-qty-t2').value = shiftDistributionData.t2.qty;
        
        document.getElementById('custom-cycle-t3').value = shiftDistributionData.t3.cycle || shiftDistributionData.baseCycle;
        document.getElementById('custom-cavities-t3').value = shiftDistributionData.t3.cavities || shiftDistributionData.baseCavities;
        document.getElementById('custom-qty-t3').value = shiftDistributionData.t3.qty;
        
        // Atualizar resumo
        updateShiftModalSummary();
        
        modal.classList.remove('hidden');
        
        // Reinicializar ícones Lucide no modal
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }
    
    /**
     * Fecha o modal de customização por turno
     */
    function closeShiftCustomizeModal() {
        const modal = document.getElementById('shift-customize-modal');
        if (modal) modal.classList.add('hidden');
    }
    
    /**
     * Recalcula a quantidade para um turno específico baseado no ciclo e cavidades
     * @param {string} shiftId - 't1', 't2' ou 't3'
     */
    window.recalculateShiftQty = function(shiftId) {
        const cycleInput = document.getElementById(`custom-cycle-${shiftId}`);
        const cavitiesInput = document.getElementById(`custom-cavities-${shiftId}`);
        const qtyInput = document.getElementById(`custom-qty-${shiftId}`);
        
        if (!cycleInput || !cavitiesInput || !qtyInput) return;
        
        const cycle = parseFloat(cycleInput.value) || 0;
        const cavities = parseInt(cavitiesInput.value) || 0;
        
        const shiftConfig = SHIFT_CONFIG[shiftId];
        if (!shiftConfig) return;
        
        const qty = calculateShiftQuantity(cycle, cavities, shiftConfig.hours);
        qtyInput.value = qty;
        
        updateShiftModalSummary();
    };
    
    /**
     * Atualiza o resumo no modal de customização
     */
    function updateShiftModalSummary() {
        const t1Qty = parseInt(document.getElementById('custom-qty-t1')?.value) || 0;
        const t2Qty = parseInt(document.getElementById('custom-qty-t2')?.value) || 0;
        const t3Qty = parseInt(document.getElementById('custom-qty-t3')?.value) || 0;
        
        const total = t1Qty + t2Qty + t3Qty;
        
        const totalEl = document.getElementById('shift-total-qty');
        const summaryT1 = document.getElementById('shift-summary-t1');
        const summaryT2 = document.getElementById('shift-summary-t2');
        const summaryT3 = document.getElementById('shift-summary-t3');
        
        if (totalEl) totalEl.textContent = total.toLocaleString('pt-BR');
        if (summaryT1) summaryT1.textContent = t1Qty.toLocaleString('pt-BR');
        if (summaryT2) summaryT2.textContent = t2Qty.toLocaleString('pt-BR');
        if (summaryT3) summaryT3.textContent = t3Qty.toLocaleString('pt-BR');
    }
    
    /**
     * Restaura a distribuição padrão (proporcional)
     */
    function resetShiftDistribution() {
        const total = shiftDistributionData.totalQty;
        const cycle = shiftDistributionData.baseCycle;
        const cavities = shiftDistributionData.baseCavities;
        
        if (total > 0 && cycle > 0 && cavities > 0) {
            // Recalcular distribuição proporcional
            const t1Qty = Math.round(total * SHIFT_CONFIG.t1.percent);
            const t2Qty = Math.round(total * SHIFT_CONFIG.t2.percent);
            const t3Qty = total - t1Qty - t2Qty;
            
            // Preencher modal
            document.getElementById('custom-cycle-t1').value = cycle;
            document.getElementById('custom-cavities-t1').value = cavities;
            document.getElementById('custom-qty-t1').value = t1Qty;
            
            document.getElementById('custom-cycle-t2').value = cycle;
            document.getElementById('custom-cavities-t2').value = cavities;
            document.getElementById('custom-qty-t2').value = t2Qty;
            
            document.getElementById('custom-cycle-t3').value = cycle;
            document.getElementById('custom-cavities-t3').value = cavities;
            document.getElementById('custom-qty-t3').value = t3Qty;
            
            updateShiftModalSummary();
        }
    }
    
    /**
     * Aplica a distribuição customizada ao formulário de planejamento
     */
    function applyShiftDistribution() {
        // Capturar valores do modal
        const t1Cycle = parseFloat(document.getElementById('custom-cycle-t1')?.value) || shiftDistributionData.baseCycle;
        const t1Cavities = parseInt(document.getElementById('custom-cavities-t1')?.value) || shiftDistributionData.baseCavities;
        const t1Qty = parseInt(document.getElementById('custom-qty-t1')?.value) || 0;
        
        const t2Cycle = parseFloat(document.getElementById('custom-cycle-t2')?.value) || shiftDistributionData.baseCycle;
        const t2Cavities = parseInt(document.getElementById('custom-cavities-t2')?.value) || shiftDistributionData.baseCavities;
        const t2Qty = parseInt(document.getElementById('custom-qty-t2')?.value) || 0;
        
        const t3Cycle = parseFloat(document.getElementById('custom-cycle-t3')?.value) || shiftDistributionData.baseCycle;
        const t3Cavities = parseInt(document.getElementById('custom-cavities-t3')?.value) || shiftDistributionData.baseCavities;
        const t3Qty = parseInt(document.getElementById('custom-qty-t3')?.value) || 0;
        
        // Atualizar dados
        shiftDistributionData.t1 = { cycle: t1Cycle, cavities: t1Cavities, qty: t1Qty, customized: true };
        shiftDistributionData.t2 = { cycle: t2Cycle, cavities: t2Cavities, qty: t2Qty, customized: true };
        shiftDistributionData.t3 = { cycle: t3Cycle, cavities: t3Cavities, qty: t3Qty, customized: true };
        
        // Atualizar total planejado
        const newTotal = t1Qty + t2Qty + t3Qty;
        shiftDistributionData.totalQty = newTotal;
        
        // Atualizar campo principal de quantidade planejada
        const plannedQtyInput = document.getElementById('planned-quantity');
        if (plannedQtyInput) {
            plannedQtyInput.value = newTotal;
        }
        
        // Atualizar UI da seção de distribuição
        updateShiftDistributionUI();
        
        // Atualizar campos ocultos
        updateShiftHiddenFields();
        
        // Fechar modal
        closeShiftCustomizeModal();
        
        // Feedback
        if (typeof window.showNotification === 'function') {
            window.showNotification('Distribuição por turno aplicada com sucesso!', 'success');
        } else {
            console.log('✅ Distribuição por turno aplicada com sucesso!');
        }
    }
    
    // Event Listeners para o modal de customização por turno
    // Registrar eventos diretamente (já estamos dentro de um DOMContentLoaded)
    setTimeout(function() {
        // Botão customizar na seção principal
        const customizeBtn = document.getElementById('customize-shifts-btn');
        if (customizeBtn) {
            customizeBtn.addEventListener('click', openShiftCustomizeModal);
        }
        
        // Botão fechar modal
        const closeBtn = document.getElementById('shift-customize-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', closeShiftCustomizeModal);
        }
        
        // Botão restaurar padrão
        const resetBtn = document.getElementById('shift-reset-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', resetShiftDistribution);
        }
        
        // Botão aplicar distribuição
        const applyBtn = document.getElementById('shift-apply-btn');
        if (applyBtn) {
            applyBtn.addEventListener('click', applyShiftDistribution);
        }
        
        // Fechar modal ao clicar fora
        const modal = document.getElementById('shift-customize-modal');
        if (modal) {
            modal.addEventListener('click', function(e) {
                if (e.target === modal) {
                    closeShiftCustomizeModal();
                }
            });
        }
        
        // Recalcular ao alterar campos no modal
        ['t1', 't2', 't3'].forEach(shift => {
            const cycleInput = document.getElementById(`custom-cycle-${shift}`);
            const cavitiesInput = document.getElementById(`custom-cavities-${shift}`);
            
            if (cycleInput) {
                cycleInput.addEventListener('input', () => {
                    recalculateShiftQty(shift);
                });
            }
            if (cavitiesInput) {
                cavitiesInput.addEventListener('input', () => {
                    recalculateShiftQty(shift);
                });
            }
        });
        
        console.log('[SHIFT DISTRIBUTION] Event listeners registrados com sucesso');
    }, 500); // Delay para garantir que o DOM está completamente carregado
    
    // ========================================
    // FIM - DISTRIBUIÇÃO POR TURNO
    // ========================================
    
    let cachedResolvedUserName = null;

    // Recupera sessão diretamente do armazenamento (sessionStorage > localStorage)
    function getStoredUserSession() {
        const storageSources = [() => sessionStorage, () => localStorage];
        for (const getStorage of storageSources) {
            try {
                const storage = getStorage();
                if (!storage) continue;
                const data = storage.getItem('synchro_user');
                if (data) {
                    const parsed = JSON.parse(data);
                    if (parsed && typeof parsed === 'object' && typeof parsed.name === 'string') {
                        parsed.name = parsed.name.trim();
                    }
                    console.log('📍 [DEBUG] getStoredUserSession() encontrou:', parsed);
                    return parsed;
                }
            } catch (error) {
                console.warn('⚠️ [DEBUG] Erro ao ler sessão armazenada:', error);
            }
        }
        console.warn('⚠️ [DEBUG] getStoredUserSession() não encontrou dados');
        return null;
    }

    // Obtém usuário ativo com fallback para sessão armazenada
    function getActiveUser() {
        const authUser = window.authSystem?.getCurrentUser?.();
        if (authUser && (authUser.username || authUser.name)) {
            return authUser;
        }

        const storedUser = getStoredUserSession();
        if (storedUser) {
            const sanitizedUser = { ...storedUser };
            if (typeof sanitizedUser.name === 'string') {
                sanitizedUser.name = sanitizedUser.name.trim();
            }
            if (window.authSystem?.setCurrentUser) {
                window.authSystem.setCurrentUser(sanitizedUser);
            } else if (window.authSystem) {
                window.authSystem.currentUser = sanitizedUser;
            }
            return sanitizedUser;
        }

        return {};
    }

    /**
     * Verifica se o usuário atual é gestor, suporte, lider ou tem acesso total (Leandro Camargo)
     * Usada para restringir funções de edição e exclusão
     */
    function isUserGestorOrAdmin() {
        const user = getActiveUser();
        if (!user) return false;
        
        // Usuários com acesso total (Leandro Camargo, Davi Batista ou role 'suporte')
        const isAuthorizedAdmin = 
            user.name === 'Leandro Camargo' || user.email === 'leandro@hokkaido.com.br' ||
            user.name === 'Davi Batista' || user.email === 'davi@hokkaido.com.br' ||
            user.role === 'suporte';
        if (isAuthorizedAdmin) return true;
        
        // Verificar se é gestor ou lider
        return user.role === 'gestor' || user.role === 'lider';
    }

    /**
     * Exibe notificação de permissão negada para operações restritas
     */
    function showPermissionDeniedNotification(action = 'realizar esta ação') {
        const message = `⮝ Permissão negada: Apenas gestores podem ${action}.`;
        showNotification(message, 'error');
        return false;
    }

    function deriveNameFromIdentifier(identifier) {
        if (!identifier || typeof identifier !== 'string') return '';
        const trimmed = identifier.trim();
        if (!trimmed) return '';
        const base = trimmed.includes('@') ? trimmed.split('@')[0] : trimmed;
        const sanitized = base.replace(/[^\w�-�.\-_\s]/g, ' ');
        const parts = sanitized.split(/[._\-\s]+/).filter(Boolean);
        if (!parts.length) return '';
        return parts.map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join(' ');
    }

    function persistResolvedUserName(name, currentUser) {
        if (!name || typeof name !== 'string') return;
        cachedResolvedUserName = name.trim();
        if (!cachedResolvedUserName) return;
        if (currentUser && typeof currentUser === 'object') {
            const updatedUser = { ...currentUser, name: cachedResolvedUserName };
            if (window.authSystem?.setCurrentUser) {
                window.authSystem.setCurrentUser(updatedUser);
            } else if (window.authSystem) {
                window.authSystem.currentUser = updatedUser;
            }
        }
    }

    // Função para obter o nome do usuário com fallback seguro
    function getCurrentUserName() {
        if (cachedResolvedUserName && cachedResolvedUserName !== 'Desconhecido') {
            return cachedResolvedUserName;
        }

        const currentUser = getActiveUser();
        console.log('📍 [DEBUG] getCurrentUserName() - currentUser:', currentUser);

        const candidateSources = [
            currentUser?.name,
            currentUser?.displayName,
            currentUser?.fullName,
            currentUser?.profile?.name,
            currentUser?.user?.name,
            currentUser?.user?.displayName
        ];

        for (const source of candidateSources) {
            if (typeof source === 'string' && source.trim()) {
                console.log('✅ [DEBUG] Nome obtido de fonte primária:', source.trim());
                persistResolvedUserName(source.trim(), currentUser);
                return cachedResolvedUserName;
            }
        }

        const usernameDerived = deriveNameFromIdentifier(currentUser?.username || currentUser?.user?.username);
        if (usernameDerived) {
            console.log('✅ [DEBUG] Nome derivado do username:', usernameDerived);
            persistResolvedUserName(usernameDerived, currentUser);
            return cachedResolvedUserName;
        }

        const emailDerived = deriveNameFromIdentifier(currentUser?.email || currentUser?.user?.email);
        if (emailDerived) {
            console.log('✅ [DEBUG] Nome derivado do e-mail:', emailDerived);
            persistResolvedUserName(emailDerived, currentUser);
            return cachedResolvedUserName;
        }

        const storedSession = getStoredUserSession();
        if (storedSession && typeof storedSession === 'object') {
            const storedCandidates = [
                storedSession.name,
                storedSession.displayName,
                storedSession.fullName
            ];
            for (const stored of storedCandidates) {
                if (typeof stored === 'string' && stored.trim()) {
                    console.log('✅ [DEBUG] Nome recuperado da sessão armazenada:', stored.trim());
                    persistResolvedUserName(stored.trim(), currentUser || storedSession);
                    return cachedResolvedUserName;
                }
            }

            const fallbackFromIdentifier = deriveNameFromIdentifier(storedSession.username || storedSession.email);
            if (fallbackFromIdentifier) {
                console.log('✅ [DEBUG] Nome derivado da sessão armazenada:', fallbackFromIdentifier);
                persistResolvedUserName(fallbackFromIdentifier, currentUser || storedSession);
                return cachedResolvedUserName;
            }
        }

        console.warn('⚠️ [DEBUG] Nenhum nome encontrado, retornando "Desconhecido"');
        cachedResolvedUserName = 'Desconhecido';
        return cachedResolvedUserName;
    }
    
    // Funções para normalizar datas conforme o ciclo de trabalho (6h30 a 6h29 do dia seguinte)
    // Turno 1: 06:30 - 14:59 | Turno 2: 15:00 - 23:19 | Turno 3: 23:20 - 06:29

    function getWorkDay(dateStr, timeStr) {
        if (!dateStr) return null;

        let hours = 12; // padrão neutro (meio-dia)
        let mins = 0;
        if (typeof timeStr === 'string' && timeStr.includes(':')) {
            const [timeHours, timeMinutes] = timeStr.split(':').map(Number);
            if (!Number.isNaN(timeHours)) {
                hours = timeHours;
                mins = timeMinutes || 0;
            }
        }

        // Se for 6:30 ou depois, é do dia atual
        if (hours > 6 || (hours === 6 && mins >= 30)) {
            return dateStr;
        }

        const [year, month, day] = dateStr.split('-').map(Number);
        if ([year, month, day].some(n => Number.isNaN(n))) return dateStr;

        const baseDate = new Date(year, (month || 1) - 1, day || 1);
        baseDate.setDate(baseDate.getDate() - 1);
        return baseDate.toISOString().split('T')[0];
    }

    // Wrapper para compatibilidade com chamadas antigas
    function getWorkDayFromDate(dateStr, timeStr) {
        return getWorkDay(dateStr, timeStr);
    }

    function normalizeToDate(value) {
        if (!value) return null;
        if (value instanceof Date) {
            return Number.isNaN(value.getTime()) ? null : value;
        }
        if (value && typeof value.toDate === 'function') {
            const converted = value.toDate();
            return converted instanceof Date && !Number.isNaN(converted.getTime()) ? converted : null;
        }
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    function resolveProductionDateTime(raw) {
        if (!raw || typeof raw !== 'object') return null;

        const candidates = [];

        if (raw.dataHoraInformada) {
            candidates.push(raw.dataHoraInformada);
        }

        if (raw.horaInformada && (raw.data || raw.date)) {
            candidates.push(`${raw.data || raw.date}T${raw.horaInformada}`);
        }

        if (raw.datetime) {
            candidates.push(raw.datetime);
        }

        candidates.push(raw.timestamp);
        candidates.push(raw.createdAt);
        candidates.push(raw.updatedAt);

        for (const candidate of candidates) {
            const dateObj = normalizeToDate(candidate);
            if (dateObj) {
                return dateObj;
            }
        }

        return null;
    }

    function getWorkDayFromTimestamp(timestamp) {
        const dateObj = normalizeToDate(timestamp);
        if (!(dateObj instanceof Date)) return null;
        if (Number.isNaN(dateObj.getTime())) return null;
        const isoString = new Date(dateObj.getTime() - dateObj.getTimezoneOffset() * 60000).toISOString();
        const [datePart, timePart] = isoString.split('T');
        return getWorkDay(datePart, timePart?.substring(0, 5));
    }

    function populateLossOptions() {
        const perdasSelect = document.getElementById('production-entry-perdas');
        if (!perdasSelect) return;
        
        const groupedReasons = window.getGroupedLossReasons();
        let options = '<option value="">Nenhum</option>';
        
        // Adicionar opções agrupadas
        Object.entries(groupedReasons).forEach(([group, reasons]) => {
            options += `<optgroup label="${group}">`;
            reasons.forEach(reason => {
                options += `<option value="${reason}">${reason}</option>`;
            });
            options += `</optgroup>`;
        });
        
        perdasSelect.innerHTML = options;
    }

    function showLoadingState(panel, isLoading, noData = false) {
        const loadingEl = document.getElementById(`${panel}-loading`);
        const noDataEl = document.getElementById(`${panel}-no-data`);
        const contentEl = panel === 'leader-panel' ? leaderLaunchPanel : 
                        panel === 'launch-panel' ? launchPanelContainer : 
                        panel === 'resumo' ? resumoContentContainer :
                        document.getElementById('dashboard-content');

        if (isLoading) {
            if (loadingEl) loadingEl.style.display = 'block';
            if (noDataEl) noDataEl.style.display = 'none';
            if (contentEl) contentEl.style.display = 'none';
        } else {
            if (loadingEl) loadingEl.style.display = 'none';
            if (noData) {
                if (noDataEl) noDataEl.style.display = 'block';
                if (contentEl) contentEl.style.display = 'none';
            } else {
                if (noDataEl) noDataEl.style.display = 'none';
                if (contentEl) {
                    if (panel.includes('dashboard') || panel.includes('resumo') || panel.includes('list')) {
                        contentEl.style.display = 'block';
                    } else {
                        contentEl.style.display = 'grid';
                    }
                }
            }
        }
    }

    function showConfirmModal(id, collection) {
        // ⚠️ VERIFICAÇÃO DE PERMISSÃO: Apenas gestores podem excluir
        if (!isUserGestorOrAdmin()) {
            showPermissionDeniedNotification('excluir registros');
            return;
        }
        
        docIdToDelete = id;
        collectionToDelete = collection;
        try { console.log('[TRACE][showConfirmModal] target', { id, collection }); } catch(e) { /* noop */ }

        let message = 'Tem a certeza de que deseja excluir este lançamento? Esta ação não pode ser desfeita.';
        if (collection === 'downtime_entries') {
            message = 'Tem a certeza de que deseja excluir este registro de parada? Esta ação não pode ser desfeita.';
        } else if (collection === 'planning') {
            message = 'Tem a certeza de que deseja excluir este planejamento? Todos os lançamentos de produção associados também serão removidos.';
        }

        // Usar confirm nativo para garantir que o usuário consiga confirmar mesmo se o modal customizado falhar
        const userConfirmed = window.confirm(message);
        if (userConfirmed) {
            executeDelete();
        } else {
            hideConfirmModal();
        }
    }
    
    function hideConfirmModal() {
        docIdToDelete = null;
        collectionToDelete = null;
        if (confirmModal) confirmModal.classList.add('hidden');
    }
    
    async function executeDelete() {
        try { console.log('[TRACE][executeDelete] called', { docIdToDelete, collectionToDelete }); } catch(e){}
        if (!docIdToDelete || !collectionToDelete) {
            try { console.warn('[TRACE][executeDelete] missing target', { docIdToDelete, collectionToDelete }); } catch(e){}
            return;
        }
        
        const docRef = db.collection(collectionToDelete).doc(docIdToDelete);

        try {
            console.log('[TRACE][executeDelete] deleting', { id: docIdToDelete, collection: collectionToDelete });
            
            // 🔄 CRÍTICO: Se for production_entries, subtrair o valor da OP antes de excluir
            if (collectionToDelete === 'production_entries') {
                const entryDoc = await docRef.get();
                if (entryDoc.exists) {
                    const entryData = entryDoc.data();
                    const produzido = coerceToNumber(entryData.produzido || entryData.produced || entryData.quantity, 0);
                    const orderId = entryData.orderId || entryData.order_id;
                    const planId = entryData.planId;
                    
                    console.log('[SYNC-DELETE] Subtraindo produção da OP:', { produzido, orderId, planId });
                    
                    // Subtrair da OP (production_orders)
                    if (orderId && produzido > 0) {
                        try {
                            const orderRef = db.collection('production_orders').doc(orderId);
                            const orderSnap = await orderRef.get();
                            if (orderSnap.exists) {
                                const orderData = orderSnap.data() || {};
                                const currentTotal = coerceToNumber(orderData.total_produzido ?? orderData.totalProduced, 0);
                                const newTotal = Math.max(0, currentTotal - produzido);
                                await orderRef.update({
                                    total_produzido: newTotal,
                                    totalProduced: newTotal,
                                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                                });
                                console.log(`[SYNC-DELETE] OP ${orderId} atualizada: total_produzido ${currentTotal} → ${newTotal}`);
                            }
                        } catch (orderErr) {
                            console.warn('[SYNC-DELETE] Falha ao atualizar total da OP:', orderErr);
                        }
                    }
                    
                    // Subtrair do planejamento também
                    if (planId && produzido > 0) {
                        try {
                            const planRef = db.collection('planning').doc(planId);
                            const planSnap = await planRef.get();
                            if (planSnap.exists) {
                                const planData = planSnap.data() || {};
                                const currentPlanTotal = coerceToNumber(planData.total_produzido, 0);
                                const newPlanTotal = Math.max(0, currentPlanTotal - produzido);
                                await planRef.update({
                                    total_produzido: newPlanTotal,
                                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                                });
                                console.log(`[SYNC-DELETE] Plano ${planId} atualizado: total_produzido ${currentPlanTotal} → ${newPlanTotal}`);
                            }
                        } catch (planErr) {
                            console.warn('[SYNC-DELETE] Falha ao atualizar total do plano:', planErr);
                        }
                    }
                }
            }
            
            if (collectionToDelete === 'planning') {
                const prodEntriesSnapshot = await db.collection('production_entries').where('planId', '==', docIdToDelete).get();
                const batch = db.batch();
                prodEntriesSnapshot.docs.forEach(doc => {
                    batch.delete(doc.ref);
                });
                await batch.commit();
            }

            await docRef.delete();
            try { showNotification('Item excluído com sucesso.', 'success'); } catch(e) { /* noop */ }
            
            // Registrar log da exclusão
            registrarLogSistema('EXCLUSÃO DE REGISTRO', collectionToDelete, {
                docId: docIdToDelete,
                collection: collectionToDelete
            });
            
            if (pageTitle && pageTitle.textContent === 'Análise' && currentAnalysisView === 'resumo') {
                window.loadResumoData?.();
            }

            if (collectionToDelete === 'production_entries' || collectionToDelete === 'downtime_entries' || collectionToDelete === 'rework_entries') {
                recentEntriesCache.delete(docIdToDelete);
                await loadRecentEntries(false);
                
                // 🔄 Recarregar ordens para atualizar os cards
                if (collectionToDelete === 'production_entries') {
                    productionOrdersCache = null; // Invalidar cache
                    // Se estiver na view de ordens, recarregar
                    if (currentAnalysisView === 'orders') {
                        await loadOrdersAnalysis();
                    }
                }
                
                // 🔄 Invalidar cache de paradas e recarregar aba se necessário
                if (collectionToDelete === 'downtime_entries') {
                    cachedDowntimeDataForChart = []; // Limpar cache do gráfico de paradas
                    if (typeof invalidateDowntimeCache === 'function') {
                        invalidateDowntimeCache();
                    }
                    if (window.DataStore) {
                        window.DataStore.invalidate('downtimeEntries');
                    }
                    if (window.CacheManager) {
                        window.CacheManager.invalidate('downtime_entries');
                    }
                    // Se estiver na view de paradas, recarregar
                    if (currentAnalysisView === 'downtime') {
                        await loadDowntimeAnalysis();
                    }
                }
            }


        } catch (error) {
            console.error("Erro ao excluir: ", error);
            const code = error && (error.code || error.name) || '';
            const msg = code === 'permission-denied'
                ? 'Permissão negada para excluir este item. Verifique seu perfil de acesso.'
                : 'Não foi possível excluir o item e/ou seus dados associados.';
            try { showNotification(msg, 'error'); } catch(e) { /* noop */ }
            alert(msg);
        } finally {
            hideConfirmModal();
        }
    }

    // --- BANCO DE DADOS DE CAIXAS DE TARA ---
    const taraBoxesDatabase = {
        "H-01": { "peso": 0, "descricao": "caixa plastica" },
        "H-02": { "peso": 0, "descricao": "caixa plastica" },
        "H-03": { "peso": 0, "descricao": "caixa plastica" },
        "H-04": { "peso": 0, "descricao": "caixa plastica" },
        "H-05": { "peso": 0, "descricao": "caixa plastica" },
        "H-06": { "peso": 0, "descricao": "caixa plastica" },
        "H-07": { "peso": 0, "descricao": "caixa plastica" },
        "H-08": { "peso": 0, "descricao": "caixa plastica" },
        "H-09": { "peso": 0, "descricao": "caixa plastica" },
        "H-10": { "peso": 0, "descricao": "caixa plastica" },
        "H-11": { "peso": 0, "descricao": "caixa plastica" },
        "H-12": { "peso": 0, "descricao": "caixa plastica" },
        "H-13": { "peso": 0, "descricao": "caixa plastica" },
        "H-14": { "peso": 0, "descricao": "caixa plastica" },
        "H-15": { "peso": 0, "descricao": "caixa plastica" },
        "H-16": { "peso": 0, "descricao": "caixa plastica" },
        "H-17": { "peso": 0, "descricao": "caixa plastica" },
        "H-18": { "peso": 0, "descricao": "caixa plastica" },
        "H-19": { "peso": 0, "descricao": "caixa plastica" },
        "H-20": { "peso": 0, "descricao": "caixa plastica" },
        "H-26": { "peso": 0, "descricao": "caixa plastica" },
        "H-27": { "peso": 0, "descricao": "caixa plastica" },
        "H-28": { "peso": 0, "descricao": "caixa plastica" },
        "H-29": { "peso": 0, "descricao": "caixa plastica" },
        "H-30": { "peso": 0, "descricao": "caixa plastica" },
        "H-31": { "peso": 0, "descricao": "caixa plastica" },
        "H-32": { "peso": 0, "descricao": "caixa plastica" }
    };

    // --- FUNÇÕES DO NOVO SISTEMA DE LANÇAMENTOS POR HORA ---

    // Função para carregar lançamentos por hora
    async function loadHourlyEntries(planId, turno) {
        const entriesRef = db.collection('hourly_production_entries');
        const q = entriesRef.where('planId', '==', planId).where('turno', '==', turno);
        const querySnapshot = await q.get();
        
        const entriesContainer = document.getElementById('hourly-entries-container');
        if (!entriesContainer) return;
        
        entriesContainer.innerHTML = '';
        
        const hours = [
            '08:00', '09:00', '10:00', '11:00', '12:00',
            '13:00', '14:00', '15:00', '16:00', '17:00', '18:00',
            '19:00', '20:00', '21:00', '22:00', '23:00', '00:00',
            '01:00', '02:00', '03:00', '04:00', '05:00', '06:00', '07:00'
        ];
        
        const existingEntries = {};
        querySnapshot.forEach(doc => {
            const data = doc.data();
            existingEntries[data.hora] = { id: doc.id, ...data };
        });
        
        hours.forEach(hora => {
            const entry = existingEntries[hora] || { hora, peso_bruto: '', usar_tara: false, embalagem_fechada: '' };
            const entryElement = createHourlyEntryElement(entry, planId, turno);
            entriesContainer.appendChild(entryElement);
        });
        
        updateTotalCalculation();
        lucide.createIcons();
            // Atualizar aba de análise se estiver aberta
            await refreshAnalysisIfActive();
    }

    // Função para criar elemento de lançamento por hora
    function createHourlyEntryElement(entry, planId, turno) {
        const div = document.createElement('div');
        div.className = 'hourly-entry grid grid-cols-13 gap-2 items-center p-2 border-b text-sm';
        div.innerHTML = `
            <div class="col-span-2 font-medium">${entry.hora}</div>
            <div class="col-span-3">
                <input type="number" step="0.01" 
                       value="${entry.peso_bruto || ''}" 
                       placeholder="Peso bruto (kg)"
                       class="peso-bruto-input w-full p-1 border rounded"
                       data-hora="${entry.hora}">
            </div>
            <div class="col-span-2 flex items-center">
                <input type="checkbox" ${entry.usar_tara ? 'checked' : ''} 
                       class="usar-tara-checkbox mr-1"
                       data-hora="${entry.hora}">
                <span class="text-xs">Usar Tara</span>
            </div>
            <div class="col-span-2">
                <input type="number" 
                       value="${entry.embalagem_fechada || ''}" 
                       placeholder="Embalagens"
                       class="embalagem-fechada-input w-full p-1 border rounded"
                       data-hora="${entry.hora}">
            </div>
            <div class="col-span-3">
                <span class="pecas-calculadas text-sm font-semibold">0 peças</span>
            </div>
            <div class="col-span-1">
                ${entry.id ? 
                    `<button type="button" class="delete-hourly-entry text-red-600 hover:text-red-800" data-id="${entry.id}">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>` : 
                    ''
                }
            </div>
        `;
        return div;
    }

    // Função para buscar peso da peça do planejamento
    async function getPieceWeightFromPlan(planId) {
        try {
            const planDoc = await db.collection('planning').doc(planId).get();
            if (planDoc.exists) {
                return planDoc.data().piece_weight || 0;
            }
        } catch (error) {
            console.error("Erro ao buscar peso da peça:", error);
        }
        return 0;
    }

    // Função para calcular totais
    async function updateTotalCalculation() {
        const planId = document.getElementById('production-entry-plan-id').value;
        const pieceWeight = await getPieceWeightFromPlan(planId);
        const useTara = document.getElementById('use-tara-box').checked;
        const taraWeight = parseFloat(document.getElementById('tara-box-weight').value) || 0;
        
        let totalPesoLiquido = 0;
        let totalPecas = 0;
        
        // Calcular totais de cada hora
        document.querySelectorAll('.hourly-entry').forEach(entry => {
            const pesoBruto = parseFloat(entry.querySelector('.peso-bruto-input').value) || 0;
            const usarTara = entry.querySelector('.usar-tara-checkbox').checked;
            const embalagemFechada = parseInt(entry.querySelector('.embalagem-fechada-input').value) || 0;
            
            const pesoLiquido = usarTara && useTara ? 
                Math.max(0, pesoBruto - taraWeight) : pesoBruto;
            
            // Calcular peças: por peso + por embalagem fechada
            const pecasPorPeso = pieceWeight > 0 ? Math.round((pesoLiquido * 1000) / pieceWeight) : 0;
            const pecasPorEmbalagem = embalagemFechada; // Assumindo 1 embalagem = 1 peça
            
            const pecasTotal = pecasPorPeso + pecasPorEmbalagem;
            
            if (entry.querySelector('.pecas-calculadas')) {
                entry.querySelector('.pecas-calculadas').textContent = `${pecasTotal} peças`;
            }
            
            totalPesoLiquido += pesoLiquido;
            totalPecas += pecasTotal;
        });
        
        // Atualizar totais
        const totalPesoLiquidoEl = document.getElementById('total-peso-liquido');
        const totalPecasEl = document.getElementById('total-pecas');
        const produzidoInput = document.getElementById('production-entry-produzido');
        
        if (totalPesoLiquidoEl) totalPesoLiquidoEl.textContent = `${totalPesoLiquido.toFixed(3)} kg`;
        if (totalPecasEl) totalPecasEl.textContent = totalPecas.toLocaleString('pt-BR');
        if (produzidoInput) produzidoInput.value = totalPecas;
    }

    // Função para salvar lançamentos por hora
    async function saveHourlyEntries(planId, turno) {
        const entries = [];
        
        document.querySelectorAll('.hourly-entry').forEach(entry => {
            const hora = entry.querySelector('.peso-bruto-input').dataset.hora;
            const pesoBruto = parseFloat(entry.querySelector('.peso-bruto-input').value) || 0;
            const usarTara = entry.querySelector('.usar-tara-checkbox').checked;
            const embalagemFechada = parseInt(entry.querySelector('.embalagem-fechada-input').value) || 0;
            
            if (pesoBruto > 0 || embalagemFechada > 0) {
                entries.push({
                    planId,
                    turno,
                    hora,
                    peso_bruto: pesoBruto,
                    usar_tara: usarTara,
                    embalagem_fechada: embalagemFechada,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
        });
        
        // Salvar no Firestore
        const batch = db.batch();
        entries.forEach(entry => {
            const docRef = db.collection('hourly_production_entries').doc();
            batch.set(docRef, entry);
        });
        
        await batch.commit();
    }

    // --- INITIALIZATION ---
    function init() {
        // Verificar autenticação primeiro (com pequeno delay para garantir carregamento)
        setTimeout(() => {
            if (!window.authSystem || !window.authSystem.getCurrentUser()) {
                console.warn('⚠️ Autenticação não encontrada. Redirecionando para login...');
                window.location.href = 'login.html';
                return;
            }
            
            console.log('✅ Usuário autenticado. Inicializando interface...');
            
            // Atualizar interface com informações do usuário
            if (window.authSystem && typeof window.authSystem.updateUserInterface === 'function') {
                window.authSystem.updateUserInterface();
            }
            
            setTodayDate();
            restoreSidebarState();
            setupEventListeners();
            setupLaunchTab();
            populateLossOptions();
            
            // Pré-carregar controller de paradas longas (registra window.* exports)
            import('./src/controllers/extended-downtime.controller.js').catch(err => {
                console.warn('[EXTENDED-DOWNTIME] Pré-carregamento falhou:', err);
            });
            
            // Pré-carregar controller de parada avulsa/lote (registra window.* exports)
            import('./src/controllers/downtime-grid.controller.js').catch(err => {
                console.warn('[DOWNTIME-GRID] Pré-carregamento falhou:', err);
            });

            // Pré-carregar controller de dashboard (registra window.* exports)
            import('./src/controllers/dashboard.controller.js').catch(err => {
                console.warn('[DASHBOARD] Pré-carregamento falhou:', err);
            });

            // Pré-carregar controller de resumo + OEE (registra window.* exports)
            import('./src/controllers/resumo.controller.js').catch(err => {
                console.warn('[RESUMO] Pré-carregamento falhou:', err);
            });

            // Pré-carregar service de downtime shift splitting (registra window.* exports)
            import('./src/services/downtime-shift.service.js').catch(err => {
                console.warn('[DOWNTIME-SHIFT] Pré-carregamento falhou:', err);
            });

            // Pré-carregar color/formatting utils (registra window.* exports)
            import('./src/utils/color.utils.js').catch(err => {
                console.warn('[COLOR-UTILS] Pré-carregamento falhou:', err);
            });
            
            // Inicializar dados básicos
            loadAnalysisMachines();
            populateQuickFormOptions();
            
            // Verificar se os elementos críticos existem
            setTimeout(() => {
                console.log('📍 Verificando elementos críticos...');
                console.log('machine-selector:', !!document.getElementById('machine-selector'));
                console.log('quick-production-form:', !!document.getElementById('quick-production-form'));
                console.log('quick-losses-form:', !!document.getElementById('quick-losses-form'));
                console.log('quick-downtime-form:', !!document.getElementById('quick-downtime-form'));
                console.log('btn-losses:', !!document.getElementById('btn-losses'));
                console.log('btn-downtime:', !!document.getElementById('btn-downtime'));
            }, 1000);
            
            if (productionModalForm && !document.getElementById('production-entry-plan-id')) {
                const planIdInput = document.createElement('input');
                planIdInput.type = 'hidden';
                planIdInput.id = 'production-entry-plan-id';
                planIdInput.name = 'planId';
                productionModalForm.prepend(planIdInput);
            }
            
            // Iniciar atualização automática de OEE em tempo real (a cada 60 minutos — otimizado Fase 2, era 30min)
            setInterval(updateRealTimeOeeData, 60 * 60 * 1000);
            
            // Iniciar atualização automática da timeline (a cada 30 minutos — otimizado Fase 2, era 10min)
            setInterval(updateTimelineIfVisible, 30 * 60 * 1000);
            
            // Atualizar imediatamente se estivermos na aba de dashboard ou análise
            setTimeout(updateRealTimeOeeData, 2000);
            
            // Adicionar listener para redimensionar gráficos
            const debouncedResize = debounce(handleWindowResize, 250);
            window.addEventListener('resize', debouncedResize);
            window.addEventListener('orientationchange', () => setTimeout(debouncedResize, 300));
            
            // Final da inicialização - carregar aba de lançamento por padrão
            loadLaunchPanel();
            lucide.createIcons();
        }, 300); // Fim do setTimeout da autenticação
    }
    
    // Verificar se a aba está visível (otimização para não fazer refresh em background)
    function isPageVisible() {
        return document.visibilityState === 'visible';
    }
    
    // Função para atualizar dados de OEE em tempo real
    async function updateRealTimeOeeData() {
        try {
            // Otimização: Não atualizar se a aba não estiver visível
            if (!isPageVisible()) {
                console.log('[OEE] Aba não visível, pulando atualização');
                return;
            }
            
            // Verificar se estamos na aba de dashboard ou análise
            const currentPage = document.querySelector('.nav-btn.active')?.dataset.page;
            if (currentPage !== 'analise') {
                return;
            }
            
            // Verificar se estamos visualizando dados de hoje
            const today = getProductionDateString();
            const selectedDate = resumoDateSelector ? resumoDateSelector.value : today;
            
            if (selectedDate !== today) {
                return;
            }
            
            // Recarregar dados apenas se estiver na visualização atual
            const currentView = document.querySelector('.analysis-tab-btn.active')?.dataset.view;
            
            if (currentView === 'dashboard') {
                // Atualizar dados do dashboard sem mostrar loading
                const startDate = startDateSelector ? startDateSelector.value : today;
                const endDate = endDateSelector ? endDateSelector.value : today;
                
                if (startDate === today && endDate === today) {
                    const prodSnapshot = await db.collection('production_entries')
                        .where('data', '==', today)
                        .get();
                    const productions = prodSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    
                    if (productions.length > 0) {
                        const planIds = [...new Set(productions.map(p => p.planId))];
                        const plans = {};
                        
                        for (let i = 0; i < planIds.length; i += 10) {
                            const batchIds = planIds.slice(i, i + 10);
                            if (batchIds.length > 0) {
                                const planBatchSnapshot = await db.collection('planning')
                                    .where(firebase.firestore.FieldPath.documentId(), 'in', batchIds)
                                    .get();
                                planBatchSnapshot.docs.forEach(doc => {
                                    plans[doc.id] = doc.data();
                                });
                            }
                        }
                        
                        const combinedData = productions.filter(prod => plans[prod.planId])
                            .map(prod => ({ ...prod, ...plans[prod.planId] }));
                        
                        window.fullDashboardData = { perdas: combinedData };
                        window.processAndRenderDashboard?.(window.fullDashboardData);
                    }
                }
            } else if (currentView === 'resumo') {
                // Atualizar dados do resumo silenciosamente
                window.loadResumoData?.(false); // false = não mostrar loading
            }
            
        } catch (error) {
            console.error("Erro ao atualizar dados OEE em tempo real: ", error);
        }
    }
    
    // loadAnalysisData removido — controller analysis.controller.js trata via refreshAnalysisIfActive


    function computeOrderExecutionMetrics(order, productionTotalsByOrderId) {
        const lotSize = coerceToNumber(order.lot_size, 0);
        const status = (order.status || '').toLowerCase();
        const isFinishedStatus = ['concluida', 'finalizada', 'encerrada'].includes(status);

        const aggregateTotals = productionTotalsByOrderId.get(order.id) || 0;
        const storedTotals = coerceToNumber(order.total_produzido ?? order.totalProduced, 0);

        // CORREÇÃO: Sempre usar o MAIOR valor entre armazenado e agregado
        // Isso garante que novos lançamentos após edição manual sejam contabilizados
        const totalProduced = Math.max(aggregateTotals, storedTotals, 0);

        const computedProgress = lotSize > 0
            ? Math.min((totalProduced / lotSize) * 100, 100)
            : 0;
        const progress = isFinishedStatus && computedProgress < 100 ? 100 : computedProgress;
        const remaining = isFinishedStatus
            ? 0
            : Math.max(0, lotSize - totalProduced);

        return {
            lotSize,
            totalProduced,
            progress,
            remaining,
            isComplete: isFinishedStatus || (lotSize > 0 && totalProduced >= lotSize),
            hasProduction: totalProduced > 0
        };
    }

    async function loadOrdersAnalysis() {
        console.log('📋 Carregando análise de ordens de produção');

        // Usar cache otimizado para reduzir leituras do Firebase
        let ordersDataset = Array.isArray(productionOrdersCache) ? [...productionOrdersCache] : [];

        if (ordersDataset.length === 0) {
            try {
                // Usar função cacheada para economizar leituras
                ordersDataset = await getProductionOrdersCached();
                productionOrdersCache = ordersDataset;
                console.log('📋 Ordens carregadas (cache/Firebase):', ordersDataset.length);
            } catch (error) {
                console.error('Erro ao recuperar ordens de produção para análise:', error);
            }
        } else {
            console.log('📋 Usando cache de ordens:', ordersDataset.length);
        }

        if (!ordersDataset || ordersDataset.length === 0) {
            console.warn('❌ Nenhuma ordem de produção encontrada.');
            showAnalysisNoData('Nenhuma ordem de produção cadastrada.');
            return;
        }

        const ordersGrid = document.getElementById('orders-grid');
        if (!ordersGrid) {
            console.error('❌ Elemento orders-grid não encontrado no DOM');
            return;
        }

        const startDateStr = currentAnalysisFilters.startDate;
        const endDateStr = currentAnalysisFilters.endDate;

        const normalizedOrders = ordersDataset.map(order => ({
            ...order,
            normalizedCode: String(order.part_code || order.product_cod || '').trim()
        }));

        // CORREÇÃO: Mapear produção por ID de ordem SEM filtro de data
        // Isso garante que o progresso exibido seja o mesmo dos cards de máquinas
        // Os valores são pegos diretamente do total_produzido armazenado na OP (atualizado a cada lançamento)
        // ou calculados a partir de TODOS os lançamentos da ordem (sem filtro de data)
        const productionTotalsByOrderId = new Map();

        try {
            // Buscar TODOS os lançamentos de produção (sem filtro de data)
            // para garantir consistência com os cards de máquinas
            const orderIds = normalizedOrders.map(o => o.id).filter(id => id);
            
            if (orderIds.length > 0) {
                // Buscar em lotes de 10 (limite do Firestore para 'in')
                const batchSize = 10;
                for (let i = 0; i < orderIds.length; i += batchSize) {
                    const batchIds = orderIds.slice(i, i + batchSize);
                    const productionSnapshot = await db.collection('production_entries')
                        .where('orderId', 'in', batchIds)
                        .get();

                    productionSnapshot.docs.forEach(doc => {
                        const data = doc.data();
                        const orderId = data.orderId || data.order_id;
                        
                        if (!orderId) return;

                        const producedQty = coerceToNumber(data.produzido ?? data.quantity, 0);
                        if (!Number.isFinite(producedQty) || producedQty <= 0) {
                            return;
                        }

                        productionTotalsByOrderId.set(
                            orderId,
                            (productionTotalsByOrderId.get(orderId) || 0) + producedQty
                        );
                    });
                }
            }
        } catch (error) {
            console.error('Erro ao carregar lançamentos para análise de ordens:', error);
        }

        // Preencher dropdown de máquinas com máquinas usadas nas ordens
        populateOrdersMachineFilter(normalizedOrders);

        const ordersWithProgress = normalizedOrders.map(order => {
            const metrics = computeOrderExecutionMetrics(order, productionTotalsByOrderId);
            return { ...order, ...metrics };
        });

        // Aplicar filtros de status, máquina e pesquisa
        const ordersStatusFilter = document.getElementById('orders-status-filter')?.value || '';
        const ordersMachineFilter = document.getElementById('analysis-orders-machine-filter')?.value || '';
        const ordersSearchQuery = document.getElementById('orders-search')?.value.toLowerCase() || '';
        const ordersSortValue = document.getElementById('orders-sort-filter')?.value || 'recent';

        let filteredOrders = ordersWithProgress;

        // Filtro por status
        if (ordersStatusFilter) {
            filteredOrders = filteredOrders.filter(order => {
                const status = (order.status || '').toLowerCase();
                if (ordersStatusFilter === 'planejada') return status === 'planejada';
                if (ordersStatusFilter === 'em_andamento') return status === 'em_andamento';
                if (ordersStatusFilter === 'ativa') return status === 'ativa';
                if (ordersStatusFilter === 'concluida') return status === 'concluida' || status === 'finalizada';
                if (ordersStatusFilter === 'cancelada') return status === 'cancelada';
                return true;
            });
        }

        // Filtro por máquina
        if (ordersMachineFilter) {
            filteredOrders = filteredOrders.filter(order => {
                return order.machine_id === ordersMachineFilter;
            });
        }

        // Filtro de busca
        if (ordersSearchQuery) {
            filteredOrders = filteredOrders.filter(order => 
                (order.order_number || '').toLowerCase().includes(ordersSearchQuery) ||
                (order.product || '').toLowerCase().includes(ordersSearchQuery) ||
                (order.part_code || '').toLowerCase().includes(ordersSearchQuery) ||
                (order.customer || '').toLowerCase().includes(ordersSearchQuery)
            );
        }

        // Ordenação
        filteredOrders.sort((a, b) => {
            switch (ordersSortValue) {
                case 'recent':
                    const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt) || new Date(0);
                    const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt) || new Date(0);
                    return dateB - dateA;
                case 'oldest':
                    const dateA2 = a.createdAt?.toDate?.() || new Date(a.createdAt) || new Date(0);
                    const dateB2 = b.createdAt?.toDate?.() || new Date(b.createdAt) || new Date(0);
                    return dateA2 - dateB2;
                case 'progress-desc':
                    return (b.progress || 0) - (a.progress || 0);
                case 'progress-asc':
                    return (a.progress || 0) - (b.progress || 0);
                case 'lot-desc':
                    return (Number(b.lot_size) || 0) - (Number(a.lot_size) || 0);
                case 'lot-asc':
                    return (Number(a.lot_size) || 0) - (Number(b.lot_size) || 0);
                case 'alpha':
                case 'name-asc':
                    return (a.order_number || '').localeCompare(b.order_number || '');
                default:
                    return 0;
            }
        });

        // ===== ATUALIZAR KPIs =====
        const totalOrders = ordersWithProgress.length;
        const activeOrders = ordersWithProgress.filter(o => ['ativa', 'em_andamento'].includes((o.status || '').toLowerCase())).length;
        const completedOrders = ordersWithProgress.filter(o => ['concluida', 'finalizada'].includes((o.status || '').toLowerCase())).length;
        const avgProgress = totalOrders > 0 
            ? Math.round(ordersWithProgress.reduce((sum, o) => sum + (o.progress || 0), 0) / totalOrders)
            : 0;

        // Atualizar elementos KPI no DOM
        const kpiTotal = document.getElementById('orders-kpi-total');
        const kpiActive = document.getElementById('orders-kpi-active');
        const kpiCompleted = document.getElementById('orders-kpi-completed');
        const kpiProgress = document.getElementById('orders-kpi-avg-progress');

        if (kpiTotal) kpiTotal.textContent = totalOrders.toLocaleString('pt-BR');
        if (kpiActive) kpiActive.textContent = activeOrders.toLocaleString('pt-BR');
        if (kpiCompleted) kpiCompleted.textContent = completedOrders.toLocaleString('pt-BR');
        if (kpiProgress) kpiProgress.textContent = `${avgProgress}%`;

        // ===== GERAR CARDS DE ORDENS =====
        const ordersHtml = filteredOrders.map(order => {
            const progressPercent = Math.min(order.progress || 0, 100);
            const progressColor = progressPercent >= 100 ? 'bg-emerald-500' : progressPercent >= 70 ? 'bg-blue-500' : progressPercent >= 40 ? 'bg-amber-500' : 'bg-red-500';
            const progressRingColor = progressPercent >= 100 ? 'text-emerald-500' : progressPercent >= 70 ? 'text-blue-500' : progressPercent >= 40 ? 'text-amber-500' : 'text-red-500';
            const lotSizeNumeric = Number(order.lot_size) || 0;
            const status = (order.status || '').toLowerCase();

            // Mapa de cores para status
            const statusColorMap = {
                'planejada': { badge: 'bg-slate-100 text-slate-600 border border-slate-300', icon: 'calendar', label: 'Planejada' },
                'em_andamento': { badge: 'bg-amber-100 text-amber-700 border border-amber-300', icon: 'play-circle', label: 'Em Andamento' },
                'ativa': { badge: 'bg-blue-100 text-blue-700 border border-blue-300', icon: 'zap', label: 'Ativa' },
                'concluida': { badge: 'bg-emerald-100 text-emerald-700 border border-emerald-300', icon: 'check-circle-2', label: 'Concluída' },
                'finalizada': { badge: 'bg-emerald-100 text-emerald-700 border border-emerald-300', icon: 'check-circle-2', label: 'Finalizada' },
                'cancelada': { badge: 'bg-red-100 text-red-700 border border-red-300', icon: 'x-circle', label: 'Cancelada' }
            };

            const statusDisplay = statusColorMap[status] || statusColorMap['planejada'];
            const isActive = status === 'ativa' || status === 'em_andamento';

            // Buscar modelo da máquina
            const machineInfo = window.databaseModule?.machineById?.get(order.machine_id);
            const machineLabel = machineInfo ? `${order.machine_id} - ${machineInfo.model}` : (order.machine_id || 'N/A');

            // Data de criação formatada
            const createdDate = order.createdAt?.toDate?.() || new Date(order.createdAt);
            const formattedDate = createdDate instanceof Date && !isNaN(createdDate) 
                ? createdDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
                : '';

            // Verificar se pode reativar
            const isReactivatable = ['concluida','finalizada','encerrada'].includes(status);

            return `
                <div class="group bg-white rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100 overflow-hidden ${isActive ? 'ring-2 ring-blue-400 ring-offset-1' : ''}">
                    <!-- Header do Card -->
                    <div class="p-4 border-b border-gray-50 bg-gradient-to-r ${isActive ? 'from-blue-50 to-white' : 'from-gray-50 to-white'}">
                        <div class="flex items-start justify-between gap-2">
                            <div class="flex-1 min-w-0">
                                <div class="flex items-center gap-2">
                                    <span class="text-lg font-bold text-gray-800 truncate">${escapeHtml(order.order_number)}</span>
                                    ${formattedDate ? `<span class="text-xs text-gray-400">${formattedDate}</span>` : ''}
                                </div>
                                <p class="text-sm text-gray-600 truncate mt-0.5" title="${escapeHtml(order.product || '')}">${escapeHtml(order.product || 'Produto não especificado')}</p>
                            </div>
                            <span class="flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${statusDisplay.badge}">
                                <i data-lucide="${statusDisplay.icon}" class="w-3 h-3"></i>
                                ${statusDisplay.label}
                            </span>
                        </div>
                    </div>

                    <!-- Corpo do Card -->
                    <div class="p-4">
                        <!-- Informações principais em grid compacto -->
                        <div class="grid grid-cols-2 gap-3 text-sm mb-4">
                            <div class="flex items-center gap-2">
                                <i data-lucide="user" class="w-4 h-4 text-gray-400"></i>
                                <span class="text-gray-600 truncate" title="${escapeHtml(order.customer || '')}">${escapeHtml(order.customer || 'N/A')}</span>
                            </div>
                            <div class="flex items-center gap-2">
                                <i data-lucide="cog" class="w-4 h-4 text-gray-400"></i>
                                <span class="text-gray-600 truncate" title="${escapeHtml(machineLabel)}">${escapeHtml(machineLabel)}</span>
                            </div>
                            <div class="flex items-center gap-2">
                                <i data-lucide="hash" class="w-4 h-4 text-gray-400"></i>
                                <span class="text-gray-600 truncate" title="${escapeHtml(order.part_code || '')}">${escapeHtml(order.part_code || 'N/A')}</span>
                            </div>
                            ${order.raw_material ? `
                            <div class="flex items-center gap-2">
                                <i data-lucide="package" class="w-4 h-4 text-gray-400"></i>
                                <span class="text-gray-600 truncate" title="${escapeHtml(order.raw_material)}">${escapeHtml(order.raw_material)}</span>
                            </div>
                            ` : '<div></div>'}
                        </div>

                        <!-- Progresso Visual -->
                        <div class="bg-gray-50 rounded-lg p-3">
                            <div class="flex items-center justify-between mb-2">
                                <span class="text-xs font-medium text-gray-500 uppercase tracking-wide">Progresso da OP</span>
                                <span class="text-sm font-bold ${progressRingColor}">${Math.round(progressPercent)}%</span>
                            </div>
                            <div class="w-full bg-gray-200 rounded-full h-2 mb-2">
                                <div class="${progressColor} h-2 rounded-full transition-all duration-500" style="width: ${progressPercent}%"></div>
                            </div>
                            <div class="flex justify-between text-xs text-gray-500">
                                <span><strong class="text-emerald-600">${order.totalProduced.toLocaleString('pt-BR')}</strong> produzido</span>
                                <span><strong class="text-gray-700">${lotSizeNumeric.toLocaleString('pt-BR')}</strong> planejado</span>
                            </div>
                            ${order.remaining > 0 ? `<div class="text-center mt-1 text-xs text-amber-600">Faltam <strong>${order.remaining.toLocaleString('pt-BR')}</strong> un</div>` : ''}
                        </div>
                    </div>

                    <!-- Footer com Ações -->
                    <div class="px-4 pb-4 flex gap-2">
                        ${status === 'planejada' ? `
                        <button class="activate-order-btn flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium text-sm transition-colors" data-order-id="${order.id}" data-machine-id="${order.machine_id || ''}">
                            <i data-lucide="play" class="w-4 h-4"></i>
                            Ativar
                        </button>
                        ` : ''}
                        ${isReactivatable ? `
                        <button class="reactivate-order-btn flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors" data-order-id="${order.id}">
                            <i data-lucide="rotate-ccw" class="w-4 h-4"></i>
                            Reativar
                        </button>
                        ` : ''}
                        <button class="edit-order-btn ${(status === 'planejada' || isReactivatable) ? 'flex-1' : 'w-full'} flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium text-sm transition-colors" data-order-id="${order.id}">
                            <i data-lucide="edit-3" class="w-4 h-4"></i>
                            Editar
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        if (filteredOrders.length === 0) {
            ordersGrid.innerHTML = `
                <div class="col-span-full flex flex-col items-center justify-center py-16">
                    <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                        <i data-lucide="inbox" class="w-8 h-8 text-gray-400"></i>
                    </div>
                    <h3 class="text-lg font-medium text-gray-700 mb-1">Nenhuma ordem encontrada</h3>
                    <p class="text-sm text-gray-500">Tente ajustar os filtros de busca</p>
                </div>
            `;
        } else {
            ordersGrid.innerHTML = ordersHtml;
        }

        try {
            lucide.createIcons();
        } catch (iconError) {
            console.warn('Falha ao renderizar ícones lucide na aba de ordens:', iconError);
        }

        const noDataContainer = document.getElementById('analysis-no-data');
        if (filteredOrders.length > 0 && noDataContainer) {
            noDataContainer.classList.add('hidden');
        }

        // Configurar event listeners para filtros
        const ordersStatusFilterBtn = document.getElementById('orders-status-filter');
        const ordersMachineFilterBtn = document.getElementById('analysis-orders-machine-filter');
        const ordersSearchInput = document.getElementById('orders-search');
        const ordersSortSelect = document.getElementById('orders-sort-filter');
        const ordersClearFiltersBtn = document.getElementById('orders-clear-filters');
        const ordersRefreshBtn = document.getElementById('orders-refresh-btn');
        const ordersResultsCount = document.getElementById('orders-results-count');
        
        // Atualizar contador de resultados
        if (ordersResultsCount) {
            ordersResultsCount.textContent = `${filteredOrders.length} ordem${filteredOrders.length !== 1 ? 'ns' : ''} encontrada${filteredOrders.length !== 1 ? 's' : ''}`;
        }
        
        if (ordersStatusFilterBtn && !ordersStatusFilterBtn.dataset.listenerAttached) {
            ordersStatusFilterBtn.addEventListener('change', () => loadOrdersAnalysis());
            ordersStatusFilterBtn.dataset.listenerAttached = 'true';
        }

        if (ordersMachineFilterBtn && !ordersMachineFilterBtn.dataset.listenerAttached) {
            ordersMachineFilterBtn.addEventListener('change', () => loadOrdersAnalysis());
            ordersMachineFilterBtn.dataset.listenerAttached = 'true';
        }
        
        if (ordersSearchInput && !ordersSearchInput.dataset.listenerAttached) {
            ordersSearchInput.addEventListener('input', debounce(() => loadOrdersAnalysis(), 300));
            ordersSearchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    loadOrdersAnalysis();
                }
            });
            ordersSearchInput.dataset.listenerAttached = 'true';
        }

        // Botão de busca explícito
        const ordersSearchBtn = document.getElementById('orders-search-btn');
        if (ordersSearchBtn && !ordersSearchBtn.dataset.listenerAttached) {
            ordersSearchBtn.addEventListener('click', () => loadOrdersAnalysis());
            ordersSearchBtn.dataset.listenerAttached = 'true';
        }

        if (ordersSortSelect && !ordersSortSelect.dataset.listenerAttached) {
            ordersSortSelect.addEventListener('change', () => loadOrdersAnalysis());
            ordersSortSelect.dataset.listenerAttached = 'true';
        }

        if (ordersClearFiltersBtn && !ordersClearFiltersBtn.dataset.listenerAttached) {
            ordersClearFiltersBtn.addEventListener('click', () => {
                if (ordersStatusFilterBtn) ordersStatusFilterBtn.value = '';
                if (ordersMachineFilterBtn) ordersMachineFilterBtn.value = '';
                if (ordersSearchInput) ordersSearchInput.value = '';
                if (ordersSortSelect) ordersSortSelect.value = 'recent';
                loadOrdersAnalysis();
            });
            ordersClearFiltersBtn.dataset.listenerAttached = 'true';
        }

        if (ordersRefreshBtn && !ordersRefreshBtn.dataset.listenerAttached) {
            ordersRefreshBtn.addEventListener('click', async () => {
                productionOrdersCache = null;
                await loadOrdersAnalysis();
                showNotification('Ordens atualizadas!', 'success');
            });
            ordersRefreshBtn.dataset.listenerAttached = 'true';
        }

        // Toggle de visualização Grid/Lista
        const ordersViewGrid = document.getElementById('orders-view-grid');
        const ordersViewList = document.getElementById('orders-view-list');
        const ordersListContainer = document.getElementById('orders-list');
        
        if (ordersViewGrid && !ordersViewGrid.dataset.listenerAttached) {
            ordersViewGrid.addEventListener('click', () => {
                ordersGrid.classList.remove('hidden');
                if (ordersListContainer) ordersListContainer.classList.add('hidden');
                ordersViewGrid.classList.add('bg-white', 'shadow-sm', 'text-primary-blue');
                ordersViewGrid.classList.remove('text-gray-500');
                if (ordersViewList) {
                    ordersViewList.classList.remove('bg-white', 'shadow-sm', 'text-primary-blue');
                    ordersViewList.classList.add('text-gray-500');
                }
            });
            ordersViewGrid.dataset.listenerAttached = 'true';
        }

        if (ordersViewList && !ordersViewList.dataset.listenerAttached) {
            ordersViewList.addEventListener('click', () => {
                ordersGrid.classList.add('hidden');
                if (ordersListContainer) {
                    ordersListContainer.classList.remove('hidden');
                    populateOrdersListView(filteredOrders);
                }
                ordersViewList.classList.add('bg-white', 'shadow-sm', 'text-primary-blue');
                ordersViewList.classList.remove('text-gray-500');
                if (ordersViewGrid) {
                    ordersViewGrid.classList.remove('bg-white', 'shadow-sm', 'text-primary-blue');
                    ordersViewGrid.classList.add('text-gray-500');
                }
            });
            ordersViewList.dataset.listenerAttached = 'true';
        }

        // Função para preencher view de lista (tabela)
        function populateOrdersListView(orders) {
            const listBody = document.getElementById('orders-list-body');
            if (!listBody) return;

            const statusColorMap = {
                'planejada': { badge: 'bg-slate-100 text-slate-600', label: 'Planejada' },
                'em_andamento': { badge: 'bg-amber-100 text-amber-700', label: 'Em Andamento' },
                'ativa': { badge: 'bg-blue-100 text-blue-700', label: 'Ativa' },
                'concluida': { badge: 'bg-emerald-100 text-emerald-700', label: 'Concluída' },
                'finalizada': { badge: 'bg-emerald-100 text-emerald-700', label: 'Finalizada' },
                'cancelada': { badge: 'bg-red-100 text-red-700', label: 'Cancelada' }
            };

            listBody.innerHTML = orders.map(order => {
                const status = (order.status || '').toLowerCase();
                const statusDisplay = statusColorMap[status] || statusColorMap['planejada'];
                const progressPercent = Math.min(order.progress || 0, 100);
                const progressColor = progressPercent >= 100 ? 'bg-emerald-500' : progressPercent >= 70 ? 'bg-blue-500' : progressPercent >= 40 ? 'bg-amber-500' : 'bg-red-500';
                const lotSize = Number(order.lot_size) || 0;
                const machineInfo = window.databaseModule?.machineById?.get(order.machine_id);
                const machineLabel = machineInfo ? `${order.machine_id}` : (order.machine_id || 'N/A');

                return `
                    <tr class="hover:bg-gray-50 transition-colors">
                        <td class="px-4 py-3 text-sm font-semibold text-gray-800">${escapeHtml(order.order_number)}</td>
                        <td class="px-4 py-3 text-sm text-gray-600 max-w-xs truncate" title="${escapeHtml(order.product || '')}">${escapeHtml(order.product || 'N/A')}</td>
                        <td class="px-4 py-3 text-sm text-gray-600">${escapeHtml(machineLabel)}</td>
                        <td class="px-4 py-3">
                            <span class="inline-flex px-2 py-1 rounded-full text-xs font-medium ${statusDisplay.badge}">${statusDisplay.label}</span>
                        </td>
                        <td class="px-4 py-3">
                            <div class="flex items-center gap-2">
                                <div class="flex-1 bg-gray-200 rounded-full h-2 w-20">
                                    <div class="${progressColor} h-2 rounded-full" style="width: ${progressPercent}%"></div>
                                </div>
                                <span class="text-xs font-medium text-gray-600">${Math.round(progressPercent)}%</span>
                            </div>
                        </td>
                        <td class="px-4 py-3 text-sm text-right font-medium text-emerald-600">${order.totalProduced.toLocaleString('pt-BR')}</td>
                        <td class="px-4 py-3 text-sm text-right text-gray-600">${lotSize.toLocaleString('pt-BR')}</td>
                        <td class="px-4 py-3 text-center">
                            <button class="edit-order-btn p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" data-order-id="${order.id}" title="Editar">
                                <i data-lucide="edit-3" class="w-4 h-4"></i>
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');

            lucide.createIcons();

            // Re-attach listeners para botões de edição na lista
            listBody.querySelectorAll('.edit-order-btn').forEach(btn => {
                if (!btn.dataset.listenerAttached) {
                    btn.addEventListener('click', async () => {
                        const orderId = btn.getAttribute('data-order-id');
                        if (!orderId) return;
                        // Simular click no botão do grid
                        const gridBtn = document.querySelector(`.edit-order-btn[data-order-id="${orderId}"]`);
                        if (gridBtn) gridBtn.click();
                    });
                    btn.dataset.listenerAttached = 'true';
                }
            });
        }

        lucide.createIcons();

        // Adicionar event listener para botões de reativação
        document.querySelectorAll('.reactivate-order-btn').forEach(btn => {
            if (!btn.dataset.listenerAttached) {
                btn.addEventListener('click', async (e) => {
                    const orderId = btn.getAttribute('data-order-id');
                    if (!orderId) return;
                    if (!confirm('Deseja realmente reativar esta ordem? Ela voltará ao status ATIVA.')) return;
                    try {
                        await db.collection('production_orders').doc(orderId).update({ status: 'ativa' });
                        showNotification('Ordem reativada com sucesso!', 'success');
                        await loadOrdersAnalysis();
                    } catch (err) {
                        showNotification('Erro ao reativar ordem. Tente novamente.', 'error');
                        console.error('Erro ao reativar ordem:', err);
                    }
                });
                btn.dataset.listenerAttached = 'true';
            }
        });

        // Adicionar event listener para botões de ativação (ordens planejadas)
        document.querySelectorAll('.activate-order-btn').forEach(btn => {
            if (!btn.dataset.listenerAttached) {
                btn.addEventListener('click', async (e) => {
                    const orderId = btn.getAttribute('data-order-id');
                    const machineId = btn.getAttribute('data-machine-id');
                    if (!orderId) return;
                    
                    // Verificar se há máquina definida
                    if (!machineId) {
                        showNotification('Esta ordem não tem máquina definida. Edite a ordem e selecione uma máquina primeiro.', 'warning');
                        return;
                    }
                    
                    if (!confirm(`Deseja ativar esta ordem na máquina ${machineId}?`)) return;
                    
                    try {
                        // Atualizar status para ativa
                        await db.collection('production_orders').doc(orderId).update({ 
                            status: 'ativa',
                            activatedAt: firebase.firestore.FieldValue.serverTimestamp()
                        });
                        showNotification('Ordem ativada com sucesso!', 'success');

                        // Registrar no histórico do sistema
                        if (typeof logSystemAction === 'function') {
                            logSystemAction('ordem_ativada', `Ordem ${orderId} ativada`, {
                                maquina: machineId,
                                orderId: orderId
                            });
                        }
                        
                        // Atualizar cache e recarregar
                        productionOrdersCache = null;
                        await loadOrdersAnalysis();
                    } catch (err) {
                        showNotification('Erro ao ativar ordem. Tente novamente.', 'error');
                        console.error('Erro ao ativar ordem:', err);
                    }
                });
                btn.dataset.listenerAttached = 'true';
            }
        });

        // Adicionar event listener para botões de edição
        document.querySelectorAll('.edit-order-btn').forEach(btn => {
            if (!btn.dataset.listenerAttached) {
                btn.addEventListener('click', async (e) => {
                    const orderId = btn.getAttribute('data-order-id');
                    if (!orderId) return;
                    // Buscar dados da ordem
                    let orderData = null;
                    if (Array.isArray(productionOrdersCache)) {
                        orderData = productionOrdersCache.find(o => o.id === orderId);
                    }
                    if (!orderData) {
                        try {
                            const doc = await db.collection('production_orders').doc(orderId).get();
                            if (doc.exists) orderData = { id: doc.id, ...doc.data() };
                        } catch (err) { orderData = null; }
                    }
                    if (!orderData) {
                        showNotification('Ordem não encontrada.', 'error');
                        return;
                    }
                    // Preencher campos do modal
                    document.getElementById('edit-order-id').value = orderData.id;
                    // Preencher select de produtos
                    const productSelect = document.getElementById('edit-order-product');
                    productSelect.innerHTML = '';
                    if (window.databaseModule && window.databaseModule.productByCode) {
                        const products = Array.from(window.databaseModule.productByCode.values());
                        products.forEach(prod => {
                            const opt = document.createElement('option');
                            opt.value = prod.cod;
                            opt.textContent = `${prod.cod} - ${prod.name} (${prod.client})`;
                            if ((orderData.product_cod || orderData.part_code || orderData.product) == prod.cod || orderData.product == prod.name) opt.selected = true;
                            productSelect.appendChild(opt);
                        });
                    } else {
                        const opt = document.createElement('option');
                        opt.value = orderData.product || '';
                        opt.textContent = orderData.product || '';
                        opt.selected = true;
                        productSelect.appendChild(opt);
                    }

                    // Preencher select de máquinas
                    const machineSelect = document.getElementById('edit-order-machine');
                    machineSelect.innerHTML = '';
                    if (window.databaseModule && window.databaseModule.machineById) {
                        const machines = Array.from(window.databaseModule.machineById.values());
                        machines.forEach(mac => {
                            const opt = document.createElement('option');
                            opt.value = mac.id;
                            opt.textContent = `${mac.id} - ${mac.model}`;
                            if ((orderData.machine_id || orderData.machine) == mac.id) opt.selected = true;
                            machineSelect.appendChild(opt);
                        });
                    } else {
                        const opt = document.createElement('option');
                        opt.value = orderData.machine_id || orderData.machine || '';
                        opt.textContent = orderData.machine_id || orderData.machine || '';
                        opt.selected = true;
                        machineSelect.appendChild(opt);
                    }

                    document.getElementById('edit-order-customer').value = orderData.customer || orderData.client || '';
                    document.getElementById('edit-order-lot').value = orderData.lot || orderData.lot_size || '';
                    document.getElementById('edit-order-planned').value = orderData.lot_size || '';
                    document.getElementById('edit-order-executed').value = orderData.total_produzido || orderData.totalProduced || '';
                    
                    // Mostrar info de última edição
                    const lastAdj = orderData.lastManualAdjustment;
                    if (lastAdj && lastAdj.editedByName) {
                        const adjTime = lastAdj.timestamp?.toDate?.() || new Date();
                        const timeStr = adjTime.toLocaleString('pt-BR');
                        console.log(`[EDIT-ORDER] Última edição: ${lastAdj.editedByName} em ${timeStr}`);
                    }
                    
                    document.getElementById('edit-order-modal').classList.remove('hidden');
                });
                btn.dataset.listenerAttached = 'true';
            }
        });
// Modal de edição de ordem
document.getElementById('close-edit-order-modal').onclick = () => {
    document.getElementById('edit-order-modal').classList.add('hidden');
};
document.getElementById('cancel-edit-order').onclick = () => {
    document.getElementById('edit-order-modal').classList.add('hidden');
};
document.getElementById('edit-order-form').onsubmit = async function(e) {
    e.preventDefault();
    const id = document.getElementById('edit-order-id').value;
    const product = document.getElementById('edit-order-product').value;
    const machine = document.getElementById('edit-order-machine').value;
    const customer = document.getElementById('edit-order-customer').value;
    const lot = document.getElementById('edit-order-lot').value;
    const planned = Number(document.getElementById('edit-order-planned').value);
    const executed = Number(document.getElementById('edit-order-executed').value);
    if (!id) return;
    try {
        const currentUser = getActiveUser();
        
        const updateData = {
            product,
            machine_id: machine,
            customer,
            lot_size: planned,
            total_produzido: executed,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        if (executed > 0) {
            updateData.lastManualAdjustment = {
                value: executed,
                editedBy: currentUser?.username || 'desconhecido',
                editedByName: currentUser?.name || 'Desconhecido',
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                reason: 'Edição manual via interface'
            };
            console.log(`[AUDIT] ${currentUser?.name || 'Desconhecido'} editou quantidade da ordem ${id}: ${executed}`);
        }
        
        await db.collection('production_orders').doc(id).update(updateData);
        showNotification('Ordem atualizada com sucesso!', 'success');
        document.getElementById('edit-order-modal').classList.add('hidden');
        
        // CRÍTICO: Invalidar cache de ordens para forçar recarregamento do banco
        productionOrdersCache = null;
        
        // Aguardar Firestore processar E atualizar todas as visualizações
        console.log('[EDIT-ORDER-HANDLER] Iniciando refresh após edição...');
        
        // 1. Recarregar lista de análise de ordens
        await loadOrdersAnalysis();
        console.log('[EDIT-ORDER-HANDLER] loadOrdersAnalysis() concluído');
        
        // 2. CRÍTICO: Recarregar seletor de máquinas (atualiza aba Lançamentos)
        // Usar Promise para aguardar o evento machineDataUpdated
        const machineDataPromise = new Promise((resolve) => {
            const handler = () => {
                console.log('[EDIT-ORDER-HANDLER] Evento machineDataUpdated recebido');
                document.removeEventListener('machineDataUpdated', handler);
                resolve();
            };
            document.addEventListener('machineDataUpdated', handler);
            // Timeout de 3s para segurança
            setTimeout(() => {
                document.removeEventListener('machineDataUpdated', handler);
                console.warn('[EDIT-ORDER-HANDLER] Timeout aguardando machineDataUpdated');
                resolve();
            }, 3000);
        });
        
        await populateMachineSelector(); // Aguardar completamente
        await machineDataPromise; // Aguardar evento
        console.log('[EDIT-ORDER-HANDLER] populateMachineSelector() concluído e dados prontos');
        
        // 3. Recarregar dados atuais da máquina selecionada do machineCardData
        if (selectedMachineData && selectedMachineData.machine) {
            const machineName = selectedMachineData.machine;
            const machineDataArray = machineCardData[machineName];
            // machineCardData agora é array - pegar primeiro plano para compatibilidade
            const updatedMachineData = Array.isArray(machineDataArray) ? machineDataArray[0] : machineDataArray;
            if (updatedMachineData) {
                selectedMachineData = updatedMachineData;
                console.log('[EDIT-ORDER-HANDLER] selectedMachineData atualizado:', { 
                    total: selectedMachineData.total_produzido, 
                    lot: selectedMachineData.lot_size || selectedMachineData.order_lot_size 
                });
            }
            
            // 4. Forçar re-seleção da máquina para atualizar o painel completamente
            if (typeof onMachineSelected === 'function') {
                await onMachineSelected(machineName);
                console.log('[EDIT-ORDER-HANDLER] onMachineSelected() executado para', machineName);
            }
        }
        
        // 5. Forçar atualização visual da aba Lançamentos
        updateMachineInfo();
        console.log('[EDIT-ORDER-HANDLER] updateMachineInfo() concluído');
        
        // 6. Se gráfico OP estiver aberto, atualizar também
        if (launchChartMode === 'op') {
            await loadOpProductionChart();
            console.log('[EDIT-ORDER-HANDLER] loadOpProductionChart() concluído');
        }
        
        // 7. Atualizar estatísticas
        await loadTodayStats();
        console.log('[EDIT-ORDER-HANDLER] ✅ Refresh completo finalizado!');
    } catch (err) {
        showNotification('Erro ao atualizar ordem.', 'error');
        console.error('Erro ao atualizar ordem:', err);
    }
};
    }

    function aggregateOeeMetrics(productionData, lossesData, downtimeData, planData, shiftFilter = 'all') {
        console.log('[TRACE][aggregateOeeMetrics] iniciando com', {
            production: productionData.length,
            losses: lossesData.length,
            downtime: downtimeData.length,
            plan: planData.length,
            shiftFilter
        });

        const toShiftNumber = (value) => {
            if (value === null || value === undefined) return null;
            const num = Number(value);
            return Number.isFinite(num) && num > 0 ? num : null;
        };

        const determineShiftFromTime = (timeStr) => {
            if (!timeStr || typeof timeStr !== 'string') return null;
            const [hoursStr, minutesStr] = timeStr.split(':');
            const hours = Number(hoursStr);
            const minutes = Number(minutesStr) || 0;
            if (!Number.isFinite(hours)) return null;
            // T1: 06:30 - 14:59
            if ((hours === 6 && minutes >= 30) || (hours >= 7 && hours < 15)) return 1;
            // T2: 15:00 - 23:19
            if (hours >= 15 && (hours < 23 || (hours === 23 && minutes < 20))) return 2;
            // T3: 23:20 - 06:29
            return 3;
        };

        const determineShiftFromDate = (dateObj) => {
            if (!(dateObj instanceof Date) || Number.isNaN(dateObj.getTime())) return null;
            const hours = dateObj.getHours();
            return determineShiftFromTime(`${String(hours).padStart(2, '0')}:00`);
        };

        const inferShift = (item) => {
            const candidates = [
                item.shift,
                item?.raw?.shift,
                item?.raw?.turno,
                item?.raw?.Shift,
                item?.raw?.Turno
            ];
            for (const value of candidates) {
                const shiftNum = toShiftNumber(value);
                if (shiftNum) return shiftNum;
            }

            const timeCandidates = [
                item.startTime,
                item.endTime,
                item?.raw?.startTime,
                item?.raw?.endTime,
                item?.raw?.hora,
                item?.raw?.hour,
                item?.raw?.time,
                item?.raw?.horaInformada
            ];
            for (const time of timeCandidates) {
                const shiftNum = determineShiftFromTime(time);
                if (shiftNum) return shiftNum;
            }

            const dateCandidates = [];
            if (item.datetime) {
                const parsed = new Date(item.datetime);
                if (!Number.isNaN(parsed.getTime())) dateCandidates.push(parsed);
            }
            if (item?.raw?.timestamp?.toDate) {
                dateCandidates.push(item.raw.timestamp.toDate());
            }
            if (item?.raw?.createdAt?.toDate) {
                dateCandidates.push(item.raw.createdAt.toDate());
            }
            if (item?.raw?.updatedAt?.toDate) {
                dateCandidates.push(item.raw.updatedAt.toDate());
            }
            const resolvedDate = resolveProductionDateTime(item.raw);
            if (resolvedDate) {
                dateCandidates.push(resolvedDate);
            }
            for (const date of dateCandidates) {
                const shiftNum = determineShiftFromDate(date);
                if (shiftNum) return shiftNum;
            }

            // CORREÇÃO: Se não conseguir inferir o turno, assume turno 1 (padrão) para evitar descarte
            console.log('[TRACE][aggregateOeeMetrics] turno não identificado para item', item.id || 'sem-id', 'assumindo turno 1');
            return 1;
        };

        const inferMachine = (item) => item.machine || item?.raw?.machine || item?.raw?.machineRef || item?.raw?.machine_id || null;

        // CORREÇÃO: Incluir workDay/date no agrupamento para múltiplas datas
        const groupKey = (machine, shift, workDay) => `${machine || 'unknown'}_${shift ?? 'none'}_${workDay || 'nodate'}`;
        const grouped = {};

        const getOrCreateGroup = (item) => {
            const machine = inferMachine(item);
            const shiftNum = inferShift(item);
            const workDay = item.workDay || item.date || 'nodate';
            
            if (!machine) {
                console.log('[TRACE][aggregateOeeMetrics] máquina não identificada para item', item.id || 'sem-id');
                return null;
            }
            
            const key = groupKey(machine, shiftNum, workDay);
            if (!grouped[key]) {
                grouped[key] = {
                    machine,
                    shift: shiftNum,
                    workDay,
                    production: 0,
                    scrapPcs: 0,
                    scrapKg: 0,
                    downtimeMin: 0
                };
            }
            return grouped[key];
        };

        productionData.forEach(item => {
            const group = getOrCreateGroup(item);
            if (!group) return;
            group.production += item.quantity || 0;
        });

        lossesData.forEach(item => {
            const group = getOrCreateGroup(item);
            if (!group) return;
            const scrapPcs = Number(item.scrapPcs ?? item.quantity ?? 0) || 0;
            const scrapKg = Number(item.scrapKg ?? 0) || 0;
            group.scrapPcs += scrapPcs;
            group.scrapKg += scrapKg;
        });

        // Obter categorias excluídas do OEE
        const oeeExcludedCategories = window.databaseModule?.oeeExcludedCategories || [];
        
        // NOVO: Criar set de máquinas com plano ativo para validação
        const machinesWithPlan = new Set();
        planData.forEach(p => {
            if (p && p.machine) {
                machinesWithPlan.add(normalizeMachineId(p.machine));
            }
        });

        downtimeData.forEach(item => {
            // CORREÇÃO: Verificar se é parada semOP (sem OP planejada)
            // Paradas semOP só devem ser contabilizadas se a máquina tem planejamento
            const isSemOP = item.raw?.semOP === true;
            const machineId = normalizeMachineId(item.machine || '');
            
            if (isSemOP && !machinesWithPlan.has(machineId)) {
                // Máquina SEM OP e SEM planejamento - NÃO contabilizar no OEE
                console.log('[TRACE][aggregateOeeMetrics] Parada semOP ignorada (máquina sem planejamento):', machineId, item.reason);
                return;
            }
            
            const group = getOrCreateGroup(item);
            if (!group) return;
            
            // Verificar se a categoria deve ser excluída do cálculo de OEE
            const reason = item.reason || '';
            const category = window.getDowntimeCategory(reason);
            if (oeeExcludedCategories.includes(category)) {
                // Parada de categoria excluída - NÃO contabilizar no OEE
                console.log('[TRACE][aggregateOeeMetrics] Parada excluída do OEE:', category, reason);
                return;
            }
            
            group.downtimeMin += item.duration || 0;
        });

        const clamp01 = (value) => Math.max(0, Math.min(1, value));
        const groupsWithMetrics = [];

        console.log('[TRACE][aggregateOeeMetrics] grupos criados:', Object.keys(grouped).length);

        Object.values(grouped).forEach(group => {
            // CORREÇÃO: Buscar planos por máquina e data também
            const planCandidates = planData.filter(p => p && p.raw && p.machine === group.machine);
            
            if (!planCandidates.length) {
                // CORREÇÃO: Se não há plano E não há produção, ignorar do OEE
                // Isso evita contabilizar máquinas que estão apenas "paradas" sem planejamento
                if (group.production === 0) {
                    console.log('[TRACE][aggregateOeeMetrics] ignorando máquina sem plano e sem produção:', group.machine);
                    return;
                }
                
                console.log('[TRACE][aggregateOeeMetrics] sem plano para máquina', group.machine, 'usando valores padrão');
                // CORREÇÃO: Usar valores padrão quando não há plano disponível
                const metrics = window.calculateShiftOEE(
                    group.production,
                    group.downtimeMin,
                    0, // refugoPcs
                    30, // ciclo padrão de 30 segundos
                    2   // 2 cavidades padrão
                );

                groupsWithMetrics.push({
                    machine: group.machine,
                    shift: group.shift,
                    workDay: group.workDay,
                    disponibilidade: clamp01(metrics.disponibilidade),
                    performance: clamp01(metrics.performance),
                    qualidade: clamp01(metrics.qualidade),
                    oee: clamp01(metrics.oee)
                });
                return;
            }

            // Tentar encontrar plano específico para o turno
            let plan = planCandidates.find(p => {
                const planShift = Number(p.shift || 0);
                return planShift && planShift === group.shift;
            });

            // Se não encontrou plano específico, usar o primeiro disponível
            if (!plan) {
                plan = planCandidates[0];
                console.log('[TRACE][aggregateOeeMetrics] usando plano genérico para máquina', group.machine, 'turno', group.shift);
            }

            if (!plan || !plan.raw) {
                console.log('[TRACE][aggregateOeeMetrics] plano inválido para máquina', group.machine);
                return;
            }

            const shiftKey = `t${group.shift}`;
            const cicloReal = plan.raw[`real_cycle_${shiftKey}`] || plan.raw.budgeted_cycle || 30;
            const cavAtivas = plan.raw[`active_cavities_${shiftKey}`] || plan.raw.mold_cavities || 2;
            const pieceWeight = plan.raw.piece_weight || 0.1; // peso padrão de 100g

            let refugoPcs = Math.round(Math.max(0, group.scrapPcs || 0));
            if (!refugoPcs && group.scrapKg > 0 && pieceWeight > 0) {
                refugoPcs = Math.round((group.scrapKg * 1000) / pieceWeight);
            }

            const metrics = window.calculateShiftOEE(
                group.production,
                group.downtimeMin,
                refugoPcs,
                cicloReal,
                cavAtivas
            );

            console.log('[TRACE][aggregateOeeMetrics] grupo processado:', {
                machine: group.machine,
                shift: group.shift,
                workDay: group.workDay,
                production: group.production,
                downtimeMin: group.downtimeMin,
                refugoPcs,
                scrapPcs: group.scrapPcs,
                scrapKg: group.scrapKg,
                cicloReal,
                cavAtivas,
                metrics
            });

            groupsWithMetrics.push({
                machine: group.machine,
                shift: group.shift,
                workDay: group.workDay,
                disponibilidade: clamp01(metrics.disponibilidade),
                performance: clamp01(metrics.performance),
                qualidade: clamp01(metrics.qualidade),
                oee: clamp01(metrics.oee)
            });
        });

        const averageMetric = (items, selector) => {
            if (!items.length) return 0;
            const total = items.reduce((sum, item) => sum + selector(item), 0);
            return total / items.length;
        };

        const normalizedShift = shiftFilter === 'all' ? 'all' : toShiftNumber(shiftFilter);
        const filteredGroups = normalizedShift === 'all'
            ? groupsWithMetrics
            : groupsWithMetrics.filter(item => item.shift === normalizedShift);

        console.log('[TRACE][aggregateOeeMetrics] grupos com métricas:', groupsWithMetrics.length);
        console.log('[TRACE][aggregateOeeMetrics] grupos filtrados:', filteredGroups.length);

        const overall = {
            disponibilidade: averageMetric(groupsWithMetrics, item => item.disponibilidade),
            performance: averageMetric(groupsWithMetrics, item => item.performance),
            qualidade: averageMetric(groupsWithMetrics, item => item.qualidade),
            oee: averageMetric(groupsWithMetrics, item => item.oee)
        };

        const filtered = {
            disponibilidade: averageMetric(filteredGroups, item => item.disponibilidade),
            performance: averageMetric(filteredGroups, item => item.performance),
            qualidade: averageMetric(filteredGroups, item => item.qualidade),
            oee: averageMetric(filteredGroups, item => item.oee)
        };

        console.log('[TRACE][aggregateOeeMetrics] resultado final:', {
            overall,
            filtered,
            shiftFilter,
            normalizedShift
        });

        return {
            overall,
            filtered,
            groups: groupsWithMetrics
        };
    }


    // Função para carregar análise de perdas
    async function loadLossesAnalysis() {
        const { startDate, endDate, machine, shift } = currentAnalysisFilters;
        console.log('[TRACE][loadLossesAnalysis] fetching data', { startDate, endDate, machine, shift });
        
        const lossesData = await getFilteredData('losses', startDate, endDate, machine, shift);
        const productionData = await getFilteredData('production', startDate, endDate, machine, shift);

        // =====================================================
        // BUSCAR BORRAS DA COLEÇÃO pmp_borra (Nova aba PMP)
        // =====================================================
        let pmpBorraData = [];
        try {
            // Buscar borras do período selecionado
            const pmpBorraSnapshot = await db.collection('pmp_borra')
                .where('date', '>=', startDate)
                .where('date', '<=', endDate)
                .get();
            
            pmpBorraSnapshot.forEach(doc => {
                const data = doc.data();
                const machineId = normalizeMachineId(data.machine || '');
                
                // Aplicar filtros de máquina e turno
                if (machine !== 'all' && machineId !== normalizeMachineId(machine)) {
                    return;
                }
                
                // Para turno, inferir pelo horário se disponível
                if (shift !== 'all' && data.hour) {
                    const hourParts = data.hour.split(':');
                    const hourNum = parseInt(hourParts[0], 10);
                    const minNum = parseInt(hourParts[1], 10) || 0;
                    let inferredShift = 1;
                    // T1: 06:30-14:59, T2: 15:00-23:19, T3: 23:20-06:29
                    if ((hourNum === 6 && minNum >= 30) || (hourNum >= 7 && hourNum < 15)) inferredShift = 1;
                    else if (hourNum >= 15 && (hourNum < 23 || (hourNum === 23 && minNum < 20))) inferredShift = 2;
                    else inferredShift = 3;
                    
                    if (inferredShift !== parseInt(shift, 10)) {
                        return;
                    }
                }
                
                // Mapear para formato compatível com análise
                pmpBorraData.push({
                    id: doc.id,
                    date: data.date,
                    machine: machineId,
                    quantity: 0, // Borra não tem peças, só peso
                    reason: 'BORRA - PMP',
                    mp: '',
                    mp_type: '',
                    workDay: data.date,
                    scrapPcs: 0,
                    scrapKg: data.quantityKg || 0,
                    pieceWeight: 0,
                    raw: {
                        ...data,
                        tipo_lancamento: 'borra',
                        refugo_kg: data.quantityKg || 0,
                        source: 'pmp_borra'
                    }
                });
            });
            
            console.log('[TRACE][loadLossesAnalysis] PMP Borra data loaded:', pmpBorraData.length);
        } catch (error) {
            console.warn('[TRACE][loadLossesAnalysis] Erro ao carregar pmp_borra:', error);
        }
        
        // Combinar dados de perdas com borras do PMP
        const allLossesData = [...lossesData, ...pmpBorraData];

        console.log('[TRACE][loadLossesAnalysis] datasets received', {
            lossesCount: lossesData.length,
            pmpBorraCount: pmpBorraData.length,
            totalLossesCount: allLossesData.length,
            productionCount: productionData.length
        });
        
        const totalLosses = allLossesData.reduce((sum, item) => sum + item.quantity, 0);
        const totalProduction = productionData.reduce((sum, item) => sum + item.quantity, 0);
        const lossesPercentage = totalProduction > 0 ? (totalLosses / totalProduction * 100) : 0;
        
        // Calcular principal motivo
        const reasonCounts = {};
        allLossesData.forEach(item => {
            reasonCounts[item.reason] = (reasonCounts[item.reason] || 0) + item.quantity;
        });
        const mainReason = Object.keys(reasonCounts).reduce((a, b) => 
            reasonCounts[a] > reasonCounts[b] ? a : b, '---'
        );
        
        // Separar dados de borra (inclui pmp_borra)
        const borraData = allLossesData.filter(item => {
            const reasonStr = (item.reason || item.raw?.perdas || '').toString().toLowerCase();
            const isTagged = (item.raw && item.raw.tipo_lancamento === 'borra');
            const isPmpBorra = item.raw?.source === 'pmp_borra';
            return isTagged || isPmpBorra || reasonStr.includes('borra');
        });
        const regularLossesData = allLossesData.filter(item => !borraData.includes(item));
        console.log('[TRACE][loadLossesAnalysis] borra split', {
            borraCount: borraData.length,
            regularLossesCount: regularLossesData.length,
            borraSample: borraData.slice(0, 3)
        });
        
        // Calcular total de borra em kg
        const totalBorraKg = borraData.reduce((sum, item) => {
            // Para borra, usar preferencialmente o peso em kg
            const weight = item.raw?.refugo_kg || item.raw?.quantityKg || item.scrapKg || 0;
            return sum + weight;
        }, 0);
        if (allLossesData.length > 0 && borraData.length === 0) {
            console.warn('[TRACE][loadLossesAnalysis] Atenção: há perdas mas nenhuma BORRA detectada. Verifique se os lançamentos de borra possuem tipo_lancamento="borra" ou motivo contendo "borra".');
        }

        // Calcular MP mais perdida
        const materialCounts = {};
        allLossesData.forEach(item => {
            const mpType = item.mp_type || 'Não especificado';
            materialCounts[mpType] = (materialCounts[mpType] || 0) + item.quantity;
        });
        const mainMaterialCode = Object.keys(materialCounts).length > 0 
            ? Object.keys(materialCounts).reduce((a, b) => 
                materialCounts[a] > materialCounts[b] ? a : b, '---'
            ) 
            : '---';
        const mainMaterial = mainMaterialCode !== '---' ? getDescricaoMP(mainMaterialCode) : '---';

        // Análise específica de borra
        const borraMPCounts = {};
        const borraReasonCounts = {};
        const borraMachineCounts = {};
        
        borraData.forEach(item => {
            const mpType = item.mp_type || item.raw?.mp_type || 'Não especificado';
            const reason = item.reason || item.raw?.perdas || 'Não especificado';
            const machine = item.machine || 'Não especificado';
            
            borraMPCounts[mpType] = (borraMPCounts[mpType] || 0) + (item.raw?.refugo_kg || item.quantity || 0);
            borraReasonCounts[reason] = (borraReasonCounts[reason] || 0) + (item.raw?.refugo_kg || item.quantity || 0);
            borraMachineCounts[machine] = (borraMachineCounts[machine] || 0) + (item.raw?.refugo_kg || item.quantity || 0);
        });

        const topBorraMP = Object.keys(borraMPCounts).length > 0
            ? Object.keys(borraMPCounts).reduce((a, b) => borraMPCounts[a] > borraMPCounts[b] ? a : b, '---')
            : '---';
            
        const topBorraReason = Object.keys(borraReasonCounts).length > 0
            ? Object.keys(borraReasonCounts).reduce((a, b) => borraReasonCounts[a] > borraReasonCounts[b] ? a : b, '---')
            : '---';
            
        const topBorraMachine = Object.keys(borraMachineCounts).length > 0
            ? Object.keys(borraMachineCounts).reduce((a, b) => borraMachineCounts[a] > borraMachineCounts[b] ? a : b, '---')
            : '---';

        // Atualizar interface
        document.getElementById('total-losses').textContent = totalLosses.toLocaleString();
        document.getElementById('losses-percentage').textContent = `${lossesPercentage.toFixed(1)}%`;
        document.getElementById('total-borra').textContent = `${totalBorraKg.toFixed(3)}`;
        document.getElementById('main-loss-reason').textContent = mainReason;
        document.getElementById('main-loss-material').textContent = mainMaterial;
        
        // Atualizar dados específicos de borra
        const topBorraMPElement = document.getElementById('top-borra-mp');
        const topBorraReasonElement = document.getElementById('top-borra-reason');
        const topBorraMachineElement = document.getElementById('top-borra-machine');
        
        if (topBorraMPElement) topBorraMPElement.textContent = topBorraMP;
        if (topBorraReasonElement) topBorraReasonElement.textContent = topBorraReason.replace('BORRA - ', '');
        if (topBorraMachineElement) topBorraMachineElement.textContent = topBorraMachine;

        // ✅ CORREÇÃO: Armazenar dados ANTES da geração de gráficos
        // para garantir que filtros funcionem mesmo se um gráfico falhar
        window._lossesAnalysisData = [...regularLossesData];
        populateLossesReasonFilter(regularLossesData);
        console.log('[TRACE][loadLossesAnalysis] _lossesAnalysisData populated with', regularLossesData.length, 'items');

        // Gerar gráficos (usando regularLossesData que exclui borra)
        try { await generateLossesParetoChart(regularLossesData); } catch(e) { console.warn('[CHART] Pareto error:', e); }
        try { await generateLossesByMachineChart(regularLossesData); } catch(e) { console.warn('[CHART] ByMachine error:', e); }
        try { await generateLossesByProductChart(regularLossesData); } catch(e) { console.warn('[CHART] ByProduct error:', e); }
        try { await generateLossesByMaterialChart(regularLossesData); } catch(e) { console.warn('[CHART] ByMaterial error:', e); }
        try { await generateLossesDailyChart(regularLossesData); } catch(e) { console.warn('[CHART] Daily error:', e); }
        
        // Gerar gráficos específicos de borra
        await generateBorraByMachineChart(borraData);
        await generateBorraMonthlyChart(borraData);
        
        // Preencher tabela de apontamentos de borra
        await populateBorraApontamentosTable(borraData);
        
        // ✅ Carregar análise de sucata
        if (typeof loadSucataAnalysis === 'function') {
            await loadSucataAnalysis(startDate, endDate, machine, shift);
        }
    }

    // Função para carregar análise de paradas
    async function loadDowntimeAnalysis() {
        const { startDate, endDate, machine, shift } = currentAnalysisFilters;
        console.log('[TRACE][loadDowntimeAnalysis] fetching data', { startDate, endDate, machine, shift });
        
        // ✅ SEMPRE limpar caches antes de carregar dados frescos do Firebase
        cachedDowntimeDataForChart = [];
        
        // Carregar paradas normais (do turno) - busca direto do Firebase
        const downtimeSegments = await getFilteredData('downtime', startDate, endDate, machine, shift);
        const downtimeData = window.consolidateDowntimeEvents(downtimeSegments);
        
        // Debug: log dos motivos encontrados
        const uniqueReasons = [...new Set(downtimeData.map(d => d.reason || 'Sem motivo'))];
        console.log('[loadDowntimeAnalysis] Motivos encontrados no Firebase:', uniqueReasons);
        console.log('[loadDowntimeAnalysis] Total de segmentos:', downtimeSegments.length, '| Eventos consolidados:', downtimeData.length);

        console.log('[TRACE][loadDowntimeAnalysis] normal downtime received', {
            segments: downtimeSegments.length,
            events: downtimeData.length
        });
        
        // Paradas longas removidas - Unificação 02/2026 (usa apenas downtime_entries)
        
        // Usar apenas paradas normais para estatísticas principais (KPIs)
        const totalDowntime = downtimeData.reduce((sum, item) => sum + (item.duration || 0), 0);
        const downtimeCount = downtimeData.length;
        const avgDowntime = downtimeCount > 0 ? (totalDowntime / downtimeCount) : 0;
        
        // Calcular MTBF (Mean Time Between Failures) - apenas paradas normais
        const hoursInPeriod = window.calculateHoursInPeriod(startDate, endDate);
        const mtbf = downtimeCount > 0 ? (hoursInPeriod / downtimeCount) : 0;

        // Atualizar interface
        document.getElementById('total-downtime').textContent = `${(totalDowntime / 60).toFixed(1)}h`;
        document.getElementById('downtime-count').textContent = downtimeCount.toString();
        document.getElementById('avg-downtime').textContent = `${avgDowntime.toFixed(0)}min`;
        document.getElementById('mtbf-value').textContent = `${mtbf.toFixed(1)}h`;

        // ✅ Gerar gráfico de CATEGORIAS/MOTIVOS apenas com paradas normais
        await generateDowntimeReasonsChart(downtimeData);
        setupDowntimeChartToggle(); // Setup dos botões de toggle categoria/motivo
        
        // Outros gráficos apenas com paradas normais
        await generateDowntimeByMachineChart(downtimeData);
        await generateDowntimeTimelineChart(downtimeData);

        // Filtro de motivos — delegado ao controller de análise
    }



    // Helper para destruir gráficos Chart.js existentes
    function destroyChart(canvasId) {
        const canvas = document.getElementById(canvasId);
        if (canvas) {
            const existingChart = Chart.getChart(canvas);
            if (existingChart) {
                existingChart.destroy();
            }
        }
    }
    
    // Helper para mostrar mensagem quando não há dados no gráfico
    function showNoDataMessage(canvasId, message = 'Nenhum dado disponível para o período selecionado') {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        
        // Limpar canvas
        const context = canvas.getContext('2d');
        if (context) {
            context.clearRect(0, 0, canvas.width, canvas.height);
        }
        
        // Adicionar mensagem
        const container = canvas.parentElement;
        if (container) {
            let messageDiv = container.querySelector('.no-data-message');
            if (!messageDiv) {
                messageDiv = document.createElement('div');
                messageDiv.className = 'no-data-message absolute inset-0 flex items-center justify-center';
                container.style.position = 'relative';
                container.appendChild(messageDiv);
            }
            messageDiv.innerHTML = `<p class="text-gray-500 text-sm">${message}</p>`;
        }
    }
    
    // Helper para remover mensagem de "sem dados"
    function clearNoDataMessage(canvasId) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        
        const container = canvas.parentElement;
        if (container) {
            const messageDiv = container.querySelector('.no-data-message');
            if (messageDiv) messageDiv.remove();
        }
    }

    // Configurações responsivas globais para gráficos
    function getResponsiveChartOptions() {
        const isMobile = window.innerWidth < 768;
        const isTablet = window.innerWidth < 1024;
        
        return {
            responsive: true,
            maintainAspectRatio: false,
            devicePixelRatio: window.devicePixelRatio || 1,
            scales: {
                x: {
                    grid: {
                        display: !isMobile,
                        color: 'rgba(0, 0, 0, 0.05)'
                    },
                    ticks: {
                        font: {
                            size: isMobile ? 8 : isTablet ? 10 : 12
                        },
                        maxRotation: isMobile ? 45 : 0,
                        minRotation: 0,
                        autoSkip: true,
                        maxTicksLimit: isMobile ? 8 : isTablet ? 12 : 16
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    },
                    ticks: {
                        font: {
                            size: isMobile ? 9 : isTablet ? 11 : 12
                        },
                        maxTicksLimit: isMobile ? 6 : 8
                    }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: isMobile ? 'bottom' : 'top',
                    labels: {
                        font: {
                            size: isMobile ? 10 : isTablet ? 11 : 12
                        },
                        usePointStyle: true,
                        padding: isMobile ? 10 : 20,
                        boxWidth: isMobile ? 8 : 12
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: 'white',
                    bodyColor: 'white',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                    titleFont: {
                        size: isMobile ? 11 : 12
                    },
                    bodyFont: {
                        size: isMobile ? 10 : 11
                    },
                    padding: isMobile ? 6 : 10
                }
            },
            layout: {
                padding: {
                    top: isMobile ? 5 : 10,
                    right: isMobile ? 5 : 10,
                    bottom: isMobile ? 5 : 10,
                    left: isMobile ? 5 : 10
                }
            }
        };
    }

    // Função para mesclar configurações específicas com as responsivas
    function mergeChartOptions(specificOptions = {}) {
        const baseOptions = getResponsiveChartOptions();
        
        // Função helper para merge profundo
        function deepMerge(target, source) {
            for (const key in source) {
                if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                    target[key] = target[key] || {};
                    deepMerge(target[key], source[key]);
                } else {
                    target[key] = source[key];
                }
            }
            return target;
        }
        
        return deepMerge(JSON.parse(JSON.stringify(baseOptions)), specificOptions);
    }

    async function getFilteredData(collection, startDate, endDate, machine = 'all', shift = 'all') {
        try {
            console.log('[TRACE][getFilteredData] called', { collection, startDate, endDate, machine, shift });
            
            const normalizeShift = (value) => {
                if (value === undefined || value === null) return null;
                if (typeof value === 'number' && Number.isFinite(value)) return value;
                const match = String(value).match(/(\d+)/);
                return match ? Number(match[1]) : null;
            };
            // FIX: map cada tipo analítico para a coleção real no Firestore e normalizar os campos esperados pela aba de análise
            const collectionConfig = {
                production: {
                    collection: 'production_entries',
                    dateField: 'data',
                    mapper: (id, raw) => {
                        const mappedDate = raw.data || raw.date || '';
                        const primaryTimestamp = raw.timestamp || raw.createdAt || raw.updatedAt;
                        const resolvedDateTime = resolveProductionDateTime(raw);
                        const timestamp = resolvedDateTime || normalizeToDate(primaryTimestamp);
                        const timeHint = raw.horaInformada || raw.hora || raw.hour || raw.time || null;
                        const workDay = getWorkDayFromTimestamp(resolvedDateTime || primaryTimestamp) || getWorkDay(mappedDate, timeHint);
                        const isoDateTime = timestamp ? new Date(timestamp.getTime() - timestamp.getTimezoneOffset() * 60000).toISOString() : null;
                        
                        // Resolver produto através de múltiplas fontes
                        const product = raw.product || raw.produto || raw.product_cod || raw.cod_produto || raw.productName || raw.mp || '';
                        
                        // CORREÇÃO: Usar mesma lógica do Dashboard TV para consistência
                        // Verificar todos os campos possíveis de quantidade produzida
                        const rawQty = Number(raw.produzido ?? raw.pecasBoas ?? raw.quantity ?? raw.produced ?? raw.qtd ?? raw.quantidade ?? raw.total_produzido ?? 0) || 0;
                        
                        return {
                            id,
                            date: mappedDate,
                            machine: normalizeMachineId(raw.machine || raw.machineRef || raw.machine_id || null),
                            quantity: Math.round(rawQty), // Sempre inteiro, consistente com Dashboard TV
                            shift: normalizeShift(raw.turno ?? raw.shift),
                            datetime: isoDateTime,
                            mp: raw.mp || '',
                            product: product,
                            workDay: workDay || mappedDate,
                            raw
                        };
                    }
                },
                losses: {
                    collection: 'production_entries',
                    dateField: 'data',
                    mapper: (id, raw) => {
                        const dateValue = raw.data || raw.date || '';
                        const primaryTimestamp = raw.timestamp || raw.createdAt || raw.updatedAt;
                        const resolvedDateTime = resolveProductionDateTime(raw);
                        const timeHint = raw.horaInformada || raw.hora || raw.hour || raw.time || null;
                        const workDay = getWorkDayFromTimestamp(resolvedDateTime || primaryTimestamp) || getWorkDay(dateValue, timeHint);
                        const rawRefugoKg = Number(raw.refugo_kg ?? raw.refugoKg ?? raw.scrap_kg ?? raw.scrapKg ?? 0) || 0;
                        const rawRefugoPcs = Number(raw.refugo_qty ?? raw.refugo_qtd ?? raw.scrap_qty ?? raw.scrap_qtd ?? 0) || 0;
                        const pieceWeight = Number(raw.piece_weight ?? raw.peso_unitario ?? raw.pesoUnitario ?? raw.peso ?? 0) || 0;
                        const resolvedPcs = rawRefugoPcs > 0
                            ? rawRefugoPcs
                            : (rawRefugoKg > 0 && pieceWeight > 0 ? Math.round((rawRefugoKg * 1000) / pieceWeight) : 0);
                        const resolvedKg = rawRefugoKg > 0
                            ? rawRefugoKg
                            : (pieceWeight > 0 && resolvedPcs > 0 ? (resolvedPcs * pieceWeight) / 1000 : 0);
                        
                        // Resolver produto através de múltiplas fontes
                        const product = raw.product || raw.produto || raw.product_cod || raw.cod_produto || raw.productName || '';
                        
                        return {
                            id,
                            date: dateValue,
                            machine: normalizeMachineId(raw.machine || raw.machineRef || raw.machine_id || null),
                            quantity: resolvedPcs,
                            shift: normalizeShift(raw.turno ?? raw.shift),
                            reason: raw.perdas || raw.reason || '',
                            mp: raw.mp || '',
                            mp_type: raw.mp_type || raw.mp || '',
                            product: product,
                            workDay: workDay || dateValue,
                            scrapPcs: resolvedPcs,
                            scrapKg: resolvedKg,
                            pieceWeight,
                            raw
                        };
                    }
                },
                downtime: {
                    collection: 'downtime_entries',
                    dateField: 'date',
                    mapper: (id, raw) => {
                        const startMinutes = raw.startTime ? parseTimeToMinutes(raw.date, raw.startTime) : null;
                        const endMinutes = raw.endTime ? parseTimeToMinutes(raw.date, raw.endTime) : null;
                        let duration = Number(raw.duration ?? raw.duration_min ?? raw.duracao_min ?? 0) || 0;
                        if (!duration && startMinutes !== null && endMinutes !== null) {
                            duration = Math.max(0, endMinutes - startMinutes);
                        }
                        const primaryTimestamp = raw.timestamp || raw.createdAt || raw.updatedAt;
                                const timeHint = raw.startTime || raw.endTime || null;
                                // Preferir calcular o workDay a partir da data/horário do próprio registro
                                // (evita classificar pelo createdAt quando o lançamento é retroativo)
                                const workDay = getWorkDay(raw.date || '', timeHint) || getWorkDayFromTimestamp(primaryTimestamp);
                        let mappedShift = normalizeShift(raw.shift ?? raw.turno);
                        if (!mappedShift) {
                            mappedShift = window.inferShiftFromSegment(raw.date || '', raw.startTime || '', raw.endTime || '');
                        }
                        return {
                            id,
                            date: raw.date || '',
                            machine: normalizeMachineId(raw.machine || null),
                            duration,
                            reason: raw.reason || '',
                            shift: mappedShift,
                            startTime: raw.startTime || '',
                            endTime: raw.endTime || '',
                            workDay: workDay || raw.date || '',
                            raw
                        };
                    }
                },
                plan: {
                    collection: 'planning',
                    dateField: 'date',
                    mapper: (id, raw) => {
                        const dateValue = raw.date || '';
                        const primaryTimestamp = raw.createdAt || raw.updatedAt || raw.timestamp;
                        // Calcular workDay usando timestamp (quando foi criado)
                        // Se não tiver timestamp, assumir que a data salva JÁ é uma data de trabalho
                        const workDay = getWorkDayFromTimestamp(primaryTimestamp) || dateValue;
                        
                        return {
                            id,
                            date: dateValue,
                            machine: normalizeMachineId(raw.machine || null),
                            quantity: getPlanQuantity(raw), // Usa função centralizada para consistência com Dashboard TV
                            shift: normalizeShift(raw.shift ?? raw.turno),
                            product: raw.product || '',
                            mp: raw.mp || '',
                            workDay: workDay || dateValue,
                            raw
                        };
                    }
                },
                rework: {
                    collection: 'rework_entries',
                    dateField: 'data',
                    mapper: (id, raw) => {
                        const dateValue = raw.data || '';
                        const primaryTimestamp = raw.timestamp || raw.createdAt || raw.updatedAt;
                        const workDay = getWorkDayFromTimestamp(primaryTimestamp) || dateValue;
                        return {
                            id,
                            date: dateValue,
                            machine: normalizeMachineId(raw.machine || null),
                            quantity: Number(raw.quantidade ?? raw.quantity ?? 0) || 0,
                            shift: normalizeShift(raw.turno ?? raw.shift),
                            reason: raw.motivo || raw.reason || '',
                            mp: raw.mp || '',
                            workDay: workDay || dateValue,
                            raw
                        };
                    }
                }
            };

            const config = collectionConfig[collection];
            if (!config) {
                console.warn(`Coleção de análise desconhecida: ${collection}`);
                return [];
            }

            if (!startDate || !endDate) {
                console.warn('[TRACE][getFilteredData] datas inválidas fornecidas', { startDate, endDate });
                return [];
            }

            let query = db.collection(config.collection);
            
            // Buscar um período amplo (do dia anterior ao dia posterior)
            // para capturar dados do turno 3 (23h-7h)
            const startObj = new Date(startDate);
            startObj.setDate(startObj.getDate() - 1);
            const queryStartDate = Number.isNaN(startObj.getTime()) ? null : startObj.toISOString().split('T')[0];
            
            const endObj = new Date(endDate);
            endObj.setDate(endObj.getDate() + 1);
            const queryEndDate = Number.isNaN(endObj.getTime()) ? null : endObj.toISOString().split('T')[0];
            
            console.log('[TRACE][getFilteredData] query setup with expanded date range', { 
                collection: config.collection,
                dateField: config.dateField,
                userStartDate: startDate,
                userEndDate: endDate,
                queryStartDate,
                queryEndDate,
                machine,
                shift
            });
            
            if (queryStartDate && queryEndDate) {
                query = query.where(config.dateField, '>=', queryStartDate).where(config.dateField, '<=', queryEndDate);
            }

            let snapshot = await query.get();

            if (snapshot.empty && queryStartDate && queryEndDate) {
                console.warn('[TRACE][getFilteredData] snapshot vazio com filtro de datas — sem dados para o período (otimização: fallback sem filtro REMOVIDO)');
            }
            console.log('[TRACE][getFilteredData] raw snapshot', { 
                collection: config.collection,
                size: snapshot.size,
                empty: snapshot.empty
            });
            
            let data = snapshot.docs.map(doc => config.mapper(doc.id, doc.data()));

            const startWorkDay = startDate || null;
            const endWorkDay = endDate || null;

            data = data.filter(item => {
                const workDay = item.workDay || item.date;
                if (!workDay) return false;
                const meetsStart = !startWorkDay || workDay >= startWorkDay;
                const meetsEnd = !endWorkDay || workDay <= endWorkDay;
                return meetsStart && meetsEnd;
            });

            if (collection === 'losses') {
                data = data.filter(item => {
                    if (item.quantity > 0) return true;
                    const rawWeight = Number(item.raw?.refugo_kg ?? item.raw?.weight ?? 0) || 0;
                    return rawWeight > 0;
                });
            }

            if (machine !== 'all') {
                const target = normalizeMachineId(machine);
                data = data.filter(item => normalizeMachineId(item.machine) === target);
            }

            if (shift !== 'all') {
                data = data.filter(item => Number(item.shift || 0) === Number(shift));
            }

            console.log('[TRACE][getFilteredData] returning data', {
                collection,
                count: data.length,
                sample: data.slice(0, 3)
            });
            return data;
        } catch (error) {
            console.error('Erro ao buscar dados filtrados:', error);
            return [];
        }
    }

    function parseTimeToMinutes(dateStr, timeStr) {
        // FIX: utilitário para converter HH:MM em minutos absolutos para cálculos de duração
        if (!dateStr || !timeStr) return null;
        const [hours, minutes] = timeStr.split(':').map(Number);
        if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
        const date = new Date(`${dateStr}T${timeStr}:00`);
        return Math.floor(date.getTime() / 60000);
    }


    function showAnalysisNoData(message = 'Nenhum dado disponível para os filtros selecionados.') {
        const loading = document.getElementById('analysis-loading');
        const noData = document.getElementById('analysis-no-data');

        if (loading) {
            loading.classList.add('hidden');
        }

        if (noData) {
            noData.classList.remove('hidden');
            const messageElement = noData.querySelector('[data-analysis-empty-message]') || noData.querySelector('p');
            if (messageElement && message) {
                messageElement.textContent = message;
            }
        }
    }

    function loadAnalysisMachines() {
        // Inicializar lista de máquinas com os dados do banco de dados (normalizados)
        machines = machineDatabase.map(machine => ({ 
            id: normalizeMachineId(machine.id), 
            name: normalizeMachineId(machine.id), 
            model: machine.model 
        }));
        
        // Carregar lista de máquinas para o filtro
        const machineSelector = document.getElementById('analysis-machine');
        if (machineSelector) {
            machineSelector.innerHTML = '<option value="all">Todas as máquinas</option>';
            machines.forEach(machine => {
                const option = document.createElement('option');
                option.value = machine.id;
                option.textContent = `${machine.id} - ${machine.model}`;
                machineSelector.appendChild(option);
            });
        }

        // Carregar lista de máquinas para o formulário de ordens
        populateOrderMachineSelect();
    }

    function populateOrderMachineSelect() {
        const orderMachineSelect = document.getElementById('order-machine');
        if (orderMachineSelect) {
            // Manter a opção vazia no início
            const currentValue = orderMachineSelect.value;
            orderMachineSelect.innerHTML = '<option value="">Selecione uma máquina</option>';
            
            machineDatabase.forEach(machine => {
                const option = document.createElement('option');
                const mid = normalizeMachineId(machine.id);
                option.value = mid;
                option.textContent = `${mid} - ${machine.model}`;
                orderMachineSelect.appendChild(option);
            });

            // Restaurar valor anterior se existisse
            if (currentValue) {
                orderMachineSelect.value = currentValue;
            }
        }
    }


    // Helper: atualiza a aba de análise se ela estiver ativa
    // Versão stub — o controller sobrescreve window.refreshAnalysisIfActive quando carregado
    async function refreshAnalysisIfActive() {
        const currentPage = document.querySelector('.nav-btn.active')?.dataset.page;
        if (currentPage !== 'analise') return;
        // Controller não carregado ainda — análise será carregada quando o usuário navegar
    }


    // Função para atualizar a barra de timeline
    function updateTimelineProgress(executed, planned, expectedByNow) {
        const progressBar = document.getElementById('timeline-progress');
        const targetIndicator = document.getElementById('timeline-target-indicator');
        const percentageText = document.getElementById('timeline-percentage');
        const executedText = document.getElementById('timeline-executed');
        const plannedText = document.getElementById('timeline-planned');
        const statusIndicator = document.getElementById('timeline-status-indicator');
        const statusText = document.getElementById('timeline-status-text');
        const lastUpdateText = document.getElementById('timeline-last-update');

        if (!progressBar || !targetIndicator) return;

        // Calcular percentuais
        const executedPercentage = planned > 0 ? Math.min((executed / planned) * 100, 100) : 0;
        const expectedPercentage = planned > 0 ? Math.min((expectedByNow / planned) * 100, 100) : 0;
        const palette = window.resolveProgressPalette(executedPercentage);
        const orderStatus = (currentActiveOrder && typeof currentActiveOrder.status === 'string')
            ? currentActiveOrder.status.toLowerCase()
            : '';
        const blockedStatuses = ['concluida', 'cancelada', 'finalizada', 'encerrada'];
    const orderEligibleForFinalize = !!currentActiveOrder?.id && !blockedStatuses.includes(orderStatus);
    const orderEligibleForActivate = !!currentActiveOrder?.id && !blockedStatuses.includes(orderStatus) && orderStatus !== 'ativa';

        currentOrderProgress = {
            executed: Number.isFinite(executed) ? executed : 0,
            planned: Number.isFinite(planned) ? planned : 0,
            expected: Number.isFinite(expectedByNow) ? expectedByNow : 0
        };

        // Animar barra de progresso
        setTimeout(() => {
            progressBar.style.width = `${executedPercentage}%`;
            targetIndicator.style.left = `${expectedPercentage}%`;
        }, 100);

        progressBar.classList.add('timeline-progress');
        progressBar.style.background = `linear-gradient(90deg, ${palette.start}, ${palette.end})`;
        progressBar.style.boxShadow = `0 6px 18px ${window.hexWithAlpha(palette.end, 0.35)}`;
        targetIndicator.style.backgroundColor = palette.end;
    const lotCompleted = planned > 0 && executed >= planned;
    progressBar.classList.toggle('timeline-complete', lotCompleted);

        // Atualizar textos
        if (percentageText) {
            percentageText.textContent = `${executedPercentage.toFixed(1)}%`;
            percentageText.classList.remove('text-red-600', 'text-amber-500', 'text-emerald-600', 'text-green-600');
            if (palette.textClass) {
                percentageText.classList.add(palette.textClass);
            }
        }
        
        if (executedText) {
            executedText.textContent = `${executed.toLocaleString('pt-BR')} peças`;
        }
        
        if (plannedText) {
            plannedText.textContent = `${planned.toLocaleString('pt-BR')} un (Planejado)`;
        }

        // Determinar status
        let status = 'on-track';
        let statusMessage = 'No prazo';
        let indicatorClass = 'bg-green-500 animate-pulse';

        if (executed < expectedByNow * 0.8) {
            status = 'behind';
            statusMessage = 'Atrasado';
            indicatorClass = 'bg-red-500 animate-pulse';
        } else if (executed > expectedByNow * 1.2) {
            status = 'ahead';
            statusMessage = 'Adiantado';
            indicatorClass = 'bg-blue-500 animate-pulse';
        }

        if (lotCompleted) {
            status = 'completed';
            statusMessage = 'Lote concluído';
            indicatorClass = 'bg-emerald-500 animate-pulse';
        }

        // Atualizar indicador de status
        if (statusIndicator) {
            statusIndicator.className = `w-2 h-2 rounded-full ${indicatorClass}`;
        }
        
        if (statusText) {
            statusText.textContent = statusMessage;
            statusText.className = `text-gray-600 font-medium`;
            
            if (status === 'behind') {
                statusText.className = 'text-red-600 font-medium';
            } else if (status === 'ahead') {
                statusText.className = 'text-blue-600 font-medium';
            } else {
                statusText.className = 'text-green-600 font-medium';
            }
        }

        // Atualizar timestamp
        if (lastUpdateText) {
            const now = new Date();
            lastUpdateText.textContent = `Última atualização: ${now.toLocaleTimeString('pt-BR', { 
                hour: '2-digit', 
                minute: '2-digit' 
            })}`;
        }

        if (finalizeOrderBtn) {
            finalizeOrderBtn.classList.toggle('hidden', !orderEligibleForFinalize);
            finalizeOrderBtn.disabled = !orderEligibleForFinalize;
        }
        if (activateOrderBtn) {
            activateOrderBtn.classList.toggle('hidden', !orderEligibleForActivate);
            activateOrderBtn.disabled = !orderEligibleForActivate;
        }
    }

    // Ativa OP a partir do painel da máquina (botão azul)
    async function handleActivateOrderFromPanel(event) {
        event?.preventDefault?.();

        if (!selectedMachineData) {
            alert('Selecione uma máquina antes de ativar a OP.');
            return;
        }

        // Se já houver ordem ativa, não fazer nada
        if (currentActiveOrder && String(currentActiveOrder.status || '').toLowerCase() === 'ativa') {
            showNotification('Esta OP já está ativa nesta máquina.', 'info');
            return;
        }

        const machineId = selectedMachineData.machine;
        let targetOrder = currentActiveOrder;

        // Caso não exista uma ordem resolvida no contexto, localizar pela part_code atual
        if (!targetOrder || !targetOrder.id) {
            try {
                const partCode = selectedMachineData.product_cod || selectedMachineData.product_code;
                if (partCode) {
                    const lotsSnapshot = await db.collection('production_orders')
                        .where('part_code', '==', String(partCode))
                        .get();

                    if (!lotsSnapshot.empty) {
                        const orders = lotsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                        const toNum = (v) => { const n = parseInt(String(v||'').replace(/\D/g,''), 10); return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY; };
                        const isOpen = (o) => !['concluida','cancelada','finalizada','encerrada'].includes(String(o.status||'').toLowerCase());
                        const sameMachine = orders.filter(o => (o.machine_id || o.machine) === machineId);
                        targetOrder = sameMachine.find(o => ['ativa','em_andamento'].includes(String(o.status||'').toLowerCase()))
                            || sameMachine.filter(isOpen).sort((a,b) => toNum(a.order_number) - toNum(b.order_number))[0]
                            || orders.filter(isOpen).sort((a,b) => toNum(a.order_number) - toNum(b.order_number))[0]
                            || orders.sort((a,b) => toNum(a.order_number) - toNum(b.order_number))[0];
                    }
                }
            } catch (error) {
                console.warn('Falha ao localizar OP para ativação:', error);
            }
        }

        if (!targetOrder || !targetOrder.id) {
            alert('Nenhuma OP elegível encontrada para ativação.');
            return;
        }

        try {
            const ok = await setOrderAsActive(targetOrder.id, machineId);
            if (!ok) {
                showNotification('Ativação cancelada ou não concluída.', 'warning');
                return;
            }

            // Atualizar status do planejamento para em_execucao
            const planId = selectedMachineData?.id;
            if (planId) {
                try {
                    await db.collection('planning').doc(planId).update({
                        status: 'em_execucao',
                        startedAt: firebase.firestore.FieldValue.serverTimestamp(),
                        startedBy: getActiveUser()?.name || 'Sistema'
                    });
                } catch (planErr) {
                    console.warn('Não foi possível atualizar o status do planejamento ao ativar a OP:', planErr);
                }
            }

            // Atualizar listas e painel
            await Promise.allSettled([
                typeof loadProductionOrders === 'function' ? loadProductionOrders() : Promise.resolve(),
                populateMachineSelector()
            ]);
            if (selectedMachineData?.machine) {
                await onMachineSelected(selectedMachineData.machine);
            }

            showNotification('OP ativada com sucesso!', 'success');
        } catch (error) {
            console.error('Erro ao ativar OP pelo painel:', error);
            alert('Erro ao ativar a OP. Tente novamente.');
        }
    }

    // Finalizar OP diretamente pelo botão do card
    async function handleCardFinalizeClick(buttonEl) {
        try {
            const orderId = buttonEl?.dataset?.orderId;
            const planId = buttonEl?.dataset?.planId;
            const card = buttonEl.closest('.machine-card');
            const machine = card?.dataset?.machine;
            if (!orderId) {
                alert('Ordem não encontrada para finalizar.');
                return;
            }

            if (typeof window.authSystem?.checkPermissionForAction === 'function') {
                const hasPermission = window.authSystem.checkPermissionForAction('close_production_order');
                if (hasPermission === false) return;
            }

            const confirmMsg = `Confirma a finalização desta OP?`;
            if (!window.confirm(confirmMsg)) return;

            const originalHtml = buttonEl.innerHTML;
            buttonEl.disabled = true;
            buttonEl.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i><span>Finalizando...</span>`;
            if (typeof lucide !== 'undefined') lucide.createIcons();

            const user = getActiveUser();
            const updatePayload = {
                status: 'concluida',
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                completedAt: firebase.firestore.FieldValue.serverTimestamp(),
                completedBy: user?.username || null,
                completedByName: user?.name || null
            };
            await db.collection('production_orders').doc(orderId).update(updatePayload);

            if (planId) {
                try {
                    await db.collection('planning').doc(planId).update({
                        status: 'concluida',
                        finishedAt: firebase.firestore.FieldValue.serverTimestamp(),
                        finishedBy: user?.name || user?.username || null
                    });
                } catch (e) {
                    console.warn('Falha ao atualizar planejamento ao finalizar pelo card:', e);
                }
            }

            // Se a OP finalizada for a ativa no painel, limpar contexto
            if (currentActiveOrder?.id === orderId) {
                currentActiveOrder = null;
                resetProductionTimer?.();
                if (productionControlPanel) productionControlPanel.classList.add('hidden');
            }

            showNotification('OP finalizada com sucesso!', 'success');

            // Recarregar cartões e, se a mesma máquina estiver selecionada, recarregar painel
            await populateMachineSelector();
            if (machine) {
                const stillSelected = selectedMachineData?.machine === machine;
                if (stillSelected) await onMachineSelected(machine);
            }
        } catch (err) {
            console.error('Erro ao finalizar OP pelo card:', err);
            alert('Erro ao finalizar OP. Tente novamente.');
        } finally {
            if (buttonEl) {
                buttonEl.disabled = false;
                buttonEl.classList.add('hidden');
            }
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
    }

    // Ativar próxima OP diretamente pelo botão do card
    async function handleCardActivateNextClick(buttonEl) {
        const card = buttonEl.closest('.machine-card');
        const machine = buttonEl?.dataset?.machine || card?.dataset?.machine;
        if (!machine) {
            alert('Máquina não identificada para ativar próxima OP.');
            return;
        }

        const originalHtml = buttonEl.innerHTML;
        buttonEl.disabled = true;
        buttonEl.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i><span>Ativando...</span>`;
        if (typeof lucide !== 'undefined') lucide.createIcons();

        try {
            // Seleciona a máquina para garantir contexto e reaproveitar a lógica de ativação do painel
            await onMachineSelected(machine);
            await handleActivateOrderFromPanel();

            // Recarregar cards e painel
            await populateMachineSelector();
            await onMachineSelected(machine);
        } catch (err) {
            console.error('Erro ao ativar próxima OP pelo card:', err);
            alert('Erro ao ativar próxima OP. Tente novamente.');
        } finally {
            buttonEl.disabled = false;
            buttonEl.innerHTML = originalHtml;
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
    }

    // Função de debounce para otimizar redimensionamento
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Função para lidar com redimensionamento da janela
    function handleWindowResize() {
        const chartInstances = [];

        if (typeof Chart !== 'undefined' && Chart.instances) {
            if (Array.isArray(Chart.instances)) {
                chartInstances.push(...Chart.instances);
            } else if (Chart.instances instanceof Map) {
                chartInstances.push(...Chart.instances.values());
            } else {
                chartInstances.push(...Object.values(Chart.instances));
            }
        }

        chartInstances.forEach(chart => {
            if (chart && typeof chart.resize === 'function') {
                chart.resize();
            }
        });

        // Recarregar dados da aba ativa se necessário
        const activeTab = document.querySelector('.nav-btn.active');
        if (activeTab) {
            const activePage = activeTab.getAttribute('data-page');
            
            // Só recarregar se for uma aba com gráficos e se houve mudança significativa no tamanho
            if (['analise', 'lancamento'].includes(activePage)) {
                // Verificar se mudou entre breakpoints importantes (mobile/desktop)
                const wasMobile = typeof window.previousWidth === 'number' ? window.previousWidth < 768 : window.innerWidth < 768;
                const isMobile = window.innerWidth < 768;
                
                if (wasMobile !== isMobile) {
                    // Recarregar gráficos com novas configurações responsivas
                    setTimeout(() => {
                        if (activePage === 'analise') {
                            refreshAnalysisIfActive();
                        } else if (activePage === 'lancamento') {
                            loadLaunchPanel();
                        }
                    }, 100);
                }
            }
        }
        
        // Salvar largura atual para comparação futura
        window.previousWidth = window.innerWidth;
    }

    // Função para atualizar timeline apenas se estiver visível
    async function updateTimelineIfVisible() {
        // Otimização: Não atualizar se a aba do navegador não estiver visível
        if (!isPageVisible()) {
            return;
        }
        
        const timelineElement = document.getElementById('timeline-progress');
        if (!timelineElement || timelineElement.offsetParent === null) {
            return; // Timeline não está visível
        }

        // Recarregar dados de produção atuais
        try {
            if (!selectedMachineData) {
                updateTimelineProgress(0, 0, 0);
                return;
            }

            const today = new Date().toISOString().split('T')[0];
            const productionData = await getFilteredData('production', today, today, selectedMachineData.machine || 'all');

            const totalExecuted = productionData.reduce((sum, item) => sum + (item.quantity || 0), 0);
            const totalPlanned = Number(selectedMachineData.planned_quantity) || 0;
            const hourlyTarget = totalPlanned / window.HOURS_IN_PRODUCTION_DAY;
            const hoursElapsed = window.getHoursElapsedInProductionDay(new Date());
            const expectedByNow = Math.min(totalPlanned, hoursElapsed * hourlyTarget);

            updateTimelineProgress(totalExecuted, totalPlanned, expectedByNow);
        } catch (error) {
            console.warn('Erro ao atualizar timeline:', error);
        }
    }
    // Gráfico de produção por turno
    async function generateShiftProductionChart(productionData) {
        const ctx = document.getElementById('shift-production-chart');
        if (!ctx) return;

        destroyChart('shift-production-chart');

        if (productionData.length === 0) {
            showNoDataMessage('shift-production-chart');
            return;
        }
        
        clearNoDataMessage('shift-production-chart');

        const shiftData = [0, 0, 0]; // 1º, 2º, 3º Turno
        const shiftLabels = ['1º Turno', '2º Turno', '3º Turno'];

        productionData.forEach(item => {
            if (item.shift) {
                shiftData[item.shift - 1] += item.quantity;
            }
        });

        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: shiftLabels,
                datasets: [{
                    label: 'Peças',
                    data: shiftData,
                    backgroundColor: ['#10B981', '#3B82F6', '#F59E0B'],
                    borderColor: ['#047857', '#1E40AF', '#D97706'],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            font: {
                                size: window.innerWidth < 768 ? 9 : 11
                            }
                        }
                    },
                    x: {
                        ticks: {
                            font: {
                                size: window.innerWidth < 768 ? 9 : 11
                            }
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.parsed.y} pcs`;
                            }
                        }
                    }
                }
            }
        });
    }

    async function generateMachineProductionTimeline(productionData, options = {}) {
        const {
            canvas: providedCanvas = null,
            targetCanvasId = 'analysis-machine-production-timeline',
            maxMachines = 6
        } = options;

        const canvas = providedCanvas || document.getElementById(targetCanvasId);
        if (!canvas) return;
        const canvasId = canvas.id || targetCanvasId;

        if (machineProductionTimelineInstance) {
            machineProductionTimelineInstance.destroy();
            machineProductionTimelineInstance = null;
        }

        if (!Array.isArray(productionData) || productionData.length === 0) {
            showNoDataMessage(canvasId);
            return;
        }

        const dateSet = new Set();
        const totalsByMachine = new Map();
        const totalsByMachineDate = new Map();

        productionData.forEach(item => {
            const machine = (item?.machine || 'Sem máquina').toString();
            const rawDate = item?.workDay || item?.date || '';
            const dateKey = rawDate ? String(rawDate).slice(0, 10) : '';
            if (!dateKey) return;
            const quantity = Number(item?.quantity) || 0;

            dateSet.add(dateKey);
            totalsByMachine.set(machine, (totalsByMachine.get(machine) || 0) + quantity);
            const compositeKey = `${machine}__${dateKey}`;
            totalsByMachineDate.set(compositeKey, (totalsByMachineDate.get(compositeKey) || 0) + quantity);
        });

        if (dateSet.size === 0 || totalsByMachine.size === 0) {
            showNoDataMessage(canvasId);
            return;
        }

        const sortedDates = Array.from(dateSet).sort();
        const displayLabels = sortedDates.map(window.formatShortDateLabel);
        const machinesSorted = Array.from(totalsByMachine.entries())
            .sort((a, b) => b[1] - a[1])
            .map(entry => entry[0]);

        const machinesToPlot = machinesSorted.slice(0, Math.max(1, maxMachines));

        clearNoDataMessage(canvasId);

        const datasets = machinesToPlot.map((machine, index) => {
            const colors = window.ANALYSIS_LINE_COLORS[index % window.ANALYSIS_LINE_COLORS.length];
            const points = sortedDates.map(dateKey => totalsByMachineDate.get(`${machine}__${dateKey}`) || 0);
            return {
                label: machine,
                data: points,
                borderColor: colors.border,
                backgroundColor: colors.fill,
                tension: 0.3,
                pointRadius: 3,
                pointHoverRadius: 5,
                fill: false
            };
        });

        const context = canvas.getContext('2d');
        machineProductionTimelineInstance = new Chart(context, {
            type: 'line',
            data: {
                labels: displayLabels,
                datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: (value) => `${Number(value).toLocaleString('pt-BR')} pcs`
                        },
                        title: {
                            display: true,
                            text: 'Peças'
                        }
                    },
                    x: {
                        ticks: {
                            maxRotation: 0
                        }
                    }
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            boxWidth: 12
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const label = context.dataset?.label || '';
                                const value = Number(context.parsed.y) || 0;
                                return `${label}: ${value.toLocaleString('pt-BR')} pcs`;
                            }
                        }
                    }
                }
            }
        });
    }

    // Função para atualizar gráficos de eficiência em formato doughnut
    function updateGauge(canvasId, percentage) {
        console.log(`[GAUGE] Atualizando ${canvasId} com ${percentage}%`);
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.error(`[GAUGE] Canvas "${canvasId}" não encontrado`);
            return;
        }

        const normalizedValue = Math.max(0, Math.min(Number(percentage) || 0, 100));
        const remainingValue = Math.max(0, 100 - normalizedValue);
        const style = gaugeChartStyles[canvasId] || { color: '#0F172A' };
        let activeColor = style.color;

        if (normalizedValue < 60 && style.dangerColor) {
            activeColor = style.dangerColor;
        } else if (normalizedValue < 80 && style.warningColor) {
            activeColor = style.warningColor;
        }

        const valueElementId = canvasId.replace('-gauge', '-value');
        const valueElement = document.getElementById(valueElementId);
        if (valueElement) {
            valueElement.style.color = activeColor;
        }

        if (gaugeChartInstances[canvasId]) {
            const chart = gaugeChartInstances[canvasId];
            chart.data.datasets[0].data = [normalizedValue, remainingValue];
            chart.data.datasets[0].backgroundColor = [
                activeColor,
                'rgba(229, 231, 235, 0.45)'
            ];
            chart.update();
            return;
        }

        gaugeChartInstances[canvasId] = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels: ['Atual', 'Restante'],
                datasets: [{
                    data: [normalizedValue, remainingValue],
                    backgroundColor: [
                        activeColor,
                        'rgba(229, 231, 235, 0.45)'
                    ],
                    borderWidth: 0,
                    hoverOffset: 4,
                    borderRadius: 10
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '72%',
                rotation: -90,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        enabled: false
                    }
                },
                animation: {
                    animateRotate: true,
                    duration: 800
                }
            }
        });
    }

    function renderModernDonutChart({
        canvasId,
        labels = [],
        data = [],
        colors = DEFAULT_DONUT_COLORS,
        datasetLabel = '',
        tooltipFormatter,
        legendPosition,
        cutout = '65%'
    }) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.error(`[DONUT] Canvas "${canvasId}" não encontrado`);
            return null;
        }

        const existing = Chart.getChart(canvas);
        if (existing) existing.destroy();

        const palette = labels.map((_, index) => colors[index % colors.length]);
        const total = data.reduce((sum, value) => sum + (Number(value) || 0), 0);
        const isMobile = window.innerWidth < 768;
        const resolvedLegendPosition = legendPosition || (isMobile ? 'bottom' : 'right');

        const chart = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    label: datasetLabel,
                    data,
                    backgroundColor: palette,
                    borderWidth: 0,
                    hoverOffset: 6,
                    borderRadius: 12
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout,
                rotation: -90,
                plugins: {
                    legend: {
                        position: resolvedLegendPosition,
                        labels: {
                            usePointStyle: true,
                            padding: isMobile ? 10 : 14,
                            boxWidth: isMobile ? 10 : 12,
                            font: {
                                size: isMobile ? 10 : 12
                            }
                        }
                    },
                    tooltip: {
                        mode: 'nearest',
                        callbacks: {
                            label: tooltipFormatter || ((context) => {
                                const label = context.label || '';
                                const value = Number(context.parsed || 0);
                                if (!total) {
                                    return `${label}: ${value.toLocaleString()}`;
                                }
                                const percentage = ((value / total) * 100).toFixed(1);
                                return `${label}: ${value.toLocaleString()} (${percentage}%)`;
                            })
                        },
                        backgroundColor: '#0F172A',
                        borderColor: 'rgba(15, 23, 42, 0.2)',
                        borderWidth: 1,
                        titleFont: {
                            size: isMobile ? 11 : 12
                        },
                        bodyFont: {
                            size: isMobile ? 10 : 11
                        },
                        padding: isMobile ? 8 : 10
                    }
                },
                animation: {
                    animateRotate: true,
                    animateScale: true,
                    duration: 900,
                    easing: 'easeOutQuart'
                }
            }
        });

        return chart;
    }

    function createHourlyProductionChart({
        canvas,
        labels,
        executedPerHour,
        plannedPerHour,
        highlightCurrentHour = false
    }) {
        if (!canvas) {
            console.error('[HOUR-CHART] Canvas não encontrado para renderização.');
            return null;
        }

        const ctx = canvas.getContext('2d');
        const canvasRect = canvas.getBoundingClientRect();
        const gradientHeight = canvasRect.height || canvas.height || 320;

        const fillGradient = ctx.createLinearGradient(0, 0, 0, gradientHeight);
        fillGradient.addColorStop(0, 'rgba(16, 185, 129, 0.65)');
        fillGradient.addColorStop(1, 'rgba(16, 185, 129, 0.1)');

        const executed = executedPerHour.map(value => Number(value) || 0);
        const planned = plannedPerHour.map(value => Number(value) || 0);

        const executedCumulative = [];
        const plannedCumulative = [];
        executed.reduce((sum, value, index) => {
            const total = sum + value;
            executedCumulative[index] = total;
            return total;
        }, 0);
        planned.reduce((sum, value, index) => {
            const total = sum + value;
            plannedCumulative[index] = total;
            return total;
        }, 0);

        let highlightIndex = -1;
        if (highlightCurrentHour) {
            const highlightLabel = window.getProductionHourLabel();
            highlightIndex = labels.indexOf(highlightLabel);
        }

        const barBackground = (context) => {
            if (!context) return fillGradient;
            const { dataIndex } = context;
            if (dataIndex === highlightIndex) {
                return 'rgba(14, 165, 233, 0.85)';
            }
            return fillGradient;
        };

        return new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [
                    {
                        type: 'line',
                        label: 'Produção Acumulada',
                        data: executedCumulative,
                        borderColor: '#10B981',
                        borderWidth: 2,
                        fill: false,
                        tension: 0.35,
                        pointRadius: 0,
                        yAxisID: 'y1',
                        order: 1
                    },
                    {
                        type: 'line',
                        label: 'Meta Acumulada',
                        data: plannedCumulative,
                        borderColor: '#EF4444',
                        borderWidth: 2,
                        borderDash: [8, 6],
                        fill: false,
                        tension: 0.25,
                        pointRadius: 0,
                        yAxisID: 'y1',
                        order: 0
                    }
                ]
            },
            options: mergeChartOptions({
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                layout: {
                    padding: {
                        top: 8,
                        bottom: 0,
                        left: 6,
                        right: 12
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(148, 163, 184, 0.18)',
                            drawBorder: false
                        },
                        ticks: {
                            callback: (value) => `${Number(value).toLocaleString()} pcs`
                        }
                    },
                    y1: {
                        beginAtZero: true,
                        position: 'right',
                        grid: {
                            drawOnChartArea: false
                        },
                        ticks: {
                            callback: (value) => `${Number(value).toLocaleString()} pcs`
                        }
                    }
                },
                plugins: {
                    legend: {
                        position: 'top',
                        align: 'center',
                        labels: {
                            usePointStyle: true,
                            padding: 14
                        }
                    },
                    tooltip: {
                        callbacks: {
                            title: (tooltipItems) => `Hora ${tooltipItems[0].label}`,
                            label: (context) => {
                                const label = context.dataset.label || '';
                                const rawValue = context.parsed?.y ?? context.parsed ?? 0;
                                const suffix = label.includes('Acumulada') ? ' peças acumuladas' : ' peças';
                                return `${label}: ${Number(rawValue).toLocaleString()}${suffix}`;
                            }
                        }
                    }
                }
            })
        });
    }

    // Gráfico Pareto de perdas
    async function generateLossesParetoChart(lossesData) {
        const canvas = document.getElementById('losses-pareto-chart');
        if (!canvas) return;

        destroyChart('losses-pareto-chart');

        if (!Array.isArray(lossesData) || lossesData.length === 0) {
            showNoDataMessage('losses-pareto-chart');
            return;
        }

        clearNoDataMessage('losses-pareto-chart');

        const aggregated = {};
        lossesData.forEach(item => {
            const reason = item?.reason || item?.category || item?.type || 'Sem classificação';
            // Usar refugo_kg para perdas, não quantity
            const quantity = Number(item?.raw?.refugo_kg || item?.quantity || 0);
            aggregated[reason] = (aggregated[reason] || 0) + quantity;
        });

        const sortedEntries = Object.entries(aggregated).sort((a, b) => b[1] - a[1]);
        const labels = sortedEntries.map(([label]) => label);
        const values = sortedEntries.map(([, value]) => value);
        const total = values.reduce((sum, value) => sum + value, 0);

        const cumulativePercentages = [];
        values.reduce((sum, value, index) => {
            const accumulated = sum + value;
            cumulativePercentages[index] = total ? (accumulated / total) * 100 : 0;
            return accumulated;
        }, 0);

        new Chart(canvas, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    {
                        type: 'bar',
                        label: 'Perdas (kg)',
                        data: values,
                        backgroundColor: 'rgba(239, 68, 68, 0.85)',
                        borderColor: '#B91C1C',
                        borderWidth: 1,
                        yAxisID: 'y'
                    },
                    {
                        type: 'line',
                        label: '% Acumulado',
                        data: cumulativePercentages,
                        borderColor: '#0EA5E9',
                        backgroundColor: 'transparent',
                        borderWidth: 2,
                        tension: 0.3,
                        pointRadius: 3,
                        pointHoverRadius: 5,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: mergeChartOptions({
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Perdas (kg)'
                        }
                    },
                    y1: {
                        beginAtZero: true,
                        suggestedMax: 100,
                        position: 'right',
                        grid: {
                            drawOnChartArea: false
                        },
                        ticks: {
                            callback: (value) => `${value}%`
                        },
                        title: {
                            display: true,
                            text: '% Acumulado'
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                if (context.dataset.type === 'line') {
                                    return `${context.dataset.label}: ${context.parsed.y.toFixed(1)}%`;
                                }
                                return `${context.dataset.label}: ${Number(context.parsed.y).toLocaleString()} kg`;
                            }
                        }
                    }
                }
            })
        });
    }

    // Gerar gráfico de perdas por máquina
    async function generateLossesByMachineChart(lossesData) {
        const ctx = document.getElementById('losses-by-machine-chart');
        if (!ctx) return;

        destroyChart('losses-by-machine-chart');

        if (lossesData.length === 0) {
            showNoDataMessage('losses-by-machine-chart');
            return;
        }
        
        clearNoDataMessage('losses-by-machine-chart');

        const machineLosses = {};
        lossesData.forEach(item => {
            const machine = item.machine || 'Sem máquina';
            // Usar refugo_kg para perdas, não quantity
            machineLosses[machine] = (machineLosses[machine] || 0) + (item.raw?.refugo_kg || item.quantity || 0);
        });

        const labels = Object.keys(machineLosses);
        const data = Object.values(machineLosses);

        const isMobile = window.innerWidth < 768;

        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Perdas (kg)',
                    data: data,
                    backgroundColor: 'rgba(239, 68, 68, 0.8)',
                    borderColor: '#EF4444',
                    borderWidth: 1
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,

                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: {
                            font: {
                                size: isMobile ? 10 : 12
                            }
                        }
                    },
                    y: {
                        ticks: {
                            font: {
                                size: isMobile ? 10 : 12
                            }
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    }


    // Gerar gráfico de perdas por tipo de matéria-prima
    async function generateLossesByMaterialChart(lossesData) {
        const ctx = document.getElementById('losses-by-material-chart');
        if (!ctx) return;

        destroyChart('losses-by-material-chart');

        if (lossesData.length === 0) {
            showNoDataMessage('losses-by-material-chart', 'Nenhuma perda com tipo de MP registrada');
            return;
        }
        
        clearNoDataMessage('losses-by-material-chart');

        // Agrupar perdas por tipo de MP
        const materialLosses = {};
        lossesData.forEach(item => {
            const mpType = item.mp_type || 'Não especificado';
            // Usar refugo_kg para perdas em kg, não quantity (que é em peças)
            materialLosses[mpType] = (materialLosses[mpType] || 0) + (item.raw?.refugo_kg || item.quantity || 0);
        });

        const labels = Object.keys(materialLosses);
        const data = Object.values(materialLosses);

        // Se não houver dados com mp_type, mostrar mensagem
        if (labels.length === 0 || (labels.length === 1 && labels[0] === 'Não especificado')) {
            showNoDataMessage('losses-by-material-chart', 'Configure o tipo de MP no planejamento para visualizar esta análise');
            return;
        }

        const isMobile = window.innerWidth < 768;

        // Cores para diferentes tipos de MP
        const colors = [
            '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'
        ];
        const totalLosses = data.reduce((sum, value) => sum + value, 0);

        renderModernDonutChart({
            canvasId: 'losses-by-material-chart',
            labels,
            data,
            colors,
            datasetLabel: 'Perdas (kg)',
            legendPosition: isMobile ? 'bottom' : 'right',
            tooltipFormatter: (context) => {
                const value = Number(context.parsed || 0);
                const percentage = totalLosses > 0 ? ((value / totalLosses) * 100).toFixed(1) : '0.0';
                return `${context.label}: ${value.toFixed(3)} kg (${percentage}%)`;
            }
        });
    }

    // ✅ NOVO: Gerar gráfico de perdas diárias
    async function generateLossesDailyChart(lossesData) {
        const ctx = document.getElementById('losses-daily-chart');
        if (!ctx) return;

        destroyChart('losses-daily-chart');

        if (!lossesData || lossesData.length === 0) {
            showNoDataMessage('losses-daily-chart', 'Nenhuma perda registrada no período');
            return;
        }
        
        clearNoDataMessage('losses-daily-chart');

        // Agrupar perdas por data
        const dailyLosses = {};
        lossesData.forEach(item => {
            // Tentar extrair a data do item
            let dateStr = item.date || item.raw?.date || item.raw?.data || '';
            
            // Se não tem data direta, tentar extrair do timestamp
            if (!dateStr && item.raw?.timestamp) {
                const ts = item.raw.timestamp?.toDate ? item.raw.timestamp.toDate() : new Date(item.raw.timestamp);
                if (ts instanceof Date && !isNaN(ts)) {
                    dateStr = ts.toISOString().split('T')[0];
                }
            }
            
            // Se ainda não tem data, usar data atual como fallback
            if (!dateStr) {
                dateStr = new Date().toISOString().split('T')[0];
            }
            
            // Usar refugo_kg para perdas em kg
            const lossKg = item.raw?.refugo_kg || item.quantity || 0;
            dailyLosses[dateStr] = (dailyLosses[dateStr] || 0) + lossKg;
        });

        // Ordenar as datas
        const sortedDates = Object.keys(dailyLosses).sort((a, b) => new Date(a) - new Date(b));
        
        // Formatar labels para exibição (DD/MM)
        const labels = sortedDates.map(date => {
            const parts = date.split('-');
            if (parts.length === 3) {
                return `${parts[2]}/${parts[1]}`;
            }
            return date;
        });
        
        const data = sortedDates.map(date => dailyLosses[date]);

        // Calcular média para linha de referência
        const avgLoss = data.length > 0 ? data.reduce((sum, val) => sum + val, 0) / data.length : 0;
        const avgLine = data.map(() => avgLoss);

        const isMobile = window.innerWidth < 768;

        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Perdas (kg)',
                        data: data,
                        backgroundColor: 'rgba(59, 130, 246, 0.7)',
                        borderColor: '#3B82F6',
                        borderWidth: 1,
                        borderRadius: 4,
                        order: 2
                    },
                    {
                        label: `Média (${avgLoss.toFixed(2)} kg)`,
                        data: avgLine,
                        type: 'line',
                        borderColor: '#EF4444',
                        borderWidth: 2,
                        borderDash: [5, 5],
                        pointRadius: 0,
                        fill: false,
                        order: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            font: {
                                size: isMobile ? 9 : 11
                            },
                            maxRotation: 45,
                            minRotation: 0
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        },
                        ticks: {
                            font: {
                                size: isMobile ? 10 : 12
                            },
                            callback: function(value) {
                                return value.toFixed(1) + ' kg';
                            }
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            padding: 15,
                            font: {
                                size: isMobile ? 10 : 12
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleFont: { size: 13 },
                        bodyFont: { size: 12 },
                        padding: 12,
                        callbacks: {
                            label: function(context) {
                                const value = context.parsed.y;
                                if (context.dataset.label.includes('Média')) {
                                    return `Média: ${value.toFixed(2)} kg`;
                                }
                                return `Perdas: ${value.toFixed(3)} kg`;
                            }
                        }
                    }
                }
            }
        });
    }

    // Variável para armazenar dados de downtime e modo atual do gráfico
    let cachedDowntimeDataForChart = [];
    let downtimeChartMode = 'category'; // 'category' ou 'reason'

    // Gerar gráfico de paradas por CATEGORIA ou MOTIVO
    async function generateDowntimeReasonsChart(downtimeData, mode = null) {
        const ctx = document.getElementById('downtime-reasons-chart');
        if (!ctx) return;

        // Se recebeu novos dados, SUBSTITUIR o cache (nunca mesclar com dados antigos)
        if (downtimeData !== null && downtimeData !== undefined) {
            cachedDowntimeDataForChart = Array.isArray(downtimeData) ? [...downtimeData] : [];
            console.log('[generateDowntimeReasonsChart] Cache atualizado com', cachedDowntimeDataForChart.length, 'eventos');
        }
        
        // Usar modo passado ou o modo atual
        if (mode) {
            downtimeChartMode = mode;
        }

        destroyChart('downtime-reasons-chart');

        if (cachedDowntimeDataForChart.length === 0) {
            showNoDataMessage('downtime-reasons-chart');
            return;
        }
        
        clearNoDataMessage('downtime-reasons-chart');

        let labels, data, colors;
        const isMobile = window.innerWidth < 768;
        
        // Cores para cada categoria - Sincronizadas com status do Dashboard TV
        // Usar cores do database.js se disponíveis
        const dbColors = window.databaseModule?.downtimeReasonColors || {};
        const categoryColors = {
            'FERRAMENTARIA': '#ff1744',      // Status Critical - Vermelho
            'PROCESSO': '#7c4dff',            // Status Maintenance - Roxo
            'COMPRAS': '#ffab00',             // Status Warning - Amarelo
            'PREPARAÇÃO': '#ffab00',          // Status Warning - Amarelo
            'QUALIDADE': '#7c4dff',           // Status Maintenance - Roxo
            'MANUTENÇÃO': '#ff1744',          // Status Critical - Vermelho
            'PRODUÇÃO': '#00e676',            // Status Running - Verde
            'SETUP': '#ffab00',               // Status Warning - Amarelo
            'ADMINISTRATIVO': '#78909c',      // Status Idle - Cinza
            'PCP': '#78909c',                 // Status Idle - Cinza
            'COMERCIAL': '#00bcd4',           // Status Comercial - Ciano
            'OUTROS': '#9e9e9e'               // Status Outros - Cinza médio
        };

        if (downtimeChartMode === 'category') {
            // Agrupar por CATEGORIA
            const categoryDurations = {};
            cachedDowntimeDataForChart.forEach(item => {
                const reason = item.reason || 'Sem motivo';
                const category = window.getDowntimeCategory(reason);
                categoryDurations[category] = (categoryDurations[category] || 0) + (item.duration || 0);
            });

            labels = Object.keys(categoryDurations);
            data = Object.values(categoryDurations).map(d => Number(((d || 0) / 60).toFixed(2)));
            colors = labels.map(label => categoryColors[label] || '#6B7280');
        } else {
            // Agrupar por MOTIVO individual
            const reasonDurations = {};
            cachedDowntimeDataForChart.forEach(item => {
                const reason = item.reason || 'Sem motivo';
                reasonDurations[reason] = (reasonDurations[reason] || 0) + (item.duration || 0);
            });

            // Ordenar por duração (maior primeiro) e pegar os top 12
            const sortedReasons = Object.entries(reasonDurations)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 12);
            
            labels = sortedReasons.map(([reason]) => reason);
            data = sortedReasons.map(([, duration]) => Number(((duration || 0) / 60).toFixed(2)));
            
            // Atribuir cores baseadas na categoria de cada motivo
            colors = labels.map(reason => {
                const category = window.getDowntimeCategory(reason);
                return categoryColors[category] || '#6B7280';
            });
        }

        const totalHours = data.reduce((sum, value) => sum + value, 0);

        renderModernDonutChart({
            canvasId: 'downtime-reasons-chart',
            labels,
            data,
            colors: colors,
            datasetLabel: 'Paradas (h)',
            legendPosition: isMobile ? 'bottom' : 'right',
            tooltipFormatter: (context) => {
                const value = Number(context.parsed || 0);
                const percentage = totalHours > 0 ? ((value / totalHours) * 100).toFixed(1) : '0.0';
                return `${context.label}: ${value.toFixed(1)} h (${percentage}%)`;
            }
        });
    }

    // Setup dos botões de toggle do gráfico de paradas
    function setupDowntimeChartToggle() {
        const btnCategory = document.getElementById('btn-chart-category');
        const btnReason = document.getElementById('btn-chart-reason');
        
        if (!btnCategory || !btnReason) return;
        
        const updateToggleStyles = (activeBtn, inactiveBtn) => {
            activeBtn.classList.remove('text-gray-500', 'hover:text-gray-700');
            activeBtn.classList.add('bg-white', 'text-gray-800', 'shadow-sm');
            inactiveBtn.classList.remove('bg-white', 'text-gray-800', 'shadow-sm');
            inactiveBtn.classList.add('text-gray-500', 'hover:text-gray-700');
        };
        
        btnCategory.onclick = () => {
            if (downtimeChartMode === 'category') return;
            updateToggleStyles(btnCategory, btnReason);
            generateDowntimeReasonsChart(null, 'category');
        };
        
        btnReason.onclick = () => {
            if (downtimeChartMode === 'reason') return;
            updateToggleStyles(btnReason, btnCategory);
            generateDowntimeReasonsChart(null, 'reason');
        };
    }

    // Gerar gráfico de paradas por máquina
    async function generateDowntimeByMachineChart(downtimeData) {
        const ctx = document.getElementById('downtime-by-machine-chart');
        if (!ctx) return;

        destroyChart('downtime-by-machine-chart');

        if (downtimeData.length === 0) {
            showNoDataMessage('downtime-by-machine-chart');
            return;
        }
        
        clearNoDataMessage('downtime-by-machine-chart');

        const machineDowntime = {};
        downtimeData.forEach(item => {
            const machine = item.machine || 'Sem máquina';
            machineDowntime[machine] = (machineDowntime[machine] || 0) + (item.duration || 0);
        });

        const labels = Object.keys(machineDowntime);
        const data = Object.values(machineDowntime).map(d => (d / 60).toFixed(1)); // Converter para horas

        const isMobile = window.innerWidth < 768;

        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Tempo de Parada (h)',
                    data: data,
                    backgroundColor: 'rgba(239, 68, 68, 0.8)',
                    borderColor: '#EF4444',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,

                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            font: {
                                size: isMobile ? 10 : 12
                            },
                            callback: function(value) {
                                return value + 'h';
                            }
                        }
                    },
                    x: {
                        ticks: {
                            font: {
                                size: isMobile ? 10 : 12
                            }
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    }

    // Gerar timeline de paradas
    async function generateDowntimeTimelineChart(downtimeData) {
        const ctx = document.getElementById('downtime-timeline-chart');
        if (!ctx) {
            console.error('[TIMELINE] Canvas não encontrado: downtime-timeline-chart');
            return;
        }

        destroyChart('downtime-timeline-chart');

        console.log('[TIMELINE] Dados recebidos:', downtimeData.length, 'registros');
        
        if (downtimeData.length === 0) {
            console.warn('[TIMELINE] Nenhum dado de parada para mostrar');
            showNoDataMessage('downtime-timeline-chart');
            return;
        }
        
        // Log amostra de dados para debug
        if (downtimeData.length > 0) {
            console.log('[TIMELINE] Amostra de dados:', JSON.stringify(downtimeData.slice(0, 3), null, 2));
        }
        
        clearNoDataMessage('downtime-timeline-chart');

        // Limitar aos últimos 20 eventos para visualização
        const recentDowntimes = downtimeData.slice(-20).reverse();
        
        console.log('[TIMELINE] Paradas recentes:', recentDowntimes.length);
        
        const labels = recentDowntimes.map((item, index) => {
            const dateStr = item.date || item.workDay || '';
            let dateLabel;
            try {
                const date = dateStr ? new Date(dateStr) : new Date();
                dateLabel = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
            } catch (e) {
                dateLabel = dateStr;
            }
            return `${dateLabel} - ${item.machine || 'Máq'}`;
        });
        
        const data = recentDowntimes.map(item => item.duration || 0);
        
        console.log('[TIMELINE] Labels:', labels);
        console.log('[TIMELINE] Durações:', data);

        const isMobile = window.innerWidth < 768;

        try {
            new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Duração (min)',
                        data: data,
                        backgroundColor: recentDowntimes.map(item => {
                            const duration = item.duration || 0;
                            if (duration > 120) return '#EF4444'; // Vermelho para >2h
                            if (duration > 60) return '#F59E0B'; // Amarelo para >1h
                            return '#10B981'; // Verde para <1h
                        }),
                        borderWidth: 1,
                        borderColor: '#fff'
                    }]
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: {
                            beginAtZero: true,
                            ticks: {
                                font: {
                                    size: isMobile ? 10 : 12
                                }
                            }
                        },
                        y: {
                            ticks: {
                                font: {
                                    size: isMobile ? 8 : 10
                                }
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const item = recentDowntimes[context.dataIndex];
                                    return [
                                        `Duração: ${context.parsed.x} min`,
                                        `Motivo: ${item.reason || 'Não informado'}`
                                    ];
                                }
                            }
                        }
                    }
                }
            });
            console.log('[TIMELINE] Gráfico criado com sucesso');
        } catch (error) {
            console.error('[TIMELINE] Erro ao criar gráfico:', error);
        }
    }

    async function generateBorraByMachineChart(borraData) {
        const ctx = document.getElementById('borra-by-machine-chart');
        if (!ctx) return;

        destroyChart('borra-by-machine-chart');

        if (borraData.length === 0) {
            showNoDataMessage('borra-by-machine-chart');
            return;
        }
        
        clearNoDataMessage('borra-by-machine-chart');

        const machineCounts = {};
        borraData.forEach(item => {
            const machine = item.machine || 'Não especificado';
            const weight = item.raw?.refugo_kg || item.raw?.quantityKg || item.scrapKg || item.quantity || 0;
            machineCounts[machine] = (machineCounts[machine] || 0) + weight;
        });

        const labels = Object.keys(machineCounts);
        const data = Object.values(machineCounts);

        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Borra (kg)',
                    data: data,
                    backgroundColor: 'rgba(251, 191, 36, 0.8)',
                    borderColor: '#F59E0B',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            font: { size: window.innerWidth < 768 ? 10 : 12 }
                        }
                    },
                    x: {
                        ticks: {
                            font: { size: window.innerWidth < 768 ? 10 : 12 }
                        }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.parsed.y.toFixed(1)} kg`;
                            }
                        }
                    }
                }
            }
        });
    }

    // Gerar gráfico de borra mensal com acumulado
    async function generateBorraMonthlyChart(borraData) {
        const ctx = document.getElementById('borra-monthly-chart');
        if (!ctx) return;

        destroyChart('borra-monthly-chart');

        if (borraData.length === 0) {
            showNoDataMessage('borra-monthly-chart');
            return;
        }
        
        clearNoDataMessage('borra-monthly-chart');

        // Agrupar por mês
        const monthlyData = {};
        const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        
        borraData.forEach(item => {
            const raw = item.raw || {};
            let date = null;
            
            // Extrair data do registro
            if (raw.date?.toDate) {
                date = raw.date.toDate();
            } else if (raw.datetime?.toDate) {
                date = raw.datetime.toDate();
            } else if (raw.timestamp?.toDate) {
                date = raw.timestamp.toDate();
            } else if (typeof raw.date === 'string') {
                date = new Date(raw.date);
            } else if (typeof raw.datetime === 'string') {
                date = new Date(raw.datetime);
            }
            
            if (!date || isNaN(date.getTime())) {
                date = new Date(); // Fallback para data atual
            }
            
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            const weight = raw.refugo_kg || raw.quantityKg || item.scrapKg || item.quantity || 0;
            
            if (!monthlyData[monthKey]) {
                monthlyData[monthKey] = {
                    month: monthNames[date.getMonth()],
                    year: date.getFullYear(),
                    total: 0
                };
            }
            monthlyData[monthKey].total += weight;
        });

        // Ordenar por data e pegar últimos 6 meses
        const sortedMonths = Object.keys(monthlyData).sort().slice(-6);
        const labels = sortedMonths.map(key => `${monthlyData[key].month}/${String(monthlyData[key].year).slice(-2)}`);
        const monthlyTotals = sortedMonths.map(key => monthlyData[key].total);
        
        // Calcular acumulado
        const accumulated = [];
        let runningTotal = 0;
        monthlyTotals.forEach(val => {
            runningTotal += val;
            accumulated.push(runningTotal);
        });

        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Mensal (kg)',
                        data: monthlyTotals,
                        backgroundColor: 'rgba(251, 191, 36, 0.8)',
                        borderColor: '#F59E0B',
                        borderWidth: 1,
                        order: 2
                    },
                    {
                        label: 'Acumulado (kg)',
                        data: accumulated,
                        type: 'line',
                        borderColor: '#DC2626',
                        backgroundColor: 'rgba(220, 38, 38, 0.1)',
                        borderWidth: 2,
                        fill: false,
                        tension: 0.3,
                        pointRadius: 4,
                        pointBackgroundColor: '#DC2626',
                        yAxisID: 'y1',
                        order: 1
                    },
                    {
                        label: 'Meta (450 kg)',
                        data: labels.map(() => 450),
                        type: 'line',
                        borderColor: '#EF4444',
                        borderWidth: 2,
                        borderDash: [5, 5],
                        pointRadius: 0,
                        fill: false,
                        order: 0
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: 'Mensal (kg)',
                            font: { size: 10 }
                        },
                        ticks: {
                            font: { size: window.innerWidth < 768 ? 9 : 10 }
                        }
                    },
                    y1: {
                        beginAtZero: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Acumulado (kg)',
                            font: { size: 10 }
                        },
                        grid: {
                            drawOnChartArea: false
                        },
                        ticks: {
                            font: { size: window.innerWidth < 768 ? 9 : 10 }
                        }
                    },
                    x: {
                        ticks: {
                            font: { size: window.innerWidth < 768 ? 9 : 10 }
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            boxWidth: 12,
                            font: { size: 10 }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.dataset.label}: ${context.parsed.y.toFixed(1)} kg`;
                            }
                        }
                    }
                }
            }
        });
    }

    // Variáveis globais para paginação da tabela de borra
    let borraTableData = [];
    let borraTableCurrentPage = 1;
    const borraTablePageSize = 10;

    // Função para preencher a tabela de apontamentos de borra
    async function populateBorraApontamentosTable(borraData) {
        const tableBody = document.getElementById('borra-apontamentos-table');
        if (!tableBody) return;

        // Preparar dados da tabela
        borraTableData = borraData.map(item => {
            const raw = item.raw || {};
            
            // Extrair data/hora
            let dateTime = '---';
            if (raw.date || raw.datetime) {
                const dateStr = raw.date || raw.datetime;
                if (dateStr?.toDate) {
                    const d = dateStr.toDate();
                    dateTime = `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
                } else if (typeof dateStr === 'string') {
                    dateTime = dateStr;
                }
            } else if (raw.timestamp?.toDate) {
                const d = raw.timestamp.toDate();
                dateTime = `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
            }

            // Extrair motivo (removendo prefixo BORRA)
            let reason = item.reason || raw.perdas || raw.motivo || 'Não especificado';
            reason = reason.replace(/^BORRA\s*-\s*/i, '');

            return {
                dateTime: dateTime,
                machine: item.machine || raw.machine_id || raw.maquina || '---',
                reason: reason,
                material: item.material || raw.mp || raw.materia_prima || '---',
                quantity: raw.refugo_kg || raw.quantityKg || item.scrapKg || item.quantity || 0,
                operator: raw.operator || raw.operador || raw.user || '---',
                shift: raw.turno || raw.shift || '---'
            };
        }).sort((a, b) => {
            // Ordenar por data mais recente primeiro
            if (a.dateTime === '---') return 1;
            if (b.dateTime === '---') return -1;
            return b.dateTime.localeCompare(a.dateTime);
        });

        borraTableCurrentPage = 1;
        renderBorraTable();
    }

    // Função para renderizar a tabela de borra
    function renderBorraTable() {
        const tableBody = document.getElementById('borra-apontamentos-table');
        if (!tableBody) return;

        const totalItems = borraTableData.length;
        const totalPages = Math.ceil(totalItems / borraTablePageSize);
        const startIndex = (borraTableCurrentPage - 1) * borraTablePageSize;
        const endIndex = Math.min(startIndex + borraTablePageSize, totalItems);
        const pageData = borraTableData.slice(startIndex, endIndex);

        if (totalItems === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="4" class="px-4 py-8 text-center text-gray-400">
                        <i data-lucide="inbox" class="w-8 h-8 mx-auto mb-2"></i>
                        <p>Nenhum apontamento de borra encontrado no período</p>
                    </td>
                </tr>
            `;
            lucide.createIcons();
        } else {
            tableBody.innerHTML = pageData.map((row, idx) => `
                <tr class="hover:bg-amber-50/50 transition ${idx % 2 === 0 ? 'bg-white' : 'bg-amber-50/30'}">
                    <td class="px-4 py-3 text-gray-700 text-xs">${row.dateTime}</td>
                    <td class="px-4 py-3">
                        <span class="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">${row.machine}</span>
                    </td>
                    <td class="px-4 py-3 text-center">
                        <span class="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs font-semibold">${parseFloat(row.quantity).toFixed(3)}</span>
                    </td>
                    <td class="px-4 py-3">
                        <span class="px-2 py-1 ${getTurnoColor(row.shift)} rounded text-xs font-medium">${row.shift}</span>
                    </td>
                </tr>
            `).join('');
        }

        // Atualizar informações de paginação
        const showingEl = document.getElementById('borra-table-showing');
        const totalEl = document.getElementById('borra-table-total');
        const pageEl = document.getElementById('borra-table-page');
        const prevBtn = document.getElementById('borra-table-prev');
        const nextBtn = document.getElementById('borra-table-next');

        if (showingEl) showingEl.textContent = totalItems > 0 ? `${startIndex + 1}-${endIndex}` : '0';
        if (totalEl) totalEl.textContent = totalItems;
        if (pageEl) pageEl.textContent = `Página ${borraTableCurrentPage} de ${totalPages || 1}`;
        if (prevBtn) prevBtn.disabled = borraTableCurrentPage <= 1;
        if (nextBtn) nextBtn.disabled = borraTableCurrentPage >= totalPages;

        // Reinicializar ícones Lucide
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    // Função auxiliar para cor do turno
    function getTurnoColor(turno) {
        const turnoLower = (turno || '').toString().toLowerCase();
        if (turnoLower.includes('a') || turnoLower.includes('1') || turnoLower.includes('manhã') || turnoLower.includes('manha')) {
            return 'bg-green-100 text-green-700';
        } else if (turnoLower.includes('b') || turnoLower.includes('2') || turnoLower.includes('tarde')) {
            return 'bg-blue-100 text-blue-700';
        } else if (turnoLower.includes('c') || turnoLower.includes('3') || turnoLower.includes('noite')) {
            return 'bg-purple-100 text-purple-700';
        }
        return 'bg-gray-100 text-gray-700';
    }

    // Funções de navegação da tabela
    function borraTableNextPage() {
        const totalPages = Math.ceil(borraTableData.length / borraTablePageSize);
        if (borraTableCurrentPage < totalPages) {
            borraTableCurrentPage++;
            renderBorraTable();
        }
    }

    function borraTablePrevPage() {
        if (borraTableCurrentPage > 1) {
            borraTableCurrentPage--;
            renderBorraTable();
        }
    }

    // Função para exportar tabela de borra
    function exportBorraTable() {
        if (borraTableData.length === 0) {
            showNotification('Não há dados para exportar', 'warning');
            return;
        }

        const headers = ['Data/Hora', 'Máquina', 'Quantidade (kg)', 'Turno'];
        const csvContent = [
            headers.join(';'),
            ...borraTableData.map(row => [
                row.dateTime,
                row.machine,
                parseFloat(row.quantity).toFixed(3).replace('.', ','),
                row.shift
            ].join(';'))
        ].join('\n');

        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `apontamentos_borra_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showNotification('Exportação concluída!', 'success');
    }

    // Função para calcular OEE detalhado
    async function calculateDetailedOEE(startDate, endDate, machine, shift) {
        try {
            // Normalizar shift: se não está definido ou é null, usar 'all'
            const normalizedShift = shift === undefined || shift === null || shift === '' ? 'all' : shift;
            
            console.log('[TRACE][calculateDetailedOEE] Buscando dados para:', { startDate, endDate, machine, shift: normalizedShift });
            
            const [productionData, lossesData, downtimeData, planData] = await Promise.all([
                getFilteredData('production', startDate, endDate, machine, 'all'),
                getFilteredData('losses', startDate, endDate, machine, 'all'),
                getFilteredData('downtime', startDate, endDate, machine, 'all'),
                getFilteredData('plan', startDate, endDate, machine, 'all')
            ]);

            console.log('[TRACE][calculateDetailedOEE] Dados recebidos:', {
                production: productionData.length,
                losses: lossesData.length,
                downtime: downtimeData.length,
                plan: planData.length
            });

            if (productionData.length === 0 && lossesData.length === 0 && downtimeData.length === 0) {
                console.warn('[TRACE][calculateDetailedOEE] PROBLEMA: Nenhum dado encontrado para o período!');
                return { availability: 0, performance: 0, quality: 0, oee: 0 };
            }

            const { filtered, groups } = aggregateOeeMetrics(
                productionData,
                lossesData,
                downtimeData,
                planData,
                normalizedShift  // <-- usar normalizedShift em vez de shift
            );

            console.log('[TRACE][calculateDetailedOEE] Resultado da agregação:', {
                gruposProcessados: groups.length,
                disponibilidade: (filtered.disponibilidade * 100).toFixed(1),
                performance: (filtered.performance * 100).toFixed(1),
                qualidade: (filtered.qualidade * 100).toFixed(1),
                oee: (filtered.oee * 100).toFixed(1)
            });

            // CORREÇÃO: Se todos os valores estão zero mas há dados, algo está errado
            if (filtered.disponibilidade === 0 && filtered.performance === 0 && filtered.qualidade === 0 && productionData.length > 0) {
                console.error('[TRACE][calculateDetailedOEE] PROBLEMA CRÍTICO: Valores zerados com dados disponíveis!');
                console.log('[TRACE][calculateDetailedOEE] Amostra production:', productionData.slice(0, 3));
                console.log('[TRACE][calculateDetailedOEE] Amostra plan:', planData.slice(0, 3));
            }

            // CORREÇÃO: Calcular OEE como produto dos componentes (D × P × Q)
            // em vez de usar a média dos OEEs individuais
            const availability = filtered.disponibilidade * 100;
            const performance = filtered.performance * 100;
            const quality = filtered.qualidade * 100;
            const oeeCalculated = (availability * performance * quality) / 10000;

            return {
                availability: availability,
                performance: performance,
                quality: quality,
                oee: oeeCalculated  // OEE = D × P × Q (correto!)
            };
        } catch (error) {
            console.error('Erro ao calcular OEE detalhado:', error);
            return { availability: 0, performance: 0, quality: 0, oee: 0 };
        }
    }

    // Implementações faltantes para análise completa


    // Expor o serviço de dados analíticos para módulos externos (ex.: predictive-analytics)
    if (!window.analyticsDataService) {
        window.analyticsDataService = {};
    }
    window.analyticsDataService.getFilteredData = getFilteredData;

    // Compatibilidade: garantir que outros módulos (Advanced KPIs, SPC, etc.) encontrem a versão completa
    window.getFilteredData = getFilteredData;
    
    // Expor funções da tabela de borra
    window.borraTableNextPage = borraTableNextPage;
    window.borraTablePrevPage = borraTablePrevPage;
    window.exportBorraTable = exportBorraTable;
        
    // Final da inicialização  
    init();

    function getProductionDateString(date = new Date()) {
        const dateObj = date instanceof Date ? date : new Date(date);
        const hour = dateObj.getHours();
        const minute = dateObj.getMinutes();
        
        // Se for antes das 6h30, pertence ao dia de trabalho anterior
        if (hour < 6 || (hour === 6 && minute < 30)) {
            const prevDay = new Date(dateObj);
            prevDay.setDate(prevDay.getDate() - 1);
            return new Date(prevDay.getTime() - (prevDay.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
        }
        
        return new Date(dateObj.getTime() - (dateObj.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    }
    
    /**
     * Retorna o range de datas de calendário que cobrem um dia de trabalho específico
     * Um dia de trabalho começa às 7h e termina às 6h59 do dia seguinte
     * Exemplo: workday "2025-01-06" = calendário 2025-01-06 (7h) até 2025-01-07 (6h59)
     */
    function getCalendarDateRangeForWorkday(workdayDate) {
        if (!workdayDate || typeof workdayDate !== 'string') return { startDate: null, endDate: null };
        
        const [year, month, day] = workdayDate.split('-').map(Number);
        if ([year, month, day].some(n => Number.isNaN(n))) {
            return { startDate: null, endDate: null };
        }
        
        // Um workday começa no calendário de `workdayDate` e termina no calendário do dia seguinte
        const nextDay = new Date(year, month - 1, day + 1);
        
        return {
            startDate: workdayDate,  // 2025-01-06 representa 7h até 6h59
            endDate: nextDay.toISOString().split('T')[0]  // Próximo dia até 6h59
        };
    }

    function setTodayDate() {
        const todayString = getProductionDateString();
        if (planningDateSelector) planningDateSelector.value = todayString;
        if (resumoDateSelector) resumoDateSelector.value = todayString;
        
        if (startDateSelector) startDateSelector.value = todayString;
        if (endDateSelector) endDateSelector.value = todayString;
    }

    function setupEventListeners() {
        // Usar event delegation para nav buttons (funciona com novos elementos)
        const navContainer = document.querySelector('nav');
        if (navContainer) {
            navContainer.addEventListener('click', (e) => {
                const navBtn = e.target.closest('.nav-btn');
                if (navBtn) {
                    // Se for link externo (sem data-page), deixar comportamento padrão
                    if (!navBtn.dataset.page) {
                        return; // Não interceptar
                    }
                    e.preventDefault();
                    handleNavClick({ currentTarget: navBtn, preventDefault: () => {} });
                }
            });
        } else {
            // Fallback: listener direto nos botões
            navButtons.forEach(button => button.addEventListener('click', handleNavClick));
        }
        
        // handleAnalysisTabClick — delegado ao controller de análise
        
        if (sidebarOpenBtn) sidebarOpenBtn.addEventListener('click', openSidebar);
        if (sidebarCloseBtn) sidebarCloseBtn.addEventListener('click', closeSidebar);
        if (sidebarToggleBtn) sidebarToggleBtn.addEventListener('click', toggleSidebarCollapse);
        if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeSidebar);

    if (planningForm) planningForm.addEventListener('submit', handlePlanningFormSubmit);
    if (planningOrderSelect) planningOrderSelect.addEventListener('change', onPlanningOrderChange);
    
    // Event listeners para busca de OP
    const orderSearchInput = document.getElementById('planning-order-search');
    if (orderSearchInput) {
        console.log('[Planejamento] Adicionando event listeners ao campo de busca de OP');
        orderSearchInput.addEventListener('input', onPlanningOrderSearchInput);
        orderSearchInput.addEventListener('blur', onPlanningOrderSearchBlur);
        orderSearchInput.addEventListener('focus', (e) => {
            if (e.target.value.trim()) {
                searchPlanningOrder(e.target.value);
            }
        });
    } else {
        console.warn('[Planejamento] Campo de busca de OP não encontrado!');
    }
    
        if (planningDateSelector) planningDateSelector.addEventListener('change', (e) => listenToPlanningChanges(e.target.value));
        if (productionOrderForm) productionOrderForm.addEventListener('submit', handleProductionOrderFormSubmit);
        
        // Adicionar listener para código do produto
        const productCodInput = document.getElementById('planning-product-cod');
        if (productCodInput) {
            ['change', 'blur'].forEach(evt => {
                productCodInput.addEventListener(evt, onPlanningProductCodChange);
            });
            productCodInput.addEventListener('input', onPlanningProductCodChange);
        }
        
        if (planningTableBody) planningTableBody.addEventListener('click', handlePlanningTableClick);
        
        if (leaderLaunchPanel) leaderLaunchPanel.addEventListener('click', handleLeaderPanelClick);
        if (leaderModal) {
            const leaderModalCloseBtn = leaderModal.querySelector('#leader-modal-close-btn');
            if (leaderModalCloseBtn) leaderModalCloseBtn.addEventListener('click', hideLeaderModal);
        }
        if (leaderModalForm) leaderModalForm.addEventListener('submit', handleLeaderEntrySubmit);
        
        if (launchPanelContainer) launchPanelContainer.addEventListener('click', handleLaunchPanelClick);
        if (productionModal) {
            const prodCloseBtn = productionModal.querySelector('#production-modal-close-btn');
            const prodCancelBtn = productionModal.querySelector('#production-modal-cancel-btn');
            if (prodCloseBtn) prodCloseBtn.addEventListener('click', hideProductionModal);
            if (prodCancelBtn) prodCancelBtn.addEventListener('click', hideProductionModal);
        }
        if (productionModalForm) productionModalForm.addEventListener('submit', handleProductionEntrySubmit);
        if (refreshRecentEntriesBtn) refreshRecentEntriesBtn.addEventListener('click', () => loadRecentEntries());
        if (recentEntriesList) recentEntriesList.addEventListener('click', handleRecentEntryAction);
        if (finalizeOrderBtn) finalizeOrderBtn.addEventListener('click', handleFinalizeOrderClick);
    if (activateOrderBtn) activateOrderBtn.addEventListener('click', handleActivateOrderFromPanel);
        
        // Event listeners para filtro de data e máquina de lançamentos históricos
        const entriesDateFilter = document.getElementById('entries-date-filter');
        const entriesMachineFilter = document.getElementById('entries-machine-filter');
        const entriesDateToday = document.getElementById('entries-date-today');
        const entriesClearAllFilters = document.getElementById('entries-clear-all-filters');
        
        // Popular seletor de máquinas
        if (entriesMachineFilter && typeof machineProductData !== 'undefined') {
            const machines = Object.keys(machineProductData).sort();
            machines.forEach(machine => {
                const option = document.createElement('option');
                option.value = machine;
                option.textContent = machine;
                entriesMachineFilter.appendChild(option);
            });
        }
        
        if (entriesDateFilter) {
            // Definir data atual como valor padrão
            entriesDateFilter.value = getProductionDateString();
            
            entriesDateFilter.addEventListener('change', () => {
                const selectedDate = entriesDateFilter.value;
                if (selectedDate) {
                    window.lancamentoFilterDate = selectedDate;
                    updateEntriesFilterIndicator();
                    loadRecentEntriesWithFilters();
                }
            });
        }
        
        if (entriesMachineFilter) {
            entriesMachineFilter.addEventListener('change', () => {
                const selectedMachine = entriesMachineFilter.value;
                window.lancamentoFilterMachine = selectedMachine || null;
                updateEntriesFilterIndicator();
                loadRecentEntriesWithFilters();
            });
        }
        
        if (entriesDateToday) {
            entriesDateToday.addEventListener('click', () => {
                const today = getProductionDateString();
                if (entriesDateFilter) entriesDateFilter.value = today;
                if (entriesMachineFilter) entriesMachineFilter.value = '';
                window.lancamentoFilterDate = null;
                window.lancamentoFilterMachine = null;
                hideEntriesFilterIndicator();
                loadRecentEntries(true);
            });
        }
        
        if (entriesClearAllFilters) {
            entriesClearAllFilters.addEventListener('click', () => {
                const today = getProductionDateString();
                if (entriesDateFilter) entriesDateFilter.value = today;
                if (entriesMachineFilter) entriesMachineFilter.value = '';
                window.lancamentoFilterDate = null;
                window.lancamentoFilterMachine = null;
                hideEntriesFilterIndicator();
                loadRecentEntries(true);
            });
        }
        
        // Event listeners para filtros de lançamentos recentes
        const filterButtons = document.querySelectorAll('.filter-entry-btn');
        filterButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const filter = btn.dataset.filter;
                applyEntryFilter(filter);
            });
        });
        
    if (resumoDateSelector) resumoDateSelector.addEventListener('change', () => window.loadResumoData?.());
        if (printReportBtn) printReportBtn.addEventListener('click', () => window.handlePrintReport?.());
    if (reportQuantBtn) reportQuantBtn.addEventListener('click', () => window.switchReportView?.('quant'));

    // Carregar OPs para o formulário de planejamento
    loadPlanningOrders().catch(err => console.warn('Erro ao carregar OPs para planejamento:', err));
        if (reportEfficBtn) reportEfficBtn.addEventListener('click', () => window.switchReportView?.('effic'));
        if (resumoContentContainer) resumoContentContainer.addEventListener('click', (e) => window.handleResumoTableClick?.(e));
        
        if (refreshDashboardBtn) refreshDashboardBtn.addEventListener('click', () => window.loadDashboardData?.());
        if (machineFilter) machineFilter.addEventListener('change', () => window.processAndRenderDashboard?.(window.fullDashboardData));
        if (graphMachineFilter) graphMachineFilter.addEventListener('change', () => window.processAndRenderDashboard?.(window.fullDashboardData));
        
        dateRangeButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                dateRangeButtons.forEach(btn => btn.classList.remove('active'));
                e.currentTarget.classList.add('active');
                setDateRange(e.currentTarget.dataset.range);
            });
        });


        // Confirm modal handlers are assigned dynamically inside showConfirmModal

        // NOVOS EVENT LISTENERS PARA O SISTEMA DE LANÇAMENTOS POR HORA
        document.addEventListener('input', function(e) {
            if (e.target.classList.contains('peso-bruto-input') || 
                e.target.classList.contains('embalagem-fechada-input')) {
                updateTotalCalculation();
            }
        });

        document.addEventListener('change', function(e) {
            if (e.target.classList.contains('usar-tara-checkbox') || e.target.id === 'use-tara-box') {
                updateTotalCalculation();
            }
        });

        // Event listener para deletar lançamentos por hora
        document.addEventListener('click', async function(e) {
            if (e.target.closest('.delete-hourly-entry')) {
                const button = e.target.closest('.delete-hourly-entry');
                const entryId = button.dataset.id;
                
                try {
                    await db.collection('hourly_production_entries').doc(entryId).delete();
                    button.closest('.hourly-entry').remove();
                    updateTotalCalculation();
                } catch (error) {
                    console.error("Erro ao deletar lançamento:", error);
                    alert("Erro ao deletar lançamento.");
                }
            }
        });
    }

    // --- GESTÃO DE LISTENERS ---
    function detachActiveListener() {
        // O gerenciador de listeners cuida automaticamente de desinscrições
        // Esta função é mantida para compatibilidade
        console.log('✅ Listeners ativos desinscritos pelo listenerManager');
    }

    // --- GESTÃO DE ORDENS DE PRODUÇÃO ---
    let ordersCache = [];
    
    async function loadProductionOrders() {
        console.log('[Ordens] Carregando ordens de produção...');
        
        const grid = document.getElementById('orders-grid');
        const tableBody = document.getElementById('orders-table-body');
        const tableContainer = document.getElementById('orders-table-container');
        const emptyState = document.getElementById('orders-empty-state');
        const countEl = document.getElementById('orders-count');
        
        try {
            // Usar função cacheada para economizar leituras do Firebase
            ordersCache = await getProductionOrdersCached();
            console.log('[Ordens] ' + ordersCache.length + ' ordens carregadas (cache/Firebase)');
            
            // Atualizar KPIs
            updateOrdersKPIs(ordersCache);
            
            // Renderizar ordens
            renderOrders(ordersCache);
            
            // Popular filtro de máquinas
            populateOrdersMachineFilter();
            
            // Configurar filtros e eventos (apenas uma vez)
            if (!window.ordersFiltersConfigured) {
                setupOrdersFilters();
                setupOrdersViewToggle();
                window.ordersFiltersConfigured = true;
            }
            
        } catch (error) {
            console.error('[Ordens] Erro ao carregar:', error);
            if (countEl) countEl.textContent = 'Erro ao carregar ordens';
        }
    }
    
    function updateOrdersKPIs(orders) {
        const total = orders.length;
        const active = orders.filter(o => ['ativa', 'em_andamento'].includes((o.status || '').toLowerCase())).length;
        const suspended = orders.filter(o => (o.status || '').toLowerCase() === 'suspensa').length;
        const completed = orders.filter(o => ['concluida', 'finalizada'].includes((o.status || '').toLowerCase())).length;
        
        // Calcular totais de produção e perdas
        let totalProducedAll = 0;
        let totalLossesAll = 0;
        orders.forEach(o => {
            const produced = Number(o.total_produzido ?? o.totalProduced ?? o.total_produced) || 0;
            const losses = Number(o.total_perdas ?? o.totalLosses ?? o.total_losses ?? o.refugo ?? o.scrap) || 0;
            totalProducedAll += produced;
            totalLossesAll += losses;
        });
        
        // Atualizar elementos
        const kpiTotal = document.getElementById('orders-kpi-total');
        const kpiActive = document.getElementById('orders-kpi-active');
        const kpiSuspended = document.getElementById('orders-kpi-suspended');
        const kpiCompleted = document.getElementById('orders-kpi-completed');
        const kpiTotalProduced = document.getElementById('orders-kpi-total-produced');
        const kpiTotalLosses = document.getElementById('orders-kpi-total-losses');
        
        if (kpiTotal) kpiTotal.textContent = total;
        if (kpiActive) kpiActive.textContent = active;
        if (kpiSuspended) kpiSuspended.textContent = suspended;
        if (kpiCompleted) kpiCompleted.textContent = completed;
        if (kpiTotalProduced) kpiTotalProduced.textContent = totalProducedAll.toLocaleString('pt-BR');
        if (kpiTotalLosses) kpiTotalLosses.textContent = totalLossesAll.toLocaleString('pt-BR');
    }
    
    function renderOrders(orders) {
        const grid = document.getElementById('orders-grid');
        const tableBody = document.getElementById('orders-table-body');
        const tableContainer = document.getElementById('orders-table-container');
        const emptyState = document.getElementById('orders-empty-state');
        const countEl = document.getElementById('orders-count');
        
        // Atualizar contador
        if (countEl) countEl.textContent = orders.length + ' ordem' + (orders.length !== 1 ? 's' : '') + ' encontrada' + (orders.length !== 1 ? 's' : '');
        
        if (orders.length === 0) {
            if (grid) grid.innerHTML = '';
            if (tableBody) tableBody.innerHTML = '';
            if (emptyState) emptyState.classList.remove('hidden');
            return;
        }
        
        if (emptyState) emptyState.classList.add('hidden');
        
        // Renderizar Grid de Cards
        if (grid) {
            grid.innerHTML = orders.map(order => renderOrderCard(order)).join('');
        }
        
        // Renderizar Tabela
        if (tableBody) {
            tableBody.innerHTML = orders.map(order => renderOrderTableRow(order)).join('');
        }
        
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
    
    function renderOrderCard(order) {
        const status = (order.status || 'planejada').toLowerCase();
        const lotSize = Number(order.lot_size) || 0;
        // CORREÇÃO: Usar total_produzido OU totalProduced (nomes corretos do campo no Firebase)
        const produced = Number(order.total_produzido ?? order.totalProduced ?? order.total_produced) || 0;
        const losses = Number(order.total_perdas ?? order.totalLosses ?? order.total_losses ?? order.refugo ?? order.scrap) || 0;
        const progress = lotSize > 0 ? Math.min((produced / lotSize) * 100, 100) : 0;
        
        const statusConfig = {
            'planejada': { bg: 'bg-slate-100', text: 'text-slate-700', label: 'Planejada', icon: 'calendar' },
            'ativa': { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Ativa', icon: 'zap' },
            'em_andamento': { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Em Andamento', icon: 'play-circle' },
            'suspensa': { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Suspensa', icon: 'pause-circle' },
            'concluida': { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Concluída', icon: 'check-circle-2' },
            'finalizada': { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Finalizada', icon: 'check-circle-2' },
            'cancelada': { bg: 'bg-red-100', text: 'text-red-700', label: 'Cancelada', icon: 'x-circle' }
        };
        
        const sc = statusConfig[status] || statusConfig['planejada'];
        const progressColor = progress >= 100 ? 'bg-emerald-500' : progress >= 50 ? 'bg-blue-500' : 'bg-amber-500';
        const isActive = ['ativa', 'em_andamento'].includes(status);
        const isSuspended = status === 'suspensa';
        const canActivate = status === 'planejada';
        const canReactivate = ['concluida', 'finalizada'].includes(status);
        const canSuspend = isActive;
        const canResume = isSuspended;
        const canFinalize = isActive;
        
        return '<div class="bg-white rounded-xl border ' + (isActive ? 'border-blue-300 ring-2 ring-blue-100' : isSuspended ? 'border-orange-300 ring-2 ring-orange-100' : 'border-gray-200') + ' shadow-sm hover:shadow-md transition-all overflow-hidden">' +
            '<div class="p-4 border-b border-gray-100 ' + (isActive ? 'bg-blue-50' : isSuspended ? 'bg-orange-50' : 'bg-gray-50') + '">' +
                '<div class="flex items-start justify-between gap-2">' +
                    '<div class="flex-1 min-w-0">' +
                        '<h4 class="font-bold text-gray-800 truncate">OP ' + escapeHtml(order.order_number || '') + '</h4>' +
                        '<p class="text-sm text-gray-600 truncate">' + escapeHtml(order.product || order.part_code || 'Produto não definido') + '</p>' +
                    '</div>' +
                    '<span class="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ' + sc.bg + ' ' + sc.text + '">' +
                        '<i data-lucide="' + sc.icon + '" class="w-3 h-3"></i>' +
                        sc.label +
                    '</span>' +
                '</div>' +
            '</div>' +
            '<div class="p-4 space-y-3">' +
                '<div class="grid grid-cols-2 gap-2 text-sm">' +
                    '<div class="flex items-center gap-2 text-gray-600">' +
                        '<i data-lucide="user" class="w-4 h-4 text-gray-400"></i>' +
                        '<span class="truncate">' + escapeHtml(order.customer || 'N/A') + '</span>' +
                    '</div>' +
                    '<div class="flex items-center gap-2 text-gray-600">' +
                        '<i data-lucide="settings" class="w-4 h-4 text-gray-400"></i>' +
                        '<span class="truncate">' + escapeHtml(order.machine_id || 'N/A') + '</span>' +
                    '</div>' +
                '</div>' +
                '<div class="bg-gray-50 rounded-lg p-3">' +
                    '<div class="flex items-center justify-between text-xs text-gray-500 mb-1">' +
                        '<span>Progresso</span>' +
                        '<span class="font-semibold">' + Math.round(progress) + '%</span>' +
                    '</div>' +
                    '<div class="w-full bg-gray-200 rounded-full h-2">' +
                        '<div class="' + progressColor + ' h-2 rounded-full transition-all" style="width: ' + progress + '%"></div>' +
                    '</div>' +
                    '<div class="grid grid-cols-3 text-xs text-gray-500 mt-2">' +
                        '<span class="text-center"><span class="font-semibold text-green-600">' + produced.toLocaleString('pt-BR') + '</span><br>Produzido</span>' +
                        '<span class="text-center"><span class="font-semibold text-blue-600">' + lotSize.toLocaleString('pt-BR') + '</span><br>Planejado</span>' +
                        '<span class="text-center"><span class="font-semibold text-red-600">' + losses.toLocaleString('pt-BR') + '</span><br>Perdas</span>' +
                    '</div>' +
                '</div>' +
            '</div>' +
            '<div class="px-4 pb-4 grid grid-cols-2 gap-2">' +
                (canActivate ? '<button onclick="activateOrder(\'' + order.id + '\', \'' + (order.machine_id || '') + '\')" class="flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition"><i data-lucide="play" class="w-4 h-4"></i>Ativar</button>' : '') +
                (canFinalize ? '<button onclick="finalizeOrder(\'' + order.id + '\')" class="flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition"><i data-lucide="check-circle-2" class="w-4 h-4"></i>Finalizar</button>' : '') +
                (canSuspend ? '<button onclick="suspendOrder(\'' + order.id + '\')" class="flex items-center justify-center gap-1.5 px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition"><i data-lucide="pause" class="w-4 h-4"></i>Suspender</button>' : '') +
                (canResume ? '<button onclick="resumeOrder(\'' + order.id + '\')" class="flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition"><i data-lucide="play" class="w-4 h-4"></i>Retomar</button>' : '') +
                (canReactivate ? '<button onclick="reactivateOrder(\'' + order.id + '\')" class="flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition"><i data-lucide="rotate-ccw" class="w-4 h-4"></i>Reativar</button>' : '') +
                '<button onclick="openOrderTraceability(\'' + order.id + '\')" class="flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition"><i data-lucide="file-search" class="w-4 h-4"></i>Rastrear</button>' +
                '<button onclick="editOrder(\'' + order.id + '\')" class="flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition"><i data-lucide="edit-3" class="w-4 h-4"></i>Editar</button>' +
            '</div>' +
        '</div>';
    }
    
    function renderOrderTableRow(order) {
        const status = (order.status || 'planejada').toLowerCase();
        const lotSize = Number(order.lot_size) || 0;
        // CORREÇÃO: Usar total_produzido OU totalProduced (nomes corretos do campo no Firebase)
        const produced = Number(order.total_produzido ?? order.totalProduced ?? order.total_produced) || 0;
        const losses = Number(order.total_perdas ?? order.totalLosses ?? order.total_losses ?? order.refugo ?? order.scrap) || 0;
        const progress = lotSize > 0 ? Math.min((produced / lotSize) * 100, 100) : 0;
        
        const statusBadge = {
            'planejada': '<span class="px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">Planejada</span>',
            'ativa': '<span class="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">Ativa</span>',
            'em_andamento': '<span class="px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">Em Andamento</span>',
            'suspensa': '<span class="px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">Suspensa</span>',
            'concluida': '<span class="px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">Concluída</span>',
            'finalizada': '<span class="px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">Finalizada</span>',
            'cancelada': '<span class="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">Cancelada</span>'
        };
        
        const isActive = ['ativa', 'em_andamento'].includes(status);
        const isSuspended = status === 'suspensa';
        const canActivate = status === 'planejada';
        const canReactivate = ['concluida', 'finalizada'].includes(status);
        const canSuspend = isActive;
        const canResume = isSuspended;
        const canFinalize = isActive;
        
        let actions = '';
        if (canActivate) {
            actions += '<button onclick="activateOrder(\'' + order.id + '\', \'' + (order.machine_id || '') + '\')" class="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-medium mr-1" title="Ativar"><i data-lucide="play" class="w-3 h-3 inline"></i></button>';
        }
        if (canFinalize) {
            actions += '<button onclick="finalizeOrder(\'' + order.id + '\')" class="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-medium mr-1" title="Finalizar"><i data-lucide="check-circle-2" class="w-3 h-3 inline"></i></button>';
        }
        if (canSuspend) {
            actions += '<button onclick="suspendOrder(\'' + order.id + '\')" class="px-2 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded text-xs font-medium mr-1" title="Suspender"><i data-lucide="pause" class="w-3 h-3 inline"></i></button>';
        }
        if (canResume) {
            actions += '<button onclick="resumeOrder(\'' + order.id + '\')" class="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-medium mr-1" title="Retomar"><i data-lucide="play" class="w-3 h-3 inline"></i></button>';
        }
        if (canReactivate) {
            actions += '<button onclick="reactivateOrder(\'' + order.id + '\')" class="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium mr-1" title="Reativar"><i data-lucide="rotate-ccw" class="w-3 h-3 inline"></i></button>';
        }
        actions += '<button onclick="openOrderTraceability(\'' + order.id + '\')" class="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-medium mr-1" title="Rastrear"><i data-lucide="file-search" class="w-3 h-3 inline"></i></button>';
        actions += '<button onclick="editOrder(\'' + order.id + '\')" class="px-2 py-1 bg-gray-500 hover:bg-gray-600 text-white rounded text-xs font-medium" title="Editar"><i data-lucide="edit-3" class="w-3 h-3 inline"></i></button>';
        
        const progressBar = '<div class="w-full bg-gray-200 rounded-full h-2"><div class="bg-blue-500 h-2 rounded-full" style="width: ' + progress + '%"></div></div><span class="text-xs text-gray-500">' + Math.round(progress) + '%</span>';
        
        return '<tr class="hover:bg-gray-50">' +
            '<td class="px-4 py-3 font-medium">' + escapeHtml(order.order_number || '') + '</td>' +
            '<td class="px-4 py-3">' + escapeHtml(order.product || order.part_code || '-') + '</td>' +
            '<td class="px-4 py-3">' + escapeHtml(order.machine_id || '-') + '</td>' +
            '<td class="px-4 py-3 text-center">' + lotSize.toLocaleString('pt-BR') + '</td>' +
            '<td class="px-4 py-3 text-center text-green-600 font-semibold">' + produced.toLocaleString('pt-BR') + '</td>' +
            '<td class="px-4 py-3 text-center text-red-600 font-semibold">' + losses.toLocaleString('pt-BR') + '</td>' +
            '<td class="px-4 py-3 text-center"><div class="flex flex-col items-center gap-1">' + progressBar + '</div></td>' +
            '<td class="px-4 py-3 text-center">' + (statusBadge[status] || statusBadge['planejada']) + '</td>' +
            '<td class="px-4 py-3 text-center whitespace-nowrap">' + actions + '</td>' +
        '</tr>';
    }
    
    function populateOrdersMachineFilter() {
        const machineFilter = document.getElementById('orders-machine-filter');
        if (!machineFilter) return;
        
        machineFilter.innerHTML = '<option value="">Todas Máquinas</option>';
        
        if (typeof machineDatabase !== 'undefined' && machineDatabase.length > 0) {
            machineDatabase.forEach(function(machine) {
                const mid = normalizeMachineId(machine.id);
                machineFilter.innerHTML += '<option value="' + mid + '">' + mid + ' - ' + machine.model + '</option>';
            });
        }
    }
    
    function setupOrdersFilters() {
        const searchInput = document.getElementById('orders-search');
        const statusFilter = document.getElementById('orders-status-filter');
        const machineFilter = document.getElementById('orders-machine-filter');
        const sortFilter = document.getElementById('orders-sort-filter');
        const clearBtn = document.getElementById('orders-clear-filters');
        
        function applyFilters() {
            let filtered = [...ordersCache];
            
            // Busca
            const query = (searchInput?.value || '').toLowerCase().trim();
            if (query) {
                filtered = filtered.filter(o => 
                    (o.order_number || '').toLowerCase().includes(query) ||
                    (o.product || '').toLowerCase().includes(query) ||
                    (o.part_code || '').toLowerCase().includes(query) ||
                    (o.customer || '').toLowerCase().includes(query)
                );
            }
            
            // Status
            const status = statusFilter?.value || '';
            if (status) {
                filtered = filtered.filter(o => {
                    const s = (o.status || '').toLowerCase();
                    if (status === 'concluida') return ['concluida', 'finalizada'].includes(s);
                    return s === status;
                });
            }
            
            // Máquina
            const machine = machineFilter?.value || '';
            if (machine) {
                filtered = filtered.filter(o => o.machine_id === machine);
            }
            
            // Ordenação
            const sort = sortFilter?.value || 'recent';
            filtered.sort((a, b) => {
                const lotA = Number(a.lot_size) || 0;
                const lotB = Number(b.lot_size) || 0;
                const prodA = Number(a.total_produzido ?? a.totalProduced ?? a.total_produced) || 0;
                const prodB = Number(b.total_produzido ?? b.totalProduced ?? b.total_produced) || 0;
                const progressA = lotA > 0 ? (prodA / lotA) : 0;
                const progressB = lotB > 0 ? (prodB / lotB) : 0;
                
                switch (sort) {
                    case 'recent':
                        return (b.createdAt?.toDate?.() || new Date(0)) - (a.createdAt?.toDate?.() || new Date(0));
                    case 'progress-desc':
                        return progressB - progressA;
                    case 'progress-asc':
                        return progressA - progressB;
                    case 'lot-desc':
                        return lotB - lotA;
                    case 'alpha':
                        return (a.order_number || '').localeCompare(b.order_number || '');
                    default:
                        return 0;
                }
            });
            
            updateOrdersKPIs(filtered);
            renderOrders(filtered);
        }
        
        if (searchInput) searchInput.addEventListener('input', debounce(applyFilters, 300));
        if (statusFilter) statusFilter.addEventListener('change', applyFilters);
        if (machineFilter) machineFilter.addEventListener('change', applyFilters);
        if (sortFilter) sortFilter.addEventListener('change', applyFilters);
        
        if (clearBtn) {
            clearBtn.addEventListener('click', function() {
                if (searchInput) searchInput.value = '';
                if (statusFilter) statusFilter.value = '';
                if (machineFilter) machineFilter.value = '';
                if (sortFilter) sortFilter.value = 'recent';
                applyFilters();
            });
        }
    }
    
    function setupOrdersViewToggle() {
        const gridBtn = document.getElementById('orders-view-grid-btn');
        const tableBtn = document.getElementById('orders-view-table-btn');
        const grid = document.getElementById('orders-grid');
        const tableContainer = document.getElementById('orders-table-container');
        
        if (gridBtn && tableBtn && grid && tableContainer) {
            gridBtn.addEventListener('click', function() {
                grid.classList.remove('hidden');
                tableContainer.classList.add('hidden');
                gridBtn.classList.add('bg-white', 'shadow-sm', 'text-primary-blue');
                gridBtn.classList.remove('text-gray-500');
                tableBtn.classList.remove('bg-white', 'shadow-sm', 'text-primary-blue');
                tableBtn.classList.add('text-gray-500');
            });
            
            tableBtn.addEventListener('click', function() {
                grid.classList.add('hidden');
                tableContainer.classList.remove('hidden');
                tableBtn.classList.add('bg-white', 'shadow-sm', 'text-primary-blue');
                tableBtn.classList.remove('text-gray-500');
                gridBtn.classList.remove('bg-white', 'shadow-sm', 'text-primary-blue');
                gridBtn.classList.add('text-gray-500');
            });
        }
    }

    // --- NAVEGAÇÃO ---
    // OTIMIZAÇÃO: Mapa de controladores para evitar cadeia de if/else
    const _controllerRegistry = {
        'lancamento':        { path: './src/controllers/launch.controller.js',            fn: 'setupLancamentoPage' },
        'planejamento':      { path: './src/controllers/planning.controller.js',          fn: 'setupPlanejamentoPage' },
        'ordens':            { path: './src/controllers/orders.controller.js',            fn: 'setupOrdensPage' },
        'analise':           { path: './src/controllers/analysis.controller.js',          fn: 'setupAnalisePage',
                               pre: () => { setupProductionOrdersTab(); listenToProductionOrders(); } },
        'paradas-longas':    { path: './src/controllers/extended-downtime.controller.js', fn: 'setupExtendedDowntimePage' },
        'acompanhamento':    { path: './src/controllers/monitoring.controller.js',        fn: 'setupAcompanhamentoPage' },
        'historico-sistema': { path: './src/controllers/historico.controller.js',         fn: 'setupHistoricoPage' },
        'admin-dados':       { path: './src/controllers/admin.controller.js',             fn: 'setupAdminDadosPage' },
        'relatorios':        { path: './src/controllers/reports.controller.js',           fn: 'setupRelatoriosPage' },
        'lideranca-producao':{ path: './src/controllers/leadership.controller.js',       fn: 'setupLiderancaProducaoPage' },
        'setup-maquinas':    { path: './src/controllers/setup.controller.js',            fn: 'setupSetupMaquinasPage' },
        'ferramentaria':     { path: './src/controllers/tooling.controller.js',          fn: 'setupFerramentariaPage' },
        'pcp':               { path: './src/controllers/pcp.controller.js',              fn: 'setupPCPPage',
                               post: () => { if (typeof lucide !== 'undefined') lucide.createIcons(); } },
        'pmp':               { path: './src/controllers/pmp.controller.js',              fn: 'setupPMPPage',
                               post: () => { if (typeof lucide !== 'undefined') lucide.createIcons(); } }
    };

    // OTIMIZAÇÃO: Prefetch de coleções quentes em background ao entrar em abas que compartilham dados
    const _prefetchCollections = {
        'lancamento':   ['planning', 'production_entries', 'active_downtimes'],
        'planejamento': ['planning', 'production_entries', 'active_downtimes'],
        'analise':      ['production_entries', 'planning'],
        'pcp':          ['planning', 'active_downtimes', 'production_entries'],
        'ordens':       ['production_orders']
    };

    function _prefetchForPage(page) {
        const collections = _prefetchCollections[page];
        if (!collections) return;
        const today = getProductionDateString();
        collections.forEach(col => {
            switch (col) {
                case 'planning':
                    if (window.getPlanningCached) window.getPlanningCached(today).catch(() => {});
                    break;
                case 'production_entries':
                    if (window.getProductionEntriesCached) window.getProductionEntriesCached(today).catch(() => {});
                    break;
                case 'active_downtimes':
                    if (window.getActiveDowntimesCached) window.getActiveDowntimesCached().catch(() => {});
                    break;
                case 'production_orders':
                    if (window.getProductionOrdersCached) window.getProductionOrdersCached().catch(() => {});
                    break;
            }
        });
    }

    function handleNavClick(e) {
        const page = e.currentTarget.dataset.page;
        
        // Se for um link externo (sem data-page), não interceptar
        if (!page) {
            // Permitir comportamento padrão do link
            return;
        }
        
        e.preventDefault();
        
        // Verificar se o usuário tem permissão para acessar esta aba
        if (!window.authSystem.canAccessTab(page)) {
            window.authSystem.showPermissionError();
            return;
        }
        
        navButtons.forEach(btn => btn.classList.remove('active'));
        e.currentTarget.classList.add('active');
        
        pageContents.forEach(content => {
            content.classList.toggle('hidden', content.id !== `${page}-page`);
        });
        
        if (pageTitle) {
            pageTitle.textContent = e.currentTarget.querySelector('span').textContent;
        }
        
        detachActiveListener();

        // OTIMIZAÇÃO: prefetch de coleções compartilhadas em background
        _prefetchForPage(page);

        // OTIMIZAÇÃO: Registry-based dispatch — substitui 15 blocos if/else
        const entry = _controllerRegistry[page];
        if (entry) {
            // Gate de permissão adicional (ex: Relatórios)
            if (entry.gate && !entry.gate()) return;
            // Pré-execução (ex: Análise chama setupProductionOrdersTab)
            if (entry.pre) entry.pre();
            // Import dinâmico
            import(entry.path).then(mod => {
                mod[entry.fn]();
                if (entry.post) entry.post();
            }).catch(err => {
                console.error(`[${page}] Erro ao carregar módulo:`, err);
                showNotification('Erro ao carregar módulo. Recarregue a página.', 'error');
            });
        }

        if (window.innerWidth < 768) {
            closeSidebar();
        }
    }

    let _productionOrdersTabSetupDone = false;
    function setupProductionOrdersTab() {
        if (!productionOrderCodeInput) return;
        if (_productionOrdersTabSetupDone) return;
        _productionOrdersTabSetupDone = true;

        // Popular lista de códigos disponíveis
        if (productionOrderCodeDatalist) {
            const sortedProducts = [...productDatabase].sort((a, b) => a.cod - b.cod);
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

    function escapeHtml(str = '') {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function normalizeNumericString(value) {
        if (typeof value !== 'string') return null;
        const trimmed = value.trim();
        if (!trimmed) return null;

        const thousandPatternPtBr = /^\d{1,3}(\.\d{3})+(,\d+)?$/;
        const thousandPatternEn = /^\d{1,3}(,\d{3})+(\.\d+)?$/;

        const hasComma = trimmed.includes(',');
        const hasDot = trimmed.includes('.');

        // Se possuir apenas vírgula (formato típico pt-BR), tratar como decimal
        if (hasComma && !hasDot) {
            return trimmed.replace(/\s+/g, '').replace(',', '.');
        }

        if (thousandPatternPtBr.test(trimmed)) {
            return trimmed.replace(/\./g, '').replace(',', '.');
        }

        if (thousandPatternEn.test(trimmed)) {
            return trimmed.replace(/,/g, '');
        }

        // Caso geral: remover espaços e trocar vírgula por ponto
        return trimmed.replace(/\s+/g, '').replace(',', '.');
    }

    function parseOptionalNumber(value) {
        if (value === null || value === undefined || value === '') return null;

        if (typeof value === 'number') {
            return Number.isFinite(value) ? value : null;
        }

        if (typeof value === 'string') {
            const normalized = normalizeNumericString(value);
            if (normalized === null) return null;
            const parsed = Number(normalized);
            return Number.isFinite(parsed) ? parsed : null;
        }

        const fallback = Number(value);
        return Number.isFinite(fallback) ? fallback : null;
    }

    function coerceToNumber(value, fallback = 0) {
        const parsed = parseOptionalNumber(value);
        return parsed === null ? fallback : parsed;
    }

    function getProductionOrderStatusBadge(status = 'planejada') {
        const statusMap = {
            'planejada': { label: 'Planejada', className: 'bg-sky-100 text-sky-700' },
            'em_andamento': { label: 'Em andamento', className: 'bg-amber-100 text-amber-700' },
            'concluida': { label: 'Concluída', className: 'bg-emerald-100 text-emerald-700' },
            'cancelada': { label: 'Cancelada', className: 'bg-red-100 text-red-700' }
        };

        const safeStatus = statusMap[status] || statusMap['planejada'];
        return `<span class="px-2 py-1 rounded-full text-xs font-semibold ${safeStatus.className}">${safeStatus.label}</span>`;
    }

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

    let _ordersFiltersInitialized = false;
    function initOrdersFilters() {
        if (_ordersFiltersInitialized) return;
        _ordersFiltersInitialized = true;
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

        lucide.createIcons();
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
            lucide.createIcons();
        }
    }

    async function handleActivateProductionOrder(e) {
        e.preventDefault();
        const orderId = e.currentTarget.dataset.orderId;
        const order = productionOrdersCache.find(o => o.id === orderId);
        let machineId = e.currentTarget.dataset.machineId || order?.machine_id || selectedMachineData?.machine || '';

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
                if (selectedMachineData?.machine) {
                    await onMachineSelected(selectedMachineData.machine);
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
            await db.collection('production_orders').doc(orderId).delete();
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
        if (!selectedMachineData) {
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
        const planId = selectedMachineData.id;
        const currentExecuted = Math.round(coerceToNumber(selectedMachineData.totalProduced, 0));
        // CORREÇÃO: Usar planned_quantity (meta diária) primeiro, não lot_size (tamanho total OP)
        const plannedQty = Math.round(coerceToNumber(
            selectedMachineData.planned_quantity ?? selectedMachineData.planned_qty ?? selectedMachineData.meta, 0
        ));

        // Preencher informações
        if (machineSpan) machineSpan.textContent = selectedMachineData.machine || '-';
        if (productSpan) productSpan.textContent = selectedMachineData.product || '-';
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
                machine: selectedMachineData.machine,
                product: selectedMachineData.product || '',
                product_cod: selectedMachineData.product_cod || '',
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
            await db.collection('production_entries').add(adjustmentEntry);

            // Atualizar o planejamento com a nova quantidade
            await db.collection('planning').doc(planId).update({
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
                machine: selectedMachineData?.machine,
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
            await db.collection('quantity_adjustments').add(adjustmentRecordForCollection);

            // Atualizar a quantidade do lote (lot_size) da OP
            const currentOrder = await db.collection('production_orders').doc(orderId).get();
            const orderData = currentOrder.data();
            const currentAdjustments = orderData.quantity_adjustments || [];
            
            await db.collection('production_orders').doc(orderId).update({
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

            if (selectedMachineData && selectedMachineData.machine) {
                const machine = selectedMachineData.machine;
                // machineCardData agora é array - pegar primeiro plano para compatibilidade
                const machineDataArray = machineCardData[machine];
                const updatedMachineData = Array.isArray(machineDataArray) ? machineDataArray[0] : (machineDataArray || machineSelector?.machineData?.[machine]);
                if (updatedMachineData) {
                    selectedMachineData = updatedMachineData;
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

            const snapshot = await db.collection('production_orders')
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

    // Sincronizar selectedMachineData com a OP ativa antes de atualizar o card
    async function syncSelectedMachineWithActiveOrder() {
        try {
            if (!selectedMachineData || !selectedMachineData.machine) return;

            const activeOrder = await checkActiveOrderOnMachine(selectedMachineData.machine);
            if (!activeOrder) {
                return;
            }
            // Carregar lançamentos desta OP para aplicar a mesma regra da análise
            const productionSnapshot = await db.collection('production_entries')
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

            selectedMachineData = {
                ...selectedMachineData,
                order_id: activeOrder.id || activeOrder.order_id || selectedMachineData.order_id,
                orderId: activeOrder.id || activeOrder.orderId || selectedMachineData.orderId,
                order_lot_size: metrics.lotSize,
                lot_size: metrics.lotSize,
                total_produzido: metrics.totalProduced,
                totalProduced: metrics.totalProduced
            };

            console.log('[SYNC-ORDER] selectedMachineData sincronizado com OP ativa', {
                machine: selectedMachineData.machine,
                order_id: selectedMachineData.order_id,
                lot_size: selectedMachineData.order_lot_size,
                total_produzido: selectedMachineData.total_produzido
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
                await db.collection('production_orders').doc(activeOrder.id).update({
                    status: 'concluida',
                    finishedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    finishedBy: getActiveUser()?.name || 'Sistema'
                });
            }
            
            // Ativar nova OP
            await db.collection('production_orders').doc(orderId).update({
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
            
            await db.collection('production_orders').doc(orderId).update({
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
        if (!db || !selectedMachineData) {
            console.log('[DOWNTIME][CHECK] Nenhuma máquina selecionada ou DB indisponível');
            return;
        }
        
        try {
            const activeDowntimeDoc = await db.collection('active_downtimes').doc(selectedMachineData.machine).get();
            
            if (activeDowntimeDoc.exists) {
                const activeDowntime = activeDowntimeDoc.data();
                console.log('[DOWNTIME][CHECK] Parada ativa encontrada:', activeDowntime);
                
                // Validar dados mínimos
                if (!activeDowntime.machine || !activeDowntime.startDate || !activeDowntime.startTime) {
                    console.warn('[DOWNTIME][CHECK] Dados de parada ativa incompletos, removendo...');
                    const normalizedMachineForDelete = normalizeMachineId(selectedMachineData.machine);
                    await db.collection('active_downtimes').doc(normalizedMachineForDelete).delete();
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
                    startTimestamp = window.parseDateTime(activeDowntime.startDate, activeDowntime.startTime);
                }
                
                if (!startTimestamp || isNaN(startTimestamp.getTime())) {
                    console.warn('[DOWNTIME][CHECK] Timestamp de início inválido, removendo parada...');
                    const normalizedMachineForDelete = normalizeMachineId(selectedMachineData.machine);
                    await db.collection('active_downtimes').doc(normalizedMachineForDelete).delete();
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
                        const normalizedMachineForDelete = normalizeMachineId(selectedMachineData.machine);
                        await db.collection('active_downtimes').doc(normalizedMachineForDelete).delete();
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
                    startShift: activeDowntime.startShift || window.getShiftForDateTime(startTimestamp),
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
                console.log('[DOWNTIME][CHECK] Nenhuma parada ativa para:', selectedMachineData.machine);
            }
        } catch (error) {
            console.error('[DOWNTIME][CHECK] Erro ao verificar paradas ativas:', error);
        }
    }

    function listenToProductionOrders() {
        if (!db || !productionOrderTableBody) return;

        try {
            const query = db.collection('production_orders').orderBy('createdAt', 'desc');
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
                lucide.createIcons();
            }

            setProductionOrderStatus('Salvando ordem de produção...', 'info');

            // CORREÇÃO: Validação de ordem duplicada considera agora apenas ordens ATIVAS
            // Uma ordem pode ser reutilizada em datas diferentes ou após finalização
            const existingSnapshot = await db.collection('production_orders')
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
                await db.collection('production_orders').doc(editingOrderId).update(docData);
                setProductionOrderStatus('Ordem atualizada com sucesso!', 'success');
                
                // Registrar log de edição
                registrarLogSistema('EDIÇÃO DE ORDEM DE PRODUÇÃO', 'ordem', {
                    orderId: editingOrderId,
                    orderNumber: normalizedOrderNumber,
                    product: docData.product,
                    lotSize: docData.lot_size
                });
            } else {
                const docRef = await db.collection('production_orders').add(docData);
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
                lucide.createIcons();
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
                        const orderDoc = await db.collection('production_orders').doc(productionOrderId).get();
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
                const duplicateCheck = await db.collection('planning')
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
                const productDuplicateCheck = await db.collection('planning')
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
            
            await db.collection('planning').add(docData);
            
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


    // Setup de busca na tabela de planejamento
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
            // CORREÇÃO CONSISTÊNCIA: Enriquecer plannings com total_produzido da OP vinculada
            // Isso garante que os cards das máquinas mostrem o MESMO valor que a aba Admin > Dados > Ordens
            // IMPORTANTE: Sempre usar o valor da OP como fonte de verdade
            for (const plan of planningItems) {
                const orderId = plan.production_order_id || plan.production_order || plan.order_id;
                if (orderId) {
                    try {
                        // Buscar sempre da OP (ignorar cache para garantir valor atualizado)
                        const orderDoc = await db.collection('production_orders').doc(orderId).get();
                        if (orderDoc.exists) {
                            const orderData = orderDoc.data() || {};
                            const orderTotal = coerceToNumber(orderData.total_produzido ?? orderData.totalProduced, 0);
                            orderTotalCache.set(orderId, orderTotal);
                            
                            const planTotal = coerceToNumber(plan.total_produzido, 0);
                            
                            // SEMPRE usar o valor da OP como fonte de verdade
                            // O Admin mostra o valor da OP, então os cards devem mostrar o mesmo
                            if (orderTotal !== planTotal) {
                                console.log(`[SYNC-CONSISTENCIA] Planning ${plan.id} tem total_produzido (${planTotal}) diferente da OP ${orderId} (${orderTotal}). Sincronizando...`);
                                // Atualizar cache local imediatamente com valor da OP
                                plan.total_produzido = orderTotal;
                                plan.totalProduced = orderTotal;
                                // Atualizar Firebase em background (não esperar)
                                db.collection('planning').doc(plan.id).update({
                                    total_produzido: orderTotal,
                                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                                }).catch(e => console.warn('[SYNC-CONSISTENCIA] Falha ao sincronizar planning:', e));
                            } else {
                                // Valores já estão sincronizados
                                plan.total_produzido = orderTotal;
                                plan.totalProduced = orderTotal;
                            }
                        } else {
                            orderTotalCache.set(orderId, 0);
                        }
                    } catch (e) {
                        console.warn('[SYNC-CONSISTENCIA] Erro ao buscar OP:', orderId, e);
                        orderTotalCache.set(orderId, 0);
                    }
                }
            }
            
            const combinedData = planningItems.map(plan => {
                const shifts = { T1: 0, T2: 0, T3: 0 };

                productionEntries.forEach(entry => {
                    if (!entry || entry.planId !== plan.id) return;
                    const shiftKey = window.normalizeShiftValue(entry.turno);
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
        const planningQuery = db.collection('planning').where('date', '==', date);
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
                if (selectedMachineData) {
                    const updatedSelected = planningItems.find(item => item.id === selectedMachineData.id);
                    if (updatedSelected) {
                        selectedMachineData = { ...selectedMachineData, ...updatedSelected };
                        updateQuickProductionPieceWeightUI();
                        if (productName) {
                            productName.textContent = selectedMachineData.product || 'Produto não definido';
                        }
                        if (shiftTarget) {
                            // Usar lot_size (tamanho do lote OP), não planned_quantity/3
                            const totalPlanned = coerceToNumber(selectedMachineData.order_lot_size ?? selectedMachineData.lot_size, 0);
                            const totalExecuted = coerceToNumber(selectedMachineData.total_produzido, 0);
                            if (!totalPlanned) {
                                shiftTarget.textContent = `${totalExecuted.toLocaleString('pt-BR')} / N/A`;
                            } else {
                                shiftTarget.textContent = `${totalExecuted.toLocaleString('pt-BR')} / ${totalPlanned.toLocaleString('pt-BR')}`;
                            }
                        }
                        if (productMp) {
                            productMp.textContent = selectedMachineData.mp ? `MP: ${selectedMachineData.mp}` : 'Matéria-prima não definida';
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

        const entriesQuery = db.collection('production_entries').where('data', '==', date);
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
        
        const downtimeQuery = db.collection('downtime_entries')
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
        // IMPORTANTE: Filtrar apenas máquinas válidas do machineDatabase para evitar contagem incorreta
        const validMachineIdsSet = new Set(machineDatabase.map(m => normalizeMachineId(m.id)));
        const pollActiveDowntimes = async () => {
            try {
                // OTIMIZAÇÃO: Usar função com cache (TTL 30s para dados em tempo real)
                const downtimes = await getActiveDowntimesCached(false);
                // FIX: Aceitar paradas onde isActive NÃO seja explicitamente false
                // (undefined, null, true = parada válida; apenas false = inativa)
                const validDowntimeIds = downtimes
                    .filter(d => {
                        if (d.isActive === false) {
                            console.debug(`[pollActiveDowntimes] Parada ${d.id} com isActive=false, ignorando`);
                            return false;
                        }
                        return true;
                    })
                    .map(d => d.id)
                    .filter(id => {
                        const normalizedId = normalizeMachineId(id);
                        if (!validMachineIdsSet.has(normalizedId)) {
                            console.warn(`[pollActiveDowntimes] Máquina "${id}" não existe no machineDatabase — ignorando (SEM deletar)`);
                            return false;
                        }
                        return true;
                    });
                activeDowntimeSet = new Set(validDowntimeIds);
                // NOTA: NÃO deletar docs automaticamente — era causa de sumiço de paradas
                scheduleRender();
            } catch (error) {
                console.error('Erro ao buscar paradas ativas:', error);
            }
        };
        
        // Executar imediatamente na primeira vez
        pollActiveDowntimes();
        
        // Configurar polling a cada 300 segundos (otimizado Fase 2 — era 120s, reduz 60% leituras active_downtimes)
        window._startActiveDowntimesPolling = () => {
            if (window._activeDowntimesPolling) {
                clearInterval(window._activeDowntimesPolling);
            }
            window._activeDowntimesPolling = setInterval(pollActiveDowntimes, 300000);
        };
        window._startActiveDowntimesPolling();
        
        // NOTA: Visibilidade (pausar/retomar polling) é gerenciada pelo handler
        // único registrado junto ao listenerManager (linhas ~516-533).
        // NÃO registrar outro handler aqui — causava acumulação (N handlers após N tab-switches).
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
        
        lucide.createIcons();
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
        lucide.createIcons();
    }
    
    function handleLeaderPanelClick(e) {
        const setupButton = e.target.closest('.setup-btn');
        if (setupButton) {
            const docId = setupButton.dataset.id;
            const turno = setupButton.dataset.turno;
            showLeaderModal(docId, turno);
        }
    }

    async function showLeaderModal(docId, turno) {
        if (!leaderModalForm || !leaderModalTitle) return;
        
        console.log('[TRACE][showLeaderModal] opening', { docId, turno });

        leaderModalForm.querySelector('#leader-modal-cancel-btn')?.remove();
        
        leaderModalForm.innerHTML = `
            <input type="hidden" id="leader-entry-doc-id" name="docId">
            <input type="hidden" id="leader-entry-turno" name="turno">
            <div>
                <label for="leader-entry-real-cycle" class="block text-sm font-medium">Ciclo Real (${turno})</label>
                <input type="number" id="leader-entry-real-cycle" name="real_cycle" step="0.1" class="mt-1 w-full p-2 border-gray-300 rounded-md">
            </div>
            <div>
                <label for="leader-entry-active-cavities" class="block text-sm font-medium">Cavidades Ativas (${turno})</label>
                <input type="number" id="leader-entry-active-cavities" name="active_cavities" step="1" class="mt-1 w-full p-2 border-gray-300 rounded-md">
            </div>
            <div class="mt-6 flex justify-end gap-3 pt-4 border-t">
                <button type="button" id="leader-modal-cancel-btn" class="bg-gray-200 hover:bg-gray-300 font-bold py-2 px-6 rounded-lg">Cancelar</button>
                <button type="submit" class="bg-primary-blue hover:bg-blue-800 text-white font-bold py-2 px-6 rounded-lg">Salvar</button>
            </div>`;
        
        leaderModal.querySelector('#leader-modal-cancel-btn').addEventListener('click', hideLeaderModal);
        
        document.getElementById('leader-entry-doc-id').value = docId;
        document.getElementById('leader-entry-turno').value = turno;

        try {
            // Suporta múltiplos IDs (csv) vindos do painel consolidado
            const ids = String(docId).split(',').map(s => s.trim()).filter(Boolean);
            let headerMachine = '';
            let prefillReal = '';
            let prefillCav = '';
            for (const id of ids) {
                try {
                    const ref = db.collection('planning').doc(id);
                    const snap = await ref.get();
                    if (snap.exists) {
                        const data = snap.data();
                        if (!headerMachine) headerMachine = data.machine || '';
                        const rc = data[`real_cycle_${turno.toLowerCase()}`];
                        const cav = data[`active_cavities_${turno.toLowerCase()}`];
                        if (!prefillReal && rc) prefillReal = rc;
                        if (!prefillCav && cav) prefillCav = cav;
                        if (prefillReal && prefillCav) break; // já temos valores para preencher
                    }
                } catch (innerErr) {
                    console.warn('[TRACE][showLeaderModal] falha ao recuperar doc para prefill', id, innerErr);
                }
            }
            leaderModalTitle.textContent = `Lançamento: ${headerMachine || 'Máquina'} - ${turno}`;
            document.getElementById('leader-entry-real-cycle').value = prefillReal || '';
            document.getElementById('leader-entry-active-cavities').value = prefillCav || '';
            
        } catch (error) {
            console.error("Erro ao buscar dados do setup: ", error);
        }
        
        leaderModal.classList.remove('hidden');
        console.log('[TRACE][showLeaderModal] modal displayed');
    }
    
    function hideLeaderModal() {
        if (leaderModal) leaderModal.classList.add('hidden');
    }

    async function handleLeaderEntrySubmit(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const docId = formData.get('docId');
        const turno = formData.get('turno');
        const realCycle = parseFloat(formData.get('real_cycle')) || null;
        const activeCavities = parseInt(formData.get('active_cavities')) || null;

        console.log('[TRACE][handleLeaderEntrySubmit] submission data', {
            docId,
            turno,
            realCycle,
            activeCavities
        });

        const planDataToUpdate = {
            [`real_cycle_${turno.toLowerCase()}`]: realCycle,
            [`active_cavities_${turno.toLowerCase()}`]: activeCavities,
        };

        console.log('[TRACE][handleLeaderEntrySubmit] updating planning document', planDataToUpdate);

        try {
            // Suporta múltiplos IDs (csv) para manter OPs sincronizadas para o mesmo produto
            const ids = String(docId).split(',').map(s => s.trim()).filter(Boolean);
            const batchSize = 20; // segurança para não estourar limites
            for (let i = 0; i < ids.length; i += batchSize) {
                const slice = ids.slice(i, i + batchSize);
                const batch = db.batch();
                slice.forEach(id => {
                    const ref = db.collection('planning').doc(id);
                    batch.update(ref, planDataToUpdate);
                });
                await batch.commit();
            }

            hideLeaderModal();
            console.log('[TRACE][handleLeaderEntrySubmit] completed successfully for ids', ids);
        } catch (error) {
            console.error("Erro ao salvar dados do líder: ", error);
            alert("Não foi possível salvar os dados. Tente novamente.");
        }
    }

    // --- PAINEL DO OPERADOR ---
    function listenToCurrentProductionPlan() {
        detachActiveListener();
        const date = getProductionDateString();
        showLoadingState('launch-panel', true);

        let planningItems = [];
        let launchedEntries = new Set();
        let productionEntries = [];

        const render = () => {
            renderLaunchPanel(planningItems, launchedEntries, productionEntries);
            showLoadingState('launch-panel', false, planningItems.length === 0);
        };

        // Limpar listeners anteriores se existirem
        listenerManager.unsubscribe('launchPlanning');
        listenerManager.unsubscribe('launchProductions');

        // OTIMIZADO FASE 2: Filtrar apenas data de hoje (era 30 dias — ~10.000 leituras/turno a menos)
        // Planejamentos ativos de datas antigas devem ser reproporcionados para hoje
        const planningQuery = db.collection('planning').where('date', '==', date);
        listenerManager.subscribe('launchPlanning', planningQuery,
            (snapshot) => {
                // Filtrar apenas planejamentos ativos (não concluídos/finalizados/cancelados)
                planningItems = snapshot.docs
                    .map(doc => ({ id: doc.id, ...doc.data() }))
                    .filter(isPlanActive);
                planningItems.sort((a, b) => (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0));
                render();
            },
            (error) => {
                console.error("Erro ao carregar plano de produção: ", error);
                if (launchPanelContainer) {
                    launchPanelContainer.innerHTML = `<div class="col-span-full text-center text-red-600 bg-red-50 p-4 rounded-lg"><p class="font-bold">Falha ao carregar dados.</p></div>`;
                }
            }
        );
        
        // OTIMIZADO FASE 2: Reutilizar dados do listener 'productionEntries' via DataStore
        // (eliminado listener duplicado 'launchProductions' — mesma query do 'productionEntries')
        const updateLaunchFromDataStore = () => {
            const cached = window.DataStore ? window.DataStore.get('productionEntries') : null;
            if (cached) {
                launchedEntries = new Set();
                productionEntries = cached.map(e => ({ ...e }));
                cached.forEach(entry => {
                    if (entry.produzido > 0 || entry.refugo_kg > 0) {
                        launchedEntries.add(`${entry.planId}-${entry.turno}`);
                    }
                });
                render();
            }
        };
        // Ouvir atualizações do DataStore (alimentado pelo listener 'productionEntries')
        if (window.DataStore) {
            window.DataStore.subscribe('productionEntries', updateLaunchFromDataStore);
        }
        // Carregar dados iniciais se já existirem
        updateLaunchFromDataStore();
    }

    function renderLaunchPanel(planItems, launchedEntries, productionEntries) {
        if (!launchPanelContainer) return;
        launchPanelContainer.innerHTML = planItems.map(item => {
            const t1Launched = launchedEntries.has(`${item.id}-T1`);
            const t2Launched = launchedEntries.has(`${item.id}-T2`);
            const t3Launched = launchedEntries.has(`${item.id}-T3`);

            const t1Class = t1Launched ? 'bg-status-success hover:bg-green-700' : 'bg-gray-500 hover:bg-gray-600';
            const t2Class = t2Launched ? 'bg-status-success hover:bg-green-700' : 'bg-gray-500 hover:bg-gray-600';
            const t3Class = t3Launched ? 'bg-status-success hover:bg-green-700' : 'bg-gray-500 hover:bg-gray-600';
            
            const totalProduzido = productionEntries
                .filter(p => p.planId === item.id)
                .reduce((sum, p) => sum + (p.produzido || 0), 0);
            
            const meta = item.planned_quantity || 0;
            const progresso = meta > 0 ? (totalProduzido / meta) * 100 : 0;
            const progressoCor = progresso < 50 ? 'bg-status-error' : progresso < 90 ? 'bg-status-warning' : 'bg-status-success';

            const linkedOrderId = item.order_id || item.production_order_id || item.production_order || null;
            const linkedOrder = linkedOrderId && Array.isArray(productionOrdersCache)
                ? productionOrdersCache.find(order => order && order.id === linkedOrderId)
                : null;
            const orderNumberRaw = linkedOrder?.order_number
                || item.order_number
                || linkedOrder?.order_number_original
                || item.order_number_original
                || linkedOrder?.id
                || '';
            const orderNumberLabel = orderNumberRaw
                ? `OP ${escapeHtml(orderNumberRaw)}`
                : 'OP não vinculada';

            return `
            <div class="bg-gray-50 border rounded-lg p-4 shadow-sm flex flex-col justify-between">
                <div>
                    <div class="flex justify-between items-start">
                        <div>
                            <h3 class="font-bold text-lg">${item.machine}</h3>
                            <p class="text-sm text-gray-600">${item.product}</p>
                            <p class="text-xs text-gray-500">${orderNumberLabel}</p>
                            <p class="text-xs text-gray-500 mt-1">${item.mp ? `MP: ${item.mp}` : 'MP não definida'}</p>
                        </div>
                        <span class="text-xs font-bold text-gray-500">${totalProduzido.toLocaleString('pt-BR')} / ${meta.toLocaleString('pt-BR')}</span>
                    </div>
                    <div class="w-full bg-gray-200 rounded-full h-2.5 mt-2">
                        <div class="${progressoCor} h-2.5 rounded-full" style="width: ${Math.min(progresso, 100)}%"></div>
                    </div>
                </div>
                <div class="grid grid-cols-3 gap-2 mt-4">
                    <button data-id="${item.id}" data-turno="T1" class="launch-btn ${t1Class} text-white font-bold py-2 rounded-md">Turno 1</button>
                    <button data-id="${item.id}" data-turno="T2" class="launch-btn ${t2Class} text-white font-bold py-2 rounded-md">Turno 2</button>
                    <button data-id="${item.id}" data-turno="T3" class="launch-btn ${t3Class} text-white font-bold py-2 rounded-md">Turno 3</button>
                </div>
            </div>
        `}).join('');
        lucide.createIcons();
    }
    
    async function handleLaunchPanelClick(e) {
        const launchButton = e.target.closest('.launch-btn');
        if (launchButton) {
            const planId = launchButton.dataset.id;
            const turno = launchButton.dataset.turno;
            showProductionModal(planId, turno);
        }
    }

    async function showProductionModal(planId, turno) {
        if (!productionModalForm || !productionModalTitle) return;
        
        productionModalForm.reset();
        document.getElementById('production-entry-plan-id').value = planId;
        document.getElementById('production-entry-turno').value = turno;

        try {
            const planDoc = await db.collection('planning').doc(planId).get();
            if (planDoc.exists) {
                const planData = planDoc.data();
                productionModalTitle.textContent = `Lançamento: ${planData.machine} - ${turno}`;
                // Preencher contexto do modal com dados do plano (máquina/produto)
                try {
                    fillModalContext(productionModal, {
                        machine: planData.machine,
                        product: planData.product,
                        product_cod: planData.product_cod
                    });
                } catch (e) { /* noop */ }
                
                // Configurar informações do produto
                const productWeightInfo = document.getElementById('product-weight-info');
                if (productWeightInfo) {
                    const pieceWeightGrams = resolvePieceWeightGrams(
                        planData.piece_weight_grams,
                        planData.piece_weight,
                        planData.weight
                    );
                    const infoParts = [
                        pieceWeightGrams > 0
                            ? `Peso da peça: ${pieceWeightGrams.toFixed(3)}g`
                            : 'Peso da peça: -'
                    ];
                    if (planData.mp) infoParts.push(`MP: ${planData.mp}`);
                    productWeightInfo.textContent = infoParts.join(' – ');
                }
                
                // Configurar caixa de tara
                const taraCheckbox = document.getElementById('use-tara-box');
                const taraWeightInput = document.getElementById('tara-box-weight');
                const taraInfo = document.getElementById('tara-box-info');
                
                const taraData = taraBoxesDatabase[planData.machine];
                if (taraData) {
                    taraWeightInput.value = taraData.peso;
                    taraInfo.textContent = taraData.descricao;
                }
            } else { throw new Error("Plano não encontrado."); }
            
            // Carregar lançamentos existentes
            await loadHourlyEntries(planId, turno);
            
            productionModal.classList.remove('hidden');

        } catch(error) {
            console.error("Erro ao abrir modal de produção:", error);
            alert("Não foi possível carregar os dados. Tente novamente.");
        }
    }

    function hideProductionModal() {
        if (productionModal) productionModal.classList.add('hidden');
    }

    async function handleProductionEntrySubmit(e) {
        e.preventDefault();
        
        // ✅ POKA-YOKE: Bloquear lançamento se OP não estiver ativada
        if (!validateOrderActivated()) {
            return;
        }

        // ✅ POKA-YOKE: Bloquear lançamento se ciclo/cavidades não foram informados
        if (!validateCycleCavityLaunched()) {
            return;
        }
        
        const statusMessage = document.getElementById('production-modal-status');
        const saveButton = document.getElementById('production-modal-save-btn');
        
        if (!saveButton) return;
        
        saveButton.disabled = true;
        saveButton.textContent = 'Salvando...';

        const formData = new FormData(productionModalForm);
        const planId = formData.get('planId');
        const turno = formData.get('turno');
        
        console.log('[TRACE][handleProductionEntrySubmit] submission started', { planId, turno });

        const produzido = parseInt(formData.get('produzido')) || 0;
        const refugoKg = parseFloat(formData.get('refugo')) || 0;
        const borrasKg = parseFloat(formData.get('borras')) || 0;
        const motivoRefugo = formData.get('perdas');

        console.log('[TRACE][handleProductionEntrySubmit] parsed form values', {
            produzido,
            refugoKg,
            borrasKg,
            motivoRefugo
        });

        try {
            // Salvar lançamentos por hora
            await saveHourlyEntries(planId, turno);
            console.log('[TRACE][handleProductionEntrySubmit] hourly entries saved');

            // Salvar registro principal de produção
            const entriesRef = db.collection('production_entries');
            const q = entriesRef.where('planId', '==', planId).where('turno', '==', turno).limit(1);
            const querySnapshot = await q.get();
            const planDoc = await db.collection('planning').doc(planId).get();
            const planData = planDoc.exists ? planDoc.data() : {};
            const linkedOrderId = planData.order_id || planData.production_order_id || planData.production_order || null;
            const linkedOrderNumber = planData.order_number || planData.orderNumber || null;
            const planMachine = planData.machine || selectedMachineData?.machine || null;
            const planDate = planData.date || getProductionDateString();
            const planMp = planData.mp || '';
            const planMpType = planData.mp_type || '';

            console.log('[TRACE][handleProductionEntrySubmit] resolved plan info', {
                planMachine,
                planDate,
                planMp,
                planMpType,
                linkedOrderId
            });

            const entryPayload = {
                produzido,
                duracao_min: 0,
                refugo_kg: refugoKg,
                borras_kg: borrasKg,
                motivo_refugo: motivoRefugo,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                machine: planMachine, // FIX: vincula a máquina correta para análise e filtros
                mp: planMp,
                mp_type: planMpType,
                orderId: linkedOrderId || null,
                order_id: linkedOrderId || null,
                production_order_id: linkedOrderId || null,
                order_number: linkedOrderNumber || null
            };

            console.log('[TRACE][handleProductionEntrySubmit] entry payload', entryPayload);
            
            if(querySnapshot.empty){
                console.log('[TRACE][handleProductionEntrySubmit] creating production entry');
                await entriesRef.add({
                    ...entryPayload,
                    planId,
                    turno,
                    data: planDate,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                }); // FIX: inclui data/createdAt para uso futuro
            } else {
                console.log('[TRACE][handleProductionEntrySubmit] updating existing production entry');
                await querySnapshot.docs[0].ref.update({
                    ...entryPayload,
                    data: planDate
                });
            }

            // =====================================================
            // INTEGRAÇÃO FERRAMENTARIA - Atualizar batidas do molde
            // =====================================================
            if (produzido > 0 && typeof window.atualizarBatidasPorProducao === 'function') {
                try {
                    // Já temos planData disponível aqui, então usar diretamente
                    const productCod = planData?.product_cod || planData?.productCod || planData?.part_code || 
                                       selectedMachineData?.product_cod || selectedMachineData?.productCod;
                    
                    console.log('[SYNC-FERRAMENTARIA] Modal - Dados para integração:', { productCod, produzido, planId });
                    
                    if (productCod) {
                        const resultadoBatidas = await window.atualizarBatidasPorProducao(productCod, produzido);
                        if (resultadoBatidas.success) {
                            console.log(`[SYNC-FERRAMENTARIA] ✅ Modal Produção - Batidas atualizadas: molde "${resultadoBatidas.molde}", +${resultadoBatidas.batidasAdicionadas} batidas`);
                        } else {
                            console.log(`[SYNC-FERRAMENTARIA] ⚠️ Modal - Batidas não atualizadas:`, resultadoBatidas.reason);
                        }
                    } else {
                        console.log('[SYNC-FERRAMENTARIA] ⚠️ Modal - product_cod não encontrado');
                    }
                } catch (ferramentariaErr) {
                    console.warn('[SYNC-FERRAMENTARIA] Falha ao atualizar batidas (modal):', ferramentariaErr);
                }
            }

            if (statusMessage) {
                statusMessage.textContent = 'Lançamentos salvos com sucesso!';
                statusMessage.className = 'text-green-600 text-sm font-semibold h-5 text-center';
            }
            // Atualizar aba de análise se estiver aberta
            await refreshAnalysisIfActive();
            setTimeout(() => {
                hideProductionModal();
                if (statusMessage) statusMessage.textContent = '';
            }, 1500);
        } catch (error) {
            console.error("Erro ao salvar lançamentos: ", error);
            if (statusMessage) {
                statusMessage.textContent = 'Erro ao salvar. Tente novamente.';
                statusMessage.className = 'text-red-600 text-sm font-semibold h-5 text-center';
            }
        } finally {
            saveButton.disabled = false;
            saveButton.textContent = 'Salvar Lançamentos';
        }
    }
    // --- ABA DE LANÇAMENTO INTERATIVO ---
    
    function setupLaunchTab() {
        populateMachineSelector();

        if (machineCardGrid && !machineCardGrid.dataset.listenerAttached) {
            machineCardGrid.addEventListener('click', async (event) => {
                // Ações de botões dentro do card
                const finalizeBtn = event.target.closest('.card-finalize-btn');
                if (finalizeBtn) {
                    event.preventDefault();
                    event.stopPropagation();
                    await handleCardFinalizeClick(finalizeBtn);
                    return;
                }
                const activateNextBtn = event.target.closest('.card-activate-next-btn');
                if (activateNextBtn) {
                    event.preventDefault();
                    event.stopPropagation();
                    await handleCardActivateNextClick(activateNextBtn);
                    return;
                }
                
                // NOVO: Botão finalizar parada no card parado
                const finishDowntimeBtn = event.target.closest('.card-finish-downtime-btn');
                if (finishDowntimeBtn) {
                    event.preventDefault();
                    event.stopPropagation();
                    const card = finishDowntimeBtn.closest('.machine-card');
                    if (card && card.dataset.machine) {
                        openCardFinishDowntimeModal(card.dataset.machine, card.dataset.downtimeReason || '', card.dataset.downtimeStart || '');
                    }
                    return;
                }

                // Seleção do card da máquina
                const card = event.target.closest('.machine-card');
                if (!card) return;
                const machine = card.dataset.machine;
                if (!machine) return;
                
                // Se é um card parado (sem OP), abrir modal de finalização
                if (card.classList.contains('machine-stopped') && !card.dataset.planId) {
                    openCardFinishDowntimeModal(machine, card.dataset.downtimeReason || '', card.dataset.downtimeStart || '');
                    return;
                }
                
                // Scroll automático apenas quando usuário clica diretamente no card
                await onMachineSelected(machine, { scrollToPanel: true });
            });
            machineCardGrid.dataset.listenerAttached = 'true';
        }

        setupActionButtons();
        updateCurrentShift();
        setInterval(updateCurrentShift, 60000);

        // Toggle modo do gráfico (Por hora / OP)
        if (launchChartModeHourlyBtn && !launchChartModeHourlyBtn.dataset.listenerAttached) {
            launchChartModeHourlyBtn.addEventListener('click', async () => {
                if (launchChartMode === 'hourly') return;
                launchChartMode = 'hourly';
                launchChartModeHourlyBtn.classList.add('bg-white','text-blue-600','shadow-sm');
                launchChartModeOpBtn?.classList.remove('bg-white','text-blue-600','shadow-sm');
                if (opProductionChart) opProductionChart.classList.add('hidden');
                if (hourlyProductionChart) hourlyProductionChart.classList.remove('hidden');
                await refreshLaunchCharts();
            });
            launchChartModeHourlyBtn.dataset.listenerAttached = 'true';
        }
        if (launchChartModeOpBtn && !launchChartModeOpBtn.dataset.listenerAttached) {
            launchChartModeOpBtn.addEventListener('click', async () => {
                if (launchChartMode === 'op') return;
                launchChartMode = 'op';
                launchChartModeOpBtn.classList.add('bg-white','text-blue-600','shadow-sm');
                launchChartModeHourlyBtn?.classList.remove('bg-white','text-blue-600','shadow-sm');
                if (hourlyProductionChart) hourlyProductionChart.classList.add('hidden');
                if (opProductionChart) opProductionChart.classList.remove('hidden');
                await refreshLaunchCharts();
            });
            launchChartModeOpBtn.dataset.listenerAttached = 'true';
        }
    }

    function updateCurrentShift() {
        const now = new Date();
        const hour = now.getHours();
        const minute = now.getMinutes();
        let currentShift;
        
        // T1: 06:30-14:59, T2: 15:00-23:19, T3: 23:20-06:29
        if ((hour === 6 && minute >= 30) || (hour >= 7 && hour < 15)) {
            currentShift = 'T1';
        } else if (hour >= 15 && (hour < 23 || (hour === 23 && minute < 20))) {
            currentShift = 'T2';
        } else {
            currentShift = 'T3';
        }
        
        if (currentShiftDisplay) {
            currentShiftDisplay.textContent = currentShift;
        }
    }
    
    function updateMachineInfo() {
        if (!selectedMachineData) return;
        
        if (machineIcon) machineIcon.textContent = selectedMachineData.machine;
        if (machineName) machineName.textContent = `Máquina ${selectedMachineData.machine}`;
        if (productName) productName.textContent = selectedMachineData.product || 'Produto não definido';
        if (shiftTarget) {
            // Usar APENAS lot_size, não planned_quantity (meta diária)
            const totalPlanned = selectedMachineData.order_lot_size || selectedMachineData.lot_size || 0;
            const totalExecuted = coerceToNumber(selectedMachineData.total_produzido, 0);
            
            if (!totalPlanned) {
                shiftTarget.textContent = `${totalExecuted.toLocaleString('pt-BR')} / N/A`;
            } else {
                shiftTarget.textContent = `${totalExecuted.toLocaleString('pt-BR')} / ${totalPlanned.toLocaleString('pt-BR')}`;
            }
        }
    }
    
    
    
    // Carregar gráfico da OP (acumulado por DIA ao longo da ordem)
    async function loadOpProductionChart() {
        if (!selectedMachineData || !opProductionChart) return;
        try {
            const orderId = selectedMachineData.order_id || selectedMachineData.orderId || null;
            const planId = selectedMachineData.id;
            let query = db.collection('production_entries');
            if (orderId) {
                query = query.where('orderId', '==', orderId);
            } else {
                query = query.where('planId', '==', planId);
            }
            const snap = await query.get();
            const entries = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            if (entries.length === 0) {
                if (opChartInstance) { opChartInstance.destroy(); opChartInstance = null; }
                const ctx = opProductionChart.getContext('2d');
                ctx.clearRect(0,0,opProductionChart.width, opProductionChart.height);
                return;
            }
            const parseDate = (e) => {
                try {
                    if (e.timestamp?.toDate) return e.timestamp.toDate();
                } catch (_) {}
                if (e.dataHoraInformada) return new Date(e.dataHoraInformada);
                if (e.data && e.horaInformada) return new Date(`${e.data}T${e.horaInformada}:00`);
                if (e.data) return new Date(`${e.data}T12:00:00`);
                return new Date();
            };
            // Agrupar por DIA de produção
            const toDateKey = (e) => {
                if (e.data) return e.data; // já deve estar em YYYY-MM-DD
                const d = parseDate(e);
                const y = d.getFullYear();
                const m = String(d.getMonth()+1).padStart(2,'0');
                const day = String(d.getDate()).padStart(2,'0');
                return `${y}-${m}-${day}`;
            };
            const dailyTotals = {};
            entries.forEach(e => {
                const key = toDateKey(e);
                const qty = Number(e.produzido || e.quantity || 0) || 0;
                dailyTotals[key] = (dailyTotals[key] || 0) + qty;
            });
            const dayKeys = Object.keys(dailyTotals).sort(); // YYYY-MM-DD ordena lexicograficamente por data
            let cumulative = 0;
            const labels = [];
            const values = [];
            const fmtDay = (k) => {
                // k: YYYY-MM-DD -> DD/MM
                const [yy, mm, dd] = k.split('-');
                return `${dd}/${mm}`;
            };
            dayKeys.forEach(k => {
                cumulative += dailyTotals[k];
                labels.push(fmtDay(k));
                values.push(cumulative);
            });
            if (opChartInstance) { opChartInstance.destroy(); opChartInstance = null; }
            opChartInstance = new Chart(opProductionChart.getContext('2d'), {
                type: 'line',
                data: {
                    labels,
                    datasets: [
                        {
                            label: 'Acumulado da OP (por dia)',
                            data: values,
                            borderColor: '#10B981',
                            backgroundColor: 'rgba(16,185,129,0.15)',
                            borderWidth: 2,
                            fill: true,
                            tension: 0.2,
                            pointRadius: 0
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: { grid: { display: false } },
                        y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } }
                    },
                    plugins: {
                        legend: { display: true },
                        tooltip: {
                            callbacks: {
                                label: (ctx) => ` ${ctx.parsed.y?.toLocaleString('pt-BR')} peças`
                            }
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Erro ao carregar gráfico da OP:', error);
        }
    }

    async function refreshLaunchCharts() {
        // Guard para evitar atualizações concorrentes sobrescrevendo o gráfico
        if (isRefreshingLaunchCharts) return;
        isRefreshingLaunchCharts = true;
        try {
            if (launchChartMode === 'op') {
                await loadOpProductionChart();
            } else {
                await loadHourlyProductionChart();
            }
        } finally {
            isRefreshingLaunchCharts = false;
        }
    }
    
    async function loadTodayStats() {
        if (!selectedMachineData) return;
        
        try {
            const today = getProductionDateString();
            // Calcular janela do dia de produção atual [07:00 de hoje, 07:00 de amanhã)
            const windowStart = window.combineDateAndTime(today, '07:00');
            const nextDay = new Date(windowStart);
            nextDay.setDate(nextDay.getDate() + 1);
            const tomorrow = nextDay.toISOString().split('T')[0];
            const windowEnd = window.combineDateAndTime(tomorrow, '07:00');
            
            // Carregar produção do dia para a MÁQUINA (somando todas as OPs do dia)
            const prodSnapshot = await db.collection('production_entries')
                .where('data', '==', today)
                .where('machine', '==', selectedMachineData.machine)
                .get();
            const prodDocs = prodSnapshot.docs;
            let totalProduced = 0;
            let totalLosses = 0;
            
            // Produção por turno
            let producedT1 = 0;
            let producedT2 = 0;
            let producedT3 = 0;
            
            prodDocs.forEach(doc => {
                const data = doc.data();
                const quantidade = Number(data.produzido || data.quantity || 0) || 0;
                const turno = Number(data.turno || data.shift || 0);
                
                totalProduced += quantidade;
                totalLosses += Number(data.refugo_kg || 0) || 0;
                
                // Separar por turno
                if (turno === 1) {
                    producedT1 += quantidade;
                } else if (turno === 2) {
                    producedT2 += quantidade;
                } else if (turno === 3) {
                    producedT3 += quantidade;
                }
            });
            
            // Carregar paradas (duas consultas por data para evitar índice composto)
            const [dtSnapToday, dtSnapTomorrow] = await Promise.all([
                db.collection('downtime_entries')
                  .where('machine', '==', selectedMachineData.machine)
                  .where('date', '==', today)
                  .get(),
                db.collection('downtime_entries')
                  .where('machine', '==', selectedMachineData.machine)
                  .where('date', '==', tomorrow)
                  .get()
            ]);
            const dtDocs = [...dtSnapToday.docs, ...dtSnapTomorrow.docs];
            let totalDowntime = 0;
            dtDocs.forEach(doc => {
                const data = doc.data();
                const start = window.combineDateAndTime(data.date, data.startTime);
                const end = window.combineDateAndTime(data.date, data.endTime);
                if (!(start instanceof Date) || Number.isNaN(start.getTime())) return;
                if (!(end instanceof Date) || Number.isNaN(end.getTime())) return;
                const overlapStart = start > windowStart ? start : windowStart;
                const overlapEnd = end < windowEnd ? end : windowEnd;
                if (overlapEnd > overlapStart) {
                    totalDowntime += Math.round((overlapEnd - overlapStart) / 60000);
                }
            });
            
            // Calcular eficiência baseado na meta diária (com fallback para planned_quantity)
            const dailyTarget = Number(selectedMachineData.daily_target || selectedMachineData.planned_quantity || 0);
            const efficiency = dailyTarget > 0 ? (totalProduced / dailyTarget * 100) : 0;
            
            // Atualizar display - produção por turno
            const producedT1El = document.getElementById('produced-t1');
            const producedT2El = document.getElementById('produced-t2');
            const producedT3El = document.getElementById('produced-t3');
            if (producedT1El) producedT1El.textContent = producedT1.toLocaleString('pt-BR');
            if (producedT2El) producedT2El.textContent = producedT2.toLocaleString('pt-BR');
            if (producedT3El) producedT3El.textContent = producedT3.toLocaleString('pt-BR');
            
            // Atualizar display - totais
            if (producedToday) producedToday.textContent = totalProduced.toLocaleString('pt-BR');
            if (efficiencyToday) efficiencyToday.textContent = efficiency.toFixed(1) + '%';
            if (lossesToday) lossesToday.textContent = totalLosses.toFixed(2);
            if (downtimeToday) downtimeToday.textContent = totalDowntime;
            
        } catch (error) {
            console.error("Erro ao carregar estatísticas: ", error);
        }
    }
    
    function setupActionButtons() {
        // Botão de produção
        const btnProduction = document.getElementById('btn-production');
        if (btnProduction && !btnProduction.dataset.listenerAttached) {
            btnProduction.addEventListener('click', openProductionModal);
            btnProduction.dataset.listenerAttached = 'true';
        }

        // Botão de perdas
        const btnLosses = document.getElementById('btn-losses');
        if (btnLosses && !btnLosses.dataset.listenerAttached) {
            btnLosses.addEventListener('click', openLossesModal);
            btnLosses.dataset.listenerAttached = 'true';
        }
        
        // Botão de parada
        const btnDowntime = document.getElementById('btn-downtime');
        if (btnDowntime && !btnDowntime.dataset.listenerAttached) {
            console.log('[TRACE][setupEventListeners] Anexando listener ao btn-downtime');
            btnDowntime.addEventListener('click', toggleDowntime);
            btnDowntime.dataset.listenerAttached = 'true';
        } else if (btnDowntime) {
            console.log('[TRACE][setupEventListeners] btn-downtime listener já anexado');
        } else {
            console.warn('[WARN][setupEventListeners] btn-downtime não encontrado no DOM');
        }
        
        // Botão de produção manual
        const btnManualProduction = document.getElementById('btn-manual-production');
        if (btnManualProduction && !btnManualProduction.dataset.listenerAttached) {
            btnManualProduction.addEventListener('click', openManualProductionModal);
            btnManualProduction.dataset.listenerAttached = 'true';
        }

        const btnManualLosses = document.getElementById('btn-manual-losses');
        if (btnManualLosses && !btnManualLosses.dataset.listenerAttached) {
            btnManualLosses.addEventListener('click', openManualLossesModal);
            btnManualLosses.dataset.listenerAttached = 'true';
        }

        // Botão de lançamento manual de parada
        const btnManualDowntime = document.getElementById('btn-manual-downtime');
        if (btnManualDowntime && !btnManualDowntime.dataset.listenerAttached) {
            console.log('[TRACE][setupEventListeners] Anexando listener ao btn-manual-downtime');
            btnManualDowntime.addEventListener('click', openManualDowntimeModal);
            btnManualDowntime.dataset.listenerAttached = 'true';
        } else if (btnManualDowntime) {
            console.log('[TRACE][setupEventListeners] btn-manual-downtime listener já anexado');
        } else {
            console.warn('[WARN][setupEventListeners] btn-manual-downtime não encontrado no DOM');
        }
        
        // Botão de retrabalho
        const btnRework = document.getElementById('btn-rework');
        if (btnRework && !btnRework.dataset.listenerAttached) {
            console.log('[TRACE][setupEventListeners] Anexando listener ao btn-rework');
            btnRework.addEventListener('click', openReworkModal);
            btnRework.dataset.listenerAttached = 'true';
        } else if (btnRework) {
            console.log('[TRACE][setupEventListeners] btn-rework listener já anexado');
        } else {
            console.warn('[WARN][setupEventListeners] btn-rework não encontrado no DOM');
        }
        
        // Botão de borra
        const btnManualBorra = document.getElementById('btn-manual-borra');
        if (btnManualBorra && !btnManualBorra.dataset.listenerAttached) {
            console.log('[TRACE][setupEventListeners] Anexando listener ao btn-manual-borra');
            btnManualBorra.addEventListener('click', openManualBorraModal);
            btnManualBorra.dataset.listenerAttached = 'true';
        } else if (btnManualBorra) {
            console.log('[TRACE][setupEventListeners] btn-manual-borra listener já anexado');
        } else {
            console.warn('[WARN][setupEventListeners] btn-manual-borra não encontrado no DOM');
        }

        // Botão de ajuste de quantidade executada
        const btnAdjustExecuted = document.getElementById('btn-adjust-executed');
        if (btnAdjustExecuted && !btnAdjustExecuted.dataset.listenerAttached) {
            console.log('[TRACE][setupEventListeners] Anexando listener ao btn-adjust-executed');
            btnAdjustExecuted.addEventListener('click', openAdjustExecutedModal);
            btnAdjustExecuted.dataset.listenerAttached = 'true';
        } else if (btnAdjustExecuted) {
            console.log('[TRACE][setupEventListeners] btn-adjust-executed listener já anexado');
        }

        // Botão de paradas longas (delegado ao extended-downtime controller via window.*)
        const btnExtendedDowntime = document.getElementById('btn-extended-downtime');
        if (btnExtendedDowntime && !btnExtendedDowntime.dataset.listenerAttached) {
            console.log('[TRACE][setupEventListeners] Anexando listener ao btn-extended-downtime');
            btnExtendedDowntime.addEventListener('click', () => window.openExtendedDowntimeModal?.());
            btnExtendedDowntime.dataset.listenerAttached = 'true';
        } else if (btnExtendedDowntime) {
            console.log('[TRACE][setupEventListeners] btn-extended-downtime listener já anexado');
        } else {
            console.warn('[WARN][setupEventListeners] btn-extended-downtime não encontrado no DOM');
        }

        // Nota: O submit de paradas longas da ABA é tratado pelo setupExtendedDowntimeTab()
        // Não anexar listener duplicado aqui
        
        // Setup modals
        try {
            setupModals();
            console.log('[TRACE][setupEventListeners] setupModals completed successfully');
        } catch (err) {
            console.error('[ERROR][setupEventListeners] setupModals failed:', err);
        }
        
        // Setup tare controls
        try {
            setupTareControls();
            console.log('[TRACE][setupEventListeners] setupTareControls completed successfully');
        } catch (err) {
            console.error('[ERROR][setupEventListeners] setupTareControls failed:', err);
        }
    }

    async function handleFinalizeOrderClick(event) {
        event?.preventDefault?.();

        if (!selectedMachineData) {
            alert('Selecione uma máquina antes de finalizar a ordem.');
            return;
        }

        if (typeof window.authSystem?.checkPermissionForAction === 'function') {
            const hasPermission = window.authSystem.checkPermissionForAction('close_production_order');
            if (hasPermission === false) {
                return;
            }
        }

        // ⚠️ MULTI-PRODUTO: Verificar se há múltiplos planos elegíveis para finalização
        const machinePlans = machineCardData[selectedMachineData.machine] || [];
        const eligiblePlans = machinePlans.filter(p => {
            const status = String(p.status || '').toLowerCase();
            // Planos que podem ser finalizados: ativa, em_andamento, ou planejado (não concluída/cancelada)
            return !['concluida', 'cancelada', 'finalizada', 'encerrada'].includes(status);
        });

        if (eligiblePlans.length === 0) {
            showNotification('Nenhuma ordem elegível para finalização nesta máquina.', 'warning');
            return;
        }

        // Se houver múltiplos planos elegíveis, mostrar modal de seleção
        if (eligiblePlans.length > 1) {
            openFinalizeOrderSelectorModal(eligiblePlans);
            return;
        }

        // Se houver apenas 1 plano elegível, finalizar diretamente
        const targetPlan = eligiblePlans[0];
        await executeFinalizeOrder(targetPlan);
    }

    // Modal de seleção de OP para finalização (Multi-Produto)
    function openFinalizeOrderSelectorModal(plans) {
        const modal = document.getElementById('finalize-order-selector-modal');
        const listContainer = document.getElementById('finalize-order-list');
        const closeBtn = document.getElementById('finalize-order-selector-close');
        const cancelBtn = document.getElementById('finalize-order-selector-cancel');

        if (!modal || !listContainer) {
            console.error('Modal de seleção de OP não encontrado');
            // Fallback: usar o primeiro plano
            if (plans.length > 0) {
                executeFinalizeOrder(plans[0]);
            }
            return;
        }

        // Limpar lista anterior
        listContainer.innerHTML = '';

        // Gerar cards para cada plano
        plans.forEach((plan, idx) => {
            const productName = plan.product || plan.product_name || getProductByCode(plan.product_cod)?.name || `Produto ${idx + 1}`;
            const orderNum = plan.order_number || plan.order_number_original || '-';
            const turno = plan.turno || plan.shift || '-';
            const status = plan.status || 'planejado';
            const statusColor = status === 'ativa' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700';
            const progress = plan.progress || plan.last_progress || {};
            const executed = progress.executed || 0;
            const planned = progress.planned || plan.quantidade || 0;
            const percentComplete = planned > 0 ? Math.round((executed / planned) * 100) : 0;

            const card = document.createElement('div');
            card.className = 'bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl p-4 cursor-pointer transition-all hover:shadow-md hover:border-emerald-300';
            card.innerHTML = `
                <div class="flex items-start justify-between gap-3">
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 mb-2">
                            <span class="text-xs font-bold ${statusColor} px-2 py-0.5 rounded-full">${status.toUpperCase()}</span>
                            <span class="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">T${turno}</span>
                        </div>
                        <p class="font-semibold text-gray-800 text-sm truncate" title="${productName}">${productName}</p>
                        <p class="text-xs text-gray-500 mt-1">OP: <span class="font-medium">${orderNum}</span></p>
                        <div class="mt-2">
                            <div class="flex items-center justify-between text-xs text-gray-500 mb-1">
                                <span>Progresso</span>
                                <span class="font-medium">${executed.toLocaleString()} / ${planned.toLocaleString()} (${percentComplete}%)</span>
                            </div>
                            <div class="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                                <div class="h-full rounded-full transition-all ${percentComplete >= 100 ? 'bg-emerald-500' : 'bg-blue-500'}" style="width: ${Math.min(percentComplete, 100)}%"></div>
                            </div>
                        </div>
                    </div>
                    <button type="button" class="finalize-plan-btn flex-shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 px-3 rounded-lg text-xs transition-colors flex items-center gap-1.5">
                        <i data-lucide="check-circle" class="w-4 h-4"></i>
                        Finalizar
                    </button>
                </div>
            `;

            // Evento de clique no botão de finalizar
            const finalizeBtn = card.querySelector('.finalize-plan-btn');
            finalizeBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                closeModal('finalize-order-selector-modal');
                await executeFinalizeOrder(plan);
            });

            listContainer.appendChild(card);
        });

        // Eventos de fechar modal
        const closeModal_ = () => closeModal('finalize-order-selector-modal');
        closeBtn?.addEventListener('click', closeModal_);
        cancelBtn?.addEventListener('click', closeModal_);

        // Abrir modal
        modal.classList.remove('hidden');
        lucide.createIcons();
    }

    // Executa a finalização de uma ordem específica
    async function executeFinalizeOrder(plan) {
        // Buscar a OP correspondente ao plano
        let targetOrder = null;
        
        if (plan.order_id) {
            try {
                const orderDoc = await db.collection('production_orders').doc(plan.order_id).get();
                if (orderDoc.exists) {
                    targetOrder = { id: orderDoc.id, ...orderDoc.data() };
                }
            } catch (err) {
                console.warn('Erro ao buscar OP por order_id:', err);
            }
        }

        // Se não encontrou por order_id, buscar por part_code
        if (!targetOrder && plan.product_cod) {
            try {
                const ordersSnapshot = await db.collection('production_orders')
                    .where('part_code', '==', String(plan.product_cod))
                    .get();
                
                if (!ordersSnapshot.empty) {
                    const orders = ordersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    const isOpen = (o) => !['concluida','cancelada','finalizada','encerrada'].includes(String(o.status||'').toLowerCase());
                    targetOrder = orders.find(o => ['ativa','em_andamento'].includes(String(o.status||'').toLowerCase()))
                        || orders.filter(isOpen)[0]
                        || orders[0];
                }
            } catch (err) {
                console.warn('Erro ao buscar OP por part_code:', err);
            }
        }

        if (!targetOrder) {
            // Se não encontrar OP, finalizar apenas o planejamento
            console.log('OP não encontrada, finalizando apenas planejamento:', plan.id);
        }

        const orderLabel = targetOrder?.order_number || targetOrder?.order_number_original || plan.order_number || plan.id;
        const confirmMessage = `Confirma a finalização da OP ${orderLabel || ''}? Esta ação marcará o lote como concluído.`;
        if (!window.confirm(confirmMessage)) {
            return;
        }

        const button = finalizeOrderBtn;
        const originalContent = button ? button.innerHTML : '';

        try {
            if (button) {
                button.disabled = true;
                button.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i><span>Finalizando...</span>`;
                lucide.createIcons();
            }

            const currentUser = getActiveUser();
            const progressSnapshot = {
                executed: Number(plan.progress?.executed || currentOrderProgress?.executed) || 0,
                planned: Number(plan.progress?.planned || currentOrderProgress?.planned || plan.quantidade) || 0,
                expected: Number(plan.progress?.expected || currentOrderProgress?.expected) || 0
            };

            // Atualizar OP se existir
            if (targetOrder?.id) {
                const updatePayload = {
                    status: 'concluida',
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    completedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    completedBy: currentUser.username || null,
                    completedByName: currentUser.name || null,
                    last_progress: {
                        ...progressSnapshot,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    }
                };

                await db.collection('production_orders').doc(targetOrder.id).update(updatePayload);
            }

            // Atualizar planejamento
            if (plan.id) {
                const planUpdate = {
                    status: 'concluida',
                    finishedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    finishedBy: currentUser.name || currentUser.username || null
                };

                try {
                    await db.collection('planning').doc(plan.id).update(planUpdate);
                } catch (planError) {
                    console.warn('Não foi possível atualizar status do planejamento:', planError);
                }
            }

            showNotification(`OP ${orderLabel} finalizada com sucesso!`, 'success');

            // Verificar se ainda há outras OPs ativas na máquina
            const machinePlans = machineCardData[selectedMachineData?.machine] || [];
            const remainingActive = machinePlans.filter(p => 
                p.id !== plan.id && 
                !['concluida', 'cancelada', 'finalizada', 'encerrada'].includes(String(p.status || '').toLowerCase())
            );

            if (remainingActive.length > 0) {
                // Ainda há OPs ativas, manter painel visível e selecionar a próxima
                selectedMachineData = remainingActive[0];
                showNotification(`Ainda há ${remainingActive.length} OP(s) ativa(s) nesta máquina.`, 'info');
                await loadRecentEntriesForMachine(selectedMachineData.machine, selectedMachineData.product_cod);
            } else {
                // Não há mais OPs ativas
                if (button) {
                    button.classList.add('hidden');
                }

                currentActiveOrder = null;
                selectedMachineData = null;
                setActiveMachineCard(null);
                resetProductionTimer();
                if (productionControlPanel) {
                    productionControlPanel.classList.add('hidden');
                }
                if (recentEntriesList) {
                    recentEntriesList.innerHTML = '';
                }
                updateRecentEntriesEmptyMessage('Selecione uma máquina para visualizar os lançamentos.');
                setRecentEntriesState({ loading: false, empty: true });
            }

            await Promise.allSettled([
                loadTodayStats(),
                refreshAnalysisIfActive(),
                populateMachineSelector()
            ]);

        } catch (error) {
            console.error('Erro ao finalizar ordem de produção:', error);
            alert('Não foi possível finalizar a ordem. Tente novamente.');
        } finally {
            if (button) {
                button.disabled = false;
                button.innerHTML = originalContent;
                lucide.createIcons();
            }
        }
    }
    
    function setupModals() {
    // ================================
    // VALIDAÇÃO EM TEMPO REAL (POKA-YOKE)
    // ================================
    
    // Validar campos de lançamento de produção em tempo real
    function setupProductionFormValidation() {
        const qtyInput = document.getElementById('quick-production-qty');
        const weightInput = document.getElementById('quick-production-weight');
        const useTareCheckbox = document.getElementById('quick-production-use-tare');
        const submitBtn = document.getElementById('quick-production-submit');
        const measuredFeedback = document.getElementById('quick-production-piece-weight-feedback');
        const measuredVariation = document.getElementById('quick-production-piece-weight-variation');
        
        if (!qtyInput || !weightInput) return;
        
        // Função para atualizar feedback
        const updateFeedback = () => {
            const qty = qtyInput.value ? parseInt(qtyInput.value, 10) : 0;
            const weightInput_value = weightInput.value || '';
            const weightGrams = parseWeightInputToGrams(weightInput_value);
            // Usar getActivePieceWeightGrams que faz fallback para o catálogo
            const activePieceWeight = getActivePieceWeightGrams();
            
            // Atualizar display de conversão
            const convertedDisplay = document.getElementById('quick-production-weight-converted');
            if (weightGrams > 0) {
                let conversionText = '';
                
                // Mostrar conversão de unidade
                if (parseFloat(weightInput_value) > 0 && parseFloat(weightInput_value) < 100) {
                    conversionText = `= ${weightGrams}g`;
                } else {
                    conversionText = `= ${(weightGrams/1000).toFixed(3)}kg`;
                }
                
                // Calcular peso líquido se tara estiver ativa
                let netWeightGrams = weightGrams;
                if (useTareCheckbox && useTareCheckbox.checked) {
                    const tareGrams = getTareWeightForMachine(selectedMachineData?.machine);
                    if (tareGrams > 0) {
                        netWeightGrams = Math.max(0, weightGrams - tareGrams);
                        conversionText += ` → ${(netWeightGrams/1000).toFixed(3)}kg (líquido)`;
                    }
                }
                
                // ✅ NOVO: Mostrar conversão para peças
                if (activePieceWeight > 0 && netWeightGrams > 0) {
                    const estimatedPieces = Math.floor(netWeightGrams / activePieceWeight);
                    conversionText += ` ≈ ${estimatedPieces.toLocaleString('pt-BR')} peças`;
                }
                
                convertedDisplay.textContent = conversionText;
                convertedDisplay.classList.remove('hidden');
            } else {
                convertedDisplay.textContent = '';
            }
            
            if (measuredVariation) {
                measuredVariation.textContent = '';
                measuredVariation.classList.add('hidden');
            }
            
            // Validar consistência se ambos preenchidos
            const consistencyAlert = document.getElementById('quick-production-consistency-alert');
            const consistencyMsg = document.getElementById('quick-production-consistency-message');
            
            if (qty > 0 && weightGrams > 0 && selectedMachineData) {
                if (activePieceWeight > 0) {
                    const consistency = validateWeightQuantityConsistency(weightGrams, qty, activePieceWeight, PIECE_WEIGHT_TOLERANCE_PERCENT);
                    if (!consistency.valid) {
                        consistencyAlert.classList.remove('hidden');
                        consistencyMsg.textContent = consistency.message;
                        submitBtn.classList.add('opacity-75');
                    } else {
                        consistencyAlert.classList.add('hidden');
                        submitBtn.classList.remove('opacity-75');
                    }
                }
            } else {
                consistencyAlert.classList.add('hidden');
                submitBtn.classList.remove('opacity-75');
            }
            
            // Validar que pelo menos um campo está preenchido
            if ((qty === 0 || !qtyInput.value) && (weightGrams === 0 || !weightInput.value)) {
                submitBtn.disabled = true;
                submitBtn.classList.add('opacity-50', 'cursor-not-allowed');
            } else {
                submitBtn.disabled = false;
                submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            }
        };

        quickProductionUpdateFeedback = updateFeedback;
        
        // Event listeners
        qtyInput.addEventListener('input', updateFeedback);
        qtyInput.addEventListener('blur', updateFeedback);
        qtyInput.addEventListener('change', updateFeedback);

        weightInput.addEventListener('input', updateFeedback);
        weightInput.addEventListener('blur', updateFeedback);
        weightInput.addEventListener('change', updateFeedback);
        
        if (measuredInput) {
            measuredInput.addEventListener('input', () => {
                if (measuredInput.value && measuredFeedback) {
                    measuredFeedback.textContent = '';
                }
                updateFeedback();
            });
            measuredInput.addEventListener('blur', () => {
                const val = measuredInput.value;
                if (val && (isNaN(parseFloat(val)) || parseFloat(val) <= 0)) {
                    measuredInput.classList.add('border-red-500', 'border-2');
                    if (measuredFeedback) {
                        measuredFeedback.textContent = '❌ Informe um peso válido em gramas';
                        measuredFeedback.classList.add('text-red-600');
                    }
                } else {
                    measuredInput.classList.remove('border-red-500', 'border-2');
                    if (measuredFeedback) {
                        measuredFeedback.textContent = 'Se vazio, será usado o peso padrão do planejamento.';
                        measuredFeedback.classList.remove('text-red-600');
                    }
                }
            });
        }
        
        if (useTareCheckbox) {
            useTareCheckbox.addEventListener('change', updateFeedback);
        }
        
        // Validar que quantidade é inteiro positivo
        qtyInput.addEventListener('blur', function() {
            const val = this.value;
            if (val && (isNaN(parseInt(val, 10)) || parseInt(val, 10) < 0)) {
                this.classList.add('border-red-500', 'border-2');
                document.getElementById('quick-production-qty-feedback').textContent = '❌ Deve ser um número inteiro positivo';
                document.getElementById('quick-production-qty-feedback').classList.add('text-red-600');
            } else {
                this.classList.remove('border-red-500', 'border-2');
                document.getElementById('quick-production-qty-feedback').textContent = '';
                document.getElementById('quick-production-qty-feedback').classList.remove('text-red-600');
            }
        });
        
        // Validar que peso é número positivo
        weightInput.addEventListener('blur', function() {
            const val = this.value;
            if (val && (isNaN(parseFloat(val)) || parseFloat(val) < 0)) {
                this.classList.add('border-red-500', 'border-2');
                document.getElementById('quick-production-weight-feedback').textContent = '❌ Deve ser um número positivo';
                document.getElementById('quick-production-weight-feedback').classList.add('text-red-600');
            } else {
                this.classList.remove('border-red-500', 'border-2');
                document.getElementById('quick-production-weight-feedback').textContent = 'Digite o peso em gramas (Ex: 1500g = 1,5kg)';
                document.getElementById('quick-production-weight-feedback').classList.remove('text-red-600');
            }
        });
        
        // Primeiro update
        updateFeedback();
    }

        // Modal de produção
        const quickProductionModal = document.getElementById('quick-production-modal');
        const quickProductionClose = document.getElementById('quick-production-close');
        const quickProductionCancel = document.getElementById('quick-production-cancel');
        const quickProductionForm = document.getElementById('quick-production-form');
        
        if (quickProductionClose) quickProductionClose.addEventListener('click', () => closeModal('quick-production-modal'));
        if (quickProductionCancel) quickProductionCancel.addEventListener('click', () => closeModal('quick-production-modal'));
        // Listeners serão adicionados em openProductionModal() quando o modal abre
        
        // Modal de perdas
        const quickLossesClose = document.getElementById('quick-losses-close');
        const quickLossesCancel = document.getElementById('quick-losses-cancel');
        const quickLossesForm = document.getElementById('quick-losses-form');
        const quickLossesDeleteBtn = document.getElementById('quick-losses-delete-btn');
        
        if (quickLossesClose) quickLossesClose.addEventListener('click', () => closeModal('quick-losses-modal'));
        if (quickLossesCancel) quickLossesCancel.addEventListener('click', () => closeModal('quick-losses-modal'));
        if (quickLossesForm) quickLossesForm.addEventListener('submit', handleLossesSubmit);
        if (quickLossesDeleteBtn) {
            quickLossesDeleteBtn.addEventListener('click', () => {
                if (currentEditContext && currentEditContext.type === 'loss' && currentEditContext.id) {
                    const targetCollection = currentEditContext.collection || 'production_entries';
                    showConfirmModal(currentEditContext.id, targetCollection);
                } else {
                    alert('Abra um lançamento existente para excluir.');
                }
            });
        }
        
        // Modal de parada
        const quickDowntimeClose = document.getElementById('quick-downtime-close');
        const quickDowntimeCancel = document.getElementById('quick-downtime-cancel');
        const quickDowntimeForm = document.getElementById('quick-downtime-form');
        
        if (quickDowntimeClose) quickDowntimeClose.addEventListener('click', () => closeModal('quick-downtime-modal'));
        if (quickDowntimeCancel) quickDowntimeCancel.addEventListener('click', () => closeModal('quick-downtime-modal'));
        if (quickDowntimeForm) quickDowntimeForm.addEventListener('submit', handleDowntimeSubmit);
        
        // Modal de produção manual
        const manualProductionClose = document.getElementById('manual-production-close');
        const manualProductionCancel = document.getElementById('manual-production-cancel');
        const manualProductionForm = document.getElementById('manual-production-form');
        const manualProductionSubmitBtn = document.getElementById('manual-production-submit');

        if (manualProductionClose) manualProductionClose.addEventListener('click', () => closeModal('manual-production-modal'));
        if (manualProductionCancel) manualProductionCancel.addEventListener('click', () => closeModal('manual-production-modal'));
        
        // Modal de perdas manual
        const manualLossesClose = document.getElementById('manual-losses-close');
        const manualLossesCancel = document.getElementById('manual-losses-cancel');

        if (manualLossesClose) manualLossesClose.addEventListener('click', () => closeModal('manual-losses-modal'));
        if (manualLossesCancel) manualLossesCancel.addEventListener('click', () => closeModal('manual-losses-modal'));

        // Modal de parada manual
        const manualDowntimeClose = document.getElementById('manual-downtime-close');
        const manualDowntimeCancel = document.getElementById('manual-downtime-cancel');
        
        if (manualDowntimeClose) manualDowntimeClose.addEventListener('click', () => closeModal('manual-downtime-modal'));
        if (manualDowntimeCancel) manualDowntimeCancel.addEventListener('click', () => closeModal('manual-downtime-modal'));

        // Modal de retrabalho
        const quickReworkClose = document.getElementById('quick-rework-close');
        const quickReworkCancel = document.getElementById('quick-rework-cancel');
        const quickReworkForm = document.getElementById('quick-rework-form');

        if (quickReworkClose) quickReworkClose.addEventListener('click', () => closeModal('quick-rework-modal'));
        if (quickReworkCancel) quickReworkCancel.addEventListener('click', () => closeModal('quick-rework-modal'));
        if (quickReworkForm) quickReworkForm.addEventListener('submit', handleReworkSubmit);

        // Modal de borra
        const manualBorraClose = document.getElementById('manual-borra-close');
        const manualBorraCancel = document.getElementById('manual-borra-cancel');
        const manualBorraForm = document.getElementById('manual-borra-form');

        if (manualBorraClose) manualBorraClose.addEventListener('click', () => closeModal('manual-borra-modal'));
        if (manualBorraCancel) manualBorraCancel.addEventListener('click', () => closeModal('manual-borra-modal'));
        if (manualBorraForm) manualBorraForm.addEventListener('submit', handleManualBorraSubmit);

        // Modal de ajuste de quantidade
        const adjustQuantityClose = document.getElementById('adjust-quantity-close');
        const adjustQuantityCancel = document.getElementById('adjust-quantity-cancel');
        const adjustQuantityForm = document.getElementById('adjust-quantity-form');

        if (adjustQuantityClose) adjustQuantityClose.addEventListener('click', closeAdjustQuantityModal);
        if (adjustQuantityCancel) adjustQuantityCancel.addEventListener('click', closeAdjustQuantityModal);
        if (adjustQuantityForm) adjustQuantityForm.addEventListener('submit', handleAdjustQuantitySubmit);

        // Modal de ajuste de quantidade executada (planejamento)
        initAdjustExecutedModal();
    }
    
    // Funções para abrir/fechar modais
    function openProductionModal() {
        currentEditContext = null;
        
        // ✅ POKA-YOKE: Bloquear lançamento se OP não estiver ativada
        if (!validateOrderActivated()) {
            return;
        }
        
        if (!selectedMachineData) {
            alert('Selecione uma máquina primeiro.');
            return;
        }
        updateQuickProductionPieceWeightUI({ forceUpdateInput: true });
        
        // ⚠️ MULTI-PRODUTO: Popular seletor se houver múltiplos planos na máquina
        const planSelectorContainer = document.getElementById('quick-production-plan-selector-container');
        const planSelector = document.getElementById('quick-production-plan-selector');
        if (planSelectorContainer && planSelector && selectedMachineData?.machine) {
            const machinePlans = machineCardData[selectedMachineData.machine];
            if (Array.isArray(machinePlans) && machinePlans.length > 1) {
                // Mostrar seletor e popular com os planos
                planSelectorContainer.classList.remove('hidden');
                planSelector.innerHTML = '<option value="">Selecione o produto para lançar...</option>';
                machinePlans.forEach((p, idx) => {
                    const productName = p.product || p.product_name || getProductByCode(p.product_cod)?.name || `Produto ${idx + 1}`;
                    const orderNum = p.order_number || p.order_number_original || '-';
                    planSelector.innerHTML += `<option value="${p.id}" ${p.id === selectedMachineData.id ? 'selected' : ''}>${productName} (OP: ${orderNum})</option>`;
                });
                
                // Listener para trocar o plano selecionado
                planSelector.onchange = function() {
                    const selectedPlanId = this.value;
                    if (selectedPlanId && Array.isArray(machinePlans)) {
                        const newPlan = machinePlans.find(p => p.id === selectedPlanId);
                        if (newPlan) {
                            selectedMachineData = newPlan;
                            updateQuickProductionPieceWeightUI({ forceUpdateInput: true });
                            // Atualizar contexto do modal
                            const contextProduct = document.querySelector('#quick-production-modal .context-product');
                            const contextOrder = document.querySelector('#quick-production-modal .context-op');
                            if (contextProduct) contextProduct.textContent = newPlan.product || getProductByCode(newPlan.product_cod)?.name || '-';
                            if (contextOrder) contextOrder.textContent = newPlan.order_number || '-';
                        }
                    }
                };
            } else {
                planSelectorContainer.classList.add('hidden');
            }
        }
        
        // ⚠️ ADICIONAR LISTENERS QUANDO O MODAL ABRE
        const form = document.getElementById('quick-production-form');
        const submitBtn = document.getElementById('quick-production-submit');
        
        if (form) {
            form.removeEventListener('submit', handleQuickProductionSubmit);
            form.addEventListener('submit', handleQuickProductionSubmit);
        }
        
        if (submitBtn) {
            submitBtn.removeEventListener('click', handleQuickProductionSubmit);
            submitBtn.addEventListener('click', handleQuickProductionSubmit);
        }
        
        // ✅ Configurar campo de código do operador
        setupUserCodeInput('quick-production-user');
        const userInput = document.getElementById('quick-production-user');
        if (userInput) {
            userInput.value = '';
            updateUserNameDisplay('quick-production-user', '');
        }
        
        openModal('quick-production-modal');
    }
    
    // Função para popular motivos de perdas dinamicamente
    function populateLossReasonsSelect(selectId) {
        const reasonSelect = document.getElementById(selectId);
        if (!reasonSelect) return;
        
        const groupedReasons = window.getGroupedLossReasons();
        let options = '<option value="">Selecione o motivo...</option>';
        
        Object.entries(groupedReasons).forEach(([group, reasons]) => {
            options += `<optgroup label="${group}">`;
            reasons.forEach(reason => {
                options += `<option value="${reason}">${reason}</option>`;
            });
            options += '</optgroup>';
        });
        
        reasonSelect.innerHTML = options;
        console.log('[PERDAS] Motivos carregados em ' + selectId + ':', Object.keys(groupedReasons).length, 'categorias');
    }
    
    function openLossesModal() {
        currentEditContext = null;
        
        // Popular motivos de perdas dinamicamente
        populateLossReasonsSelect('quick-losses-reason');
        
        // ✅ POKA-YOKE: Bloquear lançamento se OP não estiver ativada
        if (!validateOrderActivated()) {
            return;
        }
        
        if (!selectedMachineData) {
            alert('Selecione uma máquina primeiro.');
            return;
        }
        // Ocultar botão de exclusão em novo lançamento
        const quickLossesDeleteBtn = document.getElementById('quick-losses-delete-btn');
        if (quickLossesDeleteBtn) quickLossesDeleteBtn.classList.add('hidden');
        
        // Configurar poka yoke para entrada de peso
        const weightInput = document.getElementById('quick-losses-weight');
        if (weightInput) {
            // Criar helper de validação se não existir
            if (!document.getElementById('weight-feedback-helper')) {
                const helper = document.createElement('div');
                helper.id = 'weight-feedback-helper';
                helper.className = 'mt-1 text-sm font-medium';
                weightInput.parentElement.appendChild(helper);
            }
            
            // Limpar valor anterior
            weightInput.value = '';
            
            // Adicionar listener para feedback real-time
            weightInput.removeEventListener('input', updateWeightFeedback);
            weightInput.addEventListener('input', updateWeightFeedback);
            
            // Adicionar listener para validação ao sair
            weightInput.removeEventListener('blur', validateWeightInput);
            weightInput.addEventListener('blur', validateWeightInput);
        }

        // ⚠️ ADICIONAR LISTENERS QUANDO O MODAL ABRE
        const form = document.getElementById('quick-losses-form');
        const submitBtn = document.getElementById('quick-losses-submit');
        const closeBtn = document.getElementById('quick-losses-close');
        const cancelBtn = document.getElementById('quick-losses-cancel');
        
        if (form) {
            form.removeEventListener('submit', handleLossesSubmit);
            form.addEventListener('submit', handleLossesSubmit);
        }
        
        if (submitBtn) {
            submitBtn.removeEventListener('click', handleLossesSubmit);
            submitBtn.addEventListener('click', handleLossesSubmit);
        }

        if (closeBtn) {
            closeBtn.removeEventListener('click', () => closeModal('quick-losses-modal'));
            closeBtn.addEventListener('click', () => closeModal('quick-losses-modal'));
        }

        if (cancelBtn) {
            cancelBtn.removeEventListener('click', () => closeModal('quick-losses-modal'));
            cancelBtn.addEventListener('click', () => closeModal('quick-losses-modal'));
        }
        
        // ✅ Configurar campo de código do operador
        setupUserCodeInput('quick-losses-user');
        const userInputQuickLosses = document.getElementById('quick-losses-user');
        if (userInputQuickLosses) {
            userInputQuickLosses.value = '';
            updateUserNameDisplay('quick-losses-user', '');
        }
        
        openModal('quick-losses-modal');
    }
    
    // Atualizar feedback em tempo real do input de peso
    function updateWeightFeedback() {
        const weightInput = document.getElementById('quick-losses-weight');
        const helper = document.getElementById('weight-feedback-helper');
        
        if (!helper || !weightInput.value) {
            if (helper) {
                helper.innerHTML = '';
                helper.className = 'mt-1 text-sm';
            }
            return;
        }
        
        const rawValue = weightInput.value;
        const weightGrams = parseInt(rawValue, 10) || 0;
        
        let feedbackHTML = '';
        let feedbackClass = 'text-gray-600';
        
        // Obter peso da peça para conversão (usa catálogo como fallback)
        const pieceWeightGrams = getActivePieceWeightGrams();
        
        if (weightGrams > 0) {
            // Entrada em gramas - mostrar conversão para kg
            const weightKg = (weightGrams / 1000).toFixed(3);
            feedbackHTML = `✔ ${weightGrams}g = <strong>${weightKg} kg</strong>`;
            
            // Calcular e mostrar quantidade de peças
            if (pieceWeightGrams > 0) {
                const estimatedPieces = Math.floor(weightGrams / pieceWeightGrams);
                feedbackHTML += ` ≈ <strong class="text-blue-600">${estimatedPieces.toLocaleString('pt-BR')} peças</strong>`;
            }
            
            feedbackClass = 'text-green-700';
        } else if (rawValue && weightGrams === 0) {
            // Entrada não-vazia mas não foi convertida
            feedbackHTML = `❌ <strong>Erro:</strong> Não foi possível interpretar "${rawValue}" como número`;
            feedbackClass = 'text-red-700 bg-red-50 p-2 rounded border border-red-200';
        }
        
        if (helper) {
            helper.innerHTML = feedbackHTML;
            helper.className = `mt-1 text-sm font-medium ${feedbackClass}`;
        }
    }
    
    // Validar e corrigir entrada de peso ao sair do campo
    function validateWeightInput() {
        const weightInput = document.getElementById('quick-losses-weight');
        if (!weightInput || !weightInput.value) return;
        
        const rawValue = weightInput.value;
        const weightGrams = parseInt(rawValue, 10) || 0;
        
        if (weightGrams === 0 && rawValue.trim()) {
            // Campo tem texto mas não foi interpretado como número
            const confirmation = window.confirm(
                `Não consegui interpretar "${rawValue}" como peso em gramas.\n\n` +
                `Digite apenas números inteiros (ex: 1500 para 1,5kg)\n\n` +
                `Deseja limpar o campo e tentar novamente?`
            );
            if (confirmation) {
                weightInput.value = '';
                updateWeightFeedback();
                weightInput.focus();
            }
        } else if (weightGrams > 50000) {
            // Alerta se peso muito alto (mais de 50kg em gramas)
            const weightKg = (weightGrams / 1000).toFixed(3);
            const confirmation = window.confirm(
                `⚠️ Peso muito alto: ${weightGrams}g (${weightKg}kg)\n\n` +
                `Confirma este peso ou quer corrigir?`
            );
            if (!confirmation) {
                weightInput.value = '';
                updateWeightFeedback();
                weightInput.focus();
            }
        }
    }
    
    function openReworkModal() {
        console.log('[TRACE][openReworkModal] called, selectedMachineData:', selectedMachineData);
        
        currentEditContext = null;
        
        // ✅ POKA-YOKE: Bloquear lançamento se OP não estiver ativada
        if (!validateOrderActivated()) {
            return;
        }
        
        if (!selectedMachineData) {
            console.warn('[WARN][openReworkModal] Nenhuma máquina selecionada');
            alert('Selecione uma máquina primeiro.');
            return;
        }
        
        // ⚠️ ADICIONAR LISTENERS QUANDO O MODAL ABRE
        const form = document.getElementById('quick-rework-form');
        const submitBtn = document.getElementById('quick-rework-submit');
        
        if (form) {
            form.removeEventListener('submit', handleReworkSubmit);
            form.addEventListener('submit', handleReworkSubmit);
        }
        
        if (submitBtn) {
            submitBtn.removeEventListener('click', handleReworkSubmit);
            submitBtn.addEventListener('click', handleReworkSubmit);
        }
        
        const reworkModal = document.getElementById('quick-rework-modal');
        if (reworkModal) {
            console.log('[DEBUG] Portalizando quick-rework-modal antes da abertura');
            modalManager.portalize(reworkModal);
        }

        setTimeout(() => {
            console.log('[TRACE][openReworkModal] abrindo modal quick-rework-modal');
            openModal('quick-rework-modal');
        }, 0);
    }
    
    function openManualProductionModal() {
        currentEditContext = null;
        
        // ✅ POKA-YOKE: Bloquear lançamento se OP não estiver ativada
        if (!validateOrderActivated()) {
            return;
        }
        
        if (!selectedMachineData) {
            alert('Selecione uma máquina primeiro.');
            return;
        }

        // Preenchimento do contexto (máquina e produto)
        const contextMachine = document.querySelector('#manual-production-modal .context-machine');
        const contextProduct = document.querySelector('#manual-production-modal .context-product');
        if (contextMachine) contextMachine.textContent = selectedMachineData.machine || '-';
        if (contextProduct) contextProduct.textContent = selectedMachineData.product || '-';

        const dateInput = document.getElementById('manual-production-date');
        if (dateInput) {
            dateInput.value = getProductionDateString();
        }

        const shiftSelect = document.getElementById('manual-production-shift');
        if (shiftSelect) {
            shiftSelect.value = String(getCurrentShift());
        }

        const hourInput = document.getElementById('manual-production-hour');
        if (hourInput) {
            const now = new Date();
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            hourInput.value = `${hours}:${minutes}`;
        }
        
        // ⚠️ ADICIONAR LISTENERS QUANDO O MODAL ABRE
        const form = document.getElementById('manual-production-form');
        const submitBtn = document.getElementById('manual-production-submit');
        
        if (form) {
            form.removeEventListener('submit', handleManualProductionSubmit);
            form.addEventListener('submit', handleManualProductionSubmit);
        }
        
        if (submitBtn) {
            submitBtn.removeEventListener('click', handleManualProductionSubmit);
            submitBtn.addEventListener('click', handleManualProductionSubmit);
        }
        
        // ✅ Configurar campo de código do operador
        setupUserCodeInput('manual-production-user');
        const userInput = document.getElementById('manual-production-user');
        if (userInput) {
            userInput.value = '';
            updateUserNameDisplay('manual-production-user', '');
        }

        openModal('manual-production-modal');
    }

    function openManualLossesModal() {
        currentEditContext = null;
        
        // Popular motivos de perdas dinamicamente
        populateLossReasonsSelect('manual-losses-reason');
        
        // ✅ POKA-YOKE: Bloquear lançamento se OP não estiver ativada
        if (!validateOrderActivated()) {
            return;
        }
        
        if (!selectedMachineData) {
            alert('Selecione uma máquina primeiro.');
            return;
        }

        // Preenchimento do contexto (máquina e produto)
        const contextMachine = document.querySelector('#manual-losses-modal .context-machine');
        const contextProduct = document.querySelector('#manual-losses-modal .context-product');
        if (contextMachine) contextMachine.textContent = selectedMachineData.machine || '-';
        if (contextProduct) contextProduct.textContent = selectedMachineData.product || '-';

        const dateInput = document.getElementById('manual-losses-date');
        if (dateInput) {
            dateInput.value = getProductionDateString();
        }

        const shiftSelect = document.getElementById('manual-losses-shift');
        if (shiftSelect) {
            shiftSelect.value = String(getCurrentShift());
        }

        const hourInput = document.getElementById('manual-losses-hour');
        if (hourInput) {
            const now = new Date();
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            hourInput.value = `${hours}:${minutes}`;
        }

        // ⚠️ ADICIONAR LISTENERS QUANDO O MODAL ABRE
        const form = document.getElementById('manual-losses-form');
        const submitBtn = document.getElementById('manual-losses-submit');
        
        if (form) {
            form.removeEventListener('submit', handleManualLossesSubmit);
            form.addEventListener('submit', handleManualLossesSubmit);
        }
        
        if (submitBtn) {
            submitBtn.removeEventListener('click', handleManualLossesSubmit);
            submitBtn.addEventListener('click', handleManualLossesSubmit);
        }
        
        // ✅ Configurar campo de código do operador
        setupUserCodeInput('manual-losses-user');
        const userInputLosses = document.getElementById('manual-losses-user');
        if (userInputLosses) {
            userInputLosses.value = '';
            updateUserNameDisplay('manual-losses-user', '');
        }

        openModal('manual-losses-modal');
    }

    function openManualBorraModal() {
        console.log('[TRACE][openManualBorraModal] called, selectedMachineData:', selectedMachineData);
        
        currentEditContext = null;
        
        // ✅ POKA-YOKE: Bloquear lançamento se OP não estiver ativada
        if (!validateOrderActivated()) {
            return;
        }
        
        if (!selectedMachineData) {
            console.warn('[WARN][openManualBorraModal] Nenhuma máquina selecionada');
            alert('Selecione uma máquina primeiro.');
            return;
        }

        // Preenchimento do contexto (máquina e produto)
        const contextMachine = document.querySelector('#manual-borra-modal .context-machine');
        const contextProduct = document.querySelector('#manual-borra-modal .context-product');
        if (contextMachine) contextMachine.textContent = selectedMachineData.machine || '-';
        if (contextProduct) contextProduct.textContent = selectedMachineData.product || '-';

        // Popular os selects do modal com máquinas e motivos do database.js
        populateBorraModal();

        const dateInput = document.getElementById('manual-borra-date');
        if (dateInput) {
            dateInput.value = getProductionDateString();
        }

        const shiftSelect = document.getElementById('manual-borra-shift');
        if (shiftSelect) {
            shiftSelect.value = String(getCurrentShift());
        }

        const machineSelect = document.getElementById('manual-borra-machine');
        if (machineSelect && selectedMachineData) {
            machineSelect.value = normalizeMachineId(selectedMachineData.machine);
        }

        const hourInput = document.getElementById('manual-borra-hour');
        if (hourInput) {
            const now = new Date();
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            hourInput.value = `${hours}:${minutes}`;
        }

        // ⚠️ ADICIONAR LISTENERS QUANDO O MODAL ABRE
        const form = document.getElementById('manual-borra-form');
        const submitBtn = document.getElementById('manual-borra-submit');
        
        if (form) {
            form.removeEventListener('submit', handleManualBorraSubmit);
            form.addEventListener('submit', handleManualBorraSubmit);
        }
        
        if (submitBtn) {
            submitBtn.removeEventListener('click', handleManualBorraSubmit);
            submitBtn.addEventListener('click', handleManualBorraSubmit);
        }

        const borraModal = document.getElementById('manual-borra-modal');
        if (borraModal) {
            console.log('[DEBUG] Portalizando manual-borra-modal antes da abertura');
            modalManager.portalize(borraModal);
        }

        setTimeout(() => {
            console.log('[TRACE][openManualBorraModal] abrindo modal manual-borra-modal');
            openModal('manual-borra-modal');
        }, 0);
    }

    function closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;

        modal.classList.add('hidden');
        modal.setAttribute('aria-hidden', 'true');
        modal.removeAttribute('data-modal-open');

        modalManager.clearStyles(modal);
        const modalContent = modal.querySelector('.bg-white, .modal-content, [class*="bg-white"]');
        if (modalContent) {
            modalManager.clearContentStyles(modalContent);
        }

        // Limpar formulários associados ao modal fechado
        const form = modal.querySelector('form');
        if (form) form.reset();
        if (['quick-production-modal', 'quick-losses-modal', 'quick-downtime-modal', 'quick-rework-modal', 'manual-borra-modal'].includes(modalId)) {
            currentEditContext = null;
        }
    }
    
    // Expor closeModal globalmente para uso em onclick
    window.closeModal = closeModal;

    // Preenche o contexto (máquina/produto) em um modal, se existir o bloco .modal-context
    function fillModalContext(modalEl, context = null) {
        if (!modalEl) return;
        const ctx = modalEl.querySelector('.modal-context');
        if (!ctx) return;
        const machineEl = ctx.querySelector('.context-machine');
        const productEl = ctx.querySelector('.context-product');
        const src = context || selectedMachineData || {};
        const machine = src.machine || src.machine_id || '-';
        let product = src.product || src.product_name || '';
        const code = src.product_cod || src.product_code || src.part_code || '';
        if (!product && code) product = `Cod ${code}`;
        if (machineEl) machineEl.textContent = machine || '-';
        if (productEl) productEl.textContent = product || 'Produto não definido';
    }

    function openModal(modalId) {
        if (modalId === 'quick-downtime-modal') {
            // Forçar re-vinculação do submit do formulário de parada
            const quickDowntimeForm = document.getElementById('quick-downtime-form');
            if (quickDowntimeForm) {
                quickDowntimeForm.onsubmit = null;
                quickDowntimeForm.removeEventListener('submit', handleDowntimeSubmit);
                quickDowntimeForm.addEventListener('submit', handleDowntimeSubmit);
                console.log('[DEBUG] Evento de submit vinculado ao quick-downtime-form (openModal)');
            }
        }
        
        // Popular selects de usuários quando modal abre
        if (['quick-production-modal', 'quick-losses-modal', 'quick-downtime-modal', 'manual-production-modal', 'manual-losses-modal', 'manual-downtime-modal'].includes(modalId)) {
            populateAllUserSelects();
        }
        
        console.error('🔴🔴🔴 OPENMODAL START, modalId=' + modalId + ' 🔴🔴🔴');

        const modal = document.getElementById(modalId);
        console.error('🔴 modal found:', !!modal, 'typeof:', typeof modal);

        if (!modal) {
            console.error('🔴 EARLY RETURN: Modal not found');
            return;
        }

        modalManager.portalize(modal);
        console.error('🔴 calling fillModalContext');

        // Atualizar faixa de contexto do modal, quando aplicável
        try {
            fillModalContext(modal);
            console.error('🔴 fillModalContext OK');
        } catch (e) {
            console.error('🔴 fillModalContext ERROR:', e.message);
        }

        modal.setAttribute('data-modal-open', 'true');
        modal.setAttribute('aria-hidden', 'false');
        modal.classList.remove('hidden');
        modalManager.applyStyles(modal);

        const modalContent = modal.querySelector('.bg-white, .modal-content, [class*="bg-white"]');
        if (modalContent) {
            modalManager.applyContentStyles(modalContent);
        } else {
            console.warn('🔴 Nenhum container interno padrão (.bg-white/.modal-content) encontrado para', modalId);
        }

        const initialComputed = window.getComputedStyle(modal);
        console.error('🔴 after force -> hidden:', modal.classList.contains('hidden'),
            'display:', initialComputed.display,
            'opacity:', initialComputed.opacity,
            'visibility:', initialComputed.visibility,
            'z-index:', initialComputed.zIndex);

        const logState = (label) => {
            if (!modal || !modal.isConnected) {
                console.error(`🔴 ${label} modal desconectado do DOM`, { modalId });
                return;
            }
            const style = window.getComputedStyle(modal);
            const rect = modal.getBoundingClientRect();
            console.error(`🔴 ${label} hidden=${modal.classList.contains('hidden')} display=${style.display} opacity=${style.opacity} visibility=${style.visibility} z-index=${style.zIndex} rect=${Math.round(rect.width)}x${Math.round(rect.height)} top=${Math.round(rect.top)} left=${Math.round(rect.left)}`);
        };

        requestAnimationFrame(() => {
            modalManager.verify(modal);
            logState('RAF check');
        });

        setTimeout(() => logState('100ms later'), 100);
        setTimeout(() => logState('300ms later'), 300);
        setTimeout(() => logState('500ms later'), 500);

        console.error('🔴🔴🔴 OPENMODAL END 🔴🔴🔴');
    }

    // Função para toggle de parada (stop/start)
    function toggleDowntime() {
        console.log('[TRACE][toggleDowntime] called, selectedMachineData:', selectedMachineData, 'machineStatus:', machineStatus);
        
        // ✅ POKA-YOKE: Bloquear lançamento se OP não estiver ativada
        if (!validateOrderActivated()) {
            return;
        }
        
        if (!selectedMachineData) {
            console.warn('[WARN][toggleDowntime] Nenhuma máquina selecionada');
            alert('Selecione uma máquina primeiro.');
            return;
        }
        
        if (machineStatus === 'running') {
            console.log('[TRACE][toggleDowntime] Status running -> abrindo modal para selecionar motivo da parada');
            // Parar máquina - solicitar motivo ANTES de iniciar a parada
            openDowntimeReasonModal();
        } else {
            console.log('[TRACE][toggleDowntime] Status stopped -> finalizando parada');
            // Retomar máquina - finalizar parada (motivo já foi informado no início)
            finalizeMachineDowntime();
        }
    }
    
    // Função para abrir modal de lançamento manual de parada passada
    function openManualDowntimeModal() {
        console.log('[TRACE][openManualDowntimeModal] called, selectedMachineData:', selectedMachineData);
        
        // ✅ POKA-YOKE: Bloquear lançamento se OP não estiver ativada
        if (!validateOrderActivated()) {
            return;
        }
        
        if (!selectedMachineData) {
            console.warn('[WARN][openManualDowntimeModal] Nenhuma máquina selecionada');
            alert('Selecione uma máquina primeiro.');
            return;
        }

        // Preenchimento do contexto (máquina)
        const contextMachine = document.querySelector('#manual-downtime-modal .context-machine');
        if (contextMachine) contextMachine.textContent = selectedMachineData.machine || '-';
        
        // Preencher datas padrão
        const today = getProductionDateString();
        const ds = document.getElementById('manual-downtime-date-start');
        const de = document.getElementById('manual-downtime-date-end');
        
        if (ds && !ds.value) ds.value = today;
        if (de && !de.value) de.value = today;

        // ⚠️ ADICIONAR LISTENERS QUANDO O MODAL ABRE
        const form = document.getElementById('manual-downtime-form');
        const submitBtn = document.getElementById('manual-downtime-submit');
        
        if (form) {
            form.removeEventListener('submit', handleManualDowntimeSubmit);
            form.addEventListener('submit', handleManualDowntimeSubmit);
        }
        
        if (submitBtn) {
            submitBtn.removeEventListener('click', handleManualDowntimeSubmit);
            submitBtn.addEventListener('click', handleManualDowntimeSubmit);
        }
        
        // ✅ Configurar campo de código do operador
        setupUserCodeInput('manual-downtime-user');
        const userInputDowntime = document.getElementById('manual-downtime-user');
        if (userInputDowntime) {
            userInputDowntime.value = '';
            updateUserNameDisplay('manual-downtime-user', '');
        }

        openModal('manual-downtime-modal');
        console.log('[TRACE][openManualDowntimeModal] completed');
    }
    
    // ========================================
    // SISTEMA ROBUSTO DE PARADAS - FUNÇÕES PRINCIPAIS
    // ========================================
    
    /**
     * Inicia uma parada de máquina com persistência robusta
     * @param {string} reason - Motivo da parada (informado no modal)
     * @param {string} observations - Observações adicionais
     * @param {number} userCod - Código do operador responsável
     * @param {string} nomeUsuario - Nome do operador responsável
     */
    async function startMachineDowntime(reason, observations = '', userCod = null, nomeUsuario = null) {
        if (!selectedMachineData) {
            console.error('[DOWNTIME] Tentativa de iniciar parada sem máquina selecionada');
            showNotification('Selecione uma máquina primeiro.', 'error');
            return;
        }

        if (!reason) {
            console.error('[DOWNTIME] Tentativa de iniciar parada sem motivo');
            showNotification('Informe o motivo da parada.', 'error');
            return;
        }

        const now = new Date();
        const currentShift = window.getShiftForDateTime(now);
        const workday = window.getWorkdayForDateTime(now);
        
        // Estrutura de dados robusta para a parada (inclui motivo desde o início)
        currentDowntimeStart = {
            machine: selectedMachineData.machine,
            date: workday,
            startTime: window.formatTimeHM(now),
            startTimestamp: now,
            startShift: currentShift,
            // Motivo e observações (informados no início)
            reason: reason,
            observations: observations,
            // Dados do operador
            userCod: userCod,
            nomeUsuario: nomeUsuario,
            // Dados adicionais para rastreabilidade
            product: selectedMachineData.product || null,
            productCod: selectedMachineData.product_cod || null,
            orderId: selectedMachineData.order_id || null,
            orderNumber: selectedMachineData.order_number || null
        };
        
        console.log('[DOWNTIME][START] Parada iniciada:', currentDowntimeStart);
        
        // Salvar parada ativa no Firebase para persistência (sobrevive a refresh/troca de máquina)
        try {
            const activeDowntimeData = {
                // Identificação
                machine: selectedMachineData.machine,
                
                // Timestamps (múltiplos formatos para robustez)
                startDate: workday,
                startTime: window.formatTimeHM(now),
                startTimestamp: firebase.firestore.FieldValue.serverTimestamp(),
                startTimestampLocal: now.toISOString(),
                startShift: currentShift,
                
                // Motivo e observações (informados no início)
                reason: reason,
                observations: observations,
                
                // Dados do operador responsável
                userCod: userCod,
                nomeUsuario: nomeUsuario,
                
                // Contexto de produção
                product: selectedMachineData.product || null,
                productCod: selectedMachineData.product_cod || null,
                orderId: selectedMachineData.order_id || null,
                orderNumber: selectedMachineData.order_number || null,
                
                // Metadados
                startedBy: getActiveUser()?.name || 'Sistema',
                startedByUsername: getActiveUser()?.username || null,
                isActive: true,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                
                // Versão do sistema para compatibilidade futura
                systemVersion: '2.1'
            };
            
            // Usar merge para não perder dados em caso de erro parcial
            // IMPORTANTE: Normalizar ID da máquina para garantir consistência
            const normalizedMachineIdForDowntime = normalizeMachineId(selectedMachineData.machine);
            await db.collection('active_downtimes').doc(normalizedMachineIdForDowntime).set(activeDowntimeData, { merge: true });
            
            console.log('[DOWNTIME][START] Parada ativa persistida no Firebase:', activeDowntimeData);
        } catch (error) {
            console.error('[DOWNTIME][START] Erro ao persistir parada no Firebase:', error);
            // Mesmo com erro no Firebase, continuamos com a parada local
            showNotification('Parada iniciada localmente. Pode haver erro de sincronização.', 'warning');
        }
        
        machineStatus = 'stopped';
        updateMachineStatus();
        freezeProductionTimer();
        startDowntimeTimer();
        
        // Notificação com informações contextuais
        const shiftLabel = currentShift === 1 ? '1º Turno' : currentShift === 2 ? '2º Turno' : '3º Turno';
        showNotification(`Máquina parada às ${window.formatTimeHM(now)} (${shiftLabel}) - Motivo: ${reason}. Clique em START quando retomar.`, 'warning');
    }
    
    // Função para popular motivos de parada rápida dinamicamente
    function populateQuickDowntimeReasons() {
        const reasonSelect = document.getElementById('quick-downtime-reason');
        if (!reasonSelect) return;
        
        const groupedReasons = window.getGroupedDowntimeReasons();
        let options = '<option value="">Selecione o motivo...</option>';
        
        Object.entries(groupedReasons).forEach(([group, reasons]) => {
            options += `<optgroup label="${group}">`;
            reasons.forEach(reason => {
                options += `<option value="${reason}">${reason}</option>`;
            });
            options += '</optgroup>';
        });
        
        reasonSelect.innerHTML = options;
        console.log('[PARADA-RAPIDA] Motivos carregados:', Object.keys(groupedReasons).length, 'categorias');
    }
    
    // Função para abrir modal solicitando motivo da parada ao INICIAR (nova dinâmica)
    function openDowntimeReasonModal() {
        console.log('[TRACE][openDowntimeReasonModal] called - Solicitando motivo para INICIAR parada');
        
        // Popular motivos dinamicamente
        populateQuickDowntimeReasons();
        
        // Limpar formulário
        const reasonSelect = document.getElementById('quick-downtime-reason');
        const obsField = document.getElementById('quick-downtime-obs');
        if (reasonSelect) reasonSelect.value = '';
        if (obsField) obsField.value = '';
        
        // Atualizar título e botão do modal para refletir a nova dinâmica
        const modalTitle = document.getElementById('downtime-modal-title');
        const actionBtn = document.getElementById('downtime-action-btn');
        if (modalTitle) modalTitle.textContent = 'Iniciar Parada - Informe o Motivo';
        if (actionBtn) actionBtn.textContent = 'Iniciar Parada';
        
        // ✅ Configurar campo de código do operador
        setupUserCodeInput('quick-downtime-user');
        const userInputQuickDowntime = document.getElementById('quick-downtime-user');
        if (userInputQuickDowntime) {
            userInputQuickDowntime.value = '';
            updateUserNameDisplay('quick-downtime-user', '');
        }
        
        console.log('[TRACE][openDowntimeReasonModal] abrindo modal quick-downtime-modal');
        openModal('quick-downtime-modal');
    }
    
    /**
     * Finaliza uma parada de máquina (quando usuário clica START para retomar)
     * O motivo já foi informado no início da parada
     */
    async function finalizeMachineDowntime() {
        console.log('[DOWNTIME][FINALIZE] Finalizando parada', {
            selectedMachineData,
            currentDowntimeStart,
            machineStatus,
            timestamp: new Date().toISOString()
        });

        if (!currentDowntimeStart) {
            console.warn('[DOWNTIME][FINALIZE] Nenhuma parada ativa encontrada');
            // Garante que o status da máquina volte para running e a UI seja atualizada
            machineStatus = 'running';
            updateMachineStatus();
            resumeProductionTimer();
            stopDowntimeTimer();
            await loadTodayStats();
            await loadRecentEntries(false);
            await refreshAnalysisIfActive();
            return;
        }
        
        // Bloquear múltiplos cliques
        if (finalizeMachineDowntime._processing) {
            console.warn('[DOWNTIME][FINALIZE] Já está processando, ignorando clique duplicado');
            return;
        }
        finalizeMachineDowntime._processing = true;
        
        let erroFinal = null;
        let savedSegments = 0;
        
        try {
            const now = new Date();
            const endShift = window.getShiftForDateTime(now);
            const endWorkday = window.getWorkdayForDateTime(now);
            
            // Reconstruir data de início a partir dos dados salvos
            let startDateTime;
            if (currentDowntimeStart.startTimestamp instanceof Date) {
                startDateTime = currentDowntimeStart.startTimestamp;
            } else if (currentDowntimeStart.startTimestampLocal) {
                startDateTime = new Date(currentDowntimeStart.startTimestampLocal);
            } else {
                // Fallback: reconstruir a partir de date + startTime
                startDateTime = window.parseDateTime(currentDowntimeStart.date, currentDowntimeStart.startTime);
            }
            
            if (!startDateTime || isNaN(startDateTime.getTime())) {
                console.error('[DOWNTIME][FINALIZE] Data de início inválida:', currentDowntimeStart);
                alert('Erro: Data de início da parada inválida. Registre manualmente.');
                return;
            }
            
            // Verificar se a data de início é futura (erro de dados)
            if (startDateTime > now) {
                console.error('[DOWNTIME][FINALIZE] Data de início é futura! Corrigindo para agora menos 1 minuto.', {
                    startDateTime: startDateTime.toISOString(),
                    now: now.toISOString()
                });
                // Corrigir para 1 minuto antes de agora
                startDateTime = new Date(now.getTime() - 60000);
            }
            
            // Se a diferença for muito pequena (< 5 segundos), garantir pelo menos 1 minuto de duração
            const diffMs = now.getTime() - startDateTime.getTime();
            if (diffMs < 5000) {
                console.warn('[DOWNTIME][FINALIZE] Parada muito curta (' + diffMs + 'ms), ajustando para 1 minuto');
                startDateTime = new Date(now.getTime() - 60000);
            }
            
            const startDateStr = window.formatDateYMD(startDateTime);
            const startTimeStr = window.formatTimeHM(startDateTime);
            const endDateStr = window.formatDateYMD(now);
            const endTimeStr = window.formatTimeHM(now);
            
            // Calcular duração total para log
            const totalDurationMs = now.getTime() - startDateTime.getTime();
            const totalDurationMin = Math.max(1, Math.round(totalDurationMs / 60000));
            const totalDurationHours = (totalDurationMs / 3600000).toFixed(2);
            
            console.log('[DOWNTIME][FINALIZE] Calculando segmentos:', {
                startDateTime: startDateTime.toISOString(),
                now: now.toISOString(),
                startDate: startDateStr,
                startTime: startTimeStr,
                endDate: endDateStr,
                endTime: endTimeStr,
                totalDurationMs,
                totalDurationMin,
                totalDurationHours: `${totalDurationHours}h`
            });
            
            // Segmentar a parada por turno
            const segments = window.splitDowntimeIntoShiftSegments(startDateStr, startTimeStr, endDateStr, endTimeStr);
            
            if (!segments.length) {
                console.error('[DOWNTIME][FINALIZE] Nenhum segmento gerado');
                alert('Intervalo de parada inválido. Verifique os horários ou registre manualmente.');
                return;
            }
            
            console.log('[DOWNTIME][FINALIZE] Segmentos a salvar:', segments.length, segments);
            
            const currentUser = getActiveUser();
            const batch = db.batch();
            
            // Usar o motivo que foi informado no início da parada
            const reason = currentDowntimeStart.reason;
            const obs = currentDowntimeStart.observations || '';
            
            // Validação: motivo é obrigatório
            if (!reason || reason.trim() === '') {
                console.error('[DOWNTIME][FINALIZE] Motivo não informado');
                alert('⚠️ Erro: Motivo da parada não foi informado.\n\nEsta parada não pode ser finalizada sem um motivo válido.\nPor favor, registre a parada manualmente com o motivo correto.');
                return;
            }
            
            for (const seg of segments) {
                const downtimeData = {
                    // Identificação
                    machine: currentDowntimeStart.machine,
                    
                    // Período
                    date: seg.date,
                    startTime: seg.startTime,
                    endTime: seg.endTime,
                    duration: seg.duration,
                    shift: seg.shift,
                    
                    // Motivo e observações (informados no início da parada)
                    reason: reason,
                    observations: obs,
                    
                    // Dados do operador que registrou a parada
                    userCod: currentDowntimeStart.userCod ?? null,
                    nomeUsuario: currentDowntimeStart.nomeUsuario || null,
                    
                    // Contexto de produção (se disponível)
                    product: currentDowntimeStart.product || null,
                    productCod: currentDowntimeStart.productCod || null,
                    orderId: currentDowntimeStart.orderId || null,
                    orderNumber: currentDowntimeStart.orderNumber || null,
                    
                    // Metadados de registro
                    registradoPor: currentUser?.username || null,
                    registradoPorNome: getCurrentUserName(),
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    
                    // Metadados adicionais para auditoria
                    originalStartTimestamp: startDateTime.toISOString(),
                    originalEndTimestamp: now.toISOString(),
                    totalParentDuration: totalDurationMin,
                    segmentIndex: segments.indexOf(seg),
                    totalSegments: segments.length,
                    systemVersion: '2.0'
                };
                
                const docRef = db.collection('downtime_entries').doc();
                batch.set(docRef, downtimeData);
                savedSegments++;
                
                console.log(`[DOWNTIME][FINALIZE] Segmento ${savedSegments}/${segments.length} preparado:`, {
                    date: seg.date,
                    shift: seg.shift,
                    duration: seg.duration,
                    startTime: seg.startTime,
                    endTime: seg.endTime
                });
            }
            
            // Executar batch de salvamento
            await batch.commit();
            console.log(`[DOWNTIME][FINALIZE] ${savedSegments} segmentos salvos com sucesso`);
            
        } catch (error) {
            erroFinal = error;
            console.error('[DOWNTIME][FINALIZE] Erro ao registrar parada:', error);
            alert('Erro ao registrar parada. Tente novamente.');
        } finally {
            // Remover parada ativa dessa máquina (evita restauração automática na troca de máquina/reload)
            const machineToClean = currentDowntimeStart?.machine;
            const reasonForLog = currentDowntimeStart?.reason;
            
            // Calcular duração para log
            let durationForLog = '-';
            if (currentDowntimeStart) {
                let startDt;
                if (currentDowntimeStart.startTimestamp instanceof Date) {
                    startDt = currentDowntimeStart.startTimestamp;
                } else if (currentDowntimeStart.startTimestampLocal) {
                    startDt = new Date(currentDowntimeStart.startTimestampLocal);
                }
                if (startDt && !isNaN(startDt.getTime())) {
                    const elapsedMin = Math.round((Date.now() - startDt.getTime()) / 60000);
                    durationForLog = elapsedMin + ' min';
                }
            }
            
            try {
                if (machineToClean) {
                    const normalizedMachineForDelete = normalizeMachineId(machineToClean);
                    await db.collection('active_downtimes').doc(normalizedMachineForDelete).delete();
                    console.log('[DOWNTIME][FINALIZE] active_downtime removed for machine', normalizedMachineForDelete);
                }
            } catch (err) {
                console.warn('[DOWNTIME][FINALIZE] failed to delete active_downtime doc', err);
            }
            
            // Resetar status e timers (sempre)
            currentDowntimeStart = null;
            machineStatus = 'running';
            updateMachineStatus();
            stopDowntimeTimer();
            resumeProductionTimer();
            await loadTodayStats();
            await loadRecentEntries(false);
            await refreshAnalysisIfActive();
            
            if (!erroFinal) {
                showNotification('Parada finalizada e registrada com sucesso!', 'success');
                console.log('[DOWNTIME][FINALIZE] success path completed');
                
                // Registrar log de parada
                registrarLogSistema('REGISTRO DE PARADA', 'parada', {
                    machine: machineToClean || selectedMachineData?.machine,
                    motivo: reasonForLog || '-',
                    duracao: durationForLog
                });
            }
            
            // Liberar flag de processamento
            finalizeMachineDowntime._processing = false;
        }
    }



    // ==================== HISTÓRICO DO SISTEMA ====================
    
    // Função global para registrar ações no sistema
    window.logSystemAction = async function(tipo, descricao, detalhes = {}) {
        try {
            const usuario = window.authSystem?.getCurrentUser();
            const now = new Date();
            
            await db.collection('system_logs').add({
                tipo: tipo,
                descricao: descricao,
                maquina: detalhes.maquina || selectedMachineData?.machine || null,
                usuario: usuario?.name || 'Desconhecido',
                userId: usuario?.id || null,
                detalhes: detalhes,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                timestampLocal: now.toISOString(),
                data: now.toISOString().split('T')[0],
                hora: now.toTimeString().split(' ')[0]
            });
            
            console.log('[SYSTEM_LOG]', tipo, descricao);
        } catch (error) {
            console.error('[SYSTEM_LOG] Erro ao registrar ação:', error);
        }
    };
    
    // Função interna para registrar logs (usada em diversos pontos do sistema)
    async function registrarLogSistema(acao, tipo, detalhes = {}) {
        try {
            const usuario = window.authSystem?.getCurrentUser();
            const now = new Date();
            
            await db.collection('system_logs').add({
                acao: acao,
                tipo: tipo,
                descricao: acao,
                maquina: detalhes.machine || detalhes.maquina || selectedMachineData?.machine || null,
                usuario: usuario?.name || 'Desconhecido',
                userId: usuario?.id || null,
                detalhes: detalhes,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                timestampLocal: now.toISOString(),
                data: now.toISOString().split('T')[0],
                hora: now.toTimeString().split(' ')[0]
            });
            
            console.log('[SYSTEM_LOG]', acao, tipo, detalhes);
        } catch (error) {
            console.error('[SYSTEM_LOG] Erro ao registrar log:', error);
        }
    }


    // Handlers dos formulários
    async function handleManualProductionSubmit(e) {
        e.preventDefault();
        e.stopPropagation();
        
        // ✅ POKA-YOKE: Bloquear lançamento se OP não estiver ativada
        if (!validateOrderActivated()) {
            return;
        }

        // ✅ POKA-YOKE: Bloquear lançamento se ciclo/cavidades não foram informados
        if (!validateCycleCavityLaunched()) {
            return;
        }
        
        if (!window.authSystem || !window.authSystem.checkPermissionForAction) {
            showNotification('Erro de permissão', 'error');
            return;
        }
        
        if (!window.authSystem.checkPermissionForAction('add_production')) {
            showNotification('Permissão negada para registrar produção', 'error');
            return;
        }

        if (!selectedMachineData) {
            showNotification('Selecione uma máquina', 'warning');
            return;
        }
        
        const dateInput = document.getElementById('manual-production-date');
        const hourInput = document.getElementById('manual-production-hour');
        const shiftSelect = document.getElementById('manual-production-shift');
        const qtyInput = document.getElementById('manual-production-qty');
        const weightInput = document.getElementById('manual-production-weight');
        const useTareCheckbox = document.getElementById('manual-production-use-tare');
        const obsInput = document.getElementById('manual-production-obs');

        // ✅ POKA-YOKE: Operador obrigatório
        const userInput = document.getElementById('manual-production-user');
        const userCod = userInput ? parseInt(userInput.value, 10) : null;
        if (userCod === null || isNaN(userCod) || userInput.value === '') {
            alert('⚠️ Operador obrigatório!\n\nPor favor, digite o código do operador responsável.');
            if (userInput) userInput.focus({ preventScroll: true });
            return;
        }
        const userData = getUserByCode ? getUserByCode(userCod) : null;
        if (!userData) {
            alert('⚠️ Código inválido!\n\nO código digitado não foi encontrado no sistema.\nVerifique e tente novamente.');
            if (userInput) userInput.focus({ preventScroll: true });
            return;
        }
        const nomeUsuario = userData.nomeUsuario;

        const dateValue = dateInput?.value || '';
        const hourValue = hourInput?.value || '';
        const shiftRaw = shiftSelect?.value || '';
        const quantityValue = parseInt(qtyInput?.value || '0', 10);
        const rawWeightGrams = parseWeightInputToGrams(weightInput?.value || '');
        let netWeightGrams = rawWeightGrams;
        const observations = (obsInput?.value || '').trim();
        
        if (!dateValue) {
            showNotification('Informe a data da produção', 'warning');
            dateInput?.focus({ preventScroll: true });
            return;
        }
        
        const hasQty = Number.isFinite(quantityValue) && quantityValue > 0;
        if (!hasQty && rawWeightGrams <= 0) {
            showNotification('Informe quantidade OU peso', 'warning');
            return;
        }

        if (useTareCheckbox?.checked && rawWeightGrams > 0) {
            const tareWeightGrams = getTareWeightForMachine(selectedMachineData?.machine);
            if (tareWeightGrams > 0) {
                netWeightGrams = Math.max(0, rawWeightGrams - tareWeightGrams);
            }
        }

        const hasWeight = netWeightGrams > 0;
        
        if (!hasQty && !hasWeight) {
            showNotification('Peso informado é inválido após descontar a tara', 'warning');
            return;
        }
        
        try {
            const shiftNumeric = parseInt(shiftRaw, 10);
            const turno = [1, 2, 3].includes(shiftNumeric) ? shiftNumeric : getCurrentShift();
            const planId = selectedMachineData?.id || null;
            const currentUser = getActiveUser();

            let resolvedQuantity = hasQty ? quantityValue : 0;
            if (!hasQty && hasWeight) {
                const pieceWeightGrams = getActivePieceWeightGrams();
                if (pieceWeightGrams <= 0) {
                    showNotification('Peso médio da peça não encontrado. Informe a quantidade manualmente ou cadastre o peso no planejamento.', 'warning');
                    return;
                }
                const conversion = calculateQuantityFromGrams(netWeightGrams, pieceWeightGrams);
                if (conversion.error || conversion.quantity <= 0) {
                    showNotification('Não foi possível converter o peso informado em peças. Verifique o valor digitado.', 'warning');
                    return;
                }
                resolvedQuantity = conversion.quantity;
            }

            const netWeightKg = hasWeight ? Number(gramsToKg(netWeightGrams).toFixed(3)) : 0;
            
            const payloadBase = {
                planId,
                data: dateValue,
                turno,
                produzido: resolvedQuantity,
                peso_bruto: netWeightKg,
                refugo_kg: 0,
                perdas: '',
                observacoes: observations,
                machine: selectedMachineData.machine || null,
                mp: selectedMachineData.mp || '',
                orderId: selectedMachineData.order_id || null,
                manual: true,
                horaInformada: hourValue || null,
                registradoPor: currentUser?.username || null,
                registradoPorNome: getCurrentUserName(),
                userCod: userCod,
                nomeUsuario: nomeUsuario
            };
            
            await db.collection('production_entries').add({
                ...payloadBase,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // CRÍTICO: Atualizar total_produzido na OP vinculada e no planejamento
            const linkedOrderId = selectedMachineData.order_id || selectedMachineData.orderId;
            if (linkedOrderId && resolvedQuantity > 0) {
                try {
                    const orderRef = db.collection('production_orders').doc(linkedOrderId);
                    const orderSnap = await orderRef.get();
                    if (orderSnap.exists) {
                        const orderData = orderSnap.data() || {};
                        const currentTotal = coerceToNumber(orderData.total_produzido ?? orderData.totalProduced, 0);
                        const newTotal = currentTotal + resolvedQuantity;
                        await orderRef.update({
                            total_produzido: newTotal,
                            totalProduced: newTotal,
                            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                        });
                        console.log(`[SYNC-ORDER] OP ${linkedOrderId} atualizada: total_produzido ${currentTotal} → ${newTotal}`);
                    }
                } catch (orderErr) {
                    console.warn('[SYNC-ORDER] Falha ao atualizar total da OP:', orderErr);
                }
            }

            // Atualizar total_produzido no planejamento também
            if (planId && resolvedQuantity > 0) {
                try {
                    const planRef = db.collection('planning').doc(planId);
                    const planSnap = await planRef.get();
                    if (planSnap.exists) {
                        const planData = planSnap.data() || {};
                        const currentPlanTotal = coerceToNumber(planData.total_produzido, 0);
                        const newPlanTotal = currentPlanTotal + resolvedQuantity;
                        await planRef.update({
                            total_produzido: newPlanTotal,
                            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                        });
                        console.log(`[SYNC-PLAN] Plano ${planId} atualizado: total_produzido ${currentPlanTotal} → ${newPlanTotal}`);
                    }
                } catch (planErr) {
                    console.warn('[SYNC-PLAN] Falha ao atualizar total do plano:', planErr);
                }
            }

            // =====================================================
            // INTEGRAÇÃO FERRAMENTARIA - Atualizar batidas do molde
            // =====================================================
            if (resolvedQuantity > 0 && typeof window.atualizarBatidasPorProducao === 'function') {
                try {
                    // Tentar obter product_cod de várias fontes
                    let productCod = selectedMachineData?.product_cod || selectedMachineData?.productCod;
                    
                    // Se não encontrou, buscar do planning
                    if (!productCod && planId) {
                        try {
                            const planDoc = await db.collection('planning').doc(planId).get();
                            if (planDoc.exists) {
                                const planData = planDoc.data();
                                productCod = planData.product_cod || planData.productCod || planData.part_code;
                            }
                        } catch (e) {
                            console.warn('[SYNC-FERRAMENTARIA] Erro ao buscar planning:', e);
                        }
                    }
                    
                    console.log('[SYNC-FERRAMENTARIA] Manual - Dados para integração:', { productCod, resolvedQuantity, planId });
                    
                    if (productCod) {
                        const resultadoBatidas = await window.atualizarBatidasPorProducao(productCod, resolvedQuantity);
                        if (resultadoBatidas.success) {
                            console.log(`[SYNC-FERRAMENTARIA] ✅ Produção Manual - Batidas atualizadas: molde "${resultadoBatidas.molde}", +${resultadoBatidas.batidasAdicionadas} batidas`);
                        } else {
                            console.log(`[SYNC-FERRAMENTARIA] ⚠️ Manual - Batidas não atualizadas:`, resultadoBatidas.reason);
                        }
                    } else {
                        console.log('[SYNC-FERRAMENTARIA] ⚠️ Manual - product_cod não encontrado');
                    }
                } catch (ferramentariaErr) {
                    console.warn('[SYNC-FERRAMENTARIA] Falha ao atualizar batidas (manual):', ferramentariaErr);
                }
            }

            // Registrar no histórico do sistema
            if (typeof logSystemAction === 'function') {
                logSystemAction('producao', `Produção manual: ${resolvedQuantity} peças`, {
                    quantidade: resolvedQuantity,
                    maquina: selectedMachineData.machine,
                    op: linkedOrderId || planId,
                    turno: turno,
                    data: dateValue,
                    peso: netWeightKg
                });
            }
            
            closeModal('manual-production-modal');
            await populateMachineSelector();
            await refreshLaunchCharts();
            await loadTodayStats();
            await loadRecentEntries(false);
            
            showNotification('✅ Produção manual registrada com sucesso!', 'success');
        } catch (error) {
            console.error('Erro ao registrar produção:', error);
            showNotification('❌ Erro ao registrar produção: ' + error.message, 'error');
        }
    }

    // ✅ POKA-YOKE: Validar se a OP está ativada
    function validateOrderActivated() {
        if (!currentActiveOrder || !currentActiveOrder.id) {
            showNotification('⚠️ ORDEM NÃO ATIVADA! Ative a OP antes de fazer qualquer lançamento.', 'error');
            console.warn('[POKA-YOKE] Tentativa de lançamento bloqueada: OP não ativada');
            return false;
        }
        const status = String(currentActiveOrder.status || '').toLowerCase();
        if (status !== 'ativa' && status !== 'em_andamento') {
            showNotification(`⚠️ OP NÃO ESTÁ ATIVA! Status atual: ${currentActiveOrder.status}. Ative antes de registrar.`, 'error');
            console.warn('[POKA-YOKE] Tentativa de lançamento bloqueada: status inválido -', status);
            return false;
        }
        return true;
    }

    // ✅ POKA-YOKE: Verificar se ciclo/cavidades foram lançados antes de permitir produção/perdas
    function validateCycleCavityLaunched() {
        // Verificar se há dados de máquina selecionada
        if (!selectedMachineData) {
            console.warn('[POKA-YOKE] validateCycleCavityLaunched: selectedMachineData não disponível');
            return true; // Permitir se não houver dados (fallback)
        }

        // Obter turno atual
        const currentShift = typeof getCurrentShift === 'function' ? getCurrentShift() : null;
        if (!currentShift) {
            console.warn('[POKA-YOKE] validateCycleCavityLaunched: turno atual não identificado');
            return true; // Permitir se não conseguir identificar o turno
        }

        // Mapear turno para chave do campo
        const shiftKey = `t${currentShift}`; // t1, t2, t3
        const realCycleField = `real_cycle_${shiftKey}`;
        const activeCavitiesField = `active_cavities_${shiftKey}`;

        // Verificar se ciclo e cavidades foram informados para o turno atual
        const realCycle = selectedMachineData[realCycleField];
        const activeCavities = selectedMachineData[activeCavitiesField];

        const hasCycle = realCycle !== null && realCycle !== undefined && realCycle !== '' && Number(realCycle) > 0;
        const hasCavities = activeCavities !== null && activeCavities !== undefined && activeCavities !== '' && Number(activeCavities) > 0;

        if (!hasCycle || !hasCavities) {
            const turnoLabel = currentShift === 1 ? '1º Turno' : currentShift === 2 ? '2º Turno' : '3º Turno';
            const missing = [];
            if (!hasCycle) missing.push('Ciclo Real');
            if (!hasCavities) missing.push('Cavidades Ativas');

            showNotification(
                `⚠️ CICLO/CAVIDADES NÃO INFORMADO!\n\n` +
                `Informe ${missing.join(' e ')} do ${turnoLabel} antes de fazer lançamentos.\n\n` +
                `Acesse a aba LIDERANÇA → Painel de Lançamento Ciclo/Cavidades`,
                'error'
            );
            console.warn('[POKA-YOKE] Tentativa de lançamento bloqueada: ciclo/cavidades não informados', {
                turno: turnoLabel,
                realCycle,
                activeCavities,
                machine: selectedMachineData.machine
            });
            return false;
        }

        console.log('[POKA-YOKE] validateCycleCavityLaunched: OK', {
            turno: `T${currentShift}`,
            realCycle,
            activeCavities,
            machine: selectedMachineData.machine
        });
        return true;
    }

    //  POKA-YOKE: Verificar se existe OP ativa para a máquina atual
    function isOrderActiveForCurrentMachine() {
        if (!currentActiveOrder || !currentActiveOrder.id) {
            return false;
        }
        const status = String(currentActiveOrder.status || '').toLowerCase();
        return status === 'ativa' || status === 'em_andamento';
    }


    async function handleQuickProductionSubmit(e) {
        e.preventDefault();
        e.stopPropagation();

        // ✅ POKA-YOKE: Bloquear lançamento se OP não estiver ativada
        if (!validateOrderActivated()) {
            return;
        }

        // ✅ POKA-YOKE: Bloquear lançamento se ciclo/cavidades não foram informados
        if (!validateCycleCavityLaunched()) {
            return;
        }


        if (!window.authSystem || !window.authSystem.checkPermissionForAction) {
            showNotification('Erro de permissão', 'error');
            return;
        }

        if (!window.authSystem.checkPermissionForAction('add_production')) {
            showNotification('Permissão negada para registrar produção', 'error');
            return;
        }

        if (!selectedMachineData) {
            showNotification('Selecione uma máquina', 'warning');
            return;
        }

        // ✅ POKA-YOKE: Operador obrigatório
        const userInput = document.getElementById('quick-production-user');
        const userCod = userInput ? parseInt(userInput.value, 10) : null;
        if (userCod === null || isNaN(userCod) || userInput.value === '') {
            alert('⚠️ Operador obrigatório!\n\nPor favor, digite o código do operador responsável.');
            if (userInput) userInput.focus({ preventScroll: true });
            return;
        }
        const userData = getUserByCode ? getUserByCode(userCod) : null;
        if (!userData) {
            alert('⚠️ Código inválido!\n\nO código digitado não foi encontrado no sistema.\nVerifique e tente novamente.');
            if (userInput) userInput.focus({ preventScroll: true });
            return;
        }
        const nomeUsuario = userData.nomeUsuario;

        const qtyInput = document.getElementById('quick-production-qty');
        const weightInput = document.getElementById('quick-production-weight');
        const obsInput = document.getElementById('quick-production-obs');
        const useTareCheckbox = document.getElementById('quick-production-use-tare');

        const quantityValue = parseInt(qtyInput?.value || '0', 10);
        const rawWeightGrams = parseWeightInputToGrams(weightInput?.value || '');
        let netWeightGrams = rawWeightGrams;
        const observations = (obsInput?.value || '').trim();

        const hasQty = Number.isFinite(quantityValue) && quantityValue > 0;

        if (useTareCheckbox?.checked && rawWeightGrams > 0) {
            const tareWeight = getTareWeightForMachine(selectedMachineData?.machine);
            if (tareWeight > 0) {
                netWeightGrams = Math.max(0, rawWeightGrams - tareWeight);
            }
        }

        const hasWeight = netWeightGrams > 0;

        if (!hasQty && !hasWeight) {
            showNotification('Informe quantidade OU peso', 'warning');
            return;
        }

        try {
            const planId = selectedMachineData?.id || null;
            if (!planId) {
                showNotification('Não foi possível identificar o planejamento', 'error');
                return;
            }

            const turno = getCurrentShift();
            const currentUser = getActiveUser();

            let resolvedQuantity = hasQty ? quantityValue : 0;
            if (!hasQty && hasWeight) {
                const pieceWeightGrams = getActivePieceWeightGrams();
                if (pieceWeightGrams <= 0) {
                    showNotification('Peso médio da peça não encontrado. Informe quantidade ou cadastre o peso da peça.', 'warning');
                    return;
                }
                const conversion = calculateQuantityFromGrams(netWeightGrams, pieceWeightGrams);
                if (conversion.error || conversion.quantity <= 0) {
                    showNotification('Não foi possível converter o peso em peças. Verifique o valor informado.', 'warning');
                    return;
                }
                resolvedQuantity = conversion.quantity;
            }

            const netWeightKg = hasWeight ? Number(gramsToKg(netWeightGrams).toFixed(3)) : 0;

            const payloadBase = {
                planId,
                data: getProductionDateString(),
                turno,
                produzido: resolvedQuantity,
                peso_bruto: netWeightKg,
                refugo_kg: 0,
                perdas: '',
                observacoes: observations,
                machine: selectedMachineData.machine || null,
                mp: selectedMachineData.mp || '',
                orderId: selectedMachineData.order_id || null,
                manual: false,
                // Dados do operador responsável
                userCod: userCod,
                nomeUsuario: nomeUsuario,
                registradoPor: currentUser?.username || null,
                registradoPorNome: getCurrentUserName()
            };

            await db.collection('production_entries').add({
                ...payloadBase,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // CRÍTICO: Atualizar total_produzido na OP vinculada e no planejamento
            const linkedOrderId = selectedMachineData.order_id || selectedMachineData.orderId;
            if (linkedOrderId && resolvedQuantity > 0) {
                try {
                    const orderRef = db.collection('production_orders').doc(linkedOrderId);
                    const orderSnap = await orderRef.get();
                    if (orderSnap.exists) {
                        const orderData = orderSnap.data() || {};
                        const currentTotal = coerceToNumber(orderData.total_produzido ?? orderData.totalProduced, 0);
                        const newTotal = currentTotal + resolvedQuantity;
                        await orderRef.update({
                            total_produzido: newTotal,
                            totalProduced: newTotal,
                            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                        });
                        console.log(`[SYNC-ORDER] OP ${linkedOrderId} atualizada: total_produzido ${currentTotal} → ${newTotal}`);
                    }
                } catch (orderErr) {
                    console.warn('[SYNC-ORDER] Falha ao atualizar total da OP:', orderErr);
                }
            }

            // Atualizar total_produzido no planejamento também
            if (planId && resolvedQuantity > 0) {
                try {
                    const planRef = db.collection('planning').doc(planId);
                    const planSnap = await planRef.get();
                    if (planSnap.exists) {
                        const planData = planSnap.data() || {};
                        const currentPlanTotal = coerceToNumber(planData.total_produzido, 0);
                        const newPlanTotal = currentPlanTotal + resolvedQuantity;
                        await planRef.update({
                            total_produzido: newPlanTotal,
                            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                        });
                        console.log(`[SYNC-PLAN] Plano ${planId} atualizado: total_produzido ${currentPlanTotal} → ${newPlanTotal}`);
                    }
                } catch (planErr) {
                    console.warn('[SYNC-PLAN] Falha ao atualizar total do plano:', planErr);
                }
            }

            // =====================================================
            // INTEGRAÇÃO FERRAMENTARIA - Atualizar batidas do molde
            // =====================================================
            if (resolvedQuantity > 0 && typeof window.atualizarBatidasPorProducao === 'function') {
                try {
                    // Tentar obter product_cod de várias fontes
                    let productCod = selectedMachineData?.product_cod || selectedMachineData?.productCod;
                    
                    // Se não encontrou, buscar do planning
                    if (!productCod && planId) {
                        try {
                            const planDoc = await db.collection('planning').doc(planId).get();
                            if (planDoc.exists) {
                                const planData = planDoc.data();
                                productCod = planData.product_cod || planData.productCod || planData.part_code;
                            }
                        } catch (e) {
                            console.warn('[SYNC-FERRAMENTARIA] Erro ao buscar planning:', e);
                        }
                    }
                    
                    console.log('[SYNC-FERRAMENTARIA] Dados para integração:', { productCod, resolvedQuantity, planId });
                    
                    if (productCod) {
                        const resultadoBatidas = await window.atualizarBatidasPorProducao(productCod, resolvedQuantity);
                        if (resultadoBatidas.success) {
                            console.log(`[SYNC-FERRAMENTARIA] ✅ Batidas atualizadas: molde "${resultadoBatidas.molde}", +${resultadoBatidas.batidasAdicionadas} batidas`);
                        } else {
                            console.log(`[SYNC-FERRAMENTARIA] ⚠️ Batidas não atualizadas:`, resultadoBatidas.reason);
                        }
                    } else {
                        console.log('[SYNC-FERRAMENTARIA] ⚠️ product_cod não encontrado - batidas não atualizadas');
                    }
                } catch (ferramentariaErr) {
                    console.warn('[SYNC-FERRAMENTARIA] Falha ao atualizar batidas:', ferramentariaErr);
                }
            }

            // Registrar no histórico do sistema
            if (typeof logSystemAction === 'function') {
                logSystemAction('producao', `Produção rápida: ${resolvedQuantity} peças`, {
                    quantidade: resolvedQuantity,
                    maquina: selectedMachineData.machine,
                    op: linkedOrderId || planId,
                    turno: turno,
                    data: getProductionDateString(),
                    peso: netWeightKg
                });
            }

            closeModal('quick-production-modal');
            
            // Salvar posição do scroll antes de atualizar
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
            
            // Executar atualizações em paralelo para reduzir tempo
            await Promise.all([
                populateMachineSelector(),
                refreshLaunchCharts(),
                loadTodayStats(),
                loadRecentEntries(false)
            ]);
            
            // Restaurar posição do scroll após atualizações
            requestAnimationFrame(() => {
                window.scrollTo({ left: scrollLeft, top: scrollTop, behavior: 'instant' });
            });

            showNotification('✅ Produção rápida registrada com sucesso!', 'success');
        } catch (error) {
            console.error('Erro ao registrar produção rápida:', error);
            showNotification('❌ Erro ao registrar produção: ' + error.message, 'error');
        }
    }

    async function handleManualLossesSubmit(e) {
        e.preventDefault();
        e.stopPropagation();

        // ✅ POKA-YOKE: Bloquear lançamento se OP não estiver ativada
        if (!isOrderActiveForCurrentMachine()) {
            showNotification('⚠️ Ative uma OP antes de fazer lançamentos. Vá em "Ordens" e clique em "Ativar" na OP desejada.', 'warning');
            return;
        }

        // ✅ POKA-YOKE: Bloquear lançamento se ciclo/cavidades não foram informados
        if (!validateCycleCavityLaunched()) {
            return;
        }


        if (!window.authSystem || !window.authSystem.checkPermissionForAction) {
            showNotification('Erro de permissão', 'error');
            return;
        }

        if (!window.authSystem.checkPermissionForAction('add_losses')) {
            showNotification('Permissão negada para registrar perdas', 'error');
            return;
        }

        if (!selectedMachineData) {
            showNotification('Selecione uma máquina', 'warning');
            return;
        }

        const dateInput = document.getElementById('manual-losses-date');
        const shiftSelect = document.getElementById('manual-losses-shift');
        const hourInput = document.getElementById('manual-losses-hour');
        const qtyInput = document.getElementById('manual-losses-qty');
        const weightInput = document.getElementById('manual-losses-weight');
        const reasonSelect = document.getElementById('manual-losses-reason');
        const obsInput = document.getElementById('manual-losses-obs');

        // ✅ POKA-YOKE: Operador obrigatório
        const userInput = document.getElementById('manual-losses-user');
        const userCod = userInput ? parseInt(userInput.value, 10) : null;
        if (userCod === null || isNaN(userCod) || userInput.value === '') {
            alert('⚠️ Operador obrigatório!\n\nPor favor, digite o código do operador responsável.');
            if (userInput) userInput.focus({ preventScroll: true });
            return;
        }
        const userData = getUserByCode ? getUserByCode(userCod) : null;
        if (!userData) {
            alert('⚠️ Código inválido!\n\nO código digitado não foi encontrado no sistema.\nVerifique e tente novamente.');
            if (userInput) userInput.focus({ preventScroll: true });
            return;
        }
        const nomeUsuario = userData.nomeUsuario;

        const dateValue = (dateInput?.value || '').trim();
        const shiftRaw = shiftSelect?.value || '';
        const hourValue = (hourInput?.value || '').trim();
        const quantityValue = parseInt(qtyInput?.value || '0', 10);
        const weightValueKg = parseFloat(weightInput?.value || '0');
        let netWeightGrams = kgToGrams(weightValueKg);
        const reasonValue = reasonSelect?.value || '';
        const observations = (obsInput?.value || '').trim();

        if (!dateValue) {
            showNotification('Informe a data da perda', 'warning');
            dateInput?.focus({ preventScroll: true });
            return;
        }

        const hasQuantity = Number.isFinite(quantityValue) && quantityValue > 0;
        const hasWeight = netWeightGrams > 0;

        if (!hasQuantity && !hasWeight) {
            showNotification('Informe quantidade OU peso', 'warning');
            return;
        }

        if (!reasonValue) {
            showNotification('Selecione o motivo da perda', 'warning');
            reasonSelect?.focus({ preventScroll: true });
            return;
        }

        try {
            const planId = selectedMachineData?.id || null;
            if (!planId) {
                showNotification('Não foi possível identificar o planejamento', 'error');
                return;
            }

            const pieceWeightGrams = getActivePieceWeightGrams();
            let refugoQty = hasQuantity ? quantityValue : 0;

            if (!hasQuantity && hasWeight) {
                if (pieceWeightGrams <= 0) {
                    showNotification('Peso médio da peça não encontrado. Informe a quantidade manualmente ou cadastre o peso no planejamento.', 'warning');
                    qtyInput?.focus({ preventScroll: true });
                    return;
                }
                const conversion = calculateQuantityFromGrams(netWeightGrams, pieceWeightGrams);
                refugoQty = conversion.quantity > 0 ? conversion.quantity : 1;
            }

            if (refugoQty <= 0) {
                showNotification('Não foi possível determinar a quantidade de perdas.', 'warning');
                return;
            }

            let pesoTotalKg = hasWeight ? gramsToKg(netWeightGrams) : 0;
            if (pesoTotalKg <= 0 && pieceWeightGrams > 0) {
                pesoTotalKg = (refugoQty * pieceWeightGrams) / 1000;
            }
            pesoTotalKg = Number(pesoTotalKg.toFixed(3));

            const shiftNumeric = parseInt(shiftRaw, 10);
            const turno = [1, 2, 3].includes(shiftNumeric) ? shiftNumeric : getCurrentShift();
            const currentUser = getActiveUser();

            // ✅ NOVO: Buscar tipo de matéria prima do banco de dados
            const mpValue = selectedMachineData.mp || '';
            let tipoMateriaPrima = '';
            if (mpValue && window.materiaPrimaDatabase) {
                const materialFound = window.materiaPrimaDatabase.find(m => String(m.codigo) === String(mpValue));
                if (materialFound) {
                    tipoMateriaPrima = materialFound.descricao;
                }
            }

            const payloadBase = {
                planId,
                data: dateValue,
                turno,
                produzido: 0,
                peso_bruto: 0,
                refugo_kg: Number.isFinite(pesoTotalKg) && pesoTotalKg > 0 ? Number(pesoTotalKg) : 0,
                refugo_qty: refugoQty,
                perdas: reasonValue,
                observacoes: observations,
                machine: selectedMachineData.machine || null,
                mp: mpValue,
                tipoMateriaPrima: tipoMateriaPrima,  // ✅ NOVO: Tipo de matéria prima do banco de dados
                product_cod: selectedMachineData.product_cod || '',
                product: selectedMachineData.product || '',
                orderId: selectedMachineData.order_id || null,
                manual: true,
                horaInformada: hourValue || null,
                registradoPor: currentUser?.username || null,
                registradoPorNome: getCurrentUserName(),
                userCod: userCod,
                nomeUsuario: nomeUsuario
            };

            await db.collection('production_entries').add({
                ...payloadBase,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Registrar no histórico do sistema
            if (typeof logSystemAction === 'function') {
                logSystemAction('perda', `Perda manual: ${payloadBase.refugo_qty || 0} peças (${payloadBase.refugo_kg || 0}kg)`, {
                    quantidade: payloadBase.refugo_qty,
                    pesoKg: payloadBase.refugo_kg,
                    maquina: selectedMachineData?.machine,
                    motivo: payloadBase.perdas,
                    turno: payloadBase.turno,
                    data: payloadBase.data
                });
            }

            closeModal('manual-losses-modal');
            
            // Salvar posição do scroll antes de atualizar
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
            
            await Promise.all([
                populateMachineSelector(),
                refreshLaunchCharts(),
                loadTodayStats(),
                loadRecentEntries(false)
            ]);
            
            // Restaurar posição do scroll após atualizações
            requestAnimationFrame(() => {
                window.scrollTo({ left: scrollLeft, top: scrollTop, behavior: 'instant' });
            });

            showNotification('✅ Perda manual registrada com sucesso!', 'success');
        } catch (error) {
            console.error('Erro ao registrar perda:', error);
            showNotification('❌ Erro ao registrar perda: ' + error.message, 'error');
        }
    }
    
    // Helper: Converte string com vírgula ou ponto em número, normalizando para locale pt-BR
    function parseNumberPtBR(str) {
        if (!str) return 0;
        str = String(str).trim();
        // Remover espaços
        str = str.replace(/\s/g, '');
        // Se tem ambos vírgula e ponto, considerar o último como separador decimal
        const lastComma = str.lastIndexOf(',');
        const lastDot = str.lastIndexOf('.');
        let normalized = str;
        
        if (lastComma > lastDot) {
            // Vírgula é o separador decimal: "1.234,56" → "1234.56"
            normalized = str.replace(/\./g, '').replace(',', '.');
        } else if (lastDot > lastComma) {
            // Ponto é o separador decimal: "1,234.56" ou "1.23" → mantém "1.23"
            normalized = str.replace(/,/g, '');
        } else if (lastComma >= 0) {
            // Só tem vírgula: "1,50" → "1.50"
            normalized = str.replace(',', '.');
        }
        // Caso contrário (só números ou só ponto): mantém como está
        
        const result = parseFloat(normalized) || 0;
        console.log(`[TRACE][parseNumberPtBR] Input: "${str}" → Normalized: "${normalized}" → Result: ${result}`);
        return result;
    }

    async function handleLossesSubmit(e) {
        e.preventDefault();
        
        // ✅ POKA-YOKE: Bloquear lançamento se OP não estiver ativada
        if (!validateOrderActivated()) {
            return;
        }

        // ✅ POKA-YOKE: Bloquear lançamento se ciclo/cavidades não foram informados
        if (!validateCycleCavityLaunched()) {
            return;
        }
        
        // Verificar permissão
        if (!window.authSystem.checkPermissionForAction('add_losses')) {
            return;
        }
        
        console.log('[TRACE][handleLossesSubmit] triggered', {
            selectedMachineData,
            currentEditContext
        });

        const quantityInput = document.getElementById('quick-losses-qty');
        const weightInput = document.getElementById('quick-losses-weight');
        const quantity = parseInt(quantityInput.value, 10) || 0;
        // Entrada agora é em GRAMAS diretamente (não mais em kg)
        let weightGrams = parseInt(weightInput.value, 10) || 0;
        const reason = document.getElementById('quick-losses-reason').value;
        const obs = (document.getElementById('quick-losses-obs').value || '').trim();
        
        // ✅ POKA-YOKE: Operador obrigatório
        const userInput = document.getElementById('quick-losses-user');
        const userCod = userInput ? parseInt(userInput.value, 10) : null;
        if (userCod === null || isNaN(userCod) || userInput.value === '') {
            alert('⚠️ Operador obrigatório!\n\nPor favor, digite o código do operador responsável.');
            if (userInput) userInput.focus({ preventScroll: true });
            return;
        }
        const userData = getUserByCode ? getUserByCode(userCod) : null;
        if (!userData) {
            alert('⚠️ Código inválido!\n\nO código digitado não foi encontrado no sistema.\nVerifique e tente novamente.');
            if (userInput) userInput.focus({ preventScroll: true });
            return;
        }
        const nomeUsuario = userData.nomeUsuario;
        
        // Verificar se deve aplicar tara da caixa plástica
        const useTare = document.getElementById('quick-losses-use-tare').checked;
        if (useTare && weightGrams > 0) {
            const tareWeight = getTareWeightForMachine(selectedMachineData?.machine);
            if (tareWeight > 0) {
                weightGrams = Math.max(0, weightGrams - tareWeight);
                console.log(`[TRACE][handleLossesSubmit] Tara aplicada: ${tareWeight}g descontados. Peso líquido: ${weightGrams}g`);
            }
        }

        console.log('[TRACE][handleLossesSubmit] parsed form values', { quantity, weightGrams, reason, obs, useTare });

        if (quantity <= 0 && weightGrams <= 0) {
            alert('Informe a quantidade ou o peso da perda.');
            if (quantityInput) quantityInput.focus({ preventScroll: true });
            else if (weightInput) weightInput.focus({ preventScroll: true });
            return;
        }

        if (!reason) {
            alert('Por favor, selecione o motivo da perda.');
            return;
        }

        // ✅ POKA-YOKE: Observação obrigatória
        if (!obs || obs.length < 3) {
            alert('⚠️ Observação obrigatória!\n\nPor favor, descreva detalhes sobre a perda para garantir rastreabilidade.');
            document.getElementById('quick-losses-obs').focus({ preventScroll: true });
            return;
        }

        // ========================================
        // CONVERSÃO DE PESO PARA PEÇAS
        // ========================================
        let refugoQty = quantity > 0 ? quantity : 0;
        const pieceWeightGrams = getActivePieceWeightGrams();

        if (refugoQty <= 0 && weightGrams > 0) {
            if (pieceWeightGrams <= 0) {
                alert('Não foi possível converter peso para peças. O peso médio da peça não está configurado. Informe a quantidade diretamente.');
                console.warn('[TRACE][handleLossesSubmit] Peso médio não encontrado: selectedMachineData =', selectedMachineData);
                return;
            }
            const conversion = calculateQuantityFromGrams(weightGrams, pieceWeightGrams);
            refugoQty = conversion.quantity > 0 ? conversion.quantity : 1;
            console.log(`[TRACE][handleLossesSubmit] Conversão: ${weightGrams}g  /  ${pieceWeightGrams}g/peça = ${refugoQty} peças`);
            showNotification(`Convertido: ${weightGrams}g = ${refugoQty} peças`, 'info');
        }
        
        console.log('[TRACE][handleLossesSubmit] Perda em peças:', { quantity, weightGrams, refugoQty, pesoMedio: weightGrams > 0 ? (weightGrams / Math.max(refugoQty, 1)) : 0 });

        const isEditing = currentEditContext && currentEditContext.type === 'loss' && currentEditContext.id;
        const originalData = isEditing ? currentEditContext.original : null;

        console.log('[TRACE][handleLossesSubmit] context info', { isEditing, originalData });

        const fallbackPlan = selectedMachineData ? selectedMachineData.id : originalData?.planId;
        const planId = isEditing ? (originalData?.planId || fallbackPlan) : fallbackPlan;

        console.log('[TRACE][handleLossesSubmit] resolved plan', { fallbackPlan, planId });

        if (!planId) {
            alert('Não foi possível identificar o planejamento associado ao lançamento.');
            return;
        }

        const currentShift = getCurrentShift();
        const turno = isEditing ? (originalData?.turno || currentShift) : currentShift;
        const dataReferencia = isEditing ? (originalData?.data || getProductionDateString()) : getProductionDateString();
        const machineRef = isEditing ? (originalData?.machine || selectedMachineData?.machine) : selectedMachineData?.machine;
        const mpValue = isEditing ? (originalData?.mp || selectedMachineData?.mp || '') : (selectedMachineData?.mp || '');

        // ✅ NOVO: Buscar tipo de matéria prima do banco de dados
        let tipoMateriaPrima = '';
        if (mpValue && window.materiaPrimaDatabase) {
            const materialFound = window.materiaPrimaDatabase.find(m => String(m.codigo) === String(mpValue));
            if (materialFound) {
                tipoMateriaPrima = materialFound.descricao;
            }
        }

        // Calcular peso total se necessário (peças  x  peso médio)
        let pesoTotalKg = weightGrams > 0 ? gramsToKg(weightGrams) : 0;
        if (pesoTotalKg <= 0 && refugoQty > 0 && pieceWeightGrams > 0) {
            pesoTotalKg = (refugoQty * pieceWeightGrams) / 1000;
        }
        pesoTotalKg = Number(pesoTotalKg.toFixed(3));

        const payloadBase = {
            planId,
            data: dataReferencia,
            turno,
            produzido: 0,
            peso_bruto: 0,
            refugo_kg: pesoTotalKg,
            refugo_qty: refugoQty,  // SEMPRE em peças
            perdas: reason,
            observacoes: obs,
            machine: machineRef || null,
            mp: mpValue,
            tipoMateriaPrima: tipoMateriaPrima,  // ✅ NOVO: Tipo de matéria prima do banco de dados
            product_cod: isEditing ? (originalData?.product_cod || selectedMachineData?.product_cod || '') : (selectedMachineData?.product_cod || ''),
            product: isEditing ? (originalData?.product || selectedMachineData?.product || '') : (selectedMachineData?.product || ''),
            orderId: selectedMachineData?.order_id || null,
            orderNumber: selectedMachineData?.order_number || null,
            userCod: userCod,
            nomeUsuario: nomeUsuario
        };

        console.log('[TRACE][handleLossesSubmit] payloadBase prepared', payloadBase);

        const collectionRef = db.collection('production_entries');
        const successMessage = isEditing ? 'Perda atualizada com sucesso!' : 'Perda registrada com sucesso!';

        try {
            if (isEditing) {
                console.log('[TRACE][handleLossesSubmit] updating existing entry', currentEditContext.id);
                await collectionRef.doc(currentEditContext.id).update({
                    ...payloadBase,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            } else {
                console.log('[TRACE][handleLossesSubmit] creating new entry');
                await collectionRef.add({
                    ...payloadBase,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }

            closeModal('quick-losses-modal');
            
            // Salvar posição do scroll antes de atualizar
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
            
            await populateMachineSelector();
            
            // Atualizar selectedMachineData com os dados mais recentes
            // machineCardData agora é array - pegar primeiro plano para compatibilidade
            if (selectedMachineData && selectedMachineData.machine && machineCardData[selectedMachineData.machine]) {
                const machineDataArray = machineCardData[selectedMachineData.machine];
                selectedMachineData = Array.isArray(machineDataArray) ? machineDataArray[0] : machineDataArray;
                updateMachineInfo();
                updateQuickProductionPieceWeightUI();
            }
            
            await Promise.all([
                loadTodayStats(),
                loadHourlyProductionChart(),
                loadRecentEntries(false),
                refreshAnalysisIfActive()
            ]);
            
            // Restaurar posição do scroll após atualizações
            requestAnimationFrame(() => {
                window.scrollTo({ left: scrollLeft, top: scrollTop, behavior: 'instant' });
            });
            
            showNotification(successMessage, 'success');
            
            // Registrar log
            registrarLogSistema(isEditing ? 'EDIÇÃO DE PERDA' : 'LANÇAMENTO DE PERDA', 'perda', {
                machine: machineRef,
                refugoQty: refugoQty,
                pesoKg: pesoTotalKg,
                motivo: reason,
                observacoes: obs
            });

            console.log('[TRACE][handleLossesSubmit] success path completed');
        } catch (error) {
            console.error('Erro ao registrar perda: ', error);
            alert('Erro ao registrar perda. Tente novamente.');
        }
    }
    
    /**
     * Handler para INICIAR uma parada (nova dinâmica - motivo informado no início)
     * Coleta o motivo do modal e inicia a parada
     */
    async function handleDowntimeSubmit(e) {
        e.preventDefault();
        
        // ✅ POKA-YOKE: Bloquear lançamento se OP não estiver ativada
        if (!validateOrderActivated()) {
            return;
        }
        
        // Verificar permissão
        if (!window.authSystem.checkPermissionForAction('add_downtime')) {
            return;
        }
        
        console.log('[DOWNTIME][SUBMIT] Coletando motivo para INICIAR parada', {
            selectedMachineData,
            machineStatus
        });

        const reason = document.getElementById('quick-downtime-reason').value;
        const obs = (document.getElementById('quick-downtime-obs').value || '').trim();
        
        // ✅ POKA-YOKE: Operador obrigatório
        const userInput = document.getElementById('quick-downtime-user');
        const userCod = userInput ? parseInt(userInput.value, 10) : null;
        if (userCod === null || isNaN(userCod) || userInput.value === '') {
            alert('⚠️ Operador obrigatório!\n\nPor favor, digite o código do operador responsável.');
            if (userInput) userInput.focus({ preventScroll: true });
            return;
        }
        const userData = getUserByCode ? getUserByCode(userCod) : null;
        if (!userData) {
            alert('⚠️ Código inválido!\n\nO código digitado não foi encontrado no sistema.\nVerifique e tente novamente.');
            if (userInput) userInput.focus({ preventScroll: true });
            return;
        }
        const nomeUsuario = userData.nomeUsuario;
        
        console.log('[DOWNTIME][SUBMIT] Valores do formulário:', { reason, obs, userCod, nomeUsuario });

        if (!reason) {
            alert('Por favor, selecione o motivo da parada.');
            return;
        }

        // ✅ POKA-YOKE: Observação obrigatória
        if (!obs || obs.length < 3) {
            alert('⚠️ Observação obrigatória!\n\nPor favor, descreva detalhes sobre a parada para garantir rastreabilidade.');
            document.getElementById('quick-downtime-obs').focus({ preventScroll: true });
            return;
        }

        // Fechar o modal antes de iniciar a parada
        closeModal('quick-downtime-modal');
        
        // Iniciar a parada com o motivo informado e dados do usuário
        await startMachineDowntime(reason, obs, userCod, nomeUsuario);
        
        console.log('[DOWNTIME][SUBMIT] Parada iniciada com motivo:', reason, 'usuário:', nomeUsuario);
    }

    async function handleManualBorraSubmit(e) {
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


        if (!window.authSystem.checkPermissionForAction('add_losses')) {
            return;
        }

        if (!selectedMachineData) {
            alert('Nenhuma máquina selecionada. Selecione uma máquina para registrar a borra.');
            return;
        }

        const dateInput = document.getElementById('manual-borra-date');
        const shiftSelect = document.getElementById('manual-borra-shift');
        const hourInput = document.getElementById('manual-borra-hour');
        const machineSelect = document.getElementById('manual-borra-machine');
        const weightInput = document.getElementById('manual-borra-weight');
        const mpTypeSelect = document.getElementById('manual-borra-mp-type');
        const reasonInput = document.getElementById('manual-borra-reason');
        const obsInput = document.getElementById('manual-borra-obs');

        const dateValue = (dateInput?.value || '').trim();
        const shiftRaw = shiftSelect?.value || '';
        const hourValue = (hourInput?.value || '').trim();
    const machineValue = machineSelect?.value || '';
        // Entrada agora é em GRAMAS diretamente
        const weightGrams = parseInt(weightInput?.value || '0', 10);
        const weightKg = weightGrams / 1000; // Converter para kg para salvar
        const mpTypeValue = mpTypeSelect?.value || '';
        const reasonValue = (reasonInput?.value || '').trim();
        const observations = (obsInput?.value || '').trim();

        if (!dateValue) {
            alert('Informe a data de geração da borra.');
            if (dateInput) dateInput.focus();
            return;
        }

        if (!machineValue) {
            alert('Selecione a máquina que gerou a borra.');
            if (machineSelect) machineSelect.focus();
            return;
        }

        if (!Number.isFinite(weightGrams) || weightGrams <= 0) {
            alert('Informe o peso da borra em gramas (valor deve ser maior que zero).');
            if (weightInput) weightInput.focus();
            return;
        }

        if (!mpTypeValue) {
            alert('Selecione o tipo de matéria-prima da borra.');
            if (mpTypeSelect) mpTypeSelect.focus();
            return;
        }

        if (!reasonValue) {
            alert('Informe o motivo da geração da borra.');
            if (reasonInput) reasonInput.focus();
            return;
        }

        const statusDiv = document.getElementById('manual-borra-status');
        const submitButton = document.getElementById('manual-borra-save');

        try {
            if (statusDiv) statusDiv.textContent = 'Salvando borra...';
            if (submitButton) {
                submitButton.disabled = true;
                submitButton.textContent = 'Salvando...';
            }

            const currentUser = getActiveUser();
            const workDay = getWorkDayFromDate(dateValue, hourValue);
            const normalizedMachine = normalizeMachineId(machineValue || selectedMachineData.machine || '');
            const resolvedPlanId = selectedMachineData?.id || selectedMachineData?.planId || selectedMachineData?.planningRef || null;
            if (!resolvedPlanId) {
                console.warn('[WARN][handleManualBorraSubmit] planId não encontrado para BORRA, registro será salvo sem vínculo de plano.', {
                    selectedMachineData
                });
            }
            
            // Preparar dados da borra (salvar como perda especial)
            const borraData = {
                data: dateValue,
                workDay: workDay,
                machine: normalizedMachine,
                planId: resolvedPlanId || null,
                planningRef: resolvedPlanId || null,
                refugo_kg: weightKg, // Salvar em kg (convertido de gramas)
                perdas: `BORRA - ${reasonValue}`,
                mp: '',
                mp_type: mpTypeValue,
                turno: parseInt(shiftRaw, 10) || 1,
                horaInformada: hourValue || null,
                observacoes: observations || '',
                tipo_lancamento: 'borra', // Identificador especial
                planningRef: selectedMachineData.id,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                createdBy: currentUser.username || 'sistema',
                createdByName: currentUser.name || 'Sistema'
            };

            console.log('[TRACE][handleManualBorraSubmit] prepared borra data', borraData);

            // Salvar na coleção production_entries (como outras perdas)
            const docRef = await db.collection('production_entries').add(borraData);
            
            console.log('[TRACE][handleManualBorraSubmit] borra saved successfully', { docId: docRef.id });

            // Registrar no histórico do sistema
            if (typeof logSystemAction === 'function') {
                logSystemAction('perda', `Borra registrada: ${weightKg.toFixed(3)}kg`, {
                    pesoKg: weightKg,
                    pesoGramas: weightGrams,
                    maquina: normalizedMachine,
                    motivo: reasonValue,
                    tipoMp: mpTypeValue,
                    turno: borraData.turno,
                    data: dateValue
                });
            }

            if (statusDiv) statusDiv.textContent = 'Borra registrada com sucesso!';
            showNotification(`Borra de ${weightGrams}g (${weightKg.toFixed(3)}kg) registrada com sucesso!`, 'success');

            // Fechar modal e atualizar dados
            setTimeout(() => {
                closeModal('manual-borra-modal');
                if (typeof updateOverviewData === 'function') {
                    updateOverviewData();
                }
                if (typeof refreshRecentEntries === 'function') {
                    refreshRecentEntries();
                }
            }, 1500);

        } catch (error) {
            console.error('[ERROR][handleManualBorraSubmit] falha ao salvar borra', error);
            
            if (statusDiv) statusDiv.textContent = 'Erro ao registrar borra. Tente novamente.';
            showNotification('Erro ao registrar borra. Verifique os dados e tente novamente.', 'error');
        } finally {
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = 'Registrar Borra';
            }
        }
    }

    
    // Função para lançamento manual de parada passada
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

        if (!selectedMachineData) {
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
            const segments = window.splitDowntimeIntoDailySegments(dateStartStr, startTime, finalDateEnd, endTime);
            if (!segments.length) {
                showNotification('Não foi possível processar o período informado', 'error');
                return;
            }

            // Persistir cada segmento
            const currentUser = getActiveUser();
            for (const seg of segments) {
                // Inferir turno do segmento
                const segShift = typeof window.inferShiftFromSegment === 'function' 
                    ? window.inferShiftFromSegment(seg.date, seg.startTime, seg.endTime) 
                    : null;
                const downtimeData = {
                    machine: selectedMachineData.machine,
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

                await db.collection('downtime_entries').add(downtimeData);
            }

            // Calcular duração total para o log
            const totalDuration = segments.reduce((sum, seg) => sum + (seg.duration || 0), 0);

            // Registrar no histórico do sistema
            if (typeof logSystemAction === 'function') {
                logSystemAction('parada', `Parada manual registrada: ${reason}`, {
                    maquina: selectedMachineData?.machine,
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

    async function finishDowntime() {
        try {
            console.log('[TRACE][finishDowntime] invoked', { currentDowntimeStart, machineStatus });
            if (!currentDowntimeStart) {
                console.warn('Nenhuma parada ativa para finalizar.');
                return;
            }

            const now = new Date();
            const endTime = now.toTimeString().substr(0, 5);

            const startDateStr = currentDowntimeStart.date || window.formatDateYMD(currentDowntimeStart.startTimestamp || now);
            const endDateStr = window.formatDateYMD(now);

            const segments = window.splitDowntimeIntoDailySegments(startDateStr, currentDowntimeStart.startTime, endDateStr, endTime);
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
                await db.collection('downtime_entries').add(downtimeData);
            } else {
                // Validar motivo antes de salvar os segmentos
                if (!currentDowntimeStart.reason || currentDowntimeStart.reason.trim() === '') {
                    console.error('[DOWNTIME][FINISH] Tentativa de salvar parada sem motivo');
                    alert('⚠️ Erro: Motivo da parada não foi informado.\n\nEsta parada não pode ser finalizada sem um motivo válido.');
                    return;
                }
                const shiftValue = currentDowntimeStart.startShift || currentDowntimeStart.shift || currentDowntimeStart.turno || null;
                for (const seg of segments) {
                    // FIX: Usar turno do SEGMENTO (seg.shift) em vez do turno de início
                    // para que paradas cross-turno apareçam corretamente em cada turno
                    const segShift = seg.shift || shiftValue;
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
                    await db.collection('downtime_entries').add(downtimeData);
                }
            }
            
            // Remover parada ativa do Firebase
            try {
                const normalizedMachineForDelete = normalizeMachineId(currentDowntimeStart.machine);
                await db.collection('active_downtimes').doc(normalizedMachineForDelete).delete();
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
        
        console.log('[TRACE][handleReworkSubmit] triggered', { selectedMachineData });

        if (!selectedMachineData) {
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

        const planId = selectedMachineData?.id || null;
        if (!planId) {
            alert('Não foi possível identificar o planejamento associado a esta máquina.');
            return;
        }

        const currentShift = getCurrentShift();
        const dataReferencia = getProductionDateString();
        const currentUser = getActiveUser();

        console.log('[TRACE][handleReworkSubmit] starting rework submission');

        try {
            const machineId = selectedMachineData.machine || '';
            const shiftKey = `T${currentShift}`;
            const productionDocsMap = new Map();
            const dateFields = ['data', 'workDay'];
            const shiftVariants = [currentShift, shiftKey, String(currentShift)];

            for (const field of dateFields) {
                for (const shiftVariant of shiftVariants) {
                    try {
                        const snapshot = await db.collection('production_entries')
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

            const transactionResult = await db.runTransaction(async (transaction) => {
                const reworkRef = db.collection('rework_entries').doc();
                let totalDeducted = 0;
                let adjustedDocs = 0;

                for (const doc of productionDocs) {
                    const freshSnapshot = await transaction.get(doc.ref);
                    if (!freshSnapshot.exists) {
                        console.warn(`[TRACE][handleReworkSubmit] skipping missing production doc ${doc.id}`);
                        continue;
                    }

                    const prodData = freshSnapshot.data() || {};
                    const docShiftKey = window.normalizeShiftValue(prodData.turno);
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
                        const planRef = db.collection('planning').doc(planId);
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
                            selectedMachineData.order_id,
                            selectedMachineData.production_order_id,
                            selectedMachineData.production_order,
                            selectedMachineData.orderId
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
                            const orderRef = db.collection('production_orders').doc(linkedOrderId);
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
                    machine: selectedMachineData.machine || null,
                    mp: selectedMachineData.mp || '',
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
                machine: selectedMachineData?.machine,
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
    
    // Funções auxiliares
    function getCurrentShift(reference = new Date()) {
        const hour = reference.getHours();
        const minute = reference.getMinutes();
        
        // T1: 06:30-14:59, T2: 15:00-23:19, T3: 23:20-06:29
        if ((hour === 6 && minute >= 30) || (hour >= 7 && hour < 15)) {
            return 1; // 1º Turno
        } else if (hour >= 15 && (hour < 23 || (hour === 23 && minute < 20))) {
            return 2; // 2º Turno
        } else {
            return 3; // 3º Turno
        }
    }

    function getShiftStartDateTime(reference = new Date()) {
        const shift = getCurrentShift(reference);
        const productionDay = getProductionDateString(reference);
        const shiftStartMap = {
            1: '07:00',
            2: '15:00',
            3: '23:20'
        };
        const startTime = shiftStartMap[shift] || '07:00';
        const startDate = window.combineDateAndTime(productionDay, startTime);
        if (startDate instanceof Date && !Number.isNaN(startDate.getTime())) {
            return startDate;
        }
        return null;
    }
    
    function updateMachineStatus() {
        // Notificação Web Push se máquina parada > 10 minutos
        if (machineStatus === 'stopped' && currentDowntimeStart) {
            const now = new Date();
            const startDateTime = window.combineDateAndTime(currentDowntimeStart.date, currentDowntimeStart.startTime);
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
                const startDateTime = window.combineDateAndTime(currentDowntimeStart.date, currentDowntimeStart.startTime);
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
        
        lucide.createIcons();
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
                start = window.parseDateTime(currentDowntimeStart.date, currentDowntimeStart.startTime);
            }
            // Prioridade 4: Fallback para combineDateAndTime
            else {
                start = window.combineDateAndTime(currentDowntimeStart.date, currentDowntimeStart.startTime);
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
                const combined = window.combineDateAndTime(dateStr, timeStr);
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
                const combined = window.combineDateAndTime(dateStr, timeStr);
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
            lucide.createIcons();
        }
    }

    async function loadRecentEntries(showLoading = true, filterDate = null) {
        if (!recentEntriesList) return;

        if (showLoading) {
            setRecentEntriesState({ loading: true, empty: false });
        }

        if (!selectedMachineData) {
            recentEntriesCache = new Map();
            if (recentEntriesList) recentEntriesList.innerHTML = '';
            updateRecentEntriesEmptyMessage('Selecione uma máquina para visualizar os lançamentos.');
            setRecentEntriesState({ loading: false, empty: true });
            return;
        }

        try {
            const date = filterDate || window.lancamentoFilterDate || getProductionDateString();
            const planId = selectedMachineData.id;

            const productionSnapshot = await db.collection('production_entries')
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
            const machineId = normalizeMachineId(selectedMachineData.machine || '');
            if (machineId) {
                const machineSnapshot = await db.collection('production_entries')
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

            const downtimeSnapshot = await db.collection('downtime_entries')
                .where('machine', '==', selectedMachineData.machine)
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

            const reworkSnapshot = await db.collection('rework_entries')
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
        const machineToSearch = filterMachine || (selectedMachineData ? selectedMachineData.machine : null);
        
        if (!machineToSearch) {
            updateRecentEntriesEmptyMessage('Selecione uma máquina para visualizar os lançamentos.');
            setRecentEntriesState({ loading: false, empty: true });
            return;
        }
        
        try {
            const entries = [];
            recentEntriesCache = new Map();
            
            // Buscar lançamentos de produção pela máquina
            const productionSnapshot = await db.collection('production_entries')
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
            const downtimeSnapshot = await db.collection('downtime_entries')
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
            const reworkSnapshot = await db.collection('rework_entries')
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

    function showNotification(message, type = 'info') {
        console.log('🔔 Mostrando notificação:', { message, type });
        // Criar notificação toast
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg ${
            type === 'success' ? 'bg-green-100 text-green-800 border-green-200' :
            type === 'warning' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
            type === 'error' ? 'bg-red-100 text-red-800 border-red-200' :
            'bg-blue-100 text-blue-800 border-blue-200'
        } border`;
        
        notification.innerHTML = `
            <div class="flex items-center gap-2">
                <i data-lucide="${
                    type === 'success' ? 'check-circle' :
                    type === 'warning' ? 'alert-triangle' :
                    type === 'error' ? 'x-circle' : 'info'
                }" class="w-5 h-5"></i>
                <span>${message}</span>
            </div>
        `;
        
        document.body.appendChild(notification);
        lucide.createIcons();
        
        // Remover após 3 segundos
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
    }
    
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

    function isPlanActive(plan) {
        if (!plan) return false;
        const status = String(plan.status || '').toLowerCase();
        const inactiveStatuses = ['concluida', 'concluido', 'finalizada', 'finalizado', 'cancelada', 'cancelado', 'encerrada', 'encerrado'];
        if (status && inactiveStatuses.includes(status)) {
            return false;
        }
        // Não esconder automaticamente quando atingir a meta.
        // O card só deve sair quando for explicitamente finalizado (status atualizado para concluída).
        return true;
    }

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
        const sortedMachines = [...machineDatabase].sort((a, b) => 
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
        const validMachineIds = new Set(machineDatabase.map(m => normalizeMachineId(m.id)));

        // NOVO: Mostrar TODAS as máquinas (planejadas + paradas + inativas)
        // Filtrar APENAS máquinas que existem no machineDatabase (evita contagem incorreta)
        const allMachineIds = new Set();
        
        // Adicionar máquinas com planejamento (somente se existir no machineDatabase)
        activePlans.forEach(plan => {
            if (plan && plan.machine) {
                const mid = normalizeMachineId(plan.machine);
                if (validMachineIds.has(mid)) {
                    allMachineIds.add(mid);
                } else {
                    console.warn(`[renderMachineCards] Máquina "${plan.machine}" do planejamento não existe no machineDatabase`);
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
        
        // Se nenhuma máquina, mostrar todas do machineDatabase
        if (allMachineIds.size === 0) {
            machineDatabase.forEach(m => {
                allMachineIds.add(normalizeMachineId(m.id));
            });
        }

        machineCardData = {};
        window.machineCardData = machineCardData;
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
            const turno = window.normalizeShiftValue(entry.turno);
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

    const oeeSummary = combinedEntries.length > 0 ? window.calculateRealTimeOEE?.(combinedEntries) : null;
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
        const progressPalette = window.resolveProgressPalette(progressPercentRaw);
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
                        <span class="font-medium">${window.formatShiftLabel(currentShiftKey)}</span>
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
        const machineHasPlans = selectedMachineData && selectedMachineData.machine && 
            machineCardData[selectedMachineData.machine] && 
            machineCardData[selectedMachineData.machine].length > 0;
        if (machineHasPlans) {
            setActiveMachineCard(selectedMachineData.machine);
        } else {
            selectedMachineData = null;
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
        const secondaryColor = window.hexWithAlpha(primaryColor, 0.18);

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
            const planSnapshot = await db.collection('planning').where('date', '==', today).get();
            let plans = planSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // OTIMIZAÇÃO FIREBASE: Carregar todas as OPs do cache em vez de N+1 queries individuais
            // Antes: cada plano fazia 1-3 leituras individuais (doc.get, query part_code, query production_entries)
            // Agora: 1 leitura bulk (cached) + lookups em memória
            const allCachedOrders = await getProductionOrdersCached();
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
            const todayProdEntries = await getProductionEntriesCached(today);
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
                const productionSnapshot = await db.collection('production_entries').where('data', '==', today).get();
                const planIdSet = new Set(activePlans.map(plan => plan.id));
                productionEntries = productionSnapshot.docs
                    .map(doc => ({ id: doc.id, ...doc.data() }))
                    .filter(entry => planIdSet.has(entry.planId));

                // Paradas do dia (inclui dia anterior para cobrir T3 após 00:00)
                const base = new Date(`${today}T12:00:00`);
                const prev = new Date(base); prev.setDate(prev.getDate() - 1);
                const prevStr = new Date(prev.getTime() - prev.getTimezoneOffset()*60000).toISOString().split('T')[0];
                const dtSnapshot = await db.collection('downtime_entries')
                    .where('date', 'in', [prevStr, today])
                    .get();
                const machineSet = new Set(activePlans.map(p => p.machine));
                downtimeEntries = dtSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
                    .filter(dt => machineSet.has(dt.machine));
            }

            // Buscar paradas ativas para colorir cards de vermelho
            // IMPORTANTE: Filtrar apenas máquinas válidas do machineDatabase
            const validMachineIdsSet = new Set(machineDatabase.map(m => normalizeMachineId(m.id)));
            let activeDowntimeSet = new Set();
            try {
                // OTIMIZADO: usa cache global ao invés de leitura direta
                const activeData = await getActiveDowntimesCached();
                const validDowntimeIds = activeData
                    // FIX: Aceitar paradas onde isActive NÃO seja explicitamente false
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
                        return true;
                    });
                activeDowntimeSet = new Set(validDowntimeIds);
            } catch (e) {
                console.warn('Erro ao buscar paradas ativas:', e);
            }
            // NOTA: NÃO deletar docs automaticamente — era causa de sumiço de paradas

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
        const previousMachine = selectedMachineData ? selectedMachineData.machine : null;
        // machineCardData agora é array - pegar primeiro plano para compatibilidade
        const machineDataArray = machineCardData[machine];
        const machineData = Array.isArray(machineDataArray) ? machineDataArray[0] : (machineDataArray || machineSelector?.machineData?.[machine]);

        if (!machine || !machineData) {
            productionControlPanel.classList.add('hidden');
            selectedMachineData = null;
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
        
        selectedMachineData = machineData;
        if (machineSelector) {
            machineSelector.value = machine;
        }
        setActiveMachineCard(machine);
        updateQuickProductionPieceWeightUI({ forceUpdateInput: true });
        
        // Carregar estado persistente da tara
        loadTareStateForAllForms(selectedMachineData.machine);
        
        // Atualizar informações de tara nos formulários
        updateTareDisplay('quick', document.getElementById('quick-production-use-tare')?.checked || false);
        updateTareDisplay('manual', document.getElementById('manual-production-use-tare')?.checked || false);
        updateTareDisplay('losses', document.getElementById('quick-losses-use-tare')?.checked || false);

        if (previousMachine !== selectedMachineData.machine) {
            resetProductionTimer();
        }
        
        // Atualizar informações da máquina
        if (machineIcon) machineIcon.textContent = machine;
        if (machineName) machineName.textContent = `Máquina ${machine}`;
        if (productName) productName.textContent = selectedMachineData.product || 'Produto não definido';
        if (productMp) {
            productMp.textContent = selectedMachineData.mp ? `MP: ${selectedMachineData.mp}` : 'Matéria-prima não definida';
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
        if (!selectedMachineData || !hourlyProductionChart) return;

        currentActiveOrder = null;
        currentOrderProgress = { executed: 0, planned: 0, expected: 0 };

        try {
            const today = getProductionDateString();
            // 1) Recuperar todos os lançamentos de produção da MÁQUINA no dia atual
            //    (filtraremos em memória pelos planos do MESMO PRODUTO)
            const productionSnapshot = await db.collection('production_entries')
                .where('data', '==', today)
                .where('machine', '==', selectedMachineData.machine)
                .get();

            const hourlyData = {};
            for (let i = 7; i < 31; i++) {
                const hour = i >= 24 ? i - 24 : i;
                const hourStr = `${String(hour).padStart(2, '0')}:00`;
                hourlyData[hourStr] = { planned: 0, actual: 0 };
            }

            const partCode = selectedMachineData.product_cod || selectedMachineData.product_code;
            let matchedOrder = null;
            let lotSize = Number(selectedMachineData.planned_quantity) || 0;

            // 2) Identificar todos os planos de HOJE para esta máquina e MESMO PRODUTO
            //    para consolidar entre trocas de OP do mesmo produto
            let relevantPlans = [];
            try {
                const planSnap = await db.collection('planning')
                    .where('date', '==', today)
                    .where('machine', '==', selectedMachineData.machine)
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
            if (selectedMachineData.order_id) {
                try {
                    const doc = await db.collection('production_orders').doc(selectedMachineData.order_id).get();
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
                    const lotsSnapshot = await db.collection('production_orders')
                        .where('part_code', '==', String(partCode))
                        .get();

                    if (!lotsSnapshot.empty) {
                        const orderDocs = lotsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                        const toNum = (v) => { const n = parseInt(String(v||'').replace(/\D/g,''), 10); return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY; };
                        const isOpen = (o) => !['concluida','cancelada','finalizada','encerrada'].includes(String(o.status||'').toLowerCase());
                        const sameMachine = orderDocs.filter(o => (o.machine_id || o.machine) === selectedMachineData.machine);
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
                dailyTarget = Number(selectedMachineData.planned_quantity) || Number(selectedMachineData.daily_target) || 0;
            }
            const hourlyTarget = window.HOURS_IN_PRODUCTION_DAY > 0 ? (dailyTarget / window.HOURS_IN_PRODUCTION_DAY) : 0;

            Object.keys(hourlyData).forEach(hour => {
                hourlyData[hour].planned = hourlyTarget;
            });

            // 4) Somar EXECUTADO por hora somente para lançamentos pertencentes aos planos do mesmo produto
            const relevantPlanIdSet = new Set((relevantPlans || []).map(p => p.id));
            // Se não encontramos planos relevantes (edge), considerar ao menos o plano atual como elegível
            if (relevantPlanIdSet.size === 0 && selectedMachineData.id) {
                relevantPlanIdSet.add(selectedMachineData.id);
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
            const hoursElapsed = window.getHoursElapsedInProductionDay(new Date());
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
        if (!selectedMachineData) return;
        
        try {
            const today = filterDate || window.lancamentoFilterDate || getProductionDateString();
            // Janela do dia de produção atual: [hoje 07:00, amanhã 07:00)
            const windowStart = window.combineDateAndTime(today, '07:00');
            const nextDay = new Date(windowStart);
            nextDay.setDate(nextDay.getDate() + 1);
            const tomorrow = nextDay.toISOString().split('T')[0];
            const windowEnd = window.combineDateAndTime(tomorrow, '07:00');
            
            // Buscar dados de produção
            const prodSnapshot = await db.collection('production_entries')
                .where('machine', '==', selectedMachineData.machine)
                .where('data', '==', today)
                .get();
            
            const productions = prodSnapshot.docs.map(doc => doc.data());
            
                        // Buscar paradas de hoje e de amanhã (duas consultas simples)
                        // OTIMIZAÇÃO FIREBASE: Usar 1 query com 'in' em vez de 2 queries separadas
                        const dtSnapshot = await db.collection('downtime_entries')
                                    .where('machine', '==', selectedMachineData.machine)
                                    .where('date', 'in', [today, tomorrow])
                                    .get();
                        const downtimes = dtSnapshot.docs.map(doc => doc.data());
            
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
                const start = window.combineDateAndTime(dt.date, dt.startTime);
                const end = window.combineDateAndTime(dt.date, dt.endTime);
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
            const dailyTarget = Number(selectedMachineData.daily_target || selectedMachineData.planned_quantity || 0);
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
            const activeDowntime = (machineStatus === 'stopped' && currentDowntimeStart && currentDowntimeStart.machine === selectedMachineData.machine)
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

    function populateQuickFormOptions() {
        // Popular motivos de perda (usa database.js via getGroupedLossReasons)
        populateLossReasonsSelect('quick-losses-reason');
        
        // Popular motivos de parada
        const downtimeReasonSelect = document.getElementById('quick-downtime-reason');
        if (downtimeReasonSelect) {
            downtimeReasonSelect.innerHTML = '<option value="">Selecione o motivo...</option>';
            
            // Usar motivos do database.js ou fallback
            const downtimeReasons = window.getGroupedDowntimeReasons();
            
            Object.entries(downtimeReasons).forEach(([groupName, reasons]) => {
                const group = document.createElement('optgroup');
                group.label = groupName;
                reasons.forEach(reason => {
                    const option = document.createElement('option');
                    option.value = reason;
                    option.textContent = reason;
                    group.appendChild(option);
                });
                downtimeReasonSelect.appendChild(group);
            });
        }

        // Também popular o select de paradas manuais
        const manualDowntimeReasonSelect = document.getElementById('manual-downtime-reason');
        if (manualDowntimeReasonSelect) {
            manualDowntimeReasonSelect.innerHTML = '<option value="">Selecione o motivo...</option>';
            
            // Usar motivos do database.js ou fallback
            const downtimeReasons = window.getGroupedDowntimeReasons();
            
            Object.entries(downtimeReasons).forEach(([groupName, reasons]) => {
                const group = document.createElement('optgroup');
                group.label = groupName;
                reasons.forEach(reason => {
                    const option = document.createElement('option');
                    option.value = reason;
                    option.textContent = reason;
                    group.appendChild(option);
                });
                manualDowntimeReasonSelect.appendChild(group);
            });
        }
    }

    // ================================
    // NOVO: Função para buscar paradas ativas por máquina
    // ================================
    async function getActiveMachineDowntime(machineId) {
        try {
            if (!window.db) return null;
            
            const normalizedId = normalizeMachineId(machineId);
            const now = new Date();
            const todayStr = now.toISOString().split('T')[0];  // YYYY-MM-DD
            
            // PRIORIDADE 1: Buscar paradas em "active_downtimes" (paradas iniciadas via "Parar Máquina")
            const activeDowntimeRef = window.db.collection('active_downtimes').doc(normalizedId);
            const activeDowntimeSnap = await activeDowntimeRef.get();
            
            if (activeDowntimeSnap.exists) {
                const data = activeDowntimeSnap.data();
                if (data && data.isActive) {
                    // Log removido - estava poluindo o console a cada polling
                    return {
                        recordId: normalizedId, // Usar ID da máquina como recordId para paradas em active_downtimes
                        type: 'active_downtime_live',
                        reason: data.reason || 'Parada ativa',
                        startDate: data.startDate,
                        endDate: null,
                        status: 'active',
                        durationMinutes: data.durationMinutes
                    };
                }
            }
            
            // Paradas longas (extended_downtime_logs) removidas - Unificação 02/2026
            
            return null;
        } catch (error) {
            console.warn('[MACHINE-DOWNTIME] Erro ao buscar paradas:', error);
            return null;
        }
    }

    // ========== CACHE PARA DOWNTIME STATUS ==========
    // Evita múltiplas leituras Firebase para cada máquina
    let _downtimeStatusCache = null;
    let _downtimeStatusCacheTimestamp = 0;
    const DOWNTIME_CACHE_TTL = 120000; // 120 segundos - alinhado com intervalo de polling (otimizado)

    // NOVO: Função para invalidar todos os caches de downtime
    function invalidateDowntimeCache(machineId = null) {
        console.log('[CACHE] Invalidando cache de downtime', machineId ? `para ${machineId}` : '(completo)');
        
        // Invalidar cache interno
        _downtimeStatusCache = null;
        _downtimeStatusCacheTimestamp = 0;
        
        // Invalidar cache global
        if (machineId) {
            const mid = normalizeMachineId(machineId);
            if (window.downtimeStatusCache) delete window.downtimeStatusCache[mid];
            if (downtimeStatusCache) delete downtimeStatusCache[mid];
        } else {
            window.downtimeStatusCache = {};
            if (typeof downtimeStatusCache !== 'undefined') downtimeStatusCache = {};
        }
        
        // Invalidar DataStore cache
        if (window.DataStore) {
            window.DataStore.invalidate('activeDowntimes');
        }
    }
    
    // Expor globalmente para uso em outros módulos
    window.invalidateDowntimeCache = invalidateDowntimeCache;

    // OTIMIZADO: Função para buscar status de todas as máquinas com cache
    async function getAllMachinesDowntimeStatus(forceRefresh = false) {
        // Verificar cache
        const now = Date.now();
        if (!forceRefresh && _downtimeStatusCache && (now - _downtimeStatusCacheTimestamp) < DOWNTIME_CACHE_TTL) {
            // Usar cache - economia de leituras
            return _downtimeStatusCache;
        }
        
        const statusMap = {};
        const staleDocIds = []; // docs órfãos para auto-limpeza
        
        try {
            // Máquinas válidas do machineDatabase
            const validMachineIdsSet = new Set(machineDatabase.map(m => normalizeMachineId(m.id)));

            // OTIMIZAÇÃO FIREBASE: Usar funções cached em vez de leituras diretas
            // Antes: 2 leituras diretas ao Firebase (active_downtimes.get() + extended_downtime_logs query)
            // Agora: Reutiliza dados do DataStore/cache (getActiveDowntimesCached + getExtendedDowntimesCached)
            
            // 1. Buscar paradas ativas via cache (compartilha cache com pollActiveDowntimes)
            const activeDowntimesList = await getActiveDowntimesCached(forceRefresh);
            activeDowntimesList.forEach(data => {
                const mid = normalizeMachineId(data.id);
                
                // FIX: Aceitar paradas onde isActive NÃO seja explicitamente false
                if (!data || data.isActive === false) {
                    console.debug(`[MACHINE-STATUS] Parada ${data?.id} com isActive=false, ignorando`);
                    return;
                }
                
                // Ignorar se máquina não existe no database (sem deletar)
                if (!validMachineIdsSet.has(mid)) {
                    console.warn(`[MACHINE-STATUS] Máquina "${data.id}" não existe no machineDatabase — ignorando`);
                    return;
                }
                
                statusMap[mid] = {
                    recordId: mid,
                    type: 'active_downtime_live',
                    reason: data.reason || 'Parada ativa',
                    startDate: data.startDate,
                    endDate: null,
                    status: 'active',
                    durationMinutes: data.durationMinutes
                };
            });
            
            // 2. Buscar extended_downtime_logs ativos via cache
            try {
                const extendedList = await getExtendedDowntimesCached(forceRefresh, true);
                    
                extendedList.forEach(data => {
                    const machineId = data.machine_id || data.machine;
                    if (machineId) {
                        const mid = normalizeMachineId(machineId);
                        // Não sobrescrever se já existe em active_downtimes (prioridade)
                        if (!statusMap[mid]) {
                            // Ignorar se máquina não existe no database
                            if (!validMachineIdsSet.has(mid)) return;
                            
                            statusMap[mid] = {
                                recordId: data.id,
                                type: 'extended_downtime',
                                reason: data.reason || data.type || 'Parada registrada',
                                startDate: data.start_date || data.date,
                                endDate: null,
                                status: 'active',
                                durationMinutes: null,
                                category: data.category
                            };
                        }
                    }
                });
                console.debug('[MACHINE-STATUS] extended_downtime_logs ativos:', extendedList.length);
            } catch (extendedError) {
                console.warn('[MACHINE-STATUS] Erro ao buscar extended_downtime_logs:', extendedError);
            }
            
            // NOTA: Auto-limpeza REMOVIDA — era causa de sumiço de paradas ativas
            // Apenas logar docs potencialmente órfãos para monitoramento
            if (staleDocIds.length > 0) {
                console.debug(`[MACHINE-STATUS] Docs potencialmente órfãos (NÃO deletados):`, staleDocIds.map(d => `${d.collection}/${d.id}`));
            }
            
            // Atualizar cache
            _downtimeStatusCache = statusMap;
            _downtimeStatusCacheTimestamp = now;
            
        } catch (error) {
            console.error('[MACHINE-STATUS] Erro ao carregar status:', error);
        }
        
        return statusMap;
    }

    // ================================
    // NOVO: Variáveis globais do downtime
    // ================================
    // Armazenar timers de paradas
    const downtimeTimers = new Map();
    
    // Cache de status de paradas (inicializado em renderMachineCards)
    let downtimeStatusCache = {};

    // ============================================================
    // FINALIZAR PARADA - Encerra parada ativa
    // ============================================================
    async function finalizarParada(recordId, machineId) {
        console.log('[FINALIZAR-PARADA] Solicitação de finalização:', { recordId, machineId });
        
        if (!recordId || !machineId) {
            console.error('[FINALIZAR-PARADA] IDs inválidos');
            return;
        }

        try {
            const normalizedMachineId = normalizeMachineId(machineId);
            const now = new Date();
            
            // Verificar se é uma parada em "active_downtimes" (parada iniciada via "Parar Máquina")
            const isActiveDowttimeRecord = recordId === normalizedMachineId;
            
            let downtimeData = null;
            let recordSnapshot = null;
            
            if (isActiveDowttimeRecord) {
                // CASO 1: Parada em "active_downtimes"
                recordSnapshot = await db.collection('active_downtimes').doc(recordId).get();
                if (!recordSnapshot.exists) {
                    showNotification('Registro de parada não encontrado', 'error');
                    return;
                }
                downtimeData = recordSnapshot.data();
            } else {
                // CASO 2: Parada em "extended_downtime_logs"
                recordSnapshot = await db.collection('extended_downtime_logs').doc(recordId).get();
                if (!recordSnapshot.exists) {
                    showNotification('Registro de parada não encontrado', 'error');
                    return;
                }
                downtimeData = recordSnapshot.data();
            }
            
            console.log('[FINALIZAR-PARADA] Dados do registro:', downtimeData);
            
            // Calcular duração prévia para mostrar no alerta
            let startDatetime = null;
            
            // Tentar diferentes formas de obter a data de início
            if (isActiveDowttimeRecord) {
                // Para paradas em active_downtimes
                if (downtimeData.startTimestamp) {
                    startDatetime = downtimeData.startTimestamp.toDate?.() || new Date(downtimeData.startTimestamp);
                } else if (downtimeData.startTimestampLocal) {
                    startDatetime = new Date(downtimeData.startTimestampLocal);
                } else if (downtimeData.startDate && downtimeData.startTime) {
                    startDatetime = new Date(downtimeData.startDate + 'T' + downtimeData.startTime);
                }
            } else {
                // Para paradas em extended_downtime_logs
                if (downtimeData.start_datetime) {
                    startDatetime = downtimeData.start_datetime.toDate?.() || new Date(downtimeData.start_datetime);
                } else if (downtimeData.start_date && downtimeData.start_time) {
                    startDatetime = new Date(downtimeData.start_date + 'T' + downtimeData.start_time);
                } else if (downtimeData.createdAt) {
                    startDatetime = downtimeData.createdAt.toDate?.() || new Date(downtimeData.createdAt);
                }
            }
            
            // Validar se a data é válida
            if (!startDatetime || isNaN(startDatetime.getTime())) {
                startDatetime = new Date(now.getTime() - 60 * 60 * 1000); // Fallback: 1 hora atrás
            }
            
            const durationMinutes = Math.max(0, Math.floor((now - startDatetime) / (1000 * 60)));
            const hours = Math.floor(durationMinutes / 60);
            const mins = durationMinutes % 60;
            const durationText = hours > 0 ? `${hours}h ${mins}min` : `${mins}min`;
            
            // Tipo/Motivo da parada - VALIDAÇÃO OBRIGATÓRIA
            const reasonText = downtimeData.reason || downtimeData.type || '';
            
            // Não permitir finalizar parada sem motivo válido
            if (!reasonText || reasonText.trim() === '' || reasonText.toLowerCase() === 'não informado') {
                console.error('[FINALIZAR-PARADA] Parada sem motivo válido');
                alert('⚠️ Erro: Esta parada não possui um motivo válido registrado.\n\nNão é possível finalizá-la sem um motivo.\nPor favor, edite a parada para adicionar o motivo antes de finalizar.');
                showNotification('Parada sem motivo válido', 'error');
                return;
            }
            
            const startDateStr = isActiveDowttimeRecord 
                ? (downtimeData.startDate || '?') 
                : (downtimeData.start_date || '?');
            const startTimeStr = isActiveDowttimeRecord 
                ? (downtimeData.startTime || '?') 
                : (downtimeData.start_time || '?');
            const startText = `${startDateStr} às ${startTimeStr}`;
            
            // 2. ALERTA DE CONFIRMAÇÃO
            const confirmMessage = `⚠️ FINALIZAR PARADA LONGA?\n\n` +
                `🏭 Máquina: ${normalizedMachineId}\n` +
                `📋 Motivo: ${reasonText}\n` +
                `🕐 Início: ${startText}\n` +
                `⏱️ Duração: ${durationText}\n\n` +
                `Deseja realmente finalizar esta parada?`;
            
            if (!confirm(confirmMessage)) {
                console.log('[FINALIZAR-PARADA] Usuário cancelou a finalização');
                showNotification('Finalização cancelada', 'info');
                return;
            }
            
            // 3. Usuário confirmou - prosseguir com finalização
            console.log('[FINALIZAR-PARADA] Usuário confirmou - encerrando parada');
            
            const endDate = now.toISOString().split('T')[0];  // YYYY-MM-DD
            const endTime = now.toTimeString().split(' ')[0].substring(0, 5);  // HH:MM

            // 4. Atualizar registro: marcar como inativo/finalizado
            if (isActiveDowttimeRecord) {
                // Para paradas em active_downtimes: registrar histórico e depois deletar
                
                // Obter turno fallback da parada
                const shiftFallback = downtimeData.startShift || downtimeData.shift || downtimeData.turno || null;
                
                // FIX: Dividir parada em segmentos por turno para correta exibição cross-turno
                const segments = window.splitDowntimeIntoShiftSegments(startDateStr, startTimeStr, endDate, endTime);
                
                if (segments && segments.length > 0) {
                    for (const seg of segments) {
                        const segShift = seg.shift || shiftFallback;
                        const downtimeEntryData = {
                            machine: normalizedMachineId,
                            date: seg.date,
                            startTime: seg.startTime,
                            endTime: seg.endTime,
                            duration: seg.duration,
                            reason: reasonText,
                            shift: segShift,
                            turno: segShift,
                            observations: downtimeData.observations || '',
                            batchDowntime: downtimeData.batchDowntime || false,
                            registradoPor: getActiveUser()?.username || null,
                            registradoPorNome: getActiveUser()?.name || 'Sistema',
                            createdAt: firebase.firestore.FieldValue.serverTimestamp()
                        };
                        await db.collection('downtime_entries').add(downtimeEntryData);
                        console.log('[FINALIZAR-PARADA] Segmento registrado em downtime_entries:', downtimeEntryData);
                    }
                } else {
                    // Fallback: se splitDowntimeIntoShiftSegments não retornar segmentos, salvar registro único
                    const downtimeEntryData = {
                        machine: normalizedMachineId,
                        date: startDateStr,
                        startTime: startTimeStr,
                        endTime: endTime,
                        duration: durationMinutes,
                        reason: reasonText,
                        shift: shiftFallback,
                        turno: shiftFallback,
                        observations: downtimeData.observations || '',
                        batchDowntime: downtimeData.batchDowntime || false,
                        registradoPor: getActiveUser()?.username || null,
                        registradoPorNome: getActiveUser()?.name || 'Sistema',
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    };
                    await db.collection('downtime_entries').add(downtimeEntryData);
                    console.log('[FINALIZAR-PARADA] Registrado (fallback) em downtime_entries:', downtimeEntryData);
                }
                
                // Depois, deletar o documento de active_downtimes (o padrão do sistema é deletar, não atualizar)
                await db.collection('active_downtimes').doc(recordId).delete();
                console.log('[FINALIZAR-PARADA] Documento active_downtimes deletado:', recordId);
            } else {
                // Para paradas em extended_downtime_logs: atualizar status
                const updateData = {
                    end_date: endDate,
                    end_time: endTime,
                    end_datetime: firebase.firestore.Timestamp.fromDate(now),
                    duration_minutes: durationMinutes,
                    status: 'inactive',  // Muda de 'active' para 'inactive'
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                };
                
                // Adicionar usuário apenas se existir
                const activeUser = getActiveUser();
                if (activeUser && activeUser.name) {
                    updateData.updatedBy = activeUser.name;
                }
                
                await db.collection('extended_downtime_logs').doc(recordId).update(updateData);
            }

            console.log('[FINALIZAR-PARADA] Registrado como finalizado:', { 
                recordId, 
                machineId: normalizedMachineId, 
                durationMinutes: `${hours}h ${mins}m`
            });

            // 5. Limpar TODOS os caches de downtime
            const mid = normalizedMachineId;
            
            // CORRIGIDO: Usar função centralizada para invalidar todos os caches
            invalidateDowntimeCache(mid);

            // Limpar timer de cronômetro
            if (window.downtimeTimers && window.downtimeTimers.has(mid)) {
                clearInterval(window.downtimeTimers.get(mid));
                window.downtimeTimers.delete(mid);
            }

            // 6. Mostrar notificação de sucesso
            showNotification(
                `✅ Parada finalizada para ${mid} após ${durationText}`,
                'success'
            );

            // 7. Re-renderizar painel de máquinas (recarrega todos os dados)
            if (typeof populateMachineSelector === 'function') {
                console.log('[FINALIZAR-PARADA] Recarregando painel de máquinas...');
                await populateMachineSelector();
            }

            // 8. Recarregar lista de paradas (se tab está aberta — delegado ao controller)
            if (typeof window.loadExtendedDowntimeList === 'function') {
                await window.loadExtendedDowntimeList();
            }

        } catch (error) {
            console.error('[FINALIZAR-PARADA] Erro completo:', error);
            console.error('[FINALIZAR-PARADA] Stack:', error.stack);
            showNotification(`Erro ao finalizar parada: ${error.message}`, 'error');
        }
    }

    // NOVO: Função auxiliar para obter cor do badge baseado no tipo
    function getDowntimeTypeColor(type) {
        const colors = {
            'maintenance': 'bg-blue-100 text-blue-800',
            'preventive': 'bg-blue-100 text-blue-800',
            'maintenance_planned': 'bg-blue-100 text-blue-800',
            'no_order': 'bg-red-100 text-red-800',
            'commercial': 'bg-amber-100 text-amber-800',
            'weekend': 'bg-gray-100 text-gray-800',
            'holiday': 'bg-purple-100 text-purple-800',
            'setup': 'bg-green-100 text-green-800',
            'other': 'bg-gray-100 text-gray-800'
        };
        return colors[type] || 'bg-gray-100 text-gray-800';
    }

    // NOVO: Função auxiliar para obter rótulo do tipo
    function getDowntimeTypeLabel(type) {
        const labels = {
            'maintenance': 'Manutenção Preventiva',
            'preventive': 'Manutenção Preventiva',
            'maintenance_planned': 'Manutenção Programada',
            'maintenance_emergency': 'Manutenção Emergencial',
            'no_order': 'Sem Pedido',
            'commercial': 'Parada Comercial',
            'weekend': 'Fim de Semana',
            'holiday': 'Feriado',
            'setup': 'Setup/Troca',
            'other': 'Outro'
        };
        return labels[type] || type;
    }

    // ================================
    // NOVO: Funções para cronômetro de parada
    // ================================
    
    // Calcular duração da parada em tempo real
    function getDowntimeDuration(startDate) {
        try {
            const start = new Date(startDate);
            const now = new Date();
            const diffMs = now.getTime() - start.getTime();
            
            if (diffMs < 0) return '0h 0m';
            
            const totalSeconds = Math.floor(diffMs / 1000);
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;
            
            if (hours > 0) {
                return `${hours}h ${minutes}m`;
            } else if (minutes > 0) {
                return `${minutes}m ${seconds}s`;
            } else {
                return `${seconds}s`;
            }
        } catch (e) {
            return '0h 0m';
        }
    }
    
    // Iniciar cronômetro para uma máquina parada
    function startDowntimeTimer(machineId, cardElement) {
        try {
            // Verificar se cardElement é válido
            if (!cardElement || typeof cardElement.querySelector !== 'function') {
                console.warn('[DOWNTIME-TIMER] cardElement inválido para máquina:', machineId);
                return;
            }
            
            // Limpar timer anterior se existir
            if (downtimeTimers.has(machineId)) {
                clearInterval(downtimeTimers.get(machineId));
            }
            
            // Atualizar a cada segundo
            const interval = setInterval(() => {
                const timerElement = cardElement?.querySelector(`[data-timer-machine="${machineId}"]`);
                if (timerElement && window.db) {
                    // Buscar parada atual
                    const statusMap = downtimeStatusCache || {};
                    const downtime = statusMap[machineId];
                    
                    if (downtime) {
                        const duration = getDowntimeDuration(downtime.startDate);
                        timerElement.textContent = duration;
                    }
                } else if (!timerElement) {
                    // Elemento removido, limpar interval
                    clearInterval(interval);
                    downtimeTimers.delete(machineId);
                }
            }, 1000);
            
            downtimeTimers.set(machineId, interval);
        } catch (e) {
            console.warn('[DOWNTIME-TIMER] Erro ao iniciar timer:', e);
        }
    }

    // Função para popular o modal de BORRA com máquinas e motivos do database.js
    function populateBorraModal() {
        // Popular máquinas no modal de BORRA
        const borraMachineSelect = document.getElementById('manual-borra-machine');
        if (borraMachineSelect) {
            borraMachineSelect.innerHTML = '<option value="">Selecione...</option>';
            machineDatabase.forEach(machine => {
                const option = document.createElement('option');
                const mid = normalizeMachineId(machine.id);
                option.value = mid;
                option.textContent = `${mid} - ${machine.model}`;
                borraMachineSelect.appendChild(option);
            });
            console.log('✅ Máquinas do modal de BORRA populadas');
        }

        // Popular motivos no modal de BORRA usando database.js
        const borraReasonSelect = document.getElementById('manual-borra-reason');
        if (borraReasonSelect) {
            borraReasonSelect.innerHTML = '<option value="">Selecione o motivo...</option>';
            
            const groupedReasons = window.getGroupedLossReasons();
            Object.entries(groupedReasons).forEach(([groupName, reasons]) => {
                const group = document.createElement('optgroup');
                group.label = groupName;
                reasons.forEach(reason => {
                    const option = document.createElement('option');
                    option.value = reason;
                    option.textContent = reason;
                    group.appendChild(option);
                });
                borraReasonSelect.appendChild(group);
            });
            console.log('✅ Motivos do modal de BORRA populados via database.js');
        }
    }

    // EXPOR FUNÇÕES GLOBALMENTE para HTML onclick handlers
    // ============================================================
    // Essas funções estão definidas dentro do DOMContentLoaded, mas precisam
    // ser acessadas pelo HTML onclick. Exposição via window permite acesso global.
    window.finalizarParada = finalizarParada;
    window.showNotification = showNotification;
    window.getAllMachinesDowntimeStatus = getAllMachinesDowntimeStatus;
    window.normalizeMachineId = normalizeMachineId;
    window.renderMachineCards = renderMachineCards;
    window.populateMachineSelector = populateMachineSelector;
    
    // ─── Fase 3: Exposições extras para módulos ES6 (Analysis, Planning, Launch) ───
    window.onMachineSelected = onMachineSelected;
    window.getDescricaoMP = getDescricaoMP;
    window.updateMachineInfo = updateMachineInfo;
    window.loadOpProductionChart = loadOpProductionChart;
    window.loadTodayStats = loadTodayStats;
    window.loadProductionOrders = loadProductionOrders;
    window.setOrderAsActive = setOrderAsActive;
    window.loadLaunchPanel = loadLaunchPanel;
    window.isPageVisible = isPageVisible;
    window.detachActiveListener = detachActiveListener;
    window.showLoadingState = showLoadingState;
    window.showConfirmModal = showConfirmModal;
    window.machineCardProductionCache = machineCardProductionCache;

    // ─── Fase 3B: Exposições extras para Launch controller modular ───
    window.checkActiveDowntimes = checkActiveDowntimes;
    window.syncSelectedMachineWithActiveOrder = syncSelectedMachineWithActiveOrder;
    window.refreshLaunchCharts = refreshLaunchCharts;
    window.openModal = openModal;
    window.resolveProductionDateTime = resolveProductionDateTime;
    window.validateOrderActivated = validateOrderActivated;
    window.validateCycleCavityLaunched = validateCycleCavityLaunched;
    window.isOrderActiveForCurrentMachine = isOrderActiveForCurrentMachine;
    window.setupUserCodeInput = setupUserCodeInput;
    window.updateUserNameDisplay = updateUserNameDisplay;
    window.loadTareStateForAllForms = loadTareStateForAllForms;
    window.updateTareDisplay = updateTareDisplay;
    window.updateQuickProductionPieceWeightUI = updateQuickProductionPieceWeightUI;
    window.createHourlyProductionChart = createHourlyProductionChart;
    window.updateTimelineProgress = updateTimelineProgress;
    window.refreshAnalysisIfActive = refreshAnalysisIfActive;

    // ─── Fase 3B: Exposições para Analysis controller modular ───
    window.normalizeToDate = normalizeToDate;
    window.getWorkDayFromTimestamp = getWorkDayFromTimestamp;
    window.getWorkDay = getWorkDay;
    window.getPlanQuantity = getPlanQuantity;
    window.parseTimeToMinutes = parseTimeToMinutes;

    // ─── Phase 13: Exposições para Downtime Grid controller ───
    window.getCurrentUserName = getCurrentUserName;
    window.loadRecentEntries = loadRecentEntries;
    window.machineCardData = machineCardData;

    // ─── Phase 14/15: Exposições para Dashboard + Resumo controllers ───
    window.getProductionDateString = getProductionDateString;
    window.coerceToNumber = coerceToNumber;

    // Expor variáveis de cache para acesso em finalizarParada
    window.downtimeStatusCache = downtimeStatusCache;
    window.downtimeTimers = downtimeTimers;
    
    console.log('[DEBUG] Use debugActiveDowntimes() no console para diagnosticar paradas órfãs');
    console.log('[DEBUG] Use cleanOrphanDowntimes(false) para remover paradas órfãs');
    console.log('[DEBUG] Use forceStopDowntime("H06") para forçar limpeza de uma máquina específica');
});



