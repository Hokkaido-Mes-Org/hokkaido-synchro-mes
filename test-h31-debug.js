/**
 * Script de teste para debug dos dados da máquina H31
 * Execute no console do navegador após carregar a página
 */

window.testH31Debug = async function() {
    console.log('=== DEBUG H31 ===\n');

    // 1. Verificar se machineCardData tem H31
    console.log('1. machineCardData["H31"]:', window.machineCardData?.['H31']);
    
    // 2. Verificar selectedMachineData
    console.log('\n2. selectedMachineData:', window.selectedMachineData);

    // 3. Tentar chamar getPlanPieceWeightInfo
    if (typeof window.getPlanPieceWeightInfo === 'function') {
        const h31Data = window.machineCardData?.['H31'];
        const pieceWeightInfo = window.getPlanPieceWeightInfo(h31Data);
        console.log('\n3. getPlanPieceWeightInfo(H31 data):', pieceWeightInfo);
    }

    // 4. Tentar chamar getActivePieceWeightGrams
    if (typeof window.getActivePieceWeightGrams === 'function') {
        const h31Data = window.machineCardData?.['H31'];
        const pieceWeightGrams = window.getActivePieceWeightGrams(h31Data);
        console.log('\n4. getActivePieceWeightGrams(H31 data):', pieceWeightGrams, 'gramas');
    }

    // 5. Tentar chamar getCatalogPieceWeight
    if (typeof window.getCatalogPieceWeight === 'function') {
        const h31Data = window.machineCardData?.['H31'];
        const catalogWeight = window.getCatalogPieceWeight(h31Data);
        console.log('\n5. getCatalogPieceWeight(H31 data):', catalogWeight, 'gramas');
    }

    // 6. Verificar dados do planejamento (planning)
    const h31Plan = window.machineCardData?.['H31'];
    if (h31Plan) {
        console.log('\n6. Dados do planejamento H31:');
        console.log('   - piece_weight:', h31Plan.piece_weight);
        console.log('   - piece_weight_grams:', h31Plan.piece_weight_grams);
        console.log('   - weight:', h31Plan.weight);
        console.log('   - product_cod:', h31Plan.product_cod);
        console.log('   - product_code:', h31Plan.product_code);
        console.log('   - product:', h31Plan.product);
        console.log('   - machine:', h31Plan.machine);
        console.log('   - planned_quantity:', h31Plan.planned_quantity);
        console.log('   - latest_piece_weight_grams:', h31Plan.latest_piece_weight_grams);
    }

    // 7. Testar conversão de peso
    console.log('\n7. Teste de conversão: 1kg com peso médio 0.2g');
    if (typeof window.calculateQuantityFromGrams === 'function' && typeof window.kgToGrams === 'function') {
        const testWeightKg = 1;
        const testWeightGrams = window.kgToGrams(testWeightKg);
        const testPieceWeight = 0.2;
        const result = window.calculateQuantityFromGrams(testWeightGrams, testPieceWeight);
        console.log(`   - ${testWeightKg}kg = ${testWeightGrams}g`);
        console.log(`   - Peso da peça: ${testPieceWeight}g`);
        console.log(`   - Resultado da conversão:`, result);
    }

    console.log('\n=== FIM DEBUG ===');
};

// Executar automaticamente se chamado
console.log('Função de teste criada. Execute: testH31Debug()');
