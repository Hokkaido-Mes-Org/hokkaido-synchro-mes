# HokkaidoMES — Dicionário de Dados

> **Versão:** 1.0 • **Data:** Fevereiro 2026  
> **Classificação:** CONFIDENCIAL — Equipe de Desenvolvimento  
> **Responsável:** Leandro de Camargo

---

## 1. Visão Geral

Este documento descreve **todas as coleções Firestore** utilizadas pelo sistema HokkaidoMES, incluindo campos, tipos, obrigatoriedade e relações.

**Projeto Firebase:** `hokkaido-synchro`  
**Total de coleções:** 22+  
**Engine:** Cloud Firestore (NoSQL document-based)

---

## 2. Convenções

| Símbolo | Significado |
|---------|-----------|
| **PK** | Chave primária (document ID) |
| **FK** | Referência para outro documento |
| **REQ** | Campo obrigatório |
| **OPT** | Campo opcional |
| **AUTO** | Gerado automaticamente |
| **STS** | Server Timestamp |

---

## 3. Coleções — Produção

### 3.1 `production_entries` — Registros de Produção

> Registra cada lançamento de produção feito pelo operador.

| Campo | Tipo | Obrig. | Descrição | Exemplo |
|-------|------|:------:|-----------|---------|
| `id` | string | PK/AUTO | ID do documento Firestore | `abc123xyz` |
| `machineId` | string | REQ | Identificador da máquina | `H01` |
| `machine` | string | OPT | Nome/alias da máquina (legado) | `H01` |
| `date` | string | REQ | Data de produção (YYYY-MM-DD) | `2026-02-19` |
| `turno` | string | REQ | Turno (T1, T2 ou T3) | `T1` |
| `quantity` | number | REQ | Quantidade produzida (peças) | `1500` |
| `product` | string | OPT | Nome do produto | `Rosca 28mm` |
| `productCode` | number | OPT | Código do produto | `12345` |
| `orderNumber` | string | OPT | Número da ordem de produção | `OP-2026-001` |
| `operator` | string | OPT | Nome do operador | `João Silva` |
| `startTime` | string | OPT | Hora de início | `06:30` |
| `endTime` | string | OPT | Hora de término | `14:30` |
| `weight` | number | OPT | Peso unitário (gramas) | `25.5` |
| `cavities` | number | OPT | Nº de cavidades do molde | `8` |
| `cycle` | number | OPT | Tempo de ciclo (segundos) | `18` |
| `tpieces_per_hour_goal` | number | OPT | Meta de peças/hora | `320` |
| `createdAt` | Timestamp | AUTO/STS | Data/hora de criação | — |
| `createdBy` | string | AUTO | Usuário que criou | `leandro.camargo` |
| `updatedAt` | Timestamp | AUTO/STS | Data/hora de atualização | — |

**Índices recomendados:**
- `date` + `machineId` (consultas por dia/máquina)
- `date` + `turno` (consultas por turno)
- `orderNumber` (busca por ordem)

---

### 3.2 `hourly_production_entries` — Produção Hora a Hora

> Tracking granular de produção por hora para gráficos de timeline.

| Campo | Tipo | Obrig. | Descrição | Exemplo |
|-------|------|:------:|-----------|---------|
| `id` | string | PK/AUTO | ID Firestore | — |
| `machineId` | string | REQ | ID da máquina | `H05` |
| `date` | string | REQ | Data (YYYY-MM-DD) | `2026-02-19` |
| `hour` | string | REQ | Hora (HH:00) | `08:00` |
| `turno` | string | REQ | Turno | `T1` |
| `quantity` | number | REQ | Quantidade naquela hora | `180` |
| `createdAt` | Timestamp | AUTO | Criação | — |

---

### 3.3 `rework_entries` — Registros de Retrabalho

> Registra peças que precisaram de retrabalho ou foram refugadas.

| Campo | Tipo | Obrig. | Descrição | Exemplo |
|-------|------|:------:|-----------|---------|
| `id` | string | PK/AUTO | ID Firestore | — |
| `machineId` | string | REQ | ID da máquina | `H03` |
| `date` | string | REQ | Data | `2026-02-19` |
| `turno` | string | REQ | Turno | `T2` |
| `quantity` | number | REQ | Quantidade de retrabalho | `45` |
| `reason` | string | OPT | Motivo do retrabalho | `Dimensão fora` |
| `orderNumber` | string | OPT | OP associada | `OP-001` |
| `createdAt` | Timestamp | AUTO | Criação | — |

---

### 3.4 `quantity_adjustments` — Ajustes de Quantidade

