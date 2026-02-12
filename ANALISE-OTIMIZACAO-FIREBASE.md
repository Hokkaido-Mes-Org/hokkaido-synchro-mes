# 📊 Análise de Otimização - Leituras Firebase

**Data:** Fevereiro 2026  
**Sistema:** Hokkaido MES  

---

## 🔍 Resumo Executivo

### Problemas Identificados

| Problema | Impacto | Prioridade |
|----------|---------|------------|
| Leituras sem filtro (`.get()` completo) | **ALTO** - ~22 ocorrências | 🔴 Crítica |
| Cache existente mas não utilizado | **ALTO** - 100% das queries | 🔴 Crítica |
| Leituras duplicadas de `planning` | **MÉDIO** - 8+ chamadas | 🟡 Alta |
| Leituras duplicadas de `active_downtimes` | **MÉDIO** - 6+ chamadas | 🟡 Alta |
| Leituras duplicadas de `production_orders` | **MÉDIO** - 5+ chamadas | 🟡 Alta |

### Economia Potencial

| Cenário | Leituras/Dia Atual | Com Otimização | Redução |
|---------|-------------------|----------------|---------|
| Uso normal (10 usuários) | ~50.000 | ~5.000 | **90%** |
| Pico (fim de turno) | ~100.000 | ~10.000 | **90%** |
| **Custo mensal estimado** | ~$50-100 | ~$5-10 | **~$45-90** |

---

## 🔴 Problema 1: Leituras sem Filtro (CRÍTICO)

### Código Problemático

Múltiplas chamadas buscam coleções **INTEIRAS** quando poderiam usar filtros:

```javascript
// ❌ PROBLEMÁTICO - Busca TODOS os documentos
const snapshot = await db.collection('planning').get();                    // Linha 11019
const snapshot = await db.collection('production_orders').get();           // Linha 858
const snapshot = await db.collection('extended_downtime_logs').get();      // Linha 1001
const snapshot = await db.collection('active_downtimes').get();            // Linhas 21218, 33406, etc
```

### Localizações no script.js

| Coleção | Linhas | Quantidade |
|---------|--------|------------|
| `planning` | 11019, 11152, 11293, 11442, 11586, 11716, 11859, 17812, 37090 | 9 |
| `production_orders` | 858, 39885, 39972, 41777 | 4 |
| `active_downtimes` | 21218, 33406, 36592, 38432, 39066, 45652 | 6 |
| `extended_downtime_logs` | 1001 | 1 |
| `ferramentaria_moldes` | 46610 | 1 |
| `machine_priorities` | 45324 | 1 |

### Solução Recomendada

```javascript
// ✅ CORRETO - Usar filtros de data/status
const snapshot = await db.collection('planning')
    .where('date', '>=', startDate)
    .where('date', '<=', endDate)
    .get();

// ✅ MELHOR AINDA - Usar cache
const data = await getPlanningCached(date);
```

**Impacto:** Se `planning` tem 1000 docs e só precisa de 50 do dia atual:
- ❌ Sem filtro: 1000 leituras = ~$0.06
- ✅ Com filtro: 50 leituras = ~$0.003
- **Economia: 95%**

---

## 🔴 Problema 2: Sistema de Cache Não Utilizado (CRÍTICO)

### Estruturas de Cache Existentes (linhas 490-750)

✅ **CacheManager** - Implementado mas **nunca chamado**
✅ **DataStore** - Implementado mas **pouco usado**
✅ **BatchQueryManager** - Implementado mas **nunca chamado**

### Funções com Cache já Implementadas

```javascript
// Estas funções JÁ EXISTEM e usam cache:
getProductionOrdersCached(forceRefresh)     // ✅ Usada em 5 lugares
getPlanningCached(date, forceRefresh)       // ⚠️ Pouco usada
getProductionEntriesCached(date)            // ❌ Não usada
getExtendedDowntimesCached(forceRefresh)    // ❌ Não usada
```

