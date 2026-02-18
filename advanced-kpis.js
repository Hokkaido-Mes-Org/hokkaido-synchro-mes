/**
 * Syncrho v8.0 - KPIs Avançados
 * Módulo de indicadores avançados: MTBF, MTTR, FPY, Cost per Unit
 */

// Verificar dependências globais
if (typeof getFilteredData === 'undefined' && typeof window.getFilteredData === 'undefined') {
    console.warn('[ADVANCED-KPIs] Função getFilteredData não encontrada. Carregue predictive-analytics.js ou traceability-system.js antes.');
}
if (typeof formatDate === 'undefined' && typeof window.formatDate === 'undefined') {
    console.warn('[ADVANCED-KPIs] Função formatDate não encontrada. Carregue predictive-analytics.js ou traceability-system.js antes.');
}

class AdvancedKPIs {
    constructor() {
        this.cache = {
            mtbf: null,
            mttr: null,
            fpy: null,
            costPerUnit: null,
            lastUpdate: null
        };
        this.updateInterval = null;
    }

    // Inicializar sistema de KPIs avançados
    async initialize() {
        console.log('[ADVANCED-KPIs] Inicializando sistema de KPIs avançados');
        
        // Calcular KPIs iniciais
        await this.calculateAllKPIs();
        
        // Configurar atualização automática (a cada hora)
        this.setupAutoUpdate();
        
        console.log('[ADVANCED-KPIs] Sistema de KPIs avançados ativo');
    }

    // Configurar atualizações automáticas
    setupAutoUpdate() {
        // Atualizar a cada hora
        this.updateInterval = setInterval(() => {
            this.calculateAllKPIs();
        }, 60 * 60 * 1000);
    }

    // Calcular todos os KPIs
    async calculateAllKPIs() {
        try {
            console.log('[ADVANCED-KPIs] Calculando KPIs avançados...');
            
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(endDate.getDate() - 30); // 30 dias de histórico

            // Carregar dados necessários
            const [production, losses, downtime, planning] = await Promise.all([
                getFilteredData('production', formatDate(startDate), formatDate(endDate)),
                getFilteredData('losses', formatDate(startDate), formatDate(endDate)),
                getFilteredData('downtime', formatDate(startDate), formatDate(endDate)),
                getFilteredData('planning', formatDate(startDate), formatDate(endDate))
            ]);

            // Calcular cada KPI
            const mtbf = await this.calculateMTBF(production, downtime);
            const mttr = await this.calculateMTTR(downtime);
            const fpy = await this.calculateFPY(production, losses);
            const costPerUnit = await this.calculateCostPerUnit(production, downtime, planning);

            // Atualizar cache
            this.cache = {
                mtbf,
                mttr,
                fpy,
                costPerUnit,
                lastUpdate: new Date()
            };

            // Atualizar interface se estiver na aba de analytics
            this.updateKPIInterface();

            console.log('[ADVANCED-KPIs] KPIs calculados:', this.cache);

        } catch (error) {
            console.error('[ADVANCED-KPIs] Erro ao calcular KPIs:', error);
        }
    }

    // MTBF - Mean Time Between Failures
    async calculateMTBF(productionData, downtimeData) {
        try {
            // Agrupar por máquina
            const machines = [...new Set(productionData.map(p => p.machine))];
            const mtbfByMachine = {};
            let totalMTBF = 0;

            for (const machine of machines) {
                // Produção da máquina
                const machineProduction = productionData.filter(p => p.machine === machine);
                
                // Paradas da máquina (apenas não planejadas)
                const machineDowntime = downtimeData.filter(d => 
                    d.machine === machine && 
                    !this.isPlannedDowntime(d.reason)
                );

                if (machineDowntime.length === 0) {
                    mtbfByMachine[machine] = { mtbf: Infinity, failures: 0 };
                    continue;
                }

                // Calcular tempo total de operação (em horas)
                const totalOperationHours = this.calculateOperationHours(machineProduction);
                
                // Número de falhas (paradas não planejadas)
                const failures = machineDowntime.length;
                
                // MTBF = Tempo Total de Operação / Número de Falhas
                const mtbf = failures > 0 ? totalOperationHours / failures : Infinity;
                
                mtbfByMachine[machine] = {
                    mtbf: mtbf,
                    failures: failures,
                    operationHours: totalOperationHours
                };

                if (mtbf !== Infinity) {
                    totalMTBF += mtbf;
                }
            }

            const validMachines = Object.values(mtbfByMachine).filter(m => m.mtbf !== Infinity);
            const averageMTBF = validMachines.length > 0 ? 
                validMachines.reduce((sum, m) => sum + m.mtbf, 0) / validMachines.length : 0;

            return {
                average: averageMTBF,
                byMachine: mtbfByMachine,
                unit: 'horas',
                benchmark: 168, // 1 semana = benchmark industrial
                status: averageMTBF >= 168 ? 'excellent' : averageMTBF >= 72 ? 'good' : 'needs_improvement'
            };

        } catch (error) {
            console.error('[ADVANCED-KPIs] Erro ao calcular MTBF:', error);
            return { average: 0, byMachine: {}, unit: 'horas', status: 'error' };
        }
    }

