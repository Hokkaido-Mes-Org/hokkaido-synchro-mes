# ANÁLISE COMPLETA DO CODEBASE — HokkaidoMES (Syncrho MES v2.0)

**Data da análise:** Junho 2025  
**Escopo:** Todos os arquivos de código-fonte do diretório `backupHokkaidoMES`  
**Total de arquivos de código:** 53 (JS + HTML + CSS)  
**Total de linhas de código:** ~63.220 linhas

---

## ÍNDICE

1. [Visão Geral do Sistema](#1-visão-geral-do-sistema)
2. [Arquitetura e Estrutura de Diretórios](#2-arquitetura-e-estrutura-de-diretórios)
3. [Inventário Completo de Arquivos (com linhas)](#3-inventário-completo-de-arquivos)
4. [Arquivos HTML — Páginas do Sistema](#4-arquivos-html)
5. [Script Principal (script.js)](#5-script-principal)
6. [Sistema de Autenticação (auth.js)](#6-sistema-de-autenticação)
7. [Bancos de Dados Locais (database.js + materia-prima-database.js)](#7-bancos-de-dados-locais)
8. [Service Worker](#8-service-worker)
9. [Sistema Modular ES6 (src/)](#9-sistema-modular-es6)
10. [Feature Flags (feature-flags.js)](#10-feature-flags)
11. [Ponte Legado (bridge.js)](#11-ponte-legado)
12. [Entry Point Modular (src/index.js)](#12-entry-point-modular)
13. [Core — EventBus, StateManager, ListenerManager](#13-core)
14. [Services — Firebase e Serviços de Dados](#14-services)
15. [Utils — Funções Utilitárias](#15-utils)
16. [Components — Componentes UI](#16-components)
17. [Controllers — Módulos de Página](#17-controllers)
18. [Módulos Standalone (raiz)](#18-módulos-standalone)
19. [Coleções Firestore](#19-coleções-firestore)
20. [Sistema de Turnos](#20-sistema-de-turnos)
21. [Exposições window.* (Legado ↔ Módulos)](#21-exposições-window)
22. [Dependências Externas (CDN)](#22-dependências-externas)
23. [Ordem de Carregamento dos Scripts](#23-ordem-de-carregamento)
24. [Navegação / Abas do Sistema](#24-navegação-e-abas)
25. [Permissões e Controle de Acesso](#25-permissões-e-controle-de-acesso)
26. [Fluxo de Dados e Cache](#26-fluxo-de-dados-e-cache)
27. [Migração Arquitetural (Fases 1–5)](#27-migração-arquitetural)
28. [Riscos e Débitos Técnicos](#28-riscos-e-débitos-técnicos)

---

## 1. Visão Geral do Sistema

**Nome Comercial:** Syncrho MES v2.0 — Industry 4.0 Manufacturing Execution System  
**Nome Interno:** HokkaidoMES  
**Fábrica:** Hokkaido Plastics (injeção plástica)  
**Máquinas:** H01–H15 (H11 desativada — `DISABLED_MACHINES=['H11']`)  
**Clientes:** SILGAN, APTAR, ÓRICA, PARKER, DIVERSOS  
**Backend:** Firebase/Firestore (SDK compat v8.10.1)  
**Frontend:** Vanilla JavaScript (monolítico) + ES6 Modules (migração em andamento)  
**Styling:** Tailwind CSS (CDN) + style.css customizado  
**Gráficos:** Chart.js  
**Ícones:** Lucide Icons  
**Exportações:** XLSX (Excel), html2pdf (PDF)  
**Notificações:** Web Push via Service Worker  

---

## 2. Arquitetura e Estrutura de Diretórios

```
backupHokkaidoMES/
├── index.html               # SPA principal (8.513 linhas)
├── login.html               # Página de login (811 linhas)
├── dashboard-tv.html         # Dashboard TV industrial (5.620 linhas)
├── admin-fix-downtime.html   # Ferramenta admin correção de paradas (438 linhas)
├── acompanhamento-turno.html # Acompanhamento de turno standalone (730 linhas)
├── style.css                 # Estilos customizados (1.303 linhas)
├── script.js                 # Core monolítico legado (19.046 linhas)
├── auth.js                   # Sistema de autenticação (533 linhas)
├── database.js               # Base de produtos hardcoded (1.838 linhas)
├── materia-prima-database.js # Base de matérias-primas (96 linhas)
├── service-worker.js         # Push notifications (21 linhas)
├── advanced-kpis.js          # KPIs avançados: MTBF, MTTR, FPY (503 linhas)
├── auto-pareto-analysis.js   # Análise Pareto automática (1.180 linhas)
├── machine-queue.js          # Fila de produção por máquina (691 linhas)
├── machine-schedule.js       # Programação semanal de máquinas (736 linhas)
├── traceability-system.js    # Rastreabilidade completa (1.334 linhas)
├── erp-import.js             # Importação ERP Sankhya via Excel (1.085 linhas)
├── docs/                     # Documentação do projeto
│   ├── ANALISE-OTIMIZACAO-FIREBASE.md
│   ├── ARQUITETURA-MODULAR-MES.md
│   ├── ESTUDO-LEITURAS-POR-ABA.md
│   ├── FUNCOES-ATIVAS-SISTEMA.md
│   ├── MAPA-ARQUIVOS-DEPLOY.md
│   ├── N8N-AUTOMACAO-PLANO-ACAO.md
│   └── UNIFICACAO-PARADAS-DETALHADA.md
├── tools/                    # Scripts de análise
│   ├── _count_fns.ps1
│   └── _count_fns.py
└── src/                      # Sistema modular ES6
    ├── index.js              # Bootstrap modular (102 linhas)
    ├── components/
    │   ├── cache-dashboard.js    # Debug overlay de cache (46 linhas)
    │   └── notification.js       # Toast notifications (47 linhas)
    ├── config/
    │   └── feature-flags.js      # Feature flags (52 linhas)
    ├── controllers/              # 17 controllers de página
    │   ├── admin.controller.js           # 3.869 linhas
    │   ├── analysis.controller.js        # 9.418 linhas
    │   ├── dashboard.controller.js       # 639 linhas
    │   ├── downtime-grid.controller.js   # 1.118 linhas
    │   ├── extended-downtime.controller.js # 1.810 linhas
    │   ├── historico.controller.js       # 360 linhas
    │   ├── launch.controller.js          # 4.187 linhas
    │   ├── leadership.controller.js      # 745 linhas
    │   ├── monitoring.controller.js      # 867 linhas
    │   ├── orders.controller.js          # 1.186 linhas
    │   ├── pcp.controller.js             # 1.178 linhas
    │   ├── planning.controller.js        # 2.740 linhas
    │   ├── pmp.controller.js             # 932 linhas
    │   ├── reports.controller.js         # 500 linhas
    │   ├── resumo.controller.js          # 663 linhas
    │   ├── setup.controller.js           # 538 linhas
    │   └── tooling.controller.js         # 364 linhas
    ├── core/                    # Infraestrutura central
    │   ├── event-bus.js         # Pub/Sub (137 linhas)
    │   ├── listener-manager.js  # Gerência de listeners Firestore (112 linhas)
    │   └── state-manager.js     # Cache centralizado (157 linhas)
    ├── legacy/
    │   └── bridge.js            # Ponte legado ↔ módulos (142 linhas)
    ├── services/                # Serviços de dados
    │   ├── base.service.js          # Classe abstrata CRUD+cache (379 linhas)
    │   ├── downtime.service.js      # Paradas: 3 coleções (227 linhas)
    │   ├── downtime-shift.service.js # Motor de split por turno (532 linhas)
    │   ├── firebase-cache.service.js # Proxy cache window.* (189 linhas)
    │   ├── firebase-client.js       # Wrapper Firebase (111 linhas)
    │   ├── logs.service.js          # Logs do sistema (71 linhas)
    │   ├── orders.service.js        # Ordens de produção (101 linhas)
    │   ├── planning.service.js      # Planejamento (88 linhas)
    │   └── production.service.js    # Entradas de produção (98 linhas)
    └── utils/                   # Utilitários compartilhados
        ├── auth.utils.js        # Sessão/usuário (200 linhas)
        ├── color.utils.js       # Cores, paletas, motivos (301 linhas)
        ├── date.utils.js        # Datas, turnos (161 linhas)
        ├── dom.utils.js         # debounce, escapeHtml (57 linhas)
        ├── logger.js            # Log no Firestore (75 linhas)
        ├── number.utils.js      # Parsing numérico (120 linhas)
        ├── plan.utils.js        # Status de plano/OP (58 linhas)
        └── product.utils.js     # Busca de produto por código (62 linhas)
```

---

## 3. Inventário Completo de Arquivos

| Arquivo | Linhas | Tipo |
|---------|-------:|------|
| script.js | 19.046 | Legado monolítico |
| analysis.controller.js | 9.418 | Controller |
| index.html | 8.513 | SPA principal |
| dashboard-tv.html | 5.620 | TV industrial |
| launch.controller.js | 4.187 | Controller |
| admin.controller.js | 3.869 | Controller |
| planning.controller.js | 2.740 | Controller |
| database.js | 1.838 | Base de produtos |
| extended-downtime.controller.js | 1.810 | Controller |
| traceability-system.js | 1.334 | Rastreabilidade |
| style.css | 1.303 | Estilos |
| orders.controller.js | 1.186 | Controller |
| auto-pareto-analysis.js | 1.180 | Pareto |
| pcp.controller.js | 1.178 | Controller |
| downtime-grid.controller.js | 1.118 | Controller |
| erp-import.js | 1.085 | Import ERP |
| pmp.controller.js | 932 | Controller |
| monitoring.controller.js | 867 | Controller |
| login.html | 811 | Login |
| leadership.controller.js | 745 | Controller |
| machine-schedule.js | 736 | Programação |
| acompanhamento-turno.html | 730 | Acompanhamento |
| machine-queue.js | 691 | Fila PCP |
| resumo.controller.js | 663 | Controller |
| dashboard.controller.js | 639 | Controller |
| setup.controller.js | 538 | Controller |
| auth.js | 533 | Autenticação |
| downtime-shift.service.js | 532 | Service |
| reports.controller.js | 500 | Controller |
| advanced-kpis.js | 503 | KPIs |
| admin-fix-downtime.html | 438 | Ferramenta admin |
| base.service.js | 379 | Service base |
| tooling.controller.js | 364 | Controller |
| historico.controller.js | 360 | Controller |
| color.utils.js | 301 | Utilitário |
| downtime.service.js | 227 | Service |
| auth.utils.js | 200 | Utilitário |
| firebase-cache.service.js | 189 | Service |
| date.utils.js | 161 | Utilitário |
| state-manager.js | 157 | Core |
| bridge.js | 142 | Ponte legado |
| event-bus.js | 137 | Core |
| number.utils.js | 120 | Utilitário |
| listener-manager.js | 112 | Core |
| firebase-client.js | 111 | Service |
| src/index.js | 102 | Entry point |
| orders.service.js | 101 | Service |
| production.service.js | 98 | Service |
| materia-prima-database.js | 96 | Base MP |
| planning.service.js | 88 | Service |
| logger.js | 75 | Utilitário |
| product.utils.js | 62 | Utilitário |
| dom.utils.js | 57 | Utilitário |
| plan.utils.js | 58 | Utilitário |
| feature-flags.js | 52 | Config |
| notification.js | 47 | Componente |
| cache-dashboard.js | 46 | Componente |
| service-worker.js | 21 | SW |

**Total JS:** ~54.240 linhas | **Total HTML:** ~16.112 linhas | **Total CSS:** 1.303 linhas

---

## 4. Arquivos HTML

### 4.1 index.html (8.513 linhas)
- **Propósito:** SPA (Single Page Application) principal do MES
- **Navegação:** 13 abas/páginas controladas via `data-page` attributes
- **Scripts carregados:** 12 (auth.js, databases, script.js, módulos standalone, src/index.js como module)
- **Contém:** Todo o HTML das 13 páginas inline (sem lazy loading), todos os modais, formulários e templates

### 4.2 login.html (811 linhas)
- **Propósito:** Tela de login do sistema
- **Design:** Glass-effect card com fundo gradiente + imagem
- **Autenticação:** Submete credenciais para Firebase/Firestore (coleção de usuários), com opção "lembrar-me" (24h vs 8h)
- **Standalone:** Independente do index.html — redireciona para index.html após login bem-sucedido

### 4.3 dashboard-tv.html (5.620 linhas)
- **Propósito:** Painel industrial para exibição em TVs no chão de fábrica
- **Design:** Industrial 4.0 (inspirado em GE Predix / Siemens MindSphere)
- **Funcionalidades:** Cards de máquina com status em tempo real, OEE, produção, paradas ativas
- **Auto-refresh:** Meta tag `http-equiv="refresh"` a cada 5 minutos
- **Firebase:** SDK compat v9.22.0 (diferente do index.html que usa v8.10.1)
- **Acesso restrito:** Apenas para usuários daniel, linaldo, luciano

### 4.4 admin-fix-downtime.html (438 linhas)
- **Propósito:** Ferramenta administrativa para correção de registros de paradas na coleção `downtime_entries`
- **Funcionalidades:** Analisa registros incompletos (sem duração, datas inválidas) e corrige em batch
- **Firebase:** Configuração manual (campos de API key, Project ID) — independente da configuração global
- **Log visual:** Console monospace estilizado com cores por tipo (info, warn, error, success)

### 4.5 acompanhamento-turno.html (730 linhas)
- **Propósito:** Acompanhamento de turno standalone (versão independente do módulo embutido no index.html)
- **Firebase:** SDK v8.10.1
- **Funcionalidades:** Comparação CEDOC vs MES por máquina e turno

---

## 5. Script Principal (script.js)

- **Linhas:** 19.046
- **Padrão:** IIFE (Immediately Invoked Function Expression) — todas as funções vivem em uma closure
- **Versão no carregamento:** `script.js?v=20260217-phase10`
- **Responsabilidades atuais (pós-migração):**
  - Inicialização do Firebase (`window.db`)
  - `DOMContentLoaded` handler com setup de UI/navegação
  - DataStore e CacheManager globais
  - Funções de cache: `getProductionOrdersCached`, `getPlanningCached`, `getProductionEntriesCached`, `getActiveDowntimesCached`, etc.
  - Funções modais: `openModal`, `closeModal`, `showConfirmModal`
  - Funções de UI global: `showLoadingState`, `renderMachineCards`
  - Feature flag gates: `if (window.__FLAGS?.USE_MODULAR_X)` → delega para controller modular
  - Listeners Firestore globais: `listenToPlanningChanges`, `listenToDowntimeChanges`
  - Tab switching logic
  - Machine selection logic (`onMachineSelected`)
  - `DISABLED_MACHINES = ['H11']`
  - Funções expostas via `window.*` para uso pelos controllers modulares

- **Globais expostos (amostra):** `window.forceStopDowntime`, `window.closeModal`, `window.lancamentoFilterDate`, `window.renderMachineCards`, `window.showLoadingState`, `window.showConfirmModal`, `window.detachActiveListener`, `window.onMachineSelected`, `window.loadProductionOrders`, `window.populateMachineSelector`, `window.getPlanningCached`, `window.getExtendedDowntimesCached`, `window.getProductionOrdersCached`, `window.getActiveDowntimesCached`, `window.getAllMachinesDowntimeStatus`, `window.loadLaunchPanel`, `window.invalidateDowntimeCache`, `window.refreshAnalysisIfActive`, `window.listenToPlanningChanges`, `window.selectedMachineData`, `window.productByCode`, `window.authSystem`, `window.machineSchedule`, `window.MachineQueue`, `window.DISABLED_MACHINES`, `window.DataStore`, `window.CacheManager`

---

## 6. Sistema de Autenticação (auth.js)

- **Linhas:** 533
- **Classe:** `AuthSystem`
- **Armazenamento de sessão:** `synchro_user` em `localStorage` (24h — "lembrar-me") ou `sessionStorage` (8h)
- **Roles:** `gestor`, `operador`, `lider`, `suporte`, `planejamento`, `analise`

### 6.1 Controle de Acesso por Aba

| Aba (data-page) | Restrição |
|---|---|
| `qualidade` / `processo` | admin only |
| `ajustes` | admin + gestor |
| `pmp` | apenas leandro, manaus |
| `pcp` | apenas leandro, roberto, elaine, daniel, tiago |
| `lideranca-producao` | lista específica de usuários + role lider |
| `setup-maquinas` | sem restrição (todos com acesso ao sistema) |
| `ferramentaria` | sem restrição |
| `acompanhamento` | sem restrição |
| `historico-sistema` | sem restrição |
| `admin-dados` | sem restrição listada em auth.js (controlada por script.js) |

### 6.2 Permissões por Ação

| Ação | Roles Permitidos |
|---|---|
| `create_planning` | gestor, planejamento |
| `edit_planning` | gestor, planejamento |
| `add_production` | gestor, operador, lider |
| `add_losses` | gestor, operador, lider |
| `add_downtime` | gestor, operador, lider |
| `add_rework` | gestor, operador, lider |
| `adjust_executed` | gestor |
| `view_analysis` | gestor, analise, lider |
| `export_data` | gestor, analise |
| `close_production_order` | gestor |
| `submit_quality` | gestor, operador, lider |

### 6.3 Métodos da classe

`init`, `loadUserSession`, `validateSession`, `hasPermission`, `isRole`, `getCurrentUser`, `logout`, `canAccessTab`, `filterTabsBasedOnPermissions`, `checkPermissionForAction`, `showPermissionError`, `updateUserInterface`, `addUserInfoToHeader`, `addLogoutButton`, `setDefaultActiveTab`, `filterManualEntriesButtons`

---

## 7. Bancos de Dados Locais

### 7.1 database.js (1.838 linhas)
- **Variável global:** `productDatabase` (array)
- **Estrutura de cada item:** `{ cod, client, name, cavities, cycle, weight, pieces_per_hour_goal, mp }`
- **Organização por cliente:**
  - **SILGAN** — Bombas spray, closures
  - **APTAR** — Atuadores, clips, caps
  - **ÓRICA** — Conectores para detonadores
  - **PARKER** — Peças de filtro de óleo
  - **DIVERSOS** — Produtos variados

### 7.2 materia-prima-database.js (96 linhas)
- **Constante:** `materiaPrimaDatabase` (array)
- **Estrutura:** `{ codigo, descricao }`
- **Materiais catalogados:** PP (várias grades), PE (HD, LD), PA (Nylon 6, 6.6), ABS, POM (Acetal), PC, PS (GPPS, HIPS)

---

## 8. Service Worker (service-worker.js)

- **Linhas:** 21
- **Funcionalidades:**
  1. `push` event → mostra notificação nativa do browser (título + corpo + ícone + URL)
  2. `notificationclick` event → abre URL associada à notificação
- **Uso:** Alertas de máquinas paradas para gestores
- **Registro:** Feito no `index.html` via `navigator.serviceWorker.register('service-worker.js')`

---

## 9. Sistema Modular ES6 (src/)

### 9.1 Visão Geral da Migração

O sistema está em transição de um monolito (script.js com ~50.000+ linhas original) para uma arquitetura modular ES6. A migração ocorreu em **5 fases**:

| Fase | Descrição | Status |
|------|-----------|--------|
| **Fase 1** | Fundação: core (EventBus, StateManager, ListenerManager), services (BaseService, Firebase wrappers), bridge | ✅ Completa |
| **Fase 2** | Extração dos primeiros controllers: PCP, Tooling, Setup, Leadership, Reports | ✅ Completa |
| **Fase 3** | Controllers complexos: Planning, Orders, Analysis, Launch, Admin, Monitoring, PMP | ✅ Completa |
| **Fase 4** | Remoção de código morto do script.js | ✅ Completa |
| **Fase 5** | Remoção de bridge code e utilities duplicados (5A + 5B) | ✅ Completa (~7.836 linhas removidas) |

Todos os 20 feature flags estão em `true` — o sistema roda 100% no modo modular.

### 9.2 Padrão de Comunicação

```
script.js (IIFE closure)
    ↓ expõe funções via window.*
    ↓
src/index.js (ES6 module, type="module")
    ↓ espera window.db + window.DataStore (polling 100ms, timeout 15s)
    ↓ chama initBridge()
    ↓
bridge.js
    ↓ syncLegacyToModern: DataStore → StateManager
    ↓ exposeServicesToGlobal: services → window.services
    ↓ setupModernToLegacySync: EventBus → invalidate legacy caches
    ↓
script.js lê window.__FLAGS
    ↓ se flag=true → chama controller modular (via import dinâmico ou window.*)
    ↓ se flag=false → usa código legado inline (atualmente não ocorre)
```

### 9.3 Bloqueio Técnico Remanescente

> *"Controllers usam window.* forwarding para funções do closure. Bridge analysis/orders/planning/launch não pode ser removido até controllers importarem de módulos ES6 compartilhados."*
> — Comentário em feature-flags.js

Os controllers usam **window forwarding** extensivamente para invocar funções da closure do script.js. Exemplo em planning.controller.js:

```javascript
const showConfirmModal = (...args) => window.showConfirmModal?.(...args);
const getProductionOrdersCached = (...args) => window.getProductionOrdersCached?.(...args);
const renderMachineCards = (...args) => window.renderMachineCards?.(...args);
```

---

## 10. Feature Flags (feature-flags.js)

**52 linhas** | Todas as flags de módulo = `true`

### 10.1 Module Flags (todas TRUE)

| Flag | Controller Correspondente |
|------|---------------------------|
| `USE_MODULAR_PCP` | pcp.controller.js |
| `USE_MODULAR_TOOLING` | tooling.controller.js |
| `USE_MODULAR_SETUP` | setup.controller.js |
| `USE_MODULAR_REPORTS` | reports.controller.js |
| `USE_MODULAR_LEADERSHIP` | leadership.controller.js |
| `USE_MODULAR_ORDERS` | orders.controller.js |
| `USE_MODULAR_MONITORING` | monitoring.controller.js |
| `USE_MODULAR_ADMIN` | admin.controller.js |
| `USE_MODULAR_HISTORICO` | historico.controller.js |
| `USE_MODULAR_PMP` | pmp.controller.js |
| `USE_MODULAR_QUALITY` | (sem controller dedicado*) |
| `USE_MODULAR_PLANNING` | planning.controller.js |
| `USE_MODULAR_ANALYSIS` | analysis.controller.js |
| `USE_MODULAR_LAUNCH` | launch.controller.js |
| `USE_MODULAR_EXTENDED_DOWNTIME` | extended-downtime.controller.js |
| `USE_MODULAR_DOWNTIME_GRID` | downtime-grid.controller.js |
| `USE_MODULAR_DASHBOARD` | dashboard.controller.js |
| `USE_MODULAR_RESUMO` | resumo.controller.js |
| `USE_MODULAR_DOWNTIME_SHIFT` | (service, não controller) |
| `USE_MODULAR_COLOR_UTILS` | (utilitário, não controller) |

### 10.2 Debug Flags (todas FALSE)

| Flag | Propósito |
|------|-----------|
| `LOG_SERVICE_CALLS` | Log de chamadas de serviço |
| `LOG_CACHE_HITS` | Log de hits no cache |
| `LOG_EVENT_BUS` | Log de eventos no EventBus |

---

## 11. Ponte Legado (bridge.js)

**142 linhas** | Conecta o mundo ES6 ao mundo `window.*`

### 11.1 Funções Exportadas

| Função | Responsabilidade |
|--------|-----------------|
| `syncLegacyToModern()` | Transfere dados do `window.DataStore` para o `StateManager` (6 coleções: production_orders, planning, production_entries, downtime_entries, active_downtimes, extended_downtime_logs) |
| `exposeServicesToGlobal()` | Cria `window.services` com instâncias de ProductionService, DowntimeEntriesService, PlanningService, OrdersService, LogsService |
| `setupModernToLegacySync()` | Escuta eventos no EventBus (data:invalidated, production:updated, etc.) → invalida caches legados correspondentes |
| `initBridge()` | Orquestra as 3 funções acima |

---

## 12. Entry Point Modular (src/index.js)

**102 linhas** | Ponto de entrada do sistema modular

### 12.1 Fluxo de Boot

1. Importa `initBridge` e `FLAGS`
2. Importa side-effect modules: `number.utils.js`, `plan.utils.js`, `product.utils.js`, `notification.js`, `logger.js` (auto-registram em `window.*`)
3. Expõe `window.__FLAGS = FLAGS` imediatamente (antes de qualquer await)
4. `waitForLegacy()`: polling a cada 100ms por `window.db` e `window.DataStore` com timeout de 15s
5. Se legado pronto → `initBridge()`
6. Log dos controllers ativos/inativos

**IMPORTANTE:** Este arquivo NÃO substitui o script.js — roda EM PARALELO.

---

## 13. Core

### 13.1 EventBus (event-bus.js — 137 linhas)
- **Padrão:** Pub/Sub Singleton
- **Métodos:** `on(event, fn)`, `once(event, fn)`, `emit(event, data)`, `off(event, fn)`, `clear()`, `stats()`
- **Debug:** Mantém histórico dos últimos 50 eventos emitidos
- **Uso:** Comunicação desacoplada entre controllers e services (ex: `monitoring:initialized`, `data:invalidated`, `production:updated`)

### 13.2 StateManager (state-manager.js — 157 linhas)
- **Padrão:** Cache in-memory centralizado (substitui DataStore + CacheManager legados)
- **Estado interno:** `#state` (Map), `#timestamps` (Map), `#accessCounts` (Map)
- **TTL padrão:** 120.000ms (2 minutos)
- **Métodos:** `get(key)`, `set(key, value, ttl?)`, `isFresh(key)`, `has(key)`, `invalidate(key)`, `getIfFresh(key)`, `stats()`, `resetStats()`
- **Integração:** bridge.js sincroniza DataStore → StateManager nas 6 coleções principais

### 13.3 ListenerManager (listener-manager.js — 112 linhas)
- **Propósito:** Gerencia ciclo de vida de listeners Firestore (subscribe → unsubscribe → pause → resume)
- **Integração com Visibility API:** Pausa listeners quando aba fica oculta, retoma quando fica visível
- **Exposto como:** `window.listenerManager`
- **Métodos:** `subscribe(name, fn)`, `unsubscribe(name)`, `pause(name)`, `resume(name)`, `pauseAll()`, `resumeAll()`, `getActiveListeners()`, `stats()`
- **Nota:** Importação removida do src/index.js porque duplicava a instância criada pelo script.js

---

## 14. Services

### 14.1 BaseService (base.service.js — 379 linhas)
- **Padrão:** Classe abstrata herdada por todos os services
- **Cache automático:** Cache in-memory por query key, check de TTL
- **Listeners:** Gerenciamento de listeners Firestore com Map de unsubscribe functions
- **Integração:** Usa `stateManager` para cache e `EventBus` para notificações
- **Operações CRUD:** `getAll(options, force)`, `getById(id)`, `create(data)`, `update(id, data)`, `delete(id)`, `batchUpdate(updates)`

### 14.2 firebase-client.js (111 linhas)
- **Propósito:** Wrapper fino sobre o Firebase inicializado pelo script.js
- **Dependência:** `window.db` (definido pelo script.js)
- **Exports:** `getDb()`, `getAuth()`, `getCurrentUser()`, `getCurrentUserRole()`, `serverTimestamp()`, `increment()`, `arrayUnion()`, `deleteField()`, `createBatch()`, `runTransaction()`, `toDate()`

### 14.3 firebase-cache.service.js (189 linhas)
- **Propósito:** Proxy centralizado de cache que delega para funções `window.*Cached`
- **Cadeia de cache:** Módulo ES6 → `window.*Cached()` → `memory → DataStore → CacheManager → Firestore`
- **Funções exportadas:** `getProductionOrdersCached`, `findProductionOrderCached`, `getPlanningCached`, `getProductionEntriesCached`, `getActiveDowntimesCached`, `getExtendedDowntimesCached`, `getDowntimeEntriesCached`, `getMachinePrioritiesCached`, `invalidateCache`, `getCacheStats`
- **Fallback:** Acesso direto ao Firestore se `window.*Cached` não estiver disponível

### 14.4 downtime.service.js (227 linhas)
- **Gerencia 3 coleções:** `downtime_entries`, `active_downtimes`, `extended_downtime_logs`
- **Classes:** `DowntimeEntriesService` (extends BaseService), `ActiveDowntimesService`, `ExtendedDowntimeService`
- **Métodos especializados:** `getByDateRange`, `getByMachine`, `getByOrder`, `startDowntime`, `stopDowntime`
- **Invalidação:** Limpa `window._downtimeStatusCache` e `window.downtimeStatusCache` após mudanças

### 14.5 downtime-shift.service.js (532 linhas)
- **Propósito:** Motor de segmentação de paradas por turno
- **Função principal:** `splitDowntimeIntoShiftSegments(start, end)` — divide uma parada que cruza limites de turno em segmentos individuais
- **Safety:** `MAX_ITERATIONS=1000` para evitar loops infinitos
- **Funções auxiliares:** `getShiftStart`, `getShiftEnd`, `getWorkdayForDateTime`, `parseDateTime`, `consolidateDowntimeEvents`, `calculateHoursInPeriod`, `splitDowntimeIntoDailySegments`
- **Window exports:** 11 funções expostas como `window.*`

### 14.6 orders.service.js (101 linhas)
- **Coleção:** `production_orders`
- **Classe:** `OrdersService` (extends BaseService, TTL: 120s)
- **Métodos:** `getByOrderNumber`, `getByStatus`, `getByMachine`, `getPriorities` (5min cache para `machine_priorities`), `setPriority`

### 14.7 planning.service.js (88 linhas)
- **Coleção:** `planning`
- **Classe:** `PlanningService` (extends BaseService, TTL: 120s)
- **Métodos:** `getForDate`, `getByMachine`, `getByOrder`
- **Cache inteligente:** Filtra do cache geral antes de fazer query

### 14.8 production.service.js (98 linhas)
- **Coleção:** `production_entries`
- **Classe:** `ProductionService` (extends BaseService, TTL: 60s)
- **Métodos:** `getForDate`, `getByMachine`, `getByOrder`, `getByDateRange`, `getTotalByOrder`

### 14.9 logs.service.js (71 linhas)
- **Coleção:** `system_logs`
- **Classe:** `LogsService` (extends BaseService, TTL: 30s)
- **Métodos:** `log(action, category, details)`, `getByCategory`, `getByDateRange`

---

## 15. Utils

### 15.1 auth.utils.js (200 linhas)
- **Exports:** `getStoredUserSession`, `getActiveUser`, `isUserGestorOrAdmin`, `getCurrentUserName`, `showPermissionDeniedNotification`, `clearUserNameCache`
- **Integração:** Lê sessão de `sessionStorage.synchro_user` ou `localStorage.synchro_user`
- **Cache:** `getCurrentUserName` mantém cache interno do nome do usuário

### 15.2 color.utils.js (301 linhas)
- **Exports (18 totais):**
  - Constantes: `PRODUCTION_DAY_START_HOUR` (7), `HOURS_IN_PRODUCTION_DAY` (24), `PROGRESS_PALETTE`, `ANALYSIS_LINE_COLORS`
  - Funções de cor: `hexToRgb`, `rgbToHex`, `mixHexColors`, `resolveProgressPalette`, `hexWithAlpha`
  - Funções de tempo: `formatHourLabel`, `formatShortDateLabel`, `getProductionHoursOrder`, `getProductionHourLabel`, `getHoursElapsedInProductionDay`, `formatShiftLabel`
  - Motivos de perda/parada: `getGroupedLossReasons`, `getGroupedDowntimeReasons`, `getDowntimeCategory`
- **Motivos de perda por grupo:** PROCESSO (15 motivos), FERRAMENTARIA (9), MAQUINA (5), MATERIA PRIMA (1)
- **Motivos de parada por grupo:** FERRAMENTARIA (3), PROCESSO (6), COMPRAS (6), PREPARAÇÃO (5), QUALIDADE (3), MANUTENÇÃO (3), PRODUÇÃO (5), SETUP (4), ADMINISTRATIVO (1), PCP (3), COMERCIAL (3), OUTROS (2)
- **Window exports:** Todas as 18 funções/constantes são registradas em `window.*`

### 15.3 date.utils.js (161 linhas)
- **Exports:** `getProductionDateString`, `getCurrentShift`, `getShiftForDateTime`, `SHIFT_DEFINITIONS`, `formatDateBR`, `formatDateYMD`, `formatTimeHM`, `formatDateInput`, `formatDateBRShort`, `formatDateBRFull`, `pad2`, `combineDateAndTime`
- **Dia de produção:** Começa às 06:30 — antes desse horário, considera dia anterior
- **Window exports:** `window.combineDateAndTime`

### 15.4 dom.utils.js (57 linhas)
- **Exports:** `debounce(fn, delay)`, `escapeHtml(str)`, `normalizeMachineId(id)` (normaliza "h3" → "H03")

### 15.5 logger.js (75 linhas)
- **Exports:** `logSystemAction(action, details)`, `registrarLogSistema(action, details)`
- **Ambas gravam na coleção `system_logs`** com timestamp, usuário, ação, detalhes
- **Window exports:** `window.logSystemAction`

### 15.6 number.utils.js (120 linhas)
- **Exports:** `normalizeNumericString`, `parseOptionalNumber`, `coerceToNumber`, `parsePieceWeightInput`, `parsePieceWeightGrams`, `resolvePieceWeightGrams`
- **Normaliza:** Vírgulas brasileiras (1.234,56 → 1234.56), whitespace, etc.
- **Window exports:** `window.coerceToNumber`, `window.parseOptionalNumber`, `window.parsePieceWeightInput`, `window.resolvePieceWeightGrams`, `window.normalizeNumericString`

### 15.7 plan.utils.js (58 linhas)
- **Exports:** `isPlanActive(plan)`, `normalizeShiftValue(turno)`, `getProductionOrderStatusBadge(status)`
- **Status badges:** CSS classes para: em_andamento (blue), finalizada (green), suspensa (yellow), cancelada (red), planejada (gray)
- **Window exports:** `window.isPlanActive`, `window.normalizeShiftValue`, `window.getProductionOrderStatusBadge`

### 15.8 product.utils.js (62 linhas)
- **Export:** `getProductByCode(code)` — busca produto em 4 fontes (prioridade):
  1. `window.productByCode` (Map)
  2. `databaseModule` Map
  3. `window.productDatabase` (array)
  4. `databaseModule` array
- **Window exports:** `window.getProductByCode`

---

## 16. Components

### 16.1 cache-dashboard.js (46 linhas)
- **Propósito:** Overlay de debug fixo no canto inferior direito da tela
- **Mostra:** Estatísticas do DataStore e CacheManager (contagens, hits, misses)
- **Ativação:** Chamada manual ou via console
- **Atualização:** Refresh a cada 5 segundos

### 16.2 notification.js (47 linhas)
- **Propósito:** Componente de toast notification
- **Design:** Tailwind CSS + Lucide Icons
- **Tipos:** `success` (verde, check-circle), `error` (vermelho, alert-circle), `info` (azul, info)
- **Auto-dismiss:** 3 segundos
- **Export:** `showNotification(message, type)` — também exposto como `window.showNotification`

---

## 17. Controllers

### 17.1 analysis.controller.js (9.418 linhas)
- **Maior controller do sistema**
- **Origem:** script.js ~120+ funções migradas
- **Escopo:** Módulo de análise completo — gráficos, tabelas, dashboards, Pareto, tendências
- **Sub-módulos:** Dashboard KPIs, análise por máquina, comparativos de turno, perdas, paradas, OEE
- **Imports:** Praticamente todos os utils (color, date, dom, number, plan, product, auth, logger)
- **Window forwarding:** Extensivo uso de `window.*` para funções do closure do script.js

### 17.2 launch.controller.js (4.187 linhas)
- **Escopo:** Runtime principal de lançamento — a aba central do operador
- **Funcionalidades:** Cards de máquina, paradas (início/fim), produção, lançamento de hora-a-hora
- **Origem:** script.js L~50+ funções migradas
- **Window exposures:** `openStandaloneDowntimeModal`, `closeStandaloneModal`, `openCardFinishDowntimeModal`, `closeCardFinishDowntimeModal`, `confirmCardFinishDowntime`, `openBatchDowntimeModal`, `closeBatchDowntimeModal`, `toggleBatchMachine`, `toggleBatchMachineClick`, `batchSelectAllMachines`, `batchDeselectAllMachines`, `refreshRecentEntries`

### 17.3 admin.controller.js (3.869 linhas)
- **Escopo:** Página administrativa de dados — visualização e correção em batch
- **Sub-módulos:** Paradas, Ordens, Produção, Perdas, Planejamento, Ajustes em lote
- **Funções migradas:** ~49
- **Window exposures:** `adminParadasEditar`, `adminParadasExcluir`, `adminExcluirParadasPorMotivo`

### 17.4 planning.controller.js (2.740 linhas)
- **Escopo:** Planejamento de produção — CRUD de planos, associação com OPs, modal de criação
- **Origem:** script.js (~2.700 linhas, 19+ funções)
- **Window forwarding (15 funções):** `detachActiveListener`, `showLoadingState`, `showConfirmModal`, `onMachineSelected`, `loadProductionOrders`, `populateMachineSelector`, `getPlanningCached`, `getExtendedDowntimesCached`, `getProductionOrdersCached`, `getActiveDowntimesCached`, `getAllMachinesDowntimeStatus`, `loadLaunchPanel`, `renderMachineCards`
- **listenerManager:** Usa wrapper local que delega para `window.listenerManager`

### 17.5 extended-downtime.controller.js (1.810 linhas)
- **Escopo:** Gerenciamento de paradas prolongadas (fim de semana, manutenção programada, parada comercial)
- **Funcionalidades:** Lista com filtros, modal de criação/edição, análise de paradas por categoria
- **Window exposures (7):** `loadExtendedDowntimeList`, `openEditDowntimeModal`, `openExtendedDowntimeModal`, `loadExtendedDowntimeAnalysis`, `setupExtendedDowntimeTab`, `handleEditExtendedDowntime`, `handleDeleteExtendedDowntime`

### 17.6 orders.controller.js (1.186 linhas)
- **Escopo:** CRUD de Ordens de Produção (cards + tabela, KPIs, filtros, busca)
- **Funções migradas:** 25 (Region 1: L14654–15839)
- **Window exposures (16):** `activateOrder`, `reactivateOrder`, `editOrder`, `finalizeOrder`, `suspendOrder`, `resumeOrder`, `deleteOrder`, `openOrderTraceability`, `recalculateAllOrdersTotals`, `refreshOrdersList`, `searchMP`, `saveOrderForm`, `openNewOrderModal`, `closeOrderFormModal`, `onPartCodeChange`

### 17.7 pcp.controller.js (1.178 linhas)
- **Escopo:** Planejamento e Controle da Produção (PCP)
- **Origem:** script.js (~1.400 linhas)
- **Dependências legacy:** `window.authSystem`, `window.machineSchedule`, `window.MachineQueue`, `window.DISABLED_MACHINES`, `window.productByCode`
- **Window exposure:** `window.savePCPObservation`
- **Estado interno:** `pcpState` (initialized, currentDate, data, machinePriorities), `pcpObservationsCache`

### 17.8 downtime-grid.controller.js (1.118 linhas)
- **Escopo:** Grid de paradas standalone (sem OP), início/fim por card, parada em batch (múltiplas máquinas)
- **Window exposures (10):** `openStandaloneDowntimeModal`, `closeStandaloneModal`, `openCardFinishDowntimeModal`, `closeCardFinishDowntimeModal`, `confirmCardFinishDowntime`, `openBatchDowntimeModal`, `closeBatchDowntimeModal`, `toggleBatchMachine`, `toggleBatchMachineClick`, `batchSelectAllMachines`, `batchDeselectAllMachines`

### 17.9 pmp.controller.js (932 linhas)
- **Escopo:** Plano Mestre de Produção — sub-abas para Moído, Borra, Sucata
- **Coleções Firestore:** `pmp_moido`, `pmp_borra`, `pmp_sucata`
- **Window exposures (11):** `deletePMPBorraEntry`, `deletePMPSucataEntry`, `loadSucataAnalysis`, `sucataTablePrevPage`, `sucataTableNextPage`, `exportSucataTable`, `openPmpBorraModal`, `loadPMPHistory`, `initPMPPage`, `openPmpSucataModal`, `initSucataModal`
- **Gráficos Chart.js:** sucataByTypeChart, sucataByMachineChart, sucataMonthlyChart

### 17.10 monitoring.controller.js (867 linhas)
- **Escopo:** Acompanhamento de turno — 3 sub-abas
- **Sub-módulos:**
  1. Acompanhamento de Turno (CEDOC vs MES — produção por máquina/turno)
  2. Acompanhamento de Perdas (OP vs MES — refugo por máquina/turno)
  3. Acompanhamento de Paradas (Timeline visual de paradas por máquina)
- **Coleções:** `production_entries`, `downtime_entries`, `planejamento`, `acompanhamento_turno`, `acompanhamento_perdas`, `system_logs`

### 17.11 leadership.controller.js (745 linhas)
- **Escopo:** Escalas de operadores + absenteísmo
- **Coleção:** `escalas_operadores`
- **Window exposures (10):** `editarEscala`, `excluirEscala`, `switchLiderancaTab`, `switchAbsenteismoSubTab`, `buscarHistoricoAbsenteismo`, `excluirAbsenteismo`, `atualizarDashboardAbsenteismo`, `togglePeriodoPersonalizado`, `verificarAcessoAbsenteismo`, `updateMaquinasCount`

### 17.12 resumo.controller.js (663 linhas)
- **Escopo:** Resumo + OEE — Aba de Análise com relatórios quantitativos e de eficiência
- **Funcionalidades:** Cálculo de OEE (disponibilidade × performance × qualidade), histórico OEE, agrupamento por período
- **Window exposures (9):** `loadResumoData`, `switchReportView`, `handleResumoTableClick`, `handlePrintReport`, `calculateShiftOEE`, `calculateRealTimeOEE`, `loadOeeHistory`, `groupOeeByPeriod`, `saveOeeHistory`
- **Importa:** `getDowntimeCategory` de color.utils.js

### 17.13 dashboard.controller.js (639 linhas)
- **Escopo:** Dashboard KPIs e gráficos (sub-aba de Análise)
- **Window exposures:** `loadDashboardData`, `processAndRenderDashboard`, `populateMachineFilter`

### 17.14 setup.controller.js (538 linhas)
- **Escopo:** Registro e análise de setups de máquina (troca de molde, cor, etc.)
- **Origem:** script.js (~1.100 linhas)
- **Gráficos:** 5 charts (tipo, máquina, tempoMáquina, diário, distribuiçãoTempo)
- **Paginação:** 20 por página
- **Window exposures (4):** `editarSetup`, `excluirSetup`, `setupSetupMaquinasPage`, `renderSetupCharts`

### 17.15 reports.controller.js (500 linhas)
- **Escopo:** Relatórios de produção, perdas e paradas em formato tabular + CSV export
- **Sub-implementações:** ReportsModule IIFE (PDF) + funções rel* standalone (inline)
- **Paginação:** 20 paradas por página

### 17.16 tooling.controller.js (364 linhas)
- **Escopo:** Ferramentaria — controle de moldes (CRUD, batidas, manutenções preventivas/corretivas)
- **Window exposures (4):** `registrarManutencaoMolde`, `editarMolde`, `adicionarBatidasManual`, `atualizarBatidasPorProducao`
- **Estado:** `ferramentariaState` (moldes, manutencoes, filtros, initialized)

### 17.17 historico.controller.js (360 linhas)
- **Escopo:** Visualizador de histórico do sistema (logs)
- **Coleção:** `system_logs`
- **Funcionalidades:** Filtros por categoria, data, usuário; paginação; exportação

---

## 18. Módulos Standalone (raiz)

### 18.1 advanced-kpis.js (503 linhas)
- **Classe:** `AdvancedKPIs`
- **KPIs calculados:** MTBF (Mean Time Between Failures), MTTR (Mean Time To Repair), FPY (First Pass Yield), Custo por Unidade
- **Atualização:** Automática a cada hora
- **Dependência:** `getFilteredData` (função global do script.js/traceability)

### 18.2 auto-pareto-analysis.js (1.180 linhas)
- **Classe:** `AutoParetoAnalysis`
- **Funcionalidades:** Análise Pareto automática para paradas, qualidade e produção
- **Range padrão:** 30 dias
- **Gráficos:** Chart.js com barras + linha acumulada (80/20)

### 18.3 machine-queue.js (691 linhas)
- **Padrão:** IIFE
- **Propósito:** Gerenciamento de fila de ordens de produção por máquina (aba PCP)
- **Coleção:** `production_orders`
- **Funcionalidade:** Drag-and-drop para reordenação de prioridade
- **Versão:** `?v=20260206`

### 18.4 machine-schedule.js (736 linhas)
- **Propósito:** Programação semanal de máquinas (liga/desliga por dia da semana)
- **Coleção:** `machine_schedule` (documentos `week_YYYY-MM-DD`)
- **Versão:** `?v=20260217`

### 18.5 traceability-system.js (1.334 linhas)
- **Classe:** `TraceabilitySystem`
- **Propósito:** Rastreabilidade completa da produção
- **Genealogia:** Lote → Ordem → Máquina → Operador → Parâmetros de processo
- **Retenção:** 7 anos
- **Define:** Função global `getFilteredData` (usada por advanced-kpis.js)

### 18.6 erp-import.js (1.085 linhas)
- **Propósito:** Importação de ordens de produção do ERP Sankhya via planilha Excel
- **Biblioteca:** XLSX (SheetJS) para parsing
- **Headers reconhecidos:** "Nro. OP", "Centro de Trabalho", "Produto", "Quantidade", etc.
- **Versão:** `?v=20260217`

---

## 19. Coleções Firestore

### 19.1 Coleções Principais

| Coleção | Propósito | Service | Controller(s) |
|---------|-----------|---------|----------------|
| `production_orders` | Ordens de produção | OrdersService | orders, planning, launch, admin, pcp |
| `planning` | Planejamento diário | PlanningService | planning, analysis, monitoring, resumo |
| `production_entries` | Lançamentos de produção | ProductionService | launch, analysis, monitoring, reports |
| `downtime_entries` | Registros de parada finalizados | DowntimeEntriesService | launch, analysis, monitoring, reports, admin |
| `active_downtimes` | Paradas em andamento | ActiveDowntimesService | launch, downtime-grid, analysis, pcp |
| `extended_downtime_logs` | Paradas prolongadas | ExtendedDowntimeService | extended-downtime, planning, analysis |
| `system_logs` | Logs do sistema | LogsService | historico, logger.js |
| `machine_priorities` | Prioridades de máquina | OrdersService (getPriorities) | pcp, orders |
| `escalas_operadores` | Escalas de operadores | — | leadership |
| `machine_schedule` | Programação semanal | — | machine-schedule.js |

### 19.2 Coleções Secundárias

| Coleção | Propósito | Controller |
|---------|-----------|------------|
| `hourly_production_entries` | Produção hora-a-hora | analysis, launch |
| `rework_entries` | Retrabalhos | analysis, admin |
| `quantity_adjustments` | Ajustes de quantidade | admin |
| `pmp_borra` | PMP — Borra (resíduo) | pmp |
| `pmp_moido` | PMP — Moído (reciclado) | pmp |
| `pmp_sucata` | PMP — Sucata (descarte) | pmp |
| `acompanhamento_turno` | Dados de acompanhamento | monitoring |
| `acompanhamento_perdas` | Dados de perdas | monitoring |
| `planejamento` | Planejamento (variante usada pelo monitoring) | monitoring |

### 19.3 TTLs de Cache por Service

| Service | TTL |
|---------|-----|
| LogsService | 30s |
| ProductionService | 60s |
| DowntimeEntriesService | 60s |
| ActiveDowntimesService | 60s |
| OrdersService | 120s |
| PlanningService | 120s |
| StateManager (padrão) | 120s |
| OrdersService.getPriorities | 300s (5 min) |

---

## 20. Sistema de Turnos

### 20.1 Definição de Turnos

| Turno | Início | Fim |
|-------|--------|-----|
| **T1** (Manhã) | 06:30 | 14:59 |
| **T2** (Tarde) | 15:00 | 23:19 |
| **T3** (Noite) | 23:20 | 06:29 (dia seguinte) |

### 20.2 Dia de Produção

- **Início:** 06:30
- **Duração:** 24 horas (até 06:29 do dia seguinte)
- **Regra:** Lançamentos antes de 06:30 pertencem ao dia anterior
- **Implementação:** `getProductionDateString()` (em date.utils.js e script.js)
- **Constante:** `PRODUCTION_DAY_START_HOUR = 7` (em color.utils.js, para cálculos de gráficos horários — nota: diferença de 30min pode causar discrepância)

### 20.3 Motor de Split de Turno

O `downtime-shift.service.js` implementa lógica complexa para segmentar paradas que cruzam limites de turno:

- **Entrada:** Timestamp de início e fim de uma parada
- **Saída:** Array de segmentos, cada um contendo turno, data do dia de produção, duração
- **Uso:** Permite que relatórios mostrem corretamente a distribuição de paradas por turno
- **Safety:** Contador de iterações com máximo de 1.000 para evitar loops infinitos

---

## 21. Exposições window.* (Legado ↔ Módulos)

O sistema possui uma extensa rede de funções expostas via `window.*` para comunicação bidirecional entre o closure do script.js e os módulos ES6.

### 21.1 De Utils para window.* (auto-registro)

| Módulo | Funções Expostas |
|--------|------------------|
| color.utils.js | 14 funções + 4 constantes (18 total) |
| number.utils.js | 5 funções |
| plan.utils.js | 3 funções |
| product.utils.js | 1 função |
| logger.js | 1 função |
| date.utils.js | 1 função |
| notification.js | 1 função |

### 21.2 De Services para window.*

| Service | Funções Expostas |
|---------|------------------|
| downtime-shift.service.js | 11 funções |

### 21.3 De Controllers para window.* (onclick handlers)

| Controller | Qtd window.* |
|------------|:---:|
| orders.controller.js | 16 |
| launch.controller.js | 12+ |
| pmp.controller.js | 11 |
| downtime-grid.controller.js | 10 |
| leadership.controller.js | 10 |
| resumo.controller.js | 9 |
| extended-downtime.controller.js | 7 |
| setup.controller.js | 4 |
| tooling.controller.js | 4 |
| admin.controller.js | 3+ |
| dashboard.controller.js | 3 |
| pcp.controller.js | 1 |

### 21.4 Window forwarding nos Controllers (dependências do legacy)

Padrão recorrente — controllers lêem funções do closure do script.js via window.*:

```javascript
// planning.controller.js — 15 forwarded functions
const showConfirmModal = (...args) => window.showConfirmModal?.(...args);
const renderMachineCards = (...args) => window.renderMachineCards?.(...args);
// etc.
```

**Funções mais demandadas via window forwarding:**
- `window.getProductionOrdersCached` — usado por 5+ controllers
- `window.getActiveDowntimesCached` — usado por 4+ controllers
- `window.showNotification` — usado por 10+ controllers
- `window.showConfirmModal` — usado por 3+ controllers
- `window.getProductionDateString` — usado por 3+ controllers
- `window.showLoadingState` — usado por 2+ controllers

---

## 22. Dependências Externas (CDN)

| Biblioteca | Versão | CDN | Uso |
|------------|--------|-----|-----|
| Tailwind CSS | latest | cdn.tailwindcss.com | Estilização |
| Firebase App | 8.10.1 | gstatic.com | Backend |
| Firebase Firestore | 8.10.1 | gstatic.com | Database |
| Firebase Storage | 8.10.1 | gstatic.com | Armazenamento |
| Chart.js | latest | cdn.jsdelivr.net | Gráficos |
| Lucide Icons | latest | unpkg.com | Ícones |
| SheetJS (XLSX) | 0.18.5 | cdnjs.cloudflare.com | Excel import/export |
| html2pdf.js | 0.10.1 | cdnjs.cloudflare.com | Exportação PDF |
| Google Fonts (Roboto) | — | fonts.googleapis.com | Fonte (dashboard-tv) |

**Nota sobre Firebase no dashboard-tv.html:** Usa SDK compat v9.22.0, diferente do index.html que usa v8.10.1.

---

## 23. Ordem de Carregamento dos Scripts (index.html)

```
1. Tailwind CSS (CDN)
2. auth.js — Sistema de autenticação
3. Service Worker registration (inline)
4. Tailwind config (inline)
5. Lucide Icons (CDN)
6. Chart.js (CDN)
7. XLSX / SheetJS (CDN)
8. html2pdf.js (CDN)
9. Firebase App + Firestore + Storage (CDN, v8.10.1)
10. materia-prima-database.js — Base MP
11. database.js — Base de produtos
12. traceability-system.js — Rastreabilidade
    [... index.html inline HTML: todas as 13 abas ...]
13. advanced-kpis.js — KPIs avançados
14. auto-pareto-analysis.js — Pareto automático
15. machine-queue.js — Fila PCP
16. script.js — Core monolítico (IIFE)
17. erp-import.js — Import ERP
18. machine-schedule.js — Programação semanal
19. src/index.js — Entry point modular (type="module")
    → Espera window.db + window.DataStore (polling)
    → initBridge()
    → Sistema modular ativo
```

**Ponto crítico:** `src/index.js` carrega DEPOIS de `script.js` e espera ativamente que o legado inicialize (`window.db` + `window.DataStore`). Se o legado não inicializar em 15s, os módulos são desativados.

---

## 24. Navegação e Abas

### 24.1 Abas do Sistema (data-page)

| # | data-page | Título | Controller |
|---|-----------|--------|------------|
| 1 | `planejamento` | Planejamento | planning.controller.js |
| 2 | `ordens` | Ordens | orders.controller.js |
| 3 | `lancamento` | Lançamento (**aba padrão**) | launch.controller.js |
| 4 | `analise` | Análise | analysis.controller.js + dashboard + resumo |
| 5 | `pmp` | PMP - Gestão de Materiais | pmp.controller.js |
| 6 | `acompanhamento` | Acompanhamento de Turno | monitoring.controller.js |
| 7 | `historico-sistema` | Histórico do Sistema | historico.controller.js |
| 8 | `relatorios` | Relatórios e Análises | reports.controller.js |
| 9 | `admin-dados` | Administração de Dados | admin.controller.js |
| 10 | `lideranca-producao` | Liderança Produção | leadership.controller.js |
| 11 | `setup-maquinas` | Setup de Máquinas | setup.controller.js |
| 12 | `ferramentaria` | Ferramentaria | tooling.controller.js |
| 13 | `pcp` | PCP - Planejamento e Controle | pcp.controller.js |

### 24.2 Sub-abas Conhecidas

- **Análise:** Dashboard / Resumo / Análise detalhada
- **PMP:** Moído / Borra / Sucata
- **Acompanhamento:** Turno / Perdas / Paradas
- **Liderança:** Escalas / Absenteísmo

---

## 25. Permissões e Controle de Acesso

### 25.1 Fluxo de Autenticação

```
login.html
  → Usuário submete credenciais
  → Consulta Firestore (coleção de usuários)
  → Grava sessão em localStorage/sessionStorage (chave: 'synchro_user')
  → Redireciona para index.html

index.html
  → auth.js carrega → AuthSystem.init()
  → Valida sessão (timestamp + TTL)
  → Se inválida → redireciona para login.html
  → Se válida → filterTabsBasedOnPermissions()
    → Esconde abas sem acesso
    → setDefaultActiveTab('lancamento')
```

### 25.2 Expiração de Sessão

| Modo | TTL |
|------|-----|
| "Lembrar-me" ativado | 24 horas (localStorage) |
| "Lembrar-me" desativado | 8 horas (sessionStorage) |

### 25.3 Roles do Sistema

| Role | Descrição |
|------|-----------|
| `gestor` | Acesso total, permissões administrativas |
| `operador` | Lançamento de produção, paradas, perdas |
| `lider` | Operações + visualização de análise |
| `suporte` | Suporte técnico |
| `planejamento` | Criação/edição de planejamento |
| `analise` | Visualização de análise e exportação |

---

## 26. Fluxo de Dados e Cache

### 26.1 Cadeia de Cache (3 camadas)

```
Controller (módulo ES6)
  → firebase-cache.service.js (proxy)
    → window.*Cached() (função do script.js closure)
      → Memory cache (objeto JS simples, TTL por função)
        → DataStore (cache in-memory centralizado)
          → CacheManager (persistência em memória com TTL)
            → Firestore (source of truth)
```

### 26.2 Invalidação

Quando dados mudam (ex: nova parada registrada):
1. Controller emite evento no EventBus (ex: `downtime:created`)
2. Bridge escuta o evento → invalida caches legados correspondentes
3. StateManager invalida chave específica
4. Próxima leitura vai ao Firestore

### 26.3 Listeners em Tempo Real

O sistema usa Firestore `onSnapshot` para atualizações em tempo real:
- Gerenciados pelo `ListenerManager`
- Pausados automaticamente quando aba oculta (Visibility API)
- Retomados quando aba fica visível
- Listeners principais: `planning`, `active_downtimes`, `production_entries`

---

## 27. Migração Arquitetural (Fases 1–5)

### 27.1 Linha do Tempo

| Fase | Conteúdo | Linhas Envolvidas |
|------|----------|-------------------|
| **Fase 1** | Core (EventBus, StateManager, ListenerManager) + Services (Base, Firebase, Downtime, Orders, Planning, Production, Logs) + Bridge + index.js | ~2.500 linhas novas |
| **Fase 2** | Extração dos controllers: PCP (#1), Tooling (#2), Setup (#3), Leadership (#4), Reports (#5) | ~3.300 linhas migradas |
| **Fase 3** | Controllers complexos: Planning, Orders, Admin, Monitoring, PMP, Analysis, Launch, Dashboard, Extended-Downtime, Downtime-Grid, Historico, Resumo | ~25.000 linhas migradas |
| **Fase 3A** | Shared utilities: number.utils, plan.utils, product.utils, notification, logger, color.utils, date.utils, dom.utils, auth.utils | ~1.100 linhas novas |
| **Fase 4** | Remoção de código morto no script.js | ~4.000 linhas removidas |
| **Fase 5** | Remoção de bridge code e duplicatas (5A: ~5.500 linhas; 5B: ~2.336 linhas) | ~7.836 linhas removidas |

### 27.2 Estado Atual

- **script.js** partiu de ~50.000+ linhas → atualmente 19.046 linhas
- **Todos os 20 feature flags** estão TRUE — sistema 100% no modo modular
- **Código remanescente no script.js:** Inicialização Firebase, DataStore/CacheManager, funções de cache globais, UI helpers (modals, loading states), tab switching, machine selection, listeners Firestore
- **Bloqueio:** Controllers não podem abandonar window forwarding até que as funções compartilhadas do script.js sejam extraídas para módulos ES6 compartilhados

### 27.3 Próximos Passos Potenciais

1. **Extrair funções compartilhadas** do closure do script.js para módulos ES6:
   - `showConfirmModal`, `showLoadingState` → `src/utils/modal.utils.js`
   - `renderMachineCards`, `onMachineSelected` → `src/utils/machine.utils.js`
   - Funções `*Cached` → mover lógica para services existentes
2. **Eliminar window forwarding** nos controllers (importar de módulos ES6)
3. **Reduzir script.js** ao mínimo: apenas inicialização Firebase + DataStore + bridge boot
4. **Versões de Firebase SDK:** Unificar v8.10.1 (index.html) com v9.22.0 (dashboard-tv.html)

---

## 28. Riscos e Débitos Técnicos

### 28.1 Críticos

| Risco | Descrição |
|-------|-----------|
| **script.js monolítico** | 19.046 linhas em uma IIFE — difícil de manter, testar e debugar |
| **Window forwarding massivo** | 100+ funções expostas via window.* — cria acoplamento implícito, difícil de rastrear |
| **Sem bundler/minificação** | Todos os arquivos carregam como-são no browser — impacto em performance e segurança |
| **Firebase SDK desatualizado** | v8.10.1 (compat) — deveria migrar para v10+ modular |
| **Sem testes automatizados** | Nenhum framework de teste identificado — toda validação é manual |
| **CDN como dependência** | Tailwind, Chart.js, Lucide, XLSX via CDN — se CDN cair, app quebra |
| **Credenciais Firebase** | Possivelmente expostas no código frontend (padrão Firebase, mas requer rules) |

### 28.2 Moderados

| Risco | Descrição |
|-------|-----------|
| **Duplicação de lógica** | `getProductionDateString` implementada em 3+ lugares (date.utils.js, reports.controller.js, script.js) |
| **Inconsistência de horário** | `PRODUCTION_DAY_START_HOUR=7` (color.utils) vs turnos começando 06:30 |
| **Cache complexo** | 3+ camadas de cache (memory, DataStore, CacheManager, StateManager) com TTLs diferentes |
| **database.js hardcoded** | 1.838 linhas de dados de produto no código-fonte — deveria estar em banco/config |
| **Firestore com nomes mistos** | Campos com nomes em PT/EN misturados (motivo/reason, data/date, turno/shift) |
| **Dashboard-TV isolado** | 5.620 linhas independentes — não reutiliza componentes do sistema principal |
| **ListenerManager duplicado** | Comentário no index.js indica que houve conflito de instâncias (resolvido removendo import) |

### 28.3 Baixos

| Item | Descrição |
|------|-----------|
| **Versioning manual** | Scripts carregados com `?v=20260217` no HTML (deveria ser automático via build) |
| **Console.log em produção** | Logs extensivos de debug (ex: `[Modules] Controller modular carregado`) |
| **Sem PWA completo** | Service Worker só lida com push — sem cache offline |
| **HTML inline** | 8.513 linhas de HTML em um único arquivo — sem componentes reutilizáveis |
| **tools/ sem documentação** | Scripts PowerShell/Python de análise sem instruções de uso |

---

*Documento gerado automaticamente a partir da análise estática do codebase HokkaidoMES.*