### Onde NÃO estão sendo usadas (e deveriam)

| Função com Cache | Chamadas diretas sem cache |
|-----------------|---------------------------|
| `getProductionOrdersCached()` | db.collection('production_orders').get() em 4 lugares |
| `getPlanningCached()` | db.collection('planning').get() em 9 lugares |
| `getExtendedDowntimesCached()` | db.collection('extended_downtime_logs').get() em 1 lugar |

---

## 🟡 Problema 3: Leituras Duplicadas (ALTA PRIORIDADE)

### Cenário Típico

Quando usuário abre o sistema:
1. `loadProductionOrders()` → lê `production_orders` (**1.000 leituras**)
2. `loadPlanningTable()` → lê `planning` (**500 leituras**)
3. `renderMachineCards()` → lê `active_downtimes` (**30 leituras**)
4. `updateHeader()` → lê `production_orders` **NOVAMENTE** (**1.000 leituras**)
5. `loadAnalytics()` → lê `planning` **NOVAMENTE** (**500 leituras**)

**Total: 3.030 leituras quando poderiam ser 1.530**

### Solução: Centralizar Inicialização

```javascript
// ✅ PROPOSTA: Carregar dados uma vez e compartilhar
async function initializeAppData() {
    const [orders, planning, downtimes] = await Promise.all([
        getProductionOrdersCached(),
        getPlanningCached(today),
        getActiveDowntimesCached()
    ]);
    
    // Todas as funções usam os dados em memória
    DataStore.set('productionOrders', orders);
    DataStore.set('planning', planning);
    DataStore.set('activeDowntimes', downtimes);
}
```

---

## 📋 Plano de Implementação

### Fase 1: Quick Wins (2-4 horas) - Redução de 50%

**1.1 Substituir chamadas diretas por cached:**

```javascript
// ANTES (linha 11019)
const planSnapshot = await db.collection('planning').get();

// DEPOIS
const planData = await getPlanningCached();
```

**Arquivos para modificar:**
- script.js: linhas 11019, 11152, 11293, 11442, 11586, 11716, 11859, 17812, 37090

**1.2 Criar função `getActiveDowntimesCached()`:**

```javascript
async function getActiveDowntimesCached(forceRefresh = false) {
    if (!forceRefresh && window.DataStore) {
        const cached = window.DataStore.get('activeDowntimes');
        if (cached) return cached;
    }
    
    const snapshot = await db.collection('active_downtimes').get();
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    if (window.DataStore) {
        window.DataStore.set('activeDowntimes', data);
    }
    return data;
}
```

### Fase 2: Otimização de Queries (4-8 horas) - Redução adicional de 30%

**2.1 Adicionar filtros de data onde possível:**

```javascript
// Para funções que precisam de dados históricos
async function getPlanningForPeriod(startDate, endDate) {
    // Verificar cache local primeiro
    const cacheKey = `planning_${startDate}_${endDate}`;
    const cached = CacheManager.get(cacheKey);
    if (cached) return cached;
    
    // Query com filtro
    const snapshot = await db.collection('planning')
        .where('date', '>=', startDate)
        .where('date', '<=', endDate)
        .get();
    
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    CacheManager.set(cacheKey, data, 120000); // TTL 2 min
    
    return data;
}
```

**2.2 Usar índices compostos no Firestore:**

Criar no Firebase Console:
```
Collection: production_entries
Index: data (ASC), machine_id (ASC)

Collection: downtime_entries  
Index: date (ASC), machine_id (ASC), status (ASC)

Collection: planning
Index: date (ASC), machine_id (ASC)
```

### Fase 3: Arquitetura de Cache Inteligente (8-16 horas) - Redução adicional de 10%

**3.1 Implementar invalidação inteligente de cache:**

```javascript
// Quando salvar um documento, invalidar cache relacionado
async function saveProductionEntry(data) {
    await db.collection('production_entries').add(data);
    
    // Invalidar caches relacionados
    CacheManager.invalidate('production_entries');
    DataStore.set('productionEntries', null);
    
    // Notificar subscribers
    DataStore.notifyUpdate('productionEntries');
}
```

