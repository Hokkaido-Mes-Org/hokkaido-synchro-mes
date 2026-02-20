# Otimização de Leituras Firebase — Plano Executado

**Data:** 2025  
**Status:** ✅ Implementado  
**Objetivo:** Reduzir custos com leituras Firestore (estimativa: ~1,2M leituras/dia → ~400K/dia)

---

## Diagnóstico (antes das alterações)

| Métrica | Valor |
|---------|-------|
| Total `.get()` diretos | 157 chamadas no código |
| `onSnapshot` ativos simultâneos | 10 subscriptions |
| `setInterval` polling | 18 timers |
| `.collection()` referências | 407 |
| Estimativa leituras/turno/usuário | ~39.600 |
| Estimativa leituras/dia (10 users × 3 turnos) | ~1.188.000 |

### Maiores ofensores identificados

| # | Fonte | Coleção | Impacto estimado/turno/user |
|---|-------|---------|-----------------------------|
| 1 | `launchPlanning` (script.js) | planning (30 dias) | ~10.000 leituras |
| 2 | Listener duplicado `launchProductions` | production_entries | ~5.500 leituras |
| 3 | Polling `active_downtimes` (60s + 120s dual) | active_downtimes | ~3.600 leituras |
| 4 | Controllers sem cache (admin, analysis, monitoring) | vários | ~8.000 leituras |
| 5 | TTLs muito curtos (30s-120s) | vários | ~5.000 leituras |

---

## Alterações Implementadas

### Fase 1 — Eliminação de duplicatas (impacto: ~60% redução)

#### 1A. Listener `launchPlanning` — de 30 dias para hoje
- **Arquivo:** `script.js` (linha ~11656)
- **Antes:** `db.collection('planning').where('date', '>=', thirtyDaysAgoStr)` — carregava 30 dias
- **Depois:** `db.collection('planning').where('date', '==', date)` — carrega apenas hoje
- **Economia:** ~10.000 leituras/turno/usuário

#### 1B. Listener `launchProductions` — eliminado (duplicava `productionEntries`)
- **Arquivo:** `script.js` (linha ~11675)
- **Antes:** Listener `onSnapshot` separado em `production_entries` (idêntico ao `productionEntries`)
- **Depois:** Reutiliza dados do DataStore via `subscribe('productionEntries', ...)`
- **Economia:** ~5.500 leituras/turno/usuário (1 listener a menos)

#### 1C. Polling `active_downtimes` — unificado em 300s
- **Arquivos:** `script.js` (linha ~11281), `planning.controller.js` (linha ~2487)
- **Antes:** script.js polled a cada 120s, planning.controller.js a cada 60s
- **Depois:** Ambos em 300s (5 min), com pause/resume na visibilidade da aba
- **Economia:** ~3.600 leituras/turno/usuário

### Fase 2 — Aumento de TTLs (impacto: ~20% redução adicional)

| Componente | Antes | Depois | Arquivo |
|------------|-------|--------|---------|
| `BaseService.cacheTTL` | 60s | **120s** | `src/services/base.service.js` |
| `ActiveDowntimesService` | 30s | **120s** | `src/services/downtime.service.js` |
| `LogsService` | 30s | **300s** (5min) | `src/services/logs.service.js` |
| `StateManager.defaultTTL` | 120s | **300s** (5min) | `src/core/state-manager.js` |
| `CacheManager._ttl` | 180s | **300s** (5min) | `script.js` (linha ~712) |
| `DataStore.isFresh` default | 300s | **600s** (10min) | `script.js` (linha ~852) |
| `DataStore.fetchIfNeeded` | 180s | **300s** (5min) | `script.js` (linha ~899) |
| `getActiveDowntimesCached` | 120s | **300s** (5min) | `script.js` (linha ~1383) |
| `getDowntimeEntriesCached` | 120s | **300s** (5min) | `script.js` (linha ~1410) |
| OEE polling | 30min | **60min** | `script.js` (linha ~4410) |
| Timeline polling | 10min | **30min** | `script.js` (linha ~4413) |

### Fase 3 — Cache em controllers sem cache (impacto: ~15% redução)

