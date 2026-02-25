# HokkaidoMES — Cadastro de Usuários e Mapeamento de Acessos

> **Última atualização**: Fevereiro 2026
> **Fonte de dados**: `login.html` (base de usuários) + `auth.js` (permissões por aba)
> **Total de usuários**: 55

---

## 1. Resumo por Perfil (Role)

| Role | Qtd | Nível de Acesso |
|------|-----|-----------------|
| **suporte** | 9 | Acesso total ao sistema (equivale a admin) |
| **gestor** | 19 | Acesso gerencial completo + Dashboard TV |
| **lider** | 3 | Acesso de liderança + setup + ferramentaria |
| **operador** | 24 | Acesso básico (planejamento, lançamento, análise) |

---

## 2. Legenda de Permissões

| Código | Descrição |
|--------|-----------|
| `planejamento` | Visualizar planejamento diário |
| `lancamento` | Lançar produção, paradas, refugos |
| `analise` | Visualizar gráficos e KPIs |
| `dashboard-tv` | Acesso ao Dashboard TV (chão de fábrica) |
| `relatorios` | Gerar e visualizar relatórios |
| `lançamento_manual_producao` | Lançamento manual de produção |
| `lançamento_manual_perdas` | Lançamento manual de perdas/refugo |
| `lançamento_manual_paradas` | Lançamento manual de paradas |
| `qualidade` | Acesso à aba de qualidade |
| `ajustes` | Acesso à aba de ajustes |
| `admin` | Acesso administrativo (admin-dados) |

---

## 3. Lista Completa de Usuários

### 3.1 Usuários com Perfil SUPORTE (Acesso Total)

| # | Login | Senha | Nome | Permissões |
|---|-------|-------|------|------------|
| 1 | `raphael.moreira` | Raphael2025! | Raphael Moreira | planejamento, lancamento, analise, lançamento_manual_producao, lançamento_manual_perdas, qualidade, ajustes, relatorios, admin |
| 2 | `roberto.fernandes` | Roberto2025! | Roberto Fernandes | planejamento, lancamento, analise, lançamento_manual_producao, lançamento_manual_perdas, qualidade, ajustes, relatorios, admin |
| 3 | `daniella.braganca` | Daniella2025! | Daniella Bragança | planejamento, lancamento, analise, lançamento_manual_producao, lançamento_manual_perdas, qualidade, ajustes, relatorios, admin |
| 4 | `michelle.benjamin` | Michelle2025! | Michelle Benjamin | planejamento, lancamento, analise, lançamento_manual_producao, lançamento_manual_perdas, qualidade, ajustes, relatorios, admin |
| 5 | `marilise.katia` | Marilise2026! | Marilise Katia | planejamento, lancamento, analise, lançamento_manual_producao, lançamento_manual_perdas, qualidade, ajustes, relatorios, admin |
| 6 | `cleidiana` | Cleidiana2025! | Cleidiana | planejamento, lancamento, analise, lançamento_manual_producao, lançamento_manual_perdas, qualidade, ajustes, relatorios, admin |
| 7 | `aline.guedes` | Aline2025! | Aline Guedes | planejamento, lancamento, analise, lançamento_manual_producao, lançamento_manual_perdas, qualidade, ajustes, relatorios, admin |
| 8 | `ferramentaria.geral` | Ferramentaria2025! | Ferramentaria Geral | planejamento, lancamento, analise, lançamento_manual_paradas, dashboard-tv |
| 9 | `manutencao.geral` | Manutencao2025! | Manutenção Geral | planejamento, lancamento, analise, lançamento_manual_paradas, dashboard-tv |
| 10 | `compras` | Compras2025! | Compras | planejamento, lancamento, analise, lançamento_manual_paradas, dashboard-tv |

### 3.2 Usuários com Perfil GESTOR

| # | Login | Senha | Nome | Permissões extras |
|---|-------|-------|------|-------------------|
| 1 | `gestor` | gestor123 | Gestor de Produção | dashboard-tv |
| 2 | `supervisor` | sup123 | Supervisor | dashboard-tv |
| 3 | `leandro.camargo` | Leandro2025! | Leandro Camargo | dashboard-tv, relatorios |
| 4 | `tiago.oliveira` | Tiago2025! | Tiago Oliveira | dashboard-tv, setup-maquinas, pcp |
| 5 | `lidiomar.landim` | Lidiomar2026! | Lidiomar Landim | dashboard-tv |
| 6 | `werigue` | Werigue2025! | Werigue | dashboard-tv, relatorios |
| 7 | `erika.muta` | Erika2025! | Erika Muta | dashboard-tv |
| 8 | `daniel.rocha` | Daniel2025! | Daniel Rocha | dashboard-tv, pmp |
| 9 | `leonardo.doria` | Leonardo2025! | Leonardo Dória | dashboard-tv |
| 10 | `thiago.alberigi` | Thiago2025! | Thiago Alberigi | dashboard-tv |
| 11 | `vania` | Vania2025! | Vânia | dashboard-tv |
| 12 | `silvio.piazera` | Silvio2025! | Sílvio Piazera | dashboard-tv |
| 13 | `diego.goto` | Diego2025! | Diego Goto | dashboard-tv |
| 14 | `elaine` | Elaine2026! | Elaine | dashboard-tv |
| 15 | `cicero.silva` | Cicero2025! | Cicero Silva | dashboard-tv |
| 16 | `jefferson.muniz` | Jefferson2025! | Jefferson Muniz | dashboard-tv |
| 17 | `leandro.sebastiao` | Leandro2025! | Leandro Sebastião | dashboard-tv |
| 18 | `alessandro.santos` | Alessandro2025! | Alessandro Santos | dashboard-tv, relatorios |
| 19 | `manaus.silva` | Manaus2025! | Manaus Silva | dashboard-tv |
| 20 | `joao.silva` | Joao2025! | João Silva | dashboard-tv |
| 21 | `victor.lima` | Victor2025! | Victor Lima | dashboard-tv, relatorios |
| 22 | `rafael.pontes` | Rafael2025! | Rafael Pontes | dashboard-tv, relatorios |
| 23 | `time.qualidade` | Qualidade2025! | Time Qualidade | dashboard-tv, relatorios |
| 24 | `filipe.schulz` | Filipe2025! | Filipe Schulz | dashboard-tv |
| 25 | `tania.consulo` | Tania2026! | Tânia Consulo | dashboard-tv |

> **Nota**: Todos os gestores possuem permissões base: `planejamento`, `lancamento`, `analise` + as extras listadas.

### 3.3 Usuários com Perfil LÍDER

