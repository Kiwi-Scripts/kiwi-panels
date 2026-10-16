import { Z_PANEL_BASE, Z_PANEL_ZONE } from '../constants';

/**
 * The panels of the overlay from bottom to top. The position in the stack is the offset of their z-index in the panel zone, so
 * the panel that was shown or clicked last is always on top, and the ones it passes fall down by one.
 */
export interface PanelStack {
    /** Adds a panel on top of the stack. It is raised again whenever it is shown or clicked. */
    add( panel: HTMLElement ): void;
    remove( panel: HTMLElement ): void;
    /** Moves a panel on top of all others. */
    raise( panel: HTMLElement ): void;
    /** The panels from bottom to top. */
    order(): readonly HTMLElement[];
    dispose(): void;
}

/** @param runOutside the listeners must not trigger change detection of a host framework. */
export function createPanelStack( runOutside: <T>( fn: () => T ) => T = fn => fn() ): PanelStack {
    // The last one is on top.
    const order: HTMLElement[] = [];
    const cleanups = new Map<HTMLElement, () => void>();

    const apply = (): void => {
        order.forEach( ( panel, i ) => {
            const zIndex = String( Z_PANEL_BASE + Math.min( i, Z_PANEL_ZONE - 1 ) );
            if ( panel.style.zIndex !== zIndex ) {
                panel.style.zIndex = zIndex;
            }
        } );
    };

    const raise = ( panel: HTMLElement ): void => {
        const index = order.indexOf( panel );
        if ( index >= 0 && index < order.length - 1 ) {
            order.splice( index, 1 );
            order.push( panel );
            apply();
        }
    };

    const remove = ( panel: HTMLElement ): void => {
        const index = order.indexOf( panel );
        if ( index >= 0 ) {
            order.splice( index, 1 );
            cleanups.get( panel )?.();
            cleanups.delete( panel );
            apply();
        }
    };

    return {
        raise,
        remove,
        order: () => order,
        add: panel => {
            if ( order.includes( panel ) ) {
                return;
            }
            order.push( panel );
            apply();
            // Capturing, so that a child that stops the event does not keep the panel down.
            const onDown = (): void => raise( panel );
            runOutside( () => panel.addEventListener( 'pointerdown', onDown, true ) );
            cleanups.set( panel, () => panel.removeEventListener( 'pointerdown', onDown, true ) );
        },
        dispose: () => {
            cleanups.forEach( cleanup => cleanup() );
            cleanups.clear();
            order.length = 0;
        }
    };
}
