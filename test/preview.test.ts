import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createOverlay, memoryStorage, type Overlay, type PanelDefinition } from '../src';

const def = ( id: string, extra: Partial<PanelDefinition> = {} ): PanelDefinition => ( {
    id, title: id.toUpperCase(), mount: () => document.createElement( 'p' ), ...extra
} );

const hooked = () => {
    const calls: string[] = [];
    const mount = vi.fn( () => ( {
        content: document.createElement( 'i' ),
        onShow: ( args?: unknown ) => void calls.push( `show:${String( args )}` ),
        onHide: () => void calls.push( 'hide' ),
        onMinimize: () => void calls.push( 'minimize' ),
        dispose: () => void calls.push( 'dispose' )
    } ) );
    return { calls, mount };
};

let overlay: Overlay;

beforeEach( () => {
    document.body.innerHTML = '';
    overlay = createOverlay( { storage: false } );
} );

afterEach( () => overlay.dispose() );

describe( 'panel preview', () => {
    it( 'shows a closed panel transiently: not open, no state change event, nothing persisted', () => {
        const storage = memoryStorage();
        overlay.dispose();
        overlay = createOverlay( { storage } );
        const changes = vi.fn();
        overlay.on( 'panelchange', changes );
        const { calls, mount } = hooked();
        const panel = overlay.register( def( 'a', { mount } ) );

        panel.preview( 'x', { x: 100, y: 100 } );
        expect( panel.previewing ).toBe( true );
        expect( panel.state ).toBe( 'closed' );
        expect( panel.element.classList.contains( 'kp-preview' ) ).toBe( true );
        expect( panel.element.classList.contains( 'kp-open' ) ).toBe( false );
        expect( calls ).toEqual( ['show:x'] );
        expect( changes ).not.toHaveBeenCalled();
        expect( storage.get( 'a' ) ).toBeNull();
    } );

    it( 'retargets on a repeated call and mounts once', () => {
        const { calls, mount } = hooked();
        const panel = overlay.register( def( 'a', { mount } ) );
        panel.preview( 1 );
        panel.preview( 2 );
        expect( mount ).toHaveBeenCalledTimes( 1 );
        expect( calls ).toEqual( ['show:1', 'show:2'] );
    } );

    it( 'ends like close() for a closed panel', () => {
        const { calls, mount } = hooked();
        const panel = overlay.register( def( 'a', { mount } ) );
        panel.preview();
        panel.endPreview();
        expect( panel.previewing ).toBe( false );
        expect( panel.element.classList.contains( 'kp-preview' ) ).toBe( false );
        expect( calls ).toEqual( ['show:undefined', 'hide', 'dispose'] );
        expect( panel.body.childElementCount ).toBe( 0 );
        panel.preview();
        expect( mount ).toHaveBeenCalledTimes( 2 );
    } );

    it( 'returns a minimized panel to minimized, keeping its content', () => {
        const { calls, mount } = hooked();
        const panel = overlay.register( def( 'a', { mount } ) );
        panel.open();
        panel.minimize();
        calls.length = 0;
        panel.preview( 'p' );
        expect( panel.state ).toBe( 'minimized' );
        expect( panel.element.classList.contains( 'kp-preview' ) ).toBe( true );
        panel.endPreview();
        expect( panel.state ).toBe( 'minimized' );
        expect( panel.element.classList.contains( 'kp-preview' ) ).toBe( false );
        expect( calls ).toEqual( ['show:p', 'minimize'] );
        expect( panel.body.childElementCount ).toBe( 1 );
        expect( mount ).toHaveBeenCalledTimes( 1 );
    } );

    it( 'does nothing to an open panel', () => {
        const panel = overlay.register( def( 'a' ) );
        panel.open();
        panel.preview();
        expect( panel.previewing ).toBe( false );
        panel.endPreview();
        expect( panel.state ).toBe( 'open' );
    } );

    it( 'is promoted in place by open() and toggle(), without a remount', () => {
        const { calls, mount } = hooked();
        const panel = overlay.register( def( 'a', { mount } ) );
        panel.preview( 1, { x: 50, y: 60 } );
        const { left, top } = panel.element.style;
        panel.open( 2 );
        expect( panel.state ).toBe( 'open' );
        expect( panel.previewing ).toBe( false );
        expect( mount ).toHaveBeenCalledTimes( 1 );
        expect( calls ).toEqual( ['show:1', 'show:2'] );
        expect( panel.element.style.left ).toBe( left );
        expect( panel.element.style.top ).toBe( top );

        const other = overlay.register( def( 'b' ) );
        other.preview();
        other.toggle();
        expect( other.state ).toBe( 'open' );
    } );

    it( 'does not keep the preview position as the next default or persist it', () => {
        const storage = memoryStorage();
        overlay.dispose();
        overlay = createOverlay( { storage } );
        const panel = overlay.register( def( 'a', { defaultPosition: { left: 300, top: 40 } } ) );
        panel.preview( undefined, { x: 500, y: 200 } );
        panel.open();
        expect( JSON.parse( storage.get( 'a' )! ).pos ).toBeUndefined();
        panel.close();
        panel.open();
        expect( panel.element.style.left ).toBe( '300px' );
    } );

    it( 'promotes in place even if the user placed the panel before, and goes back to that place next time', () => {
        const panel = overlay.register( def( 'a' ) );
        panel.moveTo( { left: 100, top: 60 } );
        panel.preview( undefined, { x: 500, y: 200 } );
        const left = panel.element.style.left;
        expect( left ).not.toBe( '100px' );
        panel.open();
        expect( panel.element.style.left ).toBe( left );
        panel.close();
        panel.open();
        expect( panel.element.style.left ).toBe( '100px' );
    } );

    it( 'keeps a promoted panel where the user drags it', () => {
        const panel = overlay.register( def( 'a' ) );
        panel.preview( undefined, { x: 500, y: 200 } );
        panel.open();
        panel.moveTo( { left: 120, top: 30 } );
        panel.close();
        panel.open();
        expect( panel.element.style.left ).toBe( '120px' );
    } );

    it( 'ends when the panel is closed, and is refreshed while it lasts', () => {
        const refresh = vi.fn();
        const panel = overlay.register( def( 'a', { mount: () => ( { refresh } ) } ) );
        panel.preview();
        overlay.refresh();
        expect( refresh ).toHaveBeenCalledTimes( 1 );
        panel.close();
        expect( panel.previewing ).toBe( false );
        overlay.refresh();
        expect( refresh ).toHaveBeenCalledTimes( 1 );
    } );

    it( 'leaves the tray item alone', () => {
        const states: string[] = [];
        overlay.dispose();
        overlay = createOverlay( {
            storage: false,
            tray: { mount: () => undefined, update: items => void states.push( items.map( i => i.state ).join() ), dispose: () => undefined }
        } );
        const panel = overlay.register( def( 'a' ) );
        panel.preview();
        expect( states.every( s => s === 'closed' ) ).toBe( true );
    } );
} );
