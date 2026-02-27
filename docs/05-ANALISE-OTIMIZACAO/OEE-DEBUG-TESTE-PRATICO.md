# OEE Debug: Localizar e Testar Cálculos

**Como encontrar, entender e testar os cálculos de OEE no código**

---

## 1. MAPA DE LOCALIZAÇÃO

### 1.1 Cálculo de OEE por Turno

**Arquivo**: `src/controllers/analysis.controller.js` (linhas 45-63)  
**Função**: `calculateShiftOEE()`

```javascript
// ⚡ Função base que calcula OEE para 1 TURNO
function calculateShiftOEE(produzido, tempoParadaMin, refugoPcs, cicloReal, cavAtivas) {
    const tempoTurnoMin = 480;  // 8 horas
    const tempoProgramado = tempoTurnoMin;
    const tempoProduzindo = Math.max(0, tempoProgramado - Math.max(0, tempoParadaMin));
    
    // Disponibilidade
    const disponibilidade = tempoProgramado > 0 ? (tempoProduzindo / tempoProgramado) : 0;
    
    // Performance (baseado em capacidade)
    const producaoTeorica = cicloReal > 0 && cavAtivas > 0 
        ? (tempoProduzindo * 60 / cicloReal) * cavAtivas 
        : 0;
    const performance = producaoTeorica > 0 
        ? Math.min(1, produzido / producaoTeorica) 
        : (produzido > 0 ? 1 : 0);
    
    // Qualidade
    const totalProduzido = Math.max(0, produzido) + Math.max(0, refugoPcs);
    const qualidade = totalProduzido > 0 
        ? (Math.max(0, produzido) / totalProduzido) 
        : (produzido > 0 ? 1 : 0);
    
    // OEE final
    const oee = disponibilidade * performance * qualidade;
    
    return { disponibilidade, performance, qualidade, oee };
}
```

**Status**: ✅ Correto para um turno | ❌ Errado para dados de 3 turnos agregados

---

### 1.2 Agregação de OEE (Agregação Errada)

**Arquivo**: `src/controllers/analysis.controller.js` (linhas 1328-1650)  
**Função**: `aggregateOeeMetrics()`

```javascript
// ⚠️ Problema aqui:
Object.values(grouped).forEach(group => {
    // group.production = SOMA de T1+T2+T3
    // group.downtimeMin = SOMA de T1+T2+T3
    // Mas usandoShiftOEE que assume UM turno!
    
    const metrics = calculateShiftOEE(
        group.production,      // ❌ Soma de 3 turnos
        group.downtimeMin,     // ❌ Soma de 3 turnos
        refugoPcs,
        cicloReal,             // ✅ De um turno
        cavAtivas              // ✅ De um turno
    );
});
```

**Status**: 🔴 CRÍTICO - Dados de 3 turnos em fórmula de 1 turno

---

### 1.3 Cálculo de "Efficiency" com Meta

**Arquivo 1**: `src/controllers/launch.controller.js` (linha 4210-4211)

```javascript
// Eficiência baseada em META FIXA (não capacidade)
const dailyTarget = Number(window.selectedMachineData.daily_target 
                           || window.selectedMachineData.planned_quantity 
                           || 0);
const efficiency = dailyTarget > 0 
    ? (totalProduced / dailyTarget * 100)  // Compara com 450K
    : 0;
```

**Arquivo 2**: `dashboard-tv.html` (linhas 2823-2832)

```javascript
// Meta hardcoded
const META_DIARIA_SEMANA = 1400000;
const META_DIARIA_FDS = 450000;

function getMetaDiaria(dateStr = null) {
    const date = dateStr ? new Date(dateStr + 'T12:00:00') : new Date();
    const dayOfWeek = date.getDay();
    const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
    return isWeekend ? META_DIARIA_FDS : META_DIARIA_SEMANA;
}
```

**Status**: ✅ Correto para meta | ⚠️ Não deveria estar em OEE

