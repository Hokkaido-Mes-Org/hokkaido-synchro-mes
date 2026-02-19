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

## 8. Observações Importantes

1. **Senhas em texto plano** — As senhas estão hardcoded no `login.html` (sem hash ou Firebase Auth). Considerar migração futura para Firebase Authentication.

2. **ACL por nome** — Várias abas usam lista de nomes (`allowedUsers.includes(name)`) ao invés de roles. Isso é frágil — qualquer alteração no nome do usuário pode quebrar o acesso.

3. **Usuário "Leandro Camargo"** — Tem tratamento especial hardcoded em `auth.js` como `isAuthorizedAdmin` (acesso total ao sistema independente do role).

4. **Contas compartilhadas** — `operador.turno1/2/3`, `ferramentaria.geral`, `manutencao.geral`, `compras` e `time.qualidade` são contas compartilhadas por equipes.

5. **Duplicidade de controle** — A aba PMP é controlada tanto em `auth.js` quanto em `script.js`, com listas ligeiramente diferentes (auth.js: Leandro + Manaus; script.js: Leandro + Manaus + Daniel Rocha).

---

*Documento de referência interna — atualizar a cada adição/remoção de usuários.*
*Fevereiro 2026 — Hokkaido Plastics*
