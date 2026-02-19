# HokkaidoMES — Plano de Ação para Automação com n8n

> **Data:** 18/02/2026  
> **Status:** Análise Inicial + Plano de Ação  
> **Autor:** AI Architect  
> **Objetivo:** Definir estratégia para implantação de automações com n8n

---

## 1. Sumário Executivo

O **HokkaidoMES** é um MES (Manufacturing Execution System) modular com 23+ coleções Firestore e 17 controllers ES6. Possui múltiplas oportunidades de automação com **n8n**:

- ✅ **Monitoramento** de paradas longas (alertas)
- ✅ **Sincronização** de dados entre Firestore e ERPs externos
- ✅ **Relatórios** automáticos por período
- ✅ **Notificações** em tempo real (Slack, WhatsApp, email)
- ✅ **Correção** de dados inconsistentes
- ✅ **Integração** com planilhas do Google Sheets

**ROI Esperado:** 15-20 horas/mês economizadas em tarefas manuais (dados, sincronização, relatórios)

---

## 2. Análise de Fluxos Atuais

### 2.1 Fluxo de Produção

```
┌─────────────────────────────────────────────────────┐
│ Máquina (Operador lança dados)                      │
└────────────┬────────────────────────────────────────┘
             │ (Manual via UI)
             ▼
┌──────────────────────────────────────────────────────┐
│ Firestore: production_entries                        │
│ - produzido (peças)                                  │
│ - peso_bruto (kg)                                    │
│ - timestamp, machine, turno, planId                  │
└────────────┬────────────────────────────────────────┘
             │ (Real-time listener)
             ▼
┌──────────────────────────────────────────────────────┐
│ Dashboard em Tempo Real (analysis.controller.js)     │
│ - OEE calculado                                      │
│ - Gráficos de produção                               │
│ - Alertas de limite                                  │
└──────────────────────────────────────────────────────┘
```

**Pontos de Automação:**
- Dados não são sincronizados com ERPs externos
- Alertas são apenas visuais (sem notificações)
- Relatórios são gerados manualmente via Reports tab

### 2.2 Fluxo de Paradas (Downtime)

```
┌──────────────────────────────────────────────────────┐
│ Sistema: downtime_entries (manual ou auto-detectado) │
│ - machine, reason, duration, status                  │
│ - startTime, endTime, createdAt                      │
└────────────┬────────────────────────────────────────┘
             │
             ├─► extended_downtime_logs (análise)
             └─► Paradas acumuladas (relatório)
```

**Problema:** Paradas longas não geram alertas automáticos

### 2.3 Fluxo de Planejamento

```
┌──────────────────────────────────────────────────────┐
│ Firestore: planning (Ordem de Produção + OP)         │
│ - machine, product_cod, quantity, data, status       │
│ - total_produzido (atualizado em tempo real)         │
└────────────┬────────────────────────────────────────┘
             │ (Listeners)
             ▼
┌──────────────────────────────────────────────────────┐
│ Análise em Dashboard                                 │
│ - % Execução vs. Plano                               │
│ - Produtos atrasados                                 │
└──────────────────────────────────────────────────────┘
```

**Problema:** Não há sincronização com ERP para contratos/POs externas

### 2.4 Fluxo de Qualidade

```
┌──────────────────────────────────────────────────────┐
│ Firestore: process_control_checks                    │
│ - amostras, valores de processo (temp, pressão)      │
└────────────┬────────────────────────────────────────┘
             │
             ▼ (Manual via reports.controller.js)
┌──────────────────────────────────────────────────────┐
│ Relatório de Qualidade (gerado ad-hoc)               │
└──────────────────────────────────────────────────────┘
```

**Problema:** Sem geração automática de relatórios ou alertas de desvios

---

## 3. Oportunidades de Automação com n8n

### 3.1 **TRIGGER 1: Monitoramento de Paradas Longas** ⭐ (Alta Prioridade)

