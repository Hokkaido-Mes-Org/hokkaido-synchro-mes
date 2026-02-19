# HokkaidoMES — Análise de Valuation e ROI

> **Tipo de análise**: Sistema MES interno (uso próprio, sem intenção de venda)
> **Data de referência**: Fevereiro 2026
> **Escopo**: Avaliação de valor gerado, custo de reposição e retorno sobre investimento

---

## 📋 Sumário Executivo

| Métrica | Valor Estimado |
|---------|----------------|
| **Custo de Reposição** | R$ 1.200.000 – R$ 1.800.000 |
| **Valor Anual Gerado** | R$ 480.000 – R$ 720.000 |
| **ROI em 3 anos** | 180% – 300% |
| **Payback** | 18 – 24 meses |
| **Máquinas gerenciadas** | 26 injetoras |
| **Turnos monitorados** | 3 (24h/dia) |

---

## 1. Inventário Funcional do Sistema

### 1.1 Módulos Implementados

| # | Módulo | Arquivos | Linhas | Funcionalidades |
|---|--------|----------|--------|-----------------|
| 1 | **Lançamento de Produção** | launch.controller.js + script.js | ~4.500 | Registro de produção por máquina/turno, apontamento de refugos, histórico de lançamentos |
| 2 | **Planejamento Diário** | planning.controller.js | ~2.524 | Planejamento de produção, metas por máquina, sequenciamento |
| 3 | **Ordens de Produção** | orders.controller.js | ~1.020 | CRUD de ordens, ciclo de vida da OP, integração com planejamento |
| 4 | **Gestão de Paradas** | downtime.service.js, extended-downtime.controller.js | ~2.200 | Paradas ativas, classificação por tipo, duração, histórico, paradas prolongadas |
| 5 | **Análise e KPIs** | analysis.controller.js, advanced-kpis.js | ~9.300 | OEE em tempo real, MTBF, MTTR, FPY, tendências, comparativos |
| 6 | **Dashboard TV** | dashboard-tv.html | ~5.550 | Visualização chão de fábrica, status em tempo real, indicadores por turno |
| 7 | **Monitoramento Real-time** | monitoring.controller.js | ~759 | Acompanhamento de perdas, status de máquinas, alertas |
| 8 | **Relatórios** | reports.controller.js | ~464 | Relatórios de produção, paradas, eficiência |
| 9 | **Rastreabilidade** | traceability-system.js | ~1.202 | Rastreamento de lotes, histórico de produção por batch |
| 10 | **Ferramentaria** | tooling.controller.js | ~334 | Gestão de moldes, manutenções preventivas/corretivas |
| 11 | **Setup de Máquinas** | setup.controller.js | ~483 | Tracking de tempo de setup, análise por preparador |
| 12 | **Liderança/Escalas** | leadership.controller.js | ~672 | Escalas de operadores, absenteísmo, gestão de equipe |
| 13 | **PCP** | pcp.controller.js | ~1.127 | Mensagens, observações, comunicação com chão de fábrica |
| 14 | **PMP (Materiais)** | pmp.controller.js | ~780 | Gestão de borra, moído, sucata |
| 15 | **Admin/Histórico** | admin.controller.js, historico.controller.js | ~4.162 | Correção de dados, logs do sistema, auditoria |
| 16 | **Análise de Pareto** | auto-pareto-analysis.js | ~1.046 | Análise automática de causas, gráficos Pareto |
| 17 | **Importação ERP** | erp-import.js | ~1.016 | Integração com sistema ERP externo |
| 18 | **Fila/Agenda de Máquinas** | machine-queue.js, machine-schedule.js | ~1.270 | Sequenciamento, priorização de produção |
| 19 | **Sistema de Auth** | auth.js | ~494 | Login, roles, permissões por aba, controle de acesso |
| 20 | **Cache/Performance** | firebase-cache.service.js, state-manager.js | ~500 | Cache inteligente, redução de leituras Firebase |

### 1.2 Métricas de Código

| Métrica | Valor |
|---------|-------|
| **Total de arquivos** | 60 |
| **Linhas de JavaScript** | ~57.118 |
| **Linhas de HTML** | ~14.000 |
| **Linhas de CSS** | ~1.154 |
| **Collections Firebase** | 31 |
| **Endpoints/APIs internas** | ~150+ funções expostas |

