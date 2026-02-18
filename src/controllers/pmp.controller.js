/**
 * HokkaidoMES — PMP (Plano Mestre de Produção) Controller (Módulo ES6)
 * Fase 3: Completamente extraído de script.js (linhas 33062-34540)
 *
 * Sub-módulos:
 *   1. Moído — lançamento de moído (coleção pmp_moido)
 *   2. Borra — lançamento de borra (coleção pmp_borra)
 *   3. Sucata — lançamento + análise de sucata (coleção pmp_sucata)
 *
 * Coleções Firestore: pmp_moido, pmp_borra, pmp_sucata
 */

import { getDb, serverTimestamp } from '../services/firebase-client.js';
import { showNotification } from '../components/notification.js';
import { registrarLogSistema } from '../utils/logger.js';
import { normalizeMachineId } from '../utils/dom.utils.js';
import { getCurrentShift } from '../utils/date.utils.js';
import { getActiveUser, getCurrentUserName } from '../utils/auth.utils.js';
import { EventBus } from '../core/event-bus.js';

// ── Estado do módulo ──
let sucataTableData = [];
let sucataTablePage = 1;
const sucataTablePageSize = 10;
let sucataByTypeChart = null;
let sucataByMachineChart = null;
let sucataMonthlyChart = null;

/** Atalho para Firestore */
function db() { return getDb(); }

/** Fallback modal helpers (usa globais se disponíveis) */
function openModal(id) {
    if (typeof window.openModal === 'function') {
        window.openModal(id);
    } else {
        const m = document.getElementById(id);
        if (m) { m.classList.remove('hidden'); m.setAttribute('aria-hidden', 'false'); }
    }
}

function closeModal(id) {
    if (typeof window.closeModal === 'function') {
        window.closeModal(id);
    } else {
        const m = document.getElementById(id);
        if (m) { m.classList.add('hidden'); m.setAttribute('aria-hidden', 'true'); }
    }
}

/** Debounce utility local */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => { clearTimeout(timeout); func(...args); };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ═══════════════════════════════════════════════
// ENTRY POINT
// ═══════════════════════════════════════════════

let _pmpInitialized = false;
export function setupPMPPage() {
    if (_pmpInitialized) {
        console.debug('[PMP·mod] Já inicializado — ignorando re-setup');
        return;
    }
    _pmpInitialized = true;
    console.log('[PMP·mod] Controller modular carregado');
    initPMPPage();
    EventBus.emit('pmp:initialized');
}

// ═══════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════

function initPMPPage() {
    console.log('[TRACE][initPMPPage] Inicializando aba PMP');

    const btnPmpBorra = document.getElementById('btn-pmp-borra');
    if (btnPmpBorra) btnPmpBorra.addEventListener('click', openPmpBorraModal);

    const pmpBorraForm = document.getElementById('pmp-borra-form');
    if (pmpBorraForm) pmpBorraForm.addEventListener('submit', handlePmpBorraSubmit);

    const pmpBorraCancel = document.getElementById('pmp-borra-cancel');
    if (pmpBorraCancel) pmpBorraCancel.addEventListener('click', () => closeModal('pmp-borra-modal'));

    const pmpBorraClose = document.getElementById('pmp-borra-modal-close');
    if (pmpBorraClose) pmpBorraClose.addEventListener('click', () => closeModal('pmp-borra-modal'));

    const pmpBorraOperador = document.getElementById('pmp-borra-operador');
    if (pmpBorraOperador) {
        pmpBorraOperador.addEventListener('input', debounce(searchOperadorByCode, 500));
        pmpBorraOperador.addEventListener('blur', searchOperadorByCode);
    }

    const btnPmpFilter = document.getElementById('btn-pmp-filter');
    if (btnPmpFilter) btnPmpFilter.addEventListener('click', loadPMPHistory);

    const pmpFilterDate = document.getElementById('pmp-filter-date');
    if (pmpFilterDate) pmpFilterDate.value = new Date().toISOString().split('T')[0];

    if (typeof initSucataModal === 'function') {
        initSucataModal();
    } else {
        _initSucataModal();
    }

    // Expose window globals for onclick handlers in HTML templates
    window.deletePMPBorraEntry = deletePMPBorraEntry;
    window.deletePMPSucataEntry = deletePMPSucataEntry;
    window.loadSucataAnalysis = loadSucataAnalysis;
    window.sucataTablePrevPage = sucataTablePrevPage;
    window.sucataTableNextPage = sucataTableNextPage;
    window.exportSucataTable = exportSucataTable;
    window.openPmpBorraModal = openPmpBorraModal;
    window.loadPMPHistory = loadPMPHistory;
    window.initPMPPage = initPMPPage;
    window.openPmpSucataModal = openPmpSucataModal;
    window.initSucataModal = _initSucataModal;
}

// ═══════════════════════════════════════════════
// MOÍDO
// ═══════════════════════════════════════════════

