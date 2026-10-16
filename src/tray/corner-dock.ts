import { div, svgIcon } from '../dom/h';
import type { Tray, TrayActions, TrayItem } from './tray';
import { createTrayButton, syncTrayButtons, type TrayButton } from './tray-button';

export type Corner = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';

export interface CornerDockOptions {
    /** Default: 'bottom-right'. */
    corner?: Corner;
    /** SVG path (24x24) of the launcher. Default: a grid. */
    icon?: string;
}

const ICON_GRID = 'M4 8h4V4H4v4zm6 12h4v-4h-4v4zm-6 0h4v-4H4v4zm0-6h4v-4H4v4zm6 0h4v-4h-4v4zm6-10v4h4V4h-4zm-6 4h4V4h-4v4zm6 6h4v-4h-4v4zm0 6h4v-4h-4v4z';
const ICON_PIN = 'M16 9V4h1c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3z';

/**
 * A round launcher in a corner of the viewport. Hovering it slides a row of buttons out next to it, one per panel; the pin button
 * keeps the row open. Without a modifier key, clicking the launcher pins the row too.
 */
export function cornerDock( options: CornerDockOptions = {} ): Tray {
    const corner = options.corner ?? 'bottom-right';
    const [vertical, horizontal] = corner.split( '-' );
    const buttons = new Map<string, TrayButton>();
    let root: HTMLElement | undefined;
    let launcher: HTMLButtonElement | undefined;
    let pin: HTMLButtonElement | undefined;
    let inner: HTMLElement | undefined;
    let actions: TrayActions | undefined;

    const toggle = ( state?: boolean ) => {
        root?.classList.toggle( 'kp-tray-pinned', state );
        pin?.classList.toggle( 'kp-on', !!root?.classList.contains( 'kp-tray-pinned' ) );
    };

    return {
        trayHotkey: 'KeyT',
        toggle,
        mount( container, tray ) {
            actions = tray;
            root = div( `kp-tray kp-corner-${vertical} kp-corner-${horizontal}` );
            const items = div( 'kp-tray-items' );
            inner = div( 'kp-tray-inner' );
            
            pin = document.createElement( 'button' );
            pin.type = 'button';
            pin.className = 'kp-tray-btn kp-tray-pin';
            pin.title = 'Keep the tray open';
            pin.append( svgIcon( ICON_PIN ) );
            pin.onclick = () => toggle();
            inner.append( pin );

            launcher = document.createElement( 'button' );
            launcher.type = 'button';
            launcher.className = 'kp-launcher';
            launcher.title = 'Panels';
            launcher.append( svgIcon( options.icon ?? ICON_GRID ) );
            launcher.onclick = actions?.launcher ?? ( () => toggle() );

            items.append( inner );
            root.append( items, launcher );
            container.append( root );
        },
        update( items: readonly TrayItem[] ) {
            if ( !inner || !actions ) {
                return;
            }
            // The pin button stays first, so the panel buttons are synced into a wrapper that follows it.
            let list = inner.querySelector<HTMLElement>( '.kp-tray-list' );
            if ( !list ) {
                list = div( 'kp-tray-list' );
                list.style.display = 'contents';
                inner.append( list );
            }
            syncTrayButtons( list, buttons, items, item => createTrayButton( item, () => actions?.toggle( item.id ) ) );
        },
        setModifierState( { held, latched } ) {
            launcher?.classList.toggle( 'kp-on', held );
            launcher?.classList.toggle( 'kp-latched', latched );
        },
        dispose() {
            root?.remove();
            buttons.clear();
        }
    };
}
