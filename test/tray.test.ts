import { afterEach, describe, expect, it, vi } from 'vitest';

import { createOverlay, edgeBar, cornerDock, type Overlay, type Tray, type TrayItem } from '../src';

let overlay: Overlay;
afterEach( () => overlay?.dispose() );

const make = ( tray: Tray ): Overlay => overlay = createOverlay( { storage: false, tray } );
const panel = ( id: string ) => ( { id, title: `Panel ${id}`, mount: () => document.createElement( 'div' ) } );

describe( 'edge bar', () => {
    it( 'draws labelled buttons along the chosen edge', () => {
        make( edgeBar( { edge: 'left' } ) ).register( panel( 'a' ) );
        const bar = overlay.root.querySelector( '.kp-bar' );
        expect( bar?.classList.contains( 'kp-edge-left' ) ).toBe( true );
        expect( bar?.querySelector( '.kp-tray-label' )?.textContent ).toBe( 'Panel a' );
    } );

    it( 'can show icons only', () => {
        make( edgeBar( { iconsOnly: true } ) ).register( panel( 'a' ) );
        expect( overlay.root.querySelector( '.kp-tray-label' ) ).toBeNull();
    } );

    it( 'keeps the registration order and follows title changes', () => {
        make( edgeBar() );
        overlay.register( panel( 'a' ) );
        overlay.register( { ...panel( 'b' ), mount: ctx => void ctx.setTitle( 'Renamed' ) } ).open();
        overlay.register( panel( 'c' ) );
        const labels = Array.from( overlay.root.querySelectorAll( '.kp-tray-label' ), l => l.textContent );
        expect( labels ).toEqual( ['Panel a', 'Renamed', 'Panel c'] );
    } );
} );

describe( 'corner dock', () => {
    it( 'is placed in the chosen corner and pins on launcher click without a modifier', () => {
        make( cornerDock( { corner: 'top-left' } ) );
        const dock = overlay.root.querySelector( '.kp-tray' );
        expect( dock?.classList.contains( 'kp-corner-top' ) ).toBe( true );
        expect( dock?.classList.contains( 'kp-corner-left' ) ).toBe( true );
        overlay.root.querySelector<HTMLElement>( '.kp-launcher' )?.click();
        expect( dock?.classList.contains( 'kp-tray-pinned' ) ).toBe( true );
    } );

    it( 'toggles the latch on launcher click when the overlay has a modifier and trayLatch', () => {
        overlay = createOverlay( { storage: false, tray: cornerDock(), hotkeys: { modifier: 'Alt', trayLatch: true } } );
        overlay.root.querySelector<HTMLElement>( '.kp-launcher' )?.click();
        expect( overlay.modifier?.isLatched() ).toBe( true );
        expect( overlay.root.querySelector( '.kp-launcher' )?.classList.contains( 'kp-latched' ) ).toBe( true );
    } );
} );

describe( 'custom tray', () => {
    it( 'receives items derived from the panel state, and can toggle panels', () => {
        const updates: TrayItem[][] = [];
        let toggle: ( id: string ) => void = () => undefined;
        const tray: Tray = {
            mount: ( _container, actions ) => void ( toggle = actions.toggle ),
            update: items => void updates.push( items.map( i => ( { ...i } ) ) ),
            dispose: vi.fn()
        };
        make( tray );
        const a = overlay.register( { ...panel( 'a' ), mount: () => ( { isActive: () => true } ) } );
        toggle( 'a' );
        a.minimize();
        const last = updates.at( -1 )![0];
        expect( last ).toMatchObject( { id: 'a', title: 'Panel a', state: 'minimized', active: true, badge: null } );
        overlay.dispose();
        expect( tray.dispose ).toHaveBeenCalled();
    } );
} );

describe( 'panels without a tray button', () => {
    it( 'are left out of the tray but open like any other', () => {
        const overlay = createOverlay( { storage: false, tray: cornerDock() } );
        overlay.register( { id: 'a', title: 'A', mount: () => document.createElement( 'div' ) } );
        overlay.register( { id: 'quiet', title: 'Quiet', tray: false, mount: () => document.createElement( 'div' ) } );
        const ids = Array.from( overlay.root.querySelectorAll<HTMLElement>( '.kp-tray-inner button' ), b => b.dataset.panel ).filter( Boolean );
        expect( ids ).toEqual( ['a'] );
        overlay.panels.open( 'quiet' );
        expect( overlay.panels.get( 'quiet' )?.state ).toBe( 'open' );
        overlay.dispose();
    } );
} );
