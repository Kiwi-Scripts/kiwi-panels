# @kiwi-js/panels

A framework-agnostic HTML overlay library: register "panels" and open them from a taskbar/tray. Panels are draggable, resizable, dockable to the left/right edge, collapsible, minimizable, can go fullscreen, stack by last use, and remember their state. Everything renders into one shadow root, so page styles and overlay styles stay apart.

```ts
import { createOverlay, cornerDock } from '@kiwi-js/panels';

const overlay = createOverlay( {
    tray: cornerDock( { corner: 'bottom-right' } ),   // or edgeBar( { edge: 'bottom' } ), or your own Tray
    hotkeys: { modifier: 'Alt', latchKey: 'KeyL' }    // optional
} );

// Level 1 - plain DOM: return a node.
overlay.register( { id: 'notes', title: 'Notes', hotkey: 'KeyN', mount: () => document.createElement( 'textarea' ) } );

// Level 2 - lifecycle: return hooks (optionally with `content`).
overlay.register( {
    id: 'clock',
    title: 'Clock',
    mount: ctx => {
        const out = document.createElement( 'div' );
        return { content: out, refresh: () => { out.textContent = new Date().toLocaleTimeString(); } };
    }
} );

overlay.panels.open( 'clock' );
setInterval( () => overlay.requestRefresh(), 1000 );
```

## API

- Comming soon
