# Triagem e Quarentena — Documentação Funcional

## Visão Geral

A funcionalidade de **Triagem** gerencia o fluxo de peças rejeitadas na produção que possuem potencial de reaproveitamento. As peças defeituosas são colocadas em **quarentena** e, à medida que passam por triagem, podem voltar para a produção (aprovadas) ou ser definitivamente descartadas (refugadas).

---

## Fluxo do Processo

```
 Produção          Quarentena           Triagem              Resultado
┌──────────┐     ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  Peça     │     │              │    │              │    │  APROVADA    │
│  rejeitada│────>│  Aguardando  │───>│  Em análise  │───>│  → volta p/  │
│  (defeito)│     │  triagem     │    │  pelo inspe- │    │    produção  │
│           │     │              │    │  tor de      │    │              │
└──────────┘     └──────────────┘    │  qualidade   │    │  REFUGADA    │
                                      │              │───>│  → descarte  │
                                      └──────────────┘    │    definitivo│
                                                          └──────────────┘
```

### Status possíveis

| Status | Descrição | Cor |
|--------|-----------|-----|
| `QUARENTENA` | Peças aguardando início da triagem | 🟡 Amarelo |
| `EM_TRIAGEM` | Triagem em andamento (inspetor avaliando peças) | 🔵 Azul |
| `CONCLUIDA` | Triagem finalizada (todas as peças classificadas) | 🟢 Verde |

---

## Coleção Firestore: `triage_entries`

### Campos

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `machineId` | string | Máquina de origem (ex: "H01") |
| `orderNumber` | string | Número da ordem de produção |
| `product` | string | Nome do produto |
| `productCode` | string | Código do produto |
| `defectReason` | string | Motivo do defeito (código da `lossReasonsDatabase`) |
| `defectCategory` | string | Categoria do defeito (PROCESSO, FERRAMENTARIA, etc.) |
| `quantity` | number | Quantidade total de peças enviadas para quarentena |
| `quantityApproved` | number | Peças aprovadas na triagem (acumulado) |
| `quantityRejected` | number | Peças definitivamente refugadas (acumulado) |
| `quantityPending` | number | Peças ainda pendentes de triagem |
| `status` | string | QUARENTENA \| EM_TRIAGEM \| CONCLUIDA |
| `quarantineDate` | string | Data de entrada na quarentena (YYYY-MM-DD) |
| `triageDate` | string\|null | Data de conclusão da triagem |
| `triageOperator` | string | Operador responsável pela triagem |
| `operador` | string | Operador que registrou a quarentena |
| `turno` | string | Turno (1T, 2T, 3T) |
| `notes` | string | Observações gerais |
| `history` | array | Histórico de ações de triagem |
| `createdAt` | timestamp | Criado automaticamente pelo BaseService |
| `updatedAt` | timestamp | Atualizado automaticamente pelo BaseService |

### Campo `history` (array de objetos)

Cada entrada no histórico contém:

```json
{
    "timestamp": "2026-02-26T14:30:00.000Z",
    "approved": 50,
    "rejected": 10,
    "operator": "João Silva",
    "notes": "Peças com rebarba leve aprovadas após corte"
}
```

---

## Arquitetura dos Módulos

### Service: `src/services/triage.service.js`

Estende `BaseService` e gerencia a coleção `triage_entries`.

**Métodos principais:**

| Método | Descrição |
|--------|-----------|
| `sendToQuarantine(data)` | Registra novo lote em quarentena |
| `startTriage(id, operator)` | Muda status para EM_TRIAGEM |
| `recordTriageResult(id, { approved, rejected, notes })` | Registra resultado parcial/final da triagem |
| `finalizeTriage(id, operator, notes)` | Encerra triagem — peças pendentes viram refugo |
| `getQuarantined()` | Lista lotes com status QUARENTENA |
| `getInTriage()` | Lista lotes com status EM_TRIAGEM |
| `getCompleted(start, end)` | Lista lotes concluídos (com filtro de data opcional) |
| `getByMachine(machineId)` | Filtra por máquina |
| `getByOrder(orderNumber)` | Filtra por ordem |
| `getByProduct(productCode)` | Filtra por produto |
| `getKPIs(start, end)` | Calcula KPIs (totais, taxas, top defeitos) |