> Registro de auditoria para ajustes manuais de quantidade.

| Campo | Tipo | Obrig. | Descrição | Exemplo |
|-------|------|:------:|-----------|---------|
| `id` | string | PK/AUTO | ID Firestore | — |
| `machineId` | string | REQ | Máquina afetada | `H02` |
| `date` | string | REQ | Data do ajuste | `2026-02-19` |
| `oldQuantity` | number | REQ | Quantidade anterior | `1500` |
| `newQuantity` | number | REQ | Quantidade nova | `1480` |
| `reason` | string | REQ | Motivo do ajuste | `Contagem incorreta` |
| `adjustedBy` | string | REQ | Quem ajustou | `leandro.camargo` |
| `createdAt` | Timestamp | AUTO | Criação | — |

---

## 4. Coleções — Paradas (Downtime)

### 4.1 `active_downtimes` — Paradas Ativas

> Paradas em andamento. O document ID é o machineId (1 parada ativa por máquina).

| Campo | Tipo | Obrig. | Descrição | Exemplo |
|-------|------|:------:|-----------|---------|
| `id` | string | PK | = machineId (documento único) | `H06` |
| `machine_id` | string | REQ | ID da máquina | `H06` |
| `machine` | string | OPT | Nome/alias | `H06` |
| `motivo` | string | REQ | Motivo da parada | `Troca de molde` |
| `reason` | string | OPT | Alias do motivo (legado) | `Troca de molde` |
| `categoria` | string | OPT | Categoria | `Processo` |
| `start_time` | string | REQ | Hora de início | `10:30` |
| `start_date` | string | OPT | Data de início | `2026-02-19` |
| `turno` | string | OPT | Turno | `T1` |
| `orderNumber` | string | OPT | OP associada | `OP-001` |
| `operador` | string | OPT | Operador | `João` |
| `semOP` | boolean | OPT | Parada sem OP ativa | `false` |
| `createdAt` | Timestamp | AUTO | Criação | — |
| `updatedAt` | Timestamp | AUTO | Atualização | — |

**Regra de negócio:** Apenas 1 documento por máquina. Ao finalizar, é deletado e registrado em `downtime_entries`.

---

### 4.2 `downtime_entries` — Paradas Finalizadas

> Histórico completo de paradas já encerradas.

| Campo | Tipo | Obrig. | Descrição | Exemplo |
|-------|------|:------:|-----------|---------|
| `id` | string | PK/AUTO | ID Firestore | — |
| `machineId` | string | REQ | ID da máquina | `H06` |
| `machine` | string | OPT | Alias | `H06` |
| `data` | string | REQ | Data da parada | `2026-02-19` |
| `motivo` | string | REQ | Motivo | `Falta de matéria-prima` |
| `reason` | string | OPT | Alias motivo (legado) | — |
| `categoria` | string | OPT | Categoria | `Material` |
| `category` | string | OPT | Alias (legado) | — |
| `start_time` | string | REQ | Hora de início | `10:30` |
| `end_time` | string | REQ | Hora de término | `11:15` |
| `duration_minutes` | number | REQ | Duração em minutos | `45` |
| `turno` | string | OPT | Turno | `T1` |
| `orderNumber` | string | OPT | OP associada | `OP-001` |
| `operador` | string | OPT | Operador | `João` |
| `createdAt` | Timestamp | AUTO | Criação | — |
| `finishedAt` | Timestamp | OPT | Quando foi finalizada | — |
| `finishedBy` | string | OPT | Quem finalizou | `leandro.camargo` |

**Índices recomendados:**
- `data` + `machineId`
- `data` (>= / <=) para range queries
- `motivo` (agrupamento por motivo)

---

### 4.3 `extended_downtime_logs` — Paradas Prolongadas

> Para paradas que ultrapassam 1 turno (manutenção, fim de semana, etc.).

| Campo | Tipo | Obrig. | Descrição | Exemplo |
|-------|------|:------:|-----------|---------|
| `id` | string | PK/AUTO | ID Firestore | — |
| `machine_id` | string | REQ | ID da máquina | `H08` |
| `machine` | string | OPT | Alias | `H08` |
| `status` | string | REQ | Status: `active` ou `inactive` | `active` |
| `motivo` | string | REQ | Motivo | `Manutenção preventiva` |
| `start_date` | string | REQ | Data de início | `2026-02-15` |
| `start_time` | string | REQ | Hora de início | `18:00` |
| `end_date` | string | OPT | Data de término | `2026-02-17` |
| `end_time` | string | OPT | Hora de término | `06:00` |
| `observacoes` | string | OPT | Observações | `Troca de rolamento` |
| `force_stopped` | boolean | OPT | Encerrada forçadamente | `false` |
| `createdAt` | Timestamp | AUTO | Criação | — |
| `updatedAt` | Timestamp | AUTO | Atualização | — |
| `createdBy` | string | OPT | Criador | `leandro.camargo` |

