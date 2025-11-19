/**
 * Syncrho v8.0 - Sistema de Análise Pareto Automática
 * Identifica automaticamente as principais causas de problemas
 */

class AutoParetoAnalysis {
    constructor() {
        this.analytics = {
            downtime: null,
            quality: null,
            production: null,
            lastUpdate: null
        };
        this.charts = {};
        this.analysisRange = {
            startDate: null,
            endDate: null,
            label: 'Últimos 30 dias',
            presetDays: 30,
            isManual: false
        };
        this.rangeFeedbackTimeout = null;
    }

    // Inicializar sistema de Pareto automático
    async initialize() {
        console.log('[AUTO-PARETO] Inicializando análise Pareto automática');
        
        // Executar análise inicial
        await this.performCompleteAnalysis();
        this.highlightQuickRangeButton(this.analysisRange?.presetDays);
        this.syncDateInputsWithRange();
        this.updatePeriodLabel();
        
        console.log('[AUTO-PARETO] Sistema ativo');
    }

    // Executar análise completa
    async performCompleteAnalysis(customStartDate = null, customEndDate = null, options = {}) {
        try {
            const range = this.resolveDateRange(customStartDate, customEndDate, options);
            this.analysisRange = {
                startDate: new Date(range.startDate),
                endDate: new Date(range.endDate),
                label: range.label,
                presetDays: range.presetDays,
                isManual: range.isManual
            };

            // Carregar dados
            const [production, losses, downtime] = await Promise.all([
                getFilteredData('production', formatDate(range.startDate), formatDate(range.endDate)),
                getFilteredData('losses', formatDate(range.startDate), formatDate(range.endDate)),
                getFilteredData('downtime', formatDate(range.startDate), formatDate(range.endDate))
            ]);

            // Executar análises Pareto
            this.analytics = {
                downtime: this.analyzeDowntimePareto(downtime),
                quality: this.analyzeQualityPareto(losses, production),
                production: this.analyzeProductionPareto(production),
                machines: this.analyzeMachinePareto(production, losses, downtime),
                lastUpdate: new Date()
            };

            // Atualizar interface
            this.updateParetoInterface();
            this.syncDateInputsWithRange();
            this.highlightQuickRangeButton(this.analysisRange.presetDays);
            this.updatePeriodLabel();
            this.clearRangeFeedback();
            
            console.log('[AUTO-PARETO] Análise completa realizada:', this.analytics);

        } catch (error) {
            console.error('[AUTO-PARETO] Erro na análise:', error);
            this.setRangeFeedback('Erro ao gerar a análise para o período selecionado.', 'error');
        }
    }

    resolveDateRange(customStartDate, customEndDate, options = {}) {
        const DAY_MS = 24 * 60 * 60 * 1000;
        const manualSelection = options.isManual ?? Boolean(customStartDate || customEndDate);

        let endDate = this.normalizeDateInput(
            customEndDate || this.analysisRange?.endDate || new Date()
        );
        if (!endDate) {
            endDate = new Date();
        }

        let startDate = this.normalizeDateInput(
            customStartDate || this.analysisRange?.startDate
        );

        if (!startDate) {
            startDate = new Date(endDate);
            const defaultWindow = options.presetDays || this.analysisRange?.presetDays || 30;
            startDate.setDate(endDate.getDate() - (defaultWindow - 1));
        }

        if (startDate > endDate) {
            const temp = startDate;
            startDate = endDate;
            endDate = temp;
        }

        const diffDays = Math.max(1, Math.round((endDate - startDate) / DAY_MS) + 1);
        const presetDays = options.presetDays || (!manualSelection ? diffDays : null);

        const label = this.buildRangeLabel(startDate, endDate, {
            label: options.label,
            isManual: manualSelection,
            diffDays
        });

        return {
            startDate,
            endDate,
            label,
            presetDays,
            isManual: manualSelection
        };
    }

