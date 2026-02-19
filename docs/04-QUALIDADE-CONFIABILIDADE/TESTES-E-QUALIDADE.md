# HokkaidoMES — Estratégia de Testes e Garantia de Qualidade

> **Versão:** 1.0 • **Data:** Fevereiro 2026  
> **Classificação:** INTERNO — Equipe de Desenvolvimento  
> **Responsável:** Leandro de Camargo

---

## 1. Objetivo

Definir a estratégia de **testes, validação e garantia de qualidade** do sistema HokkaidoMES, abrangendo testes manuais, automatizados e critérios de aceitação para mudanças.

---

## 2. Estado Atual dos Testes

| Tipo de Teste | Status | Cobertura |
|--------------|:------:|:---------:|
| Testes unitários | ❌ Nenhum | 0% |
| Testes de integração | ❌ Nenhum | 0% |
| Testes E2E | ❌ Nenhum | 0% |
| Testes manuais | ✅ Ad-hoc | Variável |
| Lint/Static analysis | ❌ Nenhum | 0% |
| Code review | ⚠️ Informal | Variável |

> **Prioridade:** Implementar testes automatizados é uma ação planejada para Fase 9 do roadmap.

---

## 3. Estratégia de Testes (Pirâmide)

```
          ┌───────────┐
          │  E2E (UI) │  ← Menos testes, mais lentos
          │  Cypress   │
          ├───────────┤
          │ Integração │  ← Testes de serviço + Firebase
          │ Jest+Emul. │
          ├───────────┤
          │  Unitários │  ← Mais testes, mais rápidos
          │   Vitest   │
          └───────────┘
```

---

## 4. Testes Unitários (Planejados)

### 4.1 Framework Recomendado

| Ferramenta | Propósito |
|-----------|-----------|
| **Vitest** | Test runner (compatível com ES6 modules) |
| **@testing-library/dom** | Testes de DOM |
| **c8** | Coverage report |

### 4.2 O Que Testar (Prioridade)

#### P1 — Funções Críticas de Cálculo

| Módulo | Função | Prioridade |
|--------|--------|:---------:|
| `resumo.controller.js` | `calculateShiftOEE()` | **P1** |
| `resumo.controller.js` | `calculateRealTimeOEE()` | **P1** |
| `date.utils.js` | `getProductionDateString()` | **P1** |
| `date.utils.js` | `formatDate()` | **P1** |
| `number.utils.js` | `coerceToNumber()` | **P1** |
| `number.utils.js` | `formatWeight()` | **P1** |
| `plan.utils.js` | `getPlanQuantity()` | **P1** |
| `product.utils.js` | `getProductInfo()` | **P1** |
| `color.utils.js` | `resolveProgressPalette()` | **P2** |

#### P2 — Lógica de Negócio dos Services

| Módulo | Área | Prioridade |
|--------|------|:---------:|
| `downtime.service.js` | `aggregateByReason()` | **P1** |
| `downtime.service.js` | `aggregateByCategory()` | **P1** |
| `planning.service.js` | `getForDate()` / `getByMachine()` | **P2** |
| `base.service.js` | Cache hit/miss logic | **P2** |
| `event-bus.js` | `on()` / `emit()` / `off()` | **P2** |
| `state-manager.js` | `set()` / `get()` / `isFresh()` | **P2** |

### 4.3 Exemplo de Teste Unitário

```javascript
// tests/utils/date.utils.test.js
import { describe, it, expect } from 'vitest';
import { getProductionDateString, formatDate } from '../../src/utils/date.utils.js';

describe('getProductionDateString', () => {
    it('deve retornar data atual para horário diurno (T1/T2)', () => {
        const date = new Date('2026-02-19T10:00:00');
        expect(getProductionDateString(date)).toBe('2026-02-19');
    });

    it('deve retornar data anterior para horário noturno (T3, após meia-noite)', () => {
        const date = new Date('2026-02-19T02:00:00');
        expect(getProductionDateString(date)).toBe('2026-02-18');
    });

    it('deve tratar limite de turno 06:30 corretamente', () => {
        const date = new Date('2026-02-19T06:29:00');
        expect(getProductionDateString(date)).toBe('2026-02-18');
    });

    it('deve retornar nova data após 06:30', () => {
        const date = new Date('2026-02-19T06:31:00');
        expect(getProductionDateString(date)).toBe('2026-02-19');
    });
});

describe('formatDate', () => {
    it('deve formatar data ISO para DD/MM/AAAA', () => {
        expect(formatDate('2026-02-19')).toBe('19/02/2026');
    });
});
```

