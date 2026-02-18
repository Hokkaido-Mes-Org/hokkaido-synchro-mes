# HokkaidoMES — Mapa de Arquivos para Deploy

> Gerado em: 17/02/2026  
> Objetivo: Listar todos os arquivos necessários para funcionalidade 100% e identificar arquivos obsoletos para exclusão do repositório.

---

## 1. ARQUIVOS OBRIGATÓRIOS (manter no repositório)

### Páginas HTML (entry points)

| Arquivo | Função |
|---------|--------|
| `index.html` | Aplicação principal (SPA) |
| `login.html` | Página de login (standalone) |
| `dashboard-tv.html` | Dashboard para TV (standalone, JS inline) |
| `admin-fix-downtime.html` | Ferramenta admin de paradas (standalone, JS inline) |
| `acompanhamento-turno.html` | Acompanhamento de turno (standalone, JS inline) |

### JavaScript raiz (carregados pelo index.html)

| Arquivo | Ref. em index.html |
|---------|-------------------|
| `auth.js` | L12 — sistema de autenticação |
| `database.js` | L8349 — banco de máquinas e produtos |
| `materia-prima-database.js` | L8348 — banco de matérias-primas |
| `traceability-system.js` | L8350 — rastreabilidade |
| `advanced-kpis.js` | L8497 — KPIs avançados |
| `auto-pareto-analysis.js` | L8498 — análise de Pareto automática |
| `machine-queue.js` | L8499 — fila de máquinas |
| `script.js` | L8500 — core do sistema (~19k linhas) |
| `erp-import.js` | L8501 — importação ERP |
| `machine-schedule.js` | L8502 — agenda de máquinas |
| `service-worker.js` | L17 — push notifications |

### CSS

| Arquivo | Ref. em index.html |
|---------|-------------------|
| `style.css` | L257 — estilos customizados |

### Módulos ES6 (`src/`)

#### Entry point
| Arquivo | Importado por |
|---------|---------------|
| `src/index.js` | index.html L8505 (`<script type="module">`) |

#### Core
| Arquivo | Importado por |
|---------|---------------|
| `src/core/event-bus.js` | state-manager, bridge, base.service, + 9 controllers |
| `src/core/state-manager.js` | bridge, base.service, orders.service |

#### Config
| Arquivo | Importado por |
|---------|---------------|
| `src/config/feature-flags.js` | src/index.js |

#### Legacy bridge
| Arquivo | Importado por |
|---------|---------------|
| `src/legacy/bridge.js` | src/index.js |

#### Services
| Arquivo | Importado por |
|---------|---------------|
| `src/services/firebase-client.js` | base.service, + 12 controllers |
| `src/services/base.service.js` | production/downtime/planning/orders/logs services |
| `src/services/production.service.js` | bridge.js |
| `src/services/downtime.service.js` | bridge.js |
| `src/services/downtime-shift.service.js` | script.js, analysis.controller |
| `src/services/planning.service.js` | bridge.js |
| `src/services/orders.service.js` | bridge.js |
| `src/services/logs.service.js` | bridge.js |

#### Utils
| Arquivo | Importado por |
|---------|---------------|
| `src/utils/number.utils.js` | src/index.js, launch, analysis, planning controllers |
| `src/utils/plan.utils.js` | src/index.js, launch, analysis, planning controllers |
| `src/utils/product.utils.js` | src/index.js, launch, analysis, planning controllers |
| `src/utils/logger.js` | src/index.js, + 8 controllers |
| `src/utils/auth.utils.js` | 8 controllers |
| `src/utils/date.utils.js` | downtime-shift.service, + 7 controllers |
| `src/utils/dom.utils.js` | 7 controllers |
| `src/utils/color.utils.js` | script.js, + 5 controllers |

#### Components
| Arquivo | Importado por |
|---------|---------------|
| `src/components/notification.js` | src/index.js, + 7 controllers |

#### Controllers (17 — todos carregados via `import()` dinâmico no script.js)
| Arquivo | import() em script.js |
|---------|----------------------|
| `src/controllers/launch.controller.js` | L9023 |
| `src/controllers/planning.controller.js` | L9031 |
| `src/controllers/orders.controller.js` | L9039 |
| `src/controllers/analysis.controller.js` | L9052 |
| `src/controllers/extended-downtime.controller.js` | L4311 + L9062 |
| `src/controllers/downtime-grid.controller.js` | L4316 |
| `src/controllers/dashboard.controller.js` | L4321 |
| `src/controllers/resumo.controller.js` | L4326 |
| `src/controllers/monitoring.controller.js` | L9071 |
| `src/controllers/historico.controller.js` | L9080 |
| `src/controllers/admin.controller.js` | L9089 |
| `src/controllers/reports.controller.js` | L9109 |
| `src/controllers/leadership.controller.js` | L9118 |
| `src/controllers/setup.controller.js` | L9127 |
| `src/controllers/tooling.controller.js` | L9136 |
| `src/controllers/pcp.controller.js` | L9145 |
| `src/controllers/pmp.controller.js` | L9155 |

---

## 2. ARQUIVOS ÓRFÃOS NO `src/` (podem ser removidos)

Estes existem no `src/` mas **nenhum arquivo os importa**:

