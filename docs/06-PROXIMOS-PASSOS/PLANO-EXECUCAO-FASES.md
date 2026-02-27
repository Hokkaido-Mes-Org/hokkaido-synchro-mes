# Plano de Execução em Fases — Migração Firebase Hosting

> **Data**: Fevereiro 2026  
> **Projeto**: HokkaidoMES  
> **Projeto Firebase**: `hokkaido-synchro` (projectId)  
> **Repositório**: `hokkaidoplasticsfirebase/hokkaido-synchro-mes.git`  
> **Objetivo**: Migrar para Firebase Hosting **sem interromper** o uso atual via GitHub

---

## Visão Geral das Fases

```
     GITHUB (Source of Truth - Sempre Acessível)
     ├── main          ← código estável (atual, funciona via GitHub Pages)
     ├── staging        ← testes pré-produção no Firebase
     └── firebase-auth  ← desenvolvimento futuro do Firebase Auth
     
     ┌────────────────────────────────────────────┐
     │  FASE 0   Preparação (sem impacto)         │  ← VOCÊ ESTÁ AQUI
     │  FASE 1   Deploy paralelo no Firebase      │  
     │  FASE 2   Validação lado-a-lado            │
     │  FASE 3   Migração gradual de usuários     │
     │  FASE 4   Produção 100% no Firebase        │
     │  FASE 5   Firebase Auth + RBAC (futuro)    │
     └────────────────────────────────────────────┘
```

### Princípio Fundamental

> **O GitHub continua 100% funcional durante toda a migração.**  
> O Firebase Hosting roda em PARALELO até que se confirme a estabilidade.  
> A qualquer momento, pode-se voltar ao GitHub sem perder nada.

---

## FASE 0 — Preparação (Sem Impacto no Sistema Atual)

**Duração**: 1-2 horas  
**Risco**: ZERO (nenhuma mudança no sistema em produção)  
**Objetivo**: Configurar ferramentas, criar contas, preparar credenciais

### Passo 0.1 — Instalar Firebase CLI

```powershell
# Opção A: via npm (requer Node.js)
npm install -g firebase-tools

# Opção B: via standalone installer (sem Node.js)
# Download: https://firebase.tools/bin/win/instant/latest
```

### Passo 0.2 — Login no Firebase

```powershell
firebase login
# Abre o navegador → Login com conta Google que tem acesso ao projeto hokkaido-synchro
# Após login: "Success! Logged in as seu@email.com"
```

### Passo 0.3 — Verificar Projeto

```powershell
firebase projects:list
# Deve mostrar: hokkaido-synchro

firebase use hokkaido-synchro
# ✅ Now using project hokkaido-synchro
```

### Passo 0.4 — Arquivos de Configuração (Já Criados)

Os seguintes arquivos já foram criados no repositório:

| Arquivo | Função |
|---------|--------|
| `firebase.json` | Configuração de hospedagem (public dir, ignores, rewrites, headers) |
| `.firebaserc` | Mapeia o alias "default" para o project-id `hokkaido-synchro` |
| `.github/workflows/firebase-deploy.yml` | CI/CD automático (deploy em push) |

### Passo 0.5 — Gerar Service Account Key (para GitHub Actions)

```
1. Acessar: https://console.firebase.google.com/project/hokkaido-synchro/settings/serviceaccounts/adminsdk
2. Clicar em "Generate new private key"
3. Salvar o JSON (NÃO commitar no repositório!)
4. No GitHub do repositório:
   - Settings → Secrets and variables → Actions
   - New repository secret
   - Nome: FIREBASE_SERVICE_ACCOUNT_HOKKAIDO_SYNCHRO
   - Valor: Colar o conteúdo INTEIRO do JSON baixado
5. Deletar o arquivo JSON do seu computador
```

### Passo 0.6 — Testar Localmente

