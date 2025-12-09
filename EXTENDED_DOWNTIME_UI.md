# UI para Análise Consolidada de Paradas Longas

## 📋 Estrutura HTML para adicionar à aba de Análise > Paradas

### **Resumo com KPIs**
```html
<!-- Seção de Resumo Consolidado -->
<div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
    <!-- Total de Paradas -->
    <div class="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-4 border border-red-200">
        <p class="text-xs font-semibold text-red-600 uppercase mb-1">Total Parado</p>
        <p id="kpi-total-downtime" class="text-3xl font-bold text-red-700">0h</p>
        <p class="text-xs text-red-500 mt-1">Consolidado</p>
    </div>

    <!-- Paradas Normais -->
    <div class="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-4 border border-orange-200">
        <p class="text-xs font-semibold text-orange-600 uppercase mb-1">Paradas Normais</p>
        <p id="kpi-normal-downtime" class="text-2xl font-bold text-orange-700">0h (0)</p>
        <p class="text-xs text-orange-500 mt-1">Ocorrências regulares</p>
    </div>

    <!-- Paradas Longas -->
    <div class="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
        <p class="text-xs font-semibold text-blue-600 uppercase mb-1">Paradas Longas</p>
        <p id="kpi-extended-downtime" class="text-2xl font-bold text-blue-700">0h (0)</p>
        <p class="text-xs text-blue-500 mt-1">Programadas/Manutenção</p>
    </div>

    <!-- Total Ocorrências -->
    <div class="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 border border-purple-200">
        <p class="text-xs font-semibold text-purple-600 uppercase mb-1">Total Ocorrências</p>
        <p id="kpi-downtime-count" class="text-3xl font-bold text-purple-700">0</p>
        <p id="kpi-avg-downtime" class="text-xs text-purple-500 mt-1">Média: 0h</p>
    </div>
</div>
```

### **Gráficos Separados**
```html
<!-- Seção de Gráficos Separados -->
<div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
    <!-- Paradas Normais -->
    <div class="bg-white rounded-xl shadow-lg p-4 border border-gray-200">
        <h3 class="text-lg font-bold text-gray-800 mb-4">Paradas Normais por Motivo</h3>
        <div class="h-80">
            <canvas id="normal-downtime-chart"></canvas>
        </div>
    </div>

    <!-- Paradas Longas -->
    <div class="bg-white rounded-xl shadow-lg p-4 border border-gray-200">
        <h3 class="text-lg font-bold text-gray-800 mb-4">Paradas Longas por Tipo</h3>
        <div class="h-80">
            <canvas id="extended-downtime-chart"></canvas>
        </div>
    </div>
</div>
```

### **Gráficos Consolidados**
```html
<!-- Seção Consolidada -->
<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <!-- Total por Máquina -->
    <div class="bg-white rounded-xl shadow-lg p-4 border border-gray-200">
        <h3 class="text-lg font-bold text-gray-800 mb-4">Total de Paradas por Máquina</h3>
        <div class="h-80">
            <canvas id="consolidated-downtime-chart"></canvas>
        </div>
    </div>

    <!-- Comparativo -->
    <div class="bg-white rounded-xl shadow-lg p-4 border border-gray-200">
        <h3 class="text-lg font-bold text-gray-800 mb-4">Comparativo: Normais vs Longas</h3>
        <div class="h-80">
            <canvas id="downtime-comparison-chart"></canvas>
        </div>
    </div>
</div>
```

---

## 🔧 Como Integrar

### **Passo 1: Encontre a seção de Paradas no index.html**
```html
<!-- Procure por -->
<div id="analise-downtime-section">
```

### **Passo 2: Substitua ou adicione os elementos HTML acima**

### **Passo 3: As funções JavaScript já estão prontas em script.js**
A função `analyzeExtendedDowntime()` será chamada automaticamente quando você acessar a aba de Análise > Paradas.

---

## 📊 O que cada gráfico mostra

| Gráfico | Descrição | Tipo |
|---------|-----------|------|
| **Paradas Normais por Motivo** | Distribui paradas normais (downtime_entries) por motivo | Donut |
| **Paradas Longas por Tipo** | Distribui paradas longas (extended_downtime_logs) por tipo | Donut |
| **Total por Máquina** | Total consolidado de horas parado por máquina | Barras |
| **Comparativo** | Lado a lado: paradas normais vs longas por máquina | Barras Agrupadas |

---

## 🎯 Funcionalidades Implementadas

✅ **Carregamento automático** de paradas normais e longas  
✅ **Cálculo correto** de duração (paradas ativas calculam até agora)  
✅ **Filtros** por máquina, período e turno  
✅ **Consolidação** das duas fontes em um relatório único  
✅ **KPIs** que mostram totais separados e consolidados  
✅ **Debug logs** para rastrear dados carregados  

---

## 🐛 Debug

Abra o console (F12) e procure por:
```
📊 ANÁLISE DE PARADAS LONGAS
✅ Paradas longas encontradas: X
✅ Paradas normais encontradas: Y
📊 RESUMO CONSOLIDADO: {...}
```

