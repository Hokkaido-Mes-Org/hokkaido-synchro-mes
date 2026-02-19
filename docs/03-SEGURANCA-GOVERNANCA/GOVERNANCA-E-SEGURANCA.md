# HokkaidoMES — Governança, Segurança e Controle de Acesso

> **Versão:** 1.0 • **Data:** Fevereiro 2026  
> **Classificação:** CONFIDENCIAL — Uso Interno  
> **Responsável:** Leandro de Camargo

---

## 1. Objetivo

Este documento estabelece as políticas, diretrizes e controles de **governança e segurança** do sistema HokkaidoMES, garantindo:

- Proteção de dados industriais e operacionais
- Controle de acesso baseado em perfis (RBAC)
- Rastreabilidade de ações (audit trail)
- Conformidade com boas práticas de TI industrial
- Base para auditorias internas e externas

---

## 2. Classificação de Dados

### 2.1 Níveis de Sensibilidade

| Nível | Classificação | Exemplos | Controle |
|-------|--------------|----------|----------|
| **C1** | Público | Dashboard TV (leitura), alertas de parada | Sem restrição |
| **C2** | Interno | Dados de produção, planejamento, OEE | Autenticação obrigatória |
| **C3** | Restrito | Relatórios gerenciais, análises de perdas | Perfil gestor+ |
| **C4** | Confidencial | Credenciais, logs de auditoria, dados admin | Perfil suporte apenas |

### 2.2 Dados Armazenados

| Tipo de Dado | Localização | Sensibilidade | Retenção |
|--------------|-------------|---------------|----------|
| Credenciais de usuário | `login.html` (client-side) | **C4** | Permanente |
| Sessão de login | `localStorage` / `sessionStorage` | **C3** | 24h / 8h |
| Dados de produção | Firestore `production_entries` | **C2** | Indefinida |
| Registros de parada | Firestore `downtime_entries` | **C2** | Indefinida |
| Planejamento | Firestore `planning` | **C2** | Indefinida |
| Ordens de produção | Firestore `production_orders` | **C2** | Indefinida |
| Logs de auditoria | Firestore `system_logs` | **C4** | Indefinida |
| Dados de ferramentaria | Firestore `moldes` | **C2** | Indefinida |
| Configurações de máquina | `database.js` (hardcoded) | **C2** | Código-fonte |

---

## 3. Autenticação

### 3.1 Mecanismo Atual

| Aspecto | Implementação Atual |
|---------|---------------------|
| **Tipo** | Credenciais client-side (hardcoded em `login.html`) |
| **Armazenamento de sessão** | `localStorage` (24h) ou `sessionStorage` (8h) |
| **Chave de sessão** | `synchro_user` |
| **Dados da sessão** | `{ username, name, role, permissions, loginTime }` |
| **Expiração** | Verificação por timestamp (`loginTime`) |
| **"Remember Me"** | Toggle entre `localStorage` e `sessionStorage` |
| **Logout** | Limpeza de `localStorage` + `sessionStorage` + redirect |

### 3.2 Fluxo de Autenticação

```
┌──────────────┐     ┌─────────────┐     ┌──────────────────┐
│  login.html  │────▶│  Validação  │────▶│  Redireciona     │
│  (form)      │     │  Client-Side│     │  para index.html │
└──────────────┘     └──────┬──────┘     └──────────────────┘
                            │
                     ┌──────▼──────┐
                     │ localStorage │
                     │  ou session  │
                     │  Storage     │
                     └─────────────┘
```

### 3.3 Resolução de Usuário

O sistema usa busca flexível (`findUserKeyFlexible`) com 5 métodos:

1. Match direto por chave (case-insensitive)
2. Substituição de espaço por ponto
3. Remoção de todos os pontos
4. Match por nome completo
5. Match parcial por tokens do nome

### 3.4 Riscos Identificados e Mitigações

| Risco | Severidade | Status | Mitigação Recomendada |
|-------|-----------|--------|----------------------|
| Senhas em texto plano no HTML | **CRÍTICO** | ⚠️ Aberto | Migrar para Firebase Auth |
| Sem HTTPS obrigatório | **ALTO** | ⚠️ Aberto | Forçar HTTPS no hosting |
| Sem hashing de senha | **CRÍTICO** | ⚠️ Aberto | bcrypt/scrypt no backend |
| Session hijacking via localStorage | **MÉDIO** | ⚠️ Aberto | Tokens JWT com refresh |
| Sem rate limiting no login | **MÉDIO** | ⚠️ Aberto | Implementar throttling |
| Sem MFA | **BAIXO** | ⚠️ Aberto | Firebase Auth + TOTP |

> **NOTA IMPORTANTE:** O sistema atual opera em ambiente de **rede local industrial (intranet)**. Os riscos acima são priorizados considerando esse contexto. A migração para Firebase Authentication é recomendada antes de qualquer exposição à internet.

