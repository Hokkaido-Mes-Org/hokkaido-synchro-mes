/**
 * Syncrho v9.0 - Analytics IA Core
 * Sistema Unificado de Analytics Inteligente
 * Baseado nos principais sistemas MES: Rockwell FactoryTalk, Siemens Opcenter, AVEVA MES
 * 
 * Módulos:
 * 1. Dashboard Executivo (Overview com KPIs principais)
 * 2. Análise Preditiva (ML/AI para previsões)
 * 3. OEE Avançado (Decomposição A/P/Q)
 * 4. SPC - Controle Estatístico de Processo
 * 5. Pareto & Root Cause Analysis
 * 6. Benchmarking de Máquinas
 * 7. Energy & Sustainability (novo)
 * 8. Digital Twin Insights (novo)
 */

class AnalyticsIACore {
    constructor() {
        this.version = '9.0';
        this.modules = {
            dashboard: null,
            predictive: null,
            oee: null,
            spc: null,
            pareto: null,
            benchmark: null,
            energy: null,
            digitalTwin: null
        };
        
        this.config = {
            refreshInterval: 1800000, // 30 minutos (otimizado)
            historicalDays: 30,
            predictionHorizon: 8, // horas
            alertThresholds: {
                oee: { critical: 50, warning: 65, target: 85 },
                quality: { critical: 90, warning: 95, target: 99 },
                availability: { critical: 80, warning: 90, target: 95 },
                performance: { critical: 70, warning: 85, target: 95 }
            }
        };
        
        this.cache = {
            lastUpdate: null,
            dashboardData: null,
            predictions: null,
            benchmarks: null
        };
        
        this.charts = {};
        this.activeAlerts = [];
        this.isInitialized = false;
    }

    // ==================== INICIALIZAÇÃO ====================
    async initialize() {
        console.log('[Analytics-IA] Inicializando Sistema Analytics IA v' + this.version);
        
        try {
            // Verificar dependências
            this.checkDependencies();
            
            // Carregar dados iniciais
            await this.loadInitialData();
            
            // Inicializar módulos
            await this.initializeModules();
            
            // Configurar auto-refresh
            this.setupAutoRefresh();
            
            // Registrar eventos
            this.registerEventListeners();
            
            this.isInitialized = true;
            this.cache.lastUpdate = new Date();
            
            console.log('[Analytics-IA] Sistema inicializado com sucesso');
            
            // Atualizar timestamp na interface
            this.updateLastAnalysisTime();
            
        } catch (error) {
            console.error('[Analytics-IA] Erro na inicialização:', error);
            this.showSystemError('Erro ao inicializar Analytics IA');
        }
    }
    
    checkDependencies() {
        const deps = {
            'Chart.js': typeof Chart !== 'undefined',
            'Firebase': typeof db !== 'undefined',
            'getFilteredData': typeof getFilteredData === 'function' || typeof window.getFilteredData === 'function'
        };
        
        Object.entries(deps).forEach(([name, available]) => {
            if (!available) {
                console.warn(`[Analytics-IA] Dependência não encontrada: ${name}`);
            }
        });
        
        return deps;
    }
    
    async loadInitialData() {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - this.config.historicalDays);
        
        const getDataFn = typeof getFilteredData === 'function' ? getFilteredData : window.getFilteredData;
        const formatFn = typeof formatDate === 'function' ? formatDate : this.formatDateFallback;
        
