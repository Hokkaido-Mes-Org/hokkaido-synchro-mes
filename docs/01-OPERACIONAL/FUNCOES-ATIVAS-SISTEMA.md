# HokkaidoMES — Resumo das Principais Funções Ativas

> **Data:** Fevereiro 2026  
> **Versão:** Sistema Modular + Legado (Arquitetura Híbrida)  
> **Status:** Em migração para ES6 Modules

---

## 📋 Sumário Executivo

O **HokkaidoMES** é um sistema de **Execução de Manufatura (MES)** que gerencia a operação de máquinas industriais, planejamento de produção, rastreamento de paradas e análise de KPIs. O sistema funciona em arquitetura **híbrida**, combinando código legado (`script.js` - 19.047 linhas) com novos módulos ES6.

**Principais Responsabilidades:**
- 🏭 Monitoramento em tempo real de máquinas
- 📊 Coleta e análise de dados de produção
- ⏸️ Registro e análise de paradas (downtime)
- 📋 Planejamento e controle de ordens
- 📈 Geração de KPIs e relatórios
- 🔐 Autenticação e controle de acesso por perfil

---

## 🏗️ Arquitetura de Camadas

```
┌─────────────────────────────────────────────────────┐
│            Camada de Apresentação (UI)              │
│   - Controllers (uma para cada aba/feature)         │
│   - Components reutilizáveis (modal, notif, etc)    │
└────────────┬────────────────────────────────────────┘
             │ importa / dispara eventos
             ▼
┌─────────────────────────────────────────────────────┐
│          Camada de Lógica de Negócio                │
│   - Event Bus (pub/sub central)                     │
│   - State Manager (cache centralizado)              │
│   - Services (CRUD + cache + listeners)             │
└────────────┬────────────────────────────────────────┘
             │ acessa / monitora
             ▼
┌─────────────────────────────────────────────────────┐
│            Camada de Persistência                   │
│   - Firebase Firestore (23+ coleções)               │
│   - Firebase Authentication                        │
│   - Firebase Cloud Storage                          │
└─────────────────────────────────────────────────────┘
```

---

## 🔧 Componentes Principais

### 1️⃣ **Núcleo do Sistema** (`src/core/`)

#### **EventBus** - Comunicação Pub/Sub
- **Responsabilidade:** Substituir variáveis globais (`window.*`) por um sistema de eventos centralizado
- **Funções principais:**
  - `EventBus.on(event, callback)` - Escutar eventos
  - `EventBus.emit(event, data)` - Emitir eventos
  - `unsubscribe()` - Cancelar inscrição

**Exemplo de uso:**
```javascript
// Escutar quando uma parada é criada
EventBus.on('downtime:created', (data) => {
  console.log('Nova parada:', data);
});

// Emitir evento
EventBus.emit('downtime:created', { machine: 'H01', reason: 'Manutenção' });
```

#### **StateManager** - Cache Centralizado
- **Responsabilidade:** Unificar DataStore + CacheManager legados em um gerenciador de estado com TTL
- **Funções principais:**
  - `stateManager.set(key, data)` - Armazenar dados
  - `stateManager.get(key)` - Recuperar dados
  - `stateManager.isFresh(key, ttl)` - Validar se cache está fresco
  - `stateManager.invalidate(key)` - Limpar dados em cache

**Exemplo de uso:**
```javascript
stateManager.set('planning', [...planejamentos]);
const planning = stateManager.get('planning');
if (stateManager.isFresh('planning', 60000)) {
  // Usar cache (menos de 1 min)
}
```

#### **ListenerManager** - Gerenciamento de Listeners Firestore
- **Responsabilidade:** Gerenciar lifecycle (criar/remover) de listeners Firestore
- **Funções principais:**
  - `attach(name, query, callback)` - Criar listener
  - `detach(name)` - Remover listener
  - `detachAll()` - Remover todos os listeners

---

### 2️⃣ **Serviços de Dados** (`src/services/`)

Cada serviço encapsula a lógica de uma coleção Firestore com cache automático e listeners gerenciados.

