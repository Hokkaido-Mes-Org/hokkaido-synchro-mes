# 📘 Manual do Operador - Synchro MES v2.0

## Sistema de Execução de Manufatura - Hokkaido Plastics

---

## 📋 Índice

1. [Introdução ao Sistema](#1-introdução-ao-sistema)
2. [Login e Acesso](#2-login-e-acesso)
3. [Navegação Principal](#3-navegação-principal)
4. [Aba Lançamento - Operações Diárias](#4-aba-lançamento---operações-diárias)
5. [Lançar Produção](#5-lançar-produção)
6. [Registrar Perdas](#6-registrar-perdas)
7. [Controle de Paradas](#7-controle-de-paradas)
8. [Registrar Borra](#8-registrar-borra)
9. [Registrar Retrabalho](#9-registrar-retrabalho)
10. [Entendendo os Indicadores](#10-entendendo-os-indicadores)
11. [Dúvidas Frequentes](#11-dúvidas-frequentes)
12. [Glossário](#12-glossário)

---

## 1. Introdução ao Sistema

O **Synchro MES** é o sistema de controle de produção da Hokkaido Plastics. Ele permite registrar em tempo real:

- ✅ Produção de peças
- ⚠️ Perdas e refugos
- ⏱️ Paradas de máquina
- 🔧 Retrabalhos
- 📊 Acompanhar indicadores de eficiência

### Por que usar o sistema?

1. **Rastreabilidade**: Todo lançamento fica registrado com data, hora e operador
2. **Controle em tempo real**: Gestores acompanham a produção de qualquer lugar
3. **Melhoria contínua**: Dados permitem identificar problemas e oportunidades
4. **Transparência**: Histórico completo disponível para consulta

---

## 2. Login e Acesso

### Como fazer login:

1. Abra o sistema no navegador (Chrome recomendado)
2. Digite seu **nome de usuário**
3. Digite sua **senha**
4. Clique em **Entrar**

### Sua identificação:

Após o login, seu nome aparece no canto superior direito da tela, junto com seu perfil (Operador/Gestor).

> ⚠️ **IMPORTANTE**: Nunca compartilhe sua senha. Cada lançamento é registrado com seu nome.

### Como sair (Logout):

Clique no botão **Sair** (vermelho) no canto superior direito quando terminar de usar.

---

## 3. Navegação Principal

O menu lateral esquerdo contém todas as abas do sistema:

| Aba | Ícone | Função |
|-----|-------|--------|
| **Planejamento** | 📋 | Visualizar o plano de produção do dia |
| **Ordens** | 📦 | Consultar ordens de produção |
| **Lançamento** | ⌨️ | **Principal aba do operador** - Registrar produção, perdas e paradas |
| **Análise** | 📊 | Ver gráficos e indicadores (gestores) |
| **Relatórios** | 📈 | Gerar relatórios de produção |
| **Paradas Longas** | 📅 | Consultar paradas programadas |
| **Ajustes** | ⚙️ | Configurações do sistema (gestores) |

### Dica Mobile 📱

Em celulares, clique no botão **☰** (três linhas) no canto superior esquerdo para abrir o menu.

---

## 4. Aba Lançamento - Operações Diárias

Esta é a **aba principal** para o operador. Aqui você realiza todas as operações do dia.

### 4.1 Painel de Controle de Produção

Ao entrar na aba Lançamento, você verá:

- **Cards de máquinas**: Cada retângulo representa uma máquina planejada para o dia
- **Turno atual**: Indicado no canto superior direito (T1, T2 ou T3)

### Turnos:
- **T1 (1º Turno)**: 07:00 às 14:59
- **T2 (2º Turno)**: 15:00 às 22:59
- **T3 (3º Turno)**: 23:00 às 06:59

### 4.2 Selecionando sua Máquina

1. Localize o card da sua máquina (ex: H-01, H-05, H-11...)
2. **Clique no card** para selecioná-lo
3. O card ficará destacado em **azul** quando selecionado
4. O painel de controle aparecerá abaixo

> 🔴 **Card Vermelho**: Indica que a máquina está com **parada ativa**

### 4.3 Informações do Card

Cada card mostra:
- **Número da máquina** (ex: H-01)
- **Produto** em produção
- **Matéria-prima** (MP)
- **Progresso** do lote (barra de progresso)
- **Produzido / Meta** do lote

---

## 5. Lançar Produção

### Quando lançar?

Lance a produção **ao final de cada hora** ou quando completar embalagens.

### Como lançar:

1. **Selecione sua máquina** (clique no card)
2. Clique no botão azul **"Lançar Produção"**
3. Um formulário aparecerá:

| Campo | O que preencher |
|-------|-----------------|
| **Embalagens Fechadas** | Quantidade de sacos/caixas completamente cheios |
| **Peças Soltas** | Peças que não completaram uma embalagem (opcional) |
| **Operador** | Selecione seu nome |

4. Clique em **"Confirmar Lançamento"**
5. Aguarde a mensagem de sucesso ✅

### Exemplo prático:

> Você produziu 3 sacos de 100 peças + 45 peças soltas
> - Embalagens Fechadas: **3**
> - Peças Soltas: **45**
> - Total registrado: 345 peças

### ⚠️ Dicas importantes:

- O sistema calcula automaticamente o total baseado na quantidade da embalagem
- Confira se o produto e máquina estão corretos antes de confirmar
- Lançamentos aparecem na lista "Lançamentos Recentes" abaixo

---

## 6. Registrar Perdas

### O que são perdas?

- **Refugos**: Peças defeituosas que não podem ser vendidas
- **Rebarbas**: Material excedente do processo
- **Peças quebradas**: Danificadas durante produção

### Quando registrar?

Registre **imediatamente** quando identificar peças com defeito ou perda de material.

### Como registrar:

1. **Selecione sua máquina**
2. Clique no botão laranja **"Registrar Perdas"**
3. Preencha o formulário:

| Campo | O que preencher |
|-------|-----------------|
| **Peso (kg)** | Peso total das perdas em quilogramas |
| **Tipo de Perda** | Selecione: Refugo, Rebarba, Setup, etc. |
| **Motivo** | Selecione o motivo da perda |
| **Observações** | Detalhes adicionais (opcional) |

4. Clique em **"Confirmar"**

### Tipos de Perda:

| Tipo | Quando usar |
|------|-------------|
| **Refugo** | Peças com defeito visível |
| **Rebarba** | Excesso de material nas peças |
| **Setup** | Perdas durante ajuste da máquina |
| **Purga** | Material descartado ao limpar rosca |
| **Contaminação** | Material misturado ou sujo |

---

## 7. Controle de Paradas

### 7.1 Iniciar Parada

Quando a máquina parar por qualquer motivo:

1. **Selecione sua máquina**
2. Clique no botão vermelho **"Iniciar Parada"**
3. Selecione o **Motivo da Parada**:

| Categoria | Exemplos |
|-----------|----------|
| **Setup** | Troca de molde, troca de cor |
| **Manutenção** | Máquina quebrada, ajustes mecânicos |
| **Qualidade** | Aguardando aprovação, problema no produto |
| **Material** | Falta de matéria-prima |
| **Utilidades** | Falta de água, energia |
| **Outros** | Reunião, intervalo programado |

4. Clique em **"Confirmar Início"**
5. O botão muda para **"Finalizar Parada"** e um timer aparece

> 🔴 O card da máquina ficará **VERMELHO** enquanto a parada estiver ativa

### 7.2 Finalizar Parada

Quando a máquina voltar a produzir:

1. Clique no botão vermelho **"Finalizar Parada"**
2. O sistema registra automaticamente o tempo de parada
3. O card volta à cor normal

### ⚠️ Importante:

- **Sempre finalize a parada** quando a máquina voltar
- Se esquecer, peça a um gestor para ajustar
- Paradas não finalizadas afetam os indicadores

### 7.3 Lançamento Manual de Parada

Para registrar paradas que já ocorreram:

1. Clique em **"Lançamento Manual de Parada"**
2. Preencha:
   - Data e hora de início
   - Data e hora de término
   - Motivo da parada
3. Confirme o lançamento

---

## 8. Registrar Borra

### O que é Borra?

Resíduo do processo de injeção que precisa ser descartado (material degradado, sujeira do cilindro).

### Como registrar:

1. **Selecione sua máquina**
2. Clique em **"Registrar Borra"** (botão amarelo)
3. Preencha:

| Campo | O que preencher |
|-------|-----------------|
| **Peso (kg)** | Peso da borra em quilogramas |
| **Observações** | Motivo ou detalhes (opcional) |

4. Confirme o lançamento

---

## 9. Registrar Retrabalho

### O que é Retrabalho?

Peças que precisaram de ajustes/correções mas podem ser aproveitadas.

### Como registrar:

1. **Selecione sua máquina**
2. Clique em **"Registrar Retrabalho"** (botão roxo)
3. Preencha:

| Campo | O que preencher |
|-------|-----------------|
| **Quantidade** | Número de peças retrabalhadas |
| **Tipo** | Tipo de retrabalho realizado |
| **Observações** | Detalhes do que foi feito |

4. Confirme o lançamento

---

## 10. Entendendo os Indicadores

### 10.1 Indicadores na Tela

Após selecionar uma máquina, você verá 4 cards de indicadores:

| Indicador | O que significa | Meta |
|-----------|-----------------|------|
| **Produzido Hoje** | Total de peças boas produzidas | Quanto maior, melhor |
| **Eficiência (%)** | Produção real ÷ Produção esperada | Meta: 85% ou mais |
| **Perdas (kg)** | Total de material perdido | Quanto menor, melhor |
| **Paradas (min)** | Tempo total de máquina parada | Quanto menor, melhor |

### 10.2 Gráfico de Produção

O gráfico mostra hora a hora:
- **Barra Azul**: Produção planejada
- **Barra Verde**: Produção executada (o que você produziu)
- **Linha Vermelha**: Meta acumulada

### 10.3 Barra de Progresso (Timeline)

- Mostra o progresso da meta diária
- **Verde**: Produção à frente ou no prazo
- **Amarelo**: Produção um pouco atrasada
- **Vermelho**: Produção muito atrasada

### 10.4 Lista de Lançamentos Recentes

Abaixo do painel, você vê todos os lançamentos do dia:
- Pode filtrar por tipo: **Todos**, **Produção**, **Perdas**, **Paradas**
- Cada lançamento mostra: hora, tipo, quantidade, operador

---

## 11. Dúvidas Frequentes

### ❓ Errei um lançamento, o que fazer?

Entre em contato com o gestor imediatamente. Apenas gestores podem editar ou excluir lançamentos.

### ❓ A máquina não aparece na lista

Verifique se:
1. A máquina foi incluída no planejamento do dia
2. A data do sistema está correta
3. Você está no turno correto

### ❓ O sistema está lento

1. Atualize a página (F5)
2. Verifique a conexão com a internet
3. Feche outras abas do navegador

### ❓ Esqueci de finalizar uma parada

Informe o gestor. Ele pode fazer o lançamento manual com os horários corretos.

### ❓ O turno mudou mas ainda mostra o anterior

Atualize a página (F5). O sistema atualiza automaticamente, mas às vezes precisa de refresh.

### ❓ Posso usar no celular?

Sim! O sistema funciona em celulares e tablets. Use o navegador Chrome para melhor experiência.

### ❓ Posso fazer lançamento de ontem?

Apenas gestores podem fazer lançamentos retroativos. Informe o gestor sobre a situação.

---

## 12. Glossário

| Termo | Significado |
|-------|-------------|
| **OP** | Ordem de Produção |
| **MP** | Matéria-Prima |
| **Lote** | Quantidade total da ordem de produção |
| **Ciclo** | Tempo para produzir uma "batida" na máquina |
| **Cavidades** | Quantidade de peças produzidas por ciclo |
| **Setup** | Preparação/ajuste da máquina |
| **Refugo** | Peças defeituosas descartadas |
| **Eficiência** | % de aproveitamento do tempo produtivo |
| **OEE** | Overall Equipment Effectiveness (Eficiência Global) |
| **Purga** | Limpeza do cilindro da injetora |
| **Borra** | Resíduo do processo de injeção |

---

## 📞 Suporte

Em caso de problemas ou dúvidas:

1. **Primeiro**: Consulte este manual
2. **Segundo**: Fale com o líder do turno
3. **Terceiro**: Entre em contato com o gestor

---

## ✅ Checklist do Operador

Use este checklist diariamente:

- [ ] Fazer login no início do turno
- [ ] Verificar se minha máquina aparece no sistema
- [ ] Registrar produção a cada hora
- [ ] Registrar perdas imediatamente quando ocorrerem
- [ ] Iniciar parada sempre que a máquina parar
- [ ] Finalizar parada quando a máquina voltar
- [ ] Conferir lançamentos antes do final do turno
- [ ] Fazer logout ao sair

---

**Versão do Manual**: 1.0  
**Última Atualização**: Novembro/2025  
**Sistema**: Synchro MES v2.0

---

*Este manual foi desenvolvido para capacitar os operadores no uso correto do sistema Synchro MES. Leia com atenção e consulte sempre que tiver dúvidas.*
