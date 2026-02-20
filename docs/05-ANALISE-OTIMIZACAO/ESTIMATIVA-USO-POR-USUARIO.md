# 📊 Estimativa de Uso Firebase por Perfil de Usuário

**Data:** Fevereiro 2026  
**Sistema:** Hokkaido MES  
**Base:** 55 usuários cadastrados | 3 turnos | ~10-15 usuários simultâneos  
**Referências:** `ESTUDO-LEITURAS-POR-ABA.md`, `USUARIOS-ACESSOS.md`, `ACOES-REDUCAO-CUSTOS-FIRESTORE.md`

---

## 1. Perfis de Uso Identificados

Baseado no mapeamento de acessos e no comportamento observado, os 55 usuários se dividem em **5 perfis de uso** distintos em termos de consumo Firebase:

| Perfil de Uso | Qtd Usuários | Abas Principais | Duração Típica/Dia |
|---------------|-------------|-----------------|---------------------|
| **A — Operador de Chão** | 29 operadores + 3 contas turno = 32 | Lançamento, Planejamento, Análise | 8h (turno integral) |
| **B — Gestor/Supervisor** | 19 gestores | Análise, Relatórios, Dashboard TV, Lançamento | 4-6h |
| **C — Líder de Produção** | 3 líderes | Lançamento, Liderança, Ferramentaria, Setup | 6-8h |
| **D — Suporte/Admin** | 7 suporte ativos | Admin, Análise, Relatórios, Qualidade, todas abas | 2-4h |
| **E — Dashboard TV** | 1-2 TVs fixas | Dashboard TV exclusivo | 24h (automático) |

---

## 2. Estimativa de Leituras por Perfil (Pré-Otimização)

### Perfil A — Operador de Chão (32 usuários)

Comportamento típico: permanece na aba **Lançamento** durante o turno inteiro, consulta **Planejamento** no início e **Análise** eventualmente.

| Ação | Leituras/Evento | Frequência/Dia | Subtotal |
|------|-----------------|----------------|----------|
| Abrir Lançamento (inicialização) | 500 | 1× | 500 |
| Polling active_downtimes (15s) | 26 docs × 4/min × 480min | contínuo (8h) | 49.920 |
| Polling production_entries (30s) | 200 docs × 2/min × 480min | contínuo (8h) | 192.000 |
| Consultar Planejamento | 150 | 2-3× | 375 |
| Consultar Análise | 400 | 1× | 400 |
| Lançar produção (write + reload) | 100 | 5-10× | 750 |
| **Total/operador/dia** | | | **~244.000** |

**Total Perfil A (ativos por turno):**  
- ~10-12 operadores logados por turno  
- ~10 × 244.000 = **~2.440.000 leituras/dia**

---

### Perfil B — Gestor/Supervisor (19 usuários)

Comportamento típico: acessa várias abas ao longo do dia, consulta **Análise** e **Relatórios** frequentemente, mantém **Dashboard TV** aberto em background.

| Ação | Leituras/Evento | Frequência/Dia | Subtotal |
|------|-----------------|----------------|----------|
| Abrir Lançamento | 500 | 1× | 500 |
| Polling Lançamento (parcial, 4h) | 26 × 4/min × 240min | contínuo (4h) | 24.960 |
| Consultar Análise (sub-abas) | 400 | 3-5× | 1.600 |
| Gerar Relatórios | 900 | 1-2× | 1.350 |
| Consultar Ordens | 300 | 1-2× | 450 |
| Dashboard TV em background | minimal (polling pausado quando hidden) | — | 500 |
| Consultar Planejamento | 150 | 2× | 300 |
| **Total/gestor/dia** | | | **~30.000** |

**Total Perfil B (ativos por dia):**  
- ~8-10 gestores logados por dia  
- ~8 × 30.000 = **~240.000 leituras/dia**

---

### Perfil C — Líder de Produção (3 usuários)

Comportamento típico: similar ao operador mas com mais navegação entre abas (Liderança, Ferramentaria, Setup).

| Ação | Leituras/Evento | Frequência/Dia | Subtotal |
|------|-----------------|----------------|----------|
| Lançamento + polling (6h) | 26 × 4/min × 360min | contínuo | 37.440 |
| Aba Liderança | 150 | 2-3× | 375 |
| Aba Ferramentaria | 70 | 1× | 70 |
| Aba Setup | 80 | 1-2× | 120 |
| Aba Análise | 400 | 1-2× | 600 |
| Lançamentos de produção | 100 | 8-15× | 1.125 |
| **Total/líder/dia** | | | **~40.000** |

