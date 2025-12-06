# 🔒 Guia de Segurança Firebase - Synchro MES

## Visão Geral

Este guia explica como proteger seu projeto Firebase usando **apenas o Firebase Console** (sem necessidade do Google Cloud Console).

**Projeto:** hokkaido-synchro  
**Plano:** Blaze (Pay as you go)

---

## 📋 Índice

1. [Regras de Segurança do Firestore](#parte-1-regras-de-segurança-do-firestore)
2. [Firebase App Check](#parte-2-firebase-app-check)
3. [Configuração de Autenticação](#parte-3-configuração-de-autenticação)
4. [Regras do Firebase Storage](#parte-4-regras-do-firebase-storage)
5. [Monitoramento e Alertas](#parte-5-monitoramento-e-alertas)
6. [Backup e Recuperação de Dados](#parte-6-backup-e-recuperação-de-dados)
7. [Checklist Final](#checklist-final)
8. [Resumo Executivo para Diretoria](#resumo-executivo-para-diretoria)

---

## Parte 1: Regras de Segurança do Firestore

As regras de segurança do Firestore são a **proteção mais importante** do seu banco de dados. Elas controlam quem pode ler e escrever dados.

### Passo 1.1 - Acessar o Firebase Console

1. Acesse: https://console.firebase.google.com/
2. Faça login com sua conta Google
3. Selecione o projeto **hokkaido-synchro**

### Passo 1.2 - Navegar até Firestore

1. No menu lateral esquerdo, clique em **Firestore Database**
2. Clique na aba **Regras** (Rules)

### Passo 1.3 - Copiar e Colar as Regras

Substitua TODO o conteúdo atual pelas regras abaixo:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // ============================================
    // FUNÇÕES AUXILIARES DE SEGURANÇA
    // ============================================
    
    // Verifica se o usuário está autenticado
    function isAuthenticated() {
      return request.auth != null;
    }
    
    // Verifica se o email é do domínio hokkaido
    function isHokkaidoUser() {
      return isAuthenticated() && 
             request.auth.token.email.matches('.*@hokkaido[.]com');
    }
    
    // Verifica se é um email específico autorizado
    function isAuthorizedEmail() {
      let authorizedEmails = [
        'leandro.camargo@hokkaido.com',
        'tiago.oliveira@hokkaido.com',
        'michelle.benjamin@hokkaido.com',
        'vitor.admin@hokkaido.com'
      ];
      return isAuthenticated() && 
             request.auth.token.email in authorizedEmails;
    }
    
    // ============================================
    // COLEÇÃO: planning (Planejamento de Produção)
    // ============================================
    match /planning/{docId} {
      // Leitura: qualquer usuário autenticado
      allow read: if isAuthenticated();
      
      // Criar: usuários do domínio hokkaido
      allow create: if isHokkaidoUser();
      
      // Atualizar: usuários do domínio hokkaido
      allow update: if isHokkaidoUser();
      
      // Deletar: apenas emails autorizados específicos
      allow delete: if isAuthorizedEmail();
    }
    
    // ============================================
    // COLEÇÃO: production_entries (Lançamentos de Produção)
    // ============================================
    match /production_entries/{docId} {
      allow read: if isAuthenticated();
      allow create: if isHokkaidoUser();
      allow update: if isHokkaidoUser();
      allow delete: if isAuthorizedEmail();
    }
    
    // ============================================
    // COLEÇÃO: downtime_entries (Paradas de Máquina)
    // ============================================
    match /downtime_entries/{docId} {
      allow read: if isAuthenticated();
      allow create: if isHokkaidoUser();
      allow update: if isHokkaidoUser();
      allow delete: if isAuthorizedEmail();
    }
    
    // ============================================
    // COLEÇÃO: extended_downtime_logs (Paradas Estendidas)
    // ============================================
    match /extended_downtime_logs/{docId} {
      allow read: if isAuthenticated();
      allow create: if isHokkaidoUser();
      allow update: if isHokkaidoUser();
      allow delete: if isAuthorizedEmail();
    }
    
    // ============================================
    // COLEÇÃO: active_downtimes (Paradas Ativas)
    // ============================================
    match /active_downtimes/{docId} {
      allow read: if isAuthenticated();
      allow write: if isHokkaidoUser();
    }
    
    // ============================================
    // COLEÇÃO: machine_status (Status das Máquinas)
    // ============================================
    match /machine_status/{docId} {
      allow read: if isAuthenticated();
      allow write: if isHokkaidoUser();
    }
    
    // ============================================
    // COLEÇÃO: losses_entries (Refugos/Perdas)
    // ============================================
    match /losses_entries/{docId} {
      allow read: if isAuthenticated();
      allow create: if isHokkaidoUser();
      allow update: if isHokkaidoUser();
      allow delete: if isAuthorizedEmail();
    }
    
    // ============================================
    // COLEÇÃO: production_orders (Ordens de Produção)
    // ============================================
    match /production_orders/{docId} {
      allow read: if isAuthenticated();
      allow write: if isHokkaidoUser();
    }
    
    // ============================================
    // COLEÇÃO: users (Dados de Usuários)
    // ============================================
    match /users/{userId} {
      // Usuário pode ler/escrever apenas seus próprios dados
      allow read: if isAuthenticated() && request.auth.uid == userId;
      allow write: if isAuthenticated() && request.auth.uid == userId;
    }
    
    // ============================================
    // COLEÇÃO: system_logs (Logs do Sistema)
    // ============================================
    match /system_logs/{docId} {
      allow read: if isAuthorizedEmail();
      allow create: if isHokkaidoUser();
      allow update, delete: if false; // Logs são imutáveis
    }
    
    // ============================================
    // REGRA PADRÃO: NEGAR TUDO NÃO ESPECIFICADO
    // ============================================
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

### Passo 1.4 - Publicar as Regras

1. Revise as regras para garantir que estão corretas
2. Clique no botão **Publicar** (Publish)
3. Aguarde a mensagem "Regras publicadas com sucesso"

### Passo 1.5 - Testar as Regras (Opcional)

1. Ainda na aba Regras, clique em **Rules Playground**
2. Configure um teste:
   - **Simulation type:** get (para leitura)
   - **Location:** planning/teste123
   - **Authenticated:** Sim
   - **Provider:** google.com
   - **Firebase UID:** qualquer valor
3. Clique em **Run** e verifique se o acesso é permitido/negado conforme esperado

### ✅ Resultado da Parte 1
- Apenas usuários autenticados podem ler dados
- Apenas usuários @hokkaido.com podem criar/editar dados
- Apenas emails específicos podem deletar dados
- Usuários anônimos não têm acesso a nada

---

## Parte 2: Firebase App Check

O App Check verifica se as requisições vêm realmente do seu aplicativo, bloqueando scripts maliciosos e robôs.

### Passo 2.1 - Acessar App Check

1. No Firebase Console, no menu lateral, clique em **App Check**
2. Ou acesse: https://console.firebase.google.com/project/hokkaido-synchro/appcheck

### Passo 2.2 - Registrar seu App Web

1. Na aba **Apps**, localize seu aplicativo web
2. Se não aparecer, clique em **Registrar** e selecione a plataforma **Web**

### Passo 2.3 - Configurar reCAPTCHA v3

1. Clique no seu app web na lista
2. Selecione **reCAPTCHA v3** como provedor de atestado
3. O Firebase vai gerar automaticamente uma **Site Key**
4. **COPIE esta Site Key** - você vai precisar dela no código

### Passo 2.4 - Adicionar App Check no Código

Abra os arquivos `script.js`, `dashboard-tv.html` e `acompanhamento-turno.html`.

**Adicione este código APÓS a linha `firebase.initializeApp(firebaseConfig);`:**

```javascript
// ========== APP CHECK - PROTEÇÃO CONTRA BOTS ==========
if (typeof firebase.appCheck === 'function') {
    const appCheck = firebase.appCheck();
    appCheck.activate(
        'COLE_SUA_RECAPTCHA_SITE_KEY_AQUI', // Substitua pela Site Key do passo 2.3
        true // Atualização automática de token
    );
    console.log('[SEGURANÇA] App Check ativado');
}
```

### Passo 2.5 - Ativar Enforcement (IMPORTANTE: Só após testar!)

> ⚠️ **ATENÇÃO:** Só ative o Enforcement depois de testar que tudo funciona!

1. No Firebase Console > App Check > aba **APIs**
2. Você verá uma lista de serviços (Cloud Firestore, etc.)
3. Para cada serviço que deseja proteger:
   - Clique nos 3 pontos (⋮) ao lado do serviço
   - Selecione **Enforce**
4. Aguarde alguns minutos para propagar

### Passo 2.6 - Monitorar App Check

1. Vá para App Check > aba **Metrics**
2. Monitore:
   - 🟢 **Verified requests:** Requisições válidas do seu app
   - 🟡 **Unverified requests:** Requisições sem token (antes do enforcement)
   - 🔴 **Blocked requests:** Requisições bloqueadas (após enforcement)

### ✅ Resultado da Parte 2
- Requisições de scripts/robôs externos são bloqueadas
- Apenas seu aplicativo real pode acessar o Firebase
- Proteção contra abuso de API

---

## Parte 3: Configuração de Autenticação

### Passo 3.1 - Acessar Authentication

1. No Firebase Console, clique em **Authentication** no menu lateral
2. Vá para a aba **Sign-in method**

### Passo 3.2 - Revisar Provedores de Login

Verifique quais provedores estão ativados:

| Provedor | Recomendação |
|----------|--------------|
| E-mail/senha | ✅ Manter ativado |
| Google | ✅ Manter ativado |
| Anônimo | ❌ **DESATIVAR** |
| Facebook | ⚠️ Só se necessário |
| Twitter | ⚠️ Só se necessário |

### Passo 3.3 - Desativar Login Anônimo (IMPORTANTE)

1. Na lista de provedores, localize **Anonymous**
2. Se estiver **Enabled**, clique nele
3. Desative o toggle e clique em **Salvar**

### Passo 3.4 - Configurar Domínios Autorizados

1. Vá para a aba **Settings** (Configurações)
2. Role até **Authorized domains**
3. Verifique se apenas seus domínios estão listados:
   - `localhost` (para desenvolvimento)
   - `hokkaido-synchro.web.app` (se usar Firebase Hosting)
   - `hokkaido-synchro.firebaseapp.com`
   - Seu domínio personalizado (se tiver)

4. **Remova** domínios desconhecidos ou não utilizados

### Passo 3.5 - Verificar Usuários

1. Vá para a aba **Users**
2. Revise a lista de usuários cadastrados
3. **Delete** contas não reconhecidas ou de teste

### ✅ Resultado da Parte 3
- Apenas métodos de login seguros estão ativos
- Login anônimo desativado
- Apenas domínios autorizados podem usar autenticação

---

## Parte 4: Regras do Firebase Storage

Se você usa o Firebase Storage para armazenar arquivos:

### Passo 4.1 - Acessar Storage

1. No Firebase Console, clique em **Storage** no menu lateral
2. Vá para a aba **Rules**

### Passo 4.2 - Configurar Regras de Segurança

Substitua as regras existentes por:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    
    // Função para verificar autenticação
    function isAuthenticated() {
      return request.auth != null;
    }
    
    // Função para verificar domínio hokkaido
    function isHokkaidoUser() {
      return isAuthenticated() && 
             request.auth.token.email.matches('.*@hokkaido[.]com');
    }
    
    // Arquivos públicos (logos, imagens do sistema)
    match /public/{allPaths=**} {
      allow read: if true;
      allow write: if isHokkaidoUser();
    }
    
    // Relatórios e documentos
    match /reports/{allPaths=**} {
      allow read: if isAuthenticated();
      allow write: if isHokkaidoUser();
    }
    
    // Uploads de usuários
    match /uploads/{userId}/{allPaths=**} {
      allow read: if isAuthenticated();
      allow write: if isAuthenticated() && request.auth.uid == userId;
    }
    
    // Regra padrão: negar tudo
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

### Passo 4.3 - Publicar

1. Clique em **Publish**
2. Aguarde a confirmação

### ✅ Resultado da Parte 4
- Arquivos protegidos por autenticação
- Usuários só podem fazer upload em suas próprias pastas
- Arquivos públicos são somente leitura para visitantes

---

## Parte 5: Monitoramento e Alertas

### Passo 5.1 - Configurar Alertas de Orçamento

1. No Firebase Console, clique no ícone de engrenagem ⚙️ > **Usage and billing**
2. Vá para **Details & settings**
3. Configure alertas de orçamento:
   - Clique em **Modify** nos Budget alerts
   - Defina valores como R$ 10, R$ 50, R$ 100
   - Você receberá email quando atingir esses valores

### Passo 5.2 - Monitorar Uso

1. Vá para **Usage and billing** > **Usage**
2. Monitore regularmente:
   - **Firestore reads/writes:** Quantas operações no banco
   - **Storage:** Espaço utilizado
   - **Authentication:** Número de usuários ativos

### Passo 5.3 - Verificar Logs (Cloud Functions)

Se usar Cloud Functions:
1. Vá para **Functions** no menu lateral
2. Clique em **Logs**
3. Verifique erros ou comportamentos suspeitos

### Passo 5.4 - Configurar Notificações

1. Vá para **Project settings** (ícone de engrenagem)
2. Clique em **Integrations**
3. Ative notificações por email para alertas importantes

### ✅ Resultado da Parte 5
- Alertas de custo configurados
- Monitoramento ativo do uso
- Notificações de problemas

---

## Checklist Final

### 🔲 Segurança do Firestore
- [ ] Regras de segurança publicadas
- [ ] Testadas no Rules Playground
- [ ] Apenas autenticados podem ler
- [ ] Apenas @hokkaido.com podem escrever
- [ ] Regra padrão nega acesso não especificado

### 🔲 App Check
- [ ] reCAPTCHA v3 configurado
- [ ] Site Key copiada
- [ ] Código adicionado nos arquivos JS/HTML
- [ ] Testado que funciona
- [ ] Enforcement ativado (após testes)

### 🔲 Autenticação
- [ ] Login anônimo desativado
- [ ] Apenas provedores necessários ativos
- [ ] Domínios autorizados revisados
- [ ] Usuários desconhecidos removidos

### 🔲 Storage (se aplicável)
- [ ] Regras de segurança configuradas
- [ ] Testadas

### 🔲 Monitoramento
- [ ] Alertas de orçamento configurados
- [ ] Uso monitorado regularmente

---

## ❓ FAQ - Perguntas Frequentes

### "Preciso do Google Cloud Console para isso?"
**Não!** Tudo neste guia é feito apenas no Firebase Console, que é gratuito.

### "O plano Blaze vai me cobrar por isso?"
**Não diretamente.** As configurações de segurança não têm custo. O Blaze cobra apenas pelo uso (leituras, escritas, armazenamento) acima do limite gratuito.

### "E se eu bloquear usuários legítimos?"
Teste as regras no **Rules Playground** antes de publicar. Se algo der errado, você pode voltar às regras anteriores rapidamente.

### "As credenciais no código ainda são um problema?"
Com as regras de segurança e App Check, as credenciais no código se tornam inúteis para atacantes. Eles não conseguirão:
- Ler dados (regras de segurança bloqueiam)
- Fazer requisições de fora do app (App Check bloqueia)

### "Com que frequência devo revisar a segurança?"
Recomendado: **mensalmente** ou sempre que adicionar novas funcionalidades.

---

## Parte 6: Backup e Recuperação de Dados

O Firebase oferece múltiplas opções de backup para garantir que seus dados estejam sempre seguros e recuperáveis.

### 6.1 - Opções de Backup Disponíveis

| Método | Frequência | Custo | Dificuldade |
|--------|------------|-------|-------------|
| Export Manual (Console) | Sob demanda | Gratuito* | ⭐ Fácil |
| Export Agendado | Diário/Semanal | ~$0.10/GB | ⭐⭐ Médio |
| Backup via Script | Personalizado | Gratuito* | ⭐⭐⭐ Avançado |

*\*Custos de armazenamento no Cloud Storage podem se aplicar*

---

### 6.2 - Método 1: Export Manual pelo Firebase Console

Este é o método mais simples e recomendado para começar.

#### Passo a Passo:

1. **Acesse o Firebase Console**
   - https://console.firebase.google.com/
   - Selecione o projeto **hokkaido-synchro**

2. **Vá para Firestore Database**
   - Menu lateral > **Firestore Database**

3. **Abra o menu de opções**
   - Clique nos **3 pontos (⋮)** no canto superior direito
   - Selecione **Export documents** ou **Importar/Exportar**

4. **Configure a exportação**
   - **Destino:** Selecione ou crie um bucket do Cloud Storage
   - **Coleções:** Escolha "Exportar todas as coleções" ou selecione específicas
   - Clique em **Exportar**

5. **Aguarde a conclusão**
   - O processo pode levar alguns minutos dependendo do volume de dados
   - Você receberá uma notificação quando terminar

#### Onde ficam os arquivos de backup:

```
gs://hokkaido-synchro.appspot.com/backups/
└── 2025-12-06_manual/
    ├── all_namespaces/
    │   ├── planning/
    │   ├── production_entries/
    │   ├── downtime_entries/
    │   └── ...
    └── metadata.json
```

---

### 6.3 - Método 2: Backup Agendado Automático

Para backups automáticos diários ou semanais:

#### Passo a Passo:

1. **Acesse o Firebase Console**
   - Vá para **Firestore Database**

2. **Configure Backup Automático**
   - Clique na aba **Backups** (se disponível no seu plano)
   - Ou acesse: **Configurações do Projeto** > **Backup**

3. **Defina a programação**
   - **Frequência:** Diária ou Semanal
   - **Horário:** Escolha um horário de baixo uso (ex: 03:00)
   - **Retenção:** Quantos dias manter os backups (ex: 30 dias)

4. **Configure o destino**
   - Bucket: `hokkaido-synchro-backups`
   - Região: `southamerica-east1` (São Paulo)

5. **Ative o backup**
   - Clique em **Salvar** ou **Ativar**

---

### 6.4 - Método 3: Export via Linha de Comando (gcloud)

Para usuários técnicos que preferem automação:

#### Pré-requisitos:
- Google Cloud SDK instalado
- Autenticação configurada

#### Comandos:

```bash
# Login no Google Cloud
gcloud auth login

# Selecionar projeto
gcloud config set project hokkaido-synchro

# Exportar todas as coleções
gcloud firestore export gs://hokkaido-synchro-backups/backup-$(date +%Y-%m-%d)

# Exportar coleções específicas
gcloud firestore export gs://hokkaido-synchro-backups/backup-$(date +%Y-%m-%d) \
  --collection-ids=planning,production_entries,downtime_entries
```

---

### 6.5 - Como Acessar e Baixar os Backups

#### Opção A: Via Firebase Console

1. Acesse **Storage** no Firebase Console
2. Navegue até a pasta de backups
3. Clique no arquivo desejado
4. Clique em **Download**

#### Opção B: Via Google Cloud Console

1. Acesse: https://console.cloud.google.com/storage/browser
2. Selecione o projeto **hokkaido-synchro**
3. Navegue até o bucket de backups
4. Selecione os arquivos e clique em **Download**

#### Opção C: Via gsutil (Linha de Comando)

```bash
# Baixar todo o backup
gsutil -m cp -r gs://hokkaido-synchro-backups/backup-2025-12-06 ./backup-local/

# Listar backups disponíveis
gsutil ls gs://hokkaido-synchro-backups/
```

---

### 6.6 - Como Restaurar um Backup

> ⚠️ **ATENÇÃO:** A restauração sobrescreve dados existentes!

#### Passo a Passo:

1. **Acesse o Firebase Console**
   - Vá para **Firestore Database**

2. **Inicie a importação**
   - Clique nos **3 pontos (⋮)** > **Import documents**

3. **Selecione o backup**
   - Navegue até o bucket de backups
   - Selecione a pasta do backup desejado
   - Clique em **Importar**

4. **Aguarde a conclusão**
   - Não feche a página durante o processo
   - Verifique se os dados foram restaurados corretamente

#### Via Linha de Comando:

```bash
# Restaurar de um backup específico
gcloud firestore import gs://hokkaido-synchro-backups/backup-2025-12-06
```

---

### 6.7 - Política de Backup Recomendada

Para um sistema de produção como o Synchro MES, recomendamos:

| Tipo de Backup | Frequência | Retenção | Responsável |
|----------------|------------|----------|-------------|
| Automático | Diário às 03:00 | 30 dias | Sistema |
| Manual | Antes de atualizações | 90 dias | TI |
| Mensal | 1º dia do mês | 1 ano | TI |
| Anual | 31 de dezembro | 5 anos | TI |

---

### 6.8 - Estimativa de Custos de Backup

Com o plano Blaze, os custos são baseados no uso:

| Recurso | Preço | Estimativa Mensal* |
|---------|-------|-------------------|
| Armazenamento | $0.026/GB/mês | ~$0.50 |
| Export | $0.10/GB | ~$1.00 |
| Import | $0.10/GB | Sob demanda |

*\*Estimativa para ~20GB de dados*

---

### 6.9 - Script de Backup Automatizado (Opcional)

Se quiser criar um script para backup automático no sistema Synchro:

```javascript
// backup-firestore.js
// Execute com: node backup-firestore.js

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'hokkaido-synchro.appspot.com'
});

const db = admin.firestore();

async function backupCollection(collectionName) {
  const snapshot = await db.collection(collectionName).get();
  const data = [];
  
  snapshot.forEach(doc => {
    data.push({
      id: doc.id,
      ...doc.data()
    });
  });
  
  return data;
}

async function fullBackup() {
  const collections = [
    'planning',
    'production_entries',
    'downtime_entries',
    'extended_downtime_logs',
    'losses_entries',
    'production_orders',
    'machine_status'
  ];
  
  const backup = {
    timestamp: new Date().toISOString(),
    project: 'hokkaido-synchro',
    collections: {}
  };
  
  for (const col of collections) {
    console.log(`Exportando ${col}...`);
    backup.collections[col] = await backupCollection(col);
  }
  
  // Salvar em arquivo JSON
  const fs = require('fs');
  const filename = `backup-${new Date().toISOString().split('T')[0]}.json`;
  fs.writeFileSync(filename, JSON.stringify(backup, null, 2));
  
  console.log(`Backup salvo em: ${filename}`);
  console.log(`Total de registros: ${Object.values(backup.collections).reduce((a, b) => a + b.length, 0)}`);
}

fullBackup().catch(console.error);
```

---

## Resumo Executivo para Diretoria

### 📊 Visão Geral do Sistema de Segurança - Synchro MES

**Apresentado por:** Equipe de TI  
**Data:** 6 de dezembro de 2025  
**Sistema:** Synchro MES - Controle de Produção  
**Infraestrutura:** Google Firebase (Plano Blaze)

---

### 🎯 Objetivo

Garantir a **segurança**, **disponibilidade** e **integridade** dos dados de produção da Hokkaido, em conformidade com as melhores práticas de segurança da informação.

---

### 🛡️ Camadas de Proteção Implementadas

| Camada | Descrição | Status |
|--------|-----------|--------|
| **1. Autenticação** | Apenas usuários com login podem acessar | ✅ Ativo |
| **2. Autorização** | Apenas emails @hokkaido.com podem modificar dados | ✅ Ativo |
| **3. App Check** | Bloqueia acessos de scripts/robôs externos | 🔲 Em implementação |
| **4. Backup** | Cópias de segurança diárias automáticas | 🔲 Em implementação |
| **5. Monitoramento** | Alertas de uso anormal e custos | 🔲 Em implementação |

---

### 💰 Investimento e Custos

| Item | Custo Mensal Estimado |
|------|----------------------|
| Firebase (Plano Blaze) | ~R$ 50-100* |
| Backup/Armazenamento | ~R$ 10-20 |
| **Total** | **~R$ 60-120/mês** |

*\*Varia conforme uso. Limite gratuito cobre boa parte do uso.*

---

### 📈 Benefícios

1. **Segurança de Dados**
   - Dados protegidos por criptografia em trânsito e em repouso
   - Acesso restrito por autenticação e autorização
   - Proteção contra ataques externos

2. **Disponibilidade**
   - Infraestrutura Google com 99.95% de disponibilidade
   - Servidores redundantes em múltiplas regiões
   - Recuperação automática de falhas

3. **Continuidade de Negócio**
   - Backups automáticos diários
   - Recuperação de dados em caso de incidentes
   - Histórico de 30 dias de backups

4. **Conformidade**
   - Logs de auditoria de todas as operações
   - Controle de acesso por usuário
   - Rastreabilidade completa

---

### 📋 Política de Backup

| Frequência | Retenção | Armazenamento |
|------------|----------|---------------|
| Diário | 30 dias | Google Cloud Storage |
| Mensal | 12 meses | Google Cloud Storage |
| Anual | 5 anos | Google Cloud Storage |

**Tempo de Recuperação (RTO):** < 4 horas  
**Ponto de Recuperação (RPO):** < 24 horas (último backup diário)

---

### 🔐 Controle de Acesso

| Nível | Permissões | Usuários |
|-------|------------|----------|
| **Administrador** | Criar, editar, deletar | Leandro, Vitor |
| **Operador** | Criar, editar | Equipe @hokkaido.com |
| **Visualização** | Apenas leitura | Dashboard TV |

---

### 📊 Métricas de Segurança

Monitoramento contínuo de:
- Tentativas de acesso não autorizado
- Volume de operações por usuário
- Custos e uso de recursos
- Disponibilidade do sistema

---

### ✅ Plano de Ação

| Ação | Responsável | Prazo | Status |
|------|-------------|-------|--------|
| Configurar regras de segurança | TI | Imediato | ✅ Pronto |
| Ativar App Check | TI | 1 semana | 🔲 Pendente |
| Configurar backup automático | TI | 1 semana | 🔲 Pendente |
| Documentar procedimentos | TI | 2 semanas | ✅ Pronto |
| Treinar equipe | TI | 1 mês | 🔲 Pendente |

---

### 📞 Contatos de Emergência

| Situação | Contato |
|----------|---------|
| Problemas de acesso | [TI Local] |
| Incidente de segurança | [TI Local] + Firebase Support |
| Recuperação de dados | [TI Local] |

---

### 📝 Aprovações

| Nome | Cargo | Assinatura | Data |
|------|-------|------------|------|
| | Diretor de TI | | |
| | Diretor Industrial | | |
| | Gerente de Produção | | |

---

## 📞 Suporte

Se tiver problemas:
1. Verifique o **Rules Playground** para testar regras
2. Confira o console do navegador (F12) para erros
3. Monitore o **App Check Metrics** para requisições bloqueadas

---

*Documento atualizado em: 6 de dezembro de 2025*  
*Versão: 3.0 - Incluindo Backup e Resumo Executivo*
