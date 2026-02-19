# HOKKAIDO MES — RAG Reference Document

> **Propósito**: Documento de referência para assistentes AI que trabalham neste codebase.
> Reduz alucinações, tokens e tempo ao fornecer contexto pré-digerido e verificado.
> **Última atualização**: Junho 2025 · **Commit base**: `31d1a6a`

---

## 1. Visão Geral do Projeto

| Campo | Valor |
|-------|-------|
| **Nome** | HokkaidoMES (Hokkaido Synchro MES) |
| **Tipo** | Manufacturing Execution System — indústria de injeção plástica |
| **Stack** | HTML5 + Vanilla JS (ES6 modules + legacy monolith) + Firebase Firestore + TailwindCSS + Chart.js + Lucide Icons |
| **Repositório** | `hokkaidoplasticsfirebase/hokkaido-synchro-mes.git` · branch `main` |
| **Deploy** | Firebase Hosting |
| **Arquitetura** | SPA híbrida — `script.js` (legacy monolith ~19k linhas) + sistema modular ES6 (`src/`) |

---

## 2. Arquitetura

### 2.1 Fluxo de Inicialização

```
index.html
  ├─ <script src="script.js">          ← Legacy: Firebase init, DataStore, CacheManager, UI handlers
  ├─ <script src="auth.js">            ← AuthSystem (login/logout, roles, tab permissions)
  ├─ <script src="database.js">        ← productDatabase[], machineDatabase[], rawMaterialDatabase
  ├─ <script src="advanced-kpis.js">   ← KPI calculations
  ├─ <script src="auto-pareto-analysis.js"> ← Pareto analysis
  ├─ <script src="erp-import.js">      ← ERP import
  ├─ <script src="machine-queue.js">   ← Machine queue
  ├─ <script src="machine-schedule.js">← Machine scheduling
  ├─ <script src="traceability-system.js"> ← Batch traceability
  └─ <script type="module" src="src/index.js"> ← ES6 bootstrap (aguarda legacy, inicia bridge)
       └─ bridge.js → syncLegacyToModern() + exposeServicesToGlobal()
```

### 2.2 Padrão Bridge (src/legacy/bridge.js)

O bridge sincroniza dados do `DataStore` (legacy) para o `StateManager` (modular) e expõe serviços no `window`:
- **Legacy → Modern**: Copia collections do DataStore para StateManager
- **Modern → Legacy**: Escuta EventBus e invalida DataStore
- **Collections sincronizadas**: `planning`, `productionOrders`, `productionEntries`, `activeDowntimes`, `extendedDowntimeLogs`, `downtimeEntries`

### 2.3 Feature Flags (src/config/feature-flags.js)

Todas as flags `USE_MODULAR_*` estão `true`. Controllers totalmente migrados para ES modules.

```js
// NÃO alterar — flags servem como circuit breakers
USE_MODULAR_LAUNCH: true
USE_MODULAR_PLANNING: true
USE_MODULAR_ORDERS: true
USE_MODULAR_ANALYSIS: true
USE_MODULAR_DOWNTIME: true
USE_MODULAR_MONITORING: true
USE_MODULAR_HISTORICO: true
USE_MODULAR_ADMIN: true
USE_MODULAR_REPORTS: true
USE_MODULAR_LEADERSHIP: true
USE_MODULAR_SETUP: true
USE_MODULAR_TOOLING: true
USE_MODULAR_PCP: true
USE_MODULAR_PMP: true
```

---

## 3. Mapa de Arquivos (60 arquivos)

### 3.1 Arquivos raiz (scripts carregados via `<script>`)

| Arquivo | Linhas | Descrição |
|---------|--------|-----------|
| script.js | ~19.000 | **Legacy monolith** — Firebase init, DataStore/CacheManager, event listeners, navegação, utilities |
| auth.js | ~494 | AuthSystem — login/logout, roles, tab permissions (canAccessTab) |
| database.js | ~1.839 | productDatabase[], machineDatabase[], rawMaterialDatabase |
| advanced-kpis.js | ~437 | Cálculos avançados de KPI |
| auto-pareto-analysis.js | ~1.046 | Análise de Pareto automática |
| erp-import.js | ~1.016 | Importação ERP |
| machine-queue.js | ~648 | Fila de máquinas |
| machine-schedule.js | ~622 | Agendamento de máquinas |
| traceability-system.js | ~1.202 | Rastreabilidade de lotes |
| style.css | ~1.154 | Stylesheet principal |
| service-worker.js | ~20 | Service worker básico |
| materia-prima-database.js | ~94 | Banco de matéria-prima |

