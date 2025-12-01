# Sistema de Tara das Caixas Plásticas

## Visão Geral
O sistema foi implementado para permitir o desconto automático do peso das caixas plásticas utilizadas como tara para pesagem de alguns produtos na empresa.

## Funcionalidades Implementadas

### 1. Base de Dados das Taras
- Adicionada tabela `tareBoxesDatabase` no arquivo `database.js`
- Contém o peso padrão **(em Kilos com 3 casas decimais)** da caixa plástica de cada máquina
- Máquinas cadastradas: H-01 a H-32 (conforme especificado)
- ✅ **ATUALIZADO v2.1**: Todas as taras convertidas de gramas para kilos

### 2. Interface de Usuário
Adicionados campos de tara nos seguintes formulários:

#### Formulário de Produção Rápida
- Checkbox "Usar tara da caixa plástica"
- Exibição do peso da tara quando habilitado

#### Formulário de Produção Manual
- Checkbox "Usar tara da caixa plástica"
- Exibição do peso da tara quando habilitado

#### Formulário de Perdas
- Checkbox "Usar tara da caixa plástica"
- Exibição do peso da tara quando habilitado

### 3. Lógica de Funcionamento

#### Comportamento Automático
- O campo de tara só aparece se a máquina selecionada possui tara cadastrada
- Quando uma máquina sem tara é selecionada, o campo fica oculto

#### Cálculo da Tara
- Quando o checkbox está marcado e há peso informado:
  - O sistema subtrai automaticamente o peso da tara do peso bruto informado
  - O resultado é o peso líquido do produto
  - Formato padronizado: 3 casas decimais (Ex: 2.490 kg)

#### Segurança
- O peso nunca fica negativo (mínimo sempre 0)
- Logs detalhados no console para auditoria

### 4. Pesos das Caixas Cadastradas (v2.1 - Padronizado em Kilos)

| Máquina | Peso (kg) |
|---------|----------|
| H-01    | 3.010    |
| H-02    | 3.165    |
| H-03    | 3.005    |
| H-04    | 3.425    |
| H-05    | 3.030    |
| H-07    | 3.210    |
| H-08    | 3.415    |
| H-09    | 3.030    |
| H-10    | 3.230    |
| H-11    | 3.015    |
| H-12    | 2.985    |
| H-13    | 3.305    |
| H-14    | 3.115    |
| H-15    | 3.240    |
| H-17    | 3.020    |
| H-20    | 3.255    |
| H-26    | 2.985    |
| H-27    | 3.025    |
| H-28    | 3.060    |
| H-29    | 3.265    |
| H-30    | 2.965    |
| H-31    | 3.110    |
| H-32    | 2.910    |

## ⭐ NOVAS FUNCIONALIDADES (v2.0)

### Persistência da Tara por Dia
- **Memória Inteligente**: Uma vez marcada, a opção de tara fica ativa pelo resto do dia
- **Por Máquina**: Cada máquina mantém seu próprio estado de tara
- **Limpeza Automática**: Estados de dias anteriores são removidos automaticamente

### Campos Opcionais - Quantidade OU Peso
- **Flexibilidade Total**: Informe apenas quantidade OU apenas peso - não ambos
- **Interface Clara**: Indicações visuais sobre quais campos são opcionais
- **Validação Inteligente**: Sistema aceita qualquer um dos dois campos

## Como Usar

### Uso Básico
1. **Selecionar uma máquina** que possui tara cadastrada
2. **Abrir um formulário** de produção ou perdas 
3. **Informar APENAS UM**: quantidade de peças OU peso bruto
4. **Marcar o checkbox** "Usar tara da caixa plástica" (se necessário)
5. **O sistema automaticamente** calculará e usará o peso líquido

### Persistência da Tara
- **Primera vez**: Marque "Usar tara da caixa plástica"
- **Próximos lançamentos**: O checkbox já estará marcado automaticamente
- **Válido até**: Final do dia (meia-noite)
- **Por máquina**: Cada máquina lembra seu próprio estado

## Exemplos Práticos

### Exemplo 1: Lançamento por Peso
**Cenário:** Máquina H-01, peso bruto = 5,5 kg
- Tara da caixa H-01: 3010g = 3,01 kg
- Peso líquido calculado: 5,5 - 3,01 = 2,49 kg
- **Campo quantidade**: deixar vazio
- **Campo peso**: 5,5 kg
- Sistema registrará 2,49 kg e calculará peças automaticamente

### Exemplo 2: Lançamento por Quantidade
**Cenário:** Máquina H-05, 150 peças produzidas
- **Campo quantidade**: 150
- **Campo peso**: deixar vazio
- Sistema registrará 150 peças e calculará peso automaticamente

## Benefícios

### Versão 1.0
1. **Precisão:** Eliminação de erros manuais no cálculo da tara
2. **Praticidade:** Desconto automático sem necessidade de cálculos
3. **Flexibilidade:** Uso opcional - nem todos os produtos usam caixa
4. **Rastreabilidade:** Logs completos das operações com tara
5. **Segurança:** Validações para evitar valores negativos

### Versão 2.0 (Novas Melhorias)
6. **Memória Inteligente:** Tara persiste pelo resto do dia uma vez ativada
7. **Entrada Flexível:** Lance por quantidade OU peso - não precisa preencher ambos
8. **Interface Intuitiva:** Indicações claras sobre campos opcionais
9. **Produtividade:** Menos cliques e campos para preencher
10. **Consistência:** Evita inconsistências entre peso e quantidade

## Suporte Técnico

Para dúvidas ou problemas relacionados ao sistema de tara:
- Verifique os logs no console do navegador (F12)
- Confirme se a máquina possui tara cadastrada
- Verifique se o peso informado é maior que a tara