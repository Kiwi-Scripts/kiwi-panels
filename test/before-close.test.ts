import { afterEach, describe, expect, it } from 'vitest';

import { createOverlay, type Overlay } from '../src';

let overlay: Overlay;
afterEach( () => overlay?.dispose() );

function setup( beforeClose: () => boolean | void ) {
    overlay = createOverlay( { storage: false } );
    const calls = { hide: 0 };
    overlay.register( {
        id: 'a', title: 'A',
        mount: () => ( { content: document.createElement( 'div' ), beforeClose, onHide: () => void calls.hide++ } )
    } );
    overlay.panels.open( 'a' );
    return { calls, panel: overlay.panels.get( 'a' )! };
}

describe( 'beforeClose', () => {
    it( 'keeps the panel open when it returns false, from the header button as well as close()', () => {
        let keep = true;
        const { calls, panel } = setup( () => ( keep ? false : undefined ) );
        panel.close();
        expect( [panel.state, calls.hide] ).toEqual( ['open', 0] );
        panel.element.querySelector<HTMLButtonElement>( 'button[title="Close"]' )!.click();
        expect( panel.state ).toBe( 'open' );
        keep = false;
        panel.close();
        expect( [panel.state, calls.hide] ).toEqual( ['closed', 1] );
    } );

    it( 'is skipped by a forced close, and a hook that throws does not hold the panel', () => {
        const { panel } = setup( () => false );
        panel.close( { force: true } );
        expect( panel.state ).toBe( 'closed' );
        const second = setup( () => { throw new Error( 'boom' ); } );
        second.panel.close();
        expect( second.panel.state ).toBe( 'closed' );
    } );
} );