---

## 5. Coleções — Ordens e Planejamento

### 5.1 `production_orders` — Ordens de Produção

| Campo | Tipo | Obrig. | Descrição | Exemplo |
|-------|------|:------:|-----------|---------|
| `id` | string | PK/AUTO | ID Firestore | — |
| `orderNumber` | string | REQ | Número da OP | `OP-2026-001` |
| `product` | string | REQ | Nome do produto | `Rosca 28mm` |
| `productCode` | number | OPT | Código do produto | `12345` |
| `machineId` | string | REQ | Máquina designada | `H01` |
| `quantity` | number | REQ | Quantidade planejada | `50000` |
| `quantityProduced` | number | OPT | Quantidade produzida | `32000` |
| `status` | string | REQ | Status atual | `em_andamento` |
| `materia_prima` | string | OPT | Código matéria-prima | `MP-001` |
| `priority` | number | OPT | Prioridade (1=alta) | `2` |
| `startDate` | string | OPT | Data de início | `2026-02-19` |
| `endDate` | string | OPT | Data de término | `2026-02-25` |
| `createdAt` | Timestamp | AUTO | Criação | — |
| `updatedAt` | Timestamp | AUTO | Atualização | — |
| `createdBy` | string | OPT | Criador | — |

**Status possíveis:** `ativa`, `em_andamento`, `suspensa`, `concluida`, `finalizada`

---

### 5.2 `planning` — Planejamento Diário

| Campo | Tipo | Obrig. | Descrição | Exemplo |
|-------|------|:------:|-----------|---------|
| `id` | string | PK/AUTO | ID Firestore | — |
| `date` | string | REQ | Data do planejamento | `2026-02-19` |
| `machineId` | string | REQ | Máquina | `H01` |
| `machine` | string | OPT | Alias | `H01` |
| `product` | string | OPT | Nome do produto | `Rosca 28mm` |
| `productCode` | number | OPT | Código do produto | `12345` |
| `quantity` | number | REQ | Quantidade planejada | `15000` |
| `orderNumber` | string | OPT | OP vinculada | `OP-001` |
| `turno` | string | OPT | Turno | `T1` |
| `status` | string | OPT | Status | `planejado` |
| `createdAt` | Timestamp | AUTO | Criação | — |
| `updatedAt` | Timestamp | AUTO | Atualização | — |

---

### 5.3 `machine_priorities` — Prioridades de Máquina

| Campo | Tipo | Obrig. | Descrição |
|-------|------|:------:|-----------|
| `id` | string | PK | = machineId |
| `priority` | number | REQ | Ordem de prioridade |
| `updatedAt` | Timestamp | AUTO | Última atualização |

---

## 6. Coleções — PMP (Gestão de Materiais)

### 6.1 `pmp_borra` — Registro de Borra

| Campo | Tipo | Obrig. | Descrição | Exemplo |
|-------|------|:------:|-----------|---------|
| `id` | string | PK/AUTO | ID Firestore | — |
| `machineId` | string | REQ | Máquina | `H05` |
| `date` | string | REQ | Data | `2026-02-19` |
| `turno` | string | REQ | Turno | `T1` |
| `peso` | number | REQ | Peso em kg | `12.5` |
| `operador` | string | OPT | Operador | — |
| `createdAt` | Timestamp | AUTO | Criação | — |

### 6.2 `pmp_moido` — Material Moído

> Mesma estrutura de `pmp_borra`.

### 6.3 `pmp_sucata` — Sucata

> Mesma estrutura de `pmp_borra`, com campo adicional `motivo` (string, OPT).

---

## 7. Coleções — Pessoas e Escalas

### 7.1 `escalas_operadores` — Escalas de Turno

| Campo | Tipo | Obrig. | Descrição | Exemplo |
|-------|------|:------:|-----------|---------|
| `id` | string | PK/AUTO | ID Firestore | — |
| `date` | string | REQ | Data da escala | `2026-02-19` |
| `turno` | string | REQ | Turno | `T1` |
| `machineId` | string | REQ | Máquina | `H01` |
| `operador` | string | REQ | Nome do operador | `João Silva` |
| `createdAt` | Timestamp | AUTO | Criação | — |
| `createdBy` | string | OPT | Quem criou a escala | — |

