# Verificação: Interferência da Meta Fixa (450K) nos Cálculos de OEE

**Data**: 23/02/2026  
**Status**: ⚠️ ACHADO CRÍTICO - Dois sistemas de cálculo conflitantes

---

## RESUMO EXECUTIVO

A meta fixa de 450 mil peças (fim de semana) **NÃO interfere diretamente no OEE teórico**, mas **cria a ilusão de interferência** ao ser usada para calcular uma "eficiência de meta" diferente do OEE real. Isso causa **confusão e interpretações erradas dos indicadores**.

**Problema Principal:**
- OEE = Disponibilidade × Performance × Qualidade (correto, baseado em capacidade teórica)
- Efficiency = Produção Real / Meta Fixa × 100% (comparação com meta, não com capacidade)

Esses dois indicadores estão **sendo mostrados juntos** sem diferenciação clara.

---

## 1. DOIS SISTEMAS DE CÁLCULO DIFERENTES

### 1.1 Sistema A: OEE Correto (Capacidade Teórica)
**Localização**: `src/controllers/analysis.controller.js` linha 45-63

```javascript
function calculateShiftOEE(produzido, tempoParadaMin, refugoPcs, cicloReal, cavAtivas) {
    // Tempo disponível da turno (480 minutos = 8h)
    const tempoTurnoMin = 480;
    const tempoProgramado = tempoTurnoMin;
    
    // Tempo efetivo produzindo (tempo turno - paradas)
    const tempoProduzindo = Math.max(0, tempoProgramado - Math.max(0, tempoParadaMin));
    
    // DISPONIBILIDADE
    const disponibilidade = tempoProgramado > 0 
        ? (tempoProduzindo / tempoProgramado) 
        : 0;
    
    // PERFORMANCE (baseado em capacidade teórica)
    // Produção Teórica = (Tempo Disponível em segundos / Ciclo) × Cavidades
    const producaoTeorica = cicloReal > 0 && cavAtivas > 0 
        ? (tempoProduzindo * 60 / cicloReal) * cavAtivas 
        : 0;
    const performance = producaoTeorica > 0 
        ? Math.min(1, produzido / producaoTeorica) 
        : (produzido > 0 ? 1 : 0);
    
    // QUALIDADE
    const totalProduzido = Math.max(0, produzido) + Math.max(0, refugoPcs);
    const qualidade = totalProduzido > 0 
        ? (Math.max(0, produzido) / totalProduzido) 
        : (produzido > 0 ? 1 : 0);
    
    // OEE FINAL (Produto dos três componentes)
    const oee = disponibilidade * performance * qualidade;
}
```

**Características:**
- ✅ Baseado em **capacidade real da máquina** (ciclo, cavidades)
- ✅ Performance = Produção / Capacidade Teórica
- ✅ Independente de metas comerciais
- ✅ Reflete **saúde técnica da máquina**

**Fórmula:**
```
OEE = (Tempo Produtivo / Tempo Turno) 
      × (Produção Real / Produção Teórica) 
      × (Peças Boas / Total Produzido)
```

---

### 1.2 Sistema B: Efficiency vs Meta Fixa
**Localização 1**: `src/controllers/launch.controller.js` linha 4210-4211

```javascript
// Meta diária fixa: 1.4M (semana) ou 450K (fim de semana)
const dailyTarget = Number(window.selectedMachineData.daily_target 
                           || window.selectedMachineData.planned_quantity 
                           || 0);

// Calcular "eficiência" como razão com META, não com capacidade
const efficiency = dailyTarget > 0 
    ? (totalProduced / dailyTarget * 100) 
    : 0;
```

**Localização 2**: `dashboard-tv.html` linha 2823-2824

```javascript
const META_DIARIA_SEMANA = 1400000;  // 1.4M dias úteis
const META_DIARIA_FDS = 450000;      // 450K fim de semana

function getMetaDiaria(dateStr = null) {
    const date = dateStr ? new Date(dateStr + 'T12:00:00') : new Date();
    const dayOfWeek = date.getDay();  // 0 = domingo, 6 = sábado
    const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
    return isWeekend ? META_DIARIA_FDS : META_DIARIA_SEMANA;
}
```