```powershell
cd "c:\Users\Leandro de Camargo\Downloads\backupHokkaidoMES"

# Servir localmente (simula Firebase Hosting)
firebase serve --only hosting --port 5000

# Abrir: http://localhost:5000
# Verificar: Login funciona? Abas carregam? Firestore conecta?
# Ctrl+C para parar
```

### Checklist Fase 0

- [ ] Firebase CLI instalado (`firebase --version` retorna versão)
- [ ] Login feito (`firebase login`)
- [ ] Projeto confirmado (`firebase use hokkaido-synchro`)
- [ ] `firebase.json` existe na raiz
- [ ] `.firebaserc` existe na raiz
- [ ] Teste local (`firebase serve`) funciona sem erros
- [ ] Service Account Key gerada e salva como Secret no GitHub

---

## FASE 1 — Deploy Paralelo (GitHub + Firebase Side-by-Side)

**Duração**: 30 minutos  
**Risco**: BAIXO (sistema atual no GitHub não é alterado)  
**Objetivo**: Ter o sistema rodando SIMULTANEAMENTE no GitHub E no Firebase

### Passo 1.1 — Primeiro Deploy Manual

```powershell
cd "c:\Users\Leandro de Camargo\Downloads\backupHokkaidoMES"

# Deploy para Firebase Hosting
firebase deploy --only hosting

# Resultado esperado:
# ✅ Deploy complete!
# Hosting URL: https://hokkaido-synchro.web.app
```

### Passo 1.2 — Verificar URLs

Após o deploy, o sistema estará acessível em **duas** URLs simultâneas:

| Ambiente | URL | Status |
|----------|-----|--------|
| **GitHub** (atual) | URL atual do GitHub Pages | ✅ Continua funcionando |
| **Firebase** (novo) | `https://hokkaido-synchro.web.app` | ✅ Recém-ativado |
| **Firebase** (alt) | `https://hokkaido-synchro.firebaseapp.com` | ✅ Automático |

### Passo 1.3 — Testar no Firebase

Abrir `https://hokkaido-synchro.web.app` e verificar:

| Teste | Esperado | OK? |
|-------|----------|-----|
| Página de login carrega | Login.html visível | [ ] |
| Login com leandro.camargo | Redireciona para index.html | [ ] |
| Aba Planejamento | Carrega dados do Firestore | [ ] |
| Aba Lançamento | Mostra máquinas e formulários | [ ] |
| Aba Análise | Gráficos renderizam | [ ] |
| Aba Relatórios | Visível apenas para 8 usuários autorizados | [ ] |
| Dashboard TV | `dashboard-tv.html` carrega | [ ] |
| Acompanhamento Turno | `acompanhamento-turno.html` carrega | [ ] |
| HTTPS | Cadeado verde no browser | [ ] |
| Velocidade | Carregamento <3s | [ ] |

### Passo 1.4 — Ativar Deploy Automático via GitHub Actions

```powershell
# Committar os arquivos de configuração
cd "c:\Users\Leandro de Camargo\Downloads\backupHokkaidoMES"

git add firebase.json .firebaserc .github/workflows/firebase-deploy.yml
git commit -m "feat: adicionar Firebase Hosting + CI/CD automático"
git push origin main
```

A partir deste momento, **todo push para `main`** faz deploy automático no Firebase.

### Passo 1.5 — Testar CI/CD

```powershell
# Fazer uma mudança cosmética para testar o pipeline
# Ex: adicionar um comentário no style.css
echo "/* Firebase Hosting deploy test */" >> style.css

git add style.css
git commit -m "test: verificar deploy automático Firebase"
git push origin main

# Ir para: https://github.com/hokkaidoplasticsfirebase/hokkaido-synchro-mes/actions
# Verificar que o workflow "Deploy to Firebase Hosting" rodou com sucesso ✅
```

### Diagrama da Situação após Fase 1

