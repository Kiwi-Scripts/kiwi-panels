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

Browser only: `createOverlay()` throws without a DOM. Ships ESM and CJS with types.

## Contents

- [Concepts](#concepts)
- [`createOverlay( options )`](#createoverlay-options-)
- [The `Overlay` object](#the-overlay-object)
- [Defining panels](#defining-panels)
- [Panel lifecycle and states](#panel-lifecycle-and-states)
- [`PanelHandle`](#panelhandle)
- [Placement](#placement)
- [Trays](#trays)
- [Hotkeys and the modifier key](#hotkeys-and-the-modifier-key)
- [Persistence](#persistence)
- [Theming](#theming)
- [Dormant launcher](#dormant-launcher)
- [DOM helpers](#dom-helpers)

## Concepts

- **Overlay**: one per page (see `singleton`). It owns a host element (`<kiwi-panels>`) with a shadow root, the panels, the tray, the hotkeys and the persistence.
- **Panel**: a registered window with an `id`, a `title` and a `mount()` function that builds its content. The overlay owns the window chrome (header, drag, resize, dock, fullscreen); you own the content.
- **Tray**: the taskbar. It draws one button per panel and reports clicks; it does not own panels.
- **Panel stack**: open panels are ordered by last use (opening, clicking or `raise()` brings one to the top). They use z-indexes just below the maximum, so they sit above page content; the tray is above the panels.

## `createOverlay( options )`

All options are optional.

| Option | Default | Meaning |
| --- | --- | --- |
| `tray` | `cornerDock()` | A `Tray`, or `false` for none (e.g. when the application opens panels itself). |
| `trayCommands` | none | `TrayCommand[]`: extra tray buttons not tied to a panel (e.g. a power button), shown after the panel buttons. |
| `theme` | built-in dark | Design token overrides, see [Theming](#theming). |
| `storage` | session storage | A [`StorageAdapter`](#persistence), or `false` to turn persistence off. |
| `restoreState` | `true` | Reopen the panels that were open/minimized when the page was left. Positions, sizes, collapsed and dock state are always restored. |
| `hotkeys` | on, no modifier | `{ modifier?, latchKey?, trayLatch?, escapeToClose? }`, or `false` to attach no key listeners at all. See [Hotkeys](#hotkeys-and-the-modifier-key). |
| `runOutside` | runs directly | `<T>( fn: () => T ) => T`. Wraps the registration of listeners and timers; pass e.g. `NgZone.runOutsideAngular` so hovering and dragging do not trigger change detection. |
| `refreshInterval` | `250` | Minimum ms between throttled refreshes. |
| `singleton` | `false` | If an overlay created with `singleton: true` is still active, return it instead of creating a second one. |
| `container` | `document.body` | Where the host element is added. |

## The `Overlay` object

```ts
overlay.register( definition ): PanelHandle   // throws if the id is already registered
overlay.unregister( id )                      // force-closes the panel and removes it with its tray button
overlay.panels                                // PanelsApi, see below
overlay.refresh()                             // refresh all open panels now
overlay.requestRefresh()                      // refresh soon, at most once per refreshInterval
overlay.inOverlay( target )                   // true if the node/event target belongs to the overlay
overlay.on( type, listener ): () => void      // returns an unsubscribe function
overlay.host / overlay.root                   // the host element and its shadow root
overlay.modifier / overlay.hotkeys            // the modifier key (if configured) and the hotkey registry
overlay.dispose()                             // removes everything the overlay added to the page
```

`overlay.panels`: `get( id )`, `list()` (registration order), and `open( id, args? )`, `close( id )`, `toggle( id )`, `minimize( id )`, `raise( id )`, `dock( id, side )`. The action methods **throw for an unknown id**; `get` returns `undefined`.

Events (`overlay.on`):

| Event | Payload |
| --- | --- |
| `panelchange` | `{ id, state, previous }` when a panel is opened, closed or minimized |
| `register` / `unregister` | `{ id }` |
| `dispose` | `undefined` |

`dispose()` keeps the persisted state (so the panels come back on the next page load); `unregister( id )` closes the panel first.

`overlay.refresh()` only calls `refresh` on panels that need it (see below) and then updates the tray. Nothing refreshes by itself on a timer: call `requestRefresh()` when your data changes, or on your own interval.

## Defining panels

```ts
overlay.register( {
    id: 'inspector',                 // unique per overlay
    title: 'Inspector',
    icon: 'M3 3h18v18H3z',           // SVG path (24x24) or a Node; default: first letter of the title
    hotkey: 'KeyI',                  // toggles the panel, see Hotkeys
    size: { width: 420 },            // initial px; height defaults to content, width to the theme
    minSize: { width: 240, height: 120 },
    defaultPosition: 'top-right',    // see Placement; default 'center'
    dockable: true,
    trayToggle: 'minimize',          // what the tray button does to an open panel: 'minimize' | 'close'
    mount: ctx => { /* ... */ }
} );
```

| Field | Default | Meaning |
| --- | --- | --- |
| `collapsible`, `minimizable`, `closable`, `fullscreenable`, `resizable` | `true` | Enable the matching header button / behaviour. |
| `dockable` | `false` | Allow snapping to the full height of the left or right edge. |
| `tray` | `true` | Whether the panel has a tray button. Without one it is opened only by code or its hotkey. |
| `trayToggle` | `'minimize'` | What the tray button does to an *open* panel. |
| `className` | none | Extra class on the panel element. |

### `mount( ctx )`

Called when the panel is opened (or restored) and **again every time it is opened after having been closed**. Minimizing does not unmount. Two levels, which can be mixed:

1. **Plain DOM**: return a `Node`, or append to `ctx.body` yourself, or return nothing.
2. **Lifecycle**: return an object with any of the hooks below, plus optionally `content: Node` to put in the body.

Hooks (`PanelHooks`), all optional:

| Hook | When |
| --- | --- |
| `onShow( args? )` | Opened, or opened again with other `args` while already open (so `args` can retarget the panel). |
| `beforeClose()` | About to close via the close button, `close()`, Escape or the tray. Return `false` to keep it open (e.g. to stop something running first). `close( { force: true } )` skips it. A throwing hook does not block closing. |
| `onHide()` | Closed. |
| `onMinimize()` | Minimized (hidden, not closed). |
| `refresh()` | Redraw; throttled. |
| `isActive()` | Whether the panel holds something running. A minimized panel that is active keeps refreshing and is outlined in the tray. |
| `dispose()` | The content ends: closed (it will mount again when reopened) or removed with the overlay. |

Errors thrown by hooks are caught and logged as `[kiwi-panels] panel "<id>": <hook> failed`.

### `PanelContext` (`ctx`)

`id`, `overlay`, `panel` (the `PanelHandle`), `body` (the scrolling content area), plus:

- `setTitle( title )`
- `setBadge( count | text | null )`: count on the tray button; `null`, `''` and `0` hide it
- `setHeaderLeft( nodes )`: nodes after the collapse button and title
- `setHeaderRight( nodes )`: nodes before the minimize/fullscreen/close buttons
- `requestRefresh()`: throttled refresh of all panels
- `updateTray()`: tell the tray something it shows changed (e.g. what `isActive()` returns)

## Panel lifecycle and states

`PanelState` is `'closed' | 'open' | 'minimized'`.

| State | Visible | Content mounted | Tray button |
| --- | --- | --- | --- |
| `closed` | no | no (`dispose` + body emptied on close) | idle |
| `open` | yes | yes | lit |
| `minimized` | no | yes, kept alive | lit; outlined while `isActive()` |

- Closing **ends the content**: the next `open()` runs `mount()` again. Only the window (position, size, collapsed, dock) is remembered. Use `minimize()` to keep the content.
- `toggle()` opens a closed/minimized panel and, for an open one, minimizes it (or closes it with `trayToggle: 'close'`).
- Refreshing: an `open` panel, a previewing panel, and a `minimized` panel whose `isActive()` returns true are refreshed; others are not.
- **Escape** (when `hotkeys` is not `false`) leaves fullscreen first. With `escapeToClose: true` it then closes the topmost open panel.

### Preview

`handle.preview( args?, at? )` shows a closed or minimized panel *transiently*, next to the viewport point `at` (default: where it would open). It does not touch the tray, the persisted state or focus, and calls `onShow( args )`; calling it again retargets it. Open panels are unaffected. `endPreview()` hides it: a closed panel ends as after `close()`; a minimized one goes back to minimized, content intact. Calling `open()`/`toggle()` during a preview **promotes it in place**: same mounted content, same position (unless the user has placed the panel before, in which case it goes there). What starts and ends a preview (a held key, hovering, ...) is up to you. `handle.previewing` tells whether one is showing; `state` stays `closed`/`minimized` meanwhile.

## `PanelHandle`

Returned by `register()` and `overlay.panels.get()`.

Read-only: `id`, `element` (root element in the shadow root), `body`, `state`, `collapsed`, `fullscreen`, `dockSide` (`'left' | 'right' | null`), `previewing`.

Methods: `open( args? )`, `close( { force? } )`, `preview( args?, at? )`, `endPreview()`, `toggle()`, `minimize()`, `raise()`, `setCollapsed( on )`, `setFullscreen( on )`, `dock( side | null )`, `moveTo( pos )`, `resizeTo( size )`.

`open()` on an already-open panel only raises it and calls `onShow` again. `moveTo` takes `{ left, top }` or `{ right, top }` (px from the viewport's top-left / top-right corner).

## Placement

`defaultPosition` says where a panel appears when the user has not moved it yet. **Once the user drags a panel, that position is kept (and persisted), and overrides `defaultPosition`.** Panels are kept inside the viewport (8px margin) and re-laid out on window resize.

| Spec | Result |
| --- | --- |
| `'center'`, `'top-left'`, `'top-center'`, `'top-right'`, `'bottom-left'`, `'bottom-center'`, `'bottom-right'`, `'center-left'`, `'center-right'` | A fixed place. |
| `{ left, top }` / `{ right, top }` | Explicit px position. |
| `'cursor'` | Next to where the pointer last was. Same as `{ anchor: 'cursor' }`. |
| `{ anchor, steps? }` | Next to an anchor: an `Element`, `Rect`, `{x, y}`, `'cursor'`, or a function returning one (asked each time the panel is placed). |
| `{ at, stack, gap? }` | A fixed place that makes room for panels already open there: moves past them in the direction(s) `'left' \| 'right' \| 'up' \| 'down'` (or an array, tried in turn), by their size plus `gap` (default 8). |
| `( panel, env ) => pos` | Fully custom. `env` has `pointer` and `obstacles()` (rects of other shown panels). |

**Anchored steps** are tried in order; the first where the panel fully fits the viewport wins. If none fits, the first is used and the panel is pushed inside. A step is an object `{ side, gap?, align?, clamp? }` or a string `'<right|left|above|below>[+gap] [start|center|end] [clamp]'` (e.g. `'right+16'`, `'below+8 center clamp'`). `clamp` lets the panel slide along the other axis to fit. Default steps: `['right+16', 'below+16 clamp', 'above+16 clamp']`. Invalid strings throw.

The pure helpers `placeAround( anchorRect, size, view, steps? )` and `placeStacked( ... )` are exported for use outside panels.

## Trays

A `Tray` is just an interface, so you can write your own:

```ts
interface Tray {
    trayHotkey?: string | null;                    // key that opens/pins the tray; default 'KeyT', null disables
    toggle?( state?: boolean ): void;              // open/pin the tray
    mount( container: HTMLElement, actions: TrayActions ): void;   // once; container is inside the shadow root
    update( items: readonly TrayItem[] ): void;    // on any change; registration order
    setModifierState?( s: { held: boolean; latched: boolean } ): void;
    dispose(): void;
}
```

`TrayItem`: `{ id, title, icon?, badge, state, hotkey?, active }`. `TrayActions`: `toggle( id )`, `commands?`, `modifier?` (label of the modifier key), `launcher?()`.

Built in:

- **`cornerDock( { corner?, icon?, trayHotkey? } )`**: a round launcher in a corner (`'bottom-right'` default, `'bottom-left'`, `'top-right'`, `'top-left'`). Hovering slides out a row of panel buttons; a pin button keeps it open. The launcher is labelled with the modifier key when there is one. Without a modifier, clicking the launcher pins the row.
- **`edgeBar( { edge?, iconsOnly? } )`**: a taskbar along `'bottom'` (default), `'top'`, `'left'` or `'right'`, with a labelled button per panel (`iconsOnly` for icons only).

Tray behaviour: the tray hotkey (`KeyT` unless overridden) needs the modifier key when the overlay has one. With `hotkeys.trayLatch: true`, clicking the launcher latches the modifier instead of pinning the tray.

## Hotkeys and the modifier key

```ts
createOverlay( { hotkeys: { modifier: 'Alt', latchKey: 'KeyL', trayLatch: false, escapeToClose: false } } );
```

- `modifier` (`'Alt' | 'Control' | 'Shift' | 'Meta'`): when set, panel hotkeys fire only while it is held (or latched). Without one, they fire as plain keys, **except while typing** in a text field.
- `latchKey` (a `KeyboardEvent.code`): pressed with the modifier, latches it so hotkeys work without holding it. While latched, pressing it alone or tapping the modifier alone releases the latch.
- `PanelDefinition.hotkey` and `HotkeyBinding.combo` use `KeyboardEvent.code` values, optionally with extra modifiers that must match exactly: `'KeyF'`, `'Shift+KeyR'`, `'Ctrl+Alt+Digit1'` (`shift`, `ctrl`/`control`, `alt`, `meta`/`cmd`). Unknown modifiers throw.
- A handler that returns `false` passes the key on; anything else consumes it (`preventDefault` + `stopPropagation`). Key repeats are ignored.
- `overlay.hotkeys.bind( { combo, modifier?, allowWhileEditing?, handler } )` adds your own binding and returns an unbind function. `modifier` defaults to `true` when the overlay has a modifier key.
- `hotkeys: false` attaches no key listeners (no panel hotkeys, no Escape handling, no tray hotkey).

## Persistence

Per panel, the overlay stores `{ state, collapsed, dock, pos?, size? }` under the key `<prefix>:<panelId>`. `pos` and `size` are only present once the user moved or resized the panel. Stored data is validated on load, so corrupt or old data falls back to defaults.

```ts
createOverlay( { storage: localStorageAdapter( 'my-app' ) } );   // default: sessionStorageAdapter() with prefix 'kiwi-panels'
createOverlay( { storage: false } );                             // no persistence
```

Adapters: `sessionStorageAdapter( prefix? )`, `localStorageAdapter( prefix? )`, `webStorage( () => Storage, prefix? )` (all guarded against blocked/full storage), `memoryStorage()`. A custom `StorageAdapter` is `{ get( key ), set( key, value ), remove( key ) }` with string values (synchronous).

On `register()`, the saved window state is applied, and (with `restoreState`) an `open` panel is reopened and a `minimized` one is mounted and minimized. Since registration restores immediately, **register panels after the overlay is configured** and expect `onShow`/`mount` to run during `register()` for restored panels.

## Theming

Pass `theme` to override design tokens; each maps to the CSS variable `--kp-<kebab-case>` on the host element.

| Token | Default |
| --- | --- |
| `bg`, `bgAlt`, `bgHover` | `#1e1e1e`, `#181818`, `#2a2d2e` |
| `fg`, `muted` | `#d4d4d4`, `#808080` |
| `border`, `borderStrong` | `#333`, `#555` |
| `accent`, `accentFg`, `info` | `#ff9800`, `#000`, `#4fc3f7` |
| `font` | `12px/1.4 Consolas, 'Courier New', monospace` |
| `radius`, `shadow`, `panelWidth` | `4px`, `0 4px 16px rgba(0,0,0,.5)`, `380px` |

Your own content inside a panel is in the shadow root, so page CSS does not reach it: style it with inline styles, or inject a `<style>` into the content.

## Dormant launcher

For hosts that keep the overlay switched off until asked for:

```ts
const dormant = createDormantLauncher( {
    label: 'Off', corner: 'bottom-right',       // also: title, icon, theme, container
    onWake() { dormant.dispose(); startOverlay(); }
} );
```

It renders only a dimmed launcher: no panels, hotkeys or listeners. It stays until `dispose()`, so dispose it in `onWake` before creating the real overlay.

## DOM helpers

Small helpers for building panel content, all exported: `div`, `span`, `badge`, `button`, `link`, `svgIcon( path )`, `svgEl`, `renderIcon`, `renderSection`, `renderDetails`, `openKeys` / `keepState` (preserve which `<details>` are open across re-renders), `isEditing( event )` (is the user typing in a field), `placeBox( box, element )`, and `renderHeader( spec )` (the header row used by panels). Their classes (`kp-*`) are styled by the overlay's stylesheet; they only look right inside the overlay's shadow root.

## Development

```sh
npm run build       # tsup -> dist/
npm run dev         # watch
npm run typecheck
npm test            # vitest + happy-dom
```

`examples/` has a runnable demo against `dist/` (`?tray=bar&edge=left` switches to the edge bar).

## License

MIT
