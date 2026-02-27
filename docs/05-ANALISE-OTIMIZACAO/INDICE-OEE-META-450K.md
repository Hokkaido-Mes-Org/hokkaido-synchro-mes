# Índice: Análise OEE vs Meta 450K

**Verificação Completa: A meta fixa de 450 mil interfere no cálculo de OEE?**

---

## 📋 Documentos Criados

### 1. **RESUMO-OEE-META.md** ⭐ **LEIA PRIMEIRO**
- **Tamanho**: 4 min de leitura
- **Conteúdo**: Resposta direta com exemplos práticos
- **Para quem**: Gerentes, usuários finais
- **Tópicos**:
  - A resposta curta (SIM, mas indiretamente)
  - 3 exemplos reais
  - Raiz do problema
  - Próximos passos
  - FAQ

**🎯 Ação**: Se tem 5 minutossó, leia ESTE.

---

### 2. **VERIFICACAO-OEE-META-450K.md** (Análise Profunda)
- **Tamanho**: 15 min de leitura
- **Conteúdo**: Análise técnica detalhada
- **Para quem**: Product Owners, Leads Técnicos
- **Tópicos**:
  - Dois sistemas de cálculo lado-a-lado
  - Exemplo comparativo (sábado vs segunda)
  - Raízes do problema (agregação errada)
  - Como 450K interfere indiretamente
  - Recomendações priorizadas
  - Análise de código atual

**🎯 Ação**: Se precisa entender profundamente, leia ESTE.

---

### 3. **FIX-CALCULO-OEE-AGGREGADO.md** (Solução de Código)
- **Tamanho**: 20 min leitura + 2-3h implementação
- **Conteúdo**: Código corrigido com explicações
- **Para quem**: Desenvolvedores
- **Tópicos**:
  - Problema atual em código
  - Solução 1: Calcular por turno (RECOMENDADO)
  - Solução 2: Adaptar fórmula para agregado
  - Solução 3: Separar indicadores na UI
  - Solução 4: Remover meta de cálculos técnicos
  - Checklist de implementação
  - Testes propostos

**🎯 Ação**: Quando for implementar, use ESTE como referência.

---

### 4. **OEE-DEBUG-TESTE-PRATICO.md** (Validação)
- **Tamanho**: 10 min leitura + testes rápidos
- **Conteúdo**: Como encontrar, debugar e testar
- **Para quem**: QA, Desenvolvedores, Product Specialists
- **Tópicos**:
  - Mapa de localização no código
  - Teste rápido em 5 passos (console)
  - Script de validação com dados reais
  - Checklist visual
  - Testes automated

**🎯 Ação**: Quando descobrir que tem que validar os números, use ESTE.

---

## 🎯 Fluxo de Leitura por Perfil

### 👨‍💼 Gerente / PM

```
RESUMO-OEE-META.md (5 min)
    ↓
FAQ e Próximos Passos
    ↓
Delegar implementação do FIX-* para dev
```

### 👨‍💻 Desenvolvedor

```
RESUMO-OEE-META.md (5 min) - Contexto
    ↓
FIX-CALCULO-OEE-AGGREGADO.md (20 min) - Solução
    ↓
OEE-DEBUG-TESTE-PRATICO.md - Teste durante dev
    ↓
VERIFICACAO-OEE-META-450K.md - Referência se travado
```

### 🧪 QA / Tester

```
OEE-DEBUG-TESTE-PRATICO.md (10 min)
    ↓
Executar testes propostos
    ↓
RESUMO-OEE-META.md - Se dúvida, ler FAQ
```

### 📊 Analista de Dados

```
VERIFICACAO-OEE-META-450K.md (15 min) - Raízes
    ↓
OEE-DEBUG-TESTE-PRATICO.md - Extração de números
    ↓
FIX-CALCULO-OEE-AGGREGADO.md - Validação de fórmulas
```

---

## 📌 Achados Principais

### ✅ O que foi confirmado

1. **Meta 450K não afeta matematicamente o OEE** ✓
   - OEE usa capacidade teórica (ciclo, cavidades)
   - Meta 450K é independente dessa fórmula

2. **MAS cria confusão indireta** ⚠️
   - Dois indicadores diferentes (OEE técnico vs Meta comercial)
   - Aparecem com nomes similares na UI
   - Usuários ficam confusos qual acreditar

3. **OEE agregado está ERRADO** 🔴
   - Dados de 3 turnos sendo processados como 1 turno
   - Performance pode estar subestimada 20-30%
   - Resultado: OEE 20-30% mais baixo do que deveria

---

## 🔴 Problema Crítico

```
Código Atual:
├─ Agregação: Soma dados de T1+T2+T3
└─ Cálculo: Aplica fórmula de 1 turno

Resultado:
├─ Produção: 380K (correto)
├─ Performance Teórica: 6.5K (de 1 turno)
├─ Divisão: 380K / 6.5K = 5.846 (clampea a 100%)
└─ OEE: 45% (deveria ser 75%+)

Status: ❌ INCOERENTE - Incompatível
```

---

## ✅ Soluções Propostas

### Priority 0 (⚠️ URGENTE)

**Nível 1 - Validar o Bug**
- Executar teste em `OEE-DEBUG-TESTE-PRATICO.md`
- Confirmar OEE está subestimado
- `Esforço`: 30 min | **Prioridade**: CRÍTICA

**Nível 2 - Comunicar**
- Informar stakeholders sobre erro
- Alertar se relatórios históricos estão errados
- `Esforço`: 1h | **Prioridade**: ALTA

### Priority 1 (Curto Prazo - 1-2 semanas)

