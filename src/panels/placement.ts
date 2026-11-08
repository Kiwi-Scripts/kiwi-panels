import type { AnyPos, PanelPos } from '../types';

export interface Point {
    x: number;
    y: number;
}

/** A rectangle in viewport coordinates; a `DOMRect` fits. */
export interface Rect {
    left: number;
    top: number;
    right: number;
    bottom: number;
}

export interface Size {
    width: number;
    height: number;
}

/** Fixed places: the corners, the edge centers and the center of the viewport. */
export type NamedPosition =
    | 'center' | 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'
    | 'center-left' | 'center-right';

export type Side = 'right' | 'left' | 'above' | 'below';

/**
 * One way of placing a panel next to an anchor. `side` says where the panel goes relative to the anchor, `align` how it lines up
 * with the anchor's edge on the other axis. A step is used when the panel fits the viewport with it; `clamp` allows to shift the
 * panel along the other axis until it fits (the axis of `side` must fit by itself).
 */
export interface PlacementStep {
    side: Side;
    /** Distance to the anchor in px. Default: 16. */
    gap?: number;
    /** Default: 'start'. */
    align?: 'start' | 'center' | 'end';
    clamp?: boolean;
}

/**
 * Shorthand for a step: `<side>[+<gap>] [start|center|end] [clamp]`, e.g. `'right+16'` or `'below+8 clamp'`.
 */
export type StepSpec = PlacementStep | string;

/** What a panel is placed around. `'cursor'` is the pointer, a function is asked each time the panel is placed. */
export type AnchorSpec = 'cursor' | Element | Rect | Point | ( () => Element | Rect | Point | null | undefined );

/**
 * Next to an anchor: the steps are tried in order and the first one with which the panel is fully inside the viewport wins. If none
 * fits, the first step is used and the panel is pushed into the viewport.
 */
export interface AnchoredPlacement {
    anchor: AnchorSpec;
    /** Default: right of the anchor, else below it, else above it, the last two shifted sideways to fit. */
    steps?: readonly StepSpec[];
}

export type Direction = 'left' | 'right' | 'up' | 'down';

/**
 * A fixed place that makes room for the panels that are open there: while the panel would cover another one it moves past it, in
 * the direction of `stack` by the size of that panel plus `gap`. With several directions, the next is tried from the start when the
 * panel would leave the viewport in the one before.
 */
export interface StackedPlacement {
    at: NamedPosition;
    stack: Direction | readonly Direction[];
    /** Default: 8. */
    gap?: number;
}

/** What the placement of a panel can look at. */
export interface PlacementEnv {
    /** Where the pointer last was. */
    pointer?: Point;
    /** The rectangles of the other panels that are shown. */
    obstacles(): readonly Rect[];
}

export type PositionSpec =
    | NamedPosition
    /** Next to the pointer: `{ anchor: 'cursor' }`. */
    | 'cursor'
    | AnyPos
    | AnchoredPlacement
    | StackedPlacement
    | ( ( panel: HTMLElement, env: PlacementEnv ) => AnyPos );

export const MARGIN = 8;
const DEFAULT_GAP = 16;
const STACK_GAP = 8;
const MAX_SHIFTS = 24;

export const DEFAULT_STEPS: readonly StepSpec[] = ['right+16', 'below+16 clamp', 'above+16 clamp'];

const STEP_PATTERN = /^(right|left|above|below)(?:\s*\+\s*(-?\d+(?:\.\d+)?))?(?:\s+(start|center|end))?(?:\s+(clamp))?$/;

export function parseStep( spec: StepSpec ): PlacementStep {
    if ( typeof spec !== 'string' ) {
        return spec;
    }
    const match = STEP_PATTERN.exec( spec.trim() );
    if ( !match ) {
        throw new Error( `Unknown placement step "${spec}"; expected "<right|left|above|below>[+gap] [start|center|end] [clamp]"` );
    }
    return {
        side: match[1] as Side,
        gap: match[2] === undefined ? undefined : Number( match[2] ),
        align: match[3] as PlacementStep['align'],
        clamp: !!match[4]
    };
}

const clamp = ( value: number, min: number, max: number ): number => Math.max( min, Math.min( value, max ) );

const fits = ( pos: PanelPos, size: Size, view: Size ): boolean =>
    pos.left >= MARGIN && pos.top >= MARGIN && pos.left + size.width <= view.width - MARGIN && pos.top + size.height <= view.height - MARGIN;

/** Moves a panel just far enough to be inside the viewport (as far as it fits at all). */
export function pushInside( pos: PanelPos, size: Size, view: Size ): PanelPos {
    return {
        left: Math.max( MARGIN, Math.min( pos.left, view.width - size.width - MARGIN ) ),
        top: Math.max( MARGIN, Math.min( pos.top, view.height - size.height - MARGIN ) )
    };
}

/** Where a step puts the panel, before it is checked against the viewport. */
function stepPosition( step: PlacementStep, anchor: Rect, size: Size ): PanelPos {
    const gap = step.gap ?? DEFAULT_GAP;
    const align = step.align ?? 'start';
    const alongY = align === 'start' ? anchor.top : align === 'end' ? anchor.bottom - size.height : ( anchor.top + anchor.bottom - size.height ) / 2;
    const alongX = align === 'start' ? anchor.left : align === 'end' ? anchor.right - size.width : ( anchor.left + anchor.right - size.width ) / 2;
    switch ( step.side ) {
        case 'right': return { left: anchor.right + gap, top: alongY };
        case 'left': return { left: anchor.left - gap - size.width, top: alongY };
        case 'below': return { left: alongX, top: anchor.bottom + gap };
        case 'above': return { left: alongX, top: anchor.top - gap - size.height };
    }
}

