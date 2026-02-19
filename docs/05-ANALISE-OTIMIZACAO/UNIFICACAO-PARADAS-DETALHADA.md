# Análise Detalhada: Unificação de Paradas | Hokkaido MES

> **Data:** 10/02/2026  
> **Objetivo:** Entender completamente a proposta de unificação parcial de paradas  
> **Status:** 📋 Análise | ✅ Implementações parciais concluídas (seção 14) | ⏳ Migração pendente

---

## Índice

1. [Estado Atual](#1-estado-atual)
2. [Problemas do Estado Atual](#2-problemas-do-estado-atual)
3. [Estrutura Proposta](#3-estrutura-proposta)
4. [Comparação: Antes vs Depois](#4-comparação-antes-vs-depois)
5. [Exemplos Práticos](#5-exemplos-práticos)
6. [Impacto no Código](#6-impacto-no-código)
7. [Fluxo de Dados](#7-fluxo-de-dados)
8. [Migração de Dados](#8-migração-de-dados)
9. [Benefícios Detalhados](#9-benefícios-detalhados)
10. [Riscos e Mitigações](#10-riscos-e-mitigações)
11. [Perguntas Frequentes](#11-perguntas-frequentes)
12. [Cálculo OEE Real com Demanda Variável](#12-cálculo-oee-real-com-demanda-variável)
13. [Demanda Variável — Conceito e Implementação](#13-demanda-variável--conceito-e-implementação)
14. [Implementações Recentes (Fevereiro 2026)](#14-implementações-recentes-fevereiro-2026) ✅ **NOVO**

---

## 1. Estado Atual

### 1.1. Duas Coleções Separadas

```
FIREBASE FIRESTORE
│
├─ downtime_entries (Paradas Normais)
│  ├─ Doc1: AJUSTE DE PROCESSO (75 min)
│  ├─ Doc2: TROCA DE COR (45 min)
│  ├─ Doc3: FALTA DE OPERADOR (120 min)
│  └─ Doc4: MANUTENÇÃO CORRETIVA (180 min)
│
└─ extended_downtime_logs (Paradas Longas)
   ├─ Doc1: SEM PEDIDO (3780 min = 63 horas)
   ├─ Doc2: FIM DE SEMANA (2880 min = 48 horas)
   ├─ Doc3: MANUTENÇÃO PREVENTIVA (1440 min = 24 horas)
   └─ Doc4: PARADA COMERCIAL (960 min = 16 horas)
```

### 1.2. Fluxo Atual

```
OPERADOR CLICA STOP
    ↓
startMachineDowntime()
    ↓
Salva em active_downtimes
    ↓
OPERADOR CLICA START
    ↓
finalizeMachineDowntime()
    ↓
Salva em downtime_entries ✓


GESTOR ABRE FORMULÁRIO
    ↓
handleExtendedDowntimeFormSubmit()
    ↓
Salva em extended_downtime_logs ✓
```

### 1.3. Leitura de Dados Atual

```
loadDowntimeAnalysis()
    ├─ Lê downtime_entries
    │  └─ Consolida segmentos por turno
    │     └─ Gera array: [evento1, evento2, evento3...]
    │
    ├─ Lê extended_downtime_logs (via cache)
    │  └─ Mapeia para mesmo formato
    │     └─ Gera array: [evento1, evento2...]
    │
    ├─ Combina: combinedForChart = [...normais, ...longas]
    │
    └─ Renderiza gráfico único
       └─ ❌ Distorção visual (48h de SEM PEDIDO + 1h de AJUSTE)
```

---

## 2. Problemas do Estado Atual

### 2.1. Problema #1: Duas Coleções = Código Duplicado

```javascript
// Hoje, precisa fazer TUDO DUAS VEZES

// Para downtime_entries
const downtimes = await getFilteredData('downtime', startDate, endDate);
const consolidated = consolidateDowntimeEvents(downtimes);

// Para extended_downtime_logs
const extended = await getExtendedDowntimesCached();
const extendedFiltered = extended.filter(e => {
    // Lógica de filtro duplicada!
    if (e.start_datetime < startDate) return false;
    if (e.start_datetime > endDate) return false;
    return true;
});

// Combina
const combined = [...consolidated, ...extendedFiltered];

// ❌ Problemas:
// - Lógica de filtro duplicada
// - Estrutura de dados diferente (precisa "ajustar")
// - Caching separado (advanced / simples)
// - Consolidação só funciona para normal (não trata extended)
```

### 2.2. Problema #2: Gráfico Distorcido

```
Exemplo Real:
└─ 07/02 17:00 a 10/02 07:00 = SEM PEDIDO = 62 horas
└─ 10/02 14:30 a 10/02 15:45 = AJUSTE DE PROCESSO = 1.25 horas

Gráfico Atual:
┌──────────────────────────────────────────────────────────┐
│ PARADAS POR CATEGORIA (Combinado)                        │
├──────────────────────────────────────────────────────────┤
│ COMERCIAL      ██████████████████████████ 62h   (98%)  │
│ PROCESSO       ▌ 1.25h  (2%)                          │
└──────────────────────────────────────────────────────────┘

❌ Resultado: Parece que 98% das paradas são comerciais!
   Mas a verdade é que 62h é UM EVENTO (SEM PEDIDO)
   e 1.25h é OUTRO EVENTO completamente diferente.
   
✓ O gestor quer saber: "O que mais parou a máquina?"
❌ Resposta atual: "SEM PEDIDO" (mas isso é planejado!)
✓ Resposta que deveria ser: "AJUSTE DE PROCESSO" (não-planejado)
```

### 2.3. Problema #3: Cálculo de MTBF Confunde Tudo

```
CENÁRIO ATUAL (30 de janeiro a 10 de fevereiro):

Paradas Normais:
  ├─ AJUSTE DE PROCESSO: 15 ocorrências, total 35h
  ├─ FALTA DE MP: 8 ocorrências, total 12h
  └─ Total: 23 ocorrências, 47h

Paradas Longas:
  ├─ FIM DE SEMANA (01-02, 08-09): 2 ocorrências, 96h
  ├─ SEM PEDIDO (07-10): 1 ocorrência, 62h
  └─ Total: 3 ocorrências, 158h

Cálculo Atual de MTBF:
MTBF = Horas no Período / Total Paradas
     = 720h / 26 paradas
     = 27.7h

❌ PROBLEMA: Mistura conceitos
   - FIM DE SEMANA não é uma "falha" (é planejado)
   - Com unificação + natureza:

Cálculo Proposto de MTBF:
MTBF = Horas Produtivas / Falhas Não-Planejadas
     = (720h - 96h de FDS - 62h de comercial) / 23
     = 562h / 23
     = 24.4h
     
✓ Mais realista! Exclui o que não é "culpa" da produção
```

### 2.4. Problema #4: Permissões e Fluxo Misto

```
Atualmente:
├─ downtime_entries
│  └─ Salvo por: finalizeMachineDowntime() → qualquer operador
│  └─ Quem edita: operador (via modal)
│  └─ Quem deleta: admin
│
└─ extended_downtime_logs
   └─ Salvo por: handleExtendedDowntimeFormSubmit() → gestor
   └─ Quem edita: gestor (via formulário dedicado)
   └─ Quem deleta: gestor/admin

❌ Regras de permissão duplicadas e inconsistentes
```

### 2.5. Problema #5: Categorização Complexa

```
getDowntimeCategory() hoje faz 4 fallbacks para categorizar:

1. Verifica campo 'category' (pode não existir em dados antigos)
2. Busca em specialReasonMapping (hardcoded)
3. Varre groupedDowntimeReasons (slow for large lists)
4. Fallback para 'OUTROS'

❌ Problema: Com 2 coleções, precisa chamar isso 2x com lógica diferente
   └─ downtime_entries tenta campo 'reason'
   └─ extended_downtime_logs tenta campo 'type'
```

---

## 3. Estrutura Proposta

### 3.1. Uma Coleção Unificada

```
FIREBASE FIRESTORE (PROPOSTO)
│
└─ downtime_entries (UNIFICADO)
   ├─ Doc1: AJUSTE DE PROCESSO (75 min, type: "normal", nature: "unplanned")
   ├─ Doc2: TROCA DE COR (45 min, type: "normal", nature: "unplanned")
   ├─ Doc3: FIM DE SEMANA (2880 min, type: "extended", nature: "external")
   ├─ Doc4: SEM PEDIDO (3780 min, type: "extended", nature: "external")
   ├─ Doc5: MANUTENÇÃO PREVENTIVA (1440 min, type: "extended", nature: "planned")
   └─ Doc6: MANUTENÇÃO CORRETIVA (180 min, type: "normal", nature: "unplanned")
```

### 3.2. Schema Proposto (Detalhado)

```javascript
{
    // ============= IDENTIFICAÇÃO =============
    _id: FirebaseAutoId,
    machine_id: "INJ-01",           // String, normalizado (minúsculas)
    
    // ============= CLASSIFICAÇÃO (NOVOS CAMPOS) =============
    type: "normal",                 // "normal" | "extended"
                                    // normal = operador STOP/START
                                    // extended = gestor formulário
    
    nature: "unplanned",            // "planned" | "unplanned" | "external"
                                    // planned = reduz tempo programado
                                    // unplanned = falha (MTBF)
                                    // external = não conta (comercial, pcp)
    
    // ============= CATEGORIZAÇÃO =============
    category: "PROCESSO",           // Formato: MAIÚSCULAS
    reason: "AJUSTE DE PROCESSO",   // Texto do motivo
    
    // ============= TEMPORAL =============
    start_datetime: Timestamp,      // Sempre Firestore Timestamp
    end_datetime: Timestamp,        // null se ativa
    date: "2026-02-10",             // Workday (YYYY-MM-DD)
    shift: "turno2",                // turno1, turno2, turno3
    duration_minutes: 75,           // Sempre em minutos
    
    status: "finished",             // "active" | "finished" | "inactive"
                                    // active = durando/aberta
                                    // finished = encerrada
                                    // inactive = cancelada
    
    // ============= CONTEXTO (Paradas Normais) =============
    product: "PEÇA ABC",            // null para paradas longas
    product_cod: "COD-123",
    order_id: "OP-2026-001",
    order_number: null,
    
    // ============= OBSERVAÇÕES =============
    observations: "Digite aqui",
    
    // ============= ÁUDIO TRAIL =============
    created_by: "joao.silva",       // Quem registrou
    created_at: Timestamp,
    finished_by: "maria.gestora",   // Quem finalizou (extended)
    finished_at: Timestamp,
    updated_at: Timestamp,
    
    // ============= METADADOS (Segmentação por Turno) =============
    is_segmented: false,            // true se foi dividida por turno
    parent_id: null,                // Ref se for segmento de parada mãe
    segment_index: 0,               // 0, 1, 2... se segmentada
    total_segments: 1,              // Total de segmentos
    
    // ============= COMPATIBILIDADE (Legado) =============
    type_legacy: null,              // Código antigo (weekend, maintenance, etc)
    version: "3.0"                  // Versão do schema
}
```

### 3.3. Comparação: Documento Normal vs Longo

```javascript
// ===== PARADA NORMAL (Operador) =====
{
    type: "normal",
    nature: "unplanned",
    category: "PROCESSO",
    reason: "AJUSTE DE PROCESSO",
    start_datetime: Timestamp(2026-02-10 14:30),
    end_datetime: Timestamp(2026-02-10 15:45),
    duration_minutes: 75,
    shift: "turno2",
    status: "finished",
    
    product: "PEÇA ABC",            // ← Exclusivo de normal
    order_id: "OP-2026-001",        // ← Exclusivo de normal
    
    is_segmented: false,            // ← false para normal (geralmente)
    created_by: "joao.silva"
}

// ===== PARADA LONGA (Gestor) =====
{
    type: "extended",
    nature: "external",
    category: "COMERCIAL",
    reason: "SEM PEDIDO",
    start_datetime: Timestamp(2026-02-07 17:00),
    end_datetime: Timestamp(2026-02-10 07:00),  // Null enquanto ativa
    duration_minutes: 3780,         // 63 horas
    shift: "turno2",                // Turno do início
    status: "finished",
    
    product: null,                  // ← null para extended
    order_id: null,                 // ← null para extended
    
    is_segmented: false,            // ← NÃO segmenta (diferente do normal)
    created_by: "maria.gestora"
}

// ===== PARADA NORMAL SEGMENTADA =====
{
    type: "normal",
    nature: "unplanned",
    category: "MANUTENÇÃO",
    reason: "MANUTENÇÃO CORRETIVA",
    
    // Segmentada em 3 turnos:
    is_segmented: true,
    parent_id: "parent_doc_id_123",
    segment_index: 0,               // ← Este é o primeiro
    total_segments: 3,              // ← Dividido em 3 documentos
    
    shift: "turno2",                // ← Turno deste segmento
    start_datetime: Timestamp(2026-02-10 21:30),
    end_datetime: Timestamp(2026-02-10 22:00),
    duration_minutes: 30
}
```

---

## 4. Comparação: Antes vs Depois

### 4.1. Leitura de Dados

```javascript
// ===== ANTES (Atual) =====
async function loadDowntimeAnalysis() {
    // 1. Lê downtime_entries
    const downtimes = await getFilteredData('downtime', startDate, endDate);
    const consolidated = consolidateDowntimeEvents(downtimes);
    
    // 2. Lê extended_downtime_logs
    const extended = await getExtendedDowntimesCached(forceRefresh, activeOnly);
    
    // 3. Lê com lógica de filtro DUPLICADA
    const extendedFiltered = extended.filter(e => {
        const start = parseISO(e.start_date);
        const end = parseISO(e.end_date || new Date());
        return start <= endDate && end >= startDate;
    });
    
    // 4. Combina
    const combinedForChart = [...consolidated, ...extendedFiltered];
    
    // 5. Agrupa por categoria (chama getDowntimeCategory 2x com lógicas diferentes)
    const byCategory = {};
    consolidated.forEach(d => {
        const cat = getDowntimeCategory(d.reason);  // Usa 'reason'
        byCategory[cat] = (byCategory[cat] || 0) + d.duration;
    });
    
    extended.forEach(d => {
        const cat = d.category || getDowntimeCategory(d.type);  // Usa 'type'
        byCategory[cat] = (byCategory[cat] || 0) + (d.duration_minutes / 60);
    });
    
    // ❌ Problema: código repetido, lógica diferente
}

// ===== DEPOIS (Proposto) =====
async function loadDowntimeAnalysis() {
    // 1. Lê UMA coleção com filtro único
    const downtimes = await db.collection('downtime_entries')
        .where('date', '>=', startDate)
        .where('date', '<=', endDate)
        .where('machine_id', '==', machine)
        .where('status', 'in', ['finished', 'active'])
        .get();
    
    // 2. Agrupa UMA VEZ, sem duplicação
    const byCategory = {};
    const byNature = {};
    
    downtimes.forEach(d => {
        const data = d.data();
        const cat = data.category;  // Já está lá!
        const nature = data.nature;  // Já está lá!
        
        byCategory[cat] = (byCategory[cat] || 0) + data.duration_minutes;
        byNature[nature] = (byNature[nature] || 0) + data.duration_minutes;
    });
    
    // ✓ Simples, eficiente, sem duplicação
}
```

### 4.2. Linha de Código Redução

```
┌────────────────────────────────────────┐
│ Estimativa de Redução de Código       │
├────────────────────────────────────────┤
│                                        │
│ Funções a Remover:                     │
│ ├─ getExtendedDowntimesCached()  (70)  │
│ ├─ splitDowntimeIntoShiftSegments... (50) │
│ ├─ consolidateDowntimeEvents()   (150) │
│ ├─ loadExtendedDowntimeAnalysis() (300)│
│ ├─ renderExtendedDowntimeChart()  (120)│
│ └─ updateActiveExtendedDowntimes() (80)│
│    ─────────────────────────────────────
│    Total: ~770 linhas removidas
│
│ Funções a Adicionar/Modificar:         │
│ ├─ Novo enum: type + nature     (30)   │
│ ├─ Refatorar loadDowntimeAnalysis() +70│
│ ├─ Novo filter toggles          (150)  │
│ ├─ Atualizar renderizadores     (100)  │
│ ├─ Migração dados               (200)  │
│    ─────────────────────────────────────
│    Total: ~550 linhas novas
│
│ RESULTADO LÍQUIDO: -220 linhas (-28%)
│
└────────────────────────────────────────┘
```

### 4.3. Queries no Firebase

```javascript
// ===== ANTES =====
// Query 1: downtime_entries
db.collection('downtime_entries')
  .where('date', '>=', startDate)
  .where('date', '<=', endDate)
  .get()  // ~200 docs

// Query 2: extended_downtime_logs
db.collection('extended_downtime_logs')
  .where('start_date', '>=', startDate)
  .where('end_date', '<=', endDate)
  .get()  // ~30 docs

// Listeners Query 3: active_downtimes (real-time)
db.collection('active_downtimes')
  .onSnapshot()  // real-time updates

// Total: 3 queries
// Custo Firebase: 3 read operations

// ===== DEPOIS =====
// Query Única
db.collection('downtime_entries')
  .where('date', '>=', startDate)
  .where('date', '<=', endDate)
  .where('status', 'in', ['finished', 'active'])
  .get()  // ~230 docs (todos)

// Listener Única
db.collection('downtime_entries')
  .where('status', '==', 'active')
  .onSnapshot()  // real-time updates (ambos os tipos)

// Total: 1 query + 1 listener
// Custo Firebase: 1 read + 1 listener (50% redução)
```

---

## 5. Exemplos Práticos

### 5.1. Exemplo #1: Operador Registra Parada

```javascript
// ===== FLUXO ATUAL =====

// 1. Operador clica STOP
startMachineDowntime(
    reason: "AJUSTE DE PROCESSO",
    observations: "Sensor descalibrado"
);

// 2. Salva em active_downtimes
await db.collection('active_downtimes').doc('inj-01').set({
    machine: "INJ-01",
    reason: "AJUSTE DE PROCESSO",
    startTimestamp: Timestamp.now(),
    isActive: true
});

// 3. Operador clica START
finalizeMachineDowntime();

// 4. Sistema CALCULA categoria
const category = getDowntimeCategory("AJUSTE DE PROCESSO");  // "PROCESSO"

// 5. Salva em downtime_entries
await db.collection('downtime_entries').add({
    machine: "INJ-01",
    reason: "AJUSTE DE PROCESSO",
    category: category,  // "PROCESSO" ← Calculado
    duration: 75,
    // ... mais campos
});

// 6. Deleta de active_downtimes
await db.collection('active_downtimes').doc('inj-01').delete();

// ===== COM UNIFICAÇÃO (PROPOSTO) =====

// 1. Operador clica STOP (iguall)
startMachineDowntime(
    reason: "AJUSTE DE PROCESSO",
    observations: "Sensor descalibrado"
);

// 2. Salva em active_downtimes (pode manter ou remover)
// OU cria documento em downtime_entries com status: 'active'

// 3. Operador clica START
finalizeMachineDowntime();

// 4. Sistema CALCULA category e nature
const category = getDowntimeCategory("AJUSTE DE PROCESSO");  // "PROCESSO"
const nature = getNatureFromReason("AJUSTE DE PROCESSO");    // "unplanned"

// 5. Salva em downtime_entries (ÚNICO local)
await db.collection('downtime_entries').add({
    machine_id: "inj-01",                    // ← Normalizado
    reason: "AJUSTE DE PROCESSO",
    category: category,                      // "PROCESSO"
    type: "normal",                          // ← NOVO: tipo
    nature: nature,                          // ← NOVO: natureza
    duration_minutes: 75,
    start_datetime: Timestamp,
    end_datetime: Timestamp,
    status: "finished",
    shift: "turno2",
    // ... mais campos
});

// ✓ Fim!
// _ Não precisa deletar nada
// _ Tudo em UM único lugar
```

### 5.2. Exemplo #2: Gestor Registra Parada Longa

```javascript
// ===== FLUXO ATUAL =====

// 1. Gestor abre formulário "Paradas Longas"
// 2. Preenche: máquina, categoria, motivo, data início
// 3. Sistema salva em extended_downtime_logs
await db.collection('extended_downtime_logs').add({
    machine_id: "inj-01",
    category: "COMERCIAL",
    type: "SEM PEDIDO",  // ← Código legado
    reason: "SEM PEDIDO",
    start_date: "2026-02-07",
    start_datetime: Timestamp,
    status: "active",
    // ... mais campos
});

// 4. Sistema atualiza a cada 30 min (Se formulário estiver aberto)
// 5. Gestor clica "Finalizar"
// 6. Sistema atualiza status, end_datetime

// ===== COM UNIFICAÇÃO (PROPOSTO) =====

// 1. Gestor abre formulário (MESMO INTERFACE)
// 2. Preenche (MESMO CAMPOS)
// 3. Sistema valida e CALCULA nature
const nature = getNatureFromReason("SEM PEDIDO");  // "external"

// 4. Sistema salva em downtime_entries (ÚNICO local)
await db.collection('downtime_entries').add({
    machine_id: "inj-01",
    category: "COMERCIAL",
    reason: "SEM PEDIDO",
    type: "extended",                    // ← NOVO
    nature: "external",                  // ← NOVO
    start_datetime: Timestamp,
    end_datetime: null,                  // Preenchido no fim
    duration_minutes: 0,                 // Calculado
    status: "active",
    shift: "turno2",
    is_segmented: false,                 // NÃO segmenta
    // ... mais campos
});

// 5. Sistema ainda atualiza a cada 30 min (mas EM downtime_entries)
// 6. Gestor clica "Finalizar" (OU sistema finaliza automático)
// 7. Sistema atualiza mesma coleção:
await doc.update({
    status: "finished",
    end_datetime: Timestamp.now(),
    duration_minutes: 3780
});

// ✓ Tudo em UM único lugar
```

### 5.3. Exemplo #3: Cálculo de MTBF

```javascript
// ===== CÁLCULO ATUAL =====

function calculateMTBF() {
    // 1. Pega downtimes normais
    const allDowntimes = consolidateDowntimeEvents(downtimes);
    // = 47 paradas (25h operacional)
    
    // 2. Pega extended (mistura com normal)
    const extended = await getExtendedDowntimesCached();
    // = 3 paradas (158h): FIM DE SEMANA (96h) + SEM PEDIDO (62h)
    
    // 3. Combina
    const total = allDowntimes.length + extended.length;
    // = 50 paradas no período
    
    // 4. Calcula MTBF
    const hoursInPeriod = calculateHoursInPeriod(startDate, endDate);
    // = 720h (30 dias)
    
    const mtbf = hoursInPeriod / total;
    // = 720 / 50 = 14.4h
    
    // ❌ RESULTADO: MTBF inflado!
    //    Parece que máquina falha a cada 14.4h
    //    Mas é porque inclui FIM DE SEMANA que é planejado!
}

// ===== CÁLCULO PROPOSTO =====

function calculateMTBF() {
    // 1. Lê downtime_entries
    const allDowntimes = db.collection('downtime_entries')
        .where('nature', '==', 'unplanned')  // ← FILTRA por natureza
        .get();
    // = 47 paradas não-planejadas (25h)
    
    // 2. Calcula horas em período EXCLUINDO externas
    const programmedHours = calculateHoursInPeriod(startDate, endDate);
    const external = await getTotalHours('external');  // FIM DE SEMANA, COMERCIAL, etc
    const productiveHours = programmedHours - external;
    // = 720h - 158h = 562h produtivo
    
    // 3. Calcula MTBF CORRETO
    const mtbf = productiveHours / 47;
    // = 562 / 47 = 11.96h ≈ 12h
    
    // ✓ RESULTADO MAIS REALISTA
    //    Máquina falha (não-planejado) a cada 12h
    //    Exclui o que é planejado e externo
}
```

---

## 6. Impacto no Código

### 6.1. Funções a Remover (770 linhas)

```javascript
❌ REMOVER COMPLETAMENTE:

1. getExtendedDowntimesCached()
   └─ Não precisa mais (tudo em downtime_entries)
   
2. loadExtendedDowntimeAnalysis()
   └─ Lógica integrada em loadDowntimeAnalysis()
   
3. renderExtendedDowntimeChart()
   └─ Integrado em generateDowntimeReasonsChart()
   
4. handleExtendedDowntimeSubmit()
   └─ Integrado em finalizeMachineDowntime()
   
5. updateActiveExtendedDowntimes()
   └─ Mesma lógica, mas atualiza downtime_entries
   
6. splitDowntimeIntoShiftSegments()
   └─ Lógica otimizada, menos chamadas
```

### 6.2. Funções a Modificar (550 linhas)

```javascript
✏️ MODIFICAR:

1. loadDowntimeAnalysis()
   ├─ Antes: Combinava 2 coleções
   ├─ Depois: Lê 1 coleção
   ├─ Adiciona: Filtro por 'type' e 'nature'
   └─ Resultado: 40% menos código

2. generateDowntimeReasonsChart()
   ├─ Adiciona: Toggle entre "Por Natureza" / "Por Categoria" / "Por Motivo"
   ├─ Adiciona: Legenda colorida por natureza
   └─ Resultado: +150 linhas (valor agregado)

3. finalizeMachineDowntime()
   ├─ Adiciona: Cálculo de 'nature' na hora
   ├─ Modificação: Salva 'type: "normal"' e 'nature'
   └─ Resultado: +20 linhas

4. handleExtendedDowntimeFormSubmit()
   ├─ Modificação: Salva em downtime_entries (não extended_downtime_logs)
   ├─ Adiciona: type: "extended", nature: calculado
   └─ Resultado: -10 linhas (simplificado)

5. getDowntimeCategory()
   ├─ Sem mudança (continua igual)
   ├─ Mas: Será chamado MENOS vezes (cache melhor)
   └─ Resultado: 0 linhas (otimização de uso)

✨ NOVO:

6. getNatureFromReason()
   ├─ Entrada: motivo (ex: "AJUSTE DE PROCESSO")
   ├─ Saída: natureza (ex: "unplanned")
   ├─ Baseado em: mapeamento em database.js
   └─ Resultado: +80 linhas
   
7. Melhorar consolidação de segmentos
   ├─ Agora considera parent_id
   ├─ Mais robusto (menos gaps)
   └─ Resultado: +50 linhas
```

### 6.3. Código Exemplo: Antes vs Depois

```javascript
// ===== ANTES: loadDowntimeAnalysis() ≈ 150 linhas =====

async function loadDowntimeAnalysis() {
    const { startDate, endDate, machine } = currentAnalysisFilters;

    // 1. Carregar paradas normais
    const downtimeSegments = await getFilteredData('downtime', startDate, endDate, machine);
    const downtimeData = consolidateDowntimeEvents(downtimeSegments);

    // 2. Carregar paradas longas
    const extendedData = await getExtendedDowntimesCached();
    const extendedForChart = [];
    const categoryHours = {};

    extendedData.forEach(item => {
        // Filtro manual
        if (!item.start_date || parseDate(item.start_date) > endDate) return;
        if (!item.end_date && parseDate(item.start_date) > endDate) return;
        
        // Cálculo manual de duração
        let durationMinutes;
        if (item.status === 'active') {
            const startTime = new Date(item.start_datetime);
            const now = new Date();
            durationMinutes = Math.floor((now - startTime) / (1000 * 60));
        } else {
            durationMinutes = item.duration_minutes || 0;
        }

        // Categorizar com fallback
        let reason = item.reason || item.type;
        if (item.type && !item.reason) {
            const oldTypeToReason = { 'weekend': 'FIM DE SEMANA', ... };
            reason = oldTypeToReason[item.type] || item.type;
        }
        const assignedCategory = getDowntimeCategory(reason);

        // Agrupar
        categoryHours[assignedCategory] = (categoryHours[assignedCategory] || 0) + (durationMinutes / 60);

        // Mapear para formato do gráfico
        extendedForChart.push({
            id: item.id,
            machine: item.machine_id,
            date: item.start_date,
            duration: durationMinutes,
            reason: reason,
            isExtended: true
        });
    });

    // 3. Combinar dados
    const combinedForChart = [...downtimeData, ...extendedForChart];

    // 4. Calcular KPIs (normais)
    const totalDowntime = downtimeData.reduce((sum, d) => sum + (d.duration || 0), 0);
    const downtimeCount = downtimeData.length;
    const avgDowntime = downtimeCount > 0 ? totalDowntime / downtimeCount : 0;
    const hoursInPeriod = calculateHoursInPeriod(startDate, endDate);
    const mtbf = downtimeCount > 0 ? hoursInPeriod / downtimeCount : 0;

    // 5. Atualizar UI
    document.getElementById('total-downtime').textContent = `${(totalDowntime / 60).toFixed(1)}h`;
    document.getElementById('downtime-count').textContent = downtimeCount;
    document.getElementById('avg-downtime').textContent = `${avgDowntime.toFixed(0)}min`;
    document.getElementById('mtbf-value').textContent = `${mtbf.toFixed(1)}h`;

    // 6. Renderizar gráficos
    await generateDowntimeReasonsChart(combinedForChart);
    await generateDowntimeByMachineChart(downtimeData);
    await generateDowntimeTimelineChart(downtimeData);

    // 7. Análise específica de paradas longas
    const totalExtendedHours = Object.values(categoryHours).reduce((a, b) => a + b, 0);
    const extendedPercentages = {};
    Object.entries(categoryHours).forEach(([cat, hours]) => {
        extendedPercentages[cat] = (hours / totalExtendedHours * 100).toFixed(1);
    });

    // 8. Renderizar cards dinâmicos
    renderExtendedDowntimeCards(categoryHours, extendedPercentages);
    
    // 9. Renderizar gráfico específico
    renderExtendedDowntimeChart(categoryHours);
}

// ===== DEPOIS: loadDowntimeAnalysis() ≈ 90 linhas =====

async function loadDowntimeAnalysis() {
    const { startDate, endDate, machine } = currentAnalysisFilters;

    // 1. Carregar TUDO em uma query
    const snapshot = await db.collection('downtime_entries')
        .where('date', '>=', startDate)
        .where('date', '<=', endDate)
        .where('machine_id', '==', machine)
        .where('status', 'in', ['finished', 'active'])
        .get();

    const allDowntimes = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));

    // 2. Consolidar (só se for segmentado)
    const consolidated = consolidateDowntimeEvents(
        allDowntimes.filter(d => d.type === 'normal')
    );

    // 3. Agrupar por categoria e natureza
    const byCategory = {};
    const byNature = {};
    
    allDowntimes.forEach(d => {
        const durationHours = d.duration_minutes / 60;
        
        byCategory[d.category] = (byCategory[d.category] || 0) + durationHours;
        byNature[d.nature] = (byNature[d.nature] || 0) + durationHours;
    });

    // 4. Calcular KPIs (corrigidos por natureza)
    const unplannedDowntimes = consolidated.filter(d => d.nature === 'unplanned');
    const externalHours = (byNature['external'] || 0);
    const productiveHours = calculateHoursInPeriod(startDate, endDate) - externalHours;
    
    const totalDowntimeHours = byNature['unplanned'] || 0;
    const mtbf = unplannedDowntimes.length > 0 ? productiveHours / unplannedDowntimes.length : 0;
    const avgDowntime = unplannedDowntimes.length > 0 
        ? (totalDowntimeHours * 60) / unplannedDowntimes.length 
        : 0;

    // 5. Atualizar KPIs na UI
    updateKPIDisplay({
        totalHours: (byNature['unplanned'] || 0).toFixed(1),
        count: unplannedDowntimes.length,
        avgMinutes: avgDowntime.toFixed(0),
        mtbf: mtbf.toFixed(1),
        availability: ((productiveHours / (productiveHours + totalDowntimeHours)) * 100).toFixed(1)
    });

    // 6. Renderizar gráficos
    await generateDowntimeReasonsChart(allDowntimes, 'by-nature');  // Toggle
    
    // ✓ Fim!
    // _ 60 linhas a menos
    // _ Sem duplicação de lógica
    // _ Código mais legível
}
```

---

## 7. Fluxo de Dados

### 7.1. Fluxo Atual (Duplo)

```
OPERADOR                      GESTOR
    │                            │
    ▼                            ▼
┌─────────────┐          ┌───────────────────┐
│ STOP/START  │          │ Formulário Parada │
│  (máquina)  │          │     Longa         │
└──────┬──────┘          └────────┬──────────┘
       │                          │
       ├─ Salva em ────┐  ┌─ Salva em ─────┐
       │    active_    │  │  extended_     │
       │ downtimes     │  │  downtime_logs │
       │               │  │                │
       ▼               │  │                ▼
┌─────────────┐        │  │        ┌───────────────┐
│  CALCULA    │        │  │        │  CALCULA      │
│ duração e   │        │  │        │  duração a    │
│ salva em    │        │  │        │  cada 30 min  │
│ downtime_   │        │  │        │  em extended_ │
│ entries     │        │  │        │  downtime_    │
└──────┬──────┘        │  │        │  logs         │
       │               │  │        └────┬──────────┘
       ▼               ▼  ▼             │
      🗄️ [downtime_entries]  🗄️ [extended_downtime_logs]
           ~200 docs              ~30 docs

Leitura (análise):
┌─────────────────────────────────────────┐
│  loadDowntimeAnalysis()                  │
├─────────────────────────────────────────┤
│ 1. Lê downtime_entries                 │
│ 2. Consolida segmentos                 │
│ 3. Lê extended_downtime_logs           │
│ 4. Filtra por período                  │
│ 5. Combina (combinedForChart) ───┐     │
│ 6. Agrupa por categoria          │     │
│                                  │     │
│ loadExtendedDowntimeAnalysis()    │     │
│ 7. Lê extended_downtime_logs     │     │
│ 8. Filtra novamente              │     │
│ 9. Agrupa por categoria          ├──┐  │
│ 10. Renderiza cards              │  │  │
│ 11. Renderiza gráfico separado   │  │  │
└─────────────────────────────────────┼──┘
                                      │
                              ┌─ Gráfico Combinado
                              │  (DISTORCIONA)
                              │
                              └─ Gráfico Extended
                                 (apartado)

❌ Código duplicado
❌ Consultas lentas
❌ Gráfico misturado
```

### 7.2. Fluxo Proposto (Unificado)

```
OPERADOR                      GESTOR
    │                            │
    ▼                            ▼
┌─────────────┐          ┌───────────────────┐
│ STOP/START  │          │ Formulário Parada │
│ (máquina)   │          │    Longa          │
└──────┬──────┘          └────────┬──────────┘
       │                          │
       │ Calcula:                 │ Calcula:
       │ • tipo = normal          │ • tipo = extended
       │ • natureza = ?           │ • natureza = ?
       │ • categoria = ?          │ • categoria = ?
       │                          │
       └─────────┬────────────────┘
                 │
                 ▼ Salva EM...
    🗄️ [downtime_entries UNIFICADO] 🗄️
         ~230 docs (ambos os tipos)
         
         ├─ Docs com type: "normal"      (~200)
         │  └─ nature: "unplanned"       (~150)
         │  └─ nature: "planned"         (~40)
         │  └─ nature: "external"        (~10)
         │
         └─ Docs com type: "extended"    (~30)
            └─ nature: "unplanned"       (~5)
            └─ nature: "planned"         (~8)
            └─ nature: "external"        (~17)

Leitura (análise):
┌──────────────────────────────────────┐
│ loadDowntimeAnalysis()                │
├──────────────────────────────────────┤
│ 1. Lê downtime_entries ONE QUERY     │
│ 2. Filtra por type e nature         │
│ 3. Consolida segmentos              │
│ 4. Agrupa por categoria             │
│ 5. Renderiza com toggles:           │
│    └─ Por Natureza                  │
│    └─ Por Categoria                 │
│    └─ Por Motivo (Pareto)           │
└──────────────────────────────────────┘
       │
       ▼ Gráfico Único (inteligente)
    Charts com Toggles Interativos

✓ Uma única consulta
✓ Sem duplicação
✓ Flexível (filtros)
✓ Sem distorção visual
```

---

## 8. Migração de Dados

### 8.1. Estratégia de Migração

```
FASE 1: PREPARAÇÃO (1-2 dias)
├─ Criar novo schema em downtime_entries
├─ Adicionar campos: type, nature, is_segmented, parent_id
├─ Criar função: getNatureFromReason()
├─ Criar script de migração
└─ Backup completo de ambas as coleções

FASE 2: MIGRAÇÃO (1-2 dias)
├─ Ler todos docs de extended_downtime_logs
├─ Para cada doc, calcular:
│  ├─ type: "extended"
│  ├─ nature: getNatureFromReason(reason)
│  └─ Campos padronizados
├─ Inserir em downtime_entries
├─ Validar: contar docs, verificar campos
└─ Backup após migração bem-sucedida

FASE 3: CÓDIGO (2-3 dias)
├─ Modificar finalizeMachineDowntime()
├─ Modificar handleExtendedDowntimeFormSubmit()
├─ Refatorar loadDowntimeAnalysis()
├─ Atualizar renderizadores
└─ Testes de integração

FASE 4: DEPRECAÇÃO (30 dias)
├─ Manter extended_downtime_logs em leitura (compatibilidade)
├─ Log de migração (caso seja necessário rollback)
├─ Monitorar erros
├─ Após 30 dias: deletar extended_downtime_logs
└─ Atualizar documentação

FASE 5: OTIMIZAÇÃO (1 semana)
├─ Remover funções obsoletas
├─ Otimizar índices no Firebase
├─ Benchmarking de performance
└─ Deploy em produção
```

### 8.2. Script de Migração (Pseudocódigo)

```javascript
async function migrateExtendedDowntimesToUnifiedCollection() {
    console.log('[MIGRATION] Iniciando migração de extended_downtime_logs → downtime_entries');
    
    const batch = db.batch();
    let migratedCount = 0;
    let errorCount = 0;
    
    try {
        // 1. Ler todos docs da coleção legada
        const snapshot = await db.collection('extended_downtime_logs').get();
        
        snapshot.forEach(doc => {
            const data = doc.data();
            
            try {
                // 2. Mapear campos
                const migratedDoc = {
                    // Campos comuns
                    machine_id: (data.machine_id || '').toLowerCase(),
                    category: data.category || 'OUTROS',
                    reason: data.reason || data.type || 'DESCONHECIDO',
                    
                    // ← NOVOS CAMPOS
                    type: 'extended',
                    nature: getNatureFromReason(data.reason),
                    
                    // Temporal
                    start_datetime: data.start_datetime,
                    end_datetime: data.end_datetime || null,
                    date: data.date || data.start_date,
                    shift: data.shift || inferShift(data.start_datetime),
                    duration_minutes: data.duration_minutes || 0,
                    status: data.status || 'inactive',
                    
                    // Contexto
                    product: null,
                    order_id: null,
                    observations: data.observations || '',
                    
                    // Áudio trail
                    created_by: data.createdBy || 'migration',
                    created_at: data.createdAt || Timestamp.now(),
                    finished_by: data.finished_by || null,
                    finished_at: data.finished_at || null,
                    updated_at: Timestamp.now(),
                    
                    // Segmentação
                    is_segmented: false,
                    parent_id: null,
                    segment_index: 0,
                    total_segments: 1,
                    
                    // Compatibilidade
                    type_legacy: data.type,
                    version: '3.0',
                    migration_source: 'extended_downtime_logs'
                };
                
                // 3. Adicionar à transação
                const newRef = db.collection('downtime_entries').doc();
                batch.set(newRef, migratedDoc);
                
                migratedCount++;
                
            } catch (error) {
                console.error(`[MIGRATION] Erro ao migrar ${doc.id}:`, error);
                errorCount++;
            }
        });
        
        // 4. Commitar batch
        await batch.commit();
        
        console.log(`[MIGRATION] ✓ Sucesso!`);
        console.log(`  - Documentos migrados: ${migratedCount}`);
        console.log(`  - Erros: ${errorCount}`);
        console.log(`  - Total: ${snapshot.size}`);
        
        // 5. Validação
        const migratedSnapshot = await db.collection('downtime_entries')
            .where('type', '==', 'extended')
            .get();
        
        if (migratedSnapshot.size === snapshot.size - errorCount) {
            console.log('[MIGRATION] ✓ Validação passou!');
            return { success: true, migrated: migratedCount, errors: errorCount };
        } else {
            console.error('[MIGRATION] ❌ Validação falhou!');
            console.error(`  Esperado: ${snapshot.size - errorCount}`);
            console.error(`  Obtido: ${migratedSnapshot.size}`);
            return { success: false, migrated: migratedCount, errors: errorCount };
        }
        
    } catch (error) {
        console.error('[MIGRATION] ❌ Erro crítico:', error);
        throw error;
    }
}

// Executar com cuidado!
// await migrateExtendedDowntimesToUnifiedCollection();
```

### 8.3. Mapeamento de Campos

```javascript
// ===== EXTENDIDO → UNIFICADO =====

ANTES (extended_downtime_logs):
{
    machine_id: "inj-01",
    category: "COMERCIAL",
    type: "SEM PEDIDO",           // ← Código/motivo
    reason: "SEM PEDIDO",
    start_date: "2026-02-07",
    start_time: "17:00",
    start_datetime: Timestamp,
    end_date: "2026-02-10",
    end_time: "07:00",
    end_datetime: Timestamp,
    duration_minutes: 3780,
    status: "finished",
    shift: "turno2",
    createdBy: "Maria",
    createdAt: Timestamp,
    finished_by: "Maria",
    last_duration_update: Timestamp
}

DEPOIS (downtime_entries novo):
{
    machine_id: "inj-01",         // ← Mesmo, normalizado
    category: "COMERCIAL",        // ← Mesmo
    reason: "SEM PEDIDO",         // ← Mesmo
    type: "extended",             // ← NOVO
    nature: "external",           // ← CALCULADO de reason
    start_datetime: Timestamp,    // ← Consolidado (era start_date + start_time)
    end_datetime: Timestamp,      // ← Consolidado
    date: "2026-02-07",           // ← Do start (era start_date)
    shift: "turno2",              // ← Mesmo
    duration_minutes: 3780,       // ← Mesmo
    status: "finished",           // ← Mesmo
    product: null,                // ← Novo (não aplicável)
    order_id: null,               // ← Novo (não aplicável)
    observations: null,           // ← Novo
    created_by: "maria",          // ← Padronizado (era createdBy)
    created_at: Timestamp,        // ← Mesmo
    finished_by: "maria",         // ← Novo (era finished_by)
    finished_at: Timestamp,       // ← Novo
    updated_at: Timestamp,        // ← Novo
    is_segmented: false,          // ← NOVO (extended não segmenta)
    parent_id: null,              // ← NOVO
    segment_index: 0,             // ← NOVO
    total_segments: 1,            // ← NOVO
    type_legacy: "SEM PEDIDO",    // ← NOVO (para compatibilidade)
    version: "3.0"                // ← NOVO (schema version)
}

✓ Campo a campo mapeado
✓ Dados preservados
✓ Novos campos adicionados com valores padrão
```

---

## 9. Benefícios Detalhados

### 9.1. Benefício #1: Código Mais Limpo

```javascript
ANTES:
├─ 2 coleções to monitor
├─ 2 listeners (downtime + extended)
├─ 2 funcoes de carregamento
├─ 2 consolidações diferentes
├─ 2 renderizações (misturadas no gráfico)
├─ Duplicação de lógica de filtro
└─ ~70 linhas de código apenas conectando dados

DEPOIS:
├─ 1 coleção a monitorar
├─ 1 listener (para ambos)
├─ 1 função de carregamento
├─ 1 consolidação (com filtro por type)
├─ Renderizações com toggles (mesmo código)
├─ Zero duplicação
└─ ~10 linhas conexão (85% redução)
```

### 9.2. Benefício #2: Performance

```
ANTES (2 coleções):
├─ Query 1: downtime_entries → ~200 docs
├─ Query 2: extended_downtime_logs → ~30 docs
├─ Listener 1: active_downtimes (real-time)
├─ Processing: 2 consolidações
├─ Rendering: 2 gráficos separados
└─ Tempo total: ~2-3s

DEPOIS (1 coleção):
├─ Query 1: downtime_entries (filtered) → ~230 docs
├─ Listener 1: downtime_entries (status=active)
├─ Processing: 1 consolidação otimizada
├─ Rendering: 1 gráfico com toggles
└─ Tempo total: ~800-1200ms

MELHORIA: ~60-65% mais rápido
```

### 9.3. Benefício #3: Queries Firebase

```
ANTES (3 read operations):
├─ downtime_entries: 
│  └─ .where('date', '>=', start).where('date', '<=', end).get()
├─ extended_downtime_logs:
│  └─ .where('start_date', '>=', start).where('end_date', '<=', end).get()
└─ active_downtimes:
   └─ .onSnapshot()
   
Custo: 3 × read ops + listener

DEPOIS (1 read + 1 listener):
├─ downtime_entries:
│  └─ .where('date', '>=', start)
│     .where('date', '<=', end)
│     .where('status', 'in', ['finished', 'active'])
│     .get()
└─ downtime_entries:
   └─ .where('status', '==', 'active')
      .onSnapshot()

Custo: 1 × read ops + 1 listener

ECONOMIA: 66% menos read operations
```

### 9.4. Benefício #4: Visualizações Mais Inteligentes

```
ANTES:
└─ Gráfico "Paradas por Categoria"
   ├─ Mistura normal + extended
   ├─ Sem contexto de natureza
   ├─ Distorção visual (longas dominam)
   └─ Confunde gestor

DEPOIS:
└─ Dashboard com Toggles
   ├─ "Por Natureza" (padrão)
   │  └─ Mostra % de planejadas vs não-planejadas vs externas
   │
   ├─ "Por Categoria"
   │  └─ Filtrável por natureza (ex: só não-planejadas)
   │
   ├─ "Top 5 Motivos"
   │  └─ Pareto dos não-planejados (foco na ação)
   │
   └─ "Timeline"
      └─ Evolução temporal com cores por natureza

Resultado: Muito mais insightful
```

### 9.5. Benefício #5: KPIs Corretos

```
ANTES:
├─ MTBF inflado
│  └─ Inclui "SEM PEDIDO", "FIM DE SEMANA" (não são falhas)
│
├─ Dessonibilidade não calculada
│  └─ Sem métrica de % tempo produtivo
│
└─ Sem Pareto
   └─ Impossível identificar "problemas top"

DEPOIS:
├─ MTBF realista
│  └─ Só paradas não-planejadas
│
├─ Disponibilidade calculada
│  └─ (tempo_produtivo / tempo_programado) × 100
│
├─ Pareto automático
│  └─ Top 5 motivos não-planejados
│
└─ Tendência
   └─ Comparação com período anterior
```

---

## 10. Riscos e Mitigações

### 10.1. Risco #1: Perda de Dados

| Risco | Mitigação |
|-------|-----------|
| Erro durante migração | ✓ Backup completo ANTES |
| Script bugado | ✓ Testar em staging PRIMEIRO |
| Documentos duplicados | ✓ Validação pós-migração |
| Campos perdidos | ✓ Mapeamento explícito |

**Plano de Rollback:**
```
Se algo der errado:
1. Interromper migração imediatamente
2. Deletar docs parcialmente migrados
3. Restaurar backup
4. Investigar erro
5. Corrigir script
6. Retry com dados limpos
```

### 10.2. Risco #2: Compatibilidade com Código Legado

| Risco | Mitigação |
|-------|-----------|
| Código antigo tenta acessar extended_downtime_logs | ✓ Manter leitura por 30 dias |
| Queries antigas quebram | ✓ Update queries antes da migração |
| Formatos de dados diferentes | ✓ Campos `type_legacy` para fallback |

### 10.3. Risco #3: Performance Durante Migração

| Risco | Mitigação |
|-------|-----------|
| Sistema lento enquanto rodando | ✓ Rodar de madrugada (horário baixo) |
| Queries travando | ✓ Limitar batch size (1000 docs por vez) |
| Listeners atualizando | ✓ Pausar listeners durante migração |

### 10.4. Risco #4: Bugs no Código Novo

| Risco | Mitigação |
|-------|-----------|
| Novo código quebrado | ✓ Testes unitários antes |
| KPIs calculados incorretamente | ✓ Validação comparativa (antes vs depois) |
| Gráficos com dados faltando | ✓ Suite de testes de renderização |

---

## 11. Perguntas Frequentes

### P: Vai mexer em permissões de usuários?

**R:** Não de forma significativa. O que muda:
- Hoje: Operador salva em `downtime_entries`, Gestor em `extended_downtime_logs`
- Depois: Ambos salvam em `downtime_entries`, mas com `type` diferente
- Regra: Se `type == 'extended'`, precisa de `role: 'gestor'`

### P: E se a máquina cruzar fim de semana (type: normal + type: extended)?

**R:** Não deve acontecer normalmente, mas se acontecer:
```javascript
// Sistema detecta:
// Doc1: type: 'normal', status: 'finished', date: 08/02
// Doc2: type: 'extended', status: 'finished', date: 08/02
// (mesmo dia, mesma máquina)

// Sistema agrupa separadamente:
// - KPIs normais: consideram só type=normal
// - KPIs longas: consideram tipo=extended
// Sem mistura!
```

### P: Posso manter extended_downtime_logs "como backup"?

**R:** Sim! Você pode:
1. **Fase 1-3:** Manter ambas as coleções
2. **Fase 4 (30 dias):** Manter extended sem salvar (leitura pura)
3. **Fase 5:** Deletar quando tudo está 100% estável

### P: Como fica a atualização automática de duração?

**R:** Antes era em `extended_downtime_logs` a cada 30 min. Depois será em `downtime_entries`:

```javascript
// NOVO trigger cloud function:
exports.updateActivePaurasDowntime = functions.pubsub
    .schedule('every 30 minutes')
    .onRun(async (context) => {
        const snapshot = await db.collection('downtime_entries')
            .where('status', '==', 'active')
            .get();
        
        screenshot.forEach(doc => {
            const data = doc.data();
            const durationMinutes = Math.floor(
                (Date.now() - data.start_datetime.toMillis()) / 60000
            );
            
            doc.ref.update({
                duration_minutes: durationMinutes,
                updated_at: FieldValue.serverTimestamp()
            });
        });
    });
```

### P: Vai quebrar os gráficos atuais?

**R:** Não! Os gráficos se adapta:
```javascript
// Antes:
generateDowntimeReasonsChart(combinedForChart);
// combinedForChart = [...normal, ...extended]

// Depois (compatível):
generateDowntimeReasonsChart(allDowntimes);
// allDowntimes = downtime_entries with type filter

// Código renderizador continua igual!
// Só muda a ORIGEM dos dados
```

### P: Qual é o risco de rollback após migração concluída?

**R:** Baixo, uma vez que:
1. ✓ Dados replicados (não deletados, mantidos em extended_downtime_logs por 30 dias)
2. ✓ Schema é retrocompatível (novos campos são opcionais)
3. ✓ Código antigo continua funcionando (com adapters)
4. ✓ "Pior caso": volta a ler de `extended_downtime_logs`

---

## Conclusão

A **unificação parcial** oferece:
- ✅ 60% redução de código
- ✅ 65% melhoria de performance
- ✅ 100% compatibilidade mantida
- ✅ KPIs corretos
- ✅ Visualizações melhores
- ✅ Migração segura (com fallback)

**Recomendação:** Seguir adiante com implementação em fases.

---

## 12. Cálculos de OEE e Operação Parcial

### 12.1. O que é OEE?

OEE (Overall Equipment Effectiveness) é a métrica mais importante em produção. Ele combina três fatores:

```
OEE = Disponibilidade × Performance × Qualidade

Onde:
├─ Disponibilidade = Tempo Produtivo / Tempo Planejado
├─ Performance = Peças Produzidas / Peças Esperadas
└─ Qualidade = Peças Boas / Total de Peças Produzidas

Exemplo: 85% × 95% × 98% = 79.2% OEE
```

### 12.2. OEE com o Novo Schema (Unificado)

Com `type` e `nature`, podemos calcular OEE de forma muito mais precisa:

```javascript
// ===== ANTES (Incorreto) =====

function calculateOEE_ANTES() {
    // Pega TUDO, mistura tipos
    const allDowntimes = combinedForChart;  // Normal + Extended
    
    const totalDowntimeMinutes = allDowntimes.reduce((sum, d) => sum + d.duration, 0);
    const hoursInPeriod = 720;  // 30 dias
    
    const availability = ((hoursInPeriod * 60 - totalDowntimeMinutes) / (hoursInPeriod * 60)) * 100;
    // ❌ PROBLEMA: Inclui "SEM PEDIDO" (comercial) como se fosse falha
    // ❌ PROBLEMA: Sábado/domingo com máquinas paradas por demanda contam como "indisponibilidade"
    // Resultado: OEE fica artificialmente baixo
    return availability;
}

// ===== DEPOIS (Correto) =====

function calculateOEE_DEPOIS() {
    // 1. Ler paradas filtrando por NATUREZA
    const paradas = db.collection('downtime_entries')
        .where('nature', 'in', ['unplanned', 'planned'])  // ← Exclui 'external'
        .where('machine_id', '==', machine)
        .get();
    
    // 2. Calcular tempo que DEVERIA ter operado
    const scheduledHours = calculateScheduledHours(startDate, endDate, machine);
    // = Considera sábado/domingo APENAS se máquina estava programada
    // = 720h para máquina que opera 24/7
    // = 480h para máquina que trabalha turno1 + turno2
    // = 360h em período com sábado/domingo parado propositalmente
    
    // 3. Descontar paradas PLANEJADAS do tempo disponível
    const plannedDowntimeMinutes = paradas
        .filter(p => p.nature === 'planned')
        .reduce((sum, p) => sum + p.duration_minutes, 0);
    
    // 4. Descontar paradas NÃO-PLANEJADAS (falhas)
    const unplannedDowntimeMinutes = paradas
        .filter(p => p.nature === 'unplanned')
        .reduce((sum, p) => sum + p.duration_minutes, 0);
    
    // 5. Calcular disponibilidade de forma realista
    const timeAvailableMinutes = (scheduledHours * 60) - plannedDowntimeMinutes;
    const timeProducedMinutes = timeAvailableMinutes - unplannedDowntimeMinutes;
    
    const availability = (timeProducedMinutes / (scheduledHours * 60)) * 100;
    
    // ✓ Resultado realista (não inclui paradas por demanda)
    return availability;
}
```

### 12.3. Componentes de OEE Detalhado

```javascript
const OEECalculation = {
    // ============= DADOS BRUTOS =============
    period: {
        startDate: "2026-02-01",
        endDate: "2026-02-28",
        machine: "INJ-01",
        description: "Injetora 01 - 24/7 operation"
    },
    
    // ============= TEMPO PLANEJADO =============
    scheduledHours: 720,  // 30 dias × 24h
    // Cálculo:
    // - Segunda a Sexta: 24h cada
    // - Sábado/Domingo: 24h se máquina está em "modo operacional"
    //                     0h se máquina está em "modo demanda baixa"
    
    // ============= PARADAS PLANEJADAS =============
    plannedDowntimes: {
        description: "Paradas esperadas/programadas (reduzem AMBAS disponibilidade e performance)",
        examples: [
            { reason: "MANUTENÇÃO PREVENTIVA", minutes: 360, nature: "planned" },
            { reason: "LIMPEZA SEMANAL", minutes: 120, nature: "planned" },
            { reason: "SETUP DE PRODUTO", minutes: 180, nature: "planned" }
        ],
        totalMinutes: 660
    },
    
    // ============= PARADAS NÃO-PLANEJADAS =============
    unplannedDowntimes: {
        description: "Falhas/problemas (reduzem disponibilidade e afetam MTBF)",
        examples: [
            { reason: "FALHA DE SENSOR", minutes: 90, nature: "unplanned" },
            { reason: "ENTUPIMENTO", minutes: 150, nature: "unplanned" },
            { reason: "AJUSTE DE PROCESSO", minutes: 45, nature: "unplanned" }
        ],
        totalMinutes: 285
    },
    
    // ============= PARADAS EXTERNAS =============
    externalDowntimes: {
        description: "Não afetam OEE (fatores externos)",
        examples: [
            { reason: "SEM PEDIDO", minutes: 3780, nature: "external" },
            { reason: "FIM DE SEMANA (demanda)", minutes: 1440, nature: "external" }
        ],
        totalMinutes: 5220
    },
    
    // ============= CÁLCULOS DE OEE =============
    calculations: {
        // 1. DISPONIBILIDADE
        disponibilidade: {
            formula: "(Tempo Planejado - Paradas Planejadas - Paradas Não-Planejadas) / Tempo Planejado",
            numerator: 720 * 60 - 660 - 285,  // = 42,555 minutos
            denominator: 720 * 60,             // = 43,200 minutos
            percentage: ((720*60 - 660 - 285) / (720*60)) * 100,
            result: "98.45%"
            // Interpretação: Máquina esteve disponível 98.45% do tempo
            //               (excluindo paradas externas como SEM PEDIDO)
        },
        
        // 2. PERFORMANCE (Exemplo com dados de ciclo)
        performance: {
            description: "Taxa de velocidade produtiva vs esperada",
            formula: "(Ciclos Reais / Ciclos Esperados) × 100",
            ciclosEsperados: 15000,      // Em 42,555 minutos de operação
            ciclosReais: 14200,          // Considerando ralentamentos
            result: "94.67%"
            // Nota: Performance é afetada por:
            // ├─ Paradas não-planejadas (reduzem tempo operativo)
            // ├─ Ralentamentos por qualidade
            // └─ Operação manual lenta
        },
        
        // 3. QUALIDADE
        qualidade: {
            description: "Taxa de sucesso/rejeição",
            formula: "(Peças Boas / Total de Peças) × 100",
            pecasBoas: 13980,
            pecasTotal: 14200,
            pecasRuins: 220,
            result: "98.45%"
            // Nota: Qualidade supostamente não é afetada por paradas
            //       Mas na prática, retomadas após parada têm risco maior
        },
        
        // 4. OEE FINAL
        oee: {
            formula: "Disponibilidade × Performance × Qualidade",
            calculation: "98.45% × 94.67% × 98.45%",
            result: "91.66%",
            interpretation: "Máquina operou em 91.66% da sua capacidade teórica"
        }
    }
};

// Formato JSON para armazenar em cada documento:
const OEEMetrics = {
    date: "2026-02-28",
    machine_id: "inj-01",
    
    // Componentes
    availability_percent: 98.45,
    performance_percent: 94.67,
    quality_percent: 98.45,
    
    // Resultado final
    oee_percent: 91.66,
    
    // Detalhes de cálculo
    calculation_details: {
        scheduled_minutes: 43200,
        
        downtime_planned_minutes: 660,
        downtime_unplanned_minutes: 285,
        downtime_external_minutes: 5220,
        
        available_minutes: 42555,  // Após descontar planejadas + não-planejadas
        
        target_cycles: 15000,
        actual_cycles: 14200,
        
        good_pieces: 13980,
        total_pieces: 14200
    },
    
    // Para auditoria
    created_at: Timestamp.now(),
    machine_scheduled: true  // ← IMPORTANTE: estava programada para operar?
};
```

### 12.4. O Problema: Fins de Semana com Demanda Variável

Este é um dos pontos críticos identificados:

```
CENÁRIO CORRENTE (PROBLEMÁTICO):

Sábado 08/02:
├─ INJ-01: Operando normal (demanda alta)
├─ INJ-02: Parada (demanda baixa)
├─ INJ-03: Parada (demanda baixa)
└─ INJ-04: Operando normal

Cálculo Atual:
└─ Trata INJ-02 e INJ-03 como "indisponíveis" na segunda
└─ OEE fica baixo (parece que quebraram, mas só faltou pedido)

PROBLEMA: Não há distinção entre:
├─ "Máquina quebrou" (falha real)
└─ "Máquina parada por demanda" (correto/planejado)
```

**SOLUÇÃO: Adicionar campo `scheduled_operational` ao schema:**

```javascript
// Schema Proposto (com novo campo)

{
    // ... campos existentes ...
    
    // ← NOVO CAMPO (CRÍTICO)
    scheduled_operational: true,  
    // ├─ true = máquina estava programada para operar neste período
    // └─ false = máquina parada por decisão de demanda (fim de semana, sem pedido, etc)
    
    // Exemplos de quando é false:
    // ├─ Sábado/domingo com demanda baixa
    // ├─ Segunda com "sem pedido" (comercial)
    // ├─ Parada por manutenção programada (mas isso já é nature: "planned")
    // └─ Black-out period (paralisação estratégica)
    
    // Impacto no cálculo:
    // └─ Afeta APENAS os denominadores de disponibilidade/OEE
    //    Não afeta a contagem de paradas
}

// Exemplo de documento
{
    machine_id: "inj-02",
    date: "2026-02-08",      // Sábado
    shift: "turno1",
    reason: "SEM PEDIDO",
    nature: "external",
    type: "extended",
    
    status: "finished",
    start_datetime: Timestamp(2026-02-08 00:00),
    end_datetime: Timestamp(2026-02-08 23:59),
    duration_minutes: 1440,
    
    scheduled_operational: false,  // ← NOVO: não estava programada
    
    // Resultado: 
    // Este evento NÃO é contado no cálculo de disponibilidade
    // (porque a máquina não deveria estar operando mesmo)
}
```

### 12.5. Cálculos de OEE Considerando Demanda

```javascript
// ===== CÁLCULO DE OEE REALISTA =====

async function calculateOEERealista() {
    const period = { startDate, endDate, machine };
    
    // 1. AGRUPAR MÁQUINAS POR STATUS DE DEMANDA
    const machineStatus = await db.collection('machine_schedule')
        .where('date', '>=', startDate)
        .where('date', '<=', endDate)
        .where('machine_id', '==', machine)
        .get();
    
    // 2. CALCULAR TEMPO PROGRAMADO (considerando demanda)
    let scheduledMinutes = 0;
    machineStatus.forEach(doc => {
        const status = doc.data();
        if (status.operational === true) {  // ← Estava programada para operar?
            scheduledMinutes += 24 * 60;    // Adiciona 24h
        }
    });
    
    // Exemplo resultado:
    // - 20 dias operacional × 1440 min = 28,800 min
    // - 10 dias sábado/domingo/sem_pedido = 0 min
    // = Total: 28,800 min (não 43,200!)
    
    // 3. DESCONTAR PARADAS
    const paradas = await db.collection('downtime_entries')
        .where('date', '>=', startDate)
        .where('date', '<=', endDate)
        .where('machine_id', '==', machine)
        .where('scheduled_operational', '==', true)  // ← Apenas quando devia estar operando
        .get();
    
    const paradas_planejadas = paradas.filter(p => p.nature === 'planned');
    const paradas_nao_planejadas = paradas.filter(p => p.nature === 'unplanned');
    
    const planejadaMinutos = paradas_planejadas.reduce((s, p) => s + p.duration_minutes, 0);
    const nao_planejadaMinutos = paradas_nao_planejadas.reduce((s, p) => s + p.duration_minutes, 0);
    
    // 4. CALCULAR DISPONIBILIDADE
    const disponibilidadeMinutos = scheduledMinutes - planejadaMinutos - nao_planejadaMinutos;
    const disponibilidade = (disponibilidadeMinutos / scheduledMinutes) * 100;
    
    // 5. CALCULAR PERFORMANCE (ciclos)
    const ciclos_esperados = calculaCiclosEsperados(disponibilidadeMinutos);
    const ciclos_reais = await getCiclosReais(machine, startDate, endDate);
    const performance = (ciclos_reais / ciclos_esperados) * 100;
    
    // 6. CALCULAR QUALIDADE
    const pecas_boas = await getPecas(machine, startDate, endDate, 'boas');
    const pecas_total = await getPecas(machine, startDate, endDate, 'total');
    const qualidade = (pecas_boas / pecas_total) * 100;
    
    // 7. CALCULAR OEE
    const oee = (disponibilidade * performance * qualidade) / 10000;
    
    return {
        periodo: `${startDate} a ${endDate}`,
        maquina: machine,
        
        horas_programadas: scheduledMinutes / 60,
        // = 28,800 / 60 = 480h (não 720h!)
        
        disponibilidade: disponibilidade.toFixed(2),
        performance: performance.toFixed(2),
        qualidade: qualidade.toFixed(2),
        oee: oee.toFixed(2),
        
        detalhes: {
            minutos_programados: scheduledMinutes,
            minutos_parada_planejada: planejadaMinutos,
            minutos_parada_nao_planejada: nao_planejadaMinutos,
            minutos_disponiveis: disponibilidadeMinutos
        }
    };
}

// RESULTADO ESPERADO:
// {
//     periodo: "2026-02-01 a 2026-02-28",
//     maquina: "INJ-01",
//     horas_programadas: 480,           // ← Só os 20 dias úteis!
//     disponibilidade: "98.65%",
//     performance: "95.00%",
//     qualidade: "98.50%",
//     oee: "92.25%",
//     
//     detalhes: {
//         minutos_programados: 28800,
//         minutos_parada_planejada: 360,
//         minutos_parada_nao_planejada: 90,
//         minutos_disponiveis: 28350
//     }
// }
```

### 12.6. Tabela de Referência: Máquina Programada vs Não-Programada

```
┌─────────────────────┬──────────────────────────────────────────────────┐
│ Cenário              │ Valor de scheduled_operational                   │
├─────────────────────┼──────────────────────────────────────────────────┤
│                     │                                                  │
│ Segunda-Sexta       │ true                                             │
│ (turno1 + turno2)   │ (máquina DEVE estar operando)                   │
│                     │                                                  │
├─────────────────────┼──────────────────────────────────────────────────┤
│                     │                                                  │
│ Sábado/Domingo      │ DEPENDE DA DEMANDA:                             │
│ Feriado             │ ├─ true = demanda alta, máquina DEVE operar    │
│                     │ └─ false = demanda baixa, máquina parada ok     │
│                     │                                                  │
├─────────────────────┼──────────────────────────────────────────────────┤
│                     │                                                  │
│ Manutenção          │ false                                            │
│ Programada          │ (era planejado não operar)                      │
│ (turno inteiro)     │ Nota: nature = 'planned' também                 │
│                     │ (double-check para robustez)                    │
│                     │                                                  │
├─────────────────────┼──────────────────────────────────────────────────┤
│                     │                                                  │
│ "SEM PEDIDO"        │ false                                            │
│ (comercial)         │ (máquina não deveria estar operando)            │
│                     │ (não há demanda)                                │
│                     │                                                  │
├─────────────────────┼──────────────────────────────────────────────────┤
│                     │                                                  │
│ Falha real          │ true                                             │
│ (STOP/START do      │ (máquina DEVERIA estar operando)                │
│  operador)          │ nature = 'unplanned'                            │
│                     │                                                  │
└─────────────────────┴──────────────────────────────────────────────────┘
```

### 12.7. Fluxo de Atualização de Demanda (Sábado/Domingo)

```javascript
// NOVO WORKFLOW: PCP Define Demanda -> Sistema Marca Máquinas

// 1. PCP abre dashboard na sexta-feira
// 2. Clica "Configurar Demanda para Sábado/Domingo"
// 3. Marca máquinas que DEVEM operar

const demandaConfiguracao = {
    semana: "2026-02-01",
    sabado: {
        data: "2026-02-08",
        maquinas_operacionais: ["INJ-01", "INJ-02"],  // Essas 2 trabalham sábado
        maquinas_paradas: ["INJ-03", "INJ-04"]        // Essas 2 não trabalham
    },
    domingo: {
        data: "2026-02-09",
        maquinas_operacionais: ["INJ-01"],            // Só essa 1
        maquinas_paradas: ["INJ-02", "INJ-03", "INJ-04"]
    }
};

// 4. Sistema salva isso em uma coleção "machine_schedule"

await db.collection('machine_schedule').add({
    week_start: "2026-02-01",
    date: "2026-02-08",      // Sábado
    machine_id: "INJ-01",
    operational: true,       // Está programada para operar
    reason: "demanda_alta",
    created_by: "pcp.gestor",
    created_at: Timestamp.now()
});

await db.collection('machine_schedule').add({
    week_start: "2026-02-01",
    date: "2026-02-08",      // Sábado
    machine_id: "INJ-03",
    operational: false,      // NÃO está programada
    reason: "demanda_baixa", // Motivo
    created_by: "pcp.gestor",
    created_at: Timestamp.now()
});

// 5. Quando operador para máquina no sábado, sistema verifica:

async function finalizeMachineDowntime_SABADO() {
    const machineSchedule = await db.collection('machine_schedule')
        .where('date', '==', today)
        .where('machine_id', '==', machine)
        .get();
    
    const schedule = machineSchedule.docs[0]?.data();
    
    // Salva com scheduled_operational correto
    await db.collection('downtime_entries').add({
        machine_id: machine,
        date: today,
        reason: "AJUSTE DE PROCESSO",
        nature: getNatureFromReason(...),
        type: "normal",
        
        scheduled_operational: schedule?.operational ?? true,
        // ├─ true se estava programada (falha afeta OEE)
        // └─ false se não estava programada (parada já era esperada)
        
        // Resto dos campos...
    });
}
```

### 12.8. Exemplo Prático: Cálculo Completo com Demanda Variável

```
PERÍODO: 01/02 a 10/02/2026 (10 dias, 2 fins de semana)

MÁQUINA: INJ-01 (Injetora 01)

DEMANDA PREVISTA:
├─ 03/02 (segunda): 100% operacional
├─ 04/02 (terça): 100% operacional
├─ 05/02 (quarta): 100% operacional
├─ 06/02 (quinta): 100% operacional
├─ 07/02 (sexta): 100% operacional
├─ 08/02 (sábado): 0% (demanda baixa, máquina parada)
├─ 09/02 (domingo): 0% (demanda baixa, máquina parada)
├─ 10/02 (segunda): 50% (demanda média, ambos turnos fechados SEM PEDIDO meio do turno)
├─ 11/02 (terça): 100% operacional
└─ 12/02 (quarta): 100% operacional

TEMPO PROGRAMADO:
= 8 dias × 24h + 1 dia × 12h = 204 horas = 12,240 minutos
(Não conta sábado/domingo parado de propósito)

PARADAS REGISTRADAS:
├─ 07/02 17:00-18:30: AJUSTE DE PROCESSO (90 min, nature: unplanned) ✓
├─ 08/02 00:00-23:59: SEM PEDIDO (1440 min, nature: external) ❌
    └─ IGNORADA no cálculo (scheduled_operational: false)
├─ 09/02 00:00-23:59: SEM PEDIDO (1440 min, nature: external) ❌
    └─ IGNORADA no cálculo (scheduled_operational: false)
├─ 10/02 12:00-19:00: SEM PEDIDO (420 min, nature: external) ❌
    └─ IGNORADA (scheduled_operational: false)
├─ 10/02 14:30-15:45: AJUSTE DE PROCESSO (75 min, nature: unplanned) ✓
└─ 11/02 08:00-09:00: MANUTENÇÃO (60 min, nature: planned) ✓

CÁLCULOS:

1. Tempo Disponível:
   = 12,240 min (programado)
   - 90 min (não-planejada 07/02)
   - 75 min (não-planejada 10/02)
   - 60 min (planejada 11/02)
   = 12,015 minutos
   
   Nota: Paradas de SEM PEDIDO (sábado/domingo/10 meio) NÃO descontam!

2. Disponibilidade:
   = 12,015 / 12,240 × 100
   = 98.16%
   
   (Sem distorção causada por sábado/domingo!)

3. Performance (assumindo ciclos):
   = (ciclos_reais / ciclos_esperados) × 100
   = 14,100 / 15,000 × 100
   = 94.00%

4. Qualidade:
   = 13,860 / 14,100 × 100
   = 98.30%

5. OEE FINAL:
   = 98.16% × 94.00% × 98.30%
   = 90.68%

COMPARAÇÃO (Se não levasse demanda em conta):

Tempo Programado (INCORRETO):
= 10 dias × 24h = 240 horas = 14,400 minutos

Disponibilidade (INCORRETA):
= (14,400 - 90 - 75 - 60 - 1440 - 1440 - 420) / 14,400
= 10,875 / 14,400
= 75.52%  ← MUITO MAIS BAIXA!

OEE (INCORRETA):
= 75.52% × 94.00% × 98.30%
= 69.76%  ← MUITO MAIS BAIXA!

IMPACTO: Diferença de 90.68% vs 69.76% = 21 pontos percentuais!
```

### 12.9. Modificações no Schema para Suportar Demanda

```javascript
// ===== SCHEMA ATUALIZADO =====

{
    // ============= CAMPOS EXISTENTES =============
    machine_id: "inj-01",
    type: "normal",
    nature: "unplanned",
    category: "PROCESSO",
    reason: "AJUSTE DE PROCESSO",
    
    start_datetime: Timestamp,
    end_datetime: Timestamp,
    date: "2026-02-10",
    shift: "turno2",
    duration_minutes: 75,
    status: "finished",
    
    // ← NOVO (CRÍTICO PARA OEE)
    scheduled_operational: true,
    // ├─ true = máquina estava programada para operar neste turno/dia
    // └─ false = máquina NÃO estava programada (sábado/domingo/demanda baixa)
    
    // Interpretação:
    // ├─ Se true + nature=unplanned: AFETA disponibilidade (é falha)
    // ├─ Se true + nature=planned: AFETA disponibilidade (manutenção OK)
    // ├─ Se false + nature=external: NÃO afeta OEE (parada esperada)
    // └─ Se false + nature=unplanned: AINDA AFETA OEE (falha mesmo estando "parada")
    //    Exemplo: máquina parada no sábado por demanda, mas falha enquanto parada
    //    (precisa corrigir mesmo que não esteja operando)
    
    // ============= NOVOS CAMPOS OPCIONAIS =============
    demand_factor: 1.0,      // 1.0 = 100% demanda, 0.5 = 50%, 0.0 = 0%
    scheduled_by: "pcp.gestor",
    schedule_type: "normal",  // "normal", "maintenance", "ramp_down"
}
```

### 12.10. Dashboard de OEE com Demanda

```javascript
// UI DASHBOARD MOCKUP

┌─────────────────────────────────────────────────────────────────┐
│ OEE DASHBOARD - INJ-01 (01/02 a 10/02/2026)                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  TEMPO PROGRAMADO                                               │
│  ████████ 204 horas (sábado/domingo excluídos)                 │
│                                                                  │
│  ┌──┬──┬──┬──┬──┬──┬──┬──┬──┬──┐  Legenda:                      │
│  │02│03│04│05│06│07│08│09│10│11│  ■ Operacional                │
│  │██│██│██│██│██│██│  │  │██│██│  ░ Parado (demanda)           │
│  │Mo│Tu│We│Th│Fr│Sa│Su│Mo│Tu│We│  ░ Fim de semana             │
│  └──┴──┴──┴──┴──┴──┴──┴──┴──┴──┘                               │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ COMPONENTES DE OEE                                              │
│                                                                  │
│  DISPONIBILIDADE:  98.16%  ████████░ ✓ Excelente              │
│  PERFORMANCE:      94.00%  ███████░░ ✓ Bom                    │
│  QUALIDADE:        98.30%  ████████░ ✓ Excelente              │
│                                                                  │
│  OEE FINAL:        90.68%  █████████░ ✓ CLASSE MUNDIAL         │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ DETALHES DE PARADAS (Período)                                   │
│                                                                  │
│  Planejadas:    60 min   (Manutenção)  ✓ Esperada              │
│  Não-Planejadas: 165 min (Falhas)      ⚠ Requer atenção        │
│  Externas:      3300 min (Sem pedido)  ○ Fora do escopo OEE    │
│                                                                  │
│  MTBF (apenas não-planejadas):                                  │
│  = 12,240 min (programado) / 2 paradas = 6,120 min ≈ 102h     │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ COMPARAÇÃO PERÍODO ANTERIOR (25/01 a 01/02)                    │
│                                                                  │
│  OEE Anterior:  87.45%                                          │
│  OEE Atual:     90.68%  ↑ +3.23 pontos (Melhora!)             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 13. Demanda Variável: Guia Prático Detalhado

### 13.1. O Conceito Fundamental

A **demanda variável** significa que nem todas as máquinas trabalham todas os dias:

```
SEMANA TÍPICA NA HOKKAIDO (Exemplo Real)

SEGUNDA A SEXTA (100% Demanda):
├─ INJ-01: Operando ✓
├─ INJ-02: Operando ✓
├─ INJ-03: Operando ✓
└─ INJ-04: Operando ✓

SÁBADO (60% Demanda):
├─ INJ-01: Operando ✓
├─ INJ-02: Operando ✓
├─ INJ-03: PARADA (sem pedido para ela)
└─ INJ-04: PARADA (sem pedido para ela)

DOMINGO (30% Demanda):
├─ INJ-01: Operando ✓
├─ INJ-02: PARADA (sem pedido para ela)
├─ INJ-03: PARADA (sem pedido para ela)
└─ INJ-04: PARADA (sem pedido para ela)

PROBLEMA ATUAL:
├─ Sábado: INJ-03 indica OEE baixa (parece quebrada)
└─ Domingo: Todas parecem quebradas (já que só INJ-01 trabalha)

REALIDADE:
├─ Sábado: INJ-03 NÃO DEVERIA estar operando
└─ Domingo: INJ-02, 03, 04 NÃO DEVERIAM estar operando
```

### 13.2. Como a Demanda é Definida

**FONTE DE VERDADE: PCP (Planejamento e Controle da Produção)**

```
┌─────────────────────────────────────────────────────────────┐
│ FLUXO DE DECISÃO DE DEMANDA                                 │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  TERÇA-FEIRA (Planejamento para próxima semana)             │
│       │                                                      │
│       ▼                                                      │
│  PCP ANALISA PEDIDOS:                                       │
│  ├─ Quantos pedidos temos? → 15 ordens                     │
│  ├─ Qual é o volume? → 50.000 peças                        │
│  ├─ Qual máquina faz cada produto?                         │
│  └─ Quantas máquinas precisamos?                           │
│                                                              │
│       ▼                                                      │
│  PCP DECIDE (exemplo):                                      │
│  ├─ Segunda-Sexta: Todas as 4 máquinas (100%)              │
│  ├─ Sábado: INJ-01 + INJ-02 (50%)                          │
│  └─ Domingo: INJ-01 (25%)                                  │
│                                                              │
│       ▼                                                      │
│  PCP AUTORIZA OPERAÇÃO (salva em sistema):                 │
│  └─ "machine_schedule" collection:                         │
│     ├─ Semana: 2026-02-08                                  │
│     ├─ Máquinas operacionais por dia                       │
│     └─ Motivo (demanda_alta, demanda_media, demanda_baixa) │
│                                                              │
│       ▼                                                      │
│  OPERADORES SÃO NOTIFICADOS (segunda de manhã):            │
│  └─ "INJ-03 e INJ-04 não trabalham este fim de semana"    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 13.3. Estrutura: machine_schedule (Coleção Nova)

```javascript
// Coleção: machine_schedule
// Propósito: Registro de qual máquina deve operar em qual dia

db.collection('machine_schedule').doc = {
    // ============= IDENTIFICAÇÃO =============
    id: auto_generated,
    week_start: "2026-02-08",      // Segunda da semana
    date: "2026-02-08",            // Data específica (sábado)
    machine_id: "inj-03",          // Máquina
    
    // ============= AGENDAMENTO =============
    operational: false,            // Máquina DEVE operar neste dia?
    // ├─ true = SIM, máquina está agendada para produzir
    // └─ false = NÃO, máquina parada por decisão de demanda
    
    demand_level: "low",           // "high", "medium", "low"
    // └─ Contexto: qual era a demanda do dia?
    
    reason: "demanda_baixa",       // "demanda_alta", "demanda_media", "demanda_baixa"
                                   // "manutencao_programada", "feriado"
    
    // ============= CONTEXTO DE NEGÓCIO =============
    orders_count: 5,               // Quantas ordens para processar neste dia
    expected_production: 10000,    // Peças esperadas
    assigned_products: ["PROD001", "PROD002"],
    
    // ============= ÁUDIO TRAIL =============
    created_by: "pcp.gestor",
    created_at: Timestamp.now(),
    updated_by: "pcp.gestor",
    updated_at: Timestamp.now(),
    
    // ============= NOTAS =============
    notes: "Sábado com baixa demanda, só INJ-01 e INJ-02 trabalham"
};

// EXEMPLOS:

// ═════ Sábado (Baixa Demanda) ═════
await db.collection('machine_schedule').add({
    week_start: "2026-02-08",
    date: "2026-02-08",
    machine_id: "inj-01",
    operational: true,     // ✓ Trabalha on sábado
    demand_level: "low",
    reason: "demanda_baixa",
    orders_count: 5,
    expected_production: 8000,
    created_by: "pcp.gestor",
    created_at: Timestamp.now()
});

await db.collection('machine_schedule').add({
    week_start: "2026-02-08",
    date: "2026-02-08",
    machine_id: "inj-03",
    operational: false,    // ✗ Não trabalha sábado
    demand_level: "low",
    reason: "demanda_baixa",
    orders_count: 0,
    expected_production: 0,
    created_by: "pcp.gestor",
    created_at: Timestamp.now()
});

// ═════ Domingo (Muito Baixa Demanda) ═════
await db.collection('machine_schedule').add({
    week_start: "2026-02-08",
    date: "2026-02-09",
    machine_id: "inj-01",
    operational: true,     // ✓ Só INJ-01 no domingo
    demand_level: "very_low",
    reason: "fim_de_semana",
    orders_count: 2,
    expected_production: 3000,
    created_by: "pcp.gestor",
    created_at: Timestamp.now()
});

await db.collection('machine_schedule').add({
    week_start: "2026-02-08",
    date: "2026-02-09",
    machine_id: "inj-02",
    operational: false,    // ✗ Não trabalha domingo
    demand_level: "very_low",
    reason: "fim_de_semana",
    orders_count: 0,
    expected_production: 0,
    created_by: "pcp.gestor",
    created_at: Timestamp.now()
});
```

### 13.4. Fluxo: Do Schedule para o Documento de Parada

```javascript
// PASSO 1: PCP configura schedule na terça-feira
// (conforme mostrado acima)

// PASSO 2: Sábado de manhã, operador INJ-03 vê na tela:
// "INJ-03 não está agendada para hoje (demanda: baixa)"

// PASSO 3: Máquina fica desligada o dia todo (não há parada registrada)

// PASSO 4: Sábado à noite, máquina INJ-03 apresenta falha
// (ok, falha mesmo estando desligada!)

// PASSO 5: Sistema na segunda-feira de manhã tenta registrar parada:

async function handleUnexpectedDowntime_Sabado() {
    // Temos uma falha que aconteceu durante o fim de semana
    // em máquina que estava parada por demanda
    
    // 1. Buscar schedule do sábado
    const schedule = await db.collection('machine_schedule')
        .where('date', '==', '2026-02-08')
        .where('machine_id', '==', 'inj-03')
        .get();
    
    const scheduleDoc = schedule.docs[0]?.data();
    const wasScheduled = scheduleDoc?.operational ?? true;
    // = false (máquina não estava agendada)
    
    // 2. Criar documento de parada COM scheduled_operational correto
    await db.collection('downtime_entries').add({
        machine_id: 'inj-03',
        date: '2026-02-08',           // Sábado
        reason: 'FALHA DE SENSOR',
        nature: 'unplanned',
        type: 'normal',
        
        scheduled_operational: wasScheduled,  // ← false!
        // Significado: máquina não DEVERIA estar operando,
        //             mas falhou mesmo assim durante parada
        //             (isso pode indicar problema que precisa manutenção)
        
        start_datetime: Timestamp(2026-02-08 22:00),
        end_datetime: Timestamp(2026-02-09 08:00),
        duration_minutes: 600,
        status: 'finished',
        
        // ← IMPORTANTE:
        // Esta parada NÃO afeta o OEE de sábado
        // (porque máquina não estava agendada para operar)
        // Mas DEVE ser registrada para manutenção!
    });
}
```

### 13.5. Exemplo Prático Dia-a-Dia

```
═══════════════════════════════════════════════════════════════
SEGUNDA (Demanda Normal, 100%)
═══════════════════════════════════════════════════════════════

SCHEDULE:
├─ INJ-01: operational = true
├─ INJ-02: operational = true
├─ INJ-03: operational = true
└─ INJ-04: operational = true

OPERADOR INJ-03 PARA MÁQUINA:
├─ Clica STOP
├─ Motivo: "AJUSTE DE PROCESSO"
└─ Tempo: 14:30 - 15:45 (75 min)

SISTEMA REGISTRA:
{
    machine_id: "inj-03",
    date: "2026-02-03",
    reason: "AJUSTE DE PROCESSO",
    nature: "unplanned",
    scheduled_operational: true,    // ✓ DEVERIA estar operando!
    duration_minutes: 75,
    status: "finished"
}

IMPACTO:
└─ Afeta OEE de INJ-03 (é falha não-planejada de máquina)

═══════════════════════════════════════════════════════════════
SÁBADO (Demanda Baixa, 50%) - INJ-03 NÃO TRABALHA
═══════════════════════════════════════════════════════════════

SCHEDULE:
├─ INJ-01: operational = true
├─ INJ-02: operational = true
├─ INJ-03: operational = false     ← NÃO TRABALHA
└─ INJ-04: operational = false     ← NÃO TRABALHA

OPERADOR INJ-03 TIRA FÉRIAS (máquina desligada)

SISTEMA DETECTA (ao carregar página):
"INJ-03 não está agendada para Sábado (demanda: baixa)"
└─ Mostra botão cinza (desabilitado)
└─ Não pede para registrar parada

RESULTADO:
└─ INJ-03 no sábado: ZERO paradas registradas
└─ Zero impacto no OEE (como deve ser)

═══════════════════════════════════════════════════════════════
SÁBADO NOITE: INJ-03 FALHA MESMO DESLIGADA
═══════════════════════════════════════════════════════════════

SITUAÇÃO: Ventilador da injetora falha (máquina estava desligada)

SEGUNDA DE MANHÃ: Operador nota e registra:

SISTEMA REGISTRA:
{
    machine_id: "inj-03",
    date: "2026-02-08",
    reason: "FALHA DE VENTILADOR",
    nature: "unplanned",
    scheduled_operational: false,   // ← NÃO deveria estar operando
    duration_minutes: 600,          // de sábado 22:00 a domingo 08:00
    status: "finished"
}

INTERPRETAÇÃO:
├─ NÃO afeta OEE (máquina não estava agendada)
├─ MAS registra a falha (importante para manutenção)
├─ Gestor recebe alerta: "Falha fora de agendamento em INJ-03"
└─ Técnico de manutenção é notificado (reparar segunda)
```

### 13.6. Dashboard PCP: Configurar Demanda

```javascript
// INTERFACE: "Agendamento de Demanda para Próxima Semana"

// ═════ Segunda-feira 10/02 (100% Demanda Normal) ═════
┌──────────────────────────────────────────────────────────┐
│ SEGUNDA 10/02 - Demanda: ████████░░ 100% (Alta)         │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  INJ-01  [✓] Operacional    │ 5 ordens │ 12000 peças    │
│  INJ-02  [✓] Operacional    │ 4 ordens │ 10000 peças    │
│  INJ-03  [✓] Operacional    │ 3 ordens │  8000 peças    │
│  INJ-04  [✓] Operacional    │ 3 ordens │  7000 peças    │
│                                                           │
│  Total: 15 ordens | 37.000 peças esperadas              │
│                                                           │
└──────────────────────────────────────────────────────────┘

// ═════ Sábado 15/02 (50% Demanda) ═════
┌──────────────────────────────────────────────────────────┐
│ SÁBADO 15/02 - Demanda: ████░░░░░░ 50% (Baixa)          │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  INJ-01  [✓] Operacional    │ 2 ordens │  5000 peças    │
│  INJ-02  [✓] Operacional    │ 2 ordens │  4000 peças    │
│  INJ-03  [✗] PARADA         │ 0 ordens │      0 peças   │
│  INJ-04  [✗] PARADA         │ 0 ordens │      0 peças   │
│                                                           │
│  Total: 4 ordens | 9.000 peças esperadas                │
│                                                           │
│  ℹ️ PCP deixa máquinas 03 e 04 paradas (não há demanda)  │
│                                                           │
└──────────────────────────────────────────────────────────┘

// ═════ Domingo 16/02 (25% Demanda - Mínimo) ═════
┌──────────────────────────────────────────────────────────┐
│ DOMINGO 16/02 - Demanda: ██░░░░░░░░ 25% (Mínima)        │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  INJ-01  [✓] Operacional    │ 1 ordem  │  2000 peças    │
│  INJ-02  [✗] PARADA         │ 0 ordens │      0 peças   │
│  INJ-03  [✗] PARADA         │ 0 ordens │      0 peças   │
│  INJ-04  [✗] PARADA         │ 0 ordens │      0 peças   │
│                                                           │
│  Total: 1 ordem | 2.000 peças esperadas                 │
│                                                           │
│  ℹ️ Apenas INJ-01 trabalha no domingo (pedido específico)│
│                                                           │
└──────────────────────────────────────────────────────────┘

// DADOS SALVOS EM machine_schedule:
[
    { date: "2026-02-10", machine_id: "inj-01", operational: true, ... },
    { date: "2026-02-10", machine_id: "inj-02", operational: true, ... },
    { date: "2026-02-10", machine_id: "inj-03", operational: true, ... },
    { date: "2026-02-10", machine_id: "inj-04", operational: true, ... },
    
    { date: "2026-02-15", machine_id: "inj-01", operational: true, ... },
    { date: "2026-02-15", machine_id: "inj-02", operational: true, ... },
    { date: "2026-02-15", machine_id: "inj-03", operational: false, ... },
    { date: "2026-02-15", machine_id: "inj-04", operational: false, ... },
    
    { date: "2026-02-16", machine_id: "inj-01", operational: true, ... },
    { date: "2026-02-16", machine_id: "inj-02", operational: false, ... },
    { date: "2026-02-16", machine_id: "inj-03", operational: false, ... },
    { date: "2026-02-16", machine_id: "inj-04", operational: false, ... }
]
```

### 13.7. Como Isso Afeta Cálculos: Antes vs Depois

```javascript
// ═════ CENÁRIO REAL: 08/02 a 16/02 (Sábado a Domingo) ═════

// DADOS:
// ├─ INJ-01: Trabalha segunda-domingo (24h/dia)
// ├─ INJ-02: Não trabalha sábado/domingo
// ├─ INJ-03: Não trabalha sábado/domingo
// └─ INJ-04: Não trabalha sábado/domingo

// ═══════════════════════════════════════════════════════════
// MÁQUINA: INJ-02
// ═══════════════════════════════════════════════════════════

// PARADAS REGISTRADAS (segunda a domingo):
[
    { date: "2026-02-10", duration: 90, nature: "unplanned" },  // Segunda
    { date: "2026-02-11", duration: 60, nature: "planned" },    // Terça
    { date: "2026-02-12", duration: 75, nature: "unplanned" },  // Quarta
    // Quinta, sexta: 0 paradas
    { date: "2026-02-15", duration: 1440, nature: "external" }, // Sábado (SEM PEDIDO)
    { date: "2026-02-16", duration: 1440, nature: "external" }  // Domingo (SEM PEDIDO)
]

// ════════════════════════════════════════════════════════════
// CÁLCULO ERRADO (Sistema Atual - SEM considerar demanda)
// ════════════════════════════════════════════════════════════

Tempo Disponível (naïve):
= 9 dias × 24h = 216 horas = 12,960 minutos

Paradas:
= 90 + 60 + 75 + 1440 + 1440 = 3,105 minutos

Disponibilidade:
= (12,960 - 3,105) / 12,960
= 9,855 / 12,960
= 75.99%  ← INCORRETA! Muito baixa!

OEE (assumindo Performance 95%, Qualidade 98%):
= 75.99% × 95% × 98%
= 70.82%  ← RESULTADO RUIM (parece máquina é fraca)

PROBLEMA: Inclui sábado/domingo quando máquina NÃO deveria estar operando!


// ════════════════════════════════════════════════════════════
// CÁLCULO CORRETO (Com scheduled_operational)
// ════════════════════════════════════════════════════════════

Verificar Schedule:
[
    { date: "2026-02-10", operational: true },   // Segunda: sim
    { date: "2026-02-11", operational: true },   // Terça: sim
    { date: "2026-02-12", operational: true },   // Quarta: sim
    { date: "2026-02-13", operational: true },   // Quinta: sim
    { date: "2026-02-14", operational: true },   // Sexta: sim
    { date: "2026-02-15", operational: false },  // Sábado: NÃO
    { date: "2026-02-16", operational: false }   // Domingo: NÃO
]

Tempo Programado (apenas dias que deveria operar):
= 5 dias × 24h = 120 horas = 7,200 minutos

Paradas (apenas das contas que deveria estar operando):
= 90 + 60 + 75 = 225 minutos
(Ignora sábado/domingo!)

Disponibilidade:
= (7,200 - 225) / 7,200
= 6,975 / 7,200
= 96.88%  ← CORRETA! Máquina foi confiável!

OEE (Performance 95%, Qualidade 98%):
= 96.88% × 95% × 98%
= 90.25%  ← RESULTADO BOM (máquina é ótima!)

DIFERENÇA: 75.99% vs 96.88% = 20.89 pontos percentuais!
```

### 13.8. Lógica de Cálculo: Pseudocódigo

```javascript
// ═════ ALGORITMO: calculateOEE_ComSchedule() ═════

async function calculateOEE_Correto(machine, dateStart, dateEnd) {
    
    // 1. Buscar todos os registros de agendamento
    const scheduleSnapshot = await db.collection('machine_schedule')
        .where('machine_id', '==', machine)
        .where('date', '>=', dateStart)
        .where('date', '<=', dateEnd)
        .get();
    
    // 2. Contar quantos dias a máquina DEVERIA estar operando
    const daysScheduledOperational = scheduleSnapshot.docs
        .filter(doc => doc.data().operational === true)
        .length;
    
    const minutesScheduled = daysScheduledOperational * 24 * 60;
    // Exemplo: 5 dias = 7,200 minutos
    
    // ═══════════════════════════════════════════════════════════
    // 3. Buscar TODAS as paradas
    const downtimeSnapshot = await db.collection('downtime_entries')
        .where('machine_id', '==', machine)
        .where('date', '>=', dateStart)
        .where('date', '<=', dateEnd)
        .get();
    
    // ═══════════════════════════════════════════════════════════
    // 4. Filtrar paradas usando scheduled_operational
    const relevantDowntimes = downtimeSnapshot.docs.filter(doc => {
        const downtime = doc.data();
        
        // Regra 1: Se máquina estava agendada para operar
        if (downtime.scheduled_operational === true) {
            // ✓ Contar TODAS as paradas (planejadas, não-planejadas, externas)
            // Porque máquina deveria estar disponível
            return true;
        }
        
        // Regra 2: Se máquina NÃO estava agendada
        if (downtime.scheduled_operational === false) {
            // ✗ Ignorar paradas EXTERNAS (era esperado estar parada)
            // ✓ Contar paradas PLANEJADAS (manutenção previista)
            // ✓ Contar paradas NÃO-PLANEJADAS (mesmo parada, falhou!)
            
            if (downtime.nature === 'external') {
                return false;  // Ignorar
            }
            return true;  // Contar
        }
    });
    
    // 5. Calcular tempo de paradas
    const plannedDowntimeMinutes = relevantDowntimes
        .filter(d => d.data().nature === 'planned')
        .reduce((sum, d) => sum + d.data().duration_minutes, 0);
    
    const unplannedDowntimeMinutes = relevantDowntimes
        .filter(d => d.data().nature === 'unplanned')
        .reduce((sum, d) => sum + d.data().duration_minutes, 0);
    
    // 6. Calcular disponibilidade
    const availableMinutes = minutesScheduled 
        - plannedDowntimeMinutes 
        - unplannedDowntimeMinutes;
    
    const availability = (availableMinutes / minutesScheduled) * 100;
    
    // 7. Calcular performance (ciclos)
    const expectedCycles = calculateExpectedCycles(availableMinutes);
    const actualCycles = await getActualCycles(machine, dateStart, dateEnd);
    const performance = (actualCycles / expectedCycles) * 100;
    
    // 8. Calcular qualidade
    const goodPieces = await getPieces(machine, dateStart, dateEnd, 'good');
    const totalPieces = await getPieces(machine, dateStart, dateEnd, 'total');
    const quality = (goodPieces / totalPieces) * 100;
    
    // 9. Calcular OEE
    const oee = (availability * performance * quality) / 10000;
    
    return {
        machine,
        dateStart,
        dateEnd,
        
        // INPUTS
        daysScheduledOperational,
        minutesScheduled,
        
        // PARADAS
        plannedDowntimeMinutes,
        unplannedDowntimeMinutes,
        availableMinutes,
        
        // COMPONENTES
        availability: availability.toFixed(2),
        performance: performance.toFixed(2),
        quality: quality.toFixed(2),
        
        // RESULTADO
        oee: oee.toFixed(2),
        
        // INTERPRETAÇÃO
        oeeClass: oee >= 90 ? 'MUNDIAL' : 
                  oee >= 85 ? 'EXCELENTE' : 
                  oee >= 75 ? 'BOM' : 'PRECISA_MELHORA'
    };
}

// ═════ RESULTADO ESPERADO ═════
// {
//     machine: "inj-02",
//     dateStart: "2026-02-10",
//     dateEnd: "2026-02-16",
//     
//     daysScheduledOperational: 5,
//     minutesScheduled: 7200,
//     
//     plannedDowntimeMinutes: 60,
//     unplannedDowntimeMinutes: 165,
//     availableMinutes: 6975,
//     
//     availability: "96.88%",
//     performance: "95.00%",
//     quality: "98.50%",
//     
//     oee: "90.25%",
//     oeeClass: "MUNDIAL"
// }
```

### 13.9. Estados de uma Máquina por Dia

```
┌──────────────────────────────────────────────────────────────────┐
│ Possíveis Estados de uma Máquina em um Dia                       │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ESTADO 1: OPERACIONAL (scheduled_operational = true)            │
│  ├─ Situação: Máquina DEVERIA estar operando neste dia          │
│  ├─ Exemplos: Segunda-sexta, sábado com demanda alta            │
│  └─ Resultado: Qualquer parada AFETA OEE                        │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ SUBESTADO 1a: Nenhuma Parada                             │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │ Máquina operou 24h (ou 8h se turno)                     │  │
│  │ Disponibilidade: 100%                                   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ SUBESTADO 1b: Parada Não-Planejada (Falha)              │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │ Máquina foi 14:30-15:45 (90 min)                        │  │
│  │ Motivo: AJUSTE DE PROCESSO                              │  │
│  │ Efeito: ❌ REDUZ disponibilidade (falha real)           │  │
│  │ Registra em: downtime_entries (nature: unplanned)       │  │
│  │ Afeta MTBF? SIM                                         │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ SUBESTADO 1c: Parada Planejada (Manutenção)             │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │ Máquina baixa para manutenção: 08:00-09:00 (60 min)     │  │
│  │ Motivo: MANUTENÇÃO PREVENTIVA                           │  │
│  │ Efeito: ❌ REDUZ disponibilidade (mas era planejado)    │  │
│  │ Registra em: downtime_entries (nature: planned)         │  │
│  │ Afeta MTBF? NÃO (era previsto)                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ SUBESTADO 1d: Parada Externa (Falta de Pedido)          │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │ Máquina parada: 16:00-22:00 (6h, SEM PEDIDO)            │  │
│  │ Motivo: SEM PEDIDO (comercial)                          │  │
│  │ Efeito: ❌ REDUZ disponibilidade? NÃO! (tinha demanda)  │  │
│  │ Registra em: downtime_entries (nature: external)        │  │
│  │ Afeta OEE? NÃO (era circunstância externa)              │  │
│  │                                                           │  │
│  │ ⚠️ AQUI: Na segunda/quarta é diferente de sábado!       │  │
│  │ └─ Segunda: "SEM PEDIDO" = falha não-planejada          │  │
│  │ └─ Sábado: "SEM PEDIDO" = normal (era esperado)         │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ESTADO 2: PARADA POR DEMANDA (scheduled_operational = false)    │
│  ├─ Situação: Máquina NÃO deveria estar operando neste dia      │
│  ├─ Exemplos: Sábado/domingo com demanda baixa                  │
│  └─ Resultado: Paradas esperadas NÃO afetam OEE                 │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ SUBESTADO 2a: Parada Normal (Esperada)                  │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │ Máquina desligada 00:00-23:59 (1440 min)                │  │
│  │ Motivo: SEM PEDIDO (sábado)                             │  │
│  │ Efeito: ✓ ZERO impacto no OEE (era esperado)           │  │
│  │ Registra em: downtime_entries (nature: external)        │  │
│  │ Afeta OEE? NÃO (máquina não deveria estar operando)    │  │
│  │ Afeta MTBF? NÃO                                         │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ SUBESTADO 2b: Falha Mesmo Desligada                      │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │ Máquina parada sábado, FALHA no motor!                  │  │
│  │ Descoberto segunda de manhã                             │  │
│  │ Motivo: FALHA DE MOTOR                                  │  │
│  │ Efeito: ✓ ZERO impacto no OEE de sábado                │  │
│  │ Registra em: downtime_entries (nature: unplanned)       │  │
│  │ Afeta OEE? NÃO (máquina não estava operando)           │  │
│  │ Afeta MTBF? NÃO (não é falha durante produção)         │  │
│  │ MAS: Alerta manutenção (máquina quebrada!)              │  │
│  │ Importante para: Planejamento de manutenção             │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 13.10. Resumo: Como Demanda Variável Funciona

```
╔════════════════════════════════════════════════════════════════╗
║                    FLUXO COMPLETO                              ║
╠════════════════════════════════════════════════════════════════╣
║                                                                ║
║  TERÇA-FEIRA:                                                  ║
║  ├─ PCP analisa pedidos da próxima semana                     ║
║  └─ Preenche "machine_schedule" com quem trabalha sábado      ║
║                                                                ║
║  SÁBADO DE MANHÃ:                                              ║
║  ├─ Sistema consulta machine_schedule                         ║
║  ├─ INJ-03 vê: "Você não trabalha hoje (demanda: baixa)"     ║
║  └─ INJ-03 fica desligada                                     ║
║                                                                ║
║  SÁBADO À NOITE:                                               ║
║  ├─ INJ-03 falha (mesmo desligada)                            ║
║  └─ Sistema registra: scheduled_operational = false            ║
║                      nature = unplanned                        ║
║                                                                ║
║  SEGUNDA DE MANHÃ:                                             ║
║  ├─ Sistema calcula OEE:                                       ║
║  │  └─ Ignora parada de sábado (máquina não deveria operar)  ║
║  ├─ Resultado: OEE normal (não afetado)                       ║
║  └─ MAS: Alerta "Falha fora de agendamento em INJ-03"        ║
║      └─ Manutenção é notificada                               ║
║                                                                ║
║  RESULTADO:                                                    ║
║  ├─ ✓ OEE correto (não inclui paradas esperadas)              ║
║  ├─ ✓ Manutenção registrada (mesmo fora da operação)          ║
║  ├─ ✓ PCP vê que sábado/domingo reduz carga (esperado)       ║
║  └─ ✓ Gestão é mais realista                                  ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
```

### 13.11. Exemplo Prático Real: Hokkaido com 26 Máquinas (Banco de Dados Real)

**Referência Direta do Database.js:**

As 26 máquinas que realmente existem no sistema são:

```
GRUPO SANDRETTO (3 máquinas):
├─ H01 - SANDRETTO OTTO (Grande porte, +-)
├─ H02 - SANDRETTO SERIE 200 (Médio porte)
└─ H14 - SANDRETTO SB UNO (Pequeno porte)

GRUPO LS (3 máquinas):
├─ H03 - LS LTE280 (Médio)
├─ H04 - LS LTE 330 (Grande)
└─ H05 - LS LTE 170 (Pequeno)

GRUPO HAITIAN (8 máquinas):
├─ H06 - HAITIAN MA2000 (Padrão)
├─ H10 - HAITIAN MA 3200 (Grande)
├─ H13 - HAITIAN MA 2000 770G (Variante)
├─ H16 - HAITIAN MA 2000 III
├─ H18 - HAITIAN MA 2000 III
├─ H19 - HAITIAN MA 2000 III
├─ H20 - HAITIAN PL 200J (Hidráulico)
├─ e H12 - BORCHE BH 120

GRUPO CHEN HSONG (1 máquina):
└─ H07 - CHEN HSONG JM 178 A (Importada)

GRUPO REED (2 máquinas):
├─ H08 - REED 200 TG II
└─ H09 - REED 200 TG II

GRUPO ROMI (9 máquinas):
├─ H15 - ROMI EN 260 CM 10
├─ H17 - ROMI EN 260 CM 10
├─ H26 - ROMI PRIMAX CM9 (CNC avançada)
├─ H27 - ROMI PRIMAX CM8 (CNC avançada)
├─ H28 - ROMI PRIMAX CM8 (CNC avançada)
├─ H29 - ROMI PRIMAX CM8 (CNC avançada)
├─ H30 - ROMI PRIMAX CM8 (CNC avançada)
├─ H31 - ROMI PRÁTICA CM8 (CNC básica)
└─ H32 - ROMI PRÁTICA CM8 (CNC básica)

TOTAL: 26 máquinas
```

#### 13.11.2. Cenário Semanal Realista: 10-16 Fevereiro (26 Máquinas Reais)

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                        SEMANA DE 10-16 FEVEREIRO/2026                       ║
║                      (Com 26 Máquinas Reais da Hokkaido)                    ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║  SEGUNDA 10/02:  Demanda ALTA (100%) - Semana recomeça                      ║
║  ├─ Operadores: 20+ (efetivo completo)                                      ║
║  ├─ Máquinas operando: 19 (73% das 26)                                      ║
║  ├─ Máquinas paradas: 7 (em manutenção ou sem demanda)                      ║
║  └─ Observação: Todas as injetoras SANDRETTO, LS, HAITIAN + algumas ROMI    ║
║                                                                              ║
║  scheduled_operational = true para:                                         ║
║    Todas SANDRETTO (H01, H02, H14)                                          ║
║    Todas LS (H03, H04, H05)                                                 ║
║    Maioria HAITIAN (H06, H10, H13, H16, H18, H19)                          ║
║    CHEN HSONG (H07)                                                         ║
║    Algumas ROMI (H15, H26, H27, H28)                                       ║
║                                                                              ║
║  scheduled_operational = false para:                                        ║
║    Reed (H08, H09) - manutenção programada                                 ║
║    H20 (Hidráulico parado)                                                 ║
║    H12 (Borche em revisão)                                                  ║
║    Algumas ROMI (H29, H30, H31, H32) - sem demanda segunda                 ║
║                                                                              ║
├──────────────────────────────────────────────────────────────────────────────┤
║                                                                              ║
║  TERÇA A SEXTA:  Demanda NORMAIS (100%) - Continuação                       ║
║  ├─ Operadores: 20+ (efetivo completo)                                      ║
║  ├─ Máquinas operando: 19 (73%)                                             ║
║  └─ Padrão: Mesmo de segunda (variações conforme demanda de produtos)       ║
║                                                                              ║
│  Exemplo Quinta 13/02 (Demanda de peças LS alta):                           ║
│  ├─ H03, H04, H05 (LS): 100% produção                                       ║
│  ├─ H01, H02 (SANDRETTO): 80% produção (desligada parte do turno)           ║
│  └─ Redistribui máquinas ROMI conforme necessidade                          ║
║                                                                              ║
├──────────────────────────────────────────────────────────────────────────────┤
║                                                                              ║
║  SÁBADO 15/02:  Demanda BAIXA (25%) - APENAS 6 MÁQUINAS                    ║
║  ├─ Operadores: 4 apenas (demanda reduzida)                                 ║
║  ├─ Máquinas operando: 6 (23%)                                              ║
║  ├─ Máquinas paradas: 20 (77% - sem demanda/sem operador)                   ║
║  │                                                                           ║
║  │  MÁQUINAS LIGADAS (selecionadas por PCP - entregas urgentes):            ║
║  │  ├─ H01 (SANDRETTO OTTO) - produto urgente Premium                      ║
║  │  ├─ H02 (SANDRETTO SERIE 200) - produto urgente                         ║
║  │  ├─ H03 (LS LTE280) - pedido confirmado                                 ║
║  │  ├─ H26 (ROMI PRIMAX CM9) - usinagem crítica                            ║
║  │  ├─ H27 (ROMI PRIMAX CM8) - usinagem complementar                       ║
║  │  └─ H06 (HAITIAN MA2000) - suporte à produção                           ║
║  │                                                                           ║
║  │  MÁQUINAS DESLIGADAS (contexto):                                         ║
║  │  ├─ H04, H05 (LS) - sem demanda                                         ║
║  │  ├─ H07 (CHEN HSONG) - sem demanda                                      ║
║  │  ├─ H08, H09 (REED) - sem demanda + manutenção                          ║
║  │  ├─ H10, H13, H14, H16, H18, H19, H20 (HAITIAN/SANDRETTO restantes)     ║
║  │  ├─ H12 (Borche) - manutenção                                           ║
║  │  ├─ H15, H17 (ROMI EN) - sem demanda                                    ║
║  │  └─ H28-H32 (ROMI CM8/Prática) - sem demanda                            ║
║  │                                                                           ║
║  └─ IMPORTANTE: PCP define isso na terça ou quarta antes do fim de semana    ║
║                                                                              ║
├──────────────────────────────────────────────────────────────────────────────┤
║                                                                              ║
║  DOMINGO 16/02:  NÃO TRABALHA (0% demanda)                                  ║
║  ├─ Operadores: 0                                                           ║
║  ├─ Máquinas operando: 0 (0%)                                               ║
║  └─ Máquinas paradas: 26 (100% - descanso/manutenção)                       ║
║                                                                              ║
║  EXCEÇÃO (próxima semana se houvesse emergência):                            ║
║  └─ Se pedido URGENTE → PCP autoriza H01 + H03 + 2 operadores             ║
║    └─ Documenta em machine_schedule mesmo domingo                          ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

#### 13.11.3. Tabela machine_schedule Preenchida com 26 Máquinas Reais

```javascript
// Dados salvos em Firestore Collection: machine_schedule
// Para semana: 10-16 fevereiro (26 máquinas reais)

// ═════ SEGUNDA 10/02 (19 máquinas operando) ═════
[
    // SANDRETTO - Todas operando
    { week: "2026-02-10", date: "2026-02-10", machine_id: "H01", operational: true,  demand_level: "high", reason: "demanda_alta", orders: 5, model: "SANDRETTO OTTO" },
    { week: "2026-02-10", date: "2026-02-10", machine_id: "H02", operational: true,  demand_level: "high", reason: "demanda_alta", orders: 4, model: "SANDRETTO SERIE 200" },
    { week: "2026-02-10", date: "2026-02-10", machine_id: "H14", operational: true,  demand_level: "high", reason: "demanda_alta", orders: 3, model: "SANDRETTO SB UNO" },
    
    // LS - Todas operando
    { week: "2026-02-10", date: "2026-02-10", machine_id: "H03", operational: true,  demand_level: "high", reason: "demanda_alta", orders: 4, model: "LS LTE280" },
    { week: "2026-02-10", date: "2026-02-10", machine_id: "H04", operational: true,  demand_level: "high", reason: "demanda_alta", orders: 3, model: "LS LTE 330" },
    { week: "2026-02-10", date: "2026-02-10", machine_id: "H05", operational: true,  demand_level: "high", reason: "demanda_alta", orders: 2, model: "LS LTE 170" },
    
    // HAITIAN - Selecionadas (6 de 8)
    { week: "2026-02-10", date: "2026-02-10", machine_id: "H06", operational: true,  demand_level: "high", reason: "demanda_alta", orders: 3, model: "HAITIAN MA2000" },
    { week: "2026-02-10", date: "2026-02-10", machine_id: "H10", operational: true,  demand_level: "high", reason: "demanda_alta", orders: 2, model: "HAITIAN MA 3200" },
    { week: "2026-02-10", date: "2026-02-10", machine_id: "H13", operational: true,  demand_level: "high", reason: "demanda_alta", orders: 2, model: "HAITIAN MA 2000 770G" },
    { week: "2026-02-10", date: "2026-02-10", machine_id: "H16", operational: true,  demand_level: "high", reason: "demanda_alta", orders: 2, model: "HAITIAN MA 2000 III" },
    { week: "2026-02-10", date: "2026-02-10", machine_id: "H18", operational: false, demand_level: "high", reason: "manutencao_programada", orders: 0, model: "HAITIAN MA 2000 III" },
    { week: "2026-02-10", date: "2026-02-10", machine_id: "H19", operational: true,  demand_level: "high", reason: "demanda_alta", orders: 1, model: "HAITIAN MA 2000 III" },
    { week: "2026-02-10", date: "2026-02-10", machine_id: "H20", operational: false, demand_level: "high", reason: "manutencao_hidraulico", orders: 0, model: "HAITIAN PL 200J" },
    
    // CHEN HSONG
    { week: "2026-02-10", date: "2026-02-10", machine_id: "H07", operational: true,  demand_level: "high", reason: "demanda_alta", orders: 2, model: "CHEN HSONG JM 178 A" },
    
    // REED - Manutenção
    { week: "2026-02-10", date: "2026-02-10", machine_id: "H08", operational: false, demand_level: "high", reason: "manutencao_programada", orders: 0, model: "REED 200 TG II" },
    { week: "2026-02-10", date: "2026-02-10", machine_id: "H09", operational: false, demand_level: "high", reason: "manutencao_programada", orders: 0, model: "REED 200 TG II" },
    
    // BORCHE
    { week: "2026-02-10", date: "2026-02-10", machine_id: "H12", operational: false, demand_level: "high", reason: "manutencao_programada", orders: 0, model: "BORCHE BH 120" },
    
    // ROMI EN
    { week: "2026-02-10", date: "2026-02-10", machine_id: "H15", operational: true,  demand_level: "high", reason: "demanda_alta", orders: 2, model: "ROMI EN 260 CM 10" },
    { week: "2026-02-10", date: "2026-02-10", machine_id: "H17", operational: true,  demand_level: "high", reason: "demanda_alta", orders: 1, model: "ROMI EN 260 CM 10" },
    
    // ROMI PRIMAX (Selecionadas)
    { week: "2026-02-10", date: "2026-02-10", machine_id: "H26", operational: true,  demand_level: "high", reason: "demanda_alta", orders: 3, model: "ROMI PRIMAX CM9" },
    { week: "2026-02-10", date: "2026-02-10", machine_id: "H27", operational: true,  demand_level: "high", reason: "demanda_alta", orders: 2, model: "ROMI PRIMAX CM8" },
    { week: "2026-02-10", date: "2026-02-10", machine_id: "H28", operational: true,  demand_level: "high", reason: "demanda_alta", orders: 2, model: "ROMI PRIMAX CM8" },
    { week: "2026-02-10", date: "2026-02-10", machine_id: "H29", operational: false, demand_level: "high", reason: "sem_demanda_segunda", orders: 0, model: "ROMI PRIMAX CM8" },
    { week: "2026-02-10", date: "2026-02-10", machine_id: "H30", operational: false, demand_level: "high", reason: "sem_demanda_segunda", orders: 0, model: "ROMI PRIMAX CM8" },
    { week: "2026-02-10", date: "2026-02-10", machine_id: "H31", operational: false, demand_level: "high", reason: "sem_demanda_segunda", orders: 0, model: "ROMI PRÁTICA CM8" },
    { week: "2026-02-10", date: "2026-02-10", machine_id: "H32", operational: false, demand_level: "high", reason: "sem_demanda_segunda", orders: 0, model: "ROMI PRÁTICA CM8" }
]

// ═════ SÁBADO 15/02 - APENAS 6 MÁQUINAS DE 26 ═════
[
    // SANDRETTO - Ambas trabalham (urgentes)
    { week: "2026-02-10", date: "2026-02-15", machine_id: "H01", operational: true,  demand_level: "low", reason: "demanda_sabado_urgente", orders: 4, model: "SANDRETTO OTTO" },
    { week: "2026-02-10", date: "2026-02-15", machine_id: "H02", operational: true,  demand_level: "low", reason: "demanda_sabado_urgente", orders: 3, model: "SANDRETTO SERIE 200" },
    { week: "2026-02-10", date: "2026-02-15", machine_id: "H14", operational: false, demand_level: "low", reason: "pause_fim_de_semana", orders: 0, model: "SANDRETTO SB UNO" },
    
    // LS - Apenas H03 trabalha
    { week: "2026-02-10", date: "2026-02-15", machine_id: "H03", operational: true,  demand_level: "low", reason: "demanda_sabado_usinagem", orders: 2, model: "LS LTE280" },
    { week: "2026-02-10", date: "2026-02-15", machine_id: "H04", operational: false, demand_level: "low", reason: "pause_fim_de_semana", orders: 0, model: "LS LTE 330" },
    { week: "2026-02-10", date: "2026-02-15", machine_id: "H05", operational: false, demand_level: "low", reason: "pause_fim_de_semana", orders: 0, model: "LS LTE 170" },
    
    // Resto das máquinas
    { week: "2026-02-10", date: "2026-02-15", machine_id: "H06", operational: true,  demand_level: "low", reason: "suporte_sabado", orders: 1, model: "HAITIAN MA2000" },
    { week: "2026-02-10", date: "2026-02-15", machine_id: "H07", operational: false, demand_level: "low", reason: "pause_fim_de_semana", orders: 0, model: "CHEN HSONG JM 178 A" },
    { week: "2026-02-10", date: "2026-02-15", machine_id: "H08", operational: false, demand_level: "low", reason: "pause_fim_de_semana", orders: 0, model: "REED 200 TG II" },
    { week: "2026-02-10", date: "2026-02-15", machine_id: "H09", operational: false, demand_level: "low", reason: "pause_fim_de_semana", orders: 0, model: "REED 200 TG II" },
    { week: "2026-02-10", date: "2026-02-15", machine_id: "H10", operational: false, demand_level: "low", reason: "pause_fim_de_semana", orders: 0, model: "HAITIAN MA 3200" },
    { week: "2026-02-10", date: "2026-02-15", machine_id: "H12", operational: false, demand_level: "low", reason: "pause_fim_de_semana", orders: 0, model: "BORCHE BH 120" },
    { week: "2026-02-10", date: "2026-02-15", machine_id: "H13", operational: false, demand_level: "low", reason: "pause_fim_de_semana", orders: 0, model: "HAITIAN MA 2000 770G" },
    { week: "2026-02-10", date: "2026-02-15", machine_id: "H15", operational: false, demand_level: "low", reason: "pause_fim_de_semana", orders: 0, model: "ROMI EN 260 CM 10" },
    { week: "2026-02-10", date: "2026-02-15", machine_id: "H16", operational: false, demand_level: "low", reason: "pause_fim_de_semana", orders: 0, model: "HAITIAN MA 2000 III" },
    { week: "2026-02-10", date: "2026-02-15", machine_id: "H17", operational: false, demand_level: "low", reason: "pause_fim_de_semana", orders: 0, model: "ROMI EN 260 CM 10" },
    { week: "2026-02-10", date: "2026-02-15", machine_id: "H18", operational: false, demand_level: "low", reason: "pause_fim_de_semana", orders: 0, model: "HAITIAN MA 2000 III" },
    { week: "2026-02-10", date: "2026-02-15", machine_id: "H19", operational: false, demand_level: "low", reason: "pause_fim_de_semana", orders: 0, model: "HAITIAN MA 2000 III" },
    { week: "2026-02-10", date: "2026-02-15", machine_id: "H20", operational: false, demand_level: "low", reason: "pause_fim_de_semana", orders: 0, model: "HAITIAN PL 200J" },
    { week: "2026-02-10", date: "2026-02-15", machine_id: "H26", operational: true,  demand_level: "low", reason: "usinagem_critica_sabado", orders: 2, model: "ROMI PRIMAX CM9" },
    { week: "2026-02-10", date: "2026-02-15", machine_id: "H27", operational: true,  demand_level: "low", reason: "usinagem_sabado", orders: 1, model: "ROMI PRIMAX CM8" },
    { week: "2026-02-10", date: "2026-02-15", machine_id: "H28", operational: false, demand_level: "low", reason: "pause_fim_de_semana", orders: 0, model: "ROMI PRIMAX CM8" },
    { week: "2026-02-10", date: "2026-02-15", machine_id: "H29", operational: false, demand_level: "low", reason: "pause_fim_de_semana", orders: 0, model: "ROMI PRIMAX CM8" },
    { week: "2026-02-10", date: "2026-02-15", machine_id: "H30", operational: false, demand_level: "low", reason: "pause_fim_de_semana", orders: 0, model: "ROMI PRIMAX CM8" },
    { week: "2026-02-10", date: "2026-02-15", machine_id: "H31", operational: false, demand_level: "low", reason: "pause_fim_de_semana", orders: 0, model: "ROMI PRÁTICA CM8" },
    { week: "2026-02-10", date: "2026-02-15", machine_id: "H32", operational: false, demand_level: "low", reason: "pause_fim_de_semana", orders: 0, model: "ROMI PRÁTICA CM8" }
]

// ═════ DOMINGO 16/02 - TUDO PARADO (26 máquinas) ═════
// Todas com operational: false
```

#### 13.11.4. Cálculo de OEE: H01 (SANDRETTO OTTO) vs H31 (ROMI PRÁTICA)

```javascript
// ═════ MÁQUINA: H01 (SANDRETTO OTTO) ═════
// Máquina de grande porte, alta demanda

const h01_data = {
    machine: "H01",
    model: "SANDRETTO OTTO",
    capacity: "Alto porte (600 ton equivalente)",
    period: "10-16 Fevereiro",
    type: "Alta demanda (trabalha sábado)",
    
    schedule_operative: [
        { date: "2026-02-10", operational: true },   // Segunda - SIM
        { date: "2026-02-11", operational: true },   // Terça - SIM
        { date: "2026-02-12", operational: true },   // Quarta - SIM
        { date: "2026-02-13", operational: true },   // Quinta - SIM
        { date: "2026-02-14", operational: true },   // Sexta - SIM
        { date: "2026-02-15", operational: true },   // SÁBADO - SIM (urgente!)
        { date: "2026-02-16", operational: false }   // Domingo - NÃO
    ],
    
    minutes_scheduled: 6 * 24 * 60,  // 6 dias = 8,640 minutos
    
    downtimes_recorded: [
        { date: "2026-02-10", duration: 120, nature: "unplanned" },  // Monday: Troca de cor
        { date: "2026-02-11", duration: 90,  nature: "planned" },    // Tuesday: Setup
        { date: "2026-02-12", duration: 0 },                         // Wednesday: Perfect
        { date: "2026-02-13", duration: 60,  nature: "unplanned" },  // Thursday: Ajuste
        { date: "2026-02-14", duration: 45,  nature: "unplanned" },  // Friday: Fast fix
        { date: "2026-02-15", duration: 180, nature: "unplanned" },  // Saturday: Falha maior
    ],
    
    calculation: {
        planned_minutes: 90,
        unplanned_minutes: 120 + 60 + 45 + 180 = 405,
        available_minutes: 8640 - 90 - 405 = 8145,
        availability: (8145 / 8640) * 100 = 94.28%,
        
        expected_cycles: 1200,
        actual_cycles: 1080,
        performance: (1080 / 1200) * 100 = 90.00%,
        
        good_pieces: 10800,
        total_pieces: 11000,
        quality: (10800 / 11000) * 100 = 98.18%,
        
        oee: (94.28 * 90.00 * 98.18) / 10000 = 83.44%,
        classification: "EXCELENTE"
    }
};

// ═════ MÁQUINA: H31 (ROMI PRÁTICA CM8) ═════
// Máquina de pequeno porte, CNC, sem demanda sábado

const h31_data = {
    machine: "H31",
    model: "ROMI PRÁTICA CM8",
    capacity: "Pequeno porte (CNC básica)",
    period: "10-16 Fevereiro",
    type: "Demanda variável (não trabalha sábado)",
    
    schedule_operative: [
        { date: "2026-02-10", operational: false },  // Segunda - NÃO (manutenção)
        { date: "2026-02-11", operational: true },   // Terça - SIM
        { date: "2026-02-12", operational: true },   // Quarta - SIM
        { date: "2026-02-13", operational: true },   // Quinta - SIM
        { date: "2026-02-14", operational: true },   // Sexta - SIM
        { date: "2026-02-15", operational: false },  // Sábado - NÃO (sem demanda)
        { date: "2026-02-16", operational: false }   // Domingo - NÃO
    ],
    
    minutes_scheduled: 4 * 24 * 60,  // 4 dias (terça-sexta) = 5,760 minutos
    // Nota: segunda não conta (manutenção) e sábado/domingo não contam
    
    downtimes_recorded: [
        // Segunda: manutenção (não registra porque scheduled_operational: false)
        
        { date: "2026-02-11", duration: 75,  nature: "unplanned" },  // Terça: Falha sensor
        { date: "2026-02-12", duration: 0 },                         // Quarta: Perfect
        { date: "2026-02-13", duration: 30,  nature: "unplanned" },  // Quinta: Ajuste rápido
        { date: "2026-02-14", duration: 0 },                         // Sexta: Perfect
        
        // Sábado: parada esperada (não registra)
    ],
    
    calculation: {
        planned_minutes: 0,  // Sem manutenção durante semana
        unplanned_minutes: 75 + 30 = 105,
        available_minutes: 5760 - 0 - 105 = 5655,
        availability: (5655 / 5760) * 100 = 98.18%,
        
        expected_cycles: 720,
        actual_cycles: 690,
        performance: (690 / 720) * 100 = 95.83%,
        
        good_pieces: 6750,
        total_pieces: 6900,
        quality: (6750 / 6900) * 100 = 97.83%,
        
        oee: (98.18 * 95.83 * 97.83) / 10000 = 92.27%,
        classification: "CLASSE MUNDIAL"
    },
    
    interpretation: {
        details: [
            "✓ H31 tem OEE MELHOR que H01 (92.27% vs 83.44%)",
            "✓ Disponibilidade excelente: 98.18%",
            "✓ Performance boa: 95.83%",
            "✓ Qualidade excelente: 97.83%",
            "",
            "📊 POR QUÊ H31 > H01:",
            "  └─ Não trabalhrou sábado (não sofre penalidade)",
            "  └─ Teve manutenção planejada (não afeta)",
            "  └─ Apenas 2 pequenas falhas (75 + 30 min)",
            "  └─ H01 teve 405 min de paradas (maior porte = mais complexo)"
        ]
    }
};

// ═════ DASHBOARD COMPARATIVO (26 Máquinas) ═════

console.log(`
╔═════════════════════════════════════════════════════════════════════════════╗
║               ANÁLISE OEE HOKKAIDO - SEMANA 10-16 FEVEREIRO                ║
║                        (Com 26 Máquinas Reais)                             ║
╠═════════════════════════════════════════════════════════════════════════════╣
║                                                                             ║
║  MÁQUINA    MODELO              DIAS   DISPONIB.  PERFORM.  QUALID.  OEE  ║
║  ─────────────────────────────────────────────────────────────────────────║
║  H01 (SANDRETTO OTTO)           6      94.28%     90.00%    98.18%   83.44% ║
║  H02 (SANDRETTO SERIE 200)      6      95.12%     91.50%    98.45%   85.34% ║
║  H03 (LS LTE280)                6      96.54%     93.00%    98.90%   88.90% ║
║  H04 (LS LTE 330)               6      97.10%     94.10%    99.05%   90.23% ║
║  H05 (LS LTE 170)               5      95.67%     92.30%    98.67%   86.78% ║
║  H06 (HAITIAN MA2000)           6      93.45%     89.50%    97.80%   81.23% ║
║  H07 (CHEN HSONG JM 178 A)      5      96.78%     94.00%    98.90%   89.98% ║
║  H08 (REED 200 TG II)           4      98.34%     95.50%    99.20%   93.67% ║
║  H09 (REED 200 TG II)           4      97.89%     95.00%    99.10%   92.78% ║
║  H10 (HAITIAN MA 3200)          5      94.23%     89.00%    97.50%   79.89% ║
║  H12 (BORCHE BH 120)            3      89.45%     84.50%    96.78%   73.23% ║
║  H13 (HAITIAN MA 2000 770G)     5      92.34%     87.60%    97.45%   77.89% ║
║  H14 (SANDRETTO SB UNO)         5      95.78%     92.40%    98.67%   87.23% ║
║  H15 (ROMI EN 260 CM 10)        6      96.45%     93.80%    98.90%   89.12% ║
║  H16 (HAITIAN MA 2000 III)      5      94.67%     90.20%    98.10%   83.45% ║
║  H17 (ROMI EN 260 CM 10)        5      97.23%     94.50%    99.00%   90.89% ║
║  H18 (HAITIAN MA 2000 III)      3      91.23%     85.00%    97.12%   75.45% ║
║  H19 (HAITIAN MA 2000 III)      5      93.89%     88.90%    97.78%   80.34% ║
║  H20 (HAITIAN PL 200J)          2      85.67%     79.30%    95.45%   64.78% ║
║  H26 (ROMI PRIMAX CM9)          6      97.78%     95.20%    99.10%   92.23% ║
║  H27 (ROMI PRIMAX CM8)          6      96.89%     94.60%    98.99%   90.56% ║
║  H28 (ROMI PRIMAX CM8)          5      95.34%     92.10%    98.45%   86.45% ║
║  H29 (ROMI PRIMAX CM8)          4      98.12%     96.00%    99.20%   94.34% ║
║  H30 (ROMI PRIMAX CM8)          4      97.56%     95.30%    99.10%   92.89% ║
║  H31 (ROMI PRÁTICA CM8)         4      98.18%     95.83%    97.83%   92.27% ║
║  H32 (ROMI PRÁTICA CM8)         3      96.78%     93.45%    98.67%   88.90% ║
║  ─────────────────────────────────────────────────────────────────────────║
║  MÉDIA GERAL                    5.0    95.12%     91.23%    98.34%   84.67% ║
║  MEDIANA                        5.0    95.78%     91.50%    98.45%   86.34% ║
║                                                                             ║
║  📊 DISTRIBUIÇÃO:                                                           ║
║     CLASSE MUNDIAL (>= 90%):  8 máquinas (H08, H09, H17, H26, H27, H29, H30, H31) ║
║     EXCELENTE (85-89%):       10 máquinas                                   ║
║     BOM (80-84%):             5 máquinas                                    ║
║     PRECISA MELHORA (<80%):   3 máquinas (H10, H12, H20)                   ║
║                                                                             ║
║  ✅ INSIGHTS:                                                               ║
║     ✓ ROMI PRIMAX (H26-H30) são as melhores (CNC modernas)                ║
║     ✓ REED (H08-H09) têm excelente performance (4 dias)                   ║
║     ✓ H31-H32 (ROMI Prática) boas (não sofrem penalidade sábado)          ║
║     ⚠️  HAITIAN MA 3200 (H10) precisa atenção (só 4.8% OEE)               ║
║     ⚠️  HAITIAN PL 200J (H20) em pior condição (apenas 65% OEE)           ║
║     ⚠️  Máquinas com manutenção (H12, H20) têm OEE mais baixa             ║
║                                                                             ║
╚═════════════════════════════════════════════════════════════════════════════╝
`);
```

---

**✅ Agora COM MÁQUINAS REAIS do Database.js**

Cada máquina com seu modelo real e características específicas!

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                        SEMANA DE 10-16 FEVEREIRO/2026                       ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║  SEGUNDA 10/02:  Demanda ALTA (100%) - Semana recomeça                      ║
║  ├─ Operadores: 20+ (efetivo completo)                                      ║
║  ├─ Máquinas operando: 19 (82% das máquinas)                                ║
║  ├─ Máquinas paradas: 7 (em manutenção ou sem demanda)                      ║
║  └─ Observação: Injetoras + Robôs + algumas secundárias                     ║
║                                                                              ║
║  scheduled_operational = true para: INJ-01-08, ROB-01-06, TORM-01-02,       ║
║                                     FRE-01-02, PRENSA-01-02, CNC-01-02      ║
║  scheduled_operational = false para: LIXADEIRA-01-02, FURADEIRA-01,         ║
║                                      MONTAGEM (em manutenção)                ║
║                                                                              ║
├──────────────────────────────────────────────────────────────────────────────┤
║                                                                              ║
║  TERÇA A SEXTA:  Demanda NORMAIS (100%) - Continuação                       ║
║  ├─ Operadores: 20+ (efetivo completo)                                      ║
║  ├─ Máquinas operando: 19 (82%)                                             ║
║  ├─ Padrão: Mesmo de segunda                                               ║
║  └─ Variações: Conforme necessidade de produção                             ║
║                                                                              ║
│  Exemplo Quinta 13/02:                                                       ║
│  ├─ Demanda: Produto XYZ vai acabar → aumenta produção INJ-01, INJ-02       ║
│  ├─ Aloca máquinas diárias conforme pedido                                  ║
│  └─ Reduz produção INJ-05/06 (produto mais lento)                           ║
║                                                                              ║
├──────────────────────────────────────────────────────────────────────────────┤
║                                                                              ║
║  SÁBADO 15/02:  Demanda BAIXA (25%) - Operadores limitados                 ║
║  ├─ Operadores: 4 apenas                                                    ║
║  ├─ Máquinas operando: 6 (23%)                                              ║
║  ├─ Máquinas paradas: 20 (77% - sem demanda/sem operador)                   ║
║  │                                                                           ║
║  │  MÁQUINAS LIGADAS (selecionadas por PCP):                                ║
║  │  ├─ INJ-01 (produto com entrega urgente)                                 ║
║  │  ├─ INJ-02 (produto com entrega urgente)                                 ║
║  │  ├─ ROB-01 (célula dos injetores)                                        ║
║  │  ├─ ROB-02 (célula complementar)                                         ║
║  │  ├─ CNC-01 (usinagem crítica)                                            ║
║  │  └─ PRENSA-01 (fabricação secundária)                                    ║
║  │                                                                           ║
║  │  MÁQUINAS DESLIGADAS (contexto):                                         ║
║  │  ├─ INJ-03 a INJ-08 (sem demanda sábado)                                 ║
║  │  ├─ ROB-03 a ROB-06 (sem demanda)                                        ║
║  │  ├─ TORM-01, TORM-02 (sem demanda sábado)                                ║
║  │  ├─ FRE-01, FRE-02 (sem demanda)                                         ║
║  │  ├─ LIXADEIRA-01, LIXADEIRA-02 (sem demanda)                             ║
║  │  └─ FURADEIRA-01, CNC-02, MONTAGEM, PRENSA-02 (sem demanda)             ║
║  │                                                                           ║
║  └─ IMPORTANTE: PCP DEFINE isso terça ou quarta antes do fim de semana      ║
║                                                                              ║
├──────────────────────────────────────────────────────────────────────────────┤
║                                                                              ║
║  DOMINGO 16/02:  NÃO TRABALHA (0% demanda)                                  ║
║  ├─ Operadores: 0                                                           ║
║  ├─ Máquinas operando: 0 (0%)                                               ║
║  └─ Máquinas paradas: 26 (100% - descanso/manutenção)                       ║
║                                                                              ║
║  EXCEÇÃO (próxima semana se houvesse emergência):                            ║
║  └─ Se houvesse pedido URGENTE → PCP autoriza INJ-01 + 1 operador         ║
║    └─ Documentaria em machine_schedule mesmo domingo                        ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

#### 13.11.3. Tabela machine_schedule Preenchida Realista

```javascript
// Dados salvos em Firestore Collection: machine_schedule
// Para semana: 10-16 fevereiro

// ═════ SEGUNDA 10/02 ═════
[
    { week: "2026-02-10", date: "2026-02-10", machine_id: "inj-01", operational: true,  demand_level: "high", reason: "demanda_alta", orders: 4 },
    { week: "2026-02-10", date: "2026-02-10", machine_id: "inj-02", operational: true,  demand_level: "high", reason: "demanda_alta", orders: 3 },
    { week: "2026-02-10", date: "2026-02-10", machine_id: "inj-03", operational: true,  demand_level: "high", reason: "demanda_alta", orders: 2 },
    { week: "2026-02-10", date: "2026-02-10", machine_id: "inj-04", operational: true,  demand_level: "high", reason: "demanda_alta", orders: 2 },
    { week: "2026-02-10", date: "2026-02-10", machine_id: "inj-05", operational: false, demand_level: "high", reason: "manutencao_programada", orders: 0 },
    { week: "2026-02-10", date: "2026-02-10", machine_id: "inj-06", operational: true,  demand_level: "high", reason: "demanda_alta", orders: 2 },
    { week: "2026-02-10", date: "2026-02-10", machine_id: "inj-07", operational: true,  demand_level: "high", reason: "demanda_alta", orders: 1 },
    { week: "2026-02-10", date: "2026-02-10", machine_id: "inj-08", operational: true,  demand_level: "high", reason: "demanda_alta", orders: 1 },
    
    { week: "2026-02-10", date: "2026-02-10", machine_id: "rob-01", operational: true,  demand_level: "high", reason: "suporte_inj01_02", orders: 7 },
    { week: "2026-02-10", date: "2026-02-10", machine_id: "rob-02", operational: true,  demand_level: "high", reason: "suporte_inj03_04", orders: 4 },
    { week: "2026-02-10", date: "2026-02-10", machine_id: "rob-03", operational: true,  demand_level: "high", reason: "suporte_inj05_06", orders: 4 },
    { week: "2026-02-10", date: "2026-02-10", machine_id: "rob-04", operational: true,  demand_level: "high", reason: "suporte_inj07_08", orders: 2 },
    { week: "2026-02-10", date: "2026-02-10", machine_id: "rob-05", operational: true,  demand_level: "high", reason: "acabamento", orders: 7 },
    { week: "2026-02-10", date: "2026-02-10", machine_id: "rob-06", operational: true,  demand_level: "high", reason: "paletizacao", orders: 7 },
    
    { week: "2026-02-10", date: "2026-02-10", machine_id: "torm-01", operational: true,  demand_level: "high", reason: "producao_secundaria", orders: 2 },
    { week: "2026-02-10", date: "2026-02-10", machine_id: "torm-02", operational: true,  demand_level: "high", reason: "producao_secundaria", orders: 1 },
    { week: "2026-02-10", date: "2026-02-10", machine_id: "fre-01", operational: true,  demand_level: "high", reason: "producao_secundaria", orders: 2 },
    { week: "2026-02-10", date: "2026-02-10", machine_id: "fre-02", operational: false, demand_level: "high", reason: "manutencao_programada", orders: 0 },
    
    { week: "2026-02-10", date: "2026-02-10", machine_id: "lixadeira-01", operational: false, demand_level: "high", reason: "sem_demanda", orders: 0 },
    { week: "2026-02-10", date: "2026-02-10", machine_id: "lixadeira-02", operational: false, demand_level: "high", reason: "sem_demanda", orders: 0 },
    { week: "2026-02-10", date: "2026-02-10", machine_id: "prensa-01", operational: true,  demand_level: "high", reason: "demanda_alta", orders: 1 },
    { week: "2026-02-10", date: "2026-02-10", machine_id: "prensa-02", operational: false, demand_level: "high", reason: "manutencao_programada", orders: 0 },
    { week: "2026-02-10", date: "2026-02-10", machine_id: "furadeira-01", operational: false, demand_level: "high", reason: "sem_demanda", orders: 0 },
    { week: "2026-02-10", date: "2026-02-10", machine_id: "cnc-01", operational: true,  demand_level: "high", reason: "demanda_alta", orders: 2 },
    { week: "2026-02-10", date: "2026-02-10", machine_id: "cnc-02", operational: false, demand_level: "high", reason: "manutencao_programada", orders: 0 },
    { week: "2026-02-10", date: "2026-02-10", machine_id: "montagem", operational: false, demand_level: "high", reason: "manutencao_completa", orders: 0 }
]

// ═════ TERÇA 11/02 ATÉ SEXTA 14/02 ═════
// Mesmo padrão de segunda, com variações conforme necessidade

// Quinta 13/02 (Exemplo: demanda de Produto XYZ alta)
[
    // INJ-01 e 02 mantêm (vendas XYZ)
    // INJ-03 aumenta (também produz XYZ)
    // INJ-05 reduz (estava produzindo outro produto)
    // ... (simplificado)
]

// ═════ SÁBADO 15/02 - APENAS 6 MÁQUINAS ═════
[
    { week: "2026-02-10", date: "2026-02-15", machine_id: "inj-01", operational: true,  demand_level: "low", reason: "demanda_sábado_entrega_urgente", orders: 3 },
    { week: "2026-02-10", date: "2026-02-15", machine_id: "inj-02", operational: true,  demand_level: "low", reason: "demanda_sábado_entrega_urgente", orders: 2 },
    { week: "2026-02-10", date: "2026-02-15", machine_id: "inj-03", operational: false, demand_level: "low", reason: "pause_fim_de_semana", orders: 0 },
    { week: "2026-02-10", date: "2026-02-15", machine_id: "inj-04", operational: false, demand_level: "low", reason: "pause_fim_de_semana", orders: 0 },
    { week: "2026-02-10", date: "2026-02-15", machine_id: "inj-05", operational: false, demand_level: "low", reason: "pause_fim_de_semana", orders: 0 },
    { week: "2026-02-10", date: "2026-02-15", machine_id: "inj-06", operational: false, demand_level: "low", reason: "pause_fim_de_semana", orders: 0 },
    { week: "2026-02-10", date: "2026-02-15", machine_id: "inj-07", operational: false, demand_level: "low", reason: "pause_fim_de_semana", orders: 0 },
    { week: "2026-02-10", date: "2026-02-15", machine_id: "inj-08", operational: false, demand_level: "low", reason: "pause_fim_de_semana", orders: 0 },
    
    { week: "2026-02-10", date: "2026-02-15", machine_id: "rob-01", operational: true,  demand_level: "low", reason: "suporte_inj01_02_sábado", orders: 5 },
    { week: "2026-02-10", date: "2026-02-15", machine_id: "rob-02", operational: true,  demand_level: "low", reason: "suporte_sábado", orders: 1 },
    { week: "2026-02-10", date: "2026-02-15", machine_id: "rob-03", operational: false, demand_level: "low", reason: "pause_fim_de_semana", orders: 0 },
    { week: "2026-02-10", date: "2026-02-15", machine_id: "rob-04", operational: false, demand_level: "low", reason: "pause_fim_de_semana", orders: 0 },
    { week: "2026-02-10", date: "2026-02-15", machine_id: "rob-05", operational: true,  demand_level: "low", reason: "acabamento_sábado", orders: 3 },
    { week: "2026-02-10", date: "2026-02-15", machine_id: "rob-06", operational: false, demand_level: "low", reason: "pause_fim_de_semana", orders: 0 },
    
    // Secundárias do sábado
    { week: "2026-02-10", date: "2026-02-15", machine_id: "torm-01", operational: false, demand_level: "low", reason: "pause_fim_de_semana", orders: 0 },
    { week: "2026-02-10", date: "2026-02-15", machine_id: "torm-02", operational: false, demand_level: "low", reason: "pause_fim_de_semana", orders: 0 },
    { week: "2026-02-10", date: "2026-02-15", machine_id: "fre-01", operational: false, demand_level: "low", reason: "pause_fim_de_semana", orders: 0 },
    { week: "2026-02-10", date: "2026-02-15", machine_id: "fre-02", operational: false, demand_level: "low", reason: "pause_fim_de_semana", orders: 0 },
    { week: "2026-02-10", date: "2026-02-15", machine_id: "lixadeira-01", operational: false, demand_level: "low", reason: "pause_fim_de_semana", orders: 0 },
    { week: "2026-02-10", date: "2026-02-15", machine_id: "lixadeira-02", operational: false, demand_level: "low", reason: "pause_fim_de_semana", orders: 0 },
    { week: "2026-02-10", date: "2026-02-15", machine_id: "prensa-01", operational: true,  demand_level: "low", reason: "suporte_sábado", orders: 1 },
    { week: "2026-02-10", date: "2026-02-15", machine_id: "prensa-02", operational: false, demand_level: "low", reason: "pause_fim_de_semana", orders: 0 },
    { week: "2026-02-10", date: "2026-02-15", machine_id: "furadeira-01", operational: false, demand_level: "low", reason: "pause_fim_de_semana", orders: 0 },
    { week: "2026-02-10", date: "2026-02-15", machine_id: "cnc-01", operational: true,  demand_level: "low", reason: "usinagem_criticasabado", orders: 1 },
    { week: "2026-02-10", date: "2026-02-15", machine_id: "cnc-02", operational: false, demand_level: "low", reason: "pause_fim_de_semana", orders: 0 },
    { week: "2026-02-10", date: "2026-02-15", machine_id: "montagem", operational: false, demand_level: "low", reason: "pause_fim_de_semana", orders: 0 }
]

// ═════ DOMINGO 16/02 - NADA OPERA ═════
// Todas as 26 máquinas com operational: false

// RESUMO:
// Segunda-Sexta: ~19 máquinas (operational: true)
// Sábado: ~6 máquinas (operational: true)
// Domingo: 0 máquinas (operational: false)
```

#### 13.11.4. Cálculo de OEE: INJ-01 vs INJ-05 (Semana 10-16 Fevereiro)

```javascript
// ═════ CENÁRIO: Duas máquinas diferentes ═════

// INJ-01: Trabalha segunda-sexta + sábado (alta demanda)
// INJ-05: Trabalha segunda-quinta, parada sexta (manutenção), não trabalha sábado

// ═════ MÁQUINA: INJ-01 ═════

const inj01_data = {
    machine: "INJ-01",
    period: "10-16 Fevereiro",
    type: "Alta demanda (trabalha sábado)",
    
    schedule_operative: [
        { date: "2026-02-10", operational: true },   // Segunda
        { date: "2026-02-11", operational: true },   // Terça
        { date: "2026-02-12", operational: true },   // Quarta
        { date: "2026-02-13", operational: true },   // Quinta
        { date: "2026-02-14", operational: true },   // Sexta
        { date: "2026-02-15", operational: true },   // SÁBADO (trabalha!)
        { date: "2026-02-16", operational: false }   // Domingo
    ],
    
    minutes_scheduled: 6 * 24 * 60,  // 6 dias × 24h = 8,640 minutos
    
    downtimes_recorded: [
        // Segunda
        { date: "2026-02-10", duration: 90, nature: "unplanned" },  // Ajuste processo
        
        // Terça
        { date: "2026-02-11", duration: 60, nature: "planned" },    // Limpeza
        
        // Quarta
        { date: "2026-02-12", duration: 0 },                        // Sem parada
        
        // Quinta
        { date: "2026-02-13", duration: 30, nature: "unplanned" },  // Ajuste rápido
        
        // Sexta
        { date: "2026-02-14", duration: 45, nature: "unplanned" },  // Setup
        
        // SÁBADO
        { date: "2026-02-15", duration: 120, nature: "unplanned" }, // Falha, mas corrigida
        
        // Domingo
        // (não registra porque scheduled_operational: false)
    ],
    
    calculation: {
        // Paradas filtrando por scheduled_operational
        planned_minutes: 60,           // Limpeza de terça
        unplanned_minutes: 90+30+45+120 = 285,  // Todas as falhas
        
        available_minutes: 8640 - 60 - 285 = 8295,
        
        availability: (8295 / 8640) * 100 = 96.00%,
        
        // Performance (ciclos esperados vs reais)
        expected_cycles: 1440,  // Base 1200, esperado em 8295 min
        actual_cycles: 1365,    // Ralentamentos por ajustes
        performance: (1365 / 1440) * 100 = 94.79%,
        
        // Qualidade
        good_pieces: 13365,
        total_pieces: 13500,
        quality: (13365 / 13500) * 100 = 98.89%,
        
        // OEE FINAL
        oee: (96.00 * 94.79 * 98.89) / 10000 = 90.06%,
        classification: "CLASSE MUNDIAL"
    },
    
    interpretation: {
        description: "INJ-01 teve excelente performance",
        details: [
            "✓ Trabalhou 6 dias (segunda-sábado)",
            "✓ Disponibilidade: 96% (muito boa)",
            "✓ Performance: 94.79% (ralentamentos normais)",
            "✓ Qualidade: 98.89% (excelente)",
            "✓ OEE: 90.06% (CLASSE MUNDIAL)",
            "",
            "⚠ Falhas ocorridas:",
            "  └─ Sábado: Falha 120 min mas foi corrigida"
        ]
    }
};

// ═════ MÁQUINA: INJ-05 ═════

const inj05_data = {
    machine: "INJ-05",
    period: "10-16 Fevereiro",
    type: "Demanda baixa (não trabalha sábado)",
    
    schedule_operative: [
        { date: "2026-02-10", operational: false },  // Segunda (MANUTENÇÃO!)
        { date: "2026-02-11", operational: true },   // Terça
        { date: "2026-02-12", operational: true },   // Quarta
        { date: "2026-02-13", operational: true },   // Quinta
        { date: "2026-02-14", operational: true },   // Sexta
        { date: "2026-02-15", operational: false },  // Sábado (não trabalha)
        { date: "2026-02-16", operational: false }   // Domingo
    ],
    
    minutes_scheduled: 4 * 24 * 60,  // 4 dias × 24h = 5,760 minutos
    // Nota: não conta segunda (manutenção) e sábado/domingo
    
    downtimes_recorded: [
        // Segunda: MANUTENÇÃO PROGRAMADA (mas scheduled_operational = false, então ignora)
        // { date: "2026-02-10", duration: 1440, nature: "planned", scheduled_operational: false },
        
        // Terça
        { date: "2026-02-11", duration: 90, nature: "unplanned" },  // Falha
        
        // Quarta
        { date: "2026-02-12", duration: 0 },  // Sem parada
        
        // Quinta
        { date: "2026-02-13", duration: 45, nature: "unplanned" },  // Ajuste
        
        // Sexta
        { date: "2026-02-14", duration: 0 },  // Sem parada
        
        // Sábado: PARADA (scheduled_operational = false)
        // { date: "2026-02-15", duration: 1440, nature: "external", scheduled_operational: false },
        // (não registra porque máquina não deveria estar operando)
        
        // Domingo: (não trabalha)
    ],
    
    calculation: {
        // Paradas contando APENAS terça-sexta
        planned_minutes: 0,     // Sem manutenção durante semana
        unplanned_minutes: 90 + 45 = 135,
        
        available_minutes: 5760 - 0 - 135 = 5625,
        
        availability: (5625 / 5760) * 100 = 97.65%,
        
        // Performance
        expected_cycles: 960,
        actual_cycles: 920,
        performance: (920 / 960) * 100 = 95.83%,
        
        // Qualidade
        good_pieces: 8930,
        total_pieces: 9000,
        quality: (8930 / 9000) * 100 = 99.22%,
        
        // OEE FINAL
        oee: (97.65 * 95.83 * 99.22) / 10000 = 93.29%,
        classification: "CLASSE MUNDIAL"
    },
    
    interpretation: {
        description: "INJ-05 teve performance SUPERIOR à INJ-01",
        details: [
            "✓ Trabalhou 4 dias (terça-sexta)",
            "✓ Não trabalhou segunda (manutenção planejada) e sábado (sem demanda)",
            "✓ Disponibilidade: 97.65% (EXCELENTE - melhor que INJ-01)",
            "✓ Performance: 95.83% (ótima)",
            "✓ Qualidade: 99.22% (EXCELENTE)",
            "✓ OEE: 93.29% (CLASSE MUNDIAL - melhor que INJ-01!)",
            "",
            "📊 COMPARAÇÃO:",
            "  └─ INJ-05 OEE: 93.29%",
            "  └─ INJ-01 OEE: 90.06%",
            "  └─ DIFERENÇA: +3.23 pontos (INJ-05 melhor)",
            "",
            "💡 POR QUÊ INJ-05 É MELHOR:",
            "  └─ Teve manutenção planejada (não afeta disponibilidade)",
            "  └─ Teve menos falhas (só 2 pequenas)",
            "  └─ Melhor qualidade",
            "  └─ Não sofre "penalidade" de sábado/domingo"
        ]
    }
};

// ═════ DASHBOARD COMPARATIVO ═════

console.log(`
╔════════════════════════════════════════════════════════════════════════════╗
║                    ANÁLISE OEE - SEMANA 10-16 FEV                         ║
╠════════════════════════════════════════════════════════════════════════════╣
║                                                                            ║
║  MÁQUINA        DIAS       DISPONIBILIDADE   PERFORMANCE   QUALIDADE  OEE ║
║  ─────────────────────────────────────────────────────────────────────────║
║  INJ-01 (ref)   6 dias     96.00%           94.79%        98.89%    90.06% ║
║  INJ-05 (+opt)  4 dias     97.65%           95.83%        99.22%    93.29% ║
║  ─────────────────────────────────────────────────────────────────────────║
║  Diferença      ↓ 2 dias   ↑1.65 ptos       ↑1.04 ptos    ↑0.33 ptos ↑3.23% ║
║                                                                            ║
║  📊 CONCLUSÃO: INJ-05 é melhor porque:                                     ║
║     1. Recebeu manutenção planejada (melhor saúde)                        ║
║     2. Teve menos falhas durante operação                                 ║
║     3. Precisou de menos dias (4 vs 6)                                    ║
║     ✓ Não foi "penalizada" por sábado/domingo (contagem correta)         ║
║                                                                            ║
╚════════════════════════════════════════════════════════════════════════════╝
`);
```

#### 13.11.5. Dashboard Operacional do Sábado

```javascript
// TELA OPERACIONAL - SÁBADO 15/02/2026 (4 operadores)

┌──────────────────────────────────────────────────────────────────────────┐
│                  🟢 DEMANDA DO SÁBADO 15 DE FEVEREIRO                    │
│              (Configurado terça 12/02 por PCP - João da Silva)          │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  📊 RESUMO:                                                             │
│  ├─ Demanda: ███░░░░░░░ 25% (Baixa)                                   │
│  ├─ Operadores: 4 (Mariana, Carlos, Ana, Pedro)                       │
│  ├─ Máquinas operando: 6 de 26                                         │
│  └─ Ordens a cumprir: 10 ordens (prazo alguns produtos)                │
│                                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ✅ MÁQUINAS OPERACIONAIS (6 máquinas programadas):                   │
│                                                                         │
│  ┌─ INJ-01 (600 ton)  ────→ 3 ordens                                  │
│  │  └─ Operador: Mariana                                              │
│  │  └─ Status: Operando                                               │
│  │  └─ Pedidos: PROD001 (50 unidades), PROD002 (30 unidades)         │
│  │                                                                     │
│  ┌─ INJ-02 (600 ton)  ────→ 2 ordens                                  │
│  │  └─ Operador: Carlos                                               │
│  │  └─ Status: Operando                                               │
│  │  └─ Pedidos: PROD001 (40 unidades), PROD003 (20 unidades)         │
│  │                                                                     │
│  ┌─ ROB-01 (célula 1) ────→ Automático (suporte INJ-01/02)           │
│  │  └─ Status: Operando                                               │
│  │                                                                     │
│  ┌─ ROB-02 (célula 2) ────→ Automático (suporte secundário)          │
│  │  └─ Status: Operando                                               │
│  │                                                                     │
│  ┌─ ROB-05 (acabamento) ──→ Automático (acabamento)                  │
│  │  └─ Status: Operando                                               │
│  │                                                                     │
│  ┌─ CNC-01 (usinagem)  ────→ 1 ordem crítica                          │
│  │  └─ Operador: Ana                                                  │
│  │  └─ Status: Operando                                               │
│  │  └─ Pedido: PROD005 (peças usinadas, prazo tightening)            │
│  │                                                                     │
│  ┌─ PRENSA-01          ────→ 1 ordem                                  │
│  │  └─ Operador: Pedro                                                │
│  │  └─ Status: Operando                                               │
│  │  └─ Pedido: PROD004 (60 unidades)                                  │
│                                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ❌ MÁQUINAS PARADAS (20 máquinas - sem demanda no sábado):           │
│                                                                         │
│  INJ-03 a INJ-08  │ ROB-03, ROB-04, ROB-06  │ TORM-01, TORM-02      │
│  FRE-01, FRE-02   │ LIXADEIRA-01, 02        │ FURADEIRA-01          │
│  CNC-02 (manutenção) │ PRENSA-02 (aguardando)  │ MONTAGEM (parada)   │
│                                                                         │
│  ℹ️  Essas máquinas estão programadas para PARADA no sábado por:     │
│      └─ Sem pedidos específicos                                       │
│      └─ Falta de operadores (apenas 4 disponíveis)                   │
│      └─ Plano de manutenção                                           │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  📱 NOTIFICAÇÕES:                                                       │
│  ├─ Mariana (INJ-01): "Seu turno começa em 2 horas. Produção normal" │
│  ├─ Carlos (INJ-02): "Você não trabalha sábado. Aproveite o descanso"│
│  ├─ Ana (CNC-01): "Usinagem crítica. Prazo: entrega segunda de manhã"│
│  └─ Pedro (Gerência): "4 operadores escalados. Demanda 25%"          │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  💰 IMPACTO FINANCEIRO:                                                 │
│  ├─ Custo operores sábado: R$ 1.200 (4 × R$ 300)                     │
│  ├─ Produção esperada: R$ 8.500 (10 ordens)                          │
│  ├─ Margem: R$ 7.300                                                  │
│  └─ Justificado? SIM (entrega urgente, cliente premium)               │
│                                                                         │
└──────────────────────────────────────────────────────────────────────────┘
```

#### 13.11.6. Impacto no Cálculo de OEE: Resumo Semana Completa

```javascript
// Todas as 26 máquinas - semana 10-16 fevereiro

const weekOEE = {
    week: "2026-02-10 a 2026-02-16",
    totalMachines: 26,
    
    oeeByMachine: [
        { machine: "INJ-01", oee: 90.06, days_operative: 6, demand: "HIGH", classification: "CLASSE MUNDIAL" },
        { machine: "INJ-02", oee: 89.54, days_operative: 6, demand: "HIGH", classification: "CLASSE MUNDIAL" },
        { machine: "INJ-03", oee: 91.23, days_operative: 5, demand: "MEDIUM", classification: "CLASSE MUNDIAL" },
        { machine: "INJ-04", oee: 85.67, days_operative: 5, demand: "MEDIUM", classification: "EXCELENTE" },
        { machine: "INJ-05", oee: 93.29, days_operative: 4, demand: "LOW", classification: "CLASSE MUNDIAL" },
        { machine: "INJ-06", oee: 88.45, days_operative: 5, demand: "MEDIUM", classification: "CLASSE MUNDIAL" },
        { machine: "INJ-07", oee: 92.10, days_operative: 5, demand: "MEDIUM", classification: "CLASSE MUNDIAL" },
        { machine: "INJ-08", oee: 86.78, days_operative: 4, demand: "LOW", classification: "EXCELENTE" },
        
        { machine: "ROB-01", oee: 95.34, days_operative: 6, demand: "HIGH", classification: "CLASSE MUNDIAL" },
        { machine: "ROB-02", oee: 94.12, days_operative: 6, demand: "HIGH", classification: "CLASSE MUNDIAL" },
        { machine: "ROB-03", oee: 93.45, days_operative: 5, demand: "MEDIUM", classification: "CLASSE MUNDIAL" },
        { machine: "ROB-04", oee: 89.23, days_operative: 4, demand: "LOW", classification: "CLASSE MUNDIAL" },
        { machine: "ROB-05", oee: 96.78, days_operative: 6, demand: "HIGH", classification: "CLASSE MUNDIAL" },
        { machine: "ROB-06", oee: 91.56, days_operative: 5, demand: "MEDIUM", classification: "CLASSE MUNDIAL" },
        
        { machine: "TORM-01", oee: 88.34, days_operative: 5, demand: "MEDIUM", classification: "CLASSE MUNDIAL" },
        { machine: "TORM-02", oee: 85.12, days_operative: 4, demand: "LOW", classification: "EXCELENTE" },
        { machine: "FRE-01", oee: 87.45, days_operative: 5, demand: "MEDIUM", classification: "CLASSE MUNDIAL" },
        { machine: "FRE-02", oee: 82.67, days_operative: 3, demand: "LOW_MAINT", classification: "BOM" },
        
        { machine: "LIXADEIRA-01", oee: 79.23, days_operative: 2, demand: "LOW", classification: "BOM" },
        { machine: "LIXADEIRA-02", oee: null, days_operative: 0, demand: "ZERO_MAINT", classification: "EM_MANUTENÇÃO" },
        { machine: "PRENSA-01", oee: 91.67, days_operative: 6, demand: "HIGH", classification: "CLASSE MUNDIAL" },
        { machine: "PRENSA-02", oee: 84.34, days_operative: 3, demand: "LOW_MAINT", classification: "EXCELENTE" },
        { machine: "FURADEIRA-01", oee: 80.12, days_operative: 2, demand: "LOW", classification: "BOM" },
        { machine: "CNC-01", oee: 94.56, days_operative: 6, demand: "HIGH", classification: "CLASSE MUNDIAL" },
        { machine: "CNC-02", oee: null, days_operative: 0, demand: "ZERO_MAINT", classification: "EM_MANUTENÇÃO" },
        { machine: "MONTAGEM", oee: null, days_operative: 0, demand: "ZERO_MAINT", classification: "EM_MANUTENÇÃO" }
    ],
    
    statistics: {
        average_oee: 90.12,
        median_oee: 89.54,
        machines_operational: 23,
        machines_in_maintenance: 3,
        
        oee_distribution: {
            "CLASSE MUNDIAL (>= 90%)": 17,  // 17 máquinas
            "EXCELENTE (85-89%)": 4,        // 4 máquinas
            "BOM (75-84%)": 2,              // 2 máquinas
            "EM_MANUTENÇÃO": 3              // 3 máquinas (não contam)
        },
        
        production_capacity: {
            monday_to_friday: "19 máquinas (82%)",
            saturday: "6 máquinas (23%)",
            sunday: "0 máquinas (0%)"
        }
    },
    
    insights: [
        "✅ Média de OEE 90.12% = Excelente desempenho global",
        "✅ 73% das máquinas em operação estão em CLASSE MUNDIAL",
        "✅ Sábado com redução de 77% de carga não afeta OEE das máquinas (correto!)",
        "⚠️  CNC-02 e Montagem em manutenção (plano previsto)",
        "⚠️  Lixadeiras têm OEE low (79-80%) → revisar setup/operação",
        "💡 ROB-05 e ROB-01 são destaques (96.78% e 95.34%)"
    ]
};

console.log(JSON.stringify(weekOEE, null, 2));

// RESULTADO: Sem o campo scheduled_operational, todas essas máquinas
// pareceriam ter OEE PÉSSIMA no sábado/domingo.
// COM o campo, o cálculo fica CORRETO!
```

---

**Próximas Ações:**
1. ✓ Aprovação desta abordagem
2. ✓ Entendimento de OEE + Demanda
3. ✓ Entendimento de Demanda Variável (seção 13)
4. ✓ Exemplo prático com 26 máquinas (seção 13.11)
5. ✓ Criar schema atualizado (com scheduled_operational)
6. ✅ **IMPLEMENTADO** — Coleção `machine_schedule` no Firestore (seção 14)
7. ✅ **IMPLEMENTADO** — Agendamento Semanal no PCP (sub-aba dedicada — seção 14)
8. ✅ **IMPLEMENTADO** — API `getMachineScheduleForDate()` disponível globalmente
9. ✅ **IMPLEMENTADO** — Reestruturação PCP em 3 sub-abas (seção 14.3)
10. ✅ **IMPLEMENTADO** — Remoção da categoria HOKKAIDO de paradas (seção 14.4)
11. ⏳ Refatorar `calculateShiftOEE()` para usar `getMachineScheduleForDate()`
12. ⏳ Dashboard OEE com máquinas agendadas vs não-agendadas
13. ⏳ Desenvolvedor criar script de migração de coleções
14. ⏳ Testes em staging
15. ⏳ Deploy em produção

**Próximas Decisões:**
- ✅ Dashboard para PCP configurar máquinas operacionais? → **SIM, implementado**
- PCP define demanda terça-feira para fim de semana?
- Alertas automáticos para fins semana de alta demanda?
- Histórico de demanda para análise de padrões?

---

## 14. Implementações Recentes (Fevereiro 2026)

> **Data de implementação:** 10/02/2026  
> **Status:** ✅ Implementado e funcional  
> **Arquivos modificados:** `script.js`, `index.html`, `database.js`

### 14.1. Agendamento Semanal de Máquinas (machine_schedule)

#### 14.1.1. O que foi implementado

O módulo de **Agendamento Semanal** permite ao PCP definir quais das 26 máquinas devem operar em cada dia da semana, diretamente pela interface web.

```
IMPLEMENTAÇÃO REALIZADA:
│
├─ Firestore Collection: machine_schedule
│  └─ Documentos com chave: week_YYYY-MM-DD (ex: week_2026-02-09)
│  └─ Cada doc contém: { schedule: { "2026-02-09": { "H01": true, "H02": false, ... } } }
│
├─ Frontend: Sub-aba "Agendamento Semanal" na página PCP
│  └─ Grid visual 26 máquinas × 7 dias
│  └─ Checkboxes interativos por máquina/dia
│  └─ KPIs em tempo real (total, hoje, média, utilização)
│
├─ API Global: window.getMachineScheduleForDate(machineId, date)
│  └─ Retorna { operational: boolean, scheduled: boolean }
│  └─ Cache com TTL de 30 segundos
│
└─ API Global: window.getAllMachinesScheduleForDate(date)
   └─ Retorna objeto { "H01": true, "H02": false, ... }
```

#### 14.1.2. Schema Firestore Implementado

```javascript
// Coleção: machine_schedule
// Documento ID: week_YYYY-MM-DD (segunda-feira da semana)
// Exemplo: week_2026-02-09

{
    weekStart: "2026-02-09",                    // Segunda da semana (ISO string)
    schedule: {
        "2026-02-09": {                          // Segunda
            "H01": true, "H02": true, "H03": true, "H04": true,
            "H05": true, "H06": false, "H07": true, "H08": true,
            // ... (26 máquinas)
        },
        "2026-02-10": { /* Terça */ },
        "2026-02-11": { /* Quarta */ },
        "2026-02-12": { /* Quinta */ },
        "2026-02-13": { /* Sexta */ },
        "2026-02-14": { /* Sábado */ },
        "2026-02-15": { /* Domingo */ }
    },
    updatedAt: Timestamp,                       // Última atualização
    updatedBy: "leandro camargo"                // Usuário que salvou
}
```

**Diferença do Schema Proposto (seção 13.3) vs Implementado:**

| Aspecto | Proposto (seção 13.3) | Implementado |
|---------|----------------------|--------------|
| **Estrutura** | 1 doc por máquina/dia | 1 doc por semana (todas as máquinas) |
| **Doc ID** | Auto-gerado | `week_YYYY-MM-DD` (determinístico) |
| **Campos extras** | `demand_level`, `orders_count`, `expected_production` | Não incluídos (simplicidade) |
| **Machine ID** | `inj-03` (minúsculas) | `H03` (formato real do sistema) |
| **Granularidade** | Por dia individual | Semana inteira em 1 documento |
| **Consultas** | 26+ docs por dia | 1 doc por semana (mais eficiente) |

> **Justificativa:** O schema implementado é mais eficiente para o Firestore (1 leitura vs 26+ por semana) e mais simples de manter. Os campos extras (`demand_level`, `orders_count`) podem ser adicionados futuramente se necessário.

#### 14.1.3. Funcionalidades do Módulo

```javascript
// IIFE no final de script.js — Módulo auto-contido

(function() {
    // ====== CONSTANTES ======
    const CACHE_TTL = 30000;  // 30 segundos de cache
    const DAYS_IDS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'];
    
    // ====== ESTADO INTERNO ======
    const scheduleState = {
        currentWeekStart: null,       // Date: segunda-feira atual
        scheduleData: {},             // { "2026-02-09": { "H01": true, ... } }
        isDirty: false,               // Alterações não salvas?
        initialized: false,           // Já inicializou?
        cache: {},                    // Cache de consultas por data
        cacheExpiry: {}               // Expiração do cache por data
    };
    
    // ====== FUNÇÕES PRINCIPAIS ======
    // loadWeekSchedule(monday)       — Carrega dados da semana do Firestore
    // saveWeekSchedule()             — Salva semana inteira no Firestore
    // copyPreviousWeek()             — Copia agendamento da semana anterior
    // renderScheduleGrid()           — Renderiza grid 26×7 com checkboxes
    // updateScheduleKPIs()           — Atualiza KPIs (total, hoje, média, uso)
    // navigateWeek(direction)        — Avança/retrocede semana
    // setAllSchedule(value)          — Marca/desmarca tudo
    // toggleColumn(dayIndex)         — Marca/desmarca coluna (dia inteiro)
    
    // ====== API PÚBLICA ======
    // getMachineScheduleForDate(machineId, date)
    //   → { operational: bool, scheduled: bool }
    //   → Se não existe doc: retorna { operational: true, scheduled: false }
    //
    // getAllMachinesScheduleForDate(date)
    //   → { "H01": true, "H02": false, ... }
})();
```

#### 14.1.4. Interface Visual

```
┌───────────────────────────────────────────────────────────────────┐
│ 📅 Agendamento Semanal de Máquinas                               │
│ KPIs: [Total: 26] [Hoje: 19] [Média: 22] [Utilização: 78%]     │
├───────────────────────────────────────────────────────────────────┤
│ ◄ Semana Anterior | Semana 7 | 09/02 a 15/02/2026 | Próxima ► │
├──────┬────┬────┬────┬────┬────┬────┬────┬───────┤
│ Máq  │Seg │Ter │Qua │Qui │Sex │Sab │Dom │Total  │
├──────┼────┼────┼────┼────┼────┼────┼────┼───────┤
│ H01  │ ☑  │ ☑  │ ☑  │ ☑  │ ☑  │ ☑  │ ☐  │ 6/7   │
│ H02  │ ☑  │ ☑  │ ☑  │ ☑  │ ☑  │ ☐  │ ☐  │ 5/7   │
│ H03  │ ☑  │ ☑  │ ☑  │ ☑  │ ☑  │ ☐  │ ☐  │ 5/7   │
│ ...  │ .. │ .. │ .. │ .. │ .. │ .. │ .. │ ...   │
│ H32  │ ☑  │ ☑  │ ☑  │ ☑  │ ☑  │ ☐  │ ☐  │ 5/7   │
├──────┼────┼────┼────┼────┼────┼────┼────┼───────┤
│Total │ 26 │ 26 │ 26 │ 26 │ 26 │  8 │  2 │ 140   │
└──────┴────┴────┴────┴────┴────┴────┴────┴───────┘
│ [Copiar Semana Anterior] [Marcar Tudo] [Limpar] [💾 Salvar]    │
└───────────────────────────────────────────────────────────────────┘
```

#### 14.1.5. Integração Futura com OEE

```javascript
// ANTES (atual): calculateShiftOEE ignora agendamento
function calculateShiftOEE(produzido, tempoParadaMin, refugoPcs, cicloReal, cavAtivas) {
    const tempoTurnoMin = 480;  // ← Fixo, sempre 480 min
    const tempoProgramado = tempoTurnoMin;
    // ... calcula OEE normalmente
}

// DEPOIS (a implementar): usar getMachineScheduleForDate
async function calculateShiftOEE_V2(machine, date, turno, produzido, tempoParadaMin, refugoPcs, cicloReal, cavAtivas) {
    // 1. Verificar se a máquina estava agendada
    const schedule = await getMachineScheduleForDate(machine, date);
    
    if (!schedule.operational) {
        // Máquina NÃO agendada → OEE não se aplica
        return { disponibilidade: null, performance: null, qualidade: null, oee: null, status: 'not_scheduled' };
    }
    
    // 2. Máquina agendada → calcular OEE normalmente
    const tempoTurnoMin = 480;
    const tempoProgramado = tempoTurnoMin;
    const tempoProduzindo = Math.max(0, tempoProgramado - Math.max(0, tempoParadaMin));
    // ... resto do cálculo
}

// IMPACTO NO DASHBOARD:
// - Máquinas não agendadas aparecem como "N/A" em vez de 0% OEE
// - KPI geral só considera máquinas agendadas
// - Relatórios de eficiência excluem máquinas paradas por demanda
```

### 14.2. Categorias de Parada Atualizadas

#### 14.2.1. Remoção da Categoria HOKKAIDO

A categoria **"HOKKAIDO"** foi removida do sistema de paradas. Esta categoria NÃO existia em `groupedDowntimeReasons` (database.js), mas tinha referências residuais em:

```
REFERÊNCIAS REMOVIDAS:
│
├─ script.js L27312: Mapa de cores de categorias (badge de parada)
│  └─ ANTES: 'HOKKAIDO': 'bg-gray-200 text-gray-700'
│  └─ DEPOIS: Removido (cor movida para 'OUTROS')
│
├─ script.js L5651: Comentário na função aggregateOeeMetrics
│  └─ ANTES: "// Obter categorias excluídas do OEE (ex: HOKKAIDO)"
│  └─ DEPOIS: "// Obter categorias excluídas do OEE"
│
└─ script.js L33830: Comentário na função processResumoData
   └─ ANTES: "// Excluir paradas de categorias que não devem afetar OEE (ex: HOKKAIDO)"
   └─ DEPOIS: "// Excluir paradas de categorias que não devem afetar OEE"
```

#### 14.2.2. Categorias Ativas (12 categorias)

```javascript
// database.js — groupedDowntimeReasons (estado atual)
var groupedDowntimeReasons = {
    "FERRAMENTARIA": ["CORRETIVA DE MOLDE", "PREVENTIVA DE MOLDE", "TROCA DE VERSÃO"],
    "PROCESSO":      ["ABERTURA DE CAVIDADE", "AJUSTE DE PROCESSO", "FECHAMENTO DE CAVIDADE", 
                      "TRY OUT", "PRENDENDO GALHO", "PRENDENDO PEÇAS"],
    "COMPRAS":       ["FALTA DE MATÉRIA PRIMA", "FALTA DE SACO PLÁSTICO", 
                      "FALTA DE CAIXA DE PAPELÃO", "FALTA DE CAIXA PLÁSTICA", "FALTA DE MASTER"],
    "PREPARAÇÃO":    ["AGUARDANDO PREPARAÇÃO DE MATERIAL", "AGUARDANDO ESTUFAGEM DE M.P", 
                      "FORA DE COR", "TESTE DE COR"],
    "QUALIDADE":     ["AGUARDANDO CLIENTE/FORNECEDOR", "LIBERAÇÃO INÍCIAL", 
                      "AGUARDANDO DISPOSIÇÃO DA QUALIDADE"],
    "MANUTENÇÃO":    ["MANUTENÇÃO CORRETIVA", "MANUTENÇÃO PREVENTIVA"],
    "PRODUÇÃO":      ["FALTA DE OPERADOR", "TROCA DE COR", "F.O REVEZAMENTO ALMOÇO", 
                      "F.O REVEZAMENTO JANTA", "INICIO/REINICIO"],
    "SETUP":         ["INSTALAÇÃO DE MOLDE", "RETIRADA DE MOLDE", 
                      "INSTALAÇÃO DE PERÍFÉRICOS", "SETUP/TROCA"],
    "ADMINISTRATIVO":["FALTA DE ENERGIA", "FERIADO"],
    "PCP":           ["SEM PROGRAMAÇÃO", "SEM PROGRAMAÇÃO-FIM DE SEMANA", 
                      "ESTRATÉGIA PCP", "FIM DE SEMANA"],
    "COMERCIAL":     ["SEM PEDIDO", "PARADA COMERCIAL", "BAIXA DEMANDA"],
    "OUTROS":        ["VAZAMENTO DO BICO", "QUEIMA DE RESISTÊNCIA", "PARADA LONGA", 
                      "OUTROS (PARADA LONGA)", "MANUTENÇÃO PROGRAMADA"]
};
// Nota: Categoria "HOKKAIDO" removida — nunca existiu aqui, apenas em referências de UI
```

#### 14.2.3. Mapeamento de Cores por Categoria (Atualizado)

```javascript
// script.js — categoryColors (estado atual, sem HOKKAIDO)
const categoryColors = {
    'FERRAMENTARIA':  'bg-indigo-100 text-indigo-700',
    'PROCESSO':       'bg-cyan-100 text-cyan-700',
    'COMPRAS':        'bg-green-100 text-green-700',
    'PREPARAÇÃO':     'bg-yellow-100 text-yellow-700',
    'QUALIDADE':      'bg-pink-100 text-pink-700',
    'MANUTENÇÃO':     'bg-blue-100 text-blue-700',
    'PRODUÇÃO':       'bg-orange-100 text-orange-700',
    'SETUP':          'bg-purple-100 text-purple-700',
    'ADMINISTRATIVO': 'bg-slate-100 text-slate-700',
    'PCP':            'bg-teal-100 text-teal-700',
    'COMERCIAL':      'bg-amber-100 text-amber-700',
    'OUTROS':         'bg-gray-200 text-gray-700'
};
```

### 14.3. Reestruturação da Página PCP em Sub-abas

#### 14.3.1. Estrutura Anterior vs Nova

```
ANTES (tudo empilhado verticalmente):
┌──────────────────────────────────────┐
│ PCP Header                          │
├──────────────────────────────────────┤
│ Dashboard de Produção (KPIs, Cards) │
│                                      │
│ Fila de Ordens por Máquinas          │
│                                      │
│ Agendamento Semanal (colapsável)     │
│                                      │
└──────────────────────────────────────┘

DEPOIS (3 sub-abas independentes):
┌──────────────────────────────────────┐
│ PCP - Planejamento e Controle       │
│ [Dashboard] [Fila Ordens] [Agenda]  │
├──────────────────────────────────────┤
│                                      │
│  (Conteúdo da sub-aba ativa)        │
│                                      │
└──────────────────────────────────────┘
```

#### 14.3.2. Implementação Técnica

```html
<!-- Sub-abas no HTML (index.html) -->
<div class="flex border-b border-gray-200 bg-gray-50">
    <button class="pcp-subtab-btn" data-subtab="pcp-dashboard">Dashboard de Produção</button>
    <button class="pcp-subtab-btn" data-subtab="pcp-fila">Fila de Ordens</button>
    <button class="pcp-subtab-btn" data-subtab="pcp-agendamento">Agendamento Semanal</button>
</div>

<!-- Conteúdo envelopado por divs com IDs correspondentes -->
<div id="pcp-subtab-pcp-dashboard" class="pcp-subtab-content"><!-- Dashboard --></div>
<div id="pcp-subtab-pcp-fila" class="pcp-subtab-content hidden"><!-- Fila --></div>
<div id="pcp-subtab-pcp-agendamento" class="pcp-subtab-content hidden"><!-- Agendamento --></div>
```

```javascript
// Lógica de switching (script.js — setupPCPSubTabs)
function setupPCPSubTabs() {
    const buttons = document.querySelectorAll('.pcp-subtab-btn');
    const contents = document.querySelectorAll('.pcp-subtab-content');
    
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.dataset.subtab;
            
            // Desativar todas
            buttons.forEach(b => { b.classList.remove('border-indigo-600', 'text-indigo-700'); });
            contents.forEach(c => c.classList.add('hidden'));
            
            // Ativar selecionada
            btn.classList.add('border-indigo-600', 'text-indigo-700');
            document.getElementById(`pcp-subtab-${targetId}`)?.classList.remove('hidden');
            
            // Lazy-load: inicializa agendamento na primeira vez
            if (targetId === 'pcp-agendamento' && !window.machineSchedule.getState().initialized) {
                window.machineSchedule._loadAndRender();
            }
        });
    });
}
```

### 14.4. Sistema de Absenteísmo (Tipos de Ausência)

#### 14.4.1. Tipos de Ausência Ativos (7 tipos)

```javascript
// script.js — TIPOS_AUSENCIA (estado atual)
const TIPOS_AUSENCIA = {
    'falta_nao_justificada': { label: 'Falta não justificada', color: '#ef4444', bgColor: 'bg-red-100 text-red-700' },
    'atestado':              { label: 'Atestado Médico',       color: '#eab308', bgColor: 'bg-yellow-100 text-yellow-700' },
    'folga_aniversario':     { label: 'Folga Aniversário',     color: '#a855f7', bgColor: 'bg-purple-100 text-purple-700' },
    'ferias':                { label: 'Férias',                color: '#10b981', bgColor: 'bg-emerald-100 text-emerald-700' },
    'atraso':                { label: 'Atraso',                color: '#f97316', bgColor: 'bg-orange-100 text-orange-700' },
    'hokkaido_day':          { label: 'Dia Hokkaido',          color: '#0ea5e9', bgColor: 'bg-sky-100 text-sky-700' },
    'outros':                { label: 'Outros',                color: '#6b7280', bgColor: 'bg-gray-100 text-gray-700' }
};
```

> **Nota:** `hokkaido_day` é um tipo de **ausência** (absenteísmo de operadores), NÃO uma categoria de parada de máquina. Esse tipo permanece ativo no sistema.

#### 14.4.2. Diferenciação Importante

```
CATEGORIAS DE PARADA (downtime)          TIPOS DE AUSÊNCIA (absenteísmo)
═══════════════════════════              ══════════════════════════════
Afetam MÁQUINAS (OEE)                   Afetam OPERADORES (RH)
12 categorias ativas                     7 tipos ativos
Firestore: downtime_entries              Firestore: absenteismo_registros
Página: Análise de Paradas               Página: Absenteísmo
─────────────────────────                ──────────────────────────────
FERRAMENTARIA                            falta_nao_justificada
PROCESSO                                 atestado
COMPRAS                                  folga_aniversario
PREPARAÇÃO                               ferias
QUALIDADE                                atraso
MANUTENÇÃO                               hokkaido_day ← Pertence aqui
PRODUÇÃO                                 outros
SETUP
ADMINISTRATIVO
PCP
COMERCIAL
OUTROS
❌ HOKKAIDO ← Removida daqui
```

### 14.5. Resumo das Mudanças por Arquivo

| Arquivo | Mudança | Linhas Afetadas |
|---------|---------|-----------------|
| **script.js** | Módulo de Agendamento Semanal (IIFE) | ~500 linhas (final do arquivo) |
| **script.js** | `setupPCPSubTabs()` — lógica de sub-abas | ~50 linhas |
| **script.js** | `setupPCPPage()` — chamada a `setupPCPSubTabs()` | +1 linha |
| **script.js** | Removida `'HOKKAIDO'` de `categoryColors` | 1 linha |
| **script.js** | Removidos comentários `(ex: HOKKAIDO)` | 2 linhas |
| **script.js** | `TIPOS_AUSENCIA` — preservado `hokkaido_day` | Mantido |
| **script.js** | `atualizarEstatisticasHistorico()` — inclui `hokkaido` e `ferias` | +4 linhas |
| **index.html** | Header PCP com sub-abas | ~30 linhas |
| **index.html** | 3 wrappers `pcp-subtab-content` | 6 linhas |
| **index.html** | Seção agendamento (visible, sem toggle) | Refatorada |
| **index.html** | Grid de stats absenteísmo → `md:grid-cols-8` | 1 linha |
| **index.html** | Card `abs-stat-hokkaido` no absenteísmo | 4 linhas |
| **index.html** | Filtros com `hokkaido_day` (hist + dashboard) | 2 linhas |
| **database.js** | Sem alterações (HOKKAIDO nunca existiu aqui) | 0 linhas |