**Problema:** Paradas > 15min não geram alertas  
**Solução n8n:**

```
Firestore (downtime_entries) 
    ↓ [Watch Collection]
    ├─ duration > 15 min? ✓
    ├─ Enviar alerta Slack/WhatsApp
    └─ Registrar em Google Sheets (histórico)
```

**Benefício:** Reduz tempo de resposta a paradas, evita perdas

**Implementação:**
- Webhook Firestore → n8n
- Lógica: IF duration > THRESHOLD
- Output: Slack + Google Sheets

---

### 3.2 **TRIGGER 2: Sincronização de Produção → ERP** ⭐ (Alta Prioridade)

**Problema:** Dados de produção reais não chegam ao ERP  
**Solução n8n:**

```
production_entries (Firestore)
    ↓ [Watch Collection - novo doc]
    ├─ Formatar: { machine, product_cod, quantidade, data, hora }
    └─ POST /api/production (ERP externo)
       └─ Log sucesso/erro em collection: erp_sync_logs
```

**Benefício:** ERP possui dados reais de produção, reduz erros manuais

**Configuração:**
- Polling a cada 5-10 min OR webhook real-time
- Retry automático em falha
- Dead letter queue para erros

---

### 3.3 **TRIGGER 3: Geração Automática de Relatórios** (Média Prioridade)

**Problema:** Relatórios só geram clicando na UI  
**Solução n8n:**

```
CRON: Diário às 18:00
    ↓ [Schedule]
    ├─ Fetch production (últimas 24h)
    ├─ Fetch paradas (últimas 24h)
    ├─ Calcular OEE/KPIs
    └─ Gerar PDF + enviar email
       └─ cc: lider, gestor via grupo
```

**Benefício:** Dashboard automático para gestores (sem logar no sistema)

---

### 3.4 **TRIGGER 4: Sincronização Google Sheets ↔ Firestore** (Média Prioridade)

**Problema:** Dados em planilhas não sincronizam com sistema  
**Solução n8n:**

```
Google Sheets (Planning Tab)
    ↓ [Watch Sheet]
    ├─ Nova linha adicionada?
    ├─ Validar: machine, product, qty, data
    └─ Criar planning doc em Firestore
       └─ ou UPDATE se já existe
```

**Benefício:** Planejamento via Sheets (mais familiar para alguns usuários)

---

### 3.5 **TRIGGER 5: Alertas de Qualidade (Desvios)** (Média Prioridade)

**Problema:** Desvios de qualidade não disparam alertas  
**Solução n8n:**

```
process_control_checks (Firestore)
    ↓ [Watch Collection]
    ├─ temperatura < min OU > max? ✓
    ├─ pressão fora de range?
    ├─ Calcular tendência (últimas N amostras)
    └─ IF trending_bad → enviar alerta WhatsApp líder
       └─ Log em "quality_alerts"
```

**Benefício:** Reação rápida a desvios, prevenção de produtos ruins

---

### 3.6 **TRIGGER 6: Sincronização Bidirecional com Planilha de Custos** (Baixa Prioridade)

**Problema:** Custos de produção estão em planilha externa  
**Solução n8n:**

```
production_entries + planning (Firestore)
    ↓
    ├─ Calcular: custo_hora_maquina × duracao
    ├─ Calcular: custo_mp (via tabela de custos)
    └─ Google Sheets (Custos por OP)
       └─ Usar para análise de rentabilidade
```

**Benefício:** Integração financeira sem duplicação de dados

---

### 3.7 **TRIGGER 7: Auditoria e Backup Automático** (Média Prioridade)

**Problema:** Sem backup automático de dados críticos  
**Solução n8n:**

```
CRON: Diário às 23:00
    ↓ [Schedule]
    ├─ Fetch todas as collections (planning, production, downtime)
    ├─ Exportar como CSV/JSON
    └─ Upload Google Drive (pasta dated/2026-02-18/)
       └─ e.g.: "2026-02-18_production_backup.csv"
```

