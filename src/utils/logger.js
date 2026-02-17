/**
 * HokkaidoMES — System Logger (ES6 Module)
 * Fase 3: Extraído de script.js (linhas 26256-26303)
 *
 * Registra ações no sistema na coleção `system_logs` do Firestore.
 * Duas funções: logSystemAction (padrão tipo/descricao) e registrarLogSistema (padrão acao/tipo).
 */

import { getDb, serverTimestamp } from '../services/firebase-client.js';

/**
 * Registra uma ação no sistema (formato tipo + descrição).
 * @param {string} tipo - Tipo da ação (ex: 'EXCLUSÃO', 'EDIÇÃO')
 * @param {string} descricao - Descrição textual da ação
 * @param {Object} [detalhes={}] - Detalhes adicionais
 */
export async function logSystemAction(tipo, descricao, detalhes = {}) {
    try {
        const db = getDb();
        const usuario = window.authSystem?.getCurrentUser();
        const now = new Date();

        await db.collection('system_logs').add({
            tipo,
            descricao,
            maquina: detalhes.maquina || detalhes.machine || null,
            usuario: usuario?.name || 'Desconhecido',
            userId: usuario?.id || null,
            detalhes,
            timestamp: serverTimestamp(),
            timestampLocal: now.toISOString(),
            data: now.toISOString().split('T')[0],
            hora: now.toTimeString().split(' ')[0]
        });

        console.log('[SYSTEM_LOG]', tipo, descricao);
    } catch (error) {
        console.error('[SYSTEM_LOG] Erro ao registrar ação:', error);
    }
}

/**
 * Registra um log no sistema (formato ação + tipo).
 * @param {string} acao - Ação realizada
 * @param {string} tipo - Tipo da ação
 * @param {Object} [detalhes={}] - Detalhes adicionais
 */
export async function registrarLogSistema(acao, tipo, detalhes = {}) {
    try {
        const db = getDb();
        const usuario = window.authSystem?.getCurrentUser();
        const now = new Date();

        await db.collection('system_logs').add({
            acao,
            tipo,
            descricao: acao,
            maquina: detalhes.machine || detalhes.maquina || null,
            usuario: usuario?.name || 'Desconhecido',
            userId: usuario?.id || null,
            detalhes,
            timestamp: serverTimestamp(),
            timestampLocal: now.toISOString(),
            data: now.toISOString().split('T')[0],
            hora: now.toTimeString().split(' ')[0]
        });

        console.log('[SYSTEM_LOG]', acao, tipo);
    } catch (error) {
        console.error('[SYSTEM_LOG] Erro ao registrar log:', error);
    }
}

// Expor globalmente para compatibilidade com código legado que usa window.logSystemAction
window.logSystemAction = logSystemAction;
