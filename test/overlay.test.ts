import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createOverlay, memoryStorage, type Overlay, type PanelDefinition } from '../src';

const def = ( id: string, extra: Partial<PanelDefinition> = {} ): PanelDefinition => ( {
    id,
    title: id.toUpperCase(),
    mount: ctx => {
        const p = document.createElement( 'p' );
        p.textContent = `content of ${ctx.id}`;
        return p;
    },
    ...extra
} );

let overlay: Overlay;

beforeEach( () => {
    document.body.innerHTML = '';
    overlay = createOverlay( { storage: false } );
} );

afterEach( () => overlay.dispose() );

describe( 'panel state machine', () => {
    it( 'starts closed and mounts lazily on first open', () => {
        const mount = vi.fn( () => document.createElement( 'span' ) );
        const panel = overlay.register( def( 'a', { mount } ) );
        expect( panel.state ).toBe( 'closed' );
        expect( mount ).not.toHaveBeenCalled();

        panel.open();
        expect( panel.state ).toBe( 'open' );
        expect( mount ).toHaveBeenCalledTimes( 1 );
        expect( panel.element.classList.contains( 'kp-open' ) ).toBe( true );

        panel.minimize();
        panel.open();
        expect( mount ).toHaveBeenCalledTimes( 1 );
    } );

    it( 'close ends the content and the next open mounts afresh; minimize keeps it', () => {
        let mounts = 0;
        const hooks = { dispose: vi.fn(), onHide: vi.fn() };
        const panel = overlay.register( def( 'a', {
            mount: ctx => {
                mounts++;
                ctx.setTitle( 'Changed' );
                ctx.setBadge( 5 );
                ctx.setHeaderLeft( [document.createElement( 'u' )] );
                return { content: document.createElement( 'i' ), ...hooks };
            }
        } ) );
        panel.open();
        panel.minimize();
        panel.open();
        expect( mounts ).toBe( 1 );
        expect( hooks.dispose ).not.toHaveBeenCalled();

        panel.close();
        expect( hooks.onHide ).toHaveBeenCalledTimes( 1 );
        expect( hooks.dispose ).toHaveBeenCalledTimes( 1 );
        expect( panel.body.childElementCount ).toBe( 0 );
        expect( panel.element.querySelector( '.kp-header u' ) ).toBeNull();
        expect( panel.element.querySelector( '.kp-title' )?.textContent ).toBe( 'A' );
        const button = overlay.root.querySelector( '.kp-tray-btn[data-panel="a"]' );
        expect( button?.querySelector( '.kp-tray-badge' )?.textContent ).toBe( '' );

        panel.open();
        expect( mounts ).toBe( 2 );
        expect( panel.body.querySelectorAll( 'i' ) ).toHaveLength( 1 );
        expect( panel.element.querySelector( '.kp-title' )?.textContent ).toBe( 'Changed' );
    } );

    it( 'keeps the window (position, size) across a close', () => {
        const panel = overlay.register( def( 'a' ) );
        panel.open();
        panel.moveTo( { left: 70, top: 80 } );
        panel.resizeTo( { width: 333 } );
        panel.close();
        panel.open();
        expect( panel.element.style.left ).toBe( '70px' );
        expect( panel.element.style.width ).toBe( '333px' );
    } );

    it( 'disposes a still-open panel when the overlay goes, but a closed one only once', () => {
        const open = { dispose: vi.fn() };
        const closed = { dispose: vi.fn() };
        overlay.register( def( 'a', { mount: () => open } ) ).open();
        overlay.register( def( 'b', { mount: () => closed } ) ).open();
        overlay.panels.close( 'b' );
        overlay.dispose();
        expect( open.dispose ).toHaveBeenCalledTimes( 1 );
        expect( closed.dispose ).toHaveBeenCalledTimes( 1 );
        overlay = createOverlay( { storage: false } );
    } );

    it( 'goes open -> minimized -> open -> closed and reports each change', () => {
        const changes: string[] = [];
        overlay.on( 'panelchange', c => changes.push( `${c.previous}>${c.state}` ) );
        const panel = overlay.register( def( 'a' ) );
        panel.open();
        panel.minimize();
        expect( panel.element.classList.contains( 'kp-open' ) ).toBe( false );
        panel.open();
        panel.close();
        expect( changes ).toEqual( ['closed>open', 'open>minimized', 'minimized>open', 'open>closed'] );
    } );

    it( 'only minimizes an open panel', () => {
        const panel = overlay.register( def( 'a' ) );
        panel.minimize();
        expect( panel.state ).toBe( 'closed' );
    } );

    it( 'toggle minimizes by default and closes with trayToggle: close', () => {
        const a = overlay.register( def( 'a' ) );
        const b = overlay.register( def( 'b', { trayToggle: 'close' } ) );
        a.toggle();
        a.toggle();
        b.toggle();
        b.toggle();
        expect( a.state ).toBe( 'minimized' );
        expect( b.state ).toBe( 'closed' );
        a.toggle();
        expect( a.state ).toBe( 'open' );
    } );

    it( 'calls the hooks, passing args to onShow, also when already open', () => {
        const hooks = { onShow: vi.fn(), onHide: vi.fn(), onMinimize: vi.fn(), dispose: vi.fn() };
        const panel = overlay.register( def( 'a', { mount: () => hooks } ) );
        panel.open( 1 );
        panel.open( 2 );
        panel.minimize();
        panel.open();
        panel.close();
        overlay.unregister( 'a' );
        expect( hooks.onShow.mock.calls.map( c => c[0] ) ).toEqual( [1, 2, undefined] );
        expect( hooks.onMinimize ).toHaveBeenCalledTimes( 1 );
        expect( hooks.onHide ).toHaveBeenCalledTimes( 1 );
        expect( hooks.dispose ).toHaveBeenCalledTimes( 1 );
    } );

    it( 'lets mount return hooks together with content, or append to ctx.body', () => {
        const withContent = overlay.register( def( 'a', { mount: () => ( { content: document.createElement( 'i' ), refresh() {} } ) } ) );
        const manual = overlay.register( def( 'b', { mount: ctx => void ctx.body.append( document.createElement( 'b' ) ) } ) );
        withContent.open();
        manual.open();
        expect( withContent.body.querySelector( 'i' ) ).not.toBeNull();
        expect( manual.body.querySelector( 'b' ) ).not.toBeNull();
    } );

    it( 'survives a throwing mount', () => {
        const error = vi.spyOn( console, 'error' ).mockImplementation( () => undefined );
        const panel = overlay.register( def( 'a', { mount: () => { throw new Error( 'boom' ); } } ) );
        expect( () => panel.open() ).not.toThrow();
        expect( error ).toHaveBeenCalled();
        error.mockRestore();
    } );

    it( 'rejects duplicate ids and unknown ids', () => {
        overlay.register( def( 'a' ) );
        expect( () => overlay.register( def( 'a' ) ) ).toThrow( /already registered/ );
        expect( () => overlay.panels.open( 'nope' ) ).toThrow( /Unknown panel/ );
    } );

    it( 'collapse, fullscreen and dock exclude each other correctly', () => {
        const panel = overlay.register( def( 'a' ) );
        panel.open();
        panel.setFullscreen( true );
        expect( panel.fullscreen ).toBe( true );
        panel.setCollapsed( true );
        expect( panel.fullscreen ).toBe( false );
        panel.setFullscreen( true );
        expect( panel.collapsed ).toBe( false );
        panel.dock( 'left' );
        expect( panel.fullscreen ).toBe( false );
        expect( panel.element.classList.contains( 'kp-docked-left' ) ).toBe( true );
        panel.dock( null );
        expect( panel.element.classList.contains( 'kp-docked-left' ) ).toBe( false );
    } );

    it( 'does not enter fullscreen while closed and leaves it on close', () => {
        const panel = overlay.register( def( 'a' ) );
        panel.setFullscreen( true );
        expect( panel.fullscreen ).toBe( false );
        panel.open();
        panel.setFullscreen( true );
        panel.close();
        expect( panel.fullscreen ).toBe( false );
    } );

    it( 'unregister removes the panel from the DOM', () => {
        const panel = overlay.register( def( 'a' ) );
        overlay.unregister( 'a' );
        expect( overlay.panels.get( 'a' ) ).toBeUndefined();
        expect( panel.element.isConnected ).toBe( false );
    } );
} );

