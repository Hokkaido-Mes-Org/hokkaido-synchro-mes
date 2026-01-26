# Modelo de Fluxo de Apontamento de Paradas por Setor

## Objetivo
Definir responsabilidades claras para cada setor no apontamento de paradas, garantindo que cada equipe registre sua contribuição no tempo correto e com informações precisas.

---

## 1. Estrutura de Responsabilidades

### SETOR PROCESSO
**Responsável**: Operador de Máquina
**Quando Atua**: Sempre que há parada

| Campo | Descrição |
|-------|-----------|
| **Hora de Início** | Hora exata da parada |
| **Máquina/Linha** | Identificação do equipamento |
| **Motivo Inicial** | Classificação prelimar da parada |
| **Setor Chamado** | Setup, Ferramentaria ou Manutenção |
| **Hora de Fim** | Quando a máquina retorna à produção |

**Registro no Sistema**: Campo "APONTAMENTO PROCESSO"

---

### SETOR SETUP
**Responsável**: Técnico de Setup
**Quando Atua**: Quando chamado por troca/ajuste de ferramenta ou preparação

| Campo | Descrição |
|-------|-----------|
| **Hora de Chegada** | Hora que chegou ao local |
| **Hora de Início do Trabalho** | Quando iniciou a atividade |
| **Tipo de Trabalho** | Ex: "Troca de ferramenta", "Ajuste de matriz", "Preparação inicial" |
| **Ferramentas/Itens Alterados** | Especificar quais foram substituídas |
| **Hora de Término** | Quando finalizou e máquina testada |
| **Observações** | Problemas encontrados, necessidade de outros setores |

**Registro no Sistema**: Campo "APONTAMENTO SETUP"

---

### SETOR FERRAMENTARIA
**Responsável**: Técnico de Ferramentaria
**Quando Atua**: Quando chamado por problema em ferramentas, dispositivos ou matrizes

| Campo | Descrição |
|-------|-----------|
| **Hora de Chegada** | Hora que chegou ao local |
| **Hora de Início do Trabalho** | Quando iniciou diagnóstico/reparo |
| **Problema Identificado** | Ex: "Ferramenta desgastada", "Matriz quebrada", "Dispositivo travado" |
| **Ação Realizada** | "Reposição", "Reprocessamento", "Reparo" |
| **Ferramentaria Usada** | Qual ferramenta/dispositivo foi utilizado |
| **Hora de Término** | Quando finalizou o serviço |
| **Necessidade de Manutenção?** | Se sim, descrever para repassar à Manutenção |

**Registro no Sistema**: Campo "APONTAMENTO FERRAMENTARIA"

---

### SETOR MANUTENCAO
**Responsável**: Técnico de Manutenção
**Quando Atua**: Quando chamado por falha mecânica, elétrica ou manutenção preventiva

| Campo | Descrição |
|-------|-----------|
| **Hora de Chegada** | Hora que chegou ao local |
| **Hora de Início do Trabalho** | Quando iniciou a manutenção |
| **Tipo de Manutenção** | "Corretiva", "Preventiva", "Preditiva" |
| **Componente/Sistema** | Qual parte foi intervenciona |
| **Falha Encontrada** | Descrição detalhada do problema |
| **Ação Realizada** | "Substituição", "Reparo", "Ajuste", "Limpeza" |
| **Peças Utilizadas** | Especificar componentes trocados |
| **Hora de Término** | Quando finalizou e máquina retorna à operação |
| **Necessidade de Acompanhamento?** | Se sim, data e motivo |

**Registro no Sistema**: Campo "APONTAMENTO MANUTENÇÃO"

---

## 2. Fluxo de Apontamento Integrado

```
PROCESSO DETECTA PARADA
         ↓
   PROCESSO REGISTRA:
   • Hora de Início
   • Máquina
   • Motivo Inicial
   • Setor Chamado
         ↓
   ┌─────────────────────────────────────────┐
   │ SETOR RESPONSÁVEL ATENDE E REGISTRA:    │
   │ • Hora de Chegada                       │
   │ • Hora de Início                        │
   │ • Atividade Realizada                   │
   │ • Hora de Término                       │
   └─────────────────────────────────────────┘
         ↓
   PROCESSO REGISTRA:
   • Hora de Fim
   • Validação Final
   • Motivo Confirmado
         ↓
   PARADA FECHADA NO SISTEMA
```