---

## 4. Autorização — Controle de Acesso (RBAC)

### 4.1 Perfis de Usuário

| Perfil | Código | Descrição | Qtd Usuários |
|--------|--------|-----------|-------------|
| **Operador** | `operador` | Lançamento de dados de produção, perdas e paradas | ~25+ |
| **Gestor** | `gestor` | Planejamento, relatórios, Dashboard TV | ~5 |
| **Líder** | `lider` | Gestão de turno, escalas, setup | ~5 |
| **Suporte** | `suporte` | Acesso administrativo completo | ~5 |

### 4.2 Matriz de Permissões por Aba

| Aba / Funcionalidade | Operador | Gestor | Líder | Suporte |
|----------------------|:--------:|:------:|:-----:|:-------:|
| Lançamento | ✅ | ✅ | ✅ | ✅ |
| Planejamento | ❌ | ✅ | ❌ | ✅ |
| Ordens de Produção | ❌ | ✅ | ❌ | ✅ |
| Análise | ✅ | ✅ | ✅ | ✅ |
| PMP (Borra/Sucata) | ❌ | ❌* | ❌ | ✅ |
| Acompanhamento Turno | ❌ | ❌* | ❌ | ✅ |
| Histórico do Sistema | ❌ | ❌ | ❌ | ✅* |
| Relatórios | ❌ | ✅ | ✅ | ✅ |
| Admin Dados | ❌ | ❌ | ❌ | ✅* |
| Liderança Produção | ❌ | ❌ | ✅ | ✅ |
| Setup de Máquinas | ❌ | ❌ | ✅ | ✅ |
| Ferramentaria | ❌ | ❌ | ✅ | ✅ |
| PCP | ❌ | ❌* | ❌ | ✅ |
| Dashboard TV | ❌ | ✅ | ✅ | ✅ |

> *Acesso restrito a usuários nomeados individualmente (ver seção 4.3)

### 4.3 Controle de Acesso Nominal (por Nome)

Além dos perfis de role, certas funcionalidades são restritas a **usuários específicos**:

| Funcionalidade | Usuários Autorizados |
|----------------|---------------------|
| Qualidade / Processo | Leandro Camargo, role=suporte |
| PMP | Leandro Camargo, Manaus Silva, Daniel Rocha |
| Acompanhamento Turno | 5 usuários nomeados |
| Histórico Sistema | Leandro Camargo, Michelle, Tiago |
| Admin Dados | Leandro Camargo, Michelle, Tiago |
| PCP | 5 usuários nomeados |
| Analytics / IA | Leandro Camargo, Davi Batista, role=suporte |
| Filtro de Data (lançamento) | Leandro Camargo, Davi Batista, role=suporte |
| Botão Novo Produto | Leandro Camargo, Davi Batista, role=gestor/suporte |
| Liderança Produção | 7 usuários nomeados + role=lider |

### 4.4 Permissões por Ação

| Ação | Permissão Requerida |
|------|---------------------|
| Criar/Editar/Excluir Planejamento | `planejamento` |
| Lançar produção, perdas, paradas | `lancamento` |
| Retrabalho, ajustar executado | `lancamento` |
| Visualizar análises | `analise` |
| Exportar dados | `analise` |
| Controle de qualidade | `analise` |
| Fechar ordem de produção | `planejamento` OU `lancamento` |

### 4.5 Princípio do Menor Privilégio

O sistema respeita o princípio de **menor privilégio**:
- Operadores acessam **apenas** lançamento e análise básica
- Navegação lateral é **filtrada dinamicamente** via `filterTabsBasedOnPermissions()`
- Botões de ação são **ocultados** para perfis sem permissão via `filterManualEntriesButtons()`
- Ações protegidas verificam permissão via `checkPermissionForAction(action)` antes de executar

---

## 5. Auditoria e Rastreabilidade

### 5.1 System Logs

Todas as ações críticas são registradas na coleção `system_logs` do Firestore:

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `type` | string | Tipo de ação (ex: `delete_downtime`, `create_planning`) |
| `action` | string | Descrição detalhada da ação |
| `user` | string | Nome do usuário que realizou a ação |
| `machine` | string | ID da máquina afetada (quando aplicável) |
| `details` | object | Dados complementares (antes/depois) |
| `timestamp` | Timestamp | Data/hora da ação (server timestamp) |
| `date` | string | Data formatada `YYYY-MM-DD` |

### 5.2 Ações Auditadas

| Categoria | Ações Registradas |
|-----------|-------------------|
| **Produção** | Criar/editar/excluir entrada de produção |
| **Paradas** | Iniciar/finalizar/excluir parada, exclusão em lote |
| **Planejamento** | Criar/editar/excluir planejamento |
| **Ordens** | Criar/editar/excluir/ativar/suspender/concluir ordem |
| **Admin** | Ajustes em batch, limpeza de dados |
| **Setup** | Registros de setup/troca de molde |
| **Ferramentaria** | CRUD de moldes, registros de manutenção |
| **Qualidade** | Inspeções de processo |

