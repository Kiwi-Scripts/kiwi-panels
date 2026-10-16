import type { AnyPos, DockSide, PanelSize, PanelSnapshot, PanelState } from '../types';
import type { StorageAdapter } from './storage';

export interface PanelPersistence {
    load( id: string ): PanelSnapshot | undefined;
    save( id: string, snapshot: PanelSnapshot ): void;
    clear( id: string ): void;
}

const STATES: PanelState[] = ['closed', 'open', 'minimized'];

const isNumber = ( value: unknown ): value is number => typeof value === 'number' && Number.isFinite( value );

function readPos( value: any ): AnyPos | undefined {
    if ( isNumber( value?.top ) && isNumber( value?.left ) ) {
        return { left: value.left, top: value.top };
    }
    if ( isNumber( value?.top ) && isNumber( value?.right ) ) {
        return { right: value.right, top: value.top };
    }
    return undefined;
}

function readSize( value: any ): Partial<PanelSize> | undefined {
    const size: Partial<PanelSize> = {};
    if ( isNumber( value?.width ) ) {
        size.width = value.width;
    }
    if ( isNumber( value?.height ) ) {
        size.height = value.height;
    }
    return size.width !== undefined || size.height !== undefined ? size : undefined;
}

/** Stored data may come from an older version or was edited by hand, so every field is checked. */
function parse( raw: string | null ): PanelSnapshot | undefined {
    if ( !raw ) {
        return undefined;
    }
    try {
        const data = JSON.parse( raw );
        return {
            state: STATES.includes( data.state ) ? data.state : 'closed',
            collapsed: data.collapsed === true,
            dock: ( [ 'left', 'right' ] as ( DockSide | null )[] ).includes( data.dock ) ? data.dock : null,
            pos: readPos( data.pos ),
            size: readSize( data.size )
        };
    } catch {
        return undefined;
    }
}

export function createPanelPersistence( storage: StorageAdapter ): PanelPersistence {
    return {
        load: id => parse( storage.get( id ) ),
        save: ( id, snapshot ) => storage.set( id, JSON.stringify( snapshot ) ),
        clear: id => storage.remove( id )
    };
}
