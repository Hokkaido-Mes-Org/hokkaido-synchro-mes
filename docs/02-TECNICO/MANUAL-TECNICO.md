# HokkaidoMES — Manual Técnico

> **Versão:** 1.0 • **Data:** Fevereiro 2026  
> **Classificação:** CONFIDENCIAL — Equipe de Desenvolvimento  
> **Responsável:** Leandro de Camargo

---

## 1. Visão Geral do Sistema

### 1.1 O Que é o HokkaidoMES

O **HokkaidoMES** (Manufacturing Execution System) é um sistema web para gestão de chão de fábrica da indústria de injeção plástica Hokkaido. Gerencia produção, paradas de máquina, planejamento, ordens de produção, qualidade, ferramentaria e KPIs operacionais.

### 1.2 Stack Tecnológica

| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| **Frontend** | HTML5 + JavaScript (ES6 Modules) | — |
| **Estilização** | TailwindCSS (CDN) | v3.x |
| **Gráficos** | Chart.js | v4.x |
| **Ícones** | Lucide Icons | CDN |
| **Backend** | Firebase (BaaS) | SDK Compat v8/v9 |
| **Banco de Dados** | Cloud Firestore | — |
| **Autenticação** | Client-side (customizado) | → Plano: Firebase Auth |
| **Hosting** | Firebase Hosting | — |
| **PWA** | Service Worker (push notifications) | — |

### 1.3 Requisitos de Sistema

| Requisito | Especificação |
|-----------|--------------|
| **Browser** | Chrome 90+, Edge 90+, Firefox 88+ (ES6 Modules) |
| **Rede** | Acesso à internet (Firebase) ou rede local |
| **Resolução** | 1024x768 mínimo; 1920x1080 recomendado |
| **Dispositivos** | Desktop, tablets (responsivo limitado) |
| **Service Worker** | Para push notifications (opcional) |

---

## 2. Arquitetura do Sistema

### 2.1 Arquitetura Geral

```
                    ┌──────────────────────────────────────┐
                    │             BROWSER                   │
                    │  ┌─────────────────────────────────┐  │
                    │  │         index.html (SPA)         │  │
                    │  │  ┌───────┐ ┌──────────────────┐ │  │
                    │  │  │auth.js│ │    script.js      │ │  │
                    │  │  │(RBAC) │ │  (19K lines)      │ │  │
                    │  │  └───────┘ │  Legacy Monolith  │ │  │
                    │  │            └────────┬───────────┘ │  │
                    │  │      ┌──────────────┼────────────┐│  │
                    │  │      │  src/index.js │ (ES6)     ││  │
                    │  │      │  ┌───────────▼──────┐    ││  │
                    │  │      │  │  legacy/bridge.js│    ││  │
                    │  │      │  └──────────────────┘    ││  │
                    │  │      │  ┌────────┐ ┌─────────┐  ││  │
                    │  │      │  │Services│ │Controllers│ ││  │
                    │  │      │  │(8)     │ │(17)      │ ││  │
                    │  │      │  └────────┘ └──────────┘ ││  │
                    │  │      │  ┌────┐ ┌──────┐ ┌─────┐ ││  │
                    │  │      │  │Core│ │Utils │ │Comps │ ││  │
                    │  │      │  │(3) │ │(8)   │ │(2)  │ ││  │
                    │  │      │  └────┘ └──────┘ └─────┘ ││  │
                    │  │      └───────────────────────────┘│  │
                    │  └────────────────┬──────────────────┘  │
                    └───────────────────┼──────────────────────┘
                                        │ HTTPS
                                        ▼
                    ┌──────────────────────────────────────┐
                    │          FIREBASE (Google Cloud)      │
                    │  ┌──────────┐  ┌──────────────────┐  │
                    │  │ Firestore│  │  Firebase Hosting │  │
                    │  │ (23+     │  │  (static files)  │  │
                    │  │ coleções)│  │                   │  │
                    │  └──────────┘  └──────────────────┘  │
                    └──────────────────────────────────────┘
```

### 2.2 Modelo Híbrido (Legado + Modular)

O sistema opera em **modo híbrido** durante a migração:

```
CARREGAMENTO DO SISTEMA:
═══════════════════════
1. Browser carrega index.html
2. auth.js carrega (sincrono) → AuthSystem → RBAC
3. database.js carrega → productDatabase
4. script.js carrega → Firebase init → window.db → Toda lógica legada
5. src/index.js carrega (type="module") → waitForLegacy() → bridge.js
6. Feature Flags determinam qual versão de cada funcionalidade usar
7. Controllers registram event handlers na DOM
```