---

## 2. Metodologia de Valuation

Para sistemas internos (não destinados à venda), utilizamos três métodos complementares:

### 2.1 Método 1: Custo de Reposição

> *"Quanto custaria desenvolver este sistema do zero hoje?"*

#### Estimativa de Esforço

| Componente | Complexidade | Horas Estimadas |
|------------|--------------|-----------------|
| Arquitetura e Firebase setup | Alta | 120h |
| Sistema de autenticação/roles | Média | 80h |
| Lançamento de produção | Alta | 200h |
| Gestão de paradas (ativas + histórico) | Alta | 160h |
| Planejamento e ordens | Alta | 180h |
| Análise e OEE (charts, KPIs) | Muito Alta | 280h |
| Dashboard TV | Média | 100h |
| Rastreabilidade | Alta | 120h |
| Ferramentaria/Setup/Liderança | Média | 200h |
| PCP/PMP | Média | 100h |
| Admin, histórico, logs | Média | 120h |
| Pareto automático | Média | 60h |
| Integração ERP | Média | 80h |
| Cache/Performance optimization | Alta | 100h |
| UI/UX completa (HTML/CSS/responsive) | Alta | 200h |
| Testes, QA, ajustes | — | 300h |
| Documentação | — | 100h |
| **TOTAL** | — | **2.500h** |

#### Cálculo de Custo

| Perfil | Taxa Horária | Proporção | Subtotal |
|--------|--------------|-----------|----------|
| Desenvolvedor Sênior Full Stack | R$ 180/h | 60% | R$ 270.000 |
| Desenvolvedor Pleno | R$ 120/h | 30% | R$ 90.000 |
| UX/Designer | R$ 100/h | 10% | R$ 25.000 |
| **Custo direto de desenvolvimento** | — | — | **R$ 385.000** |

**Overhead e custos indiretos** (gestão, infraestrutura, iterações):
- Fator multiplicador: 2,5x – 3,5x
- **Custo de reposição total**: **R$ 962.500 – R$ 1.347.500**

Arredondando com margem de segurança: **R$ 1.200.000 – R$ 1.800.000**

---

### 2.2 Método 2: Comparação com Soluções de Mercado

| Solução MES | Tipo | Custo Inicial | Custo Anual | Observações |
|-------------|------|---------------|-------------|-------------|
| **TOTVS MES** | On-premise | R$ 150.000+ | R$ 50.000+ | Licenciamento + customização |
| **SAP ME/MII** | Enterprise | R$ 500.000+ | R$ 120.000+ | Implantação complexa |
| **Siemens Opcenter** | Enterprise | R$ 300.000+ | R$ 80.000+ | Integração com automação |
| **Rockwell FactoryTalk** | Enterprise | R$ 200.000+ | R$ 60.000+ | Foco em automação |
| **ProShop ERP+MES** | SaaS | — | R$ 36.000+/ano | Por usuário |
| **Plex MES** | SaaS | — | R$ 60.000+/ano | Enterprise cloud |

**Comparativo**:
- Implantação de MES comercial para 26 máquinas: R$ 150.000 – R$ 300.000 inicial
- Custo anual de licença/suporte: R$ 50.000 – R$ 100.000
- **TCO 5 anos**: R$ 400.000 – R$ 800.000

O HokkaidoMES já foi desenvolvido internamente, eliminando custos de licenciamento perpétuo.

---

### 2.3 Método 3: Valor Gerado (Income Approach)

> *"Quanto o sistema economiza ou gera de valor anualmente?"*

#### 2.3.1 Ganhos de Disponibilidade (OEE - Disponibilidade)

**Premissas**:
- 26 máquinas operando 24h/dia, 3 turnos
- Tempo disponível/máquina/mês: 720h (30 dias × 24h)
- Custo médio hora-máquina injeção plástica: R$ 80-150/h
- Perda média SEM MES: 15-20% do tempo
- Perda COM MES otimizado: 10-12% do tempo

