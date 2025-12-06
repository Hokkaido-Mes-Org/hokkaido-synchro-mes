# 🔒 Guia de Segurança Firebase - Synchro MES

## Visão Geral

Este guia explica como proteger suas credenciais do Firebase usando:
1. **Firebase App Check** - Verifica se requisições vêm do seu domínio
2. **Regras de Segurança do Firestore** - Controla quem pode ler/escrever dados
3. **Restrição de API Key** - Limita uso da chave apenas ao seu domínio

---

## 📋 Pré-requisitos

- Acesso ao [Firebase Console](https://console.firebase.google.com/)
- Acesso ao [Google Cloud Console](https://console.cloud.google.com/)
- Projeto Firebase: `hokkaido-synchro`

---

## Parte 1: Restringir a API Key no Google Cloud Console

### Passo 1.1 - Acessar o Google Cloud Console

1. Acesse: https://console.cloud.google.com/
2. No canto superior esquerdo, selecione o projeto **hokkaido-synchro**

### Passo 1.2 - Navegar até APIs e Serviços

1. No menu lateral esquerdo, clique em **APIs e Serviços**
2. Clique em **Credenciais**

### Passo 1.3 - Editar a API Key

1. Na lista de **Chaves de API**, localize a chave que começa com `AIzaSyB1YrMK07...`
2. Clique no nome da chave para editar

### Passo 1.4 - Adicionar Restrições de Aplicativo

1. Em **Restrições de aplicativo**, selecione **Referenciadores HTTP (sites)**
2. Clique em **Adicionar um item**
3. Adicione os domínios permitidos:

```
https://seu-dominio.com/*
https://www.seu-dominio.com/*
http://localhost:*/*
http://127.0.0.1:*/*
```

> ⚠️ **Substitua `seu-dominio.com` pelo domínio real onde o Synchro está hospedado**

### Passo 1.5 - Restringir APIs

1. Em **Restrições de API**, selecione **Restringir chave**
2. Marque apenas as APIs necessárias:
   - ✅ Cloud Firestore API
   - ✅ Firebase Authentication API (se usar)
   - ✅ Identity Toolkit API
   - ✅ Token Service API

3. Clique em **Salvar**

### ✅ Resultado
A API Key só funcionará quando chamada do seu domínio. Tentativas de outros sites falharão.

---

## Parte 2: Configurar Regras de Segurança do Firestore

### Passo 2.1 - Acessar o Firebase Console

1. Acesse: https://console.firebase.google.com/
2. Selecione o projeto **hokkaido-synchro**

### Passo 2.2 - Navegar até Firestore

1. No menu lateral, clique em **Firestore Database**
2. Clique na aba **Regras**

### Passo 2.3 - Configurar Regras de Segurança

Substitua as regras atuais por estas:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Função auxiliar para verificar autenticação
    function isAuthenticated() {
      return request.auth != null;
    }
    
    // Função para verificar se é usuário autorizado
    function isAuthorizedUser() {
      return isAuthenticated() && 
             request.auth.token.email.matches('.*@hokkaido[.]com');
    }
    
    // ========================================
    // COLEÇÃO: planning (Planejamento)
    // ========================================
    match /planning/{document=**} {
      // Leitura: usuários autenticados
      allow read: if isAuthenticated();
      // Escrita: apenas usuários do domínio hokkaido
      allow write: if isAuthorizedUser();
    }
    
    // ========================================
    // COLEÇÃO: production_entries (Produção)
    // ========================================
    match /production_entries/{document=**} {
      allow read: if isAuthenticated();
      allow write: if isAuthorizedUser();
    }
    
    // ========================================
    // COLEÇÃO: downtime_entries (Paradas)
    // ========================================
    match /downtime_entries/{document=**} {
      allow read: if isAuthenticated();
      allow write: if isAuthorizedUser();
    }
    
    // ========================================
    // COLEÇÃO: extended_downtime_logs (Paradas Estendidas)
    // ========================================
    match /extended_downtime_logs/{document=**} {
      allow read: if isAuthenticated();
      allow write: if isAuthorizedUser();
    }
    
    // ========================================
    // COLEÇÃO: users (Usuários)
    // ========================================
    match /users/{userId} {
      // Usuário só pode ler/escrever seu próprio documento
      allow read: if isAuthenticated() && request.auth.uid == userId;
      allow write: if isAuthenticated() && request.auth.uid == userId;
    }
    
    // ========================================
    // COLEÇÃO: machine_status (Status das Máquinas)
    // ========================================
    match /machine_status/{document=**} {
      allow read: if isAuthenticated();
      allow write: if isAuthorizedUser();
    }
    
    // ========================================
    // REGRA PADRÃO: Negar tudo que não foi especificado
    // ========================================
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

### Passo 2.4 - Publicar as Regras

1. Clique no botão **Publicar**
2. Aguarde a confirmação de que as regras foram atualizadas

### ✅ Resultado
- Apenas usuários autenticados podem ler dados
- Apenas usuários com email `@hokkaido.com` podem escrever
- Usuários anônimos não têm acesso

---

## Parte 3: Ativar Firebase App Check

### Passo 3.1 - Acessar App Check

1. No Firebase Console, vá para **App Check** (menu lateral)
2. Ou acesse: https://console.firebase.google.com/project/hokkaido-synchro/appcheck

### Passo 3.2 - Registrar o App Web

1. Clique em **Apps** na aba superior
2. Localize seu app web e clique nele
3. Se não existir, clique em **Registrar** e selecione **Web**

### Passo 3.3 - Escolher Provedor de Atestado

Para aplicações web, use **reCAPTCHA Enterprise**:

1. Clique em **reCAPTCHA Enterprise**
2. Você será direcionado ao Google Cloud Console
3. Crie uma nova chave reCAPTCHA:
   - **Tipo**: Website
   - **Domínios**: Adicione seu domínio (ex: `seu-dominio.com`)
4. Copie a **Site Key** gerada

### Passo 3.4 - Configurar no Firebase Console

1. Volte ao Firebase Console > App Check
2. Cole a **Site Key** do reCAPTCHA
3. Clique em **Salvar**

### Passo 3.5 - Adicionar App Check no Código

Adicione este código após a inicialização do Firebase em cada arquivo:

```javascript
// Após: firebase.initializeApp(firebaseConfig);

// Inicializar App Check
const appCheck = firebase.appCheck();
appCheck.activate(
    'SUA_RECAPTCHA_SITE_KEY', // Substitua pela sua Site Key
    true // Define se o token é atualizado automaticamente
);
```

### Passo 3.6 - Ativar Enforcement

> ⚠️ **IMPORTANTE**: Só faça isso APÓS testar que tudo funciona!

1. No Firebase Console > App Check
2. Vá para a aba **APIs**
3. Para cada serviço (Firestore, Authentication, etc.):
   - Clique nos 3 pontos (⋮)
   - Selecione **Enforce**

### ✅ Resultado
Apenas requisições do seu app (com token válido) serão aceitas.

---

## Parte 4: Monitoramento e Verificação

### 4.1 - Verificar Restrições da API Key

1. Abra o DevTools (F12) no navegador
2. Vá para a aba **Network**
3. Faça uma ação no Synchro que use Firebase
4. Verifique se as requisições estão funcionando

### 4.2 - Testar Regras do Firestore

1. No Firebase Console > Firestore > Regras
2. Clique em **Rules Playground**
3. Simule requisições para testar as regras:
   - Teste leitura como usuário autenticado ✅
   - Teste leitura como usuário anônimo ❌
   - Teste escrita como usuário `@hokkaido.com` ✅
   - Teste escrita como usuário externo ❌

### 4.3 - Monitorar App Check

1. No Firebase Console > App Check
2. Vá para a aba **Metrics**
3. Monitore:
   - Requisições verificadas ✅
   - Requisições não verificadas ⚠️
   - Requisições bloqueadas ❌

---

## 📊 Resumo das Proteções

| Camada | Proteção | Status |
|--------|----------|--------|
| API Key | Restrita ao domínio | 🔲 Pendente |
| Firestore | Regras de segurança | 🔲 Pendente |
| App Check | Verificação de app | 🔲 Pendente |

---

## 🚨 Checklist Final

- [ ] API Key restrita no Google Cloud Console
- [ ] Domínios permitidos configurados
- [ ] Regras de segurança do Firestore publicadas
- [ ] Regras testadas no Rules Playground
- [ ] App Check ativado (reCAPTCHA Enterprise)
- [ ] App Check integrado no código
- [ ] Enforcement ativado (após testes)
- [ ] Monitoramento configurado

---

## ❓ FAQ - Perguntas Frequentes

### "As credenciais ainda aparecem no código. Isso é seguro?"

**Sim, com as proteções acima.** As credenciais do Firebase são projetadas para serem públicas. A segurança real vem das:
- Regras de segurança do Firestore
- Restrições de domínio na API Key
- App Check

### "E se alguém copiar minha API Key?"

Com as restrições de domínio, a chave só funciona quando chamada do seu site. Se alguém tentar usar de outro lugar, receberá erro de "Referer não permitido".

### "Preciso fazer as 3 partes?"

**Recomendado:** Sim, cada camada adiciona segurança:
- **Mínimo:** Regras de segurança do Firestore (Parte 2)
- **Recomendado:** + Restrição de API Key (Parte 1)
- **Ideal:** + App Check (Parte 3)

### "O que acontece se eu ativar Enforcement muito cedo?"

Usuários podem perder acesso se o App Check não estiver configurado corretamente. Sempre teste primeiro!

---

## 📞 Suporte

Em caso de problemas:
1. Verifique os logs no Firebase Console
2. Use o Rules Playground para debugar regras
3. Confira o console do navegador para erros de API

---

*Documento criado em: 5 de dezembro de 2025*
*Versão: 1.0*