### 3.2 HTML

| Arquivo | Linhas | Descrição |
|---------|--------|-----------|
| index.html | ~8.090 | SPA principal — contém 13 containers de página |
| login.html | — | Página de login |
| dashboard-tv.html | ~5.550 | Dashboard TV standalone para chão de fábrica |
| acompanhamento-turno.html | — | Acompanhamento de turno (standalone) |
| admin-fix-downtime.html | ~382 | Ferramenta admin para correção de paradas |

### 3.3 Módulos ES6 (src/)

#### Core

| Módulo | Linhas | API principal |
|--------|--------|---------------|
| src/index.js | 92 | Bootstrap: aguarda legacy → initBridge → importa controllers |
| src/core/state-manager.js | 144 | `get(key)`, `set(key, data)`, `isFresh(key, ttl)`, `getIfFresh(key, ttl)`, `invalidate(key)` |
| src/core/event-bus.js | 127 | `on(event, cb)→unsub`, `once()`, `emit(event, data)`, `off()`, `clear()` |
| src/core/listener-manager.js | 103 | Gerenciamento de Firestore listeners |
| src/legacy/bridge.js | 129 | `initBridge()` — sync DataStore↔StateManager |
| src/config/feature-flags.js | 49 | Feature flags (todas true) |

#### Services

| Módulo | Linhas | Descrição |
|--------|--------|-----------|
| src/services/base.service.js | 337 | Classe base para todos os services |
| src/services/firebase-client.js | 100 | `getDb()`, `serverTimestamp()`, `increment(n)`, `arrayUnion()`, `deleteField()`, `createBatch()`, `runTransaction(fn)` |
| src/services/firebase-cache.service.js | 170 | Cache layer Firebase |
| src/services/production.service.js | 88 | CRUD de produção |
| src/services/downtime.service.js | 206 | CRUD de paradas |
| src/services/downtime-shift.service.js | 454 | Serviço de paradas por turno |
| src/services/orders.service.js | 88 | CRUD de ordens |
| src/services/planning.service.js | 79 | CRUD de planejamento |
| src/services/logs.service.js | 64 | Serviço de logs do sistema |

#### Controllers (1 por página/tab)

| Módulo | Linhas | Slug de navegação |
|--------|--------|-------------------|
| src/controllers/launch.controller.js | 3.820 | `lancamento` |
| src/controllers/analysis.controller.js | 8.848 | `analise` |
| src/controllers/planning.controller.js | 2.524 | `planejamento` |
| src/controllers/admin.controller.js | 3.849 | `admin-dados` |
| src/controllers/extended-downtime.controller.js | 1.710 | `paradas-longas` |
| src/controllers/pcp.controller.js | 1.127 | `pcp` |
| src/controllers/orders.controller.js | 1.020 | `ordens` |
| src/controllers/downtime-grid.controller.js | 1.004 | (sub-view) |
| src/controllers/pmp.controller.js | 780 | `pmp` |
| src/controllers/monitoring.controller.js | 759 | `acompanhamento` |
| src/controllers/leadership.controller.js | 672 | `lideranca-producao` |
| src/controllers/dashboard.controller.js | 595 | `dashboard` |
| src/controllers/resumo.controller.js | 576 | `resumo` |
| src/controllers/setup.controller.js | 483 | `setup-maquinas` |
| src/controllers/reports.controller.js | 464 | `relatorios` |
| src/controllers/tooling.controller.js | 334 | `ferramentaria` |
| src/controllers/historico.controller.js | 313 | `historico-sistema` |

#### Utils

| Módulo | Linhas | Funções principais |
|--------|--------|-------------------|
| src/utils/color.utils.js | 270 | Paletas de cores, gradientes |
| src/utils/auth.utils.js | 179 | Helpers de autenticação |
| src/utils/date.utils.js | 143 | Formatação de datas, cálculos de turno |
| src/utils/number.utils.js | 104 | Formatação numérica |
| src/utils/dom.utils.js | 54 | Helpers DOM |
| src/utils/product.utils.js | 53 | Helpers de produto |
| src/utils/plan.utils.js | 53 | Helpers de planejamento |
| src/utils/logger.js | 67 | Logger com níveis |