#### monitoring.controller.js
- **Adicionado:** `cachedQuery()` helper com TTL 5min
- **Cacheados:** 9 queries diretas → 4 chaves de cache reutilizáveis
  - `production_entries` por data (2 queries → 1 cache hit)
  - `production_entries` por turno (6 queries → cache hit)
  - `planning` por data (1 query → cache hit)
  - `downtime_entries` por data (1 query → cache hit)

#### analysis.controller.js
- **Adicionado:** `cachedInlineQuery()` helper com TTL 5min
- **Cacheados:** Relatórios inline (Resumo, Eficiência, Paradas, Perdas, Produção)
- **Chaves compartilhadas:** `prod_${start}_${end}`, `down_${start}_${end}`, `losses_${start}_${end}`
- Relatórios com mesmo período reutilizam cache automaticamente

#### tooling.controller.js
- **Adicionado:** Cache para `ferramentaria_moldes` (full collection read) com TTL 5min
- **Antes:** Leitura completa da coleção a cada navegação para a aba

#### reports.controller.js
- **Adicionado:** `cachedRelQuery()` helper com TTL 5min
- **Cacheados:** 3 queries de relatórios (produção, perdas, paradas)
- Mudança de período no mesmo range reutiliza cache

---

## Estimativa de Impacto

| Métrica | Antes | Depois | Redução |
|---------|-------|--------|---------|
| Leituras/turno/usuário | ~39.600 | ~13.000 | **~67%** |
| Leituras/dia (10 × 3) | ~1.188.000 | ~390.000 | **~67%** |
| Listeners ativos simultâneos | 10 | **8** | -2 |
| Polling total (active_downtimes) | 60s + 120s | **300s** | -80% freq |
| Intervalo mín. entre leituras cache | 30s-60s | **120s-600s** | 4-10× mais lento |

### Decomposição da economia

| Alteração | Economia estimada/dia |
|-----------|----------------------|
| launchPlanning → hoje | ~300.000 leituras |
| launchProductions eliminado | ~165.000 leituras |
| Polling 300s unificado | ~108.000 leituras |
| TTLs aumentados (services+DataStore) | ~150.000 leituras |
| Cache em controllers | ~75.000 leituras |
| **Total** | **~798.000 leituras/dia** |

---

## Arquivos Modificados

| Arquivo | Tipo de alteração |
|---------|-------------------|
| `script.js` | Listeners, TTLs, polling |
| `src/controllers/planning.controller.js` | Polling interval |
| `src/controllers/monitoring.controller.js` | Cache helper + queries cacheadas |
| `src/controllers/analysis.controller.js` | Cache helper + queries inline cacheadas |
| `src/controllers/tooling.controller.js` | Cache para full collection read |
| `src/controllers/reports.controller.js` | Cache helper + queries cacheadas |
| `src/services/base.service.js` | TTL padrão |
| `src/services/downtime.service.js` | TTL ActiveDowntimes |
| `src/services/logs.service.js` | TTL Logs |
| `src/core/state-manager.js` | TTL padrão |

---

## Fase 4 — Quick Wins (Fev/2026) ✅

### 4A. Dashboard TV: reutilizar dados do onSnapshot
- **Arquivo:** `dashboard-tv.html`
- **Antes:** `loadRealTimeData` e `updateRealTimeActiveDowntimes` faziam `.get()` ou cache read de `active_downtimes` separadamente
- **Depois:** `onSnapshot` armazena dados em `_activeDowntimesSnapshotData`, reutilizado por ambas funções (0 leituras extras)
- **Economia:** ~2.880 leituras/dia por TV

### 4B. Dashboard TV: intervalo de polling 60s → 300s (5 min)
- **Arquivo:** `dashboard-tv.html`
- **Antes:** `setInterval(loadRealTimeData, 60000)` — refresh a cada 1 minuto
- **Depois:** `setInterval(loadRealTimeData, 300000)` — refresh a cada 5 minutos
- **Economia:** ~80% redução nas leituras de polling do Dashboard TV

### 4C. Dashboard TV: visibilitychange para pausar polling
- **Arquivo:** `dashboard-tv.html`
- **Adicionado:** `document.addEventListener('visibilitychange', ...)` — pausa/retoma `_dashboardTVPollInterval`
- **Economia:** evita leituras quando TV está com tela desligada ou navegador em background

