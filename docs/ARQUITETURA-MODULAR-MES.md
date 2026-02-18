# HokkaidoMES — Plano de Refatoração Arquitetural

> **Autor:** AI Architect • **Data:** 2026-02-16  
> **Status:** Plano Estratégico — Nenhuma mudança no código legado ainda

---

## Sumário Executivo

O `script.js` atual possui **~51.400 linhas** dentro de uma closure `DOMContentLoaded` monolítica. A comunicação entre módulos depende de **~40+ variáveis `window.*`** globais. Existem **23+ coleções Firestore** acessadas diretamente por todo o código, com um sistema de cache ad-hoc distribuído em 8+ camadas independentes.

Este documento propõe uma migração cirúrgica em **3 fases** para ES6 Modules, sem downtime e sem regressão.

---

## 1. Estrutura Modular Proposta

```
src/
├── index.js                          # Entry point — bootstrap + router
├── config/
│   ├── firebase.config.js            # Firebase init + config object
│   ├── machines.config.js            # DISABLED_MACHINES, machineList, machineDatabase
│   └── shifts.config.js              # SHIFT_DEFINITIONS, SHIFT_CONFIG
│
├── core/
│   ├── event-bus.js                  # Pub/Sub central (substitui window.* globals)
│   ├── state-manager.js             # DataStore + CacheManager unificados
│   ├── listener-manager.js          # Firestore listener lifecycle
│   └── router.js                     # Tab navigation controller
│
├── services/                         # ← CAMADA DE SERVIÇO FIREBASE
│   ├── firebase-client.js           # db instance, batch, transaction helpers
│   ├── auth.service.js              # Auth wrapper (login, session, roles)
│   ├── production.service.js        # production_entries CRUD + cache
│   ├── planning.service.js          # planning CRUD + cache
│   ├── orders.service.js            # production_orders CRUD + cache
│   ├── downtime.service.js          # active_downtimes + downtime_entries + extended_logs
│   ├── quality.service.js           # process_control_checks CRUD
│   ├── pmp.service.js               # pmp_borra + pmp_sucata
│   ├── scheduling.service.js        # machine_schedule, escalas_operadores
│   ├── tooling.service.js           # ferramentaria_moldes + manutencoes
│   ├── logs.service.js              # system_logs, audit trail
│   └── base.service.js              # Classe abstrata: fetchWithCache, invalidate, onSnapshot wrapper
│
├── controllers/                      # ← LÓGICA DE UI (1 por aba/feature)
│   ├── launch.controller.js         # Machine cards, selection, quick forms
│   ├── analysis.controller.js       # Analysis tab: OEE, charts, comparisons
│   ├── downtime-analysis.controller.js  # Downtime charts, timeline, reasons
│   ├── planning.controller.js       # Planning tab CRUD
│   ├── orders.controller.js         # Orders tab CRUD + import
│   ├── quality.controller.js        # Quality tab
│   ├── pcp.controller.js            # PCP dashboard, priorities
│   ├── admin.controller.js          # Admin data management
│   ├── reports.controller.js        # Report generation + export
│   ├── monitoring.controller.js     # Acompanhamento turno/perdas/paradas
│   ├── leadership.controller.js     # Liderança, escalas, absenteísmo
│   ├── pmp.controller.js            # PMP borra/sucata UI
│   ├── setup.controller.js          # Machine setup/changeover
│   └── tooling.controller.js        # Ferramentaria UI
│
├── components/                       # ← UI REUTILIZÁVEIS
│   ├── modal.js                     # ModalManager unificado
│   ├── notification.js              # showNotification()
│   ├── confirm-dialog.js            # showConfirmModal/hideConfirmModal
│   ├── machine-card.js              # Renderização de card de máquina
│   ├── chart-factory.js             # Chart.js wrapper + destroy/recreate
│   ├── data-table.js                # Tabela genérica com paginação + filtro
│   ├── date-range-picker.js         # Seletor de período reutilizável
│   └── sidebar.js                   # Sidebar toggle/navigation
│
├── utils/
│   ├── date.utils.js                # getProductionDateString, formatDate, etc.
│   ├── format.utils.js              # formatNumber, kgToGrams, weight conversions
│   ├── dom.utils.js                 # debounce, showLoadingState, element helpers
│   ├── export.utils.js              # Excel/PDF/CSV export helpers
│   └── validation.utils.js          # Poka-yoke, form validation
│
└── legacy/
    └── bridge.js                     # Ponte window.* ↔ ES6 Modules (temporário)
```

### Fluxo de Comunicação Entre Módulos

```
┌─────────────┐     importa     ┌──────────────┐     importa     ┌────────────┐
│ Controllers │ ──────────────► │   Services   │ ──────────────► │ Firebase   │
│  (UI Logic) │                 │ (Data + Cache)│                 │  Client    │
└──────┬──────┘                 └──────┬───────┘                 └────────────┘
       │                               │
       │ importa                       │ emite eventos
       ▼                               ▼
┌─────────────┐                 ┌──────────────┐
│ Components  │                 │  Event Bus   │
│(UI Reusable)│                 │ (Pub/Sub)    │
└─────────────┘                 └──────────────┘
       │                               ▲
       │ importa                       │ escuta
       ▼                               │
┌─────────────┐                 ┌──────────────┐
│   Utils     │                 │State Manager │
│ (Pure fns)  │                 │(Cache Central)│
└─────────────┘                 └──────────────┘
```

