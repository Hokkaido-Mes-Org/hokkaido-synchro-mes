# HokkaidoMES — Guia Operacional do Usuário

> **Versão:** 1.0 • **Data:** Fevereiro 2026  
> **Público-alvo:** Operadores, Gestores, Líderes e Suporte  
> **Responsável:** Leandro de Camargo

---

## 1. Acesso ao Sistema

### 1.1 Login

1. Abra o navegador (Google Chrome recomendado)
2. Acesse o endereço do sistema: `https://hokkaido-synchro.web.app` (ou URL local)
3. Insira seu **nome de usuário** e **senha**
4. Opcionalmente, marque **"Lembrar-me"** para manter a sessão por 24h
5. Clique em **"Entrar"**

> **Dica:** Se não lembrar seu usuário, tente digitar seu nome completo — o sistema reconhece variações como "leandro camargo", "leandro.camargo" ou "Leandro Camargo".

### 1.2 Sessão

| Tipo | Duração |
|------|---------|
| Com "Lembrar-me" | 24 horas |
| Sem "Lembrar-me" | 8 horas (fecha ao fechar aba) |

### 1.3 Logout

- Clique no ícone de **usuário** no canto superior direito
- Clique em **"Sair"**

### 1.4 Problemas de Acesso

| Problema | Solução |
|----------|---------|
| Senha incorreta | Verificar caps lock; contatar suporte |
| Tela branca | Limpar cache: `Ctrl + Shift + Delete` → limpar dados → recarregar |
| Aba não aparece | Seu perfil não tem permissão; contate o gestor |

---

## 2. Navegação

### 2.1 Menu Lateral

O sistema possui **13 abas** de navegação no menu lateral esquerdo. Nem todas as abas são visíveis para todos os perfis.

### 2.2 Abas por Perfil

| Aba | Operador | Gestor | Líder | Suporte |
|-----|:--------:|:------:|:-----:|:-------:|
| Lançamento | ✅ | ✅ | ✅ | ✅ |
| Análise | ✅ | ✅ | ✅ | ✅ |
| Planejamento | — | ✅ | — | ✅ |
| Ordens | — | ✅ | — | ✅ |
| Relatórios | — | ✅ | ✅ | ✅ |
| PMP | — | — | — | ✅ |
| Acompanhamento | — | — | — | ✅ |
| Histórico | — | — | — | ✅ |
| Admin Dados | — | — | — | ✅ |
| Liderança | — | — | ✅ | ✅ |
| Setup | — | — | ✅ | ✅ |
| Ferramentaria | — | — | ✅ | ✅ |
| PCP | — | — | — | ✅ |
| Dashboard TV | — | ✅ | ✅ | ✅ |

---

## 3. Aba: Lançamento (Padrão)

Esta é a aba principal para operadores. Permite registrar produção, paradas e perdas.

### 3.1 Seleção de Máquina

1. Na parte superior, selecione a **máquina** desejada no seletor
2. O sistema carrega automaticamente o **planejamento do dia** para a máquina
3. Se uma **ordem de produção** está ativa, ela aparece destacada

### 3.2 Cards de Máquina

Os cards mostram o status de cada máquina:

| Cor | Status |
|-----|--------|
| 🟢 Verde | Produzindo |
| 🔴 Vermelho | Parada |
| 🟡 Amarelo | Alerta (parada > 10 min) |
| ⚪ Cinza | Inativa |
| 🟣 Roxo | Em manutenção |

### 3.3 Lançamento de Produção

1. Selecione a máquina
2. Preencha a **quantidade produzida** (em peças)
3. Confirme o **turno** (T1, T2 ou T3)
4. Opcionalmente, ajuste a **hora**
5. Clique em **"Lançar"**

> **Turnos:**
> - T1 = 06:30 às 15:00
> - T2 = 15:00 às 23:30
> - T3 = 23:30 às 06:30

### 3.4 Registro de Parada

1. Clique em **"Registrar Parada"**
2. Selecione o **motivo** da parada (lista categorizada)
3. Informe o **horário de início** (ou use "agora")
4. Se a parada já terminou, informe também o **horário de término**
5. Clique em **"Salvar"**

**Categorias de parada:**
- **Manutenção** — Mecânica, elétrica, preventiva
- **Processo** — Troca de molde, setup, ajuste
- **Material** — Falta de matéria-prima, material contaminado
- **Qualidade** — Teste, ajuste de qualidade
- **Operacional** — Falta de operador, refeição, outros

### 3.5 Parada Prolongada

Para paradas que duram mais de 1 turno (ex: fins de semana, manutenção planejada):

1. Clique em **"Parada Prolongada"**
2. Selecione as **máquinas** afetadas
3. Defina **data/hora de início e fim**
4. Selecione o **motivo**
5. Clique em **"Salvar"**

### 3.6 Registro de Perdas