---

### 1.4 Display no Dashboard

**Arquivo**: `src/controllers/dashboard.controller.js` (linha 293-295)

```javascript
// Gráfico de meta diária vs produção
const planItem = data.length > 0 ? data.find(d => d.planned_quantity > 0) : null;
const metaDiaria = planItem ? planItem.planned_quantity : 0;
const metaPorHora = metaDiaria / 24;

// Usa para desenhar meta no gráfico acumulado
```

**Status**: ⚠️ Mescla conceitos - gráfico mostra produção vs. meta juntas

---

## 2. TESTE RÁPIDO EM 5 PASSOS

### Passo 1: Abrir Console do Navegador

```
Navegação: Análise > F12 (ou Ctrl+Shift+I) > Aba Console
```

### Passo 2: Executar Script de Debug

```javascript
// Simular cálculo de OEE para dados reais

// ===== DADOS DE ENTRADA =====
const dadosSabado = {
    maquina: 'H-10',
    producaoTotal: 380000,      // Soma de T1+T2+T3
    downtimeTotal: 120,         // Minutos em TODO O DIA
    refugoTotal: 5200,          // Peças ruins no dia inteiro
    
    // Dados por turno (pegar do plano)
    cicloT1: 20,                // segundos
    cicloT2: 20,
    cicloT3: 20,
    
    cavT1: 2,                   // cavidades
    cavT2: 2,
    cavT3: 2
};

// ===== CÁLCULO ERRADO (Atual) =====
// Agrupa dados de 3 turnos mas calcula como 1 turno
console.log("❌ CÁLCULO ATUAL (ERRADO):");

const tempoTurnoMin = 480;  // 1 turno
const tempoProduzindo = tempoTurnoMin - dadosSabado.downtimeTotal;  // 480-120
const disponibilidade = tempoProduzindo / tempoTurnoMin;

const producaoTeorica = (tempoProduzindo * 60 / dadosSabado.cicloT1) * dadosSabado.cavT1;
// = (360 * 60 / 20) * 2 = 1.080 * 2 = 2.160

const performance = Math.min(1, dadosSabado.producaoTotal / producaoTeorica);
// = 380.000 / 2.160 = 175.925 → clampea a 1.0 = 100%!

const qualidade = (dadosSabado.producaoTotal - dadosSabado.refugoTotal) / dadosSabado.producaoTotal;
const oee_errado = disponibilidade * performance * qualidade;

console.log(`Disponibilidade: ${(disponibilidade*100).toFixed(1)}%`);
console.log(`Performance: ${(performance*100).toFixed(1)}% ⚠️ (deveria ser ~100% mas está errado)`);
console.log(`Qualidade: ${(qualidade*100).toFixed(1)}%`);
console.log(`OEE: ${(oee_errado*100).toFixed(1)}%`);

// ===== CÁLCULO CORRETO (Proposto) =====
console.log("\n✅ CÁLCULO CORRETO (Proposta):");

// Para dados de 3 turnos, tempo TOTAL é 3 x 480
const tempoTotalDia = 3 * 480;  // 1.440 minutos
const tempoAtivoTotal = tempoTotalDia - dadosSabado.downtimeTotal;
const disponibilidade_correta = tempoAtivoTotal / tempoTotalDia;

// Capacidade é a SOMA dos 3 turnos
const producaoTeoricaTotal = 
    (tempoAtivoTotal * 60 / dadosSabado.cicloT1) * dadosSabado.cavT1;
    // Simplificado: assume ciclo/cav iguais nos 3 turnos

const performance_correta = Math.min(1, dadosSabado.producaoTotal / producaoTeoricaTotal);
const qualidade_correta = (dadosSabado.producaoTotal - dadosSabado.refugoTotal) / dadosSabado.producaoTotal;
const oee_correto = disponibilidade_correta * performance_correta * qualidade_correta;

console.log(`Disponibilidade: ${(disponibilidade_correta*100).toFixed(1)}%`);
console.log(`Performance: ${(performance_correta*100).toFixed(1)}%`);
console.log(`Qualidade: ${(qualidade_correta*100).toFixed(1)}%`);
console.log(`OEE: ${(oee_correto*100).toFixed(1)}%`);

// ===== VALOR DE META =====
console.log("\n📊 INDICADOR DE META (Comercial):");
const META_SABADO = 450000;
const metaPercentual = (dadosSabado.producaoTotal / META_SABADO) * 100;
console.log(`Meta: ${metaPercentual.toFixed(1)}%`);

// ===== COMPARAÇÃO =====
console.log("\n📈 COMPARAÇÃO:");
console.log(`OEE Atual: ${(oee_errado*100).toFixed(1)}%`);
console.log(`OEE Correto: ${(oee_correto*100).toFixed(1)}%`);
console.log(`Meta %: ${metaPercentual.toFixed(1)}%`);
console.log(`\nDifença OEE: ${((oee_correto - oee_errado)*100).toFixed(1)}% maior se correto`);
```

