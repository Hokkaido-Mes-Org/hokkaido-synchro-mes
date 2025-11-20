/**
 * Syncrho v8.0 - Sistema de Analytics Preditivos
 * Módulo de Machine Learning e Previsões
 */

// Funções auxiliares de suporte
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function normalizeMachineId(id) {
    if (!id) return null;
    const s = String(id).toUpperCase().replace(/\s+/g, '');
    const match = s.match(/^H[-_]?(\d{1,2})$/);
    if (match) {
        return `H${match[1].padStart(2, '0')}`;
    }
    const digitsOnly = s.match(/^(\d{1,2})$/);
    if (digitsOnly) {
        return `H${digitsOnly[1].padStart(2, '0')}`;
    }
    const fallback = s.replace(/-/g, '').match(/^H(\d{1,2})$/);
    return fallback ? `H${fallback[1].padStart(2, '0')}` : s;
}

function parseShiftValue(value) {
    if (value === undefined || value === null) return null;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const match = String(value).match(/(\d+)/);
    return match ? Number(match[1]) : null;
}

function toDate(value) {
    if (!value) return null;
    if (typeof value.toDate === 'function') return value.toDate();
    if (typeof value === 'object' && typeof value.seconds === 'number') {
        return new Date(value.seconds * 1000);
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function parseTimeString(timeStr) {
    if (!timeStr) return null;
    const match = String(timeStr).match(/^(\d{1,2}):(\d{2})/);
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours > 23 || minutes > 59) return null;
    return { hours, minutes };
}

function combineDateTime(dateStr, timeStr) {
    if (!dateStr) return null;
    const time = parseTimeString(timeStr);
    const iso = time
        ? `${dateStr}T${String(time.hours).padStart(2, '0')}:${String(time.minutes).padStart(2, '0')}:00`
        : `${dateStr}T00:00:00`;
    const result = new Date(iso);
    return Number.isNaN(result.getTime()) ? null : result;
}

function resolveTimestamp(raw, dateValue, timeValue) {
    const candidateFields = ['timestamp', 'datetime', 'createdAt', 'updatedAt', 'generatedAt'];
    for (const field of candidateFields) {
        const resolved = toDate(raw?.[field]);
        if (resolved) return resolved;
    }
    const combined = combineDateTime(dateValue, timeValue);
    if (combined) return combined;
    if (dateValue) {
        const fallback = new Date(`${dateValue}T00:00:00`);
        if (!Number.isNaN(fallback.getTime())) return fallback;
    }
    return null;
}

function ensureISOString(dateObj) {
    if (!dateObj) return null;
    try {
        return new Date(dateObj.getTime() - dateObj.getTimezoneOffset() * 60000).toISOString();
    } catch (error) {
        return null;
    }
}

function getEntryDateKey(entry) {
    if (!entry) return null;
    if (entry.workDay) return String(entry.workDay).slice(0, 10);
    if (entry.date) return String(entry.date).slice(0, 10);
    if (entry.timestamp) {
        const parsed = new Date(entry.timestamp);
        if (!Number.isNaN(parsed.getTime())) {
            return parsed.toISOString().split('T')[0];
        }
    }
    if (entry.datetime) {
        const parsed = new Date(entry.datetime);
        if (!Number.isNaN(parsed.getTime())) {
            return parsed.toISOString().split('T')[0];
        }
    }
    return null;
}

function getEntryDateTime(entry) {
    if (!entry) return null;
    if (entry.timestamp) {
        const parsed = new Date(entry.timestamp);
        if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    if (entry.datetime) {
        const parsed = new Date(entry.datetime);
        if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    if (entry.date) {
        const parsed = new Date(`${entry.date}T00:00:00`);
        if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    if (entry.workDay) {
        const parsed = new Date(`${entry.workDay}T00:00:00`);
        if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    return null;
}
const predictiveCollectionConfig = {
    production: {
        collection: 'production_entries',
        orderByField: 'data',
        orderDirection: 'desc',
        limit: 5000,
        mapper: (doc) => {
            const raw = doc.data();
            const dateValue = raw.data || raw.date || raw.workDay || null;
            const timeValue = raw.horaInformada || raw.hora || raw.hour || raw.time || null;
            const timestamp = resolveTimestamp(raw, dateValue, timeValue);
            return {
                id: doc.id,
                timestamp: ensureISOString(timestamp),
                date: dateValue,
                machine: normalizeMachineId(raw.machine || raw.machineRef || raw.machine_id || raw.maquina),
                quantity: Number(raw.produzido ?? raw.quantity ?? raw.total ?? raw.quantidade ?? 0) || 0,
                shift: parseShiftValue(raw.turno ?? raw.shift),
                raw
            };
        }
    },
    losses: {
        collection: 'production_entries',
        orderByField: 'data',
        orderDirection: 'desc',
        limit: 5000,
        mapper: (doc) => {
            const raw = doc.data();
            const dateValue = raw.data || raw.date || raw.workDay || null;
            const timeValue = raw.horaInformada || raw.hora || raw.hour || raw.time || null;
            const timestamp = resolveTimestamp(raw, dateValue, timeValue);
            const scrap = calculateScrap(raw);
            return {
                id: doc.id,
                timestamp: ensureISOString(timestamp),
                date: dateValue,
                machine: normalizeMachineId(raw.machine || raw.machineRef || raw.machine_id || raw.maquina),
                quantity: scrap.scrapQty,
                scrapKg: scrap.scrapKg,
                pieceWeight: scrap.pieceWeight,
                reason: raw.perdas || raw.reason || raw.tipo_perda || '',
                mp: raw.mp || raw.material || '',
                shift: parseShiftValue(raw.turno ?? raw.shift),
                raw
            };
        }
    },
    downtime: {
        collection: 'downtime_entries',
        orderByField: 'date',
        orderDirection: 'desc',
        limit: 5000,
        mapper: (doc) => {
            const raw = doc.data();
            const dateValue = raw.date || raw.workDay || null;
            const startDateTime = combineDateTime(raw.date, raw.startTime);
            const endDateTime = combineDateTime(raw.date, raw.endTime);
            const timestamp = resolveTimestamp(raw, dateValue, raw.startTime || raw.endTime);
            let duration = Number(raw.duration ?? raw.duration_min ?? raw.duracao_min ?? raw.minutes ?? 0) || 0;
            if (!duration && startDateTime && endDateTime) {
                duration = Math.max(0, Math.round((endDateTime.getTime() - startDateTime.getTime()) / 60000));
            }
            return {
                id: doc.id,
                timestamp: ensureISOString(startDateTime || timestamp),
                date: dateValue,
                machine: normalizeMachineId(raw.machine || raw.machine_id || raw.maquina),
                duration,
                reason: raw.reason || raw.motivo || '',
                shift: parseShiftValue(raw.shift ?? raw.turno),
                raw
            };
        }
    }
};

function calculateScrap(raw = {}) {
    const scrapKg = Number(raw.refugo_kg ?? raw.refugoKg ?? raw.scrap_kg ?? raw.scrapKg ?? 0) || 0;
    const scrapQty = Number(raw.refugo_qty ?? raw.refugo_qtd ?? raw.scrap_qty ?? raw.scrap_qtd ?? 0) || 0;
    const pieceWeight = Number(raw.peso_unitario ?? raw.pesoUnitario ?? raw.piece_weight ?? raw.peso ?? 0) || 0;

    const resolvedQty = scrapQty || (scrapKg > 0 && pieceWeight > 0 ? Math.round((scrapKg * 1000) / pieceWeight) : 0);
    const resolvedKg = scrapKg || (pieceWeight > 0 && resolvedQty > 0 ? (resolvedQty * pieceWeight) / 1000 : 0);

    return {
        scrapQty: resolvedQty,
        scrapKg: resolvedKg,
        pieceWeight
    };
}

async function getFilteredData(type, startDate, endDate) {
    if (window.analyticsDataService?.getFilteredData) {
        try {
            const dataset = await window.analyticsDataService.getFilteredData(type, startDate, endDate, 'all', 'all');
            const normalized = Array.isArray(dataset) ? dataset : [];
            console.log(`[PREDICTIVE] Dataset via analyticsDataService (${type}): ${normalized.length}`);
            return normalized;
        } catch (error) {
            console.warn('[PREDICTIVE] Falha ao usar analyticsDataService, aplicando fallback direto no Firestore', error);
        }
    }

    if (typeof db === 'undefined') {
        console.warn('[PREDICTIVE] Firestore não inicializado, retornando array vazio');
        return [];
    }

    const config = predictiveCollectionConfig[type];
    if (!config) {
        console.warn(`[PREDICTIVE] Coleção "${type}" não configurada`);
        return [];
    }

    const startRange = startDate ? new Date(`${startDate}T00:00:00`) : null;
    const endRange = endDate ? new Date(`${endDate}T23:59:59.999`) : null;

    const runQuery = async (withOrdering = true) => {
        let query = db.collection(config.collection);
        if (withOrdering && config.orderByField) {
            query = query.orderBy(config.orderByField, config.orderDirection || 'desc');
        }
        if (config.limit) {
            query = query.limit(config.limit);
        }
        return query.get();
    };

    try {
        let snapshot;
        try {
            snapshot = await runQuery(true);
        } catch (error) {
            if (config.orderByField && error?.code === 'failed-precondition') {
                console.warn(`[PREDICTIVE] Índice ausente para ${config.collection}.${config.orderByField}, tentando sem orderBy`);
                snapshot = await runQuery(false);
            } else {
                throw error;
            }
        }

        const normalized = snapshot.docs.map(config.mapper).filter(item => {
            const targetDate = item.timestamp ? new Date(item.timestamp) : (item.date ? new Date(`${item.date}T00:00:00`) : null);
            if (!targetDate || Number.isNaN(targetDate.getTime())) return true;
            if (startRange && targetDate < startRange) return false;
            if (endRange && targetDate > endRange) return false;
            return true;
        });

        console.log(`[PREDICTIVE] Carregados ${normalized.length} registros processados de ${config.collection}`);
        return normalized;
    } catch (error) {
        console.error(`[PREDICTIVE] Erro ao carregar dados de ${config.collection}:`, error);
        return [];
    }
}

class PredictiveAnalytics {
    constructor() {
        this.charts = {};
        this.predictions = null;
        this.lastUpdate = null;
        this.updateInterval = null;
        this.mlModel = new SimpleMLEngine();
        this.hourlyHistory = [];
    }

    // Inicializar sistema preditivo
    async initialize() {
        console.log('[PREDICTIVE] Inicializando sistema de analytics preditivos');
        
        try {
            // Carrega dados históricos e gera previsões iniciais
            await this.loadHistoricalData();
            await this.generatePredictions();

            // Configurar atualizações automáticas após primeira carga
            this.setupAutoUpdate();
        } catch (error) {
            console.error('[PREDICTIVE] Falha na inicialização:', error);
        }
    }

    // Configurar atualização automática das previsões
    setupAutoUpdate() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }

        // Atualiza previsões a cada 30 minutos
        this.updateInterval = setInterval(async () => {
            try {
                await this.loadHistoricalData();
                await this.generatePredictions();
            } catch (error) {
                console.error('[PREDICTIVE] Erro ao atualizar previsões automaticamente:', error);
            }
        }, 30 * 60 * 1000);
    }

    // Gerar previsões usando ML
    async generatePredictions() {
        try {
            console.log('[PREDICTIVE] Gerando previsões...');
            
            if (!this.historicalData) {
                await this.loadHistoricalData();
            }

            // Treinar modelo com dados históricos
            const trainingData = this.prepareTrainingData();
            await this.mlModel.train(trainingData);

            // Gerar previsões para próximas 8 horas
            const hourlyForecast = this.forecastHourlyProduction(8);
            this.predictions = {
                breakdownProbability: this.mlModel.predictBreakdown(),
                qualityTrend: this.mlModel.predictQuality(),
                oeePrediction: this.mlModel.predictOEE(),
                hourlyProduction: hourlyForecast,
                recommendations: this.mlModel.generateRecommendations(),
                generatedAt: new Date()
            };

            this.lastUpdate = new Date();

            // Atualizar interface se não houver erro
            if (this.predictions) {
                await this.updatePredictiveInterface();
                this.generateProactiveAlerts();
            }
            
            console.log('[PREDICTIVE] Previsões atualizadas');

        } catch (error) {
            console.error('[PREDICTIVE] Erro ao gerar previsões:', error);
            // Criar previsões default em caso de erro
            this.predictions = {
                breakdownProbability: 0.3,
                qualityTrend: 0.85,
                oeePrediction: 0.75,
                hourlyProduction: [100, 110, 105, 108, 115, 112, 110, 108],
                recommendations: ['Monitor do sistema iniciado'],
                generatedAt: new Date()
            };
            this.lastUpdate = new Date();
        }
    }

    // Carregar dados históricos necessários para o modelo
    async loadHistoricalData() {
        try {
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(endDate.getDate() - 30); // 30 dias de histórico

            const [production, losses, downtime] = await Promise.all([
                getFilteredData('production', formatDate(startDate), formatDate(endDate)),
                getFilteredData('losses', formatDate(startDate), formatDate(endDate)),
                getFilteredData('downtime', formatDate(startDate), formatDate(endDate))
            ]);

            this.historicalData = {
                production,
                losses,
                downtime
            };

            return this.historicalData;
        } catch (error) {
            console.error('[PREDICTIVE] Erro ao carregar dados históricos:', error);
            this.historicalData = { production: [], losses: [], downtime: [] };
            return this.historicalData;
        }
    }

    // Preparar dados para treinamento
    prepareTrainingData() {
        const { production, losses, downtime } = this.historicalData;
        
        // Agrupar dados por hora
    const hourlyData = this.aggregateByHour(production, losses, downtime);
    this.hourlyHistory = hourlyData;
        
        // Calcular features para ML
        return hourlyData.map(hour => ({
            // Features de entrada
            hour: new Date(hour.timestamp).getHours(),
            dayOfWeek: new Date(hour.timestamp).getDay(),
            productionRate: hour.production / 60, // peças por minuto
            downtimeMinutes: hour.downtime,
            scrapRate: hour.losses / Math.max(hour.production, 1),
            oee: hour.oee || 0,
            
            // Labels (para treinamento supervisionado)
            nextHourProduction: hour.nextHourProduction || 0,
            hadBreakdown: hour.hadBreakdown || false,
            qualityScore: hour.qualityScore || 1
        }));
    }

    // Agregar dados por hora
    aggregateByHour(production, losses, downtime) {
        const hourlyMap = new Map();
        
        // Processar produção
        production.forEach(item => {
            const hour = this.getHourKey(item.timestamp || item.date);
            if (!hourlyMap.has(hour)) {
                hourlyMap.set(hour, { timestamp: hour, production: 0, losses: 0, downtime: 0, oee: 0 });
            }
            hourlyMap.get(hour).production += Number(item.quantity) || 0;
        });

        // Processar perdas
        losses.forEach(item => {
            const hour = this.getHourKey(item.timestamp || item.date);
            if (hourlyMap.has(hour)) {
                hourlyMap.get(hour).losses += Number(item.quantity) || 0;
            }
        });

        // Processar paradas
        downtime.forEach(item => {
            const hour = this.getHourKey(item.timestamp || item.date);
            if (hourlyMap.has(hour)) {
                hourlyMap.get(hour).downtime += Number(item.duration) || 0;
            }
        });

        return Array.from(hourlyMap.values()).sort((a, b) => 
            new Date(a.timestamp) - new Date(b.timestamp)
        );
    }

    // Construir previsão de produção horária usando histórico real
    forecastHourlyProduction(hours = 8) {
        if (!Array.isArray(this.hourlyHistory) || this.hourlyHistory.length === 0) {
            // Fallback para o modelo simples
            return this.mlModel.predictHourlyProduction(hours);
        }

        const perHourBuckets = new Map();
        let totalProduction = 0;
        this.hourlyHistory.forEach(entry => {
            const hour = new Date(entry.timestamp).getHours();
            if (!perHourBuckets.has(hour)) {
                perHourBuckets.set(hour, []);
            }
            perHourBuckets.get(hour).push(entry.production || 0);
            totalProduction += entry.production || 0;
        });

        const recentWindow = this.hourlyHistory.slice(-Math.min(this.hourlyHistory.length, 12));
        const recentAvg = recentWindow.length > 0
            ? recentWindow.reduce((sum, item) => sum + (item.production || 0), 0) / recentWindow.length
            : 0;
        const globalAvg = this.hourlyHistory.length > 0
            ? totalProduction / this.hourlyHistory.length
            : recentAvg;

        const slope = recentWindow.length >= 2
            ? (recentWindow[recentWindow.length - 1].production - recentWindow[0].production) /
                Math.max(recentWindow.length - 1, 1)
            : 0;

        const baseValue = globalAvg || recentAvg || 0;
        const forecast = [];
        const now = new Date();

        for (let i = 1; i <= hours; i++) {
            const futureDate = new Date(now.getTime() + i * 60 * 60 * 1000);
            const futureHour = futureDate.getHours();
            const bucket = perHourBuckets.get(futureHour) || [];
            const hourAvg = bucket.length > 0
                ? bucket.reduce((sum, value) => sum + value, 0) / bucket.length
                : baseValue;

            const trendDenominator = Math.max(recentAvg || baseValue || 1, 1);
            const trendFactor = 1 + ((slope / trendDenominator) * (i / hours));
            const noiseFactor = 0.97 + (Math.random() * 0.06); // pequena oscilação  ±3%
            const predicted = Math.max(0, Math.round(hourAvg * trendFactor * noiseFactor));

            forecast.push(predicted);
        }

        return forecast;
    }

    // Obter chave da hora
    getHourKey(timestamp) {
        const date = new Date(timestamp);
        return new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()).getTime();
    }

    // Atualizar interface com previsões
    async updatePredictiveInterface() {
        if (!this.predictions) return;

        // Atualizar KPIs preditivos
        this.updateKPICards();
        
        // Atualizar gráficos
        await this.updatePredictionCharts();
        
        // Atualizar recomendações
        this.updateRecommendations();
        
        // Atualizar timestamp
        const lastUpdateEl = document.getElementById('last-prediction-time');
        if (lastUpdateEl && this.lastUpdate) {
            lastUpdateEl.textContent = this.lastUpdate.toLocaleTimeString('pt-BR');
        }
    }

    // Atualizar cards de KPI
    updateKPICards() {
        const { breakdownProbability, qualityTrend, oeePrediction } = this.predictions;

        // Probabilidade de parada
        const breakdownEl = document.getElementById('breakdown-probability');
        const breakdownBarEl = document.getElementById('breakdown-probability-bar');
        if (breakdownEl && breakdownBarEl) {
            breakdownEl.textContent = `${(breakdownProbability * 100).toFixed(1)}%`;
            breakdownBarEl.style.width = `${breakdownProbability * 100}%`;
            
            // Mudar cor baseado no risco
            const colorClass = breakdownProbability > 0.7 ? 'bg-red-500' : 
                             breakdownProbability > 0.4 ? 'bg-yellow-500' : 'bg-green-500';
            breakdownBarEl.className = `h-2 rounded-full transition-all duration-500 ${colorClass}`;
        }

        // Tendência de qualidade
        const qualityEl = document.getElementById('quality-trend');
        const qualityBarEl = document.getElementById('quality-trend-bar');
        if (qualityEl && qualityBarEl) {
            qualityEl.textContent = `${(qualityTrend * 100).toFixed(1)}%`;
            qualityBarEl.style.width = `${qualityTrend * 100}%`;
        }

        // OEE previsto
        const oeeEl = document.getElementById('predicted-oee');
        const oeeBarEl = document.getElementById('predicted-oee-bar');
        if (oeeEl && oeeBarEl) {
            oeeEl.textContent = `${(oeePrediction * 100).toFixed(1)}%`;
            oeeBarEl.style.width = `${oeePrediction * 100}%`;
        }
    }

    // Atualizar gráficos de previsão
    async updatePredictionCharts() {
        if (!this.predictions) return;
        await this.updatePredictionsChart();
        await this.updateTrendsChart();
    }

    // Gráfico de previsões para próximas horas
    async updatePredictionsChart() {
        const ctx = document.getElementById('predictions-chart');
        if (!ctx || !this.predictions) return;

        if (this.charts.predictions) {
            this.charts.predictions.destroy();
        }

        const hours = Array.from({ length: 8 }, (_, i) => {
            const hour = new Date();
            hour.setHours(hour.getHours() + i + 1);
            return hour.getHours() + ':00';
        });

        const trendRaw = await this.calculateCurrentTrend(8);
        const trendData = Array.from({ length: hours.length }, (_, index) => {
            if (!trendRaw || trendRaw.length === 0) return null;
            return typeof trendRaw[index] === 'number' ? trendRaw[index] : null;
        });

        const plannedProduction = Array.from({ length: hours.length }, (_, index) => {
            const production = this.predictions.hourlyProduction?.[index];
            return typeof production === 'number' ? production : null;
        });

        this.charts.predictions = new Chart(ctx, {
            type: 'line',
            data: {
                labels: hours,
                datasets: [{
                    label: 'Produção Prevista',
                    data: plannedProduction,
                    borderColor: '#3B82F6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    fill: true,
                    tension: 0.4
                }, {
                    label: 'Tendência Atual',
                    data: trendData,
                    borderColor: '#10B981',
                    borderDash: [5, 5],
                    fill: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Peças/Hora'
                        }
                    }
                }
            }
        });
    }

    // Gráfico de tendências históricas
    async updateTrendsChart() {
        const ctx = document.getElementById('trends-chart');
        if (!ctx) return;

        if (this.charts.trends) {
            this.charts.trends.destroy();
        }

        const last7Days = await this.getLast7DaysData();
        const labels = last7Days?.labels ?? [];
        const oeeData = last7Days?.oee ?? [];
        const productionData = last7Days?.production ?? [];
        const downtimeData = last7Days?.downtime ?? [];

        this.charts.trends = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'OEE %',
                    data: oeeData,
                    borderColor: '#8B5CF6',
                    yAxisID: 'y'
                }, {
                    label: 'Produção (peças)',
                    data: productionData,
                    borderColor: '#3B82F6',
                    yAxisID: 'y1'
                }, {
                    label: 'Downtime (min)',
                    data: downtimeData,
                    borderColor: '#F97316',
                    yAxisID: 'y2'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                    }
                },
                scales: {
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: 'OEE %'
                        }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Produção (peças)'
                        },
                        grid: {
                            drawOnChartArea: false
                        }
                    },
                    y2: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Downtime (min)'
                        },
                        grid: {
                            drawOnChartArea: false
                        }
                    }
                }
            }
        });
    }

    // Gerar alertas proativos
    generateProactiveAlerts() {
        if (!this.predictions) {
            console.warn('[PREDICTIVE] Sem previsões disponíveis para gerar alertas');
            return;
        }

        const alerts = [];
        const { breakdownProbability, qualityTrend, oeePrediction } = this.predictions;

        // Alert de parada iminente
        if (breakdownProbability > 0.6) {
            alerts.push({
                type: 'danger',
                title: 'Risco Alto de Parada',
                message: `Probabilidade de ${(breakdownProbability * 100).toFixed(0)}% nas próximas 4h`,
                action: 'Verificar manutenção preventiva',
                priority: 'alta'
            });
        }

        // Alert de qualidade
        if (qualityTrend < 0.95) {
            alerts.push({
                type: 'warning',
                title: 'Tendência de Qualidade Declinante',
                message: `Qualidade prevista: ${(qualityTrend * 100).toFixed(1)}%`,
                action: 'Revisar parâmetros de processo',
                priority: 'média'
            });
        }

        // Alert de OEE baixo
        if (oeePrediction < 0.7) {
            alerts.push({
                type: 'info',
                title: 'OEE Abaixo da Meta',
                message: `OEE previsto: ${(oeePrediction * 100).toFixed(1)}%`,
                action: 'Otimizar setup e ciclos',
                priority: 'baixa'
            });
        }

        this.renderAlerts(alerts);
    }

    // Renderizar alertas na interface
    renderAlerts(alerts) {
        const container = document.getElementById('proactive-alerts');
        if (!container) return;

        if (alerts.length === 0) {
            container.innerHTML = `
                <div class="text-center text-gray-500 py-8">
                    <i data-lucide="check-circle" class="w-12 h-12 mx-auto text-green-500 mb-2"></i>
                    <p class="font-semibold">Tudo funcionando bem!</p>
                    <p class="text-sm">Nenhum alerta proativo no momento</p>
                </div>
            `;
            return;
        }

        container.innerHTML = alerts.map(alert => `
            <div class="p-4 rounded-lg border-l-4 ${this.getAlertClasses(alert.type)}">
                <div class="flex items-start justify-between">
                    <div class="flex-1">
                        <h4 class="font-semibold text-sm">${alert.title}</h4>
                        <p class="text-sm text-gray-600 mt-1">${alert.message}</p>
                        <p class="text-xs text-blue-600 mt-2 font-medium">${alert.action}</p>
                    </div>
                    <span class="text-xs px-2 py-1 rounded-full ${this.getPriorityClasses(alert.priority)}">
                        ${alert.priority.toUpperCase()}
                    </span>
                </div>
            </div>
        `).join('');
    }

    // Atualizar recomendações
    updateRecommendations() {
        const container = document.getElementById('ai-recommendations');
        if (!container || !this.predictions) return;

        const recommendations = this.predictions.recommendations || [];
        
        container.innerHTML = recommendations.map(rec => `
            <div class="flex items-start gap-3 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <i data-lucide="${rec.icon || 'lightbulb'}" class="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0"></i>
                <div class="flex-1">
                    <h4 class="font-semibold text-sm text-gray-900">${rec.title || 'Recomendação'}</h4>
                    <p class="text-sm text-gray-700 mt-1">${rec.description || rec}</p>
                    <div class="mt-2 text-xs text-yellow-700 font-medium">
                        Impacto estimado: ${rec.impact || 'Médio'}
                    </div>
                </div>
            </div>
        `).join('') || `
            <div class="text-center text-gray-500 py-6">
                <i data-lucide="lightbulb" class="w-10 h-10 mx-auto text-gray-400 mb-2"></i>
                <p class="text-sm">Nenhuma recomendação específica no momento</p>
            </div>
        `;
    }

    // Classes CSS para alertas
    getAlertClasses(type) {
        const classes = {
            danger: 'bg-red-50 border-red-500',
            warning: 'bg-yellow-50 border-yellow-500',
            info: 'bg-blue-50 border-blue-500',
            success: 'bg-green-50 border-green-500'
        };
        return classes[type] || classes.info;
    }

    // Classes CSS para prioridades
    getPriorityClasses(priority) {
        const classes = {
            alta: 'bg-red-100 text-red-800',
            média: 'bg-yellow-100 text-yellow-800',
            baixa: 'bg-blue-100 text-blue-800'
        };
        return classes[priority] || classes.baixa;
    }

    // Calcular tendência atual a partir de dados reais
    async calculateCurrentTrend(hours) {
        try {
            const endDate = new Date();
            const startDate = new Date(endDate.getTime() - hours * 60 * 60 * 1000);
            const dataset = await getFilteredData('production', formatDate(startDate), formatDate(endDate));
            if (!Array.isArray(dataset) || dataset.length === 0) {
                return [];
            }

            const buckets = Array(hours).fill(0);
            dataset.forEach(item => {
                const itemDate = getEntryDateTime(item);
                if (!itemDate) return;
                if (itemDate < startDate || itemDate > endDate) return;
                const bucketIndex = Math.floor((itemDate.getTime() - startDate.getTime()) / (60 * 60 * 1000));
                if (bucketIndex >= 0 && bucketIndex < hours) {
                    buckets[bucketIndex] += Number(item.quantity || 0);
                }
            });

            return buckets;
        } catch (error) {
            console.error('[Analytics] Erro ao calcular tendência:', error);
            return [];
        }
    }

    // Obter dados dos últimos 7 dias
    async getLast7DaysData() {
        try {
            if (!this.historicalData) {
                return { labels: [], oee: [], production: [], downtime: [] };
            }

            const labels = [];
            const dayKeys = [];

            for (let i = 6; i >= 0; i--) {
                const date = new Date();
                date.setDate(date.getDate() - i);
                date.setHours(0, 0, 0, 0);
                labels.push(date.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' }));
                dayKeys.push(formatDate(date));
            }

            const productionTotals = dayKeys.map(() => 0);
            const downtimeTotals = dayKeys.map(() => 0);

            this.historicalData.production.forEach(entry => {
                const key = getEntryDateKey(entry);
                const index = dayKeys.indexOf(key);
                if (index !== -1) {
                    productionTotals[index] += Number(entry.quantity || 0);
                }
            });

            this.historicalData.downtime.forEach(entry => {
                const key = getEntryDateKey(entry);
                const index = dayKeys.indexOf(key);
                if (index !== -1) {
                    downtimeTotals[index] += Number(entry.duration || 0);
                }
            });

            const oee = productionTotals.map((prod, idx) => {
                const down = downtimeTotals[idx];
                const denominator = prod + down;
                if (denominator <= 0) return 0;
                return Math.min(100, (prod / denominator) * 100);
            });

            return {
                labels,
                oee,
                production: productionTotals,
                downtime: downtimeTotals
            };

        } catch (error) {
            console.error('[Analytics] Erro ao carregar dados históricos:', error);
            return { labels: [], oee: [], production: [], downtime: [] };
        }
    }

    // Cleanup
    destroy() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        
        Object.values(this.charts).forEach(chart => {
            if (chart) chart.destroy();
        });
        
        this.charts = {};
    }
}

