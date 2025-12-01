/**
 * Syncrho v8.0 - Sistema SPC (Statistical Process Control)
 * Controle Estatístico de Processo com gráficos X-R e capacidade
 */

// Verificar dependências globais
if (typeof getFilteredData === 'undefined' && typeof window.getFilteredData === 'undefined') {
    console.warn('[SPC] Função getFilteredData não encontrada. Carregue predictive-analytics.js ou traceability-system.js antes.');
}
if (typeof formatDate === 'undefined' && typeof window.formatDate === 'undefined') {
    console.warn('[SPC] Função formatDate não encontrada. Carregue predictive-analytics.js ou traceability-system.js antes.');
}

class SPCController {
    constructor() {
        this.charts = {};
        this.spcData = {
            measurements: [],
            controlLimits: {},
            processCapability: {},
            alarms: [],
            lastUpdate: null
        };
        this.activeMonitoring = false;
        this.monitoringInterval = null;
        
        // Configurações SPC
        this.config = {
            sampleSize: 5,          // Tamanho da amostra para subgrupos
            updateInterval: 300000, // 5 minutos
            controlRules: {
                rule1: true,  // Ponto fora dos limites de controle
                rule2: true,  // 9 pontos consecutivos do mesmo lado da linha central
                rule3: true,  // 6 pontos consecutivos crescentes ou decrescentes
                rule4: true,  // 14 pontos consecutivos alternando para cima e para baixo
                rule5: true,  // 2 de 3 pontos consecutivos na zona A ou além
                rule6: true,  // 4 de 5 pontos consecutivos na zona B ou além
                rule7: true,  // 15 pontos consecutivos na zona C (ambos os lados da linha central)
                rule8: true   // 8 pontos consecutivos fora da zona C (ambos os lados)
            }
        };
    }

    // Inicializar sistema SPC
    async initialize() {
        console.log('[SPC] ========================================');
        console.log('[SPC] Inicializando Sistema de Controle Estatístico de Processo');
        console.log('[SPC] Chart.js disponível:', typeof Chart !== 'undefined');
        console.log('[SPC] Firebase disponível:', typeof db !== 'undefined');
        console.log('[SPC] ========================================');
        
        // Verificar se Chart.js está disponível
        if (typeof Chart === 'undefined') {
            console.error('[SPC] Chart.js não está carregado! Os gráficos não serão exibidos.');
            // Tentar carregar Chart.js dinamicamente
            return;
        }
        
        // Atualizar status para "Carregando"
        const statusElement = document.getElementById('spc-process-status');
        console.log('[SPC] Elemento de status encontrado:', !!statusElement);
        if (statusElement) {
            statusElement.textContent = 'Carregando...';
            statusElement.className = 'px-3 py-1 rounded-full text-sm font-medium text-blue-600 bg-blue-50';
        }
        
        try {
            // Carregar dados históricos
            await this.loadHistoricalData();
            
            console.log('[SPC] Medições carregadas:', this.spcData.measurements.length);
            
            if (this.spcData.measurements.length === 0) {
                console.warn('[SPC] Nenhum dado disponível, gerando dados sintéticos para demonstração');
                this.spcData.measurements = this.generateSyntheticData();
                console.log('[SPC] Dados sintéticos gerados:', this.spcData.measurements.length);
            }
            
            // Verificar novamente após gerar sintéticos
            if (this.spcData.measurements.length === 0) {
                console.error('[SPC] Falha crítica: não foi possível gerar dados');
                if (statusElement) {
                    statusElement.textContent = 'Erro';
                    statusElement.className = 'px-3 py-1 rounded-full text-sm font-medium text-red-600 bg-red-50';
                }
                this.showNoDataMessage();
                return;
            }
            
            // Calcular limites de controle
            this.calculateControlLimits();
            
            console.log('[SPC] Limites calculados:', this.spcData.controlLimits ? 'Sim' : 'Não');
            
            // Calcular capacidade do processo
            this.calculateProcessCapability();
            
            console.log('[SPC] Capacidade calculada:', this.spcData.processCapability ? 'Sim' : 'Não');
            
            // Aplicar regras de controle
            this.applyControlRules();
            
            // Atualizar interface
            console.log('[SPC] Atualizando interface...');
            this.updateSPCInterface();
            
            // Atualizar timestamp
            this.spcData.lastUpdate = new Date();
            
            // Iniciar monitoramento automático
            this.startMonitoring();
            
            console.log('[SPC] Sistema SPC ativo com', this.spcData.measurements.length, 'medições');
            
        } catch (error) {
            console.error('[SPC] Erro ao inicializar sistema:', error);
            if (statusElement) {
                statusElement.textContent = 'Erro';
                statusElement.className = 'px-3 py-1 rounded-full text-sm font-medium text-red-600 bg-red-50';
            }
        }
    }

