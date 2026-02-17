// ===== NOVO: Importador de Ordens do ERP Sankhya =====

// Estado global do importador
window.importOrdersState = {
    file: null,
    parsedOrders: [],
    selectedRows: new Set()
};

// Abrir modal de importação
function openImportOrdersModal() {
    const modal = document.getElementById('import-orders-modal');
    if (modal) {
        modal.classList.remove('hidden');
        resetImportModal();
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
}

// Fechar modal de importação
function closeImportOrdersModal() {
    const modal = document.getElementById('import-orders-modal');
    if (modal) {
        modal.classList.add('hidden');
        resetImportModal();
    }
}

// Resetar estado do modal
function resetImportModal() {
    window.importOrdersState = { file: null, parsedOrders: [], selectedRows: new Set() };
    
    document.getElementById('import-file-input').value = '';
    document.getElementById('import-upload-area').classList.remove('hidden');
    document.getElementById('import-file-info').classList.add('hidden');
    document.getElementById('import-config').classList.add('hidden');
    document.getElementById('import-preview').classList.add('hidden');
    document.getElementById('import-status').classList.add('hidden');
    document.getElementById('import-execute-btn').disabled = true;
}

// Limpar arquivo selecionado
function clearImportFile() {
    resetImportModal();
}

// Handler para seleção de arquivo
function handleImportFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    window.importOrdersState.file = file;
    
    // Mostrar info do arquivo
    document.getElementById('import-upload-area').classList.add('hidden');
    document.getElementById('import-file-info').classList.remove('hidden');
    document.getElementById('import-file-name').textContent = file.name;
    document.getElementById('import-file-size').textContent = formatFileSize(file.size);
    
    // Processar arquivo
    parseImportExcel(file);
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' bytes';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// Parsear arquivo Excel do ERP Sankhya
async function parseImportExcel(file) {
    try {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Converter para array de arrays para ter acesso às linhas brutas
        const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        console.log('[Import] Dados brutos:', rawData.slice(0, 5));
        
        // Encontrar a linha de cabeçalho (contém "Nro. OP", "Centro de Trabalho", etc)
        let headerRowIndex = -1;
        let headers = [];
        
        for (let i = 0; i < Math.min(10, rawData.length); i++) {
            const row = rawData[i];
            if (row && row.some(cell => String(cell).includes('Nro. OP') || String(cell).includes('Centro de Trabalho'))) {
                headerRowIndex = i;
                headers = row.map(h => String(h || '').trim());
                break;
            }
        }
        
        if (headerRowIndex === -1) {
            alert('Formato de arquivo não reconhecido. Certifique-se de que é um relatório de Ordens de Produção do ERP.');
            resetImportModal();
            return;
        }
        
        console.log('[Import] Cabeçalhos encontrados na linha', headerRowIndex + 1, ':', headers);
        
        // Mapear índices das colunas
        const colIndex = {
            centroTrabalho: headers.findIndex(h => h.includes('Centro de Trabalho')),
            nroOP: headers.findIndex(h => h === 'Nro. OP' || h.includes('Nro. OP')),
            tamLote: headers.findIndex(h => h.includes('Tam. Lote')),
            saldoProduzir: headers.findIndex(h => h.includes('Saldo a Produzir')),
            produtoAcabado: headers.findIndex(h => h.includes('Produto Acabado')),
            status: headers.findIndex(h => h === 'Status'),
            descrProduto: headers.findIndex(h => h.includes('Descr. Produto')),
            nroLote: headers.findIndex(h => h === 'Nro. Lote' || h.includes('Nro. Lote')),
            cliente: headers.findIndex(h => h.includes('Nome Parceiro')),
            observacoes: headers.findIndex(h => h.includes('Observações'))
        };
        
        console.log('[Import] Índices de colunas:', colIndex);
        
        // Extrair dados das linhas após o cabeçalho
        const orders = [];
        for (let i = headerRowIndex + 1; i < rawData.length; i++) {
            const row = rawData[i];
            if (!row || row.length === 0) continue;
            
            // Pegar valores das colunas
            const centroTrabalho = colIndex.centroTrabalho >= 0 ? String(row[colIndex.centroTrabalho] || '') : '';
            const nroOP = colIndex.nroOP >= 0 ? String(row[colIndex.nroOP] || '') : '';
            const tamLote = colIndex.tamLote >= 0 ? row[colIndex.tamLote] : '';
            const saldoProduzir = colIndex.saldoProduzir >= 0 ? row[colIndex.saldoProduzir] : '';
            const produtoAcabado = colIndex.produtoAcabado >= 0 ? String(row[colIndex.produtoAcabado] || '') : '';
            const status = colIndex.status >= 0 ? String(row[colIndex.status] || '') : '';
            const descrProduto = colIndex.descrProduto >= 0 ? String(row[colIndex.descrProduto] || '') : '';
            const nroLote = colIndex.nroLote >= 0 ? String(row[colIndex.nroLote] || '') : '';
            const cliente = colIndex.cliente >= 0 ? String(row[colIndex.cliente] || '') : '';
            
            // Validar se é uma linha de dados (tem número de OP válido)
            if (!nroOP || nroOP === '' || isNaN(Number(nroOP))) continue;
            
            // Extrair código da máquina do Centro de Trabalho (ex: "3 - H02 - SANDRETTO" -> "H02")
            let machineId = '';
            if (centroTrabalho) {
                const match = centroTrabalho.match(/\d+\s*-\s*([A-Z0-9]+)/i);
                if (match) {
                    machineId = match[1].toUpperCase();
                } else {
                    machineId = centroTrabalho.split('-')[0]?.trim() || centroTrabalho;
                }
            }
            
            // Converter status do ERP para status do sistema
            let systemStatus = 'planejada';
            const statusLower = status.toLowerCase();
            if (statusLower.includes('andamento')) systemStatus = 'em_andamento';
            else if (statusLower.includes('criado')) systemStatus = 'planejada';
            else if (statusLower.includes('conclu') || statusLower.includes('finaliz')) systemStatus = 'concluida';
            else if (statusLower.includes('cancel')) systemStatus = 'cancelada';
            
            orders.push({
                index: orders.length,
                order_number: nroOP.trim(),
                part_code: produtoAcabado.trim(),
                part_name: descrProduto.trim(),
                machine_id: machineId,
                machine_full: centroTrabalho,
                customer: cliente.trim(),
                lot_size: parseImportNumber(tamLote) || 0,
                remaining: parseImportNumber(saldoProduzir) || 0,
                batch_number: nroLote.trim(),
                status_erp: status,
                status: systemStatus,
                selected: true
            });
        }
        
        console.log('[Import] Ordens extraídas:', orders.length, orders);
        
        if (orders.length === 0) {
            alert('Nenhuma ordem de produção válida encontrada no arquivo.');
            resetImportModal();
            return;
        }
        
        // Atualizar estado
        window.importOrdersState.parsedOrders = orders;
        window.importOrdersState.selectedRows = new Set(orders.map((_, i) => i));
        
        // Mostrar configurações e preview
        document.getElementById('import-config').classList.remove('hidden');
        document.getElementById('import-preview').classList.remove('hidden');
        document.getElementById('import-records-count').textContent = `${orders.length} registros encontrados`;
        document.getElementById('import-execute-btn').disabled = false;
        
        // Popular select de máquinas
        populateImportMachineSelect(orders);
        
        // Renderizar preview
        renderImportPreview(orders);
        
        if (typeof lucide !== 'undefined') lucide.createIcons();
        
    } catch (error) {
        console.error('[Import] Erro ao processar arquivo:', error);
        alert('Erro ao processar arquivo Excel: ' + error.message);
        resetImportModal();
    }
}

// Popular select de máquinas
function populateImportMachineSelect(orders) {
    const select = document.getElementById('import-default-machine');
    if (!select) return;
    
    const machines = [...new Set(orders.map(o => o.machine_id).filter(m => m))];
    select.innerHTML = '<option value="">Usar do arquivo</option>';
    machines.forEach(m => {
        select.innerHTML += `<option value="${m}">${m}</option>`;
    });
}

// Renderizar preview da tabela
function renderImportPreview(orders) {
    const tbody = document.getElementById('import-preview-body');
    if (!tbody) return;
    
    tbody.innerHTML = orders.map((order, idx) => `
        <tr class="hover:bg-gray-50 ${order.selected ? '' : 'opacity-50'}">
            <td class="px-3 py-2">
                <input type="checkbox" 
                       class="import-row-checkbox w-4 h-4 text-indigo-600 rounded" 
                       data-index="${idx}" 
                       ${order.selected ? 'checked' : ''}
                       onchange="toggleImportRow(${idx}, this.checked)">
            </td>
            <td class="px-3 py-2 font-medium text-gray-800">${order.order_number}</td>
            <td class="px-3 py-2">${order.part_code}</td>
            <td class="px-3 py-2 text-gray-600 text-xs max-w-xs truncate" title="${order.part_name}">${order.part_name || '-'}</td>
            <td class="px-3 py-2">
                <span class="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">${order.machine_id || '-'}</span>
            </td>
            <td class="px-3 py-2 text-center font-medium">${order.lot_size.toLocaleString('pt-BR')}</td>
            <td class="px-3 py-2">
                <span class="px-2 py-0.5 rounded text-xs font-medium ${getStatusBadgeClass(order.status)}">${order.status_erp || order.status}</span>
            </td>
            <td class="px-3 py-2 text-gray-600 text-xs max-w-xs truncate" title="${order.customer}">${order.customer || '-'}</td>
        </tr>
    `).join('');
}

function getStatusBadgeClass(status) {
    switch(status) {
        case 'em_andamento': return 'bg-amber-100 text-amber-700';
        case 'concluida': return 'bg-green-100 text-green-700';
        case 'cancelada': return 'bg-red-100 text-red-700';
        default: return 'bg-gray-100 text-gray-700';
    }
}

// Toggle seleção de linha
function toggleImportRow(index, checked) {
    const orders = window.importOrdersState.parsedOrders;
    if (orders[index]) {
        orders[index].selected = checked;
        if (checked) {
            window.importOrdersState.selectedRows.add(index);
        } else {
            window.importOrdersState.selectedRows.delete(index);
        }
    }
    updateImportSelectAll();
}

// Toggle todas as linhas
function toggleAllImportRows(checked) {
    const orders = window.importOrdersState.parsedOrders;
    orders.forEach((order, idx) => {
        order.selected = checked;
        if (checked) {
            window.importOrdersState.selectedRows.add(idx);
        } else {
            window.importOrdersState.selectedRows.delete(idx);
        }
    });
    renderImportPreview(orders);
}

function updateImportSelectAll() {
    const checkbox = document.getElementById('import-select-all');
    const orders = window.importOrdersState.parsedOrders;
    const allSelected = orders.every(o => o.selected);
    const someSelected = orders.some(o => o.selected);
    
    if (checkbox) {
        checkbox.checked = allSelected;
        checkbox.indeterminate = someSelected && !allSelected;
    }
}

// Executar importação
async function executeImportOrders() {
    const orders = window.importOrdersState.parsedOrders.filter(o => o.selected);
    
    if (orders.length === 0) {
        alert('Selecione pelo menos uma ordem para importar.');
        return;
    }
    
    const skipExisting = document.getElementById('import-skip-existing')?.checked ?? true;
    const defaultStatus = document.getElementById('import-default-status')?.value || 'from_file';
    const defaultMachine = document.getElementById('import-default-machine')?.value || '';
    
    // Mostrar status
    document.getElementById('import-config').classList.add('hidden');
    document.getElementById('import-preview').classList.add('hidden');
    document.getElementById('import-status').classList.remove('hidden');
    document.getElementById('import-result').classList.add('hidden');
    document.getElementById('import-progress-container').classList.remove('hidden');
    document.getElementById('import-execute-btn').disabled = true;
    
    let imported = 0;
    let skipped = 0;
    let errors = 0;
    
    try {
        // Verificar ordens existentes usando cache para economizar leituras
        const existingOrders = new Set();
        if (skipExisting) {
            const cachedOrders = await getProductionOrdersCached();
            cachedOrders.forEach(order => {
                if (order.order_number) {
                    existingOrders.add(String(order.order_number));
                }
            });
        }
        
        const batch = db.batch();
        const ordersToImport = [];
        
        for (const order of orders) {
            // Verificar se já existe
            if (skipExisting && existingOrders.has(order.order_number)) {
                skipped++;
                continue;
            }
            
            // Preparar dados da ordem
            const orderData = {
                order_number: order.order_number,
                part_code: order.part_code,
                product: order.part_name || order.part_code || '',
                product_cod: order.part_code,
                machine_id: defaultMachine || order.machine_id || '',
                machine_name: order.machine_full || '',
                customer: order.customer || '',
                lot_size: order.lot_size,
                total_produced: 0,
                remaining: order.remaining || order.lot_size,
                batch_number: order.batch_number || '',
                status: defaultStatus === 'from_file' ? (order.status || 'planejada') : defaultStatus,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                imported_at: firebase.firestore.FieldValue.serverTimestamp(),
                import_source: 'excel_erp'
            };
            
            console.log('[Import] Ordem preparada:', orderData);
            ordersToImport.push(orderData);
        }
        
        // Importar em lotes de 500 (limite do Firestore batch)
        const batchSize = 450;
        for (let i = 0; i < ordersToImport.length; i += batchSize) {
            const batchOrders = ordersToImport.slice(i, i + batchSize);
            const currentBatch = db.batch();
            
            for (const orderData of batchOrders) {
                const docRef = db.collection('production_orders').doc();
                currentBatch.set(docRef, orderData);
            }
            
            await currentBatch.commit();
            imported += batchOrders.length;
            
            // Atualizar progresso
            const progress = Math.round(((i + batchOrders.length) / ordersToImport.length) * 100);
            document.getElementById('import-progress-bar').style.width = `${progress}%`;
            document.getElementById('import-progress-text').textContent = `Importando... ${imported} de ${ordersToImport.length}`;
        }
        
        // Mostrar resultado
        document.getElementById('import-progress-container').classList.add('hidden');
        document.getElementById('import-result').classList.remove('hidden');
        
        if (imported > 0) {
            document.getElementById('import-result-icon').innerHTML = '<div class="p-4 bg-green-100 rounded-full inline-block"><i data-lucide="check-circle" class="w-12 h-12 text-green-600"></i></div>';
            document.getElementById('import-result-text').className = 'text-lg font-semibold text-green-700';
            document.getElementById('import-result-text').textContent = `${imported} ordem(s) importada(s) com sucesso!`;
        } else {
            document.getElementById('import-result-icon').innerHTML = '<div class="p-4 bg-amber-100 rounded-full inline-block"><i data-lucide="alert-circle" class="w-12 h-12 text-amber-600"></i></div>';
            document.getElementById('import-result-text').className = 'text-lg font-semibold text-amber-700';
            document.getElementById('import-result-text').textContent = 'Nenhuma ordem foi importada.';
        }
        
        let details = [];
        if (skipped > 0) details.push(`${skipped} ignorada(s) (já existem)`);
        if (errors > 0) details.push(`${errors} erro(s)`);
        document.getElementById('import-result-details').textContent = details.length > 0 ? details.join(' – ') : '';
        
        if (typeof lucide !== 'undefined') lucide.createIcons();
        
        // Invalidar cache e atualizar lista de ordens
        productionOrdersCache = null;
        
        // Atualizar lista de ordens após 1.5 segundos
        setTimeout(async () => {
            if (typeof loadOrdersAnalysis === 'function') {
                await loadOrdersAnalysis();
                showNotification('Lista de ordens atualizada!', 'info');
            }
        }, 1500);
        
    } catch (error) {
        console.error('[Import] Erro durante importação:', error);
        
        document.getElementById('import-progress-container').classList.add('hidden');
        document.getElementById('import-result').classList.remove('hidden');
        document.getElementById('import-result-icon').innerHTML = '<div class="p-4 bg-red-100 rounded-full inline-block"><i data-lucide="x-circle" class="w-12 h-12 text-red-600"></i></div>';
        document.getElementById('import-result-text').className = 'text-lg font-semibold text-red-700';
        document.getElementById('import-result-text').textContent = 'Erro durante a importação';
        document.getElementById('import-result-details').textContent = error.message;
        
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
}

// Expor funções globalmente
window.openImportOrdersModal = openImportOrdersModal;
window.closeImportOrdersModal = closeImportOrdersModal;
window.handleImportFileSelect = handleImportFileSelect;
window.clearImportFile = clearImportFile;
window.toggleImportRow = toggleImportRow;
window.toggleAllImportRows = toggleAllImportRows;
window.executeImportOrders = executeImportOrders;

// ====== CADASTRO DE NOVOS PRODUTOS ======

// Abrir modal de novo produto
function openNewProductModal() {
    const modal = document.getElementById('new-product-modal');
    if (modal) {
        modal.classList.remove('hidden');
        resetNewProductModal();
        populateNewProductMPSelect();
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
}

// Fechar modal de novo produto
function closeNewProductModal() {
    const modal = document.getElementById('new-product-modal');
    if (modal) {
        modal.classList.add('hidden');
        resetNewProductModal();
    }
}

// Resetar modal de novo produto
function resetNewProductModal() {
    const form = document.getElementById('new-product-form');
    if (form) form.reset();
    
    const feedback = document.getElementById('new-product-feedback');
    if (feedback) {
        feedback.classList.add('hidden');
        feedback.textContent = '';
    }
    
    const calcResult = document.getElementById('new-product-calc-result');
    if (calcResult) calcResult.textContent = '';
}

// Popular select de matéria-prima
function populateNewProductMPSelect() {
    const select = document.getElementById('new-product-mp');
    if (!select) return;
    
    select.innerHTML = '<option value="">Selecione (opcional)...</option>';
    
    // Usar o banco de matérias-primas se disponível
    if (typeof materiaPrimaDatabase !== 'undefined' && Array.isArray(materiaPrimaDatabase)) {
        materiaPrimaDatabase.forEach(mp => {
            const opt = document.createElement('option');
            opt.value = mp.codigo;
            opt.textContent = `${mp.codigo} - ${mp.descricao}`;
            select.appendChild(opt);
        });
    }
}

// Calcular meta de peças por hora
function calcularMetaPPH() {
    const cavities = parseFloat(document.getElementById('new-product-cavities')?.value) || 0;
    const cycle = parseFloat(document.getElementById('new-product-cycle')?.value) || 0;
    
    if (cavities <= 0 || cycle <= 0) {
        document.getElementById('new-product-calc-result').textContent = '⚠️ Preencha cavidades e ciclo';
        return;
    }
    
    const pph = Math.round((3600 / cycle) * cavities);
    document.getElementById('new-product-calc-result').textContent = `= ${pph.toLocaleString('pt-BR')} peças/hora`;
    document.getElementById('new-product-pph').value = pph;
}

// Mostrar feedback no modal
function showNewProductFeedback(message, type = 'info') {
    const feedback = document.getElementById('new-product-feedback');
    if (!feedback) return;
    
    feedback.classList.remove('hidden', 'bg-green-100', 'text-green-800', 'bg-red-100', 'text-red-800', 'bg-amber-100', 'text-amber-800');
    
    if (type === 'success') {
        feedback.classList.add('bg-green-100', 'text-green-800');
    } else if (type === 'error') {
        feedback.classList.add('bg-red-100', 'text-red-800');
    } else {
        feedback.classList.add('bg-amber-100', 'text-amber-800');
    }
    
    feedback.textContent = message;
}

// Salvar novo produto
async function saveNewProduct() {
    const cod = parseInt(document.getElementById('new-product-cod')?.value, 10);
    const client = document.getElementById('new-product-client')?.value?.trim();
    const name = document.getElementById('new-product-name')?.value?.trim();
    const cavities = parseInt(document.getElementById('new-product-cavities')?.value, 10);
    const cycle = parseFloat(document.getElementById('new-product-cycle')?.value);
    const weight = parseFloat(document.getElementById('new-product-weight')?.value);
    const pph = parseInt(document.getElementById('new-product-pph')?.value, 10);
    const mp = document.getElementById('new-product-mp')?.value || '';
    
    // Validações
    if (!cod || cod <= 0) {
        showNewProductFeedback('⚠️ Informe um código válido para o produto.', 'error');
        document.getElementById('new-product-cod')?.focus();
        return;
    }
    
    if (!client) {
        showNewProductFeedback('⚠️ Selecione o cliente.', 'error');
        document.getElementById('new-product-client')?.focus();
        return;
    }
    
    if (!name) {
        showNewProductFeedback('⚠️ Informe o nome do produto.', 'error');
        document.getElementById('new-product-name')?.focus();
        return;
    }
    
    if (!cavities || cavities <= 0) {
        showNewProductFeedback('⚠️ Informe um número válido de cavidades.', 'error');
        document.getElementById('new-product-cavities')?.focus();
        return;
    }
    
    if (!cycle || cycle <= 0) {
        showNewProductFeedback('⚠️ Informe um tempo de ciclo válido.', 'error');
        document.getElementById('new-product-cycle')?.focus();
        return;
    }
    
    if (!weight || weight <= 0) {
        showNewProductFeedback('⚠️ Informe um peso válido.', 'error');
        document.getElementById('new-product-weight')?.focus();
        return;
    }
    
    if (!pph || pph <= 0) {
        showNewProductFeedback('⚠️ Informe a meta de peças/hora. Use o botão Calcular.', 'error');
        document.getElementById('new-product-pph')?.focus();
        return;
    }
    
    try {
        showNewProductFeedback('ó Verificando código do produto...', 'info');
        
        // Verificar se o código já existe no Firestore
        const existingSnapshot = await db.collection('products')
            .where('cod', '==', cod)
            .get();
        
        if (!existingSnapshot.empty) {
            showNewProductFeedback(`❌ Já existe um produto com o código ${cod}.`, 'error');
            return;
        }
        
        showNewProductFeedback('ó Salvando produto...', 'info');
        
        // Criar objeto do produto
        const newProduct = {
            cod: cod,
            client: client,
            name: name,
            cavities: cavities,
            cycle: cycle,
            weight: weight,
            pieces_per_hour_goal: pph,
            mp: mp,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdBy: window.authSystem?.getCurrentUser?.()?.name || 'Sistema',
            source: 'manual_cadastro'
        };
        
        // Salvar no Firestore
        const docRef = await db.collection('products').add(newProduct);
        
        console.log('[PRODUTO] Novo produto cadastrado:', { id: docRef.id, ...newProduct });
        
        // Também adicionar ao productDatabase local se existir
        if (typeof productDatabase !== 'undefined' && Array.isArray(productDatabase)) {
            productDatabase.push({
                cod: cod,
                client: client,
                name: name,
                cavities: cavities,
                cycle: cycle,
                weight: weight,
                pieces_per_hour_goal: pph,
                mp: mp
            });
        }
        
        showNewProductFeedback(`✅ Produto ${cod} - ${name} cadastrado com sucesso!`, 'success');
        
        // Notificação de sucesso
        if (typeof showNotification === 'function') {
            showNotification(`Produto ${cod} cadastrado com sucesso!`, 'success');
        }
        
        // Fechar modal após 2 segundos
        setTimeout(() => {
            closeNewProductModal();
        }, 2000);
        
    } catch (error) {
        console.error('[PRODUTO] Erro ao salvar:', error);
        showNewProductFeedback(`❌ Erro ao salvar: ${error.message}`, 'error');
    }
}

// Expor funções globalmente
window.openNewProductModal = openNewProductModal;
window.closeNewProductModal = closeNewProductModal;
window.calcularMetaPPH = calcularMetaPPH;
window.saveNewProduct = saveNewProduct;


// Configurar drag and drop para o modal de importação
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        const uploadArea = document.getElementById('import-upload-area');
        if (uploadArea) {
            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                uploadArea.addEventListener(eventName, preventDefaults, false);
            });
            
            function preventDefaults(e) {
                e.preventDefault();
                e.stopPropagation();
            }
            
            ['dragenter', 'dragover'].forEach(eventName => {
                uploadArea.addEventListener(eventName, () => {
                    uploadArea.classList.add('border-indigo-500', 'bg-indigo-50');
                }, false);
            });
            
            ['dragleave', 'drop'].forEach(eventName => {
                uploadArea.addEventListener(eventName, () => {
                    uploadArea.classList.remove('border-indigo-500', 'bg-indigo-50');
                }, false);
            });
            
            uploadArea.addEventListener('drop', (e) => {
                const files = e.dataTransfer.files;
                if (files.length > 0) {
                    const file = files[0];
                    if (file.name.match(/\.(xlsx|xls)$/i)) {
                        document.getElementById('import-file-input').files = files;
                        handleImportFileSelect({ target: { files: [file] } });
                    } else {
                        alert('Por favor, selecione um arquivo Excel (.xlsx ou .xls)');
                    }
                }
            }, false);
        }
    }, 1000);
});