**Benefício:** Disaster recovery, compliance

---

## 4. Oportunidades Adicionais (Futuro)

| N | Automação | Complexidade | ROI |
|---|-----------|--------------|-----|
| 4.1 | Previsão de finalização de OP (ML) | 🔴 Alta | 🟢 Alto |
| 4.2 | Balanceamento automático de carga | 🔴 Alta | 🟢 Alto |
| 4.3 | Agendamento de setup (AI) | 🔴 Alta | 🟢 Médio |
| 4.4 | Detecção de anomalias em paradas | 🔴 Alta | 🟢 Médio |
| 4.5 | Integração com SAP/Oracle | 🔴 Alta | 🟢 Muito Alto |

---

## 5. Arquitetura Proposta

### 5.1 Deployment de n8n

```
┌──────────────────────────────────────┐
│ n8n (Docker/Cloud)                   │
│ URL: n8n.hokkaido.local             │
│ Porta: 5678 (UI) + 5679 (webhook)   │
└──────────────────────────────────────┘
        ↕
┌──────────────────────────────────────────────────┐
│ Firestore (Firebase)                             │
│ - Watch Collections                              │
│ - Write Audit Logs                               │
└──────────────────────────────────────────────────┘
        ↕
┌──────────────────────────────────────────────────┐
│ Integrações Externas                             │
│ - Slack (alertas)                                │
│ - Google Sheets (sync)                           │
│ - Email (SMTP)                                   │
│ - ERP APIs (se aplicável)                        │
└──────────────────────────────────────────────────┘
```

### 5.2 Fluxo de Dados n8n

```
Firestore Webhook
    ↓
n8n Workflow
    ├─ Parse + Validate
    ├─ Transform
    ├─ Logic (IF/THEN)
    ├─ Action (Send/Update/Create)
    └─ Log Result
    
Resultado:
    ├─ Slack Notification ✓
    ├─ Google Sheets Row ✓
    ├─ Firestore Batch Update ✓
    └─ Email ✓
```

---

## 6. Plano de Implementação (Fases)

### **FASE 1: Prototipagem (2 semanas)**

| Sprint | Atividade | Saída |
|--------|-----------|-------|
| 1 | n8n setup local + Firestore credentials | Docker compose + service account |
| 1 | ✅ Trigger 1 (Paradas longas) → Slack | Workflow testado em dev |
| 2 | ✅ Trigger 3 (Relatório diário) → PDF via email | Cron + PDF generation |
| 2 | Testes + documentação | README.md + screenshots |

**Deliverables:**
- n8n rodando localmente
- 2 workflows em produção
- Manual de uso

---

### **FASE 2: Produção (3 semanas)**

| Sprint | Atividade | Saída |
|--------|-----------|-------|
| 3 | ✅ Trigger 2 (Production → ERP) | API integration testada |
| 3 | ✅ Trigger 4 (Google Sheets ↔ Firestore) | Sync bidirecional |
| 4 | ✅ Trigger 5 (Alertas Qualidade) | WhatsApp alerts |
| 4 | Monitoring + alertas de falhas n8n | Slack alerts para falhas |

**Deliverables:**
- Workflows em container production
- Documentação de troubleshooting
- Backup automático ativado

---

### **FASE 3: Otimização (2 semanas)**

| Sprint | Atividade | Saída |
|--------|-----------|-------|
| 5 | Dashboard n8n (histórico de workflows) | Metrics + logs |
| 5 | Integração com logging (Firestore audit) | Rastreamento completo |
| - | ✅ Trigger 7 (Backup automático) | Backup diário |
| - | Documentação final + training | Wiki + vídeos |

**Deliverables:**
- Sistema 100% automatizado
- Documentação de manutenção
- Plano de disaster recovery

---

## 7. Tecnologias e Integrações

### Tecnologias Necessárias