---

## 3. Regras de Apontamento

### Regra 1: Tempo Real
- Apontamentos devem ser feitos **imediatamente**, sem atrasos.
- Máximo 5 minutos após a ação ocorrer.

### Regra 2: Especificidade
- Motivos genéricos são **proibidos**.
- Sempre informar o máximo detalhe possível.

### Regra 3: Responsabilidade Individual
- Cada setor é responsável por seus próprios apontamentos.
- Não transferir responsabilidade para outro setor.

### Regra 4: Registro Integrado
- Todos os apontamentos devem estar no mesmo ticket/ordem de parada.
- O sistema deve permitir visualizar todos os setores envolvidos.

### Regra 5: Validação
- Ao fechar a parada, o Processo valida se todos os setores completaram seus apontamentos.

---

## 4. Motivos Padrão por Setor

### PROCESSO
- [ ] Parada Operacional
- [ ] Aguardando Setup
- [ ] Aguardando Ferramentaria
- [ ] Aguardando Manutenção
- [ ] Falta de Matéria-Prima

### SETUP
- [ ] Troca de Ferramenta
- [ ] Troca de Matriz
- [ ] Ajuste de Parâmetros
- [ ] Preparação de Máquina
- [ ] Teste de Qualidade
- [ ] Material Contaminado

### FERRAMENTARIA
- [ ] Ferramenta Desgastada
- [ ] Ferramenta Quebrada
- [ ] Matriz Danificada
- [ ] Dispositivo com Problema
- [ ] Reprocessamento de Ferramenta

### MANUTENÇÃO
- [ ] Falha Mecânica
- [ ] Falha Elétrica
- [ ] Falha Hidráulica
- [ ] Manutenção Preventiva
- [ ] Limpeza/Lubrificação
- [ ] Vazamento

---

## 5. Exemplo Prático de Preenchimento

**APONTAMENTO PROCESSO**
- Hora de Início: 08:30
- Máquina: Injetora 05
- Motivo Inicial: Aguardando Setup
- Setor Chamado: Setup
- Hora de Fim: 09:15

**APONTAMENTO SETUP**
- Hora de Chegada: 08:32
- Hora de Início: 08:33
- Tipo de Trabalho: Troca de Ferramenta
- Ferramentas Alteradas: Pino Macho nº 12 (desgastado)
- Hora de Término: 09:10
- Observações: Ferramenta descartada após reprocessamento

**APONTAMENTO MANUTENÇÃO** (se necessário)
- Não foi necessário neste caso

---

## 6. Sistema de Validação

- [ ] Processo preencheu hora de início e fim
- [ ] Setor responsável preencheu suas atividades
- [ ] Todos os campos obrigatórios estão completos
- [ ] Horários são consistentes (início < fim)
- [ ] Motivo está entre as opções padrão ou justificado

---

## 7. Implementação no Sistema (Fluxo Prático)

### 7.1. Interface de Apontamento - Tela Principal do Processo

**Ao detectar parada (Operador de Máquina)**

```
┌─────────────────────────────────────────────────────────┐
│  APONTAMENTO DE PARADA - SETOR PROCESSO                 │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Máquina: [Injetora 05              ]                   │
│  Hora de Início: [08:30:45]  (Auto-preenchido)         │
│  Data: [26/01/2026]                                     │
│                                                         │
│  Motivo Principal:                                      │
│  ○ Parada Operacional                                   │
│  ○ Aguardando Setup          (Selecionar)               │
│  ○ Aguardando Ferramentaria                             │
│  ○ Aguardando Manutenção                                │
│  ○ Falta de Matéria-Prima                               │
│                                                         │
│  Setor Responsável:                                     │
│  [Setup              ]                                  │
│                                                         │
│  Observação Inicial:                                    │
│  [_________________________________]                   │
│                                                         │
│  ┌─────────────┐         ┌──────────────┐              │
│  │   CONFIRMAR │         │    CANCELAR  │              │
│  └─────────────┘         └──────────────┘              │
│                                                         │
│  Status: ⏳ AGUARDANDO SETUP                            │
└─────────────────────────────────────────────────────────┘
```