/** Places a panel of `size` around `anchor` with the first of the steps that works (see {@link AnchoredPlacement}). */
export function placeAround( anchor: Rect, size: Size, view: Size, steps: readonly StepSpec[] = DEFAULT_STEPS ): PanelPos {
    const parsed = steps.map( parseStep );
    for ( const step of parsed ) {
        const pos = stepPosition( step, anchor, size );
        if ( fits( pos, size, view ) ) {
            return pos;
        }
        if ( step.clamp ) {
            // Only the axis along the anchor's edge may move.
            const sideways = step.side === 'right' || step.side === 'left';
            const pushed = pushInside( pos, size, view );
            const shifted = sideways ? { left: pos.left, top: pushed.top } : { left: pushed.left, top: pos.top };
            if ( fits( shifted, size, view ) ) {
                return shifted;
            }
        }
    }
    return pushInside( parsed[0] ? stepPosition( parsed[0], anchor, size ) : { left: anchor.left, top: anchor.top }, size, view );
}

const overlaps = ( a: Rect, b: Rect ): boolean => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

/** Places a panel at a fixed spot, moved past the obstacles in the given directions (see {@link StackedPlacement}). */
export function placeStacked(
    base: PanelPos, size: Size, view: Size, obstacles: readonly Rect[], directions: readonly Direction[], gap = STACK_GAP
): PanelPos {
    for ( const direction of directions ) {
        let pos = base;
        for ( let i = 0; i < MAX_SHIFTS; i++ ) {
            const rect: Rect = { left: pos.left, top: pos.top, right: pos.left + size.width, bottom: pos.top + size.height };
            const hit = obstacles.find( o => overlaps( rect, o ) );
            if ( !hit ) {
                if ( fits( pos, size, view ) ) {
                    return pos;
                }
                break;
            }
            pos = direction === 'left' ? { left: hit.left - gap - size.width, top: pos.top }
                : direction === 'right' ? { left: hit.right + gap, top: pos.top }
                : direction === 'up' ? { left: pos.left, top: hit.top - gap - size.height }
                : { left: pos.left, top: hit.bottom + gap };
            if ( !fits( pos, size, view ) ) {
                break;
            }
        }
    }
    return base;
}

/** The rectangle an anchor stands for, or `undefined` if there is none (e.g. no pointer position is known yet). */
export function anchorRect( anchor: AnchorSpec, env: PlacementEnv ): Rect | undefined {
    const target = typeof anchor === 'function' ? anchor() : anchor;
    if ( !target ) {
        return undefined;
    }
    const pointRect = ( p: Point ): Rect => ( { left: p.x, top: p.y, right: p.x, bottom: p.y } );
    if ( target === 'cursor' ) {
        return env.pointer && pointRect( env.pointer );
    }
    if ( 'getBoundingClientRect' in target ) {
        const r = target.getBoundingClientRect();
        return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    }
    return 'x' in target ? pointRect( target ) : target;
}

/** The top left of a panel of `size` at a named place. */
export function namedPosition( name: NamedPosition, size: Size, view: Size ): PanelPos {
    const [vertical, horizontal] = name === 'center' ? ['center', 'center'] : name.split( '-' );
    return {
        left: Math.max( MARGIN, horizontal === 'left' ? MARGIN : horizontal === 'right' ? view.width - size.width - MARGIN : ( view.width - size.width ) / 2 ),
        top: Math.max( MARGIN, vertical === 'top' ? MARGIN : vertical === 'bottom' ? view.height - size.height - MARGIN : ( view.height - size.height ) / 2 )
    };
}

const isNamed = ( spec: PositionSpec ): spec is NamedPosition | 'cursor' => typeof spec === 'string';

/** Whether the result depends on what happens around the panel, so that it has to be worked out again each time the panel opens. */
export const isDynamic = ( spec: PositionSpec ): boolean => !isNamed( spec ) ? ( 'anchor' in spec || 'stack' in spec || typeof spec === 'function' ) : spec === 'cursor';

/** Turns any {@link PositionSpec} into coordinates, for the size the panel has right now. */
export function resolvePosition( spec: PositionSpec, panel: HTMLElement, env: PlacementEnv ): AnyPos {
    const size = { width: panel.offsetWidth, height: panel.offsetHeight };
    const view = { width: window.innerWidth, height: window.innerHeight };
    if ( typeof spec === 'function' ) {
        return spec( panel, env );
    }
    if ( spec === 'cursor' ) {
        return resolvePosition( { anchor: 'cursor' }, panel, env );
    }
    if ( typeof spec === 'string' ) {
        return namedPosition( spec, size, view );
    }
    if ( 'anchor' in spec ) {
        const rect = anchorRect( spec.anchor, env );
        return rect ? placeAround( rect, size, view, spec.steps ) : namedPosition( 'center', size, view );
    }
    if ( 'stack' in spec ) {
        const directions = typeof spec.stack === 'string' ? [spec.stack] : spec.stack;
        return placeStacked( namedPosition( spec.at, size, view ), size, view, env.obstacles(), directions, spec.gap );
    }
    return spec;
}