    // MTTR - Mean Time To Repair
    async calculateMTTR(downtimeData) {
        try {
            // Filtrar apenas paradas não planejadas
            const unplannedDowntime = downtimeData.filter(d => !this.isPlannedDowntime(d.reason));
            
            if (unplannedDowntime.length === 0) {
                return { average: 0, byMachine: {}, unit: 'minutos', status: 'excellent' };
            }

            // Agrupar por máquina
            const machines = [...new Set(unplannedDowntime.map(d => d.machine))];
            const mttrByMachine = {};

            for (const machine of machines) {
                const machineDowntime = unplannedDowntime.filter(d => d.machine === machine);
                const totalDowntime = machineDowntime.reduce((sum, d) => sum + (d.duration || 0), 0);
                const repairs = machineDowntime.length;
                
                const mttr = repairs > 0 ? totalDowntime / repairs : 0;
                
                mttrByMachine[machine] = {
                    mttr: mttr,
                    repairs: repairs,
                    totalDowntime: totalDowntime
                };
            }

            // MTTR médio de todas as máquinas
            const allMTTR = Object.values(mttrByMachine).map(m => m.mttr);
            const averageMTTR = allMTTR.length > 0 ? 
                allMTTR.reduce((sum, mttr) => sum + mttr, 0) / allMTTR.length : 0;

            return {
                average: averageMTTR,
                byMachine: mttrByMachine,
                unit: 'minutos',
                benchmark: 60, // 1 hora = benchmark
                status: averageMTTR <= 30 ? 'excellent' : averageMTTR <= 60 ? 'good' : 'needs_improvement'
            };

        } catch (error) {
            console.error('[ADVANCED-KPIs] Erro ao calcular MTTR:', error);
            return { average: 0, byMachine: {}, unit: 'minutos', status: 'error' };
        }
    }

    // FPY - First Pass Yield
    async calculateFPY(productionData, lossesData) {
        try {
            // Agrupar por lote/produto
            const batchData = this.groupProductionByBatch(productionData, lossesData);
            
            let totalFirstPass = 0;
            let totalProcessed = 0;
            const fpyByProduct = {};

            for (const [product, batches] of Object.entries(batchData)) {
                let productFirstPass = 0;
                let productTotal = 0;

                for (const batch of batches) {
                    const produced = batch.produced || 0;
                    const rejected = batch.rejected || 0;
                    const firstPass = Math.max(0, produced - rejected);
                    
                    productFirstPass += firstPass;
                    productTotal += produced;
                }

                const fpyRate = productTotal > 0 ? (productFirstPass / productTotal) * 100 : 100;
                
                fpyByProduct[product] = {
                    fpy: fpyRate,
                    firstPass: productFirstPass,
                    total: productTotal
                };

                totalFirstPass += productFirstPass;
                totalProcessed += productTotal;
            }

            const overallFPY = totalProcessed > 0 ? (totalFirstPass / totalProcessed) * 100 : 100;

            return {
                overall: overallFPY,
                byProduct: fpyByProduct,
                unit: '%',
                benchmark: 95, // 95% = benchmark
                status: overallFPY >= 98 ? 'excellent' : overallFPY >= 95 ? 'good' : 'needs_improvement'
            };

        } catch (error) {
            console.error('[ADVANCED-KPIs] Erro ao calcular FPY:', error);
            return { overall: 0, byProduct: {}, unit: '%', status: 'error' };
        }
    }