### 4D. Unificar polling duplicado de active_downtimes
- **Arquivo:** `src/controllers/planning.controller.js`
- **Antes:** Sobrescrevia `window._startActiveDowntimesPolling` e registrava `visibilitychange` duplicado
- **Depois:** Usa variável separada `window._planningDowntimesPolling`, sem duplicar handler de visibilidade
- **Economia:** ~8.640 leituras/dia

### 4E. Limitar full collection reads de production_orders
- **Arquivos:** `script.js`, `planning.controller.js`, `orders.controller.js`, `reports.controller.js`, `firebase-cache.service.js`
- **Antes:** `db.collection('production_orders').orderBy('createdAt','desc').get()` — sem limit
- **Depois:** Adicionado `.limit(500)` em todos os pontos (listeners e fallbacks)
- **Economia:** Proporcional ao crescimento da coleção; evita leitura de OPs antigas desnecessárias

---

## Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| Dados desatualizados com TTLs maiores | Todas as ações de escrita (salvar, editar, excluir) usam `forceRefresh` ou invalidam cache específico |
| `launchPlanning` não mostrar planos antigos | Planos ativos de datas anteriores devem ser replanejados — comportamento correto |
| Polling 300s pode atrasar cards vermelhos de paradas | A detecção manual (botão registrar parada) é instantânea; apenas o card visual demora até 5min |
| Cache do reports.controller pode servir snapshot stale | TTL de 5min é aceitável para relatórios que são sob demanda |
| Dashboard TV 5min pode atrasar dados visuais | `onSnapshot` em `active_downtimes` atualiza paradas em tempo real; demais dados atualizam a cada 5min |
| `.limit(500)` em production_orders | Cobre amplamente o volume operacional; OPs muito antigas são irrelevantes para operação diária |

---

## Próximos passos (se necessário)

1. **Monitorar custos Firebase** por 1 semana para validar redução real
2. **Considerar Cloud Functions** para consolidar dados diários (elimina queries de range)
3. **Implementar `onSnapshot` com `includeMetadataChanges`** para evitar reads duplicados durante reconexão
4. **Indexar consultas compostas** no Firestore para reduzir scan de documentos
5. **Avaliar migração parcial para Realtime Database** para dados com alta frequência (active_downtimes)
6. ~~**Implementar invalidação de cache em writes** (Fase 4B do plano de ações)~~ ✅ Implementado (write-invalidation.js)
7. **Converter pollings de active_downtimes para onSnapshot compartilhado** (ação 3.2)

---

## Fase 4B — Otimizações Nível 2 (Fev/2026) ✅

### 4F. Write-Invalidation Wrapper (Ação 2.1)
- **Arquivo criado:** `src/utils/write-invalidation.js` (~175 linhas)
- **Função:** Mapa centralizado de 8 coleções → chaves de cache (DataStore, CacheManager, StateManager, EventBus)
- **API:** `invalidateCacheForCollection(collection, machineId)`, `invalidateAfterWrite(collection, writeFn, machineId)`, `getWriteInvalidationStats()`
- **Bootstrap:** Importado em `src/index.js`, bridge atualizado em `src/legacy/bridge.js` (collectionEventMap para eventos `*:changed`)
- **Economia:** Evita reloads desnecessários após writes — impacto proporcional ao volume de escritas

### 4G. Tab-Aware Prefetch (Ação 2.2)
- **Arquivo modificado:** `script.js` — `_prefetchCollections`
- **Antes:** Prefetch configurado para 5 de 14 abas
- **Depois:** Todas 14 abas mapeadas com coleções para prefetch (incluindo `downtime_entries` e `extended_downtime_logs` adicionados ao switch)
- **Economia:** Evita re-fetch de dados ao navegar entre abas; dados pré-carregados ficam no cache por 5min

### 4H. Shared Query Cache (Ação 2.3)
- **Arquivo criado:** `src/utils/shared-query-cache.js` (~100 linhas)
- **Integrações:** `analysis.controller.js` (`cachedInlineQuery` → sharedQueryCache), `reports.controller.js` (`cachedRelQuery` → sharedQueryCache)
- **Antes:** Cada controller tinha cache privado (Map) — mesmos dados do mesmo período eram duplicados
- **Depois:** Cache compartilhado singleton, TTL 300s, suporta invalidação por prefixo
- **Economia:** ~50% redução em queries duplicadas quando Analysis e Reports consultam mesmo período

