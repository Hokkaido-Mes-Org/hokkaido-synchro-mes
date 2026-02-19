# HokkaidoMES — Plano de Continuidade, Backup e Recuperação de Desastres

> **Versão:** 1.0 • **Data:** Fevereiro 2026  
> **Classificação:** CONFIDENCIAL — Gestão e TI  
> **Responsável:** Leandro de Camargo

---

## 1. Objetivo

Garantir a **continuidade operacional** do sistema HokkaidoMES em cenários de falha, perda de dados, degradação de serviço ou indisponibilidade, minimizando impacto na operação fabril.

---

## 2. Análise de Impacto no Negócio (BIA)

### 2.1 Criticidade por Funcionalidade

| Funcionalidade | Criticidade | RTO* | RPO** | Impacto da Indisponibilidade |
|---------------|:-----------:|:-----:|:-----:|------------------------------|
| Lançamento de produção | **CRÍTICO** | 30 min | 0 | Perda de dados de produção do turno |
| Registro de paradas | **CRÍTICO** | 30 min | 0 | Perda de rastreabilidade de downtime |
| Dashboard TV | **ALTO** | 2h | 5 min | Falta de visibilidade no chão de fábrica |
| Planejamento | **ALTO** | 4h | 1h | Atraso na programação de produção |
| Ordens de produção | **ALTO** | 4h | 1h | Descoordenação de OPs |
| Análise / OEE | **MÉDIO** | 8h | 4h | Relatórios atrasados |
| Relatórios | **MÉDIO** | 8h | 4h | Atraso em reports gerenciais |
| PMP (borra/sucata) | **BAIXO** | 24h | 8h | Registro retroativo possível |
| Ferramentaria | **BAIXO** | 24h | 8h | Registro retroativo possível |
| Histórico / Logs | **BAIXO** | 24h | 24h | Auditoria temporariamente indisponível |

> *RTO (Recovery Time Objective): Tempo máximo aceitável para restaurar o serviço  
> **RPO (Recovery Point Objective): Perda máxima aceitável de dados

### 2.2 Dependências Externas

| Dependência | Provedor | SLA | Alternativa |
|-------------|----------|:---:|-------------|
| Cloud Firestore | Google Cloud | 99.999% | Fallback offline (SDK) |
| Firebase Hosting | Google Cloud | 99.95% | Deploy em S3/Netlify |
| CDN (TailwindCSS, Chart.js) | CDN públicas | ~99.9% | Bundle local |
| Internet (rede local → cloud) | ISP local | Variável | Cache local + retry |

---

## 3. Estratégia de Backup

### 3.1 Backup do Firestore

#### Backup Automático (Recomendado)

```bash
# Configurar export automático diário via Cloud Scheduler + Cloud Functions
# Ou manualmente via gcloud CLI:

# Exportar todas as coleções
gcloud firestore export gs://hokkaido-synchro-backups/$(date +%Y-%m-%d)

# Exportar coleções específicas (críticas)
gcloud firestore export gs://hokkaido-synchro-backups/$(date +%Y-%m-%d) \
  --collection-ids=production_entries,downtime_entries,planning,production_orders,active_downtimes
```

#### Política de Retenção

| Tipo | Frequência | Retenção | Destino |
|------|-----------|----------|---------|
| **Diário** | Todo dia às 02:00 | 30 dias | GCS bucket |
| **Semanal** | Domingo às 03:00 | 90 dias | GCS bucket |
| **Mensal** | 1º dia do mês | 1 ano | GCS bucket (Nearline) |
| **Anual** | 1º de janeiro | 5 anos | GCS bucket (Coldline) |

#### Coleções Prioritárias para Backup

| Prioridade | Coleções |
|:---------:|----------|
| **P1** | `production_entries`, `downtime_entries`, `production_orders`, `planning` |
| **P2** | `active_downtimes`, `extended_downtime_logs`, `system_logs` |
| **P3** | `moldes`, `setups`, `escalas_operadores`, `pmp_*` |
| **P4** | `acompanhamento_*`, `pcp_observacoes`, `process_control_checks` |

### 3.2 Backup do Código-Fonte