    // Cost per Unit - Custo por Unidade
    async calculateCostPerUnit(productionData, downtimeData, planningData) {
        try {
            // Parâmetros de custo (em produção, estes viriam do sistema ERP)
            const costParameters = {
                laborCostPerHour: 50.00, // R$ por hora
                machineOperationCostPerHour: 80.00, // R$ por hora
                materialCostPerKg: 5.50, // R$ por kg
                downtimeCostPerHour: 120.00 // R$ por hora de parada
            };

            const costByProduct = {};
            const products = [...new Set(productionData.map(p => p.product).filter(Boolean))];

            for (const product of products) {
                // Dados do produto
                const productProduction = productionData.filter(p => p.product === product);
                const productPlanning = planningData.find(p => p.product === product);
                
                if (!productPlanning) continue;

                // Calcular quantidades
                const totalProduced = productProduction.reduce((sum, p) => sum + (p.quantity || 0), 0);
                const totalTimeHours = productProduction.reduce((sum, p) => sum + (p.durationMin || 0), 0) / 60;
                
                // Calcular custos
                const laborCost = totalTimeHours * costParameters.laborCostPerHour;
                const machineCost = totalTimeHours * costParameters.machineOperationCostPerHour;
                
                // Custo de material (baseado no peso da peça)
                const pieceWeight = productPlanning.piece_weight || 0;
                const materialCost = (totalProduced * pieceWeight / 1000) * costParameters.materialCostPerKg;
                
                // Custo de parada
                const productDowntime = downtimeData.filter(d => 
                    productProduction.some(p => p.machine === d.machine && p.date === d.date)
                );
                const downtimeHours = productDowntime.reduce((sum, d) => sum + (d.duration || 0), 0) / 60;
                const downtimeCost = downtimeHours * costParameters.downtimeCostPerHour;
                
                // Custo total e custo por unidade
                const totalCost = laborCost + machineCost + materialCost + downtimeCost;
                const costPerUnit = totalProduced > 0 ? totalCost / totalProduced : 0;

                costByProduct[product] = {
                    costPerUnit: costPerUnit,
                    totalCost: totalCost,
                    totalProduced: totalProduced,
                    breakdown: {
                        labor: laborCost,
                        machine: machineCost,
                        material: materialCost,
                        downtime: downtimeCost
                    },
                    pieceWeight: pieceWeight
                };
            }

            // Calcular custo médio ponderado
            const totalCosts = Object.values(costByProduct).reduce((sum, p) => sum + p.totalCost, 0);
            const totalUnits = Object.values(costByProduct).reduce((sum, p) => sum + p.totalProduced, 0);
            const averageCostPerUnit = totalUnits > 0 ? totalCosts / totalUnits : 0;

            return {
                average: averageCostPerUnit,
                byProduct: costByProduct,
                unit: 'R$',
                totalCosts: totalCosts,
                totalUnits: totalUnits,
                status: 'calculated'
            };

        } catch (error) {
            console.error('[ADVANCED-KPIs] Erro ao calcular Cost per Unit:', error);
            return { average: 0, byProduct: {}, unit: 'R$', status: 'error' };
        }
    }

    // Helpers
    isPlannedDowntime(reason) {
        const plannedReasons = [
            'MANUTENÇÃO PROGRAMADA',
            'SETUP',
            'TROCA DE FERRAMENTA',
            'LIMPEZA',
            'PAUSA',
            'REFEIÇÃO',
            'SEM PROGRAMAÇÃO',
            'SEM PEDIDO'
        ];
        return plannedReasons.some(planned => 
            reason && reason.toUpperCase().includes(planned)
        );
    }

    calculateOperationHours(productionData) {
        // Simplificado: usar soma de tempo de produção
        // Em produção, seria calculado com base no tempo de máquina ligada
        return productionData.reduce((sum, p) => sum + (p.durationMin || 60), 0) / 60;
    }

    groupProductionByBatch(productionData, lossesData) {
        const batches = {};
        
        // Agrupar produção por produto
        productionData.forEach(prod => {
            const product = prod.product || 'UNKNOWN';
            if (!batches[product]) {
                batches[product] = [];
            }
            
            // Encontrar perdas correspondentes
            const relatedLosses = lossesData.filter(loss => 
                loss.machine === prod.machine && 
                loss.date === prod.date &&
                loss.shift === prod.shift
            );
            
            const totalLosses = relatedLosses.reduce((sum, l) => sum + (l.quantity || 0), 0);
            
            batches[product].push({
                produced: prod.quantity || 0,
                rejected: totalLosses,
                date: prod.date,
                machine: prod.machine
            });
        });

        return batches;
    }

