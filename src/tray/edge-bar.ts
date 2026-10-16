import { div } from '../dom/h';
import { createTrayButton, syncTrayButtons, type TrayButton } from './tray-button';
import type { Tray, TrayActions, TrayItem } from './tray';

export type Edge = 'bottom' | 'top' | 'left' | 'right';

export interface EdgeBarOptions {
    /** Default: 'bottom'. */
    edge?: Edge;
    /** Shows only the icons. Default: false, the title is shown next to the icon. */
    iconsOnly?: boolean;
}

/** A taskbar along one edge of the viewport with a labelled button per panel. */
export function edgeBar( options: EdgeBarOptions = {} ): Tray {
    const edge = options.edge ?? 'bottom';
    const buttons = new Map<string, TrayButton>();
    let bar: HTMLElement | undefined;
    let actions: TrayActions | undefined;

    return {
        mount( container, tray ) {
            actions = tray;
            bar = div( `kp-bar kp-edge-${edge}` );
            container.append( bar );
        },
        update( items: readonly TrayItem[] ) {
            if ( bar ) {
                syncTrayButtons( bar, buttons, items, item =>
                    createTrayButton( item, () => actions?.toggle( item.id ), { label: !options.iconsOnly } ) );
            }
        },
        setModifierState( { latched } ) {
            bar?.classList.toggle( 'kp-latched', latched );
        },
        dispose() {
            bar?.remove();
            buttons.clear();
        }
    };
}