| Estratégia | Status |
|-----------|--------|
| Repositório local | ✅ `backupHokkaidoMES/` |
| Git (recomendado) | ⚠️ Implementar |
| Versionamento semântico | ⚠️ Implementar |
| Backup offsite | ⚠️ Implementar |

**Recomendação:** Inicializar repositório Git e fazer push para GitHub/GitLab privado:

```bash
cd backupHokkaidoMES
git init
git add .
git commit -m "Backup inicial - v1.0"
git remote add origin https://github.com/hokkaido/mes.git
git push -u origin main
```

### 3.3 Backup de Configuração

| Item | Localização | Backup |
|------|-------------|--------|
| Firebase Config | `firebase.json` + `.firebaserc` | Git |
| Firestore Rules | `firestore.rules` | Git |
| Firestore Indexes | `firestore.indexes.json` | Git |
| Feature Flags | `src/config/feature-flags.js` | Git |
| Database de Produtos | `database.js` | Git |
| Credenciais de usuários | `login.html` (hardcoded) | Git (CRIPTOGRAFAR) |

---

## 4. Plano de Recuperação de Desastres (DRP)

### 4.1 Cenário 1: Indisponibilidade do Firebase

**Impacto:** Sistema inteiro offline  
**Probabilidade:** Muito baixa (SLA 99.999%)

**Ações:**
1. Verificar status: https://status.firebase.google.com
2. Se prolongado (>1h): ativar modo offline do Firestore (SDK tem persistência local)
3. Comunicar operadores para registrar produção manualmente (planilha)
4. Ao retorno: importar dados manuais via admin

### 4.2 Cenário 2: Perda de Dados no Firestore

**Impacto:** Perda de registros operacionais  
**Probabilidade:** Baixa

**Ações:**
```
1. IDENTIFICAR a extensão da perda (quais coleções, período)
2. LOCALIZAR o backup mais recente no GCS bucket
3. RESTAURAR via gcloud:
   gcloud firestore import gs://hokkaido-synchro-backups/YYYY-MM-DD
4. VERIFICAR integridade dos dados restaurados
5. COMUNICAR usuários sobre possível gap de dados
6. REGISTRAR incidente nos system_logs
```

### 4.3 Cenário 3: Corrupção do Código (Deploy Ruim)

**Impacto:** Interface com bugs ou inacessível  
**Probabilidade:** Média

**Ações:**
```
1. IDENTIFICAR o problema (console errors, tela branca, funcionalidade quebrada)
2. ROLLBACK imediato:
   firebase hosting:clone hokkaido-synchro:PREVIOUS_VERSION hokkaido-synchro:live
3. Se Git disponível:
   git revert HEAD
   firebase deploy --only hosting
4. INVESTIGAR causa raiz no código
5. CORRIGIR e testar antes de re-deploy
```

### 4.4 Cenário 4: Perda de Internet Local

**Impacto:** Sem acesso ao sistema  
**Probabilidade:** Média

**Ações:**
1. Firestore SDK tem **persistência offline** — dados em cache local permanecem acessíveis
2. Novos registros ficam em **fila local** e sincronizam quando a conexão retornar
3. Para operação prolongada offline: usar planilhas de backup
4. Dashboard TV para de atualizar (aceitar dados stale)

### 4.5 Cenário 5: Comprometimento de Acesso (Segurança)

**Impacto:** Acesso indevido ao sistema ou dados  
**Probabilidade:** Baixa (intranet)

**Ações:**
```
1. CONTER: Revogar acesso do usuário comprometido (remover de login.html)
2. REVOGAR: Regenerar API keys no Firebase Console
3. INVESTIGAR: Verificar system_logs por ações suspeitas
4. COMUNICAR: Informar gestão e equipe de TI
5. CORRIGIR: Alterar senhas afetadas
6. PREVENIR: Implementar MFA, revisar ACL
```

---

## 5. Procedimento Operacional de Contingência

### 5.1 Registro Manual (Quando o Sistema Está Offline)

Em caso de indisponibilidade do sistema, operadores devem registrar dados em:

**Planilha de Contingência:**