| Arquivo | Motivo |
|---------|--------|
| `src/core/listener-manager.js` | Comentado no index.js: "duplicava o listenerManager do script.js" |
| `src/services/firebase-cache.service.js` | Nunca importado por nenhum módulo |
| `src/components/cache-dashboard.js` | Nunca importado por nenhum módulo |

---

## 3. ARQUIVOS PARA EXCLUIR DO REPOSITÓRIO

### Já removidos do workspace local (excluir do GitHub se ainda existirem)

Estes arquivos apareciam no repositório mas já foram removidos durante a refatoração modular:

| Arquivo | Era o quê |
|---------|-----------|
| `spc-controller.js` | Controlador SPC — código migrado para analysis.controller.js |
| `predictive-analytics.js` | Analytics preditivos — código migrado para o módulo de análise |
| `reports-module.js` | Módulo de relatórios — substituído por `src/controllers/reports.controller.js` |
| `analytics-ia-core .js` | Core IA analytics (com espaço no nome) — removido |
| `index.txt` | Arquivo texto legado — removido |
| `documentacao-paradas-visual.html` | Documentação visual — removido |
| `fluxograma-sistema.html` | Fluxograma do sistema — removido |
| `guia-integracao-setores.html` | Guia de integração — removido |
| `sucata-section-to-add.html` | Template de seção sucata — removido |
| `test-h31-debug.js` | Script de debug H31 — removido |
| `test-integration.js` | Testes de integração — removido |
| `test-machine-grid.html` | Teste de grid de máquinas — removido |
| `documentacao-sistema-mes.md` | Documentação do sistema — removido |
| `ANALISE-IMPACTO-IMPLEMENTACAO-MACHINE-SCHEDULE.md` | Análise de impacto — removido |
| `ANALISE-MIGRACAO-PYTHON.md` | Análise de migração — removido |
| `DOCUMENTACAO-PARADAS.md` | Documentação de paradas — removido |

### Documentação (opcional — não afeta funcionalidade)

Estes são documentos internos de referência. Remover não afeta funcionalidade:

| Arquivo | Conteúdo |
|---------|----------|
| `ANALISE-OTIMIZACAO-FIREBASE.md` | Análise de otimização Firebase |
| `ARQUITETURA-MODULAR-MES.md` | Documentação da arquitetura modular |
| `ESTUDO-LEITURAS-POR-ABA.md` | Estudo de leituras Firestore por aba |
| `UNIFICACAO-PARADAS-DETALHADA.md` | Documentação de unificação de paradas |

### Ferramentas dev (opcional — não afeta funcionalidade)

| Arquivo | Conteúdo |
|---------|----------|
| `_count_fns.ps1` | Script PowerShell para contar funções |
| `_count_fns.py` | Script Python para contar funções |

---

## 4. RESUMO RÁPIDO

| Categoria | Quantidade |
|-----------|-----------|
| **Arquivos obrigatórios (raiz)** | 17 (5 HTML + 11 JS + 1 CSS) |
| **Arquivos obrigatórios (src/)** | 41 (1 index + 2 core + 1 config + 1 legacy + 8 services + 8 utils + 2 components + 1 feature-flags + 17 controllers) |
| **Total obrigatório** | **58 arquivos** |
| Órfãos em src/ (podem remover) | 3 |
| Já removidos (excluir do GitHub) | 16 |
| Documentação (opcional) | 4 |
| Ferramentas dev (opcional) | 2 |

---

## 5. ESTRUTURA FINAL LIMPA

```
backupHokkaidoMES/
├── index.html
├── login.html
├── dashboard-tv.html
├── admin-fix-downtime.html
├── acompanhamento-turno.html
├── style.css
├── auth.js
├── database.js
├── materia-prima-database.js
├── traceability-system.js
├── advanced-kpis.js
├── auto-pareto-analysis.js
├── machine-queue.js
├── script.js
├── erp-import.js
├── machine-schedule.js
├── service-worker.js
└── src/
    ├── index.js
    ├── config/
    │   └── feature-flags.js
    ├── core/
    │   ├── event-bus.js
    │   └── state-manager.js
    ├── legacy/
    │   └── bridge.js
    ├── services/
    │   ├── base.service.js
    │   ├── firebase-client.js
    │   ├── production.service.js
    │   ├── downtime.service.js
    │   ├── downtime-shift.service.js
    │   ├── planning.service.js
    │   ├── orders.service.js
    │   └── logs.service.js
    ├── utils/
    │   ├── auth.utils.js
    │   ├── color.utils.js
    │   ├── date.utils.js
    │   ├── dom.utils.js
    │   ├── logger.js
    │   ├── number.utils.js
    │   ├── plan.utils.js
    │   └── product.utils.js
    ├── components/
    │   └── notification.js
    └── controllers/
        ├── admin.controller.js
        ├── analysis.controller.js
        ├── dashboard.controller.js
        ├── downtime-grid.controller.js
        ├── extended-downtime.controller.js
        ├── historico.controller.js
        ├── launch.controller.js
        ├── leadership.controller.js
        ├── monitoring.controller.js
        ├── orders.controller.js
        ├── pcp.controller.js
        ├── planning.controller.js
        ├── pmp.controller.js
        ├── reports.controller.js
        ├── resumo.controller.js
        ├── setup.controller.js
        └── tooling.controller.js
```