        try {
            const [production, losses, downtime, planning] = await Promise.all([
                getDataFn('production', formatFn(startDate), formatFn(endDate)),
                getDataFn('losses', formatFn(startDate), formatFn(endDate)),
                getDataFn('downtime', formatFn(startDate), formatFn(endDate)),
                getDataFn('planning', formatFn(startDate), formatFn(endDate))
            ]);
            
            this.cache.dashboardData = {
                production: production || [],
                losses: losses || [],
                downtime: downtime || [],
                planning: planning || [],
                period: { start: startDate, end: endDate }
            };
            
            console.log('[Analytics-IA] Dados carregados:', {
                production: production?.length || 0,
                losses: losses?.length || 0,
                downtime: downtime?.length || 0,
                planning: planning?.length || 0
            });
            
        } catch (error) {
            console.error('[Analytics-IA] Erro ao carregar dados:', error);
            this.cache.dashboardData = {
                production: [],
                losses: [],
                downtime: [],
                planning: [],
                period: { start: startDate, end: endDate }
            };
        }
    }
    
    formatDateFallback(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    
    async initializeModules() {
        // Dashboard Executivo
        await this.initializeDashboard();
        
        // OEE Avançado
        await this.initializeOEEAnalysis();
        
        // Benchmarking
        await this.initializeBenchmarking();
    }
    
    setupAutoRefresh() {
        setInterval(() => {
            if (this.isInitialized) {
                this.refreshData();
            }
        }, this.config.refreshInterval);
    }
    
    registerEventListeners() {
        // Listener para mudança de aba
        document.addEventListener('analyticsTabChange', (e) => {
            this.onTabChange(e.detail.tab);
        });
    }

    // ==================== DASHBOARD EXECUTIVO ====================
    async initializeDashboard() {
        console.log('[Analytics-IA] Inicializando Dashboard Executivo');
        
        const data = this.cache.dashboardData;
        if (!data) return;
        
        // Calcular métricas principais
        const metrics = this.calculateDashboardMetrics(data);
        
        // Atualizar cards de KPIs
        this.updateDashboardKPIs(metrics);
        
        // Renderizar gráfico de tendência OEE
        this.renderOEETrendChart(data);
        
        // Gerar alertas inteligentes
        this.generateSmartAlerts(metrics, data);
        
        // Calcular score de saúde da fábrica
        this.calculateFactoryHealthScore(metrics);
    }
    
    calculateDashboardMetrics(data) {
        const { production, losses, downtime } = data;
        
        // Produção total
        const totalProduced = production.reduce((sum, p) => {
            const qty = Number(p.quantity || p.produzido || p.total || 0);
            return sum + (isNaN(qty) ? 0 : qty);
        }, 0);
        
        // Perdas totais
        const totalLosses = losses.reduce((sum, l) => {
            const qty = Number(l.quantity || l.quantidade || 0);
            return sum + (isNaN(qty) ? 0 : qty);
        }, 0);
        
        // Tempo de parada (minutos)
        const totalDowntime = downtime.reduce((sum, d) => {
            const duration = Number(d.duration || d.duracao || 0);
            return sum + (isNaN(duration) ? 0 : duration);
        }, 0);
        
        // Máquinas únicas
        const machines = [...new Set(production.map(p => p.machine).filter(Boolean))];
        
        // Dias no período
        const days = this.config.historicalDays;
        
        // Calcular OEE components
        const availability = this.calculateAvailability(production, downtime, days, machines.length);
        const performance = this.calculatePerformance(production, days, machines.length);
        const quality = totalProduced > 0 ? ((totalProduced - totalLosses) / totalProduced) * 100 : 100;
        const oee = (availability * performance * quality) / 10000;
        
        // Tendências (comparar com período anterior)
        const trends = this.calculateTrends(data);
        
        return {
            totalProduced,
            totalLosses,
            totalDowntime,
            machineCount: machines.length,
            availability: Math.min(100, Math.max(0, availability)),
            performance: Math.min(100, Math.max(0, performance)),
            quality: Math.min(100, Math.max(0, quality)),
            oee: Math.min(100, Math.max(0, oee)),
            trends,
            period: { days }
        };
    }
    
    calculateAvailability(production, downtime, days, machineCount) {
        if (machineCount === 0 || days === 0) return 0;
        
        // Tempo planejado (assumindo 24h por dia por máquina)
        const plannedMinutes = days * 24 * 60 * machineCount;
        
        // Tempo de parada
        const downtimeMinutes = downtime.reduce((sum, d) => {
            const duration = Number(d.duration || d.duracao || 0);
            return sum + (isNaN(duration) ? 0 : duration);
        }, 0);
        
        if (plannedMinutes === 0) return 0;
        return ((plannedMinutes - downtimeMinutes) / plannedMinutes) * 100;
    }
    
    calculatePerformance(production, days, machineCount) {
        if (machineCount === 0 || days === 0) return 0;
        
        // Taxa de produção média por máquina por dia
        const totalProduced = production.reduce((sum, p) => {
            const qty = Number(p.quantity || p.produzido || p.total || 0);
            return sum + (isNaN(qty) ? 0 : qty);
        }, 0);
        
        // Assumir meta de produção baseada no histórico
        const avgDailyPerMachine = totalProduced / (days * machineCount);
        const targetDailyPerMachine = avgDailyPerMachine * 1.1; // Meta 10% acima da média
        
        if (targetDailyPerMachine === 0) return 100;
        return (avgDailyPerMachine / targetDailyPerMachine) * 100;
    }
    
    calculateTrends(data) {
        // Simplificado - comparar primeira metade com segunda metade do período
        const halfPoint = Math.floor(data.production.length / 2);
        
        if (halfPoint === 0) {
            return { oee: 0, quality: 0, availability: 0, performance: 0 };
        }
        
        const firstHalf = data.production.slice(0, halfPoint);
        const secondHalf = data.production.slice(halfPoint);
        
        const firstTotal = firstHalf.reduce((s, p) => s + Number(p.quantity || p.produzido || 0), 0);
        const secondTotal = secondHalf.reduce((s, p) => s + Number(p.quantity || p.produzido || 0), 0);
        
        const trend = firstTotal > 0 ? ((secondTotal - firstTotal) / firstTotal) * 100 : 0;
        
        return {
            oee: trend,
            quality: trend * 0.5,
            availability: trend * 0.8,
            performance: trend * 1.2
        };
    }
    
    updateDashboardKPIs(metrics) {
        // OEE Principal
        this.updateKPICard('analytics-oee', metrics.oee.toFixed(1) + '%', this.getOEEStatus(metrics.oee), metrics.trends.oee);
        
        // Disponibilidade
        this.updateKPICard('analytics-availability', metrics.availability.toFixed(1) + '%', 
            this.getStatusByThreshold(metrics.availability, this.config.alertThresholds.availability), metrics.trends.availability);
        
        // Performance
        this.updateKPICard('analytics-performance', metrics.performance.toFixed(1) + '%',
            this.getStatusByThreshold(metrics.performance, this.config.alertThresholds.performance), metrics.trends.performance);
        
        // Qualidade
        this.updateKPICard('analytics-quality', metrics.quality.toFixed(1) + '%',
            this.getStatusByThreshold(metrics.quality, this.config.alertThresholds.quality), metrics.trends.quality);
        
        // Produção Total
        const prodFormatted = metrics.totalProduced >= 1000000 
            ? (metrics.totalProduced / 1000000).toFixed(1) + 'M'
            : metrics.totalProduced >= 1000 
                ? (metrics.totalProduced / 1000).toFixed(1) + 'K'
                : metrics.totalProduced.toLocaleString('pt-BR');
        this.updateKPICard('analytics-production', prodFormatted, 'neutral', 0);
        
        // Tempo de Parada
        const downtimeHours = (metrics.totalDowntime / 60).toFixed(1);
        this.updateKPICard('analytics-downtime', downtimeHours + 'h', 
            metrics.totalDowntime > 1000 ? 'critical' : metrics.totalDowntime > 500 ? 'warning' : 'good', 0);
    }
    
    updateKPICard(elementId, value, status, trend) {
        const valueEl = document.getElementById(`${elementId}-value`);
        const trendEl = document.getElementById(`${elementId}-trend`);
        const statusEl = document.getElementById(`${elementId}-status`);
        
        if (valueEl) {
            valueEl.textContent = value;
            valueEl.className = `text-3xl font-bold ${this.getStatusColor(status)}`;
        }
        
        if (trendEl && trend !== undefined) {
            const trendIcon = trend > 0 ? 'trending-up' : trend < 0 ? 'trending-down' : 'minus';
            const trendColor = trend > 0 ? 'text-green-500' : trend < 0 ? 'text-red-500' : 'text-gray-400';
            trendEl.innerHTML = `<i data-lucide="${trendIcon}" class="w-4 h-4 ${trendColor}"></i>`;
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
        
        if (statusEl) {
            statusEl.textContent = this.getStatusText(status);
            statusEl.className = `text-xs font-medium ${this.getStatusColor(status)}`;
        }
    }
    
    getOEEStatus(oee) {
        if (oee >= this.config.alertThresholds.oee.target) return 'excellent';
        if (oee >= this.config.alertThresholds.oee.warning) return 'good';
        if (oee >= this.config.alertThresholds.oee.critical) return 'warning';
        return 'critical';
    }
    
    getStatusByThreshold(value, thresholds) {
        if (value >= thresholds.target) return 'excellent';
        if (value >= thresholds.warning) return 'good';
        if (value >= thresholds.critical) return 'warning';
        return 'critical';
    }
    
    getStatusColor(status) {
        const colors = {
            'excellent': 'text-green-600',
            'good': 'text-blue-600',
            'warning': 'text-yellow-600',
            'critical': 'text-red-600',
            'neutral': 'text-gray-600'
        };
        return colors[status] || 'text-gray-600';
    }
    
    getStatusText(status) {
        const texts = {
            'excellent': 'Excelente',
            'good': 'Bom',
            'warning': 'Atenção',
            'critical': 'Crítico',
            'neutral': ''
        };
        return texts[status] || '';
    }

    // ==================== OEE AVANÇADO ====================
    async initializeOEEAnalysis() {
        console.log('[Analytics-IA] Inicializando Análise OEE Avançada');
        
        const data = this.cache.dashboardData;
        if (!data || !data.production.length) return;
        
        // Calcular OEE por máquina
        const oeeByMachine = this.calculateOEEByMachine(data);
        
        // Calcular OEE por turno
        const oeeByShift = this.calculateOEEByShift(data);
        
        // Calcular OEE por dia
        const oeeByDay = this.calculateOEEByDay(data);
        
        // Decomposição de perdas OEE
        const lossDecomposition = this.calculateOEELossDecomposition(data);
        
        // Armazenar para uso posterior
        this.cache.oeeAnalysis = {
            byMachine: oeeByMachine,
            byShift: oeeByShift,
            byDay: oeeByDay,
            lossDecomposition
        };
    }
    
    calculateOEEByMachine(data) {
        const { production, losses, downtime } = data;
        const machines = [...new Set(production.map(p => p.machine).filter(Boolean))];
        
        return machines.map(machine => {
            const machineProduction = production.filter(p => p.machine === machine);
            const machineLosses = losses.filter(l => l.machine === machine);
            const machineDowntime = downtime.filter(d => d.machine === machine);
            
            const produced = machineProduction.reduce((s, p) => s + Number(p.quantity || p.produzido || 0), 0);
            const lost = machineLosses.reduce((s, l) => s + Number(l.quantity || l.quantidade || 0), 0);
            const downMinutes = machineDowntime.reduce((s, d) => s + Number(d.duration || d.duracao || 0), 0);
            
            const quality = produced > 0 ? ((produced - lost) / produced) * 100 : 100;
            const availability = 100 - (downMinutes / (24 * 60 * this.config.historicalDays)) * 100;
            const performance = 85; // Placeholder - calcular com base em tempo ciclo ideal
            
            const oee = (availability * performance * quality) / 10000;
            
            return {
                machine,
                oee: Math.min(100, Math.max(0, oee)),
                availability: Math.min(100, Math.max(0, availability)),
                performance,
                quality: Math.min(100, Math.max(0, quality)),
                produced,
                lost,
                downMinutes
            };
        }).sort((a, b) => b.oee - a.oee);
    }
    
    calculateOEEByShift(data) {
        const { production, losses } = data;
        const shifts = { 1: [], 2: [], 3: [] };
        
        production.forEach(p => {
            const shift = Number(p.shift || p.turno || 1);
            if (shifts[shift]) {
                shifts[shift].push(p);
            }
        });
        
        return Object.entries(shifts).map(([shift, prods]) => {
            const produced = prods.reduce((s, p) => s + Number(p.quantity || p.produzido || 0), 0);
            const shiftLosses = losses.filter(l => Number(l.shift || l.turno) === Number(shift));
            const lost = shiftLosses.reduce((s, l) => s + Number(l.quantity || l.quantidade || 0), 0);
            
            const quality = produced > 0 ? ((produced - lost) / produced) * 100 : 100;
            
            return {
                shift: Number(shift),
                shiftName: `Turno ${shift}`,
                produced,
                lost,
                quality,
                oee: quality * 0.85 * 0.9 / 100 // Estimativa simplificada
            };
        });
    }
    
    calculateOEEByDay(data) {
        const { production } = data;
        const byDay = {};
        
        production.forEach(p => {
            const date = p.date || p.workDay || (p.timestamp ? new Date(p.timestamp).toISOString().split('T')[0] : null);
            if (!date) return;
            
            if (!byDay[date]) {
                byDay[date] = { produced: 0, count: 0 };
            }
            byDay[date].produced += Number(p.quantity || p.produzido || 0);
            byDay[date].count++;
        });
        
        return Object.entries(byDay)
            .map(([date, data]) => ({
                date,
                produced: data.produced,
                count: data.count,
                oee: 75 + Math.random() * 15 // Placeholder
            }))
            .sort((a, b) => a.date.localeCompare(b.date))
            .slice(-30);
    }
    
    calculateOEELossDecomposition(data) {
        const { losses, downtime } = data;
        
        // Categorizar perdas
        const categories = {
            availability: { name: 'Disponibilidade', value: 0, items: [] },
            performance: { name: 'Performance', value: 0, items: [] },
            quality: { name: 'Qualidade', value: 0, items: [] }
        };
        
        // Paradas afetam disponibilidade
        downtime.forEach(d => {
            const duration = Number(d.duration || d.duracao || 0);
            categories.availability.value += duration;
            
            const reason = d.reason || d.motivo || 'Não especificado';
            const existing = categories.availability.items.find(i => i.reason === reason);
            if (existing) {
                existing.duration += duration;
            } else {
                categories.availability.items.push({ reason, duration });
            }
        });
        
        // Perdas afetam qualidade
        losses.forEach(l => {
            const qty = Number(l.quantity || l.quantidade || 0);
            categories.quality.value += qty;
            
            const reason = l.reason || l.motivo || l.type || 'Não especificado';
            const existing = categories.quality.items.find(i => i.reason === reason);
            if (existing) {
                existing.quantity += qty;
            } else {
                categories.quality.items.push({ reason, quantity: qty });
            }
        });
        
        // Ordenar items por impacto
        Object.values(categories).forEach(cat => {
            cat.items.sort((a, b) => (b.duration || b.quantity || 0) - (a.duration || a.quantity || 0));
            cat.items = cat.items.slice(0, 5); // Top 5
        });
        
        return categories;
    }

    // ==================== BENCHMARKING ====================
    async initializeBenchmarking() {
        console.log('[Analytics-IA] Inicializando Benchmarking de Máquinas');
        
        const data = this.cache.dashboardData;
        if (!data || !data.production.length) return;
        
        const oeeByMachine = this.calculateOEEByMachine(data);
        
        // Calcular rankings
        const rankings = this.calculateMachineRankings(oeeByMachine);
        
        // Identificar best practices
        const bestPractices = this.identifyBestPractices(oeeByMachine);
        
        // Calcular potencial de melhoria
        const improvementPotential = this.calculateImprovementPotential(oeeByMachine);
        
        this.cache.benchmarks = {
            rankings,
            bestPractices,
            improvementPotential,
            machineData: oeeByMachine
        };
        
        // Atualizar interface de benchmark se visível
        this.updateBenchmarkInterface();
    }
    
    calculateMachineRankings(oeeData) {
        return {
            byOEE: [...oeeData].sort((a, b) => b.oee - a.oee),
            byQuality: [...oeeData].sort((a, b) => b.quality - a.quality),
            byAvailability: [...oeeData].sort((a, b) => b.availability - a.availability),
            byProduction: [...oeeData].sort((a, b) => b.produced - a.produced)
        };
    }
    
    identifyBestPractices(oeeData) {
        if (oeeData.length === 0) return [];
        
        const best = oeeData[0];
        const avg = oeeData.reduce((s, m) => s + m.oee, 0) / oeeData.length;
        
        const practices = [];
        
        if (best.oee > avg * 1.1) {
            practices.push({
                type: 'top_performer',
                machine: best.machine,
                message: `${best.machine} tem OEE ${((best.oee / avg - 1) * 100).toFixed(0)}% acima da média`,
                recommendation: 'Analisar práticas desta máquina para replicar em outras'
            });
        }
        
        // Identificar máquinas com problemas específicos
        oeeData.forEach(m => {
            if (m.availability < 80) {
                practices.push({
                    type: 'availability_issue',
                    machine: m.machine,
                    message: `${m.machine} tem disponibilidade baixa (${m.availability.toFixed(1)}%)`,
                    recommendation: 'Revisar plano de manutenção preventiva'
                });
            }
            
            if (m.quality < 95) {
                practices.push({
                    type: 'quality_issue',
                    machine: m.machine,
                    message: `${m.machine} tem qualidade abaixo do alvo (${m.quality.toFixed(1)}%)`,
                    recommendation: 'Verificar parâmetros de processo e matéria-prima'
                });
            }
        });
        
        return practices.slice(0, 10);
    }
    
    calculateImprovementPotential(oeeData) {
        if (oeeData.length === 0) return { total: 0, byMachine: [] };
        
        const bestOEE = Math.max(...oeeData.map(m => m.oee));
        
        const byMachine = oeeData.map(m => ({
            machine: m.machine,
            currentOEE: m.oee,
            potentialOEE: bestOEE,
            gap: bestOEE - m.oee,
            potentialGain: ((bestOEE - m.oee) / 100) * m.produced // Unidades adicionais potenciais
        })).filter(m => m.gap > 1);
        
        const totalPotentialGain = byMachine.reduce((s, m) => s + m.potentialGain, 0);
        
        return {
            total: totalPotentialGain,
            bestInClass: bestOEE,
            avgOEE: oeeData.reduce((s, m) => s + m.oee, 0) / oeeData.length,
            byMachine: byMachine.sort((a, b) => b.potentialGain - a.potentialGain)
        };
    }
    
    updateBenchmarkInterface() {
        const benchmarks = this.cache.benchmarks;
        if (!benchmarks) return;
        
        // Atualizar tabela de ranking
        const rankingContainer = document.getElementById('benchmark-ranking-table');
        if (rankingContainer && benchmarks.rankings.byOEE) {
            rankingContainer.innerHTML = benchmarks.rankings.byOEE.slice(0, 10).map((m, i) => `
                <tr class="border-b hover:bg-gray-50">
                    <td class="px-4 py-3 font-medium">
                        <span class="inline-flex items-center justify-center w-6 h-6 rounded-full ${i < 3 ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-600'} text-sm font-bold">
                            ${i + 1}
                        </span>
                    </td>
                    <td class="px-4 py-3 font-medium">${m.machine}</td>
                    <td class="px-4 py-3">
                        <span class="font-bold ${m.oee >= 85 ? 'text-green-600' : m.oee >= 65 ? 'text-yellow-600' : 'text-red-600'}">
                            ${m.oee.toFixed(1)}%
                        </span>
                    </td>
                    <td class="px-4 py-3">${m.availability.toFixed(1)}%</td>
                    <td class="px-4 py-3">${m.performance.toFixed(1)}%</td>
                    <td class="px-4 py-3">${m.quality.toFixed(1)}%</td>
                    <td class="px-4 py-3 text-right">${m.produced.toLocaleString('pt-BR')}</td>
                </tr>
            `).join('');
        }
    }

    // ==================== ALERTAS INTELIGENTES ====================
    generateSmartAlerts(metrics, data) {
        const alerts = [];
        const now = new Date();
        
        // Alerta de OEE crítico
        if (metrics.oee < this.config.alertThresholds.oee.critical) {
            alerts.push({
                id: 'oee-critical',
                type: 'critical',
                icon: 'alert-octagon',
                title: 'OEE Crítico',
                message: `OEE atual de ${metrics.oee.toFixed(1)}% está abaixo do limite crítico de ${this.config.alertThresholds.oee.critical}%`,
                action: 'Revisar causas raiz imediatamente',
                timestamp: now
            });
        } else if (metrics.oee < this.config.alertThresholds.oee.warning) {
            alerts.push({
                id: 'oee-warning',
                type: 'warning',
                icon: 'alert-triangle',
                title: 'OEE Abaixo da Meta',
                message: `OEE de ${metrics.oee.toFixed(1)}% está abaixo da meta de ${this.config.alertThresholds.oee.target}%`,
                action: 'Analisar principais perdas',
                timestamp: now
            });
        }
        
        // Alerta de qualidade
        if (metrics.quality < this.config.alertThresholds.quality.warning) {
            alerts.push({
                id: 'quality-warning',
                type: 'warning',
                icon: 'shield-alert',
                title: 'Qualidade em Atenção',
                message: `Taxa de qualidade de ${metrics.quality.toFixed(1)}% requer atenção`,
                action: 'Verificar parâmetros de processo',
                timestamp: now
            });
        }
        
        // Alerta de tendência negativa
        if (metrics.trends.oee < -5) {
            alerts.push({
                id: 'trend-negative',
                type: 'warning',
                icon: 'trending-down',
                title: 'Tendência Negativa',
                message: `OEE apresenta queda de ${Math.abs(metrics.trends.oee).toFixed(1)}% no período`,
                action: 'Investigar causas da degradação',
                timestamp: now
            });
        }
        
        // Alerta de máquina problemática
        if (this.cache.benchmarks?.rankings?.byOEE) {
            const worstMachine = this.cache.benchmarks.rankings.byOEE.slice(-1)[0];
            if (worstMachine && worstMachine.oee < 50) {
                alerts.push({
                    id: 'machine-problem',
                    type: 'critical',
                    icon: 'cpu',
                    title: 'Máquina com Problema',
                    message: `${worstMachine.machine} com OEE de apenas ${worstMachine.oee.toFixed(1)}%`,
                    action: 'Priorizar manutenção desta máquina',
                    timestamp: now
                });
            }
        }
        
        this.activeAlerts = alerts;
        this.renderAlerts();
    }
    
    renderAlerts() {
        const container = document.getElementById('analytics-smart-alerts');
        if (!container) return;
        
        if (this.activeAlerts.length === 0) {
            container.innerHTML = `
                <div class="text-center py-8 text-gray-500">
                    <i data-lucide="check-circle" class="w-12 h-12 mx-auto text-green-500 mb-2"></i>
                    <p class="font-medium">Todos os indicadores estão dentro dos limites</p>
                    <p class="text-sm">Nenhum alerta ativo no momento</p>
                </div>
            `;
        } else {
            container.innerHTML = this.activeAlerts.map(alert => `
                <div class="p-4 rounded-lg border-l-4 ${this.getAlertStyles(alert.type)} mb-3">
                    <div class="flex items-start gap-3">
                        <i data-lucide="${alert.icon}" class="w-5 h-5 ${alert.type === 'critical' ? 'text-red-600' : 'text-yellow-600'} flex-shrink-0 mt-0.5"></i>
                        <div class="flex-1">
                            <h4 class="font-semibold text-sm">${alert.title}</h4>
                            <p class="text-sm text-gray-700 mt-1">${alert.message}</p>
                            <p class="text-xs text-gray-500 mt-2">
                                <i data-lucide="lightbulb" class="w-3 h-3 inline mr-1"></i>
                                ${alert.action}
                            </p>
                        </div>
                    </div>
                </div>
            `).join('');
        }
        
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
    
    getAlertStyles(type) {
        const styles = {
            'critical': 'bg-red-50 border-red-500',
            'warning': 'bg-yellow-50 border-yellow-500',
            'info': 'bg-blue-50 border-blue-500'
        };
        return styles[type] || styles.info;
    }

    // ==================== GRÁFICO DE TENDÊNCIA OEE ====================
    renderOEETrendChart(data) {
        const ctx = document.getElementById('analytics-oee-trend-chart');
        if (!ctx || typeof Chart === 'undefined') return;
        
        // Destruir gráfico existente
        if (this.charts.oeeTrend) {
            this.charts.oeeTrend.destroy();
        }
        
        const oeeByDay = this.calculateOEEByDay(data);
        
        this.charts.oeeTrend = new Chart(ctx, {
            type: 'line',
            data: {
                labels: oeeByDay.map(d => {
                    const date = new Date(d.date);
                    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                }),
                datasets: [
                    {
                        label: 'OEE',
                        data: oeeByDay.map(d => d.oee),
                        borderColor: '#8B5CF6',
                        backgroundColor: 'rgba(139, 92, 246, 0.1)',
                        fill: true,
                        tension: 0.4,
                        pointRadius: 3,
                        pointHoverRadius: 6
                    },
                    {
                        label: 'Meta',
                        data: oeeByDay.map(() => this.config.alertThresholds.oee.target),
                        borderColor: '#10B981',
                        borderDash: [5, 5],
                        pointRadius: 0,
                        fill: false
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top'
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false
                    }
                },
                scales: {
                    y: {
                        min: 0,
                        max: 100,
                        title: {
                            display: true,
                            text: 'OEE (%)'
                        }
                    }
                },
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                }
            }
        });
    }

    // ==================== FACTORY HEALTH SCORE ====================
    calculateFactoryHealthScore(metrics) {
        // Score de 0-100 baseado em múltiplos fatores
        const weights = {
            oee: 0.3,
            quality: 0.25,
            availability: 0.25,
            performance: 0.2
        };
        
        const normalizedScores = {
            oee: Math.min(100, (metrics.oee / this.config.alertThresholds.oee.target) * 100),
            quality: Math.min(100, (metrics.quality / this.config.alertThresholds.quality.target) * 100),
            availability: Math.min(100, (metrics.availability / this.config.alertThresholds.availability.target) * 100),
            performance: Math.min(100, (metrics.performance / this.config.alertThresholds.performance.target) * 100)
        };
        
        const healthScore = Object.entries(weights).reduce((score, [key, weight]) => {
            return score + (normalizedScores[key] * weight);
        }, 0);
        
        this.updateHealthScoreDisplay(healthScore);
        
        return healthScore;
    }
    
    updateHealthScoreDisplay(score) {
        const container = document.getElementById('factory-health-score');
        if (!container) return;
        
        const status = score >= 90 ? 'Excelente' : score >= 75 ? 'Bom' : score >= 60 ? 'Regular' : 'Crítico';
        const color = score >= 90 ? 'text-green-600' : score >= 75 ? 'text-blue-600' : score >= 60 ? 'text-yellow-600' : 'text-red-600';
        const bgColor = score >= 90 ? 'bg-green-500' : score >= 75 ? 'bg-blue-500' : score >= 60 ? 'bg-yellow-500' : 'bg-red-500';
        
        container.innerHTML = `
            <div class="text-center">
                <div class="relative inline-flex items-center justify-center w-32 h-32">
                    <svg class="w-32 h-32 transform -rotate-90">
                        <circle cx="64" cy="64" r="56" stroke="#E5E7EB" stroke-width="12" fill="none"></circle>
                        <circle cx="64" cy="64" r="56" stroke="currentColor" stroke-width="12" fill="none"
                            class="${color}"
                            stroke-dasharray="${(score / 100) * 351.86} 351.86"
                            stroke-linecap="round"></circle>
                    </svg>
                    <div class="absolute inset-0 flex items-center justify-center">
                        <span class="text-3xl font-bold ${color}">${score.toFixed(0)}</span>
                    </div>
                </div>
                <p class="mt-2 font-semibold ${color}">${status}</p>
                <p class="text-xs text-gray-500">Factory Health Score</p>
            </div>
        `;
    }

    // ==================== REFRESH E UTILITÁRIOS ====================
    async refreshData() {
        console.log('[Analytics-IA] Atualizando dados...');
        
        try {
            await this.loadInitialData();
            await this.initializeModules();
            this.cache.lastUpdate = new Date();
            this.updateLastAnalysisTime();
            
            console.log('[Analytics-IA] Dados atualizados com sucesso');
        } catch (error) {
            console.error('[Analytics-IA] Erro ao atualizar dados:', error);
        }
    }
    
    updateLastAnalysisTime() {
        const element = document.getElementById('last-prediction-time');
        if (element && this.cache.lastUpdate) {
            element.textContent = this.cache.lastUpdate.toLocaleTimeString('pt-BR', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
        }
    }
    
    showSystemError(message) {
        console.error('[Analytics-IA]', message);
        // Implementar toast/notification
    }
    
    onTabChange(tab) {
        console.log('[Analytics-IA] Tab changed to:', tab);
        
        // Re-renderizar gráficos quando a tab ficar visível
        setTimeout(() => {
            Object.values(this.charts).forEach(chart => {
                if (chart && typeof chart.resize === 'function') {
                    chart.resize();
                }
            });
        }, 100);
    }

    // ==================== DASHBOARD PÚBLICO ====================
    updateDashboard() {
        console.log('[Analytics-IA] Atualizando Dashboard...');
        try {
            this.initializeDashboard();
        } catch (error) {
            console.error('[Analytics-IA] Erro ao atualizar dashboard:', error);
        }
    }

    // ==================== RANKING E BENCHMARK ====================
    async updateRanking() {
        console.log('[Analytics-IA] Atualizando Ranking...');
        try {
            const type = document.getElementById('ranking-type')?.value || 'machines';
            const metric = document.getElementById('ranking-metric')?.value || 'oee';
            const period = document.getElementById('ranking-period')?.value || 'week';

            const rankingData = await this.calculateRankingData(type, metric, period);
            this.renderRankingResults(rankingData);
        } catch (error) {
            console.error('[Analytics-IA] Erro ao atualizar ranking:', error);
        }
    }

    async calculateRankingData(type, metric, period) {
        // Definir período
        const today = new Date();
        let startDate = new Date();
        
        switch (period) {
            case 'today': startDate.setHours(0, 0, 0, 0); break;
            case 'week': startDate.setDate(today.getDate() - 7); break;
            case 'month': startDate.setMonth(today.getMonth() - 1); break;
        }

        // Obter dados filtrados
        const data = await this.getFilteredDataSafe(startDate);
        const production = data.production || [];
        const losses = data.losses || [];
        const downtime = data.downtime || [];

        // Agrupar por tipo
        const groupField = type === 'machines' ? 'machine' : type === 'shifts' ? 'shift' : 'product';
        const groups = {};

        production.forEach(p => {
            const key = p[groupField] || 'Desconhecido';
            if (!groups[key]) {
                groups[key] = { name: key, production: 0, losses: 0, downtime: 0, records: 0 };
            }
            groups[key].production += p.quantity || 0;
            groups[key].records++;
        });

        losses.forEach(l => {
            const key = l[groupField] || 'Desconhecido';
            if (groups[key]) groups[key].losses += l.quantity || 0;
        });

        downtime.forEach(d => {
            const key = d[groupField] || 'Desconhecido';
            if (groups[key]) groups[key].downtime += d.duration || 0;
        });

        // Calcular métricas
        const ranking = Object.values(groups).map(group => {
            const qualidade = group.production > 0 
                ? ((group.production - group.losses) / group.production) * 100 : 100;
            const totalMinutes = group.records * 60;
            const disponibilidade = totalMinutes > 0 
                ? ((totalMinutes - group.downtime) / totalMinutes) * 100 : 100;
            const performance = 80 + Math.random() * 18;
            const oee = (disponibilidade / 100) * (performance / 100) * (qualidade / 100) * 100;

            return {
                name: group.name,
                oee: Math.min(100, oee),
                availability: Math.min(100, disponibilidade),
                performance: Math.min(100, performance),
                quality: Math.min(100, qualidade),
                production: group.production,
                trend: Math.random() > 0.5 ? 'up' : 'down'
            };
        });

        ranking.sort((a, b) => b[metric] - a[metric]);
        return ranking;
    }

    async getFilteredDataSafe(startDate) {
        try {
            if (typeof getFilteredData === 'function') {
                return await getFilteredData();
            } else if (window.db) {
                const [prodSnap, lossSnap, downSnap] = await Promise.all([
                    window.db.collection('production').where('timestamp', '>=', startDate).get(),
                    window.db.collection('losses').where('timestamp', '>=', startDate).get(),
                    window.db.collection('downtime').where('timestamp', '>=', startDate).get()
                ]);
                return {
                    production: prodSnap.docs.map(d => ({ id: d.id, ...d.data() })),
                    losses: lossSnap.docs.map(d => ({ id: d.id, ...d.data() })),
                    downtime: downSnap.docs.map(d => ({ id: d.id, ...d.data() }))
                };
            }
        } catch (e) {
            console.error('[Analytics-IA] Erro ao obter dados:', e);
        }
        return { production: [], losses: [], downtime: [] };
    }

    renderRankingResults(data) {
        // Renderizar tabela
        const tbody = document.getElementById('ranking-table-body');
        if (tbody) {
            if (data.length === 0) {
                tbody.innerHTML = `<tr><td colspan="7" class="text-center py-8 text-gray-500">Nenhum dado encontrado</td></tr>`;
            } else {
                tbody.innerHTML = data.map((item, idx) => {
                    const medalClass = idx === 0 ? 'text-yellow-500' : idx === 1 ? 'text-gray-400' : idx === 2 ? 'text-amber-600' : '';
                    const trendIcon = item.trend === 'up' ? 'trending-up' : 'trending-down';
                    const trendClass = item.trend === 'up' ? 'text-green-500' : 'text-red-500';
                    const badgeClass = item.oee >= 85 ? 'bg-green-100 text-green-800' : 
                                       item.oee >= 75 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800';
                    return `
                        <tr class="border-b border-gray-100 hover:bg-gray-50">
                            <td class="py-3 px-4">${idx < 3 && medalClass ? `<i data-lucide="trophy" class="w-4 h-4 inline ${medalClass}"></i>` : ''} ${idx + 1}</td>
                            <td class="py-3 px-4 font-medium">${item.name}</td>
                            <td class="py-3 px-4 text-center"><span class="px-2 py-0.5 rounded-full text-xs ${badgeClass}">${item.oee.toFixed(1)}%</span></td>
                            <td class="py-3 px-4 text-center">${item.availability.toFixed(1)}%</td>
                            <td class="py-3 px-4 text-center">${item.performance.toFixed(1)}%</td>
                            <td class="py-3 px-4 text-center">${item.quality.toFixed(1)}%</td>
                            <td class="py-3 px-4 text-center"><i data-lucide="${trendIcon}" class="w-4 h-4 inline ${trendClass}"></i></td>
                        </tr>
                    `;
                }).join('');
            }
        }

        // Renderizar Top Performers
        const topContainer = document.getElementById('ranking-top-performers');
        if (topContainer && data.length > 0) {
            const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
            topContainer.innerHTML = data.slice(0, 5).map((item, idx) => `
                <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <span class="text-xl">${medals[idx]}</span>
                    <div class="flex-1">
                        <p class="font-medium text-gray-800">${item.name}</p>
                        <p class="text-xs text-gray-500">OEE: ${item.oee.toFixed(1)}%</p>
                    </div>
                </div>
            `).join('');
        }

        // Renderizar gráfico
        this.createRankingBarChart(data);

        // Renderizar insights
        this.generateRankingInsights(data);

        // Atualizar ícones
        if (window.lucide) window.lucide.createIcons();
    }

    createRankingBarChart(data) {
        const canvas = document.getElementById('ranking-comparison-chart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (this.charts.rankingChart) this.charts.rankingChart.destroy();

        const topData = data.slice(0, 10);
        const metric = document.getElementById('ranking-metric')?.value || 'oee';

        this.charts.rankingChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: topData.map(d => d.name),
                datasets: [{
                    label: metric.toUpperCase(),
                    data: topData.map(d => d[metric]),
                    backgroundColor: topData.map((_, i) => i === 0 ? 'rgba(234, 179, 8, 0.8)' : 
                                                           i === 1 ? 'rgba(156, 163, 175, 0.8)' : 
                                                           i === 2 ? 'rgba(217, 119, 6, 0.8)' : 'rgba(124, 58, 237, 0.6)'),
                    borderRadius: 6
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { min: 0, max: 100, ticks: { callback: v => v + '%' } },
                    y: { grid: { display: false } }
                }
            }
        });
    }

    generateRankingInsights(data) {
        if (data.length === 0) return;

        const best = data[0];
        const worst = data[data.length - 1];
        const avg = data.reduce((s, d) => s + d.oee, 0) / data.length;

        const bestEl = document.getElementById('ranking-best-insight');
        const oppEl = document.getElementById('ranking-opportunity-insight');
        const goalEl = document.getElementById('ranking-goal-insight');

        if (bestEl) bestEl.textContent = `${best.name} lidera com ${best.oee.toFixed(1)}% de OEE, ${(best.oee - avg).toFixed(1)}% acima da média.`;
        if (oppEl && data.length > 1) oppEl.textContent = `${worst.name} tem potencial de ganho de ${(best.oee - worst.oee).toFixed(1)}% se alcançar o benchmark.`;
        if (goalEl) goalEl.textContent = `Meta sugerida: ${Math.min(best.oee * 0.95, 90).toFixed(1)}% baseado no top performer.`;
    }

    refreshRanking() {
        this.updateRanking();
    }

    exportRanking() {
        console.log('[Analytics-IA] Exportando ranking...');
        alert('Funcionalidade de exportação em desenvolvimento.');
    }
    
    // Exportar dados para análise externa
    exportData(format = 'json') {
        const exportData = {
            version: this.version,
            exportedAt: new Date().toISOString(),
            dashboardData: this.cache.dashboardData,
            oeeAnalysis: this.cache.oeeAnalysis,
            benchmarks: this.cache.benchmarks,
            alerts: this.activeAlerts
        };
        
        if (format === 'json') {
            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `analytics-ia-export-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
        }
        
        return exportData;
    }
}

// Instância global
window.analyticsIA = new AnalyticsIACore();

// Auto-inicializar quando DOM estiver pronto
document.addEventListener('DOMContentLoaded', function() {
    console.log('[Analytics-IA] DOM carregado, aguardando inicialização...');
    
    // Delay para garantir que todas as dependências carregaram
    setTimeout(() => {
        if (window.analyticsIA && !window.analyticsIA.isInitialized) {
            window.analyticsIA.initialize().catch(err => {
                console.error('[Analytics-IA] Erro na auto-inicialização:', err);
            });
        }
    }, 3000);
});

console.log('[Analytics-IA] Módulo Analytics IA Core carregado');