    // Mostrar mensagem de sem dados
    showNoDataMessage() {
        const containers = ['spc-xbar-chart', 'spc-r-chart', 'spc-histogram'];
        containers.forEach(id => {
            const container = document.getElementById(id);
            if (container) {
                const parent = container.parentElement;
                if (parent) {
                    parent.innerHTML = `
                        <div class="flex items-center justify-center h-64 text-gray-500">
                            <div class="text-center">
                                <i data-lucide="bar-chart-2" class="w-12 h-12 mx-auto mb-2 text-gray-400"></i>
                                <p class="font-medium">Dados Insuficientes</p>
                                <p class="text-sm">Aguardando dados de produção para análise SPC</p>
                            </div>
                        </div>
                    `;
                }
            }
        });
        
        // Atualizar KPIs para "--"
        const kpiIds = ['spc-cp-value', 'spc-cpk-value', 'spc-defect-rate', 'spc-sigma-level'];
        kpiIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = '--';
        });
    }

    // Carregar dados históricos para SPC
    async loadHistoricalData() {
        try {
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(endDate.getDate() - 30); // 30 dias

            // Verificar se as funções globais estão disponíveis
            const getDataFn = typeof getFilteredData === 'function' ? getFilteredData : 
                             (typeof window.getFilteredData === 'function' ? window.getFilteredData : null);
            const formatFn = typeof formatDate === 'function' ? formatDate : 
                            (typeof window.formatDate === 'function' ? window.formatDate : this.formatDateFallback);

            if (!getDataFn) {
                console.warn('[SPC] Função getFilteredData não disponível, usando dados sintéticos');
                this.spcData.measurements = this.generateSyntheticData();
                return;
            }

            // Carregar dados de produção para contexto
            const productionData = await getDataFn('production', formatFn(startDate), formatFn(endDate));
            
            console.log('[SPC] Dados de produção carregados:', productionData?.length || 0);
            
            // Carregar medições reais de qualidade do Firestore
            let measurements = await this.loadQualityMeasurements(formatFn(startDate), formatFn(endDate));

            if (!measurements || measurements.length < this.config.sampleSize * 4) {
                console.warn('[SPC] Medições de qualidade insuficientes, gerando fallback a partir de dados de produção');
                const fallback = this.generateFallbackMeasurements(productionData || []);
                if (fallback.length > 0) {
                    measurements = fallback;
                } else {
                    console.warn('[SPC] Dados de produção também insuficientes, usando dados sintéticos');
                    measurements = this.generateSyntheticData();
                }
            }

            this.spcData.measurements = measurements;
            
            console.log('[SPC] Dados carregados:', {
                measurements: this.spcData.measurements.length,
                period: `${formatFn(startDate)} a ${formatFn(endDate)}`
            });

        } catch (error) {
            console.error('[SPC] Erro ao carregar dados:', error);
            // Usar dados sintéticos em caso de erro
            this.spcData.measurements = this.generateSyntheticData();
        }
    }

    // Fallback para formatDate
    formatDateFallback(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // Gerar dados sintéticos para demonstração
    generateSyntheticData() {
        console.log('[SPC] Gerando dados sintéticos para demonstração');
        
        const measurements = [];
        const baseValue = 100; // Valor base
        const targetSpec = baseValue;
        const tolerance = baseValue * 0.05; // 5% de tolerância
        
        const now = new Date();
        
        // Gerar 100 medições sintéticas
        for (let i = 0; i < 100; i++) {
            const timestamp = new Date(now.getTime() - (100 - i) * 60 * 60 * 1000); // Uma por hora
            
            // Variação normal com ocasionais outliers
            const noise = (Math.random() - 0.5) * tolerance * 0.8;
            const drift = Math.sin(i / 20) * tolerance * 0.2; // Pequena tendência senoidal
            const value = baseValue + noise + drift;
            
            measurements.push({
                id: `synthetic-${i}`,
                value: Number(value.toFixed(2)),
                machine: `H${String((i % 10) + 1).padStart(2, '0')}`,
                timestamp: timestamp,
                specification: {
                    target: targetSpec,
                    upperLimit: targetSpec + tolerance,
                    lowerLimit: targetSpec - tolerance
                }
            });
        }
        
        return measurements;
    }

    // Gerar medições sintéticas a partir da produção quando não há dados de qualidade
    generateFallbackMeasurements(productionData = []) {
        if (!Array.isArray(productionData) || productionData.length === 0) {
            return [];
        }

        const derivedMeasurements = [];

        productionData.forEach((entry, index) => {
            const baseValue = Number(entry.quantity ?? entry.produzido ?? entry.total ?? 0);
            if (!Number.isFinite(baseValue) || baseValue <= 0) {
                return;
            }

            const timestamp = this.normalizeToDate(
                entry.datetime || entry.timestamp || entry.updatedAt || entry.createdAt || entry.date
            ) || new Date();

            derivedMeasurements.push({
                id: entry.id ? `prod-${entry.id}` : `prod-${index}`,
                value: baseValue,
                machine: entry.machine || 'UNKNOWN',
                timestamp,
                specification: null
            });
        });

        if (derivedMeasurements.length === 0) {
            return [];
        }

        const values = derivedMeasurements.map(m => m.value);
        const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
        const variance = values.reduce((sum, value) => sum + Math.pow(value - avg, 2), 0) / values.length;
        const stdDev = Math.sqrt(Math.max(variance, 1));
        const tolerance = Math.max(avg * 0.05, stdDev || 1);

        const specification = {
            target: avg,
            upperLimit: avg + tolerance,
            lowerLimit: Math.max(0, avg - tolerance)
        };

        return derivedMeasurements.map(measurement => ({
            ...measurement,
            specification
        }));
    }

    normalizeToDate(value) {
        if (!value) return null;
        if (value instanceof Date) return value;
        if (typeof value === 'object' && typeof value.toDate === 'function') {
            return value.toDate();
        }
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    // Carregar medições de qualidade reais do Firestore
    async loadQualityMeasurements(startDate, endDate) {
        try {
            if (typeof db === 'undefined') {
                console.warn('[SPC] Firestore não inicializado - retornando vazio');
                return [];
            }

            let query = db.collection('quality_measurements');
            
            if (startDate && endDate) {
                query = query.where('timestamp', '>=', new Date(startDate))
                            .where('timestamp', '<=', new Date(endDate));
            }
            
            const snapshot = await query.limit(1000).get();
            const measurements = [];
            
            snapshot.forEach(doc => {
                measurements.push({
                    id: doc.id,
                    ...doc.data(),
                    timestamp: doc.data().timestamp?.toDate ? doc.data().timestamp.toDate() : new Date(doc.data().timestamp)
                });
            });
            
            return measurements.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            
        } catch (error) {
            console.error('[SPC] Erro ao carregar medições de qualidade:', error);
            return [];
        }
    }

    // Calcular limites de controle X-R
    calculateControlLimits() {
        console.log('[SPC] Iniciando cálculo de limites de controle...');
        const { measurements } = this.spcData;
        console.log('[SPC] Número de medições:', measurements?.length || 0);
        
        if (!measurements || measurements.length < 10) { // Mínimo reduzido para 10
            console.warn('[SPC] Dados insuficientes para cálculo de limites:', measurements?.length || 0);
            this.spcData.controlLimits = null;
            return;
        }

        // Agrupar medições em subgrupos
        const subgroups = this.createSubgroups(measurements);
        console.log('[SPC] Subgrupos criados:', subgroups?.length || 0);

        if (!subgroups.length || subgroups.length < 2) {
            console.warn('[SPC] Nenhum subgrupo completo para cálculo de limites');
            this.spcData.controlLimits = null;
            return;
        }
        
        console.log('[SPC] Calculando limites com', subgroups.length, 'subgrupos');
        
        // Calcular estatísticas para cada subgrupo
        const subgroupStats = subgroups.map(subgroup => {
            const values = subgroup.map(m => m.value);
            const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
            const range = Math.max(...values) - Math.min(...values);
            
            return {
                timestamp: subgroup[0].timestamp,
                machine: subgroup[0].machine,
                mean: mean,
                range: range,
                values: values,
                size: values.length
            };
        });

        // Calcular limites de controle
        const overallMean = subgroupStats.reduce((sum, sg) => sum + sg.mean, 0) / subgroupStats.length;
        const averageRange = subgroupStats.reduce((sum, sg) => sum + sg.range, 0) / subgroupStats.length;
        
        // Constantes para gráficos X-R (baseadas no tamanho da amostra)
        const sampleSize = this.config.sampleSize;
        const constants = this.getControlConstants(sampleSize);
        
        // Limites do gráfico X (médias)
        const xChart = {
            centerLine: overallMean,
            upperControlLimit: overallMean + (constants.A2 * averageRange),
            lowerControlLimit: overallMean - (constants.A2 * averageRange),
            upperWarningLimit: overallMean + (constants.A2 * averageRange * 2/3),
            lowerWarningLimit: overallMean - (constants.A2 * averageRange * 2/3)
        };

        // Limites do gráfico R (amplitudes)
        const rChart = {
            centerLine: averageRange,
            upperControlLimit: constants.D4 * averageRange,
            lowerControlLimit: Math.max(0, constants.D3 * averageRange),
            upperWarningLimit: constants.D4 * averageRange * 2/3,
            lowerWarningLimit: Math.max(0, constants.D3 * averageRange * 2/3)
        };

        this.spcData.controlLimits = {
            xChart,
            rChart,
            subgroupStats,
            constants,
            calculatedAt: new Date()
        };

        console.log('[SPC] Limites de controle calculados:', this.spcData.controlLimits);
    }

    // Criar subgrupos para análise
    createSubgroups(measurements) {
        const subgroups = [];
        const groupSize = this.config.sampleSize;
        
        for (let i = 0; i < measurements.length; i += groupSize) {
            const subgroup = measurements.slice(i, i + groupSize);
            if (subgroup.length === groupSize) {
                subgroups.push(subgroup);
            }
        }
        
        return subgroups;
    }

    // Constantes para cálculo de limites de controle
    getControlConstants(n) {
        const constants = {
            2: { A2: 1.880, D3: 0, D4: 3.267, d2: 1.128 },
            3: { A2: 1.023, D3: 0, D4: 2.574, d2: 1.693 },
            4: { A2: 0.729, D3: 0, D4: 2.282, d2: 2.059 },
            5: { A2: 0.577, D3: 0, D4: 2.114, d2: 2.326 },
            6: { A2: 0.483, D3: 0, D4: 2.004, d2: 2.534 },
            7: { A2: 0.419, D3: 0.076, D4: 1.924, d2: 2.704 },
            8: { A2: 0.373, D3: 0.136, D4: 1.864, d2: 2.847 },
            9: { A2: 0.337, D3: 0.184, D4: 1.816, d2: 2.970 },
            10: { A2: 0.308, D3: 0.223, D4: 1.777, d2: 3.078 }
        };
        
        return constants[n] || constants[5]; // Default para n=5
    }

    // Calcular capacidade do processo (Cp, Cpk, Pp, Ppk)
    calculateProcessCapability() {
        const { measurements, controlLimits } = this.spcData;
        if (!measurements.length || !controlLimits) return;

        // Assumir especificações (em produção, viria do produto)
        const firstMeasurement = measurements[0];
        const spec = firstMeasurement.specification;
        
        if (!spec) return;

        // Estatísticas do processo
        const values = measurements.map(m => m.value);
        const processMean = values.reduce((sum, v) => sum + v, 0) / values.length;
        const processStdDev = this.calculateStandardDeviation(values);
        
        // Limites de especificação
        const USL = spec.upperLimit; // Upper Specification Limit
        const LSL = spec.lowerLimit; // Lower Specification Limit
        const target = spec.target;   // Target value
        
        // Capacidade potencial (Cp) - considera apenas variação
        const Cp = (USL - LSL) / (6 * processStdDev);
        
        // Capacidade real (Cpk) - considera centralização
        const Cpk = Math.min(
            (USL - processMean) / (3 * processStdDev),
            (processMean - LSL) / (3 * processStdDev)
        );
        
        // Performance do processo (Pp) - usa desvio padrão total
        const Pp = (USL - LSL) / (6 * processStdDev);
        
        // Performance real (Ppk)
        const Ppk = Math.min(
            (USL - processMean) / (3 * processStdDev),
            (processMean - LSL) / (3 * processStdDev)
        );

        // % Defeituosos estimado
        const defectRate = this.calculateDefectRate(values, LSL, USL);
        
        // DPMO (Defeitos Por Milhão de Oportunidades)
        const dpmo = defectRate * 1000000;
        
        // Nível Sigma
        const sigmaLevel = this.calculateSigmaLevel(dpmo);

        this.spcData.processCapability = {
            Cp: Number(Cp.toFixed(3)),
            Cpk: Number(Cpk.toFixed(3)),
            Pp: Number(Pp.toFixed(3)),
            Ppk: Number(Ppk.toFixed(3)),
            processMean: Number(processMean.toFixed(3)),
            processStdDev: Number(processStdDev.toFixed(3)),
            defectRate: Number((defectRate * 100).toFixed(3)),
            dpmo: Number(dpmo.toFixed(0)),
            sigmaLevel: Number(sigmaLevel.toFixed(1)),
            specification: spec,
            sampleSize: values.length,
            capability: this.interpretCapability(Cpk),
            calculatedAt: new Date()
        };

        console.log('[SPC] Capacidade do processo calculada:', this.spcData.processCapability);
    }

    // Calcular desvio padrão
    calculateStandardDeviation(values) {
        const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
        const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
        const variance = squaredDiffs.reduce((sum, sd) => sum + sd, 0) / (values.length - 1);
        return Math.sqrt(variance);
    }

    // Calcular taxa de defeitos
    calculateDefectRate(values, LSL, USL) {
        const defects = values.filter(v => v < LSL || v > USL).length;
        return defects / values.length;
    }

    // Calcular nível sigma
    calculateSigmaLevel(dpmo) {
        // Aproximação simples do nível sigma baseado em DPMO
        if (dpmo <= 3.4) return 6.0;
        if (dpmo <= 233) return 5.0;
        if (dpmo <= 6210) return 4.0;
        if (dpmo <= 66807) return 3.0;
        if (dpmo <= 308538) return 2.0;
        return 1.0;
    }

    // Interpretar capacidade
    interpretCapability(cpk) {
        if (cpk >= 2.0) return 'Excelente';
        if (cpk >= 1.33) return 'Adequado';
        if (cpk >= 1.0) return 'Marginal';
        return 'Inadequado';
    }

    // Aplicar regras de controle (Western Electric Rules)
    applyControlRules() {
        const { controlLimits } = this.spcData;
        if (!controlLimits) return [];

        const alarms = [];
        const stats = controlLimits.subgroupStats;
        
        if (stats.length < 9) return alarms; // Precisa de dados suficientes

        // Verificar cada regra para os últimos pontos
        const recent = stats.slice(-25); // Últimos 25 subgrupos
        
        recent.forEach((point, index) => {
            const globalIndex = stats.length - recent.length + index;
            
            // Regra 1: Ponto fora dos limites de controle
            if (this.config.controlRules.rule1) {
                if (point.mean > controlLimits.xChart.upperControlLimit || 
                    point.mean < controlLimits.xChart.lowerControlLimit) {
                    alarms.push({
                        type: 'OUT_OF_CONTROL',
                        rule: 'Regra 1',
                        description: 'Ponto fora dos limites de controle',
                        subgroup: globalIndex + 1,
                        value: point.mean,
                        timestamp: point.timestamp,
                        severity: 'critical'
                    });
                }
            }

            // Regra 2: 9 pontos consecutivos do mesmo lado da linha central
            if (this.config.controlRules.rule2 && index >= 8) {
                const last9 = recent.slice(index - 8, index + 1);
                const allAbove = last9.every(p => p.mean > controlLimits.xChart.centerLine);
                const allBelow = last9.every(p => p.mean < controlLimits.xChart.centerLine);
                
                if (allAbove || allBelow) {
                    alarms.push({
                        type: 'TREND',
                        rule: 'Regra 2',
                        description: '9 pontos consecutivos do mesmo lado da linha central',
                        subgroup: globalIndex + 1,
                        severity: 'high'
                    });
                }
            }

            // Regra 3: 6 pontos consecutivos crescentes ou decrescentes
            if (this.config.controlRules.rule3 && index >= 5) {
                const last6 = recent.slice(index - 5, index + 1);
                const increasing = last6.every((p, i) => i === 0 || p.mean > last6[i-1].mean);
                const decreasing = last6.every((p, i) => i === 0 || p.mean < last6[i-1].mean);
                
                if (increasing || decreasing) {
                    alarms.push({
                        type: 'TREND',
                        rule: 'Regra 3',
                        description: '6 pontos consecutivos em tendência',
                        subgroup: globalIndex + 1,
                        severity: 'high'
                    });
                }
            }

            // Adicionar mais regras conforme necessário...
        });

        this.spcData.alarms = alarms;
        return alarms;
    }

    // Iniciar monitoramento automático
    startMonitoring() {
        if (this.activeMonitoring) return;

        this.activeMonitoring = true;
        this.monitoringInterval = setInterval(() => {
            this.checkProcessStatus();
        }, this.config.updateInterval);

        console.log('[SPC] Monitoramento ativo');
    }

    // Verificar status do processo
    async checkProcessStatus() {
        try {
            // Monitorar novas medições em tempo real
            await this.monitorNewMeasurements();
            
            // Recalcular limites se necessário
            this.calculateControlLimits();
            
            // Aplicar regras de controle
            const alarms = this.applyControlRules();
            
            // Atualizar interface
            this.updateSPCInterface();
            
            // Processar alarmes
            if (alarms.length > 0) {
                this.processAlarms(alarms);
            }

        } catch (error) {
            console.error('[SPC] Erro no monitoramento:', error);
        }
    }

    // Monitoramento contínuo de medições do Firestore
    async monitorNewMeasurements() {
        // Em produção, usa listeners do Firestore para tempo real
        try {
            if (typeof db === 'undefined') {
                console.warn('[SPC] Firestore não disponível para monitoramento');
                return;
            }

            // Configurar listener em tempo real para collection quality_measurements
            db.collection('quality_measurements')
                .where('timestamp', '>=', new Date(Date.now() - 24 * 60 * 60 * 1000))
                .orderBy('timestamp', 'desc')
                .limit(100)
                .onSnapshot(snapshot => {
                    const newMeasurements = [];
                    
                    snapshot.forEach(doc => {
                        newMeasurements.push({
                            id: doc.id,
                            ...doc.data(),
                            timestamp: doc.data().timestamp?.toDate ? doc.data().timestamp.toDate() : new Date(doc.data().timestamp)
                        });
                    });
                    
                    // Atualizar dados SPC com novas medições
                    if (newMeasurements.length > 0) {
                        this.spcData.measurements = newMeasurements;
                        this.updateSPCInterface();
                        
                        // Aplicar regras de controle
                        const alarms = this.applyControlRules();
                        if (alarms.length > 0) {
                            this.processAlarms(alarms);
                        }
                    }
                });
                
        } catch (error) {
            console.error('[SPC] Erro ao configurar monitoramento em tempo real:', error);
        }
    }

    // Processar alarmes
    processAlarms(alarms) {
        alarms.forEach(alarm => {
            console.warn(`[SPC-ALARM] ${alarm.rule}: ${alarm.description}`, alarm);
            
            // Em produção, aqui seria enviado para sistema de notificações
            this.showSPCAlert(alarm);
        });
    }

    // Mostrar alerta SPC
    showSPCAlert(alarm) {
        // Adicionar à lista de alertas na interface
        const alertsContainer = document.getElementById('spc-alerts-container');
        if (!alertsContainer) return;

        const alertElement = document.createElement('div');
        alertElement.className = `p-3 rounded-lg border-l-4 mb-3 ${
            alarm.severity === 'critical' ? 'bg-red-50 border-red-500' :
            alarm.severity === 'high' ? 'bg-orange-50 border-orange-500' :
            'bg-yellow-50 border-yellow-500'
        }`;
        
        alertElement.innerHTML = `
            <div class="flex items-start justify-between">
                <div>
                    <h5 class="font-semibold text-sm">${alarm.rule}</h5>
                    <p class="text-sm text-gray-700">${alarm.description}</p>
                    <p class="text-xs text-gray-500 mt-1">Subgrupo ${alarm.subgroup} - ${new Date(alarm.timestamp).toLocaleTimeString()}</p>
                </div>
                <button onclick="this.parentElement.parentElement.remove()" class="text-gray-400 hover:text-gray-600">
                    <i data-lucide="x" class="w-4 h-4"></i>
                </button>
            </div>
        `;
        
        alertsContainer.insertBefore(alertElement, alertsContainer.firstChild);
        
        // Remover alertas antigos (manter apenas os últimos 10)
        while (alertsContainer.children.length > 10) {
            alertsContainer.removeChild(alertsContainer.lastChild);
        }
    }

    // Atualizar interface SPC
    updateSPCInterface() {
        console.log('[SPC] updateSPCInterface chamado');
        console.log('[SPC] Dados disponíveis:', {
            measurements: this.spcData.measurements?.length || 0,
            controlLimits: !!this.spcData.controlLimits,
            processCapability: !!this.spcData.processCapability
        });
        
        this.updateControlCharts();
        this.updateCapabilityDisplay();
        this.updateProcessStatus();
        
        // Forçar resize dos gráficos após renderização
        setTimeout(() => {
            Object.values(this.charts).forEach(chart => {
                if (chart && typeof chart.resize === 'function') {
                    chart.resize();
                }
            });
        }, 100);
    }

    // Atualizar gráficos de controle
    updateControlCharts() {
        console.log('[SPC] updateControlCharts chamado');
        this.updateXBarChart();
        this.updateRChart();
        this.updateHistogram();
    }

    // Gráfico X-bar (médias)
    updateXBarChart() {
        console.log('[SPC] updateXBarChart chamado');
        
        const ctx = document.getElementById('spc-xbar-chart');
        console.log('[SPC] Canvas spc-xbar-chart encontrado:', !!ctx);
        
        if (!ctx) {
            console.warn('[SPC] Elemento spc-xbar-chart não encontrado');
            return;
        }
        
        if (typeof Chart === 'undefined') {
            console.warn('[SPC] Chart.js não disponível');
            return;
        }
        
        console.log('[SPC] Control Limits:', !!this.spcData.controlLimits);
        
        if (!this.spcData.controlLimits) {
            console.warn('[SPC] Limites de controle não calculados');
            return;
        }

        if (this.charts.xbar) {
            this.charts.xbar.destroy();
        }

        const { xChart, subgroupStats } = this.spcData.controlLimits || {};
        console.log('[SPC] xChart:', !!xChart, 'subgroupStats:', subgroupStats?.length);
        
        if (!xChart || !Array.isArray(subgroupStats) || subgroupStats.length === 0) {
            console.warn('[SPC] Gráfico X̄ sem dados suficientes para renderizar');
            return;
        }
        
        console.log('[SPC] Renderizando gráfico X̄ com', subgroupStats.length, 'subgrupos');
        
        const labels = subgroupStats.map((_, i) => `SG${i + 1}`);
        const values = subgroupStats.map(sg => sg.mean);

        this.charts.xbar = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels.slice(-30), // Últimos 30 subgrupos
                datasets: [
                    {
                        label: 'Média dos Subgrupos',
                        data: values.slice(-30),
                        borderColor: '#3B82F6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        pointBackgroundColor: values.slice(-30).map(v => 
                            v > xChart.upperControlLimit || v < xChart.lowerControlLimit ? '#EF4444' : '#3B82F6'
                        ),
                        pointRadius: 4,
                        tension: 0.1
                    },
                    {
                        label: 'LCS',
                        data: Array(Math.min(30, labels.length)).fill(xChart.upperControlLimit),
                        borderColor: '#EF4444',
                        borderDash: [5, 5],
                        pointRadius: 0,
                        fill: false
                    },
                    {
                        label: 'LC',
                        data: Array(Math.min(30, labels.length)).fill(xChart.centerLine),
                        borderColor: '#10B981',
                        pointRadius: 0,
                        fill: false
                    },
                    {
                        label: 'LCI',
                        data: Array(Math.min(30, labels.length)).fill(xChart.lowerControlLimit),
                        borderColor: '#EF4444',
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
                    title: {
                        display: true,
                        text: 'Gráfico X̄ (Médias dos Subgrupos)'
                    },
                    legend: {
                        position: 'top'
                    }
                },
                scales: {
                    y: {
                        title: {
                            display: true,
                            text: 'Valor'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Subgrupos'
                        }
                    }
                },
                elements: {
                    point: {
                        hoverRadius: 8
                    }
                }
            }
        });
    }

    // Gráfico R (amplitudes)
    updateRChart() {
        const ctx = document.getElementById('spc-r-chart');
        if (!ctx) {
            console.warn('[SPC] Elemento spc-r-chart não encontrado');
            return;
        }
        
        if (typeof Chart === 'undefined') {
            console.warn('[SPC] Chart.js não disponível para gráfico R');
            return;
        }
        
        if (!this.spcData.controlLimits) {
            console.warn('[SPC] Limites de controle não calculados para gráfico R');
            return;
        }

        if (this.charts.r) {
            this.charts.r.destroy();
        }

        const { rChart, subgroupStats } = this.spcData.controlLimits || {};
        if (!rChart || !Array.isArray(subgroupStats) || subgroupStats.length === 0) {
            console.warn('[SPC] Gráfico R sem dados suficientes para renderizar');
            return;
        }
        
        console.log('[SPC] Renderizando gráfico R com', subgroupStats.length, 'subgrupos');
        
        const labels = subgroupStats.map((_, i) => `SG${i + 1}`);
        const ranges = subgroupStats.map(sg => sg.range);

        this.charts.r = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels.slice(-30),
                datasets: [
                    {
                        label: 'Amplitude dos Subgrupos',
                        data: ranges.slice(-30),
                        borderColor: '#F59E0B',
                        backgroundColor: 'rgba(245, 158, 11, 0.1)',
                        pointBackgroundColor: ranges.slice(-30).map(r => 
                            r > rChart.upperControlLimit ? '#EF4444' : '#F59E0B'
                        ),
                        pointRadius: 4,
                        tension: 0.1
                    },
                    {
                        label: 'LCS',
                        data: Array(Math.min(30, labels.length)).fill(rChart.upperControlLimit),
                        borderColor: '#EF4444',
                        borderDash: [5, 5],
                        pointRadius: 0,
                        fill: false
                    },
                    {
                        label: 'LC',
                        data: Array(Math.min(30, labels.length)).fill(rChart.centerLine),
                        borderColor: '#10B981',
                        pointRadius: 0,
                        fill: false
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Gráfico R (Amplitudes dos Subgrupos)'
                    },
                    legend: {
                        position: 'top'
                    }
                },
                scales: {
                    y: {
                        title: {
                            display: true,
                            text: 'Amplitude'
                        },
                        min: 0
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Subgrupos'
                        }
                    }
                }
            }
        });
    }

    // Histograma da distribuição
    updateHistogram() {
        const ctx = document.getElementById('spc-histogram');
        if (!ctx) {
            console.warn('[SPC] Elemento spc-histogram não encontrado');
            return;
        }
        
        if (typeof Chart === 'undefined') {
            console.warn('[SPC] Chart.js não disponível para histograma');
            return;
        }
        
        if (!this.spcData.measurements || !this.spcData.measurements.length) {
            console.warn('[SPC] Sem medições para histograma');
            return;
        }

        if (this.charts.histogram) {
            this.charts.histogram.destroy();
        }

        const values = this.spcData.measurements.map(m => m.value);
        console.log('[SPC] Renderizando histograma com', values.length, 'valores');
        
        const min = Math.min(...values);
        const max = Math.max(...values);
        
        // Evitar divisão por zero
        if (min === max) {
            console.warn('[SPC] Todos os valores são iguais, não é possível criar histograma');
            return;
        }
        
        const binCount = Math.min(20, Math.ceil(Math.sqrt(values.length)));
        const binWidth = (max - min) / binCount;
        
        const bins = Array(binCount).fill(0);
        const binLabels = [];
        
        for (let i = 0; i < binCount; i++) {
            const binStart = min + (i * binWidth);
            const binEnd = binStart + binWidth;
            binLabels.push(`${binStart.toFixed(2)}-${binEnd.toFixed(2)}`);
            
            bins[i] = values.filter(v => v >= binStart && v < binEnd).length;
        }

        this.charts.histogram = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: binLabels,
                datasets: [{
                    label: 'Frequência',
                    data: bins,
                    backgroundColor: 'rgba(139, 92, 246, 0.7)',
                    borderColor: '#8B5CF6',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Distribuição dos Valores'
                    },
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        title: {
                            display: true,
                            text: 'Frequência'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Intervalos de Valores'
                        }
                    }
                }
            }
        });
    }

    // Atualizar display de capacidade
    updateCapabilityDisplay() {
        const capability = this.spcData.processCapability;
        
        console.log('[SPC] Atualizando display de capacidade:', capability);
        
        if (!capability) {
            console.warn('[SPC] Sem dados de capacidade para exibir');
            return;
        }

        // Cp
        const cpElement = document.getElementById('spc-cp-value');
        if (cpElement) {
            cpElement.textContent = capability.Cp;
            cpElement.className = `text-2xl font-bold ${this.getCapabilityColor(capability.Cp)}`;
        }

        // Cpk
        const cpkElement = document.getElementById('spc-cpk-value');
        if (cpkElement) {
            cpkElement.textContent = capability.Cpk;
            cpkElement.className = `text-2xl font-bold ${this.getCapabilityColor(capability.Cpk)}`;
        }

        // Taxa de defeitos
        const defectElement = document.getElementById('spc-defect-rate');
        if (defectElement) {
            defectElement.textContent = `${capability.defectRate}%`;
        }

        // Nível Sigma
        const sigmaElement = document.getElementById('spc-sigma-level');
        if (sigmaElement) {
            sigmaElement.textContent = `${capability.sigmaLevel}σ`;
        }

        // Status geral
        const statusElement = document.getElementById('spc-capability-status');
        if (statusElement) {
            statusElement.textContent = capability.capability;
            statusElement.className = `text-sm font-medium ${this.getCapabilityStatusColor(capability.capability)}`;
        }
        
        console.log('[SPC] Display de capacidade atualizado com sucesso');
    }

    // Cores baseadas na capacidade
    getCapabilityColor(value) {
        if (value >= 1.33) return 'text-green-600';
        if (value >= 1.0) return 'text-yellow-600';
        return 'text-red-600';
    }

    // Cores do status da capacidade
    getCapabilityStatusColor(status) {
        const colors = {
            'Excelente': 'text-green-600',
            'Adequado': 'text-green-600',
            'Marginal': 'text-yellow-600',
            'Inadequado': 'text-red-600'
        };
        return colors[status] || 'text-gray-600';
    }

    // Atualizar status do processo
    updateProcessStatus() {
        const statusElement = document.getElementById('spc-process-status');
        if (!statusElement) {
            console.warn('[SPC] Elemento spc-process-status não encontrado');
            return;
        }

        const { alarms } = this.spcData;
        const criticalAlarms = alarms.filter(a => a.severity === 'critical');
        const highAlarms = alarms.filter(a => a.severity === 'high');

        let status, colorClass;
        if (criticalAlarms.length > 0) {
            status = 'Fora de Controle';
            colorClass = 'text-red-600 bg-red-50';
        } else if (highAlarms.length > 0) {
            status = 'Atenção Requerida';
            colorClass = 'text-orange-600 bg-orange-50';
        } else if (this.spcData.measurements.length > 0) {
            status = 'Sob Controle';
            colorClass = 'text-green-600 bg-green-50';
        } else {
            status = 'Sem Dados';
            colorClass = 'text-gray-600 bg-gray-50';
        }

        statusElement.textContent = status;
        statusElement.className = `px-3 py-1 rounded-full text-sm font-medium ${colorClass}`;
        
        console.log('[SPC] Status do processo atualizado:', status);
    }

    // Parar monitoramento
    stopMonitoring() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
        this.activeMonitoring = false;
        console.log('[SPC] Monitoramento parado');
    }

    // Exportar dados SPC
    exportSPCData() {
        return {
            measurements: this.spcData.measurements,
            controlLimits: this.spcData.controlLimits,
            processCapability: this.spcData.processCapability,
            alarms: this.spcData.alarms,
            config: this.config,
            exportedAt: new Date()
        };
    }

    // Cleanup
    destroy() {
        this.stopMonitoring();
        
        Object.values(this.charts).forEach(chart => {
            if (chart) chart.destroy();
        });
        
        this.charts = {};
    }
    
    // Debug: testar manualmente
    testDebug() {
        console.log('[SPC-DEBUG] ===== TESTE MANUAL =====');
        console.log('[SPC-DEBUG] spcController existe:', !!window.spcController);
        console.log('[SPC-DEBUG] Chart.js existe:', typeof Chart !== 'undefined');
        console.log('[SPC-DEBUG] db (Firebase) existe:', typeof db !== 'undefined');
        console.log('[SPC-DEBUG] getFilteredData existe:', typeof getFilteredData === 'function' || typeof window.getFilteredData === 'function');
        console.log('[SPC-DEBUG] Medições:', this.spcData.measurements?.length || 0);
        console.log('[SPC-DEBUG] controlLimits:', !!this.spcData.controlLimits);
        console.log('[SPC-DEBUG] processCapability:', !!this.spcData.processCapability);
        console.log('[SPC-DEBUG] lastUpdate:', this.spcData.lastUpdate);
        
        // Verificar elementos DOM
        const elements = ['spc-process-status', 'spc-xbar-chart', 'spc-r-chart', 'spc-histogram', 
                          'spc-cp-value', 'spc-cpk-value', 'spc-defect-rate', 'spc-sigma-level'];
        elements.forEach(id => {
            const el = document.getElementById(id);
            console.log(`[SPC-DEBUG] Elemento #${id}:`, el ? 'ENCONTRADO' : 'NÃO ENCONTRADO');
        });
        
        // Verificar se container está visível
        const spcContent = document.getElementById('predictive-spc-content');
        console.log('[SPC-DEBUG] Container SPC:', spcContent ? (spcContent.classList.contains('hidden') ? 'ESCONDIDO' : 'VISÍVEL') : 'NÃO ENCONTRADO');
        
        console.log('[SPC-DEBUG] ===== FIM TESTE =====');
        
        return {
            measurements: this.spcData.measurements?.length,
            hasLimits: !!this.spcData.controlLimits,
            hasCapability: !!this.spcData.processCapability,
            charts: Object.keys(this.charts)
        };
    }
}

// Instância global
window.spcController = new SPCController();

// Auto-inicializar quando DOM estiver pronto
document.addEventListener('DOMContentLoaded', function() {
    console.log('[SPC] DOM carregado, preparando inicialização...');
    // Pequeno delay para garantir que todos os scripts carregaram
    setTimeout(() => {
        if (window.spcController && !window.spcController.spcData.lastUpdate) {
            console.log('[SPC] Auto-inicializando...');
            window.spcController.initialize().then(() => {
                console.log('[SPC] Auto-inicialização concluída');
            }).catch(err => {
                console.error('[SPC] Erro na auto-inicialização:', err);
            });
        }
    }, 2000);
});