# 📊 Estudo de Uso de Leituras Firebase por Aba

**Data:** Fevereiro 2026  
**Sistema:** Hokkaido MES  
**Objetivo:** Análise de consumo de leituras para redução de custos

---

## 📈 Resumo Executivo

### Distribuição de Referências por Coleção

| Coleção | Total Refs | Leituras (.get) | % do Total |
|---------|-----------|-----------------|------------|
| production_entries | 69 | 20 | **24%** |
| production_orders | 67 | 15 | **18%** |
| planning | 47 | 14 | **17%** |
| downtime_entries | 32 | 8 | **10%** |
| active_downtimes | 25 | 12 | **14%** |
| extended_downtime_logs | 18 | 5 | **6%** |
| machine_schedule | 5 | 4 | **5%** |
| Outras (12 coleções) | ~50 | ~5 | **6%** |
| **TOTAL** | **~313** | **~83** | **100%** |

---

## 🎯 Análise por Aba do Sistema

### 1. 📋 ABA PLANEJAMENTO (data-page="planejamento")

**Funções principais:**
- `loadPlanningOrders()` (linha 2710)
- Carrega ordens de produção para o planejamento

**Leituras estimadas por acesso:**
| Coleção | Leituras | Frequência |
|---------|----------|------------|
| production_orders | ~100 docs | Ao abrir aba |
| planning | ~50 docs | Ao filtrar |

**Impacto estimado:** 🟡 **MÉDIO** (~150 leituras/acesso)

**Otimização sugerida:**
- Usar `getProductionOrdersCached()` ao invés de consulta direta
- Implementar paginação (mostrar 20 OPs por vez)

---

### 2. 📦 ABA ORDENS (data-page="ordens")

**Funções principais:**
- `loadProductionOrders()` (linha 14556)

**Leituras estimadas por acesso:**
| Coleção | Leituras | Frequência |
|---------|----------|------------|
| production_orders | ~100-500 docs | Ao abrir/filtrar |

**Impacto estimado:** 🔴 **ALTO** (~200-500 leituras/acesso)

**Problema identificado:**
- Carrega TODAS as OPs sem paginação
- Cada refresh recarrega tudo

**Otimização sugerida:**
- Implementar paginação com limit(50)
- Cache de 2 minutos para lista de OPs
- Filtrar por status no servidor (where status != 'finalizada')

---

### 3. 🏭 ABA LANÇAMENTO (data-page="lancamento") ⚠️ CRÍTICA

**Funções principais:**
- `populateMachineSelector()` (linha 37640)
- `loadRecentEntries()` (linha 38309)
- `loadTodayStats()` (linha 38172)
- Polling de active_downtimes (15 segundos)

**Leituras estimadas por acesso:**
| Coleção | Leituras | Frequência |
|---------|----------|------------|
| planning | ~50 docs | Ao abrir |
| production_entries | ~200 docs | Ao abrir + a cada 30s |
| active_downtimes | ~26 docs | **A cada 15 segundos** |
| production_orders | ~100 docs | Ao enriquecer planos |
| downtime_entries | ~50 docs | Ao abrir |

**PROBLEMA CRÍTICO: POLLING**
```
Polling de 15 segundos:
- 4 polls/minuto × 26 docs = 104 leituras/minuto
- 1 hora = 6.240 leituras
- 8 horas de turno = 49.920 leituras/usuário
- 10 usuários = 499.200 leituras/dia APENAS NO POLLING
```

**Impacto estimado:** 🔴🔴 **CRÍTICO** (~500 leituras/acesso + ~50k/usuário/dia em polling)

**Otimizações sugeridas:**
1. **Aumentar intervalo de polling** de 15s para 60s (75% redução)
2. **Usar cache DataStore** - já implementado mas não totalmente utilizado
3. **Polling inteligente** - pausar quando aba não está em foco

---

### 4. 📊 ABA ANÁLISE (data-page="analise") ⚠️ ALTA

**Sub-abas:**
- Overview, Produção, Eficiência, Perdas, Paradas, Comparativo, Preditivo, SPC, Relatórios

**Funções principais:**
- `loadOverviewData()` (linha 5613) - 4 consultas paralelas
- `loadProductionAnalysis()` (linha 6061)
- `loadDowntimeAnalysis()` (linha 6915)
- `loadReportsView()` (linha 10997)
- `updateRealTimeOeeData()` - polling de 30 minutos

**Leituras estimadas por acesso:**
| Sub-aba | Coleções | Leituras Est. |
|---------|----------|---------------|
| Overview | production_entries, planning, downtime_entries, losses | ~400 |
| Produção | production_entries, planning | ~300 |
| Eficiência | production_entries, planning | ~300 |
| Perdas | production_entries | ~200 |
| Paradas | downtime_entries | ~100 |
| Relatórios | production_entries, planning, orders | ~500 |

**Impacto estimado:** 🔴 **ALTO** (~300-500 leituras/acesso por sub-aba)