**Regras de dependência (SOLID):**
1. **Controllers** importam **Services** e **Components** — nunca o contrário
2. **Services** importam **firebase-client** e **state-manager** — nunca Controllers
3. **Components** são agnósticos de dados — recebem tudo via parâmetros
4. **Utils** são funções puras, zero side-effects, zero imports de Services
5. **Event Bus** é o único mecanismo de comunicação cross-module (substitui `window.*`)

---

## 2. Firebase Optimization Audit

### 2.1 Service Layer Pattern

Toda interação com Firestore deve passar por um `BaseService`:

```javascript
// src/services/base.service.js
export class BaseService {
    constructor(collectionName, options = {}) {
        this.collection = collectionName;
        this.cacheTTL = options.cacheTTL || 60000;
        this._cache = new Map();
        this._listeners = new Map();
        this._stateManager = null; // injetado no bootstrap
    }
    
    // ── READ: Cache-first com fallback Firebase ──
    async getAll(filters = {}, forceRefresh = false) {
        const cacheKey = this._buildKey(filters);
        
        if (!forceRefresh) {
            const cached = this._getFromCache(cacheKey);
            if (cached) return cached;
        }
        
        const data = await this._fetchFromFirestore(filters);
        this._setCache(cacheKey, data);
        return data;
    }
    
    async getById(id) {
        // Busca no cache local primeiro
        const allData = this._getFromCache(this._buildKey({}));
        if (allData) {
            const item = allData.find(d => d.id === id);
            if (item) return item;
        }
        
        // Fallback: single doc read
        const doc = await db.collection(this.collection).doc(id).get();
        return doc.exists ? { id: doc.id, ...doc.data() } : null;
    }
    
    // ── WRITE: Invalida cache automaticamente ──
    async create(data) {
        const ref = await db.collection(this.collection).add({
            ...data,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        this.invalidateCache();
        this._emit('created', { id: ref.id, ...data });
        return ref.id;
    }
    
    async update(id, data) {
        await db.collection(this.collection).doc(id).update(data);
        this.invalidateCache();
        this._emit('updated', { id, ...data });
    }
    
    async delete(id) {
        await db.collection(this.collection).doc(id).delete();
        this.invalidateCache();
        this._emit('deleted', { id });
    }
    
    // ── LISTENERS: onSnapshot gerenciado ──
    subscribe(name, queryModifier, callback) {
        this.unsubscribe(name);
        
        let query = db.collection(this.collection);
        if (queryModifier) query = queryModifier(query);
        
        const unsub = query.onSnapshot(snapshot => {
            const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            this._setCache(this._buildKey({}), data);
            callback(data);
        });
        
        this._listeners.set(name, unsub);
        return () => this.unsubscribe(name);
    }
    
    // ── CACHE ──
    invalidateCache() {
        this._cache.clear();
    }
    
    _getFromCache(key) {
        const entry = this._cache.get(key);
        if (!entry) return null;
        if (Date.now() - entry.ts > this.cacheTTL) {
            this._cache.delete(key);
            return null;
        }
        return entry.data;
    }
    
    _setCache(key, data) {
        this._cache.set(key, { data, ts: Date.now() });
    }
    
    _buildKey(filters) {
        return `${this.collection}:${JSON.stringify(filters)}`;
    }
}
```

**Resultado:** Elimina 8+ caches ad-hoc, centraliza invalidação, e cada `service.create/update/delete` invalida automaticamente.

### 2.2 Estratégia de Cache Local + Persistência de Sessão

| Camada | TTL | Mecanismo | Propósito |
|--------|-----|-----------|-----------|
| **L1: In-Memory** | 30-120s | `Map` no Service | Hot data: paradas ativas, planning do dia |
| **L2: SessionStorage** | Duração da aba | `sessionStorage` | Dados semi-estáticos: products, machine_priorities |
| **L3: IndexedDB** | 24h | `idb-keyval` (2KB lib) | Dados pesados: production_entries, downtime_entries |

```javascript
// Exemplo: planning.service.js com cache em camadas
export class PlanningService extends BaseService {
    constructor() {
        super('planning', { cacheTTL: 120000 }); // 2 min in-memory
    }
    
    async getForDate(date) {
        // L1: In-memory
        const memKey = `planning:${date}`;
        const mem = this._getFromCache(memKey);
        if (mem) return mem;
        
        // L2: SessionStorage
        const session = sessionStorage.getItem(memKey);
        if (session) {
            const parsed = JSON.parse(session);
            if (Date.now() - parsed.ts < 300000) { // 5 min
                this._setCache(memKey, parsed.data);
                return parsed.data;
            }
        }
        
        // L3: Firebase
        const data = await this._fetchFromFirestore({ 
            where: [['date', '==', date]] 
        });
        this._setCache(memKey, data);
        sessionStorage.setItem(memKey, JSON.stringify({ data, ts: Date.now() }));
        return data;
    }
}
```