```
┌─────────────────────────────────────────────────────┐
│                    GITHUB                             │
│  Repositório (Source of Truth)                        │
│  ├── main branch                                      │
│  └── Código-fonte de TODOS os arquivos                │
│                                                       │
│  ┌─────── Push ───────┐   ┌──── Push ─────┐          │
│  ▼                     │   ▼               │          │
│  GitHub Pages          │   GitHub Actions   │          │
│  (URL atual)           │   (CI/CD)          │          │
│  ✅ FUNCIONANDO        │        │           │          │
│                        │        ▼           │          │
│                        │   Firebase Hosting │          │
│                        │   hokkaido-synchro │          │
│                        │   .web.app          │         │
│                        │   ✅ FUNCIONANDO    │         │
└─────────────────────────────────────────────┘

USUÁRIOS:
  👥 Equipe inteira → GitHub Pages (SEM MUDANÇA)  
  👤 Leandro (teste) → Firebase Hosting (validando)
```

### Checklist Fase 1

- [ ] `firebase deploy --only hosting` executado com sucesso
- [ ] URL `https://hokkaido-synchro.web.app` carrega o sistema
- [ ] Login funciona no Firebase Hosting
- [ ] Firestore conecta normalmente (dados carregam)
- [ ] HTTPS ativo (cadeado verde)
- [ ] GitHub Actions workflow commitado e pushado
- [ ] Deploy automático funciona (testado com push)
- [ ] GitHub Pages continua funcionando normalmente

---

## FASE 2 — Validação Lado-a-Lado (1-2 Semanas)

**Duração**: 1-2 semanas  
**Risco**: BAIXO (apenas observação comparativa)  
**Objetivo**: Validar que Firebase Hosting funciona identicamente ao GitHub

### Passo 2.1 — Teste Diário por 1 Semana

Durante 1 semana, acessar o sistema via Firebase (`hokkaido-synchro.web.app`) nos seguintes cenários:

| Dia | Teste | Observação |
|-----|-------|------------|
| Seg | Login + Planejamento + Lançamento | Fluxo operador completo |
| Ter | Análise + Relatórios + PCP | Dados históricos carregam? |
| Qua | Dashboard TV (tela inteira 1h) | Estabilidade longa duração, polling funciona? |
| Qui | Operações de escrita (lançar produção, paradas) | Dados gravam corretamente? |
| Sex | Teste com 2 usuários simultâneos | Login paralelo funciona? |
| Sáb | Acompanhamento Turno (se houver produção) | Standalone funciona? |
| Dom | Auto-verificação: comparar dados Firebase vs GitHub | Ambos mostram mesmos dados? |

### Passo 2.2 — Convidar 2-3 Testadores

Selecionar testadores de confiança para usar o Firebase em paralelo:

| Testador | Perfil | Objetivo |
|----------|--------|----------|
| **Leandro Camargo** | Gestor/Admin | Testar todas as abas, permissões, escrita |
| **Tiago Oliveira** | Gestor | Testar planejamento, setup, pcp |
| **Roberto fernandes** | Suporte | Testar permissões elevadas, admin |

**Instrução para testadores**: "Acesse `https://hokkaido-synchro.web.app` e use normalmente. Se encontrar qualquer diferença ou erro, me avise imediatamente."

### Passo 2.3 — Monitorar Métricas

```
Console Firebase → Hosting → Uso
- Verificar: Bandwidth, Request count, Latência
- Confirmar que está dentro do plano gratuito (Spark: 10 GB/mês, 360 MB/dia)
```

### Passo 2.4 — Criar Branch Staging

```powershell
# Criar branch staging para testes pré-produção
git checkout -b staging
git push origin staging

# O GitHub Actions (se configurado) faz deploy em canal "staging"
# URL: https://hokkaido-synchro--staging-{hash}.web.app
```

### Passo 2.5 — Plano de Contingência (Rollback)

Se qualquer problema for encontrado no Firebase:

```powershell
# Opção A: Rollback no Firebase (volta para deploy anterior)
firebase hosting:rollback

# Opção B: Usuários voltam para GitHub Pages
# Nenhuma ação necessária — GitHub Pages nunca foi desativado

# Opção C: Desativar Firebase temporariamente
firebase hosting:disable
```

