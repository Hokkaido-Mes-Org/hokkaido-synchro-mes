# Cálculo OEE Agregado — Arquitetura Implementada

**Status**: ✅ IMPLEMENTADO (Fases 0–2 concluídas em 2026-02-23)
**Última atualização**: 2026-02-23

---

## 1. VISÃO GERAL

O sistema calcula OEE em três camadas:

```
┌─────────────────────────────────────────────────────────┐
│  src/utils/oee.utils.js  — FONTE ÚNICA DE VERDADE      │
│                                                         │
│  calculateOEE()          → OEE de 1 turno completo     │
│  calculateShiftOEE()     → wrapper retrocompatível      │
│  calculateRealTimeShiftOEE() → turno em andamento       │
│  getPlanParamsForShift()  → ciclo/cav corretos p/ turno │
│  getShiftMinutes()        → T1=510, T2=500, T3=430 min │
└───────────────┬─────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────┐
│  aggregateOeeMetrics()  — AGREGAÇÃO DA PLANTA           │
│  (analysis.controller.js + clone em dashboard-tv.html)  │
│                                                         │
│  1. Agrupa por máquina × turno × dia                    │
│  2. Calcula OEE individual por grupo                    │
│  3. Pondera por tempo programado (shiftMinutes)         │
│  4. Retorna: oee (avg), oeeDecomposed (D×P×Q), D, P, Q │
└───────────────┬─────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────┐
│  Callers: loadOverviewData, calculateDetailedOEE,       │
│  debugOEE, generateOEEComponentsTimeline, heatmap       │
└─────────────────────────────────────────────────────────┘
```

---

## 2. FÓRMULA OEE INDIVIDUAL (por turno/máquina)

**Arquivo**: `src/utils/oee.utils.js` → `calculateOEE()`

```
Disponibilidade = (TempoProgramado − TempoParada) / TempoProgramado

                         Produção Real
Performance    = ─────────────────────────────────────
                  (TempoProduzindo × 60 / CicloSeg) × Cavidades

                   Peças Boas
Qualidade      = ─────────────────────
                  Peças Boas + Refugo

OEE = D × P × Q
```

### Regras:
- **Performance** sempre baseada em capacidade teórica (ciclo × cavidades), **NUNCA** em meta comercial
- **Qualidade** = `P / (P + R)`, consistente em todas as telas
- Valores são clamped em `[0, 1]` via `_safe()`
- Sem plano / ciclo = 0 → Performance retorna 1 se houve produção, 0 se não

### Configuração de Turnos:
| Turno | Horário | Minutos |
|-------|---------|---------|
| T1 | 06:30 – 15:00 | 510 |
| T2 | 15:00 – 23:20 | 500 |
| T3 | 23:20 – 06:30 | 430 |
| DEFAULT | — | 480 |

---

## 3. AGREGAÇÃO DA PLANTA

**Arquivo**: `src/controllers/analysis.controller.js` → `aggregateOeeMetrics()`

### 3.1 Agrupamento

Dados são agrupados por chave composta: `{máquina}_{turno}_{data}`

Cada grupo acumula:
- `production` — soma de `quantity`
- `scrapPcs` / `scrapKg` — soma de perdas
- `downtimeMin` — soma de paradas (excluindo categorias excluídas e paradas semOP de máquinas sem plano)

### 3.2 Filtros de Paradas

Antes de somar ao grupo, cada parada é verificada:

1. **semOP sem planejamento** → ignorada (máquina sem OP e sem plano ativo)
2. **Categoria excluída do OEE** → ignorada (via `oeeExcludedCategories`)

### 3.3 Cálculo por Grupo

Para cada grupo:

| Condição | Comportamento |
|----------|--------------|
| **Com plano** | `calculateShiftOEE(prod, parada, refugo, ciclo, cav)` com ciclo/cav do turno via `getPlanParamsForShift` |
| **Sem plano + com produção** | D e Q calculados inline; `performance: null`, `oee: null`, `semPlano: true` |
| **Sem plano + sem produção** | **Ignorado** (não entra na média) |

### 3.4 Ponderação — Tempo Programado

```javascript
const weightedAvg = (items, selector) => {
    const validItems = items.filter(g => selector(g) !== null);
    const totalWeight = validItems.reduce((s, g) => s + g.shiftMinutes, 0);
    return validItems.reduce((s, g) => s + selector(g) * g.shiftMinutes, 0) / totalWeight;
};
```

**Peso de cada grupo** = `shiftMinutes` (T1=510, T2=500, T3=430)

Justificativa: turnos mais longos pesam proporcionalmente mais, mas todas as máquinas programadas contribuem igualmente dentro do mesmo turno. Evita viés de seleção que ocorreria ao ponderar por produção real (onde máquinas paradas seriam invisíveis).

### 3.5 Dois Métodos de OEE Agregado

O retorno inclui ambos:

| Campo | Método | Uso |
|-------|--------|-----|
| `oee` | `avg_w(OEE_individual)` | Card principal, KPI único, benchmark |
| `oeeDecomposed` | `avg_w(D) × avg_w(P) × avg_w(Q)` | Gráficos de decomposição, Pareto de perdas |