**Cálculo**:
| Item | Sem MES | Com MES | Diferença |
|------|---------|---------|-----------|
| Disponibilidade média | 82% | 89% | +7% |
| Horas recuperadas/mês por máquina | — | — | 50h |
| Horas recuperadas/mês total (26 máq) | — | — | 1.300h |
| Valor hora-máquina média | R$ 100 | R$ 100 | — |
| **Ganho mensal** | — | — | **R$ 130.000** |
| **Ganho anual** | — | — | **R$ 1.560.000** |

*Atribuição ao MES: 15-25% (restante é esforço operacional)*

**Ganho atribuível ao MES**: R$ 234.000 – R$ 390.000/ano

---

#### 2.3.2 Redução de Refugo/Scrap (OEE - Qualidade)

**Premissas**:
- Refugo médio SEM visibilidade: 3-5% da produção
- Refugo COM análise Pareto + rastreabilidade: 2-3%
- Produção mensal estimada: 2.000.000 peças
- Peso médio por peça: 50g
- Custo médio matéria-prima: R$ 8/kg

**Cálculo**:
| Item | Sem MES | Com MES | Diferença |
|------|---------|---------|-----------|
| % Refugo | 4% | 2,5% | -1,5% |
| Peças refugadas/mês | 80.000 | 50.000 | -30.000 |
| Kg refugados/mês | 4.000 kg | 2.500 kg | -1.500 kg |
| **Economia mensal** | — | — | **R$ 12.000** |
| **Economia anual** | — | — | **R$ 144.000** |

---

#### 2.3.3 Redução de Tempo de Setup

**Premissas**:
- Setups/mês: ~150 (média 5-6/máquina)
- Tempo médio setup SEM tracking: 45 min
- Tempo médio setup COM tracking: 35 min
- Custo hora-máquina: R$ 100

**Cálculo**:
| Item | Sem MES | Com MES | Diferença |
|------|---------|---------|-----------|
| Tempo médio setup | 45 min | 35 min | -10 min |
| Tempo total setup/mês | 112,5h | 87,5h | -25h |
| **Economia mensal** | — | — | **R$ 2.500** |
| **Economia anual** | — | — | **R$ 30.000** |

---

#### 2.3.4 Produtividade Administrativa

**Premissas**:
- Horas gastas em coleta manual de dados SEM sistema: 40h/semana
- Horas gastas COM sistema automatizado: 10h/semana
- Custo médio hora administrativa: R$ 50

**Cálculo**:
| Item | Sem MES | Com MES | Diferença |
|------|---------|---------|-----------|
| Horas/semana em coleta/análise | 40h | 10h | -30h |
| Horas economizadas/mês | — | — | 120h |
| **Economia mensal** | — | — | **R$ 6.000** |
| **Economia anual** | — | — | **R$ 72.000** |

---

#### 2.3.5 Resumo de Valor Gerado Anualmente

| Categoria | Ganho Anual (R$) |
|-----------|------------------|
| Disponibilidade (atribuível ao MES) | R$ 234.000 – 390.000 |
| Redução de refugo | R$ 144.000 |
| Redução tempo de setup | R$ 30.000 |
| Produtividade administrativa | R$ 72.000 |
| **TOTAL** | **R$ 480.000 – R$ 636.000** |

Considerando benefícios intangíveis (decisões mais rápidas, visibilidade, compliance):
**Valor anual total**: **R$ 480.000 – R$ 720.000**

---

## 3. Cálculo de ROI

### 3.1 Investimento Total Estimado

| Item | Valor |
|------|-------|
| Custo de desenvolvimento (estimado) | R$ 400.000 |
| Infraestrutura Firebase (3 anos) | R$ 36.000 |
| Manutenção e evolução (3 anos) | R$ 120.000 |
| **Investimento total (3 anos)** | **R$ 556.000** |

### 3.2 Retorno em 3 Anos

| Item | Valor |
|------|-------|
| Valor gerado anual (média) | R$ 600.000 |
| Valor gerado em 3 anos | R$ 1.800.000 |
| Investimento total | R$ 556.000 |
| **Retorno líquido** | **R$ 1.244.000** |
| **ROI** | **224%** |

### 3.3 Payback

| Cálculo | Valor |
|---------|-------|
| Investimento inicial | R$ 400.000 |
| Valor gerado/mês | R$ 50.000 |
| **Payback** | **8 meses** |