**Total Perfil C:**  
- 3 líderes × 40.000 = **~120.000 leituras/dia**

---

### Perfil D — Suporte/Admin (7 usuários ativos)

Comportamento típico: uso esporádico mas intensivo, acessa Admin para edição, gera relatórios, acompanha turno.

| Ação | Leituras/Evento | Frequência/Dia | Subtotal |
|------|-----------------|----------------|----------|
| Aba Admin (filtros/edição) | 400 | 2-3× | 1.000 |
| Relatórios | 900 | 1-2× | 1.350 |
| Análise (múltiplas sub-abas) | 400 | 2-3× | 1.000 |
| Acompanhamento de Turno | 20 | 2-3× | 50 |
| Histórico Sistema | 100 | 1× | 100 |
| Qualidade/Processo | 60 | 1× | 60 |
| PCP/PMP | 60 | 0-1× | 30 |
| Lançamento (curto, ~1h) | 26 × 4 × 60 | contínuo (1h) | 6.240 |
| **Total/admin/dia** | | | **~10.000** |

**Total Perfil D:**  
- ~3 admins ativos/dia × 10.000 = **~30.000 leituras/dia**

---

### Perfil E — Dashboard TV (1-2 terminais)

Comportamento: rodando 24h sem interação humana, polling automático.

| Ação | Leituras/Evento | Frequência/Dia | Subtotal |
|------|-----------------|----------------|----------|
| Polling active_downtimes (30s) | 26 docs × 2/min × 1440min | contínuo (24h) | 74.880 |
| Polling production_entries (5min) | 200 docs × 12/h × 24h | contínuo | 57.600 |
| Polling planning (5min) | 50 docs × 12/h × 24h | contínuo | 14.400 |
| **Total/TV/dia** | | | **~147.000** |

**Total Perfil E:**  
- 1 TV × 147.000 = **~147.000 leituras/dia**

---

## 3. Consolidação — Cenário Pré-Otimização

| Perfil | Usuários Ativos/Dia | Leituras/Usuário/Dia | Total/Dia |
|--------|---------------------|----------------------|-----------|
| A — Operador | ~10 | 244.000 | 2.440.000 |
| B — Gestor | ~8 | 30.000 | 240.000 |
| C — Líder | 3 | 40.000 | 120.000 |
| D — Suporte | ~3 | 10.000 | 30.000 |
| E — Dashboard TV | 1 | 147.000 | 147.000 |
| **TOTAL** | **~25** | — | **~2.977.000** |

**Custo estimado mensal:** ~2.977.000 × 30 dias = ~89M leituras/mês  
A Firestore cobra $0,06 por 100.000 leituras → **~$53/mês**

> ⚠️ **O polling da aba Lançamento é responsável por ~82% de todo o consumo.**

---

## 4. Cenário Pós-Otimização (Nível 1 + 2 aplicados)

### Otimizações aplicadas:
- ✅ **Nível 1.1**: Polling Dashboard TV de 30s → 300s (5 min), visibilitychange pause
- ✅ **Nível 1.2**: `.limit(500)` em production_orders (5 locais)
- ✅ **Nível 2.1**: Write-invalidation (evita reload desnecessário após escrita)
- ✅ **Nível 2.2**: Tab-aware prefetch em todas 14 abas (evita re-fetch)
- ✅ **Nível 2.3**: Shared query cache entre Analysis e Reports
- ✅ **Nível 2.5**: Monitor Firebase para visibilidade

### Impacto por perfil:

| Perfil | Antes | Otimização Principal | Depois | Redução |
|--------|-------|---------------------|--------|---------|
| A — Operador | 244.000 | Polling active_downtimes de 15s permanece (safety-critical), mas prefetch + cache reduzem re-reads | ~200.000 | -18% |
| B — Gestor | 30.000 | Cache compartilhado Analysis/Reports, prefetch tabs | ~18.000 | -40% |
| C — Líder | 40.000 | Prefetch + cache nas abas novas | ~28.000 | -30% |
| D — Suporte | 10.000 | Cache + write-invalidation | ~7.000 | -30% |
| E — Dashboard TV | 147.000 | Polling 300s (já aplicado Nível 1) | ~15.000 | -90% |

