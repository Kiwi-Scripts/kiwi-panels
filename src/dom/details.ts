import { div, span } from './h';

/** A titled block of a panel. */
export function renderSection( title: string, ...nodes: ( Node | string )[] ): HTMLElement {
    const section = div( 'kp-section' );
    section.append( span( 'kp-muted', title ), ...nodes );
    return section;
}

export interface DetailsSpec {
    className: string;
    /** Identifies the element so that its open state can be restored after a re-render (see `keepState`). */
    key?: string;
    open?: boolean;
    /** Renders `head` as one row after a chevron, instead of the native marker and inline content. */
    headRow?: boolean;
    head: ( Node | string )[];
    /** The nodes of the body; a function builds them only when the element is first opened. */
    body: ( Node | string )[] | ( () => ( Node | string )[] );
    data?: Record<string, string>;
    onToggle?( open: boolean ): void;
}

/** A collapsible block with a summary and an indented body. */
export function renderDetails( spec: DetailsSpec ): HTMLDetailsElement {
    const details = document.createElement( 'details' );
    details.className = spec.className;
    if ( spec.key !== undefined ) {
        details.dataset.key = spec.key;
    }
    Object.assign( details.dataset, spec.data );

    const summary = document.createElement( 'summary' );
    if ( spec.headRow ) {
        summary.className = 'kp-wsum';
        const row = div( 'kp-row' );
        row.style.flexWrap = 'nowrap';
        row.append( span( 'kp-chev', '' ), ...spec.head );
        summary.append( row );
    } else {
        summary.append( ...spec.head );
    }

    const body = div( 'kp-dir-body' );
    const build = typeof spec.body === 'function' ? spec.body : () => spec.body as ( Node | string )[];
    let built = false;
    const ensureBody = (): void => {
        if ( !built ) {
            built = true;
            body.append( ...build() );
        }
    };
    details.append( summary, body );
    details.open = !!spec.open;
    if ( details.open || typeof spec.body !== 'function' ) {
        ensureBody();
    }
    if ( typeof spec.body === 'function' || spec.onToggle ) {
        details.addEventListener( 'toggle', () => {
            if ( details.open ) {
                ensureBody();
            }
            spec.onToggle?.( details.open );
        } );
    }
    return details;
}

/** The `key`s of the expanded `details` in the container. */
export function openKeys( container: HTMLElement ): Set<string | undefined> {
    return new Set( Array.from( container.querySelectorAll<HTMLDetailsElement>( 'details[open]' ) ).map( d => d.dataset.key ) );
}

/** Re-renders while keeping which `details` are expanded and the scroll position. */
export function keepState( container: HTMLElement, rerender: () => void ): void {
    const open = openKeys( container );
    const scrollTop = container.scrollTop;
    rerender();
    container.querySelectorAll<HTMLDetailsElement>( 'details' ).forEach( d => d.open = open.has( d.dataset.key ) );
    container.scrollTop = scrollTop;
}