#### Components

| Módulo | Linhas | Descrição |
|--------|--------|-----------|
| src/components/cache-dashboard.js | 45 | Dashboard de monitoramento de cache |
| src/components/notification.js | 41 | Componente de notificação |

---

## 4. Sistema de Navegação

### 4.1 Controller Registry (script.js ~linha 9039)

A SPA usa um registro de controllers que mapeia slugs de página para módulos ES6:

```js
_controllerRegistry = {
  'lancamento':         { path: './controllers/launch.controller.js',            setup: 'setupLancamentoPage' },
  'planejamento':       { path: './controllers/planning.controller.js',          setup: 'setupPlanejamentoPage' },
  'ordens':             { path: './controllers/orders.controller.js',            setup: 'setupOrdensPage' },
  'analise':            { path: './controllers/analysis.controller.js',          setup: 'setupAnalisePage', pre: 'setupProductionOrdersTab' },
  'paradas-longas':     { path: './controllers/extended-downtime.controller.js', setup: 'setupExtendedDowntimePage' },
  'acompanhamento':     { path: './controllers/monitoring.controller.js',        setup: 'setupAcompanhamentoPage' },
  'historico-sistema':  { path: './controllers/historico.controller.js',         setup: 'setupHistoricoPage' },
  'admin-dados':        { path: './controllers/admin.controller.js',             setup: 'setupAdminDadosPage' },
  'relatorios':         { path: './controllers/reports.controller.js',           setup: 'setupRelatoriosPage' },
  'lideranca-producao': { path: './controllers/leadership.controller.js',        setup: 'setupLiderancaProducaoPage' },
  'setup-maquinas':     { path: './controllers/setup.controller.js',             setup: 'setupSetupMaquinasPage' },
  'ferramentaria':      { path: './controllers/tooling.controller.js',           setup: 'setupFerramentariaPage' },
  'pcp':                { path: './controllers/pcp.controller.js',               setup: 'setupPCPPage' },
  'pmp':                { path: './controllers/pmp.controller.js',               setup: 'setupPMPPage' },
}
```

### 4.2 Slugs de Página (data-page)

Os 13 slugs usados em `index.html` como atributo `data-page`:
`acompanhamento`, `admin-dados`, `analise`, `ferramentaria`, `historico-sistema`, `lancamento`, `lideranca-producao`, `ordens`, `pcp`, `planejamento`, `pmp`, `relatorios`, `setup-maquinas`

---

## 5. Firebase Firestore

### 5.1 Collections (31)

| Collection | Uso principal |
|------------|---------------|
| `absenteismo` | Registro de absenteísmo |
| `acompanhamento_perdas` | Acompanhamento de perdas |
| `acompanhamento_turno` | Acompanhamento por turno |
| `active_downtimes` | Paradas ativas (em tempo real) |
| `batch_traceability` | Rastreabilidade de lotes |
| `daily_planning` | Planejamento diário |
| `derived_products` | Produtos derivados |
| `downtime_entries` | Histórico de paradas encerradas |
| `escalas_operadores` | Escalas de operadores |
| `extended_downtime_logs` | Logs de paradas prolongadas |
| `ferramentaria_manutencoes` | Manutenções de ferramentaria |
| `ferramentaria_moldes` | Cadastro de moldes |
| `hourly_production_entries` | Produção horária |
| `machine_priorities` | Prioridades de máquinas |
| `machine_schedule` | Agenda de máquinas |
| `oee_history` | Histórico de OEE |
| `pcp_messages` | Mensagens PCP |
| `pcp_observations` | Observações PCP |
| `planning` | Planejamento (principal) |
| `pmp_borra` | PMP — borra |
| `pmp_moido` | PMP — moído |
| `pmp_sucata` | PMP — sucata |
| `process_events` | Eventos de processo |
| `production_entries` | Lançamentos de produção |
| `production_orders` | Ordens de produção |
| `products` | Cadastro de produtos (Firestore) |
| `quality_records` | Registros de qualidade |
| `quantity_adjustments` | Ajustes de quantidade |
| `rework_entries` | Entradas de retrabalho |
| `setups_maquinas` | Setups de máquinas |
| `system_logs` | Logs do sistema |

### 5.2 Padrões de Acesso ao Firestore

