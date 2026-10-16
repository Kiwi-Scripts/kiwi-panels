/** A tiny typed emitter. `Events` maps event names to their payloads. */
export interface Emitter<Events extends Record<string, unknown>> {
    on<K extends keyof Events>( type: K, listener: ( payload: Events[K] ) => void ): () => void;
    emit<K extends keyof Events>( type: K, payload: Events[K] ): void;
    clear(): void;
}

export function createEmitter<Events extends Record<string, unknown>>(): Emitter<Events> {
    const listeners = new Map<keyof Events, Set<( payload: any ) => void>>();
    return {
        on( type, listener ) {
            let set = listeners.get( type );
            if ( !set ) {
                listeners.set( type, set = new Set() );
            }
            set.add( listener );
            return () => set.delete( listener ) && undefined;
        },
        emit( type, payload ) {
            // Copied, so that listeners may unsubscribe while being called.
            for ( const listener of Array.from( listeners.get( type ) ?? [] ) ) {
                try {
                    listener( payload );
                } catch ( error ) {
                    console.error( `[kiwi-panels] listener of "${String( type )}" failed:`, error );
                }
            }
        },
        clear: () => listeners.clear()
    };
}
