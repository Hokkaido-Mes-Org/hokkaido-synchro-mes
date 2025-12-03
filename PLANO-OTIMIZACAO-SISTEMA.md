# 🚀 PLANO DE OTIMIZAÇÃO DO SISTEMA SYNCHRO

**Data:** 02 de Dezembro de 2025  
**Objetivo:** Reduzir consumo do Firebase e eliminar erro 429  
**Meta:** Redução de 60-70% nas operações Firebase

---

## 📋 ÍNDICE

1. [Diagnóstico Atual](#1-diagnóstico-atual)
2. [Módulos do Sistema](#2-módulos-do-sistema)
3. [Análise de Criticidade](#3-análise-de-criticidade)
4. [Plano de Otimização - Fase 1](#4-plano-de-otimização---fase-1-crítica)
5. [Plano de Otimização - Fase 2](#5-plano-de-otimização---fase-2-importante)
6. [Plano de Otimização - Fase 3](#6-plano-de-otimização---fase-3-desejável)
7. [Módulos Candidatos à Remoção](#7-módulos-candidatos-à-remoção)
8. [Resumo de Impacto](#8-resumo-de-impacto)
9. [Cronograma Sugerido](#9-cronograma-sugerido)

---

## 1. DIAGNÓSTICO ATUAL

### 📊 Consumo Estimado de Firebase (por hora)

| Fonte | Queries/Hora | % do Total |
|-------|--------------|------------|
| Auto-refresh Timeline (1 min) | ~60-120 | 35% |
| Auto-refresh OEE (5 min) | ~24-48 | 15% |
| Analytics IA (5 min) | ~48 | 18% |
| SPC Controller (5 min) | ~24-48 | 15% |
| Predictive Analytics (30 min) | ~6 | 2% |
| Advanced KPIs (1 hora) | ~4 | 1% |
| Interações do usuário | ~50-100 | 14% |
| **TOTAL** | **~216-374** | **100%** |

### 🔴 Problemas Identificados

1. **Intervalos muito curtos** - Timeline atualiza a cada 1 minuto
2. **Múltiplos módulos redundantes** - Analytics, KPIs, Predictive fazem queries similares
3. **Listener real-time ativo** - SPC usa onSnapshot constantemente
4. **Teste de conexão desnecessário** - Escreve/deleta documento no carregamento
5. **Queries N+1** - Relatórios fazem loops de queries individuais
6. **Limites altos** - Até 5000 documentos por query

---

## 2. MÓDULOS DO SISTEMA

### Arquivos JavaScript Carregados

| # | Arquivo | Tamanho | Função Principal |
|---|---------|---------|------------------|
| 1 | `auth.js` | Pequeno | Autenticação |
| 2 | `database.js` | Médio | Dados de produtos/máquinas |
| 3 | `materia-prima-database.js` | Pequeno | Dados de matérias-primas |
| 4 | `script.js` | **Grande** (~24k linhas) | Core do sistema |
| 5 | `traceability-system.js` | Médio | Rastreabilidade de lotes |
| 6 | `predictive-analytics.js` | Médio | Predição de produção |
| 7 | `advanced-kpis.js` | Médio | KPIs avançados |
| 8 | `auto-pareto-analysis.js` | Médio | Análise de Pareto |
| 9 | `spc-controller.js` | Médio | Controle estatístico |
| 10 | `analytics-ia-core.js` | **Grande** | Analytics com IA |
| 11 | `reports-module.js` | Médio | Geração de relatórios |

---

## 3. ANÁLISE DE CRITICIDADE

### ✅ ESSENCIAIS (Não podem ser removidos)

| Módulo | Justificativa |
|--------|---------------|
| `auth.js` | Autenticação de usuários |
| `database.js` | Dados de produtos/máquinas |
| `materia-prima-database.js` | Dados de matérias-primas |
| `script.js` | Core - Lançamentos, planejamento, dashboard |

### ⚠️ IMPORTANTES (Podem ser otimizados)

| Módulo | Uso Real | Frequência de Uso |
|--------|----------|-------------------|
| `reports-module.js` | Relatórios gerenciais | Semanal/Mensal |
| `auto-pareto-analysis.js` | Análise de perdas | Sob demanda |

### 🟡 OPCIONAIS (Podem ser desativados/removidos)

| Módulo | Uso Real | Consumo Firebase | Recomendação |
|--------|----------|------------------|--------------|
| `analytics-ia-core.js` | Analytics avançado | 🔴 ALTO (~48/hora) | **DESATIVAR** |
| `predictive-analytics.js` | Predições | 🟡 MÉDIO (~6/hora) | **DESATIVAR** |
| `advanced-kpis.js` | KPIs extras | 🟢 BAIXO (~4/hora) | Manter otimizado |
| `spc-controller.js` | SPC/CEP | 🔴 ALTO (listener) | **DESATIVAR** |
| `traceability-system.js` | Rastreabilidade | 🟡 MÉDIO | Manter sob demanda |

---

## 4. PLANO DE OTIMIZAÇÃO - FASE 1 (CRÍTICA)

**Impacto estimado: -50% de queries**  
**Tempo: 1-2 horas**

### 4.1 Aumentar Intervalos de Auto-Refresh

| Local | Atual | Proposto | Economia |
|-------|-------|----------|----------|
| `script.js` - Timeline | 1 min | **5 min** | -80% (~96 queries/hora) |
| `script.js` - OEE | 5 min | **15 min** | -67% (~32 queries/hora) |
| `analytics-ia-core.js` | 5 min | **30 min** | -83% (~40 queries/hora) |
| `spc-controller.js` | 5 min | **15 min** | -67% (~32 queries/hora) |

**Código a alterar em `script.js`:**
```javascript
// ANTES (linha ~2857)
setInterval(updateDashboard, 5 * 60 * 1000); // 5 min
setInterval(updateTimeline, 1 * 60 * 1000);  // 1 min

// DEPOIS
setInterval(updateDashboard, 15 * 60 * 1000); // 15 min
setInterval(updateTimeline, 5 * 60 * 1000);   // 5 min
```

### 4.2 Remover Teste de Conexão Desnecessário

**Local:** `script.js` (linhas ~321-340)

```javascript
// REMOVER este bloco que escreve/deleta documento toda vez
const testDocRef = db.collection('_connection_test').doc('test');
await testDocRef.set({ test: true, timestamp: firebase.firestore.FieldValue.serverTimestamp() });
await testDocRef.delete();
```

**Economia:** 2 writes + 1 delete por carregamento de página

### 4.3 Desativar onSnapshot do SPC

**Local:** `spc-controller.js` (linha ~671)

```javascript
// ANTES - Listener ativo constantemente
db.collection('quality_measurements').onSnapshot(snapshot => { ... });

// DEPOIS - Busca sob demanda apenas quando necessário
// Remover ou converter para .get() quando usuário abrir SPC
```

**Economia:** Elimina listener 24/7

---

## 5. PLANO DE OTIMIZAÇÃO - FASE 2 (IMPORTANTE)

**Impacto estimado: -20% adicional**  
**Tempo: 2-4 horas**

### 5.1 Desativar Módulos Não-Essenciais

Comentar os imports no `index.html`:

```html
<!-- MÓDULOS OPCIONAIS - Desativados para economia -->
<!-- <script src="analytics-ia-core.js"></script> -->
<!-- <script src="predictive-analytics.js"></script> -->
<!-- <script src="spc-controller.js"></script> -->
```

**Economia:** ~100 queries/hora

### 5.2 Implementar Verificação de Aba Visível

Só fazer refresh se o usuário estiver vendo a página:

```javascript
// Adicionar em script.js
function shouldRefresh() {
    return document.visibilityState === 'visible';
}

// Modificar os setIntervals
setInterval(() => {
    if (shouldRefresh()) {
        updateDashboard();
    }
}, 15 * 60 * 1000);
```

**Economia:** ~30-50% quando usuário não está na aba

### 5.3 Cache Local com localStorage

```javascript
// Implementar cache para dados que não mudam frequentemente
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

function getCachedData(key) {
    const cached = localStorage.getItem(key);
    if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_DURATION) {
            return data;
        }
    }
    return null;
}

function setCachedData(key, data) {
    localStorage.setItem(key, JSON.stringify({
        data,
        timestamp: Date.now()
    }));
}
```

---

## 6. PLANO DE OTIMIZAÇÃO - FASE 3 (DESEJÁVEL)

**Impacto estimado: -10% adicional**  
**Tempo: 4-8 horas**

### 6.1 Reduzir Limites de Query

| Módulo | Atual | Proposto |
|--------|-------|----------|
| `predictive-analytics.js` | 5000 docs | 1000 docs |
| `analytics-ia-core.js` | 1000 docs | 500 docs |
| `reports-module.js` | 1000 docs | 500 docs |

### 6.2 Eliminar Queries N+1

**Local:** `reports-module.js` - `buscarProducao()`

```javascript
// ANTES - Query para cada OP individualmente
for (const entry of entries) {
    const opDoc = await db.collection('planning_orders').doc(entry.op).get();
}

// DEPOIS - Buscar todas OPs de uma vez
const opIds = [...new Set(entries.map(e => e.op))];
const opsSnapshot = await db.collection('planning_orders')
    .where(firebase.firestore.FieldPath.documentId(), 'in', opIds.slice(0, 10))
    .get();
```

### 6.3 Implementar Debounce Global

```javascript
// Utilitário de debounce
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// Aplicar em funções de busca
const debouncedSearch = debounce(searchPlanningOrders, 500);
```

---

## 7. MÓDULOS CANDIDATOS À REMOÇÃO

### 🔴 Recomendação: DESATIVAR

| Módulo | Motivo | Impacto na Remoção |
|--------|--------|-------------------|
| `analytics-ia-core.js` | Alto consumo, uso raro | **Economia: ~48 queries/hora** |
| `predictive-analytics.js` | Funcionalidade avançada não-essencial | **Economia: ~6 queries/hora** |
| `spc-controller.js` | Listener constante, uso especializado | **Economia: ~24+ queries/hora** |

### 🟡 Recomendação: MANTER SOB DEMANDA

| Módulo | Motivo | Ação |
|--------|--------|------|
| `traceability-system.js` | Útil para rastreabilidade | Carregar apenas quando necessário |
| `advanced-kpis.js` | Baixo consumo | Aumentar intervalo para 2 horas |
| `auto-pareto-analysis.js` | Útil para análises | Manter, carregar sob demanda |

### ✅ Recomendação: MANTER SEMPRE

| Módulo | Motivo |
|--------|--------|
| `auth.js` | Essencial para segurança |
| `database.js` | Dados de produtos |
| `materia-prima-database.js` | Dados de MP |
| `script.js` | Core do sistema |
| `reports-module.js` | Relatórios essenciais |

---

## 8. RESUMO DE IMPACTO

### Antes da Otimização

| Métrica | Valor |
|---------|-------|
| Queries/hora | ~216-374 |
| Queries/dia | ~5.184-8.976 |
| Queries/mês | ~155.520-269.280 |
| Status | 🔴 Atingindo limites |

### Após Fase 1

| Métrica | Valor | Redução |
|---------|-------|---------|
| Queries/hora | ~90-150 | **-55%** |
| Queries/dia | ~2.160-3.600 | **-55%** |
| Queries/mês | ~64.800-108.000 | **-55%** |
| Status | 🟡 Dentro do limite |

### Após Fases 1+2

| Métrica | Valor | Redução |
|---------|-------|---------|
| Queries/hora | ~50-80 | **-75%** |
| Queries/dia | ~1.200-1.920 | **-75%** |
| Queries/mês | ~36.000-57.600 | **-75%** |
| Status | ✅ Folga confortável |

### Após Todas as Fases

| Métrica | Valor | Redução |
|---------|-------|---------|
| Queries/hora | ~30-50 | **-85%** |
| Queries/dia | ~720-1.200 | **-85%** |
| Queries/mês | ~21.600-36.000 | **-85%** |
| Status | ✅ Muito abaixo do limite |

---

## 9. CRONOGRAMA SUGERIDO

### Fase 1 - Implementação Imediata (Hoje)
- [ ] Aumentar intervalos de auto-refresh
- [ ] Remover teste de conexão
- [ ] Desativar onSnapshot do SPC
- **Tempo:** 1-2 horas
- **Resultado:** Erro 429 deve parar imediatamente

### Fase 2 - Otimização Moderada (Esta Semana)
- [ ] Comentar módulos não-essenciais
- [ ] Implementar verificação de visibilidade
- [ ] Adicionar cache básico
- **Tempo:** 2-4 horas
- **Resultado:** Sistema muito mais leve

### Fase 3 - Refinamento (Próximas Semanas)
- [ ] Reduzir limites de query
- [ ] Eliminar queries N+1
- [ ] Implementar debounce global
- **Tempo:** 4-8 horas
- **Resultado:** Sistema otimizado

---

## 10. CÓDIGO RESUMIDO PARA FASE 1

### Alterações Necessárias

**1. `script.js` - Aumentar intervalos:**
```javascript
// Localizar setInterval e alterar tempos
// De 1 min -> 5 min (timeline)
// De 5 min -> 15 min (OEE)
```

**2. `script.js` - Remover teste de conexão:**
```javascript
// Remover bloco de _connection_test
```

**3. `index.html` - Desativar módulos:**
```html
<!-- Comentar estas linhas -->
<!-- <script src="analytics-ia-core.js"></script> -->
<!-- <script src="predictive-analytics.js"></script> -->
<!-- <script src="spc-controller.js"></script> -->
```

---

## ⚠️ AVISOS IMPORTANTES

1. **Fazer backup** antes de qualquer alteração
2. **Testar em ambiente de desenvolvimento** primeiro
3. **Monitorar Firebase Console** após mudanças
4. Usuários podem notar **atualização menos frequente** do dashboard
5. Módulos desativados podem ser **reativados** quando migrar para Blaze

---

## 📞 PRÓXIMOS PASSOS

1. **Aprovar** este plano de otimização
2. **Escolher** quais fases implementar
3. **Iniciar** pela Fase 1 (mais impacto, menos esforço)
4. **Testar** o sistema após cada fase
5. **Monitorar** o Firebase Console por 24-48h

---

*Documento criado para otimização do sistema SYNCHRO - Hokkaido Plastics*