function openMoidoModal() {
    console.log('[TRACE][openMoidoModal] Abrindo modal de moído');

    const dateInput = document.getElementById('moido-date');
    const hourInput = document.getElementById('moido-hour');

    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
    if (hourInput) {
        const now = new Date();
        hourInput.value = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    }

    ['moido-product-code', 'moido-mp-code', 'moido-quantity', 'moido-obs'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });

    ['moido-product-info', 'moido-mp-info', 'moido-product-error', 'moido-mp-error'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });

    const statusDiv = document.getElementById('moido-status');
    if (statusDiv) statusDiv.textContent = '';

    openModal('moido-modal');
}

function searchProductByCode() {
    const codeInput = document.getElementById('moido-product-code');
    const infoDiv = document.getElementById('moido-product-info');
    const errorDiv = document.getElementById('moido-product-error');
    const nameSpan = document.getElementById('moido-product-name');
    const clientSpan = document.getElementById('moido-product-client');

    if (!codeInput || !infoDiv || !errorDiv) return;
    const code = parseInt(codeInput.value, 10);

    if (!code || isNaN(code)) {
        infoDiv.classList.add('hidden');
        errorDiv.classList.add('hidden');
        return;
    }

    const product = window.productDatabase ? window.productDatabase.find(p => p.cod === code) : null;

    if (product) {
        if (nameSpan) nameSpan.textContent = product.name || '-';
        if (clientSpan) clientSpan.textContent = product.client || '-';
        infoDiv.classList.remove('hidden');
        errorDiv.classList.add('hidden');
    } else {
        infoDiv.classList.add('hidden');
        errorDiv.classList.remove('hidden');
    }
}

function searchMpByCode() {
    const codeInput = document.getElementById('moido-mp-code');
    const infoDiv = document.getElementById('moido-mp-info');
    const errorDiv = document.getElementById('moido-mp-error');
    const nameSpan = document.getElementById('moido-mp-name');

    if (!codeInput || !infoDiv || !errorDiv) return;
    const code = parseInt(codeInput.value, 10);

    if (!code || isNaN(code)) {
        infoDiv.classList.add('hidden');
        errorDiv.classList.add('hidden');
        return;
    }

    const mp = window.materiaPrimaDatabase ? window.materiaPrimaDatabase.find(m => m.codigo === code) : null;

    if (mp) {
        if (nameSpan) nameSpan.textContent = mp.descricao || '-';
        infoDiv.classList.remove('hidden');
        errorDiv.classList.add('hidden');
    } else {
        infoDiv.classList.add('hidden');
        errorDiv.classList.remove('hidden');
    }
}

async function handleMoidoSubmit(e) {
    e.preventDefault();
    e.stopPropagation();

    const statusDiv = document.getElementById('moido-status');
    const submitBtn = document.getElementById('moido-save');

    const dateValue = document.getElementById('moido-date')?.value;
    const hourValue = document.getElementById('moido-hour')?.value;
    const productCode = parseInt(document.getElementById('moido-product-code')?.value, 10);
    const mpCode = parseInt(document.getElementById('moido-mp-code')?.value, 10);
    const quantity = parseFloat(document.getElementById('moido-quantity')?.value);
    const obs = document.getElementById('moido-obs')?.value?.trim() || '';

    if (!dateValue) { showNotification('Informe a data', 'warning'); return; }
    if (!hourValue) { showNotification('Informe a hora', 'warning'); return; }
    if (!productCode || isNaN(productCode)) { showNotification('Informe o código do produto', 'warning'); return; }
    if (!mpCode || isNaN(mpCode)) { showNotification('Informe o código da matéria prima', 'warning'); return; }
    if (!quantity || isNaN(quantity) || quantity <= 0) { showNotification('Informe uma quantidade válida', 'warning'); return; }

    const product = window.productDatabase ? window.productDatabase.find(p => p.cod === productCode) : null;
    const mp = window.materiaPrimaDatabase ? window.materiaPrimaDatabase.find(m => m.codigo === mpCode) : null;

    if (!product) { showNotification('Produto não encontrado no banco de dados', 'error'); return; }
    if (!mp) { showNotification('Matéria prima não encontrada no banco de dados', 'error'); return; }

    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Salvando...'; }

    try {
        const currentUser = getActiveUser();

        const moidoData = {
            tipo: 'moido',
            data: dateValue,
            hora: hourValue,
            timestamp: serverTimestamp(),
            createdAt: serverTimestamp(),
            productCode, productName: product.name, productClient: product.client,
            mpCode, mpName: mp.descricao,
            quantidadeKg: quantity,
            observacoes: obs,
            registradoPor: currentUser?.username || 'sistema',
            registradoPorNome: getCurrentUserName() || 'Sistema'
        };

        const docRef = await db().collection('pmp_moido').add(moidoData);
        console.log('[TRACE][handleMoidoSubmit] Moído salvo, ID:', docRef.id);

        if (statusDiv) {
            statusDiv.textContent = '✅ Moído registrado com sucesso!';
            statusDiv.classList.remove('text-red-500');
            statusDiv.classList.add('text-green-600');
        }

        showNotification('✅ Moído registrado com sucesso!', 'success');
        registrarLogSistema('LANÇAMENTO DE MOÍDO', 'moido', { productCode, productName: product.name, mpCode, mpName: mp.descricao, quantidadeKg: quantity });

        setTimeout(() => { closeModal('moido-modal'); loadPMPHistory(); }, 1500);
    } catch (error) {
        console.error('[ERROR][handleMoidoSubmit]', error);
        if (statusDiv) {
            statusDiv.textContent = 'Erro ao registrar moído. Tente novamente.';
            statusDiv.classList.remove('text-green-600');
            statusDiv.classList.add('text-red-500');
        }
        showNotification('Erro ao registrar moído: ' + error.message, 'error');
    } finally {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Registrar Moído'; }
    }
}