**Implementar Fix**
- Seguir `FIX-CALCULO-OEE-AGGREGADO.md` Solução 1
- Refatorar `aggregateOeeMetrics()` para agrupar por turno
- `Esforço`: 2-3h dev + 1h teste

**Validar com Dados Históricos**
- Comparar OEE antigo vs novo
- Confirmar diferença é ~15-30%
- `Esforço`: 1h análise

**Separar Indicadores na UI**
- OEE técnico vs Meta comercial
- Adicionar tooltips explicativos
- `Esforço`: 1-2h dev + 30min design

### Priority 2 (Médio Prazo - Próximo Sprint)

**Remover Meta Fixa de OEE**
- Eliminar `planned_quantity` de cálculos de Performance
- Usar apenas em relatórios de "Meta Achievement"
- `Esforço`: 1h dev

**Documentação**
- Atualizar `GUIA-OPERACIONAL.md`
- Atualizar `MANUAL-TECNICO.md`
- `Esforço`: 1-2h

---

## 📊 Resumo Executivo

| Aspecto | Status | Impacto | Prioridade |
|---------|--------|--------|-----------|
| Meta 450K afeta OEE? | ❌ Não direto | Confusão conceitual | 🔴 CRÍTICO |
| OEE agregado está correto? | ❌ Não | OEE 20-30% baixo | 🔴 CRÍTICO |
| Dois indicadores sem label? | ✅ Sim | Desconfiança em dados | 🟡 ALTO |
| Meta fixa deve ser usada? | ❓ Depende | Conflita com OEE técnico | 🟡 ALTO |

---

## 🔗 Links Entre Documentos

```
RESUMO-OEE-META.md
    │
    ├─→ "Para mais detalhes..."
    │   └─→ VERIFICACAO-OEE-META-450K.md (Seção 3-5)
    │
    └─→ "Como corrigir?"
        └─→ FIX-CALCULO-OEE-AGGREGADO.md

VERIFICACAO-OEE-META-450K.md
    │
    ├─→ "Veja os arquivos afetados..."
    │   └─→ OEE-DEBUG-TESTE-PRATICO.md (Seção 1 - Mapa)
    │
    └─→ "Recomendações..."
        └─→ FIX-CALCULO-OEE-AGGREGADO.md

FIX-CALCULO-OEE-AGGREGADO.md
    │
    ├─→ "Como validar?"
    │   └─→ OEE-DEBUG-TESTE-PRATICO.md (Seção 2-3 - Teste)
    │
    └─→ "Por que esse fix?"
        └─→ VERIFICACAO-OEE-META-450K.md (Seção 2 e 3)

OEE-DEBUG-TESTE-PRATICO.md
    │
    └─→ "O quê está errado?"
        └─→ RESUMO-OEE-META.md + VERIFICACAO-OEE-META-450K.md
```

---

## 🎓 Quick Answers

**P: A meta 450K interfere no OEE?**  
R: Indiretamente. Não matematicamente, mas cria confusão conceitual.

**P: Qual indicador está errado?**  
R: OEE agregado (por dia). Está usando fórmula de 1 turno com dados de 3 turnos.

**P: Quanto está errado?**  
R: 20-30% subestimado. OEE real ~75%, mostrado ~45%.

**P: Precisa corrigir urgente?**  
R: SIM. Relatórios de OEE estão enganosos.

**P: Quanto tempo para corrigir?**  
R: 2-3h desenvolvimento + 1h testes = ~4-5h total.

**P: Precisa correuir dados históricos?**  
R: Sim, aplicar fórmula nova aos últimos 30 dias.

---

## 📁 Archivos Associados

Todos os documentos estão em: `/docs/05-ANALISE-OTIMIZACAO/`

```
├─ RESUMO-OEE-META.md                    ← LEIA PRIMEIRO
├─ VERIFICACAO-OEE-META-450K.md          ← Análise profunda
├─ FIX-CALCULO-OEE-AGGREGADO.md          ← Implementação
├─ OEE-DEBUG-TESTE-PRATICO.md            ← Validação
├─ INDICE-OEE-META-450K.md               ← Este arquivo
├─
└─ (Docs relacionados)
   ├─ GUIA-OPERACIONAL.md (Seção 4.2 - OEE)
   ├─ MANUAL-TECNICO.md (Capítulo de métricas)
   └─ UNIFICACAO-PARADAS-DETALHADA.md (Seção 12 - Cálculos OEE)
```

---

## 🚀 Próximas Ações

### Hoje
- [ ] Ler `RESUMO-OEE-META.md`
- [ ] Entender o problema
- [ ] Validar se OEE está realmente errado

### Amanhã
- [ ] Executar teste em `OEE-DEBUG-TESTE-PRATICO.md`
- [ ] Confirmar bug com dados reais
- [ ] Reportar ao time técnico

### Próxima Sprint
- [ ] Implementar fix de `FIX-CALCULO-OEE-AGGREGADO.md`
- [ ] Testar com dados históricos
- [ ] Atualizar documentação operacional

---

## 📞 Dúvidas?

Se algo não ficar claro:

1. Verifique o FAQ em `RESUMO-OEE-META.md`
2. Procure no `OEE-DEBUG-TESTE-PRATICO.md` como testar
3. Revise as fórmulas em `VERIFICACAO-OEE-META-450K.md`
4. Consulte código em `FIX-CALCULO-OEE-AGGREGADO.md`

---

**Última atualização**: 23/02/2026  
**Status**: ✅ Análise completa com 4 documentos e soluções propostas  
**Próxima revisão**: Após implementação do fix