### Checklist Fase 2

- [ ] 7 dias de teste diário completados sem erros
- [ ] 2-3 testadores confirmaram funcionamento idêntico
- [ ] Nenhum problema de performance identificado
- [ ] Dados gravados via Firebase aparecem em ambas as URLs
- [ ] Branch staging criada e funcionando
- [ ] Plano de rollback testado (pelo menos 1 rollback simulado)

---

## FASE 3 — Migração Gradual de Usuários (1-2 Semanas)

**Duração**: 1-2 semanas  
**Risco**: MÉDIO (mudança de URL para alguns usuários)  
**Objetivo**: Mover usuários gradualmente do GitHub Pages para Firebase Hosting

### Passo 3.1 — Onda 1: Gestores e Líderes (Semana 1)

Enviar para gestores e líderes (8-10 usuários):

```
📧 Mensagem para gestores e líderes:

Pessoal, estamos atualizando o endereço do sistema MES.
O novo endereço é: https://hokkaido-synchro.web.app

✅ Seu login e senha continuam os mesmos
✅ Todos os dados são os mesmos (não mudou nada)
✅ Agora tem HTTPS (cadeado verde = conexão segura)

Se tiver qualquer problema, o endereço antigo continua funcionando.
```

| Grupo | Usuários | Ação |
|-------|----------|------|
| **Gestores** | Leandro, Tiago, Werigue, Rafael, Victor, Elaine, Erika, Lidiomar | Acessar via Firebase |
| **Suporte** | Michelle, Roberto | Acessar via Firebase |
| **Demais** | Todos os outros | Continuar no GitHub Pages (sem mudança) |

### Passo 3.2 — Monitorar Onda 1 (3-5 dias)

| Métrica | Como verificar | Aceitável |
|---------|----------------|-----------|
| Erros de login | Console Firebase → Authentication | 0 erros |
| Erros JS | Console Firebase → Crashlytics (se ativado) | 0 erros |
| Reclamações | Feedback direto dos testadores | 0 reclamações |
| Latência | Firebase Console → Hosting | <2s carregamento |

### Passo 3.3 — Onda 2: Operadores (Semana 2)

Se a Onda 1 estiver estável por 3-5 dias, migrar o restante:

```
📧 Mensagem para todos os operadores:

Atenção: O endereço do sistema MES mudou.
Novo endereço: https://hokkaido-synchro.web.app

Favor atualizar o favorito/atalho no computador.
Mesmo login e senha de sempre.
```

### Passo 3.4 — Dashboard TV

```
Em cada TV de chão de fábrica:
1. Abrir o navegador
2. Trocar URL para: https://hokkaido-synchro.web.app/dashboard-tv.html
3. Enter — pronto
4. Manter o endereço antigo como backup em outra aba
```

### Checklist Fase 3

- [ ] Onda 1 notificada (gestores + suporte)
- [ ] 3-5 dias sem problemas na Onda 1
- [ ] Onda 2 notificada (operadores)
- [ ] Dashboard TV's atualizadas
- [ ] Acompanhamento Turno atualizado
- [ ] Todos os ~55 usuários usando Firebase Hosting
- [ ] GitHub Pages mantido como fallback (ainda ativo)

---

## FASE 4 — Produção 100% no Firebase (Permanente)

**Duração**: 1 dia + 1 semana de monitoramento  
**Risco**: BAIXO (já validado nas fases anteriores)  
**Objetivo**: Firebase Hosting se torna o ambiente oficial de produção

### Passo 4.1 — Confirmação Final

Antes de oficializar, confirmar:

| Item | Status |
|------|--------|
| Todos os 55 usuários usando Firebase há pelo menos 1 semana | [ ] |
| Zero reclamações ou erros reportados | [ ] |
| Dashboard TV estável (24h sem refresh manual) | [ ] |
| Deploy automático via GitHub Actions testado 3+ vezes | [ ] |
| Rollback testado pelo menos 1 vez | [ ] |