### 2.3 onSnapshot vs getDoc — Guia de Decisão

```
┌──────────────────────────────────┬────────────────┬──────────────────────┐
│           Cenário                │   Usar         │   Por quê            │
├──────────────────────────────────┼────────────────┼──────────────────────┤
│ Dashboard TV (sempre aberto)     │ onSnapshot     │ 1 read + delta reads │
│ active_downtimes (estado real)   │ onSnapshot     │ Precisa ser real-time│
│ production_entries (lançamento)  │ onSnapshot     │ Multi-user real-time │
│ planning (dia atual)             │ onSnapshot     │ Mudanças frequentes  │
├──────────────────────────────────┼────────────────┼──────────────────────┤
│ Análise (filtro por período)     │ getDoc + cache │ Dados históricos     │
│ Relatórios                       │ getDoc + cache │ Leitura única        │
│ machine_priorities               │ getDoc + cache │ Muda raramente       │
│ products (database)              │ getDoc + cache │ Estático (5min TTL)  │
│ machine_schedule                 │ getDoc + cache │ Muda 1x/semana       │
│ Admin (busca pontual)            │ getDoc         │ Sem cache necessário │
└──────────────────────────────────┴────────────────┴──────────────────────┘
```

**Estimativa de economia:**
- Abas de análise/relatórios atualmente fazem `getDoc` a cada troca de aba → com cache L2 (SessionStorage), reduz **~70% das leituras** intra-sessão.
- `onSnapshot` em `active_downtimes` com 10 máquinas = ~10 reads/hora (delta) vs polling a cada 60s = ~600 reads/hora → **98% redução** já implementada parcialmente.
- `machine_priorities`, `products`, `machine_schedule` = dados quase estáticos → cache de **5-10 min** elimina ~95% das leituras.

---

## 3. Estratégia de Migração Cirúrgica (3 Fases)

### Visão Geral das Fases

```
FASE 1 (2-3 semanas)          FASE 2 (4-6 semanas)         FASE 3 (4-6 semanas)
─────────────────────         ────────────────────          ────────────────────
"Fundação"                    "Extração Progressiva"        "Consolidação"
                              
• Core + Services             • Controllers extraídos       • Remover bridge.js
• Bridge.js (window.*)        • Components isolados         • Remover script.js legado
• script.js intocado          • script.js encolhendo        • Testes E2E completos
• Zero mudança no HTML        • HTML muda <script> tags     • Deploy final
```

---

### FASE 1: Fundação (Semanas 1-3)

**Objetivo:** Criar a nova estrutura ao LADO do monolito, funcionando em paralelo.

#### Passo 1.1 — Setup do Build System

```html
<!-- index.html — adicionar ao final do <body>, DEPOIS do script.js -->
<script type="module" src="src/index.js"></script>
```

> **Nota:** `<script type="module">` é naturalmente deferred e executa DEPOIS de scripts normais. Isso garante que `window.*` do `script.js` já existem quando os modules inicializam.

Não é necessário bundler (Webpack/Vite) nesta fase. Browsers modernos suportam ES6 Modules nativamente. Um bundler pode ser adicionado na Fase 3 para minificação.

#### Passo 1.2 — Extrair Core (sem tocar script.js)

```javascript
// src/core/event-bus.js
const listeners = new Map();

export const EventBus = {
    on(event, callback) {
        if (!listeners.has(event)) listeners.set(event, new Set());
        listeners.get(event).add(callback);
        return () => listeners.get(event)?.delete(callback);
    },
    
    emit(event, data) {
        listeners.get(event)?.forEach(cb => {
            try { cb(data); } catch(e) { console.error(`EventBus [${event}]:`, e); }
        });
    },
    
    off(event, callback) {
        listeners.get(event)?.delete(callback);
    }
};
```

```javascript
// src/core/state-manager.js
import { EventBus } from './event-bus.js';

class StateManager {
    #state = {};
    #timestamps = {};
    #defaultTTL = 120000;
    
    get(key) { return this.#state[key] ?? null; }
    
    set(key, data) {
        this.#state[key] = data;
        this.#timestamps[key] = Date.now();
        EventBus.emit(`state:${key}:updated`, data);
    }
    
    isFresh(key, ttl = this.#defaultTTL) {
        return this.#timestamps[key] && (Date.now() - this.#timestamps[key] < ttl);
    }
    
    invalidate(key) {
        if (key) {
            delete this.#state[key];
            delete this.#timestamps[key];
        } else {
            this.#state = {};
            this.#timestamps = {};
        }
        EventBus.emit(`state:${key || '*'}:invalidated`);
    }
}

export const stateManager = new StateManager();
```

