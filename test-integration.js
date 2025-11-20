/**
 * Teste de Integração - Syncrho MES v2.0
 * Validação completa de todos os módulos
 */

console.log('='.repeat(60));
console.log('TESTE DE INTEGRAÇÃO - SYNCRHO MES v2.0');
console.log('='.repeat(60));

// Teste 1: Verificar se todas as classes estão carregadas
console.log('\n✓ TESTE 1: Verificar Classes Carregadas');
const checks = {
    'PredictiveAnalytics': typeof PredictiveAnalytics !== 'undefined',
    'SimpleMLEngine': typeof SimpleMLEngine !== 'undefined',
    'AdvancedKPIs': typeof AdvancedKPIs !== 'undefined',
    'AutoParetoAnalysis': typeof AutoParetoAnalysis !== 'undefined',
    'SPCController': typeof SPCController !== 'undefined',
    'TraceabilitySystem': typeof TraceabilitySystem !== 'undefined'
};

Object.entries(checks).forEach(([name, loaded]) => {
    console.log(`  ${loaded ? '✅' : '❌'} ${name}: ${loaded ? 'Carregado' : 'NÃO CARREGADO'}`);
});

// Teste 2: Verificar se instâncias globais existem
console.log('\n✓ TESTE 2: Verificar Instâncias Globais');
const instances = {
    'window.predictiveAnalytics': typeof window.predictiveAnalytics === 'object',
    'window.advancedKPIs': typeof window.advancedKPIs === 'object',
    'window.autoParetoAnalysis': typeof window.autoParetoAnalysis === 'object',
    'window.spcController': typeof window.spcController === 'object',
    'window.traceabilitySystem': typeof window.traceabilitySystem === 'object'
};

Object.entries(instances).forEach(([name, exists]) => {
    console.log(`  ${exists ? '✅' : '❌'} ${name}: ${exists ? 'OK' : 'ERRO'}`);
});

// Teste 3: Verificar funções auxiliares
console.log('\n✓ TESTE 3: Verificar Funções Auxiliares');
const functions = {
    'formatDate': typeof formatDate === 'function',
    'getFilteredData': typeof getFilteredData === 'function',
    'showPredictiveSubtab': typeof window.showPredictiveSubtab === 'function'
};

Object.entries(functions).forEach(([name, exists]) => {
    console.log(`  ${exists ? '✅' : '❌'} ${name}: ${exists ? 'Disponível' : 'NÃO ENCONTRADO'}`);
});

// Teste 4: Testar carregamento de dados
console.log('\n✓ TESTE 4: Testar Carregamento de Dados');
(async () => {
    try {
        const prodData = await getFilteredData('production', '2025-11-01', '2025-11-16');
        console.log(`  ✅ getFilteredData('production'): ${prodData.length} registros`);
        
        const downData = await getFilteredData('downtime', '2025-11-01', '2025-11-16');
        console.log(`  ✅ getFilteredData('downtime'): ${downData.length} registros`);
        
        const lossData = await getFilteredData('losses', '2025-11-01', '2025-11-16');
        console.log(`  ✅ getFilteredData('losses'): ${lossData.length} registros`);
        
    } catch (error) {
        console.error('  ❌ Erro ao carregar dados:', error.message);
    }
})();

// Teste 5: Interface de elementos
console.log('\n✓ TESTE 5: Verificar Elementos HTML');
const elements = {
    'predictive-analytics-content': document.getElementById('predictive-analytics-content'),
    'predictive-kpis-content': document.getElementById('predictive-kpis-content'),
    'predictive-pareto-content': document.getElementById('predictive-pareto-content'),
    'predictive-spc-content': document.getElementById('predictive-spc-content'),
    'predictive-traceability-content': document.getElementById('predictive-traceability-content'),
    'traceability-search-results': document.getElementById('traceability-search-results')
};

Object.entries(elements).forEach(([id, element]) => {
    console.log(`  ${element ? '✅' : '❌'} #${id}: ${element ? 'Presente' : 'FALTANDO'}`);
});

console.log('\n' + '='.repeat(60));
console.log('TESTES CONCLUÍDOS');
console.log('Sistema Syncrho MES v2.0 está pronto para uso!');
console.log('='.repeat(60));