```js
// ✅ CORRETO — Via DataStore (legacy, mais comum)
const data = DataStore.get('collection_name');

// ✅ CORRETO — Via CacheManager com TTL
const cached = await CacheManager.get('key', fetchFunction, ttlMs);

// ✅ CORRETO — Via cached getters (expostos no window)
const planning = await getPlanningCached();
const entries  = await getProductionEntriesCached();
const active   = await getActiveDowntimesCached();
const orders   = await getProductionOrdersCached();

// ✅ CORRETO — Via serviços modulares
const entries = await window.services.production.getEntries(date);

// ❌ ERRADO — Acesso direto sem cache
const snapshot = await db.collection('production_entries').get(); // Evitar!
```

### 5.3 Estrutura de Documentos Comuns

**production_entries** (lançamentos de produção):
```js
{
  machine: "H01",           // ID normalizado
  productCode: 12345,       // Código do produto
  quantity: 500,             // Quantidade produzida
  date: "2025-06-15",       // Data de produção (YYYY-MM-DD)
  turno: "T1",              // T1, T2 ou T3
  operator: "Nome",         // Nome do operador
  timestamp: Timestamp,     // Firebase server timestamp
  productionDate: "2025-06-15" // Data de trabalho (pode diferir da data real p/ T3)
}
```

**active_downtimes** (paradas ativas):
```js
{
  machine: "H01",
  reason: "Manutenção mecânica",
  startTime: Timestamp,
  operator: "Nome",
  type: "parada"             // "parada" ou "setup"
}
```

**downtime_entries** (paradas finalizadas):
```js
{
  machine: "H01",
  reason: "Manutenção mecânica",
  startTime: Timestamp,
  endTime: Timestamp,
  duration: 45,              // minutos
  date: "2025-06-15",
  turno: "T1",
  operator: "Nome"
}
```

---

## 6. Turnos e Data de Produção

### 6.1 Definição dos Turnos

| Turno | Início | Fim | Observação |
|-------|--------|-----|------------|
| **T1** | 06:30 | 14:59 | Primeiro turno |
| **T2** | 15:00 | 23:19 | Segundo turno |
| **T3** | 23:20 | 06:29 | Terceiro turno (cruza meia-noite) |

### 6.2 Data de Produção (Work Day)

- **Fronteira do dia**: 06:30
- Antes de 06:30 → pertence ao dia **anterior** (T3 do dia anterior)
- A partir de 06:30 → pertence ao dia **atual**
- Funções: `getDataProducaoAtual()`, `getProductionDateString()`, `getWorkDay()`, `getWorkDayFromTimestamp()`

```js
// Exemplo: 2025-06-16 às 02:00 → data de produção = "2025-06-15" (T3 do dia anterior)
// Exemplo: 2025-06-16 às 07:00 → data de produção = "2025-06-16" (T1 do dia atual)
```

---

## 7. Máquinas

### 7.1 Lista de Máquinas (26 unidades)

**IDs válidos**: H01, H02, H03, H04, H05, H06, H07, H08, H09, H10, H12, H13, H14, H15, H16, H17, H18, H19, H20, H26, H27, H28, H29, H30, H31, H32

> **ATENÇÃO**: Não existem H11, H21, H22, H23, H24, H25.

### 7.2 Modelos por Máquina

| Máquinas | Modelo |
|----------|--------|
| H01, H02, H14 | Sandretto |
| H03, H04, H05 | LS |
| H06, H10, H13, H16, H18, H19, H20 | Haitian |
| H07 | Chen Hsong |
| H08, H09 | Reed |
| H12 | Borche |
| H15, H17, H26-H32 | Romi |

### 7.3 Normalização de ID

Sempre use `normalizeMachineId(id)` para garantir formato "H01" (com zero à esquerda):
```js
normalizeMachineId("h1")  → "H01"
normalizeMachineId("H01") → "H01"
normalizeMachineId("1")   → "H01"
```

---

## 8. Autenticação e Autorização

### 8.1 Roles

| Role | Descrição |
|------|-----------|
| `admin` | Administrador |
| `gestor` | Gestor de produção |
| `suporte` | Suporte técnico (acesso total) |
| `pcp` | Planejamento e Controle de Produção |
| `operador` | Operador de máquina |
| `viewer` | Somente leitura |
| `lider` | Líder de produção |

### 8.2 Sessão