#### Passo 1.3 — Extrair Services (sem tocar script.js)

```javascript
// src/services/firebase-client.js
// Usa o Firebase já inicializado pelo script.js
export function getDb() {
    return window.db; // Já inicializado em script.js linha 1288
}

export function getAuth() {
    return window.authSystem;
}

export function getTimestamp() {
    return firebase.firestore.FieldValue.serverTimestamp();
}
```

```javascript
// src/services/downtime.service.js
import { BaseService } from './base.service.js';

export class DowntimeService extends BaseService {
    constructor() {
        super('downtime_entries', { cacheTTL: 60000 });
    }
    
    async getByDateRange(startDate, endDate) {
        return this.getAll({
            where: [
                ['data', '>=', startDate],
                ['data', '<=', endDate]
            ]
        });
    }
    
    async getByMachine(machineId) {
        const all = await this.getAll();
        return all.filter(d => 
            (d.machineId || d.machine) === machineId
        );
    }
    
    async deleteByReason(reason) {
        const all = await this.getAll({}, true);
        const matching = all.filter(d => 
            (d.motivo || d.reason || '').includes(reason)
        );
        
        const batch = this.db.batch();
        for (const item of matching) {
            batch.delete(this.db.collection(this.collection).doc(item.id));
        }
        await batch.commit();
        this.invalidateCache();
        return matching.length;
    }
}

export const downtimeService = new DowntimeService();
```

#### Passo 1.4 — Bridge.js (Cola entre mundos)

```javascript
// src/legacy/bridge.js
// 
// TEMPORÁRIO — Este arquivo será removido na Fase 3.
// Conecta os módulos ES6 ao legado window.* do script.js
//

import { stateManager } from '../core/state-manager.js';
import { EventBus } from '../core/event-bus.js';
import { downtimeService } from '../services/downtime.service.js';
import { productionService } from '../services/production.service.js';

// ── Sincronizar DataStore legado → StateManager novo ──
function syncLegacyToModern() {
    if (window.DataStore) {
        // Quando o DataStore legado atualiza, replicar no novo StateManager
        const collections = [
            'planning', 'productionOrders', 'productionEntries',
            'activeDowntimes', 'extendedDowntimeLogs', 'downtimeEntries'
        ];
        
        collections.forEach(col => {
            window.DataStore.subscribe(col, (data) => {
                stateManager.set(col, data);
            });
        });
    }
}

// ── Expor Services modernos como window.* para o legado usar ──
function exposeServicesToLegacy() {
    window.services = {
        downtime: downtimeService,
        production: productionService,
    };
    
    // Expor EventBus para que o legado possa emitir/escutar eventos
    window.EventBus = EventBus;
}

// ── Inicializar ponte ──
export function initBridge() {
    syncLegacyToModern();
    exposeServicesToLegacy();
    console.log('🌉 Bridge: legado ↔ módulos conectados');
}
```

```javascript
// src/index.js — Entry point (Fase 1)
import { initBridge } from './legacy/bridge.js';

// Esperar o script.js terminar de inicializar
const waitForLegacy = () => new Promise(resolve => {
    if (window.db && window.DataStore) return resolve();
    
    const check = setInterval(() => {
        if (window.db && window.DataStore) {
            clearInterval(check);
            resolve();
        }
    }, 100);
});

async function bootstrap() {
    await waitForLegacy();
    initBridge();
    console.log('✅ Módulos ES6 inicializados sobre o legado');
}

bootstrap();
```

**Resultado da Fase 1:** A nova arquitetura roda EM PARALELO. Nenhuma funcionalidade existente é afetada. É possível usar `window.services.downtime.getByDateRange(...)` no console para testar.

---

### FASE 2: Extração Progressiva (Semanas 4-9)

**Objetivo:** Mover lógica do `script.js` para módulos, um Controller de cada vez.

#### Ordem de Extração (menor risco → maior risco):

| # | Controller | Linhas no script.js | Risco | Motivo |
|---|-----------|---------------------|-------|--------|
| 1 | `pcp.controller` | ~48220–49604 | 🟢 Baixo | IIFE isolado, poucas dependências |
| 2 | `tooling.controller` | ~49605–50374 | 🟢 Baixo | IIFE isolado |
| 3 | `setup.controller` | ~47070–48220 | 🟢 Baixo | Auto-contido |
| 4 | `reports.controller` | ~42000–43145 | 🟢 Baixo | Já é IIFE (ReportsModule) |
| 5 | `orders.controller` | ~43170–43990 | 🟢 Baixo | Já é IIFE (OrdersPageModule) |
| 6 | `leadership.controller` | ~44003–47070 | 🟡 Médio | Múltiplas sub-features |
| 7 | `monitoring.controller` | ~24823–26100 | 🟡 Médio | Depende de production data |
| 8 | `admin.controller` | ~26155–30004 | 🟡 Médio | CRUD cross-collection |
| 9 | `pmp.controller` | ~32911–34538 | 🟡 Médio | PMP borra + sucata |
| 10 | `quality.controller` | ~17446–19100 | 🟡 Médio | Depende de planning |
| 11 | `planning.controller` | ~19108–20400 | 🟠 Alto | Core data, muitas referências |
| 12 | `analysis.controller` | ~4600–7060 | 🟠 Alto | Maior bloco, mais charts |
| 13 | `downtime-analysis.controller` | ~7060–9600 | 🟠 Alto | Cache complexo |
| 14 | `launch.controller` | ~37050–40740 | 🔴 Crítico | Core da aplicação |