### 2.3 Padrão de Comunicação

```
┌────────────────┐
│  UI (DOM)      │ ──onclick/onchange──▶ Controller ou window.fn()
└────────┬───────┘
         │
         ▼
┌────────────────┐
│  Controller    │ ──importa──▶ Service
│  (ES6 Module)  │ ──emite────▶ EventBus
│                │ ──lê/escreve▶ StateManager
└────────┬───────┘
         │
         ▼
┌────────────────┐
│  Service       │ ──lê/escreve▶ Firestore (via firebase-client.js)
│  (ES6 Module)  │ ──cache─────▶ Map local + StateManager
│  extends Base  │ ──log───────▶ system_logs
└────────────────┘
```

---

## 3. Estrutura de Arquivos

### 3.1 Raiz do Projeto

```
backupHokkaidoMES/
├── index.html                 # SPA principal (8.514 linhas)
├── login.html                 # Página de login (811 linhas)
├── dashboard-tv.html          # Dashboard TV para chão de fábrica (5.621 linhas)
├── admin-fix-downtime.html    # Ferramenta admin de correção de paradas (439 linhas)
├── acompanhamento-turno.html  # Rastreamento de turno CEDOC vs MES (730 linhas)
├── script.js                  # Monolito legado (19.047 linhas)
├── auth.js                    # Sistema de autenticação (533 linhas)
├── database.js                # Database de produtos (1.839 linhas)
├── materia-prima-database.js  # Database de matéria-prima
├── style.css                  # Estilos customizados
├── service-worker.js          # Push notifications (21 linhas)
├── advanced-kpis.js           # KPIs avançados
├── auto-pareto-analysis.js    # Análise de Pareto automática
├── machine-queue.js           # Fila de máquinas
├── machine-schedule.js        # Programação de máquinas
├── traceability-system.js     # Sistema de rastreabilidade
├── erp-import.js              # Importação de dados ERP
├── docs/                      # Documentação
├── src/                       # Módulos ES6 (novo)
└── tools/                     # Scripts utilitários
```

### 3.2 Módulos ES6 (`src/`)

```
src/
├── index.js                           # Entry point (bootstrap + bridge)
│
├── config/
│   └── feature-flags.js               # 20 flags de controller + 3 debug
│
├── core/
│   ├── event-bus.js                   # Pub/Sub (138 linhas)
│   ├── state-manager.js              # Cache centralizado (158 linhas)
│   └── listener-manager.js           # Lifecycle de Firestore listeners
│
├── services/
│   ├── base.service.js               # Classe abstrata CRUD + cache (380 linhas)
│   ├── firebase-client.js            # Wrapper sobre window.db
│   ├── firebase-cache.service.js     # Cache de leitura Firebase
│   ├── production.service.js         # CRUD production_entries
│   ├── planning.service.js           # CRUD planning (89 linhas)
│   ├── downtime.service.js           # CRUD downtime (3 coleções, 228 linhas)
│   ├── downtime-shift.service.js     # Paradas por turno
│   ├── orders.service.js             # CRUD production_orders
│   └── logs.service.js               # Auditoria em system_logs
│
├── controllers/
│   ├── admin.controller.js           # Admin dados (3.870 linhas)
│   ├── analysis.controller.js        # Análise/OEE/Charts (9.419 linhas)
│   ├── dashboard.controller.js       # KPIs/Dashboard (640 linhas)
│   ├── downtime-grid.controller.js   # Grid parada standalone (1.119 linhas)
│   ├── extended-downtime.controller.js # Parada prolongada (1.811 linhas)
│   ├── historico.controller.js       # Logs do sistema (361 linhas)
│   ├── launch.controller.js          # Lançamento/cards (4.188 linhas)
│   ├── leadership.controller.js      # Liderança/escalas (746 linhas)
│   ├── monitoring.controller.js      # Acompanhamento turno (868 linhas)
│   ├── orders.controller.js          # Ordens de produção (1.187 linhas)
│   ├── pcp.controller.js             # PCP (1.179 linhas)
│   ├── planning.controller.js        # Planejamento (2.740 linhas)
│   ├── pmp.controller.js             # PMP borra/sucata (933 linhas)
│   ├── reports.controller.js         # Relatórios (501 linhas)
│   ├── resumo.controller.js          # Resumo/OEE engine (664 linhas)
│   ├── setup.controller.js           # Setup máquinas (539 linhas)
│   └── tooling.controller.js         # Ferramentaria (365 linhas)
│
├── components/
│   ├── notification.js               # showNotification()
│   └── cache-dashboard.js            # Dashboard de cache
│
├── utils/
│   ├── auth.utils.js                 # Utilidades de autenticação
│   ├── color.utils.js                # Cores de status/performance
│   ├── date.utils.js                 # Datas de produção, formatação
│   ├── dom.utils.js                  # debounce, loading states
│   ├── number.utils.js               # Formatação numérica
│   ├── plan.utils.js                 # Validações de planejamento
│   ├── product.utils.js              # Busca de produto, validações
│   └── logger.js                     # Logging com timestamp
│
└── legacy/
    └── bridge.js                     # Ponte window.* ↔ ES6 modules
```