// ===== Importador de Ordens em Lote (Excel) =====

function parseImportNumber(value) {
    if (value === null || value === undefined || value === '') return null;

    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
    }

    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return null;

        const normalized = trimmed
            .replace(/\s+/g, '')
            .replace(/\./g, '')
            .replace(',', '.');

        const parsed = Number(normalized);
        return Number.isFinite(parsed) ? parsed : null;
    }

    const fallback = Number(value);
    return Number.isFinite(fallback) ? fallback : null;
}

// Converter data do Excel para formato ISO
function excelDateToISO(excelDate) {
    if (!excelDate) return new Date().toISOString().split('T')[0];
    
    // Se for número (data do Excel)
    if (typeof excelDate === 'number') {
        const date = new Date((excelDate - 25569) * 86400 * 1000);
        return date.toISOString().split('T')[0];
    }
    
    // Se for string
    if (typeof excelDate === 'string') {
        const parsed = new Date(excelDate);
        if (!isNaN(parsed)) {
            return parsed.toISOString().split('T')[0];
        }
    }
    
    return new Date().toISOString().split('T')[0];
}

// Mapear nomes de colunas flexíveis
function mapColumnValue(row, possibleNames) {
    for (const name of possibleNames) {
        if (row[name] !== undefined && row[name] !== null && row[name] !== '') {
            return String(row[name]).trim();
        }
    }
    return '';
}

