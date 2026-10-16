import base from './base.css';
import tokens from './tokens.css';
import tray from './tray.css';

export const OVERLAY_CSS = tokens + base + tray;

/** Overridable design tokens; each maps to the CSS variable `--kp-<kebab-case-name>`. */
export interface Theme {
    bg?: string;
    bgAlt?: string;
    bgHover?: string;
    fg?: string;
    muted?: string;
    border?: string;
    borderStrong?: string;
    accent?: string;
    accentFg?: string;
    info?: string;
    font?: string;
    radius?: string;
    shadow?: string;
    panelWidth?: string;
}

/** Applies theme overrides as custom properties on the element. */
export function applyTheme( el: HTMLElement, theme: Theme | undefined ): void {
    for ( const [name, value] of Object.entries( theme ?? {} ) ) {
        if ( value !== undefined ) {
            el.style.setProperty( `--kp-${name.replace( /[A-Z]/g, c => `-${c.toLowerCase()}` )}`, value );
        }
    }
}
