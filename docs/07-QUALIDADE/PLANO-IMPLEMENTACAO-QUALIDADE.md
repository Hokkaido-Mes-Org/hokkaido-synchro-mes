# Aba Qualidade — Plano de Implementação

> **Versão**: 1.0 • **Data**: Fevereiro 2026  
> **Responsável**: Leandro de Camargo  
> **Status Atual**: Placeholder (Em Desenvolvimento)  
> **Acesso**: Exclusivo Leandro Camargo (role `suporte`)

---

## 1. Visão Geral

A aba **Qualidade** centralizará todo o controle de qualidade do processo de injeção plástica, unificando dados que hoje estão dispersos em outras abas (Análise, Lançamento, PMP, Rastreabilidade) e adicionando funcionalidades novas como inspeções, NCRs e SPC.

### Objetivo
Criar um módulo de qualidade completo que permita:
- Monitorar indicadores de qualidade em tempo real
- Registrar inspeções e planos de controle
- Gerar relatórios de não-conformidade (NCR)
- Controlar aprovação/rejeição de lotes
- Analisar tendências com cartas de controle (SPC)

---

## 2. O Que Já Existe no Sistema

### 2.1 Dados de Qualidade Coletados

| Dado | Coleção Firestore | Onde é usado hoje |
|------|-------------------|-------------------|
| Refugo (peças e kg) | `production_entries` (campos `refugo_kg`, `refugo_qty`, `motivo_refugo`) | Lançamento, Análise, Relatórios |
| Borra (kg) | `production_entries` + `pmp_borra` (campo `borras_kg`, `tipo_lancamento: 'borra'`) | Lançamento, PMP |
| Sucata | `pmp_sucata` | PMP |
| Moído/Reciclado | `pmp_moido` | PMP |
| Retrabalho | `rework_entries` (deduz da produção) | Lançamento |
| Registros de qualidade | `quality_records` (~200 docs, sem UI de escrita) | Rastreabilidade (leitura) |
| Status de qualidade por lote | `batch_traceability` (campo `qualityStatus`: APROVADO/CONDICIONAL) | Rastreabilidade |
| Testes de qualidade | `batch_traceability` (campo `qualityTests`) | Rastreabilidade |
| Ajustes de quantidade | `quantity_adjustments` | Admin Dados |
| Eventos de processo | `process_events` | Rastreabilidade |

### 2.2 Motivos de Refugo/Perda (Codificados)

| Categoria | Códigos | Exemplos |
|-----------|---------|----------|
| **PROCESSO** | 201–215 | Falha de injeção, Contaminação, Fiapo, Rebarba, Fora de cor, Fora de dimensional, Chupagem, Bolha, Queima, Manchas, Empenamento, Peças Scrap |
| **FERRAMENTARIA** | 101–109 | Galho preso, Marca d'agua, Marca de extrator, Risco, Sujidade molde, Lamina quebrada |
| **MÁQUINA** | 301–305 | Queda de energia, Parada emergencial, Vazamento de óleo |
| **MATÉRIA PRIMA** | 401–402 | Material não conforme, Material para limpeza |

### 2.3 Cálculo OEE — Componente Qualidade

**Arquivo fonte única**: `src/utils/oee.utils.js`

```
Qualidade = Peças Boas / (Peças Boas + Peças Refugadas)
Q = produzido / (produzido + refugoPcs)
```

- `refugoPcs` deve estar em **peças** (conversão de kg: `refugoKg * 1000 / pesoUnitário`)
- Se refugo = 0 e produção > 0, qualidade = 100%
- Valores limitados entre 0 e 1

### 2.4 Funcionalidades de Qualidade em Outras Abas

| Funcionalidade | Aba | Detalhes |
|----------------|-----|----------|
| Gauge de Qualidade (OEE) | Análise | Gráfico amber com `quality-gauge` |
| Lançamento de refugo | Lançamento | Formulário rápido + formulário manual |
| Lançamento de borra | Lançamento + PMP | Formulário dedicado |
| Lançamento de retrabalho | Lançamento | Modal dedicado, deduz da produção |
| Pareto de perdas | Análise | Por motivo, por máquina, por tipo de MP |
| Monitoramento de perdas | Acompanhamento | Perdas por máquina por turno |
| Gestão de perdas | Admin Dados | Busca, edição, exclusão de lançamentos |
| Relatório de refugo | Relatórios | Totais de refugo (kg) por máquina |
| Rastreabilidade de qualidade | Rastreabilidade | Status por lote, histórico de testes |
| Peso peça via qualidade | Lançamento | `quality_release` como fonte |