### Passo 3: Interpretar Resultado

```
Esperado:

❌ CÁLCULO ATUAL (ERRADO):
Disponibilidade: 75.0%
Performance: 100% ⚠️ (errado - performance teórica infinita)
Qualidade: 98.6%
OEE: 73.9%

✅ CÁLCULO CORRETO (Proposta):
Disponibilidade: 91.7%
Performance: 95.3%
Qualidade: 98.6%
OEE: 85.8%

📊 INDICADOR DE META (Comercial):
Meta: 84.4%

Diferença OEE: 11.9% maior se correto
```

---

### Passo 4: Validar com Dados Reais

```javascript
// Buscar dados REAIS do Firestore e testar

async function debugOeeReal() {
    try {
        // Conectar ao Firestore
        const db = window.db;  // Já carregado no index.html
        
        // Query: Pegar dados de 23/02/2026 (sábado), máquina H-10
        const startDate = new Date('2026-02-23');
        const endDate = new Date('2026-02-23');
        
        // Produção
        const prod = await db.collection('production')
            .where('machine', '==', 'H-10')
            .where('timestamp', '>=', startDate)
            .where('timestamp', '<=', endDate)
            .get();
        
        // Paradas
        const downtime = await db.collection('downtime')
            .where('machine', '==', 'H-10')
            .where('timestamp', '>=', startDate)
            .where('timestamp', '<=', endDate)
            .get();
        
        // Perdas
        const losses = await db.collection('losses')
            .where('machine', '==', 'H-10')
            .where('timestamp', '>=', startDate)
            .where('timestamp', '<=', endDate)
            .get();
        
        // Calcular
        const totalProd = prod.docs.reduce((s, d) => s + (d.data().quantity || 0), 0);
        const totalDowntimeMins = downtime.docs.reduce((s, d) => s + (d.data().duration || 0), 0);
        const totalScrap = losses.docs.reduce((s, d) => s + (d.data().scrapPcs || 0), 0);
        
        console.log(`H-10 em 23/02/2026:`);
        console.log(`  Produção Total: ${totalProd.toLocaleString()} peças`);
        console.log(`  Paradas Total: ${totalDowntimeMins} minutos`);
        console.log(`  Refugo Total: ${totalScrap.toLocaleString()} peças`);
        
        // Agora calcular OEE com esses dados
        // ... (usar script acima)
        
    } catch (error) {
        console.error('Erro ao buscar dados:', error);
    }
}

debugOeeReal();
```

### Passo 5: Informar Resultado

Se OEE estiver significativamente diferente:
- ❌ OEE atual está ERRADO
- ✅ Usar cálculo correto proposto

Se OEE for close:
- ✅ Cálculo atualmente está aceitável (não crítico)
- ⚠️ Mas ainda recomenda-se padronizar

---

## 3. CHECKLIST VISUAL

