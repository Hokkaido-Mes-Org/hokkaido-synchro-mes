/**
 * HokkaidoMES — Notification Component (ES6 Module)
 * Fase 3: Extraído de script.js (linhas 37174-37207)
 *
 * Toast notification reutilizável. Usa Tailwind CSS + Lucide icons.
 */

/**
 * Mostra uma notificação toast por 3 segundos.
 * @param {string} message - Mensagem a exibir
 * @param {'info'|'success'|'warning'|'error'} [type='info'] - Tipo visual
 */
export function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg ${
        type === 'success' ? 'bg-green-100 text-green-800 border-green-200' :
        type === 'warning' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
        type === 'error' ? 'bg-red-100 text-red-800 border-red-200' :
        'bg-blue-100 text-blue-800 border-blue-200'
    } border`;

    notification.innerHTML = `
        <div class="flex items-center gap-2">
            <i data-lucide="${
                type === 'success' ? 'check-circle' :
                type === 'warning' ? 'alert-triangle' :
                type === 'error' ? 'x-circle' : 'info'
            }" class="w-5 h-5"></i>
            <span>${message}</span>
        </div>
    `;

    document.body.appendChild(notification);

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }

    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 3000);
}

// Expor globalmente para onclick handlers inline e fallback
window.showNotification = showNotification;
