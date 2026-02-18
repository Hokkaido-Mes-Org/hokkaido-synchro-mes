/**
 * Syncrho v8.0 - Sistema de Rastreabilidade Total
 * Genealogia completa: Lote > Ordem > Máquina > Operador > Parâmetros
 */

// Funções auxiliares de suporte
if (typeof formatDate === 'undefined') {
    window.formatDate = function(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };
}

if (typeof getFilteredData === 'undefined') {
    window.getFilteredData = async function(collection, startDate, endDate) {
        // Carrega dados reais do Firestore
        try {
            if (typeof db === 'undefined') {
                console.warn('[TRACEABILITY] Firestore não inicializado, retornando array vazio');
                return [];
            }

            let query = db.collection(collection);
            
            // Aplicar filtros de data se fornecidos
            if (startDate && endDate) {
                query = query.where('timestamp', '>=', new Date(startDate))
                            .where('timestamp', '<=', new Date(endDate));
            }
            
            const snapshot = await query.limit(500).get();
            const data = [];
            
            snapshot.forEach(doc => {
                data.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            console.log(`[TRACEABILITY] Carregados ${data.length} registros de ${collection}`);
            return data;
            
        } catch (error) {
            console.error(`[TRACEABILITY] Erro ao carregar dados de ${collection}:`, error);
            return [];
        }
    };
}

class TraceabilitySystem {
    constructor() {
        this.traceabilityData = {
            batches: new Map(),
            genealogy: new Map(),
            parameters: new Map(),
            materials: new Map(),
            lastUpdate: null
        };
        this.searchCache = new Map();
        this.config = {
            retentionDays: 2555, // 7 anos de retenção
            maxSearchResults: 100,
            enableRealTimeTracking: true
        };
    }

    normalizeBatchData(batch) {
        if (!batch) return batch;

        const safeArray = (value) => Array.isArray(value) ? value : [];
        const safeNumber = (value, fallback = 0) => {
            const num = Number(value);
            return Number.isFinite(num) ? num : fallback;
        };

        batch.id = batch.id || `BATCH-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        batch.materials = safeArray(batch.materials);
        batch.parentBatches = safeArray(batch.parentBatches);
        batch.processEvents = safeArray(batch.processEvents);
        batch.qualityTests = safeArray(batch.qualityTests);

        batch.product = batch.product || batch.productName || batch.product_description || 'Produto não informado';
        batch.productCode = batch.productCode || batch.product_cod || batch.productCodeRef || 'SEM-COD';
        batch.machine = batch.machine || batch.machineId || batch.machine_id || 'Máquina não informada';
        batch.operator = batch.operator || batch.operatorName || 'Operador não informado';
        batch.shift = batch.shift || batch.turno || 'T1';
        batch.workOrder = batch.workOrder || batch.orderNumber || batch.planId || batch.id;
        batch.qualityStatus = batch.qualityStatus || 'APROVADO';

        batch.quantity = safeNumber(
            batch.quantity ?? batch.totalQuantity ?? batch.total_produzido ?? batch.totalProduced ?? batch.produzido,
            0
        );

        if (!batch.duration || !Number.isFinite(Number(batch.duration))) {
            const start = batch.startTime instanceof Date ? batch.startTime : new Date(batch.startTime);
            const end = batch.endTime instanceof Date ? batch.endTime : new Date(batch.endTime);
            const diffMinutes = start && end && !isNaN(start) && !isNaN(end)
                ? Math.max(0, Math.round((end - start) / 60000))
                : 0;
            batch.duration = diffMinutes;
        } else {
            batch.duration = safeNumber(batch.duration, 0);
        }

        return batch;
    }

    // Inicializar sistema de rastreabilidade
    async initialize() {
        console.log('[TRACEABILITY] Inicializando Sistema de Rastreabilidade Total');
        
        try {
            // Carregar dados históricos
            await this.loadTraceabilityData();
            
            // Construir árvore de genealogia
            this.buildGenealogyTree();
            
            // Inicializar interface
            this.updateTraceabilityInterface();
            
            console.log('[TRACEABILITY] Sistema de rastreabilidade ativo');
            
        } catch (error) {
            console.error('[TRACEABILITY] Erro ao inicializar:', error);
        }
    }

    // Carregar dados de rastreabilidade
    async loadTraceabilityData() {
        try {
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(endDate.getDate() - 90); // 3 meses de dados

            this.traceabilityData.batches.clear();
            this.traceabilityData.genealogy.clear();

            // Carregar dados de rastreabilidade diretamente do Firestore
            await this.loadBatchesData(startDate, endDate);
            
            // Adicionar informações de qualidade
            await this.addQualityData(formatDate(startDate), formatDate(endDate));
            
            // Adicionar dados de processo
            await this.addProcessData(formatDate(startDate), formatDate(endDate));
            
            // Construir árvore de genealogia
            this.buildGenealogyTree();
            
            this.traceabilityData.lastUpdate = new Date();
            
            console.log('[TRACEABILITY] Dados carregados:', {
                batches: this.traceabilityData.batches.size,
                genealogies: this.traceabilityData.genealogy.size
            });

        } catch (error) {
            console.error('[TRACEABILITY] Erro ao carregar dados:', error);
        }
    }

    // Carregar batches real do Firestore
    async loadBatchesData(startDate, endDate) {
        try {
            if (typeof db === 'undefined') {
                console.warn('[TRACEABILITY] Firestore não inicializado, usando dados mock');
                this.loadMockBatches();
                return;
            }

            // Buscar todos os batches registrados no Firestore
            const snapshot = await db.collection('batch_traceability')
                .orderBy('startTime', 'desc')
                .limit(1000)
                .get();

            if (snapshot.empty) {
                console.warn('[TRACEABILITY] Coleção batch_traceability vazia. Aplicando fallback baseado em production_entries');
                await this.loadBatchesFromProductionEntries(startDate, endDate);
                
                // Se ainda estiver vazio, usar dados mock
                if (this.traceabilityData.batches.size === 0) {
                    console.warn('[TRACEABILITY] Production entries também vazia. Usando dados mock para demonstração');
                    this.loadMockBatches();
                }
                return;
            }

            snapshot.forEach(doc => {
                const batch = { id: doc.id, ...doc.data() };
                batch.startTime = batch.startTime?.toDate ? batch.startTime.toDate() : new Date(batch.startTime);
                batch.endTime = batch.endTime?.toDate ? batch.endTime.toDate() : new Date(batch.endTime);
                batch.createdAt = batch.createdAt?.toDate ? batch.createdAt.toDate() : new Date(batch.createdAt);
                batch.updatedAt = batch.updatedAt?.toDate ? batch.updatedAt.toDate() : new Date(batch.updatedAt);

                this.normalizeBatchData(batch);
                this.traceabilityData.batches.set(batch.id, batch);
            });

        } catch (error) {
            console.error('[TRACEABILITY] Erro ao carregar batches:', error);
            if (!this.traceabilityData.batches.size) {
                await this.loadBatchesFromProductionEntries(startDate, endDate);
                
                // Se ainda estiver vazio, usar dados mock
                if (this.traceabilityData.batches.size === 0) {
                    console.warn('[TRACEABILITY] Usando dados mock após erro');
                    this.loadMockBatches();
                }
            }
        }
    }

    // Carregar dados mock para demonstração
    loadMockBatches() {
        const today = new Date();
        const mockBatches = [];
        
        // Criar 20 batches mock dos últimos 30 dias
        for (let i = 0; i < 20; i++) {
            const daysAgo = Math.floor(Math.random() * 30);
            const startTime = new Date(today);
            startTime.setDate(startTime.getDate() - daysAgo);
            startTime.setHours(7 + Math.floor(Math.random() * 16), Math.floor(Math.random() * 60));
            
            const endTime = new Date(startTime);
            endTime.setHours(endTime.getHours() + 4 + Math.floor(Math.random() * 4));
            
            const machines = ['M001', 'M002', 'M003', 'M005', 'M007', 'M010', 'M012'];
            const operators = ['João Silva', 'Maria Santos', 'Pedro Costa', 'Ana Lima', 'Carlos Souza'];
            const shifts = ['T1', 'T2', 'T3'];
            const products = [
                { name: 'ROSCA BAIXA P2000 28 400 ESTRIADA BRANCO 767', code: '3' },
                { name: 'ATUADOR P2000 SATIN AZUL CB150 PP', code: '69' },
                { name: 'ANEL TRAVA P2000 STD NATURAL PP BRILHANTE', code: '24' },
                { name: 'ROSCA ALTA P2000 28 410 FOSCA BRANCA 767 PP', code: '7' },
                { name: 'ATUADOR MKIV STD BRANCO 767 PP', code: '103' }
            ];
            
            const machine = machines[Math.floor(Math.random() * machines.length)];
            const operator = operators[Math.floor(Math.random() * operators.length)];
            const shift = shifts[Math.floor(Math.random() * shifts.length)];
            const product = products[Math.floor(Math.random() * products.length)];
            const quantity = 5000 + Math.floor(Math.random() * 15000);
            
            const batchId = `LOTE-${startTime.getFullYear()}${String(startTime.getMonth() + 1).padStart(2, '0')}${String(startTime.getDate()).padStart(2, '0')}-${machine}-${String(i).padStart(3, '0')}`;
            const workOrder = `OP-${startTime.getFullYear()}-${String(1000 + i).slice(-4)}`;
            
            const batch = {
                id: batchId,
                product: product.name,
                productCode: product.code,
                machine,
                operator,
                shift,
                workOrder,
                startTime,
                endTime,
                createdAt: startTime,
                quantity,
                duration: Math.floor((endTime - startTime) / 60000),
                qualityStatus: Math.random() > 0.9 ? 'CONDICIONAL' : 'APROVADO',
                materials: [
                    {
                        type: 'Resina PP',
                        code: 'PP-NAT-001',
                        batchNumber: `MP-${startTime.getFullYear()}-${String(Math.floor(Math.random() * 100)).padStart(3, '0')}`,
                        quantityUsed: Math.floor(quantity * 0.002),
                        supplier: 'Braskem'
                    }
                ],
                parentBatches: [],
                processEvents: [],
                qualityTests: [],
                parameters: {
                    temperature: 180 + Math.floor(Math.random() * 40),
                    pressure: 80 + Math.floor(Math.random() * 30),
                    cycleTime: 20 + Math.floor(Math.random() * 15)
                }
            };
            
            this.normalizeBatchData(batch);
            this.traceabilityData.batches.set(batch.id, batch);
        }
        
        console.log('[TRACEABILITY] Carregados dados mock:', this.traceabilityData.batches.size, 'batches');
    }

    async loadBatchesFromProductionEntries(startDate, endDate) {
        try {
            if (typeof db === 'undefined') {
                console.warn('[TRACEABILITY] Firestore não disponível para fallback de produção');
                return;
            }

            let query = db.collection('production_entries').orderBy('timestamp', 'desc').limit(500);
            const snapshot = await query.get();
            const planCache = new Map();
            const candidateEntries = [];

            snapshot.forEach(doc => {
                const entry = { id: doc.id, ...doc.data() };
                const entryDate = entry.timestamp?.toDate ? entry.timestamp.toDate() : (entry.createdAt?.toDate ? entry.createdAt.toDate() : null);

                if (startDate && entryDate && entryDate < startDate) return;
                if (endDate && entryDate && entryDate > endDate) return;

                candidateEntries.push({ entry, entryDate });
            });

            for (const { entry, entryDate } of candidateEntries) {
                const planData = await this.fetchPlanData(planCache, entry.planId);
                const batch = this.createBatchFromProductionEntry(entry, planData, entryDate);
                this.normalizeBatchData(batch);
                this.traceabilityData.batches.set(batch.id, batch);
            }

            console.log('[TRACEABILITY] Fallback gerou lotes a partir de production_entries:', this.traceabilityData.batches.size);

        } catch (error) {
            console.error('[TRACEABILITY] Erro no fallback de produção:', error);
        }
    }

    async fetchPlanData(cache, planId) {
        if (!planId) return null;
        if (cache.has(planId)) return cache.get(planId);

        try {
            const doc = await db.collection('planning').doc(planId).get();
            const data = doc.exists ? { id: doc.id, ...doc.data() } : null;
            cache.set(planId, data);
            return data;
        } catch (error) {
            console.error(`[TRACEABILITY] Erro ao buscar plano ${planId}:`, error);
            cache.set(planId, null);
            return null;
        }
    }

    createBatchFromProductionEntry(entry, planData, entryDate) {
        const timestamp = entryDate || new Date();
        const startTime = entry.startTime?.toDate ? entry.startTime.toDate() : timestamp;
        const endTime = entry.endTime?.toDate ? entry.endTime.toDate() : new Date(startTime.getTime() + 60 * 60 * 1000);

        const productName = entry.product || planData?.product || planData?.product_name || planData?.product_description || 'Produto não informado';
        const productCode = entry.productCode || entry.product_cod || planData?.product_cod || planData?.productCode || 'SEM-COD';
        const machine = entry.machine || planData?.machine || 'Máquina não informada';
        const operator = entry.registradoPorNome || entry.registradoPor || entry.createdByName || entry.operator || 'Operador não informado';
        const workOrder = entry.order_number || planData?.order_number || planData?.orderNumber || planData?.order_id || entry.planId || entry.id;
        const shift = entry.turno || planData?.shift || 'T1';
        const quantity = Number(entry.produzido || entry.quantity || 0);

        const mpCode = planData?.mp || entry.mp || 'MP-NA';
        const mpType = planData?.mp_type || entry.mp_type || 'Matéria-prima';
        const materials = Array.isArray(entry.materials) && entry.materials.length > 0 ? entry.materials : [{
            type: mpType,
            code: mpCode,
            batchNumber: entry.materialBatch || `${mpCode}-${formatDate(startTime)}`,
            quantityUsed: Number(entry.materialQuantity || entry.refugo_kg || 0),
            supplier: planData?.client || 'Fornecedor não informado'
        }];

        let duration = Number(entry.duracao_min || entry.duration || 0);
        if (!duration && planData?.budgeted_cycle) {
            const cycle = Number(planData.budgeted_cycle);
            const cavities = Number(planData.mold_cavities || 1) || 1;
            if (cycle > 0 && quantity > 0) {
                duration = Math.round(((quantity / cavities) * cycle) / 60);
            }
        }

        return {
            id: entry.batchId || `${workOrder || 'BATCH'}-${shift}-${formatDate(startTime).replace(/-/g, '')}`,
            product: productName,
            productCode,
            machine,
            operator,
            shift,
            workOrder,
            startTime,
            endTime,
            createdAt: timestamp,
            updatedAt: timestamp,
            quantity,
            duration,
            materials,
            processEvents: Array.isArray(entry.processEvents) ? entry.processEvents : [],
            qualityTests: Array.isArray(entry.qualityTests) ? entry.qualityTests : [],
            parentBatches: Array.isArray(entry.parentBatches) ? entry.parentBatches : [],
            qualityStatus: entry.qualityStatus || 'APROVADO'
        };
    }

    // Carregar dados de rastreabilidade real do Firestore
    async loadTracingData(startDate, endDate) {
        try {
            if (typeof db === 'undefined') {
                console.warn('[Traceability] Firestore não inicializado - retornando vazio');
                return [];
            }

            let query = db.collection('batch_traceability');
            
            if (startDate && endDate) {
                query = query.where('startTime', '>=', new Date(startDate))
                            .where('startTime', '<=', new Date(endDate));
            }
            
            const snapshot = await query.limit(1000).get();
            const batches = [];
            
            snapshot.forEach(doc => {
                batches.push({
                    id: doc.id,
                    ...doc.data(),
                    startTime: doc.data().startTime?.toDate ? doc.data().startTime.toDate() : new Date(doc.data().startTime),
                    endTime: doc.data().endTime?.toDate ? doc.data().endTime.toDate() : new Date(doc.data().endTime)
                });
            });
            
            return batches.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
            
        } catch (error) {
            console.error('[Traceability] Erro ao carregar dados de rastreabilidade:', error);
            return [];
        }
    }

    // Carregar dados de qualidade do Firestore
    async addQualityData(startDate, endDate) {
        try {
            if (typeof db === 'undefined') {
                console.warn('[TRACEABILITY] Firestore não disponível para qualidade');
                return;
            }

            let query = db.collection('quality_records');
            
            if (startDate && endDate) {
                query = query.where('timestamp', '>=', new Date(startDate))
                            .where('timestamp', '<=', new Date(endDate));
            }

            const snapshot = await query.get();
            
            snapshot.forEach(doc => {
                const quality = doc.data();
                const relatedBatch = Array.from(this.traceabilityData.batches.values()).find(batch =>
                    batch.machine === quality.machine &&
                    batch.product === quality.product &&
                    this.isSameDay(new Date(batch.startTime), new Date(quality.timestamp))
                );

                if (relatedBatch) {
                    if (!relatedBatch.qualityTests) relatedBatch.qualityTests = [];
                    relatedBatch.qualityTests.push({
                        id: doc.id,
                        ...quality,
                        timestamp: quality.timestamp?.toDate ? quality.timestamp.toDate() : new Date(quality.timestamp)
                    });
                }
            });

        } catch (error) {
            console.error('[TRACEABILITY] Erro ao carregar qualidade:', error);
        }
    }

    // Carregar dados de processo do Firestore
    async addProcessData(startDate, endDate) {
        try {
            if (typeof db === 'undefined') {
                console.warn('[TRACEABILITY] Firestore não disponível para processo');
                return;
            }

            let query = db.collection('process_events');
            
            if (startDate && endDate) {
                query = query.where('timestamp', '>=', new Date(startDate))
                            .where('timestamp', '<=', new Date(endDate));
            }

            const snapshot = await query.get();
            
            snapshot.forEach(doc => {
                const event = doc.data();
                const affectedBatches = Array.from(this.traceabilityData.batches.values()).filter(batch => {
                    const eventTime = new Date(event.timestamp);
                    const batchStart = new Date(batch.startTime);
                    const batchEnd = new Date(batch.endTime);
                    
                    return batch.machine === event.machine &&
                           eventTime >= batchStart && eventTime <= batchEnd;
                });

                affectedBatches.forEach(batch => {
                    if (!batch.processEvents) batch.processEvents = [];
                    batch.processEvents.push({
                        id: doc.id,
                        ...event,
                        timestamp: event.timestamp?.toDate ? event.timestamp.toDate() : new Date(event.timestamp)
                    });
                });
            });

        } catch (error) {
            console.error('[TRACEABILITY] Erro ao carregar eventos de processo:', error);
        }
    }

    // Carregar produtos derivados do Firestore
    async loadDerivedProducts() {
        try {
            if (typeof db === 'undefined') {
                console.warn('[TRACEABILITY] Firestore não disponível para produtos derivados');
                return;
            }

            const snapshot = await db.collection('derived_products')
                .limit(1000)
                .get();

            snapshot.forEach(doc => {
                const derived = doc.data();
                const parentBatchId = derived.parentBatchId;
                
                if (this.traceabilityData.genealogy.has(parentBatchId)) {
                    const derivedId = doc.id;
                    const parentGenealogy = this.traceabilityData.genealogy.get(parentBatchId);
                    
                    this.traceabilityData.genealogy.set(derivedId, {
                        id: derivedId,
                        type: 'PRODUTO_FINAL',
                        ...derived,
                        level: 2,
                        children: [],
                        parents: [parentBatchId]
                    });

                    parentGenealogy.children.push(derivedId);
                }
            });

        } catch (error) {
            console.error('[TRACEABILITY] Erro ao carregar produtos derivados:', error);
        }
    }

    // Calcular impacto do evento de processo
    calculateProcessEventImpact(duration) {
        if (duration < 5) return 'BAIXO';
        if (duration < 30) return 'MEDIO';
        if (duration < 120) return 'ALTO';
        return 'CRITICO';
    }

    // Verificar se é o mesmo dia
    isSameDay(date1, date2) {
        return date1.toDateString() === date2.toDateString();
    }

    // Construir árvore de genealogia
    buildGenealogyTree() {
        // Criar relações hierárquicas entre lotes
        const batches = Array.from(this.traceabilityData.batches.values());
        
        batches.forEach(batch => {
            // Simular relações de matéria-prima (upstream)
            batch.materials.forEach(material => {
                const materialBatchId = `MAT-${material.batchNumber}`;
                
                if (!this.traceabilityData.genealogy.has(materialBatchId)) {
                    this.traceabilityData.genealogy.set(materialBatchId, {
                        id: materialBatchId,
                        type: 'MATERIAL',
                        code: material.code,
                        description: material.type,
                        supplier: material.supplier,
                        children: [],
                        parents: [],
                        level: 0
                    });
                }
                
                // Adicionar relação
                const materialGenealogy = this.traceabilityData.genealogy.get(materialBatchId);
                materialGenealogy.children.push(batch.id);
                batch.parentBatches.push(materialBatchId);
            });

            // Criar entrada de genealogia para o lote
            this.traceabilityData.genealogy.set(batch.id, {
                id: batch.id,
                type: 'PRODUTO',
                code: batch.productCode,
                description: batch.product,
                machine: batch.machine,
                operator: batch.operator,
                children: [],
                parents: batch.parentBatches,
                level: 1,
                batch: batch
            });
        });

        // Carregar produtos derivados do Firestore (downstream products)
        this.loadDerivedProducts();

        console.log('[TRACEABILITY] Árvore de genealogia construída:', {
            nodes: this.traceabilityData.genealogy.size
        });
    }

    // Buscar lote por critérios
    searchBatch(criteria) {
        const cacheKey = JSON.stringify(criteria);
        if (this.searchCache.has(cacheKey)) {
            return this.searchCache.get(cacheKey);
        }

        let results = Array.from(this.traceabilityData.batches.values());

        // Aplicar filtros
        if (criteria.batchId) {
            results = results.filter(batch => 
                batch.id.toLowerCase().includes(criteria.batchId.toLowerCase())
            );
        }

        if (criteria.workOrder) {
            results = results.filter(batch => 
                batch.workOrder.toLowerCase().includes(criteria.workOrder.toLowerCase())
            );
        }

        if (criteria.product) {
            results = results.filter(batch => 
                batch.product.toLowerCase().includes(criteria.product.toLowerCase()) ||
                batch.productCode.toLowerCase().includes(criteria.product.toLowerCase())
            );
        }

        if (criteria.machine) {
            results = results.filter(batch => 
                batch.machine.toLowerCase().includes(criteria.machine.toLowerCase())
            );
        }

        if (criteria.operator) {
            results = results.filter(batch => 
                batch.operator.toLowerCase().includes(criteria.operator.toLowerCase())
            );
        }

        if (criteria.dateFrom) {
            results = results.filter(batch => 
                new Date(batch.startTime) >= new Date(criteria.dateFrom)
            );
        }

        if (criteria.dateTo) {
            results = results.filter(batch => 
                new Date(batch.startTime) <= new Date(criteria.dateTo)
            );
        }

        if (criteria.materialBatch) {
            results = results.filter(batch => 
                batch.materials.some(material => 
                    material.batchNumber.toLowerCase().includes(criteria.materialBatch.toLowerCase())
                )
            );
        }

        if (criteria.qualityStatus) {
            results = results.filter(batch => 
                batch.qualityStatus === criteria.qualityStatus
            );
        }

        // Limitar resultados
        const limitedResults = results.slice(0, this.config.maxSearchResults);

        // Cache do resultado
        this.searchCache.set(cacheKey, limitedResults);
        
        return limitedResults;
    }

    // Obter genealogia completa de um lote
    getFullGenealogy(batchId, direction = 'both') {
        const genealogy = {
            target: null,
            upstream: [],   // Materiais e lotes anteriores
            downstream: []  // Produtos derivados
        };

        const targetNode = this.traceabilityData.genealogy.get(batchId);
        if (!targetNode) {
            return genealogy;
        }

        genealogy.target = targetNode;

        // Buscar upstream (materiais, lotes anteriores)
        if (direction === 'both' || direction === 'upstream') {
            genealogy.upstream = this.traceUpstream(batchId, new Set());
        }

        // Buscar downstream (produtos derivados)
        if (direction === 'both' || direction === 'downstream') {
            genealogy.downstream = this.traceDownstream(batchId, new Set());
        }

        return genealogy;
    }

    // Rastrear upstream (materiais e lotes anteriores)
    traceUpstream(nodeId, visited = new Set()) {
        if (visited.has(nodeId)) return [];
        visited.add(nodeId);

        const node = this.traceabilityData.genealogy.get(nodeId);
        if (!node || !node.parents.length) return [];

        const upstream = [];
        
        node.parents.forEach(parentId => {
            const parent = this.traceabilityData.genealogy.get(parentId);
            if (parent) {
                upstream.push(parent);
                // Recursivamente buscar pais dos pais
                upstream.push(...this.traceUpstream(parentId, visited));
            }
        });

        return upstream;
    }

    // Rastrear downstream (produtos derivados)
    traceDownstream(nodeId, visited = new Set()) {
        if (visited.has(nodeId)) return [];
        visited.add(nodeId);

        const node = this.traceabilityData.genealogy.get(nodeId);
        if (!node || !node.children.length) return [];

        const downstream = [];
        
        node.children.forEach(childId => {
            const child = this.traceabilityData.genealogy.get(childId);
            if (child) {
                downstream.push(child);
                // Recursivamente buscar filhos dos filhos
                downstream.push(...this.traceDownstream(childId, visited));
            }
        });

        return downstream;
    }

    // Gerar matriz de recall
    generateRecallMatrix(criteria) {
        // Encontrar lotes afetados
        const affectedBatches = this.searchBatch(criteria);
        
        const recallMatrix = {
            affectedBatches: affectedBatches.length,
            totalQuantity: 0,
            affectedCustomers: new Set(),
            impactedProducts: new Set(),
            materialsInvolved: new Set(),
            timeRange: { start: null, end: null },
            actions: [],
            batches: []
        };

        affectedBatches.forEach(batch => {
            // Obter genealogia completa
            const genealogy = this.getFullGenealogy(batch.id);
            
            recallMatrix.totalQuantity += batch.quantity;
            recallMatrix.impactedProducts.add(batch.product);
            
            // Rastrear produtos derivados (que podem ter sido entregues)
            genealogy.downstream.forEach(downstream => {
                if (downstream.type === 'PRODUTO_FINAL' && downstream.customer) {
                    recallMatrix.affectedCustomers.add(downstream.customer);
                }
            });

            // Rastrear materiais
            batch.materials.forEach(material => {
                recallMatrix.materialsInvolved.add(`${material.code}-${material.batchNumber}`);
            });

            // Atualizar range de tempo
            const batchDate = new Date(batch.startTime);
            if (!recallMatrix.timeRange.start || batchDate < recallMatrix.timeRange.start) {
                recallMatrix.timeRange.start = batchDate;
            }
            if (!recallMatrix.timeRange.end || batchDate > recallMatrix.timeRange.end) {
                recallMatrix.timeRange.end = batchDate;
            }

            recallMatrix.batches.push({
                ...batch,
                genealogy: genealogy
            });
        });

        // Converter Sets para Arrays
        recallMatrix.affectedCustomers = Array.from(recallMatrix.affectedCustomers);
        recallMatrix.impactedProducts = Array.from(recallMatrix.impactedProducts);
        recallMatrix.materialsInvolved = Array.from(recallMatrix.materialsInvolved);

        // Gerar ações recomendadas
        recallMatrix.actions = this.generateRecallActions(recallMatrix);

        return recallMatrix;
    }

    // Gerar ações de recall
    generateRecallActions(recallMatrix) {
        const actions = [];

        actions.push({
            priority: 'ALTA',
            action: 'Notificar clientes afetados',
            details: `${recallMatrix.affectedCustomers.length} clientes identificados`,
            responsible: 'COMERCIAL/QUALIDADE',
            deadline: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h
        });

        actions.push({
            priority: 'ALTA',
            action: 'Segregar estoque',
            details: `${recallMatrix.affectedBatches} lotes a segregar`,
            responsible: 'PRODUÇÃO/ALMOXARIFADO',
            deadline: new Date(Date.now() + 2 * 60 * 60 * 1000) // 2h
        });

        if (recallMatrix.materialsInvolved.length > 0) {
            actions.push({
                priority: 'MÉDIA',
                action: 'Investigar matérias-primas',
                details: `Verificar ${recallMatrix.materialsInvolved.length} lotes de material`,
                responsible: 'SUPRIMENTOS/QUALIDADE',
                deadline: new Date(Date.now() + 48 * 60 * 60 * 1000) // 48h
            });
        }

        actions.push({
            priority: 'MÉDIA',
            action: 'Análise de causa raiz',
            details: 'Investigar processo produtivo e controles',
            responsible: 'ENGENHARIA/QUALIDADE',
            deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 dias
        });

        return actions;
    }

    // Atualizar interface de rastreabilidade
    updateTraceabilityInterface() {
        // Mostrar últimos 10 lotes por padrão
        const recentBatches = Array.from(this.traceabilityData.batches.values())
            .sort((a, b) => new Date(b.startTime) - new Date(a.startTime))
            .slice(0, 10);
        
        this.updateSearchResults(recentBatches);
        this.updateStatistics();
    }

    // Atualizar resultados da busca
    updateSearchResults(results) {
        const container = document.getElementById('traceability-search-results');
        if (!container) return;

        if (results.length === 0) {
            container.innerHTML = `
                <div class="text-center text-gray-500 py-8">
                    <i data-lucide="search" class="w-12 h-12 mx-auto text-gray-400 mb-2"></i>
                    <p class="font-semibold">Nenhum resultado encontrado</p>
                    <p class="text-sm">Tente ajustar os critérios de busca</p>
                </div>
            `;
            lucide.createIcons();
            return;
        }

        container.innerHTML = `
            <div class="space-y-3">
                <div class="flex items-center justify-between">
                    <h4 class="font-semibold">Resultados (${results.length})</h4>
                    <button onclick="window.traceabilitySystem.exportResults()" class="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1">
                        <i data-lucide="download" class="w-4 h-4"></i>
                        Exportar
                    </button>
                </div>
                ${results.map(batch => this.renderBatchCard(batch)).join('')}
            </div>
        `;
        lucide.createIcons();
    }

    // Renderizar card do lote
    renderBatchCard(batch) {
        const qualityColor = {
            'APROVADO': 'text-green-600 bg-green-50',
            'CONDICIONAL': 'text-yellow-600 bg-yellow-50',
            'REJEITADO': 'text-red-600 bg-red-50'
        }[batch.qualityStatus] || 'text-gray-600 bg-gray-50';

        return `
            <div class="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                 onclick="window.traceabilitySystem.showBatchDetails('${batch.id}')">
                <div class="flex items-start justify-between mb-3">
                    <div>
                        <h5 class="font-semibold text-gray-900">${batch.id}</h5>
                        <p class="text-sm text-gray-600">OP: ${batch.workOrder}</p>
                    </div>
                    <div class="text-right">
                        <span class="px-2 py-1 rounded-full text-xs font-medium ${qualityColor}">
                            ${batch.qualityStatus}
                        </span>
                    </div>
                </div>
                
                <div class="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <p class="text-gray-500">Produto</p>
                        <p class="font-medium">${batch.product}</p>
                    </div>
                    <div>
                        <p class="text-gray-500">Máquina</p>
                        <p class="font-medium">${batch.machine}</p>
                    </div>
                    <div>
                        <p class="text-gray-500">Quantidade</p>
                        <p class="font-medium">${batch.quantity.toLocaleString()} pcs</p>
                    </div>
                    <div>
                        <p class="text-gray-500">Data/Hora</p>
                        <p class="font-medium">${new Date(batch.startTime).toLocaleDateString()} ${new Date(batch.startTime).toLocaleTimeString().slice(0, 5)}</p>
                    </div>
                </div>
                
                <div class="mt-3 flex items-center justify-between text-xs text-gray-500">
                    <span>Operador: ${batch.operator}</span>
                    <span>Turno: ${batch.shift}</span>
                </div>
            </div>
        `;
    }

    // Atualizar estatísticas
    updateStatistics() {
        const stats = this.calculateStatistics();
        
        const totalBatchesEl = document.getElementById('total-batches-count');
        if (totalBatchesEl) {
            totalBatchesEl.textContent = stats.totalBatches.toLocaleString();
        }

        const totalProductsEl = document.getElementById('total-products-count');
        if (totalProductsEl) {
            totalProductsEl.textContent = stats.uniqueProducts.toLocaleString();
        }

        const traceabilityRateEl = document.getElementById('traceability-rate');
        if (traceabilityRateEl) {
            traceabilityRateEl.textContent = `${stats.traceabilityRate}%`;
        }

        const avgGenealogiesEl = document.getElementById('avg-genealogies');
        if (avgGenealogiesEl) {
            avgGenealogiesEl.textContent = stats.avgGenealogyDepth.toFixed(1);
        }
    }

    // Calcular estatísticas
    calculateStatistics() {
        const batches = Array.from(this.traceabilityData.batches.values());
        const products = new Set(batches.map(b => b.product));
        const totalBatches = batches.length;
        
        const traceableBatches = totalBatches > 0 ? batches.filter(b => 
            Array.isArray(b.materials) && b.materials.length > 0 &&
            Array.isArray(b.parentBatches) && b.parentBatches.length > 0
        ) : [];

        const genealogyDepths = Array.from(this.traceabilityData.genealogy.values())
            .map(g => g.level);

        const traceabilityRate = totalBatches > 0
            ? Math.round((traceableBatches.length / totalBatches) * 100)
            : 0;

        return {
            totalBatches,
            uniqueProducts: products.size,
            traceabilityRate,
            avgGenealogyDepth: genealogyDepths.length > 0 ? 
                genealogyDepths.reduce((sum, d) => sum + d, 0) / genealogyDepths.length : 0
        };
    }

    // Mostrar detalhes do lote
    showBatchDetails(batchId) {
        const batch = this.traceabilityData.batches.get(batchId);
        if (!batch) return;

        const genealogy = this.getFullGenealogy(batchId);
        
        // Renderizar modal de detalhes
        this.renderBatchDetailsModal(batch, genealogy);
    }

    // Renderizar modal de detalhes do lote
    renderBatchDetailsModal(batch, genealogy) {
        // Criar modal dinamicamente
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-start p-4 overflow-y-auto';
        modal.innerHTML = `
            <div class="bg-white rounded-lg shadow-xl w-full max-w-6xl mt-10 mb-10">
                <div class="flex items-center justify-between p-6 border-b">
                    <h3 class="text-xl font-bold">Detalhes do Lote: ${batch.id}</h3>
                    <button onclick="this.parentElement.parentElement.parentElement.remove()" class="p-1 rounded-full hover:bg-gray-200">
                        <i data-lucide="x" class="w-5 h-5"></i>
                    </button>
                </div>
                
                <div class="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
                    ${this.renderBatchInfo(batch)}
                    ${this.renderGenealogyTree(genealogy)}
                    ${this.renderParametersHistory(batch)}
                    ${this.renderQualityHistory(batch)}
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Inicializar ícones lucide
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    // Renderizar informações básicas do lote
    renderBatchInfo(batch) {
        const qualityColor = {
            'APROVADO': 'text-green-600 bg-green-50 border-green-200',
            'CONDICIONAL': 'text-yellow-600 bg-yellow-50 border-yellow-200',
            'REJEITADO': 'text-red-600 bg-red-50 border-red-200'
        }[batch.qualityStatus] || 'text-gray-600 bg-gray-50 border-gray-200';

        return `
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div class="bg-gray-50 p-4 rounded-lg">
                    <h4 class="font-semibold mb-3">Informações Gerais</h4>
                    <div class="space-y-2 text-sm">
                        <div class="flex justify-between">
                            <span class="text-gray-600">ID do Lote:</span>
                            <span class="font-medium">${batch.id}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-600">Ordem de Trabalho:</span>
                            <span class="font-medium">${batch.workOrder}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-600">Produto:</span>
                            <span class="font-medium">${batch.product}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-600">Código:</span>
                            <span class="font-medium">${batch.productCode}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-600">Máquina:</span>
                            <span class="font-medium">${batch.machine}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-600">Operador:</span>
                            <span class="font-medium">${batch.operator}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-600">Turno:</span>
                            <span class="font-medium">${batch.shift}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-600">Quantidade:</span>
                            <span class="font-medium">${batch.quantity.toLocaleString()} pcs</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-600">Duração:</span>
                            <span class="font-medium">${batch.duration} min</span>
                        </div>
                        <div class="flex justify-between items-center">
                            <span class="text-gray-600">Status Qualidade:</span>
                            <span class="px-2 py-1 rounded border text-xs font-medium ${qualityColor}">
                                ${batch.qualityStatus}
                            </span>
                        </div>
                    </div>
                </div>
                
                <div class="bg-gray-50 p-4 rounded-lg">
                    <h4 class="font-semibold mb-3">Matérias-Primas</h4>
                    <div class="space-y-3">
                        ${batch.materials.map(material => `
                            <div class="bg-white p-3 rounded border">
                                <div class="flex justify-between items-start mb-2">
                                    <span class="font-medium text-sm">${material.type}</span>
                                    <span class="text-xs text-gray-500">${material.code}</span>
                                </div>
                                <div class="text-xs text-gray-600">
                                    <div>Lote: ${material.batchNumber}</div>
                                    <div>Quantidade: ${material.quantityUsed} kg</div>
                                    <div>Fornecedor: ${material.supplier}</div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    // Renderizar árvore de genealogia
    renderGenealogyTree(genealogy) {
        return `
            <div class="bg-indigo-50 p-4 rounded-lg">
                <h4 class="font-semibold mb-4 flex items-center gap-2">
                    <i data-lucide="git-branch" class="w-4 h-4"></i>
                    Árvore de Genealogia
                </h4>
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 text-sm">
                    <div>
                        <h5 class="font-medium mb-2 text-gray-700">Upstream (Materiais)</h5>
                        <div class="space-y-2">
                            ${genealogy.upstream.length > 0 ? genealogy.upstream.map(node => `
                                <div class="bg-white p-2 rounded border">
                                    <div class="font-medium">${node.code}</div>
                                    <div class="text-xs text-gray-600">${node.description}</div>
                                </div>
                            `).join('') : '<div class="text-gray-500">Nenhum</div>'}
                        </div>
                    </div>
                    
                    <div class="flex items-center justify-center">
                        <div class="bg-white p-4 rounded-lg border-2 border-indigo-200 text-center">
                            <div class="font-bold text-indigo-600">${genealogy.target.code}</div>
                            <div class="text-xs text-gray-600">${genealogy.target.description}</div>
                            <div class="text-xs text-indigo-500 mt-1">LOTE ATUAL</div>
                        </div>
                    </div>
                    
                    <div>
                        <h5 class="font-medium mb-2 text-gray-700">Downstream (Derivados)</h5>
                        <div class="space-y-2">
                            ${genealogy.downstream.length > 0 ? genealogy.downstream.map(node => `
                                <div class="bg-white p-2 rounded border">
                                    <div class="font-medium">${node.code}</div>
                                    <div class="text-xs text-gray-600">${node.description}</div>
                                    ${node.customer ? `<div class="text-xs text-blue-600">Cliente: ${node.customer}</div>` : ''}
                                </div>
                            `).join('') : '<div class="text-gray-500">Nenhum</div>'}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // Renderizar histórico de parâmetros
    renderParametersHistory(batch) {
        return `
            <div class="bg-blue-50 p-4 rounded-lg">
                <h4 class="font-semibold mb-3 flex items-center gap-2">
                    <i data-lucide="settings" class="w-4 h-4"></i>
                    Parâmetros de Processo
                </h4>
                <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                    ${Object.entries(batch.parameters).map(([param, value]) => `
                        <div class="bg-white p-3 rounded border">
                            <div class="text-gray-600 text-xs uppercase">${param.replace(/([A-Z])/g, ' $1')}</div>
                            <div class="font-bold text-lg">${value}</div>
                            <div class="text-xs text-gray-500">
                                ${this.getParameterUnit(param)}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // Obter unidade do parâmetro
    getParameterUnit(param) {
        const units = {
            cycleTime: 's',
            realCycleTime: 's',
            cavities: 'un',
            activeCavities: 'un',
            pieceWeight: 'g',
            temperature: '°C',
            pressure: 'bar',
            injectionSpeed: 'mm/s',
            coolingTime: 's'
        };
        return units[param] || '';
    }

    // Renderizar histórico de qualidade
    renderQualityHistory(batch) {
        return `
            <div class="bg-orange-50 p-4 rounded-lg">
                <h4 class="font-semibold mb-3 flex items-center gap-2">
                    <i data-lucide="shield-check" class="w-4 h-4"></i>
                    Histórico de Qualidade
                </h4>
                <div class="space-y-3">
                    ${batch.qualityTests && batch.qualityTests.length > 0 ? batch.qualityTests.map(test => `
                        <div class="bg-white p-3 rounded border">
                            <div class="flex justify-between items-start mb-2">
                                <span class="font-medium text-sm">${test.type}</span>
                                <span class="px-2 py-1 rounded text-xs ${
                                    test.status === 'APROVADO' ? 'bg-green-100 text-green-600' :
                                    test.status === 'REJEITADO' ? 'bg-red-100 text-red-600' :
                                    'bg-yellow-100 text-yellow-600'
                                }">${test.status}</span>
                            </div>
                            <div class="text-xs text-gray-600">
                                <div>Motivo: ${test.reason}</div>
                                <div>Quantidade: ${test.quantity} pcs</div>
                                <div>Inspetor: ${test.inspector}</div>
                                <div>Data: ${new Date(test.timestamp).toLocaleString()}</div>
                                ${test.observations ? `<div>Obs: ${test.observations}</div>` : ''}
                            </div>
                        </div>
                    `).join('') : `
                        <div class="bg-white p-6 rounded border text-center text-gray-500">
                            <i data-lucide="check-circle" class="w-8 h-8 mx-auto text-green-500 mb-2"></i>
                            <div class="font-medium">Nenhum teste de qualidade registrado</div>
                            <div class="text-xs">Lote aprovado sem restrições</div>
                        </div>
                    `}
                </div>
            </div>
        `;
    }

    // Realizar busca
    performSearch() {
        const criteria = this.getSearchCriteria();
        const results = this.searchBatch(criteria);
        this.updateSearchResults(results);
    }

    // Obter critérios de busca da interface
    getSearchCriteria() {
        return {
            batchId: document.getElementById('search-batch-id')?.value || '',
            workOrder: document.getElementById('search-work-order')?.value || '',
            product: document.getElementById('search-product')?.value || '',
            machine: document.getElementById('search-machine')?.value || '',
            operator: document.getElementById('search-operator')?.value || '',
            materialBatch: document.getElementById('search-material-batch')?.value || '',
            dateFrom: document.getElementById('search-date-from')?.value || '',
            dateTo: document.getElementById('search-date-to')?.value || '',
            qualityStatus: document.getElementById('search-quality-status')?.value || ''
        };
    }

    // Exportar resultados
    exportResults() {
        const criteria = this.getSearchCriteria();
        const results = this.searchBatch(criteria);
        
        // Criar CSV
        const headers = [
            'Lote ID', 'Ordem Trabalho', 'Produto', 'Código', 'Máquina', 'Operador', 
            'Turno', 'Quantidade', 'Data Início', 'Duração', 'Status Qualidade'
        ];

        const csvContent = [
            headers.join(','),
            ...results.map(batch => [
                batch.id,
                batch.workOrder,
                batch.product,
                batch.productCode,
                batch.machine,
                batch.operator,
                batch.shift,
                batch.quantity,
                new Date(batch.startTime).toLocaleString(),
                batch.duration,
                batch.qualityStatus
            ].join(','))
        ].join('\n');

        // Download
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rastreabilidade_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    }

    // Obter dados de rastreabilidade para exportação
    getTraceabilityData() {
        return {
            batches: Array.from(this.traceabilityData.batches.values()),
            genealogy: Array.from(this.traceabilityData.genealogy.values()),
            statistics: this.calculateStatistics(),
            exportedAt: new Date()
        };
    }
}

// Instância global
window.traceabilitySystem = new TraceabilitySystem();