# 📊 Análise Consolidada de Paradas Longas - Implementação Completa

## ✅ O que foi criado

### **1. Função Principal: `analyzeExtendedDowntime()`**
- **Localização**: `script.js` (após linha 4985)
- **Responsabilidade**: Orquestra toda a análise
- **O que faz**:
  - ✓ Busca paradas longas do Firestore (`extended_downtime_logs`)
  - ✓ Busca paradas normais (`downtime_entries`)
  - ✓ Filtra por período, máquina e turno
  - ✓ Consolida ambas as fontes
  - ✓ Gera 4 gráficos diferentes
  - ✓ Atualiza KPIs
  - ✓ Retorna dados para uso posterior

### **2. Funções de Gráficos**

#### **a) `generateExtendedDowntimeChart(extendedData)`**
- **Tipo**: Donut Chart
- **Dados**: Paradas longas agrupadas por tipo
- **Cores**: Diferentes para cada tipo (Fim de semana, Manutenção, Feriado, Outro)
- **Exibe**: Horas e percentual de cada tipo

#### **b) `generateNormalDowntimeChart(normalData)`**
- **Tipo**: Donut Chart
- **Dados**: Paradas normais agrupadas por motivo
- **Cores**: Cores padrão de status
- **Exibe**: Horas e percentual de cada motivo

#### **c) `generateConsolidatedDowntimeChart(consolidatedData)`**
- **Tipo**: Bar Chart
- **Dados**: Total consolidado por máquina
- **Exibe**: Todas as máquinas com tempo total parado
- **Cor única**: Vai variar por máquina

#### **d) `generateDowntimeComparison(normalData, extendedData)`**
- **Tipo**: Grouped Bar Chart
- **Dados**: Comparativo lado a lado
- **Barras**: 2 por máquina (Normal vs Longa)
- **Permite ver** qual tipo de parada impacta mais

### **3. Função de Resumo: `updateExtendedDowntimeSummary()`**
- **Atualiza KPIs**:
  - Total consolidado em horas
  - Paradas normais (horas + contagem)
  - Paradas longas (horas + contagem)
  - Total de ocorrências
  - Média de parada por ocorrência

### **4. Integração na Análise**
- **Quando**: Chamada automaticamente em `loadDowntimeAnalysis()`
- **Após**: Os gráficos normais de paradas serem gerados
- **Resultado**: Você terá 4 gráficos + KPIs consolidados

---

## 🎨 Layout Proposto (HTML)

Veja o arquivo `EXTENDED_DOWNTIME_UI.md` para a estrutura HTML completa.

### **Resumo Visual**:
```
┌─────────────────────────────────────────────────────────────┐
│  KPI: Total | KPI: Normal | KPI: Longa | KPI: Contagem     │
└─────────────────────────────────────────────────────────────┘

┌──────────────────────────┐  ┌──────────────────────────┐
│  Paradas Normais         │  │  Paradas Longas          │
│  (Donut por Motivo)      │  │  (Donut por Tipo)        │
└──────────────────────────┘  └──────────────────────────┘

┌──────────────────────────┐  ┌──────────────────────────┐
│  Total por Máquina       │  │  Normal vs Longa         │
│  (Barras Simples)        │  │  (Barras Agrupadas)      │
└──────────────────────────┘  └──────────────────────────┘
```

---

## 🔍 Debug & Logs

### **Como ativar Debug**
1. Abra o navegador (F12)
2. Vá para a aba **Console**
3. Acesse **Análise > Paradas**
4. Selecione filtros (máquina, período)
5. Procure por:
   ```
   🔍 DEBUG: Análise de Paradas
   📊 ANÁLISE DE PARADAS LONGAS
   📊 RESUMO CONSOLIDADO
   ```

### **Logs Importantes**
```javascript
✅ Paradas longas encontradas: X
✅ Paradas normais encontradas: Y
Total Horas: Z
Paradas Normais: A h (B ocorrências)
Paradas Longas: C h (D ocorrências)
```

---

## 🛠️ Campos Esperados no Firestore

### **Para `extended_downtime_logs`**:
```javascript
{
  machine_id: "H06",
  start_date: "2025-12-06",
  start_time: "14:30",
  end_date: "2025-12-07",
  end_time: "06:00",
  duration_minutes: 735,  // OU
  start_datetime: Timestamp,  // Para paradas ativas
  type: "maintenance",  // weekend, maintenance, holiday, other
  reason: "Manutenção preventiva",
  status: "active" | "finalized"
}
```

### **Para `downtime_entries`**:
```javascript
{
  machine: "H06",
  date: "2025-12-06",
  startTime: "14:30",
  endTime: "15:00",
  duration: 30,  // em minutos
  reason: "Falta de matéria-prima"
}
```

---

## 📈 Cálculo de Duração

### **Paradas Longas**:
- Se `status === 'active'`: `(agora - start_datetime) / (1000 * 60 * 60)` horas
- Senão: `duration_minutes / 60` horas

### **Paradas Normais**:
- Sempre: `duration / 60` horas (de minutos para horas)

---

## 🎯 Próximos Passos

### **Para você implementar**:

1. **Adicionar HTML** (veja `EXTENDED_DOWNTIME_UI.md`):
   - Cards de KPI
   - Divs para gráficos
   - Canvas para Charts.js

2. **Testar** com dados reais:
   - Selecione período com paradas
   - Verifique console para debug
   - Valide números com Firebase

3. **Ajustar filtros** se necessário:
   - Se data não corresponder, verificar formato no Firestore
   - Se máquina não filtrar, verificar `normalizeMachineId()`

4. **Customizar cores** conforme necessário:
   - Edite `colors: [...]` nas funções de gráfico
   - Ajuste nomes de tipos/motivos

---

## ⚙️ Configurações

### **Para alterar tipos de paradas longas**:
```javascript
// Em analyzeExtendedDowntime(), altere:
const type = d.type === 'weekend' ? 'Fim de Semana' :
            d.type === 'maintenance' ? 'Manutenção' :
            d.type === 'holiday' ? 'Feriado' : 'Outro';
```

### **Para alterar cores dos gráficos**:
```javascript
// Em generateExtendedDowntimeChart(), altere:
colors: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A']
```

---

## 🐛 Troubleshooting

| Problema | Causa | Solução |
|----------|-------|--------|
| Gráficos não aparecem | Sem dados no período | Verifique datas no Firebase |
| KPIs mostram 0 | Filtro muito restritivo | Amplie período/máquina |
| Consolidação errada | Duração em unidade errada | Verificar campos em Firestore |
| Máquina não filtra | Formato diferente no BD | Verificar `normalizeMachineId()` |

---

## 📞 Suporte

Se precisar de ajustes:
1. Verifique os logs no console
2. Veja estrutura de dados no Firebase
3. Ajuste os campos esperados no código
4. Rerun a análise