```javascript
// tests/core/event-bus.test.js
import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../../src/core/event-bus.js';

describe('EventBus', () => {
    it('deve emitir e receber eventos', () => {
        const callback = vi.fn();
        EventBus.on('test:event', callback);
        EventBus.emit('test:event', { data: 123 });
        expect(callback).toHaveBeenCalledWith({ data: 123 });
    });

    it('deve permitir unsubscribe', () => {
        const callback = vi.fn();
        const unsub = EventBus.on('test:unsub', callback);
        unsub();
        EventBus.emit('test:unsub', {});
        expect(callback).not.toHaveBeenCalled();
    });
});
```

```javascript
// tests/services/downtime.service.test.js
import { describe, it, expect } from 'vitest';

describe('DowntimeService.aggregateByReason', () => {
    const entries = [
        { motivo: 'Troca de molde', duration_minutes: 30 },
        { motivo: 'Troca de molde', duration_minutes: 45 },
        { motivo: 'Falta de MP', duration_minutes: 60 },
        { motivo: 'Manutenção', duration_minutes: 20 },
    ];

    it('deve agrupar por motivo e somar minutos', () => {
        // Simular aggregateByReason inline
        const grouped = {};
        for (const e of entries) {
            const r = e.motivo;
            if (!grouped[r]) grouped[r] = { reason: r, count: 0, totalMinutes: 0 };
            grouped[r].count++;
            grouped[r].totalMinutes += e.duration_minutes;
        }
        const result = Object.values(grouped).sort((a, b) => b.totalMinutes - a.totalMinutes);

        expect(result).toHaveLength(3);
        expect(result[0].reason).toBe('Troca de molde');
        expect(result[0].totalMinutes).toBe(75);
        expect(result[0].count).toBe(2);
        expect(result[1].reason).toBe('Falta de MP');
        expect(result[1].totalMinutes).toBe(60);
    });
});
```

### 4.4 Configuração do Projeto

```javascript
// vitest.config.js (a criar)
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'jsdom',
        globals: true,
        include: ['tests/**/*.test.js'],
        coverage: {
            provider: 'c8',
            include: ['src/**/*.js'],
            exclude: ['src/legacy/**', 'src/controllers/**'],
            thresholds: {
                branches: 50,
                functions: 50,
                lines: 50,
            }
        }
    }
});
```

```json
// package.json (a criar ou atualizar)
{
    "scripts": {
        "test": "vitest run",
        "test:watch": "vitest",
        "test:coverage": "vitest run --coverage"
    },
    "devDependencies": {
        "vitest": "^1.0.0",
        "@vitest/coverage-c8": "^1.0.0"
    }
}
```

---

## 5. Testes de Integração (Planejados)

### 5.1 Firebase Emulator

```bash
# Iniciar emulators Firestore
firebase emulators:start --only firestore

# Em outro terminal: rodar testes de integração
npm run test:integration
```

### 5.2 O Que Testar

| Teste | Descrição |
|-------|-----------|
| CRUD PlanningService | Criar/ler/atualizar/deletar planejamento no emulator |
| CRUD DowntimeService | Ciclo completo de parada (ativar → finalizar) |
| CRUD OrdersService | Fluxo de status de ordens |
| Cache invalidation | Verificar que cache é invalidado appos mutação |
| Bridge sync | Verificar que DataStore ↔ StateManager sincronizam |
| Concurrent listeners | Verificar que múltiplos listeners não conflitam |

### 5.3 Exemplo de Teste de Integração

```javascript
// tests/integration/planning.integration.test.js
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

describe('PlanningService (integration)', () => {
    // Requer Firebase Emulator rodando

    it('deve criar e buscar planejamento', async () => {
        // 1. Criar planejamento
        const data = {
            date: '2026-02-19',
            machineId: 'H01',
            product: 'Rosca 28mm',
            quantity: 15000
        };
        
        // 2. Buscar por data
        // 3. Verificar que retorna o criado
        // 4. Deletar (cleanup)
    });
});
```

---

## 6. Testes E2E (Planejados)

### 6.1 Framework Recomendado

| Ferramenta | Propósito |
|-----------|-----------|
| **Cypress** | Testes end-to-end no browser |
| **Playwright** | Alternativa (multi-browser) |

### 6.2 Cenários Críticos para E2E