// Engine simples de ML
class SimpleMLEngine {
    constructor() {
        this.trained = false;
        this.baseMetrics = {};
    }

    async train(trainingData) {
        console.log('[ML] Treinando modelo com', trainingData.length, 'amostras');
        
        // Calcular métricas base
        this.baseMetrics = {
            avgProduction: trainingData.reduce((sum, d) => sum + d.productionRate, 0) / trainingData.length,
            avgDowntime: trainingData.reduce((sum, d) => sum + d.downtimeMinutes, 0) / trainingData.length,
            avgScrapRate: trainingData.reduce((sum, d) => sum + d.scrapRate, 0) / trainingData.length,
            avgOEE: trainingData.reduce((sum, d) => sum + d.oee, 0) / trainingData.length
        };

        this.trained = true;
        console.log('[ML] Modelo treinado com métricas base:', this.baseMetrics);
    }

    predictBreakdown() {
        if (!this.trained) return null; // sem dados reais, retornar null
        
        // Algoritmo baseado em downtime histórico real
        const riskFactor = Math.min(this.baseMetrics.avgDowntime / 120, 1);
        return Math.min(0.9, Math.max(0.05, riskFactor));
    }

    predictQuality() {
        if (!this.trained) return null; // sem dados reais, retornar null
        
        // Baseado na taxa de refugo real
        const qualityFactor = Math.max(0.8, 1 - this.baseMetrics.avgScrapRate * 2);
        return Math.min(0.99, Math.max(0.85, qualityFactor));
    }

