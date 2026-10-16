import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createOverlay, parseCombo, type Overlay, type PanelDefinition } from '../src';

const def = ( id: string, extra: Partial<PanelDefinition> = {} ): PanelDefinition => ( {
    id, title: id, mount: () => document.createElement( 'div' ), ...extra
} );

const key = ( code: string, init: KeyboardEventInit = {}, target: EventTarget = document ): void => {
    target.dispatchEvent( new KeyboardEvent( 'keydown', { code, key: code.replace( 'Key', '' ), bubbles: true, composed: true, cancelable: true, ...init } ) );
};

let overlay: Overlay;

beforeEach( () => {
    document.body.innerHTML = '';
} );

afterEach( () => overlay?.dispose() );

describe( 'parseCombo', () => {
    it( 'splits code and modifiers', () => {
        expect( parseCombo( 'KeyF' ) ).toEqual( { code: 'KeyF', shift: false, ctrl: false, alt: false, meta: false } );
        expect( parseCombo( 'Shift+Ctrl+KeyR' ) ).toMatchObject( { code: 'KeyR', shift: true, ctrl: true } );
    } );

    it( 'rejects unknown modifiers', () => {
        expect( () => parseCombo( 'Hyper+KeyR' ) ).toThrow();
    } );
} );

describe( 'panel hotkeys with a modifier', () => {
    beforeEach( () => {
        overlay = createOverlay( { storage: false, hotkeys: { modifier: 'Alt', latchKey: 'KeyL' } } );
    } );

    it( 'toggles the panel only while Alt is held', () => {
        const a = overlay.register( def( 'a', { hotkey: 'KeyF', trayToggle: 'close' } ) );
        key( 'KeyF' );
        expect( a.state ).toBe( 'closed' );
        key( 'KeyF', { altKey: true } );
        expect( a.state ).toBe( 'open' );
        key( 'KeyF', { altKey: true } );
        expect( a.state ).toBe( 'closed' );
    } );

    it( 'minimizes an open panel by default', () => {
        const a = overlay.register( def( 'a', { hotkey: 'KeyF' } ) );
        key( 'KeyF', { altKey: true } );
        key( 'KeyF', { altKey: true } );
        expect( a.state ).toBe( 'minimized' );
    } );

    it( 'requires extra modifiers exactly', () => {
        const a = overlay.register( def( 'a', { hotkey: 'Shift+KeyR' } ) );
        key( 'KeyR', { altKey: true } );
        expect( a.state ).toBe( 'closed' );
        key( 'KeyR', { altKey: true, shiftKey: true } );
        expect( a.state ).toBe( 'open' );
    } );

    it( 'latches the modifier with Alt+L, so plain keys work, and releases it with a lone L', () => {
        const a = overlay.register( def( 'a', { hotkey: 'KeyF' } ) );
        key( 'KeyL', { altKey: true } );
        expect( overlay.modifier?.isLatched() ).toBe( true );
        key( 'KeyF' );
        expect( a.state ).toBe( 'open' );
        key( 'KeyL' );
        expect( overlay.modifier?.isLatched() ).toBe( false );
        key( 'KeyF' );
        expect( a.state ).toBe( 'open' );
    } );

    it( 'releases the latch by tapping the modifier alone', () => {
        key( 'KeyL', { altKey: true } );
        document.dispatchEvent( new KeyboardEvent( 'keyup', { code: 'KeyL', key: 'l', altKey: true } ) );
        key( 'AltLeft', { key: 'Alt', altKey: true } );
        document.dispatchEvent( new KeyboardEvent( 'keyup', { code: 'AltLeft', key: 'Alt' } ) );
        expect( overlay.modifier?.isLatched() ).toBe( false );
    } );

    it( 'does not apply the latch while typing in a text field, but the real key still works', () => {
        const a = overlay.register( def( 'a', { hotkey: 'KeyF' } ) );
        const input = document.createElement( 'input' );
        document.body.append( input );
        key( 'KeyL', { altKey: true } );
        key( 'KeyF', {}, input );
        expect( a.state ).toBe( 'closed' );
        key( 'KeyF', { altKey: true }, input );
        expect( a.state ).toBe( 'open' );
    } );

    it( 'tells the tray about the latch', () => {
        key( 'KeyL', { altKey: true } );
        expect( overlay.root.querySelector( '.kp-launcher' )?.classList.contains( 'kp-latched' ) ).toBe( true );
    } );

    it( 'stops binding on unregister', () => {
        const a = overlay.register( def( 'a', { hotkey: 'KeyF' } ) );
        overlay.unregister( 'a' );
        key( 'KeyF', { altKey: true } );
        expect( a.state ).toBe( 'closed' );
    } );
} );

describe( 'escape', () => {
    it( 'leaves fullscreen first, then closes the top panel only if asked to', () => {
        overlay = createOverlay( { storage: false, hotkeys: { modifier: 'Alt', escapeToClose: true } } );
        const a = overlay.register( def( 'a' ) );
        const b = overlay.register( def( 'b' ) );
        a.open();
        b.open();
        b.setFullscreen( true );
        key( 'Escape' );
        expect( b.fullscreen ).toBe( false );
        expect( b.state ).toBe( 'open' );
        key( 'Escape' );
        expect( b.state ).toBe( 'closed' );
        expect( a.state ).toBe( 'open' );
    } );

    it( 'does not close panels by default', () => {
        overlay = createOverlay( { storage: false, hotkeys: { modifier: 'Alt' } } );
        const a = overlay.register( def( 'a' ) );
        a.open();
        key( 'Escape' );
        expect( a.state ).toBe( 'open' );
    } );
} );

describe( 'hotkeys without a modifier', () => {
    it( 'fires on plain keys, except while typing', () => {
        overlay = createOverlay( { storage: false, hotkeys: {} } );
        const a = overlay.register( def( 'a', { hotkey: 'KeyF' } ) );
        const input = document.createElement( 'input' );
        document.body.append( input );
        key( 'KeyF', {}, input );
        expect( a.state ).toBe( 'closed' );
        key( 'KeyF' );
        expect( a.state ).toBe( 'open' );
    } );
} );
