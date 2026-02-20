# 🔥 Ações para Otimização e Redução de Custos — Cloud Firestore

**Data:** Fevereiro 2026  
**Sistema:** Hokkaido MES  
**Objetivo:** Catálogo de ações possíveis para redução contínua de custos no Firestore  
**Contexto:** Fases 1-3 de otimização já implementadas (~1,2M → ~390K leituras/dia, redução de 67%)

---

## 📊 Situação Atual (pós-otimizações)

| Métrica | Valor Atual |
|---------|-------------|
| Leituras estimadas/dia | ~390.000 |
| Coleções Firestore | 29 |
| Chamadas `.get()` diretas (sem cache) | ~90 em script.js + ~25 em controllers |
| Listeners `onSnapshot` ativos | 3 (active_downtimes, pcp_messages ×2) |
| Pollings com leitura Firebase | 6 intervalos ativos |
| Full collection reads (sem `.where()`) | **18 locais** |
| Custo mensal estimado | ~$12-25 |

### Maiores Consumidores Remanescentes

| # | Fonte | Leit./Dia | % do Total |
|---|-------|-----------|-----------|
| 1 | Dashboard TV — `loadRealTimeData` (60s poll × 4 coleções) | ~86.400 | 22% |
| 2 | `pollActiveDowntimes` — script.js + planning.controller (300s) | ~17.280 | 4% |
| 3 | `calculateAllKPIs` — advanced-kpis.js (60min × 4 coleções) | ~3.840 | 1% |
| 4 | Navegação entre abas (leituras sob demanda) | ~280.000 | 72% |

---

## 📋 Catálogo de Ações

### Legenda de Esforço e Impacto

| Símbolo | Esforço | Impacto |
|---------|---------|---------|
| ⚡ | < 2 horas | 🟢 Baixo (< 5% redução) |
| 🔧 | 2-8 horas | 🟡 Médio (5-20% redução) |
| 🏗️ | 1-3 dias | 🔴 Alto (> 20% redução) |
| 🏢 | 1+ semana | 🔴🔴 Muito Alto (> 40% redução) |

---

## NÍVEL 1 — Quick Wins (sem risco, implementação imediata)

### 1.1 ⚡ Eliminar full collection reads remanescentes → 🟡 Médio

**Problema:** 18 locais ainda fazem `.get()` sem `.where()`, lendo a coleção inteira.

| Arquivo | Linha | Coleção | Solução |
|---------|-------|---------|---------|
| script.js | L1203 | `production_orders` | Usar `getProductionOrdersCached()` |
| script.js | L1389 | `active_downtimes` | Usar `getActiveDowntimesCached()` |
| script.js | L1455 | `machine_priorities` | Usar `getMachinePrioritiesCached()` |
| script.js | L10436 | `production_orders` | Adicionar `.limit(100)` + `.where('status','!=','finalizada')` |
| launch.controller.js | L276, L3706 | `active_downtimes` | Usar `FirebaseCacheService.getActiveDowntimes()` |
| launch.controller.js | L3581 | `production_orders` | Usar `FirebaseCacheService.getProductionOrders()` |
| orders.controller.js | L45 | `production_orders` | Adicionar `.limit(200)` + filtro de status |
| pcp.controller.js | L432 | `active_downtimes` | Usar `FirebaseCacheService.getActiveDowntimes()` |
| downtime-grid.controller.js | L88 | `active_downtimes` | Usar `FirebaseCacheService.getActiveDowntimes()` |
| tooling.controller.js | L103 | `ferramentaria_moldes` | Já cacheado (verificar se cache está ativo) |
| planning.controller.js | L1314 | `production_orders` | Adicionar `.limit(200)` |
| reports.controller.js | L92 | `production_orders` | Já tem `.limit(2000)` — reduzir para `.limit(500)` |
| dashboard-tv.html | L3633, L3871 | `active_downtimes` | Usar dados do `onSnapshot` já ativo (L3075) |
| firebase-cache.service.js | L32, L103, L161 | vários | São os próprios cache methods — OK |

**Economia estimada:** ~50.000-80.000 leituras/dia  
**Risco:** Nenhum — apenas redirecionar para funções de cache existentes

---

### 1.2 ⚡ Dashboard TV — reutilizar `onSnapshot` em vez de polling → 🟡 Médio

**Problema:** `dashboard-tv.html` tem um `onSnapshot` full collection em `active_downtimes` (L3075) E TAMBÉM faz `.get()` full collection nos mesmos dados em L3633 e L3871.

