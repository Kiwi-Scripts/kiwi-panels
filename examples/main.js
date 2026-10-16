import { createOverlay, cornerDock, edgeBar, localStorageAdapter, button, div, span } from '../dist/index.js';

const params = new URLSearchParams( location.search );
const tray = params.get( 'tray' ) === 'bar' ? edgeBar( { edge: params.get( 'edge' ) ?? 'bottom' } ) : cornerDock();

const overlay = createOverlay( {
    tray,
    storage: localStorageAdapter( 'kiwi-panels-example' ),
    hotkeys: { modifier: 'Alt', latchKey: 'KeyL', escapeToClose: true }
} );
window.overlay = overlay;

// Level 1: plain DOM. Return a node.
overlay.register( {
    id: 'notes',
    title: 'Notes',
    hotkey: 'KeyN',
    defaultPosition: 'top-left',
    mount: () => {
        const area = document.createElement( 'textarea' );
        area.rows = 8;
        area.style.cssText = 'width: 100%; box-sizing: border-box;';
        area.placeholder = 'Type here. Alt+N toggles this panel.';
        return area;
    }
} );

// Level 2: lifecycle hooks. Count while open, keep counting while minimized.
overlay.register( {
    id: 'counter',
    title: 'Counter',
    hotkey: 'KeyC',
    defaultPosition: 'top-right',
    trayToggle: 'minimize',
    mount: ctx => {
        let count = 0;
        let running = false;
        const value = span( 'kp-name', '0' );
        const toggle = button( 'Start', 'Start or stop counting', () => {
            running = !running;
            toggle.textContent = running ? 'Stop' : 'Start';
            ctx.updateTray();
        } );
        const row = div( 'kp-row' );
        row.append( span( 'kp-muted', 'ticks: ' ), value, div( 'kp-spacer' ), toggle );
        const timer = setInterval( () => {
            if ( running ) {
                count++;
                ctx.requestRefresh();
                ctx.setBadge( count );
            }
        }, 200 );
        return {
            content: row,
            isActive: () => running,
            refresh: () => { value.textContent = String( count ); },
            dispose: () => clearInterval( timer )
        };
    }
} );

overlay.register( {
    id: 'about',
    title: 'About',
    defaultPosition: 'center',
    size: { width: 320 },
    mount: ctx => {
        const box = div( '' );
        box.textContent = 'Drag the header, resize from the corner, dock with the arrows, collapse, minimize or go fullscreen. Reload: it all comes back.';
        return box;
    }
} );