| # | Login | Senha | Nome | Permissões |
|---|-------|-------|------|------------|
| 1 | `luciano` | Luciano2025! | Luciano | planejamento, lancamento, analise, lançamento_manual_producao, lançamento_manual_perdas, qualidade, ajustes, relatorios, admin |
| 2 | `davi.batista` | Davi2025! | Davi Batista | planejamento, lancamento, analise, lançamento_manual_producao, lançamento_manual_perdas, qualidade, ajustes, relatorios, admin |
| 3 | `linaldo` | Linaldo2025! | Linaldo | planejamento, lancamento, analise, dashboard-tv |

### 3.4 Usuários com Perfil OPERADOR

| # | Login | Senha | Nome | Permissões extras |
|---|-------|-------|------|-------------------|
| 1 | `admin` | admin123 | Administrador | *(base apenas)* |
| 2 | `operador` | op123 | Operador de Produção | *(base apenas)* |
| 3 | `alexandre.de.paula` | Alexandre2025! | Alexandre de Paula | *(base apenas)* |
| 4 | `felipe.rafael` | Felipe2025! | Felipe Rafael | *(base apenas)* |
| 5 | `fernando.monteiro` | Fernando2025! | Fernando Monteiro | *(base apenas)* |
| 6 | `gabriel.santos` | Gabriel2025! | Gabriel Santos | *(base apenas)* |
| 7 | `guilherme.muniz` | Guilherme2025! | Guilherme Muniz | *(base apenas)* |
| 8 | `maiara.camargo` | Maiara2025! | Maiara Camargo | *(base apenas)* |
| 9 | `noely.lima` | Noely2025! | Noely Lima | *(base apenas)* |
| 10 | `polyne.fernandes` | Polyne2025! | Polyne Fernandes | *(base apenas)* |
| 11 | `regina.de.fatima` | Regina2025! | Regina de Fatima | *(base apenas)* |
| 12 | `rodrigo.valin` | Rodrigo2025! | Rodrigo Valin | *(base apenas)* |
| 13 | `sebastiao.marcio` | Sebastião2025! | Sebastião Márcio | *(base apenas)* |
| 14 | `viviane.souza` | Viviane2025! | Viviane Souza | *(base apenas)* |
| 15 | `willian.andrade` | Willian2025! | Willian Andrade | *(base apenas)* |
| 16 | `angelina.magalhaes` | Angelina2025! | Angelina Magalhaes | *(base apenas)* |
| 17 | `jose.otavio` | Jose2025! | Jose Otavio | *(base apenas)* |
| 18 | `maria.barbosa` | Maria2025! | Maria Barbosa | *(base apenas)* |
| 19 | `isalem.evandro` | Isalem2025! | Isalem Evandro | *(base apenas)* |
| 20 | `ronaldo.santos` | Ronaldo2025! | Ronaldo Santos | *(base apenas)* |
| 21 | `aislan.everton` | Aislan2025! | Aislan Everton | *(base apenas)* |
| 22 | `daniel.de.paula` | Daniel2025! | Daniel de Paula | *(base apenas)* |
| 23 | `eloi.siqueira` | Eloi2025! | Eloi Siqueira | *(base apenas)* |
| 24 | `glaucia.lisboa` | Glaucia2025! | Glaucia Lisboa | *(base apenas)* |
| 25 | `jeosmar.massoni` | Jeosmar2025! | Jeosmar Massoni | *(base apenas)* |
| 26 | `josue.carvalho` | Josue2025! | Josué Carvalho | *(base apenas)* |
| 27 | `matheus.ventura` | Matheus2025! | Matheus Ventura | *(base apenas)* |
| 28 | `silvia.aparecida` | Silvia2025! | Silvia Aparecida | *(base apenas)* |
| 29 | `rafael.shimada` | Rafael2025! | Rafael Shimada | *(base apenas)* |

**Operadores com permissões extras:**

| # | Login | Senha | Nome | Permissões extras |
|---|-------|-------|------|-------------------|
| 30 | `ademir.de.almeida` | Ademir2025! | Ademir de Almeida | lançamento_manual_producao, lançamento_manual_perdas |
| 31 | `daniel.lisboa` | Daniel2025! | Daniel Lisboa | lançamento_manual_producao, lançamento_manual_perdas |
| 32 | `matheus.algusto` | Matheus2025! | Matheus Algusto | lançamento_manual_producao, lançamento_manual_perdas |
| 33 | `stanley.eduardo` | Stanley2025! | Stanley Eduardo | lançamento_manual_producao, lançamento_manual_perdas |
| 34 | `renata.rocha` | Renata2025! | Renata Rocha | lançamento_manual_producao, lançamento_manual_perdas |

**Operadores por turno (contas compartilhadas):**

| # | Login | Senha | Nome | Turno | Permissões extras |
|---|-------|-------|------|-------|-------------------|
| 35 | `operador.turno1` | Producao1T | Operador Turno 1 | T1 | paradas-longas |
| 36 | `operador.turno2` | Producao2T | Operador Turno 2 | T2 | paradas-longas |
| 37 | `operador.turno3` | Producao3T | Operador Turno 3 | T3 | paradas-longas |

> **Nota**: Todos os operadores possuem permissões base: `planejamento`, `lancamento`, `analise`.

---

## 4. Mapeamento de Acesso por Aba (Tab)

A tabela abaixo cruza **cada aba do sistema** com **quem pode acessá-la**, baseado nas regras de `auth.js`:

### 4.1 Abas com Controle por Role

| Aba | Slug | Regra de Acesso |
|-----|------|-----------------|
| **Lançamento** | `lancamento` | Qualquer usuário com permissão `lancamento` |
| **Planejamento** | `planejamento` | Qualquer usuário com permissão `planejamento` ou `lancamento` |
| **Ordens** | `ordens` | Qualquer usuário com permissão `planejamento` ou `lancamento` |
| **Análise** | `analise` | Qualquer usuário com permissão `analise` |
| **Paradas Longas** | `paradas-longas` | Qualquer usuário com permissão `lancamento`, `planejamento` ou `analise` |

### 4.2 Abas com Controle por Nome de Usuário (ACL)

| Aba | Slug | Usuários Autorizados |
|-----|------|---------------------|
| **Acompanhamento** | `acompanhamento` | Leandro Camargo, Michelle Benjamin, Tiago Oliveira, Davi Batista, Luciano |
| **Histórico** | `historico-sistema` | Leandro Camargo, Michelle Benjamin, Tiago Oliveira |
| **Admin Dados** | `admin-dados` | Leandro Camargo, Michelle Benjamin, Tiago Oliveira |
| **PMP** | `pmp` | Leandro Camargo, Manaus Silva |
| **PCP** | `pcp` | Leandro Camargo, Roberto Fernandes, Elaine, Daniel Rocha, Tiago Oliveira |
| **Liderança** | `lideranca-producao` | Leandro Camargo, Michelle Benjamin, Manaus Silva, Luciano, Davi Batista, Linaldo, Tiago Oliveira + qualquer `lider` |
| **Setup** | `setup-maquinas` | Leandro Camargo, Michelle Benjamin, Tiago Oliveira + qualquer `lider` |
| **Ferramentaria** | `ferramentaria` | Leandro Camargo, Michelle Benjamin, Luciano, Davi Batista + qualquer `lider` |
| **Qualidade** | `qualidade` | Apenas role `suporte` ou Leandro Camargo |
| **Processo** | `processo` | Apenas role `suporte` ou Leandro Camargo |
| **Ajustes** | `ajustes` | Role `suporte`, `gestor` ou `lider` |
| **Relatórios** | `relatorios` | Role `suporte`, `gestor`, `lider` ou permissão `relatorios` |