---

## 8. Coleções — Ferramentaria

### 8.1 `moldes` — Cadastro de Moldes

| Campo | Tipo | Obrig. | Descrição | Exemplo |
|-------|------|:------:|-----------|---------|
| `id` | string | PK/AUTO | ID Firestore | — |
| `codigo` | string | REQ | Código do molde | `MOL-001` |
| `descricao` | string | REQ | Descrição | `Molde Rosca 28mm` |
| `machineId` | string | OPT | Máquina atual | `H01` |
| `batidas` | number | OPT | Total de batidas/ciclos | `150000` |
| `limiteManutencao` | number | OPT | Batidas p/ manutenção | `200000` |
| `status` | string | OPT | Status do molde | `ativo` |
| `createdAt` | Timestamp | AUTO | Criação | — |
| `updatedAt` | Timestamp | AUTO | Atualização | — |

### 8.2 `manutencoes_molde` — Manutenções de Moldes

| Campo | Tipo | Obrig. | Descrição | Exemplo |
|-------|------|:------:|-----------|---------|
| `id` | string | PK/AUTO | ID Firestore | — |
| `moldeId` | string | FK/REQ | Referência ao molde | `MOL-001` |
| `tipo` | string | REQ | Tipo de manutenção | `preventiva` |
| `data` | string | REQ | Data da manutenção | `2026-02-19` |
| `observacoes` | string | OPT | Detalhes | `Polimento de cavidade` |
| `batidasNaManutencao` | number | OPT | Batidas ao realizar | `148000` |
| `realizadoPor` | string | OPT | Responsável | `Carlos` |
| `createdAt` | Timestamp | AUTO | Criação | — |

---

## 9. Coleções — Setup e Qualidade

### 9.1 `setups` — Registros de Setup

| Campo | Tipo | Obrig. | Descrição | Exemplo |
|-------|------|:------:|-----------|---------|
| `id` | string | PK/AUTO | ID Firestore | — |
| `machineId` | string | REQ | Máquina | `H03` |
| `tipo` | string | REQ | Tipo de setup | `Troca de molde` |
| `date` | string | REQ | Data | `2026-02-19` |
| `startTime` | string | REQ | Hora início | `08:00` |
| `endTime` | string | REQ | Hora término | `09:30` |
| `durationMinutes` | number | OPT | Duração (min) | `90` |
| `operador` | string | OPT | Operador | — |
| `observacoes` | string | OPT | Observações | — |
| `createdAt` | Timestamp | AUTO | Criação | — |

### 9.2 `process_control_checks` — Controle de Qualidade

| Campo | Tipo | Obrig. | Descrição | Exemplo |
|-------|------|:------:|-----------|---------|
| `id` | string | PK/AUTO | ID Firestore | — |
| `machineId` | string | REQ | Máquina | `H01` |
| `date` | string | REQ | Data | `2026-02-19` |
| `turno` | string | REQ | Turno | `T1` |
| `product` | string | OPT | Produto inspecionado | — |
| `checks` | array | REQ | Lista de verificações | — |
| `approved` | boolean | OPT | Aprovado | `true` |
| `inspector` | string | OPT | Inspetor | — |
| `createdAt` | Timestamp | AUTO | Criação | — |

---

## 10. Coleções — Acompanhamento

### 10.1 `acompanhamento_turno` — Tracking CEDOC vs MES

| Campo | Tipo | Obrig. | Descrição |
|-------|------|:------:|-----------|
| `id` | string | PK/AUTO | ID Firestore |
| `machineId` | string | REQ | Máquina |
| `date` | string | REQ | Data |
| `turno` | string | REQ | Turno |
| `qtd_cedoc` | number | OPT | Quantidade registrada no CEDOC |
| `qtd_mes` | number | OPT | Quantidade registrada no MES |
| `diferenca` | number | OPT | Diferença |
| `createdAt` | Timestamp | AUTO | Criação |

### 10.2 `acompanhamento_perdas` — Tracking de Perdas

| Campo | Tipo | Obrig. | Descrição |
|-------|------|:------:|-----------|
| `id` | string | PK/AUTO | ID Firestore |
| `machineId` | string | REQ | Máquina |
| `date` | string | REQ | Data |
| `turno` | string | REQ | Turno |
| `perdas_op` | number | OPT | Perdas registradas na OP |
| `perdas_mes` | number | OPT | Perdas registradas no MES |
| `createdAt` | Timestamp | AUTO | Criação |

---

## 11. Coleções — Sistema

### 11.1 `system_logs` — Logs de Auditoria

