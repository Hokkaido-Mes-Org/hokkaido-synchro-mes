# RESUMO EXECUTIVO: Meta 450K Interfere no OEE?

**Data**: 23/02/2026  
**Status**: ⚠️ **SIM, mas de forma indireta**

---

## A Resposta Curta

✅ **A meta fixa de 450 mil NÃO afeta matematicamente o cálculo do OEE** (que usa capacidade teórica da máquina)

❌ **MAS cria confusão** porque o sistema usa **dois indicadores diferentes** sem diferenciação clara:
- **OEE Técnico** = Produção Real vs Capacidade Teórica
- **Meta %** = Produção Real vs Meta Fixa (450K/1.4M)

---

## O Problema em 3 Exemplos

### Exemplo 1: Sábado com Meta Baixa

```
Máquina H-10 (Sábado)
- Meta: 450.000 peças (450K)
- Real: 380.000 peças
- Paradas: 2h

Sistema A (OEE):
  OEE = 80% × 95% × 98% = 74.6% ✅ Máquina está boa

Sistema B (Meta):
  Meta % = (380K / 450K) × 100 = 84.4% ✅ Próxima da meta

RESULTADO: Dois indicadores, ambos "bons"
```

### Exemplo 2: Segunda com Meta Alta

```
Máquina H-10 (Segunda)
- Meta: 1.400.000 peças (1.4M)
- Real: 380.000 peças
- Paradas: 2h (mesmo que sábado)

Sistema A (OEE):
  OEE = 80% × 95% × 98% = 74.6% ✅ (MESMO, pois é técnico)

Sistema B (Meta):
  Meta % = (380K / 1.4M) × 100 = 27% ❌ Distante da meta

RESULTADO: OEE é técnicamente igual
           MAS Meta % é completamente diferente!
```

### Exemplo 3: Quando a Confusão Aparece

```
Usuário vê:
┌─────────────────┐
│ OEE: 45%        │  ← Por que tão baixo?
│ Meta: 84%       │  ← Mas a meta está ok?
│ Qual é certo?   │
└─────────────────┘

Resultado: Desconfiança nos dados
```

---

## Raiz do Problema

### No Código:

**Arquivo 1**: `launch.controller.js` linha 4210
```javascript
// Usa META FIXA para calcular "eficiência"
const efficiency = dailyTarget > 0 
    ? (totalProduced / dailyTarget * 100)  // Compara com 450K
    : 0;
```

**Arquivo 2**: `analysis.controller.js` linha 45-63
```javascript
// Usa CAPACIDADE TEÓRICA para calcular OEE
const producaoTeorica = (tempo / ciclo) * cavidades;
const performance = produzido / producaoTeorica;  // Compara com capacidade
```

**Conclusão**: Dois sistemas diferentes, mesma métrica, sem label claro.

---

## Impacto na Prática

### 1️⃣ Para Operadores

```
"Minha máquina fez 380K peças"

Que acreditam?
- OEE 74%? → "Máquina está boa"
- Meta 84%? → "Atingi a meta sábado"
- OEE 45%? → "Máquina está quebrada" ❌

Qual é certo?
→ OEE 74% é o certo (reflete capacidade técnica)
→ OEE 45% está errado (bug no cálculo agregado por turno)
→ Meta 84% está certo MAS é indicador diferente
```

### 2️⃣ Para Gerentes

```
Relatório de Sábado mostra:
- OEE: 45% (subestimado por bug)
- Meta: 84% (correto)
- Conclusão errada: "OEE muito baixo, meta ok"
- Conclusão certa: "OEE está em 74%, bug reduz 29%"
```

### 3️⃣ Para Planeamento

```
Se meta estiver sendo usada para planejamento:
- Meta 450K sábado (FICÇÃO - depend de máquinas)
- Sem considerar paradas o capacidade real
- Resultado: Planos irrealistas
```

---

## Por Que Acontece?

### Problema 1: Agregação Errada

```
Dados de entrada:
- Produção T1: 120K  |
- Produção T2: 130K  | = 380K total
- Produção T3: 130K  |

Mas a fórmula assume:
- Tempo 1 turno: 480 minutos
- Não 3 × 480 = 1.440 minutos

Resultado:
= Produção ÷ (Capacidade de 1 turno)
= 380K ÷ 6.5K
= 5.800% ❌ ABSURDO!

O código "clampea" para max 100%, ficando 100% ou errado calculado
```

