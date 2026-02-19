# HokkaidoMES — Política de Versionamento e Gestão de Mudanças

> **Versão:** 1.0 • **Data:** Fevereiro 2026  
> **Classificação:** INTERNO — Equipe de Desenvolvimento  
> **Responsável:** Leandro de Camargo

---

## 1. Objetivo

Estabelecer processos formais para **controle de versão**, **gestão de mudanças** e **registro de alterações** do sistema HokkaidoMES, garantindo rastreabilidade, previsibilidade e segurança em toda atualização.

---

## 2. Versionamento Semântico (SemVer)

### 2.1 Formato

```
MAJOR.MINOR.PATCH
  │     │     │
  │     │     └── Correções de bugs (sem quebra de funcionalidade)
  │     └──────── Novas funcionalidades (retrocompatíveis)
  └────────────── Mudanças que quebram compatibilidade
```

### 2.2 Exemplos

| Tipo de Mudança | Versão Anterior | Nova Versão |
|-----------------|:---------:|:---------:|
| Bug fix em cálculo de OEE | 1.3.2 | 1.3.**3** |
| Nova aba PMP adicionada | 1.3.2 | 1.**4**.0 |
| Migração de auth client-side para Firebase Auth | 1.4.0 | **2**.0.0 |
| Remoção de `window.*` globals | 1.4.0 | **2**.0.0 |

### 2.3 Versão Atual

| Componente | Versão | Data |
|-----------|:------:|------|
| **Sistema completo** | 1.0.0 (release inicial documentada) | 2026-02-19 |
| Feature Flags | Fase 5B (todos flags = true) | 2026-02 |
| script.js | ~19.047 linhas (pós-limpeza) | 2026-02 |
| Módulos ES6 | 17 controllers + 8 services | 2026-02 |

---

## 3. Processo de Gestão de Mudanças

### 3.1 Fluxo de Mudança

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  1. REQUEST  │────▶│  2. ANALYZE  │────▶│  3. APPROVE  │
│  (Solicitação)│     │  (Análise)   │     │  (Aprovação) │
└──────────────┘     └──────────────┘     └──────┬───────┘
                                                  │
┌──────────────┐     ┌──────────────┐     ┌──────▼───────┐
│  6. CLOSE    │◀────│  5. DEPLOY   │◀────│  4. DEVELOP  │
│  (Encerrar)  │     │  (Publicar)  │     │  (Desenvolver)│
└──────────────┘     └──────────────┘     └──────────────┘
```

### 3.2 Classificação de Mudanças

| Tipo | Descrição | Aprovação | Prazo |
|------|-----------|-----------|-------|
| **Emergencial** | Bug crítico em produção (sistema parado) | Pós-ação | Imediato |
| **Urgente** | Bug que afeta operação, mas com workaround | Verbal | 24-48h |
| **Normal** | Nova funcionalidade ou melhoria | Escrita | 1-2 semanas |
| **Planejada** | Refatoração, migração, debt reduction | Conselho | Sprint |

### 3.3 Template de Solicitação de Mudança

```markdown
# Solicitação de Mudança - RFC-YYYY-NNN

**Solicitante:** [Nome]
**Data:** [DD/MM/AAAA]
**Tipo:** [Emergencial | Urgente | Normal | Planejada]
**Prioridade:** [P1 | P2 | P3 | P4]

## Descrição
[O que precisa mudar e por quê]

## Impacto
[Quais módulos/coleções/abas são afetados]

## Risco
[O que pode dar errado | Plano de rollback]

## Aprovação
- [ ] Aprovado por: _______________
- [ ] Data: ___/___/______
```

---

## 4. Checklist de Deploy

### 4.1 Pré-Deploy

- [ ] Código revisado (code review)
- [ ] Testado em ambiente de desenvolvimento
- [ ] Testado em todos os perfis (operador, gestor, líder, suporte)
- [ ] Feature flags verificados
- [ ] Sem `console.log` de debug
- [ ] Sem senhas ou API keys expostas no código novo
- [ ] Backup do Firestore realizado
- [ ] Firestore Rules atualizadas (se necessário)
- [ ] Índices Firestore criados (se necessário)
- [ ] Changelog atualizado
- [ ] Versão incrementada

### 4.2 Deploy

```bash
# 1. Verificar build (sem bundler, apenas lint)
# 2. Deploy
firebase deploy --only hosting

# 3. Verificar deploy
firebase hosting:channel:list
```

### 4.3 Pós-Deploy

- [ ] Acessar sistema e testar login
- [ ] Verificar console por erros
- [ ] Testar funcionalidade alterada
- [ ] Testar Dashboard TV
- [ ] Monitorar Firebase Console (leituras/escritas)
- [ ] Comunicar equipe sobre a atualização
- [ ] Monitorar por 24h para regressões

### 4.4 Rollback

```bash
# Se problemas detectados:
# 1. Listar deploys anteriores
firebase hosting:channel:list

# 2. Restaurar versão anterior
firebase hosting:clone hokkaido-synchro:PREVIOUS hokkaido-synchro:live

# 3. Registrar incidente
# 4. Investigar e corrigir
```

---

## 5. Gestão de Branches (Quando Git For Implementado)

### 5.1 Modelo Recomendado

```
main (produção)
  │
  ├── develop (integração)
  │     │
  │     ├── feature/nova-aba-pmp
  │     ├── feature/firebase-auth
  │     ├── fix/oee-calculation
  │     └── refactor/remove-window-globals
  │
  └── hotfix/critical-downtime-bug
```

### 5.2 Convenção de Commits

```
tipo(escopo): descrição curta

Tipos:
  feat:     Nova funcionalidade
  fix:      Correção de bug
  refactor: Refatoração sem mudança funcional
  docs:     Documentação
  style:    Formatação, espaçamento
  perf:     Melhoria de performance
  test:     Adição/correção de testes
  chore:    Manutenção, tooling

