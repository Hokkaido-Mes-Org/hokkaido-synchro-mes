# Plano de Migração: Firebase Hosting + Auth + RBAC

> **Data**: Fevereiro 2026
> **Projeto**: HokkaidoMES (Hokkaido Synchro MES)
> **Repositório**: `hokkaidoplasticsfirebase/hokkaido-synchro-mes.git`
> **Status**: Planejamento

---

## Índice

1. [Objetivo e Motivação](#1-objetivo-e-motivação)
2. [Estado Atual (AS-IS)](#2-estado-atual-as-is)
3. [Estado Futuro (TO-BE)](#3-estado-futuro-to-be)
4. [Fase 1 — Firebase Hosting](#fase-1--firebase-hosting)
5. [Fase 2 — Firebase Authentication](#fase-2--firebase-authentication)
6. [Fase 3 — RBAC com Firestore + Custom Claims](#fase-3--rbac-com-firestore--custom-claims)
7. [Fase 4 — Firestore Security Rules](#fase-4--firestore-security-rules)
7.5 [Estratégia de Migração Incremental](#75-estratégia-de-migração-incremental-zero-downtime)
7.6 [**PLANO DE EXECUÇÃO EM FASES (Documento Separado)**](PLANO-EXECUCAO-FASES.md)
8. [Cronograma e Prioridade](#8-cronograma-e-prioridade)
9. [Riscos e Mitigações](#9-riscos-e-mitigações)
10. [Checklist de Entrega](#10-checklist-de-entrega)

---

## 1. Objetivo e Motivação

### 1.1 Objetivos

| # | Objetivo | Impacto |
|---|----------|---------|
| 1 | **Hospedar o sistema no Firebase Hosting** | HTTPS automático, CDN global, CI/CD com GitHub Actions |
| 2 | **Migrar autenticação para Firebase Auth** | Eliminar senhas em texto plano no código-fonte |
| 3 | **Reestruturar controle de acesso (RBAC)** | Controle granular de leituras Firestore por role/aba |

### 1.2 Motivação

| Problema Atual | Severidade | Solução |
|---------------|-----------|---------|
| 55 usuários com senhas hardcoded em `login.html` (~580 linhas de credenciais) | **CRÍTICO** | Firebase Auth com email/senha |
| ACL por nome de usuário em `auth.js` (frágil, quebra com mudança de nome) | **ALTO** | Custom Claims no token Firebase |
| Sem HTTPS obrigatório (rede local) | **ALTO** | Firebase Hosting (HTTPS automático) |
| Sem Firestore Security Rules efetivas | **ALTO** | Rules baseadas em `request.auth` + custom claims |
| Toda aba carrega todas as collections indiscriminadamente | **MÉDIO** | Queries condicionais por role — reduz leituras |
| Deploy manual (copiar arquivos) | **MÉDIO** | `firebase deploy` + GitHub Actions |
| Session hijacking via localStorage (sem token assinado) | **MÉDIO** | Firebase Auth ID Tokens (JWT assinado pelo Google) |

---

## 2. Estado Atual (AS-IS)

### 2.1 Autenticação

```
login.html
  └─ const users = { ... }          ← 55 credenciais em texto plano no HTML
      ├─ username: 'admin'
      │   password: 'admin123'       ← Visível no View Source do browser
      │   role: 'operador'
      │   permissions: [...]
      └─ ...

auth.js (AuthSystem class)
  ├─ loadUserSession()               ← localStorage/sessionStorage
  ├─ validateSession()               ← TTL de 8h/24h
  ├─ hasPermission(perm)             ← Verifica array local
  ├─ canAccessTab(tabName)           ← 15+ blocos if/else com listas de nomes hardcoded
  └─ filterTabsBasedOnPermissions()  ← Oculta tabs no DOM
```

### 2.2 Pontos de Controle de Acesso

| Local | Tipo | Problema |
|-------|------|----------|
| `login.html` L150-730 | Credenciais | 55 objetos `{ password, role, permissions }` em texto plano |
| `auth.js` L120-250 | ACL por nome | Listas como `['Leandro Camargo', 'Michelle Benjamin', ...]` |
| `auth.js` L130 | Admin hardcoded | `currentUser.name === 'Leandro Camargo'` → acesso total |
| `script.js` (vários) | ACL duplicada | Controles de PMP, Dashboard TV duplicados entre auth.js e script.js |

### 2.3 Perfis Atuais

| Role | Qtd | Permissões Base |
|------|-----|-----------------|
| `suporte` | 10 | Acesso total (equivale a admin) |
| `gestor` | 25 | Planejamento, lançamento, análise, dashboard-tv, relatórios |
| `lider` | 3 | Planejamento, lançamento, análise + setup, ferramentaria, liderança |
| `operador` | 37 | Planejamento, lançamento, análise (básico) |

### 2.4 Abas e Funções do Sistema (14 abas)

| Aba | Slug | Collections Firestore Lidas |
|-----|------|----------------------------|
| Planejamento | `planejamento` | `planning`, `production_entries`, `downtime_entries`, `active_downtimes` |
| Lançamento | `lancamento` | `planning`, `production_entries`, `downtime_entries`, `active_downtimes`, `products` |
| Ordens | `ordens` | `production_orders` |
| Análise | `analise` | `production_entries`, `downtime_entries`, `planning` |
| Relatórios | `relatorios` | `production_entries`, `downtime_entries`, `planning`, `production_orders` |
| PCP | `pcp` | `planning`, `production_entries`, `active_downtimes`, `pcp_messages`, `pcp_observations` |
| PMP | `pmp` | `pmp_borra`, `pmp_moido` |
| Liderança | `lideranca-producao` | `production_entries`, `downtime_entries`, `escalas_operadores` |
| Setup | `setup-maquinas` | `machine_schedule` |
| Ferramentaria | `ferramentaria` | `ferramentaria_moldes`, `ferramentaria_manutencoes` |
| Acompanhamento | `acompanhamento` | `acompanhamento_turno`, `production_entries` |
| Histórico | `historico-sistema` | `system_logs` |
| Admin Dados | `admin-dados` | `products`, `production_entries`, `downtime_entries` |
| Qualidade | `qualidade` | `production_entries`, `batch_traceability` |

---

## 3. Estado Futuro (TO-BE)

### 3.1 Arquitetura Alvo

```
┌──────────────────────────────────────────────────────────────────┐
│                       FIREBASE HOSTING                           │
│  HTTPS automático · CDN · Custom Domain · GitHub Actions CI/CD   │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Browser                                                        │
│   ├─ login.html → firebase.auth().signInWithEmailAndPassword()   │
│   ├─ auth.js    → onAuthStateChanged() + getIdTokenResult()      │
│   │                  └─ token.claims.role                        │
│   │                  └─ token.claims.permissions                 │
│   └─ script.js  → db.collection(...) ← Security Rules validam   │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│                       FIREBASE AUTH                               │
│  55 usuários com email/senha · Custom Claims (role, permissions)  │
├──────────────────────────────────────────────────────────────────┤
│                    FIRESTORE + SECURITY RULES                     │
│  Rules por collection × role → operador só lê planning,          │
│  production_entries, downtime_entries, active_downtimes           │
│  Gestor lê tudo exceto system_logs e admin-only collections      │
│  Suporte lê/escreve tudo                                         │
└──────────────────────────────────────────────────────────────────┘
```

### 3.2 Decisão: Custom Claims vs Firestore `users` Collection

| Abordagem | Prós | Contras |
|-----------|------|---------|
| **Custom Claims (recomendada)** | Disponível direto no token JWT; validável em Security Rules; sem leitura extra do Firestore | Limite de 1000 bytes; requer Admin SDK (Cloud Function) para setar |
| **Firestore `users` collection** | Sem limite de dados; atualizável sem redeploy | +1 leitura Firestore por sessão; não acessível em Security Rules nativamente |

**Decisão**: Usar **Custom Claims** para `role` e `permissions[]` (cabe em <1000 bytes) + collection `users` apenas como cadastro de referência e auditoria.

---

## Fase 1 — Firebase Hosting

### 1.1 Pré-requisitos

```bash
# Instalar Firebase CLI
npm install -g firebase-tools

# Login
firebase login

# Inicializar projeto
cd backupHokkaidoMES
firebase init hosting
```

### 1.2 Configuração (`firebase.json`)

```json
{
  "hosting": {
    "public": ".",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**",
      "docs/**",
      "tools/**",
      "src/**",
      "*.md",
      "*.ps1",
      "*.py"
    ],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ],
    "headers": [
      {
        "source": "**/*.js",
        "headers": [
          { "key": "Cache-Control", "value": "public, max-age=3600" }
        ]
      },
      {
        "source": "**/*.css",
        "headers": [
          { "key": "Cache-Control", "value": "public, max-age=3600" }
        ]
      }
    ]
  }
}
```

### 1.3 Deploy Manual

```bash
firebase deploy --only hosting
```

### 1.4 CI/CD com GitHub Actions

Criar `.github/workflows/firebase-deploy.yml`:

```yaml
name: Deploy to Firebase Hosting
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to Firebase
        uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: '${{ secrets.GITHUB_TOKEN }}'
          firebaseServiceAccount: '${{ secrets.FIREBASE_SERVICE_ACCOUNT }}'
          channelId: live
          projectId: hokkaido-synchro
```

### 1.5 Custom Domain (Opcional)

```bash
firebase hosting:channel:deploy preview   # Preview antes do live
firebase hosting:sites:list               # Listar sites
```

Configurar domínio customizado no Console Firebase → Hosting → Add custom domain.

### 1.6 Checklist Fase 1

- [ ] Instalar Firebase CLI
- [ ] `firebase init hosting`
- [ ] Criar `firebase.json` com config acima
- [ ] Primeiro `firebase deploy --only hosting`
- [ ] Verificar acesso via URL do Firebase (`hokkaido-synchro.web.app`)
- [ ] Configurar GitHub Actions para deploy automático
- [ ] Testar todas as páginas (index.html, login.html, dashboard-tv.html, acompanhamento-turno.html)
- [ ] Configurar custom domain (se aplicável)

---

## Fase 2 — Firebase Authentication

### 2.1 Visão Geral

Migrar de credenciais hardcoded em `login.html` para Firebase Auth com email/senha.

### 2.2 Passo 1: Criar Usuários no Firebase Auth

Usar script Admin SDK para importar os 55 usuários:

```javascript
// scripts/import-users.js (executar uma vez com Node.js + Admin SDK)
const admin = require('firebase-admin');
const serviceAccount = require('./service-account-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const users = [
  // SUPORTE
  { email: 'raphael.moreira@hokkaido.local', password: 'Raphael2025!', displayName: 'Raphael Moreira', role: 'suporte', permissions: ['planejamento','lancamento','analise','lancamento_manual_producao','lancamento_manual_perdas','qualidade','ajustes','relatorios','admin'] },
  { email: 'roberto.fernandes@hokkaido.local', password: 'Roberto2025!', displayName: 'Roberto Fernandes', role: 'suporte', permissions: ['planejamento','lancamento','analise','lancamento_manual_producao','lancamento_manual_perdas','qualidade','ajustes','relatorios','admin'] },
  { email: 'daniella.braganca@hokkaido.local', password: 'Daniella2025!', displayName: 'Daniella Bragança', role: 'suporte', permissions: ['planejamento','lancamento','analise','lancamento_manual_producao','lancamento_manual_perdas','qualidade','ajustes','relatorios','admin'] },
  // ... (todos os 55 usuários)
  
  // GESTORES
  { email: 'leandro.camargo@hokkaido.local', password: 'Leandro2025!', displayName: 'Leandro Camargo', role: 'gestor', permissions: ['planejamento','lancamento','analise','dashboard-tv','relatorios'] },
  
  // OPERADORES
  { email: 'admin@hokkaido.local', password: 'admin123', displayName: 'Administrador', role: 'operador', permissions: ['planejamento','lancamento','analise'] },
  // ...
];

async function importUsers() {
  for (const user of users) {
    try {
      // Criar usuário
      const userRecord = await admin.auth().createUser({
        email: user.email,
        password: user.password,
        displayName: user.displayName,
        emailVerified: true
      });
      
      // Setar Custom Claims (role + permissions)
      await admin.auth().setCustomUserClaims(userRecord.uid, {
        role: user.role,
        permissions: user.permissions
      });
      
      // Salvar na collection users (referência)
      await admin.firestore().collection('users').doc(userRecord.uid).set({
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        permissions: user.permissions,
        legacyUsername: user.email.split('@')[0], // Para mapeamento
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        isActive: true
      });
      
      console.log(`✅ ${user.displayName} (${user.role})`);
    } catch (err) {
      console.error(`❌ ${user.displayName}:`, err.message);
    }
  }
}

importUsers();
```

### 2.3 Passo 2: Adicionar Firebase Auth SDK

Em `index.html` e `login.html`:

```html
<!-- Adicionar ANTES dos scripts existentes -->
<script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-auth.js"></script>
```

### 2.4 Passo 3: Refatorar `login.html`

**Antes** (580+ linhas de credenciais hardcoded):
```javascript
const users = {
  'admin': { password: 'admin123', role: 'operador', ... },
  // ... 55 usuários
};
```

**Depois** (~30 linhas):
```javascript
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const rememberMe = document.getElementById('remember-me').checked;
    
    // Construir email a partir do username
    // Convenção: username → username@hokkaido.local
    const email = username.includes('@') ? username : `${username}@hokkaido.local`;
    
    try {
        showLoading(true);
        
        // Persistência: LOCAL (survive browser restart) ou SESSION
        const persistence = rememberMe 
            ? firebase.auth.Auth.Persistence.LOCAL 
            : firebase.auth.Auth.Persistence.SESSION;
        await firebase.auth().setPersistence(persistence);
        
        // Login via Firebase Auth
        const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        // Obter Custom Claims (role, permissions)
        const tokenResult = await user.getIdTokenResult();
        const claims = tokenResult.claims;
        
        console.log('✅ Login:', user.displayName, '| Role:', claims.role);
        
        // Redirecionar
        window.location.href = 'index.html';
    } catch (error) {
        showLoading(false);
        let msg = 'Usuário ou senha incorretos';
        if (error.code === 'auth/user-not-found') msg = 'Usuário não encontrado';
        if (error.code === 'auth/wrong-password') msg = 'Senha incorreta';
        if (error.code === 'auth/too-many-requests') msg = 'Muitas tentativas. Aguarde alguns minutos.';
        showError(msg);
    }
});
```

### 2.5 Passo 4: Refatorar `auth.js`

**Antes** (`AuthSystem` class com sessionStorage/localStorage):

```javascript
class AuthSystem {
    loadUserSession() {
        let userData = localStorage.getItem(this.sessionKey);  // ← Token não assinado
    }
    hasPermission(perm) {
        return this.currentUser.permissions.includes(perm);     // ← Do localStorage
    }
}
```

**Depois** (baseado em `onAuthStateChanged` + Custom Claims):

```javascript
class AuthSystem {
    constructor() {
        this.currentUser = null;
        this.claims = null;
        this.ready = new Promise(resolve => { this._resolveReady = resolve; });
        this.init();
    }

    init() {
        firebase.auth().onAuthStateChanged(async (user) => {
            if (user) {
                // Obter claims atualizados
                const tokenResult = await user.getIdTokenResult();
                this.claims = tokenResult.claims;
                
                this.currentUser = {
                    uid: user.uid,
                    name: user.displayName,
                    email: user.email,
                    role: this.claims.role || 'operador',
                    permissions: this.claims.permissions || [],
                    loginTime: new Date().toISOString()
                };
                
                console.log('✅ Sessão Firebase Auth:', this.currentUser.name, '| Role:', this.claims.role);
                
                // Filtrar tabs
                this.filterTabsBasedOnPermissions();
            } else {
                this.currentUser = null;
                this.claims = null;
                
                // Redirecionar para login se não estiver nele
                const isLoginPage = window.location.pathname.includes('login.html');
                if (!isLoginPage) {
                    window.location.href = 'login.html';
                }
            }
            this._resolveReady();
        });
    }

    hasPermission(perm) {
        return (this.claims?.permissions || []).includes(perm);
    }

    isRole(role) {
        return this.claims?.role === role;
    }
    
    isAdmin() {
        return this.claims?.role === 'suporte';
    }

    getCurrentUser() {
        return this.currentUser;
    }

    async logout() {
        await firebase.auth().signOut();
        window.location.href = 'login.html';
    }

    canAccessTab(tabName) {
        if (!this.currentUser || !this.claims) return false;
        
        const role = this.claims.role;
        const perms = this.claims.permissions || [];
        
        // Suporte = acesso total
        if (role === 'suporte') return true;
        
        // Mapear tabs → roles permitidos
        const tabAccessMap = {
            'planejamento':      { roles: ['suporte','gestor','lider','operador'], perms: ['planejamento','lancamento'] },
            'lancamento':        { roles: ['suporte','gestor','lider','operador'], perms: ['lancamento'] },
            'ordens':            { roles: ['suporte','gestor','lider','operador'], perms: ['planejamento','lancamento'] },
            'analise':           { roles: ['suporte','gestor','lider','operador'], perms: ['analise'] },
            'relatorios':        { roles: ['suporte','gestor','lider'],            perms: ['relatorios'] },
            'pcp':               { roles: ['suporte'],                             perms: ['pcp'] },
            'pmp':               { roles: ['suporte'],                             perms: ['pmp'] },
            'lideranca-producao':{ roles: ['suporte','lider'],                     perms: ['lideranca'] },
            'setup-maquinas':    { roles: ['suporte','lider'],                     perms: ['setup'] },
            'ferramentaria':     { roles: ['suporte','lider'],                     perms: ['ferramentaria'] },
            'acompanhamento':    { roles: ['suporte'],                             perms: ['acompanhamento'] },
            'historico-sistema': { roles: ['suporte'],                             perms: ['historico'] },
            'admin-dados':       { roles: ['suporte'],                             perms: ['admin'] },
            'qualidade':         { roles: ['suporte'],                             perms: ['qualidade'] },
            'processo':          { roles: ['suporte'],                             perms: ['processo'] },
            'ajustes':           { roles: ['suporte','gestor','lider'],            perms: ['ajustes'] },
            'dashboard-tv':      { roles: ['suporte','gestor','lider'],            perms: ['dashboard-tv'] },
            'paradas-longas':    { roles: ['suporte','gestor','lider','operador'], perms: ['lancamento','planejamento','analise'] },
        };
        
        const access = tabAccessMap[tabName];
        if (!access) return false;
        
        // Verificar por role
        if (access.roles.includes(role)) return true;
        
        // Verificar por permission individual (Custom Claims)
        return perms.some(p => access.perms.includes(p));
    }
}
```

### 2.6 Mudanças Chave

| Item | Antes | Depois |
|------|-------|--------|
| **Credenciais** | Hardcoded em `login.html` (texto plano) | Firebase Auth (hash bcrypt no server) |
| **Sessão** | `localStorage`/`sessionStorage` com JSON | Firebase Auth token (JWT assinado pelo Google) |
| **TTL** | Manual (8h/24h via código) | Firebase Auth gerencia (1h token + refresh automático) |
| **ACL** | `if (name === 'Leandro Camargo')` hardcoded | `claims.role === 'suporte'` via Custom Claims |
| **Logout** | Limpar localStorage | `firebase.auth().signOut()` |
| **Rate limiting** | Nenhum | Firebase Auth nativo (too-many-requests) |
| **Número de linhas auth** | ~580 (login.html) + ~530 (auth.js) = 1.110 linhas | ~30 (login.html) + ~120 (auth.js) = 150 linhas |

### 2.7 Mapeamento de Emails

Convenção: `username` → `username@hokkaido.local`

| Username Atual | Email Firebase Auth |
|---------------|---------------------|
| `leandro.camargo` | `leandro.camargo@hokkaido.local` |
| `admin` | `admin@hokkaido.local` |
| `operador.turno1` | `operador.turno1@hokkaido.local` |
| `ferramentaria.geral` | `ferramentaria.geral@hokkaido.local` |

> **Nota**: Se no futuro quiser usar emails reais, basta atualizar no Console Firebase. O username de login pode continuar o mesmo (o código concatena `@hokkaido.local`).

### 2.8 Checklist Fase 2

- [ ] Ativar Firebase Authentication no Console (método Email/Senha)
- [ ] Criar `service-account-key.json` (Console → Settings → Service accounts)
- [ ] Criar script `scripts/import-users.js` com os 55 usuários
- [ ] Executar script de importação e verificar no Console Firebase
- [ ] Adicionar `firebase-auth.js` SDK em `index.html` e `login.html`
- [ ] Refatorar `login.html` — remover `const users = {...}`, usar `signInWithEmailAndPassword()`
- [ ] Refatorar `auth.js` — usar `onAuthStateChanged()` + `getIdTokenResult()`
- [ ] Eliminar listas de nomes hardcoded (`allowedUsers.includes(name)`)
- [ ] Testar login/logout com todos os perfis (suporte, gestor, lider, operador)
- [ ] Testar "Manter conectado" (persistence LOCAL vs SESSION)
- [ ] Remover credenciais do repositório Git (considerar `.gitignore` para service-account)
- [ ] Testar Dashboard TV (standalone, sem auth atualmente)
- [ ] Testar Acompanhamento Turno (standalone, sem auth atualmente)

---

## Fase 3 — RBAC com Firestore + Custom Claims

### 3.1 Objetivo

Controlar **quais collections do Firestore cada role pode ler**, reduzindo leituras desnecessárias e estabelecendo segurança server-side.

### 3.2 Matriz de Acesso por Collection × Role

| Collection | operador | lider | gestor | suporte |
|-----------|:--------:|:-----:|:------:|:-------:|
| `planning` | R | R | RW | RW |
| `production_entries` | R/W¹ | R/W¹ | R/W | RW |
| `downtime_entries` | R/W¹ | R/W | R/W | RW |
| `active_downtimes` | R | R/W | R/W | RW |
| `production_orders` | R | R | RW | RW |
| `products` | R | R | R | RW |
| `pcp_messages` | R | R | R/W² | RW |
| `pcp_observations` | — | — | R/W² | RW |
| `pmp_borra` | — | — | R/W³ | RW |
| `pmp_moido` | — | — | R/W³ | RW |
| `escalas_operadores` | — | R/W | R/W | RW |
| `machine_schedule` | — | R/W | R/W | RW |
| `ferramentaria_moldes` | — | R/W | R | RW |
| `ferramentaria_manutencoes` | — | R/W | R | RW |
| `acompanhamento_turno` | — | — | R⁴ | RW |
| `batch_traceability` | — | — | R | RW |
| `system_logs` | — | — | — | R |
| `oee_history` | R | R | R | RW |
| `hourly_production_entries` | R/W¹ | R/W | R/W | RW |

> **Legenda**: R = Read, W = Write, — = Sem acesso
> ¹ Write apenas da própria máquina/turno | ² Apenas com permissão `pcp` | ³ Apenas com permissão `pmp` | ⁴ Apenas com permissão `acompanhamento`

### 3.3 Custom Claims Structure

```json
{
  "role": "gestor",
  "permissions": ["planejamento", "lancamento", "analise", "dashboard-tv", "relatorios", "pcp"],
  "adminLevel": 0
}
```

Tamanho estimado: ~150-300 bytes (limite Firebase = 1.000 bytes) ✅

### 3.4 Collection `users` (Referência + Auditoria)

```javascript
// Firestore: users/{uid}
{
  "email": "leandro.camargo@hokkaido.local",
  "displayName": "Leandro Camargo",
  "role": "gestor",
  "permissions": ["planejamento", "lancamento", "analise", "dashboard-tv", "relatorios"],
  "legacyUsername": "leandro.camargo",
  "isActive": true,
  "createdAt": Timestamp,
  "updatedAt": Timestamp,
  "lastLogin": Timestamp
}
```

### 3.5 Cloud Function para Gerenciar Claims

```javascript
// functions/index.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

// Atualizar claims quando o doc users/{uid} mudar
exports.onUserUpdate = functions.firestore
  .document('users/{uid}')
  .onWrite(async (change, context) => {
    const uid = context.params.uid;
    const data = change.after.exists ? change.after.data() : null;
    
    if (!data || !data.isActive) {
      // Desativar: revogar tokens
      await admin.auth().revokeRefreshTokens(uid);
      return;
    }
    
    // Atualizar Custom Claims
    await admin.auth().setCustomUserClaims(uid, {
      role: data.role,
      permissions: data.permissions || [],
      adminLevel: data.role === 'suporte' ? 3 : data.role === 'gestor' ? 2 : data.role === 'lider' ? 1 : 0
    });
    
    console.log(`Claims atualizados para ${data.displayName} (${data.role})`);
  });

// API para admin criar/editar usuários (chamado do front-end)
exports.manageUser = functions.https.onCall(async (data, context) => {
  // Verificar se quem chama é suporte
  if (!context.auth || context.auth.token.role !== 'suporte') {
    throw new functions.https.HttpsError('permission-denied', 'Apenas suporte pode gerenciar usuários');
  }
  
  const { action, uid, email, password, displayName, role, permissions } = data;
  
  if (action === 'create') {
    const userRecord = await admin.auth().createUser({ email, password, displayName, emailVerified: true });
    await admin.firestore().collection('users').doc(userRecord.uid).set({
      email, displayName, role, permissions, isActive: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return { uid: userRecord.uid };
  }
  
  if (action === 'update') {
    await admin.firestore().collection('users').doc(uid).update({
      role, permissions, updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return { success: true };
  }
  
  if (action === 'disable') {
    await admin.auth().updateUser(uid, { disabled: true });
    await admin.firestore().collection('users').doc(uid).update({ isActive: false });
    return { success: true };
  }
});
```

### 3.6 Controle de Leituras no Front-end por Role

Implementar queries condicionais — cada aba só carrega as collections que o role tem acesso:

```javascript
// Exemplo: ao entrar na aba PCP
async function setupPCPPage() {
    const auth = window.authSystem;
    
    // Verificar acesso via claims (não via nome hardcoded)
    if (!auth.hasPermission('pcp') && !auth.isRole('suporte')) {
        showAccessDenied();
        return;
    }
    
    // Carregar apenas collections necessárias
    const planning = await db.collection('planning')
        .where('date', '==', today)
        .get(); // ← Security Rules validam server-side
    
    // Se não tem permissão, a query retorna vazio (Security Rules)
    // Em vez de carregar TUDO e filtrar no client
}
```

### 3.7 Impacto na Redução de Leituras

| Cenário | Antes (leituras/dia) | Depois (leituras/dia) | Economia |
|---------|---------------------|----------------------|----------|
| Operador acessa Lançamento | Carrega 6+ collections | Carrega 4 (planning, production, downtime, active) | ~33% |
| Operador navega para aba sem acesso | Carrega dados → mostra "sem permissão" | Não carrega nada (acesso negado antes) | ~100% da aba |
| Dashboard TV (Gestor) | Carrega tudo + ticker + polling | Sem mudança (já otimizado) | — |
| Admin Dados (suporte-only) | Todos carregam se tentam acessar | Security Rules bloqueiam no server | ~100% para não-suporte |

### 3.8 Checklist Fase 3

- [ ] Definir Custom Claims finais para cada role
- [ ] Criar Cloud Function `onUserUpdate` para sync claims ↔ Firestore
- [ ] Criar Cloud Function `manageUser` para CRUD de usuários
- [ ] Criar página de administração de usuários (substituir hardcoded)
- [ ] Implementar queries condicionais por role em cada controller
- [ ] Fazer load-testing comparando leituras antes × depois
- [ ] Documentar nova matriz RBAC

---

## Fase 4 — Firestore Security Rules

### 4.1 Rules Atuais

```javascript
// SITUAÇÃO ATUAL: Sem regras efetivas (tudo aberto se tiver auth — mas NÃO tem auth)
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;  // ← TOTALMENTE ABERTO
    }
  }
}
```

### 4.2 Rules Propostas

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // ===== HELPERS =====
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function hasRole(role) {
      return isAuthenticated() && request.auth.token.role == role;
    }
    
    function isSupporte() {
      return hasRole('suporte');
    }
    
    function isGestorOrAbove() {
      return hasRole('suporte') || hasRole('gestor');
    }
    
    function isLiderOrAbove() {
      return isGestorOrAbove() || hasRole('lider');
    }
    
    function hasPerm(perm) {
      return isAuthenticated() && perm in request.auth.token.permissions;
    }
    
    // ===== PRODUCTION CORE =====
    // Qualquer autenticado pode ler; write para lider+
    match /planning/{docId} {
      allow read: if isAuthenticated();
      allow write: if isLiderOrAbove();
    }
    
    match /production_entries/{docId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated() && hasPerm('lancamento');
      allow update, delete: if isLiderOrAbove();
    }
    
    match /downtime_entries/{docId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated() && hasPerm('lancamento');
      allow update, delete: if isLiderOrAbove();
    }
    
    match /active_downtimes/{docId} {
      allow read: if isAuthenticated();
      allow write: if isAuthenticated() && hasPerm('lancamento');
    }
    
    match /production_orders/{docId} {
      allow read: if isAuthenticated();
      allow write: if isGestorOrAbove();
    }
    
    match /products/{docId} {
      allow read: if isAuthenticated();
      allow write: if isSupporte();
    }
    
    // ===== PCP =====
    match /pcp_messages/{docId} {
      allow read: if isAuthenticated();
      allow write: if isAuthenticated() && hasPerm('pcp');
    }
    
    match /pcp_observations/{docId} {
      allow read: if isAuthenticated() && hasPerm('pcp');
      allow write: if isAuthenticated() && hasPerm('pcp');
    }
    
    // ===== PMP =====
    match /pmp_borra/{docId} {
      allow read, write: if isAuthenticated() && hasPerm('pmp');
    }
    
    match /pmp_moido/{docId} {
      allow read, write: if isAuthenticated() && hasPerm('pmp');
    }
    
    // ===== FERRAMENTARIA =====
    match /ferramentaria_moldes/{docId} {
      allow read: if isLiderOrAbove();
      allow write: if isLiderOrAbove();
    }
    
    match /ferramentaria_manutencoes/{docId} {
      allow read: if isLiderOrAbove();
      allow write: if isLiderOrAbove();
    }
    
    // ===== MACHINE MANAGEMENT =====
    match /machine_schedule/{docId} {
      allow read: if isLiderOrAbove();
      allow write: if isLiderOrAbove();
    }
    
    match /escalas_operadores/{docId} {
      allow read: if isLiderOrAbove();
      allow write: if isLiderOrAbove();
    }
    
    // ===== ADMIN =====
    match /system_logs/{docId} {
      allow read: if isSupporte();
      allow create: if isAuthenticated(); // Qualquer ação gera log
      allow update, delete: if false; // Logs são imutáveis
    }
    
    match /users/{userId} {
      allow read: if isAuthenticated() && (request.auth.uid == userId || isSupporte());
      allow write: if isSupporte();
    }
    
    // ===== ANALYTICS =====
    match /oee_history/{docId} {
      allow read: if isAuthenticated();
      allow write: if isGestorOrAbove();
    }
    
    match /hourly_production_entries/{docId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated() && hasPerm('lancamento');
      allow update: if isLiderOrAbove();
    }
    
    // ===== QUALITY =====
    match /batch_traceability/{docId} {
      allow read: if isGestorOrAbove() || hasPerm('qualidade');
      allow write: if isSupporte() || hasPerm('qualidade');
    }
    
    // ===== ACOMPANHAMENTO =====
    match /acompanhamento_turno/{docId} {
      allow read: if isAuthenticated() && hasPerm('acompanhamento');
      allow write: if isSupporte();
    }
    
    match /acompanhamento_perdas/{docId} {
      allow read: if isAuthenticated();
      allow write: if isGestorOrAbove();
    }
    
    // ===== DEFAULT: Negar tudo não coberto =====
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

### 4.3 Deploy das Rules

```bash
firebase deploy --only firestore:rules
```

### 4.4 Checklist Fase 4

- [ ] Escrever `firestore.rules` com as regras acima
- [ ] Testar com Firebase Rules Emulator (`firebase emulators:start`)
- [ ] Testar cada role: operador, lider, gestor, suporte
- [ ] Verificar que operador NÃO consegue ler `system_logs`
- [ ] Verificar que operador NÃO consegue escrever em `planning`
- [ ] Deploy: `firebase deploy --only firestore:rules`
- [ ] Monitorar erros de permissão no Console Firebase

---

## 7.5 Estratégia de Migração Incremental (Zero Downtime)

> 🎯 **Objetivo**: Fazer a migração SEM comprometer o sistema atual, hospedando no Firebase mas mantendo GitHub como source of truth
> ⏱️ **Método**: Parallelização com feature flags, CI/CD contínua, e rollback automático

### 7.5.1 Visão Geral da Abordagem

```
┌─ GitHub (Source of Truth) ─┐
│  main branch                 │
│  ├─ auth-legacy (current)    │ ← Versão atual (login.html + auth.js baseado em localStorage)
│  └─ auth-firebase (novo)     │ ← Versão com Firebase Auth
│                              │
└──────────┬──────────────────┘
           │
      CI/CD Pipeline (GitHub Actions)
           │
      ┌────┴────────────────┐
      │                     │
   🌐 Firebase Hosting (v1)  🌐 Firebase Hosting (v2 / Preview)
   hokkaido-synchro.web.app  hokkaido-synchro-preview.web.app
   (auth-legacy)             (auth-firebase)
      │                      │
   Produção                Preview/Testes
   (todos usuarios)         (Leandro, testers)
```

### 7.5.2 Estrutura de Branches no GitHub

```ssh
main (→ deployment automático para produção)
├─ auth-legacy               (Versão atual, estável)
│  └── Login via localStorage + auth.js nome-based ACLs
│
├─ auth-firebase             (Versão nova, em desenvolvimento)
│  ├── Login via Firebase Auth
│  ├── Custom Claims + RBAC
│  └── Firestore Security Rules
│
├─ auth-firebase-staging     (Testes pré-release)
│  └── Mesma que auth-firebase, para validação final
│
└─ hotfix/*                  (Correções rápidas de produção)
   └─ Mergeado em main + auth-firebase simultaneamente
```

### 7.5.3 Configuração de Deploy (GitHub Actions)

**`.github/workflows/deploy.yml`**

```yaml
name: Deploy HokkaidoMES

on:
  push:
    branches: [main, auth-legacy, auth-firebase]

env:
  FIREBASE_PROJECT_ID: hokkaido-synchro

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Determinar alvo de deploy
        id: target
        run: |
          if [ "${{ github.ref }}" == "refs/heads/main" ] || [ "${{ github.ref }}" == "refs/heads/auth-legacy" ]; then
            echo "channel=live" >> $GITHUB_OUTPUT
            echo "site=hokkaido-synchro" >> $GITHUB_OUTPUT
          elif [ "${{ github.ref }}" == "refs/heads/auth-firebase" ]; then
            echo "channel=preview" >> $GITHUB_OUTPUT
            echo "site=hokkaido-synchro-preview" >> $GITHUB_OUTPUT
          else
            echo "channel=default" >> $GITHUB_OUTPUT
            echo "site=hokkaido-synchro-staging" >> $GITHUB_OUTPUT
          fi
      
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      
      - name: Install Firebase CLI
        run: npm install -g firebase-tools
      
      - name: Deploy to Firebase Hosting
        run: |
          firebase deploy \
            --project=${{ env.FIREBASE_PROJECT_ID }} \
            --only=hosting:${{ steps.target.outputs.site }} \
            --channel=${{ steps.target.outputs.channel }}
        env:
          FIREBASE_TOKEN: ${{ secrets.FIREBASE_TOKEN }}
      
      - name: Comment PR with preview URL
        if: github.event_name == 'pull_request' && steps.target.outputs.channel == 'preview'
        uses: actions/github-script@v6
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: '🚀 Preview criada: https://hokkaido-synchro-preview.web.app\n\n🔐 Testar com: leandro.camargo@hokkaido.local (senha: Leandro2025!)'
            })
```

### 7.5.4 Estratégia de Rollback

#### A. Rollback Automático (em caso de erro de deploy)

```bash
# Se o deploy falhar e passar testes, reverter para versão anterior
firebase hosting:rollback --project hokkaido-synchro

# Ou restaurar a branch anterior:
git revert HEAD -m 1
git push origin main
```

#### B. Feature Flag para Ativar/Desativar Firebase Auth

**Arquivo: `src/config/feature-flags.js`**

```javascript
const FEATURE_FLAGS = {
    USE_FIREBASE_AUTH: localStorage.getItem('FEATURE_USE_FIREBASE_AUTH') === 'true',
    FALLBACK_TO_LEGACY_AUTH: true, // Se Firebase Auth falhar, usa login.html antigo
    LOG_AUTH_ERRORS: true,
};

export function enableFirebaseAuth() {
    localStorage.setItem('FEATURE_USE_FIREBASE_AUTH', 'true');
    location.reload();
}

export function rollbackToLegacy() {
    localStorage.removeItem('FEATURE_USE_FIREBASE_AUTH');
    location.reload();
}

// No login.html:
window.OVERRIDE_AUTH = FEATURE_FLAGS.USE_FIREBASE_AUTH
    ? 'firebase' 
    : 'legacy';
```

**Uso em `login.html`**:

```html
<div id="auth-provider-selector">
    <button onclick="useFirebaseAuth()" style="display: ${USE_FIREBASE_AUTH ? 'none' : 'block'}">
        Testar autenticação Firebase 🔐
    </button>
    <button onclick="rollbackToLegacy()" style="display: ${USE_FIREBASE_AUTH ? 'block' : 'none'}">
        Voltar para autenticação actual ↩️
    </button>
</div>

<script>
    function useFirebaseAuth() {
        enableFeatureFlag('USE_FIREBASE_AUTH');
        // Carregar novo auth.js com Firebase
        const script = document.createElement('script');
        script.src = 'auth-firebase.js';
        document.head.appendChild(script);
    }
    
    function rollbackToLegacy() {
        localStorage.removeItem('FEATURE_USE_FIREBASE_AUTH');
        location.go(0); // Hard refresh
    }
</script>
```

### 7.5.5 Fases de Rollout (Gradual)

#### Fase A: Development (Você)
- Branch: `auth-firebase`
- Deploy: `hokkaido-synchro-preview.web.app`
- Duração: 1-2 semanas
- Teste: ✅ Todos os roles, ✅ Firestore queries, ✅ Logout/refresh

#### Fase B: Staging (Gestor + 2 operadores)
- Branch: `auth-firebase-staging`
- Deploy: `hokkaido-synchro-staging.web.app`
- Duração: 3-5 dias
- Convidados: Leandro, Tiago, Roberto (ADMIN), 1 operador
- Teste: ✅ Produção real, ✅ Performance, ✅ Rollback path

#### Fase C: Canary (10% dos usuários)
- Branch: `main` (com auth-firebase merged)
- Deploy: `hokkaido-synchro.web.app` com feature flag 50/50
- Duração: 3-5 dias
- Usuários: 5 operators + 1 gestor (selecionados)
- Monitoramento: Erros no Console Firebase, latência de login, taxa de fallback para legacy

#### Fase D: General Availability (100%)
- Branch: `main` (auth-firebase merged, feature flag 100%)
- Deploy: `hokkaido-synchro.web.app`
- Duração: Permanente
- Comunicação: Email aos 55 usuários com novas credenciais

### 7.5.6 GitHub ↔ Firebase Hosting: Fluxo de Trabalho

```
1️⃣ Fazer mudança no código
   $ git checkout auth-firebase
   $ # editar auth.js, login.html, etc.
   $ git commit -m "refactor: migrar para Firebase Auth"
   $ git push origin auth-firebase

2️⃣ GitHub Actions automáticamente:
   ├─ Rodar testes unitários (se houver)
   ├─ Build (minify, etc.)
   └─ Deploy para hokkaido-synchro-preview.web.app

3️⃣ Testar em preview
   $ # Abrir https://hokkaido-synchro-preview.web.app
   $ # Logar com leandro.camargo@hokkaido.local
   $ # Testar abas, auth flow, Firestore queries

4️⃣ Merge para main (quando pronto)
   $ git checkout main
   $ git merge auth-firebase
   $ # GitHub Actions dispara deploy para hokkaido-synchro.web.app

5️⃣ Monitorar produção
   $ firebase hosting:channel:list --project hokkaido-synchro
   $ # Ver status dos deploys
   $ 
   $ # Se tiver erro, rollback automático:
   $ firebase hosting:rollback --project hokkaido-synchro
```

### 7.5.7 Mantendo GitHub como Source of Truth

✅ **GitHub é o único repositório de código**
- Todas as mudanças commitadas em GitHub
- Firebase Hosting puxa o código via GitHub Actions (não via `firebase deploy` local)
- Histórico completo de commits reflete todos os deployments

✅ **Proteções no repositório**
```yaml
# .github/CODEOWNERS
* @leandro.camargo  # Requer revisão sua

# branch protection rules (GitHub web UI)
- Require pull request reviews before merging
- Require status checks to pass (build, tests)
- Require branches to be up to date before merging
- Restrict who can push to matching branches (você + CI/CD)
```

✅ **Rollback via Git**
```bash
# Se produção falhar, reverter é tão simples quanto:
$ git revert HEAD -m 1 && git push origin main
# GitHub Actions reconstrói e redeploy a versão anterior

# Histórico permanente:
$ git log --oneline --all
c6f4d3a ✅ Merge auth-firebase → main (produção)
a7e8f2b ⚠️ Revert auth-firebase (rollback)
...
```

### 7.5.8 Checklist de Migração Segura

**Pré-migração:**
- [ ] Backup: `git tag pre-firebase-auth` em main
- [ ] Branch criada: `auth-firebase`
- [ ] Firebase project: Spark/Blaze ativo, `hokkaido-synchro` existente
- [ ] GitHub Actions workflow: `.github/workflows/deploy.yml` criado
- [ ] `firebase.json` + `.firebaserc` no repositório (não em .gitignore)
- [ ] Feature flag system: `FEATURE_FLAGS.js` em `src/config/`
- [ ] Teste local: `firebase serve` roda OK

**Durante desenvolvimento (auth-firebase):**
- [ ] Login Firebase funciona para todos os roles
- [ ] Custom Claims populados corretamente
- [ ] Logout limpa Firefox Auth token
- [ ] Refresh da página mantém sessão
- [ ] Fallback para legacy auth se Firebase indisponível
- [ ] Console Firefox sem erros CORS
- [ ] Firestore queries respeitam Security Rules
- [ ] Dashboard TV continua funcionando (sem auth)
- [ ] Acompanhamento Turno continua funcionando (sem auth)

**Antes de merge → main:**
- [ ] Pull request criada: `auth-firebase` → `main`
- [ ] Você revisor da PR (code review)
- [ ] Preview URL testada por 3+ dias
- [ ] Nenhum erro no console do preview
- [ ] Performance aceitável (< 2s pagina load)
- [ ] Firestore costs não aumentaram
- [ ] Rollback plan validado localmente

**Pós-migração (Fase C - Canary):**
- [ ] Feature flag em 50% para operadores selecionados
- [ ] Monitorar: Taxa de erro de login, latência, fallbacks
- [ ] Se OK por 2-3 dias, aumentar para 100%
- [ ] Se erro, rollback automático via feature flag

**Após 100% (Fase D):**
- [ ] Remover feature flag (USE_FIREBASE_AUTH = true hard-coded)
- [ ] Remover login.html antigo (ou mover para `login-legacy.html`)
- [ ] Remover auth.js antigo (ou mover para `auth-legacy.js`)
- [ ] Notificar equipe com novas credenciais Firebase
- [ ] Monitorar por 1 semana: Taxa de erro, slowness, feedback

### 7.5.9 Tempo Estimado de Cada Fase

| Fase | Duração | Pessoal | Atividade |
|------|---------|---------|-----------|
| **A — Development** | 1-2 semanas | Você | Programar, testar, iterar |
| **B — Staging** | 3-5 dias | Você + 3 testers | Validar produção-like, testar rollback |
| **C — Canary (50%)** | 3-5 dias | Você + 6 usuários | Monitorar, coletar feedback, resolver edge cases |
| **D — General (100%)** | 1 dia | Você | Remover feature flag, comunicar equipe |
| **E — Monitoramento** | 1 semana | Você | Monitorar erros, suportar usuários |
| **TOTAL** | **~4 semanas** | | |

---

## 8. Cronograma e Prioridade

```
Fase 1: Firebase Hosting          ████░░░░░░░░░░░░░░░░  Semana 1
Fase 2: Firebase Auth             ░░░░████████░░░░░░░░  Semanas 2-3
Fase 3: RBAC + Custom Claims      ░░░░░░░░░░░░████████  Semanas 3-4
Fase 4: Security Rules             ░░░░░░░░░░░░░░░░████  Semana 4
```

| Fase | Esforço | Risco | Pré-requisito |
|------|---------|-------|---------------|
| **1. Hosting** | Baixo (2-4h) | Baixo | Firebase CLI instalado |
| **2. Auth** | Médio (8-16h) | Médio | Fase 1 concluída |
| **3. RBAC** | Alto (16-24h) | Médio | Fase 2 concluída + Cloud Functions |
| **4. Rules** | Médio (4-8h) | Alto | Fase 2 + 3 concluídas |

**Tempo total estimado:** 30-52 horas de trabalho

---

## 9. Riscos e Mitigações

| Risco | Severidade | Mitigação |
|-------|-----------|-----------|
| Usuários esquecem nova senha | Médio | Manter senhas idênticas na migração; adicionar "Esqueci minha senha" |
| Cloud Functions têm custo | Baixo | Spark plan é grátis até 125K invocações/mês (suficiente para 55 users) |
| Dashboard TV não usa auth | Médio | Fase 2: decidir se TV fica aberto (display-only) ou requer auth |
| Firestore Rules muito restritivas | Alto | Testar extensivamente com Emulator antes do deploy |
| Lock-out acidental de todos | Crítico | Manter acesso Admin SDK (service-account) como fallback |
| Rollback necessário | Médio | Manter `login.html` antigo como `login-legacy.html` durante transição |

---

## 10. Checklist de Entrega

### Pré-migração
- [ ] Backup completo do estado atual (Git tag `pre-auth-migration`)
- [ ] Documentar todos os 55 usuários com seus roles e permissions
- [ ] Testar Firebase CLI e acesso ao projeto `hokkaido-synchro`

### Fase 1 — Hosting
- [ ] `firebase.json` configurado
- [ ] Deploy funcionando
- [ ] HTTPS ativo
- [ ] CI/CD configurado (GitHub Actions)

### Fase 2 — Auth
- [ ] 55 usuários importados no Firebase Auth
- [ ] Custom Claims setados para cada usuário
- [ ] `login.html` refatorado (sem credenciais hardcoded)
- [ ] `auth.js` refatorado (onAuthStateChanged + claims)
- [ ] Login/logout funcional para todos os perfis
- [ ] `login-legacy.html` mantido como fallback

### Fase 3 — RBAC
- [ ] Collection `users` populada
- [ ] Cloud Function `onUserUpdate` ativa
- [ ] Cloud Function `manageUser` ativa
- [ ] Tela de admin de usuários funcional
- [ ] Queries condicionais implementadas nos controllers

### Fase 4 — Security Rules
- [ ] `firestore.rules` escritas e testadas
- [ ] Deploy das rules
- [ ] Monitoramento de erros de permissão ativo

### Pós-migração
- [ ] Remover `login-legacy.html`
- [ ] Remover credenciais do histórico Git (`git filter-branch` ou BFG)
- [ ] Atualizar documentação (RAG, USUARIOS-ACESSOS.md)
- [ ] Comunicar equipe sobre novo sistema de login

---

## Arquivos Impactados

| Arquivo | Mudança | Fase |
|---------|---------|------|
| `firebase.json` | **NOVO** — config de hosting | 1 |
| `.github/workflows/firebase-deploy.yml` | **NOVO** — CI/CD | 1 |
| `login.html` | **REFATORAR** — remover 580 linhas de credenciais | 2 |
| `auth.js` | **REFATORAR** — onAuthStateChanged + Custom Claims | 2 |
| `index.html` | **EDITAR** — adicionar `firebase-auth.js` SDK | 2 |
| `dashboard-tv.html` | **EDITAR** — avaliar se precisa auth | 2 |
| `acompanhamento-turno.html` | **EDITAR** — avaliar se precisa auth | 2 |
| `script.js` | **EDITAR** — remover ACLs duplicadas (PMP, Dashboard TV) | 2-3 |
| `firestore.rules` | **NOVO** — security rules server-side | 4 |
| `functions/index.js` | **NOVO** — Cloud Functions para claims | 3 |
| `scripts/import-users.js` | **NOVO** — script de migração (uso único) | 2 |

---

*Documento de planejamento — Hokkaido Plastics · Fevereiro 2026*