**Problema identificado:**
- Cada sub-aba recarrega dados mesmo se período não mudou
- Não compartilha dados entre sub-abas (produção busca planning, eficiência busca planning novamente)

**Otimizações sugeridas:**
1. **Cache por período** - se filtros não mudaram, usar dados em memória
2. **Carregar dados uma vez** e compartilhar entre sub-abas
3. **Lazy loading** - só carregar dados quando sub-aba é acessada

---

### 5. 📦 ABA PMP (data-page="pmp")

**Funções principais:**
- Carrega dados de sucata, borra, moído

**Leituras estimadas por acesso:**
| Coleção | Leituras | Frequência |
|---------|----------|------------|
| pmp_sucata | ~20 docs | Ao abrir |
| pmp_borra | ~20 docs | Ao abrir |
| pmp_moido | ~20 docs | Ao abrir |

**Impacto estimado:** 🟢 **BAIXO** (~60 leituras/acesso)

---

### 6. 📋 ABA ACOMPANHAMENTO (data-page="acompanhamento")

**Funções principais:**
- Carrega dados de turno
- `acompanhamento_turno` e `acompanhamento_perdas`

**Leituras estimadas por acesso:**
| Coleção | Leituras | Frequência |
|---------|----------|------------|
| acompanhamento_turno | ~10 docs | Ao abrir/salvar |
| acompanhamento_perdas | ~10 docs | Ao abrir |

**Impacto estimado:** 🟢 **BAIXO** (~20 leituras/acesso)

---

### 7. 📜 ABA HISTÓRICO (data-page="historico-sistema")

**Funções principais:**
- `loadSystemLogs()` - carrega logs do sistema

**Leituras estimadas por acesso:**
| Coleção | Leituras | Frequência |
|---------|----------|------------|
| system_logs | ~100 docs | Ao abrir |

**Impacto estimado:** 🟡 **MÉDIO** (~100 leituras/acesso)

**Otimização sugerida:**
- Paginação (mostrar 50 logs por vez)

---

### 8. 📄 ABA RELATÓRIOS (data-page="relatorios")

**Funções principais:**
- `loadReportsView()` (linha 10997)
- Gera relatórios com muitos dados

**Leituras estimadas por acesso:**
| Coleção | Leituras | Frequência |
|---------|----------|------------|
| production_entries | ~500 docs | Por relatório |
| planning | ~200 docs | Por relatório |
| production_orders | ~200 docs | Por relatório |

**Impacto estimado:** 🔴 **ALTO** (~900 leituras/relatório)

**Otimização sugerida:**
- Cache de relatórios gerados (válido por 5 minutos)
- Usar dados já em memória quando possível

---

### 9. ⚙️ ABA ADMIN (data-page="admin-dados")

**Funções principais:**
- CRUD de production_entries, planning, orders
- `loadAdminData()`

**Leituras estimadas por acesso:**
| Coleção | Leituras | Frequência |
|---------|----------|------------|
| production_entries | ~200 docs | Ao filtrar |
| production_orders | ~100 docs | Ao filtrar |
| downtime_entries | ~100 docs | Ao filtrar |

**Impacto estimado:** 🟡 **MÉDIO** (~400 leituras/acesso)

---

### 10. 👷 ABA LIDERANÇA (data-page="lideranca-producao")

**Funções principais:**
- Visão geral da produção
- Carrega métricas consolidadas

**Leituras estimadas por acesso:**
| Coleção | Leituras | Frequência |
|---------|----------|------------|
| production_entries | ~100 docs | Ao abrir |
| planning | ~50 docs | Ao abrir |

**Impacto estimado:** 🟡 **MÉDIO** (~150 leituras/acesso)

---

### 11. 🔧 ABA SETUP (data-page="setup-maquinas")

**Funções principais:**
- `loadSetupMaquinas()` (linha 47387)

**Leituras estimadas por acesso:**
| Coleção | Leituras | Frequência |
|---------|----------|------------|
| setups_maquinas | ~26 docs | Ao abrir |
| escalas_operadores | ~50 docs | Ao abrir |

**Impacto estimado:** 🟢 **BAIXO** (~80 leituras/acesso)

---

### 12. 🔨 ABA FERRAMENTARIA (data-page="ferramentaria")

**Funções principais:**
- Carrega moldes e manutenções

**Leituras estimadas por acesso:**
| Coleção | Leituras | Frequência |
|---------|----------|------------|
| ferramentaria_moldes | ~50 docs | Ao abrir |
| ferramentaria_manutencoes | ~20 docs | Ao abrir |

**Impacto estimado:** 🟢 **BAIXO** (~70 leituras/acesso)

---

### 13. 📐 ABA PCP (data-page="pcp")

**Funções principais:**
- Observações e controle de produção

**Leituras estimadas por acesso:**
| Coleção | Leituras | Frequência |
|---------|----------|------------|
| pcp_observations | ~20 docs | Ao abrir |
| machine_schedule | ~26 docs | Ao abrir |