#### **BaseService** - Classe Abstrata
Toda interação com Firestore herda desta classe e oferece:

**Métodos CRUD Genéricos:**
- `getAll(filters, forceRefresh)` - Buscar todos os documentos com cache
- `getById(id)` - Buscar por ID
- `create(data)` - Criar novo documento
- `update(id, data)` - Atualizar documento
- `delete(id)` - Deletar documento
- `setupListener(name, query, callback)` - Criar listener gerenciado

**Recursos:**
- ✅ Cache automático com TTL personalizável
- ✅ Listeners de tempo real gerenciados
- ✅ Invalidação centralizada de cache
- ✅ Rastreamento de hits/misses

---

#### **PlanningService** - Gestão de Planejamento
- **Coleção:** `planning`
- **Campos:** date, machine, machineId, product, productCode, quantity, orderNumber, status, turno

**Funções principais:**
- `getForDate(date)` - Buscar planejamento de um dia
- `getByMachine(machineId, date)` - Filtrar por máquina
- `getByOrder(orderNumber)` - Buscar por número de ordem
- `getByDateRange(startDate, endDate)` - Período

---

#### **DowntimeService** - Gestão de Paradas
Gerencia 3 coleções relacionadas:
1. **downtime_entries** - Registros finalizados
2. **active_downtimes** - Paradas em andamento
3. **extended_downtime_logs** - Logs de paradas prolongadas

**Funções principais:**
- `getByDateRange(startDate, endDate)` - Paradas por período
- `getByMachine(machineId)` - Paradas de uma máquina
- `aggregateByReason(entries)` - Agrupar por motivo
- `aggregateByCategory(entries)` - Agrupar por categoria
- `getMostCommonReasons(count)` - Razões mais comuns

---

#### **ProductionService** - Dados de Produção
- **Coleção:** `production_entries`
- **Campos:** machineId, machineCodeERP, quantity, startTime, endTime, date, turno
- **Funções:** CRUD, busca por período/máquina, agregação de produção

#### **OrdersService** - Gestão de Ordens de Produção
- **Coleção:** `production_orders`
- **Campos:** orderNumber, machineId, product, quantity, status, startDate, endDate
- **Funções:** CRUD, busca por número, status, período

#### **LogsService** - Auditoria e System Logs
- **Coleção:** `system_logs`
- **Responsabilidade:** Registrar ações de usuários, erros do sistema, alterações em dados críticos

---

### 3️⃣ **Controllers** - Lógica de UI (`src/controllers/`)

Um controller por aba/feature. Responsáveis por:
- Orquestrar chamadas aos serviços
- Renderizar dados na UI
- Capturar eventos do usuário
- Emitir eventos quando dados mudam

#### **LaunchController** - Seleção e Monitoramento de Máquinas
```
Funcionalidade: Tela inicial com cards de máquinas
├─ Carregamento de dados de máquinas (máquinas ativas)
├─ Display de status em tempo real (produzindo, parada, inátivo)
├─ Seleção e navegação para máquina
├─ Formulários rápidos de lançamento
└─ Integração com real-time listeners
```

#### **PlanningController** - Gestão de Planejamento
```
Funcionalidade: CRUD de planejamento
├─ Listar planejamentos por data/máquina
├─ Criar novo planejamento
├─ Editar planejamento existente
├─ Deletar planejamento
├─ Importar planejamento via Excel/CSV
└─ Validações e tratamento de erros
```

#### **MonitoringController** - Acompanhamento de Turno
```
Funcionalidade: Dashboard de monitoramento
├─ Paradas do turno (tempo, motivo, máquina)
├─ Produção acumulada
├─ Perdas por motivo (ranking)
├─ Timeline de eventos
├─ Atualização em tempo real
└─ Filtros por período/máquina
```

#### **AnalysisController** - Análise de Dados e KPIs
```
Funcionalidade: Relatórios e análises
├─ OEE (Overall Equipment Effectiveness)
├─ Gráficos de produção
├─ Comparação entre máquinas/períodos
├─ Tendências de paradas
├─ Exportação de relatórios (Excel, PDF)
└─ Análises comparativas
```