**Ação do Sistema:**
- Registra início automático com timestamp
- Cria ID único para a parada (ex: PD-20260126-001)
- Notifica Setup que foi chamado
- Status muda para "AGUARDANDO"

---

### 7.2. Recebimento no Setor Chamado (Setup)

**Notificação que chega ao Setup (Dashboard)**

```
┌─────────────────────────────────────────────────────────┐
│  PARADAS AGUARDANDO SETUP                               │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ 🔴 PD-20260126-001 - Injetora 05              │   │
│  │ Hora: 08:30 | Setor: PROCESSO                 │   │
│  │ Motivo: Aguardando Setup                       │   │
│  │                                                 │   │
│  │ [ ACEITAR TAREFA ]                            │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Ao clicar em "ACEITAR TAREFA":**

```
┌─────────────────────────────────────────────────────────┐
│  APONTAMENTO SETUP - ID: PD-20260126-001                │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Máquina: Injetora 05                                   │
│  Parada Iniciada em: 08:30                              │
│                                                         │
│  🕐 Meu Atendimento:                                    │
│                                                         │
│  ✓ Hora de Chegada: [08:32:15]  (Auto-preenchido)     │
│  ✓ Hora de Início: [CLIQUE PARA INICIAR]              │
│                                                         │
│  Tipo de Trabalho:                                      │
│  ○ Troca de Ferramenta                                  │
│  ○ Troca de Matriz                                      │
│  ○ Ajuste de Parâmetros                                │
│  ○ Preparação de Máquina                                │
│  ○ Teste de Qualidade                                   │
│                                                         │
│  Ferramentas/Itens Alterados:                           │
│  [_________________________________]                   │
│                                                         │
│  ┌──────────────┐         ┌────────────┐              │
│  │ INICIAR TRAB │         │   RECUSAR  │              │
│  └──────────────┘         └────────────┘              │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

### 7.3. Registro Automático de Tempos

**Ao clicar em "INICIAR TRABALHO":**

```
┌─────────────────────────────────────────────────────────┐
│  APONTAMENTO SETUP - ID: PD-20260126-001                │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Status: ⏳ SETUP TRABALHANDO                           │
│  ⏱️ Tempo Decorrido: 5 min 42 seg                       │
│                                                         │
│  Hora de Chegada: 08:32:15 ✓                           │
│  Hora de Início: 08:33:20 ✓                            │
│  Hora Estimada de Término: [CALCULAR] ou [MANUAL]      │
│                                                         │
│  Tipo de Trabalho: Troca de Ferramenta    ✓             │
│  Ferramentas Alteradas: Pino Macho nº 12  ✓             │
│                                                         │
│  Observações Durante o Trabalho:                        │
│  [_________________________________]                   │
│                                                         │
│  Necessário Envolver Outro Setor?                       │
│  ○ Não  ○ Manutenção  ○ Ferramentaria                  │
│                                                         │
│  ┌──────────────┐         ┌────────────┐              │
│  │  CONCLUÍDO   │         │  PAUSAR    │              │
│  └──────────────┘         └────────────┘              │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

### 7.4. Finalização do Apontamento (Setor)

**Ao clicar em "CONCLUÍDO":**

```
┌─────────────────────────────────────────────────────────┐
│  CONFIRMAÇÃO DE TÉRMINO - SETUP                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ID Parada: PD-20260126-001                             │
│  Máquina: Injetora 05                                   │
│                                                         │
│  ⏱️ RESUMO DO ATENDIMENTO:                              │
│                                                         │
│  Hora de Chegada:  08:32:15                             │
│  Hora de Início:   08:33:20                             │
│  Hora de Término:  09:10:45                             │
│  Tempo Total:      38 min 25 seg                        │
│  Tempo de Trabalho: 37 min 25 seg                       │
│                                                         │
│  Status Máquina:                                        │
│  ○ Máquina Testada e Ok                                │
│  ○ Máquina Testada com Problema (descrever)            │
│  ○ Aguardando Teste do Processo                        │
│                                                         │
│  Relatório:                                             │
│  ✓ Troca de Ferramenta - Pino Macho nº 12             │
│  ✓ Ferramenta Reprocessada                             │
│  ✓ Máquina Testada com Sucesso                         │
│                                                         │
│  ┌────────────────────┐    ┌──────────────┐           │
│  │ CONFIRMAR TÉRMINO  │    │   VOLTAR     │           │
│  └────────────────────┘    └──────────────┘           │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Ação do Sistema:**
- Registra hora de término automaticamente
- Calcula tempo total de atendimento
- Notifica Processo que pode retomar produção
- Salva todos os dados no banco