| # | Cenário | Prioridade |
|---|---------|:---------:|
| 1 | Login com credenciais válidas → redirect para index | **P1** |
| 2 | Login com credenciais inválidas → mensagem de erro | **P1** |
| 3 | Operador vê apenas abas permitidas | **P1** |
| 4 | Lançar produção com sucesso | **P1** |
| 5 | Registrar parada e finalizar | **P1** |
| 6 | Criar planejamento e verificar na lista | **P2** |
| 7 | Criar ordem e ativá-la em máquina | **P2** |
| 8 | Gerar relatório e exportar CSV | **P2** |
| 9 | Dashboard TV carrega e exibe dados | **P2** |
| 10 | Admin exclui parada e verifica log | **P3** |

### 6.3 Exemplo de Teste E2E

```javascript
// cypress/e2e/login.cy.js
describe('Login', () => {
    it('deve fazer login como operador', () => {
        cy.visit('/login.html');
        cy.get('#username').type('operador');
        cy.get('#password').type('Operador2025!');
        cy.get('button[type="submit"]').click();
        cy.url().should('include', 'index.html');
        cy.get('[data-page="lancamento"]').should('be.visible');
    });

    it('deve rejeitar senha incorreta', () => {
        cy.visit('/login.html');
        cy.get('#username').type('operador');
        cy.get('#password').type('senhaerrada');
        cy.get('button[type="submit"]').click();
        cy.get('.error-message').should('be.visible');
    });

    it('operador não deve ver aba admin', () => {
        cy.login('operador', 'Operador2025!');
        cy.get('[data-page="admin-dados"]').should('not.be.visible');
    });
});
```

---

## 7. Testes Manuais — Checklist

### 7.1 Checklist de Regressão (Pré-Deploy)

**A executar antes de cada deploy:**

#### Login e Sessão
- [ ] Login com cada perfil (operador, gestor, líder, suporte)
- [ ] "Lembrar-me" funciona
- [ ] Logout limpa sessão
- [ ] Sessão expira após tempo correto
- [ ] Redirect para login se não autenticado

#### Lançamento
- [ ] Seleção de máquina funciona
- [ ] Cards de máquina exibem status correto
- [ ] Lançamento de produção salva no Firestore
- [ ] Registro de parada salva corretamente
- [ ] Parada prolongada funciona
- [ ] Timer de parada ativo funciona
- [ ] Finalização de parada gera entry em downtime_entries

#### Planejamento
- [ ] Criar planejamento
- [ ] Editar planejamento
- [ ] Excluir planejamento
- [ ] Filtrar por data e máquina

#### Ordens
- [ ] Criar ordem de produção
- [ ] Ativar ordem em máquina
- [ ] Suspender e retomar ordem
- [ ] Concluir ordem

#### Análise
- [ ] OEE Gauge renderiza
- [ ] Gráficos de produção renderizam
- [ ] Filtro de período funciona
- [ ] Exportação funciona

#### Relatórios
- [ ] Gerar relatório de produção
- [ ] Gerar relatório de paradas
- [ ] Exportar CSV

#### Dashboard TV
- [ ] Página carrega sem erros
- [ ] Dados são exibidos
- [ ] Auto-refresh funciona (5 min)

#### Admin (se alterado)
- [ ] Buscar parada
- [ ] Editar parada
- [ ] Excluir parada e verificar log

### 7.2 Teste de Turno (Específico)

| Cenário | Validar |
|---------|---------|
| T1 (06:30-15:00) | Data de produção = hoje |
| T2 (15:00-23:30) | Data de produção = hoje |
| T3 (23:30-06:30) | Data de produção = ontem (se após meia-noite) |
| Limite 06:30 | Verificar transição T3→T1 |

### 7.3 Teste de Performance

| Métrica | Meta | Como Verificar |
|---------|:----:|---------------|
| Tempo de carregamento inicial | < 5s | DevTools → Network |
| Rendering de cards (12 máquinas) | < 2s | Visual |
| Dashboard TV load | < 8s | DevTools |
| Resposta de lançamento | < 1s | Visual (toast notification) |
| Cache hit rate | > 60% | `showCacheDashboard()` |
| Firebase reads/sessão | < 500 | `fbstats()` |

---

## 8. Qualidade de Código

### 8.1 Lint (A Implementar)

```json
// .eslintrc.json (a criar)
{
    "env": {
        "browser": true,
        "es2021": true
    },
    "extends": "eslint:recommended",
    "parserOptions": {
        "ecmaVersion": "latest",
        "sourceType": "module"
    },
    "rules": {
        "no-unused-vars": "warn",
        "no-console": ["warn", { "allow": ["warn", "error"] }],
        "eqeqeq": "error",
        "no-eval": "error",
        "no-implied-eval": "error",
        "no-var": "error",
        "prefer-const": "warn"
    },
    "globals": {
        "firebase": "readonly",
        "Chart": "readonly"
    }
}
```