### 2.5 Variáveis JS Já Declaradas

Em `script.js`:
```javascript
let qualityTabInitialized = false;
let currentQualityContext = null;
let qualityPlansCache = { lastDate: null, plans: [] };
const QUALITY_AUTOFILL_ENABLED = false;
```

### 2.6 Usuário de Qualidade

Em `login.html` existe o usuário `time.qualidade` com acesso ao sistema.

---

## 3. Arquitetura Proposta

### 3.1 Estrutura de Arquivos

```
src/
  controllers/
    quality.controller.js     ← NOVO: Controller principal da aba
  services/
    quality.service.js        ← NOVO: CRUD Firestore para qualidade
```

### 3.2 Coleções Firestore Necessárias

| Coleção | Propósito | Campos Principais |
|---------|-----------|-------------------|
| `quality_inspections` | Registros de inspeção | `machine`, `product`, `shift`, `inspector`, `timestamp`, `type`, `results[]`, `status`, `photos[]` |
| `quality_plans` | Planos de controle por produto | `productCode`, `productName`, `checks[]`, `frequency`, `method`, `limits`, `createdBy` |
| `quality_ncr` | Relatórios de Não-Conformidade | `ncrNumber`, `machine`, `product`, `batch`, `description`, `severity`, `rootCause`, `correctiveAction`, `status`, `assignedTo`, `dueDate` |
| `quality_releases` | Liberações/aprovações de lote | `batch`, `product`, `machine`, `status`, `approvedBy`, `timestamp`, `notes`, `pieceWeight` |
| `quality_records` | **JÁ EXISTE** — enriquecer com UI | Adicionar UI para escrita |

### 3.3 Registro no Controller Registry

Em `script.js`, adicionar na `_controllerRegistry`:
```javascript
'qualidade': { 
    path: './src/controllers/quality.controller.js', 
    fn: 'setupQualidadePage' 
}
```

E na `_prefetchCollections`:
```javascript
'qualidade': ['production_entries', 'quality_records', 'batch_traceability']
```

---

## 4. Fases de Implementação

### Fase 1 — Dashboard de Indicadores (MVP)
**Prioridade**: Alta • **Complexidade**: Média

Exibir KPIs e gráficos usando **dados que já existem** no sistema:

#### KPIs
- **Taxa de Qualidade** (%) — do cálculo OEE existente
- **PPM** (Partes por Milhão defeituosas) — `(refugo / totalProduzido) * 1.000.000`
- **Refugo Total** (kg e peças) — do dia/semana/mês
- **Top 5 Motivos de Refugo** — Pareto usando `motivo_refugo`
- **Máquinas com Maior Refugo** — ranking

#### Gráficos
- Evolução da taxa de qualidade (últimos 30 dias)
- Pareto de defeitos por categoria (PROCESSO, FERRAMENTARIA, etc.)
- Refugo por máquina (barras horizontais)
- Refugo por turno (T1/T2/T3)

#### Fonte de Dados
```javascript
// Reutilizar funções cacheadas existentes
const entries = await getProductionEntriesCached(date);
const losses = entries.filter(e => e.tipo_lancamento === 'perda' || e.refugo_qty > 0);
```

#### Filtros
- Período (hoje, semana, mês, customizado)
- Máquina
- Produto
- Turno

---

### Fase 2 — Inspeções e Planos de Controle
**Prioridade**: Média • **Complexidade**: Alta

#### 2.1 Planos de Controle
- CRUD de planos de controle por produto/molde
- Definir itens de inspeção: dimensional, visual, funcional
- Frequência: início de turno, a cada N peças, troca de cor, etc.
- Limites: mín/máx, tolerância, referência (desenho)

#### 2.2 Formulário de Inspeção
- Seleção do produto/máquina (auto-preenchido se houver OP ativa)
- Checklist baseado no plano de controle
- Campos: conforme/não-conforme, valor medido, observação
- Fotos (usando Firebase Storage — já configurado)
- Resultado: APROVADO / REPROVADO / CONDICIONAL

#### 2.3 Tela de Inspeções Pendentes
- Lista de inspeções a realizar baseadas na frequência do plano
- Alerta visual quando inspeção está atrasada
- Integração com `batch_traceability` para vincular ao lote

---

### Fase 3 — NCR (Não-Conformidade)
**Prioridade**: Média • **Complexidade**: Média