### Controller: `src/controllers/triage.controller.js`

Exporta `setupQualidadePage()` — registrado no `_controllerRegistry` do `script.js`.

**Responsabilidades:**
- Gerencia sub-tabs (Triagem / Nova Quarentena)
- Renderiza dashboard de KPIs (6 indicadores)
- Tabela de lotes com filtro por status
- Formulário de entrada em quarentena
- Modal de registro de resultado de triagem
- Ações de "Triar" e "Finalizar"

### HTML: Seção em `index.html`

O conteúdo fica dentro de `<div id="qualidade-page">`, substituindo o placeholder "Em Desenvolvimento".

**Sub-tabs:**
1. **Triagem** — Dashboard com KPIs + tabela de lotes + filtros
2. **Nova Quarentena** — Formulário para enviar peças para quarentena

---

## KPIs Exibidos

| KPI | Descrição |
|-----|-----------|
| Quarentena | Quantidade de lotes aguardando triagem |
| Em Triagem | Lotes com triagem em andamento |
| Concluídas | Triagens finalizadas |
| Pçs Pendentes | Total de peças ainda não triadas |
| Aprovadas | Total de peças reaproveitadas |
| Taxa Aprov. | Percentual de reaproveitamento (aprovadas / total) |

---

## Integração com o Sistema

### Navegação
- Aba **Qualidade** no sidebar (ícone `shield-check`)
- Registrado em `_controllerRegistry` com path `./src/controllers/triage.controller.js`

### Cache
- TTL de 1 minuto no `TriageService` (via `BaseService`)
- Regras de invalidação em `write-invalidation.js`
- Prefetch configurado em `_prefetchCollections` para `triage_entries`

### Dados de referência
- Máquinas: `window.machineDatabase`
- Motivos de defeito: `window.groupedLossReasons` / `window.lossReasonsDatabase`
- Produtos: `window.productByCode`
- Usuários: `window.authSystem`

### Eventos emitidos (via EventBus)
- `triage_entries:created` — novo lote em quarentena
- `triage_entries:updated` — triagem registrada ou status alterado

---

## Exemplo de Uso

### 1. Enviar peças para quarentena
O operador da produção identifica peças com defeito e registra na aba **Nova Quarentena**:
- Seleciona máquina, turno, preenche a ordem e código do produto
- Informa quantidade de peças e motivo do defeito
- Clica em "Enviar para Quarentena"

### 2. Realizar triagem
O inspetor de qualidade acessa a aba **Triagem**:
- Visualiza lotes com status "Quarentena" (amarelo)
- Clica em **Triar** para abrir o modal
- Informa quantas peças foram aprovadas e quantas foram refugadas
- Pode registrar parcialmente (ex: triar 50 de 200 peças hoje)

### 3. Finalizar triagem
- Se clicar em **Finalizar**, todas as peças pendentes são automaticamente refugadas
- O status muda para "Concluída" (verde)
- As peças aprovadas retornam conceitualmente à produção

---

## Possíveis Evoluções Futuras

1. **Integração com OEE** — Peças aprovadas na triagem poderiam incrementar o indicador de qualidade
2. **Rastreabilidade** — Vincular lotes de triagem à coleção `traceability_records`
3. **Dashboard de Pareto** — Gráfico dos motivos de defeito mais recorrentes
4. **Alerta de quarentena longa** — Notificação quando lotes ficam > X dias sem triagem
5. **Relatórios exportáveis** — CSV/PDF com dados de triagem por período
6. **Fluxo de devolução ao estoque** — Registro formal da reentrada das peças no fluxo produtivo