// ═══════════════════════════════════════════════
// BORRA
// ═══════════════════════════════════════════════

function openPmpBorraModal() {
    console.log('[TRACE][openPmpBorraModal] Abrindo modal de borra PMP');

    const dateInput = document.getElementById('pmp-borra-date');
    const hourInput = document.getElementById('pmp-borra-hour');

    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
    if (hourInput) {
        const now = new Date();
        hourInput.value = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    }

    ['pmp-borra-operador', 'pmp-borra-quantity', 'pmp-borra-obs'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const shiftSelect = document.getElementById('pmp-borra-shift');
    if (shiftSelect) shiftSelect.value = '';
    const statusDiv = document.getElementById('pmp-borra-status');
    if (statusDiv) statusDiv.textContent = '';

    ['pmp-borra-operador-info', 'pmp-borra-operador-error'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });

    const machineSelect = document.getElementById('pmp-borra-machine');
    if (machineSelect && window.machineDatabase) {
        machineSelect.innerHTML = '<option value="">Selecione uma máquina...</option>';
        window.machineDatabase.forEach(machine => {
            const option = document.createElement('option');
            option.value = machine.id;
            option.textContent = `${machine.id} - ${machine.model}`;
            machineSelect.appendChild(option);
        });
    }

    openModal('pmp-borra-modal');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function searchOperadorByCode() {
    const codeInput = document.getElementById('pmp-borra-operador');
    const infoDiv = document.getElementById('pmp-borra-operador-info');
    const nameSpan = document.getElementById('pmp-borra-operador-name');
    const errorP = document.getElementById('pmp-borra-operador-error');

    if (!codeInput || !infoDiv || !nameSpan || !errorP) return;
    const code = parseInt(codeInput.value, 10);

    if (!code || code <= 0) {
        infoDiv.classList.add('hidden');
        errorP.classList.add('hidden');
        return;
    }

    if (window.userDatabase) {
        const user = window.userDatabase.find(u => u.cod === code);
        if (user) {
            nameSpan.textContent = user.nomeCompleto || user.nomeUsuario || 'N/A';
            infoDiv.classList.remove('hidden');
            errorP.classList.add('hidden');
        } else {
            infoDiv.classList.add('hidden');
            errorP.classList.remove('hidden');
        }
    } else {
        console.warn('[PMP-BORRA] userDatabase não disponível');
        infoDiv.classList.add('hidden');
        errorP.classList.add('hidden');
    }
}

async function handlePmpBorraSubmit(e) {
    e.preventDefault();
    e.stopPropagation();

    const statusDiv = document.getElementById('pmp-borra-status');
    const saveBtn = document.getElementById('pmp-borra-save');

    try {
        const date = document.getElementById('pmp-borra-date')?.value;
        const hour = document.getElementById('pmp-borra-hour')?.value;
        const shift = document.getElementById('pmp-borra-shift')?.value;
        const operadorCod = parseInt(document.getElementById('pmp-borra-operador')?.value, 10);
        const machine = document.getElementById('pmp-borra-machine')?.value;
        const quantity = parseFloat(document.getElementById('pmp-borra-quantity')?.value);
        const observations = document.getElementById('pmp-borra-obs')?.value?.trim() || '';

        if (!date || !hour) { statusDiv.textContent = '⚠️ Informe data e hora'; statusDiv.className = 'text-sm font-semibold h-5 text-center mt-2 text-red-600'; return; }
        if (!shift) { statusDiv.textContent = '⚠️ Selecione um turno'; statusDiv.className = 'text-sm font-semibold h-5 text-center mt-2 text-red-600'; return; }
        if (!operadorCod || operadorCod <= 0) { statusDiv.textContent = '⚠️ Informe o código do operador'; statusDiv.className = 'text-sm font-semibold h-5 text-center mt-2 text-red-600'; return; }
        if (!machine) { statusDiv.textContent = '⚠️ Selecione uma máquina'; statusDiv.className = 'text-sm font-semibold h-5 text-center mt-2 text-red-600'; return; }
        if (!quantity || quantity <= 0) { statusDiv.textContent = '⚠️ Informe a quantidade em Kg'; statusDiv.className = 'text-sm font-semibold h-5 text-center mt-2 text-red-600'; return; }

        let operadorName = 'Desconhecido';
        if (window.userDatabase) {
            const user = window.userDatabase.find(u => u.cod === operadorCod);
            if (user) {
                operadorName = user.nomeCompleto || user.nomeUsuario || 'N/A';
            } else {
                statusDiv.textContent = '⚠️ Operador não encontrado no banco de dados';
                statusDiv.className = 'text-sm font-semibold h-5 text-center mt-2 text-red-600';
                return;
            }
        }

        if (saveBtn) { saveBtn.disabled = true; saveBtn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin inline mr-2"></i>Salvando...'; }
        statusDiv.textContent = '⏳ Salvando...';
        statusDiv.className = 'text-sm font-semibold h-5 text-center mt-2 text-blue-600';

        const machineInfo = window.machineDatabase?.find(m => m.id === machine);
        const activeUser = getActiveUser() || {};

        const borraData = {
            type: 'pmp_borra', date, hour, shift,
            timestamp: serverTimestamp(), timestampLocal: new Date().toISOString(),
            operadorCod, operadorName,
            machine, machineModel: machineInfo?.model || '',
            quantityKg: quantity, observations,
            registeredBy: activeUser.name || 'Sistema',
            registeredByEmail: activeUser.email || '',
            createdAt: serverTimestamp()
        };

        await db().collection('pmp_borra').add(borraData);

        statusDiv.textContent = '✅ Borra registrada com sucesso!';
        statusDiv.className = 'text-sm font-semibold h-5 text-center mt-2 text-green-600';
        showNotification('✅ Borra registrada com sucesso!', 'success');

        setTimeout(() => {
            closeModal('pmp-borra-modal');
            if (document.getElementById('pmp-page') && !document.getElementById('pmp-page').classList.contains('hidden')) {
                loadPMPHistory();
            }
        }, 1500);
    } catch (error) {
        console.error('[PMP-BORRA] Erro ao salvar borra:', error);
        statusDiv.textContent = '❌ Erro ao salvar borra';
        statusDiv.className = 'text-sm font-semibold h-5 text-center mt-2 text-red-600';
        showNotification('Erro ao salvar borra', 'error');
    } finally {
        if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = 'Registrar Borra'; }
    }
}

async function deletePMPBorraEntry(docId) {
    try {
        if (!confirm('Tem certeza que deseja excluir este lançamento de borra?')) return;
        await db().collection('pmp_borra').doc(docId).delete();
        showNotification('Lançamento de borra excluído com sucesso', 'success');
        await loadPMPHistory();
    } catch (error) {
        console.error('[ERROR][deletePMPBorraEntry]', error);
        showNotification('Erro ao excluir lançamento: ' + error.message, 'error');
    }
}

// ═══════════════════════════════════════════════
// HISTÓRICO PMP (Borra + Sucata)
// ═══════════════════════════════════════════════

async function loadPMPHistory() {
    console.log('[TRACE][loadPMPHistory] Carregando histórico PMP (Borras e Sucatas)');

    const filterDate = document.getElementById('pmp-filter-date')?.value;
    const historyList = document.getElementById('pmp-history-list');
    if (!historyList) return;
    if (!filterDate) { showNotification('Selecione uma data para filtrar', 'warning'); return; }

    historyList.innerHTML = `<div class="text-center py-8 text-gray-400">
        <i data-lucide="loader-2" class="w-8 h-8 mx-auto mb-2 opacity-50 animate-spin"></i>
        <p>Carregando...</p></div>`;
    if (typeof lucide !== 'undefined') lucide.createIcons();

    try {
        const records = [];

        // OTIMIZAÇÃO Fase 2: executar queries de borra e sucata em paralelo
        const [borraSnapshot, sucataSnapshot] = await Promise.all([
            db().collection('pmp_borra').where('date', '==', filterDate).get(),
            db().collection('pmp_sucata').where('date', '==', filterDate).get()
        ]);
        borraSnapshot.forEach(doc => { records.push({ id: doc.id, ...doc.data(), tipo: 'borra' }); });
        sucataSnapshot.forEach(doc => { records.push({ id: doc.id, ...doc.data(), tipo: 'sucata' }); });

        records.sort((a, b) => (b.hour || '00:00').localeCompare(a.hour || '00:00'));

        if (records.length === 0) {
            historyList.innerHTML = `<div class="text-center py-8 text-gray-400">
                <i data-lucide="inbox" class="w-12 h-12 mx-auto mb-2 opacity-50"></i>
                <p>Nenhum lançamento de borra ou sucata encontrado para esta data</p></div>`;
            if (typeof lucide !== 'undefined') lucide.createIcons();
            return;
        }

        historyList.innerHTML = records.map(record => {
            if (record.tipo === 'sucata') {
                const tipoIcon = record.sucataType === 'galhos' ? '🌿' : record.sucataType === 'pecas' ? '🔩' : record.sucataType === 'moido' ? '⚙️' : '📦';
                return `<div class="flex items-center justify-between p-3 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200 transition-colors group">
                    <div class="flex items-center gap-3 flex-1">
                        <div class="p-2 rounded-lg bg-red-100"><i data-lucide="trash-2" class="w-4 h-4 text-red-600"></i></div>
                        <div>
                            <p class="text-sm font-semibold text-gray-800">${tipoIcon} Sucata - ${record.quantityKg?.toFixed(3) || '0.000'} Kg</p>
                            <p class="text-xs text-gray-500">Tipo: ${record.sucataTypeLabel || record.sucataType || '-'} | Máquina: ${record.machine || '-'}</p>
                            <p class="text-xs text-gray-400">Motivo: ${record.reason || '-'}</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-3">
                        <div class="text-right">
                            <p class="text-xs text-gray-500">${record.hour || '-'}</p>
                            <p class="text-xs text-gray-400">${record.registeredBy || 'Sistema'}</p>
                        </div>
                        <button onclick="deletePMPSucataEntry('${record.id}')" class="p-2 rounded-lg bg-red-100 hover:bg-red-200 text-red-600 transition-colors opacity-0 group-hover:opacity-100" title="Excluir lançamento">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                    </div></div>`;
            } else {
                return `<div class="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors group">
                    <div class="flex items-center gap-3 flex-1">
                        <div class="p-2 rounded-lg bg-yellow-100"><i data-lucide="droplet" class="w-4 h-4 text-yellow-600"></i></div>
                        <div>
                            <p class="text-sm font-semibold text-gray-800">Borra - ${record.quantityKg?.toFixed(3) || '0.000'} Kg</p>
                            <p class="text-xs text-gray-500">Máquina: ${record.machine || '-'} ${record.machineModel ? '(' + record.machineModel + ')' : ''}</p>
                            <p class="text-xs text-gray-400">Operador: ${record.operadorName || ('Cod ' + record.operadorCod) || '-'}</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-3">
                        <div class="text-right">
                            <p class="text-xs text-gray-500">${record.hour || '-'}</p>
                            <p class="text-xs text-gray-400">${record.registeredBy || 'Sistema'}</p>
                        </div>
                        <button onclick="deletePMPBorraEntry('${record.id}')" class="p-2 rounded-lg bg-red-100 hover:bg-red-200 text-red-600 transition-colors opacity-0 group-hover:opacity-100" title="Excluir lançamento">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                    </div></div>`;
            }
        }).join('');

        if (typeof lucide !== 'undefined') lucide.createIcons();
    } catch (error) {
        console.error('[ERROR][loadPMPHistory]', error);
        historyList.innerHTML = `<div class="text-center py-8 text-red-400">
            <i data-lucide="alert-circle" class="w-12 h-12 mx-auto mb-2 opacity-50"></i>
            <p>Erro ao carregar histórico</p></div>`;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
}

// ═══════════════════════════════════════════════
// SUCATA — Modal + Submit
// ═══════════════════════════════════════════════

function openPmpSucataModal() {
    console.log('[PMP-SUCATA] Abrindo modal de sucata');

    const modal = document.getElementById('manual-sucata-modal');
    if (!modal) { console.error('[PMP-SUCATA] Modal não encontrado'); return; }

    const dateInput = document.getElementById('manual-sucata-date');
    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];

    const shiftInput = document.getElementById('manual-sucata-shift');
    if (shiftInput) shiftInput.value = getCurrentShift() || '1';

    document.getElementById('manual-sucata-form')?.reset();
    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
    if (shiftInput) shiftInput.value = getCurrentShift() || '1';

    ['manual-sucata-operador-info', 'manual-sucata-operador-error'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });

    const statusDiv = document.getElementById('manual-sucata-status');
    if (statusDiv) { statusDiv.textContent = ''; statusDiv.className = 'text-sm font-semibold h-5 text-center mt-2'; }

    modal.classList.remove('hidden');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function savePMPSucata(e) {
    e.preventDefault();

    const statusDiv = document.getElementById('manual-sucata-status');
    const saveBtn = document.getElementById('manual-sucata-save');

    try {
        const date = document.getElementById('manual-sucata-date')?.value;
        const hour = document.getElementById('manual-sucata-hour')?.value || '';
        const shift = document.getElementById('manual-sucata-shift')?.value || '1';
        const operadorCod = document.getElementById('manual-sucata-operador')?.value;
        const sucataType = document.getElementById('manual-sucata-type')?.value;
        const weightKg = parseFloat(document.getElementById('manual-sucata-weight')?.value) || 0;
        const observations = document.getElementById('manual-sucata-obs')?.value?.trim() || '';

        if (!date) { statusDiv.textContent = '⚠️ Informe a data'; statusDiv.className = 'text-sm font-semibold h-5 text-center mt-2 text-red-600'; return; }
        if (!operadorCod) { statusDiv.textContent = '⚠️ Informe o código do operador'; statusDiv.className = 'text-sm font-semibold h-5 text-center mt-2 text-red-600'; return; }

        let operadorInfo = null;
        const operadorCodInt = parseInt(operadorCod, 10);
        if (window.userDatabase) operadorInfo = window.userDatabase.find(u => u.cod === operadorCodInt);
        if (!operadorInfo) { statusDiv.textContent = '⚠️ Operador não encontrado'; statusDiv.className = 'text-sm font-semibold h-5 text-center mt-2 text-red-600'; return; }
        if (!sucataType) { statusDiv.textContent = '⚠️ Selecione o tipo de sucata'; statusDiv.className = 'text-sm font-semibold h-5 text-center mt-2 text-red-600'; return; }
        if (!weightKg || weightKg <= 0) { statusDiv.textContent = '⚠️ Informe o peso da sucata'; statusDiv.className = 'text-sm font-semibold h-5 text-center mt-2 text-red-600'; return; }

        if (saveBtn) { saveBtn.disabled = true; saveBtn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin inline mr-2"></i>Salvando...'; }
        statusDiv.textContent = '⏳ Salvando...';
        statusDiv.className = 'text-sm font-semibold h-5 text-center mt-2 text-blue-600';

        const activeUser = getActiveUser() || {};
        const sucataTypeLabels = { 'galhos': 'Galhos', 'pecas': 'Peças Defeituosas', 'moido': 'Moído' };

        const sucataData = {
            type: 'pmp_sucata', date, hour, shift,
            operadorCod: operadorCodInt,
            operadorName: operadorInfo?.nomeCompleto || operadorInfo?.nomeUsuario || '',
            timestamp: serverTimestamp(), timestampLocal: new Date().toISOString(),
            sucataType, sucataTypeLabel: sucataTypeLabels[sucataType] || sucataType,
            quantityKg: weightKg, observations,
            registeredBy: activeUser.name || 'Sistema',
            registeredByEmail: activeUser.email || '',
            createdAt: serverTimestamp()
        };

        await db().collection('pmp_sucata').add(sucataData);

        statusDiv.textContent = '✅ Sucata registrada com sucesso!';
        statusDiv.className = 'text-sm font-semibold h-5 text-center mt-2 text-green-600';
        showNotification('✅ Sucata registrada com sucesso!', 'success');

        setTimeout(() => {
            closeModal('manual-sucata-modal');
            if (document.getElementById('pmp-page') && !document.getElementById('pmp-page').classList.contains('hidden')) {
                loadPMPHistory();
            }
        }, 1500);
    } catch (error) {
        console.error('[PMP-SUCATA] Erro:', error);
        statusDiv.textContent = '❌ Erro ao salvar sucata';
        statusDiv.className = 'text-sm font-semibold h-5 text-center mt-2 text-red-600';
        showNotification('Erro ao salvar sucata', 'error');
    } finally {
        if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = 'Registrar Sucata'; }
    }
}

async function deletePMPSucataEntry(docId) {
    try {
        if (!confirm('Tem certeza que deseja excluir este lançamento de sucata?')) return;
        await db().collection('pmp_sucata').doc(docId).delete();
        showNotification('Lançamento de sucata excluído com sucesso', 'success');
        await loadPMPHistory();
    } catch (error) {
        console.error('[ERROR][deletePMPSucataEntry]', error);
        showNotification('Erro ao excluir lançamento: ' + error.message, 'error');
    }
}

// ═══════════════════════════════════════════════
// SUCATA — Análise + Gráficos
// ═══════════════════════════════════════════════

async function loadSucataAnalysis(startDate, endDate, machine = 'all', shift = 'all') {
    console.log('[SUCATA] Carregando análise de sucata...');

    try {
        let query = db().collection('pmp_sucata')
            .where('date', '>=', startDate)
            .where('date', '<=', endDate);

        const snapshot = await query.get();
        let sucataData = [];

        snapshot.forEach(doc => {
            const data = doc.data();
            const machineId = normalizeMachineId(data.machine || '');
            if (machine !== 'all' && machineId !== normalizeMachineId(machine)) return;
            if (shift !== 'all' && data.shift !== shift) return;
            sucataData.push({ id: doc.id, ...data });
        });

        let totalGalhos = 0, totalPecas = 0, totalMoido = 0;
        const byMachine = {}, byType = {};

        sucataData.forEach(item => {
            const kg = item.quantityKg || 0;
            const tipo = item.sucataType || 'outros';
            const mac = item.machine || 'N/A';

            if (tipo === 'galhos') totalGalhos += kg;
            else if (tipo === 'pecas') totalPecas += kg;
            else if (tipo === 'moido') totalMoido += kg;

            byMachine[mac] = (byMachine[mac] || 0) + kg;
            const typeLabel = item.sucataTypeLabel || tipo;
            byType[typeLabel] = (byType[typeLabel] || 0) + kg;
        });

        const totalSucata = totalGalhos + totalPecas + totalMoido;

        const totalEl = document.getElementById('total-sucata');
        const galhosEl = document.getElementById('total-sucata-galhos');
        const pecasEl = document.getElementById('total-sucata-pecas');
        const moidoEl = document.getElementById('total-sucata-moido');

        if (totalEl) totalEl.textContent = totalSucata.toFixed(3) + ' kg';
        if (galhosEl) galhosEl.textContent = totalGalhos.toFixed(3) + ' kg';
        if (pecasEl) pecasEl.textContent = totalPecas.toFixed(3) + ' kg';
        if (moidoEl) moidoEl.textContent = totalMoido.toFixed(3) + ' kg';

        renderSucataByTypeChart(byType);
        renderSucataByMachineChart(byMachine);
        renderSucataMonthlyChart(sucataData);

        sucataTableData = sucataData.sort((a, b) => {
            const dateA = new Date(a.date + ' ' + (a.hour || '00:00'));
            const dateB = new Date(b.date + ' ' + (b.hour || '00:00'));
            return dateB - dateA;
        });
        sucataTablePage = 1;
        renderSucataTable();
    } catch (error) {
        console.error('[SUCATA] Erro ao carregar análise:', error);
    }
}

function renderSucataByTypeChart(data) {
    const ctx = document.getElementById('sucata-by-type-chart');
    if (!ctx) return;
    if (sucataByTypeChart) sucataByTypeChart.destroy();

    sucataByTypeChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(data),
            datasets: [{ data: Object.values(data),
                backgroundColor: ['rgba(34,197,94,0.8)', 'rgba(239,68,68,0.8)', 'rgba(59,130,246,0.8)', 'rgba(156,163,175,0.8)'],
                borderColor: ['rgba(34,197,94,1)', 'rgba(239,68,68,1)', 'rgba(59,130,246,1)', 'rgba(156,163,175,1)'],
                borderWidth: 2
            }]
        },
        options: { responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom', labels: { font: { size: 10 } } },
                tooltip: { callbacks: { label: ctx => ctx.label + ': ' + (ctx.raw || 0).toFixed(3) + ' kg' } } }
        }
    });
}

