import { afterEach, describe, expect, it, vi } from 'vitest';

import { cornerDock, createOverlay, edgeBar, type Overlay } from '../src';

let overlay: Overlay;
afterEach( () => overlay?.dispose() );

const panel = ( id: string ) => ( { id, title: `Panel ${id}`, mount: () => document.createElement( 'div' ) } );
const power = ( onClick = vi.fn() ) => ( { id: 'power', title: 'Turn off', icon: 'M0 0h24v24H0z', onClick } );

describe( 'tray commands', () => {
    it( 'stacks the buttons with the pin button in the corner dock', () => {
        const onClick = vi.fn();
        overlay = createOverlay( { storage: false, tray: cornerDock(), trayCommands: [power( onClick )] } );
        overlay.register( panel( 'a' ) );
        overlay.register( panel( 'b' ) );
        const ids = Array.from( overlay.root.querySelectorAll<HTMLElement>( '.kp-tray-inner button' ), b => b.dataset.panel ?? b.dataset.command ?? 'pin' );
        expect( ids ).toEqual( ['pin', 'power', 'a', 'b'] );
        overlay.root.querySelector<HTMLElement>( '[data-command="power"]' )?.click();
        expect( onClick ).toHaveBeenCalledTimes( 1 );
    } );

    it( 'adds buttons to the edge bar after the panel buttons', () => {
        overlay = createOverlay( { storage: false, tray: edgeBar(), trayCommands: [power()] } );
        overlay.register( panel( 'a' ) );
        overlay.register( panel( 'b' ) );
        const ids = Array.from( overlay.root.querySelectorAll<HTMLElement>( '.kp-bar button' ), b => b.dataset.panel ?? b.dataset.command );
        expect( ids ).toEqual( ['a', 'b', 'power'] );
    } );

    it( 'passes them to a custom tray', () => {
        const commands = [power()];
        let received: unknown;
        overlay = createOverlay( {
            storage: false,
            trayCommands: commands,
            tray: { mount: ( _container, actions ) => void ( received = actions.commands ), update: () => undefined, dispose: () => undefined }
        } );
        expect( received ).toBe( commands );
    } );
} );

describe( 'corner dock tray hotkey', () => {
    const press = (): void => {
        document.dispatchEvent( new KeyboardEvent( 'keydown', { code: 'KeyM', altKey: true, bubbles: true, cancelable: true } ) );
    };

    it( 'can be changed', () => {
        overlay = createOverlay( { storage: false, tray: cornerDock( { trayHotkey: 'KeyM' } ), hotkeys: { modifier: 'Alt' } } );
        press();
        expect( overlay.root.querySelector( '.kp-tray' )?.classList.contains( 'kp-tray-pinned' ) ).toBe( true );
    } );

    it( 'can be turned off', () => {
        overlay = createOverlay( { storage: false, tray: cornerDock( { trayHotkey: null } ), hotkeys: { modifier: 'Alt' } } );
        press();
        expect( overlay.root.querySelector( '.kp-tray' )?.classList.contains( 'kp-tray-pinned' ) ).toBe( false );
    } );
} );

describe( 'tray labels', () => {
    it( 'shows the modifier key on the launcher and the hotkey on a panel button', () => {
        overlay = createOverlay( { storage: false, tray: cornerDock(), hotkeys: { modifier: 'Control' } } );
        overlay.register( { ...panel( 'a' ), hotkey: 'KeyI' } );
        expect( overlay.root.querySelector( '.kp-launcher-label' )?.textContent ).toBe( 'Ctrl' );
        const key = overlay.root.querySelector<HTMLElement>( '[data-panel="a"] .kp-tray-key' );
        expect( key?.textContent ).toBe( 'I' );
        expect( key?.style.display ).toBe( '' );
    } );

    it( 'shows a label on a command button', () => {
        overlay = createOverlay( { storage: false, tray: cornerDock(), trayCommands: [{ ...power(), label: 'X' }] } );
        expect( overlay.root.querySelector( '[data-command="power"] .kp-tray-key' )?.textContent ).toBe( 'X' );
    } );
} );