### Passo 4.2 — Redirect do GitHub Pages (Opcional)

Se quiser redirecionar quem acessar o endereço antigo:

```html
<!-- Criar arquivo redirect.html na branch gh-pages (se usar GitHub Pages) -->
<!DOCTYPE html>
<html>
<head>
    <meta http-equiv="refresh" content="0; url=https://hokkaido-synchro.web.app">
    <title>Redirecionando...</title>
</head>
<body>
    <p>O sistema foi movido para <a href="https://hokkaido-synchro.web.app">https://hokkaido-synchro.web.app</a></p>
</body>
</html>
```

### Passo 4.3 — Custom Domain (Opcional)

Se quiser um domínio personalizado (ex: `mes.hokkaido.com.br`):

```
1. Console Firebase → Hosting → Add custom domain
2. Seguir instruções de verificação DNS
3. Firebase provisiona certificado SSL automaticamente
4. Após propagação DNS (24-48h), domínio ativo
```

### Passo 4.4 — Desativar GitHub Pages (Quando Seguro)

```
⚠️ SOMENTE quando 100% confiante que Firebase é estável:

GitHub → Repository Settings → Pages → Source → None
Ou simplesmente deixar ativo como fallback permanente (custo zero)
```

### Passo 4.5 — Celebrar 🎉

```
Estado final:
  ✅ Sistema servido via Firebase Hosting (HTTPS, CDN global)
  ✅ Deploy automático via GitHub Actions (push → deploy em <2 min)
  ✅ GitHub como Source of Truth (todo código vive no Git)
  ✅ Rollback instantâneo via GitHub Actions ou firebase hosting:rollback
  ✅ Preview automática em Pull Requests
  ✅ Zero custo (Spark plan = gratuito para este volume)
```

### Checklist Fase 4

- [ ] 100% dos usuários no Firebase por 1+ semana sem problemas
- [ ] GitHub Pages redirecionado ou desativado
- [ ] Documentação atualizada com nova URL
- [ ] Dashboard TV apontando para Firebase Hosting
- [ ] Custom domain configurado (se desejado)

---

## FASE 5 — Firebase Auth + RBAC (Fase Futura — Independente)

> ⚠️ **Esta fase é INDEPENDENTE das fases 0-4.**  
> Pode ser feita semanas ou meses depois da migração de hosting.  
> Detalhamento completo no PLANO-FIREBASE-HOSTING-AUTH-RBAC.md (Fases 2-4)

### Resumo do Que Muda na Fase 5

| Componente | Estado Atual (Fases 0-4) | Estado Futuro (Fase 5) |
|-----------|-------------------------|----------------------|
| Login | `login.html` com senhas hardcoded | Firebase Auth (email/senha) |
| Sessão | localStorage/sessionStorage | Firebase Auth Token (JWT) |
| ACL | Listas de nomes em `auth.js`/`script.js` | Custom Claims no token |
| Permissões | Array hardcoded por usuário | Custom Claims + Firestore `users` collection |
| Security Rules | `allow read, write: if true` | Rules por collection × role |
| Gerenciar usuários | Editar `login.html` e commitar | Console Firebase ou tela admin |

### Pré-requisitos da Fase 5

- [ ] Fases 0-4 100% concluídas e estáveis
- [ ] Firebase Hosting como ambiente oficial (pelo menos 2 semanas)
- [ ] Equipe informada que haverá mudança no processo de login
- [ ] Branch `firebase-auth` criada para desenvolvimento isolado

### Sub-fases da Fase 5