### 3.6 Tratamento de Máquinas "sem plano"

Grupos com `semPlano: true` (performance/oee = `null`):
- **Incluídos** em Disponibilidade e Qualidade
- **Excluídos** de Performance e OEE (o `weightedAvg` filtra items com `null`)

---

## 4. CALLERS E RETORNO

### Estrutura do retorno:

```javascript
{
    overall: {
        disponibilidade: 0.87,   // Média ponderada (todas as máquinas/turnos)
        performance: 0.72,
        qualidade: 0.98,
        oee: 0.61,               // avg_w(OEE_i)
        oeeDecomposed: 0.614     // D × P × Q
    },
    filtered: { /* mesmo formato, filtrado por turno */ },
    groups: [
        {
            machine: 'H-01', shift: 1, workDay: '2026-02-23',
            production: 12500, shiftMinutes: 510,
            disponibilidade: 0.9, performance: 0.75, qualidade: 0.99,
            oee: 0.668, semPlano: false
        },
        // ...
    ]
}
```

### Callers na codebase:

| Caller | Destructuring | O que usa |
|--------|--------------|-----------|
| `loadOverviewData` (L1289) | `{ overall, filtered }` | `.oee` para cards |
| `debugOEE` (L2117) | `{ filtered }` | `.disponibilidade`, `.performance`, `.qualidade` |
| `calculateDetailedOEE` (L8861) | `{ filtered, groups }` | `.oee`, `.disponibilidade`, `.performance` |
| `generateOEEComponentsTimeline` (L9225) | `{ groups }` | Itera nos groups individualmente |

---

## 5. DASHBOARD TV (standalone)

**Arquivo**: `dashboard-tv.html`

Contém clone inline da lógica de agregação (não usa ES6 modules).
Mesma ponderação por `shiftMinutes` via `getShiftMinutesTV()`.
Última sincronização: 2026-02-23.

---

## 6. HISTÓRICO DE CORREÇÕES

### Fase 0 — 4 bugs críticos
| Bug | O que era | Correção |
|-----|-----------|----------|
| Performance = 0.85 hardcoded | `generateOEEDistributionChart` | Cálculo real com ciclo/cavidades |
| Timeline prod/planned | `generateOEEComponentsTimeline` | Performance por capacidade teórica |
| Ranking prod/planned | Machine OEE Ranking | Idem |
| Cards TV "OEE" = prod/target | Dashboard TV | Renomeado para "Meta" |

### Fase 1 — Fonte única de cálculo
- Criado `src/utils/oee.utils.js` com `calculateOEE`, `calculateShiftOEE`, `getPlanParamsForShift`
- 4 cópias duplicadas unificadas (resumo, analysis, script.js, dashboard-tv)
- Fix do bug `||` na seleção de ciclo/cavidades por turno

### Fase 2 — Unificação da agregação
- `aggregateOeeMetrics`: média simples → ponderada por tempo programado
- `calculateOverviewOEE` removida (era redundante)
- Dead code removido de `script.js` (~390 linhas)
- Grupos "sem plano": performance inventada → `null` (transparente)
- Retorno inclui `oee` (KPI) e `oeeDecomposed` (decomposição D×P×Q)

---

## 7. ARQUIVOS RELEVANTES

| Arquivo | Responsabilidade |
|---------|-----------------|
| `src/utils/oee.utils.js` | Cálculo individual — fonte única |
| `src/controllers/analysis.controller.js` | Agregação (`aggregateOeeMetrics`) |
| `src/controllers/resumo.controller.js` | OEE em tempo real do resumo |
| `dashboard-tv.html` | Clone standalone para TV |
| `src/index.js` | Registro do módulo oee.utils |

---

## 8. EXEMPLO NUMÉRICO

```
Máquina H-01, T1 (510 min), ciclo=25s, cav=4, produção=4500, parada=60min, refugo=50pç

TempoProduzindo = 510 - 60 = 450 min
D = 450 / 510 = 88.2%

ProdTeórica = (450 × 60 / 25) × 4 = 4320 pç
P = 4500 / 4320 = 100% (capped)

Q = 4500 / (4500 + 50) = 98.9%

OEE = 0.882 × 1.0 × 0.989 = 87.2%
```

```
Agregação de 2 turnos:
  H-01 T1: shiftMinutes=510, OEE=87.2%
  H-01 T2: shiftMinutes=500, OEE=72.0%

  OEE_planta = (87.2% × 510 + 72.0% × 500) / (510 + 500)
             = (44472 + 36000) / 1010
             = 79.7%
```

---

## 9. PENDÊNCIAS FUTURAS

- [ ] **Fase 3**: Consistência visual em todas as telas (gráficos que ainda não usam `oeeDecomposed`)
- [ ] **Fase 4**: Testes unitários + documentação GUIA-OPERACIONAL
- [ ] **Fase 5**: Migrar `SHIFT_CONFIG` para Firestore (`system_config/oee_config`)