#### 3.1 Abertura de NCR
- Campos: máquina, produto, lote, descrição do defeito, severidade (Crítica/Maior/Menor)
- Foto do defeito
- Quantidade afetada (peças e kg)
- Vincular a inspeção (se aplicável)

#### 3.2 Workflow de NCR
```
ABERTA → EM ANÁLISE → AÇÃO CORRETIVA → VERIFICAÇÃO → ENCERRADA
```

- Atribuir responsável
- Campo de causa raiz (Ishikawa simplificado: Máquina, Método, Material, Mão-de-obra, Meio-ambiente)
- Ação corretiva e prazo
- Verificação de eficácia

#### 3.3 Dashboard de NCRs
- NCRs abertas por status
- NCRs por máquina/produto
- Tempo médio de resolução
- NCRs vencidas (prazo expirado)

---

### Fase 4 — SPC (Controle Estatístico de Processo)
**Prioridade**: Baixa • **Complexidade**: Alta

#### 4.1 Cartas de Controle
- Carta X̄-R (média e amplitude) para dimensionais
- Carta p (proporção de defeituosos)
- Carta np (número de defeituosos)
- Limites de controle calculados automaticamente (LCS, LC, LCI)

#### 4.2 Análise de Capacidade
- Cálculo de Cp e Cpk por característica
- Histograma de distribuição
- Alertas quando processo sai de controle

#### 4.3 Integração
- Alimentar automaticamente com dados de inspeção (Fase 2)
- Vinculação com NCR quando ponto fora de controle

---

### Fase 5 — Funcionalidades Avançadas
**Prioridade**: Baixa • **Complexidade**: Alta

- **First Article Inspection (FAI)**: Workflow de aprovação para primeiro artigo
- **PPAP simplificado**: Documentação de aprovação de peça
- **Reclamações de cliente**: Registro e tracking
- **Auditoria de processo**: Checklists de auditoria periódica
- **Cost of Poor Quality (COPQ)**: Custo da não-qualidade (refugo × custo/kg)
- **Integração com ERP**: Exportar dados de qualidade

---

## 5. Design da Interface

### 5.1 Layout da Aba

```
┌─────────────────────────────────────────────────────┐
│ 🛡️ Qualidade — Controle de Qualidade e Inspeção     │
├─────────────────────────────────────────────────────┤
│ [Dashboard] [Inspeções] [NCRs] [SPC] [Planos]      │  ← Sub-tabs
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐               │
│  │Qual %│ │ PPM  │ │Refug.│ │NCRs  │               │  ← KPIs
│  │ 98.2 │ │18.000│ │ 45kg │ │  3   │               │
│  └──────┘ └──────┘ └──────┘ └──────┘               │
│                                                     │
│  ┌──────────────────┐ ┌──────────────────┐          │
│  │ Pareto Defeitos  │ │ Qualidade x Tempo│          │  ← Gráficos
│  │ ████████ 42%     │ │ ────────────     │          │
│  │ ██████   31%     │ │                  │          │
│  │ ███      15%     │ │                  │          │
│  └──────────────────┘ └──────────────────┘          │
│                                                     │
│  ┌──────────────────────────────────────┐           │
│  │ Refugo por Máquina (últimos 7 dias) │           │  ← Ranking
│  │ H01: ████████████  12.3 kg          │           │
│  │ H05: █████████     9.1 kg           │           │
│  │ H03: ██████         6.8 kg          │           │
│  └──────────────────────────────────────┘           │
└─────────────────────────────────────────────────────┘
```

### 5.2 Paleta de Cores

Manter consistência com as demais abas:
- **Header gradient**: `from-amber-500 to-orange-600` (já definido no placeholder)
- **KPI cards**: Amber/Orange para qualidade
- **Gráficos**: Paleta amber → green (ruim → bom)
- **Status NCR**: 🔴 Crítica, 🟡 Maior, 🟢 Menor

### 5.3 Navegação por Sub-tabs

Seguir o mesmo padrão da aba Análise (`analysis-tab-btn`):
```html
<div class="flex gap-1 overflow-x-auto">
    <button class="quality-tab-btn active" data-quality-tab="dashboard">Dashboard</button>
    <button class="quality-tab-btn" data-quality-tab="inspections">Inspeções</button>
    <button class="quality-tab-btn" data-quality-tab="ncr">NCRs</button>
    <button class="quality-tab-btn" data-quality-tab="spc">SPC</button>
    <button class="quality-tab-btn" data-quality-tab="plans">Planos</button>
</div>
```

---