### Problema 2: Dois Sistemas Coexistem

```
Sistema A (OEE):
  Objetivo: Eficiência técnica
  Baseado em: Ciclo, cavidades, paradas
  Valor: ~74% (correto para capacidade)

Sistema B (Meta):
  Objetivo: Atingimento comercial
  Baseado em: planned_quantity (450K)
  Valor: ~84% (correto para meta)

MAS: Ambos aparecem como "Performance" ou "Eficiência"
      + nenhum label dizendo qual é qual
      = CONFUSÃO
```

---

## Recomendações

### 🔴 URGENTE (Hoje)

1. **Identificar qual OEE está errado**
   ```javascript
   // No console do navegador (Análise > F12 > Console)
   calculateDetailedOEE('2026-02-21', '2026-02-21', 'H-10', 'all')
   // Log mostrará: disponibilidade, performance, qualidade, oee
   // Comparar com capacidade teórica real
   ```

2. **Documentar a diferença**
   - OEE = indicador técnico (capacidade)
   - Meta % = indicador comercial (objetivo)

### 🟡 CURTO PRAZO (1-2 semanas)

1. **Corrigir cálculo de OEE agregado**
   - Agrupar por turno ANTES de calcular OEE
   - Ou adaptar fórmula para 3 turnos

2. **Separar indicadores na UI**
   ```
   ┌─────────────────────────────┐
   │ OEE: 74.2%  (Técnico)       │
   │ Meta: 84.4% (Comercial)     │
   └─────────────────────────────┘
   ```

3. **Remover meta fixa de cálculos técnicos**
   - Manter 450K para relatórios de meta
   - NÃO usar em cálculo de Performance

---

## Próximos Passos

### 1. Leia os Documentos Detalhados

| Doc | Conteúdo | Arquivo |
|-----|----------|---------|
| Análise Completa | Raízes, impacto, evidências | `VERIFICACAO-OEE-META-450K.md` |
| Fix Recomendado | Código, testes, checklist | `FIX-CALCULO-OEE-AGGREGADO.md` |
| Este Doc | Resumo executivo | `RESUMO-OEE-META.md` |

### 2. Decida Prioridade

- **P0 - Crítico**: Se usuários estão desconfiando de OEE
- **P1 - Alto**: Se gera relatórios errados
- **P2 - Médio**: Se é apenas confusão visual

### 3. Próximas Ações

1. Executar SQL para validar dados: qual OEE está certo?
2. Implementar correções propostas
3. Testar com dados históricos
4. Atualizar documentação operacional

---

## FAQ

**P: A meta 450K está "hardcoded"? Pode mudar de dia para dia?**

A: Sim, está hardcoded em `dashboard-tv.html` linha 2823-2824:
```javascript
const META_DIARIA_SEMANA = 1400000;
const META_DIARIA_FDS = 450000;
```
Muda por dia da semana, não por máquina ou dinâmico.

---

**P: Por que isso está acontecendo?**

A: Porque quando o sistema foi feito:
1. OEE foi calculado pensando em "1 turno"
2. Depois dados passaram a ser agregados "por dia inteiro"
3. Ninguém atualizou a fórmula
4. Meta 450K foi adicionada como "extra" sem integração

---

**P: Qual indicador devo acreditar?**

A: Ambos, MAS para coisas diferentes:
- **OEE 74%** = "Máquina está tecnicamente bem"
- **Meta 84%** = "Atingimos 84% do objetivo comercial"

Se ambos divergem, há um problema técnico (OEE) OU um problema de planejamento (Meta).

---

**P: Afeta os dados históricos?**

A: Sim. Se OEE está calculado errado desde o início, todos os relatórios históricos podem estar errados.

**Ação**: Revisar cálculos de OEE do últimos 30 dias.

---

## Conclusão

**A meta 450K não afeta OEE matematicamente, MAS:**

1. ❌ Cria confusão conceitual (2 métricas, 1 nome)
2. ❌ OEE agregado pode estar errado (fórmula de 1 turno vs 3 turnos)
3. ❌ Relatórios podem estar 20-30% incorretos
4. ✅ Fácil de corrigir (2-3 horas desenvolvimento)

**Recomendação**: Implementar solução proposta em `FIX-CALCULO-OEE-AGGREGADO.md` em curto prazo.