async function handleProductionOrdersImport(file) {
    if (!file) {
        alert('Selecione um arquivo.');
        return;
    }

    const statusElement = document.getElementById('import-orders-status');
    if (statusElement) {
        statusElement.textContent = 'Lendo arquivo Excel...';
        statusElement.className = 'text-sm font-semibold text-blue-600';
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            
            // Pegar primeira planilha
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            
            // Converter para JSON
            const jsonData = XLSX.utils.sheet_to_json(worksheet);
            
            if (jsonData.length === 0) {
                alert('Arquivo vazio ou sem dados.');
                if (statusElement) statusElement.textContent = '';
                return;
            }

            // Processar linhas de dados
            const orders = [];
            for (let i = 0; i < jsonData.length; i++) {
                const row = jsonData[i];
                
                // Mapeamento flexível de colunas (aceita diferentes nomes)
                const numeroOP = mapColumnValue(row, ['numero_op', 'Numero_OP', 'Número OP', 'OP', 'op', 'ordem', 'Ordem', 'numero', 'Numero']);
                const codProduto = mapColumnValue(row, ['cod_produto', 'Cod_Produto', 'Código Produto', 'codigo_produto', 'produto', 'Produto', 'cod', 'Cod']);
                const codMP = mapColumnValue(row, ['cod_mp', 'Cod_MP', 'MP', 'mp', 'materia_prima', 'Matéria Prima', 'Materia Prima']);
                const maquina = mapColumnValue(row, ['maquina', 'Maquina', 'Máquina', 'machine', 'Machine']);
                const cliente = mapColumnValue(row, ['cliente', 'Cliente', 'customer', 'Customer']);
                const tamLote = mapColumnValue(row, ['tam_lote', 'Tam_Lote', 'Lote', 'lote', 'quantidade', 'Quantidade', 'qtd', 'Qtd', 'lot_size']);
                const numeroLote = mapColumnValue(row, ['numero_lote', 'Numero_Lote', 'batch', 'Batch', 'lote_numero']);
                const dataOrdem = row['data'] || row['Data'] || row['date'] || row['Date'] || '';
                
                // Validar campos obrigatórios
                if (!numeroOP || !codProduto || !maquina || !tamLote) {
                    console.warn(`Linha ${i + 2} incompleta (faltam campos obrigatórios), pulando...`);
                    continue;
                }

                orders.push({
                    order_number: numeroOP.toUpperCase().trim(),
                    part_code: codProduto.trim(),
                    raw_material: codMP.trim(),
                    machine_id: maquina.trim(),
                    customer: cliente.trim(),
                    lot_size: parseImportNumber(tamLote),
                    batch_number: numeroLote.trim(),
                    date: excelDateToISO(dataOrdem),
                    status: 'planejada'
                });
            }

            if (orders.length === 0) {
                alert('Nenhuma ordem válida encontrada no arquivo. Verifique se as colunas estão corretas.');
                if (statusElement) statusElement.textContent = '';
                return;
            }

            if (statusElement) {
                statusElement.textContent = `${orders.length} ordem(s) encontrada(s). Verificando...`;
            }

            // Mostrar prévia em modal
            showImportPreview(orders);
        } catch (error) {
            console.error('Erro ao processar arquivo Excel:', error);
            alert('Erro ao processar arquivo. Verifique se é um arquivo Excel válido (.xlsx)');
            if (statusElement) statusElement.textContent = '';
        }
    };
    reader.readAsArrayBuffer(file);
}

