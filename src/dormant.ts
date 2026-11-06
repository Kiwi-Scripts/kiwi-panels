import { div, span, svgIcon } from './dom/h';
import { createOverlayHost } from './host';
import type { Theme } from './styles';
import type { Corner } from './tray/corner-dock';

export interface DormantOptions {
    /** Shown next to the launcher. Default: 'Off'. */
    label?: string;
    /** Tooltip of the launcher. Default: the label. */
    title?: string;
    /** Default: 'bottom-right'. */
    corner?: Corner;
    /** SVG path (24x24) of the launcher. Default: a power symbol. */
    icon?: string;
    theme?: Theme;
    /** Where the host element is added. Default: `document.body`. */
    container?: HTMLElement;
    /** The launcher was clicked. The launcher stays until `dispose()`, so dispose it here before building what replaces it. */
    onWake(): void;
}

export interface DormantLauncher {
    /** The element in the page that hosts the shadow root. */
    readonly host: HTMLElement;
    dispose(): void;
}

const ICON_POWER = 'M13 3h-2v10h2V3zm4.83 2.17-1.42 1.42A6.92 6.92 0 0 1 19 12c0 3.87-3.13 7-7 7s-7-3.13-7-7c0-2.05.88-3.9 2.29-5.19L5.88 5.4A8.93 8.93 0 0 0 3 12c0 4.97 4.03 9 9 9s9-4.03 9-9c0-2.63-1.13-5-3.17-6.83z';

/**
 * An overlay that is switched off: only a dimmed launcher in a corner, with no panels, hotkeys or listeners. It is for hosts that
 * keep their overlay out of the way until asked for; on `onWake` they dispose it and call `createOverlay()`.
 */
export function createDormantLauncher( options: DormantOptions ): DormantLauncher {
    if ( typeof document === 'undefined' ) {
        throw new Error( 'createDormantLauncher() needs a DOM; call it in the browser.' );
    }
    const { host, root } = createOverlayHost( options.container, options.theme );
    const label = options.label ?? 'Off';
    const [vertical, horizontal] = ( options.corner ?? 'bottom-right' ).split( '-' );

    const dock = div( `kp-tray kp-dormant kp-corner-${vertical} kp-corner-${horizontal}` );
    const launcher = document.createElement( 'button' );
    launcher.type = 'button';
    launcher.className = 'kp-launcher';
    launcher.title = options.title ?? label;
    launcher.append( svgIcon( options.icon ?? ICON_POWER ) );
    launcher.onclick = () => options.onWake();
    dock.append( launcher, span( 'kp-dormant-label', label ) );
    root.append( dock );

    return { host, dispose: () => host.remove() };
}
