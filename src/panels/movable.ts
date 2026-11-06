import type { AnyPos, PanelPos } from '../types';

export type NamedPosition = 'center' | 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
export type PositionSpec = NamedPosition | AnyPos | ( ( panel: HTMLElement ) => AnyPos );

const MARGIN = 8;
/** How much of a panel stays reachable when it is dragged or restored partly off screen. */
const GRAB = 40;
/** The gap between the pointer and a panel shown next to it. */
const OFFSET = 16;

const clamp = ( value: number, min: number, max: number ): number => Math.max( min, Math.min( value, max ) );

/** Positions a panel (left or right anchored), keeps its header reachable and limits its height to the rest of the viewport. */
export function placePanel( panel: HTMLElement, pos: AnyPos ): void {
    const width = panel.offsetWidth;
    const top = clamp( pos.top, 0, Math.max( 0, window.innerHeight - 32 ) );
    if ( 'left' in pos ) {
        panel.style.left = `${clamp( pos.left, GRAB - width, window.innerWidth - GRAB )}px`;
        panel.style.right = 'auto';
    } else {
        panel.style.right = `${clamp( pos.right, GRAB - width, window.innerWidth - GRAB )}px`;
        panel.style.left = 'auto';
    }
    panel.style.top = `${top}px`;
    panel.style.maxHeight = `${Math.max( 120, window.innerHeight - top - MARGIN )}px`;
}

/** Where to put `panel` so that it appears next to the viewport point `at`; it flips to the other side of the point where it would not fit. */
export function nearPoint( panel: HTMLElement, at: { x: number; y: number } ): PanelPos {
    const { offsetWidth: w, offsetHeight: h } = panel;
    const { innerWidth: vw, innerHeight: vh } = window;
    const left = at.x + OFFSET + w + MARGIN > vw ? at.x - OFFSET - w : at.x + OFFSET;
    const top = at.y + OFFSET + h + MARGIN > vh ? at.y - OFFSET - h : at.y + OFFSET;
    return { left: Math.max( MARGIN, left ), top: Math.max( MARGIN, top ) };
}

/** Turns a named position, a fixed one or a function into coordinates, for the size the panel has while it is shown. */
export function resolvePosition( spec: PositionSpec, panel: HTMLElement ): AnyPos {
    if ( typeof spec === 'function' ) {
        return spec( panel );
    }
    if ( typeof spec !== 'string' ) {
        return spec;
    }
    const { innerWidth: vw, innerHeight: vh } = window;
    const { offsetWidth: w, offsetHeight: h } = panel;
    const [vertical, horizontal] = spec === 'center' ? ['center', 'center'] : spec.split( '-' );
    return {
        left: Math.max( MARGIN, horizontal === 'left' ? MARGIN : horizontal === 'right' ? vw - w - MARGIN : ( vw - w ) / 2 ),
        top: Math.max( MARGIN, vertical === 'top' ? MARGIN : vertical === 'bottom' ? vh - h - MARGIN : ( vh - h ) / 2 )
    };
}

/**
 * Starts dragging `panel` from a pointerdown on its header; buttons and inputs in the header stay clickable.
 * `moveTo` is called with every new position, `onEnd` once the pointer is released.
 */
export function dragPanel( ev: PointerEvent, panel: HTMLElement, moveTo: ( pos: PanelPos ) => void, onEnd?: () => void ): void {
    if ( ev.button !== 0 || ( ev.target as Element ).closest?.( 'button, input' ) ) {
        return;
    }
    ev.preventDefault();
    const r = panel.getBoundingClientRect();
    const offsetX = ev.clientX - r.left;
    const offsetY = ev.clientY - r.top;
    const onMove = ( e: PointerEvent ): void => moveTo( {
        left: e.clientX - offsetX,
        top: e.clientY - offsetY
    } );
    const onUp = (): void => {
        document.removeEventListener( 'pointermove', onMove, true );
        document.removeEventListener( 'pointerup', onUp, true );
        document.removeEventListener( 'pointercancel', onUp, true );
        onEnd?.();
    };
    document.addEventListener( 'pointermove', onMove, true );
    document.addEventListener( 'pointerup', onUp, true );
    document.addEventListener( 'pointercancel', onUp, true );
}
