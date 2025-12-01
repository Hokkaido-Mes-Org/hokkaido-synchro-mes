// =====================================
// 📊 MÓDULO DE RELATÓRIOS - v2.0
// =====================================
(function() {
    'use strict';
    
    console.log('📊 [REPORTS] Carregando módulo de relatórios...');

    // Estado do módulo
    let currentData = [];
    let currentPage = 1;
    let itemsPerPage = 20;
    let currentReportType = 'producao';

    // Aguardar DOM estar pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    function init() {
        console.log('📊 [REPORTS] Inicializando...');
        
        // Aguardar um pouco para garantir que tudo está carregado
        setTimeout(() => {
            setupEventListeners();
            populateMachines();
            console.log('📊 [REPORTS] Módulo inicializado com sucesso!');
        }, 500);
    }

    function setupEventListeners() {
        // Botão Gerar Relatório
        const generateBtn = document.getElementById('report-generate-btn');
        if (generateBtn) {
            generateBtn.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                console.log('📊 [REPORTS] Botão clicado!');
                gerarRelatorio();
            };
            console.log('📊 [REPORTS] Listener adicionado ao botão');
        } else {
            console.error('📊 [REPORTS] Botão report-generate-btn NÃO encontrado!');
        }

        // Período
        const periodSelect = document.getElementById('report-period');
        if (periodSelect) {
            periodSelect.onchange = function() {
                const customDates = document.getElementById('report-custom-dates');
                if (this.value === 'custom') {
                    customDates?.classList.remove('hidden');
                } else {
                    customDates?.classList.add('hidden');
                }
            };
        }

        // Radio buttons de tipo
        document.querySelectorAll('input[name="report-type-radio"]').forEach(radio => {
            radio.onchange = function() {
                currentReportType = this.value;
                // Atualizar visual
                document.querySelectorAll('.report-type-card .report-type-content').forEach(card => {
                    card.classList.remove('border-indigo-500', 'bg-indigo-50');
                    card.classList.add('border-gray-200');
                });
                const parentCard = this.closest('.report-type-card')?.querySelector('.report-type-content');
                if (parentCard) {
                    parentCard.classList.remove('border-gray-200');
                    parentCard.classList.add('border-indigo-500', 'bg-indigo-50');
                }
            };
        });

        // Exportar Excel
        const exportExcel = document.getElementById('report-export-excel');
        if (exportExcel) {
            exportExcel.onclick = exportarExcel;
        }

        // Exportar PDF
        const exportPdf = document.getElementById('report-export-pdf');
        if (exportPdf) {
            exportPdf.onclick = exportarPDF;
        }
    }

    function populateMachines() {
        const select = document.getElementById('report-machine');
        if (!select) return;

        select.innerHTML = '<option value="all">Todas Máquinas</option>';
        
        const machines = window.databaseModule?.machineDatabase || [];
        machines.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.id;
            opt.textContent = m.id;
            select.appendChild(opt);
        });
        console.log('📊 [REPORTS] Máquinas carregadas:', machines.length);
    }

    function calcularDatas() {
        const period = document.getElementById('report-period')?.value || '7days';
        const hoje = new Date();
        let inicio = new Date();
        let fim = new Date();

        switch (period) {
            case 'today':
                inicio = new Date(hoje);
                fim = new Date(hoje);
                break;
            case 'yesterday':
                inicio = new Date(hoje);
                inicio.setDate(inicio.getDate() - 1);
                fim = new Date(inicio);
                break;
            case '7days':
                inicio = new Date(hoje);
                inicio.setDate(inicio.getDate() - 7);
                fim = new Date(hoje);
                break;
            case '30days':
                inicio = new Date(hoje);
                inicio.setDate(inicio.getDate() - 30);
                fim = new Date(hoje);
                break;
            case 'month':
                inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
                fim = new Date(hoje);
                break;
            case 'lastmonth':
                inicio = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
                fim = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
                break;
            case 'custom':
                const startInput = document.getElementById('report-date-start')?.value;
                const endInput = document.getElementById('report-date-end')?.value;
                if (startInput && endInput) {
                    return { inicio: startInput, fim: endInput };
                }
                break;
        }

        const formatDate = (d) => {
            return d.getFullYear() + '-' + 
                   String(d.getMonth() + 1).padStart(2, '0') + '-' + 
                   String(d.getDate()).padStart(2, '0');
        };

        return { inicio: formatDate(inicio), fim: formatDate(fim) };
    }

    async function gerarRelatorio() {
        console.log('📊 [REPORTS] Gerando relatório...');
        
        // Mostrar loading
        mostrarLoading(true);
        esconderResultados();
        
        // Esconder mensagem inicial
        const initial = document.getElementById('report-initial');
        if (initial) initial.classList.add('hidden');

        // Verificar Firestore
        const db = window.db;
        if (!db) {
            mostrarToast('Banco de dados não disponível. Aguarde e tente novamente.', 'error');
            mostrarLoading(false);
            return;
        }

        // Obter filtros
        const { inicio, fim } = calcularDatas();
        const maquina = document.getElementById('report-machine')?.value || 'all';
        const turno = document.getElementById('report-shift')?.value || 'all';
        const tipo = document.querySelector('input[name="report-type-radio"]:checked')?.value || 'producao';

        console.log('📊 [REPORTS] Filtros:', { tipo, inicio, fim, maquina, turno });

        try {
            let dados = [];

            switch (tipo) {
                case 'producao':
                    dados = await buscarProducao(db, inicio, fim, maquina, turno);
                    break;
                case 'paradas':
                    dados = await buscarParadas(db, inicio, fim, maquina, turno);
                    break;
                case 'perdas':
                    dados = await buscarPerdas(db, inicio, fim, maquina, turno);
                    break;
                case 'consolidado':
                    dados = await buscarConsolidado(db, inicio, fim, maquina, turno);
                    break;
            }

            console.log('📊 [REPORTS] Dados encontrados:', dados.length);
            currentData = dados;
            currentReportType = tipo;

            if (dados.length === 0) {
                mostrarVazio(true);
                mostrarToast('Nenhum registro encontrado para o período selecionado.', 'warning');
            } else {
                atualizarKPIs(dados, tipo);
                renderizarTabela(dados, tipo);
                mostrarResultados();
                mostrarToast('Relatório gerado: ' + dados.length + ' registros.', 'success');
            }

        } catch (error) {
            console.error('📊 [REPORTS] Erro:', error);
            mostrarToast('Erro ao gerar relatório: ' + error.message, 'error');
        } finally {
            mostrarLoading(false);
        }
    }

    async function buscarProducao(db, inicio, fim, maquina, turno) {
        console.log('📊 [REPORTS] Buscando produção...');
        const agrupado = {};
        const ordensCache = {};
        const planosCache = {};
        
        try {
            const snapshot = await db.collection('production_entries')
                .where('data', '>=', inicio)
                .where('data', '<=', fim)
                .get();

            console.log('📊 [REPORTS] Documentos encontrados:', snapshot.size);

            // Coletar IDs únicos de ordens e planos para buscar
            const orderIds = new Set();
            const planIds = new Set();
            
            snapshot.forEach(doc => {
                const d = doc.data();
                if (d.orderId) orderIds.add(d.orderId);
                if (d.planId) planIds.add(d.planId);
            });

            // Buscar dados das OPs
            for (const orderId of orderIds) {
                try {
                    const orderDoc = await db.collection('production_orders').doc(orderId).get();
                    if (orderDoc.exists) {
                        const od = orderDoc.data();
                        ordensCache[orderId] = {
                            numero: od.order_number || od.orderNumber || orderId,
                            produto: od.product || od.productName || od.product_name || ''
                        };
                    }
                } catch (e) {
                    console.warn('📊 [REPORTS] Erro ao buscar OP:', orderId);
                }
            }

            // Buscar dados dos planos
            for (const planId of planIds) {
                try {
                    const planDoc = await db.collection('planning').doc(planId).get();
                    if (planDoc.exists) {
                        const pd = planDoc.data();
                        planosCache[planId] = {
                            produto: pd.product || pd.productName || ''
                        };
                    }
                } catch (e) {
                    console.warn('📊 [REPORTS] Erro ao buscar plano:', planId);
                }
            }

            snapshot.forEach(doc => {
                const d = doc.data();
                
                // Filtrar por máquina
                if (maquina !== 'all' && d.machine !== maquina) return;
                
                // Filtrar por turno
                if (turno !== 'all' && String(d.turno) !== turno) return;

                // Obter número da OP do cache
                let numeroOP = '-';
                let nomeProduto = d.mp || '-';
                
                if (d.orderId && ordensCache[d.orderId]) {
                    numeroOP = ordensCache[d.orderId].numero;
                    if (ordensCache[d.orderId].produto) {
                        nomeProduto = ordensCache[d.orderId].produto;
                    }
                }
                
                // Se não tem da OP, tentar do plano
                if (nomeProduto === '-' && d.planId && planosCache[d.planId]) {
                    if (planosCache[d.planId].produto) {
                        nomeProduto = planosCache[d.planId].produto;
                    }
                }

                // Chave única para agrupar: data + turno + máquina + ordem + produto
                const chave = `${d.data}|${d.turno}|${d.machine}|${numeroOP}|${nomeProduto}`;
                
                if (!agrupado[chave]) {
                    agrupado[chave] = {
                        data: d.data || '',
                        turno: d.turno || '',
                        maquina: d.machine || '',
                        ordem: numeroOP,
                        produto: nomeProduto,
                        quantidade: 0
                    };
                }
                
                agrupado[chave].quantidade += (d.produzido || 0);
            });
        } catch (e) {
            console.error('📊 [REPORTS] Erro ao buscar produção:', e);
        }

        // Converter para array e ordenar por data (mais recente primeiro)
        return Object.values(agrupado).sort((a, b) => b.data.localeCompare(a.data));
    }

    async function buscarParadas(db, inicio, fim, maquina, turno) {
        console.log('📊 [REPORTS] Buscando paradas...');
        console.log('📊 [REPORTS] Filtros - Início:', inicio, 'Fim:', fim, 'Máquina:', maquina);
        const entries = [];
        
        try {
            // Campo correto é 'date' (não 'data') conforme salvo em script.js
            const snapshot = await db.collection('downtime_entries')
                .where('date', '>=', inicio)
                .where('date', '<=', fim)
                .get();

            console.log('📊 [REPORTS] Documentos de paradas encontrados:', snapshot.size);

            snapshot.forEach(doc => {
                const d = doc.data();
                console.log('📊 [REPORTS] Parada encontrada:', d);
                
                if (maquina !== 'all' && d.machine !== maquina) return;
                if (turno !== 'all' && String(d.turno || d.shift) !== turno) return;

                entries.push({
                    id: doc.id,
                    data: d.date || d.data || '',
                    turno: d.turno || d.shift || '',
                    maquina: d.machine || '',
                    tipo: d.downtime_type || d.type || '',
                    motivo: d.reason || '',
                    duracao: d.duration || 0,
                    observacoes: d.observations || '',
                    operador: d.registradoPorNome || d.created_by || ''
                });
            });
        } catch (e) {
            console.error('📊 [REPORTS] Erro ao buscar paradas:', e);
        }

        console.log('📊 [REPORTS] Total de paradas após filtros:', entries.length);
        return entries;
    }

    async function buscarPerdas(db, inicio, fim, maquina, turno) {
        console.log('📊 [REPORTS] Buscando perdas...');
        const entries = [];
        
        try {
            const snapshot = await db.collection('production_entries')
                .where('data', '>=', inicio)
                .where('data', '<=', fim)
                .get();

            snapshot.forEach(doc => {
                const d = doc.data();
                const refugo = d.refugo_kg || d.refugo || 0;
                
                if (refugo <= 0) return;
                if (maquina !== 'all' && d.machine !== maquina) return;
                if (turno !== 'all' && String(d.turno) !== turno) return;

                entries.push({
                    id: doc.id,
                    data: d.data || '',
                    turno: d.turno || '',
                    maquina: d.machine || '',
                    ordem: d.orderId || '',
                    produto: d.mp || '',
                    tipo: 'Refugo',
                    quantidade: refugo,
                    motivo: d.perdas || '-',
                    operador: d.registradoPorNome || ''
                });
            });
        } catch (e) {
            console.error('📊 [REPORTS] Erro ao buscar perdas:', e);
        }

        return entries;
    }

    async function buscarConsolidado(db, inicio, fim, maquina, turno) {
        console.log('📊 [REPORTS] Buscando consolidado...');
        
        const producao = await buscarProducao(db, inicio, fim, maquina, turno);
        const paradas = await buscarParadas(db, inicio, fim, maquina, turno);
        const perdas = await buscarPerdas(db, inicio, fim, maquina, turno);

        // Agrupar por data
        const porData = {};
        
        producao.forEach(p => {
            if (!porData[p.data]) {
                porData[p.data] = { data: p.data, producao: 0, paradas: 0, perdas: 0, lancamentos: 0 };
            }
            porData[p.data].producao += p.produzido || 0;
            porData[p.data].lancamentos++;
        });

        paradas.forEach(p => {
            if (!porData[p.data]) {
                porData[p.data] = { data: p.data, producao: 0, paradas: 0, perdas: 0, lancamentos: 0 };
            }
            porData[p.data].paradas += p.duracao || 0;
        });

        perdas.forEach(p => {
            if (!porData[p.data]) {
                porData[p.data] = { data: p.data, producao: 0, paradas: 0, perdas: 0, lancamentos: 0 };
            }
            porData[p.data].perdas += p.quantidade || 0;
        });

        return Object.values(porData).sort((a, b) => b.data.localeCompare(a.data));
    }

    function atualizarKPIs(dados, tipo) {
        const kpisDiv = document.getElementById('report-kpis');
        if (!kpisDiv) return;

        let total = 0, secundario = 0, terciario = 0, registros = dados.length;

        if (tipo === 'producao') {
            total = dados.reduce((s, d) => s + (d.quantidade || 0), 0);
        } else if (tipo === 'paradas') {
            total = dados.reduce((s, d) => s + (d.duracao || 0), 0);
        } else if (tipo === 'perdas') {
            total = dados.reduce((s, d) => s + (d.quantidade || 0), 0);
        } else if (tipo === 'consolidado') {
            total = dados.reduce((s, d) => s + (d.producao || 0), 0);
            secundario = dados.reduce((s, d) => s + (d.paradas || 0), 0);
            terciario = dados.reduce((s, d) => s + (d.perdas || 0), 0);
        }

        // Atualizar elementos
        const kpi1 = document.getElementById('report-kpi-produced');
        const kpi2 = document.getElementById('report-kpi-downtime');
        const kpi3 = document.getElementById('report-kpi-losses');
        const kpi4 = document.getElementById('report-kpi-records');

        if (kpi1) kpi1.textContent = total.toLocaleString('pt-BR');
        if (kpi2) kpi2.textContent = secundario.toLocaleString('pt-BR');
        if (kpi3) kpi3.textContent = terciario.toLocaleString('pt-BR');
        if (kpi4) kpi4.textContent = registros.toLocaleString('pt-BR');

        kpisDiv.classList.remove('hidden');
    }

    function renderizarTabela(dados, tipo) {
        const tbody = document.getElementById('report-table-body');
        const thead = document.getElementById('report-table-head');
        if (!tbody || !thead) return;

        // Definir cabeçalhos por tipo
        let headers = [];
        if (tipo === 'producao') {
            headers = ['Data', 'Turno', 'Máquina', 'Nº OP', 'Produto', 'Qtd Total'];
        } else if (tipo === 'paradas') {
            headers = ['Data', 'Turno', 'Máquina', 'Tipo', 'Motivo', 'Duração (min)'];
        } else if (tipo === 'perdas') {
            headers = ['Data', 'Turno', 'Máquina', 'Nº OP', 'Produto', 'Qtd Total'];
        } else if (tipo === 'consolidado') {
            headers = ['Data', 'Produção Total', 'Paradas (min)', 'Perdas', 'Linhas'];
        }

        thead.innerHTML = '<tr>' + headers.map(h => `<th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">${h}</th>`).join('') + '</tr>';

        // Renderizar linhas
        tbody.innerHTML = dados.map(d => {
            let cells = [];
            if (tipo === 'producao') {
                cells = [
                    d.data, 
                    d.turno, 
                    d.maquina, 
                    d.ordem, 
                    d.produto, 
                    (d.quantidade || 0).toLocaleString('pt-BR')
                ];
            } else if (tipo === 'paradas') {
                cells = [d.data, d.turno, d.maquina, d.tipo, d.motivo, d.duracao];
            } else if (tipo === 'perdas') {
                cells = [
                    d.data, 
                    d.turno, 
                    d.maquina, 
                    d.ordem, 
                    d.produto, 
                    (d.quantidade || 0).toLocaleString('pt-BR')
                ];
            } else if (tipo === 'consolidado') {
                cells = [
                    d.data, 
                    (d.producao || 0).toLocaleString('pt-BR'), 
                    d.paradas, 
                    d.perdas, 
                    d.lancamentos
                ];
            }
            return '<tr class="border-b border-gray-100 hover:bg-gray-50">' + 
                   cells.map(c => `<td class="px-4 py-3 text-sm text-gray-700">${c || '-'}</td>`).join('') + 
                   '</tr>';
        }).join('');

        // Atualizar contagem
        const countEl = document.getElementById('report-count');
        if (countEl) countEl.textContent = dados.length + ' linhas';
    }

    function mostrarLoading(show) {
        const el = document.getElementById('report-loading');
        if (el) el.classList.toggle('hidden', !show);
    }

    function mostrarResultados() {
        const el = document.getElementById('report-results');
        if (el) el.classList.remove('hidden');
        
        const empty = document.getElementById('report-empty');
        if (empty) empty.classList.add('hidden');
    }

    function esconderResultados() {
        ['report-results', 'report-kpis', 'report-charts', 'report-empty'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('hidden');
        });
    }

    function mostrarVazio(show) {
        const el = document.getElementById('report-empty');
        if (el) el.classList.toggle('hidden', !show);
    }

    function mostrarToast(msg, tipo) {
        if (typeof window.showNotification === 'function') {
            window.showNotification(msg, tipo);
        } else {
            console.log('📊 [TOAST]', tipo, msg);
            if (tipo === 'error') alert(msg);
        }
    }

    function exportarExcel() {
        if (!currentData.length) {
            mostrarToast('Gere um relatório primeiro.', 'warning');
            return;
        }
        
        // Criar CSV simples
        const headers = Object.keys(currentData[0]);
        let csv = headers.join(';') + '\n';
        currentData.forEach(row => {
            csv += headers.map(h => row[h] || '').join(';') + '\n';
        });

        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'relatorio_' + currentReportType + '_' + new Date().toISOString().slice(0,10) + '.csv';
        link.click();
        
        mostrarToast('Relatório exportado!', 'success');
    }

    function exportarPDF() {
        mostrarToast('Use Ctrl+P para imprimir como PDF.', 'info');
        window.print();
    }

    // Expor globalmente
    window.ReportsModule = {
        init: init,
        gerarRelatorio: gerarRelatorio,
        generateReport: gerarRelatorio
    };

    console.log('📊 [REPORTS] Módulo carregado!');

})();