#### **ReportsController** - Geração de Relatórios
```
Funcionalidade: Relatórios customizáveis
├─ Relatório diário de produção
├─ Relatório de paradas por motivo
├─ Relatório de performance de máquinas
├─ Exportação em múltiplos formatos (Excel, PDF, CSV)
├─ Agendamento de envio por email
└─ Histórico de relatórios gerados
```

#### **AdminController** - Administração
```
Funcionalidade: Gerenciamento de dados
├─ CRUD de máquinas (cadastro, ativação/desativação)
├─ CRUD de produtos
├─ CRUD de turmos e escalas
├─ Gerenciamento de usuários e perfis
├─ Importação de dados (ERP)
├─ Limpeza de dados históricos
└─ Auditoria de mudanças
```

#### Outros Controllers Especializados:
- **PMAController** - Gestão de material (borra/sucata)
- **PCPController** - Planejamento e Controle de Produção
- **ToolingController** - Gerenciamento de ferramentaria
- **QualityController** - Controle de qualidade
- **LeadershipController** - Gestão de pessoas, escalas
- **HistoricoController** - Consultas de dados históricos

---

### 4️⃣ **Componentes Reutilizáveis** (`src/components/`)

#### **Notification** - Sistema de Notificações
```javascript
showNotification({
  message: 'Parada registrada com sucesso',
  type: 'success',
  duration: 3000
});
```

#### **Modal Manager** - Gerenciamento de Diálogos
```javascript
// Abrir modal customizado
showModal({
  title: 'Criar Parada',
  content: 'form-content',
  buttons: [...]
});

// Fechar
closeModal('modal-id');
```

#### **Data Table** - Tabelas Dinâmicas
```javascript
createDataTable({
  containerId: 'table-container',
  data: [...rows],
  columns: ['id', 'machineId', 'date', 'duration'],
  filters: true,
  pagination: true
});
```

#### **Chart Factory** - Gráficos (Chart.js)
```javascript
createChart({
  type: 'bar',
  data: chartData,
  options: { responsive: true, ... }
});
```

---

## 🔐 Autenticação e Autorização

### **AuthSystem** (no `script.js` + módulos)
- **Login:** Email + Senha via Firebase Auth
- **Session:** Token JWT (localStorage)
- **Perfis:** 
  - `operador` - Apenas lançamento de dados
  - `gestor` - Visualização de dados e relatórios
  - `suporte` - Acesso administrativo completo
  - `direcao` - Dashboards executivos

**Funções principais:**
- `login(email, password)` - Autenticar usuário
- `logout()` - Encerrar sessão
- `getCurrentUser()` - Usuário autenticado
- `hasPermission(permission)` - Verificar acesso
- `isAuthorized(roles)` - Validar perfil

---

## 🗄️ Coleções Firestore (23+ coleções)

| Coleção | Responsabilidade | Atualização |
|---------|-------------------|-------------|
| `planning` | Planejamento de máquinas | Manual/ERP |
| `production_entries` | Registros de produção | Real-time (formulário) |
| `downtime_entries` | Histórico de paradas finalizadas | Batch (ao finalizar parada) |
| `active_downtimes` | Paradas em andamento | Real-time |
| `extended_downtime_logs` | Logs detalhados de paradas prolongadas | Real-time |
| `production_orders` | Ordens de produção | Manual/ERP |
| `active_production_orders` | Ordens em execução | Real-time |
| `system_logs` | Auditoria de ações do sistema | Automático |
| `machine_database` | Configuração de máquinas | Manual (admin) |
| `machine_schedule` | Escala de máquinas/operadores | Manual |
| `pmp_borra` | Registro de borra (resíduo) | Manual/formulário |
| `pmp_sucata` | Registro de sucata (refugo) | Manual/formulário |
| `ferramentaria_moldes` | Ferramentas e moldes | Manual |
| `manutencoes` | Registros de manutenção | Manual |
| `process_control_checks` | Controle de qualidade | Manual |
| `users` | Cadastro de usuários | Admin |
| `roles` | Definição de perfis | Admin |
| + 8+ coleções adicionais | Configurações, historicos, etc | Variável |

