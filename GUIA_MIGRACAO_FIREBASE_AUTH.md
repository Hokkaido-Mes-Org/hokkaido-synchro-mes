# 🔐 Guia de Migração para Firebase Authentication

## Visão Geral

Este guia migra o sistema de autenticação local (login.html) para **Firebase Authentication**, permitindo usar as regras de segurança do Firestore de forma completa.

**Data:** 6 de dezembro de 2025  
**Projeto:** hokkaido-synchro

---

## 📋 Índice

1. [Passo 1: Ativar Firebase Auth no Console](#passo-1-ativar-firebase-auth-no-console)
2. [Passo 2: Criar Usuários no Firebase](#passo-2-criar-usuários-no-firebase)
3. [Passo 3: Atualizar o Código](#passo-3-atualizar-o-código)
4. [Passo 4: Aplicar Regras de Segurança](#passo-4-aplicar-regras-de-segurança)
5. [Lista Completa de Usuários](#lista-completa-de-usuários)

---

## Passo 1: Ativar Firebase Auth no Console

### 1.1 Acessar Firebase Console
1. Acesse: https://console.firebase.google.com/
2. Selecione o projeto **hokkaido-synchro**

### 1.2 Ativar Autenticação por Email/Senha
1. No menu lateral, clique em **Authentication**
2. Clique na aba **Sign-in method**
3. Clique em **Email/Senha**
4. **Ative** a opção "Email/Senha"
5. Clique em **Salvar**

---

## Passo 2: Criar Usuários no Firebase

### 2.1 Adicionar Usuários Manualmente
1. No Firebase Console, vá em **Authentication**
2. Clique na aba **Users**
3. Clique em **Adicionar usuário**
4. Para cada usuário, use:
   - **Email:** `usuario@hokkaido.synchro` (ex: `admin@hokkaido.synchro`)
   - **Senha:** A senha atual do usuário

### 2.2 Lista de Usuários para Criar

#### 👤 ADMINISTRADORES/SUPORTE (role: suporte)
| Email | Senha | Nome |
|-------|-------|------|
| raphael.moreira@hokkaido.synchro | Raphael2025! | Raphael Moreira |
| roberto.fernandes@hokkaido.synchro | Roberto2025! | Roberto Fernandes |
| daniella.braganca@hokkaido.synchro | Daniella2025! | Daniella Bragança |
| michelle.benjamin@hokkaido.synchro | Michelle2025! | Michelle Benjamin |
| luciano@hokkaido.synchro | Luciano2025! | Luciano |
| marilise.katia@hokkaido.synchro | Marilise2025! | Marilise Katia |
| davi.batista@hokkaido.synchro | Davi2025! | Davi Batista |
| cleidiana@hokkaido.synchro | Cleidiana2025! | Cleidiana |
| aline.guedes@hokkaido.synchro | Aline2025! | Aline Guedes |

#### 👔 GESTORES (role: gestor)
| Email | Senha | Nome |
|-------|-------|------|
| gestor@hokkaido.synchro | gestor123 | Gestor de Produção |
| supervisor@hokkaido.synchro | sup123 | Supervisor |
| erika.muta@hokkaido.synchro | Erika2025! | Erika Muta |
| leandro.camargo@hokkaido.synchro | Leandro2025! | Leandro Camargo |
| tiago.oliveira@hokkaido.synchro | Tiago2025! | Tiago Oliveira |
| werigue@hokkaido.synchro | Werigue2025! | Werigue |
| daniel.rocha@hokkaido.synchro | Daniel2025! | Daniel Rocha |
| leonardo.doria@hokkaido.synchro | Leonardo2025! | Leonardo Dória |
| thiago.alberigi@hokkaido.synchro | Thiago2025! | Thiago Alberigi |
| vania@hokkaido.synchro | Vania2025! | Vânia |
| silvio.piazera@hokkaido.synchro | Silvio2025! | Sílvio Piazera |
| diego.goto@hokkaido.synchro | Diego2025! | Diego Goto |
| joao.silva@hokkaido.synchro | Joao2025! | João Silva |

#### 🔧 OPERADORES (role: operador)
| Email | Senha | Nome |
|-------|-------|------|
| admin@hokkaido.synchro | admin123 | Administrador |
| operador@hokkaido.synchro | op123 | Operador de Produção |
| alexandre.de.paula@hokkaido.synchro | Alexandre2025! | Alexandre de Paula |
| felipe.rafael@hokkaido.synchro | Felipe2025! | Felipe Rafael |
| fernando.monteiro@hokkaido.synchro | Fernando2025! | Fernando Monteiro |
| gabriel.santos@hokkaido.synchro | Gabriel2025! | Gabriel Santos |
| guilherme.muniz@hokkaido.synchro | Guilherme2025! | Guilherme Muniz |
| maiara.camargo@hokkaido.synchro | Maiara2025! | Maiara Camargo |
| noely.lima@hokkaido.synchro | Noely2025! | Noely Lima |
| polyne.fernandes@hokkaido.synchro | Polyne2025! | Polyne Fernandes |
| regina.de.fatima@hokkaido.synchro | Regina2025! | Regina de Fatima |
| rodrigo.valin@hokkaido.synchro | Rodrigo2025! | Rodrigo Valin |
| sebastiao.marcio@hokkaido.synchro | Sebastião2025! | Sebastião Márcio |
| viviane.souza@hokkaido.synchro | Viviane2025! | Viviane Souza |
| willian.andrade@hokkaido.synchro | Willian2025! | Willian Andrade |
| angelina.magalhaes@hokkaido.synchro | Angelina2025! | Angelina Magalhaes |
| jose.otavio@hokkaido.synchro | Jose2025! | Jose Otavio |
| maria.barbosa@hokkaido.synchro | Maria2025! | Maria Barbosa |
| isalem.evandro@hokkaido.synchro | Isalem2025! | Isalem Evandro |
| ronaldo.santos@hokkaido.synchro | Ronaldo2025! | Ronaldo Santos |
| aislan.everton@hokkaido.synchro | Aislan2025! | Aislan Everton |
| ademir.de.almeida@hokkaido.synchro | Ademir2025! | Ademir de Almeida |
| daniel.lisboa@hokkaido.synchro | Daniel2025! | Daniel Lisboa |
| matheus.algusto@hokkaido.synchro | Matheus2025! | Matheus Algusto |
| stanley.eduardo@hokkaido.synchro | Stanley2025! | Stanley Eduardo |
| renata.rocha@hokkaido.synchro | Renata2025! | Renata Rocha |
| daniel.de.paula@hokkaido.synchro | Daniel2025! | Daniel de Paula |
| eloi.siqueira@hokkaido.synchro | Eloi2025! | Eloi Siqueira |
| glaucia.lisboa@hokkaido.synchro | Glaucia2025! | Glaucia Lisboa |
| jeosmar.massoni@hokkaido.synchro | Jeosmar2025! | Jeosmar Massoni |
| josue.carvalho@hokkaido.synchro | Josue2025! | Josué Carvalho |
| matheus.ventura@hokkaido.synchro | Matheus2025! | Matheus Ventura |
| silvia.aparecida@hokkaido.synchro | Silvia2025! | Silvia Aparecida |
| rafael.shimada@hokkaido.synchro | Rafael2025! | Rafael Shimada |

---

## Passo 3: Atualizar o Código

### 3.1 Atualizar login.html

Substitua o sistema de login local pelo Firebase Auth. Adicione este código no `login.html`:

```html
<!-- Adicionar após os outros scripts do Firebase -->
<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js"></script>

<script>
    // Firebase já deve estar inicializado
    const auth = firebase.auth();
    
    // Mapeamento de usuários para roles e permissões (dados no Firestore)
    async function getUserData(email) {
        const doc = await firebase.firestore().collection('users_config').doc(email).get();
        if (doc.exists) {
            return doc.data();
        }
        // Dados padrão se não encontrar
        return {
            role: 'operador',
            name: email.split('@')[0],
            permissions: ['planejamento', 'lancamento', 'analise']
        };
    }

    // Handler do formulário de login
    document.getElementById('login-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;
        const rememberMe = document.getElementById('remember-me').checked;
        
        // Construir email
        const email = username.includes('@') ? username : `${username}@hokkaido.synchro`;
        
        const loginBtn = document.getElementById('login-btn');
        const loadingBtn = document.getElementById('login-loading');
        const errorDiv = document.getElementById('login-error');
        
        // Mostrar loading
        loginBtn.classList.add('hidden');
        loadingBtn.classList.remove('hidden');
        errorDiv.classList.add('hidden');
        
        try {
            // Login com Firebase Auth
            const userCredential = await auth.signInWithEmailAndPassword(email, password);
            const firebaseUser = userCredential.user;
            
            // Buscar dados adicionais do usuário
            const userData = await getUserData(email);
            
            // Criar objeto de sessão (compatível com sistema atual)
            const sessionUser = {
                id: firebaseUser.uid,
                username: username,
                email: firebaseUser.email,
                name: userData.name || username,
                role: userData.role || 'operador',
                permissions: userData.permissions || ['planejamento', 'lancamento', 'analise'],
                loginTime: new Date().toISOString(),
                firebaseAuth: true
            };
            
            // Salvar sessão
            const storage = rememberMe ? localStorage : sessionStorage;
            storage.setItem('synchro_user', JSON.stringify(sessionUser));
            
            console.log('✅ Login Firebase bem-sucedido:', sessionUser);
            
            // Redirecionar
            window.location.href = 'index.html';
            
        } catch (error) {
            console.error('❌ Erro no login:', error);
            
            // Mostrar erro
            loadingBtn.classList.add('hidden');
            loginBtn.classList.remove('hidden');
            errorDiv.classList.remove('hidden');
            
            let errorMessage = 'Usuário ou senha incorretos';
            if (error.code === 'auth/user-not-found') {
                errorMessage = 'Usuário não encontrado';
            } else if (error.code === 'auth/wrong-password') {
                errorMessage = 'Senha incorreta';
            } else if (error.code === 'auth/too-many-requests') {
                errorMessage = 'Muitas tentativas. Tente novamente em alguns minutos.';
            }
            
            document.getElementById('error-message').textContent = errorMessage;
        }
    });
    
    // Verificar se já está logado
    auth.onAuthStateChanged((user) => {
        if (user) {
            // Verificar se tem sessão local também
            const session = localStorage.getItem('synchro_user') || sessionStorage.getItem('synchro_user');
            if (session) {
                console.log('✅ Usuário já autenticado, redirecionando...');
                window.location.href = 'index.html';
            }
        }
    });
</script>
```

### 3.2 Atualizar auth.js para suportar Firebase Auth

Adicione verificação do Firebase Auth no logout:

```javascript
// No método logout() do auth.js, adicionar:
logout() {
    // Logout do Firebase Auth se estiver usando
    if (typeof firebase !== 'undefined' && firebase.auth) {
        firebase.auth().signOut().catch(err => console.warn('Erro ao fazer logout do Firebase:', err));
    }
    
    // Limpar sessão local
    localStorage.removeItem(this.sessionKey);
    sessionStorage.removeItem(this.sessionKey);
    this.currentUser = null;
    this.redirectToLogin();
}
```

---

## Passo 4: Aplicar Regras de Segurança

Agora que você tem Firebase Auth, pode usar as regras seguras. Vá em **Firestore Database > Regras** e cole:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Verifica se está autenticado
    function isAuthenticated() {
      return request.auth != null;
    }
    
    // Verifica se é do domínio hokkaido.synchro
    function isHokkaidoUser() {
      return isAuthenticated() && 
             request.auth.token.email.matches('.*@hokkaido[.]synchro');
    }
    
    // Admins/Suporte (podem deletar)
    function isAdmin() {
      let adminEmails = [
        'raphael.moreira@hokkaido.synchro',
        'roberto.fernandes@hokkaido.synchro',
        'daniella.braganca@hokkaido.synchro',
        'michelle.benjamin@hokkaido.synchro',
        'luciano@hokkaido.synchro',
        'marilise.katia@hokkaido.synchro',
        'davi.batista@hokkaido.synchro',
        'cleidiana@hokkaido.synchro',
        'aline.guedes@hokkaido.synchro'
      ];
      return isAuthenticated() && request.auth.token.email in adminEmails;
    }
    
    // ============================================
    // COLEÇÕES DE PRODUÇÃO
    // ============================================
    
    match /planning/{docId} {
      allow read: if isAuthenticated();
      allow create, update: if isHokkaidoUser();
      allow delete: if isAdmin();
    }
    
    match /production_entries/{docId} {
      allow read: if isAuthenticated();
      allow create, update: if isHokkaidoUser();
      allow delete: if isAdmin();
    }
    
    match /downtime_entries/{docId} {
      allow read: if isAuthenticated();
      allow create, update: if isHokkaidoUser();
      allow delete: if isAdmin();
    }
    
    match /extended_downtime_logs/{docId} {
      allow read: if isAuthenticated();
      allow create, update: if isHokkaidoUser();
      allow delete: if isAdmin();
    }
    
    match /active_downtimes/{docId} {
      allow read: if isAuthenticated();
      allow write: if isHokkaidoUser();
    }
    
    match /machine_status/{docId} {
      allow read: if isAuthenticated();
      allow write: if isHokkaidoUser();
    }
    
    match /losses_entries/{docId} {
      allow read: if isAuthenticated();
      allow create, update: if isHokkaidoUser();
      allow delete: if isAdmin();
    }
    
    match /production_orders/{docId} {
      allow read: if isAuthenticated();
      allow write: if isHokkaidoUser();
    }
    
    // ============================================
    // CONFIGURAÇÃO DE USUÁRIOS
    // ============================================
    
    match /users_config/{email} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }
    
    // ============================================
    // LOGS DO SISTEMA
    // ============================================
    
    match /system_logs/{docId} {
      allow read: if isAdmin();
      allow create: if isHokkaidoUser();
      allow update, delete: if false;
    }
    
    // ============================================
    // NEGAR TUDO MAIS
    // ============================================
    
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

---

## Passo 5: Criar Coleção users_config no Firestore

Para armazenar roles e permissões, crie documentos na coleção `users_config`:

### Exemplo de documento:
**Coleção:** `users_config`  
**Documento ID:** `michelle.benjamin@hokkaido.synchro`

```json
{
  "name": "Michelle Benjamin",
  "role": "suporte",
  "permissions": [
    "planejamento",
    "lancamento", 
    "analise",
    "lançamento_manual_producao",
    "lançamento_manual_perdas",
    "qualidade",
    "ajustes",
    "relatorios",
    "admin"
  ]
}
```

---

## 📋 Checklist de Migração

- [ ] Ativar Email/Senha no Firebase Authentication
- [ ] Criar todos os usuários no Firebase Auth
- [ ] Criar coleção `users_config` com roles/permissões
- [ ] Atualizar `login.html` com código Firebase Auth
- [ ] Atualizar `auth.js` com logout do Firebase
- [ ] Aplicar novas regras de segurança no Firestore
- [ ] Testar login com um usuário
- [ ] Testar permissões (criar, editar, deletar)

---

## ⚠️ Importante

1. **Backup:** Faça backup dos dados antes de migrar
2. **Teste:** Teste em ambiente de desenvolvimento primeiro
3. **Gradual:** Pode manter o sistema antigo funcionando em paralelo durante testes
4. **Senhas:** Os usuários poderão usar "Esqueci minha senha" após migração

---

## 🆘 Rollback (Se precisar voltar)

Se algo der errado, basta:
1. Remover o código Firebase Auth do `login.html`
2. Voltar as regras do Firestore para `allow read, write: if true;`
3. O sistema voltará a funcionar como antes

---

*Guia criado em 6 de dezembro de 2025*