---

### 7.5. Validação e Fechamento (Processo)

**Dashboard do Processo mostra:**

```
┌─────────────────────────────────────────────────────────┐
│  PARADA RESOLVIDA - VALIDAÇÃO NECESSÁRIA                │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ID: PD-20260126-001 | Injetora 05                      │
│  Status: ✓ SETUP CONCLUÍDO | ⏳ AGUARDANDO VALIDAÇÃO   │
│                                                         │
│  📋 HISTÓRICO DA PARADA:                                │
│                                                         │
│  [PROCESSO]                                             │
│  • Início: 08:30:45                                     │
│  • Setor Chamado: Setup                                 │
│                                                         │
│  [SETUP] ✓                                              │
│  • Chegada: 08:32:15                                    │
│  • Início: 08:33:20                                     │
│  • Término: 09:10:45                                    │
│  • Atividade: Troca de Ferramenta                       │
│                                                         │
│  Validar:                                               │
│  ✓ Máquina retomou produção?                            │
│                                                         │
│  Motivo Final Confirmado:                               │
│  ○ Troca de Ferramenta - Setup                          │
│  ○ Outro (descrever)                                    │
│                                                         │
│  Hora de Fim: [09:12:00]  (Auto-preenchido)            │
│  Tempo Total de Parada: 1h 42min                        │
│                                                         │
│  ┌─────────────────┐         ┌────────────┐            │
│  │  VALIDAR E FECHAR  │     │  REABRIR   │            │
│  └─────────────────┘         └────────────┘            │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

### 7.6. Validações Automáticas do Sistema

**O sistema valida automaticamente:**

```
✓ Hora de início < Hora de fim
✓ Setor apontou antes de Processo fechar
✓ Todos os campos obrigatórios preenchidos
✓ Motivo está na lista padrão
✓ Tempo de atendimento é realista
✓ Não há sobreposição de horários
✓ Status da máquina foi confirmado
```

**Se algo estiver errado, o sistema impede o fechamento:**

```
❌ ERRO: Hora de término do Setup (09:10) é DEPOIS de
         Hora de fim da parada (09:12). Impossível!

[CORRIGIR] [RECUSAR APONTAMENTO SETUP]
```

---

### 7.7. Banco de Dados - Estrutura de Armazenamento

**Tabela: PARADAS**
```
ID_PARADA       | PD-20260126-001
MAQUINA_ID      | INJ-005
DATA_PARADA     | 2026-01-26
HORA_INICIO     | 08:30:45
HORA_FIM        | 09:12:00
TEMPO_TOTAL_MIN | 102
STATUS          | FECHADA
MOTIVO_FINAL    | Troca de Ferramenta - Setup
```

**Tabela: APONTAMENTOS_SETORES**
```
ID_APONTAMENTO     | APT-001-SETUP
ID_PARADA          | PD-20260126-001
SETOR              | SETUP
USUARIO            | João Silva
HORA_CHEGADA       | 08:32:15
HORA_INICIO_TRAB   | 08:33:20
HORA_TERMINO       | 09:10:45
TIPO_TRABALHO      | Troca de Ferramenta
TEMPO_ATENDIMENTO  | 37:25
DESCRICAO          | Pino Macho nº 12 substituído
STATUS             | CONCLUÍDO
```

---

### 7.8. Relatórios Gerados Automaticamente

**Relatório Diário Consolidado:**

```
RESUMO DE PARADAS - 26/01/2026
═══════════════════════════════════════════════════════════

