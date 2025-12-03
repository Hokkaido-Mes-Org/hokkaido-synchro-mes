# 📚 PLANO DE TREINAMENTO - SISTEMA SYNCHRO MES
**Hokkaido Plastics - Manufacturing Execution System**

**Data:** 02 de Dezembro de 2025  
**Versão do Sistema:** v2.0 (Otimizado)  
**Público:** Operadores, Líderes, Gestores, Administradores

---

## 📋 ÍNDICE DO TREINAMENTO

1. [Estrutura Geral do Sistema](#1-estrutura-geral-do-sistema)
2. [Módulo 1: Autenticação e Acesso](#2-módulo-1-autenticação-e-acesso)
3. [Módulo 2: Painel Lançamento](#3-módulo-2-painel-lançamento)
4. [Módulo 3: Planejamento de Produção](#4-módulo-3-planejamento-de-produção)
5. [Módulo 4: Ordens de Produção](#5-módulo-4-ordens-de-produção)
6. [Módulo 5: Paradas Longas](#6-módulo-5-paradas-longas)
7. [Módulo 6: Análise de Dados](#7-módulo-6-análise-de-dados)
8. [Recurso Adicional: Filtro de Lançamentos Históricos](#8-recurso-adicional-filtro-de-lançamentos-históricos)
9. [Troubleshooting e FAQ](#9-troubleshooting-e-faq)
10. [Cronograma de Treinamento](#10-cronograma-de-treinamento)

---

## 1. ESTRUTURA GERAL DO SISTEMA

### O que é SYNCHRO MES?

SYNCHRO é um **Manufacturing Execution System (MES)** em nuvem que integra:
- 📊 **Produção em Tempo Real** - Registre lançamentos conforme acontecem
- 📋 **Planejamento** - Organize a produção do dia por máquina
- 📦 **Gestão de Ordens** - Cadastre e acompanhe OPs (Ordens de Produção)
- ⏸️ **Paradas** - Registre manutenções, feriados e paradas longas
- 📈 **Análise** - Visualize KPIs, OEE, eficiência e gráficos

### Arquitetura do Sistema

```
┌─────────────────────────────────────────────────────────┐
│              SYNCHRO MES - ARQUITETURA                  │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────┐    ┌──────────────┐    ┌───────────┐ │
│  │  Navegação   │    │  Header Info │    │   Logout  │ │
│  │ (5 Abas)     │    │  (Usuário)   │    │           │ │
│  └──────────────┘    └──────────────┘    └───────────┘ │
│                                                          │
│  ┌─────────────────────────────────────────────────────┐│
│  │  ABAS PRINCIPAIS (Clique para navegar)              ││
│  ├─────────────────────────────────────────────────────┤│
│  │  📋 Planejamento  →  Organize produção do dia      ││
│  │  📦 Ordens        →  Cadastre e gerencie OPs       ││
│  │  ⏸️  Paradas      →  Registre paradas longas       ││
│  │  📊 Lançamento    →  Produção em tempo real        ││
│  │  📈 Análise       →  KPIs, OEE, gráficos           ││
│  └─────────────────────────────────────────────────────┘│
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Fluxo Típico de Uso

```
DIA DE TRABALHO
     ↓
[1] Líder planeja máquinas para o dia (PLANEJAMENTO)
     ↓
[2] Operadores começam produção (LANÇAMENTO)
     ↓
[3] Se há parada não planejada → Registra (PARADAS/LANÇAMENTO)
     ↓
[4] Operador faz lançamentos: Produzido, Refugo, Borra, Retrabalho
     ↓
[5] Sistema calcula KPIs em tempo real (OEE, Eficiência, Qualidade)
     ↓
[6] Ao final do dia → Consulta ANÁLISE para métricas
```

---

## 2. MÓDULO 1: AUTENTICAÇÃO E ACESSO

### Login

**Como fazer:**
1. Acesse: `https://synchro-hokkaido.web.app` (URL do sistema)
2. Insira email e senha
3. Clique em "Entrar"

**Tipos de Usuários:**

| Tipo | Permissões | Acesso |
|------|-----------|--------|
| **Operador** | ✅ Fazer lançamentos | Lançamento apenas |
| **Líder** | ✅ Planejamento, Lançamento | Planejamento + Lançamento |
| **Gestor** | ✅ Tudo menos editar OPs | Todas abas |
| **Admin** | ✅ Acesso total | Sistema completo |

### Informações do Header

```
[Logo Hokkaido] [Usuário: João Silva] [Turno Atual: 2º] [Horário] [Logout]
```

- **Usuário:** Mostra quem está logado
- **Turno:** Indica qual turno está em andamento (1º/2º/3º)
- **Horário:** Atualiza em tempo real
- **Logout:** Clique para sair

---

## 3. MÓDULO 2: PAINEL LANÇAMENTO

### Objetivo
Registrar **em tempo real** toda a produção da máquina: peças produzidas, refugos, borra e retrabalho.

### Características Principais

#### 1️⃣ **Seleção de Máquina**

```
┌─────────────────────────────────────────────────────────┐
│  Selecione uma máquina clicando no card:                │
├─────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │   H01    │  │   H02    │  │   H03    │  ...         │
│  │ Produto  │  │ Produto  │  │ Produto  │              │
│  │ 85.5% OEE│  │ 92.1% OEE│  │ 78.3% OEE│              │
│  │ 450 exec │  │ 520 exec │  │ 380 exec │              │
│  │ 50 falta │  │ 30 falta │  │ 120 falta│              │
│  └──────────┘  └──────────┘  └──────────┘              │
└─────────────────────────────────────────────────────────┘
```

**Informações no Card:**
- **Máquina:** Identificação (H01, H02, etc)
- **Produto:** Nome do produto em produção
- **OEE (%):** Eficiência geral da máquina
- **Exec OP:** Quantidade já produzida
- **Faltante:** Quantidade que falta produzir
- **Barra de Progresso:** Visual do avanço da OP

#### 2️⃣ **Painel de Controle (após selecionar máquina)**

```
┌─────────────────────────────────────────────────────────┐
│  PAINEL DE CONTROLE - Máquina: H01                      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  [Card da Máquina Selecionada]                          │
│  ┌─────────────────────────────────────────────────────┐│
│  │ H01 | Produto XYZ | Status: Rodando | 02:45h      ││
│  └─────────────────────────────────────────────────────┘│
│                                                          │
│  [KPIs do Turno]                                        │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐       │
│  │ 500     │ │ 88.5%   │ │ 12      │ │ 1.5h    │       │
│  │Produzido│ │OEE      │ │Refugos  │ │Parado   │       │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘       │
│                                                          │
│  [Ações Rápidas]                                        │
│  ┌──────────────────────────────────────────────────────┐│
│  │ [➕ PRODUÇÃO] [⚠️  REFUGO] [💨 BORRA] [🔄 RETRABALHO]│
│  │ [⏸️  PARADA]  [⏹️  DESLIGAR] [📊 GRÁFICO] [🔄 RECARREGAR]
│  └──────────────────────────────────────────────────────┘│
│                                                          │
│  [Gráfico de Produção do Turno]                         │
│  (Timeline visual com estapas de produção)              │
│                                                          │
│  [Lançamentos Recentes]                                 │
│  ┌─────────────────────────────────────────────────────┐│
│  │ 12:30 | 100 peças Produzidas | João Silva          ││
│  │ 12:15 | 5 kg Refugo | João Silva                   ││
│  │ 12:00 | 8 kg Borra | João Silva                    ││
│  └─────────────────────────────────────────────────────┘│
│                                                          │
└─────────────────────────────────────────────────────────┘
```

#### 3️⃣ **Como Fazer um Lançamento**

**LANÇAMENTO DE PRODUÇÃO (Peças Produzidas)**

Passo 1: Clique em **[➕ PRODUÇÃO]**

```
┌────────────────────────────────┐
│ Lançamento de Produção         │
├────────────────────────────────┤
│                                │
│ Máquina: H01                   │
│ Produto: XYZ (Código: 2541)   │
│ Peso da peça: 25.3g           │
│                                │
│ ┌──────────────────────────────┐│
│ │ Quantidade: [_____]          ││  ← Digite quantidade
│ │ OU Peso: [_____] kg          ││  ← OU peso (automático)
│ │                              ││
│ │ ☑️ Usar Tara (peso máquina)   ││
│ │                              ││
│ │ [Cancelar]  [Confirmar]      ││
│ └──────────────────────────────┘│
│                                │
└────────────────────────────────┘
```

Passo 2: Insira a quantidade de peças **OU** peso da produção

Passo 3: Clique em **[Confirmar]**

**OU**

**LANÇAMENTO POR PESO (Alternativa)**

Se preferir, use a balança:
1. Coloque as peças na balança
2. Insira o peso lido (em kg)
3. O sistema calcula quantidade automaticamente
4. Clique em **[Confirmar]**

---

**LANÇAMENTO DE REFUGO (Peças com Defeito)**

Passo 1: Clique em **[⚠️  REFUGO]**

```
┌────────────────────────────────┐
│ Lançamento de Refugo           │
├────────────────────────────────┤
│                                │
│ Máquina: H01                   │
│ Motivo: [Selecione...]         │ ← Escolha motivo
│                                │
│ ┌──────────────────────────────┐│
│ │ Peso Refugo: [_____] kg      ││  ← Peso em kg
│ │                              ││
│ │ [Cancelar]  [Confirmar]      ││
│ └──────────────────────────────┘│
│                                │
└────────────────────────────────┘
```

Passo 2: Selecione o **motivo** (Defeito, Dimensão, Queimado, etc)

Passo 3: Insira o **peso em kg** do refugo

Passo 4: Clique em **[Confirmar]**

---

**LANÇAMENTO DE BORRA (Teste/Calibração)**

Passo 1: Clique em **[💨 BORRA]**

```
┌────────────────────────────────┐
│ Lançamento de Borra            │
├────────────────────────────────┤
│                                │
│ Máquina: H01                   │
│                                │
│ ┌──────────────────────────────┐│
│ │ Peso Borra: [_____] kg       ││  ← Peso em kg
│ │                              ││
│ │ [Cancelar]  [Confirmar]      ││
│ └──────────────────────────────┘│
│                                │
└────────────────────────────────┘
```

Passo 2: Insira o **peso em kg** da borra

Passo 3: Clique em **[Confirmar]**

---

**LANÇAMENTO DE RETRABALHO (Peças Reprocessadas)**

Passo 1: Clique em **[🔄 RETRABALHO]**

```
┌────────────────────────────────┐
│ Lançamento de Retrabalho       │
├────────────────────────────────┤
│                                │
│ Máquina: H01                   │
│ Produto: XYZ (Código: 2541)   │
│                                │
│ ┌──────────────────────────────┐│
│ │ Quantidade: [_____]          ││  ← Peças retrabalha
│ │                              ││
│ │ [Cancelar]  [Confirmar]      ││
│ └──────────────────────────────┘│
│                                │
└────────────────────────────────┘
```

Passo 2: Insira a **quantidade de peças** retrabalho

Passo 3: Clique em **[Confirmar]**

⚠️ **Nota:** Retrabalho é **subtraído** do total produzido

---

**REGISTRO DE PARADA (Máquina Parou)**

Passo 1: Clique em **[⏸️  PARADA]**

```
┌────────────────────────────────┐
│ Registrar Parada               │
├────────────────────────────────┤
│                                │
│ Máquina: H01                   │
│                                │
│ Tipo:  [Selecione...]          │ ← Manutenção, Problema, etc
│ Motivo: [Selecione...]         │ ← Específico
│ Descrição: [___________]       │ ← Opcional
│                                │
│ [Cancelar]  [Confirmar]        │
│                                │
└────────────────────────────────┘
```

Passo 2: Selecione o **Tipo** e **Motivo** da parada

Passo 3: (Opcional) Descreva detalhes

Passo 4: Clique em **[Confirmar]**

Sistema registra automaticamente a hora de início. Quando máquina voltar a rodar, clique novamente para encerrar.

---

#### 4️⃣ **Lançamentos Recentes**

Na parte inferior do painel, veja histórico dos lançamentos:

```
┌─────────────────────────────────────────────────────────┐
│ LANÇAMENTOS RECENTES                                    │
├─────────────────────────────────────────────────────────┤
│ 12:45 | ✅ 150 peças Produzidas | João Silva           │
│ 12:30 | ⚠️  5 kg Refugo (Defeito) | João Silva         │
│ 12:15 | 💨 3.2 kg Borra | João Silva                   │
│ 12:00 | ⏸️  Parada por Manutenção | João Silva         │
│ 11:45 | 🔄 20 peças Retrabalho | João Silva            │
└─────────────────────────────────────────────────────────┘
```

**Filtros de Tipo:**
- Clique em abas para ver apenas: Todos | Produção | Refugo | Borra | Retrabalho

**Filtro de Data:**
- Use os filtros acima para ver lançamentos de outros dias

---

## 4. MÓDULO 3: PLANEJAMENTO DE PRODUÇÃO

### Objetivo
Organizador do dia: Defina quais máquinas produzirão qual produto, em que quantidade e com qual matéria-prima.

### Como Acessar
Clique em **[📋 PLANEJAMENTO]** no menu lateral

### Seções Principais

#### 1️⃣ **KPIs do Planejamento (Dashboard)**

```
┌──────────────┬──────────────┬──────────────┬──────────────┐
│ 15 Itens     │ 32 Máquinas  │ 45.000       │ 8 Produtos   │
│ Planejados   │ Ativas       │ Peças Total  │ Únicos       │
└──────────────┴──────────────┴──────────────┴──────────────┘
```

#### 2️⃣ **Novo Planejamento (Formulário)**

**Seção 1: Dados da OP (Excel)**

```
┌────────────────────────────────────────┐
│ Buscar Ordem de Produção               │
│ [_________________] 🔍                 │
│                                        │
│ Resultados: (Clique para selecionar)  │
│ □ OP-2541 | Cliente: Acme | 5000 un  │
│ □ OP-2542 | Cliente: Beta | 3000 un  │
│                                        │
│ ┌──────────────┬──────────────┐       │
│ │ Tamanho Lote │    Máquina   │       │
│ │   [5000]     │  [H01 ▼]     │       │
│ └──────────────┴──────────────┘       │
└────────────────────────────────────────┘
```

**Seção 2: Dados do Produto (Cadastro)**

```
┌────────────────────────────────────────┐
│ Código: [2541]                         │
│ Nome: Peça XYZ                         │
│ ┌──────┬────────┬───────┐             │
│ │Ciclo │Cavidades│Peso  │             │
│ │ 15s  │   4    │25.3g │             │
│ └──────┴────────┴───────┘             │
└────────────────────────────────────────┘
```

**Seção 3: Matéria-Prima e Quantidade**

```
┌────────────────────────────────────────┐
│ Matéria-Prima: [Polipropileno ▼]      │
│                                        │
│ Quantidade Planejada:                 │
│ (Calculada com 85% eficiência)        │
│ [_____________________]               │
│                                        │
│ [Adicionar ao Plano]                  │
└────────────────────────────────────────┘
```

**Passo a Passo:**
1. Busque a OP digitando o número
2. Selecione a OP desejada
3. Escolha a máquina
4. Selecione a matéria-prima
5. Quantidade é calculada automaticamente
6. Clique em **[Adicionar ao Plano]**

#### 3️⃣ **Painel de Lançamento Ciclo/Cavidades**

Após adicionar ao plano, aparecem cards para configurar os parâmetros reais:

```
┌──────────────────────────────────────┐
│  H01 | Peça XYZ                      │
│  MP: Polipropileno                   │
│                                      │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐
│  │ 🟡 T1   │  │ 🔴 T2   │  │ 🔴 T3   │
│  │ Ciclo: ✓│  │ Ciclo: ✗│  │ Ciclo: ✗│
│  │ Cav: ✓  │  │ Cav: ✗  │  │ Cav: ✗  │
│  └─────────┘  └─────────┘  └─────────┘
│
│  [1º Turno] [2º Turno] [3º Turno]
└──────────────────────────────────────┘
```

**Para cada turno:**
1. Clique no botão do turno (Ex: "1º Turno")
2. Insira o **Ciclo Real** (tempo em segundos)
3. Insira **Cavidades Ativas**
4. Salve

Status muda para ✅ quando preenchido.

#### 4️⃣ **Tabela de Controle Ciclo/Cavidade**

Visualiza todos os itens planejados:

```
┌──────┬──────────┬────┬────────────────────────────────┐
│ Máq. │ Produto  │ MP │    Ciclo/Cavidades por Turno   │
├──────┼──────────┼────┼────────────────────────────────┤
│ H01  │ Peça XYZ │ PP │ T1: 15s/4 | T2: -- | T3: --   │
│ H02  │ Peça ABC │ PP │ T1: 12s/6 | T2: 12s/6 | T3: --│
└──────┴──────────┴────┴────────────────────────────────┘
```

**Ações:**
- 🔍 Filtro de busca (máquina/produto)
- ⬇️ Exportar (CSV para Excel)
- 🖨️ Imprimir

---

## 5. MÓDULO 4: ORDENS DE PRODUÇÃO

### Objetivo
Cadastre as Ordens de Produção (OPs) que virão do ERP ou Excel, com informações de cliente, produto, quantidade.

### Como Acessar
Clique em **[📦 ORDENS]** no menu lateral

### Funcionalidades

#### 1️⃣ **KPIs de Resumo**

```
┌──────────────┬──────────────┬──────────────┬──────────────┐
│ 45 OPs       │ 28 Ativas    │ 12 Concluídas│ 78% Progresso│
│ Total        │ em Andamento │ Finalizadas  │ Médio        │
└──────────────┴──────────────┴──────────────┴──────────────┘
```

#### 2️⃣ **Ações Rápidas**

```
[✨ Nova OP] [⬆️  Importar Excel] [➕ Novo Produto]
```

- **Nova OP:** Cria uma OP manualmente
- **Importar Excel:** Lê arquivo Excel com OPs
- **Novo Produto:** Cadastra novo produto no banco

#### 3️⃣ **Filtros**

```
[Buscar OP] [Status ▼] [Máquina ▼] [Ordenação ▼]
```

- **Buscar:** Por nº OP, produto, cliente
- **Status:** Planejada | Ativa | Em Andamento | Concluída | Cancelada
- **Máquina:** Filtrar por máquina específica
- **Ordenação:** Recentes | Maior Progresso | Menor Progresso | A-Z

#### 4️⃣ **Visualizações**

**CARDS (Padrão)**

```
┌──────────────────────────────┐
│ OP-2541                      │
│ Peça XYZ | Cliente: Acme     │
│                              │
│ Máquina: H01                 │
│ Lote: 5.000 peças            │
│                              │
│ Progresso: ████████░░ 78%   │
│ Status: ✅ Concluída        │
│                              │
│ [Editar] [Detalhes]          │
└──────────────────────────────┘
```

**TABLE (Alternativa)**

| OP | Produto | Máquina | Lote | Progresso | Status | Ações |
|----|---------|---------|----|-----------|--------|-------|
| 2541 | XYZ | H01 | 5000 | 78% | Concluída | ⋯ |

#### 5️⃣ **Editar OP**

Clique em **[Editar]** no card para modificar:
- Número da OP
- Produto
- Cliente
- Lote
- Máquina
- Status

#### 6️⃣ **Modal: Nova OP**

```
┌──────────────────────────────────┐
│ Criar Nova OP                    │
├──────────────────────────────────┤
│ Nº OP: [_________________]      │
│ Cliente: [_________________]    │
│ Produto: [_________________]    │
│ Quantidade: [__________]        │
│ Máquina: [__________]           │
│ Status: [Planejada ▼]           │
│                                 │
│ [Cancelar] [Criar OP]           │
└──────────────────────────────────┘
```

#### 7️⃣ **Modal: Importar Excel**

```
┌──────────────────────────────────┐
│ Importar OPs do Excel           │
├──────────────────────────────────┤
│                                 │
│ [Selecione arquivo Excel]       │
│                                 │
│ Colunas esperadas:              │
│ □ Nº OP  □ Cliente  □ Produto  │
│ □ Quantidade  □ Máquina        │
│                                 │
│ [Cancelar] [Importar]           │
└──────────────────────────────────┘
```

**Passo a Passo:**
1. Clique em **[⬆️  Importar Excel]**
2. Selecione arquivo com OPs
3. Sistema valida formato
4. Clique em **[Importar]**
5. OPs aparecem na lista

---

## 6. MÓDULO 5: PARADAS LONGAS

### Objetivo
Registrar paradas de fim de semana, manutenção programada, feriados, para que o sistema não contabilize como inatividade anormal.

### Como Acessar
Clique em **[⏸️  PARADAS LONGAS]** no menu lateral

### Seções

#### 1️⃣ **Formulário: Registrar Parada Longa**

```
┌────────────────────────────────────────┐
│ REGISTRAR PARADA LONGA                │
├────────────────────────────────────────┤
│                                        │
│ Máquinas: [H01, H02, H03] (selecione) │
│ Tipo: [Manutenção Programada ▼]       │
│ Data Início: [2025-12-06]             │
│ Data Fim: [2025-12-07]                │
│ Hora Início: [08:00]                  │
│ Hora Fim: [16:00]                    │
│ Motivo: [Manutenção preventiva ▼]    │
│                                        │
│ Duração Estimada: 32 horas            │
│                                        │
│ [Registrar Parada Longa]              │
│                                        │
└────────────────────────────────────────┘
```

**Campos Obrigatórios:**
- ✓ **Máquinas:** Selecione uma ou mais (use Ctrl/Shift)
- ✓ **Tipo:** Manutenção Programada | Feriado | Fim de Semana | Limpeza | Outro
- ✓ **Data Início/Fim:** Período da parada
- ✓ **Motivo:** Especificar

**Campos Opcionais:**
- Hora Início/Fim: Se houver horário específico

**Exemplo de Uso:**

| Cenário | Tipo | Data | Motivo |
|---------|------|------|--------|
| Sexta-feira sem produção | Fim de Semana | 06/12 a 07/12 | Sem produção |
| Manutenção planejada | Manutenção Prog. | 10/12 | Óleo/troca filtro |
| Feriado | Feriado | 25/12 | Natal |

#### 2️⃣ **Paradas Registradas**

Abaixo do formulário, lista todas as paradas registradas:

```
┌─────────────────────────────────────────┐
│ PARADAS REGISTRADAS                     │
├─────────────────────────────────────────┤
│ [H01, H02] | Manutenção | 06/12 à 07/12 │
│   Motivo: Manutenção preventiva         │
│   Duração: 32h | [Editar] [Deletar]     │
│                                         │
│ [H03] | Feriado | 25/12                 │
│   Motivo: Natal                         │
│   Duração: 24h | [Editar] [Deletar]     │
└─────────────────────────────────────────┘
```

**Ações:**
- **[Editar]:** Modifique data, tipo, motivo
- **[Deletar]:** Remova parada registrada (cuidado!)

---

## 7. MÓDULO 6: ANÁLISE DE DADOS

### Objetivo
Visualizar KPIs, indicadores de performance, gráficos e tendências de produção.

### Como Acessar
Clique em **[📈 ANÁLISE]** no menu lateral

### KPIs Principais Exibidos

```
┌──────────────┬──────────────┬──────────────┬──────────────┐
│    OEE       │  QUALIDADE   │  EFICIÊNCIA  │  PRODUÇÃO    │
│    85.3%     │    96.5%     │    78.2%     │   4.250 un   │
│ (do dia)     │ (refugos/bla)│ (ciclo real) │ (acumulada)  │
└──────────────┴──────────────┴──────────────┴──────────────┘
```

**Definições:**

- **OEE (Overall Equipment Effectiveness):** Medida geral de eficiência
  - Fórmula: (Disponibilidade × Performance × Qualidade) × 100
  - Meta: > 85%

- **Qualidade:** % de peças boas vs refugos
  - Fórmula: (Peças Boas / Total) × 100
  - Meta: > 98%

- **Eficiência:** Tempo real vs tempo orçado
  - Fórmula: (Ciclo Orçado / Ciclo Real) × 100
  - Meta: > 95%

- **Produção:** Total de peças produzidas
  - Acumula diariamente

### Gráficos Disponíveis

#### 1️⃣ **Gráfico de Produção (Timeline)**

Mostra quantidade produzida ao longo do dia, por máquina:

```
Peças
5000 ├─────────────────────────────────
     │    ╱╲
4000 ├───╱  ╲────╱╲─────────────────
     │  ╱    ╲  ╱  ╲
3000 ├╱      ╲╱    ╲╱╲────────────
     │              ╲  ╲
2000 ├───────────────╲──╲╱╲───────
     │                   ╲ ╲
1000 ├───────────────────╲─╲──╱───
     │                    ╲ ╲╱
   0 ├────────────────────────────
     └─────────────────────────────
      08:00 10:00 12:00 14:00 16:00
```

#### 2️⃣ **Gráfico de OEE por Máquina**

Comparação do OEE entre máquinas:

```
H01: ████████░░ 85% ✅
H02: ██████░░░░ 72% ⚠️
H03: █████████░ 92% ✅
H04: ███░░░░░░░ 45% ❌
```

#### 3️⃣ **Gráfico de Perdas (Refugo/Borra)**

Peso de rejeitos ao longo do tempo:

```
Kg
50 ├ Refugo
   │  ■ ■   ■    ■   ■
40 │  ■ ■   ■    ■   ■
   │  ■ ■   ■    ■   ■
30 │  ■ ■   ■    ■   ■
20 │  ■ ■ ■ ■  ■ ■   ■
10 │  ■ ■ ■ ■  ■ ■ ■ ■
 0 └──■─■─■─■──■─■─■─■──
    08 09 10 11 12 13 14
```

#### 4️⃣ **Tabela de Análise por Máquina**

| Máquina | Produção | Refugo | Borra | OEE | Qualidade | Status |
|---------|----------|--------|-------|-----|-----------|--------|
| H01 | 5.000 | 50 | 20 | 85% | 98% | ✅ |
| H02 | 3.500 | 120 | 45 | 72% | 94% | ⚠️ |
| H03 | 6.200 | 30 | 15 | 92% | 99% | ✅ |

### Filtros de Análise

```
[Data ▼] [Máquina ▼] [Turno ▼] [Período ▼]
```

- **Data:** Dia específico ou período
- **Máquina:** Análise de máquina individual ou todas
- **Turno:** 1º | 2º | 3º | Todos
- **Período:** Última hora | Dia | Semana | Mês

### Exportar Análise

Botão **[⬇️  Exportar]** para baixar dados em:
- 📊 **Excel:** Planilhas com tabelas
- 📄 **PDF:** Relatório formatado para impressão

---

## 8. RECURSO ADICIONAL: FILTRO DE LANÇAMENTOS HISTÓRICOS

### Objetivo
Filtrar lançamentos antigos (dias anteriores) para correção ou análise, com possibilidade de editar/deletar registros errados.

### Como Usar

Na aba **[📊 LANÇAMENTO]**, no painel "Lançamentos Recentes", clique em **[🔍 Filtrar]**:

```
┌────────────────────────────────────────┐
│ FILTRO DE LANÇAMENTOS                  │
├────────────────────────────────────────┤
│                                        │
│ Data: [2025-12-01 ▼]                 │
│ Máquina: [H01 ▼]                      │
│                                        │
│ [Aplicar Filtro]                      │
│                                        │
└────────────────────────────────────────┘

Resultado: 15 lançamentos encontrados
┌─────────────────────────────────────┐
│ 2025-12-01 10:30 | 100 peças | João │
│ 2025-12-01 09:45 | 5kg Refugo | João│
│ ... (clique para expandir)            │
└─────────────────────────────────────┘
```

### Editar/Deletar Histórico

**Para deletar um lançamento errado:**

1. Encontre o lançamento no filtro
2. Clique em **[🗑️  Deletar]** ou **[✏️  Editar]**
3. Confirme a ação

⚠️ **Cuidado:** Deletar lançamento afeta os KPIs!

---

## 9. TROUBLESHOOTING E FAQ

### ❓ Perguntas Frequentes

**P1: Esqueci minha senha. Como faço?**
R: Clique em "Esqueci a senha" na tela de login. Você receberá email com instruções.

**P2: Como saber qual é o turno atual?**
R: Veja no header do sistema, ao lado do nome do usuário. Mostra o turno (1º/2º/3º).

**P3: O que é OEE? Como é calculado?**
R: OEE = Eficiência Geral. Fórmula: (Tempo Disponível × Performance × Qualidade) × 100.
- Tempo Disponível: Tempo que máquina estava disponível (não em manutenção)
- Performance: Velocidade de produção (ciclo real vs orçado)
- Qualidade: % de peças boas

**P4: Posso editar um lançamento que já fiz?**
R: Sim! Vá em [📊 LANÇAMENTO] → [🔍 Filtrar] → Encontre lançamento → [✏️  Editar]

**P5: Como faço um planejamento para o dia?**
R: Vá em [📋 PLANEJAMENTO] → Busque OP no Excel → Selecione máquina → Escolha MP → Adicione ao plano.

**P6: Se a máquina parou, preciso fazer algo?**
R: Sim! Clique em [⏸️  PARADA] e selecione o motivo. Sistema registrará o tempo de parada automaticamente.

**P7: Qual a diferença entre Refugo e Borra?**
R: 
- **Refugo:** Peças com defeito (rejeitadas, queimadas, erradas)
- **Borra:** Material de teste/calibração (peças de testes iniciais da máquina)

**P8: Como filtro lançamentos de outro dia?**
R: Use o **Filtro de Lançamentos Históricos** (abaixo de Lançamentos Recentes).

**P9: Posso deletar uma Ordem de Produção?**
R: Depende da permissão do usuário. Apenas Admins podem deletar OPs.

**P10: Onde vejo o progresso de cada máquina?**
R: Na aba [📊 LANÇAMENTO], nos cards de máquina no topo, veja a barra de progresso e valores "Exec OP" e "Faltante".

---

### 🔧 Problemas Comuns e Soluções

| Problema | Causa | Solução |
|----------|-------|---------|
| Cards oscilando (executado/faltante muda) | Múltiplas atualizações conflitantes | Atualize página (F5) e reselecione máquina |
| Não consigo fazer lançamento | Máquina não planejada | Vá em PLANEJAMENTO e adicione máquina para o dia |
| Balança não conecta | Problema hardware | Verifique porta USB e drivers da balança |
| Sistema lento | Muitos dados | Limpe filtros e tente em outro horário com menos usuários |
| Erro 429 (Quota) | Firebase saturado | Sistema está otimizado; se persistir, contate Admin |
| Não aparecem lançamentos recentes | Filtro ativo | Clique em [Limpar] no filtro de lançamentos |

---

### 📞 Contato de Suporte

Para problemas técnicos que não conseguir resolver:

1. **Verifique:** Sua conexão de internet
2. **Tente:** Fazer logout e login novamente
3. **Procure:** Seu Gestor ou Administrador do Sistema
4. **Descreva:** 
   - O que você estava fazendo
   - Qual erro apareceu
   - Qual máquina / OP estava envolvida
   - Horário do problema

---

## 10. CRONOGRAMA DE TREINAMENTO

### Fase 1: Operadores (2-4 horas)

```
Dia 1 (2h)
├─ Autenticação (15 min)
├─ Overview do Sistema (30 min)
├─ Módulo Lançamento - Básico (45 min)
│  └─ Produção, Refugo, Borra
└─ Exercício Prático (30 min)

Dia 2 (2h)
├─ Continuação Lançamento (1h)
│  └─ Parada, Retrabalho, Tara
├─ Análise de Dados - Leitura (30 min)
├─ FAQ e Troubleshooting (20 min)
└─ Teste Prático (10 min)
```

### Fase 2: Líderes (4-6 horas)

```
Dia 1 (3h)
├─ Autenticação + Overview (30 min)
├─ Módulo Planejamento - Completo (2h)
│  ├─ Como buscar OPs
│  ├─ Adicionar ao plano
│  ├─ Configurar ciclo/cavidades
│  └─ Exportar tabela
└─ Q&A (30 min)

Dia 2 (3h)
├─ Módulo Ordens - Completo (1h)
│  ├─ Criar nova OP
│  └─ Importar Excel
├─ Módulo Paradas Longas (1h)
├─ Análise de Dados - Completo (45 min)
└─ Teste de Planejamento (15 min)
```

### Fase 3: Gestores (6-8 horas)

```
Dia 1 (3h)
├─ Autenticação + Overview (30 min)
├─ Todos os Módulos - Visão Geral (2h)
│  └─ O quê faz cada um, fluxo geral
└─ Permissões e Segurança (30 min)

Dia 2 (3h)
├─ Análise Avançada (1.5h)
│  ├─ Gráficos e Tendências
│  ├─ Exportar Relatórios
│  └─ KPIs Explicados
├─ Relatórios e Dashboards (1h)
└─ Simulação de Cenários (30 min)

Dia 3 (2h)
├─ Troubleshooting (1h)
├─ Configurações (30 min)
└─ Q&A Final (30 min)
```

### Fase 4: Administradores (8-12 horas)

```
Dia 1 (4h) - Arquitetura
├─ Overview Sistema (1h)
├─ Firebase & Banco de Dados (1.5h)
├─ Segurança & Permissões (1h)
└─ Backups (30 min)

Dia 2 (4h) - Operação
├─ Monitoramento (1h)
├─ Otimização de Performance (1h)
├─ Troubleshooting Avançado (1h)
├─ Manutenção Preventiva (30 min)
└─ Q&A (30 min)

Dia 3 (4h) - Customização
├─ Modificação de Código (2h)
├─ Deployment e Atualização (1h)
├─ Backup & Disaster Recovery (1h)
└─ Documentação (Livre)
```

---

## 📅 Próximos Passos Recomendados

1. **Semana 1:** Treinar Operadores (Lançamento básico)
2. **Semana 2:** Treinar Líderes (Planejamento)
3. **Semana 3:** Treinar Gestores (Análise)
4. **Semana 4:** Treinar Admins (Manutenção)
5. **Semana 5:** Uso em Produção Real
6. **Semana 6+:** Refinamento baseado em feedback

---

## 📞 Suporte Pós-Treinamento

Após treinamento, agende:
- ✅ **Reunião de Follow-up** (1 semana): Esclarecer dúvidas
- ✅ **Avaliação** (2 semanas): Testes de proficiência
- ✅ **Otimização** (4 semanas): Ajustes baseados em uso real

---

**Documento Preparado:** 02 de Dezembro de 2025  
**Versão:** 1.0  
**Próxima Revisão:** Conforme novas features forem adicionadas