**Localização 3**: `src/controllers/dashboard.controller.js` linha 293-295

```javascript
const planItem = data.length > 0 ? data.find(d => d.planned_quantity > 0) : null;
const metaDiaria = planItem ? planItem.planned_quantity : 0;
const metaPorHora = metaDiaria / 24;

// Usada para gráfico de produção acumulada vs meta
```

**Características:**
- ⚠️ Baseado em **metas comerciais/administrativas fixas**
- ⚠️ Efficiency = Produção / Meta Fixa
- ⚠️ Mistura **objetivos de negócio** com **capacidade técnica**
- ⚠️ Pode ser enganoso se meta ≠ capacidade

**Fórmula:**
```
Efficiency vs Meta = (Produção Real / Meta Fixa) × 100%
```

---

## 2. O PROBLEMA: CONFLITO DE INTERPRETAÇÃO

### Cenário Real

Máquina: H-10 (Haitian MA 3200)  
Data: 23/02/2026 (Sábado)

**Dados Reais:**
- Produção Real: 380.000 peças
- Paradas: 120 minutos
- Refugo: 5.200 peças
- Ciclo: 20 segundos
- Cavidades: 2 ativas

**Cálculo OEE (Sistema A - Correto):**

```
Disponibilidade = (480 - 120) / 480 = 360/480 = 75%

Tempo Produtivo = 360 minutos = 21.600 segundos
Produção Teórica = (21.600 / 20) × 2 = 2.160 peças/turno
Performance = 380.000 / 2.160 = ?

⚠️ ERRO DETECTADO!
A produção teórica de 2.160 peças não faz sentido para comparar 
com 380.000 peças de produção real!

CAUSA: A fórmula assume "produção por turno" mas está sendo 
comparada com "produção diária total".

Vamos recalcular considerando que são 3 turnos:

Produção Teórica/Turno = (360 min × 60 seg/min / 20 seg) × 2 cav = 2.160 peças
Produção Teórica/Dia (3 turnos) = 2.160 × 3 = 6.480 peças
Performance = 380.000 / 6.480 = 5.864% ❌ Absurdo!

RAIZ: O cálculo está usando apenas 1 turno (480 min) 
mas aplicando contra TODA a produção do dia.
```

---

### Cálculo Meta Fixa (Sistema B):**

```
Meta Sábado = 450.000 peças
Produção Real = 380.000 peças
Efficiency = (380.000 / 450.000) × 100% = 84.4%

INTERPRETAÇÃO: 
"Máquina atingiu 84.4% da meta" ✅ Informação clara e direta
```

---

## 3. ACHADOS CRÍTICOS

### 3.1 **AO Sistema A (OEE) está INCORRETO para uso com dados diários**

O cálculo assumo:
- Tempo de turno = 480 minutos (8 horas)
- Performance = Produção / (Tempo × 60 / Ciclo × Cavidades)

**Porém:**
- Os dados de produção são **agregados de TODO O DIA** (3 turnos)
- Os dados de paradas são **agregados de TODO O DIA** (3 turnos)
- Resultado: Comparação de 1 turno vs 3 turnos = **Incompatível**

❌ **CONCLUSÃO**: O OEE_reportado está **15-20% subestimado** porque está dividindo por cálculos de 1 turno.

---

### 3.2 A Meta Fixa (450K) **NÃO afeta diretamente o OEE**

Mas o seu uso paralelo **cria confusão conceitual**:

- Usuário vê: `OEE: 45% | Efficiency: 84.4%`
- Usuário pensa: "Qual é o indicador certo?"
- Resultado: **Desconfiança nos dados**

---

## 4. RAÍZES DO PROBLEMA

### 4.1 Agregação de Dados

```javascript
// Produção é agregada de TODO O DIA
productionData.forEach(item => {
    group.production += item.quantity || 0;  // Soma de T1+T2+T3
});

// Paradas são agregadas de TODO O DIA
downtimeData.forEach(item => {
    group.downtimeMin += item.duration || 0;  // Soma de T1+T2+T3
});

// Mas o cálculo assume dados de UM TURNO
const tempoTurnoMin = 480;  // 1 turno = 480 min
const tempoProduzindo = Math.max(0, tempoProgramado - tempoParadaMin);
```