### 5.3 Consulta de Logs

- **Interface:** Aba "Histórico do Sistema" (acesso restrito)
- **Filtros:** Data (hoje/ontem/período), tipo de ação, usuário, máquina
- **Paginação:** Resultados paginados
- **Acesso:** Apenas usuários autorizados (Leandro, Michelle, Tiago)

### 5.4 Funções de Log no Código

```javascript
// Registro de ação no sistema
window.logSystemAction(type, action, user, machine, details);

// Serviço modular
import { logsService } from './services/logs.service.js';
logsService.create({ type, action, user, machine, details });
```

---

## 6. Segurança de Infraestrutura

### 6.1 Firebase Security

| Componente | Status | Recomendação |
|-----------|--------|--------------|
| **Firestore Rules** | ⚠️ Verificar | Garantir regras restritivas por coleção |
| **Firebase Auth** | ❌ Não utilizado | Migrar de auth client-side para Firebase Auth |
| **App Check** | ❌ Não ativado | Ativar para proteger contra abuso de API |
| **Storage Rules** | N/A | Sem uso de storage |
| **SDK Version** | ⚠️ Compat v8/v9 | Considerar migração para SDK modular v10+ |

### 6.2 Regras Firestore Recomendadas

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Bloquear acesso não autenticado
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
    
    // Logs somente leitura (exceto criação)
    match /system_logs/{logId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update, delete: if false; // Imutável
    }
    
    // Produção: autenticados podem ler/criar
    match /production_entries/{entryId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update, delete: if request.auth.token.role in ['suporte', 'gestor'];
    }
  }
}
```

### 6.3 Segurança do Código Client-Side

| Aspecto | Status | Ação |
|---------|--------|------|
| Senhas no código-fonte | ⚠️ Presente | **PRIORIDADE 1**: Mover para servidor |
| API Keys no HTML | ⚠️ Presente | Restringir via Firebase Console (domínio) |
| Debug functions em produção | ⚠️ Presente | Remover `console.log` em produção |
| Validação de input | ✅ Parcial | Expandir validações |
| XSS Prevention | ✅ `escapeHtml()` | Manter uso consistente |

---

## 7. Política de Senhas

### 7.1 Regras Atuais

| Regra | Implementação |
|-------|--------------|
| Comprimento mínimo | Não enforced |
| Complexidade | Padrão: `Nome2025!` |
| Expiração | Nenhuma |
| Histórico | Nenhum |
| Bloqueio por tentativas | Nenhum |

### 7.2 Política Recomendada (Pós-Migração)

| Regra | Recomendação |
|-------|-------------|
| Comprimento mínimo | 8 caracteres |
| Complexidade | Maiúscula + minúscula + número + especial |
| Expiração | 90 dias |
| Histórico | Últimas 5 senhas |
| Bloqueio | Após 5 tentativas (15 min lockout) |
| MFA | Opcional para operadores, obrigatório para suporte |

---

## 8. Gestão de Sessões

### 8.1 Configuração Atual

| Parâmetro | Valor |
|-----------|-------|
| TTL com "Lembrar" | 24 horas |
| TTL sem "Lembrar" | 8 horas |
| Validação | Verificação de `loginTime` a cada carregamento |
| Invalidação | Logout manual ou expiração |
| Multi-sessão | Permitido (sem controle) |

### 8.2 Recomendações

- Implementar **token de sessão rotativo** (refresh tokens)
- Adicionar **fingerprint do device** para prevenir roubo de sessão
- **Limitar sessões simultâneas** por usuário (máx. 2)
- **Log de login/logout** na coleção `system_logs`
- Implementar **heartbeat** para detectar sessões inativas

---

## 9. Proteção de Dados

### 9.1 Dados em Trânsito

| Caminho | Protocolo | Status |
|---------|-----------|--------|
| Browser ↔ Firebase | HTTPS/TLS 1.3 | ✅ Automático pelo Firebase |
| Browser ↔ Hosting | HTTPS | ✅ Se hospedado no Firebase Hosting |
| Browser ↔ CDN (libs) | HTTPS | ✅ CDNs usam HTTPS |

### 9.2 Dados em Repouso

| Localização | Criptografia | Status |
|-------------|------------|--------|
| Firestore | AES-256 (Google) | ✅ Automático |
| localStorage | Nenhuma | ⚠️ Dados de sessão expostos |
| Código-fonte | Nenhuma | ⚠️ Senhas visíveis |

### 9.3 Backup de Dados

| Aspecto | Status |
|---------|--------|
| Backup automático Firestore | ✅ Se configurado no GCP |
| Export manual | ✅ Via `gcloud firestore export` |
| Ponto de restauração | Depende da config GCP |
| Backup do código | ✅ Este repositório |

---

## 10. Plano de Ação — Prioridades de Segurança

### Prioridade 1 — CRÍTICO (Implementar em 30 dias)

| # | Ação | Esforço | Impacto |
|---|------|---------|---------|
| 1.1 | Migrar senhas para Firebase Auth | Alto | Elimina senhas no código |
| 1.2 | Configurar Firestore Rules restritivas | Médio | Proteção do banco |
| 1.3 | Restringir API Key por domínio | Baixo | Evita abuso de API |
| 1.4 | Habilitar HTTPS exclusivo | Baixo | Proteção em trânsito |

### Prioridade 2 — ALTO (Implementar em 90 dias)

| # | Ação | Esforço | Impacto |
|---|------|---------|---------|
| 2.1 | Implementar rate limiting no login | Médio | Anti brute-force |
| 2.2 | Adicionar log de login/logout | Baixo | Rastreabilidade |
| 2.3 | Remover console.logs de debug | Baixo | Info leakage |
| 2.4 | Implementar CSP headers | Médio | XSS mitigation |

### Prioridade 3 — MÉDIO (Implementar em 180 dias)

| # | Ação | Esforço | Impacto |
|---|------|---------|---------|
| 3.1 | MFA para perfil suporte | Médio | 2FA security |
| 3.2 | Política de expiração de senhas | Médio | Credential hygiene |
| 3.3 | Auditoria de sessões ativas | Médio | Controle de acesso |
| 3.4 | Firebase App Check | Médio | Anti-bot |

---

## 11. Conformidade e Regulamentação

### 11.1 LGPD (Lei Geral de Proteção de Dados)

| Requisito | Conformidade | Observação |
|-----------|:----------:|-----------|
| Dados pessoais identificados | ✅ | Nomes de operadores em logs |
| Base legal para tratamento | ✅ | Relação de trabalho (Art. 7°, V) |
| Consentimento | N/A | Dados operacionais, não pessoais sensíveis |
| Direito de exclusão | ⚠️ | Logs de auditoria são imutáveis por design |
| Responsável (DPO) | ⚠️ | Definir responsável formal |
| Inventário de dados | ✅ | Este documento |

### 11.2 ISO 27001 (Alinhamento)

| Controle | Status | Observação |
|----------|--------|-----------|
| A.9 - Controle de Acesso | ✅ Parcial | RBAC implementado, melhorias necessárias |
| A.10 - Criptografia | ✅ | Via Firebase (em trânsito e repouso) |
| A.12 - Segurança Operacional | ⚠️ | Falta procedimento de deploy |
| A.14 - Desenvolvimento Seguro | ⚠️ | Falta code review formal |
| A.16 - Gestão de Incidentes | ⚠️ | Falta procedimento formal |
| A.18 - Conformidade | ⚠️ | Em progresso |

---

## 12. Gestão de Incidentes de Segurança

### 12.1 Classificação de Incidentes

| Severidade | Descrição | SLA de Resposta |
|-----------|-----------|-----------------|
| **P1 - Crítico** | Acesso não autorizado, vazamento de dados | 1 hora |
| **P2 - Alto** | Indisponibilidade do sistema, perda de dados | 4 horas |
| **P3 - Médio** | Comportamento anômalo, tentativa de acesso | 24 horas |
| **P4 - Baixo** | Melhoria de segurança, configuração | 1 semana |

### 12.2 Procedimento de Resposta

```
1. DETECTAR → Monitorar logs e alertas
2. CONTER → Isolar sistema/usuário afetado
3. INVESTIGAR → Analisar system_logs + Firebase Console
4. REMEDIAR → Corrigir vulnerabilidade/acesso
5. COMUNICAR → Informar stakeholders
6. APRENDER → Documentar e atualizar políticas
```

### 12.3 Contatos de Emergência

| Papel | Responsável | Contato |
|-------|------------|---------|
| Administrador do Sistema | Leandro de Camargo | leandro@hokkaido.com.br |
| Firebase Console | Administrador GCP | Via console.firebase.google.com |
| Suporte Técnico | Equipe de Suporte | role=suporte |

---

## 13. Revisão e Atualização

| Aspecto | Frequência |
|---------|-----------|
| Revisão deste documento | Semestral |
| Auditoria de usuários ativos | Mensal |
| Revisão de permissões | Trimestral |
| Teste de recuperação (backup) | Semestral |
| Verificação de Firestore Rules | A cada deploy |
| Scan de vulnerabilidades | Trimestral |

---

## Histórico de Revisões

| Versão | Data | Autor | Alteração |
|--------|------|-------|-----------|
| 1.0 | 2026-02-19 | Leandro de Camargo | Criação inicial |
