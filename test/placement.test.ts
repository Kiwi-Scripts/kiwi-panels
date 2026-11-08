import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createOverlay, type Overlay } from '../src';
import { parseStep, placeAround, placeStacked } from '../src/panels/placement';

const view = { width: 1000, height: 800 };
const size = { width: 300, height: 200 };
const point = ( x: number, y: number ) => ( { left: x, top: y, right: x, bottom: y } );

describe( 'parseStep', () => {
    it( 'reads the shorthand', () => {
        expect( parseStep( 'right+16' ) ).toEqual( { side: 'right', gap: 16, align: undefined, clamp: false } );
        expect( parseStep( 'below+8 end clamp' ) ).toEqual( { side: 'below', gap: 8, align: 'end', clamp: true } );
        expect( parseStep( { side: 'left' } ) ).toEqual( { side: 'left' } );
    } );

    it( 'rejects nonsense', () => {
        expect( () => parseStep( 'beside' ) ).toThrow( /Unknown placement step/ );
    } );
} );

describe( 'placeAround', () => {
    it( 'puts the panel right of the anchor, offset by the gap', () => {
        expect( placeAround( point( 100, 100 ), size, view ) ).toEqual( { left: 116, top: 100 } );
    } );

    it( 'goes below the anchor and shifts left when there is no room on the right', () => {
        expect( placeAround( point( 900, 100 ), size, view ) ).toEqual( { left: 692, top: 116 } );
    } );

    it( 'goes above when there is no room below either', () => {
        expect( placeAround( point( 900, 780 ), size, view ) ).toEqual( { left: 692, top: 564 } );
    } );

    it( 'uses the first step that fits, in the given order', () => {
        expect( placeAround( point( 500, 300 ), size, view, ['left+10', 'right+10'] ) ).toEqual( { left: 190, top: 300 } );
        expect( placeAround( point( 100, 300 ), size, view, ['left+10', 'right+10'] ) ).toEqual( { left: 110, top: 300 } );
    } );

    it( 'aligns with the anchor edge', () => {
        const element = { left: 400, top: 300, right: 500, bottom: 340 };
        expect( placeAround( element, size, view, ['below+4 end'] ) ).toEqual( { left: 200, top: 344 } );
        expect( placeAround( element, size, view, ['right+4 center'] ) ).toEqual( { left: 504, top: 220 } );
    } );

    it( 'pushes the panel into the viewport when no step fits', () => {
        const tight = { width: 300, height: 200 };
        expect( placeAround( point( 150, 100 ), { width: 280, height: 190 }, tight, ['right+16'] ) ).toEqual( { left: 12, top: 8 } );
    } );
} );

describe( 'placeStacked', () => {
    const base = { left: 692, top: 8 };
    const taken = { left: 692, top: 8, right: 992, bottom: 208 };

    it( 'stays where it is without obstacles', () => {
        expect( placeStacked( base, size, view, [], ['left'] ) ).toEqual( base );
    } );

    it( 'moves past a panel in the given direction, by its size plus the gap', () => {
        expect( placeStacked( base, size, view, [taken], ['left'] ) ).toEqual( { left: 384, top: 8 } );
        expect( placeStacked( base, size, view, [taken], ['down'] ) ).toEqual( { left: 692, top: 216 } );
    } );

    it( 'keeps moving past several panels', () => {
        const second = { left: 384, top: 8, right: 684, bottom: 208 };
        expect( placeStacked( base, size, view, [taken, second], ['left'], 10 ) ).toEqual( { left: 74, top: 8 } );
    } );

    it( 'falls back to the next direction when the first leaves the viewport', () => {
        const row = [taken, { left: 384, top: 8, right: 684, bottom: 208 }, { left: 76, top: 8, right: 376, bottom: 208 }];
        expect( placeStacked( base, size, view, row, ['left', 'down'] ) ).toEqual( { left: 692, top: 216 } );
    } );
} );

describe( 'panel positions', () => {
    let overlay: Overlay;
    // happy-dom does no layout: panels are 300 x 200 and sit where their style says.
    const proto = HTMLElement.prototype;
    const names = ['offsetWidth', 'offsetHeight', 'getBoundingClientRect'] as const;
    const saved = names.map( name => Object.getOwnPropertyDescriptor( proto, name ) );
    beforeEach( () => {
        Object.defineProperty( proto, 'offsetWidth', { configurable: true, get: () => 300 } );
        Object.defineProperty( proto, 'offsetHeight', { configurable: true, get: () => 200 } );
        proto.getBoundingClientRect = function() {
            const left = Number.parseFloat( this.style.left ) || 0;
            const top = Number.parseFloat( this.style.top ) || 0;
            return { left, top, right: left + 300, bottom: top + 200, width: 300, height: 200 } as DOMRect;
        };
        overlay = createOverlay();
    } );
    afterEach( () => {
        overlay.dispose();
        names.forEach( ( name, i ) => saved[i] ? Object.defineProperty( proto, name, saved[i]! ) : delete ( proto as any )[name] );
    } );

    const def = ( id: string, defaultPosition: any ) => ( { id, title: id, size: { width: 300, height: 200 }, defaultPosition, mount: () => document.createElement( 'div' ) } );

    it( 'makes room for a panel at the same spot', () => {
        const a = overlay.register( def( 'a', { at: 'top-right', stack: 'left' } ) );
        const b = overlay.register( def( 'b', { at: 'top-right', stack: 'left' } ) );
        a.open();
        expect( a.element.style.left ).toBe( '716px' );
        b.open();
        expect( b.element.style.left ).toBe( '408px' );
        expect( b.element.style.top ).toBe( '8px' );
    } );

    it( 'opens next to the pointer', () => {
        document.dispatchEvent( Object.assign( new Event( 'pointermove' ), { clientX: 200, clientY: 150 } ) );
        const a = overlay.register( def( 'a', 'cursor' ) );
        a.open();
        expect( a.element.style.left ).toBe( '216px' );
        expect( a.element.style.top ).toBe( '150px' );
        a.close();
        document.dispatchEvent( Object.assign( new Event( 'pointermove' ), { clientX: 400, clientY: 250 } ) );
        a.open();
        expect( a.element.style.left ).toBe( '416px' );
    } );
} );