### 4.3 Controles Adicionais (script.js)

| Recurso | Usuários com Acesso |
|---------|---------------------|
| **Aba PMP (script.js)** | Leandro Camargo, Manaus Silva, Daniel Rocha |
| **Dashboard TV (script.js)** | Daniel Rocha, Linaldo, Luciano, Leandro Camargo, Davi Batista + qualquer `lider` |

---

## 5. Matriz de Acesso Completa por Usuário

### 5.1 Acesso Total (todas as abas)

| Usuário | Role | Abas Restritas que Acessa |
|---------|------|--------------------------|
| **Leandro Camargo** | gestor | TODAS (hardcoded como admin em auth.js) |
| **Michelle Benjamin** | suporte | Acompanhamento, Histórico, Admin, Liderança, Setup, Ferramentaria, Qualidade, Processo |
| **Tiago Oliveira** | gestor | Acompanhamento, Histórico, Admin, PCP, Liderança, Setup |

### 5.2 Acesso Ampliado

| Usuário | Role | Abas Especiais |
|---------|------|----------------|
| **Davi Batista** | lider | Acompanhamento, Liderança, Ferramentaria, Setup |
| **Luciano** | lider | Acompanhamento, Liderança, Ferramentaria, Setup |
| **Linaldo** | lider | Liderança, Setup |
| **Manaus Silva** | gestor | PMP, Liderança |
| **Daniel Rocha** | gestor | PCP, PMP (via script.js) |
| **Roberto Fernandes** | suporte | PCP, Qualidade, Processo |
| **Elaine** | gestor | PCP |

### 5.3 Acesso Básico (Apenas Planejamento + Lançamento + Análise)

Todos os 29 operadores listados na seção 3.4 (sem permissões extras).

---

## 6. Hierarquia de Acesso

```
suporte (acesso total)
  ├── Qualidade ✅
  ├── Processo ✅
  ├── Ajustes ✅
  ├── Relatórios ✅
  └── (todas as abas normais)
  
gestor
  ├── Ajustes ✅
  ├── Relatórios ✅
  ├── Dashboard TV ✅
  └── (abas normais com ACL por nome)

lider
  ├── Ajustes ✅
  ├── Relatórios ✅
  ├── Setup ✅
  ├── Ferramentaria ✅
  ├── Liderança ✅
  └── (abas normais)
  
operador
  ├── Planejamento ✅
  ├── Lançamento ✅
  ├── Análise ✅
  └── Paradas Longas ✅ (se tiver permissão)
```

---

## 7. Sessão e Autenticação

| Parâmetro | Valor |
|-----------|-------|
| **Tipo de autenticação** | Login/senha hardcoded em `login.html` |
| **Armazenamento de sessão** | localStorage (24h) ou sessionStorage (8h) |
| **"Manter conectado"** | Salva em localStorage com TTL de 24 horas |
| **Sem "manter conectado"** | Salva em sessionStorage com TTL de 8 horas |
| **Busca tolerante** | Aceita variações com/sem acento, com ponto ou espaço |
| **Logout** | Limpa localStorage + sessionStorage → redireciona para login.html |

---

## 8. ⚠️ PROPOSTA: Nova Sistematização de Roles e Permissões

> **Status**: SUGESTIVO — Para análise antes da migração para Firebase Auth
> **Objetivo**: Estabelecer hierarquia clara de permissões e reduzir ACLs por nome de usuário
> **Próximo Passo**: Revisar, ajustar e aprovar antes de implementar

### 8.1 Problema com Estrutura Atual

| Problema | Impacto | Exemplo |
|----------|---------|---------|
| ACL por nome hardcoded | Quebra se usuario muda de nome | `allowedUsers.includes('Leandro Camargo')` |
| Líderes sem role próprio | Permissões definem tudo, role vira irrelevante | Linaldo = lider role + poucas permissões |
| Suporte + Gestor mesclados | Difícil separar operações de admin | Alguns gestores têm lançamento_manual |
| Contas compartilhadas | Sem auditoria de quem fez o quê | ferramentaria.geral, operador.turno1 |
| Leandro hardcoded | Não escala para múltiplos admins | `if (name === 'Leandro Camargo')` em auth.js |

### 8.2 Proposta: 5 Níveis Hierárquicos

```
┌─────────────────────────────────────────────────────────────────┐
│ NÍVEL 0 — SUPER_ADMIN (Novo!)                                   │
│ Super usuário — acesso irrestrito, gestão de sistema             │
│ Usuários: Leandro Camargo, [+1-2 conforme necessidade]           │
├─────────────────────────────────────────────────────────────────┤
│ NÍVEL 1 — ADMIN (antes: "suporte")                              │
│ Administrador técnico — qualidade, processo, ajustes, admin      │
│ Usuários: Raphael, Roberto, Daniella, Michelle, Marilise,       │
│           Cleidiana, Aline                                       │
├─────────────────────────────────────────────────────────────────┤
│ NÍVEL 2 — MANAGER (antes: "gestor")                             │
│ Gestor operacional — planejamento, lançamento, dashboard-tv      │
│ Usuários: 18 gestores restantes (sem acesso a admin/histórico)   │
├─────────────────────────────────────────────────────────────────┤
│ NÍVEL 3 — SUPERVISOR (antes: "lider")                           │
│ Líder de turno — setup, ferramentaria, liderança, relatórios     │
│ Usuários: Luciano, Davi Batista, Linaldo                         │
├─────────────────────────────────────────────────────────────────┤
│ NÍVEL 4 — SPECIALIST (Novo!)                                     │
│ Especialista em área — PCP, PMP, Qualidade                       │
│ Usuários: PCP (Roberto, Elaine, Daniel, Tiago),                  │
│           PMP (Manaus, Daniel), Qualidade (Time Qualidade)       │
├─────────────────────────────────────────────────────────────────┤
│ NÍVEL 5 — OPERATOR (antes: "operador")                           │
│ Operador chão-de-fábrica — planejamento, lançamento, análise     │
│ Usuários: 37 operadores (29 base + 5 especiais + 3 turno)        │
└─────────────────────────────────────────────────────────────────┘
```