#### Processo de Extração (para cada controller):

```
1. COPIAR a lógica para src/controllers/xxx.controller.js
2. SUBSTITUIR chamadas diretas ao Firebase por imports do Service
3. SUBSTITUIR window.* por imports de módulos ou EventBus
4. TESTAR o módulo novo independentemente
5. No script.js, COMENTAR o código original (não apagar)
6. No script.js, ADICIONAR: window.XxxController = await import('./src/controllers/xxx.controller.js')
7. TESTAR novamente em produção
8. Após 1 semana sem bugs, APAGAR o código comentado
```

#### Exemplo: Extração do PCP Controller

**ANTES (no script.js, ~1.400 linhas):**
```javascript
// Linha ~48220 do script.js
// ==== PCP MODULE ====
const pcpState = { /* ... */ };
function setupPCPSubTabs() { /* 70 linhas */ }
function setupPCPPage() { /* 160 linhas */ } 
function setupPCPPriorityModal() { /* 125 linhas */ }
function renderPriorityBadge(priority) { /* 45 linhas */ }
function updatePCPKPIs() { /* 80 linhas */ }
function renderPCPTable() { /* 230 linhas */ }
function exportPCPToExcel() { /* 210 linhas */ }
// Tudo dentro da closure DOMContentLoaded, acessa `db` diretamente
```

**DEPOIS:**
```javascript
// src/controllers/pcp.controller.js
import { ordersService } from '../services/orders.service.js';
import { planningService } from '../services/planning.service.js';
import { productionService } from '../services/production.service.js';
import { EventBus } from '../core/event-bus.js';
import { formatDate, getProductionDateString } from '../utils/date.utils.js';
import { DataTable } from '../components/data-table.js';

const PRIORITY_COLORS = {
    0: { label: 'URGENTE', bg: '#dc3545', color: '#fff' },
    1: { label: 'ALTA', bg: '#fd7e14', color: '#fff' },
    2: { label: 'MÉDIA', bg: '#ffc107', color: '#000' },
    3: { label: 'NORMAL', bg: '#28a745', color: '#fff' },
    99: { label: 'SEM PRIORIDADE', bg: '#6c757d', color: '#fff' },
};

class PCPController {
    #state = {
        data: [],
        filters: { status: 'all', machine: 'all' },
        sort: { field: 'priority', direction: 'asc' },
    };
    
    #elements = {};
    
    async init() {
        // Verificar permissão
        const auth = window.authSystem;
        if (!auth?.getCurrentUser()) return;
        
        const role = auth.getCurrentUser().role;
        if (!['admin', 'gestor', 'pcp'].includes(role)) {
            this.#showAccessDenied();
            return;
        }
        
        this.#cacheElements();
        this.#setupSubTabs();
        this.#setupPriorityModal();
        this.#setupEventListeners();
        await this.loadData();
    }
    
    async loadData() {
        const date = getProductionDateString();
        
        // Todas as queries em paralelo via Services
        const [orders, planning, entries, priorities] = await Promise.all([
            ordersService.getAll(),
            planningService.getForDate(date),
            productionService.getForDate(date),
            ordersService.getPriorities(),
        ]);
        
        this.#state.data = this.#mergeData(orders, planning, entries, priorities);
        this.#render();
        this.#updateKPIs();
    }
    
    #mergeData(orders, planning, entries, priorities) {
        return orders.map(order => {
            const plan = planning.find(p => p.orderNumber === order.order_number);
            const produced = entries
                .filter(e => e.orderNumber === order.order_number)
                .reduce((sum, e) => sum + (Number(e.quantity) || 0), 0);
            
            const p = priorities[order.id];
            const priority = (p !== null && p !== undefined && !isNaN(p)) 
                ? Number(p) : 99;
            
            return {
                ...order,
                planData: plan,
                produced,
                priority,
                progress: plan ? (produced / (Number(plan.quantity) || 1)) * 100 : 0,
            };
        });
    }
    
    #render() {
        const sorted = [...this.#state.data].sort((a, b) => {
            const dir = this.#state.sort.direction === 'asc' ? 1 : -1;
            return (a[this.#state.sort.field] - b[this.#state.sort.field]) * dir;
        });
        
        // ... renderização da tabela PCP
    }
    
    renderPriorityBadge(priority) {
        const config = PRIORITY_COLORS[priority] || PRIORITY_COLORS[99];
        return `<span style="background:${config.bg};color:${config.color};
                padding:2px 8px;border-radius:4px;font-size:11px;font-weight:bold">
                ${config.label}</span>`;
    }
    
    #updateKPIs() {
        const total = this.#state.data.length;
        const completed = this.#state.data.filter(d => d.progress >= 100).length;
        const inProgress = this.#state.data.filter(d => d.progress > 0 && d.progress < 100).length;
        
        // ... atualização dos KPI cards
    }
    
    async exportToExcel() {
        // ... export logic using export.utils.js
    }
    
    // ... outros métodos privados
    
    destroy() {
        // Cleanup: remove event listeners, unsubscribe
    }
}

export const pcpController = new PCPController();
```

