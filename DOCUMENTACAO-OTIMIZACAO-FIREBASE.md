# 📊 Documentação: Otimização de Leituras Firebase

**Sistema:** Hokkaido MES - Sistema de Monitoramento de Produção  
**Data:** Fevereiro 2026  
**Objetivo:** Reduzir custos do Firebase diminuindo o número de leituras

---

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Arquitetura de Cache](#arquitetura-de-cache)
3. [DataStore Centralizado](#datastore-centralizado)
4. [BatchQueryManager](#batchquerymanager)
5. [Funções de Leitura Cacheada](#funções-de-leitura-cacheada)
6. [Listeners Otimizados](#listeners-otimizados)
7. [Polling Otimizado](#polling-otimizado)
8. [Visibility API](#visibility-api)
9. [Monitor de Uso](#monitor-de-uso)
10. [Estimativa de Economia](#estimativa-de-economia)

---

## 1. Visão Geral

### Problema Identificado
O sistema estava realizando múltiplas leituras redundantes ao Firebase, principalmente:
- Leituras repetidas de `production_orders` em várias funções
- Polling frequente de `active_downtimes` (a cada 5 segundos)
- Falta de cache centralizado para dados já carregados por listeners
- Não aproveitamento de dados já em memória

### Solução Implementada
Sistema de cache em múltiplas camadas com:
- **DataStore centralizado** para dados de listeners
- **CacheManager** com TTL para consultas pontuais
- **BatchQueryManager** para agrupar queries
- **FirebaseMonitor** para acompanhamento de economia

---

## 2. Arquitetura de Cache

```
┌─────────────────────────────────────────────────────────────┐
│                    REQUISIÇÃO DE DADOS                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  NÍVEL 1: Cache Local (productionOrdersCache, etc.)         │
│  - Variáveis locais do script                               │
│  - Acesso mais rápido                                       │
└─────────────────────────────────────────────────────────────┘
                              │ miss
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  NÍVEL 2: DataStore                                         │
│  - Dados alimentados por listeners em tempo real            │
│  - Sempre atualizado quando há mudanças                     │
└─────────────────────────────────────────────────────────────┘
                              │ miss
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  NÍVEL 3: CacheManager                                      │
│  - Cache com TTL (60 segundos padrão)                       │
│  - Para consultas pontuais                                  │
└─────────────────────────────────────────────────────────────┘
                              │ miss
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  NÍVEL 4: Firebase Firestore                                │
│  - Leitura real do banco de dados                           │
│  - Resultado armazenado em todos os níveis acima            │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. DataStore Centralizado

**Localização:** `script.js` linhas 540-660

### O que é
Um objeto global que armazena dados carregados pelos listeners do Firestore, evitando que outras partes do código precisem fazer novas leituras.

### Estrutura
```javascript
const DataStore = {
    _data: {
        planning: null,
        productionOrders: null,
        productionEntries: null,
        activeDowntimes: null,
        extendedDowntimeLogs: null,
        downtimeEntries: null
    },
    _timestamps: {},      // Quando cada collection foi atualizada
    _subscribers: Map,    // Callbacks para notificar mudanças
    _readCounts: {}       // Contadores para monitoramento
};
```

### Métodos Principais

| Método | Descrição |
|--------|-----------|
| `get(collection)` | Retorna dados em memória |
| `set(collection, data)` | Armazena dados e notifica subscribers |
| `isFresh(collection, maxAgeMs)` | Verifica se dados são recentes |
| `subscribe(collection, callback)` | Registra callback para atualizações |
| `fetchIfNeeded(collection, query, force)` | Busca do Firebase apenas se necessário |
| `findById(collection, id)` | Busca item por ID no store |
| `filter(collection, predicate)` | Filtra dados localmente |

### Exemplo de Uso
```javascript
// Buscar do DataStore (sem ir ao Firebase)
const orders = window.DataStore.get('productionOrders');

// Buscar com verificação automática
const planning = await window.DataStore.fetchIfNeeded('planning');
```

---

## 4. BatchQueryManager

**Localização:** `script.js` linhas 665-730

### O que é
Agrupa múltiplas requisições de documentos individuais em uma única query usando o operador `in` do Firestore.

### Como Funciona
```javascript
// Ao invés de fazer 10 queries individuais:
// doc1.get(), doc2.get(), doc3.get()... 

// O BatchQueryManager agrupa em uma única query:
// collection.where(FieldPath.documentId(), 'in', [id1, id2, id3...]).get()
```

### Benefício
- **Antes:** 10 documentos = 10 leituras
- **Depois:** 10 documentos = 1 leitura (até 10 docs por batch)

### Exemplo de Uso
```javascript
// Buscar múltiplos documentos de forma otimizada
const doc1 = await BatchQueryManager.query('production_orders', 'id123');
const doc2 = await BatchQueryManager.query('production_orders', 'id456');
// Ambos são agrupados e executados juntos
```

---

## 5. Funções de Leitura Cacheada

**Localização:** `script.js` linhas 795-900

### getProductionOrdersCached(forceRefresh)

Função principal para buscar `production_orders` com cache em 3 níveis.

```javascript
async function getProductionOrdersCached(forceRefresh = false) {
    // NÍVEL 1: Cache local
    if (!forceRefresh && productionOrdersCache?.length > 0) {
        return productionOrdersCache;
    }
    
    // NÍVEL 2: DataStore
    if (!forceRefresh && window.DataStore) {
        const cached = window.DataStore.get('productionOrders');
        if (cached?.length > 0) return cached;
    }
    
    // NÍVEL 3: CacheManager
    if (!forceRefresh && window.CacheManager) {
        const cached = window.CacheManager.get('production_orders:all');
        if (cached) return cached;
    }
    
    // NÍVEL 4: Firebase (última opção)
    const snapshot = await db.collection('production_orders').get();
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Armazenar em todos os caches
    window.DataStore.set('productionOrders', data);
    window.CacheManager.set('production_orders:all', data);
    
    return data;
}
```

### getPlanningCached(date, forceRefresh)

Busca planejamentos com cache e filtro local por data.

```javascript
async function getPlanningCached(date = null, forceRefresh = false) {
    // Verificar DataStore
    const cached = window.DataStore.get('planning');
    if (cached?.length > 0) {
        // Filtrar por data LOCALMENTE (sem nova query)
        return date ? cached.filter(p => p.date === date) : cached;
    }
    
    // Buscar do Firebase se necessário
    // ...
}
```

### Funções Atualizadas para Usar Cache

| Função | Antes | Depois |
|--------|-------|--------|
| `loadOrdersAnalysis()` | `db.collection('production_orders').get()` | `getProductionOrdersCached()` |
| `loadPlanningOrders()` | `db.collection('production_orders').get()` | `getProductionOrdersCached()` |
| `loadProductionOrders()` | `db.collection('production_orders').get()` | `getProductionOrdersCached()` |
| `recalculateAllOrdersTotals()` | `db.collection('production_orders').get()` | `getProductionOrdersCached(true)` |
| `executeImportOrders()` | `db.collection('production_orders').get()` | `getProductionOrdersCached()` |

---

## 6. Listeners Otimizados

Os listeners do Firestore agora alimentam automaticamente o DataStore.

### listenToProductionOrders()
```javascript
listenerManager.subscribe('productionOrders', query,
    (snapshot) => {
        productionOrdersCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // ✅ NOVO: Alimenta o DataStore
        if (window.DataStore) {
            window.DataStore.set('productionOrders', productionOrdersCache);
        }
        
        // ... resto do código
    }
);
```

### listenToPlanningChanges()
```javascript
listenerManager.subscribe('planning', planningQuery,
    (snapshot) => {
        planningItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // ✅ NOVO: Alimenta o DataStore
        if (window.DataStore) {
            window.DataStore.set('planning', planningItems);
        }
        
        // ... resto do código
    }
);
```

### Production Entries Listener
```javascript
listenerManager.subscribe('productionEntries', entriesQuery,
    (snapshot) => {
        productionEntries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // ✅ NOVO: Alimenta o DataStore
        if (window.DataStore) {
            window.DataStore.set('productionEntries', productionEntries);
        }
        
        // ... resto do código
    }
);
```

---

## 7. Polling Otimizado

### Active Downtimes Polling

**Localização:** `script.js` linha 18224

| Parâmetro | Antes | Depois | Economia |
|-----------|-------|--------|----------|
| Intervalo | 5 segundos | 15 segundos | 67% menos leituras |
| Leituras/minuto | 12 | 4 | -8 leituras/min |
| Leituras/hora | 720 | 240 | -480 leituras/hora |

```javascript
// ANTES
window._activeDowntimesPolling = setInterval(pollActiveDowntimes, 5000);

// DEPOIS
window._activeDowntimesPolling = setInterval(pollActiveDowntimes, 15000);
```

### Outros Intervalos (já otimizados)

| Função | Intervalo | Status |
|--------|-----------|--------|
| `updateRealTimeOeeData` | 30 minutos | ✅ OK |
| `updateTimelineIfVisible` | 10 minutos | ✅ OK |
| SPC Monitoring | 15 minutos | ✅ OK |
| Predictive Analytics | 30 minutos | ✅ OK |

---

## 8. Visibility API

**Localização:** `script.js` linhas 410-430

### Como Funciona
Quando o usuário muda de aba no navegador, os listeners são pausados para economizar leituras.

```javascript
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        // Aba oculta - PAUSAR tudo
        console.log('👁️ Aba oculta - pausando listeners');
        listenerManager.pauseAll();
        
        // Pausar polling de downtimes
        if (window._activeDowntimesPolling) {
            clearInterval(window._activeDowntimesPolling);
            window._activeDowntimesPolling = null;
        }
    } else {
        // Aba visível - RETOMAR
        console.log('👁️ Aba visível - retomando listeners');
        listenerManager.resumeAll();
        
        // Retomar polling
        if (typeof window._startActiveDowntimesPolling === 'function') {
            window._startActiveDowntimesPolling();
        }
    }
});
```

### Benefício
Se o usuário deixar a aba aberta por 1 hora sem usar:
- **Antes:** ~720 leituras (downtimes) + listeners ativos
- **Depois:** 0 leituras (tudo pausado)

---

## 9. Monitor de Uso

**Localização:** `script.js` linhas 730-790

### FirebaseMonitor

Objeto global para acompanhar estatísticas de leitura em tempo real.

```javascript
const FirebaseMonitor = {
    _reads: 0,        // Leituras reais do Firebase
    _cacheHits: 0,    // Acessos ao cache
    _writes: 0,       // Escritas
    
    trackRead(collection, wasFromCache) {
        if (wasFromCache) {
            this._cacheHits++;
        } else {
            this._reads++;
        }
    },
    
    getStats() {
        return {
            reads: this._reads,
            cacheHits: this._cacheHits,
            hitRate: `${Math.round((this._cacheHits / total) * 100)}%`
        };
    }
};
```

### Como Usar

Abra o console do navegador (F12) e digite:

```javascript
fbstats()
```

**Saída esperada:**
```
📊 FIREBASE USAGE STATS
   ⏱️ Tempo de execução: 45 min
   🔥 Leituras Firebase: 23
   📦 Hits de cache: 156
   💰 Leituras economizadas: 156
   📈 Taxa de cache: 87%
   ✏️ Escritas: 12
```

---

## 10. Estimativa de Economia

### Cenário: 8 horas de uso contínuo

| Métrica | Antes | Depois | Economia |
|---------|-------|--------|----------|
| Downtimes polling | 5.760 reads | 1.920 reads | **67%** |
| getAllMachinesDowntimeStatus | ~90 reads/chamada | 2 reads/chamada | **98%** |
| production_orders | ~100 reads | ~10 reads | **90%** |
| planning | ~80 reads | ~8 reads | **90%** |
| **TOTAL ESTIMADO** | ~6.000 reads | ~2.000 reads | **~67%** |

### Impacto no Custo Firebase

Considerando o plano Blaze do Firebase:
- **Custo por 100.000 leituras:** ~$0.06
- **Economia mensal estimada (20 dias úteis, 8h/dia):**
  - Antes: ~960.000 leituras/mês
  - Depois: ~320.000 leituras/mês
  - **Economia: ~640.000 leituras/mês = ~$0.38/mês por usuário**

Para múltiplos usuários simultâneos, a economia é proporcional.

---

## 📝 Boas Práticas para Novas Funcionalidades

### ✅ FAÇA

```javascript
// Usar funções cacheadas
const orders = await getProductionOrdersCached();

// Verificar DataStore antes de buscar
const cached = window.DataStore.get('collection');
if (cached) return cached;

// Usar BatchQueryManager para múltiplos docs
const doc = await BatchQueryManager.query('collection', docId);
```

### ❌ NÃO FAÇA

```javascript
// Evitar .get() direto quando possível
const snapshot = await db.collection('production_orders').get();

// Evitar múltiplas queries individuais
for (const id of ids) {
    await db.collection('x').doc(id).get(); // ❌ Ruim
}
```

---

## 🔧 Comandos Úteis para Debug

| Comando | Descrição |
|---------|-----------|
| `fbstats()` | Mostra estatísticas de uso do Firebase |
| `window.DataStore.getStats()` | Estatísticas detalhadas do DataStore |
| `window.CacheManager._cache` | Ver conteúdo do cache |
| `window.FirebaseMonitor.reset()` | Resetar contadores |

---

## 📚 Arquivos Modificados

| Arquivo | Alterações |
|---------|------------|
| `script.js` | DataStore, BatchQueryManager, FirebaseMonitor, funções cacheadas |
| `script.js` | Listeners alimentando DataStore |
| `script.js` | Polling de downtimes 5s → 15s |
| `script.js` | Funções usando `getProductionOrdersCached()` |

---

**Última atualização:** Fevereiro 2026