### 8.3 Matriz de Permissões Proposta

| Permissão | SUPER_ADMIN | ADMIN | MANAGER | SUPERVISOR | SPECIALIST | OPERATOR |
|-----------|:-----------:|:-----:|:-------:|:----------:|:----------:|:--------:|
| **Planejamento** | ✅ | ✅ | ✅ | ✅ | Sim¹ | ✅ |
| **Lançamento** | ✅ | ✅ | ✅ | ✅ | Sim¹ | ✅ |
| **Análise** | ✅ | ✅ | ✅ | ✅ | Sim¹ | ✅ |
| **Dashboard TV** | ✅ | ✅ | ✅ | ✅ | — | — |
| **Relatórios** | ✅ | ✅ | ✅ | ✅ | — | — |
| **Lançamento Manual (produção)** | ✅ | ✅ | — | — | — | Sim² |
| **Lançamento Manual (perdas)** | ✅ | ✅ | — | — | — | Sim² |
| **Lançamento Manual (paradas)** | ✅ | ✅ | — | — | Sim³ | Sim² |
| **Qualidade** | ✅ | ✅ | — | — | Sim⁴ | — |
| **Ajustes** | ✅ | ✅ | ✅ | — | — | — |
| **Admin Dados** | ✅ | ✅ | — | — | — | — |
| **Histórico Sistema** | ✅ | ✅ | — | — | — | — |
| **PCP** | ✅ | ✅ | — | — | Sim⁵ | — |
| **PMP** | ✅ | ✅ | — | — | Sim⁶ | — |
| **Setup Máquinas** | ✅ | ✅ | — | ✅ | — | — |
| **Ferramentaria** | ✅ | ✅ | — | ✅ | — | — |
| **Liderança Produção** | ✅ | ✅ | — | ✅ | — | — |
| **Acompanhamento Turno** | ✅ | ✅ | ✅ | — | — | — |
| **System Logs (auditoria)** | ✅ | — | — | — | — | — |

> **Legenda**: 
> - ✅ = Acesso total
> - — = Sem acesso
> - Sim¹ = Specialist em áreas específicas
> - Sim² = 5 operadores + 3 por turno com permissão
> - Sim³ = Specialist de paradas-longas (3 operadores por turno)
> - Sim⁴ = Time Qualidade + Specialist-qualidade
> - Sim⁵ = Roberto, Elaine, Daniel Rocha, Tiago Oliveira
> - Sim⁶ = Manaus Silva, Daniel Rocha

### 8.4 Mapeamento de Usuários (Sugestão)

#### A. SUPER_ADMIN (Nível 0)

| Login | Nome | Justificativa |
|-------|------|---------------|
| `leandro.camargo` | Leandro Camargo | Admin geral do projeto |
| *Avaliar:* | *Avaliar adicionar 1-2* | *Necessário para redundância?* |

**Permissões**: Tudo

---

#### B. ADMIN (Nível 1)

| Login | Nome | Atual | Obs |
|-------|------|-------|-----|
| `raphael.moreira` | Raphael Moreira | suporte | Manter |
| `roberto.fernandes` | Roberto Fernandes | suporte | Manter (PCP mantém como specialist extra) |
| `daniella.braganca` | Daniella Bragança | suporte | Manter |
| `michelle.benjamin` | Michelle Benjamin | suporte | Manter |
| `marilise.katia` | Marilise Katia | suporte | Manter |
| `cleidiana` | Cleidiana | suporte | Manter |
| `aline.guedes` | Aline Guedes | suporte | Manter |
| `ferramentaria.geral` | Ferramentaria Geral | suporte | Manter como ADMIN, avaliar login pessoal |
| `manutencao.geral` | Manutenção Geral | suporte | Manter como ADMIN, avaliar login pessoal |
| `compras` | Compras | suporte | Manter como ADMIN, avaliar login pessoal |

**Permissões**: planejamento, lancamento, analise, lançamento_manual_producao, lançamento_manual_perdas, lançamento_manual_paradas, qualidade, ajustes, relatorios, admin, historico, acompanhamento, processo

---

#### C. MANAGER (Nível 2)

| Login | Nome | Atual | Obs |
|-------|------|-------|-----|
| `gestor` | Gestor de Produção | gestor | Manter |
| `supervisor` | Supervisor | gestor | Manter |
| `tiago.oliveira` | Tiago Oliveira | gestor | **MOVER para SPECIALIST** (especialista em PCP) |
| `lidiomar.landim` | Lidiomar Landim | gestor | Manter |
| `werigue` | Werigue | gestor | Manter |
| `erika.muta` | Erika Muta | gestor | Manter |
| `daniel.rocha` | Daniel Rocha | gestor | **MOVER para SPECIALIST** (especialista em PCP+PMP) |
| `leonardo.doria` | Leonardo Dória | gestor | Manter |
| `thiago.alberigi` | Thiago Alberigi | gestor | Manter |
| `vania` | Vânia | gestor | Manter |
| `silvio.piazera` | Sílvio Piazera | gestor | Manter |
| `diego.goto` | Diego Goto | gestor | Manter |
| `elaine` | Elaine | gestor | **MOVER para SPECIALIST** (especialista em PCP) |
| `cicero.silva` | Cicero Silva | gestor | Manter |
| `jefferson.muniz` | Jefferson Muniz | gestor | Manter |
| `leandro.sebastiao` | Leandro Sebastião | gestor | Manter |
| `alessandro.santos` | Alessandro Santos | gestor | Manter |
| `manaus.silva` | Manaus Silva | gestor | **MOVER para SPECIALIST** (especialista em PMP) |
| `joao.silva` | João Silva | gestor | Manter |
| `victor.lima` | Victor Lima | gestor | Manter |
| `rafael.pontes` | Rafael Pontes | gestor | Manter |
| `time.qualidade` | Time Qualidade | gestor | **MOVER para SPECIALIST** (qualidade dedicated) |
| `filipe.schulz` | Filipe Schulz | gestor | Manter |
| `tania.consulo` | Tânia Consulo | gestor | Manter |

**Permissões**: planejamento, lancamento, analise, dashboard-tv, relatorios, acompanhamento, ajustes

---

#### D. SUPERVISOR (Nível 3)

| Login | Nome | Atual | Obs |
|-------|------|-------|-----|
| `luciano` | Luciano | lider | Manter |
| `davi.batista` | Davi Batista | lider | Manter |
| `linaldo` | Linaldo | lider | Manter |

**Permissões**: planejamento, lancamento, analise, dashboard-tv, relatorios, setup, ferramentaria, lideranca, ajustes

---

#### E. SPECIALIST (Nível 4) — Novo!

**E.1 — Especialistas em PCP**

