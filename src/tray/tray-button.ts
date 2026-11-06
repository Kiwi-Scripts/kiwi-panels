import { renderIcon, span } from '../dom/h';
import type { TrayCommand, TrayItem } from './tray';

export interface TrayButton {
    readonly element: HTMLButtonElement;
    /** Brings the button up to date with the item. */
    sync( item: TrayItem ): void;
}

export interface TrayButtonOptions {
    /** Shows the title next to the icon. */
    label?: boolean;
}

/**
 * A button for one panel, shared by the built-in trays. Open panels light up (`kp-on`); a minimized panel that still holds
 * something is outlined (`kp-has`).
 */
export function createTrayButton( item: TrayItem, onClick: () => void, options: TrayButtonOptions = {} ): TrayButton {
    const element = document.createElement( 'button' );
    element.type = 'button';
    element.className = 'kp-tray-btn';
    element.dataset.panel = item.id;
    element.onclick = onClick;
    element.append( renderIcon( item.icon, item.title ) );
    const label = options.label ? span( 'kp-tray-label', item.title ) : undefined;
    if ( label ) {
        element.append( label );
    }
    const count = span( 'kp-tray-badge', '' );
    count.style.display = 'none';
    element.append( count );

    return {
        element,
        sync( next ) {
            element.title = next.title;
            element.classList.toggle( 'kp-on', next.state === 'open' );
            element.classList.toggle( 'kp-has', next.state === 'minimized' && next.active );
            if ( label ) {
                label.textContent = next.title;
            }
            const shown = next.badge !== null && next.badge !== '' && next.badge !== 0;
            count.style.display = shown ? '' : 'none';
            count.textContent = shown ? String( next.badge ) : '';
        }
    };
}

/** Keeps a keyed set of buttons in step with the items: new ones are created, gone ones removed, the order follows `items`. */
export function syncTrayButtons(
    parent: HTMLElement, buttons: Map<string, TrayButton>, items: readonly TrayItem[],
    create: ( item: TrayItem ) => TrayButton
): void {
    const ids = new Set( items.map( item => item.id ) );
    for ( const [id, button] of buttons ) {
        if ( !ids.has( id ) ) {
            button.element.remove();
            buttons.delete( id );
        }
    }
    items.forEach( ( item, index ) => {
        let button = buttons.get( item.id );
        if ( !button ) {
            buttons.set( item.id, button = create( item ) );
        }
        button.sync( item );
        if ( parent.children[index] !== button.element ) {
            parent.insertBefore( button.element, parent.children[index] ?? null );
        }
    } );
}

/** A button for a tray command; it is never lit, since a command has no state. */
export function createCommandButton( command: TrayCommand ): HTMLButtonElement {
    const element = document.createElement( 'button' );
    element.type = 'button';
    element.className = 'kp-tray-btn kp-tray-cmd';
    element.dataset.command = command.id;
    element.title = command.title;
    element.onclick = () => command.onClick();
    element.append( renderIcon( command.icon, command.title ) );
    return element;
}