**No script.js (substituição temporária):**
```javascript
// Linha ~48220 — CÓDIGO ORIGINAL COMENTADO
// TODO: Fase 2 - Migrado para src/controllers/pcp.controller.js
/*
const pcpState = { ... };
function setupPCPSubTabs() { ... }
... (código original intacto, apenas comentado)
*/

// Delegação para módulo novo
async function setupPCPPage() {
    const { pcpController } = await import('./src/controllers/pcp.controller.js');
    await pcpController.init();
}
```

#### Gerenciamento de Variáveis Globais Durante a Transição

| Variável Global | Usado em | Estratégia |
|-----------------|----------|------------|
| `window.db` | ~200 locais | Manter na Fase 2. Substituir por `import { getDb }` na Fase 3 |
| `window.DataStore` | ~50 locais | Bridge sincroniza com `stateManager`. Remover na Fase 3 |
| `window.CacheManager` | ~30 locais | Services encapsulam. Remover na Fase 3 |
| `window.authSystem` | ~40 locais | `auth.service.js` wraps. Remover na Fase 3 |
| `window.databaseModule` | ~25 locais | Já é módulo separado. Importar diretamente na Fase 3 |
| `selectedMachineData` | ~15 locais | `stateManager.set('selectedMachine', ...)` |
| `machineStatus` | ~10 locais | `stateManager.set('machineStatus', ...)` |

**Padrão temporário no bridge.js:**
```javascript
// Para cada variável global migrada, criar um getter/setter proxy
Object.defineProperty(window, 'DataStore', {
    get() {
        console.warn('⚠️ window.DataStore é legado. Use import { stateManager }');
        return legacyDataStoreProxy; // Proxy que redireciona para stateManager
    }
});
```

---

### FASE 3: Consolidação (Semanas 10-15)

**Objetivo:** Remover todo o código legado e o bridge.

1. **Remover `bridge.js`** — todos os controllers já importam services diretamente
2. **Remover `script.js`** — substituir por `<script type="module" src="src/index.js">`
3. **Adicionar bundler** (Vite recomendado) para:
   - Tree-shaking (eliminar código morto)
   - Minificação
   - Code-splitting por rota/aba
4. **Testes E2E** com Playwright para todas as abas

**index.html final:**
```html
<!-- De: -->
<script src="script.js?v=20260216-fix-priority-zero"></script>

<!-- Para: -->
<script type="module" src="dist/index.js"></script>
```

---

## 4. Exemplo Completo: Before vs After

### Cenário: Carregar dados de análise de paradas e renderizar gráfico

#### ANTES (Monolítico — ~120 linhas no script.js)

```javascript
// Dentro da closure DOMContentLoaded do script.js
// Variáveis espalhadas pelo arquivo:
let cachedDowntimeDetails = null;     // linha ~6930
let cachedDowntimeDataForChart = [];  // linha ~12910

async function loadDowntimeAnalysis() {
    cachedDowntimeDetails = null;
    cachedDowntimeDataForChart = [];
    
    const startDate = document.getElementById('analysis-start-date').value;
    const endDate = document.getElementById('analysis-end-date').value;
    
    if (!startDate || !endDate) {
        showNotification('Selecione o período', 'warning');
        return;
    }
    
    showLoadingState('downtime-analysis-container', true);
    
    try {
        // Acesso direto ao Firebase — sem abstração
        const snapshot = await db.collection('downtime_entries')
            .where('data', '>=', startDate)
            .where('data', '<=', endDate)
            .get();
        
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        cachedDowntimeDetails = data;
        
        // Processamento inline
        const byReason = {};
        data.forEach(entry => {
            const reason = entry.motivo || 'Sem motivo';
            if (!byReason[reason]) byReason[reason] = { count: 0, totalMinutes: 0 };
            byReason[reason].count++;
            byReason[reason].totalMinutes += entry.duration_minutes || 0;
        });
        
        // Renderização inline — tightly coupled
        const labels = Object.keys(byReason);
        const values = labels.map(l => byReason[l].totalMinutes);
        
        // Chart.js direto, sem cleanup
        if (window.downtimeReasonsChart) {
            window.downtimeReasonsChart.destroy();
        }
        
        const ctx = document.getElementById('downtime-reasons-chart').getContext('2d');
        window.downtimeReasonsChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Minutos de Parada',
                    data: values,
                    backgroundColor: 'rgba(255, 99, 132, 0.5)'
                }]
            }
        });
        
        cachedDowntimeDataForChart = data; // Cache para chart
        
    } catch (error) {
        console.error('Erro ao carregar análise:', error);
        showNotification('Erro ao carregar dados', 'error');
    } finally {
        showLoadingState('downtime-analysis-container', false);
    }
}
```