| Login | Nome | Atual | Área |
|-------|------|-------|------|
| `roberto.fernandes` | Roberto Fernandes | ADMIN | PCP (duplo: ADMIN + SPECIALIST) |
| `tiago.oliveira` | Tiago Oliveira | MANAGER | PCP (mover para SPECIALIST) |
| `elaine` | Elaine | MANAGER | PCP (mover para SPECIALIST) |
| `daniel.rocha` | Daniel Rocha | MANAGER | PCP + PMP (mover para SPECIALIST) |

**Permissões**: planejamento, lancamento, analise, pcp, pcp_observations, lançamento_manual_paradas

**E.2 — Especialistas em PMP**

| Login | Nome | Atual | Área |
|-------|------|-------|------|
| `manaus.silva` | Manaus Silva | MANAGER | PMP (mover para SPECIALIST) |
| `daniel.rocha` | Daniel Rocha | MANAGER | PMP + PCP (mover para SPECIALIST) |

**Permissões**: planejamento, lancamento, analise, pmp, pmp_borra, pmp_moido, lançamento_manual_paradas

**E.3 — Especialistas em Qualidade**

| Login | Nome | Atual | Área |
|-------|------|-------|------|
| `time.qualidade` | Time Qualidade | MANAGER | Qualidade (mover para SPECIALIST) |

**Permissões**: planejamento, lancamento, analise, qualidade, relatorios, lançamento_manual_perdas

---

#### F. OPERATOR (Nível 5)

| Grupo | Qtd | Permissões Base | Permissões Extras | Logins |
|-------|-----|-----------------|-------------------|--------|
| **Operadores Base** | 29 | planejamento, lancamento, analise | — | admin, operador, alexandre.de.paula, felipe.rafael, fernando.monteiro, gabriel.santos, guilherme.muniz, maiara.camargo, noely.lima, polyne.fernandes, regina.de.fatima, rodrigo.valin, sebastiao.marcio, viviane.souza, willian.andrade, angelina.magalhaes, jose.otavio, maria.barbosa, isalem.evandro, ronaldo.santos, aislan.everton, daniel.de.paula, eloi.siqueira, glaucia.lisboa, jeosmar.massoni, josue.carvalho, matheus.ventura, silvia.aparecida, rafael.shimada |
| **Operadores Avançados** | 5 | planejamento, lancamento, analise | lançamento_manual_producao, lançamento_manual_perdas | ademir.de.almeida, daniel.lisboa, matheus.algusto, stanley.eduardo, renata.rocha |
| **Operadores por Turno** | 3 | planejamento, lancamento, analise | lançamento_manual_paradas | operador.turno1, operador.turno2, operador.turno3 |

---

### 8.5 Principais Mudanças Propostas

| Mudança | Antes | Depois | Benefício |
|---------|-------|--------|-----------|
| **Eliminar ACL por nome** | `allowedUsers.includes('Leandro Camargo')` | `role === 'super_admin'` | Não quebra se nome mudar |
| **Super Admin explícito** | Hardcoded em auth.js | Role `SUPER_ADMIN` no Custom Claims | Permite 2+ admins; auditável |
| **Especialistas com role** | Permissão `pcp` fora de role | Role `SPECIALIST` + permission `pcp` | Hierarquia clara |
| **Contas compartilhadas** | ferramentaria.geral fica como admin | Considerar contas pessoais (Leandro + Ferramentaria1, 2) | Auditoria de ações |
| **Reduzir permissões de MANAGER** | dashboard-tv + relatorios + todas abas | Remover admin-dados, histórico, acompanhamento | Menor superfície de ataque |
| **Novo nível SPECIALIST** | Tiago/Daniel/Elaine/Manaus são MANAGER com permissões | Novo role com especialização clara | Escalabilidade |

---

### 8.6 Implementação Sugerida (Sequência)

1. **Fase A — Review**: Você revisa a proposta acima e sinaliza:
   - ✅ Concorda com a hierarquia?
   - ✅ Alterações nos usuários (mover Tiago, Daniel, etc.)?
   - ✅ Novos SUPER_ADMIN além de Leandro?
   - ✅ Eliminar contas compartilhadas em favor de pessoais?

2. **Fase B — Ajuste**: Realizo ajustes conforme feedback

3. **Fase C — Migração**: Usa novo documento para criar os usuários no Firebase Auth com os Custom Claims corretos

4. **Fase D — Pós-migração**: Gera relatório mapeando:
   - Nome atual → Email Firebase Auth (username@hokkaido.local)
   - Role anterior → Novo role + permissões
   - Justificativa de mudança

---

### 8.7 Checklist para Aprovação

Ao analisar a proposta, marque com ✅/❌:

- [ ] Hierarquia de 5 níveis faz sentido para o negócio?
- [ ] Mover Tiago/Daniel/Elaine/Manaus para SPECIALIST é aceitável?
- [ ] Criar SUPER_ADMIN só com Leandro ou adicionar +1?
- [ ] Contas compartilhadas (ferramentaria.geral, etc.) devem virar pessoais?
- [ ] Nova matriz de permissões reflete o necessário?
- [ ] Algum usuário em grupo errado? Revisar e sinalizar linha.
- [ ] Ambas as abas PCP e PMP em "especialista" fazem sentido?
- [ ] Aceitável remover MANAGER do acesso a "acompanhamento"?

---

### 8.8 Estimativa de Uso e Custo de Leituras Firestore por Role

> **Base de cálculo**: Dados reais do sistema pós-otimizações (Fev/2026)
> **Firestore pricing**: $0.06 por 100.000 leituras (Spark/Blaze plan)
> **Free tier**: 50.000 leituras/dia grátis (1.500.000/mês)

#### 8.8.1 Premissas de Uso

| Parâmetro | Valor |
|-----------|-------|
| Turnos por dia | 3 (T1, T2, T3 — 8h cada) |
| Dias operacionais/mês | 22 |
| Dashboard TVs ligadas 24h | 1 unidade |
| Polling ativo (active_downtimes, 300s) | Para todos com aba Lançamento aberta |
| TTL de cache médio | 300s (5 min) |
| Pollings de OEE/KPIs (60 min) | Apenas quando Análise está aberta |

#### 8.8.2 Leituras por Aba (Dados Reais Medidos)