describe( 'stacking', () => {
    const z = ( el: HTMLElement ): number => Number( el.style.zIndex );

    it( 'raises the last opened panel and the last clicked one', () => {
        const a = overlay.register( def( 'a' ) );
        const b = overlay.register( def( 'b' ) );
        a.open();
        b.open();
        expect( z( b.element ) ).toBeGreaterThan( z( a.element ) );
        a.element.dispatchEvent( new Event( 'pointerdown' ) );
        expect( z( a.element ) ).toBeGreaterThan( z( b.element ) );
        b.open();
        expect( z( b.element ) ).toBeGreaterThan( z( a.element ) );
    } );
} );

describe( 'refresh', () => {
    it( 'refreshes open panels and minimized active ones, not closed or idle ones', () => {
        const hooks = ( active: boolean ) => ( { refresh: vi.fn(), isActive: () => active } );
        const [open, activeMin, idleMin, closed] = [hooks( false ), hooks( true ), hooks( false ), hooks( true )];
        const panels = [open, activeMin, idleMin, closed].map( ( h, i ) => overlay.register( def( `p${i}`, { mount: () => h } ) ) );
        panels[0].open();
        panels[1].open();
        panels[1].minimize();
        panels[2].open();
        panels[2].minimize();
        overlay.refresh();
        expect( open.refresh ).toHaveBeenCalledTimes( 1 );
        expect( activeMin.refresh ).toHaveBeenCalledTimes( 1 );
        expect( idleMin.refresh ).not.toHaveBeenCalled();
        expect( closed.refresh ).not.toHaveBeenCalled();
    } );

    it( 'throttles requestRefresh into one refresh', () => {
        vi.useFakeTimers();
        const refresh = vi.fn();
        overlay.register( def( 'a', { mount: () => ( { refresh } ) } ) ).open();
        overlay.requestRefresh();
        overlay.requestRefresh();
        overlay.requestRefresh();
        vi.advanceTimersByTime( 300 );
        expect( refresh ).toHaveBeenCalledTimes( 1 );
        vi.useRealTimers();
    } );
} );