1. Selecione a máquina
2. Clique em **"Registrar Perdas"**
3. Informe a **quantidade perdida** (peças refugadas)
4. Selecione o **motivo** de perda
5. Clique em **"Salvar"**

---

## 4. Aba: Análise

Visualização de KPIs e gráficos de performance.

### 4.1 Sub-abas de Análise

| Sub-aba | Descrição |
|---------|-----------|
| **Resumo** | OEE geral + por máquina, performance do turno |
| **Dashboard** | Gráficos interativos de produção e paradas |
| **Análise Detalhada** | Produção hora a hora, tendências |
| **Pareto** | Ranking de motivos de parada |

### 4.2 OEE (Overall Equipment Effectiveness)

O OEE é calculado como:

$$OEE = Disponibilidade \times Performance \times Qualidade$$

Onde:
- **Disponibilidade** = (Tempo Planejado − Tempo Parado) / Tempo Planejado
- **Performance** = Produção Real / Produção Ideal
- **Qualidade** = (Produção Real − Refugos) / Produção Real

**Referência de OEE:**

| Faixa | Classificação |
|-------|---------------|
| ≥ 85% | 🟢 Classe Mundial |
| 65-84% | 🟡 Bom |
| 50-64% | 🟠 Regular |
| < 50% | 🔴 Abaixo do esperado |

### 4.3 Filtros

- **Período:** Hoje, ontem, últimos 7 dias, período customizado
- **Máquina:** Todas ou máquina específica
- **Turno:** Todos, T1, T2 ou T3

### 4.4 Exportação

- Clique no botão **"Exportar"** para gerar relatórios em Excel/CSV
- Gráficos podem ser salvos como imagem (botão no canto do gráfico)

---

## 5. Aba: Planejamento

Gestão do planejamento diário de produção por máquina.

### 5.1 Criar Planejamento

1. Selecione a **data**
2. Selecione a **máquina**
3. Informe o **código do produto** (busca automática no cadastro)
4. Informe a **quantidade planejada**
5. Opcionalmente, vincule um **número de ordem**
6. Clique em **"Salvar"**

### 5.2 Editar/Excluir

- Clique no ícone de **edição** (lápis) na linha do planejamento
- Para excluir, clique no ícone de **lixeira**
- **Atenção:** Exclusões são registradas nos logs de auditoria

### 5.3 Importação

- É possível importar planejamento de **planilha Excel/CSV**
- Formato: colunas com Máquina, Produto, Quantidade, Data

---

## 6. Aba: Ordens de Produção

### 6.1 Status de uma Ordem

```
Criada → Ativa → Em Andamento → Concluída
                    │
                    └→ Suspensa → Retomada
```

| Status | Significado |
|--------|------------|
| **Ativa** | Ordem criada e disponível |
| **Em Andamento** | Ordem selecionada para produção |
| **Suspensa** | Ordem pausada temporariamente |
| **Concluída** | Quantidade atingida ou encerrada manualmente |

### 6.2 Criar Ordem

1. Clique em **"Nova Ordem"**
2. Preencha: número da OP, produto, máquina, quantidade, matéria-prima
3. Clique em **"Criar"**

### 6.3 Ativar Ordem em Máquina

1. Na aba de Lançamento, selecione a máquina
2. Clique em **"Selecionar Ordem"**
3. Escolha a ordem desejada
4. A ordem entra em status **"Em Andamento"**

---

## 7. Aba: Relatórios

### 7.1 Tipos de Relatório

| Relatório | Dados Incluídos |
|-----------|----------------|
| **Produção** | Quantidade por máquina, turno, período |
| **Paradas** | Minutos parados por motivo, ranking |
| **Perdas** | Refugos por máquina e motivo |

### 7.2 Gerar Relatório

1. Selecione o **tipo** de relatório
2. Defina o **período** (data início / data fim)
3. Opcionalmente, filtre por **máquina**
4. Clique em **"Gerar"**
5. Para exportar: clique em **"Exportar CSV"**

---

## 8. Aba: PMP — Gestão de Materiais

### 8.1 Sub-abas

| Sub-aba | Descrição |
|---------|-----------|
| **Moído** | Material moído para reaproveitamento |
| **Borra** | Resíduo de borra gerado |
| **Sucata** | Peças descartadas como sucata |

### 8.2 Registrar Material

1. Selecione a sub-aba (Moído, Borra ou Sucata)
2. Preencha: máquina, peso (kg), turno, operador
3. Clique em **"Registrar"**

---

## 9. Aba: Liderança — Gestão de Produção

### 9.1 Escalas de Operadores

1. Selecione o **turno** e a **data**
2. Defina os **operadores** por máquina
3. Clique em **"Salvar Escala"**

### 9.2 Controle de Absenteísmo

Tipos de ausência:
- Falta (sem justificativa)
- Atestado médico
- Folga de aniversário
- Férias
- Atraso
- Hokkaido Day
- Outros