| Aba | Collections Lidas | Leit./Acesso | Polling | Leit./Hora (ativa) |
|-----|-------------------|:------------:|---------|:------------------:|
| **Lançamento** | planning, production_entries, downtime_entries, active_downtimes, products | ~500 | 300s active_downtimes | ~812 |
| **Dashboard TV** | active_downtimes (onSnapshot), production_entries, planning | ~300 | 300s poll + realtime | ~600 |
| **Análise** | production_entries, downtime_entries, planning, losses | ~400 | 60min KPIs | ~450 |
| **Relatórios** | production_entries, planning, production_orders | ~900 | — | ~900¹ |
| **Ordens** | production_orders | ~300 | — | ~300¹ |
| **Admin Dados** | production_entries, production_orders, downtime_entries | ~400 | — | ~400¹ |
| **PCP** | pcp_observations, machine_schedule, active_downtimes, planning | ~50 | — | ~50¹ |
| **PMP** | pmp_borra, pmp_moido | ~60 | — | ~60¹ |
| **Planejamento** | production_orders, planning | ~150 | — | ~150¹ |
| **Liderança** | production_entries, planning, escalas_operadores | ~150 | — | ~150¹ |
| **Histórico** | system_logs | ~100 | — | ~100¹ |
| **Setup** | setups_maquinas, escalas_operadores | ~80 | — | ~80¹ |
| **Ferramentaria** | ferramentaria_moldes, ferramentaria_manutencoes | ~70 | — | ~70¹ |
| **Acompanhamento** | acompanhamento_turno, acompanhamento_perdas | ~20 | — | ~20¹ |
| **Qualidade** | production_entries, batch_traceability | ~100 | — | ~100¹ |

> ¹ Sem polling — leituras ocorrem apenas ao abrir ou filtrar a aba

#### 8.8.3 Perfil de Uso Típico por Role (Simulação Diária)

**SUPER_ADMIN (1 usuário — Leandro)**

| Aba | Freq./dia | Tempo ativo | Leituras |
|-----|:---------:|:-----------:|:--------:|
| Lançamento | 3× | 30min cada = 1,5h | 1.500 + 1.218 polling = **2.718** |
| Análise | 4× | 20min cada = 1,3h | 1.600 + 585 polling = **2.185** |
| PCP | 3× | 15min cada = 0,75h | **150** |
| Relatórios | 2× | 10min cada | **1.800** |
| Admin Dados | 2× | 10min cada | **800** |
| Acompanhamento | 2× | 5min cada | **40** |
| Histórico | 1× | 5min | **100** |
| PMP | 1× | 5min | **60** |
| Ordens | 2× | 5min cada | **600** |
| | | **TOTAL/dia** | **~8.453** |

---

**ADMIN (10 usuários — Raphael, Roberto, Daniella, etc.)**

| Aba | Freq./dia | Tempo ativo | Leituras/user |
|-----|:---------:|:-----------:|:-------------:|
| Lançamento | 5× | 1h cada = 5h | 2.500 + 4.060 polling = **6.560** |
| Análise | 2× | 15min cada = 0,5h | 800 + 225 polling = **1.025** |
| Qualidade | 2× | 10min cada | **200** |
| Relatórios | 1× | 10min | **900** |
| Admin Dados | 1× | 5min | **400** |
| | | **TOTAL/user/dia** | **~9.085** |
| | | **TOTAL 10 users/dia** | **~90.850** |

---

**MANAGER (18 usuários — gestores mantidos)**

| Aba | Freq./dia | Tempo ativo | Leituras/user |
|-----|:---------:|:-----------:|:-------------:|
| Lançamento | 2× | 30min cada = 1h | 1.000 + 812 polling = **1.812** |
| Análise | 2× | 15min cada = 0,5h | 800 + 225 = **1.025** |
| Dashboard TV | 1× | 15min | **150** |
| Relatórios | 1× | 10min | **900** |
| Acompanhamento | 1× | 5min | **20** |
| | | **TOTAL/user/dia** | **~3.907** |
| | | **TOTAL 18 users/dia** | **~70.326** |

---

**SUPERVISOR (3 usuários — Luciano, Davi, Linaldo)**

| Aba | Freq./dia | Tempo ativo | Leituras/user |
|-----|:---------:|:-----------:|:-------------:|
| Lançamento | 8× | 1,5h cada = 12h | 4.000 + 9.744 polling = **13.744** |
| Setup | 2× | 10min cada | **160** |
| Ferramentaria | 2× | 10min cada | **140** |
| Liderança | 3× | 15min cada = 0,75h | **450** |
| Dashboard TV | Contínuo fundo | 2h | **1.200** |
| | | **TOTAL/user/dia** | **~15.694** |
| | | **TOTAL 3 users/dia** | **~47.082** |

---

**SPECIALIST (6 usuários — PCP: Tiago, Elaine, Daniel, Roberto; PMP: Manaus, Daniel; Qualidade: Time)**

| Tipo | Aba | Freq./dia | Tempo ativo | Leituras/user |
|------|-----|:---------:|:-----------:|:-------------:|
| PCP | Lançamento | 3× | 1h | 1.500 + 812 = **2.312** |
| PCP | PCP | 6× | 30min cada = 3h | **300** |
| PMP | PMP | 4× | 20min cada | **240** |
| PMP | Análise | 2× | 15min cada | **1.025** |
| Qualidade | Qualidade | 4× | 15min cada | **400** |
| Qualidade | Relatórios | 2× | 10min cada | **1.800** |
| | | **TOTAL médio/user/dia** | **~3.500** |
| | | **TOTAL 6 users/dia** | **~21.000** |

> Nota: Roberto aparece como ADMIN (10 users) E SPECIALIST PCP — contado leituras apenas uma vez no ADMIN.

---

**OPERATOR (37 usuários — 29 base + 5 avançados + 3 turno)**

| Aba | Freq./dia | Tempo ativo | Leituras/user |
|-----|:---------:|:-----------:|:-------------:|
| Lançamento | 10× | 2h cada (turno todo) = 6h | 5.000 + 4.872 polling = **9.872** |
| Planejamento | 2× | 5min cada | **300** |
| Análise | 1× | 5min | **450** |
| | | **TOTAL/user/dia** | **~10.622** |
| | | **TOTAL 37 users/dia** | **~393.014**² |

> ² Na prática ~10-15 operadores por turno usam o sistema simultaneamente (não 37). Estimativa realista: ~15 ativos/turno × 3T = ~45 sessões → **~159.330/dia**

---

**Dashboard TV (Standalone — 24h, sem auth)**

| Collection | Polling | Leit./hora | Leit./dia (24h) |
|-----------|---------|:----------:|:---------------:|
| active_downtimes (onSnapshot) | Realtime | ~26³ | **~624** |
| production_entries (.get) | 300s | ~2.400 | **~57.600** |
| planning (.get) | 300s | ~600 | **~14.400** |
| | | **TOTAL/dia** | **~72.624** |

> ³ onSnapshot cobra 1 leitura inicial por doc + delta; com 26 máquinas = ~26 base + incrementais

---

#### 8.8.4 Consolidação: Leituras/Dia por Role (Sistema Atual)

