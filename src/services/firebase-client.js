/**
 * HokkaidoMES — Firebase Client
 * Fase 1: Fundação Modular
 * 
 * Wrapper fino sobre o Firebase inicializado pelo script.js legado.
 * Fornece acesso tipado ao db, auth, timestamps e helpers de batch/transaction.
 * 
 * Na Fase 3, este arquivo assumirá a inicialização direta do Firebase.
 * Por enquanto, usa window.db que já foi inicializado pelo script.js.
 */

/**
 * Retorna a instância do Firestore.
 * @returns {firebase.firestore.Firestore}
 */
export function getDb() {
    if (!window.db) {
        throw new Error('[firebase-client] window.db não disponível. O script.js já carregou?');
    }
    return window.db;
}

/**
 * Retorna o sistema de autenticação.
 * @returns {Object} authSystem do auth.js
 */
export function getAuth() {
    return window.authSystem || null;
}

/**
 * Retorna o usuário atual autenticado.
 * @returns {Object|null}
 */
export function getCurrentUser() {
    return window.authSystem?.getCurrentUser?.() || null;
}

/**
 * Retorna o papel (role) do usuário atual.
 * @returns {string} 'admin' | 'gestor' | 'pcp' | 'operador' | 'viewer'
 */
export function getCurrentUserRole() {
    const user = getCurrentUser();
    return user?.role || 'viewer';
}

/**
 * Retorna um FieldValue.serverTimestamp() para uso em writes.
 * @returns {firebase.firestore.FieldValue}
 */
export function serverTimestamp() {
    return firebase.firestore.FieldValue.serverTimestamp();
}

/**
 * Retorna um FieldValue.increment() para uso em writes.
 * @param {number} n
 * @returns {firebase.firestore.FieldValue}
 */
export function increment(n = 1) {
    return firebase.firestore.FieldValue.increment(n);
}

/**
 * Retorna um FieldValue.arrayUnion() para uso em writes.
 * @param  {...any} elements
 * @returns {firebase.firestore.FieldValue}
 */
export function arrayUnion(...elements) {
    return firebase.firestore.FieldValue.arrayUnion(...elements);
}

/**
 * Retorna um FieldValue.delete() para remover um campo.
 * @returns {firebase.firestore.FieldValue}
 */
export function deleteField() {
    return firebase.firestore.FieldValue.delete();
}

/**
 * Cria um novo batch para operações atômicas.
 * @returns {firebase.firestore.WriteBatch}
 */
export function createBatch() {
    return getDb().batch();
}

/**
 * Executa uma transaction.
 * @param {Function} updateFn - Função que recebe o transaction object
 * @returns {Promise<*>}
 */
export function runTransaction(updateFn) {
    return getDb().runTransaction(updateFn);
}

/**
 * Converte um Firestore Timestamp para Date.
 * @param {*} timestamp - Firestore Timestamp ou string ISO
 * @returns {Date|null}
 */
export function toDate(timestamp) {
    if (!timestamp) return null;
    if (timestamp.toDate) return timestamp.toDate();
    if (timestamp instanceof Date) return timestamp;
    if (typeof timestamp === 'string') return new Date(timestamp);
    if (typeof timestamp === 'number') return new Date(timestamp);
    return null;
}