| Componente | Versão | Notas |
|-----------|--------|-------|
| **n8n** | 1.0+ | Docker recomendado |
| **Firestore SDK** | v9+ | Já usado no HokkaidoMES |
| **Node.js** | 18+ | Runtime n8n |
| **Docker** | 20+ | Deployment |
| **PostgreSQL** | 14+ | BD n8n (optional: SQLite para dev) |

### Integrações Built-in n8n

- ✅ **Firebase/Firestore** (community node)
- ✅ **Google Sheets** (built-in)
- ✅ **Slack** (built-in)
- ✅ **Email/SMTP** (built-in)
- ✅ **HTTP** (built-in — para ERP APIs)
- ✅ **Schedule/Cron** (built-in)
- ✅ **Webhook** (built-in)

---

## 8. Estimativas e Custos

### Tempo de Desenvolvimento

| Fase | Duração | Esforço (h/dev) |
|------|---------|-----------------|
| Fase 1 (Proto) | 2 sem | 40h |
| Fase 2 (Produção) | 3 sem | 60h |
| Fase 3 (Otimização) | 2 sem | 30h |
| **TOTAL** | **7 semanas** | **~130h** |

### Custos de Infraestrutura

| Item | Custo/mês | Notas |
|------|-----------|-------|
| n8n (self-hosted Docker) | $0 | Usando servidor existente |
| PostgreSQL (para n8n BD) | $0 | Included em servidor |
| Google Sheets API | $0 | Free com limite |
| Slack API | $0 | Free workspace OK |
| **TOTAL** | **$0** | ✅ Sem custos adicionais |

**Observação:** Se usar n8n Cloud (hosted): ~$50-200/mês

---

## 9. Checklist Pré-Implementação

- [ ] n8n instalado e rodando localmente
- [ ] Firestore SDK testado com n8n
- [ ] Service account JSON obtido (Firestore)
- [ ] Slack workspace + bot criado
- [ ] Google Sheets + service account configurado
- [ ] Email/SMTP testado
- [ ] Testadores identificados (gestor + operador)
- [ ] Documentação de requisitos pronta
- [ ] Repositories GitHub criado para workflows

---

## 10. Roadmap Próximos 6 Meses

```
Fev 2026 (Agora)
    └─ Fase 1: Prototipagem
       └─ Fase 2: Produção

Mar 2026
    └─ Fase 3: Otimização
    └─ Triggers 1-7 finalizados

Abr-Mai 2026
    └─ Oportunidades de ML/AI
    └─ Integração SAP (se aplicável)

Jun 2026
    └─ Review + expansão
```

---

## 11. Métricas de Sucesso

| Métrica | Target | Como Medir |
|---------|--------|-----------|
| Tempo de resposta a paradas | < 5 min | Logs n8n |
| Alertas entregues com sucesso | > 98% | Dashboard n8n |
| Sincronização ERP | 100% de entries | Comparar Firestore vs ERP |
| Relatórios gerados | 100% on-time | Logs de schedule |
| Uptime n8n | > 99.5% | Monitoring |
| Horas economizadas/mês | > 15h | Anual: 180h = 1 FTE |

---

## 12. Próximos Passos

1. **Semana 1:** Setup n8n local + teste Firestore
2. **Semana 2:** Implementar Trigger 1 (Slack alertas)
3. **Semana 3:** Apresentar prototipo para stakeholders
4. **Semana 4-7:** Fases 2 e 3

---

## Referências

- [n8n Documentation](https://docs.n8n.io)
- [Firestore Integration (n8n community)](https://github.com/n8n-io/n8n-nodes-base/tree/master/packages/nodes-base/nodes/Firebase)
- [HokkaidoMES Architecture](./ARQUITETURA-MODULAR-MES.md)
- [Firestore Collections Map](./MAPA-ARQUIVOS-DEPLOY.md)

---

**Status:** ✅ Pronto para Kickoff  
**Próxima Revisão:** Após conclusão Fase 1