    // Atualizar interface com KPIs
    updateKPIInterface() {
        this.updateMTBFCard();
        this.updateMTTRCard();
        this.updateFPYCard();
        this.updateCostPerUnitCard();
    }

    updateMTBFCard() {
        const mtbf = this.cache.mtbf;
        if (!mtbf) return;

        const mtbfValueEl = document.getElementById('mtbf-value');
        const mtbfStatusEl = document.getElementById('mtbf-status');
        const mtbfTrendEl = document.getElementById('mtbf-trend');

        if (mtbfValueEl) {
            mtbfValueEl.textContent = `${mtbf.average.toFixed(1)}h`;
        }

        if (mtbfStatusEl) {
            const statusConfig = {
                excellent: { text: 'Excelente', class: 'text-green-600' },
                good: { text: 'Bom', class: 'text-yellow-600' },
                needs_improvement: { text: 'Precisa Melhorar', class: 'text-red-600' },
                error: { text: 'Erro', class: 'text-gray-600' }
            };
            
            const config = statusConfig[mtbf.status] || statusConfig.error;
            mtbfStatusEl.textContent = config.text;
            mtbfStatusEl.className = `text-sm ${config.class}`;
        }

        if (mtbfTrendEl) {
            const trend = mtbf.average >= mtbf.benchmark ? 'up' : 'down';
            mtbfTrendEl.innerHTML = trend === 'up' ? 
                '<i data-lucide="trending-up" class="w-4 h-4 text-green-600"></i>' :
                '<i data-lucide="trending-down" class="w-4 h-4 text-red-600"></i>';
        }
    }

    updateMTTRCard() {
        const mttr = this.cache.mttr;
        if (!mttr) return;

        const mttrValueEl = document.getElementById('mttr-value');
        const mttrStatusEl = document.getElementById('mttr-status');

        if (mttrValueEl) {
            mttrValueEl.textContent = `${mttr.average.toFixed(0)} min`;
        }

        if (mttrStatusEl) {
            const statusConfig = {
                excellent: { text: 'Excelente', class: 'text-green-600' },
                good: { text: 'Bom', class: 'text-yellow-600' },
                needs_improvement: { text: 'Precisa Melhorar', class: 'text-red-600' },
                error: { text: 'Erro', class: 'text-gray-600' }
            };
            
            const config = statusConfig[mttr.status] || statusConfig.error;
            mttrStatusEl.textContent = config.text;
            mttrStatusEl.className = `text-sm ${config.class}`;
        }
    }

    updateFPYCard() {
        const fpy = this.cache.fpy;
        if (!fpy) return;

        const fpyValueEl = document.getElementById('fpy-value');
        const fpyStatusEl = document.getElementById('fpy-status');

        if (fpyValueEl) {
            fpyValueEl.textContent = `${fpy.overall.toFixed(1)}%`;
        }

        if (fpyStatusEl) {
            const statusConfig = {
                excellent: { text: 'Excelente', class: 'text-green-600' },
                good: { text: 'Bom', class: 'text-yellow-600' },
                needs_improvement: { text: 'Precisa Melhorar', class: 'text-red-600' },
                error: { text: 'Erro', class: 'text-gray-600' }
            };
            
            const config = statusConfig[fpy.status] || statusConfig.error;
            fpyStatusEl.textContent = config.text;
            fpyStatusEl.className = `text-sm ${config.class}`;
        }
    }

    updateCostPerUnitCard() {
        const cost = this.cache.costPerUnit;
        if (!cost) return;

        const costValueEl = document.getElementById('cost-per-unit-value');
        const costTotalEl = document.getElementById('total-cost-value');

        if (costValueEl) {
            costValueEl.textContent = `R$ ${cost.average.toFixed(2)}`;
        }

        if (costTotalEl) {
            costTotalEl.textContent = `R$ ${cost.totalCosts.toFixed(0)}`;
        }
    }

    // Obter dados dos KPIs para exportação
    getKPIData() {
        return {
            ...this.cache,
            exportedAt: new Date()
        };
    }

    // Cleanup
    destroy() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
    }
}

// Instância global
window.advancedKPIs = new AdvancedKPIs();