**Solução:** Armazenar os dados do `onSnapshot` em variável local e reutilizar:

```javascript
// Em vez de:
const snapshot = await db.collection('active_downtimes').get();

// Usar a variável populada pelo onSnapshot:
const downtimes = window._activeDowntimesSnapshot || [];
```

**Economia estimada:** ~2.880 leituras/dia por TV  
**Risco:** Nenhum

---

### 1.3 ⚡ Unificar polling duplicado de `active_downtimes` → 🟢 Baixo

**Problema:** `pollActiveDowntimes` roda em dois locais independentes com 300s:
- `script.js` L11288
- `planning.controller.js` L2515

Se ambos estiverem ativos simultaneamente, dobra as leituras.

**Solução:** Verificar se o polling já está ativo antes de iniciar outro:

```javascript
if (!window._activeDowntimesPollActive) {
    window._activeDowntimesPollActive = true;
    setInterval(pollActiveDowntimes, 300000);
}
```

Ou centralizar no `StateManager` como fonte única:

```javascript
// StateManager.startPolling('activeDowntimes', fetchFn, 300000);
```

**Economia estimada:** ~8.640 leituras/dia  
**Risco:** Muito baixo

---

### 1.4 ⚡ Adicionar `visibilitychange` no Dashboard TV → 🟡 Médio

**Problema:** O polling de 60s em `loadRealTimeData` continua rodando mesmo quando a TV está com tela desligada ou o navegador está em segundo plano.

**Solução:**

```javascript
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        clearInterval(window._dashboardTVPollInterval);
    } else {
        loadRealTimeData(); // refresh imediato
        window._dashboardTVPollInterval = setInterval(loadRealTimeData, 60000);
    }
});
```

**Economia estimada:** ~20.000-40.000 leituras/dia (depende do uso)  
**Risco:** Nenhum

---

## NÍVEL 2 — Otimizações Estruturais (médio esforço)

### 2.1 🔧 Implementar invalidação de cache em writes → 🟡 Médio

**Problema:** Após salvar/editar/excluir um documento, o cache continua servindo dados antigos até o TTL expirar. Algumas funções fazem `forceRefresh`, mas não há padrão consistente.

**Solução:** Criar um wrapper de escrita que invalida caches automaticamente:

```javascript
// src/utils/write-invalidation.js
const CACHE_KEYS_BY_COLLECTION = {
    'production_entries': ['productionEntries', 'prod_*'],
    'production_orders': ['productionOrders'],
    'planning':          ['planning', 'plan_*'],
    'active_downtimes':  ['activeDowntimes'],
    'downtime_entries':  ['downtimeEntries', 'down_*'],
};

async function writeAndInvalidate(collectionName, operation) {
    const result = await operation(); // .add(), .update(), .delete()
    
    const keys = CACHE_KEYS_BY_COLLECTION[collectionName] || [];
    keys.forEach(key => {
        CacheManager.invalidate(key);
        DataStore.invalidate(key);
        StateManager.invalidate(key);
    });
    
    return result;
}
```

**Benefício:** Elimina reads desnecessários de refresh pós-escrita  
**Economia estimada:** ~15.000-30.000 leituras/dia  
**Risco:** Baixo — precisa testar fluxos de edição

---

### 2.2 🔧 Prefetch de dados por aba (tab-aware loading) → 🟡 Médio

**Problema:** Cada aba carrega seus dados independentemente ao ser acessada, sem reaproveitar dados já carregados.

**Solução:** Ao trocar de aba, pré-carregar dados da aba adjacente em background:

```javascript
function onTabChange(currentTab) {
    const tabDataMap = {
        'lancamento': ['planning', 'active_downtimes', 'production_entries'],
        'analise':    ['production_entries', 'downtime_entries', 'planning'],
        'pcp':        ['active_downtimes', 'planning', 'production_orders'],
        'ordens':     ['production_orders'],
    };
    
    const collections = tabDataMap[currentTab] || [];
    collections.forEach(col => {
        // Pre-warm cache se não existir
        if (!CacheManager.has(col)) {
            CacheManager.fetchCollection(col);
        }
    });
}
```

**Economia estimada:** ~20.000 leituras/dia  
**Risco:** Baixo

---

### 2.3 🔧 Consolidar queries de relatórios com ranges compartilhados → 🟡 Médio