---

## 🚀 Fluxo Principal de Operação

### Cenário 1: Operador Registra Produção

```
1. Operador acessa aba "Lançamento"
   ↓
2. LaunchController carrega máquinas via MachineService
   ↓
3. Operador seleciona máquina → filtro de planejamento
   ↓
4. LaunchController busca planejamento do dia via PlanningService
   ↓
5. Operador preenche formulário (quantidade, hora, turno)
   ↓
6. Controller valida dados e chama ProductionService.create()
   ↓
7. ProductionService salva em Firestore + cache
   ↓
8. EventBus emite evento 'production:created'
   ↓
9. DashboardController escuta e atualiza gráficos em tempo real
   ↓
10. Notification exibe "Lançamento realizado com sucesso"
```

### Cenário 2: Sistema Detecta Parada Ativa

```
1. Gerenciador de paradas verifica se máquina parou
   ↓
2. DowntimeService registra parada em 'active_downtimes'
   ↓
3. EventBus emite 'downtime:started'
   ↓
4. MonitoringController atualiza lista de paradas em tempo real
   ↓
5. Dashboard mostra alerta de parada
   ↓
6. Gerente pode clicar para registrar motivo
   ↓
7. Motivo é salvo e parada é movida de 'active' para 'completed'
   ↓
8. Analytics recalcula OEE com novo downtime
```

### Cenário 3: Análise de KPIs

```
1. Usuário acessa aba "Análise"
   ↓
2. AnalysisController busca dados do último período
   ↓
3. ProductionService.getByDateRange() retorna produção
   ↓
4. DowntimeService.getByDateRange() retorna paradas
   ↓
5. Controller calcula OEE = (Ideal - Parado - Refugo) / Ideal
   ↓
6. ChartFactory renderiza gráficos com dados
   ↓
7. Usuário pode exportar relatório via ReportsController
```

---

## 🛠️ Utilidades Auxiliares (`src/utils/`)

| Módulo | Funções Principais |
|--------|-------------------|
| **date.utils.js** | `getProductionDateString()`, `formatDate()`, `parseDate()` |
| **number.utils.js** | `formatNumber()`, `kgToGrams()`, `weightConversion()` |
| **dom.utils.js** | `debounce()`, `showLoadingState()`, `highlightElement()` |
| **color.utils.js** | `getMachineStatusColor()`, `getPerformanceColor()` |
| **logger.js** | `log()`, `warn()`, `error()` (com timestamp) |
| **auth.utils.js** | `validateEmail()`, `hashPassword()` |
| **plan.utils.js** | `validatePlanning()`, `formatPlanning()` |
| **product.utils.js** | `getProductInfo()`, `validateProduct()` |

---

## 🔄 Ponte Legado ↔ Modular (`src/legacy/bridge.js`)

Conecta o antigo `script.js` com os novos módulos ES6:

```javascript
// Expor services nos módulos
window.PlanningService = FunçãoQueRetornaService();
window.DowntimeService = FunçãoQueRetornaService();

// Redirecionar eventos globais antigos para EventBus novo
window.addEventListener('downtime-created', (e) => {
  EventBus.emit('downtime:created', e.detail);
});
```

---

## 📊 Fluxo de Cache e Sincronização

```
┌──────────────────┐
│  UI User Action  │
└────────┬─────────┘
         │ (dispara método no controller)
         ▼
┌──────────────────────────┐       ┌──────────────────┐
│   Service Method         ├──────→│  Cache Check     │
│ (ex: PlanningService)    │       │  (StateManager)  │
└──────────┬───────────────┘       └────────┬─────────┘
           │                               │
           │ (cache miss ou forceRefresh)  │
           ▼                               ▼
     ┌─────────────────┐         ┌──────────────┐
     │ Firestore Query │←────────│   Listener   │
     │  + Cache Write  │         │   (Real-time)│
     └────────┬────────┘         └──────┬───────┘
              │                         │
              └────────────┬────────────┘
                           │
                    ┌──────▼─────────┐
                    │   EventBus     │
                    │  (emitter)     │
                    └──────┬─────────┘
                           │
                    ┌──────▼──────────┐
                    │  Controller(s)  │
                    │ (listeners)     │
                    └──────┬──────────┘
                           │
                    ┌──────▼────────┐
                    │   Re-render   │
                    │   UI Elements │
                    └───────────────┘
```

