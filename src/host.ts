import { HOST_TAG, OVERLAY_ATTR, Z_MAX, Z_PANEL_BASE } from './constants';
import { applyTheme, OVERLAY_CSS, type Theme } from './styles';

export interface OverlayHost {
    readonly host: HTMLElement;
    readonly root: ShadowRoot;
}

/**
 * The element in the page that hosts the shadow root, with the stylesheet in it. A shadow root keeps page styles out of the
 * overlay and the overlay styles out of the page.
 */
export function createOverlayHost( container: HTMLElement | undefined, theme: Theme | undefined ): OverlayHost {
    const host = document.createElement( HOST_TAG );
    host.setAttribute( OVERLAY_ATTR, '' );
    // `all: initial` stops inherited page styles (font, color, ...) from reaching the shadow tree.
    host.style.cssText = `all: initial; position: fixed; top: 0; left: 0; width: 0; height: 0; z-index: ${Z_MAX};`;
    host.style.setProperty( '--kp-z-max', String( Z_MAX ) );
    host.style.setProperty( '--kp-z-panel-base', String( Z_PANEL_BASE ) );
    applyTheme( host, theme );
    const root = host.attachShadow( { mode: 'open' } );
    const style = document.createElement( 'style' );
    style.textContent = OVERLAY_CSS;
    root.append( style );
    ( container ?? document.body ).append( host );
    return { host, root };
}