Exemplos:
  feat(pmp): adicionar aba de sucata
  fix(oee): corrigir cálculo de disponibilidade no T3
  refactor(planning): extrair para planning.controller.js
  docs: atualizar dicionário de dados
```

---

## 6. Changelog

### Versão 1.0.0 — Fevereiro 2026 (Release Inicial Documentada)

#### Arquitetura
- Migração de monolito (script.js ~51.400 linhas) para arquitetura modular ES6
- Implementação de EventBus (pub/sub central)
- Implementação de StateManager (cache centralizado com TTL)
- Implementação de BaseService (CRUD genérico com cache)
- Criação de bridge legado ↔ modular

#### Controllers Extraídos (17)
- `admin.controller.js` — Administração de dados (6 sub-abas)
- `analysis.controller.js` — Análise OEE, gráficos, Pareto (9.419 linhas)
- `dashboard.controller.js` — Dashboard com KPIs
- `downtime-grid.controller.js` — Grid de parada standalone
- `extended-downtime.controller.js` — Paradas prolongadas
- `historico.controller.js` — Logs do sistema
- `launch.controller.js` — Lançamento e cards de máquina
- `leadership.controller.js` — Escalas e absenteísmo
- `monitoring.controller.js` — Acompanhamento turno (3 módulos)
- `orders.controller.js` — Ordens de produção
- `pcp.controller.js` — PCP dashboard
- `planning.controller.js` — Planejamento diário
- `pmp.controller.js` — PMP (moído/borra/sucata)
- `reports.controller.js` — Relatórios com CSV export
- `resumo.controller.js` — Resumo e OEE engine
- `setup.controller.js` — Setup de máquinas
- `tooling.controller.js` — Ferramentaria

#### Services Implementados (8)
- `base.service.js` — CRUD abstrato com cache
- `firebase-client.js` — Wrapper Firestore
- `firebase-cache.service.js` — Cache de leitura
- `production.service.js`
- `planning.service.js`
- `downtime.service.js` (3 coleções)
- `downtime-shift.service.js`
- `orders.service.js`
- `logs.service.js`

#### Utilities (8)
- `auth.utils.js`, `color.utils.js`, `date.utils.js`, `dom.utils.js`
- `number.utils.js`, `plan.utils.js`, `product.utils.js`, `logger.js`

#### Redução de Código
- Fase 4: Remoção de código morto
- Fase 5A: Remoção de bridge safe code (~4.200 linhas)
- Fase 5B: Remoção de código de qualidade (~3.636 linhas)
- **Total removido:** ~32.000+ linhas (51.400 → 19.047)

#### Feature Flags
- 20 controller flags — todos habilitados (true)
- 3 debug flags — todos desabilitados (false)
- Sistema 100% modular

#### Segurança
- RBAC com 4 perfis (operador, gestor, líder, suporte)
- 13 abas com controle de acesso
- Auditoria via system_logs
- Controle nominal para funcionalidades sensíveis

#### Documentação
- Criação do pacote completo de documentação (8 documentos)

---

## 7. Registro de Mudanças Futuras

### Template para Novas Entradas

```markdown
### Versão X.Y.Z — [Mês YYYY]

#### Adicionado
- [Novas funcionalidades]

#### Alterado
- [Mudanças em funcionalidades existentes]

#### Corrigido
- [Bugs corrigidos]

#### Removido
- [Funcionalidades removidas]

#### Segurança
- [Mudanças de segurança]

#### Débito Técnico
- [Refatorações realizadas]
```

---

## 8. Política de Manutenção

### 8.1 Manutenção Preventiva

| Atividade | Frequência | Responsável |
|-----------|-----------|-------------|
| Atualizar dependências CDN | Trimestral | Dev |
| Verificar Firebase SDK deprecated | Trimestral | Dev |
| Revisar Feature Flags | A cada sprint | Dev |
| Revisar Firestore indexes performance | Mensal | Dev |
| Limpar system_logs antigos (>1 ano) | Anual | Admin |
| Atualizar database.js (produtos) | Sob demanda | PCP |
| Revisar usuários ativos | Mensal | Gestor |
| Atualizar documentação | A cada release | Dev |

### 8.2 Janela de Manutenção

| Dia | Horário | Tipo |
|-----|---------|------|
| Sábado | 03:00 - 06:00 | Manutenção programada |
| Qualquer dia | 02:00 - 04:00 | Manutenção emergencial |

**Comunicação:** Informar líderes de turno com **24h de antecedência** (manutenção programada).

---

## 9. Controle de Ambientes

### 9.1 Ambientes Atuais

| Ambiente | URL | Uso |
|----------|-----|-----|
| **Produção** | `hokkaido-synchro.web.app` | Operação real |
| **Desenvolvimento** | Local (`localhost`) | Desenvolvimento |

### 9.2 Ambientes Recomendados

| Ambiente | Propósito | Firebase Project |
|----------|-----------|------------------|
| **Produção** | Operação fabril | `hokkaido-synchro` |
| **Staging** | Testes pré-deploy | `hokkaido-synchro-staging` (criar) |
| **Desenvolvimento** | Dev local | Firebase Emulator Suite |

### 9.3 Firebase Emulator (Desenvolvimento Local)

```bash
# Instalar Firebase CLI
npm install -g firebase-tools

# Iniciar emulators
firebase emulators:start --only firestore,hosting

# Acesso local
# Firestore: localhost:8080
# Hosting: localhost:5000
```

---

## Histórico de Revisões

| Versão | Data | Autor | Alteração |
|--------|------|-------|-----------|
| 1.0 | 2026-02-19 | Leandro de Camargo | Criação inicial |