---

## 🎯 Feature Flags (Controle de Funcionalidades)

Gerenciados em `src/config/feature-flags.js`:

```javascript
const FLAGS = {
  ENABLE_PREDICTIVE_ANALYTICS: false, // Oculto para não-autorizados
  ENABLE_ERP_INTEGRATION: true,
  ENABLE_EXTENDED_DOWNTIME_TRACKING: true,
  ENABLE_QUALITY_CONTROL: true,
  ENABLE_PMP_BORRA_SUCATA: true,
};
```

**Uso:**
```javascript
if (FLAGS.ENABLE_PREDICTIVE_ANALYTICS) {
  initPredictiveAnalytics();
}
```

---

## 🔍 Monitoramento e Debug

### Logger Centralizado
```javascript
import { logger } from './utils/logger.js';

logger.log('Evento importante', data);
logger.warn('Validação de aviso', warnings);
logger.error('Erro crítico', error);
```

### EventBus Debug
```javascript
EventBus.getStats(); // {emitCount, lastEvents: [...]}
```

### StateManager Telemetria
```javascript
stateManager.getMetrics(); // {hits, misses, sets, invalidations}
```

---

## 🚨 Tratamento de Erros

### Strategy Centralizada

```
┌──────────────────┐
│  Error Occurs    │
└────────┬─────────┘
         │
    ┌────▼────────┐
    │   Caught?   │
    └┬───────────┬┘
     │ YES       │ NO
     ▼           ▼
  ┌───────┐  ┌──────────┐
  │ Log + │  │ Notify + │
  │Notify │  │   Log    │
  └───────┘  └──────────┘
     │            │
     └─────┬──────┘
          ▼
    ┌────────────────┐
    │ User Sees      │
    │ Toast/Modal    │
    └────────────────┘
```

---

## 📈 Roadmap de Migração

| Fase | Objetivo | Status |
|------|----------|--------|
| **Fase 1** | Fundação Modular (Event Bus, State Manager, Base Service) | ✅ Completa |
| **Fase 2** | Services especializados (Planning, Downtime, Production) | ✅ Completa |
| **Fase 3** | Controllers modernos (UI logic extract) | 🔄 Em progresso |
| **Fase 4** | Remover código morto e duplicações | ⏳ Planejada |
| **Fase 5** | Migração completa para modules (script.js → deprecado) | ⏳ Planejada |

---

## 🎓 Como Adicionar Nova Funcionalidade

### Passo 1: Criar Service (se envolver coleção nova)
```javascript
// src/services/myfeature.service.js
import { BaseService } from './base.service.js';

class MyFeatureService extends BaseService {
  constructor() {
    super('my_feature_collection', { cacheTTL: 60000 });
  }
  
  async customMethod() { /* ... */ }
}

export const myFeatureService = new MyFeatureService();
```

### Passo 2: Criar Controller (UI logic)
```javascript
// src/controllers/myfeature.controller.js
import { myFeatureService } from '../services/myfeature.service.js';
import { EventBus } from '../core/event-bus.js';

export class MyFeatureController {
  async handleCreate(data) {
    const created = await myFeatureService.create(data);
    EventBus.emit('myfeature:created', created);
  }
}
```

### Passo 3: Hook na UI
```html
<button onclick="myFeatureCtrl.handleCreate({...})">Criar</button>
```

---

## 📞 Contato / Suporte

**Desenvolvimento:** Leandro de Camargo  
**Arquitetura:** AI Architect  
**Documentação:** Atualizada em Fevereiro 2026