| Campo | Tipo | Obrig. | Descrição | Exemplo |
|-------|------|:------:|-----------|---------|
| `id` | string | PK/AUTO | ID Firestore | — |
| `type` | string | REQ | Tipo de ação | `delete_downtime` |
| `action` | string | REQ | Descrição da ação | `Excluiu parada H06` |
| `user` | string | REQ | Usuário | `leandro.camargo` |
| `machine` | string | OPT | Máquina afetada | `H06` |
| `details` | object | OPT | Dados complementares | `{before: {...}}` |
| `date` | string | OPT | Data formatada | `2026-02-19` |
| `timestamp` | Timestamp | AUTO/STS | Data/hora server | — |

### 11.2 `pcp_observacoes` — Observações do PCP

| Campo | Tipo | Obrig. | Descrição |
|-------|------|:------:|-----------|
| `id` | string | PK/AUTO | ID Firestore |
| `machineId` | string | REQ | Máquina |
| `date` | string | REQ | Data |
| `turno` | string | OPT | Turno |
| `observacao` | string | REQ | Texto da observação |
| `createdBy` | string | OPT | Autor |
| `createdAt` | Timestamp | AUTO | Criação |

---

## 12. Dados Locais (Client-Side)

### 12.1 `productDatabase` (database.js)

> Array global de ~500+ produtos, hardcoded no arquivo database.js.

| Campo | Tipo | Descrição | Exemplo |
|-------|------|-----------|---------|
| `cod` | number | Código do produto (PK) | `12345` |
| `client` | string | Nome do cliente | `SILGAN` |
| `name` | string | Descrição completa | `ROSCA 28MM STANDARD` |
| `cavities` | number | Nº de cavidades | `8` |
| `cycle` | number | Tempo de ciclo (seg) | `18` |
| `weight` | number | Peso unitário (g) | `25.5` |
| `pieces_per_hour_goal` | number | Meta peças/hora | `320` |
| `mp` | string | Código matéria-prima | `PP-001` |

### 12.2 `materiaPrimaDatabase` (materia-prima-database.js)

> Array global de matérias-primas.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `codigo` | string | Código da matéria-prima |
| `descricao` | string | Descrição |
| `tipo` | string | Tipo de material |

### 12.3 `DISABLED_MACHINES` (script.js)

> Array de máquinas desativadas que não aparecem nos dashboards.

```javascript
const DISABLED_MACHINES = ['H11'];
```

---

## 13. Diagrama de Relações

```
┌──────────────────┐     1:N      ┌──────────────────────┐
│ production_orders│──────────────▶│  production_entries   │
│ (orderNumber)    │              │  (orderNumber FK)     │
└────────┬─────────┘              └──────────────────────┘
         │ 1:N
         ▼
┌──────────────────┐              ┌──────────────────────┐
│    planning      │              │   downtime_entries    │
│ (orderNumber FK) │              │   (machineId)        │
└──────────────────┘              └──────────────────────┘
                                           ▲
                                           │ move-to
┌──────────────────┐              ┌────────┴─────────────┐
│     moldes       │              │  active_downtimes    │
│  (machineId)     │              │  (machineId = docID)  │
└────────┬─────────┘              └──────────────────────┘
         │ 1:N
         ▼
┌──────────────────┐              ┌──────────────────────┐
│manutencoes_molde │              │extended_downtime_logs│
│ (moldeId FK)     │              │  (machine_id)        │
└──────────────────┘              └──────────────────────┘

┌──────────────────┐              ┌──────────────────────┐
│escalas_operadores│              │    system_logs       │
│(date+turno+maq)  │              │  (auditoria geral)   │
└──────────────────┘              └──────────────────────┘
```

---

## 14. Índices Compostos Recomendados

| Coleção | Campos | Tipo | Uso |
|---------|--------|------|-----|
| `production_entries` | `date` ASC + `machineId` ASC | Composto | Consulta diária por máquina |
| `downtime_entries` | `data` ASC + `machineId` ASC | Composto | Paradas por dia/máquina |
| `planning` | `date` ASC + `machineId` ASC | Composto | Planejamento por dia/máquina |
| `production_orders` | `status` ASC + `machineId` ASC | Composto | Ordens ativas por máquina |
| `system_logs` | `date` DESC + `type` ASC | Composto | Logs recentes por tipo |
| `extended_downtime_logs` | `status` ASC + `machine_id` ASC | Composto | Paradas ativas |

---

## Histórico de Revisões

| Versão | Data | Autor | Alteração |
|--------|------|-------|-----------|
| 1.0 | 2026-02-19 | Leandro de Camargo | Criação inicial |