**Problema:** Sub-abas de Análise (Produção, Eficiência, Perdas, Paradas) consultam as mesmas coleções com os mesmos filtros de data, mas separadamente. Cache inline ajuda mas cada sub-aba tem chave diferente se o período for ligeiramente diferente.

**Solução:** Normalizar períodos para intervalos padrão (hoje, últimos 7 dias, últimos 30 dias, mês corrente) e usar chave de cache compartilhada:

```javascript
function normalizePeriod(startDate, endDate) {
    const today = new Date().toISOString().split('T')[0];
    if (startDate === today && endDate === today) return 'today';
    // ... outros períodos padrão
    return `${startDate}_${endDate}`;
}
```

**Economia estimada:** ~10.000-20.000 leituras/dia  
**Risco:** Baixo

---

### 2.4 🔧 Paginação em coleções grandes → 🟡 Médio

**Problema:** `production_orders` é carregada inteira em múltiplos locais. À medida que o número de OPs cresce, cada leitura fica mais cara.

**Locais afetados:**
- `orders.controller.js` L45 — `.orderBy('createdAt', 'desc').get()` — sem limit
- `planning.controller.js` L1314 — `.orderBy('createdAt', 'desc')` — sem limit
- `script.js` L10436 — `.orderBy('createdAt', 'desc')` — sem limit

**Solução:**

```javascript
// Adicionar limit + filtro de status
db.collection('production_orders')
    .where('status', '!=', 'finalizada')
    .orderBy('createdAt', 'desc')
    .limit(100)
    .get();

// Para visualizar finalizadas: paginação sob demanda
db.collection('production_orders')
    .orderBy('createdAt', 'desc')
    .startAfter(lastDoc)
    .limit(50)
    .get();
```

**Economia estimada:** Proporcional ao crescimento — ~500 docs × 10 readers × 3 calls = ~15.000 leituras/dia atuais → ~3.000 com paginação  
**Risco:** Médio — precisa ajustar UI para suportar paginação

---

### 2.5 🔧 Dashboard de monitoramento de consumo (Fase 3 pendente) → 🟢 Baixo

**Problema:** Não há visibilidade em tempo real do consumo de leituras. `FirebaseMonitor` e `DataStore.getStats()` existem mas não são exibidos.

**Solução:** Adicionar painel na aba Admin com:
- Total de leituras desde login
- Cache hit ratio
- Top 5 coleções mais lidas
- Alertas quando consumo excede threshold

```javascript
// Exibir no footer ou aba admin
function renderFirebaseStats() {
    const stats = window.FirebaseMonitor?.getStats?.() 
                || window.DataStore?.getStats?.() 
                || {};
    
    document.getElementById('firebase-stats').innerHTML = `
        📊 Leituras: ${stats.total || 0} | 
        Cache: ${stats.cacheHits || 0} hits | 
        Ratio: ${((stats.cacheHits / Math.max(stats.total, 1)) * 100).toFixed(1)}%
    `;
}
```

**Economia:** Indireta — permite medir impacto de otimizações futuras  
**Risco:** Nenhum

---

## NÍVEL 3 — Otimizações Avançadas (alto impacto, maior esforço)

### 3.1 🏗️ Migrar `active_downtimes` para Realtime Database → 🔴 Alto

**Problema:** `active_downtimes` é a coleção mais acessada (polling 300s em 2+ locais, `onSnapshot` no Dashboard TV, `.get()` em 12+ locais). Firestore cobra por documento lido; Realtime Database cobra por dados transferidos (GB).

**Dados da coleção:**
- ~26 documentos (1 por máquina)
- ~2-3 KB por documento
- Total: ~65 KB por leitura completa

**Cálculo de custo comparativo:**

| Métrica | Firestore | Realtime DB |
|---------|-----------|-------------|
| Custo por leitura | $0.06/100K docs | — |
| Custo por GB transferido | — | $1/GB |
| Leituras/dia atuais | ~50.000 (26 docs cada) | — |
| Dados transferidos/dia | — | ~3.25 GB |
| Custo/dia | ~$0.78 | ~$3.25 |
| Custo/mês | ~$23.40 | ~$97.50 |

**⚠️ RESULTADO:** Para este volume de dados, Realtime Database é **mais caro** que Firestore. Esta ação **NÃO é recomendada** a menos que o volume de documentos cresça significativamente (>200 docs na coleção).

**Alternativa recomendada:** Manter no Firestore mas otimizar via `onSnapshot` (ver ação 3.2).