| Data | Turno | Máquina | Produto | Código | Qtd Produzida | Paradas (motivo/duração) | Perdas | Operador |
|------|-------|---------|---------|--------|:-------------:|--------------------------|:------:|----------|
| ____/____/____ | T__ | H__ | ____________ | ______ | _____________ | ________________________ | ______ | ________ |

### 5.2 Importação Pós-Contingência

1. Coletar todas as planilhas de contingência
2. Acessar aba **Admin Dados** (perfil suporte)
3. Registrar manualmente cada entrada
4. Verificar totais com a planilha original
5. Registrar nos logs: "Dados importados pós-contingência para [data]"

---

## 6. Monitoramento e Alertas

### 6.1 Monitoramento Atual

| Métrica | Ferramenta | Status |
|---------|-----------|--------|
| Leituras Firestore | `window.FirebaseMonitor` / `fbstats()` | ✅ Ativo |
| Cache hit rate | `window.showCacheDashboard()` | ✅ Ativo |
| Erros JavaScript | Console do navegador | ✅ Manual |
| Uptime Firebase | status.firebase.google.com | ✅ Externo |
| Paradas longas | Service Worker push | ✅ Ativo |

### 6.2 Monitoramento Recomendado

| Métrica | Ferramenta Recomendada | Prioridade |
|---------|----------------------|:---------:|
| Error tracking | Sentry / Firebase Crashlytics | Alto |
| Performance | Firebase Performance Monitoring | Médio |
| Uptime do hosting | UptimeRobot / StatusCake | Alto |
| Alertas de custo Firebase | GCP Budget Alerts | Alto |
| Anomalias de acesso | Firebase Auth + Cloud Functions | Médio |

---

## 7. SLA do Sistema

### 7.1 Compromisso de Disponibilidade

| Métrica | Meta |
|---------|:----:|
| Disponibilidade mensal | 99.5% |
| Tempo máximo de indisponibilidade/mês | 3.6 horas |
| Tempo de resposta a incidente P1 | < 1 hora |
| Tempo de resposta a incidente P2 | < 4 horas |
| Janela de manutenção | Sábados 03:00-06:00 |

### 7.2 Escalação

| Nível | Responsável | Acionamento |
|-------|------------|-------------|
| L1 | Líder do turno | Primeiro contato |
| L2 | Leandro de Camargo | Se L1 não resolver em 30min |
| L3 | Suporte Firebase/GCP | Se L2 não resolver em 2h |

---

## 8. Testes de Recuperação

### 8.1 Cronograma de Testes

| Teste | Frequência | Responsável |
|-------|-----------|-------------|
| Restauração de backup Firestore | Semestral | Leandro |
| Rollback de deploy | Trimestral | Leandro |
| Operação offline (simulated) | Anual | Equipe |
| Validação de planilha contingência | Trimestral | Líderes |

### 8.2 Checklist de Teste de Backup

- [ ] Exportar backup para GCS
- [ ] Criar projeto Firebase temporário (ou emulator)
- [ ] Importar backup no projeto temporário
- [ ] Verificar contagem de documentos por coleção
- [ ] Verificar integridade de dados amostrais (10 documentos aleatórios)
- [ ] Registrar resultado e data do teste
- [ ] Apagar projeto temporário

---

## 9. Melhoria Contínua

### 9.1 Ações Pendentes

| # | Ação | Prioridade | Status |
|---|------|:---------:|:------:|
| 1 | Configurar backup automático diário | **ALTA** | ⏳ |
| 2 | Inicializar repositório Git | **ALTA** | ⏳ |
| 3 | Criar bucket GCS para backups | **ALTA** | ⏳ |
| 4 | Implementar error tracking (Sentry) | **MÉDIA** | ⏳ |
| 5 | Criar planilha de contingência impressa | **MÉDIA** | ⏳ |
| 6 | Documentar runbooks de operação | **MÉDIA** | ⏳ |
| 7 | Configurar alertas de custo GCP | **BAIXA** | ⏳ |
| 8 | Implementar health-check endpoint | **BAIXA** | ⏳ |

---

## Histórico de Revisões

| Versão | Data | Autor | Alteração |
|--------|------|-------|-----------|
| 1.0 | 2026-02-19 | Leandro de Camargo | Criação inicial |