**Problemas:**
- 🔴 Firebase acoplado — impossível testar sem Firestore
- 🔴 Cache manual com 3+ variáveis desconectadas
- 🔴 Chart.js inline — se o padrão muda, tem que alterar em 10+ gráficos
- 🔴 DOM inline — difícil de reutilizar em outra view
- 🔴 Error handling inconsistente

---

#### DEPOIS (Modular — SOLID)

```javascript
// src/services/downtime.service.js
// S: Single Responsibility — Só lida com dados de downtime
// O: Open/Closed — Extensível via herança (BaseService)
// D: Dependency Inversion — Depende de abstração (BaseService), não de Firebase direto

import { BaseService } from './base.service.js';

export class DowntimeService extends BaseService {
    constructor() {
        super('downtime_entries', { cacheTTL: 60000 });
    }
    
    async getByDateRange(startDate, endDate) {
        return this.getAll({
            where: [
                ['data', '>=', startDate],
                ['data', '<=', endDate]
            ]
        });
    }
    
    aggregateByReason(entries) {
        const grouped = {};
        for (const entry of entries) {
            const reason = entry.motivo || entry.reason || 'Sem motivo';
            if (!grouped[reason]) {
                grouped[reason] = { reason, count: 0, totalMinutes: 0, entries: [] };
            }
            grouped[reason].count++;
            grouped[reason].totalMinutes += entry.duration_minutes || 0;
            grouped[reason].entries.push(entry);
        }
        return Object.values(grouped)
            .sort((a, b) => b.totalMinutes - a.totalMinutes);
    }
}

export const downtimeService = new DowntimeService();
```

```javascript
// src/components/chart-factory.js
// S: Single Responsibility — Só cria/destrói charts
// I: Interface Segregation — API mínima: create, update, destroy

const activeCharts = new Map();

export const ChartFactory = {
    create(canvasId, config) {
        // Destroy existing chart on same canvas
        this.destroy(canvasId);
        
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.warn(`Canvas #${canvasId} not found`);
            return null;
        }
        
        const chart = new Chart(canvas.getContext('2d'), config);
        activeCharts.set(canvasId, chart);
        return chart;
    },
    
    destroy(canvasId) {
        const existing = activeCharts.get(canvasId);
        if (existing) {
            existing.destroy();
            activeCharts.delete(canvasId);
        }
    },
    
    destroyAll() {
        for (const [id, chart] of activeCharts) {
            chart.destroy();
        }
        activeCharts.clear();
    },
    
    // Preset configs para charts padronizados
    barConfig(labels, data, options = {}) {
        return {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: options.label || 'Valor',
                    data,
                    backgroundColor: options.colors || 'rgba(255, 99, 132, 0.5)',
                    borderColor: options.borderColors || 'rgba(255, 99, 132, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: options.showLegend ?? false },
                    title: { display: !!options.title, text: options.title }
                },
                scales: {
                    y: { beginAtZero: true, title: { display: true, text: options.yLabel || '' } }
                },
                ...options.chartOptions
            }
        };
    }
};
```

```javascript
// src/controllers/downtime-analysis.controller.js
// S: Single Responsibility — Coordena UI de análise de paradas
// D: Dependency Inversion — Depende de abstrações (service, chartFactory)

import { downtimeService } from '../services/downtime.service.js';
import { ChartFactory } from '../components/chart-factory.js';
import { showNotification } from '../components/notification.js';
import { showLoading, hideLoading } from '../utils/dom.utils.js';

class DowntimeAnalysisController {
    #elements = {};
    #currentData = [];
    
    init() {
        this.#cacheElements();
        this.#bindEvents();
    }
    