---

### 3.2 🏗️ Converter pollings de `active_downtimes` para `onSnapshot` compartilhado → 🔴 Alto

**Problema:** Múltiplos pollings (setInterval 300s) fazem `.get()` na mesma coleção. Cada poll lê todos os 26 documentos. Com `onSnapshot`, o Firestore cobra apenas 1 leitura por documento alterado após a leitura inicial.

**Situação atual:**
- `script.js` L11288 — polling 300s → `.get()` full
- `planning.controller.js` L2515 — polling 300s → `.get()` full
- `dashboard-tv.html` L3075 — já usa `onSnapshot` ✅
- Reads sob demanda em 6+ locais — `.get()` full cada vez

**Solução:** Criar um listener `onSnapshot` único e compartilhado:

```javascript
// src/services/active-downtimes-live.service.js
class ActiveDowntimesLiveService {
    constructor() {
        this._data = [];
        this._subscribers = [];
        this._unsubscribe = null;
    }
    
    start() {
        if (this._unsubscribe) return;
        this._unsubscribe = db.collection('active_downtimes')
            .onSnapshot(snapshot => {
                this._data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                this._subscribers.forEach(fn => fn(this._data));
            });
    }
    
    getData() { return this._data; }
    
    subscribe(fn) {
        this._subscribers.push(fn);
        if (this._data.length) fn(this._data); // immediate
        return () => this._subscribers = this._subscribers.filter(s => s !== fn);
    }
    
    stop() {
        this._unsubscribe?.();
        this._unsubscribe = null;
    }
}

// Uso: substituir todos os polling e .get() por:
const data = activeDowntimesLive.getData();
```

**Economia estimada:**
- Polling atual: ~17.280 leituras/dia (26 docs × 288 polls/dia)
- onSnapshot: ~26 leituras iniciais + ~500 leituras/dia (apenas docs alterados)
- **Economia: ~16.750 leituras/dia (~97%)**

**Risco:** Médio — listener permanente pode ter problemas de reconexão; precisa de cleanup em `visibilitychange`

---

### 3.3 🏗️ Cloud Functions para consolidação de dados → 🔴 Alto

**Problema:** Relatórios e análises consultam `production_entries`, `downtime_entries` e `planning` com filtros de data range. Cada consulta percorre potencialmente centenas de documentos.

**Solução:** Criar Cloud Functions que consolidam dados diariamente:

```
Firestore Trigger: onCreate/onUpdate em production_entries
→ Cloud Function: consolidateProductionDaily
→ Escreve em: daily_production_summary/{date}
    - totalProduzido por máquina
    - totalRefugo por máquina
    - OEE consolidado
    - totalSetup, totalParadas
```

**Collections de resumo sugeridas:**

| Coleção | Documento | Dados |
|---------|-----------|-------|
| `daily_production_summary` | `{date}` | produção, refugo, OEE por máquina |
| `daily_downtime_summary` | `{date}` | paradas por tipo, máquina, duração |
| `daily_planning_summary` | `{date}` | planos, cumprimento, eficiência |
| `monthly_kpi_summary` | `{year-month}` | KPIs mensais consolidados |

**Economia estimada:**
- Relatório atual: ~500 docs por query × 5 abas × 10 users = ~25.000 leituras/dia
- Com resumo: ~1 doc por query × 5 abas × 10 users = ~50 leituras/dia
- **Economia: ~24.950 leituras/dia (~99.8%)**

**Custos adicionais:**
- Cloud Functions: ~$0.40/milhão de invocações
- Gravações extras: ~100 docs/dia = ~$0.006/dia

**Risco:** Alto — requer setup de Cloud Functions, deploy separado, monitoramento

---

### 3.4 🏗️ Implementar `onSnapshot` com `includeMetadataChanges` → 🟢 Baixo

**Problema:** Ao reconectar após perda de conexão, `onSnapshot` re-emite todos os documentos, gerando leituras duplicadas.

**Solução:**

```javascript
db.collection('active_downtimes')
    .onSnapshot({ includeMetadataChanges: true }, snapshot => {
        // Ignorar eventos do cache local (não são leituras reais)
        if (snapshot.metadata.fromCache) return;
        if (!snapshot.metadata.hasPendingWrites) {
            // Apenas processar dados do servidor
            processData(snapshot);
        }
    });
```

**Economia estimada:** ~2.000-5.000 leituras/dia (depende de estabilidade da rede)  
**Risco:** Muito baixo