function renderSucataByMachineChart(data) {
    const ctx = document.getElementById('sucata-by-machine-chart');
    if (!ctx) return;
    if (sucataByMachineChart) sucataByMachineChart.destroy();

    const sorted = Object.entries(data).sort((a, b) => b[1] - a[1]).slice(0, 10);

    sucataByMachineChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sorted.map(x => x[0]),
            datasets: [{ label: 'Sucata (kg)', data: sorted.map(x => x[1]),
                backgroundColor: 'rgba(239,68,68,0.7)', borderColor: 'rgba(239,68,68,1)', borderWidth: 1, borderRadius: 4
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y',
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ctx.raw.toFixed(3) + ' kg' } } },
            scales: { x: { beginAtZero: true, ticks: { callback: v => v.toFixed(2) + ' kg' } }, y: { ticks: { font: { size: 10 } } } }
        }
    });
}

function renderSucataMonthlyChart(data) {
    const ctx = document.getElementById('sucata-monthly-chart');
    if (!ctx) return;
    if (sucataMonthlyChart) sucataMonthlyChart.destroy();

    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const byMonth = {};

    data.forEach(item => {
        if (!item.date) return;
        const parts = item.date.split('-');
        if (parts.length < 2) return;
        const year = parts[0];
        const month = parseInt(parts[1]) - 1;
        const key = `${year}-${String(month + 1).padStart(2, '0')}`;
        if (!byMonth[key]) byMonth[key] = { label: `${monthNames[month]}/${year.slice(2)}`, value: 0 };
        byMonth[key].value += item.quantityKg || 0;
    });

    const sortedKeys = Object.keys(byMonth).sort();
    const labels = sortedKeys.map(k => byMonth[k].label);
    const monthlyValues = sortedKeys.map(k => byMonth[k].value);

    let acc = 0;
    const accValues = monthlyValues.map(v => { acc += v; return acc; });

    sucataMonthlyChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                { label: 'Mensal (kg)', data: monthlyValues, backgroundColor: 'rgba(239,68,68,0.7)', borderColor: 'rgba(239,68,68,1)', borderWidth: 1, borderRadius: 4, order: 2, yAxisID: 'y' },
                { label: 'Acumulado (kg)', data: accValues, type: 'line', backgroundColor: 'rgba(220,38,38,0.1)', borderColor: 'rgba(220,38,38,1)', borderWidth: 2, fill: true, tension: 0.3, pointBackgroundColor: 'rgba(220,38,38,1)', pointBorderColor: '#fff', pointBorderWidth: 2, pointRadius: 4, order: 1, yAxisID: 'y1' }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: { legend: { position: 'top', labels: { usePointStyle: true, padding: 15, font: { size: 11 } } },
                tooltip: { callbacks: { label: ctx => ctx.dataset.label + ': ' + ctx.raw.toFixed(3) + ' kg' } } },
            scales: {
                x: { grid: { display: false }, ticks: { font: { size: 10 } } },
                y: { type: 'linear', display: true, position: 'left', beginAtZero: true, title: { display: true, text: 'Mensal (kg)', font: { size: 10 } }, ticks: { font: { size: 10 }, callback: v => v.toFixed(1) } },
                y1: { type: 'linear', display: true, position: 'right', beginAtZero: true, title: { display: true, text: 'Acumulado (kg)', font: { size: 10 } }, grid: { drawOnChartArea: false }, ticks: { font: { size: 10 }, callback: v => v.toFixed(1) } }
            }
        }
    });
}

