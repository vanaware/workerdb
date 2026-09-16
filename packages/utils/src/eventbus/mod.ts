// packages/utils/src/eventbus/mod.ts
// exportado como @workerdb/utils/eventbus

/**
 * Barramento de Eventos Interno do WorkerDB.
 * Substitui a necessidade de espalhar addEventListener customizados pela aplicação.
 * Garante tipagem estrita entre emissores e receptores.
 *
 * IMPORTANTE: Este é o contrato único. Se um arquivo tenta emitir um evento que não está aqui,
 * o TypeScript irá falhar, protegendo a aplicação de erros de digitação ou eventos órfãos.
 */
type EventMap = {
  // ==========================================
  // 1. COMUNICAÇÃO SW -> UI (Notificações de Estado)
  // ==========================================
  "sw:notify:pong-version": { version: string };

  // ==========================================
  // 2. EVENTOS DE REDE E CONECTIVIDADE
  // ==========================================
  "workerdb:network:online": void;
  "workerdb:network:offline": void;
  "workerdb:network:sync-completed": { syncedCount: number };

  // ==========================================
  // 3. EVENTOS DE HANDSHAKE E SW (Internos / Entrada)
  // ==========================================
  "workerdb:sw:ready": void;
  "workerdb:sw:message-received": { type: string; payload: unknown };

  // ==========================================
  // 4. EVENTOS DE UI E NAVEGAÇÃO
  // ==========================================
  "workerdb:ui:route-changed": {
    path: string;
    params: Record<string, string>;
  };
  "workerdb:ui:theme-changed": { theme: "light" | "dark" };
  "workerdb:ui:config-updated": { key: string; value: unknown };

  // ==========================================
  // 5. EVENTOS DE CICLO DE VIDA DO APP
  // ==========================================
  "workerdb:app:backgrounded": void;
  "workerdb:app:foregrounded": void;
};

type EventCallback<T,> = (payload: T,) => void;

type EventCallbackSet = Set<EventCallback<unknown>>;

class EventBusImpl {
  private listeners = new Map<keyof EventMap, EventCallbackSet>();

  /**
   * Assina um evento interno.
   * Retorna uma função de cleanup para remover o listener (evita vazamentos).
   */
  on<K extends keyof EventMap,>(
    event: K,
    callback: EventCallback<EventMap[K]>,
  ): () => void {
    if (!this.listeners.has(event,)) {
      this.listeners.set(event, new Set(),);
    }

    const callbacks = this.listeners.get(event,) as EventCallbackSet;
    callbacks.add(callback as EventCallback<unknown>,);

    // Retorna função de unsubscribe
    return () => {
      callbacks.delete(callback as EventCallback<unknown>,);
      if (callbacks.size === 0) {
        this.listeners.delete(event,);
      }
    };
  }

  /**
   * Emite um evento interno.
   */
  emit<K extends keyof EventMap,>(
    event: K,
    ...args: EventMap[K] extends void ? [] : [EventMap[K],]
  ): void {
    const callbacks = this.listeners.get(event,);
    if (callbacks) {
      const payload = args[0];
      for (const callback of callbacks) {
        try {
          callback(payload,);
        } catch (error) {
          console.error(
            `[EventBus] Erro no listener do evento '${String(event,)}':`,
            error,
          );
        }
      }
    }
  }
}

// Instância Singleton
export const EventBus = new EventBusImpl();

/**
 * Hook utilitário para Preact (usar dentro de componentes).
 * Garante que o listener seja removido automaticamente quando o componente desmontar.
 */
export function useEvent<K extends keyof EventMap,>(
  event: K,
  callback: EventCallback<EventMap[K]>,
) {
  // A implementação real do useEffect será feita na camada de UI.
  // Aqui apenas retornamos a função de cleanup do EventBus.
  return EventBus.on(event, callback,);
}