describe( 'tray integration', () => {
    const buttons = (): HTMLButtonElement[] => Array.from( overlay.root.querySelectorAll( '.kp-tray-btn[data-panel]' ) );

    it( 'shows one button per panel, lit when open, with a badge', () => {
        const a = overlay.register( def( 'a', { mount: ctx => void ctx.setBadge( 3 ) } ) );
        overlay.register( def( 'b' ) );
        expect( buttons().map( b => b.dataset.panel ) ).toEqual( ['a', 'b'] );
        a.open();
        const btn = buttons()[0];
        expect( btn.classList.contains( 'kp-on' ) ).toBe( true );
        expect( btn.querySelector( '.kp-tray-badge' )?.textContent ).toBe( '3' );
    } );

    it( 'outlines a minimized panel that is active', () => {
        const a = overlay.register( def( 'a', { mount: () => ( { isActive: () => true } ) } ) );
        a.open();
        a.minimize();
        expect( buttons()[0].classList.contains( 'kp-has' ) ).toBe( true );
    } );

    it( 'toggles the panel on click and removes the button on unregister', () => {
        const a = overlay.register( def( 'a', { trayToggle: 'close' } ) );
        buttons()[0].click();
        expect( a.state ).toBe( 'open' );
        buttons()[0].click();
        expect( a.state ).toBe( 'closed' );
        overlay.unregister( 'a' );
        expect( buttons() ).toHaveLength( 0 );
    } );
} );

describe( 'persistence', () => {
    it( 'restores position, size, collapsed, dock and state in a new overlay', () => {
        const storage = memoryStorage();
        const first = createOverlay( { storage } );
        const a = first.register( def( 'a' ) );
        a.open();
        a.moveTo( { left: 50, top: 60 } );
        a.resizeTo( { width: 300, height: 200 } );
        a.setCollapsed( true );
        const b = first.register( def( 'b' ) );
        b.open();
        b.minimize();
        first.register( def( 'c' ) );
        first.dispose();

        const second = createOverlay( { storage } );
        const a2 = second.register( def( 'a' ) );
        const b2 = second.register( def( 'b' ) );
        const c2 = second.register( def( 'c' ) );
        expect( a2.state ).toBe( 'open' );
        expect( a2.collapsed ).toBe( true );
        expect( a2.element.style.width ).toBe( '300px' );
        expect( a2.element.style.height ).toBe( '200px' );
        expect( a2.element.style.left ).toBe( '50px' );
        expect( a2.element.style.top ).toBe( '60px' );
        expect( b2.state ).toBe( 'minimized' );
        expect( c2.state ).toBe( 'closed' );
        second.dispose();
    } );

    it( 'restores geometry but not state with restoreState: false', () => {
        const storage = memoryStorage();
        const first = createOverlay( { storage } );
        const a = first.register( def( 'a' ) );
        a.open();
        a.resizeTo( { width: 310 } );
        first.dispose();

        const second = createOverlay( { storage, restoreState: false } );
        const a2 = second.register( def( 'a' ) );
        expect( a2.state ).toBe( 'closed' );
        a2.open();
        expect( a2.element.style.width ).toBe( '310px' );
        second.dispose();
    } );
} );

describe( 'overlay lifecycle', () => {
    it( 'adds one host with a shadow root and removes it on dispose', () => {
        expect( document.querySelectorAll( 'kiwi-panels' ) ).toHaveLength( 1 );
        expect( overlay.root.querySelector( 'style' )?.textContent ).toContain( '.kp-panel' );
        overlay.dispose();
        expect( document.querySelectorAll( 'kiwi-panels' ) ).toHaveLength( 0 );
        overlay = createOverlay( { storage: false } );
    } );

    it( 'reuses the active overlay with singleton: true', () => {
        const a = createOverlay( { storage: false, singleton: true } );
        const b = createOverlay( { storage: false, singleton: true } );
        expect( b ).toBe( a );
        a.dispose();
        expect( createOverlay( { storage: false, singleton: true } ) ).not.toBe( a );
    } );

    it( 'applies theme overrides as custom properties', () => {
        const themed = createOverlay( { storage: false, theme: { accent: 'red', panelWidth: '500px' } } );
        expect( themed.host.style.getPropertyValue( '--kp-accent' ) ).toBe( 'red' );
        expect( themed.host.style.getPropertyValue( '--kp-panel-width' ) ).toBe( '500px' );
        themed.dispose();
    } );

    it( 'works without a tray', () => {
        const bare = createOverlay( { storage: false, tray: false } );
        bare.register( def( 'a' ) ).open();
        expect( bare.root.querySelector( '.kp-tray' ) ).toBeNull();
        bare.dispose();
    } );
} );
