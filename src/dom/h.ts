import type { PanelIcon } from '../types';

export function div( className: string, text?: string ): HTMLDivElement {
    const el = document.createElement( 'div' );
    el.className = className;
    if ( text ) {
        el.textContent = text;
    }
    return el;
}

export function span( className: string, text: string, title?: string ): HTMLSpanElement {
    const el = document.createElement( 'span' );
    el.className = className;
    el.textContent = text;
    if ( title ) {
        el.title = title;
    }
    return el;
}

export const badge = ( text: string ): HTMLSpanElement => span( 'kp-badge', text );

/** A clickable text; `muted` is for secondary links. It may sit in a summary without toggling it. */
export function link( text: string, title: string, onClick: () => void, muted = false ): HTMLSpanElement {
    const el = span( muted ? 'kp-muted kp-link' : 'kp-link', text, title );
    el.onclick = ev => {
        ev.preventDefault();
        ev.stopPropagation();
        onClick();
    };
    return el;
}

export interface ButtonOptions {
    /** Shows the button as active. */
    on?: boolean;
    /** Smaller, for use inside rows. */
    mini?: boolean;
    disabled?: boolean;
}

export function button( text: string, title: string, onClick: () => void, options: ButtonOptions = {} ): HTMLButtonElement {
    const el = document.createElement( 'button' );
    el.type = 'button';
    el.className = 'kp-btn';
    el.textContent = text;
    el.title = title;
    el.onclick = onClick;
    el.classList.toggle( 'kp-on', !!options.on );
    el.classList.toggle( 'kp-mini', !!options.mini );
    el.disabled = !!options.disabled;
    return el;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/** An icon from an SVG path of a 24x24 viewBox. */
export function svgIcon( path: string ): SVGSVGElement {
    const icon = document.createElementNS( SVG_NS, 'svg' );
    icon.setAttribute( 'viewBox', '0 0 24 24' );
    const shape = document.createElementNS( SVG_NS, 'path' );
    shape.setAttribute( 'd', path );
    icon.append( shape );
    return icon;
}

/** Creates an SVG element; string children become text. */
export function svgEl<K extends keyof SVGElementTagNameMap>( tag: K, attrs: Record<string, string | number> = {}, ...children: ( Node | string )[] ): SVGElementTagNameMap[K] {
    const el = document.createElementNS( SVG_NS, tag );
    for ( const [name, value] of Object.entries( attrs ) ) {
        el.setAttribute( name, String( value ) );
    }
    el.append( ...children );
    return el;
}

/** A fresh node for an icon; without one, the first letter of `fallback` stands in. */
export function renderIcon( icon: PanelIcon | undefined, fallback = '' ): Node {
    if ( typeof icon === 'string' ) {
        return svgIcon( icon );
    }
    if ( icon ) {
        return icon.cloneNode( true );
    }
    return span( 'kp-icon-letter', fallback.charAt( 0 ).toUpperCase() );
}