### Consolidação Pós-Otimização:

| Perfil | Usuários | Leituras/Dia (otimizado) | Total/Dia |
|--------|----------|--------------------------|-----------|
| A — Operador | ~10 | 200.000 | 2.000.000 |
| B — Gestor | ~8 | 18.000 | 144.000 |
| C — Líder | 3 | 28.000 | 84.000 |
| D — Suporte | ~3 | 7.000 | 21.000 |
| E — Dashboard TV | 1 | 15.000 | 15.000 |
| **TOTAL** | **~25** | — | **~2.264.000** |

**Custo estimado mensal:** ~2.264.000 × 30 = ~68M leituras/mês → **~$41/mês**

**Economia vs cenário original: ~$12/mês (~23%)**

---

## 5. Cenário Alvo (com Nível 3-4 futuros)

### Otimizações futuras planejadas:
- 🔲 **Nível 3.1**: Migrar polling para `onSnapshot` (listener Firestore em tempo real)
- 🔲 **Nível 3.2**: Cache com Firestore Bundles (offline-first)
- 🔲 **Nível 4**: Migrar dados históricos para BigQuery (leituras cold separadas)

### Projeção:

| Perfil | Atualmente | Com onSnapshot (N3) | Redução |
|--------|-----------|---------------------|---------|
| A — Operador | 200.000 | ~5.000 (listener = 1 read + deltas) | **-97%** |
| B — Gestor | 18.000 | ~8.000 | -56% |
| C — Líder | 28.000 | ~10.000 | -64% |
| D — Suporte | 7.000 | ~5.000 | -29% |
| E — Dashboard TV | 15.000 | ~2.000 | -87% |
| **TOTAL/dia** | **2.264.000** | **~80.000** | **-96%** |

**Custo projetado:** ~80.000 × 30 = ~2.4M leituras/mês → **~$1.44/mês**

> 🎯 **A migração para onSnapshot é a ação de maior impacto** — transforma 2M+ polls/dia em ~30K listener deltas, com custo quase zero.

---

## 6. Distribuição por Turno

| Turno | Horário | Usuários Típicos | % do Consumo |
|-------|---------|-------------------|-------------|
| **T1** | 06:30 – 14:59 | 3-4 operadores, 5-6 gestores, 2 líderes, 2 suporte | ~45% |
| **T2** | 15:00 – 23:19 | 3-4 operadores, 2-3 gestores, 1 líder | ~35% |
| **T3** | 23:20 – 06:29 | 2-3 operadores, 0-1 gestor | ~15% |
| **TV** | 24h | 1 terminal | ~5% |

**Pico de uso:** T1 entre 08:00–12:00 (gestores + operadores online + relatórios matinais)

---

## 7. Resumo Executivo e Recomendações

### Custo por perfil de usuário:

| Perfil | Custo/Usuário/Mês (atual) | Custo/Usuário/Mês (otimizado N2) | Custo/Usuário/Mês (alvo N3) |
|--------|---------------------------|-----------------------------------|-----------------------------|
| **Operador** | $3,66 | $3,00 | $0,08 |
| **Gestor** | $0,54 | $0,32 | $0,14 |
| **Líder** | $0,72 | $0,50 | $0,18 |
| **Suporte** | $0,18 | $0,13 | $0,09 |
| **TV** | $2,65 | $0,27 | $0,04 |

### Ações prioritárias por ROI:

| # | Ação | Impacto/mês | Esforço | ROI |
|---|------|-------------|---------|-----|
| 1 | Migrar polling para onSnapshot (N3.1) | -$39/mês | 16-24h dev | Altíssimo |
| 2 | Reduzir polling active_downtimes 15s → 30s | -$10/mês | 1h dev | Muito alto |
| 3 | Cache offline com Firestore Bundles (N3.2) | -$5/mês | 8h dev | Alto |
| 4 | Paginação agressiva em production_entries | -$3/mês | 4h dev | Médio |

> **Conclusão:** O custo Firebase do sistema é dominado pelo polling contínuo dos operadores na aba Lançamento. As otimizações Nível 1-2 já implementadas reduzem ~23% do consumo. A migração para `onSnapshot` (Nível 3) reduziria ~96%, trazendo o custo total para menos de $2/mês.

---

*Documento gerado em Fevereiro 2026 — Hokkaido Plastics*  
*Base: 55 usuários cadastrados, observação de padrões de uso T1/T2/T3*