function showImportPreview(orders) {
    const previewContent = `
        <div class="space-y-4">
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p class="text-sm text-blue-700"><strong>Total de ordens:</strong> ${orders.length}</p>
            </div>
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200 border border-gray-300 text-xs">
                    <thead class="bg-gray-100">
                        <tr>
                            <th class="px-3 py-2 text-left font-semibold">OP Nú</th>
                            <th class="px-3 py-2 text-left font-semibold">Produto</th>
                            <th class="px-3 py-2 text-left font-semibold">MP</th>
                            <th class="px-3 py-2 text-left font-semibold">Máquina</th>
                            <th class="px-3 py-2 text-left font-semibold">Cliente</th>
                            <th class="px-3 py-2 text-right font-semibold">Lote</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${orders.slice(0, 10).map(o => `
                            <tr class="border-t hover:bg-gray-50">
                                <td class="px-3 py-2">${o.order_number}</td>
                                <td class="px-3 py-2">${o.part_code}</td>
                                <td class="px-3 py-2">${o.raw_material}</td>
                                <td class="px-3 py-2">${o.machine_id}</td>
                                <td class="px-3 py-2">${o.customer}</td>
                                <td class="px-3 py-2 text-right">${o.lot_size}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                ${orders.length > 10 ? `<p class="text-xs text-gray-500 mt-2">... e mais ${orders.length - 10} ordens</p>` : ''}
            </div>
        </div>
    `;

    // Criar modal simples
    const modal = document.createElement('div');
    modal.id = 'import-preview-modal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
    modal.innerHTML = `
        <div class="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-96 overflow-y-auto p-6">
            <h3 class="text-lg font-bold text-gray-900 mb-4">Prévia da Importação</h3>
            ${previewContent}
            <div class="mt-6 flex gap-3">
                <button id="confirm-import-btn" class="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg">
                    Confirmar Importação
                </button>
                <button id="cancel-import-btn" class="flex-1 bg-gray-400 hover:bg-gray-500 text-white font-semibold py-2 px-4 rounded-lg">
                    Cancelar
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('confirm-import-btn').addEventListener('click', () => {
        confirmImportOrders(orders);
        modal.remove();
    });

    document.getElementById('cancel-import-btn').addEventListener('click', () => {
        modal.remove();
    });
}