---

### 3.5 🏗️ Batch reads com `documentId() in` para lookups → 🟡 Médio

**Problema:** Vários locais fazem lookups individuais `.doc(id).get()` em loops:

| Arquivo | Coleção | Padrão |
|---------|---------|--------|
| script.js L5099 | `production_orders` | `.doc(orderId).get()` em loop |
| script.js L10122 | `production_orders` | `.doc(orderId).get()` individual |
| script.js L10733 | `production_orders` | `.doc(id).get()` individual |
| script.js L18218 | `production_orders` | `.doc(order_id).get()` individual |

**Solução:** Agrupar IDs e usar `in` query (máx 30 por batch):

```javascript
// Em vez de N chamadas individuais:
for (const id of orderIds) {
    const doc = await db.collection('production_orders').doc(id).get();
}

// Fazer uma única query batch:
const chunks = chunkArray(orderIds, 30); // Firestore limit: 30 items no 'in'
for (const chunk of chunks) {
    const snapshot = await db.collection('production_orders')
        .where(firebase.firestore.FieldPath.documentId(), 'in', chunk)
        .get();
}
```

**Nota:** `BatchQueryManager` já existe em `script.js` L998 mas é pouco utilizado.

**Economia estimada:** ~5.000-10.000 leituras/dia  
**Risco:** Baixo

---

## NÍVEL 4 — Otimizações Arquiteturais (longo prazo)

### 4.1 🏢 Service Worker com cache offline → 🔴🔴 Muito Alto

**Problema:** `service-worker.js` existe mas não cacheia respostas do Firestore. Cada page reload causa fresh reads.

**Solução:** Implementar estratégia stale-while-revalidate para dados do Firestore:

```javascript
// service-worker.js — interceptar chamadas Firestore REST
self.addEventListener('fetch', event => {
    if (event.request.url.includes('firestore.googleapis.com')) {
        event.respondWith(
            caches.match(event.request).then(cached => {
                const fetchPromise = fetch(event.request).then(response => {
                    const cache = await caches.open('firestore-cache');
                    cache.put(event.request, response.clone());
                    return response;
                });
                return cached || fetchPromise;
            })
        );
    }
});
```

**⚠️ Complexidade:** Firestore SDK usa WebSocket/gRPC, não REST puro. Esta abordagem funciona apenas com Firestore REST API ou `firebase/firestore/lite`.

**Alternativa mais viável:** Usar `enablePersistence()` do próprio Firestore SDK:

```javascript
firebase.firestore().enablePersistence({ synchronizeTabs: true })
    .catch(err => console.warn('Persistence failed:', err));
```

**Economia estimada:** ~30-50% em page reloads e reconexões  
**Risco:** Médio — pode causar conflitos de dados em multi-tab

---

### 4.2 🏢 Migrar para Firestore Lite SDK → 🔴🔴 Muito Alto

**Problema:** O SDK completo do Firestore inclui cache offline, listeners em tempo real e reconexão automática — funcionalidades pesadas que podem gerar leituras extras durante sincronização.

**Solução:** Para abas que fazem apenas leituras sob demanda (Relatórios, Análise, Histórico), usar `firebase/firestore/lite`:

```javascript
// Firestore Lite — ~80% menor, sem overhead de sincronização
import { getFirestore, collection, getDocs, query, where } 
    from 'firebase/firestore/lite';
```

**Benefícios:**
- Bundle ~80% menor
- Sem leituras de sincronização em background
- Conexão mais rápida

**Desvantagens:**
- Não suporta `onSnapshot` (listeners em tempo real)
- Sem cache offline automático

**Economia estimada:** ~10-15% em leituras de sincronização  
**Risco:** Alto — requer reestruturação significativa do código

---

### 4.3 🏢 Firestore Bundle (pré-empacotamento server-side) → 🔴🔴 Muito Alto

**Problema:** Na inicialização, o app lê múltiplas coleções para popular o estado inicial (~500 leituras).

**Solução:** Usar Firestore Bundles para pré-empacotar dados frequentemente acessados no servidor:

```javascript
// Cloud Function que gera o bundle
exports.createInitBundle = functions.https.onRequest(async (req, res) => {
    const db = admin.firestore();
    const bundleId = `init-${Date.now()}`;
    const bundle = db.bundle(bundleId);
    
    const [planning, orders, downtimes] = await Promise.all([
        db.collection('planning').where('date', '==', today).get(),
        db.collection('production_orders').where('status', '!=', 'finalizada').get(),
        db.collection('active_downtimes').get(),
    ]);
    
    const bundleBuffer = bundle
        .add('planning-today', planning)
        .add('active-orders', orders)
        .add('active-downtimes', downtimes)
        .build();
    
    res.set('Cache-Control', 'public, max-age=300'); // CDN cache 5min
    res.end(bundleBuffer);
});

// Cliente carrega o bundle:
const response = await fetch('/api/initBundle');
const bundle = await response.arrayBuffer();
await db.loadBundle(bundle);
const planningQuery = db.namedQuery('planning-today');
const snapshot = await planningQuery.get({ source: 'cache' }); // 0 reads!
```

**Economia estimada:** ~100% das leituras de inicialização (~500/session × 30 sessions/dia = ~15.000/dia)  
**Risco:** Alto — requer Cloud Functions + CDN; bundle pode ficar stale

---

### 4.4 🏢 Implementar TTL com Firestore TTL Policy → 🟢 Baixo

**Problema:** Coleções como `system_logs`, `hourly_production_entries` crescem indefinidamente, aumentando o custo de storage e de scans.

**Solução:** Configurar TTL no Firestore Console:

| Coleção | Campo TTL | Retenção |
|---------|-----------|----------|
| `system_logs` | `timestamp` | 90 dias |
| `hourly_production_entries` | `timestamp` | 30 dias |
| `extended_downtime_logs` (finalizados) | `endTime` | 180 dias |

**Configuração:** Firebase Console → Firestore → TTL Policies

**Economia:** Redução de storage + queries mais rápidas em coleções menores  
**Risco:** Dados antigos são permanentemente deletados

---

## 📊 Matriz de Priorização

| # | Ação | Esforço | Impacto | Economia/Dia | Prioridade |
|---|------|---------|---------|-------------|------------|
| 1.1 | Eliminar full collection reads | ⚡ 2h | 🟡 | ~65.000 | **P1** |
| 1.2 | Dashboard TV reutilizar onSnapshot | ⚡ 1h | 🟡 | ~2.880 | **P1** |
| 1.3 | Unificar polling duplicado | ⚡ 30min | 🟢 | ~8.640 | **P1** |
| 1.4 | visibilitychange no Dashboard TV | ⚡ 30min | 🟡 | ~30.000 | **P1** |
| 3.2 | onSnapshot compartilhado active_downtimes | 🏗️ 1d | 🔴 | ~16.750 | **P2** |
| 2.1 | Invalidação de cache em writes | 🔧 4h | 🟡 | ~22.500 | **P2** |
| 3.3 | Cloud Functions consolidação | 🏗️ 3d | 🔴 | ~24.950 | **P2** |
| 2.2 | Prefetch por aba | 🔧 4h | 🟡 | ~20.000 | **P3** |
| 2.4 | Paginação em coleções grandes | 🔧 6h | 🟡 | ~12.000 | **P3** |
| 3.5 | Batch reads com `in` query | 🏗️ 4h | 🟡 | ~7.500 | **P3** |
| 2.3 | Normalizar períodos de relatórios | 🔧 3h | 🟡 | ~15.000 | **P3** |
| 3.4 | onSnapshot com metadata | 🏗️ 2h | 🟢 | ~3.500 | **P4** |
| 4.1 | enablePersistence | 🏢 2h | 🟡 | ~30.000 | **P4** |
| 4.4 | TTL Policy para logs | 🏢 1h | 🟢 | storage only | **P4** |
| 2.5 | Dashboard monitoramento | 🔧 4h | 🟢 | indireto | **P4** |
| 4.3 | Firestore Bundles | 🏢 3d | 🔴 | ~15.000 | **P5** |
| 4.2 | Firestore Lite SDK | 🏢 5d | 🟡 | ~10.000 | **P5** |
| 3.1 | Migrar para Realtime DB | 🏗️ 3d | ❌ | **NÃO recomendado** | — |

---

## 💰 Projeção de Economia Consolidada

### Cenário Conservador (apenas P1 + P2)

| Ação | Leituras Eliminadas/Dia |
|------|------------------------|
| Full collection reads eliminados | 65.000 |
| Dashboard TV visibilitychange | 30.000 |
| onSnapshot compartilhado | 16.750 |
| Invalidação de cache em writes | 22.500 |
| Dashboard TV reutilizar onSnapshot | 2.880 |
| Unificar polling | 8.640 |
| **Total eliminado** | **~145.770** |

