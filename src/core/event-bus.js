/**
 * HokkaidoMES — Event Bus (Pub/Sub Central)
 * Fase 1: Fundação Modular
 * 
 * Substitui a comunicação via window.* globals.
 * Qualquer módulo pode emitir e escutar eventos sem dependência direta.
 * 
 * Uso:
 *   import { EventBus } from '../core/event-bus.js';
 *   
 *   // Escutar
 *   const unsub = EventBus.on('downtime:created', (data) => { ... });
 *   
 *   // Emitir
 *   EventBus.emit('downtime:created', { id: '123', machine: 'H01' });
 *   
 *   // Parar de escutar
 *   unsub();
 */

const _listeners = new Map();

// Contadores para debug/monitoramento
let _emitCount = 0;
let _lastEvents = [];
const MAX_EVENT_LOG = 50;

export const EventBus = {
    /**
     * Registra um callback para um evento.
     * @param {string} event - Nome do evento (ex: 'downtime:created')
     * @param {Function} callback - Função a ser chamada quando o evento for emitido
     * @returns {Function} Função para cancelar a inscrição
     */
    on(event, callback) {
        if (!_listeners.has(event)) {
            _listeners.set(event, new Set());
        }
        _listeners.get(event).add(callback);
        
        // Retorna função de unsubscribe
        return () => {
            const set = _listeners.get(event);
            if (set) {
                set.delete(callback);
                if (set.size === 0) {
                    _listeners.delete(event);
                }
            }
        };
    },

    /**
     * Registra um callback que será executado apenas uma vez.
     * @param {string} event - Nome do evento
     * @param {Function} callback - Função a ser chamada
     * @returns {Function} Função para cancelar a inscrição
     */
    once(event, callback) {
        const unsub = this.on(event, (data) => {
            unsub();
            callback(data);
        });
        return unsub;
    },

    /**
     * Emite um evento para todos os listeners registrados.
     * @param {string} event - Nome do evento
     * @param {*} data - Dados a serem passados para os listeners
     */
    emit(event, data) {
        _emitCount++;
        
        // Log para debug (mantém os últimos N eventos)
        _lastEvents.push({ event, timestamp: Date.now(), hasData: data !== undefined });
        if (_lastEvents.length > MAX_EVENT_LOG) {
            _lastEvents.shift();
        }

        const set = _listeners.get(event);
        if (!set || set.size === 0) return;

        for (const cb of set) {
            try {
                cb(data);
            } catch (e) {
                console.error(`[EventBus] Erro no handler de "${event}":`, e);
            }
        }
    },

    /**
     * Remove um callback específico de um evento.
     * @param {string} event - Nome do evento
     * @param {Function} callback - A referência exata do callback a remover
     */
    off(event, callback) {
        const set = _listeners.get(event);
        if (set) {
            set.delete(callback);
            if (set.size === 0) {
                _listeners.delete(event);
            }
        }
    },

    /**
     * Remove TODOS os listeners de um evento, ou todos os eventos.
     * @param {string} [event] - Se informado, limpa só esse evento. Senão, limpa tudo.
     */
    clear(event) {
        if (event) {
            _listeners.delete(event);
        } else {
            _listeners.clear();
        }
    },

    /**
     * Retorna estatísticas para debug.
     * Acessível via console: window.EventBus.stats()
     */
    stats() {
        const eventNames = [..._listeners.keys()];
        const listenerCounts = {};
        for (const [name, set] of _listeners) {
            listenerCounts[name] = set.size;
        }
        return {
            totalEvents: eventNames.length,
            totalEmits: _emitCount,
            listeners: listenerCounts,
            recentEvents: _lastEvents.slice(-10)
        };
    }
};