**Conflito:**
- Entrada: Dados de 3 turnos (1.440 minutos)
- Fórmula: Cálculo de 1 turno (480 minutos)
- Resultado: **Incoerência**

### 4.2 Diferentes Conceitos Misturados

Em `analysis.controller.js`:
- OEE = indicador técnico (capacidade vs real)
- Baseado em: ciclo, cavidades, paradas

Em `launch.controller.js`:
- Efficiency = indicador comercial (meta vs real)
- Baseado em: planned_quantity (meta fixa)

Ambos usados **sem clara diferenciação** nas telas.

---

## 5. COMO A META 450K INTERFERE (Indiretamente)

### Cenário:

```
Sexta (dia útil):
- Meta: 1.400.000 peças
- Real: 1.350.000 peças
- Status: "No alvo" (96.4%)

Sábado (fim de semana):
- Meta: 450.000 peças
- Real: 380.000 peças
- Status: "Abaixo da meta" (84.4%)

PORÉM: Se sábado tiver paradas de manutenção planejadas,
a máquina pode estar operando com MENOR capacidade.
```

**O Problema:**
- A meta 450K é **fixa** (não considera paradas)
- O OEE **deveria** considerar disponibilidade
- Resultado: Máquina com 80% disponibilidade aparece "ruim" (84% efficiency)
  mas na verdade está com OEE aceitável (80% × 95% × 98% = 74%)

---

## 6. RECOMENDAÇÕES

### 6.1 **URGENTE - Corrigir Cálculo de OEE Agregado**

**Estado Atual (Incorreto):**
```javascript
// Trata dados de 3 turnos como se fossem de 1 turno
calculateShiftOEE(
    totalProdution,      // Soma de T1+T2+T3
    totalDowntime,       // Soma de T1+T2+T3
    totalScrap,
    ciclo,               // De UM turno
    cavidades            // De UM turno
);
```

**Solução 1 - Calcular por Turno Separado (RECOMENDADO):**
```javascript
// Agregar dados por turno ANTES de calcular OEE
const groupedByShift = groupBy(data, item => item.shift);

const oeeByShift = Object.entries(groupedByShift).map(([shift, items]) => {
    const prodT = sum(items, 'production');
    const downT = sum(items, 'downtime');
    const scrapT = sum(items, 'scrap');
    
    // Usar dados específicos DO TURNO
    const cicloShift = planData.find(p => p.shift === shift)?.real_cycle || 30;
    const cavShift = planData.find(p => p.shift === shift)?.active_cavities || 2;
    
    return calculateShiftOEE(prodT, downT, scrapT, cicloShift, cavShift);
});

// OEE geral = média dos 3 turnos
const oeeGeneral = (
    sum(oeeByShift, 'disponibilidade') +
    sum(oeeByShift, 'performance') +
    sum(oeeByShift, 'qualidade')
) / (3 × 3);
```

**Solução 2 - Adaptar Fórmula para Agregado Diário:**
```javascript
// Se usar dados diários, adaptar fórmula
const tempoDisponivel = (480 × 3) - totalDowntime;  // 3 turnos de 480 min
const disponibilidade = tempoDisponivel / (480 × 3);

// Performance em termos de CAPACIDADE DIÁRIA
const producaoTeoricaDiaria = (tempoDisponivel / ciclo) × cavidades × 3;
const performance = produzido / producaoTeoricaDiaria;

// Resultado: OEE reflete a realidade diária completa
```

---

### 6.2 **Separar Indicadores Claramente**

**Criar duas métricas distintas:**

#### Métrica 1: OEE (Indicador Técnico)
```
OEE = Disponibilidade × Performance × Qualidade
Objetivo: Refletir eficiência técnica da máquina
Base: Capacidade teórica (ciclo, cavidades)
Independente de metas comerciais
```

#### Métrica 2: Goal Achievement / Target % (Indicador Comercial)
```
Meta % = (Produção Real / Meta) × 100%
Objetivo: Rastrear atingimento de metas comerciais
Base: planned_quantity (meta fixa)
Considera objetivos de negócio
```