    predictOEE() {
        if (!this.trained) return null; // sem dados reais, retornar null
        
        // Baseado no OEE histórico real
        return Math.min(0.95, Math.max(0.5, this.baseMetrics.avgOEE));
    }

    predictHourlyProduction(hours) {
        if (!this.trained) {
            return Array(hours).fill(0); // retornar zeros sem dados reais
        }
        
        const baseRate = this.baseMetrics.avgProduction * 60;
        return Array.from({ length: hours }, () => Math.max(0, baseRate));
    }

    generateRecommendations() {
        if (!this.trained) return [];

        const recommendations = [];

        // Recomendação baseada em downtime
        if (this.baseMetrics.avgDowntime > 90) {
            recommendations.push({
                icon: 'wrench',
                title: 'Revisar Manutenção Preventiva',
                description: 'Tempo de parada acima da média. Considere ajustar cronograma de manutenção.',
                impact: '+5-10% OEE'
            });
        }

        // Recomendação baseada em qualidade
        if (this.baseMetrics.avgScrapRate > 0.05) {
            recommendations.push({
                icon: 'target',
                title: 'Otimizar Controle de Qualidade',
                description: 'Taxa de refugo elevada. Revisar parâmetros de processo e calibração.',
                impact: '+2-5% Produtividade'
            });
        }

        // Recomendação baseada em OEE
        if (this.baseMetrics.avgOEE < 0.75) {
            recommendations.push({
                icon: 'trending-up',
                title: 'Foco na Melhoria Contínua',
                description: 'OEE abaixo do benchmark. Implementar ciclo PDCA nas operações.',
                impact: '+10-15% Eficiência'
            });
        }

        return recommendations;
    }
}

// Instância global do sistema preditivo
window.predictiveAnalytics = new PredictiveAnalytics();

// Auto-inicializar quando a aba preditiva for carregada
document.addEventListener('DOMContentLoaded', () => {
    console.log('[PREDICTIVE] Sistema de analytics preditivos carregado');
});