| Métrica | Atual | Projetado |
|---------|-------|-----------|
| Leituras/dia | ~390.000 | ~244.230 |
| Leituras/mês | ~11.700.000 | ~7.327.000 |
| Custo/mês | ~$12-25 | ~$7-15 |
| **Redução** | — | **~37%** |

### Cenário Otimista (P1 + P2 + P3 + Cloud Functions)

| Métrica | Atual | Projetado |
|---------|-------|-----------|
| Leituras/dia | ~390.000 | ~130.000 |
| Leituras/mês | ~11.700.000 | ~3.900.000 |
| Custo/mês | ~$12-25 | ~$3-7 |
| **Redução** | — | **~67%** |

### Cenário Máximo (todas as ações)

| Métrica | Atual | Projetado |
|---------|-------|-----------|
| Leituras/dia | ~390.000 | ~60.000 |
| Leituras/mês | ~11.700.000 | ~1.800.000 |
| Custo/mês | ~$12-25 | ~$1-3 |
| **Redução** | — | **~85-90%** |

---

## 📈 Economia Acumulada Histórica

| Fase | Período | Antes | Depois | Redução |
|------|---------|-------|--------|---------|
| Original | — | 1.200.000/dia | — | — |
| Fase 1 — Duplicatas | Jan/2026 | 1.200.000 | 480.000 | -60% |
| Fase 2 — TTLs | Fev/2026 | 480.000 | 390.000 | -19% |
| Fase 3 — Cache controllers | Fev/2026 | 390.000 | 390.000 | (já contabilizado) |
| **Fase 4 — Este plano (P1-P2)** | **Próximo** | **390.000** | **~245.000** | **-37%** |
| **Fase 5 — Cloud Functions** | **Futuro** | **245.000** | **~130.000** | **-47%** |
| **TOTAL ACUMULADO** | | **1.200.000** | **~130.000** | **-89%** |

---

## 🔍 Inventário Completo — Coleções e Uso

| # | Coleção | Docs Est. | Readers | Writers | Full Reads | Cacheada |
|---|---------|-----------|---------|---------|------------|----------|
| 1 | `production_entries` | ~10.000+ | 13 files | 3 files | Não | ✅ Sim |
| 2 | `production_orders` | ~500+ | 7 files | 3 files | **4 locais** | ✅ Sim |
| 3 | `planning` | ~1.000+ | 9 files | 3 files | Não | ✅ Sim |
| 4 | `active_downtimes` | ~26 | 7 files | 3 files | **10 locais** | ✅ Sim |
| 5 | `downtime_entries` | ~5.000+ | 9 files | 2 files | Não | ✅ Sim |
| 6 | `extended_downtime_logs` | ~500+ | 3 files | 2 files | Não | ✅ Sim |
| 7 | `machine_priorities` | ~26 | 4 files | 1 file | **2 locais** | ✅ Sim |
| 8 | `rework_entries` | ~500+ | 2 files | 1 file | Não | ❌ Não |
| 9 | `system_logs` | ~50.000+ | 3 files | 1 file | Não | ❌ Não |
| 10 | `hourly_production_entries` | ~10.000+ | 1 file | 1 file | Não | ❌ Não |
| 11 | `quantity_adjustments` | ~200+ | 2 files | 1 file | Não | ❌ Não |
| 12 | `escalas_operadores` | ~100+ | 2 files | 1 file | Não | ❌ Não |
| 13 | `pmp_borra` | ~200+ | 2 files | 1 file | Não | ❌ Não |
| 14 | `pcp_messages` | ~50+ | 2 files | 1 file | Não | ❌ Não |
| 15 | `pcp_observations` | ~200+ | 1 file | 1 file | Não | ❌ Não |
| 16 | `absenteismo` | ~500+ | 1 file | 1 file | Não | ❌ Não |
| 17 | `acompanhamento_turno` | ~1.000+ | 1 file | 1 file | Não | ❌ Não |
| 18 | `acompanhamento_perdas` | ~500+ | 1 file | 1 file | Não | ❌ Não |
| 19 | `ferramentaria_moldes` | ~50+ | 1 file | 1 file | **1 local** | ✅ Sim |
| 20 | `ferramentaria_manutencoes` | ~200+ | 1 file | 1 file | Não (limit 20) | ❌ Não |
| 21 | `setups_maquinas` | ~500+ | 1 file | 1 file | Não | ❌ Não |
| 22 | `pmp_moido` | ~100+ | 1 file | 1 file | Não | ❌ Não |
| 23 | `pmp_sucata` | ~100+ | 1 file | 1 file | Não | ❌ Não |
| 24 | `oee_history` | ~1.000+ | 1 file | 1 file | Não | ❌ Não |
| 25 | `machine_schedule` | ~100+ | 1 file | 1 file | Não | ❌ Não |
| 26 | `batch_traceability` | ~500+ | 1 file | 1 file | Não | ❌ Não |
| 27 | `quality_records` | ~200+ | 1 file | 1 file | Não | ❌ Não |
| 28 | `process_events` | ~1.000+ | 1 file | 1 file | Não | ❌ Não |
| 29 | `derived_products` | ~100+ | 1 file | 1 file | Não | ❌ Não |