### 4I. Monitor Firebase no Admin (Ação 2.5)
- **Arquivos modificados:** `index.html` (nova aba "Monitor Firebase" no admin), `admin.controller.js` (funções `setupFirebaseMonitor` + `renderFirebaseMonitor`)
- **Funcionalidade:** Painel com KPIs (total leituras, cache hit ratio, listeners ativos, write invalidations), tabela top coleções, status dos 3 caches (StateManager, SharedQueryCache, DataStore)
- **Impacto:** Visibilidade zero-code do consumo Firebase em tempo real

### Novos arquivos criados nesta fase:
| Arquivo | Linhas | Função |
|---------|--------|--------|
| `src/utils/write-invalidation.js` | ~175 | Invalidação de cache pós-escrita |
| `src/utils/shared-query-cache.js` | ~100 | Cache compartilhado cross-controller |

### Documentação criada:
- `docs/05-ANALISE-OTIMIZACAO/ESTIMATIVA-USO-POR-USUARIO.md` — Estimativa de consumo Firebase por perfil de usuário (5 perfis × 3 turnos)

---

## Fase 4B-N3 — Otimizações Nível 3: onSnapshot + Batch Reads (Fev/2026) ✅

### 4J. ActiveDowntimesLiveService — onSnapshot compartilhado (Ação 3.2)
- **Arquivo criado:** `src/services/active-downtimes-live.service.js` (~260 linhas)
- **Classe:** `ActiveDowntimesLiveService` — singleton `onSnapshot` listener para `active_downtimes`
- **API:** `start()`, `stop()`, `getData()`, `getForMachine(machineId)`, `hasData()`, `subscribe(fn)`, `stats()`
- **Funcionalidades:**
  - `includeMetadataChanges: true` — filtra `fromCache` para evitar leituras duplicadas (ação 3.4 integrada)
  - Auto-sync para DataStore, CacheManager e EventBus (`active_downtimes:updated`)
  - `visibilitychange`: pausa listener ao ocultar tab, retoma ao exibir
  - Error recovery: auto-restart após 30s em caso de erro
  - Tracking via `window.FirebaseMonitor`
- **Bootstrap:** `src/index.js` — `activeDowntimesLive.start()` após `initBridge()`
- **Integrações (7 arquivos, 12 locais):**
  - `script.js` — `getActiveDowntimesCached()`, `checkActiveDowntimes()`, `getActiveMachineDowntime()`, polling em `setupNewPlanningListeners()`
  - `src/controllers/planning.controller.js` — polling + `checkActiveDowntimes()`
  - `src/controllers/launch.controller.js` — `loadStandaloneActiveDowntimes()`, `showCardFinishDowntimeModal()`, `confirmCardFinishDowntime()`
  - `src/controllers/downtime-grid.controller.js` — `loadStandaloneActiveDowntimes()`, `showCardFinishDowntimeModal()`, `confirmCardFinishDowntime()`
- **Economia estimada:** ~16.750 leituras/dia (~97% redução em `active_downtimes`)
  - Antes: 2 pollings × 26 docs × 288 polls/dia = ~14.976 reads + ~2.300 reads on-demand
  - Depois: 26 reads iniciais + ~500 reads/dia (apenas docs alterados) + 0 reads on-demand

### 4K. includeMetadataChanges para evitar leituras em reconexão (Ação 3.4)
- **Integrado diretamente no ActiveDowntimesLiveService** (não é um componente separado)
- **Mecanismo:** `snapshot.metadata.fromCache` filtra re-emissões de cache local em reconexões
- **Economia estimada:** ~2.000-5.000 leituras/dia (dependendo da estabilidade da rede)

### 4L. Batch reads com `in` queries para `production_orders` (Ação 3.5)
- **Arquivos modificados:**
  - `script.js` — render dentro de `setupNewPlanningListeners()`: loop de N `.doc(orderId).get()` → batch `where(documentId(), 'in', chunk).get()` com chunks de 10
  - `src/controllers/planning.controller.js` — mesma refatoração: `Promise.all(N individuais)` → `Promise.all(ceil(N/10) chunks)`