    #cacheElements() {
        this.#elements = {
            startDate: document.getElementById('analysis-start-date'),
            endDate: document.getElementById('analysis-end-date'),
            container: document.getElementById('downtime-analysis-container'),
            reasonsChart: 'downtime-reasons-chart', // Canvas ID
        };
    }
    
    #bindEvents() {
        document.getElementById('btn-load-downtime-analysis')
            ?.addEventListener('click', () => this.loadAnalysis());
    }
    
    async loadAnalysis() {
        const startDate = this.#elements.startDate?.value;
        const endDate = this.#elements.endDate?.value;
        
        if (!startDate || !endDate) {
            showNotification('Selecione o período', 'warning');
            return;
        }
        
        showLoading(this.#elements.container);
        
        try {
            // Service lida com cache internamente
            this.#currentData = await downtimeService.getByDateRange(startDate, endDate);
            
            this.#renderReasonsChart();
            
        } catch (error) {
            console.error('[DowntimeAnalysis]', error);
            showNotification('Erro ao carregar dados de paradas', 'error');
        } finally {
            hideLoading(this.#elements.container);
        }
    }
    
    #renderReasonsChart() {
        const aggregated = downtimeService.aggregateByReason(this.#currentData);
        
        const labels = aggregated.map(a => a.reason);
        const values = aggregated.map(a => a.totalMinutes);
        
        const config = ChartFactory.barConfig(labels, values, {
            label: 'Minutos de Parada',
            yLabel: 'Minutos',
            title: 'Paradas por Motivo',
            colors: this.#generateColors(labels.length),
        });
        
        ChartFactory.create(this.#elements.reasonsChart, config);
    }
    
    #generateColors(count) {
        const palette = [
            '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0',
            '#9966FF', '#FF9F40', '#FF6384', '#C9CBCF'
        ];
        return Array.from({ length: count }, (_, i) => palette[i % palette.length]);
    }
    
    destroy() {
        ChartFactory.destroy(this.#elements.reasonsChart);
        this.#currentData = [];
    }
}

export const downtimeAnalysisController = new DowntimeAnalysisController();
```

**Diferenças-chave:**

| Aspecto | Antes (Monolítico) | Depois (Modular) |
|---------|---------------------|-------------------|
| **Acoplamento** | Firebase direto (`db.collection(...)`) | Via Service (testável com mock) |
| **Cache** | 3+ variáveis globais independentes | Encapsulado no Service, invalidação automática |
| **Chart.js** | Inline com `destroy` manual | `ChartFactory` centralizado, auto-cleanup |
| **Estado** | `let cachedX` solto na closure | `#currentData` privado no controller |
| **Testabilidade** | Impossível sem Firebase | Mock do Service basta |
| **Reutilização** | 0% — tudo inline | `ChartFactory` reutilizável em 10+ charts |
| **Linhas** | ~120 entrelaçadas | ~60 por arquivo, 3 arquivos declarativos |

---

## 5. Testes em Paralelo (Fase 2)

### Estratégia de Feature Flag

```javascript
// src/config/feature-flags.js
export const FLAGS = {
    USE_MODULAR_PCP: true,        // Migrado
    USE_MODULAR_REPORTS: true,    // Migrado
    USE_MODULAR_ANALYSIS: false,  // Ainda no legado
    USE_MODULAR_LAUNCH: false,    // Ainda no legado — último a migrar
};
```

```javascript
// No script.js (durante transição):
async function setupPCPPage() {
    // Feature flag: usar módulo novo ou legado?
    const { FLAGS } = await import('./src/config/feature-flags.js');
    
    if (FLAGS.USE_MODULAR_PCP) {
        const { pcpController } = await import('./src/controllers/pcp.controller.js');
        await pcpController.init();
    } else {
        // Código legado original
        setupPCPPageLegacy();
    }
}
```

Isso permite reverter instantaneamente para o código legado mudando `true → false` se houver qualquer problema.

---

## 6. Checklist de Validação por Fase

### Fase 1 ✓
- [ ] `src/index.js` carrega sem erros no console
- [ ] `window.services.downtime.getAll()` retorna dados no console
- [ ] Nenhuma funcionalidade existente foi alterada
- [ ] `bridge.js` sincroniza DataStore → StateManager

### Fase 2 ✓ (por controller)
- [ ] Feature flag `true` → módulo novo funciona identicamente
- [ ] Feature flag `false` → legado continua funcionando
- [ ] Cache invalidation funciona no módulo novo
- [ ] Exportar para Excel/PDF funciona igual
- [ ] Permissões/roles respeitadas

### Fase 3 ✓
- [ ] `script.js` removido completamente
- [ ] `bridge.js` removido completamente
- [ ] Build com Vite produz bundle menor que `script.js` original
- [ ] Todos os 14 controllers testados E2E
- [ ] Firebase reads/hora reduzidos em >50%

---

## 7. Estimativa de Impacto

| Métrica | Atual | Pós-Refatoração |
|---------|-------|-----------------|
| **Maior arquivo** | 51.400 linhas | ~500 linhas (launch.controller) |
| **Arquivos** | 1 + 8 auxiliares | ~45 módulos focados |
| **Caches** | 8+ ad-hoc desconectados | 1 StateManager + Service-level |
| **Firebase reads/hora** | ~2.000 (estimado) | ~400 (cache L2 + onSnapshot) |
| **Tempo de onboarding** | 2-3 dias (entender script.js) | 2-4 horas (módulos nomeados) |
| **Cobertura de testes** | 0% | Testável (services mockáveis) |

---

## Próximo Passo Recomendado

Quando estiver pronto para iniciar a Fase 1, diga **"Iniciar Fase 1"** e eu criarei os seguintes arquivos reais no projeto:

1. `src/core/event-bus.js`
2. `src/core/state-manager.js`
3. `src/services/base.service.js`
4. `src/services/firebase-client.js`
5. `src/legacy/bridge.js`
6. `src/index.js`
7. Adição do `<script type="module">` no `index.html`

Tudo sem tocar uma linha do `script.js`.