PARADA 1: PD-20260126-001
├─ Máquina: Injetora 05
├─ Tempo Total: 1h 42min
├─ Setor Responsável: SETUP
├─ Motivo: Troca de Ferramenta
└─ Status: ✓ FECHADA

PARADA 2: PD-20260126-002
├─ Máquina: Extrusora 02
├─ Tempo Total: 2h 15min
├─ Setor Responsável: MANUTENÇÃO
├─ Motivo: Falha Mecânica
└─ Status: ✓ FECHADA

ESTATÍSTICAS:
─────────────────────────────────────────────────────────
Total de Paradas: 2
Tempo Total Parado: 3h 57min
Setor Mais Chamado: SETUP (60%)
Tempo Médio por Atendimento: 1h 59min
Paradas Hoje: 2 | Paradas Semana: 14
```

---

### 7.9. Fluxo de Dados Completo no Sistema

```
┌─────────────────────────────────────────────────────────┐
│          OPERADOR DETECTA PARADA (Processo)             │
└─────────────────────────┬───────────────────────────────┘
                          │ Registra Início + Motivo
                          ↓
        ┌─────────────────────────────────────┐
        │  SISTEMA CRIA ID ÚNICO DA PARADA    │
        │  E NOTIFICA SETOR CHAMADO           │
        └─────────────────────────────────────┘
                          ↓
        ┌─────────────────────────────────────┐
        │  SETOR CHAMADO RECEBE NOTIFICAÇÃO   │
        │  EM SEU DASHBOARD                   │
        └─────────────────────────────────────┘
                          ↓
        ┌─────────────────────────────────────┐
        │  SETOR ACEITA E INICIA TRABALHO     │
        │  (Sistema registra chegada + início) │
        └─────────────────────────────────────┘
                          ↓
        ┌─────────────────────────────────────┐
        │  SETOR TRABALHA E FINALIZA          │
        │  (Sistema registra término)          │
        └─────────────────────────────────────┘
                          ↓
        ┌─────────────────────────────────────┐
        │  SISTEMA NOTIFICA PROCESSO QUE      │
        │  SETOR TERMINOU                     │
        └─────────────────────────────────────┘
                          ↓
        ┌─────────────────────────────────────┐
        │  PROCESSO VALIDA E FECHA A PARADA   │
        │  (Registra fim + motivo final)      │
        └─────────────────────────────────────┘
                          ↓
        ┌─────────────────────────────────────┐
        │  SISTEMA GERA RELATÓRIO E ARQUIVA   │
        │  DADOS NO BANCO DE DADOS            │
        └─────────────────────────────────────┘
```

---

### 7.10. Integração com Aplicativo Mobile (Opcional)

**O técnico de Setup recebe notificação no celular:**

```
📱 SMARTPHONE TÉCNICO SETUP

┌─────────────────────────────┐
│ 🔔 NOVA PARADA ATRIBUÍDA   │
├─────────────────────────────┤
│                             │
│ Injetora 05                 │
│ 08:30 - Há 2 minutos       │
│                             │
│ Motivo: Aguardando Setup    │
│                             │
│ [ACEITAR] [RECUSAR]        │
│                             │
└─────────────────────────────┘

(Ao aceitar, abre formulário para preenchimento)
```

---

### 7.11. Alertas e Controles

**O sistema alerta quando:**

- ⚠️ Uma parada está aberta há mais de 30 minutos sem atendimento
- ⚠️ Um setor não completou seu apontamento em 2 horas
- ⚠️ O tempo de atendimento excede o esperado para aquela atividade
- ⚠️ Um apontamento foi cancelado ou rejeitado
- ⚠️ Há inconsistência entre os horários informados

---

**Documento elaborado em 26/01/2026**
