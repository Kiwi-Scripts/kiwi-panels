import { DEFAULT_STORAGE_PREFIX } from '../constants';

/** Where panel state is kept. Values are strings; keys are already namespaced by the adapter. */
export interface StorageAdapter {
    get( key: string ): string | null;
    set( key: string, value: string ): void;
    remove( key: string ): void;
}

/** Keeps everything in memory only; also the fallback when web storage is not available. */
export function memoryStorage(): StorageAdapter {
    const data = new Map<string, string>();
    return {
        get: key => data.get( key ) ?? null,
        set: ( key, value ) => void data.set( key, value ),
        remove: key => void data.delete( key )
    };
}

/** Wraps a `Storage`; every access is guarded, since web storage throws when blocked or full. */
export function webStorage( storage: () => Storage, prefix = DEFAULT_STORAGE_PREFIX ): StorageAdapter {
    const guard = <T>( fn: () => T, fallback: T ): T => {
        try {
            return fn();
        } catch {
            return fallback;
        }
    };
    return {
        get: key => guard( () => storage().getItem( `${prefix}:${key}` ), null ),
        set: ( key, value ) => guard( () => storage().setItem( `${prefix}:${key}`, value ), undefined ),
        remove: key => guard( () => storage().removeItem( `${prefix}:${key}` ), undefined )
    };
}

export const sessionStorageAdapter = ( prefix?: string ): StorageAdapter => webStorage( () => sessionStorage, prefix );
export const localStorageAdapter = ( prefix?: string ): StorageAdapter => webStorage( () => localStorage, prefix );
