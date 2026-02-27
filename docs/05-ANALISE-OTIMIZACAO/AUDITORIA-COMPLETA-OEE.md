# Auditoria Completa: Cálculos de OEE — HokkaidoMES

**Data**: 23/02/2026  
**Escopo**: Todo o codebase (script.js, src/controllers/*, dashboard-tv.html)  
**Objetivo**: Identificar problemas, bugs e divergências; propor correções em fases

---

## SUMÁRIO EXECUTIVO

O sistema possui **7 fórmulas diferentes** de OEE espalhadas em **6 arquivos**, com **4 cópias** da função base `calculateShiftOEE`. Cada visualização calcula OEE de forma ligeiramente diferente, gerando números divergentes na mesma tela.

### Gravidade

| Nível | Qtd | Descrição |
|-------|-----|-----------|
| 🔴 CRÍTICO | 4 | Fórmulas erradas que produzem valores incorretos |
| 🟠 GRAVE | 3 | Inconsistências entre telas (usuário vê números diferentes) |
| 🟡 MÉDIO | 5 | Código duplicado, hardcoded, manutenção arriscada |
| 🟢 BAIXO | 3 | Melhorias de precisão e boas práticas |

---

## 1. MAPA COMPLETO DE FUNÇÕES OEE

### 1.1 Inventário de Funções (7 cálculos diferentes)

```
┌─────────────────────────────────────────────────────────────────┐
│  FUNÇÃO                        │ ARQUIVO              │ LINHAS │
├────────────────────────────────┼──────────────────────┼────────┤
│ A. calculateShiftOEE           │ resumo.controller    │ 32–52  │
│ B. calculateShiftOEE (cópia)   │ analysis.controller  │ 44–60  │
│ C. calculateShiftOEE (cópia)   │ script.js            │ 560    │
│ D. calculateShiftOEE (cópia)   │ dashboard-tv.html    │ 4719   │
│ E. calculateRealTimeOEE        │ resumo.controller    │ 55–165 │
│ F. calculateDashboardOEE       │ dashboard.controller  │ 161–203│
│ G. aggregateOeeMetrics         │ analysis.controller  │ 1328   │
│ H. aggregateOeeMetrics (cópia) │ script.js            │ 5306   │
│ I. aggregateOeeMetrics (cópia) │ dashboard-tv.html    │ 4498   │
│ J. calculateOverviewOEE        │ analysis.controller  │ 1645   │
│ K. calculateDetailedOEE        │ analysis.controller  │ 8813   │
│ L. calculateDetailedOEE (cópia)│ script.js            │ 8345   │
│ M. generateOEEDistributionChart│ analysis.controller  │ 4077   │
│ N. generateOEEComponentsTimeline│ analysis.controller │ 9019   │
│ O. Machine OEE Ranking (inline)│ analysis.controller  │ 2216   │
│ P. OEE per-machine card (TV)   │ dashboard-tv.html    │ 4135   │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Onde Cada Cálculo Aparece na UI

```
┌──────────────────────────┬────────────────────────────────────┐
│  TELA / COMPONENTE       │ FUNÇÃO(ÕES) USADA(S)              │
├──────────────────────────┼────────────────────────────────────┤
│ Dashboard Principal      │ E (RealTime) → fallback F (Dash)  │
│   └─ KPI Cards           │                                    │
│   └─ OEE por Turno chart │ A (ShiftOEE) por item             │
│   └─ Tendência 7 dias    │ loadOeeHistory (do Firestore)      │
│                          │                                    │
│ Aba Análise              │                                    │
│   └─ Overview OEE        │ J (OverviewOEE → G aggregate)     │
│   └─ Eficiência detalhada│ K (DetailedOEE → G aggregate)     │
│   └─ Ranking máquinas    │ O (inline, fórmula DIFERENTE!)     │
│   └─ Distribuição Donut  │ M (performance=0.85 HARDCODED!)   │
│   └─ Timeline            │ N (performance=prod/planned!)      │
│   └─ Heatmap             │ G (aggregateOeeMetrics)           │
│   └─ Relatório HTML      │ G → média por T1/T2/T3            │
│                          │                                    │
│ Aba Resumo               │ E (calculateRealTimeOEE)          │
│                          │                                    │
│ Aba Lançamento           │ E (calculateRealTimeOEE)          │
│                          │                                    │
│ Dashboard TV             │                                    │
│   └─ Anel OEE Central    │ I (aggregateOeeMetrics clone)     │
│   └─ Cards por máquina   │ P (prod/target — NÃO É OEE!)     │
└──────────────────────────┴────────────────────────────────────┘
```

---

## 2. BUGS E PROBLEMAS IDENTIFICADOS

### 🔴 BUG #1: Performance = 0.85 Hardcoded (CRÍTICO)

**Arquivo**: `analysis.controller.js` linha 4112  
**Função**: `generateOEEDistributionChart`  
**Tela**: Aba Análise → Gráfico Donut "Distribuição OEE por Máquina"

```javascript
// ❌ ERRADO: Performance fixada em 85%, ignorando dados reais
const performance = 0.85; // aproximação conservadora
const oeeFraction = availability * performance * quality;
```

**Impacto:**
- OEE do gráfico Donut **sempre** terá performance 85%, independente da realidade
- Se máquina realmente tem performance 60%, mostra 85%
- Se máquina tem performance 98%, mostra 85%
- **Resultado**: Gráfico inteiramente enganoso

**Correção necessária**: Usar cálculo de performance baseado em ciclo teórico (igual `calculateShiftOEE`), ou chamar `aggregateOeeMetrics` diretamente.

---

### 🔴 BUG #2: Performance = Produzido / Planejado (CONCEITO ERRADO)

**Arquivo**: `analysis.controller.js` linha 9090  
**Função**: `generateOEEComponentsTimeline`  
**Tela**: Aba Análise → Timeline de Componentes OEE

```javascript
// ❌ ERRADO: Usa "planned" (meta/planned_quantity) em vez de capacidade teórica
const performance = data.planned > 0 
    ? Math.min(100, (data.produced / data.planned) * 100) 
    : 100;  // ← Se sem plano, assume 100%!
```

**Problema:**
- `data.planned` vem de `item.planned || item.quantity`
- `item.planned` = `planned_quantity` (meta comercial), não capacidade teórica
- Se não tem `planned`, usa `item.quantity` (produção real = 100% sempre!)
- **Performance deveria ser**: Produção / Capacidade Teórica (ciclo × cavidades × tempo)

**Impacto:**
- Performance na timeline difere de todos os outros cálculos
- Se meta = 50K e produção = 45K: performance = 90% (conceito de meta, não OEE)
- Se meta = 10K e produção = 45K: performance = 100% (cap a 100%)
- **Resultado**: Timeline mostra valores totalmente desconectados dos gauges

---

### 🔴 BUG #3: Machine Ranking Usa Fórmula Diferente de Tudo

**Arquivo**: `analysis.controller.js` linhas 2228–2241  
**Função**: Inline em `loadEfficiencyAnalysis`  
**Tela**: Aba Análise → Ranking de Máquinas por OEE

```javascript
// ❌ DIVERGENTE: Usa tempo de turno variável (510/500/430/1440)
const TOTAL_AVAILABLE_MINUTES = shift 
    ? (shift === 1 ? 510 : shift === 2 ? 500 : 430)  // ← Diferente de 480!
    : 1440;  // ← Dia inteiro! (480 × 3 = 1440)

// ❌ DIVERGENTE: Performance = produção / planned_quantity (meta)
const performance = data.planned > 0 
    ? Math.min((data.production / data.planned) * 100, 100) 
    : 0;  // ← Se sem plano, assume 0%! (Vs. 100% no Timeline)
```

**3 divergências em relação ao cálculo padrão (`calculateShiftOEE`):**

| Aspecto | `calculateShiftOEE` | Machine Ranking |
|---------|---------------------|-----------------|
| Tempo disponível | 480 min (fixo) | 510/500/430/1440 (variável) |
| Performance base | Capacidade teórica | `planned_quantity` (meta) |
| Sem plano → | Performance = 1 | Performance = 0 |

**Impacto**: Ranking mostra OEEs inconsistentes com todos os outros. Usuário pode ver:
- Gauge OEE: 72%
- Ranking: mesma máquina com 45%
- Donut: mesma máquina com 68%

---

### 🔴 BUG #4: Dashboard TV Cards Usam Produção/Meta como "OEE"

**Arquivo**: `dashboard-tv.html` linha 4135–4137  
**Tela**: Dashboard TV → Cards individuais de máquinas

```javascript
// ❌ NÃO É OEE! É apenas atingimento de meta
let oee = 0;
if (m.target > 0) {
    oee = Math.min((m.produced / m.target) * 100, 100);
}
```

**Impacto:**
- Os cards de máquinas no TV mostram `produced/target` como "OEE"
- Enquanto o anel central do mesmo Dashboard TV calcula OEE real com `calculateShiftOEE`
- **Na mesma tela**: Anel mostra 74%, cards mostram 89% para mesma máquina
- **Resultado**: Confusão total. Operadores não sabem qual valor confiar

---

### 🟠 BUG #5: Dois Métodos de Agregação Produzem Resultados Diferentes

**Método A** - `calculateDashboardOEE` (dashboard.controller):
```javascript
// "Pools" tudo junto (totais absolutos)
disponibilidade = totalTempoProduzindo / totalTempoProgramado;
performance = totalProducaoBoa / totalProducaoTeorica;
qualidade = totalProducaoBoa / (totalProducaoBoa + totalRefugoPcs);
oee = D × P × Q;
```

**Método B** - `aggregateOeeMetrics` (analysis.controller):
```javascript
// Calcula por grupo, depois tira MÉDIA
disponibilidade = average(groups.map(g => g.disponibilidade));
performance = average(groups.map(g => g.performance));
oee = average(groups.map(g => g.oee));
```

**Método C** - `calculateOverviewOEE` (analysis.controller):
```javascript
// Pega médias do Método B, multiplica de novo
oee = avg(D) × avg(P) × avg(Q);
// ≠ avg(OEE)  porque E(XYZ) ≠ E(X)×E(Y)×E(Z)
```

**Diferença Matemática:**

Exemplo com 2 máquinas:
```
Máquina 1: D=0.9, P=0.8, Q=0.95 → OEE = 0.684
Máquina 2: D=0.6, P=0.9, Q=0.98 → OEE = 0.529

Método A (pool):   OEE = (0.75 × 0.85 × 0.965) = 0.615
Método B (avg OEE): OEE = (0.684 + 0.529) / 2  = 0.607
Método C (avg×avg): OEE = 0.75 × 0.85 × 0.965  = 0.615
```

**Impacto**: Dashboard e Análise mostram **6-8% diferente** para o mesmo período.

---

### 🟠 BUG #6: Disponibilidade Usa 480 min Fixo Independente do Turno Real

**Arquivo**: `resumo.controller.js` linha 33  
**Função**: `calculateShiftOEE`

```javascript
const tempoTurnoMin = 480;  // SEMPRE 480, para qualquer turno
```

**Porém em `calculateRealTimeOEE` (mesmo arquivo, L85):**
```javascript
const maxTurnoMin = currentShift === 'T1' ? 510 
                  : (currentShift === 'T2' ? 500 : 430);
```

**E no Machine Ranking (analysis.controller L2235):**
```javascript
const TOTAL_AVAILABLE_MINUTES = shift === 1 ? 510 
                              : shift === 2 ? 500 : 430;
```

**Problema**: O sistema reconhece que turnos têm durações diferentes (T1=510, T2=500, T3=430 min) mas a função base calcula **sempre com 480**. Isso cria inconsistência:

| Turno | Tempo Real | Tempo Usado | Erro |
|-------|-----------|-------------|------|
| T1 | 510 min (06:30–15:00) | 480 min | -6% na disponibilidade |
| T2 | 500 min (15:00–23:20) | 480 min | -4% na disponibilidade |
| T3 | 430 min (23:20–06:30) | 480 min | +12% na disponibilidade |

T3 especialmente afetado: turnos de 430 minutos calculados como 480 → disponibilidade **aparece 12% mais alta** do que realmente é.

---

### 🟠 BUG #7: `aggregateOeeMetrics` Usa Fallback Genérico Sem Validação

**Arquivo**: `analysis.controller.js` linhas 1522–1525  

```javascript
// Quando não há plano, usa valores INVENTADOS:
const metrics = calculateShiftOEE(
    group.production,
    group.downtimeMin,
    0,    // ← Refugo zerado! Ignora perdas reais
    30,   // ← Ciclo de 30 segundos (INVENTADO)
    2     // ← 2 cavidades (INVENTADO)
);
```

**Problema:**
- Máquinas sem plano ainda aparecem com OEE calculado
- Ciclo 30s e 2 cavidades é uma "chute" — pode ser 8s ou 120s na realidade
- Refugo é **zerado** (ignora dados reais de perdas)
- **Resultado**: OEE fictício para máquinas sem planejamento, poluindo a média geral

---

### 🟡 BUG #8: Qualidade Divergente (scrapPcs vs scrapKg)

Diferentes funções tratam perdas de forma diferente:

```javascript
// calculateShiftOEE (resumo): recebe refugoPcs diretamente
qualidade = produzido / (produzido + refugoPcs);

// calculateDashboardOEE: converte kg → pcs
totalRefugoPcs += Math.round(((item.refugo_kg || 0) * 1000) / pesoPeca);

// aggregateOeeMetrics: tenta pcs primeiro, depois kg
let refugoPcs = Math.round(Math.max(0, group.scrapPcs || 0));
if (!refugoPcs && group.scrapKg > 0 && pieceWeight > 0) {
    refugoPcs = Math.round((group.scrapKg * 1000) / pieceWeight);
}

// generateOEEComponentsTimeline: usa "scrap" sem conversão
quality = (data.produced - data.scrap) / data.produced;
// Subtrai do numerador em vez de somar ao denominador!
```

**4 tratamentos diferentes para qualidade!**

| Função | Numerador | Denominador | Fórmula |
|--------|-----------|-------------|---------|
| `calculateShiftOEE` | `produzido` | `produzido + refugoPcs` | $\frac{P}{P + R}$ |
| `calculateDashboardOEE` | `producaoBoa` | `producaoBoa + refugoPcs` | $\frac{P}{P + R}$ |
| `OEEComponentsTimeline` | `produced - scrap` | `produced` | $\frac{P - S}{P}$ |
| Machine Ranking | `production` | `production + losses` | $\frac{P}{P + L}$ |

**Diferença matemática** quando `scrap` ≠ 0:
- $\frac{P}{P + R}$ vs $\frac{P - S}{P}$ só são equivalentes se $R = S$ e temos $P = P_{total}$
- Se `produced` já exclui refugo: `produced/(produced+scrap)` ✅
- Se `produced` inclui refugo: `(produced-scrap)/produced` ✅
- **Mas qual é o caso?** Depende da fonte de dados e varia por tela!

---

### 🟡 BUG #9: `calculateRealTimeOEE` Não Limita Performance a 100%

**Arquivo**: `resumo.controller.js` linhas 134–135  

```javascript
// No cálculo real-time do turno atual:
const performanceReal = producaoTeoricaReal > 0 
    ? (group.produzido / producaoTeoricaReal) 
    : 0;  // ← Sem Math.min(1, ...)!
```

**Mas no `calculateShiftOEE` (mesmo arquivo, L41):**
```javascript
const performance = producaoTeorica > 0 
    ? Math.min(1, produzido / producaoTeorica)  // ← Com limite!
    : (produzido > 0 ? 1 : 0);
```

**Impacto**: Se produção real > capacidade teórica (ex: ciclo cadastrado errado, cavidades configuradas a menos), o OEE real-time pode mostrar **valores > 100%**, enquanto o cálculo por turno limita a 100%.

---

### 🟡 BUG #10: `ciclo_real` Não Seleciona Turno Correto em `calculateRealTimeOEE`

**Arquivo**: `resumo.controller.js` linhas 101–103

```javascript
ciclo_real: item.real_cycle_t1 || item.real_cycle_t2 || item.real_cycle_t3 || item.budgeted_cycle,
cav_ativas: item.active_cavities_t1 || item.active_cavities_t2 || item.active_cavities_t3 || item.mold_cavities
```

**Problema:** Usa `||` (OR) que retorna o primeiro valor truthy. Se T1 tem ciclo 0 (desligado), cai para T2. Mas **se o grupo é do turno T2**, deveria usar `real_cycle_t2` diretamente, não tentar T1 primeiro.

**Exemplo:**
```
Plano: T1 ciclo=25s, T2 ciclo=30s, T3 ciclo=28s
Grupo do turno T2:
  → item.real_cycle_t1 = 25 (truthy!)
  → Usa 25s em vez de 30s para o T2
  → Performance calculada 20% maior do que deveria!
```

**Correção**: Selecionar o ciclo do turno correto:
```javascript
const turnoKey = `real_cycle_t${group.turno?.replace('T','')}`;
ciclo_real: item[turnoKey] || item.budgeted_cycle || 30
```

---

### 🟡 BUG #11: Disponibilidade na Timeline Usa 480 min Para QUALQUER Período

**Arquivo**: `analysis.controller.js` linha 9086  

```javascript
// Agrupa dados POR DATA, mas usa 480 min fixo
const plannedMinutes = 480; // 8 horas
const availability = ((plannedMinutes - data.downtime) / plannedMinutes) * 100;
```

**Problema:** Se a data tem múltiplas máquinas e múltiplos turnos operando, `data.downtime` é a **soma de todas as paradas de todas as máquinas/turnos**, mas `plannedMinutes` é apenas 480 (1 turno de 1 máquina).

**Exemplo:**
- 10 máquinas operando 3 turnos = 10 × 3 × 480 = 14.400 min programados
- Total downtime do dia = 600 min (entre todas as 10 máquinas)
- **Cálculo atual**: (480 - 600) / 480 = **-25%** → clampea a 0%
- **Correto**: (14400 - 600) / 14400 = **95.8%**

---

### 🟡 BUG #12: Código Triplicado Sem Sincronização

As seguintes funções existem em **cópias idênticas** que podem divergir com o tempo:

| Função | Localização 1 | Localização 2 | Localização 3 |
|--------|---------------|---------------|---------------|
| `calculateShiftOEE` | resumo.controller L32 | analysis.controller L44 | script.js L560, dashboard-tv L4719 |
| `aggregateOeeMetrics` | analysis.controller L1328 | script.js L5306 | dashboard-tv L4498 |
| `calculateDetailedOEE` | analysis.controller L8813 | script.js L8345 | — |

**Risco**: Qualquer correção feita em uma cópia precisa ser replicada em todas as outras. Se falhar, os cálculos divergem silenciosamente.

---

### 🟢 MELHORIA #13: Valores Hardcoded Sem Configuração

| Valor | Significado | Localizações |
|-------|-------------|-------------|
| `480` | Minutos por turno | 6 arquivos, ~15 ocorrências |
| `510/500/430` | Duração real T1/T2/T3 | 2 locais |
| `30` | Ciclo padrão (seg) | 2 locais |
| `2` | Cavidades padrão | 2 locais |
| `0.1` | Peso peça padrão (kg) | 2 locais |
| `0.85` | Performance fixa | 1 local |
| `1,400,000` | Meta semanal | 1 local |
| `450,000` | Meta fim de semana | 1 local |

**Risco**: Qualquer mudança operacional (ex: turno passa a ser 7h) exige busca manual em dezenas de locais.

---

### 🟢 MELHORIA #14: `calculateOverviewOEE` Calcula OEE Duas Vezes

```javascript
function calculateOverviewOEE(...) {
    const { overall, filtered } = aggregateOeeMetrics(...);
    // aggregateOeeMetrics JÁ calcula overall.oee como avg(group.oee)
    
    // Mas calculateOverviewOEE RECALCULA como:
    const overallOee = overall.disponibilidade * overall.performance * overall.qualidade;
    // avg(D) × avg(P) × avg(Q) ≠ avg(D×P×Q)
}
```

**Resultado**: `overall.oee` ≠ `overallOee`. Qual usar? Depende de onde você está.

---

### 🟢 MELHORIA #15: Sem Testes Unitários Automatizados

Nenhum dos 7 cálculos de OEE tem testes automatizados. Qualquer refatoração pode introduzir regressões sem detecção.

---

## 3. TABELA RESUMO DE DIVERGÊNCIAS

### Comparação de Fórmulas (Todos os 7 Cálculos)

| Aspecto | ShiftOEE | RealTime | DashOEE | Aggregate | Ranking | Distrib. | Timeline |
|---------|----------|----------|---------|-----------|---------|----------|----------|
| **Disponibilidade** | | | | | | | |
| Base temporal | 480 | variável | 3×480 | 480 | 510/500/430 | período | 480 |
| Formula | $\frac{T-P}{T}$ | $\frac{T_{dec}-P}{T_{dec}}$ | $\frac{\sum T - \sum P}{\sum T}$ | via ShiftOEE | $\frac{T-P}{T}$ | $1-\frac{P}{T_{período}}$ | $\frac{480-P}{480}$ |
| **Performance** | | | | | | | |
| Base | Capacidade | Capacidade | Pool cap. | via ShiftOEE | **Meta** ⚠️ | **0.85** ⚠️ | **Meta** ⚠️ |
| Cap(100%) | ✅ min(1) | ❌ sem cap | ✅ implícito | ✅ via shift | ✅ min(100) | N/A | ✅ min(100) |
| Sem dados | 1 ou 0 | 0 | 0 | 1 ou 0 | **0** ⚠️ | 0.85 | **100%** ⚠️ |
| **Qualidade** | | | | | | | |
| Fórmula | $\frac{P}{P+R}$ | $\frac{P}{P+R}$ | $\frac{P}{P+R}$ | $\frac{P}{P+R}$ | $\frac{P}{P+L}$ | $\frac{P-L}{P}$ | $\frac{P-S}{P}$ ⚠️ |
| Conversão kg→pcs | Não | Sim | Sim | Sim | Não | Não | Não |
| **Agregação** | | | | | | | |
| Método | Por turno | Por turno | Pool total | Média grupos | Por máquina | Por máquina | Por dia |
| **OEE Final** | D×P×Q | D×P×Q | D×P×Q | avg(D×P×Q) | $\frac{D×P×Q}{10000}$ | D×P×Q | Não calcula |

**Legenda:** ⚠️ = diverge do padrão, ❌ = bug, P = produção, R = refugo, T = tempo, L = losses, S = scrap

---

## 4. PLANO DE CORREÇÃO EM FASES

### Fase 0: Quick Wins — Correções Críticas (Estimativa: 2-3 horas)

**Objetivo:** Eliminar bugs que produzem valores visivelmente errados.

#### 0.1 — Remover Performance = 0.85 Hardcoded 🔴
**Arquivo:** `analysis.controller.js` L4112

**De:**
```javascript
const performance = 0.85;
```

**Para:**
```javascript
// Usar aggregateOeeMetrics para calcular performance real
// ou cálculo inline com ciclo/cavidades do plano
const planForMachine = planData?.find(p => p.machine === machine);
const ciclo = planForMachine?.raw?.budgeted_cycle || 30;
const cav = planForMachine?.raw?.mold_cavities || 2;
const tempoDisponivel = Math.max(0, periodMinutes - totalDowntime);
const capacidadeTeorica = ciclo > 0 && cav > 0 
    ? (tempoDisponivel * 60 / ciclo) * cav 
    : 0;
const performance = capacidadeTeorica > 0 
    ? Math.min(1, totalProduced / capacidadeTeorica) 
    : 0;
```

#### 0.2 — Corrigir Performance na Timeline (prod/planned → capacidade) 🔴
**Arquivo:** `analysis.controller.js` L9090

**De:**
```javascript
const performance = data.planned > 0 
    ? Math.min(100, (data.produced / data.planned) * 100) 
    : 100;
```

**Para:**
```javascript
// Buscar ciclo e cavidades do plano para essa data
const dayPlan = planData.find(p => p.date === date);
const ciclo = dayPlan?.raw?.budgeted_cycle || 30;
const cav = dayPlan?.raw?.mold_cavities || 2;
const tempoDisponivel = Math.max(0, plannedMinutes - data.downtime);
const capacidadeTeorica = ciclo > 0 && cav > 0 
    ? (tempoDisponivel * 60 / ciclo) * cav 
    : 0;
const performance = capacidadeTeorica > 0 
    ? Math.min(100, (data.produced / capacidadeTeorica) * 100) 
    : 0;
```

#### 0.3 — Corrigir Machine Ranking (usar capacidade, não meta) 🔴
**Arquivo:** `analysis.controller.js` L2237

**De:**
```javascript
const performance = data.planned > 0 
    ? Math.min((data.production / data.planned) * 100, 100) 
    : 0;
```

**Para:**
```javascript
// Performance baseada em capacidade teórica
const planForMachine = planData.find(p => p.machine === mach);
const ciclo = planForMachine?.raw?.budgeted_cycle || 30;
const cav = planForMachine?.raw?.mold_cavities || 2;
const tempoDisp = Math.max(0, TOTAL_AVAILABLE_MINUTES - downtime);
const capTeorica = ciclo > 0 && cav > 0 
    ? (tempoDisp * 60 / ciclo) * cav 
    : 0;
const performance = capTeorica > 0 
    ? Math.min((data.production / capTeorica) * 100, 100) 
    : 0;
```

#### 0.4 — Corrigir Dashboard TV Cards (prod/target → label correto) 🔴
**Arquivo:** `dashboard-tv.html` L4135

**Opção A (renomear):**
```javascript
// Se mantiver prod/target, NÃO chamar de "OEE"
let goalAchievement = 0;  // Renomear variável
if (m.target > 0) {
    goalAchievement = Math.min((m.produced / m.target) * 100, 100);
}
// Na UI: mostrar como "Meta %" em vez de "OEE"
```

**Opção B (calcular OEE real):** Usar `calculateShiftOEE` com dados da máquina.

---

### Fase 1: Unificação da Função Base (Estimativa: 3-4 horas)

**Objetivo:** Uma única fonte de verdade para cálculo de OEE.

#### 1.1 — Criar `oee.utils.js` Centralizado

```javascript
// src/utils/oee.utils.js

/**
 * Configuração de turnos (importar de config ou Firestore futuramente)
 */
const SHIFT_CONFIG = {
    T1: { start: '06:30', end: '15:00', minutes: 510 },
    T2: { start: '15:00', end: '23:20', minutes: 500 },
    T3: { start: '23:20', end: '06:30', minutes: 430 },
    DEFAULT: { minutes: 480 }  // Fallback
};

/**
 * Calcula OEE para um turno específico
 * @param {Object} params
 * @param {number} params.produzido - Peças boas produzidas
 * @param {number} params.tempoParadaMin - Minutos de parada não-planejada
 * @param {number} params.refugoPcs - Peças refugadas
 * @param {number} params.cicloSeg - Tempo de ciclo em segundos
 * @param {number} params.cavidades - Cavidades ativas do molde
 * @param {string} [params.turno] - Turno ('T1', 'T2', 'T3') para usar duração correta
 * @returns {{ disponibilidade: number, performance: number, qualidade: number, oee: number }}
 */
function calculateOEE({ produzido, tempoParadaMin, refugoPcs, cicloSeg, cavidades, turno }) {
    // Tempo do turno: usar duração real se turno informado, senão default
    const config = turno ? SHIFT_CONFIG[turno] : null;
    const tempoProgramado = config?.minutes || SHIFT_CONFIG.DEFAULT.minutes;
    
    // Disponibilidade
    const tempoProduzindo = Math.max(0, tempoProgramado - Math.max(0, tempoParadaMin));
    const disponibilidade = tempoProgramado > 0 
        ? tempoProduzindo / tempoProgramado 
        : 0;
    
    // Performance (capacidade teórica)
    const producaoTeorica = (cicloSeg > 0 && cavidades > 0)
        ? (tempoProduzindo * 60 / cicloSeg) * cavidades
        : 0;
    const performance = producaoTeorica > 0
        ? Math.min(1, Math.max(0, produzido) / producaoTeorica)
        : (produzido > 0 ? 1 : 0);
    
    // Qualidade
    const totalProduzido = Math.max(0, produzido) + Math.max(0, refugoPcs);
    const qualidade = totalProduzido > 0
        ? Math.max(0, produzido) / totalProduzido
        : (produzido > 0 ? 1 : 0);
    
    // OEE
    const oee = disponibilidade * performance * qualidade;
    
    // Sanitizar
    const safe = (v) => (isNaN(v) || !isFinite(v)) ? 0 : Math.max(0, Math.min(1, v));
    
    return {
        disponibilidade: safe(disponibilidade),
        performance: safe(performance),
        qualidade: safe(qualidade),
        oee: safe(oee),
        _debug: { tempoProgramado, tempoProduzindo, producaoTeorica }
    };
}

/**
 * Calcula OEE em tempo real para turno parcial
 */
function calculateRealTimeOEE({ produzido, tempoDecorridoMin, tempoParadaMin, refugoPcs, cicloSeg, cavidades }) {
    const tempoProduzindo = Math.max(0, tempoDecorridoMin - Math.max(0, tempoParadaMin));
    
    const disponibilidade = tempoDecorridoMin > 0
        ? tempoProduzindo / tempoDecorridoMin
        : 0;
    
    const producaoTeorica = (cicloSeg > 0 && cavidades > 0)
        ? (tempoProduzindo * 60 / cicloSeg) * cavidades
        : 0;
    const performance = producaoTeorica > 0
        ? Math.min(1, Math.max(0, produzido) / producaoTeorica)
        : (produzido > 0 ? 1 : 0);
    
    const totalProduzido = Math.max(0, produzido) + Math.max(0, refugoPcs);
    const qualidade = totalProduzido > 0
        ? Math.max(0, produzido) / totalProduzido
        : (produzido > 0 ? 1 : 0);
    
    const oee = disponibilidade * performance * qualidade;
    
    const safe = (v) => (isNaN(v) || !isFinite(v)) ? 0 : Math.max(0, Math.min(1, v));
    
    return {
        disponibilidade: safe(disponibilidade),
        performance: safe(performance),
        qualidade: safe(qualidade),
        oee: safe(oee),
        isRealTime: true,
        tempoDecorrido: tempoDecorridoMin
    };
}

// Exportar
window.oeeUtils = { calculateOEE, calculateRealTimeOEE, SHIFT_CONFIG };
```

#### 1.2 — Substituir Todas as Cópias

| Cópia Atual | Ação |
|-------------|------|
| `resumo.controller.js` L32–52 | Delegar para `oeeUtils.calculateOEE` |
| `analysis.controller.js` L44–60 | Delegar para `oeeUtils.calculateOEE` |
| `script.js` L560–570 | Delegar para `oeeUtils.calculateOEE` |
| `dashboard-tv.html` L4719–4741 | Copiar `oee.utils.js` inline (TV é standalone) |

#### 1.3 — Selecionar Ciclo por Turno Correto

```javascript
// Em vez de:
ciclo_real: item.real_cycle_t1 || item.real_cycle_t2 || item.real_cycle_t3

// Usar:
function getCycleForShift(item, turno) {
    const key = `real_cycle_t${turno}`;
    return Number(item[key]) || Number(item.budgeted_cycle) || 30;
}

function getCavitiesForShift(item, turno) {
    const key = `active_cavities_t${turno}`;
    return Number(item[key]) || Number(item.mold_cavities) || 2;
}
```

---

### Fase 2: Unificação da Agregação (Estimativa: 4-5 horas)

**Objetivo:** Um único `aggregateOeeMetrics`, consistente em todo o sistema.

#### 2.1 — Decidir Método de Agregação Padrão

| Método | Prós | Contras | Recomendação |
|--------|------|---------|-------------|
| Pool (totais) | Máquinas grandes pesam mais | Complexo de debugar | **Para relatórios** |
| Média simples | Todas as máquinas iguais | Máquina parada pesa igual | **Para visão geral** |
| Média ponderada | Equilibra volume vs máquina | Mais complexo | **Para OEE da fábrica** |

**Recomendação:** Usar **média ponderada por volume de produção** como padrão:

```javascript
function aggregatedOEE(groups) {
    const totalProd = groups.reduce((s, g) => s + g.production, 0);
    if (totalProd === 0) return { D: 0, P: 0, Q: 0, OEE: 0 };
    
    const D = groups.reduce((s, g) => s + g.disponibilidade * g.production, 0) / totalProd;
    const P = groups.reduce((s, g) => s + g.performance * g.production, 0) / totalProd;
    const Q = groups.reduce((s, g) => s + g.qualidade * g.production, 0) / totalProd;
    
    return { D, P, Q, OEE: D * P * Q };
}
```

#### 2.2 — Remover Cópias Redundantes

| Arquivo | Função | Ação |
|---------|--------|------|
| `script.js` | `aggregateOeeMetrics` L5306 | Remover, delegar para `analysis.controller` |
| `dashboard-tv.html` | Clone inline L4498 | Manter cópia simplificada (standalone) |

#### 2.3 — Eliminar `calculateOverviewOEE` 

Função desnecessária que apenas re-multiplica médias. Substituir chamadas diretas por `aggregateOeeMetrics`.

#### 2.4 — Padronizar Tratamento sem Plano

```javascript
// Em vez de inventar ciclo=30, cav=2:
if (!planCandidates.length && group.production === 0) {
    return; // Ignorar do OEE (correto)
}
if (!planCandidates.length && group.production > 0) {
    // Marcar como "sem plano" para transparência
    groupsWithMetrics.push({
        ...group,
        semPlano: true,
        // Calcular apenas disponibilidade e qualidade
        disponibilidade: calculated,
        performance: null,  // ← Não inventar!
        qualidade: calculated,
        oee: null  // ← Sinalizar que OEE é incompleto
    });
    return;
}
```

---

### Fase 3: Consistência Visual (Estimativa: 3-4 horas)

**Objetivo:** Mesmo dados → mesmo número em todas as telas.

#### 3.1 — Dashboard TV: Separar OEE de Meta %

```javascript
// Cards de máquina: mostrar META % (não chamar de OEE)
const metaPercentual = target > 0 ? (produced / target * 100) : 0;
// Label na UI: "Meta" ou "Ating." (NUNCA "OEE")

// Anel central: manter OEE real (calculateShiftOEE via aggregateOeeMetrics)
```

#### 3.2 — Aba Análise: Unificar Todos os Cálculos

```
┌─────────────────────────────────────────────────────┐
│ ANTES (7 fórmulas diferentes):                      │
│                                                      │
│ Overview: calculateOverviewOEE                       │
│ Eficiência: calculateDetailedOEE                     │
│ Ranking: inline (meta-based)                         │
│ Donut: performance=0.85                              │
│ Timeline: performance=prod/planned                   │
│ Heatmap: aggregateOeeMetrics                         │
│ Relatório: aggregateOeeMetrics                       │
│                                                      │
│ DEPOIS (1 função):                                   │
│                                                      │
│ TUDO: aggregateOeeMetrics (unificado)                │
│ → Chamado uma vez por carregamento                   │
│ → Cached e reutilizado em todos os gráficos          │
└─────────────────────────────────────────────────────┘
```

#### 3.3 — Validação Cruzada (Sanity Check)

Adicionar validação em dev mode:

```javascript
if (process.env.NODE_ENV === 'development') {
    const oee1 = calculateShiftOEE(data);
    const oee2 = aggregateOeeMetrics(data);
    if (Math.abs(oee1.oee - oee2.overall.oee) > 0.05) {
        console.warn('🚨 OEE DIVERGÊNCIA:', oee1.oee, 'vs', oee2.overall.oee);
    }
}
```

---

### Fase 4: Qualidade e Robustez (Estimativa: 3-4 horas)

**Objetivo:** Garantir cálculos corretos e prevenção de regressão.

#### 4.1 — Testes Unitários

```javascript
describe('calculateOEE', () => {
    test('turno perfeito (sem paradas, sem refugo)', () => {
        const result = calculateOEE({
            produzido: 2880, // 480min × 60s / 10s × 1cav
            tempoParadaMin: 0,
            refugoPcs: 0,
            cicloSeg: 10,
            cavidades: 1,
            turno: 'T1'
        });
        expect(result.disponibilidade).toBeCloseTo(1.0);
        expect(result.performance).toBeCloseTo(0.94); // 510min reais
        expect(result.qualidade).toBeCloseTo(1.0);
    });
    
    test('com paradas e refugo', () => {
        const result = calculateOEE({
            produzido: 25000,
            tempoParadaMin: 60,
            refugoPcs: 500,
            cicloSeg: 20,
            cavidades: 2,
            turno: 'T2'
        });
        expect(result.disponibilidade).toBeCloseTo(0.88);
        expect(result.performance).toBeLessThanOrEqual(1.0);
        expect(result.qualidade).toBeCloseTo(0.98);
    });
    
    test('sem plano não inventa valores', () => {
        const result = calculateOEE({
            produzido: 1000,
            tempoParadaMin: 30,
            refugoPcs: 0,
            cicloSeg: 0,    // Sem ciclo
            cavidades: 0,   // Sem cavidades
        });
        expect(result.performance).toBe(1); // fallback: produzido>0 = 1
        // Não deve inventar capacidade teórica
    });
});
```

#### 4.2 — Documentar Fórmula Oficial

Criar seção no `MANUAL-TECNICO.md`:

```markdown
## Fórmula Oficial de OEE — HokkaidoMES

### Definições
- **Tempo Programado**: Duração do turno em minutos (T1=510, T2=500, T3=430)
- **Tempo Produzindo**: Tempo Programado − Paradas Não-Planejadas
- **Produção Teórica**: (Tempo Produzindo × 60 / Ciclo) × Cavidades
- **Peças Boas**: Produção total − Refugo

### Componentes
$$\text{Disponibilidade} = \frac{\text{Tempo Produzindo}}{\text{Tempo Programado}}$$

$$\text{Performance} = \min\left(1,\; \frac{\text{Peças Produzidas}}{\text{Produção Teórica}}\right)$$

$$\text{Qualidade} = \frac{\text{Peças Boas}}{\text{Peças Boas} + \text{Refugo (pcs)}}$$

$$\text{OEE} = \text{Disponibilidade} \times \text{Performance} \times \text{Qualidade}$$

### Regras
1. Performance NUNCA usa meta comercial (planned_quantity)
2. Performance SEMPRE usa capacidade teórica (ciclo × cavidades)
3. Sem ciclo/cavidades cadastrados = OEE "incompleto" (marcar na UI)
4. Agregação: média ponderada por volume de produção
```

#### 4.3 — Feature Flag para Novo Cálculo

```javascript
// src/config/feature-flags.js

// Adicionar:
OEE_V2: false,  // Quando true, usa oee.utils.js unificado
                 // Quando false, mantém cálculos legados
```

Permite rollback instantâneo se algo der errado.

---

### Fase 5: Parametrização e Dashboards Inteligentes (Estimativa: 6-8 horas)

**Objetivo:** Remover hardcodes e tornar o sistema adaptável.

#### 5.1 — Mover Configuração para Firestore

```javascript
// Coleção: system_config
// Documento: oee_config
{
    shifts: {
        T1: { startTime: "06:30", endTime: "15:00", minutes: 510 },
        T2: { startTime: "15:00", endTime: "23:20", minutes: 500 },
        T3: { startTime: "23:20", endTime: "06:30", minutes: 430 }
    },
    defaults: {
        cycleSec: 30,
        cavities: 2,
        pieceWeightKg: 0.1
    },
    targets: {
        weekday: 1400000,
        weekend: 450000
    },
    excludedCategories: ["PCP", "COMERCIAL", "ADMINISTRATIVO"]
}
```

#### 5.2 — Dashboard com Indicadores Separados

```
┌─────────────────────────────────────────────┐
│  OEE TÉCNICO           │  META COMERCIAL    │
│  ┌─────────────────┐   │  ┌──────────────┐  │
│  │      74.2%       │   │  │    84.4%      │  │
│  │   D×P×Q          │   │  │  Prod/Meta    │  │
│  └─────────────────┘   │  └──────────────┘  │
│  D: 88% P: 91% Q: 93% │  Meta: 450K/1.4M   │
│  (Capacidade Teórica)  │  (Objetivo)        │
└─────────────────────────────────────────────┘
```

#### 5.3 — Alerta de Inconsistência de Plano

```javascript
// Se máquina tem produção mas sem plano cadastrado:
if (group.production > 0 && !planCandidates.length) {
    showWarning(`⚠️ ${group.machine}: Produção registrada sem plano cadastrado. 
                 OEE de performance não pode ser calculado com precisão.`);
}
```

---

## 5. CRONOGRAMA E PRIORIDADES

```
                           IMPACTO
                   Alto ← ─ ─ ─ ─ → Baixo
               ┌────────┬──────────┬──────────┐
         Fácil │ FASE 0 │          │          │
               │ (2-3h) │          │          │
  ESFORÇO      ├────────┤          │          │
               │ FASE 1 │ FASE 3   │          │
               │ (3-4h) │ (3-4h)   │          │
               ├────────┤          │          │
       Difícil │ FASE 2 │ FASE 4   │ FASE 5   │
               │ (4-5h) │ (3-4h)   │ (6-8h)   │
               └────────┴──────────┴──────────┘
```

### Timeline Sugerida

| Fase | Sprint | Estimativa | Risco | Pré-requisito |
|------|--------|-----------|-------|---------------|
| **0. Quick Wins** | Sprint atual | 2-3h | ZERO | Nenhum |
| **1. Unificar Base** | Sprint +1 | 3-4h | BAIXO | Fase 0 |
| **2. Unificar Agregação** | Sprint +1 | 4-5h | MÉDIO | Fase 1 |
| **3. Consistência Visual** | Sprint +2 | 3-4h | BAIXO | Fases 1-2 |
| **4. Qualidade** | Sprint +2 | 3-4h | BAIXO | Fase 2 |
| **5. Parametrização** | Sprint +3 | 6-8h | MÉDIO | Fases 1-4 |

**Total estimado: 21-28 horas de desenvolvimento**

---

## 6. MÉTRICAS DE SUCESSO

### Após Fase 0:
- [ ] Zero gráficos com performance hardcoded
- [ ] Todos os cálculos usam capacidade teórica para Performance

### Após Fase 2:
- [ ] `calculateShiftOEE` existe em apenas 1 local (+1 cópia no TV)
- [ ] `aggregateOeeMetrics` existe em apenas 1 local (+1 cópia no TV)
- [ ] Mesmos dados → mesmo OEE em Dashboard e Análise

### Após Fase 4:
- [ ] Testes unitários com cobertura ≥ 90% das funções OEE
- [ ] Documento de referência de fórmula OEE oficial
- [ ] Feature flag permitindo rollback

### Após Fase 5:
- [ ] Zero valores hardcoded (tudo em Firestore/config)
- [ ] OEE técnico separado de Meta comercial em todas as telas
- [ ] Alerta visual quando plano está incompleto

---

## 7. REFERÊNCIA RÁPIDA: BUGS POR PRIORIDADE

### 🔴 Corrigir Imediatamente (Fase 0)
1. Performance = 0.85 hardcoded (`analysis.controller.js` L4112)
2. Performance = prod/planned na Timeline (`analysis.controller.js` L9090)
3. Performance = prod/planned no Ranking (`analysis.controller.js` L2237)
4. Dashboard TV Cards mostra prod/target como "OEE" (`dashboard-tv.html` L4135)

### 🟠 Corrigir em Breve (Fases 1-2)
5. Método de agregação inconsistente (pool vs média vs avg×avg)
6. Tempo de turno fixo 480 vs duração real 510/500/430
7. Fallback com ciclo=30/cav=2 inventados

### 🟡 Corrigir em Médio Prazo (Fases 3-4)
8. Qualidade: 4 fórmulas diferentes (P/(P+R) vs (P-S)/P)
9. RealTime sem cap em performance (pode > 100%)
10. Seleção de ciclo por turno com `||` em vez de turno correto
11. Timeline Disponibilidade usa 480 min para agregado multi-máquina
12. Código triplicado sem sincronização

### 🟢 Melhorar Gradualmente (Fase 5)
13. Valores hardcoded sem configuração central
14. `calculateOverviewOEE` redundante
15. Sem testes automatizados