### 8.2 Métricas de Qualidade

| Métrica | Meta | Atual |
|---------|:----:|:-----:|
| Cobertura de testes (core + utils) | ≥ 80% | 0% |
| Cobertura de testes (services) | ≥ 60% | 0% |
| Cobertura de testes (controllers) | ≥ 30% | 0% |
| Lint warnings | 0 | N/A |
| Lint errors | 0 | N/A |
| TODO/FIXME/HACK no código | < 20 | N/A |
| `console.log` em produção | 0 | >100 |
| Funções com >50 linhas | < 30% | N/A |
| Complexidade ciclomática média | < 10 | N/A |

### 8.3 Code Review Checklist

Para cada mudança submetida, verificar:

- [ ] **Funcionalidade:** A mudança faz o que se propõe?
- [ ] **Regressão:** Não quebra funcionalidade existente?
- [ ] **Segurança:** Não expõe dados sensíveis?
- [ ] **Performance:** Não adiciona queries desnecessárias?
- [ ] **Cache:** Invalidação de cache correta?
- [ ] **Logs:** Ações auditáveis estão sendo logadas?
- [ ] **Permissões:** Verificação de acesso está correta?
- [ ] **Tratamento de erro:** Erros são capturados e notificados?
- [ ] **Nomes:** Variáveis e funções com nomes claros?
- [ ] **Documentação:** Mudança significativa está documentada?

---

## 9. Critérios de Aceitação

### 9.1 Para Novas Funcionalidades

| Critério | Obrigatório |
|----------|:-----------:|
| Funcionalidade conforme especificação | ✅ |
| Sem erros no console | ✅ |
| Testado em todos os perfis afetados | ✅ |
| Controle de acesso correto | ✅ |
| Ações auditáveis logadas | ✅ |
| Performance aceitável (< 2s resposta) | ✅ |
| Testes unitários para lógica de cálculo | ⚠️ Desejável |
| Documentação atualizada | ⚠️ Desejável |

### 9.2 Para Correções de Bug

| Critério | Obrigatório |
|----------|:-----------:|
| Bug reproduzido e confirmado | ✅ |
| Correção resolve o problema | ✅ |
| Sem regressão em funcionalidades relacionadas | ✅ |
| Teste de regressão adicionado | ⚠️ Desejável |

---

## 10. Plano de Implementação de Testes

### 10.1 Roadmap

| Fase | Escopo | Prazo Estimado |
|------|--------|:---------:|
| **T1** | Setup Vitest + testes para utils/ | 1 semana |
| **T2** | Testes para core/ (EventBus, StateManager) | 1 semana |
| **T3** | Testes para services/ (BaseService, mocks) | 2 semanas |
| **T4** | Setup Cypress + happy-paths E2E | 2 semanas |
| **T5** | Testes para controllers (selecionados) | 3 semanas |
| **T6** | CI/CD pipeline com testes | 1 semana |

### 10.2 Cobertura Mínima por Fase

| Fase | Cobertura Alvo |
|------|:---------:|
| Após T1 | 15% (utils) |
| Após T2 | 30% (utils + core) |
| Após T3 | 50% (utils + core + services) |
| Após T4 | 50% + 5 E2E scenarios |
| Após T5 | 60% geral |
| Após T6 | 60% + CI pipeline |

---

## 11. Ferramentas de Debug Disponíveis

### 11.1 Console do Navegador

```javascript
// Monitoramento de Firebase
window.fbstats()                    // Estatísticas de leitura/escrita
window.showCacheDashboard()         // UI de monitoramento de cache

// Estado do sistema
window.authSystem.getCurrentUser()  // Usuário logado
window.__FLAGS                      // Feature flags ativos
window.services                     // Services disponíveis
window.EventBus.getStats()          // Estatísticas do EventBus
window.stateManager.getMetrics()    // Métricas de cache

// Correção de dados
window.forceStopDowntime('H06')     // Forçar fim de parada

// Debug de modal
window.closeModal('modal-id')       // Fechar modal travado
```

### 11.2 Firebase Console

- **Firestore Data Viewer:** Visualizar/editar documentos diretamente
- **Usage & Billing:** Monitorar leituras/escritas
- **Authenticate:** Verificar sessões (quando migrado)
- **Hosting:** Gerenciar deploys e rollbacks

---

## Histórico de Revisões

| Versão | Data | Autor | Alteração |
|--------|------|-------|-----------|
| 1.0 | 2026-02-19 | Leandro de Camargo | Criação inicial |