    normalizeDateInput(value) {
        if (!value) return null;
        if (value instanceof Date) {
            const normalized = new Date(value);
            normalized.setHours(0, 0, 0, 0);
            return normalized;
        }

        if (typeof value === 'string') {
            return this.parseInputDateString(value);
        }

        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) {
            return null;
        }
        parsed.setHours(0, 0, 0, 0);
        return parsed;
    }

    parseInputDateString(value) {
        if (!value) return null;
        const parts = value.split('-');
        if (parts.length === 3) {
            const [year, month, day] = parts.map(Number);
            if (
                Number.isInteger(year) &&
                Number.isInteger(month) &&
                Number.isInteger(day)
            ) {
                const parsed = new Date(year, month - 1, day, 0, 0, 0, 0);
                if (!Number.isNaN(parsed.getTime())) {
                    return parsed;
                }
            }
        }

        const fallback = new Date(value);
        if (Number.isNaN(fallback.getTime())) {
            return null;
        }
        fallback.setHours(0, 0, 0, 0);
        return fallback;
    }

    buildRangeLabel(startDate, endDate, meta = {}) {
        if (meta.label) {
            return meta.label;
        }

        if (meta.isManual) {
            return `${this.formatDisplayDate(startDate)} - ${this.formatDisplayDate(endDate)}`;
        }

        const diffDays = meta.diffDays || Math.max(1, Math.round((endDate - startDate) / (24 * 60 * 60 * 1000)) + 1);
        if (diffDays === 1) {
            return `Dia ${this.formatDisplayDate(endDate)}`;
        }
        return `Últimos ${diffDays} dias`;
    }

    formatDisplayDate(date) {
        if (!(date instanceof Date)) return '';
        return date.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    }

    formatInputDate(date) {
        if (!(date instanceof Date)) return '';
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    syncDateInputsWithRange() {
        const startInput = document.getElementById('pareto-start-date');
        const endInput = document.getElementById('pareto-end-date');

        if (!startInput || !endInput || !this.analysisRange?.startDate || !this.analysisRange?.endDate) {
            return;
        }

        startInput.value = this.formatInputDate(this.analysisRange.startDate);
        endInput.value = this.formatInputDate(this.analysisRange.endDate);
    }

    highlightQuickRangeButton(activeDays) {
        const buttons = document.querySelectorAll('[data-pareto-range]');
        if (!buttons || buttons.length === 0) return;

        buttons.forEach(button => {
            if (!button) return;
            const rangeValue = Number(button.dataset.paretoRange);
            const isActive = !this.analysisRange?.isManual && activeDays && rangeValue === Number(activeDays);
            button.classList.toggle('bg-orange-600', isActive);
            button.classList.toggle('text-white', isActive);
            button.classList.toggle('border-orange-600', isActive);
            button.classList.toggle('bg-white', !isActive);
            button.classList.toggle('text-gray-600', !isActive);
            button.classList.toggle('border-gray-300', !isActive);
        });
    }

    updatePeriodLabel() {
        const labelEl = document.getElementById('pareto-period-label');
        if (!labelEl) return;

        if (!this.analysisRange?.startDate || !this.analysisRange?.endDate) {
            labelEl.textContent = 'Últimos 30 dias';
            labelEl.title = '';
            return;
        }

        labelEl.textContent = this.analysisRange.label;
        labelEl.title = `${this.formatDisplayDate(this.analysisRange.startDate)} - ${this.formatDisplayDate(this.analysisRange.endDate)}`;
    }

    setRangeFeedback(message, type = 'error') {
        const feedbackEl = document.getElementById('pareto-range-feedback');
        if (!feedbackEl) return;

        if (!message) {
            feedbackEl.textContent = '';
            feedbackEl.classList.add('hidden');
            return;
        }

        feedbackEl.textContent = message;
        feedbackEl.classList.remove('hidden');
        feedbackEl.classList.toggle('text-red-600', type === 'error');
        feedbackEl.classList.toggle('text-green-600', type === 'success');
    }

    clearRangeFeedback() {
        this.setRangeFeedback('', 'success');
    }

    async applyCustomRangeFromInputs() {
        const startInput = document.getElementById('pareto-start-date');
        const endInput = document.getElementById('pareto-end-date');

        if (!startInput || !endInput) {
            alert('Campos de data não encontrados na interface.');
            return;
        }

        if (!startInput.value || !endInput.value) {
            this.setRangeFeedback('Selecione a data inicial e final antes de aplicar.', 'error');
            return;
        }

        const startDate = this.parseInputDateString(startInput.value);
        const endDate = this.parseInputDateString(endInput.value);

        if (!startDate || !endDate) {
            this.setRangeFeedback('Datas inválidas. Utilize o formato AAAA-MM-DD.', 'error');
            return;
        }

        if (startDate > endDate) {
            this.setRangeFeedback('A data inicial não pode ser maior que a final.', 'error');
            return;
        }

        this.setRangeFeedback('Aplicando período personalizado...', 'success');
        await this.performCompleteAnalysis(startDate, endDate, { isManual: true });
        this.setRangeFeedback('Período personalizado aplicado com sucesso.', 'success');
        clearTimeout(this.rangeFeedbackTimeout);
        this.rangeFeedbackTimeout = setTimeout(() => this.clearRangeFeedback(), 2500);
    }

    async applyQuickRange(days) {
        if (!Number.isFinite(days) || days <= 0) {
            this.setRangeFeedback('Período rápido inválido.', 'error');
            return;
        }

        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - (days - 1));

        await this.performCompleteAnalysis(startDate, endDate, {
            label: `Últimos ${days} dias`,
            presetDays: days,
            isManual: false
        });
    }

    async refreshCurrentRange() {
        if (this.analysisRange?.startDate && this.analysisRange?.endDate) {
            await this.performCompleteAnalysis(
                this.analysisRange.startDate,
                this.analysisRange.endDate,
                {
                    label: this.analysisRange.label,
                    presetDays: this.analysisRange.presetDays,
                    isManual: this.analysisRange.isManual
                }
            );
        } else {
            await this.performCompleteAnalysis();
        }
    }

    // Análise Pareto de Paradas
    analyzeDowntimePareto(downtimeData) {
        if (!downtimeData || downtimeData.length === 0) {
            return { categories: [], insights: [], totalImpact: 0 };
        }

        // Agrupar por motivo de parada
        const reasonGroups = {};
        let totalDuration = 0;

        downtimeData.forEach(item => {
            const { label: reasonLabel, family } = this.categorizeDowntimeReason(item.reason || 'NÃO ESPECIFICADO');
            const duration = Number(item.duration) || 0;
            const formattedRawReason = this.formatReasonLabel(item.reason || 'Não especificado');
            
            if (!reasonGroups[reasonLabel]) {
                reasonGroups[reasonLabel] = {
                    categoryLabel: reasonLabel,
                    family,
                    totalDuration: 0,
                    occurrences: 0,
                    avgDuration: 0,
                    machines: new Set(),
                    impact: 0,
                    rawReasons: {}
                };
            }
            
            reasonGroups[reasonLabel].totalDuration += duration;
            reasonGroups[reasonLabel].occurrences += 1;
            reasonGroups[reasonLabel].machines.add(item.machine);
            reasonGroups[reasonLabel].rawReasons[formattedRawReason] =
                (reasonGroups[reasonLabel].rawReasons[formattedRawReason] || 0) + duration;
            totalDuration += duration;
        });

        // Calcular percentuais e ordenar
        const categories = Object.values(reasonGroups)
            .map(group => {
                const subReasons = Object.entries(group.rawReasons || {})
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5)
                    .map(([reason, duration]) => ({
                        reason,
                        duration,
                        percentage: (duration / group.totalDuration) * 100
                    }));

                const primaryReason = subReasons[0]?.reason || group.categoryLabel;

                return {
                    ...group,
                    reason: primaryReason,
                    categoryLabel: group.categoryLabel,
                    percentage: (group.totalDuration / totalDuration) * 100,
                    avgDuration: group.totalDuration / group.occurrences,
                    machineCount: group.machines.size,
                    machines: Array.from(group.machines),
                    subReasons
                };
            })
            .sort((a, b) => b.totalDuration - a.totalDuration);

        // Calcular Pareto (80/20)
        let cumulativePercentage = 0;
        const paretoCategories = categories.map((cat, index) => {
            cumulativePercentage += cat.percentage;
            return {
                ...cat,
                cumulativePercentage,
                isParetoCore: cumulativePercentage <= 80,
                rank: index + 1
            };
        });

        // Gerar insights
        const insights = this.generateDowntimeInsights(paretoCategories, totalDuration);

        return {
            categories: paretoCategories,
            insights: insights,
            totalImpact: totalDuration,
            analysisType: 'downtime'
        };
    }

    // Análise Pareto de Qualidade/Perdas
    analyzeQualityPareto(lossesData, productionData) {
        if (!lossesData || lossesData.length === 0) {
            return { categories: [], insights: [], totalImpact: 0 };
        }

        // Agrupar perdas por produto
        const productGroups = {};
        let totalLosses = 0;

        lossesData.forEach(item => {
            const productName = this.normalizeProductName(item.product);
            const product = productName || 'PRODUTO NÃO ESPECIFICADO';
            const originalLabel = (item.product || '').toString().trim();
            const quantity = Number(item.quantity) || 0;
            const reason = item.reason || 'MOTIVO NÃO ESPECIFICADO';
            
            if (!productGroups[product]) {
                productGroups[product] = {
                    product: product,
                    totalLosses: 0,
                    occurrences: 0,
                    reasons: {},
                    machines: new Set(),
                    scrapRate: 0
                };
            }
            
            productGroups[product].totalLosses += quantity;
            productGroups[product].occurrences += 1;
            productGroups[product].machines.add(item.machine);
            productGroups[product].rawLabels = productGroups[product].rawLabels || {};
            if (productName) {
                productGroups[product].rawLabels[productName] =
                    (productGroups[product].rawLabels[productName] || 0) + quantity;
            }
            if (originalLabel) {
                productGroups[product].originalLabels = productGroups[product].originalLabels || {};
                productGroups[product].originalLabels[originalLabel] =
                    (productGroups[product].originalLabels[originalLabel] || 0) + quantity;
            }
            
            // Agrupar por motivos
            if (!productGroups[product].reasons[reason]) {
                productGroups[product].reasons[reason] = 0;
            }
            productGroups[product].reasons[reason] += quantity;
            
            totalLosses += quantity;
        });

        // Calcular taxa de refugo por produto
        Object.keys(productGroups).forEach(product => {
            const totalProduced = productionData
                .filter(p => p.product === product)
                .reduce((sum, p) => sum + (Number(p.quantity) || 0), 0);
            
            if (totalProduced > 0) {
                productGroups[product].scrapRate = 
                    (productGroups[product].totalLosses / totalProduced) * 100;
            }
            
            productGroups[product].totalProduced = totalProduced;
            const labels = this.resolveProductLabels(productGroups[product]);
            productGroups[product].displayLabel = labels.display;
            productGroups[product].recordedLabel = labels.recorded;
        });

        // Ordenar por impacto
        const categories = Object.values(productGroups)
            .map(group => ({
                ...group,
                product: group.displayLabel || this.formatProductDisplay(group.product) || group.product,
                rawProductName: group.recordedLabel || null,
                percentage: (group.totalLosses / totalLosses) * 100,
                avgLossPerOccurrence: group.totalLosses / group.occurrences,
                machineCount: group.machines.size,
                machines: Array.from(group.machines),
                topReasons: Object.entries(group.reasons)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 3)
                    .map(([reason, qty]) => ({ reason, quantity: qty }))
            }))
            .sort((a, b) => b.totalLosses - a.totalLosses);

        // Aplicar Pareto
        let cumulativePercentage = 0;
        const paretoCategories = categories.map((cat, index) => {
            cumulativePercentage += cat.percentage;
            return {
                ...cat,
                cumulativePercentage,
                isParetoCore: cumulativePercentage <= 80,
                rank: index + 1
            };
        });

        const insights = this.generateQualityInsights(paretoCategories, totalLosses);

        return {
            categories: paretoCategories,
            insights: insights,
            totalImpact: totalLosses,
            analysisType: 'quality'
        };
    }

    // Análise Pareto de Produção (Ineficiências)
    analyzeProductionPareto(productionData) {
        if (!productionData || productionData.length === 0) {
            return { categories: [], insights: [], totalImpact: 0 };
        }

        // Agrupar por máquina
        const machineGroups = {};
        let totalProduction = 0;

        productionData.forEach(item => {
            const machine = item.machine || 'MÁQUINA NÃO ESPECIFICADA';
            const quantity = Number(item.quantity) || 0;
            const duration = Number(item.durationMin) || 60; // Default 1h
            
            if (!machineGroups[machine]) {
                machineGroups[machine] = {
                    machine: machine,
                    totalProduction: 0,
                    totalTime: 0,
                    batches: 0,
                    efficiency: 0,
                    products: new Set()
                };
            }
            
            machineGroups[machine].totalProduction += quantity;
            machineGroups[machine].totalTime += duration;
            machineGroups[machine].batches += 1;
            machineGroups[machine].products.add(item.product);
            
            totalProduction += quantity;
        });

        // Calcular eficiências
        const categories = Object.values(machineGroups)
            .map(group => {
                const productivity = group.totalProduction / (group.totalTime / 60); // peças/hora
                const avgBatchSize = group.totalProduction / group.batches;
                
                return {
                    ...group,
                    productivity: productivity,
                    avgBatchSize: avgBatchSize,
                    productCount: group.products.size,
                    products: Array.from(group.products),
                    percentage: (group.totalProduction / totalProduction) * 100,
                    // Ineficiência = menor produtividade = maior problema
                    inefficiencyScore: 1 / Math.max(productivity, 0.1)
                };
            })
            .sort((a, b) => b.inefficiencyScore - a.inefficiencyScore);

        // Aplicar Pareto nas ineficiências
        let cumulativePercentage = 0;
        const totalInefficiency = categories.reduce((sum, cat) => sum + cat.inefficiencyScore, 0);
        
        const paretoCategories = categories.map((cat, index) => {
            const inefficiencyPercentage = (cat.inefficiencyScore / totalInefficiency) * 100;
            cumulativePercentage += inefficiencyPercentage;
            
            return {
                ...cat,
                inefficiencyPercentage,
                cumulativePercentage,
                isParetoCore: cumulativePercentage <= 80,
                rank: index + 1
            };
        });

        const insights = this.generateProductionInsights(paretoCategories, totalProduction);

        return {
            categories: paretoCategories,
            insights: insights,
            totalImpact: totalProduction,
            analysisType: 'production'
        };
    }

    // Análise Pareto por Máquina (Geral)
    analyzeMachinePareto(productionData, lossesData, downtimeData) {
        const machines = [...new Set([
            ...productionData.map(p => p.machine),
            ...lossesData.map(l => l.machine),
            ...downtimeData.map(d => d.machine)
        ])].filter(Boolean);

        const machineAnalysis = machines.map(machine => {
            const machineProduction = productionData.filter(p => p.machine === machine);
            const machineLosses = lossesData.filter(l => l.machine === machine);
            const machineDowntime = downtimeData.filter(d => d.machine === machine);

            const totalProduced = machineProduction.reduce((sum, p) => sum + (Number(p.quantity) || 0), 0);
            const totalLosses = machineLosses.reduce((sum, l) => sum + (Number(l.quantity) || 0), 0);
            const totalDowntime = machineDowntime.reduce((sum, d) => sum + (Number(d.duration) || 0), 0);

            const scrapRate = totalProduced > 0 ? (totalLosses / totalProduced) * 100 : 0;
            const availability = 1 - (totalDowntime / (24 * 60 * 30)); // Assumindo 30 dias
            
            // Score de problema (quanto maior, mais problemática a máquina)
            const problemScore = (scrapRate * 0.4) + ((1 - availability) * 60) + (totalDowntime * 0.01);

            return {
                machine,
                totalProduced,
                totalLosses,
                totalDowntime,
                scrapRate,
                availability: availability * 100,
                problemScore,
                downtimeHours: totalDowntime / 60,
                productionHours: machineProduction.reduce((sum, p) => sum + (Number(p.durationMin) || 60), 0) / 60
            };
        }).sort((a, b) => b.problemScore - a.problemScore);

        return {
            categories: machineAnalysis,
            analysisType: 'machines',
            totalMachines: machines.length
        };
    }

    normalizeProductName(product) {
        if (!product) return null;
        const clean = product.toString().trim();
        if (!clean) return null;

        return clean
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, ' ')
            .toUpperCase();
    }

    formatProductDisplay(raw) {
        if (!raw) return null;
        return raw
            .toLowerCase()
            .split(/\s+/)
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    resolveProductLabels(group) {
        const recorded = this.getTopLabel(group.originalLabels);
        const normalized = this.getTopLabel(group.rawLabels);

        const display = recorded
            || (normalized && this.formatProductDisplay(normalized))
            || this.formatProductDisplay(group.product)
            || group.product;

        return {
            display,
            recorded
        };
    }

    getTopLabel(labelMap) {
        if (!labelMap || Object.keys(labelMap).length === 0) {
            return null;
        }

        const [topEntry] = Object.entries(labelMap)
            .sort((a, b) => b[1] - a[1]);

        return topEntry ? topEntry[0] : null;
    }

    normalizeReasonText(text = '') {
        return text
            .toString()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toUpperCase()
            .trim();
    }

    formatReasonLabel(text = '') {
        const clean = text.toString().trim();
        if (!clean) return 'Não especificado';
        return clean
            .toLowerCase()
            .split(/\s+/)
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    // Categorizar motivos de parada
    categorizeDowntimeReason(reason) {
        const normalizedReason = this.normalizeReasonText(reason || 'Não especificado');
        const catalog = [
            { family: 'MANUTENÇÃO', label: 'Manutenção / Quebra', keywords: ['MANUTEN', 'QUEBRA', 'FALHA', 'REPARO', 'AJUSTE', 'PAN', 'LUBR', 'ROLAMENTO'] },
            { family: 'SETUP', label: 'Setup e Troca de Modelo', keywords: ['SETUP', 'PREPARA', 'TROCA', 'REGULAGEM', 'MOLDE', 'FERRAMENTA'] },
            { family: 'QUALIDADE', label: 'Ajustes por Qualidade', keywords: ['QUALID', 'REFUGO', 'RETRAB', 'DIMENSIONAL', 'ESPECIF'] },
            { family: 'MATERIAL', label: 'Falta / Problema de Material', keywords: ['MATERIAL', 'MATERIA', 'FALTA', 'ESTOQUE', 'COMPRA', 'FORNECEDOR'] },
            { family: 'OPERAÇÃO', label: 'Operação / Mão de Obra', keywords: ['OPERAC', 'OPERADOR', 'PESSOAL', 'TREIN', 'ABSENTE', 'EQUIPE'] },
            { family: 'ENERGIA', label: 'Energia / Utilidades', keywords: ['ENERG', 'ELETR', 'PNEUM', 'AR COMPR', 'HIDRAUL', 'VACUO'] },
            { family: 'PLANEJAMENTO', label: 'Planejamento / PCP', keywords: ['PROGR', 'PEDIDO', 'PCP', 'PLANEJ', 'SEQUENC', 'APROVAC'] },
            { family: 'LOGÍSTICA', label: 'Logística / Abastecimento', keywords: ['LOGIST', 'ABAST', 'SUPRIM', 'MOVIMENT', 'KANBAN'] },
            { family: 'SEGURANÇA', label: 'Segurança / EHS', keywords: ['SEGUR', 'EPI', 'ACIDENT', 'RISCO', 'NR'] }
        ];

        const matched = catalog.find(entry => 
            entry.keywords.some(keyword => normalizedReason.includes(keyword))
        );

        if (matched) {
            return {
                label: matched.label,
                family: matched.family
            };
        }

        return {
            label: this.formatReasonLabel(reason || 'Não especificado'),
            family: 'ESPECÍFICO'
        };
    }

    // Gerar insights de paradas
    generateDowntimeInsights(categories, totalDuration) {
        const insights = [];
        const topIssues = categories.slice(0, 3);

        // Top 3 causas de parada
        if (topIssues.length > 0) {
            const top = topIssues[0];
            const driverList = (top.subReasons || [])
                .slice(0, 3)
                .map(driver => `${driver.reason} (${driver.percentage.toFixed(1)}%)`)
                .join(', ');
            insights.push({
                type: 'critical',
                title: `Principal causa: ${top.reason}`,
                description: `Representa ${top.percentage.toFixed(1)}% do tempo total de parada (${(top.totalDuration/60).toFixed(1)}h)` +
                    (driverList ? `. Principais motivos: ${driverList}` : ''),
                recommendation: this.getDowntimeRecommendation(top.family || top.reason),
                priority: 'alta',
                machines: top.machines.slice(0, 3)
            });
        }

        // Análise 80/20
        const paretoCore = categories.filter(cat => cat.isParetoCore);
        if (paretoCore.length > 0) {
            const corePercentage = paretoCore.reduce((sum, cat) => sum + cat.percentage, 0);
            insights.push({
                type: 'analysis',
                title: `Regra 80/20 identificada`,
                description: `${paretoCore.length} causas representam ${corePercentage.toFixed(1)}% das paradas`,
                recommendation: 'Focar esforços nessas causas principais para máximo impacto',
                priority: 'média',
                categories: paretoCore.map(cat => cat.reason)
            });
        }

        // Frequência vs Duração
        const highFrequency = categories.filter(cat => cat.occurrences >= 10);
        const longDuration = categories.filter(cat => cat.avgDuration >= 120); // > 2h

        if (highFrequency.length > 0) {
            insights.push({
                type: 'pattern',
                title: 'Problemas recorrentes',
                description: `${highFrequency.length} tipos de parada ocorrem frequentemente (≥10x)`,
                recommendation: 'Implementar soluções preventivas para problemas recorrentes',
                priority: 'média'
            });
        }

        return insights;
    }

    // Gerar insights de qualidade
    generateQualityInsights(categories, totalLosses) {
        const insights = [];

        if (categories.length > 0) {
            const worst = categories[0];
            insights.push({
                type: 'critical',
                title: `Produto mais problemático: ${worst.product}`,
                description: `${worst.percentage.toFixed(1)}% das perdas (${worst.totalLosses} pcs, taxa: ${worst.scrapRate.toFixed(2)}%)`,
                recommendation: 'Revisar processo e controles de qualidade deste produto',
                priority: 'alta',
                topReasons: worst.topReasons
            });
        }

        const highScrapRate = categories.filter(cat => cat.scrapRate > 5); // >5%
        if (highScrapRate.length > 0) {
            insights.push({
                type: 'warning',
                title: `${highScrapRate.length} produtos com alta taxa de refugo`,
                description: 'Produtos com taxa de refugo superior a 5%',
                recommendation: 'Implementar controle estatístico de processo (CEP)',
                priority: 'alta',
                products: highScrapRate.map(cat => ({ 
                    product: cat.product, 
                    rate: cat.scrapRate 
                }))
            });
        }

        return insights;
    }

    // Gerar insights de produção
    generateProductionInsights(categories, totalProduction) {
        const insights = [];

        if (categories.length > 0) {
            const leastEfficient = categories[0];
            insights.push({
                type: 'opportunity',
                title: `Menor produtividade: ${leastEfficient.machine}`,
                description: `${leastEfficient.productivity.toFixed(0)} pcs/h (${leastEfficient.percentage.toFixed(1)}% da produção)`,
                recommendation: 'Analisar gargalos e otimizar ciclos de produção',
                priority: 'média'
            });
        }

        const lowProductivity = categories.filter(cat => cat.productivity < 300); // <300 pcs/h
        if (lowProductivity.length > 0) {
            insights.push({
                type: 'analysis',
                title: `${lowProductivity.length} máquinas com baixa produtividade`,
                description: 'Produtividade inferior a 300 peças/hora',
                recommendation: 'Revisar velocidades, ciclos e eficiência operacional',
                priority: 'média'
            });
        }

        return insights;
    }

    // Recomendações por tipo de parada
    getDowntimeRecommendation(reason) {
        const key = (reason || '').toUpperCase();
        const recommendations = {
            'MANUTENÇÃO': 'Implementar manutenção preditiva e preventiva',
            'SETUP': 'Aplicar técnicas SMED para redução de tempo de setup',
            'QUALIDADE': 'Revisar controles e especificações de qualidade',
            'MATERIAL': 'Otimizar gestão de estoque e suprimentos',
            'OPERAÇÃO': 'Treinamento e padronização de procedimentos',
            'ENERGIA': 'Revisar infraestrutura elétrica e pneumática',
            'PLANEJAMENTO': 'Melhorar comunicação entre PCP e produção',
            'LOGÍSTICA': 'Garantir abastecimento contínuo e rotas de entrega padronizadas',
            'SEGURANÇA': 'Reforçar protocolos de segurança e liberar área somente após inspeção',
            'ESPECÍFICO': 'Investigar causa raiz e implementar ações corretivas'
        };
        
        return recommendations[key] || 'Investigar causa raiz e implementar ações corretivas';
    }

    // Atualizar interface
    updateParetoInterface() {
        this.updateSummaryCards();
        this.updateInsightsList();
        this.generateParetoCharts();
        this.updateDowntimeDetailsPanel();
        this.updatePeriodLabel();
        this.syncDateInputsWithRange();
        this.highlightQuickRangeButton(this.analysisRange?.presetDays);
    }

    // Atualizar cards de resumo
    updateSummaryCards() {
        const { downtime, quality, production, machines } = this.analytics;

        // Card de paradas
        const downtimeCard = document.getElementById('pareto-downtime-summary');
        if (downtimeCard && downtime) {
            const topCause = downtime.categories[0];
            const detailedReasons = topCause?.subReasons?.slice(0, 3)
                .map(sub => `${sub.reason} (${sub.percentage.toFixed(1)}%)`)
                .join(', ');
            const familyLabel = topCause?.family && topCause.family !== 'ESPECÍFICO'
                ? topCause.family
                : 'Motivo específico';
            downtimeCard.innerHTML = topCause ? `
                <h4 class="font-semibold text-red-600">Principal Causa de Parada</h4>
                <p class="text-2xl font-bold">${topCause.reason}</p>
                <p class="text-xs text-gray-500">Categoria: ${topCause.categoryLabel}</p>
                <p class="text-xs text-gray-500 mb-1">${familyLabel}</p>
                <p class="text-sm text-gray-600">${topCause.percentage.toFixed(1)}% das paradas</p>
                <p class="text-xs text-gray-500">${(topCause.totalDuration/60).toFixed(1)}h em ${topCause.occurrences} ocorrências</p>
                ${detailedReasons ? `<p class="text-xs text-gray-500 mt-1">Motivos detalhados: ${detailedReasons}</p>` : ''}
            ` : '<p class="text-gray-500">Dados insuficientes</p>';
        }

        // Card de qualidade
        const qualityCard = document.getElementById('pareto-quality-summary');
        if (qualityCard && quality) {
            const topProduct = quality.categories[0];
            qualityCard.innerHTML = topProduct ? `
                <h4 class="font-semibold text-orange-600">Produto Mais Problemático</h4>
                <p class="text-2xl font-bold">${topProduct.product}</p>
                ${topProduct.rawProductName && topProduct.product !== topProduct.rawProductName ? `<p class="text-xs text-gray-500">Registrado como: ${topProduct.rawProductName}</p>` : ''}
                <p class="text-sm text-gray-600">${topProduct.percentage.toFixed(1)}% das perdas</p>
                <p class="text-xs text-gray-500">Taxa: ${topProduct.scrapRate.toFixed(2)}%</p>
            ` : '<p class="text-gray-500">Dados insuficientes</p>';
        }

        // Card de produção
        const productionCard = document.getElementById('pareto-production-summary');
        if (productionCard && production) {
            const inefficientMachine = production.categories[0];
            productionCard.innerHTML = inefficientMachine ? `
                <h4 class="font-semibold text-blue-600">Menor Produtividade</h4>
                <p class="text-2xl font-bold">${inefficientMachine.machine}</p>
                <p class="text-sm text-gray-600">${inefficientMachine.productivity.toFixed(0)} pcs/h</p>
                <p class="text-xs text-gray-500">${inefficientMachine.productCount} produtos</p>
            ` : '<p class="text-gray-500">Dados insuficientes</p>';
        }
    }

    updateDowntimeDetailsPanel() {
        const container = document.getElementById('downtime-reason-details');
        if (!container) return;

        const downtimeCategories = this.analytics.downtime?.categories || [];
        if (downtimeCategories.length === 0) {
            container.innerHTML = '<p class="text-xs text-gray-500">Dados insuficientes para detalhar motivos.</p>';
            return;
        }

        const items = downtimeCategories.slice(0, 5).map(cat => {
            const drivers = (cat.subReasons || [])
                .slice(0, 3)
                .map(driver => `${driver.reason} (${driver.percentage.toFixed(1)}%)`)
                .join(', ');
            return `
                <li class="border-l-2 border-red-200 pl-3">
                    <div class="flex justify-between text-sm font-semibold text-gray-800">
                        <span>${cat.reason}</span>
                        <span>${cat.percentage.toFixed(1)}%</span>
                    </div>
                    <p class="text-xs text-gray-500">${cat.categoryLabel} • ${(cat.totalDuration/60).toFixed(1)}h • ${cat.occurrences} ocorrências</p>
                    ${drivers ? `<p class="text-xs text-gray-600 mt-1">Motivos reais: ${drivers}</p>` : ''}
                </li>
            `;
        }).join('');

        container.innerHTML = `
            <p class="text-xs text-gray-500 uppercase tracking-wide">Top motivos reais</p>
            <ul class="space-y-2">${items}</ul>
        `;
    }

    // Atualizar lista de insights
    updateInsightsList() {
        const container = document.getElementById('pareto-insights-list');
        if (!container) return;

        const allInsights = [
            ...(this.analytics.downtime?.insights || []),
            ...(this.analytics.quality?.insights || []),
            ...(this.analytics.production?.insights || [])
        ].sort((a, b) => {
            const priorities = { 'alta': 3, 'média': 2, 'baixa': 1 };
            return priorities[b.priority] - priorities[a.priority];
        });

        container.innerHTML = allInsights.length > 0 ? 
            allInsights.map(insight => this.renderInsight(insight)).join('') :
            '<p class="text-gray-500 text-center py-4">Executando análise...</p>';
    }

    // Renderizar insight individual
    renderInsight(insight) {
        const iconMap = {
            critical: 'alert-triangle',
            warning: 'alert-circle',
            analysis: 'bar-chart',
            pattern: 'repeat',
            opportunity: 'trending-up'
        };

        const colorMap = {
            alta: 'border-red-500 bg-red-50',
            média: 'border-yellow-500 bg-yellow-50',
            baixa: 'border-blue-500 bg-blue-50'
        };

        return `
            <div class="p-4 rounded-lg border-l-4 ${colorMap[insight.priority] || colorMap.baixa}">
                <div class="flex items-start gap-3">
                    <i data-lucide="${iconMap[insight.type]}" class="w-5 h-5 mt-0.5 flex-shrink-0"></i>
                    <div class="flex-1">
                        <h5 class="font-semibold text-sm">${insight.title}</h5>
                        <p class="text-sm text-gray-700 mt-1">${insight.description}</p>
                        <p class="text-xs text-blue-600 mt-2 font-medium">${insight.recommendation}</p>
                        <div class="flex items-center gap-2 mt-2">
                            <span class="text-xs px-2 py-1 rounded-full ${
                                insight.priority === 'alta' ? 'bg-red-100 text-red-800' :
                                insight.priority === 'média' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-blue-100 text-blue-800'
                            }">${insight.priority.toUpperCase()}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // Gerar gráficos Pareto
    generateParetoCharts() {
        if (this.analytics.downtime?.categories.length > 0) {
            this.createParetoChart('downtime-pareto-chart', this.analytics.downtime.categories, 'Tempo (min)');
        }

        if (this.analytics.quality?.categories.length > 0) {
            this.createParetoChart('quality-pareto-chart', this.analytics.quality.categories, 'Quantidade (pcs)');
        }
    }

    // Criar gráfico Pareto específico
    createParetoChart(canvasId, data, yAxisLabel) {
        const ctx = document.getElementById(canvasId);
        if (!ctx || !data || data.length === 0) return;

        // Destruir gráfico anterior
        if (this.charts[canvasId]) {
            this.charts[canvasId].destroy();
        }

        const labels = data.slice(0, 10).map(item => 
            item.reason || item.product || item.machine || item.category
        );
        const values = data.slice(0, 10).map(item => 
            item.totalDuration || item.totalLosses || item.totalProduction || item.value
        );
        const percentages = data.slice(0, 10).map(item => item.cumulativePercentage);

        this.charts[canvasId] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: yAxisLabel,
                        data: values,
                        backgroundColor: 'rgba(59, 130, 246, 0.8)',
                        borderColor: 'rgba(59, 130, 246, 1)',
                        borderWidth: 1,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Acumulado (%)',
                        data: percentages,
                        type: 'line',
                        borderColor: 'rgba(239, 68, 68, 1)',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        borderWidth: 2,
                        fill: false,
                        yAxisID: 'y1'
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
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: yAxisLabel
                        }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Porcentagem Acumulada (%)'
                        },
                        max: 100,
                        grid: {
                            drawOnChartArea: false
                        }
                    }
                }
            }
        });
    }

    // Obter dados para exportação
    getAnalysisData() {
        return {
            ...this.analytics,
            exportedAt: new Date()
        };
    }

    // Cleanup
    destroy() {
        Object.values(this.charts).forEach(chart => {
            if (chart) chart.destroy();
        });
        this.charts = {};
    }
}

// Instância global
window.autoParetoAnalysis = new AutoParetoAnalysis();