| Role | Qtd Users | Leit./User/Dia | Total/Dia | % do Total |
|------|:---------:|:--------------:|:---------:|:----------:|
| **SUPER_ADMIN** | 1 | 8.453 | 8.453 | **1,8%** |
| **ADMIN** | 10 | 9.085 | 90.850 | **19,0%** |
| **MANAGER** | 18 | 3.907 | 70.326 | **14,7%** |
| **SUPERVISOR** | 3 | 15.694 | 47.082 | **9,9%** |
| **SPECIALIST** | 6 | 3.500 | 21.000 | **4,4%** |
| **OPERATOR** | ~15 ativos | 10.622 | 159.330 | **33,4%** |
| **Dashboard TV** | 1 TV | 72.624 | 72.624 | **15,2%** |
| | | | | |
| **TOTAL GERAL** | | | **~469.665**⁴ | **100%** |

> ⁴ Ligeiramente acima dos ~390.000 documentados (OTIMIZACAO-LEITURAS) por usar contagem de ~15 operadores ativos + Dashboard TV 24h. Variação normal ±20%.

---

#### 8.8.5 Projeção de Custo Mensal (22 dias operacionais)

| Item | Leit./Mês | Custo (Blaze) |
|------|:---------:|:-------------:|
| Leituras totais | 10.332.630 | — |
| Free tier (-1.500.000) | 8.832.630 cobráveis | — |
| **Custo Firestore reads** | | **$5,30** |
| Writes estimados (~5% dos reads) | ~516.000 | **$0,93** |
| Deletes estimados (~1% dos reads) | ~103.000 | **$0,10** |
| **TOTAL estimado/mês** | | **~$6,33** |
| **TOTAL estimado/ano** | | **~$75,96** |

---

#### 8.8.6 Impacto da Nova Sistematização no Custo

##### A. Economia por Bloqueio de Abas via Firestore Security Rules

Com a nova sistematização + Security Rules, **operadores não poderão ler** collections que não precisam. O bloqueio é server-side (Firestore rejeita a query):

| Collection Bloqueada | Role Bloqueado | Leituras Evitadas/Dia |
|---------------------|----------------|:---------------------:|
| `system_logs` | Todos exceto SUPER_ADMIN | ~0 (já não acessam) |
| `pcp_observations` | OPERATOR, MANAGER | ~0 (já não acessam) |
| `pmp_borra`, `pmp_moido` | OPERATOR, MANAGER | ~0 (já não acessam) |
| `ferramentaria_*` | OPERATOR, MANAGER | ~0 (já não acessam) |
| `escalas_operadores` | OPERATOR | ~0 (já não acessam) |

> **Resultado**: Economia mínima por bloqueio de abas (~0), pois o filtro de tabs no frontend já impede o acesso. O ganho real das Rules é **segurança**, não economia de leituras.

##### B. Economia Real: Controle de Queries por Role no Front-end

A economia vem de **não carregar dados desnecessários** quando o usuário não tem acesso:

| Otimização | Cenário | Economia/Dia |
|-----------|---------|:------------:|
| OPERATOR não carrega `production_orders` em Planejamento | 15 operadores × 2 acessos × 150 leit. | **~4.500** |
| MANAGER não carrega Liderança/Setup/Ferramentaria | 18 managers × 0 acessos (já não tinham) | **~0** |
| SPECIALIST não carrega Dashboard TV | 6 specialists × 0 acessos | **~0** |
| Guards no front-end previnem loads desnecessários | Previne carregamento exploratório | **~2.000** |
| **Total economia/dia** | | **~6.500** |
| **Total economia/mês** | | **~143.000 leituras ($0,09)** |

##### C. Economia Potencial: Eliminação de Contas Compartilhadas

| Conta Compartilhada | Uso Estimado | Impacto se Eliminada |
|---------------------|-------------|---------------------|
| `operador.turno1/2/3` | ~10.000 leit./dia cada | Se migrar para contas pessoais: **0 mudança em leituras** (mesmas ações, diferente auth) |
| `ferramentaria.geral` | ~5.000 leit./dia | **0 mudança em leituras** (eliminar não reduz; ganho é auditoria) |
| `manutencao.geral` | ~3.000 leit./dia | **0 mudança em leituras** |

> **Conclusão**: Eliminar contas compartilhadas não reduz leituras — o ganho é 100% em **rastreabilidade e auditoria**.

---

#### 8.8.7 Comparativo ANTES × DEPOIS da Migração

```
CENÁRIO ATUAL                          CENÁRIO PÓS-MIGRAÇÃO
─────────────                          ─────────────────────
55 usuários, 4 roles                   55 usuários, 6 roles
~390-470K leituras/dia                 ~383-463K leituras/dia
ACL por nome no front-end              Custom Claims + Security Rules
Sem proteção server-side               Firestore Rules por collection
Sem auditoria de quem fez o quê        onAuthStateChanged + system_logs
Custo: ~$6,33/mês                      Custo: ~$6,24/mês + Cloud Functions ~$0/mês¹
                                       + Firebase Auth: GRÁTIS (55 users)

¹ Cloud Functions free tier: 125K invocações/mês (suficiente)
```

| Métrica | Antes | Depois | Variação |
|---------|-------|--------|:--------:|
| Leituras/dia | ~469.665 | ~463.165 | **-1,4%** |
| Custo reads/mês | $6,33 | $6,24 | **-$0,09** |
| Firebase Auth | $0 (não usa) | $0 (grátis até 50K MAU) | **$0** |
| Cloud Functions | $0 (não usa) | $0 (free tier) | **$0** |
| Segurança Firestore | ❌ Aberto | ✅ Rules por role | **Qualitativo** |
| Auditoria de acessos | ❌ Sem rastro | ✅ Auth + Logs | **Qualitativo** |
| Risco de credentials leak | 🔴 CRÍTICO | 🟢 ZERO | **Qualitativo** |

---

#### 8.8.8 Conclusão da Análise de Custo

1. **A migração NÃO é motivada por economia de custo Firestore** — O custo atual (~$6/mês) já é muito baixo e a nova sistematização reduz apenas ~1,4% nas leituras.

2. **A motivação real é**:
   - 🔒 **Segurança**: Eliminar 55 senhas em texto plano no código-fonte
   - 🛡️ **Proteção server-side**: Firestore Security Rules bloqueando acessos indevidos
   - 📊 **Auditoria**: Saber quem fez o quê (contas pessoais + Firebase Auth logs)
   - 🧩 **Manutenibilidade**: Eliminar ACLs por nome hardcoded (frágeis)
   - 📈 **Escalabilidade**: Adicionar/remover usuários sem mexer no código

3. **Custo da migração**:
   - Firebase Auth: **GRÁTIS** (55 usuários; free tier = 50.000 MAU)
   - Cloud Functions: **GRÁTIS** (estimativa <1.000 invocações/mês; free tier = 125.000)
   - Firebase Hosting: **GRÁTIS** (free tier = 10 GB storage + 360 MB/dia de bandwidth)
   - **Custo total adicional: $0/mês**