**Impacto estimado:** 🟢 **BAIXO** (~50 leituras/acesso)

---

## 🚨 Dashboard TV (arquivo separado)

**Polling agressivo - CRÍTICO**

**Leituras estimadas:**
| Coleção | Leituras | Frequência |
|---------|----------|------------|
| active_downtimes | ~26 docs | A cada 30s |
| production_entries | ~200 docs | A cada 5 min |
| planning | ~50 docs | A cada 5 min |

**Cálculo de impacto:**
```
Por hora:
- active_downtimes: 120 polls × 26 = 3.120 leituras
- production_entries: 12 polls × 200 = 2.400 leituras
- planning: 12 polls × 50 = 600 leituras
TOTAL: ~6.120 leituras/hora ou ~48.960/turno de 8h
```

**Impacto estimado:** 🔴🔴 **CRÍTICO** (~50k leituras/turno)

---

## 📊 Comparativo de Impacto por Aba

| Aba | Leit./Acesso | Polling | Impacto Total | Prioridade |
|-----|--------------|---------|---------------|------------|
| **Lançamento** | 500 | 50k/dia | 🔴🔴 CRÍTICO | P1 |
| **Dashboard TV** | 300 | 50k/dia | 🔴🔴 CRÍTICO | P1 |
| **Análise** | 400 | 2k/hora | 🔴 ALTO | P2 |
| **Relatórios** | 900 | Nenhum | 🔴 ALTO | P2 |
| **Ordens** | 300 | Nenhum | 🟡 MÉDIO | P3 |
| **Admin** | 400 | Nenhum | 🟡 MÉDIO | P3 |
| **Planejamento** | 150 | Nenhum | 🟡 MÉDIO | P4 |
| **Liderança** | 150 | Nenhum | 🟡 MÉDIO | P4 |
| **Histórico** | 100 | Nenhum | 🟢 BAIXO | P5 |
| **Setup** | 80 | Nenhum | 🟢 BAIXO | P5 |
| **Ferramentaria** | 70 | Nenhum | 🟢 BAIXO | P5 |
| **PMP** | 60 | Nenhum | 🟢 BAIXO | P5 |
| **PCP** | 50 | Nenhum | 🟢 BAIXO | P5 |
| **Acompanhamento** | 20 | Nenhum | 🟢 BAIXO | P5 |

---

## 💰 Estimativa de Custo Mensal

### Cenário Atual (sem otimização)

| Fonte | Leituras/Dia | Leituras/Mês | Custo Est. |
|-------|--------------|--------------|------------|
| Polling Lançamento (10 usuários) | 500.000 | 15.000.000 | $90 |
| Dashboard TV (1 TV) | 50.000 | 1.500.000 | $9 |
| Navegação abas normal | 10.000 | 300.000 | $2 |
| **TOTAL** | **560.000** | **16.800.000** | **~$101** |

### Cenário Otimizado (com melhorias)

| Fonte | Leituras/Dia | Redução | Custo Est. |
|-------|--------------|---------|------------|
| Polling (60s + cache) | 50.000 | 90% | $9 |
| Dashboard TV (60s) | 12.000 | 76% | $2 |
| Navegação (com cache) | 3.000 | 70% | $0.60 |
| **TOTAL** | **65.000** | **88%** | **~$12** |

**Economia estimada: ~$89/mês ou ~$1.068/ano**

---

## 🎯 Plano de Ação Prioritário

### PRIORIDADE 1: Polling (impacto: -90% nas leituras)

1. **Aumentar intervalo de polling active_downtimes**
   - De 15s para 60s (redução de 75%)
   - Local: linha 21483

2. **Pausar polling quando aba não está visível**
   ```javascript
   document.addEventListener('visibilitychange', () => {
       if (document.hidden) {
           clearInterval(window._activeDowntimesPolling);
       } else {
           window._startActiveDowntimesPolling();
       }
   });
   ```

3. **Dashboard TV: aumentar intervalo para 60s**

### PRIORIDADE 2: Cache inteligente (impacto: -50%)

1. **Compartilhar dados entre sub-abas de Análise**
2. **Cache de 2 minutos para lista de OPs**
3. **Não recarregar se filtros não mudaram**

### PRIORIDADE 3: Paginação (impacto: -30%)

1. **Limitar production_orders para últimas 50**
2. **Paginação em logs (50 por página)**

---

## ✅ Métricas de Monitoramento

Para acompanhar o progresso, adicionar ao console:

```javascript
// Já existe DataStore.getStats() - apenas exibir
setInterval(() => {
    const stats = window.DataStore?.getStats();
    if (stats) {
        console.log(`📊 Firebase: ${stats.total} leituras | Cache: ${Object.keys(stats.lastUpdates).length} coleções`);
    }
}, 60000);
```

---

*Análise gerada em 14/02/2026 - Sistema MES Hokkaido*
