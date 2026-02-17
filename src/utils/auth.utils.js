/**
 * HokkaidoMES — Auth Utilities (ES6 Module)
 * Fase 3: Extraído de script.js (linhas 3620-3789)
 *
 * Funções de autenticação e identificação de usuário.
 * Depende de window.authSystem (injetado pelo auth.js legado).
 */

/** Cache do nome resolvido para evitar re-resolução */
let cachedResolvedUserName = null;

/**
 * Recupera sessão diretamente do armazenamento (sessionStorage > localStorage).
 * @returns {Object|null}
 */
export function getStoredUserSession() {
    const storageSources = [() => sessionStorage, () => localStorage];
    for (const getStorage of storageSources) {
        try {
            const storage = getStorage();
            if (!storage) continue;
            const data = storage.getItem('synchro_user');
            if (data) {
                const parsed = JSON.parse(data);
                if (parsed && typeof parsed === 'object' && typeof parsed.name === 'string') {
                    parsed.name = parsed.name.trim();
                }
                return parsed;
            }
        } catch (error) {
            console.warn('[Auth] Erro ao ler sessão armazenada:', error);
        }
    }
    return null;
}

/**
 * Obtém usuário ativo com fallback para sessão armazenada.
 * @returns {Object}
 */
export function getActiveUser() {
    const authUser = window.authSystem?.getCurrentUser?.();
    if (authUser && (authUser.username || authUser.name)) {
        return authUser;
    }

    const storedUser = getStoredUserSession();
    if (storedUser) {
        const sanitizedUser = { ...storedUser };
        if (typeof sanitizedUser.name === 'string') {
            sanitizedUser.name = sanitizedUser.name.trim();
        }
        if (window.authSystem?.setCurrentUser) {
            window.authSystem.setCurrentUser(sanitizedUser);
        } else if (window.authSystem) {
            window.authSystem.currentUser = sanitizedUser;
        }
        return sanitizedUser;
    }

    return {};
}

/**
 * Verifica se o usuário atual é gestor, suporte, líder ou admin.
 * @returns {boolean}
 */
export function isUserGestorOrAdmin() {
    const user = getActiveUser();
    if (!user) return false;

    const isAuthorizedAdmin =
        user.name === 'Leandro Camargo' || user.email === 'leandro@hokkaido.com.br' ||
        user.name === 'Davi Batista' || user.email === 'davi@hokkaido.com.br' ||
        user.role === 'suporte';
    if (isAuthorizedAdmin) return true;

    return user.role === 'gestor' || user.role === 'lider';
}

/**
 * Deriva nome legível a partir de um identificador (username ou email).
 * @param {string} identifier
 * @returns {string}
 */
function deriveNameFromIdentifier(identifier) {
    if (!identifier || typeof identifier !== 'string') return '';
    const trimmed = identifier.trim();
    if (!trimmed) return '';
    const base = trimmed.includes('@') ? trimmed.split('@')[0] : trimmed;
    const sanitized = base.replace(/[^\w\u00C0-\u00FF.\-_\s]/g, ' ');
    const parts = sanitized.split(/[._\-\s]+/).filter(Boolean);
    if (!parts.length) return '';
    return parts.map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join(' ');
}

/**
 * Persiste o nome resolvido no cache e no authSystem.
 * @param {string} name
 * @param {Object} currentUser
 */
function persistResolvedUserName(name, currentUser) {
    if (!name || typeof name !== 'string') return;
    cachedResolvedUserName = name.trim();
    if (!cachedResolvedUserName) return;
    if (currentUser && typeof currentUser === 'object') {
        const updatedUser = { ...currentUser, name: cachedResolvedUserName };
        if (window.authSystem?.setCurrentUser) {
            window.authSystem.setCurrentUser(updatedUser);
        } else if (window.authSystem) {
            window.authSystem.currentUser = updatedUser;
        }
    }
}

/**
 * Obtém o nome do usuário atual com cadeia de fallback robusta.
 * Fontes: authSystem → displayName → username derivation → email → stored session → 'Desconhecido'
 * @returns {string}
 */
export function getCurrentUserName() {
    if (cachedResolvedUserName && cachedResolvedUserName !== 'Desconhecido') {
        return cachedResolvedUserName;
    }

    const currentUser = getActiveUser();

    const candidateSources = [
        currentUser?.name,
        currentUser?.displayName,
        currentUser?.fullName,
        currentUser?.profile?.name,
        currentUser?.user?.name,
        currentUser?.user?.displayName
    ];

    for (const source of candidateSources) {
        if (typeof source === 'string' && source.trim()) {
            persistResolvedUserName(source.trim(), currentUser);
            return cachedResolvedUserName;
        }
    }

    const usernameDerived = deriveNameFromIdentifier(currentUser?.username || currentUser?.user?.username);
    if (usernameDerived) {
        persistResolvedUserName(usernameDerived, currentUser);
        return cachedResolvedUserName;
    }

    const emailDerived = deriveNameFromIdentifier(currentUser?.email || currentUser?.user?.email);
    if (emailDerived) {
        persistResolvedUserName(emailDerived, currentUser);
        return cachedResolvedUserName;
    }

    const storedSession = getStoredUserSession();
    if (storedSession && typeof storedSession === 'object') {
        const storedCandidates = [
            storedSession.name,
            storedSession.displayName,
            storedSession.fullName
        ];
        for (const stored of storedCandidates) {
            if (typeof stored === 'string' && stored.trim()) {
                persistResolvedUserName(stored.trim(), currentUser || storedSession);
                return cachedResolvedUserName;
            }
        }

        const fallbackFromIdentifier = deriveNameFromIdentifier(storedSession.username || storedSession.email);
        if (fallbackFromIdentifier) {
            persistResolvedUserName(fallbackFromIdentifier, currentUser || storedSession);
            return cachedResolvedUserName;
        }
    }

    cachedResolvedUserName = 'Desconhecido';
    return cachedResolvedUserName;
}

/**
 * Exibe notificação de permissão negada.
 * Importa showNotification para evitar dependência circular.
 * @param {string} action
 * @returns {false}
 */
export function showPermissionDeniedNotification(action = 'realizar esta ação') {
    // Usa window.showNotification para evitar dependência circular com notification.js
    const notify = window.showNotification || console.warn;
    const message = `⮝ Permissão negada: Apenas gestores podem ${action}.`;
    notify(message, 'error');
    return false;
}

/**
 * Invalida o cache de nome do usuário (útil após logout/login).
 */
export function clearUserNameCache() {
    cachedResolvedUserName = null;
}
