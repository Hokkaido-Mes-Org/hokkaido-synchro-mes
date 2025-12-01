# 🔒 GUIA DE IMPLEMENTAÇÃO DE SEGURANÇA - SISTEMA SYNCHRO

## Índice
1. [Visão Geral](#1-visão-geral)
2. [Pré-requisitos](#2-pré-requisitos)
3. [Fase 1: Firebase Authentication](#3-fase-1-firebase-authentication)
4. [Fase 2: Firebase Security Rules](#4-fase-2-firebase-security-rules)
5. [Fase 3: Restrição de API Keys](#5-fase-3-restrição-de-api-keys)
6. [Fase 4: Firebase App Check](#6-fase-4-firebase-app-check)
7. [Fase 5: Headers de Segurança](#7-fase-5-headers-de-segurança)
8. [Fase 6: Sanitização de Dados](#8-fase-6-sanitização-de-dados)
9. [Fase 7: Limpeza de Logs](#9-fase-7-limpeza-de-logs)
10. [Checklist Final](#10-checklist-final)

---

## 1. Visão Geral

### Objetivo
Este guia detalha o passo a passo para implementar todas as recomendações de segurança identificadas na análise do Sistema Synchro.

### Tempo Estimado
- **Total:** 4-6 horas
- **Fase 1 (Autenticação):** 2-3 horas
- **Fase 2 (Security Rules):** 30 minutos
- **Fase 3 (API Keys):** 15 minutos
- **Fase 4 (App Check):** 30 minutos
- **Fase 5 (Headers):** 15 minutos
- **Fase 6 (Sanitização):** 1 hora
- **Fase 7 (Logs):** 15 minutos

### Impacto no Sistema
- O sistema precisará de um **período de manutenção** de aproximadamente 1 hora
- Os usuários precisarão **redefinir suas senhas** após a migração

---

## 2. Pré-requisitos

### Ferramentas Necessárias
- [ ] Acesso ao [Firebase Console](https://console.firebase.google.com)
- [ ] Acesso ao [Google Cloud Console](https://console.cloud.google.com)
- [ ] Node.js instalado (versão 18+)
- [ ] Firebase CLI instalado: `npm install -g firebase-tools`
- [ ] Editor de código (VS Code recomendado)

### Verificações Iniciais
```powershell
# Verificar se Node.js está instalado
node --version

# Verificar se Firebase CLI está instalado
firebase --version

# Login no Firebase (executar uma vez)
firebase login
```

---

## 3. Fase 1: Firebase Authentication

### 3.1. Ativar Firebase Authentication

1. Acesse o [Firebase Console](https://console.firebase.google.com)
2. Selecione o projeto **hokkaido-synchro**
3. No menu lateral, clique em **Authentication**
4. Clique em **Get Started** (se primeira vez)
5. Na aba **Sign-in method**, clique em **Email/Password**
6. Ative **Enable** e clique em **Save**

### 3.2. Criar Usuários no Firebase

1. Na aba **Users**, clique em **Add user**
2. Adicione cada usuário com email e senha temporária:

| Email | Senha Temporária |
|-------|------------------|
| leandro.camargo@hokkaido.com.br | TempPass2025! |
| adriano.silva@hokkaido.com.br | TempPass2025! |
| bruno.dias@hokkaido.com.br | TempPass2025! |
| (continuar para todos os usuários) | ... |

### 3.3. Criar Coleção de Perfis de Usuário

No Firestore, crie a coleção `users` com a estrutura:

```javascript
// Documento ID = UID do Firebase Auth
{
  email: "leandro.camargo@hokkaido.com.br",
  name: "Leandro Camargo",
  role: "admin",
  permissions: ["planejamento", "lancamento", "analise", "qualidade", "ajustes", "relatorios"],
  createdAt: Timestamp,
  lastLogin: Timestamp
}
```

### 3.4. Atualizar Código de Login

**Substituir o arquivo `login.html`** - seção de script de autenticação:

```html
<script type="module">
    // Importar Firebase
    import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
    import { 
        getAuth, 
        signInWithEmailAndPassword,
        onAuthStateChanged 
    } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
    import { 
        getFirestore, 
        doc, 
        getDoc,
        updateDoc,
        serverTimestamp 
    } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

    const firebaseConfig = {
        apiKey: "AIzaSyB1YrMK07_7QROsCJQqE0MFsmJncfjphmI",
        authDomain: "hokkaido-synchro.firebaseapp.com",
        projectId: "hokkaido-synchro",
        storageBucket: "hokkaido-synchro.firebasestorage.app",
        messagingSenderId: "635645564631",
        appId: "1:635645564631:web:1e19be7957e39d1adc8292"
    };

    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getFirestore(app);

    // Verificar se já está logado
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // Buscar perfil do usuário
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                sessionStorage.setItem('synchro_user', JSON.stringify({
                    uid: user.uid,
                    email: user.email,
                    name: userData.name,
                    role: userData.role,
                    permissions: userData.permissions,
                    loginTime: new Date().toISOString()
                }));
                window.location.href = 'index.html';
            }
        }
    });

    // Formulário de login
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;
        const rememberMe = document.getElementById('remember-me').checked;
        const statusMessage = document.getElementById('login-status');
        const loginBtn = document.getElementById('login-btn');
        
        // Converter username para email se necessário
        let email = username;
        if (!username.includes('@')) {
            email = `${username.replace('.', '.')}@hokkaido.com.br`;
        }
        
        loginBtn.disabled = true;
        loginBtn.innerHTML = '<i data-lucide="loader-2" class="animate-spin"></i> Entrando...';
        
        try {
            // Autenticar com Firebase
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            
            // Buscar dados do perfil
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            
            if (!userDoc.exists()) {
                throw new Error('Perfil de usuário não encontrado. Contate o administrador.');
            }
            
            const userData = userDoc.data();
            
            // Atualizar último login
            await updateDoc(doc(db, 'users', user.uid), {
                lastLogin: serverTimestamp()
            });
            
            // Salvar sessão
            const sessionData = {
                uid: user.uid,
                email: user.email,
                name: userData.name,
                role: userData.role,
                permissions: userData.permissions,
                loginTime: new Date().toISOString()
            };
            
            if (rememberMe) {
                localStorage.setItem('synchro_user', JSON.stringify(sessionData));
            } else {
                sessionStorage.setItem('synchro_user', JSON.stringify(sessionData));
            }
            
            statusMessage.textContent = 'Login realizado com sucesso!';
            statusMessage.className = 'text-green-600 text-sm text-center';
            
            // Redirecionar
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 500);
            
        } catch (error) {
            console.error('Erro de login:', error);
            
            let errorMessage = 'Erro ao fazer login. Tente novamente.';
            
            switch (error.code) {
                case 'auth/user-not-found':
                    errorMessage = 'Usuário não encontrado.';
                    break;
                case 'auth/wrong-password':
                    errorMessage = 'Senha incorreta.';
                    break;
                case 'auth/invalid-email':
                    errorMessage = 'Email inválido.';
                    break;
                case 'auth/too-many-requests':
                    errorMessage = 'Muitas tentativas. Aguarde alguns minutos.';
                    break;
                case 'auth/invalid-credential':
                    errorMessage = 'Usuário ou senha incorretos.';
                    break;
                default:
                    errorMessage = error.message || 'Erro desconhecido.';
            }
            
            statusMessage.textContent = errorMessage;
            statusMessage.className = 'text-red-600 text-sm text-center';
            
            loginBtn.disabled = false;
            loginBtn.innerHTML = '<i data-lucide="log-in"></i> Entrar';
            lucide.createIcons();
        }
    });
</script>
```

### 3.5. Atualizar `auth.js` para usar Firebase Auth

```javascript
// auth.js - Sistema de Autenticação com Firebase
import { getAuth, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";

class AuthSystem {
    constructor() {
        this.currentUser = null;
        this.sessionKey = 'synchro_user';
        this.auth = null;
        this.init();
    }

    async init() {
        // Aguardar Firebase estar pronto
        if (typeof firebase !== 'undefined') {
            this.auth = firebase.auth();
            
            // Listener de estado de autenticação
            this.auth.onAuthStateChanged((firebaseUser) => {
                if (firebaseUser) {
                    this.loadUserSession();
                } else {
                    this.handleNoAuth();
                }
            });
        } else {
            // Fallback para verificação por sessão
            this.loadUserSession();
            this.checkAuthState();
        }
    }

    handleNoAuth() {
        const isLoginPage = window.location.pathname.includes('login.html');
        if (!isLoginPage) {
            this.logout();
        }
    }

    loadUserSession() {
        let userData = localStorage.getItem(this.sessionKey);
        
        if (!userData) {
            userData = sessionStorage.getItem(this.sessionKey);
        }
        
        if (userData) {
            try {
                this.currentUser = JSON.parse(userData);
                this.validateSession();
                this.filterTabsBasedOnPermissions();
            } catch (error) {
                console.error('Erro ao carregar sessão:', error);
                this.logout();
            }
        }
    }

    validateSession() {
        if (!this.currentUser) return false;
        
        const loginTime = new Date(this.currentUser.loginTime);
        const now = new Date();
        const hoursDiff = (now - loginTime) / (1000 * 60 * 60);
        
        const maxHours = localStorage.getItem(this.sessionKey) ? 24 : 8;
        
        if (hoursDiff > maxHours) {
            this.logout();
            return false;
        }
        
        return true;
    }

    async logout() {
        // Limpar sessão local
        localStorage.removeItem(this.sessionKey);
        sessionStorage.removeItem(this.sessionKey);
        this.currentUser = null;
        
        // Logout do Firebase
        if (this.auth) {
            try {
                await this.auth.signOut();
            } catch (error) {
                console.error('Erro ao fazer logout:', error);
            }
        }
        
        // Redirecionar
        window.location.href = 'login.html';
    }

    // ... resto dos métodos permanecem iguais
}
```

---

## 4. Fase 2: Firebase Security Rules

### 4.1. Acessar Firestore Rules

1. No Firebase Console, vá para **Firestore Database**
2. Clique na aba **Rules**

### 4.2. Aplicar as Regras de Segurança

Substitua todo o conteúdo por:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // ==========================================
    // FUNÇÕES AUXILIARES
    // ==========================================
    
    // Verificar se usuário está autenticado
    function isAuthenticated() {
      return request.auth != null;
    }
    
    // Obter dados do perfil do usuário
    function getUserData() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
    }
    
    // Verificar se é admin
    function isAdmin() {
      return isAuthenticated() && getUserData().role == 'admin';
    }
    
    // Verificar se é gestor ou admin
    function isGestorOrAdmin() {
      return isAuthenticated() && getUserData().role in ['gestor', 'admin'];
    }
    
    // Verificar se tem permissão específica
    function hasPermission(permission) {
      return isAuthenticated() && permission in getUserData().permissions;
    }
    
    // ==========================================
    // REGRAS POR COLEÇÃO
    // ==========================================
    
    // USUÁRIOS - Apenas admin pode modificar
    match /users/{userId} {
      allow read: if isAuthenticated() && (request.auth.uid == userId || isAdmin());
      allow create: if isAdmin();
      allow update: if isAdmin() || request.auth.uid == userId;
      allow delete: if isAdmin();
    }
    
    // PLANEJAMENTO
    match /planning/{docId} {
      allow read: if isAuthenticated();
      allow create: if hasPermission('planejamento');
      allow update: if hasPermission('planejamento');
      allow delete: if isGestorOrAdmin();
    }
    
    // ORDENS DE PRODUÇÃO
    match /production_orders/{docId} {
      allow read: if isAuthenticated();
      allow create: if hasPermission('planejamento');
      allow update: if hasPermission('planejamento') || hasPermission('lancamento');
      allow delete: if isGestorOrAdmin();
    }
    
    // LANÇAMENTOS DE PRODUÇÃO
    match /production_entries/{docId} {
      allow read: if isAuthenticated();
      allow create: if hasPermission('lancamento');
      allow update: if hasPermission('lancamento');
      allow delete: if isGestorOrAdmin();
    }
    
    // PARADAS (DOWNTIMES)
    match /downtimes/{docId} {
      allow read: if isAuthenticated();
      allow create: if hasPermission('lancamento');
      allow update: if hasPermission('lancamento');
      allow delete: if isGestorOrAdmin();
    }
    
    // PARADAS ATIVAS
    match /active_downtimes/{docId} {
      allow read: if isAuthenticated();
      allow create: if hasPermission('lancamento');
      allow update: if hasPermission('lancamento');
      allow delete: if hasPermission('lancamento');
    }
    
    // PERDAS (LOSSES)
    match /losses/{docId} {
      allow read: if isAuthenticated();
      allow create: if hasPermission('lancamento');
      allow update: if hasPermission('lancamento');
      allow delete: if isGestorOrAdmin();
    }
    
    // RETRABALHO
    match /rework/{docId} {
      allow read: if isAuthenticated();
      allow create: if hasPermission('lancamento');
      allow update: if hasPermission('lancamento');
      allow delete: if isGestorOrAdmin();
    }
    
    // BORRA
    match /borra/{docId} {
      allow read: if isAuthenticated();
      allow create: if hasPermission('lancamento');
      allow update: if hasPermission('lancamento');
      allow delete: if isGestorOrAdmin();
    }
    
    // QUALIDADE - Checklists
    match /quality_checklists/{docId} {
      allow read: if isAuthenticated();
      allow create: if hasPermission('lancamento');
      allow update: if hasPermission('lancamento');
      allow delete: if isAdmin();
    }
    
    // CONFIGURAÇÕES DO SISTEMA
    match /settings/{docId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }
    
    // LOGS DE AUDITORIA
    match /audit_logs/{docId} {
      allow read: if isGestorOrAdmin();
      allow create: if isAuthenticated();
      allow update, delete: if false; // Logs são imutáveis
    }
    
    // MATÉRIA PRIMA
    match /raw_materials/{docId} {
      allow read: if isAuthenticated();
      allow write: if isGestorOrAdmin();
    }
    
    // MÁQUINAS
    match /machines/{docId} {
      allow read: if isAuthenticated();
      allow write: if isGestorOrAdmin();
    }
    
    // MOTIVOS DE PARADA
    match /downtime_reasons/{docId} {
      allow read: if isAuthenticated();
      allow write: if isGestorOrAdmin();
    }
    
    // BLOQUEAR TUDO QUE NÃO FOI DEFINIDO
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

### 4.3. Publicar as Regras

1. Clique em **Publish**
2. Aguarde a confirmação "Rules published"

---

## 5. Fase 3: Restrição de API Keys

### 5.1. Acessar Google Cloud Console

1. Acesse [Google Cloud Console](https://console.cloud.google.com)
2. Selecione o projeto **hokkaido-synchro**
3. Vá para **APIs & Services > Credentials**

### 5.2. Configurar Restrições da API Key

1. Clique na API Key listada (Browser key)
2. Em **Application restrictions**, selecione **HTTP referrers (web sites)**
3. Em **Website restrictions**, adicione:

```
https://hokkaido-synchro.web.app/*
https://hokkaido-synchro.firebaseapp.com/*
https://seu-dominio-personalizado.com/*
http://localhost/*
http://127.0.0.1/*
```

4. Em **API restrictions**, selecione **Restrict key** e marque:
   - Cloud Firestore API
   - Firebase Authentication API
   - Firebase Cloud Messaging API
   - Identity Toolkit API

5. Clique em **Save**

### 5.3. Criar API Key Separada para Desenvolvimento (Opcional)

1. Clique em **Create Credentials > API Key**
2. Renomeie para "Development Key"
3. Configure restrições apenas para localhost
4. Use essa chave apenas em ambiente de desenvolvimento

---

## 6. Fase 4: Firebase App Check

### 6.1. Ativar App Check no Console

1. No Firebase Console, vá para **App Check**
2. Clique em **Get Started**
3. Selecione sua app web
4. Escolha **reCAPTCHA Enterprise** como provedor
5. Copie a **Site Key** gerada

### 6.2. Adicionar App Check no Código

Adicione no `index.html` antes do fechamento do `</head>`:

```html
<script src="https://www.google.com/recaptcha/enterprise.js?render=SUA_SITE_KEY"></script>
```

Adicione no `script.js` após a inicialização do Firebase:

```javascript
// Inicializar App Check
if (typeof firebase !== 'undefined' && firebase.appCheck) {
    const appCheck = firebase.appCheck();
    
    // Para desenvolvimento, use o debug token
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
        self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    }
    
    appCheck.activate(
        'SUA_RECAPTCHA_SITE_KEY',
        true // Permitir refresh automático do token
    );
    
    console.log('✅ Firebase App Check ativado');
}
```

### 6.3. Habilitar Enforcement

1. No Firebase Console > App Check
2. Na aba **APIs**, clique em **Firestore**
3. Clique em **Enforce**
4. Repita para **Authentication** e **Storage** (se usar)

> ⚠️ **ATENÇÃO:** Ative o enforcement apenas após testar que o App Check está funcionando corretamente!

---

## 7. Fase 5: Headers de Segurança

### 7.1. Criar/Atualizar arquivo firebase.json

Na raiz do projeto, crie ou atualize o `firebase.json`:

```json
{
  "hosting": {
    "public": ".",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**",
      "**/*.md",
      "**/package*.json"
    ],
    "headers": [
      {
        "source": "**",
        "headers": [
          {
            "key": "X-Frame-Options",
            "value": "DENY"
          },
          {
            "key": "X-Content-Type-Options",
            "value": "nosniff"
          },
          {
            "key": "X-XSS-Protection",
            "value": "1; mode=block"
          },
          {
            "key": "Referrer-Policy",
            "value": "strict-origin-when-cross-origin"
          },
          {
            "key": "Permissions-Policy",
            "value": "geolocation=(), microphone=(), camera=()"
          }
        ]
      },
      {
        "source": "**/*.@(js|css)",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "public, max-age=31536000"
          }
        ]
      },
      {
        "source": "**/*.html",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "no-cache, no-store, must-revalidate"
          },
          {
            "key": "Content-Security-Policy",
            "value": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://unpkg.com https://www.gstatic.com https://cdn.jsdelivr.net https://www.google.com https://www.googletagmanager.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https: blob:; connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.cloudfunctions.net wss://*.firebaseio.com; frame-ancestors 'none';"
          }
        ]
      }
    ],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
```

### 7.2. Deploy das Configurações

```powershell
# Inicializar Firebase no projeto (se ainda não fez)
firebase init hosting

# Deploy
firebase deploy --only hosting
```

---

## 8. Fase 6: Sanitização de Dados

### 8.1. Adicionar DOMPurify

Adicione no `index.html` antes dos outros scripts:

```html
<script src="https://cdn.jsdelivr.net/npm/dompurify@3.0.6/dist/purify.min.js"></script>
```

### 8.2. Criar Função de Sanitização

Adicione no início do `script.js`:

```javascript
// Função global para sanitizar HTML
function sanitizeHTML(dirty) {
    if (typeof DOMPurify !== 'undefined') {
        return DOMPurify.sanitize(dirty, {
            ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'span', 'br', 'p', 'div'],
            ALLOWED_ATTR: ['class', 'style']
        });
    }
    // Fallback básico se DOMPurify não estiver disponível
    const div = document.createElement('div');
    div.textContent = dirty;
    return div.innerHTML;
}

// Função para escapar HTML (quando não queremos nenhuma tag)
function escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
```

### 8.3. Atualizar Pontos Críticos

Substitua uso de `innerHTML` com dados de usuário por versões sanitizadas:

```javascript
// ❌ ANTES (inseguro)
element.innerHTML = userData.name;

// ✅ DEPOIS (seguro)
element.textContent = userData.name;
// ou
element.innerHTML = sanitizeHTML(userData.name);
```

### 8.4. Locais Prioritários para Revisar

1. `script.js` - Renderização de tabelas
2. `script.js` - Cards de máquinas
3. `script.js` - Listas de lançamentos
4. `traceability-system.js` - Modais
5. `predictive-analytics.js` - Alertas

---

## 9. Fase 7: Limpeza de Logs

### 9.1. Criar Wrapper de Console

Adicione no início do `script.js`:

```javascript
// Configuração de ambiente
const IS_PRODUCTION = window.location.hostname !== 'localhost' && 
                       window.location.hostname !== '127.0.0.1';

// Wrapper de console para produção
const logger = {
    log: (...args) => {
        if (!IS_PRODUCTION) console.log(...args);
    },
    warn: (...args) => {
        if (!IS_PRODUCTION) console.warn(...args);
    },
    error: (...args) => {
        // Erros sempre são logados
        console.error(...args);
        // Opcional: enviar para serviço de monitoramento
        // sendToMonitoring('error', args);
    },
    debug: (...args) => {
        if (!IS_PRODUCTION) console.debug(...args);
    },
    info: (...args) => {
        if (!IS_PRODUCTION) console.info(...args);
    }
};
```

### 9.2. Substituir console.log

Use buscar e substituir (Ctrl+H) no VS Code:

- Buscar: `console.log(`
- Substituir por: `logger.log(`

Repita para `console.warn`, `console.debug`, `console.info`.

> **Nota:** Mantenha `console.error` para erros críticos ou substitua por `logger.error`.

---

## 10. Checklist Final

### Pré-Deploy
- [ ] Firebase Authentication configurado
- [ ] Usuários criados no Firebase Auth
- [ ] Coleção `users` populada com perfis
- [ ] Security Rules aplicadas e publicadas
- [ ] API Key restrita no Google Cloud Console
- [ ] App Check configurado (opcional inicialmente)
- [ ] firebase.json com headers de segurança
- [ ] DOMPurify adicionado
- [ ] Funções de sanitização implementadas
- [ ] Console.logs substituídos por logger

### Testes Pré-Produção
- [ ] Login funciona com Firebase Auth
- [ ] Logout funciona corretamente
- [ ] Sessão expira após tempo configurado
- [ ] Usuário sem permissão não acessa abas restritas
- [ ] Security Rules bloqueiam acesso não autorizado
- [ ] Headers de segurança estão presentes (verificar com DevTools > Network)
- [ ] Dados são sanitizados corretamente

### Pós-Deploy
- [ ] Verificar todos os usuários conseguem logar
- [ ] Testar todas as funcionalidades principais
- [ ] Monitorar console do Firebase para erros
- [ ] Verificar App Check (se ativado)
- [ ] Documentar credenciais de admin em local seguro

---

## 📞 Suporte

Em caso de problemas durante a implementação:

1. **Firebase:** [Documentação Oficial](https://firebase.google.com/docs)
2. **Security Rules:** [Guia de Regras](https://firebase.google.com/docs/firestore/security/get-started)
3. **App Check:** [Documentação App Check](https://firebase.google.com/docs/app-check)

---

## 📝 Histórico de Versões

| Versão | Data | Alterações |
|--------|------|------------|
| 1.0 | 01/12/2025 | Documento inicial |

---

**Documento gerado automaticamente pelo sistema de análise de segurança.**