---

## 4. Firebase — Configuração e Coleções

### 4.1 Projeto Firebase

| Parâmetro | Valor |
|-----------|-------|
| **Projeto** | `hokkaido-synchro` |
| **SDK** | Firebase Compat (v8 pattern + v9 CDN) |
| **Região** | Configurado no Firebase Console |
| **Inicialização** | `script.js` (linhas ~400-500) |

### 4.2 Inicialização

```javascript
// script.js (~linha 400)
const firebaseConfig = {
    apiKey: "...",
    authDomain: "hokkaido-synchro.firebaseapp.com",
    projectId: "hokkaido-synchro",
    storageBucket: "hokkaido-synchro.appspot.com",
    messagingSenderId: "...",
    appId: "..."
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
window.db = db;
```

### 4.3 Coleções Firestore

| # | Coleção | Descrição | Serviço Responsável |
|---|---------|-----------|---------------------|
| 1 | `production_entries` | Registros de produção por turno | ProductionService |
| 2 | `planning` | Planejamento diário por máquina | PlanningService |
| 3 | `production_orders` | Ordens de produção | OrdersService |
| 4 | `active_downtimes` | Paradas ativas em andamento | DowntimeService |
| 5 | `downtime_entries` | Paradas finalizadas (histórico) | DowntimeService |
| 6 | `extended_downtime_logs` | Paradas prolongadas (dias) | DowntimeService |
| 7 | `system_logs` | Auditoria de ações | LogsService |
| 8 | `machine_priorities` | Prioridade de máquinas | script.js |
| 9 | `escalas_operadores` | Escalas de operadores por turno | LeadershipController |
| 10 | `hourly_production_entries` | Produção hora a hora | script.js |
| 11 | `quantity_adjustments` | Ajustes de quantidade (auditoria) | script.js |
| 12 | `rework_entries` | Registros de retrabalho | script.js |
| 13 | `pmp_borra` | PMP — resíduo borra | PMPController |
| 14 | `pmp_moido` | PMP — material moído | PMPController |
| 15 | `pmp_sucata` | PMP — sucata/refugo | PMPController |
| 16 | `acompanhamento_turno` | Tracking CEDOC vs MES | MonitoringController |
| 17 | `acompanhamento_perdas` | Tracking de perdas (OP vs MES) | MonitoringController |
| 18 | `moldes` | Cadastro de moldes | ToolingController |
| 19 | `manutencoes_molde` | Manutenções de moldes | ToolingController |
| 20 | `setups` | Registros de setup/troca | SetupController |
| 21 | `pcp_observacoes` | Observações do PCP | PCPController |
| 22 | `process_control_checks` | Controle de qualidade | script.js |

---

## 5. Sistema de Cache (Multi-Camada)

### 5.1 Visão Geral

O sistema possui **5 camadas de cache** que atuam de forma complementar:

```
CAMADA  │  SCOPE        │  MECANISMO           │  TTL
────────┼───────────────┼──────────────────────┼────────
  1     │  BaseService  │  Map() in-memory     │  60s-120s (configurável)
  2     │  StateManager │  Object in-memory    │  120s (padrão)
  3     │  DataStore    │  window.DataStore    │  2 min (legado)
  4     │  CacheManager │  window.CacheManager │  Variável (legado)
  5     │  Firestore    │  Persistence offline │  Firebase SDK
```

### 5.2 CacheManager (Legado)