*Se considerarmos custo completo (dev + 3 anos operação): ~11 meses*

---

## 4. Benefícios Intangíveis (Não Quantificados)

| Benefício | Impacto |
|-----------|---------|
| **Visibilidade em tempo real** | Decisões mais rápidas, redução de tempo de resposta a problemas |
| **Histórico auditável** | Compliance, rastreabilidade para clientes, ISO |
| **Dashboard TV chão de fábrica** | Engajamento de operadores, transparência |
| **Análise de Pareto automática** | Foco nas causas principais, melhoria contínua |
| **Escalas e absenteísmo** | Planejamento de capacidade, redução de horas extras |
| **Integração PCP-Produção** | Menos ruído, comunicação clara |
| **Base para IA/ML futuro** | Dados estruturados para predição, manutenção preditiva |

---

## 5. Riscos e Considerações

| Risco | Mitigação |
|-------|-----------|
| **Dependência de desenvolvedor interno** | Documentação RAG, código modular, docs/ |
| **Firebase vendor lock-in** | Dados exportáveis, API Firebase padronizada |
| **Escala além de 26 máquinas** | Arquitetura já suporta, mas requer testes |
| **Desatualização tecnológica** | Stack estável (vanilla JS), sem frameworks pesados |
| **Perda de dados** | Backups Firebase automáticos, histórico Git |

---

## 6. Comparativo: Desenvolver vs Comprar

| Critério | HokkaidoMES (Interno) | MES Comercial |
|----------|----------------------|---------------|
| Custo inicial | R$ 400.000 (já investido) | R$ 150.000 – 500.000 |
| Custo anual | R$ 12.000 (Firebase) | R$ 50.000 – 100.000 |
| Customização | Total (código próprio) | Limitada/Custosa |
| Dependência externa | Baixa | Alta |
| Time-to-value | Imediato (já em produção) | 6-18 meses |
| Fit ao processo | 100% (feito para a operação) | 60-80% |
| Evolução | Ágil, sob demanda | Roadmap do fornecedor |

**Conclusão**: Para 26 máquinas e operação 24/7, o desenvolvimento interno foi a escolha correta. O sistema já está gerando valor e tem TCO inferior a alternativas comerciais.

---

## 7. Resumo Final

| Métrica | Valor |
|---------|-------|
| **Custo de Reposição** | R$ 1.200.000 – R$ 1.800.000 |
| **Valor Anual Gerado** | R$ 480.000 – R$ 720.000 |
| **ROI (3 anos)** | 180% – 300% |
| **Payback** | 8 – 12 meses |
| **TCO vs MES comercial (5 anos)** | 30-50% menor |
| **Linhas de código** | ~72.000 |
| **Meses de desenvolvimento estimado** | 12-18 meses eq. |

### Valor Estratégico

O HokkaidoMES não é apenas um sistema operacional — é um **ativo estratégico** que:

1. **Captura know-how operacional** da empresa em código
2. **Fornece base de dados** para futuras iniciativas de IA/ML
3. **Diferencia a operação** vs concorrentes sem MES
4. **Garante independência** de fornecedores externos
5. **Permite evolução ágil** conforme necessidades mudam

---

## 8. Recomendações

### 8.1 Para Maximizar ROI

1. ✅ **Continuar investindo em manutenção** — sistema gera 3-4x seu custo anual
2. ✅ **Expandir análise preditiva** — usar dados acumulados para ML
3. ✅ **Documentar processos** — RAG doc criado, manter atualizado
4. ✅ **Treinar equipe** — reduzir dependência de indivíduos

### 8.2 Para Próximos 12 Meses

| Iniciativa | Investimento | ROI Esperado |
|------------|--------------|--------------|
| Manutenção preditiva (ML) | R$ 50.000 | +R$ 80.000/ano |
| App mobile para lançamentos | R$ 30.000 | +R$ 20.000/ano |
| Integração completa ERP | R$ 40.000 | +R$ 30.000/ano |
| Dashboard de energia | R$ 20.000 | +R$ 15.000/ano |

---

*Documento preparado para avaliação interna de ativos tecnológicos.*
*Fevereiro 2026 — Hokkaido Plastics*