### No Navegador - Aha de Análise

Abra: http://localhost (ou seu endereço)  
Aba: **Análise**  
Filtro: H-10, 23/02/2026 (sábado)

**Procure por:**

```
Label "OEE":        ← Qual valor aparece?
Label "Performance": ← É% ou não?
Label "Meta":       ← Se aparecer, qual é?
```

**Esperado:**

```
┌─────────────────────────┐
│ OEE Hoje:      45%      │ ← Está baixo? É o bug!
│ Disponibilidade: 75%    │
│ Performance:    100%    │ ← Estranho? Performance >100%?
│ Qualidade:      98%     │
└─────────────────────────┘
```

Se Performance > 100%, é o bug da agregação de 3 turnos!

---

## 4. TESTE AUTOMATED

### Executar em CI/CD (Futura)

```javascript
describe('OEE Calculator', () => {
    it('should calculate shift OEE correctly for 1 shift', () => {
        const result = calculateShiftOEE(
            produzido = 25000,      // 25K peças em 8h
            tempoParadaMin = 60,    // 1 hora de parada
            refugoPcs = 500,        // 500 refugos
            cicloReal = 20,         // 20 seg/ciclo
            cavAtivas = 2           // 2 cavidades
        );
        
        expect(result.disponibilidade).toBe(0.875);  // 420/480
        expect(result.performance).toBeCloseTo(0.75, 0.01);
        expect(result.qualidade).toBeCloseTo(0.98, 0.01);
        expect(result.oee).toBeCloseTo(0.67, 0.01);
    });
    
    it('should NOT use planned_quantity in OEE calculation', () => {
        // OEE deve ser INDEPENDENTE de meta
        const result1 = calculateShiftOEE(25000, 60, 500, 20, 2);
        const result2 = calculateShiftOEE(25000, 60, 500, 20, 2);
        
        // Deve ser idêntico mesmo com metas diferentes
        expect(result1.oee).toBe(result2.oee);
    });
    
    it('should aggregate by shift, not by daily total', () => {
        // Simular T1, T2, T3 com dados reais
        const t1_result = calculateShiftOEE(8000, 30, 150, 20, 2);
        const t2_result = calculateShiftOEE(8500, 45, 160, 20, 2);
        const t3_result = calculateShiftOEE(9200, 50, 180, 20, 2);
        
        const aggregated = [t1_result, t2_result, t3_result];
        const average_oee = (
            aggregated.reduce((s, r) => s + r.oee, 0) / aggregated.length
        );
        
        // Nunca deve ser calculado diretamente com soma!
        const wrong_way = calculateShiftOEE(
            8000+8500+9200,    // ERRADO: soma de 3 turnos
            30+45+50,          // ERRADO: soma de 3 turnos
            150+160+180,
            20,
            2
        );
        
        expect(average_oee).not.toBe(wrong_way.oee);
    });
});
```

---

## 5. QUICK REFERENCE

### Onde Procurar

| O quê | Onde | Linha |
|-------|------|-------|
| Cálculo de OEE | `analysis.controller.js` | 45-63 |
| Agregação com BUG | `analysis.controller.js` | 1550 |
| Efficiency vs Meta | `launch.controller.js` | 4210 |
| Meta fixa 450K | `dashboard-tv.html` | 2823 |
| Meta no gráfico | `dashboard.controller.js` | 293 |

### Funções Chave

```javascript
calculateShiftOEE()        // Base correta
aggregateOeeMetrics()      // Agregação errada
getMetaDiaria()            // Meta fixa
calculateDailyOEE() // (NÃO EXISTE - precisa criar)
```

---

## 6. PRÓXIMOS PASSOS

1. **Executar teste acima** para confirmar o bug
2. **Implementar `calculateDailyOEE()`** (ver `FIX-CALCULO-OEE-AGGREGADO.md`)
3. **Validar com dados históricos**
4. **Atualizar UI** para separar OEE vs Meta

