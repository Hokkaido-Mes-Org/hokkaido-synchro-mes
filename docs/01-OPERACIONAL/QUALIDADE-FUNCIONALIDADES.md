# Aba QUALIDADE — Descritivo Detalhado de Funcionalidades

> **Módulo:** Qualidade — Triagem, Quarentena e Controle de Cavidades  
> **Arquivo HTML:** `index.html` (linhas ~4707–5500)  
> **Arquivo JS:** `script.js` (linhas ~8719–10860)  
> **Coleções Firestore:** `triage_entries`, `cavity_closures`, `cavity_molds`, `cavity_machine_assignments`, `cavity_releases`  
> **Última atualização:** Junho 2025

---

## Sumário

1. [Visão Geral](#1-visão-geral)
2. [Estrutura de Navegação](#2-estrutura-de-navegação)
3. [Sub-aba: Triagem & Quarentena](#3-sub-aba-triagem--quarentena)
   - 3.1 [KPIs em Tempo Real](#31-kpis-em-tempo-real)
   - 3.2 [Formulário Inline "Nova Quarentena"](#32-formulário-inline-nova-quarentena)
   - 3.3 [Filtros de Status](#33-filtros-de-status)
   - 3.4 [Tabela de Lotes (11 Colunas)](#34-tabela-de-lotes-11-colunas)
   - 3.5 [Ações por Lote](#35-ações-por-lote)
   - 3.6 [Modal: Registrar Resultado de Triagem](#36-modal-registrar-resultado-de-triagem)
   - 3.7 [Modal: Editar Lote](#37-modal-editar-lote)
   - 3.8 [Modo Peso (Peso → Peças)](#38-modo-peso-peso--peças)
   - 3.9 [Integração com OEE](#39-integração-com-oee)
   - 3.10 [Integração com Ferramentaria](#310-integração-com-ferramentaria)
4. [Sub-aba: Controle de Cavidades](#4-sub-aba-controle-de-cavidades)
   - 4.1 [Seletor de Molde](#41-seletor-de-molde)
   - 4.2 [KPIs de Cavidades](#42-kpis-de-cavidades)
   - 4.3 [Barra de Eficiência](#43-barra-de-eficiência)
   - 4.4 [Mapa Visual de Cavidades (Grid)](#44-mapa-visual-de-cavidades-grid)
   - 4.5 [Formulário "Registrar Ação"](#45-formulário-registrar-ação)
   - 4.6 [Histórico de Fechamento/Abertura](#46-histórico-de-fechamentoabertura)
   - 4.7 [Cadastro de Molde Customizado](#47-cadastro-de-molde-customizado)
   - 4.8 [Edição de Cavidades do Molde](#48-edição-de-cavidades-do-molde)
   - 4.9 [Exclusão de Molde Customizado](#49-exclusão-de-molde-customizado)
   - 4.10 [Vinculação Molde ↔ Máquina](#410-vinculação-molde--máquina)
   - 4.11 [Liberação de Molde (Inspetor)](#411-liberação-de-molde-inspetor)
   - 4.12 [Catálogo de Defeitos de Cavidade](#412-catálogo-de-defeitos-de-cavidade)
5. [Serviço de Triagem (`_triageService`)](#5-serviço-de-triagem-_triageservice)
6. [Fluxo de Dados e Persistência](#6-fluxo-de-dados-e-persistência)
7. [Permissões e Segurança](#7-permissões-e-segurança)

---

## 1. Visão Geral

A aba **QUALIDADE** é o módulo central de gestão da qualidade do HokkaidoMES, acessível pelo menu lateral de navegação (`data-page="qualidade"`). Ela reúne dois subsistemas complementares:

| Sub-aba | Propósito | Coleção Firestore |
|---------|-----------|-------------------|
| **Triagem & Quarentena** | Gestão do ciclo de vida de lotes suspeitos — da quarentena à conclusão da triagem, com integração ao OEE | `triage_entries` |
| **Controle de Cavidades** | Mapeamento visual do estado de cada cavidade dos moldes de injeção, com histórico, vinculação de máquina e liberação por inspetor | `cavity_closures`, `cavity_molds`, `cavity_machine_assignments`, `cavity_releases` |

O controlador principal é a função `setupQualidadePage()` (inline em `script.js`), que inicializa ambas as sub-abas, configura formulários, autocomplete, modais e carrega dados do Firestore.

---

## 2. Estrutura de Navegação

### Header
- **Ícone:** Gradiente amber/orange com ícone `shield-check` (Lucide)
- **Título:** "Qualidade — Triagem"
- **Subtítulo:** "Quarentena, triagem e reaproveitamento de peças"
- **Botão Atualizar:** Ícone `refresh-cw`, chama `window._triageRefresh()` para recarregar dados do Firestore

### Sub-abas (Tabs)
Dois botões de tab na parte superior:

| Tab | ID do Painel | Ativa por Padrão? |
|-----|-------------|-------------------|
| Triagem & Quarentena | `qualidade-tab-triagem` | ✅ Sim |
| Controle de Cavidades | `qualidade-tab-cavidades` | Não |

A troca de abas é feita via `_triageSetupSubTabs()` — ao clicar, remove classes ativas de todas as tabs e oculta todos os painéis, depois ativa a tab/painel clicado.

---

## 3. Sub-aba: Triagem & Quarentena

### 3.1 KPIs em Tempo Real

Seis pills informativos em layout inline (flex-wrap), atualizados em tempo real pela função `_triageRenderKPIs()`:

| KPI | ID do Elemento | Cor | Descrição |
|-----|---------------|-----|-----------|
| **Quarentena** | `triage-kpi-quarantine` | Amarelo | Nº de lotes com status `QUARENTENA` |
| **Em Triagem** | `triage-kpi-in-triage` | Azul | Nº de lotes com status `EM_TRIAGEM` |
| **Concluídas** | `triage-kpi-completed` | Verde | Nº de lotes com status `CONCLUIDA` |
| **Pçs Pendentes** | `triage-kpi-pending-pieces` | Vermelho | Soma de `quantityPending` de todos os lotes |
| **Aprovadas** | `triage-kpi-approved` | Verde | Soma de `quantityApproved` de todos os lotes |
| **Taxa Aprov.** | `triage-kpi-approval-rate` | Teal | `(totalApproved / totalPieces × 100)%` |

### 3.2 Formulário Inline "Nova Quarentena"

Formulário colapsável (elemento `<details>` com `id="triage-inline-form-details"`). Após envio bem-sucedido, o formulário é fechado automaticamente.

#### Campos do Formulário

| Campo | Tipo | ID | Obrigatório | Detalhes |
|-------|------|-----|-------------|---------|
| **Máquina** | `<select>` | `triage-machine-select` | ✅ | Populado a partir de `machineDatabase` via `_populateTriageMachineSelect()`. Formato: `H-01 — Modelo` |
| **Turno** | `<select>` | `triage-turno-select` | Não | Opções fixas: 1T, 2T, 3T |
| **Ordem** | `<input text>` | `triage-order-input` | Não | Número da ordem de produção |
| **Produto** | `<input text>` + autocomplete | `triage-product-input` | Não | Busca por código ou nome. Ao digitar, exibe caixa de sugestões (`triage-product-suggestions`) com até 15 resultados. Ao selecionar, campo fica `readOnly` com botão "✕" para limpar |
| **Operador** | `<input text>` + autocomplete | `triage-user-input` | Não | Busca no `userDatabase` por código, nome de usuário ou nome completo. Ao selecionar, exibe resolução: "✓ Nome Completo" |
| **Modo de Entrada** | Toggle buttons | `triage-mode-pieces` / `triage-mode-weight` | — | Alterna entre entrada por peças ou por peso (ver seção 3.8) |
| **Quantidade** | `<input number>` | `triage-quantity-input` | ✅ (modo peças) | Número de peças a enviar para quarentena |
| **Peso (g)** | `<input number>` | `triage-weight-input` | ✅ (modo peso) | Peso total em gramas. Convertido automaticamente para peças |
| **Motivo do Defeito** | `<select>` + `<optgroup>` | `triage-defect-select` | Não | Populado a partir de `groupedLossReasons` — agrupado por categoria (PROCESSO, FERRAMENTARIA, MAQUINA, MATERIA PRIMA) |
| **Observações** | `<textarea>` | `triage-notes-input` | Não | Texto livre |

#### Painel de Informação do Produto

Quando um produto é selecionado via autocomplete, um painel (`triage-product-info`) é exibido mostrando:
- **Nome do Produto** (`triage-product-name`)
- **Cliente** (`triage-product-client`)
- **Cavidades** (`triage-product-cavities`)
- **Peso Unitário (g)** (`triage-product-weight`)

#### Fluxo de Envio

1. Valida campos obrigatórios (máquina + quantidade > 0)
2. Se modo peso: converte peso → peças usando peso unitário do produto (`Math.floor(peso / pesoUnitário)`)
3. Resolve operador (autocomplete ou texto livre ou usuário logado)
4. Resolve categoria do defeito a partir de `lossReasonsDatabase`
5. Chama `_triageService.sendToQuarantine(data)` → cria documento no Firestore
6. **Integração Ferramentaria:** Se `productCode` existe, chama `atualizarBatidasPorProducao(productCode, 0, 0, quantity)` para contabilizar triagem como batidas no molde
7. Reseta formulário e fecha o `<details>`
8. Atualiza dados via `_triageRefreshData()`

### 3.3 Filtros de Status

Quatro botões de filtro com indicadores coloridos (dot):

| Filtro | Data Attribute | Cor do Dot | Comportamento |
|--------|---------------|------------|---------------|
| **Todos** | `data-triage-filter="all"` | Cinza | Mostra todos os lotes |
| **Quarentena** | `data-triage-filter="QUARENTENA"` | Amarelo | Filtra por status QUARENTENA |
| **Em Triagem** | `data-triage-filter="EM_TRIAGEM"` | Azul | Filtra por status EM_TRIAGEM |
| **Concluídas** | `data-triage-filter="CONCLUIDA"` | Verde | Filtra por status CONCLUIDA |

O filtro ativo recebe classes `active bg-amber-100 text-amber-800`. A troca de filtro recalcula a tabela imediatamente via `_triageRenderTable()`.

### 3.4 Tabela de Lotes (11 Colunas)

Tabela responsiva com 11 colunas renderizada pela função `_triageRenderTable()`:

| # | Coluna | Tipo | Detalhes |
|---|--------|------|---------|
| 1 | **Máquina** | Texto | `machineId` (ex: H-13) |
| 2 | **Turno** | Texto | 1T / 2T / 3T |
| 3 | **Ordem** | Texto | Nº da ordem de produção |
| 4 | **Produto** | Texto (truncado) | Código do produto, com tooltip mostrando nome completo |
| 5 | **Defeito** | Texto (truncado) | Motivo do defeito, com tooltip completo |
| 6 | **Operador** | Texto (truncado) | Nome curto do operador (primeiros 2 nomes) |
| 7 | **Qtd Total** | Numérico (centralizado) | Quantidade total de peças no lote |
| 8 | **Aprov/Ref/Pend** | Trio colorido | `Verde / Vermelho / Âmbar` — quantidades aprovadas, refugadas e pendentes |
| 9 | **Status** | Badge | Badge colorido com dot: Quarentena (amarelo), Em Triagem (azul), Concluída (verde) |
| 10 | **Data** | Data | Data de quarentena formatada (DD/MM/YYYY) |
| 11 | **Ações** | Botões | Botões contextuais (ver seção 3.5) |

**Ordenação:** A tabela é ordenada primeiro por status (Quarentena → Em Triagem → Concluída), depois por data de quarentena decrescente.

### 3.5 Ações por Lote

Os botões de ação variam conforme o status do lote:

| Ação | Disponível em | Descrição |
|------|---------------|-----------|
| **Triar** | QUARENTENA, EM_TRIAGEM | Abre modal de resultado de triagem. Se status é QUARENTENA, automaticamente muda para EM_TRIAGEM |
| **Finalizar** | QUARENTENA, EM_TRIAGEM | Confirma com `confirm()`. Refugar todas as peças pendentes de uma vez. Chama `_triageService.finalizeTriage()` |
| **Editar** (ícone lápis) | Todos os status | Abre modal de edição do lote |
| **Excluir** (ícone lixeira) | Todos os status | Confirma com `confirm()` detalhado (máquina, ordem, quantidade). Chama `_triageService.delete()` |

### 3.6 Modal: Registrar Resultado de Triagem

Modal (`triage-result-modal`) para informar aprovações e refugos parciais de um lote.

#### Informações Exibidas (Cabeçalho)
- **Máquina**, **Ordem**, **Defeito**, **Total de Peças** do lote
- **Peças restantes para triagem** (`triage-result-remaining`)
- **Peso unitário do produto** (quando disponível)

#### Campos de Entrada

| Campo | Modo Peças | Modo Peso |
|-------|-----------|-----------|
| **Aprovadas** | `triage-result-approved` (inteiro, max = pendentes) | `triage-result-weight-approved` (gramas) |
| **Refugadas** | `triage-result-rejected` (inteiro, max = pendentes) | `triage-result-weight-rejected` (gramas) |
| **Conversão** | — | Exibe "≈ X aprovadas + Y refugadas (peso unit.: Zg)" |
| **Observações** | `triage-result-notes` | `triage-result-notes` |

#### Fluxo de Registro
1. Toggle entre modo Peças/Peso (ver seção 3.8)
2. Informar peças aprovadas e/ou refugadas (pelo menos 1)
3. Submete via `_triageService.recordTriageResult(id, {approved, rejected, operator, notes})`
4. O serviço atualiza contadores, adiciona entrada no `history` do documento
5. Se `quantityPending === 0`, status muda automaticamente para `CONCLUIDA`

### 3.7 Modal: Editar Lote

Modal (`triage-edit-modal`) para alterar dados de um lote existente.

#### Campos Editáveis

| Campo | Regra Especial |
|-------|---------------|
| **Máquina** | Select com todas as máquinas |
| **Turno** | 1T / 2T / 3T |
| **Ordem** | Texto livre |
| **Produto** | Código do produto (resolve nome automaticamente) |
| **Quantidade** | Não pode ser menor que peças já processadas (`approved + rejected`) |
| **Defeito** | Select agrupado por categoria |
| **Observações** | Texto livre |

O `quantityPending` é recalculado automaticamente: `newQuantity - (approved + rejected)`.

### 3.8 Modo Peso (Peso → Peças)

Presente tanto no formulário de Nova Quarentena quanto no Modal de Resultado de Triagem.

**Funcionamento:**
1. Dois botões de toggle: **Peças** (padrão) e **Peso**
2. Ao ativar modo Peso, campo de peças é ocultado e substituído por campo de peso em gramas
3. A conversão usa o peso unitário do produto selecionado (`product.weight` em gramas)
4. Fórmula: `peças = Math.floor(pesoTotal / pesoUnitário)`
5. Exibe informação de conversão: "≈ X peças (peso unitário: Yg)"
6. Se o produto não tem peso cadastrado, impede o uso do modo peso com mensagem de erro

### 3.9 Integração com OEE

A triagem impacta diretamente o cálculo do OEE do sistema.

#### Mapa OEE (`_triageBuildOEEMap`)

A cada refresh de dados, a função `_triageBuildOEEMap()` constrói um mapa `window._triagePcsByMachineShift`:

```
Chave: "H-13_T1" (máquina + turno)
Valor: soma de (quantityPending + quantityRejected) dos lotes NÃO concluídos
```

**Regras importantes:**
- Lotes com status `CONCLUIDA` **não** penalizam o OEE (já foram resolvidos)
- Lotes em `QUARENTENA` ou `EM_TRIAGEM` penalizam a qualidade do OEE

#### Fórmula de Qualidade no OEE

Na função `calculateOEE()` em `src/utils/oee.utils.js`:

```
Qualidade = Boas / (Boas + Refugo + Triagem)
```

Onde:
- **Boas** = peças produzidas consideradas boas
- **Refugo** = peças refugadas na produção
- **Triagem** = peças pendentes + rejeitadas de triagem (`triagePcs`)

Isso significa que peças enviadas para quarentena reduzem a taxa de qualidade até que sejam aprovadas na triagem.

### 3.10 Integração com Ferramentaria

Quando um lote é enviado para quarentena com um código de produto válido:

```javascript
await window.atualizarBatidasPorProducao(productCode, 0, 0, quantity);
```

- As peças de triagem são contabilizadas como **batidas** no molde associado ao produto
- Os parâmetros são: `(productCode, produção=0, refugo=0, triagem=quantity)`
- Isso garante que a contagem de vida do molde reflita todas as peças que passaram por ele, incluindo as em quarentena

---

## 4. Sub-aba: Controle de Cavidades

### 4.1 Seletor de Molde

Dropdown (`cav-product-select`) com moldes agrupados por cliente (`<optgroup>`).

#### Fontes de Dados
1. **`ferramentariaDatabase`** — Moldes do sistema (banco de dados estático). Cada molde é identificado por `_cavMoldKey(nome, cliente)` → formato `"cliente|nome"` em lowercase com espaços substituídos por hífens
2. **Moldes customizados** — Salvos em `localStorage` (chave `cav_custom_molds`) e sincronizados com coleção Firestore `cavity_molds`
3. **Nº de cavidades** — Tentativa de resolução via `productDatabase` (`_cavGuessCavities`), com fallback para input manual

#### Fluxo de Seleção
1. Usuário seleciona molde no dropdown
2. `_cavSelectMold(moldId)` é chamada
3. Se molde não tem nº de cavidades → exibe form inline para definir
4. Inicializa estados: todas as cavidades = aberta (1)
5. Carrega dados do Firestore (`cavity_closures` para este molde)
6. Aplica estados (fechada/entupida) baseado em registros não corrigidos
7. Renderiza grid, histórico, KPIs, painel de vinculação

#### Botões Superiores

| Botão | Visibilidade | Ação |
|-------|-------------|------|
| **Novo Molde** | Sempre | `_cavShowAddMoldModal()` |
| **Editar** (lápis) | Quando molde selecionado | `_cavShowEditMoldModal()` |
| **Excluir** (lixeira) | Quando molde customizado selecionado | `_cavDeleteCurrentMold()` |
| **Atualizar** | Sempre | `_cavRefreshAll()` |

### 4.2 KPIs de Cavidades

Quatro pills compactos atualizados por `_cavUpdateKPIs()`:

| KPI | ID | Cor do Badge | Descrição |
|-----|----|-------------|-----------|
| **Total** | `cav-kpi-total` | Cinza | Nº total de cavidades do molde |
| **Abertas** | `cav-kpi-open` | Verde | Cavidades com estado = 1 (operacionais) |
| **Fechadas** | `cav-kpi-closed` | Vermelho | Cavidades com estado = 0 (bloqueadas) |
| **Entupidas** | `cav-kpi-clogged` | Laranja | Cavidades com estado = 2 |

### 4.3 Barra de Eficiência

Barra de progresso horizontal com porcentagem:

```
Eficiência = (Abertas / Total) × 100%
```

**Escala de cores:**
| Faixa | Cor da Barra | Cor do Texto |
|-------|-------------|-------------|
| ≥ 90% | Verde (green-400 → green-600) | Verde (`text-green-600`) |
| 75%–89% | Âmbar (amber-400 → amber-600) | Âmbar (`text-amber-600`) |
| < 75% | Vermelho (red-400 → red-600) | Vermelho (`text-red-600`) |

Abaixo da barra, texto descritivo com nome do molde, cliente e máquinas vinculadas.

### 4.4 Mapa Visual de Cavidades (Grid)

Grid responsivo renderizado por `_cavRenderGrid()`, ocupando 2/3 da largura em telas grandes.

#### Estados das Cavidades

| Estado | Valor | Cor | Ícone | Label |
|--------|-------|-----|-------|-------|
| **Aberta** | 1 | Verde (bg-green-100) | ✓ | OK |
| **Fechada** | 0 | Vermelho (bg-red-100) | ✗ | Fech. |
| **Entupida** | 2 | Laranja (bg-orange-100) | ⊘ | Entup. |

#### Layout Responsivo

O número de colunas é calculado dinamicamente:

| Nº Cavidades | Colunas Base | Mobile | Tablet | Desktop |
|-------------|-------------|--------|--------|---------|
| ≤ 8 | 4 | 4 | 4 | 4 |
| 9–16 | 4 | 4 | 4 | 4 |
| 17–32 | 8 | 4 | 6 | 8 |
| 33–64 | 8 | 4 | 6 | 8 |
| > 64 | 10 | 4 | 6 | 10 |

#### Legenda
Exibida acima do grid:
- 🟢 Aberta
- 🔴 Fechada
- 🟠 Entupida

#### Interação
Ao clicar em uma cavidade:
1. Preenche o formulário lateral com o número da cavidade
2. Sugere a ação lógica (se aberta → "Fechar"; se fechada/entupida → "Abrir")
3. Se há máquina vinculada, pré-seleciona a máquina
4. Faz scroll suave até o formulário e destaca com ring visual

### 4.5 Formulário "Registrar Ação"

Formulário lateral (1/3 em telas grandes) para registrar abertura, fechamento ou entupimento de uma cavidade.

#### Campos

| Campo | Tipo | ID | Detalhes |
|-------|------|-----|---------|
| **Nº Cavidade** | Number | `cav-form-number` | Min/Max ajustado ao molde selecionado |
| **Ação** | Select | `cav-form-action` | Opções: Fechar, Abrir, Entupida |
| **Defeito** | Select | `cav-form-defect` | 47 tipos de defeito pré-catalogados (ver seção 4.12) |
| **Máquina** | Select | `cav-form-machine` | Todas as máquinas do `machineDatabase` |
| **Turno** | Select | `cav-form-shift` | 1º / 2º / 3º Turno |
| **Operador** ⁽¹⁾ | Input + autocomplete | `cav-form-operator` | Busca no `userDatabase` |
| **Técnico** ⁽¹⁾ | Input + autocomplete | `cav-form-technician` | Busca no `userDatabase` |
| **Inspetor** ⁽¹⁾ | Input + autocomplete | `cav-form-inspector` | Busca no `userDatabase` |

⁽¹⁾ Campos opcionais, colapsáveis via `<details>` ("+ Operador / Técnico / Inspetor")

#### Fluxo de Salvamento
1. Valida molde selecionado e nº de cavidade
2. Atualiza estado local da cavidade (`_cavStates`)
3. Registra na lista de histórico local (`_cavHistoryData`)
4. Salva no Firestore (`cavity_closures`)
5. Sincroniza contadores nas vinculações de máquina (`_cavSyncAssignmentCounts`)
6. Re-renderiza grid, histórico e KPIs

### 4.6 Histórico de Fechamento/Abertura

Tabela colapsável (`<details open>`) com 9 colunas:

| # | Coluna | Descrição |
|---|--------|-----------|
| 1 | **Máquina** | ID da máquina (ex: H-13) |
| 2 | **Data** | Data do registro (DD/MM/YYYY) |
| 3 | **Cav.** | Nº da cavidade (badge colorido conforme estado atual) |
| 4 | **Defeito** | Tipo de defeito (catálogo de 47 defeitos) |
| 5 | **Turno** | Badge colorido: 1º (azul), 2º (roxo), 3º (teal) |
| 6 | **Operador** | Nome do operador |
| 7 | **Corrigido** | ✓ (verde) ou ✗ (vermelho) |
| 8 | **Dt. Abertura** | Data de reabertura da cavidade (se corrigida) |
| 9 | **Ações** | Botão excluir (ícone lixeira) |

**Ordenação:** Decrescente por data.

**Contador:** `cav-history-count` mostra "X registros" no cabeçalho.

**Exclusão de registro:** Remove do histórico local; se a cavidade não tem mais registros não corrigidos, restaura estado para "aberta".

### 4.7 Cadastro de Molde Customizado

Modal (`cav-add-mold-modal`) com formulário:

| Campo | Exemplo |
|-------|---------|
| **Nome do Molde** | "Atuador Classic" |
| **Cliente** | "Aptar" |
| **Nº Total de Cavidades** | 32 |

#### Fluxo
1. Valida que todos os campos estão preenchidos
2. Gera `id` via `_cavMoldKey(name, client)`
3. Verifica duplicata (se `id` já existe, bloqueia)
4. Adiciona ao `_cavMoldsRegistry` local
5. Salva em `localStorage` (`cav_custom_molds`)
6. Salva no Firestore (`cavity_molds`)
7. Atualiza dropdown de seleção e seleciona o novo molde

### 4.8 Edição de Cavidades do Molde

Modal (`cav-edit-mold-modal`) para alterar o número total de cavidades de um molde.

| Campo | Detalhes |
|-------|---------|
| **Nº Total de Cavidades** | Input number (1–512), exibe valor atual, texto grande e centralizado |

#### Fluxo
1. Atualiza `mold.cavities` no `_cavMoldsRegistry`
2. Salva em `localStorage` e Firestore (merge com `cavity_molds`)
3. Reconstrói dropdown e re-seleciona o molde
4. Recalcula grid e KPIs

### 4.9 Exclusão de Molde Customizado

Função `_cavDeleteCurrentMold()`:

- Disponível apenas para moldes **customizados** (não presentes no `ferramentariaDatabase`)
- Moldes do sistema exibem alerta: "Moldes do sistema (ferramentaria) não podem ser excluídos por aqui"
- Confirmação obrigatória via `confirm()` com nome e cliente
- Remove do `_cavMoldsRegistry`, `localStorage` e Firestore (`cavity_molds`)
- Reseta a UI para estado vazio

### 4.10 Vinculação Molde ↔ Máquina

Painel (`cav-machine-assign-panel`) exibido abaixo do seletor de molde, permitindo vincular um molde a uma ou mais máquinas.

#### Componentes
1. **Select de Máquina** — Dropdown com todas as máquinas (32 máquinas, H-01 a H-32)
2. **Botão "Vincular"** — Chama `_cavAssignMoldToMachine()`
3. **Lista de Vinculações Ativas** — Cards com máquina vinculada, quem vinculou e botão "Desvincular"

#### Dados da Vinculação (Firestore: `cavity_machine_assignments`)

```javascript
{
  moldId, moldName, client, machine,
  totalCavities, openCount, closedCount, cloggedCount,
  assignedBy, assignedAt, active: true
}
```

#### Comportamentos
- Uma máquina só pode ter **um molde** vinculado (substituição com confirmação)
- Desvincular desativa o registro (não exclui) → `active: false`
- Contadores (open/closed/clogged) são sincronizados automaticamente quando cavidades são abertas/fechadas via `_cavSyncAssignmentCounts()`
- Vinculações aparecem nos **cards de máquina** em outras abas via `_cavGenerateCardSection(machine)` — mini-status com eficiência, barra de progresso e link para navegar diretamente ao molde

#### Navegação Cruzada
A função `_cavNavigateToMold(moldId)` permite navegar de qualquer card de máquina diretamente para o Controle de Cavidades com o molde correto selecionado.

### 4.11 Liberação de Molde (Inspetor)

Funcionalidade de registro formal do estado do molde por um inspetor de qualidade.

#### Seção na Página
Bloco compacto com borda teal, botão "Liberar Molde" e histórico colapsável.

#### Modal de Liberação (`cav-release-modal`)

| Seção | Conteúdo |
|-------|---------|
| **Resumo** | Nome do molde, cliente, contadores (Total/Abertas/Fechadas/Entupidas) |
| **Snapshot Grid** | Grid read-only do estado atual de cada cavidade (mesma visualização do grid principal, mas sem interação) |
| **Formulário** | Máquina* (select), Turno* (1T/2T/3T), Inspetor* (input com autocomplete), Observações (textarea) |

#### Dados do Registro (Firestore: `cavity_releases`)

```javascript
{
  moldId, moldName, client, machine, shift,
  inspectorName, inspectorCod,
  totalCavities, openCount, closedCount, cloggedCount,
  cavitySnapshot: { 1: 1, 2: 0, 3: 2, ... },  // snapshot completo de cada cavidade
  observations, date, time, timestamp
}
```

#### Tabela de Histórico de Liberações

9 colunas: Data/Hora, Molde, Máquina, Turno, Abertas, Fechadas, Entupidas, Inspetor, Detalhes (botão para abrir modal de detalhes).

#### Modal de Detalhes (`cav-release-detail-modal`)
Exibe os dados completos de uma liberação anterior, incluindo o snapshot do grid na data/hora da liberação.

### 4.12 Catálogo de Defeitos de Cavidade

47 tipos de defeito pré-catalogados na constante `_cavDefects`:

| Nº | Defeito | Nº | Defeito |
|----|---------|----|---------|
| 1 | BOLHA | 25 | REBARBA NO FURO (TAMPADO) |
| 2 | CHUPAGEM | 26 | REBARBA NO PROBE |
| 3 | CONTAMINAÇÃO | 27 | REBARBA RADIAL |
| 4 | DEFORMAÇÃO INTERNA | 28 | RISCO EXTERNO |
| 5 | DEFORMAÇÃO NO PTO. DE INJEÇÃO | 29 | RISCO INTERNO |
| 6 | DIMENSIONAL NÃO OK | 30 | SUJIDADE |
| 7 | ENTUPIDA | 31 | TRINCA |
| 8 | FALHA DE INJEÇÃO | 32 | QUEIMA NAS ALETAS |
| 9 | FIAPO | 33 | FORA DE COR |
| 10 | FIAPO NO PONTO DE INJEÇÃO | 34 | REBARBA NA LINHA DE FECHAMENTO |
| 11 | FICANDO PRESA | 35 | FLUXO |
| 12 | GALHO PRESO | 36 | REPUXO |
| 13 | JUNÇÃO FRIA | 37 | REBARBA INTERNA |
| 14 | LÂMINA QUEBRADA | 38 | REBARBA NA PONTA |
| 15 | MANCHAS | 39 | TESTE NÃO OK |
| 16 | MARCA D'ÁGUA | 40 | SUJIDADE DE ÓLEO |
| 17 | MARCA DE EXTRATOR | 41 | PEÇAS AMASSADAS |
| 18 | NÃO INJETA | 42 | FIAPO INTERNO |
| 19 | PEDIDO DO CLIENTE | 43 | REBARBA NO RESPIRO |
| 20 | PONTO DE INJEÇÃO ALTO | 44 | VAZAMENTO DE ÁGUA |
| 21 | QUEBRADA | 45 | FERRAMENTARIA |
| 22 | QUEIMA | 46 | ALETA DEFORMADA |
| 23 | REBARBA AXIAL | 47 | FIAPO NO CONTORNO |
| 24 | REBARBA NO FURO | | |

---

## 5. Serviço de Triagem (`_triageService`)

Serviço inline de CRUD para a coleção `triage_entries`, com cache local.

### Constantes de Status

```javascript
const TRIAGE_STATUS = {
  QUARENTENA: 'QUARENTENA',
  EM_TRIAGEM: 'EM_TRIAGEM',
  CONCLUIDA: 'CONCLUIDA'
};
```

### Métodos Públicos

| Método | Parâmetros | Descrição |
|--------|-----------|-----------|
| `getAll(filters, forceRefresh)` | — | Retorna todas as entries. Cache com TTL de 60s |
| `getById(id)` | `id` | Busca entry por ID (cache primeiro, fallback Firestore) |
| `create(data)` | `{...dados}` | Cria documento com `createdAt`/`updatedAt` serverTimestamp |
| `update(id, data)` | `id, {...dados}` | Atualiza documento com `updatedAt` serverTimestamp |
| `delete(id)` | `id` | Remove documento do Firestore |
| `sendToQuarantine(data)` | `{machineId, quantity, ...}` | Valida e cria entrada com status QUARENTENA, define `quantityPending = quantity` |
| `startTriage(id, operator)` | `id, operatorName` | Muda status para EM_TRIAGEM, registra operador e timestamp |
| `recordTriageResult(id, result)` | `id, {approved, rejected, notes}` | Atualiza contadores, adiciona ao array `history`, auto-completa se `pending = 0` |
| `finalizeTriage(id, operator, notes)` | `id, operator, notes` | Refuga todas as peças pendentes, marca como CONCLUIDA |
| `getKPIs(startDate, endDate)` | `startDate?, endDate?` | Calcula KPIs agregados: lotes, peças, taxas |

### Estrutura do Documento Firestore (`triage_entries`)

```javascript
{
  machineId: "H-13",
  orderNumber: "12345",
  product: "Atuador Classic - Corpo",
  productCode: "1001",
  defectReason: "FALHA DE INJEÇÃO",
  defectCategory: "PROCESSO",
  quantity: 500,
  quantityApproved: 350,
  quantityRejected: 50,
  quantityPending: 100,
  status: "EM_TRIAGEM",  // QUARENTENA | EM_TRIAGEM | CONCLUIDA
  quarantineDate: "2025-06-15",
  triageDate: null,       // preenchido ao concluir
  triageOperator: "Wesley",
  triageStartedAt: "2025-06-15T10:30:00Z",
  operador: "27 - Wesley",
  operadorCod: 27,
  turno: "1T",
  inputMode: "pieces",    // pieces | weight
  weightKg: null,
  pieceWeight: null,       // peso unitário quando modo peso foi usado
  notes: "Observações...",
  history: [
    {
      timestamp: "2025-06-15T14:00:00Z",
      approved: 350,
      rejected: 50,
      operator: "Wesley",
      notes: "Primeiro lote triado"
    }
  ],
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### Cache

- TTL de 60 segundos (`_cacheTTL: 60000`)
- `_invalidateCache()` é chamado após toda operação de escrita (create/update/delete)
- Evita leituras redundantes ao Firestore

---

## 6. Fluxo de Dados e Persistência

### Coleções Firestore

| Coleção | Sub-módulo | Dados |
|---------|-----------|-------|
| `triage_entries` | Triagem & Quarentena | Lotes em quarentena/triagem |
| `cavity_closures` | Controle de Cavidades | Registros de fechamento/abertura de cavidades |
| `cavity_molds` | Controle de Cavidades | Moldes customizados cadastrados pelo usuário |
| `cavity_machine_assignments` | Vinculação Molde↔Máquina | Vinculações ativas entre moldes e máquinas |
| `cavity_releases` | Liberação de Molde | Snapshots de estado do molde no momento da liberação |

### LocalStorage

| Chave | Dados |
|-------|-------|
| `cav_custom_molds` | Array JSON de moldes customizados (fallback offline) |
| `cav_mold_cavities` | Map JSON `{ moldId: nrCavidades }` (overrides de contagem) |

### Diagrama de Fluxo — Triagem

```
Formulário Quarentena → sendToQuarantine() → Firestore (QUARENTENA)
                                                    ↓
                                          Botão "Triar" → startTriage() → (EM_TRIAGEM)
                                                    ↓
                                    Modal Resultado → recordTriageResult()
                                          ↓                         ↓
                                  pending > 0 → EM_TRIAGEM    pending = 0 → CONCLUIDA
                                          ↓
                              Botão "Finalizar" → finalizeTriage() → CONCLUIDA
```

### Diagrama de Fluxo — Cavidades

```
Selecionar Molde → Inicializar estados (todas abertas)
        ↓
Carregar Firestore (cavity_closures) → Aplicar fechamentos não corrigidos
        ↓
Renderizar Grid + KPIs + Histórico
        ↓
Clicar Cavidade → Preencher formulário lateral
        ↓
Submeter Ação → Atualizar estado + Salvar Firestore + Sync Vinculações
```

---

## 7. Permissões e Segurança

| Recurso | Regra de Acesso |
|---------|----------------|
| Visualização da aba QUALIDADE | Qualquer usuário autenticado |
| Envio para quarentena | Qualquer usuário (campo operador é preenchido) |
| Registrar resultado de triagem | Qualquer usuário (operador do turno atual é detectado automaticamente) |
| Editar/Excluir lote | Qualquer usuário (sem verificação de ownership) |
| Cadastro/Exclusão de molde | Moldes customizados: qualquer usuário. Moldes de sistema: protegidos |
| Vinculação Molde↔Máquina | Qualquer usuário (registra `assignedBy`) |
| Liberação de Molde | Requer seleção de inspetor via autocomplete |

> **Nota:** O controle de acesso granular por perfil (RBAC) está planejado para fases futuras conforme documentado em `docs/06-PROXIMOS-PASSOS/PLANO-FIREBASE-HOSTING-AUTH-RBAC.md`.

---

*Documento gerado como referência técnica e operacional da aba QUALIDADE do sistema HokkaidoMES.*