### 9.3 Dashboard de Absenteísmo

- Gráficos de tendência de faltas
- Ranking por tipo de ausência
- Comparativo por período

---

## 10. Aba: Setup de Máquinas

### 10.1 Registrar Setup

1. Selecione a **máquina**
2. Informe o **tipo de setup** (troca de molde, troca de cor, etc.)
3. Registre **horário início e fim**
4. Clique em **"Salvar"**

### 10.2 Análise de Setup

- Tempo médio por tipo de setup
- Tendência diária
- Ranking por máquina

---

## 11. Aba: Ferramentaria

### 11.1 Gestão de Moldes

- **Cadastrar** novo molde (código, descrição, máquina)
- **Registrar manutenção** (data, tipo, observações)
- **Acompanhar batidas** — contador de ciclos do molde
- **Programar manutenção preventiva** — por número de batidas

### 11.2 Adicionar Batidas

1. Selecione o **molde**
2. Informe a **quantidade de batidas** a adicionar
3. Ou clique em **"Atualizar por Produção"** para calcular automaticamente

---

## 12. Aba: PCP — Planejamento e Controle

### 12.1 Visão Geral

- Dashboard com **status de todas as máquinas** no turno atual
- **Agenda de produção** por máquina com horários
- **Observações** do PCP por máquina/turno

### 12.2 Observações

1. Selecione a máquina
2. Escreva a **observação** (instrução, alerta, nota)
3. Clique em **"Salvar"**

---

## 13. Dashboard TV

### 13.1 Acesso

- Acesse diretamente: link **"Dashboard TV"** no menu lateral
- Ou via URL direta: `dashboard-tv.html`
- **Tela cheia recomendada** (F11)

### 13.2 Informações Exibidas

- OEE geral da fábrica (Gauge)
- Status de cada máquina (produzindo/parada)
- Produção do turno vs meta
- Ranking de máquinas por performance
- Paradas ativas com timer
- Alertas em tempo real

### 13.3 Auto-refresh

A tela é atualizada automaticamente a cada **5 minutos**.

---

## 14. Aba: Administração de Dados

> ⚠️ **Acesso restrito** — Apenas Suporte

### 14.1 Sub-abas Admin

| Sub-aba | Funcionalidade |
|---------|----------------|
| **Paradas** | Buscar/editar/excluir registros de parada |
| **Ordens** | Gerenciamento avançado de ordens |
| **Produção** | Visualizar/corrigir entradas de produção |
| **Perdas** | Gestão de registros de perda |
| **Planejamento** | Gestão de planejamento |
| **Ajustes Batch** | Operações em lote para correções |

### 14.2 Exclusão Segura

- Toda exclusão requer **confirmação** via modal
- Exclusões são **registradas nos logs de auditoria**
- Exclusões em lote registram cada item individualmente

---

## 15. Aba: Histórico do Sistema

> ⚠️ **Acesso restrito** — Apenas usuários autorizados

### 15.1 O Que Mostra

Registro de todas as ações realizadas no sistema:
- Quem fez
- O que fez
- Quando fez
- Em qual máquina

### 15.2 Filtros

- **Período:** Hoje, Ontem, Período customizado
- **Tipo de ação:** Criação, edição, exclusão
- **Usuário:** Qualquer usuário
- **Máquina:** Qualquer máquina

---

## 16. Atalhos e Dicas

### 16.1 Atalhos de Teclado

| Atalho | Ação |
|--------|------|
| `F5` | Recarregar dados |
| `Ctrl+Shift+Delete` | Limpar cache do navegador |
| `F11` | Tela cheia (Dashboard TV) |
| `Esc` | Fechar modal aberto |

### 16.2 Dicas de Produtividade

1. **Turno noturno:** Se você está no turno T3 (após meia-noite), o sistema ajusta automaticamente a data de produção para o dia anterior
2. **Code lookup:** Ao digitar o código do produto, o sistema busca automaticamente o nome, peso e cavidades
3. **Ordem ativa:** Quando uma OP está ativa na máquina, os campos de produto são preenchidos automaticamente
4. **Dashboard TV:** Ideal para TV grande no chão de fábrica — atualiza sozinho
5. **Exportação:** Todos os relatórios podem ser exportados como CSV para análise no Excel

---

## 17. Contatos de Suporte

| Tipo | Contato |
|------|---------|
| **Problemas de acesso** | Gestor do turno ou Suporte TI |
| **Bugs no sistema** | Leandro de Camargo |
| **Dúvidas operacionais** | Líder do turno |
| **Treinamento** | Coordenador de produção |

---

## Histórico de Revisões

| Versão | Data | Autor | Alteração |
|--------|------|-------|-----------|
| 1.0 | 2026-02-19 | Leandro de Camargo | Criação inicial |
