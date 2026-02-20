/**
 * HokkaidoMES — Entry Point (Módulos ES6)
 * Fase 1: Fundação Modular
 * 
 * Este é o ponto de entrada do sistema modular.
 * Carrega DEPOIS do script.js (via <script type="module">).
 * 
 * Responsabilidades:
 *   1. Esperar o legado (script.js) terminar de inicializar
 *   2. Conectar a ponte legado ↔ módulos
 *   3. Disponibilizar services para teste
 * 
 * IMPORTANTE: Este arquivo NÃO substitui o script.js.
 *             Ele roda EM PARALELO, adicionando a nova camada.
 */

import { initBridge } from './legacy/bridge.js';
import { FLAGS } from './config/feature-flags.js';

// ── Fase 3A: Shared Utilities (self-register on window) ──
import './utils/number.utils.js';
import './utils/plan.utils.js';
import './utils/product.utils.js';
import './components/notification.js';
import './utils/logger.js';
// REMOVIDO: listener-manager.js duplicava o listenerManager do script.js
// e sobrescrevia window.listenerManager com instância vazia, causando conflito.

// ── Fase 4B: Write Invalidation (auto-register window.*) ──
import './utils/write-invalidation.js';

// Expor flags IMEDIATAMENTE — antes de qualquer await.
// Permite que script.js consulte window.__FLAGS para decidir
// se usa módulo moderno ou código legado.
window.__FLAGS = FLAGS;

/**
 * Espera o script.js inicializar window.db e window.DataStore.
 * Timeout de 15s para evitar loop infinito.
 * @returns {Promise<boolean>} true se legado está pronto
 */
function waitForLegacy() {
    return new Promise((resolve) => {
        // Já está pronto?
        if (window.db && window.DataStore) {
            return resolve(true);
        }

        let elapsed = 0;
        const interval = 100; // 100ms
        const maxWait = 15000; // 15s

        const check = setInterval(() => {
            elapsed += interval;

            if (window.db && window.DataStore) {
                clearInterval(check);
                resolve(true);
            } else if (elapsed >= maxWait) {
                clearInterval(check);
                console.warn('[Modules] Timeout: window.db ou window.DataStore não disponíveis após 15s');
                resolve(false);
            }
        }, interval);
    });
}

/**
 * Bootstrap do sistema modular.
 */
async function bootstrap() {
    console.log('🔧 [Modules] Iniciando bootstrap...');
    
    const legacyReady = await waitForLegacy();
    
    if (!legacyReady) {
        console.error('🔧 [Modules] Legado não inicializou. Módulos desativados.');
        return;
    }

    console.log('🔧 [Modules] Legado detectado. Conectando ponte...');
    
    try {
        initBridge();
        
        // ── Fase 2: Log dos controllers ativos ──
        const activeFlags = Object.entries(FLAGS)
            .filter(([k, v]) => k.startsWith('USE_MODULAR_') && v)
            .map(([k]) => k.replace('USE_MODULAR_', ''));
        const inactiveFlags = Object.entries(FLAGS)
            .filter(([k, v]) => k.startsWith('USE_MODULAR_') && !v)
            .map(([k]) => k.replace('USE_MODULAR_', ''));
        
        console.log('✅ [Modules] Sistema modular ativo (Fase 2)');
        console.log('✅ [Modules] script.js = INTACTO | src/ = PARALELO');
        console.log('─────────────────────────────────────────────');
        console.log(`  Controllers MODULARES (${activeFlags.length}): ${activeFlags.join(', ')}`);
        console.log(`  Controllers LEGADO    (${inactiveFlags.length}): ${inactiveFlags.join(', ')}`);
        console.log('─────────────────────────────────────────────');
    } catch (error) {
        console.error('🔧 [Modules] Erro no bootstrap:', error);
    }
}

bootstrap();