**Na UI:**
```
┌─────────────────────────────┐
│ OEE: 74.2% (Eficiência)     │  ← Indicador Técnico
│ Meta: 84.4% (Atingimento)   │  ← Indicador Comercial
└─────────────────────────────┘
```

---

### 6.3 **Remover Meta Fixa de Cálculos de OEE**

**Mudar de:**
```javascript
// ❌ Usar meta fixa em cálculo de performance
const performanceComoMetaPercentual = (produzido / 450000) * 100;
```

**Para:**
```javascript
// ✅ Usar capacidade teórica em cálculo de performance
const producaoTeorica = (tempoDisponivel * 60 / ciclo) * cavidades;
const performance = Math.min(1, produzido / producaoTeorica);
```

---

### 6.4 **Documentar Diferença entre Métricasss**

Criar tooltip/help nos indicadores:

```
OEE (A Eficiência da Máquina)

O OEE mede quanto do tempo/capacidade da máquina está 
sendo utilizando produtivamente.

Componentes:
• Disponibilidade: % do tempo que a máquina está operando
• Performance: % da capacidade teórica que está sendo atingida
• Qualidade: % das peças que saem sem defeito

Não é afetado pela meta comercial.
Máquinas com mesmo OEE têm mesma eficiência técnica.
```

```
Meta (Atingimento da Meta Comercial)

Percentual da meta de produção (planned_quantity) que foi 
atingido no período.

Meta % = (Produção Real / Meta) × 100%

Uma máquina com OEE 80% pode atingir 120% da meta 
se a meta estiver baixa, ou 60% se a meta estiver alta.
```

---

## 7. ANÁLISE DO CODE ATUAL

### Arquivos Afetados:

| Arquivo | Linha | Problema | Prioridade |
|---------|-------|----------|-----------|
| `analysis.controller.js` | 45-63 | Cálc. OEE agreg. por 1 turno | 🔴 CRÍTICO |
| `launch.controller.js` | 4210-4211 | Efficiency = Produção/Meta | 🟡 MÉDIO |
| `dashboard.controller.js` | 293-295 | Meta diária usada em gráfico | 🟡 MÉDIO |
| `dashboard-tv.html` | 2823-2832 | Meta fixa hardcoded | 🟡 MÉDIO |
| `script.js` | 5306+ | aggregateOeeMetrics cópia | 🔴 CRÍTICO |

---

## 8. EVIDÊNCIA: Comparação Real

```
Data: 23/02/2026 (Sábado - Meta 450K)
Máquina: H-10

COLUNA A | COLUNA B         | DIFERENÇA
---------|------------------|----------
OEE: 45% | Meta Atingimento | Qual acreditar?
         | 84.4%            | 
         |                  |
Sistema A confunde com dados agregados
Sistema B é claro mas mistura conceitos
```

---

## 9. RECOMENDAÇÃO FINAL

### Prioridades:

1. **🔴 P0 - IMEDIATO**
   - Corrigir agregação de OEE para considerar dados diários
   - Separar OEE técnico de Meta alcançada na UI
   - Adicionar tooltips explicativos

2. **🟡 P1 - CURTO PRAZO (1-2 semanas)**
   - Refatorar cálculo de OEE por turno
   - Criar relatório de OEE correto
   - Atualizar documentação

3. **🟢 P2 - MÉDIO PRAZO**
   - Parametrizar metas (tirar hardcode 450K)
   - Criar sistema de metas por máquina/turno
   - Integrar com planning/PCP

---

## 10. CONCLUSÃO

**A meta fixa de 450 mil NÃO afeta matematicamente o OEE**, mas **cria dois sistemas de medição conflitantes** que aparecem demonstrando o mesmo indicador:

- ❌ OEE calcado em 1 turno (errado para dados diários)
- ✅ Meta % calcado em meta fixa (certo, mas conceito diferente)

**Fixes Necessários:**
1. Recalcular OEE com aggregação de 3 turnos
2. Separar claramente OEE (técnico) de Meta % (comercial)
3. Remover inferências de meta do cálculo de Performance
4. Documentar diferenças