**3.2 Implementar prefetch de dados:**

```javascript
// Ao abrir uma aba, pré-carregar dados da próxima
function onTabChange(currentTab) {
    const nextTabs = getAdjacentTabs(currentTab);
    
    // Prefetch em background (sem bloquear)
    setTimeout(() => {
        nextTabs.forEach(tab => prefetchTabData(tab));
    }, 100);
}
```

---

## 📊 Métricas de Monitoramento

### Implementar Dashboard de Consumo

```javascript
// Já existe FirebaseMonitor, mas não está sendo exibido
// Adicionar na interface:
function showFirebaseStats() {
    const stats = window.FirebaseMonitor?.getStats() || DataStore.getStats();
    console.log('📊 Firebase Stats:', stats);
    
    // Mostrar no rodapé ou painel admin
    document.getElementById('firebase-stats')?.innerHTML = `
        Leituras: ${stats.total} | 
        Cache hits: ${stats.cacheHits || 0} |
        Taxa: ${((stats.cacheHits / stats.total) * 100).toFixed(1)}%
    `;
}
```

---

## 🎯 Próximos Passos Imediatos

### Ação 1: Substituir 6 maiores ofensores (1 hora)

As linhas que mais consomem leituras:

1. **Linha 11019** - `db.collection('planning').get()` → usar `getPlanningCached()`
2. **Linha 11152** - `db.collection('planning').get()` → usar `getPlanningCached()`
3. **Linha 858** - `db.collection('production_orders').get()` → usar `getProductionOrdersCached()`
4. **Linha 21218** - `db.collection('active_downtimes').get()` → criar e usar `getActiveDowntimesCached()`
5. **Linha 39885** - `db.collection('production_orders').get()` → usar `getProductionOrdersCached()`
6. **Linha 39972** - `db.collection('production_orders').get()` → usar `getProductionOrdersCached()`

### Ação 2: Criar `getActiveDowntimesCached()` (30 min)

Função mais chamada sem cache.

### Ação 3: Adicionar métricas visíveis (30 min)

Para monitorar economia em tempo real.

---

## 📈 Projeção de Economia

| Mês | Leituras Estimadas | Custo s/ Otim. | Custo c/ Otim. | Economia |
|-----|-------------------|----------------|----------------|----------|
| Mar/2026 | 1.500.000 | $90 | $15 | $75 |
| Abr/2026 | 1.500.000 | $90 | $12 | $78 |
| Mai/2026 | 1.500.000 | $90 | $10 | $80 |

**Economia anual projetada: ~$900**

---

## ✅ Checklist de Implementação

- [x] Criar `getActiveDowntimesCached()` ✅ Implementado
- [x] Criar `getDowntimeEntriesCached()` ✅ Implementado (NOVO)
- [x] Criar `getMachinePrioritiesCached()` ✅ Implementado
- [x] Substituir leituras diretas de `planning` (9 locais) ✅ Completo
- [x] Substituir leituras diretas de `production_orders` (4 locais) ✅ Completo
- [x] Substituir leituras diretas de `active_downtimes` (6 locais) ✅ Completo
  - script.js ✅
  - dashboard-tv.html (2 locais) ✅
  - admin-fix-downtime.html ✅
- [x] Substituir leituras diretas de `downtime_entries` ✅ admin-fix-downtime.html
- [x] Substituir leituras diretas de `machine_priorities` ✅ Completo
- [ ] Adicionar filtros de data onde aplicável (Fase 2)
- [ ] Criar índices compostos no Firebase Console (Fase 2)
- [ ] Implementar dashboard de monitoramento (Fase 3)
- [ ] Implementar invalidação de cache em writes (Fase 3)
- [x] Documentar novas funções de cache ✅ Funções globais expostas

---

*Documento gerado automaticamente - Sistema MES Hokkaido*