```javascript
// Funções de cache expostas globalmente
window.getProductionOrdersCached()     // production_orders
window.getPlanningCached()             // planning
window.getProductionEntriesCached()    // production_entries
window.getActiveDowntimesCached()      // active_downtimes
window.getExtendedDowntimesCached()    // extended_downtime_logs
window.getDowntimeEntriesCached()      // downtime_entries
window.getMachinePrioritiesCached()    // machine_priorities
window.findProductionOrderCached(key)  // Busca por ordem
```

### 5.3 BaseService Cache (Modular)

```javascript
class BaseService {
    // Cache-first read pattern
    async getAll(filters, forceRefresh) {
        const cacheKey = this._buildKey(filters);
        if (!forceRefresh) {
            const cached = this._getFromCache(cacheKey);
            if (cached) return cached; // HIT
        }
        const data = await this._fetchFromFirestore(filters);
        this._setCache(cacheKey, data);
        return data;
    }
    
    // Invalidação
    invalidateCache() {
        this._cache.clear();
        stateManager.invalidate(this.collection);
    }
}
```

### 5.4 Sincronização de Cache

A `bridge.js` mantém os caches em sync:

```
DataStore changes → syncLegacyToModern() → StateManager
EventBus mutations → setupModernToLegacySync() → invalidateCache legado
```

---

## 6. Feature Flags

### 6.1 Mecânica

```javascript
// src/config/feature-flags.js
export const FLAGS = {
    USE_MODULAR_PLANNING: true,
    USE_MODULAR_ANALYSIS: true,
    // ... 18 outros flags
    LOG_SERVICE_CALLS: false,
    LOG_CACHE_HITS: false,
    LOG_EVENT_BUS: false,
};

// Uso no script.js
if (window.__FLAGS?.USE_MODULAR_PLANNING) {
    // Delega para planning.controller.js
} else {
    // Usa lógica inline do script.js (legado)
}
```

### 6.2 Todos os Flags (Estado Atual: Fevereiro 2026)

| Flag | Valor | Controller |
|------|:-----:|-----------|
| `USE_MODULAR_PCP` | ✅ true | pcp.controller.js |
| `USE_MODULAR_TOOLING` | ✅ true | tooling.controller.js |
| `USE_MODULAR_SETUP` | ✅ true | setup.controller.js |
| `USE_MODULAR_REPORTS` | ✅ true | reports.controller.js |
| `USE_MODULAR_LEADERSHIP` | ✅ true | leadership.controller.js |
| `USE_MODULAR_ORDERS` | ✅ true | orders.controller.js |
| `USE_MODULAR_MONITORING` | ✅ true | monitoring.controller.js |
| `USE_MODULAR_ADMIN` | ✅ true | admin.controller.js |
| `USE_MODULAR_HISTORICO` | ✅ true | historico.controller.js |
| `USE_MODULAR_PMP` | ✅ true | pmp.controller.js |
| `USE_MODULAR_QUALITY` | ✅ true | — (sem controller dedicado) |
| `USE_MODULAR_PLANNING` | ✅ true | planning.controller.js |
| `USE_MODULAR_ANALYSIS` | ✅ true | analysis.controller.js |
| `USE_MODULAR_LAUNCH` | ✅ true | launch.controller.js |
| `USE_MODULAR_EXTENDED_DOWNTIME` | ✅ true | extended-downtime.controller.js |
| `USE_MODULAR_DOWNTIME_GRID` | ✅ true | downtime-grid.controller.js |
| `USE_MODULAR_DASHBOARD` | ✅ true | dashboard.controller.js |
| `USE_MODULAR_RESUMO` | ✅ true | resumo.controller.js |
| `USE_MODULAR_DOWNTIME_SHIFT` | ✅ true | — (service-level) |
| `USE_MODULAR_COLOR_UTILS` | ✅ true | — (via color.utils.js) |

> **Todos os 20 flags estão habilitados.** O sistema roda 100% nos controllers modulares.

---

## 7. Páginas da Aplicação

### 7.1 SPA Principal — `index.html`

Aplicação single-page com 13 abas de navegação:

| # | data-page | Nome | Linhas do Controller |
|---|-----------|------|---------------------|
| 1 | `planejamento` | Planejamento | 2.740 |
| 2 | `ordens` | Ordens | 1.187 |
| 3 | `lancamento` | **Lançamento** (default) | 4.188 |
| 4 | `analise` | Análise | 9.419 |
| 5 | `pmp` | PMP - Gestão de Materiais | 933 |
| 6 | `acompanhamento` | Acompanhamento de Turno | 868 |
| 7 | `historico-sistema` | Histórico do Sistema | 361 |
| 8 | `relatorios` | Relatórios e Análises | 501 |
| 9 | `admin-dados` | Administração de Dados | 3.870 |
| 10 | `lideranca-producao` | Liderança Produção | 746 |
| 11 | `setup-maquinas` | Setup de Máquinas | 539 |
| 12 | `ferramentaria` | Ferramentaria | 365 |
| 13 | `pcp` | PCP | 1.179 |