## 6. Dependências e Integrações

### 6.1 Integração com Módulos Existentes

| Módulo | Integração |
|--------|------------|
| **Lançamento** | Leitura de `production_entries` para refugo/perdas |
| **Rastreabilidade** | Compartilhar `quality_records` e `batch_traceability` |
| **OEE (oee.utils.js)** | Componente de qualidade já calculado |
| **PMP** | Dados de borra, sucata e moído |
| **Análise** | Reutilizar filtros e funções de cache |
| **Relatórios** | Adicionar relatório tipo "Qualidade" |

### 6.2 Bibliotecas Requeridas

- **Chart.js** — já carregado (gráficos de barras, linha, doughnut)
- **XLSX** — já carregado (exportação Excel)
- **html2pdf** — já carregado (exportação PDF)
- **Lucide Icons** — já carregado (ícones)

### 6.3 Permissões

Configurado em `auth.js` (já implementado):
```javascript
if (tabName === 'qualidade' && !isAuthorizedAdmin) {
    return false;
}
```
- **Fase 1**: Apenas Leandro Camargo (suporte)
- **Futuro**: Expandir para `time.qualidade`, gestores e líderes conforme necessidade

---

## 7. Estimativas

| Fase | Escopo | Esforço Estimado | Leituras Firestore/dia |
|------|--------|------------------|------------------------|
| **Fase 1** | Dashboard com dados existentes | 2-3 dias | +5-15 (reutiliza cache) |
| **Fase 2** | Inspeções e planos de controle | 5-7 dias | +20-50 |
| **Fase 3** | NCR com workflow | 3-5 dias | +10-30 |
| **Fase 4** | SPC básico | 5-7 dias | +15-40 |
| **Fase 5** | Funcionalidades avançadas | 10+ dias | Variável |

### Impacto no Consumo Firebase

- Fase 1 praticamente **zero custo adicional** (reutiliza dados cacheados de `production_entries`)
- Fases 2-4 criam novas coleções, mas com volume baixo (inspeções: ~50-100/dia máximo)
- Usar `sharedQueryCache` existente para evitar leituras duplicadas

---

## 8. Checklist de Implementação

### Pré-requisitos
- [ ] Converter placeholder para sub-tabs layout
- [ ] Criar `src/controllers/quality.controller.js`
- [ ] Criar `src/services/quality.service.js`
- [ ] Registrar controller em `_controllerRegistry` no `script.js`
- [ ] Adicionar prefetch collections

### Fase 1 — Dashboard
- [ ] KPI: Taxa de Qualidade (%)
- [ ] KPI: PPM
- [ ] KPI: Refugo total (kg + peças)
- [ ] KPI: Borra total (kg)
- [ ] Gráfico: Evolução qualidade (últimos 30 dias)
- [ ] Gráfico: Pareto de motivos de refugo
- [ ] Gráfico: Refugo por máquina
- [ ] Gráfico: Refugo por turno
- [ ] Filtros: período, máquina, produto, turno
- [ ] Exportação Excel/PDF

### Fase 2 — Inspeções
- [ ] CRUD planos de controle
- [ ] Formulário de inspeção
- [ ] Lista de inspeções pendentes
- [ ] Upload de fotos
- [ ] Status: APROVADO/REPROVADO/CONDICIONAL
- [ ] Integração com `batch_traceability`

### Fase 3 — NCR
- [ ] Formulário de abertura
- [ ] Workflow de status
- [ ] Dashboard de NCRs
- [ ] Alertas de vencimento

### Fase 4 — SPC
- [ ] Carta X̄-R
- [ ] Carta p/np
- [ ] Cálculo Cp/Cpk
- [ ] Alertas de processo fora de controle

---

## 9. Referências Internas

| Arquivo | Relevância |
|---------|------------|
| `src/utils/oee.utils.js` | Cálculo de qualidade do OEE |
| `traceability-system.js` | Sistema de rastreabilidade com dados de qualidade |
| `database.js` | Motivos de refugo codificados, categorias de perda |
| `script.js` (linhas 2710-2720) | Variáveis de qualidade pré-declaradas |
| `script.js` (linhas 5316+) | Dashboard de perdas na aba Análise |
| `auth.js` (linha 134) | Controle de acesso da aba |
| `login.html` | Usuário `time.qualidade` |
| `src/controllers/analysis.controller.js` | Referência de padrão para controller com sub-tabs |

---

*Documento criado em Fevereiro 2026. Atualizar conforme cada fase for implementada.*