- **Padrão:** Coleta IDs únicos → divide em chunks de 10 → `Promise.all` de queries `in` → mapeia resultados
- **Economia estimada:** Se N=26 máquinas, reduz de 26 leituras para 3 queries (ceil(26/10) = 3), economia de ~88% por render
- **Nota:** `BatchQueryManager` em `script.js` L955 já existia mas não era utilizado nestas funções

### Resumo de economia Nível 3:
| Ação | Economia/dia | % Redução |
|------|-------------|-----------|
| 3.2 onSnapshot compartilhado | ~16.750 reads | ~97% em `active_downtimes` |
| 3.4 includeMetadataChanges | ~2.000-5.000 reads | evita duplicatas em reconexão |
| 3.5 Batch reads `in` queries | ~5.000-10.000 reads | ~88% nos loops de `production_orders` |
| **Total Nível 3** | **~23.750-31.750 reads/dia** | — |

### Novos arquivos criados nesta fase:
| Arquivo | Linhas | Função |
|---------|--------|--------|
| `src/services/active-downtimes-live.service.js` | ~260 | onSnapshot compartilhado para `active_downtimes` |

---

## Fase 4D — Otimizações Arquiteturais Nível 4 (Fev/2026) ✅

### 4M. enablePersistence com synchronizeTabs (Ação 4.1)
- **Arquivos modificados:**
  - `script.js` (~L1510) — init principal do app
  - `dashboard-tv.html` (~L3057) — init da TV de chão de fábrica
  - `acompanhamento-turno.html` (~L480) — init do formulário de turno
- **Código:** `db.enablePersistence({ synchronizeTabs: true })`
- **Não aplicado em:** `admin-fix-downtime.html` (ferramenta diagnóstica com config dinâmica)
- **Comportamento:**
  - Firestore cacheia documentos localmente no IndexedDB
  - Em page reloads, dados são servidos do cache local primeiro (0 reads), depois sincronizados em background
  - `synchronizeTabs: true` permite que múltiplas abas compartilhem o mesmo cache
  - Se falhar (multiple tabs sem suporte, browser antigo), o app continua normalmente
- **Error handling:** Captura `failed-precondition` e `unimplemented` sem interromper o app
- **Economia estimada:** ~30-50% em leituras de page reload e reconexão (~117.000-195.000 reads/dia)

### 4N. TTL Policy para coleções de logs (Ação 4.4)
- **Status:** Campos `timestamp` (serverTimestamp) verificados em todos os writes — prontos para TTL
- **Configuração no Firebase Console:**
  1. Abrir [Firebase Console](https://console.firebase.google.com/) → Projeto Hokkaido
  2. Ir em **Firestore Database** → **TTL** (ou **Data retention**)
  3. Adicionar política para `system_logs`: campo `timestamp`, retenção **90 dias**
  4. Adicionar política para `hourly_production_entries`: campo `timestamp`, retenção **30 dias**

  | Coleção | Campo TTL | Retenção | Docs antigos removidos |
  |---------|-----------|----------|------------------------|
  | `system_logs` | `timestamp` | 90 dias | ~50.000+ |
  | `hourly_production_entries` | `timestamp` | 30 dias | ~10.000+ |

- **⚠️ ATENÇÃO:** Dados removidos pelo TTL são permanentemente deletados.

### 4O. Avaliação: Firestore Lite SDK (Ação 4.2) — ❌ BLOQUEADO
- Codebase usa Firebase v8 compat SDK via CDN. Firestore Lite requer v9+ modular SDK.
- Pré-requisito: migração completa do SDK (1-2 semanas). Não justificado pelo ganho (~10% leituras).

### 4P. Avaliação: Firestore Bundles (Ação 4.3) — ❌ NÃO RECOMENDADO
- Requer Cloud Functions + CDN + deploy pipeline + monitoramento. Custo-benefício desfavorável.
- O `enablePersistence()` (4.1) já resolve o problema de inicialização — dados no IndexedDB local.

### Resumo de economia Nível 4:
| Ação | Economia/dia | Status |
|------|-------------|--------|
| 4.1 enablePersistence | ~117.000-195.000 reads | ✅ Implementado |
| 4.4 TTL Policy | storage + query speed | 📋 Config Console pendente |
| 4.2 Firestore Lite | — | ❌ Bloqueado (requer v9 SDK) |
| 4.3 Firestore Bundles | — | ❌ Não recomendado |