### 7.2 Páginas Standalone

| Página | Linhas | Propósito | Acesso |
|--------|--------|-----------|--------|
| `login.html` | 811 | Autenticação | Público |
| `dashboard-tv.html` | 5.621 | Display de fábrica (TV) | Gestor/Líder/Suporte |
| `admin-fix-downtime.html` | 439 | Correção de dados | Admin apenas |
| `acompanhamento-turno.html` | 730 | Tracking CEDOC vs MES | Restrito |

---

## 8. Principais Padrões de Código

### 8.1 Controller Pattern

```javascript
// Cada controller segue o padrão:
import { getDb, serverTimestamp } from '../services/firebase-client.js';

// Estado local do módulo
let _state = {};
let _chartInstances = {};

// Função de setup (chamada quando a aba é ativada)
export function setupMyPage() {
    if (_initialized) return; // Guard de re-init
    _initialized = true;
    
    setupEventListeners();
    loadData();
}

// Funções internas
async function loadData() { ... }
function renderTable(data) { ... }
function handleSubmit(event) { ... }

// Exposição para onclick inline
window.myPublicFunction = myPublicFunction;
```

### 8.2 Service Pattern

```javascript
import { BaseService } from './base.service.js';

class MyService extends BaseService {
    constructor() {
        super('collection_name', { cacheTTL: 60000 });
    }
    
    // Métodos específicos do domínio
    async getByFilter(filter) {
        return this.getAll({ where: [['field', '==', filter]] });
    }
}

export const myService = new MyService();
```

### 8.3 Bridge Pattern (Legado ↔ Modular)

```javascript
// Controller precisa de função do script.js:
const legacyFn = typeof window.myLegacyFunction === 'function'
    ? window.myLegacyFunction
    : () => console.warn('myLegacyFunction not available');
```

---

## 9. Variáveis Globais Críticas

### 9.1 Infraestrutura

| Global | Tipo | Inicializado Por | Usado Por |
|--------|------|-------------------|-----------|
| `window.db` | Firestore | script.js | Todos |
| `window.DataStore` | Object | script.js | bridge.js |
| `window.CacheManager` | Object | script.js | script.js |
| `window.listenerManager` | Object | script.js | Controllers |
| `window.__FLAGS` | Object | src/index.js | script.js |
| `window.__modalManager` | Object | script.js | Controllers |
| `window.authSystem` | AuthSystem | auth.js | Todos |
| `window.services` | Object | bridge.js | Debug/test |
| `window.EventBus` | EventBus | bridge.js | Debug/test |
| `window.stateManager` | StateManager | bridge.js | Debug/test |

### 9.2 Estado de Aplicação

| Global | Descrição |
|--------|-----------|
| `window.lancamentoFilterDate` | Data selecionada para lançamento |
| `window.lancamentoFilterMachine` | Máquina filtrada |
| `window.fullDashboardData` | Dados do dashboard em memória |
| `window.machineCardData` | Dados dos cards de máquina |
| `window.downtimeStatusCache` | Cache de status de paradas |

---

## 10. Fluxo de Deploy

### 10.1 Deploy Atual

```bash
# 1. Build (não há bundler — arquivos vão direto)
# 2. Deploy no Firebase Hosting
firebase deploy --only hosting

# Ou deploy de regras também:
firebase deploy
```

### 10.2 Checklist de Deploy

- [ ] Verificar `feature-flags.js` — todos os flags corretos
- [ ] Verificar Firestore Rules atualizadas
- [ ] Testar login em todos os perfis
- [ ] Verificar console por erros JavaScript
- [ ] Testar abas principais (Lançamento, Análise, Planejamento)
- [ ] Validar Dashboard TV
- [ ] Confirmar que Service Worker atualiza corretamente
- [ ] Monitorar Firebase Console por leituras anormais

### 10.3 Rollback

```bash
# Listar versões de deploy anteriores
firebase hosting:channel:list

# Reverter para versão anterior
firebase hosting:clone SOURCE_SITE:SOURCE_CHANNEL TARGET_SITE:live
```

---

## 11. Performance e Otimização