---

## ✅ Checklist de Implementação

### Fase 4A — Quick Wins (P1) — ⚡ ~4 horas ✅ CONCLUÍDO (Fev/2026)
- [x] Redirecionar full collection reads para funções de cache (1.1) — `.limit(500)` em `production_orders` (script.js, planning.controller, orders.controller, reports.controller, firebase-cache.service)
- [x] Dashboard TV: reutilizar dados do onSnapshot (1.2) — `_activeDowntimesSnapshotData` armazenado no handler, reutilizado em `loadRealTimeData` e `updateRealTimeActiveDowntimes`
- [x] Unificar polling duplicado de active_downtimes (1.3) — `planning.controller.js` usa variável separada `_planningDowntimesPolling`, não sobrescreve polling do script.js
- [x] Adicionar visibilitychange no Dashboard TV (1.4) — pausa/retoma `_dashboardTVPollInterval`
- [x] **EXTRA:** Intervalo de polling do Dashboard TV de 60s → 300s (5 minutos)

### Fase 4B — Estruturais (P2) — 🔧 ~2 dias
- [ ] Implementar write-invalidation wrapper (2.1)
- [ ] Converter polling de active_downtimes para onSnapshot compartilhado (3.2)
- [ ] Avaliar viabilidade de Cloud Functions (3.3)

### Fase 4C — Incrementais (P3) — 🔧 ~3 dias
- [ ] Prefetch de dados por aba (2.2)
- [ ] Normalizar períodos de cache em relatórios (2.3)
- [ ] Paginação em production_orders (2.4)
- [ ] Batch reads com `in` queries (3.5)

### Fase 4D — Avançadas (P4-P5) — 🏢 1+ semana
- [ ] Dashboard de monitoramento de consumo (2.5)
- [ ] `enablePersistence()` para cache offline (4.1)
- [ ] `onSnapshot` com `includeMetadataChanges` (3.4)
- [ ] TTL Policy para system_logs e hourly_production_entries (4.4)
- [ ] Avaliar Firestore Bundles para init (4.3)
- [ ] Avaliar Firestore Lite para abas read-only (4.2)

---

## ⚠️ Ações NÃO Recomendadas

| Ação | Motivo |
|------|--------|
| Migrar `active_downtimes` para Realtime Database | Custo por GB transferido é maior que custo por leitura para esta coleção (~26 docs, ~65KB) |
| Remover todos os `onSnapshot` | Listeners são eficientes para dados que mudam frequentemente — evitam polling |
| TTL muito curto no cache (< 60s) | Causa thrashing — mais leituras, não menos |
| Desabilitar cache do Firestore SDK | O cache local do SDK evita leituras em reconexões |

---

## 📚 Referências

- [OTIMIZACAO-LEITURAS-FIREBASE.md](OTIMIZACAO-LEITURAS-FIREBASE.md) — Histórico de otimizações implementadas
- [ANALISE-OTIMIZACAO-FIREBASE.md](ANALISE-OTIMIZACAO-FIREBASE.md) — Análise técnica completa
- [ESTUDO-LEITURAS-POR-ABA.md](ESTUDO-LEITURAS-POR-ABA.md) — Estudo de consumo por aba
- [Firestore Pricing](https://firebase.google.com/pricing) — Modelo de preços oficial
- [Firestore Best Practices](https://firebase.google.com/docs/firestore/best-practices) — Guia oficial

---

*Documento criado em Fevereiro/2026 — Sistema MES Hokkaido*
*Baseado em auditoria completa do código-fonte com 29 coleções e ~115 chamadas `.get()` identificadas*