// ═══════════════════════════════════════════════
// SUCATA — Tabela Paginada + Export
// ═══════════════════════════════════════════════

function renderSucataTable() {
    const tbody = document.getElementById('sucata-apontamentos-table');
    if (!tbody) return;

    const start = (sucataTablePage - 1) * sucataTablePageSize;
    const end = start + sucataTablePageSize;
    const pageData = sucataTableData.slice(start, end);

    if (pageData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="px-4 py-8 text-center text-gray-400">
            <i data-lucide="inbox" class="w-6 h-6 mx-auto mb-2 opacity-50"></i>Nenhum registro de sucata encontrado</td></tr>`;
    } else {
        tbody.innerHTML = pageData.map(item => `
            <tr class="hover:bg-red-50 transition">
                <td class="px-4 py-3 text-gray-700">${item.date || '-'} ${item.hour || '-'}</td>
                <td class="px-4 py-3 text-center"><span class="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">${item.sucataTypeLabel || item.sucataType || '-'}</span></td>
                <td class="px-4 py-3 text-center font-semibold text-red-600">${(item.quantityKg || 0).toFixed(3)} kg</td>
                <td class="px-4 py-3 text-gray-600">T${item.shift || '-'}</td>
            </tr>`).join('');
    }

    const showingEl = document.getElementById('sucata-table-showing');
    const totalEl = document.getElementById('sucata-table-total');
    const pageEl = document.getElementById('sucata-table-page');
    const prevBtn = document.getElementById('sucata-table-prev');
    const nextBtn = document.getElementById('sucata-table-next');
    const totalPages = Math.ceil(sucataTableData.length / sucataTablePageSize);

    if (showingEl) showingEl.textContent = Math.min(end, sucataTableData.length);
    if (totalEl) totalEl.textContent = sucataTableData.length;
    if (pageEl) pageEl.textContent = `Página ${sucataTablePage} de ${totalPages || 1}`;
    if (prevBtn) prevBtn.disabled = sucataTablePage <= 1;
    if (nextBtn) nextBtn.disabled = sucataTablePage >= totalPages;

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function sucataTablePrevPage() {
    if (sucataTablePage > 1) { sucataTablePage--; renderSucataTable(); }
}

function sucataTableNextPage() {
    const totalPages = Math.ceil(sucataTableData.length / sucataTablePageSize);
    if (sucataTablePage < totalPages) { sucataTablePage++; renderSucataTable(); }
}

function exportSucataTable() {
    if (sucataTableData.length === 0) { showNotification('Nenhum dado para exportar', 'warning'); return; }

    const csvContent = [
        ['Data', 'Hora', 'Máquina', 'Tipo', 'Quantidade (kg)', 'Turno', 'MP', 'Motivo', 'Observações'].join(';'),
        ...sucataTableData.map(item => [
            item.date || '', item.hour || '', item.machine || '',
            item.sucataTypeLabel || item.sucataType || '',
            (item.quantityKg || 0).toFixed(3), item.shift || '',
            item.mpType || '', item.reason || '',
            (item.observations || '').replace(/;/g, ',')
        ].join(';'))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `sucata_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showNotification('Exportação concluída!', 'success');
}

// ═══════════════════════════════════════════════
// SUCATA — Modal Init
// ═══════════════════════════════════════════════

function _initSucataModal() {
    const btnSucata = document.getElementById('btn-pmp-sucata');
    if (btnSucata) btnSucata.addEventListener('click', openPmpSucataModal);

    const closeBtn = document.getElementById('manual-sucata-close');
    const cancelBtn = document.getElementById('manual-sucata-cancel');
    if (closeBtn) closeBtn.addEventListener('click', () => closeModal('manual-sucata-modal'));
    if (cancelBtn) cancelBtn.addEventListener('click', () => closeModal('manual-sucata-modal'));

    const operadorInput = document.getElementById('manual-sucata-operador');
    if (operadorInput) {
        operadorInput.addEventListener('input', function () {
            const cod = parseInt(this.value, 10);
            const infoDiv = document.getElementById('manual-sucata-operador-info');
            const nameSpan = document.getElementById('manual-sucata-operador-name');
            const errorP = document.getElementById('manual-sucata-operador-error');

            if (!cod || cod <= 0) {
                if (infoDiv) infoDiv.classList.add('hidden');
                if (errorP) errorP.classList.add('hidden');
                return;
            }

            let operador = null;
            if (window.userDatabase) operador = window.userDatabase.find(u => u.cod === cod);

            if (operador) {
                if (infoDiv) { infoDiv.classList.remove('hidden'); if (nameSpan) nameSpan.textContent = operador.nomeCompleto || operador.nomeUsuario || '-'; }
                if (errorP) errorP.classList.add('hidden');
            } else {
                if (infoDiv) infoDiv.classList.add('hidden');
                if (errorP) errorP.classList.remove('hidden');
            }
        });
    }

    const form = document.getElementById('manual-sucata-form');
    if (form) form.addEventListener('submit', savePMPSucata);

    console.log('[PMP-SUCATA] Modal inicializado');
}