async function confirmImportOrders(orders) {
    const statusElement = document.getElementById('import-orders-status');
    if (!statusElement) return;

    statusElement.textContent = 'Importando ordens...';
    statusElement.className = 'text-sm font-semibold text-blue-600';

    let successCount = 0;
    let errorCount = 0;

    for (const order of orders) {
        try {
            // Buscar produto para extrair dados usando função helper
            const product = getProductByCode(order.part_code);

            const docData = {
                order_number: order.order_number,
                order_number_original: order.order_number,
                part_code: order.part_code,
                product_cod: order.part_code,
                product: product?.name || '',
                customer: order.customer || (product?.client || ''),
                client: order.customer || (product?.client || ''),
                raw_material: order.raw_material,
                lot_size: parseImportNumber(order.lot_size),
                batch_number: order.batch_number,
                machine_id: order.machine_id || null,
                status: 'planejada',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            if (product) {
                docData.product_snapshot = {
                    cod: product.cod || order.part_code,
                    client: product.client || '',
                    name: product.name || '',
                    cavities: parseImportNumber(product.cavities),
                    cycle: parseImportNumber(product.cycle),
                    weight: parseImportNumber(product.weight),
                    mp: product.mp || order.raw_material
                };
            }

            // Verificar duplicação de número de OP
            const existing = await db.collection('production_orders')
                .where('order_number', '==', order.order_number)
                .limit(1)
                .get();

            if (!existing.empty) {
                console.warn(`OP ${order.order_number} já existe, pulando...`);
                errorCount++;
                continue;
            }

            const docRef = await db.collection('production_orders').add(docData);
            successCount++;
            
            // Registrar log de importação
            registrarLogSistema('IMPORTAÇÃO DE ORDEM DE PRODUÇÃO', 'ordem', {
                orderId: docRef.id,
                orderNumber: order.order_number,
                product: docData.product,
                lotSize: docData.lot_size
            });
        } catch (error) {
            console.error(`Erro ao importar OP ${order.order_number}:`, error);
            errorCount++;
        }
    }

    statusElement.textContent = `Importação concluída: ${successCount} ordens importadas, ${errorCount} erros.`;
    statusElement.className = errorCount === 0 ? 'text-sm font-semibold text-green-600' : 'text-sm font-semibold text-orange-600';

    // Atualizar lista de ordens
    setTimeout(() => {
        loadProductionOrders();
        document.getElementById('import-orders-file').value = '';
        statusElement.textContent = '';
    }, 2000);
}

// Download template Excel
function downloadExcelTemplate() {
    const headers = ['numero_op', 'cod_produto', 'cod_mp', 'maquina', 'cliente', 'tam_lote', 'numero_lote', 'data'];
    const exampleRows = [
        ['OP-001', 'PROD001', 'MP001', 'H-01', 'Cliente A', 5000, 'LOTE-001', '2025-11-27'],
        ['OP-002', 'PROD002', 'MP002', 'H-05', 'Cliente B', 3000, 'LOTE-002', '2025-11-27'],
        ['OP-003', 'PROD001', 'MP001', 'H-11', 'Cliente A', 7500, 'LOTE-003', '2025-11-27']
    ];
    
    // Criar workbook e worksheet
    const ws = XLSX.utils.aoa_to_sheet([headers, ...exampleRows]);
    
    // Formatar largura das colunas
    ws['!cols'] = [
        { wch: 12 }, // numero_op
        { wch: 12 }, // cod_produto
        { wch: 10 }, // cod_mp
        { wch: 10 }, // maquina
        { wch: 15 }, // cliente
        { wch: 10 }, // tam_lote
        { wch: 12 }, // numero_lote
        { wch: 12 }  // data
    ];
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ordens');
    
    // Salvar arquivo
    XLSX.writeFile(wb, 'template_ordens.xlsx');
}

// Event listeners para importação
document.addEventListener('DOMContentLoaded', () => {
    const importBtn = document.getElementById('btn-import-orders');
    const importFile = document.getElementById('import-orders-file');
    const downloadTemplateBtn = document.getElementById('download-excel-template');

    if (importBtn && importFile) {
        importBtn.addEventListener('click', () => {
            const file = importFile.files[0];
            if (file) {
                handleProductionOrdersImport(file);
            } else {
                alert('Selecione um arquivo Excel (.xlsx).');
            }
        });
    }

    if (downloadTemplateBtn) {
        downloadTemplateBtn.addEventListener('click', downloadExcelTemplate);
    }
});

// ====================================
// DEBUG/TESTE - Disponível via console
// ====================================
// As funções de debug estão expostas dentro do DOMContentLoaded principal
// Use window._syncDebug para acessar funções de diagnóstico

document.addEventListener('DOMContentLoaded', () => {
    const refreshBtn = document.getElementById('traceability-refresh-btn');
    if (!refreshBtn) return;

    refreshBtn.dataset.defaultLabel = refreshBtn.innerHTML;

    refreshBtn.addEventListener('click', async () => {
        if (!window.traceabilitySystem) {
            console.warn('[TRACEABILITY] Sistema não inicializado');
            return;
        }

        refreshBtn.disabled = true;
        refreshBtn.classList.add('opacity-60', 'cursor-not-allowed');
        refreshBtn.innerHTML = '<span class="flex items-center gap-2"><i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i>Atualizando...</span>';
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }

        try {
            await window.traceabilitySystem.initialize();
        } catch (error) {
            console.error('[TRACEABILITY] Erro ao atualizar via botão:', error);
        } finally {
            refreshBtn.disabled = false;
            refreshBtn.classList.remove('opacity-60', 'cursor-not-allowed');
            refreshBtn.innerHTML = refreshBtn.dataset.defaultLabel;
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
        }
    });
});