- **"Manter conectado"** → `localStorage` (expira em 24h)
- **Sem manter** → `sessionStorage` (expira em 8h)

### 8.3 Permissões por Tab

O sistema usa `canAccessTab(tabName)` com regras por nome de usuário e role. Tabs como `pmp`, `pcp`, `historico-sistema`, `admin-dados`, `acompanhamento` têm listas de usuários autorizados.

---

## 9. Globals Expostos no Window

### 9.1 Dados e Cache

```
window.db                          — Instância Firestore
window.DataStore                   — Cache de dados legacy
window.CacheManager                — Cache manager com TTL
window.BatchQueryManager           — Agrupador de queries
window.FirebaseMonitor             — Monitor de uso Firebase
```

### 9.2 Cached Getters

```
window.getPlanningCached()
window.getProductionEntriesCached()
window.getActiveDowntimesCached()
window.getDowntimeEntriesCached()
window.getExtendedDowntimesCached()
window.getProductionOrdersCached()
window.getMachinePrioritiesCached()
```

### 9.3 Data/Turno

```
window.getTurnoAtual()             — Retorna "T1", "T2" ou "T3"
window.getDataProducaoAtual()      — Retorna "YYYY-MM-DD" conforme work day
window.getProductionDateString()   — Alias
window.getWorkDay()                — Retorna work day
window.getWorkDayFromTimestamp()   — Work day a partir de timestamp
```

### 9.4 Máquinas

```
window.normalizeMachineId(id)      — Normaliza para "H01"
window.populateMachineSelector(el) — Preenche <select> com máquinas
window.machineCardData             — Dados dos cards de máquina
```

### 9.5 Produção

```
window.resolveProductionDateTime() — Resolve data/turno de produção
window.normalizeToDate()           — Normaliza para Date
window.loadRecentEntries()         — Carrega lançamentos recentes
window.loadLaunchPanel()           — Carrega painel de lançamento
window.renderMachineCards()        — Renderiza cards de máquina
```

### 9.6 Paradas

```
window.checkActiveDowntimes()      — Verifica paradas ativas
window.finalizarParada()           — Finaliza parada
window.forceStopDowntime()         — Força parada
window.invalidateDowntimeCache()   — Invalida cache de paradas
window.downtimeTimers              — Timers de paradas ativas
```

### 9.7 UI

```
window.showNotification(msg, type) — type: 'success'|'error'|'warning'|'info'
window.showConfirmModal(opts)      — Modal de confirmação
window.openModal(id)               — Abre modal por ID
window.closeModal(id)              — Fecha modal por ID
window.showLoadingState(el, show)  — Indicador de carregamento
```

### 9.8 Auth e Logs

```
window.getCurrentUserName()
window.logSystemAction(action, details)
```

### 9.9 Módulos (via bridge)

```
window.services.production         — ProductionService
window.services.downtime           — DowntimeService
window.services.planning           — PlanningService
window.services.orders             — OrdersService
window.services.logs               — LogsService
window.EventBus                    — EventBus
window.stateManager                — StateManager
```

---

## 10. Produto (database.js)

### 10.1 Schema

```js
{
  cod: number,           // Código do produto (ex: 12345)
  client: string,        // Nome do cliente (ex: "SILGAN")
  name: string,          // Nome do produto
  cavities: number,      // Número de cavidades do molde
  cycle: number,         // Tempo de ciclo em segundos
  weight: number,        // Peso da peça em gramas
  pieces_per_hour_goal: number, // Meta de peças/hora
  mp: string             // Código da matéria-prima
}
```

### 10.2 Acesso

```js
// Via Map (mais eficiente)
const product = window.productByCode.get(12345);

// Via array
const product = productDatabase.find(p => p.cod === 12345);

// Via módulo
const product = window.databaseModule?.productByCode?.get(12345);
```

---

## 11. Preparadores (Setup Technicians)

Daniel, João, Luis, Manaus, Rafael, Stanley, Wagner, Yohan

---

## 12. Padrões de Código e Convenções

### 12.1 Regras Críticas