---

### 8.9 Detalhamento das Collections Firestore por Role

#### 8.9.1 Collections do Sistema (19 principais)

| # | Collection | Docs Estimados | Tamanho | Frequência de Leitura |
|---|-----------|:--------------:|---------|:---------------------:|
| 1 | `production_entries` | ~500-2.000/dia | Grande | 🔴 Altíssima |
| 2 | `production_orders` | ~100-500 total | Médio | 🔴 Alta |
| 3 | `planning` | ~26/dia (1 por máquina) | Médio | 🔴 Alta |
| 4 | `downtime_entries` | ~50-200/dia | Médio | 🟡 Média |
| 5 | `active_downtimes` | ~26 (1 por máquina) | Pequeno | 🔴 Altíssima (polling) |
| 6 | `products` | ~200 (catálogo) | Pequeno | 🟢 Baixa |
| 7 | `pcp_messages` | ~10-50/dia | Pequeno | 🟡 Média (onSnapshot) |
| 8 | `pcp_observations` | ~10-30/dia | Pequeno | 🟢 Baixa |
| 9 | `pmp_borra` | ~20 total | Pequeno | 🟢 Baixa |
| 10 | `pmp_moido` | ~20 total | Pequeno | 🟢 Baixa |
| 11 | `ferramentaria_moldes` | ~50 total | Pequeno | 🟢 Baixa |
| 12 | `ferramentaria_manutencoes` | ~20 total | Pequeno | 🟢 Baixa |
| 13 | `escalas_operadores` | ~50 total | Pequeno | 🟢 Baixa |
| 14 | `machine_schedule` | ~26 (1 por máquina) | Pequeno | 🟢 Baixa |
| 15 | `system_logs` | ~100-500/dia | Médio | 🟢 Baixa |
| 16 | `oee_history` | ~26/hora | Médio | 🟢 Baixa |
| 17 | `hourly_production_entries` | ~26/hora | Médio | 🟡 Média |
| 18 | `acompanhamento_turno` | ~10/dia | Pequeno | 🟢 Baixa |
| 19 | `batch_traceability` | ~50-200/dia | Médio | 🟢 Baixa |

#### 8.9.2 Mapa Visual: Quem Lê o Quê

```
                  production   production   downtime   active      pcp      ferrament.
                  _entries     _orders      _entries   _downtimes  _*       _*         planning  products  system_logs  pmp_*  escalas  machine_  oee_     acomp.   batch_
                                                                                                                              _oper.   schedule  history  _turno   trace.
SUPER_ADMIN       ██████████   ██████████   ██████████ ██████████  ████████ ████████   ██████████ ████████  ██████████   ██████ ████████ ████████  ████████ ████████ ████████
ADMIN             ██████████   ██████████   ██████████ ██████████  ████████ ████████   ██████████ ████████  ░░░░░░░░░░   ██████ ████████ ████████  ████████ ████████ ████████
MANAGER           ██████████   ██████████   ██████████ ██████████  ░░░░░░░░ ░░░░░░░░   ██████████ ████████  ░░░░░░░░░░   ░░░░░░ ░░░░░░░░ ░░░░░░░░  ████████ ████████ ░░░░░░░░
SUPERVISOR        ██████████   ██████████   ██████████ ██████████  ░░░░░░░░ ████████   ██████████ ████████  ░░░░░░░░░░   ░░░░░░ ████████ ████████  ████████ ░░░░░░░░ ░░░░░░░░
SPECIALIST (PCP)  ██████████   ░░░░░░░░░░   ██████████ ██████████  ████████ ░░░░░░░░   ██████████ ░░░░░░░░  ░░░░░░░░░░   ░░░░░░ ░░░░░░░░ ████████  ░░░░░░░░ ░░░░░░░░ ░░░░░░░░
SPECIALIST (PMP)  ░░░░░░░░░░   ░░░░░░░░░░   ░░░░░░░░░░ ░░░░░░░░░░  ░░░░░░░░ ░░░░░░░░   ░░░░░░░░░░ ░░░░░░░░  ░░░░░░░░░░   ██████ ░░░░░░░░ ░░░░░░░░  ░░░░░░░░ ░░░░░░░░ ░░░░░░░░
OPERATOR          ██████████   ░░░░░░░░░░   ██████████ ██████████  ░░░░░░░░ ░░░░░░░░   ██████████ ████████  ░░░░░░░░░░   ░░░░░░ ░░░░░░░░ ░░░░░░░░  ████████ ░░░░░░░░ ░░░░░░░░

Legenda: ██ = Acesso permitido (Read)  ░░ = Sem acesso (Security Rule bloqueia)
```

#### 8.9.3 Economia por Bloqueio de Collection (Security Rules)

| Collection Bloqueada | Roles Sem Acesso | Economia Mensal Est. |
|---------------------|------------------|:--------------------:|
| `system_logs` | ADMIN, MANAGER, SUPERVISOR, SPECIALIST, OPERATOR | ~$0,00 (já não leem) |
| `pmp_*` | OPERATOR, MANAGER, SUPERVISOR | ~$0,00 (já não leem) |
| `pcp_observations` | OPERATOR, MANAGER | ~$0,00 (já não leem) |
| `ferramentaria_*` | OPERATOR, MANAGER | ~$0,00 (já não leem) |
| `production_orders` | OPERATOR, SPECIALIST PCP/PMP | **-$0,03** (evita loads exploratórios) |
| | | **Total: negligível** |

> A economia de leituras Firestore com a nova sistematização é **negligível** (~1,4%) porque o controle de abas no front-end já impede o acesso. O ganho das Security Rules é **segurança** (proteção server-side), não economia.

---

## 9. Observações Importantes

1. **Senhas em texto plano** — As senhas estão hardcoded no `login.html` (sem hash ou Firebase Auth). Considerar migração futura para Firebase Authentication.

2. **ACL por nome** — Várias abas usam lista de nomes (`allowedUsers.includes(name)`) ao invés de roles. Isso é frágil — qualquer alteração no nome do usuário pode quebrar o acesso.

3. **Usuário "Leandro Camargo"** — Tem tratamento especial hardcoded em `auth.js` como `isAuthorizedAdmin` (acesso total ao sistema independente do role).

4. **Contas compartilhadas** — `operador.turno1/2/3`, `ferramentaria.geral`, `manutencao.geral`, `compras` e `time.qualidade` são contas compartilhadas por equipes.

5. **Duplicidade de controle** — A aba PMP é controlada tanto em `auth.js` quanto em `script.js`, com listas ligeiramente diferentes (auth.js: Leandro + Manaus; script.js: Leandro + Manaus + Daniel Rocha).

---

*Documento de referência interna — atualizar a cada adição/remoção de usuários.*
*Fevereiro 2026 — Hokkaido Plastics*