```
5A — Adicionar Firebase Auth SDK ao index.html e login.html
5B — Criar script de importação dos 55 usuários para Firebase Auth
5C — Implementar login via signInWithEmailAndPassword()
5D — Migrar auth.js para onAuthStateChanged() + Custom Claims
5E — Implementar Firestore Security Rules
5F — Testar extensivamente (emulator + staging)
5G — Deploy com feature flag (A/B: legacy vs Firebase Auth)
5H — Rollout gradual (10% → 50% → 100%)
5I — Remover código legacy (login.html hardcoded, auth.js nome-based)
```

---

## Cronograma Visual Consolidado

```
Semana 0 (Dia 1):
  ████ FASE 0: Preparação (1-2h)
  ████ FASE 1: Deploy paralelo (30min)

Semana 1-2:
  ████████████████ FASE 2: Validação lado-a-lado (testes diários)

Semana 3:
  ████████ FASE 3 Onda 1: Gestores e Líderes no Firebase

Semana 3-4:
  ████████ FASE 3 Onda 2: Operadores no Firebase

Semana 4+:
  ████ FASE 4: Firebase = Produção oficial

(Futuro — semanas/meses depois):
  ████████████████████████ FASE 5: Firebase Auth + RBAC
```

## Resumo de Custos

| Item | Plano | Custo |
|------|-------|-------|
| Firebase Hosting | Spark (gratuito) | **$0/mês** |
| Bandwidth | Até 360 MB/dia (Spark) | **$0/mês** |
| SSL/HTTPS | Automático | **$0/mês** |
| GitHub Actions | 2.000 min/mês (Free) | **$0/mês** |
| Firestore | Já em uso (Blaze) | ~$6/mês (sem mudança) |
| Firebase Auth | Free até 50K MAU | **$0/mês** |
| **TOTAL** | | **~$6/mês** (mesmo custo atual) |

## Resumo de Riscos por Fase

| Fase | Risco | Impacto se der errado | Rollback |
|------|-------|----------------------|----------|
| 0 | ZERO | Nenhum — apenas preparação | N/A |
| 1 | BAIXO | Sistema no GitHub não é afetado | `firebase hosting:disable` |
| 2 | BAIXO | Testers voltam para GitHub | Parar de testar no Firebase |
| 3 | MÉDIO | Mudar URL dos usuários de volta | Mensagem: "voltem para URL antiga" |
| 4 | BAIXO | Já validado extensivamente | GitHub Pages reativado em 5 min |
| 5 | MÉDIO | Firebase Auth pode ter edge cases | Feature flag → rollback to legacy |

---

## Arquivos Criados para Este Plano

| Arquivo | Função | Fase |
|---------|--------|------|
| `firebase.json` | Configuração de hosting (public dir, ignores, rewrites, cache) | 0-1 |
| `.firebaserc` | Mapeamento project-id `hokkaido-synchro` | 0-1 |
| `.github/workflows/firebase-deploy.yml` | CI/CD automático (push → deploy) | 1 |
| `docs/06-PROXIMOS-PASSOS/PLANO-EXECUCAO-FASES.md` | Este documento | 0 |

---

## Comandos de Referência Rápida

```powershell
# ─── FIREBASE CLI ───
firebase login                              # Login
firebase use hokkaido-synchro               # Selecionar projeto
firebase serve --only hosting --port 5000   # Testar localmente
firebase deploy --only hosting              # Deploy manual
firebase hosting:rollback                   # Rollback para versão anterior
firebase hosting:channel:list               # Ver canais de preview
firebase hosting:disable                    # Desativar hosting (emergência)

# ─── GIT + DEPLOY AUTOMÁTICO ───
git push origin main                        # Push → Deploy automático (produção)
git push origin staging                     # Push → Deploy em canal staging
git checkout -b feature/minha-feature       # Nova feature branch
# Criar PR → Deploy preview automático com URL única

# ─── MONITORAMENTO ───
# Console Firebase: https://console.firebase.google.com/project/hokkaido-synchro/hosting
# GitHub Actions:   https://github.com/hokkaidoplasticsfirebase/hokkaido-synchro-mes/actions
```

---

*Documento de execução — Hokkaido Plastics · Fevereiro 2026*
