import { afterEach, describe, expect, it, vi } from 'vitest';

import { createDormantLauncher, type DormantLauncher } from '../src';

let launcher: DormantLauncher | undefined;
afterEach( () => {
    launcher?.dispose();
    launcher = undefined;
} );

describe( 'dormant launcher', () => {
    it( 'mounts only a dimmed launcher with a label, in the chosen corner', () => {
        launcher = createDormantLauncher( { corner: 'top-left', label: 'Debug off', onWake: vi.fn() } );
        const root = launcher.host.shadowRoot!;
        const dock = root.querySelector( '.kp-tray.kp-dormant' );
        expect( dock?.classList.contains( 'kp-corner-top' ) ).toBe( true );
        expect( dock?.classList.contains( 'kp-corner-left' ) ).toBe( true );
        expect( root.querySelector( '.kp-launcher-label' )?.textContent ).toBe( 'Debug off' );
        expect( root.querySelector( '.kp-panel' ) ).toBeNull();
        expect( root.querySelectorAll( 'button' ) ).toHaveLength( 1 );
    } );

    it( 'is marked as overlay and styled inside the shadow root', () => {
        launcher = createDormantLauncher( { onWake: vi.fn() } );
        expect( launcher.host.hasAttribute( 'data-kp-overlay' ) ).toBe( true );
        expect( launcher.host.shadowRoot!.querySelector( 'style' )?.textContent ).toContain( '.kp-dormant' );
        expect( launcher.host.shadowRoot!.querySelector( '.kp-launcher-label' )?.textContent ).toBe( 'Off' );
    } );

    it( 'calls onWake on click, and the caller can swap it for a live overlay', () => {
        const onWake = vi.fn( () => launcher?.dispose() );
        launcher = createDormantLauncher( { onWake } );
        const host = launcher.host;
        host.shadowRoot!.querySelector<HTMLElement>( '.kp-launcher' )?.click();
        expect( onWake ).toHaveBeenCalledTimes( 1 );
        expect( host.isConnected ).toBe( false );
    } );

    it( 'registers no listeners on the document or window', () => {
        const add = vi.spyOn( document, 'addEventListener' );
        const addWin = vi.spyOn( window, 'addEventListener' );
        launcher = createDormantLauncher( { onWake: vi.fn() } );
        expect( add ).not.toHaveBeenCalled();
        expect( addWin ).not.toHaveBeenCalled();
        add.mockRestore();
        addWin.mockRestore();
    } );
} );