1. **NUNCA remova funções do `script.js` que estão expostas no `window.*`** — outros arquivos dependem delas
2. **NUNCA altere feature flags para `false`** — são circuit breakers, não toggles de desenvolvimento
3. **SEMPRE use `normalizeMachineId()`** ao trabalhar com IDs de máquina
4. **SEMPRE considere o work day** (boundary 06:30) ao filtrar por data
5. **SEMPRE use `getDataProducaoAtual()`** em vez de `new Date().toISOString().split('T')[0]`
6. **NUNCA faça queries Firestore sem cache** — use `CacheManager`, `DataStore` ou cached getters
7. **NUNCA adicione `orderBy` em queries sem verificar se o índice composto existe** no Firebase Console

### 12.2 Controller Pattern

```js
// src/controllers/example.controller.js
import { getDb, serverTimestamp } from '../services/firebase-client.js';

let initialized = false;

export async function setupExamplePage() {
    if (initialized) return;
    initialized = true;
    
    // Acessar globals legacy via window.*
    const db = getDb();
    const turno = window.getTurnoAtual();
    const date = window.getDataProducaoAtual();
    
    // ... lógica do controller
}
```

### 12.3 EventBus Events Comuns

```
state:planning:updated
state:planning:invalidated
state:productionOrders:updated
state:productionEntries:updated
state:activeDowntimes:updated
state:downtimeEntries:updated
state:extendedDowntimeLogs:updated
downtime_entries:deleted
```

### 12.4 StateManager TTL

TTL padrão: **5 minutos (300.000ms)**. O StateManager descarta dados stale automaticamente.

---

## 13. Pitfalls Conhecidos (Anti-Hallucination)

| # | Pitfall | Correção |
|---|---------|----------|
| 1 | Assumir que H11, H21-H25 existem | NÃO existem. Apenas H01-H10, H12-H20, H26-H32 |
| 2 | Usar `new Date()` para data de produção | Usar `getDataProducaoAtual()` — T3 cruza meia-noite |
| 3 | Fazer query com `orderBy` + `where` | Requer índice composto no Firebase. Verifique antes |
| 4 | Criar funções duplicadas que já existem no window | Verificar globals na seção 9 antes de criar |
| 5 | Editar `script.js` sem buscar contexto | Arquivo de ~19k linhas — sempre busque a seção específica |
| 6 | Assumir que collections Firestore usam camelCase | Usam **snake_case**: `production_entries`, `active_downtimes` |
| 7 | Ignorar o bridge ao adicionar nova funcionalidade | Se modifica dados compartilhados, o bridge precisa ser notificado |
| 8 | Confundir `turno` com `shift` no código | O código usa "turno" (PT-BR): T1, T2, T3 |
| 9 | Usar `db.collection('products')` para buscar produto por código | Use `productByCode.get(code)` do database.js — não é do Firestore |
| 10 | Achar que `productDatabase` vem do Firestore | Vem de `database.js` — é hardcoded/local |
| 11 | Esquecer que `analysis.controller.js` tem 8.848 linhas | É o maior controller — mudanças precisam de contexto cuidadoso |
| 12 | Assumir que roles seguem padrão RBAC puro | Tab access usa combinação de role + nome do usuário |

---

## 14. Checklist para Mudanças

Antes de qualquer alteração, verifique:

- [ ] Qual arquivo será modificado? (verificar tamanho e seção)
- [ ] Há funções globais (`window.*`) afetadas?
- [ ] Precisa atualizar o bridge?
- [ ] Afeta alguma collection Firestore? (verificar cache/DataStore)
- [ ] Respeita o work day (06:30 boundary)?
- [ ] Usa `normalizeMachineId()` para IDs de máquina?
- [ ] Precisa de índice composto no Firestore?
- [ ] É controller? Seguiu o pattern da seção 12.2?
- [ ] Há testes manuais necessários para validar?

---

## 15. Histórico de Commits Relevantes

| Hash | Descrição |
|------|-----------|
| `31d1a6a` | fix: historico — remover orderBy que requeria índice composto |
| `3ced373` | fix: dashboard TV — responsividade do indicador de turno |
| `a92386d` | feat: dashboard TV — visibilidade e responsividade |
| `4de1501` | fix: análise — variáveis não declaradas, HTML nesting, nome de collection |
| `416b9f1` | refactor: Kaizen fase 1-4 — remoção de código morto |
| `49e9174` | fix: bugs de parada (downtime) |
| `619ac2a` | perf: otimização Firebase — ~67% redução de leituras |

---

*Documento gerado para reduzir alucinações e melhorar eficiência de assistentes AI ao trabalhar no codebase HokkaidoMES.*
