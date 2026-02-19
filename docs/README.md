# HokkaidoMES — Documentação do Sistema

> **Versão:** 1.0 • **Data:** Fevereiro 2026  
> **Sistema:** HokkaidoMES (Manufacturing Execution System)  
> **Responsável:** Leandro de Camargo

---

## Sobre o Sistema

O **HokkaidoMES** é um sistema web de Execução de Manufatura (MES) para a indústria de injeção plástica Hokkaido. Gerencia todo o ciclo operacional: produção em tempo real, paradas de máquina, planejamento, ordens de produção, qualidade, ferramentaria e KPIs (OEE).

**Stack:** HTML5 + JavaScript (ES6 Modules) + Firebase (Firestore) + TailwindCSS + Chart.js

---

## Índice da Documentação

### Documentos Operacionais

| # | Documento | Descrição | Público-Alvo |
|---|-----------|-----------|-------------|
| 1 | [GUIA-OPERACIONAL.md](GUIA-OPERACIONAL.md) | Manual do usuário com instruções de uso de cada aba, login, lançamentos, paradas, análises e relatórios | Operadores, Gestores, Líderes |
| 2 | [FUNCOES-ATIVAS-SISTEMA.md](FUNCOES-ATIVAS-SISTEMA.md) | Resumo das principais funções, componentes, serviços e fluxos operacionais ativos no sistema | Todos |

### Documentos Técnicos

| # | Documento | Descrição | Público-Alvo |
|---|-----------|-----------|-------------|
| 3 | [MANUAL-TECNICO.md](MANUAL-TECNICO.md) | Arquitetura completa, estrutura de arquivos, padrões de código, feature flags, sistema de cache, variáveis globais, debug e troubleshooting | Desenvolvedores |
| 4 | [DICIONARIO-DADOS.md](DICIONARIO-DADOS.md) | Todas as 22+ coleções Firestore com campos, tipos, obrigatoriedade, relações e índices recomendados | Desenvolvedores, DBA |
| 5 | [ARQUITETURA-MODULAR-MES.md](ARQUITETURA-MODULAR-MES.md) | Plano de refatoração: migração de monolito para ES6 Modules em 3 fases | Desenvolvedores |

### Documentos de Governança e Segurança

| # | Documento | Descrição | Público-Alvo |
|---|-----------|-----------|-------------|
| 6 | [GOVERNANCA-E-SEGURANCA.md](GOVERNANCA-E-SEGURANCA.md) | Políticas de segurança, RBAC, auditoria, classificação de dados, conformidade LGPD, plano de ação de segurança, gestão de incidentes | Gestão, TI, Compliance |

### Documentos de Continuidade e Qualidade

| # | Documento | Descrição | Público-Alvo |
|---|-----------|-----------|-------------|
| 7 | [PLANO-CONTINUIDADE-BACKUP.md](PLANO-CONTINUIDADE-BACKUP.md) | BIA, estratégia de backup, plano de recuperação de desastres (DRP), SLA, procedimentos de contingência, monitoramento | Gestão, TI |
| 8 | [TESTES-E-QUALIDADE.md](TESTES-E-QUALIDADE.md) | Estratégia de testes (unitários, integração, E2E), checklists de regressão, critérios de aceitação, métricas de qualidade | Desenvolvedores, QA |
| 9 | [CHANGELOG-E-VERSIONAMENTO.md](CHANGELOG-E-VERSIONAMENTO.md) | Política de versionamento semântico, gestão de mudanças, checklist de deploy, changelog, política de manutenção | Desenvolvedores, Gestão |

### Documentos de Análise

| # | Documento | Descrição | Público-Alvo |
|---|-----------|-----------|-------------|
| 10 | [ANALISE-OTIMIZACAO-FIREBASE.md](ANALISE-OTIMIZACAO-FIREBASE.md) | Análise de leituras Firebase e otimização de custos | Desenvolvedores |
| 11 | [ESTUDO-LEITURAS-POR-ABA.md](ESTUDO-LEITURAS-POR-ABA.md) | Estudo detalhado de leituras Firestore por aba | Desenvolvedores |
| 12 | [MAPA-ARQUIVOS-DEPLOY.md](MAPA-ARQUIVOS-DEPLOY.md) | Mapa de arquivos para deploy | DevOps |
| 13 | [N8N-AUTOMACAO-PLANO-ACAO.md](N8N-AUTOMACAO-PLANO-ACAO.md) | Plano de automação com n8n | Automação |
| 14 | [UNIFICACAO-PARADAS-DETALHADA.md](UNIFICACAO-PARADAS-DETALHADA.md) | Análise de unificação de paradas | Desenvolvedores |

---

## Visão Geral da Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                     BROWSER (SPA)                           │
│  ┌────────┐  ┌──────────────┐  ┌──────────────────────────┐│
│  │auth.js │  │  script.js   │  │   src/ (ES6 Modules)     ││
│  │ (RBAC) │  │  (19K lines) │  │ 17 controllers           ││
│  │        │  │  Legacy core │  │  8 services               ││
│  │ 4 roles│  │  Firebase    │  │  8 utils + 3 core        ││
│  └────────┘  │  init, cache │  │  bridge.js (ponte)       ││
│              └──────┬───────┘  └────────────┬─────────────┘│
│                     │                        │              │
│                     └────────────┬───────────┘              │
└──────────────────────────────────┼──────────────────────────┘
                                   │ HTTPS
                          ┌────────▼────────┐
                          │    FIREBASE     │
                          │  Cloud Firestore│
                          │  (22+ coleções) │
                          │  Firebase Host. │
                          └─────────────────┘
```

---

## Números do Sistema

| Métrica | Valor |
|---------|:-----:|
| Linhas de código total | ~63.000 |
| script.js (legado) | 19.047 linhas |
| Controllers ES6 | 17 arquivos |
| Services ES6 | 8 arquivos |
| Coleções Firestore | 22+ |
| Abas de navegação | 13 |
| Perfis de acesso | 4 (operador, gestor, líder, suporte) |
| Usuários cadastrados | ~60+ |
| Feature Flags | 20 (todos ativos) |
| Páginas HTML | 5 |

---

## Perfis de Acesso

| Perfil | Escopo |
|--------|--------|
| **Operador** | Lançamento de produção, paradas, perdas |
| **Gestor** | Planejamento, ordens, relatórios, Dashboard TV |
| **Líder** | Gestão de turno, escalas, setup, ferramentaria |
| **Suporte** | Acesso completo a todas as funcionalidades |

---

## Links Rápidos

- **Firebase Console:** https://console.firebase.google.com/project/hokkaido-synchro
- **Sistema (Produção):** https://hokkaido-synchro.web.app
- **Dashboard TV:** https://hokkaido-synchro.web.app/dashboard-tv.html
- **Status Firebase:** https://status.firebase.google.com

---

## Manutenção da Documentação

| Aspecto | Política |
|---------|---------|
| **Revisão** | A cada release ou mudança significativa |
| **Responsável** | Desenvolvedor que fez a mudança |
| **Formato** | Markdown (`.md`) no diretório `docs/` |
| **Versionamento** | Tabela "Histórico de Revisões" em cada documento |
| **Aprovação** | Leandro de Camargo (aprovação final) |

---

> *Documentação gerada em Fevereiro 2026. Manter atualizada a cada nova versão do sistema.*