### 11.1 Métricas de Leitura Firebase

O sistema opera com monitoramento de leituras:

```javascript
window.FirebaseMonitor // Rastreia reads/writes por coleção
window.fbstats()       // Exibe estatísticas no console
window.showCacheDashboard() // UI de monitoramento de cache
```

### 11.2 Estratégias de Otimização

| Estratégia | Implementação | Impacto |
|-----------|--------------|---------|
| Cache multi-camada | BaseService + StateManager + DataStore | -70% leituras |
| Batch queries | BatchQueryManager | -50% round-trips |
| Listener reuse | listenerManager | Evita listeners duplicados |
| Lazy loading | Tabs carregam dados sob demanda | -60% leituras iniciais |
| Debounce | dom.utils.js debounce() | Evita queries repetidas |
| TTL por coleção | Configurável via BaseService | Balanço freshness/custo |

### 11.3 Limites Conhecidos

| Limite | Valor | Consequência |
|--------|-------|-------------|
| Firestore reads/dia | 50.000 (Spark) / ilimitado (Blaze) | Throttling |
| Listeners simultâneos | ~100 | Performance degradation |
| localStorage | 5-10 MB | Sessão + cache |
| DOM nodes | ~50.000 (index.html grande) | Rendering lag |

---

## 12. Debug e Troubleshooting

### 12.1 Console Commands

```javascript
// Estatísticas de Firebase
window.fbstats()

// Dashboard de cache
window.showCacheDashboard()

// Forçar parada de uma máquina
window.forceStopDowntime('H06')

// Verificar flags ativos
window.__FLAGS

// Verificar estado do auth
window.authSystem.getCurrentUser()

// Verificar EventBus
window.EventBus.getStats()

// Verificar StateManager
window.stateManager.getMetrics()

// Verificar services
window.services
```

### 12.2 Problemas Comuns

| Problema | Causa Provável | Solução |
|----------|---------------|---------|
| Tela branca após login | script.js não carregou | Limpar cache (Ctrl+Shift+Delete) |
| Dados desatualizados | Cache stale | `F5` ou aguardar TTL |
| Parada "fantasma" | active_downtimes inconsistente | `forceStopDowntime('HXX')` |
| Login não funciona | localStorage corrompido | Limpar storage + F5 |
| Gráficos não renderizam | Chart.js CDN indisponível | Verificar rede |
| Modal não fecha | __modalManager erro | `closeModal('modal-id')` no console |
| Aba não aparece | Permissão do perfil | Verificar role do usuário |

---

## 13. Débito Técnico

### 13.1 Itens Conhecidos

| # | Débito | Severidade | Esforço |
|---|--------|-----------|---------|
| 1 | 100+ `window.*` exports | Alto | Alto |
| 2 | Senhas hardcoded em HTML | Crítico | Médio |
| 3 | Sem bundler (Vite/Webpack) | Médio | Médio |
| 4 | Sem testes automatizados | Alto | Alto |
| 5 | `database.js` hardcoded | Médio | Médio |
| 6 | Firebase SDK compat (v8) | Baixo | Alto |
| 7 | Cache de 5 camadas (complexidade) | Médio | Alto |
| 8 | `script.js` ainda com 19K linhas | Médio | Em progresso |
| 9 | Controllers usam `window.*` forwarding | Alto | Alto |
| 10 | Sem CI/CD pipeline | Médio | Médio |

### 13.2 Roadmap de Resolução

| Fase | Objetivo | Status |
|------|----------|--------|
| Fase 1 | Fundação modular (Core + Services) | ✅ Completa |
| Fase 2 | Services especializados | ✅ Completa |
| Fase 3 | Extração de controllers | ✅ Completa |
| Fase 4 | Remoção de código morto | ✅ Completa |
| Fase 5A | Remoção de bridge safe code | ✅ Completa (~4.200 linhas) |
| Fase 5B | Remoção de código qualidade | ✅ Completa (~3.636 linhas) |
| Fase 6 | Eliminar `window.*` forwarding | ⏳ Planejada |
| Fase 7 | Bundler + tree-shaking | ⏳ Planejada |
| Fase 8 | Firebase Auth migration | ⏳ Planejada |
| Fase 9 | Testes automatizados | ⏳ Planejada |

---

## Histórico de Revisões

| Versão | Data | Autor | Alteração |
|--------|------|-------|-----------|
| 1.0 | 2026-02-19 | Leandro de Camargo | Criação inicial |
