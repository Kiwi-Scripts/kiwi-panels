import { OVERLAY_ATTR } from '../constants';
import { button, div, span } from '../dom/h';
import type { Overlay } from '../overlay';
import type { PanelPersistence } from '../persistence/panel-persistence';
import type { TrayItem } from '../tray/tray';
import type { AnyPos, DockSide, PanelChange, PanelSize, PanelState } from '../types';
import { keyLabel } from '../tray/tray-button';
import { renderHeader } from './header';
import { dragPanel, nearPoint, placePanel } from './movable';
import type { PanelContext, PanelDefinition, PanelHandle, PanelHooks } from './panel-definition';
import type { PanelStack } from './panel-stack';
import { isDynamic, resolvePosition, type PlacementEnv } from './placement';
import { attachResize } from './resizable';

export interface ControllerEnv {
    overlay: Overlay;
    /** The element in the shadow root that panels are appended to. */
    layer: HTMLElement;
    stack: PanelStack;
    persistence?: PanelPersistence;
    /** Reopen (or re-minimize) panels as they were when persisted. */
    restoreState: boolean;
    onStateChange( change: PanelChange ): void;
    /** Anything the tray shows changed. */
    onTrayChange(): void;
    requestRefresh(): void;
    /** What the placement of a panel can look at: the pointer and the other panels. */
    placement( self: HTMLElement ): PlacementEnv;
}

export interface PanelController {
    readonly handle: PanelHandle;
    /** Applies persisted state. Called by the overlay after the controller is registered. */
    restore(): void;
    /** Places the panel again, e.g. after the window was resized. */
    relayout(): void;
    /** Whether a refresh should reach this panel: it is open, or minimized with something running. */
    needsRefresh(): boolean;
    refresh(): void;
    trayItem(): TrayItem;
    /** Whether the panel has a button in the tray (`PanelDefinition.tray`). */
    readonly inTray: boolean;
    dispose(): void;
}

/** Hooks belong to the panel's author; a failing one must not take the overlay down with it. */
function guard( id: string, name: string, fn: () => void ): void {
    try {
        fn();
    } catch ( error ) {
        console.error( `[kiwi-panels] "${id}": ${name} failed:`, error );
    }
}

/**
 * The shell and the state machine of one panel: closed | open | minimized, plus collapsed, fullscreen and docked.
 * It builds the root, header and body, wires dragging, resizing and docking, and reports every change.
 */
export function createPanelController( def: PanelDefinition, env: ControllerEnv ): PanelController {
    const { id } = def;
    const collapsible = def.collapsible ?? true;
    const minimizable = def.minimizable ?? true;
    const closable = def.closable ?? true;
    const fullscreenable = def.fullscreenable ?? true;
    const resizable = def.resizable ?? true;
    const dockable = def.dockable ?? false;

    const el = div( `kp-panel ${def.className ?? ''}`.trim() );
    el.setAttribute( OVERLAY_ATTR, '' );
    el.dataset.panel = id;
    const body = div( 'kp-body' );
    let header: HTMLElement = div( 'kp-header' );
    el.append( header, body );
    if ( def.minSize?.width !== undefined ) {
        el.style.minWidth = `${def.minSize.width}px`;
    }
    if ( def.minSize?.height !== undefined ) {
        el.style.minHeight = `${def.minSize.height}px`;
    }
    env.layer.append( el );
    env.stack.add( el );

    let state: PanelState = 'closed';
    let collapsed = false;
    let fullscreen = false;
    let dockSide: DockSide | null = null;
    let title = def.title;
    let badge: string | number | null = null;
    let leftNodes: Node[] = [];
    let rightNodes: Node[] = [];
    let pos: AnyPos | undefined;
    let size: Partial<PanelSize> = { ...def.size };
    // Only what the user changed is persisted; the defaults come from the definition.
    let moved = false;
    let resized = false;
    let hooks: PanelHooks = {};
    let mounted = false;
    let disposed = false;
    // A preview shows a closed or minimized panel transiently; it is not a state (nothing about it is persisted or shown in the tray).
    let previewing = false;
    let previewAt: { x: number; y: number } | undefined;
    let previewPos: AnyPos | undefined;
    // Where the panel is while it is open, if not where the user keeps it: set when a preview is promoted in place.
    let session: AnyPos | undefined;
    // The default position of a dynamic specification (next to the pointer, ...) is worked out once per open.
    let autoPos: AnyPos | undefined;
    const spec = def.defaultPosition ?? 'center';
    const dynamic = isDynamic( spec );

    const persist = (): void => {
        if ( disposed ) {
            return;
        }
        env.persistence?.save( id, { state, collapsed, dock: dockSide, pos: moved ? pos : undefined, size: resized ? size : undefined } );
    };

    const applySize = (): void => {
        el.style.width = size.width !== undefined ? `${size.width}px` : '';
        el.style.height = size.height !== undefined ? `${size.height}px` : '';
    };

    const layout = (): void => {
        const open = state === 'open';
        const preview = previewing && !open;
        el.classList.toggle( 'kp-open', open );
        el.classList.toggle( 'kp-preview', preview );
        el.classList.toggle( 'kp-collapsed', collapsed );
        el.classList.toggle( 'kp-fullscreen', fullscreen );
        el.classList.toggle( 'kp-docked-left', dockSide === 'left' );
        el.classList.toggle( 'kp-docked-right', dockSide === 'right' );
        applySize();
        if ( ( open || preview ) && !dockSide && !fullscreen ) {
            if ( preview && previewAt ) {
                placePanel( el, previewPos = nearPoint( el, previewAt ) );
            } else {
                const where = session ?? ( moved && pos ? pos : dynamic ? autoPos ??= resolvePosition( spec, el, env.placement( el ) ) : resolvePosition( spec, el, env.placement( el ) ) );
                placePanel( el, where );
            }
        }
    };

    const dockButton = ( side: DockSide ): HTMLElement => button(
        side === 'left' ? '⇤' : '⇥', dockSide === side ? 'Undock' : `Dock to the ${side}`,
        () => handle.dock( dockSide === side ? null : side ), { on: dockSide === side, mini: true } );

    const rebuildHeader = (): void => {
        const next = renderHeader( {
            collapse: collapsible ? { title: collapsed ? 'Expand' : 'Collapse', collapsed, onClick: () => handle.setCollapsed( !collapsed ) } : undefined,
            left: [span( 'kp-title kp-ellipsis', title ), ...leftNodes],
            right: [...( dockable ? [dockButton( 'left' ), dockButton( 'right' )] : [] ), ...rightNodes],
            minimize: minimizable ? { title: 'Minimize', onClick: () => handle.minimize() } : undefined,
            fullscreen: fullscreenable ? { title: fullscreen ? 'Exit fullscreen' : 'Fullscreen', active: fullscreen, onClick: () => handle.setFullscreen( !fullscreen ) } : undefined,
            close: closable ? { title: 'Close', onClick: () => handle.close() } : undefined,
            onPointerDown: ev => {
                if ( !dockSide && !fullscreen ) {
                    dragPanel( ev, el, p => {
                        pos = p;
                        moved = true;
                        session = undefined;
                        layout();
                    }, persist );
                }
            }
        } );
        header.replaceWith( next );
        header = next;
    };

    const changed = (): void => {
        layout();
        rebuildHeader();
        persist();
        env.onTrayChange();
    };

    const setState = ( next: PanelState ): void => {
        const previous = state;
        state = next;
        layout();
        persist();
        env.onStateChange( { id, state: next, previous } );
        env.onTrayChange();
    };

    const ensureMounted = (): void => {
        if ( mounted ) {
            return;
        }
        mounted = true;
        const ctx: PanelContext = {
            id,
            overlay: env.overlay,
            panel: handle,
            body,
            setTitle: next => {
                title = next;
                rebuildHeader();
                env.onTrayChange();
            },
            setBadge: next => {
                badge = next;
                env.onTrayChange();
            },
            setHeaderLeft: nodes => {
                leftNodes = nodes;
                rebuildHeader();
            },
            setHeaderRight: nodes => {
                rightNodes = nodes;
                rebuildHeader();
            },
            requestRefresh: env.requestRefresh,
            updateTray: env.onTrayChange
        };
        guard( id, 'mount', () => {
            const result = def.mount( ctx );
            if ( result instanceof Node ) {
                body.append( result );
            } else if ( result ) {
                if ( result.content ) {
                    body.append( result.content );
                }
                hooks = result;
            }
        } );
    };

    /**
     * Closing a panel ends its content: `dispose` runs, the body is emptied and everything `mount()` set up (title, badge, header
     * items, hooks) is reset, so that the next `open()` mounts afresh. Where the window is (position, size, dock) stays.
     */
    const teardown = (): void => {
        if ( !mounted ) {
            return;
        }
        const ended = hooks;
        mounted = false;
        hooks = {};
        guard( id, 'dispose', () => ended.dispose?.() );
        body.replaceChildren();
        title = def.title;
        badge = null;
        leftNodes = [];
        rightNodes = [];
        rebuildHeader();
        env.onTrayChange();
    };

    /** Whether the panel's `beforeClose` hook asked to stay open. A hook that throws does not keep the panel from closing. */
    const askToKeep = (): boolean => {
        try {
            return hooks.beforeClose?.() === false;
        } catch ( error ) {
            console.error( `[kiwi-panels] panel "${id}": beforeClose failed`, error );
            return false;
        }
    };

    const handle: PanelHandle = {
        id,
        element: el,
        body,
        get state() { return state; },
        get collapsed() { return collapsed; },
        get fullscreen() { return fullscreen; },
        get dockSide() { return dockSide; },
        get previewing() { return previewing; },

        open( args ) {
            if ( disposed ) {
                return;
            }
            ensureMounted();
            const wasOpen = state === 'open';
            if ( !wasOpen ) {
                if ( previewing ) {
                    // Promoted in place: the window stays where the preview is, also if the user has placed this panel elsewhere before.
                    if ( !dockSide && previewPos ) {
                        session = previewPos;
                    }
                    previewing = false;
                    previewAt = undefined;
                    previewPos = undefined;
                }
                setState( 'open' );
                rebuildHeader();
            }
            env.stack.raise( el );
            guard( id, 'onShow', () => hooks.onShow?.( args ) );
        },
        close( options ) {
            if ( state === 'closed' ) {
                handle.endPreview();
                return;
            }
            if ( !options?.force && askToKeep() ) {
                return;
            }
            fullscreen = false;
            previewing = false;
            previewAt = undefined;
            previewPos = undefined;
            session = undefined;
            autoPos = undefined;
            setState( 'closed' );
            guard( id, 'onHide', () => hooks.onHide?.() );
            teardown();
        },
        preview( args, at ) {
            if ( disposed || state === 'open' ) {
                return;
            }
            ensureMounted();
            const first = !previewing;
            previewing = true;
            previewAt = at;
            layout();
            if ( first ) {
                rebuildHeader();
            }
            env.stack.raise( el );
            guard( id, 'onShow', () => hooks.onShow?.( args ) );
        },
        endPreview() {
            if ( !previewing ) {
                return;
            }
            previewing = false;
            previewAt = undefined;
            previewPos = undefined;
            layout();
            if ( state === 'closed' ) {
                guard( id, 'onHide', () => hooks.onHide?.() );
                teardown();
            } else {
                guard( id, 'onMinimize', () => hooks.onMinimize?.() );
            }
        },
        toggle() {
            if ( state === 'open' ) {
                return def.trayToggle === 'close' ? handle.close() : handle.minimize();
            }
            handle.open();
        },
        minimize() {
            if ( state !== 'open' ) {
                return;
            }
            setState( 'minimized' );
            guard( id, 'onMinimize', () => hooks.onMinimize?.() );
        },
        raise: () => env.stack.raise( el ),
        setCollapsed( on ) {
            if ( on === collapsed ) {
                return;
            }
            collapsed = on;
            if ( on ) {
                fullscreen = false;
            }
            changed();
        },
        setFullscreen( on ) {
            if ( on === fullscreen || ( on && state !== 'open' ) ) {
                return;
            }
            fullscreen = on;
            if ( on ) {
                collapsed = false;
            }
            changed();
        },
        dock( side ) {
            if ( side === dockSide ) {
                return;
            }
            dockSide = side;
            if ( side ) {
                fullscreen = false;
            }
            changed();
        },
        moveTo( next ) {
            pos = next;
            moved = true;
            session = undefined;
            layout();
            persist();
        },
        resizeTo( next ) {
            size = { ...size, ...next };
            resized = true;
            layout();
            persist();
        }
    };

    if ( resizable ) {
        const handleEl = div( 'kp-resize' );
        el.append( handleEl );
        attachResize( handleEl, el, {
            minSize: def.minSize,
            onStart: rect => {
                // Anchored at the left edge, so that the panel grows to the right and down.
                pos = { left: rect.left, top: rect.top };
                moved = true;
                session = undefined;
                placePanel( el, pos );
            },
            onResize: next => {
                size = next;
                resized = true;
                applySize();
            },
            onEnd: persist
        } );
    }

    rebuildHeader();

    return {
        handle,
        restore() {
            const saved = env.persistence?.load( id );
            if ( !saved ) {
                return;
            }
            collapsed = saved.collapsed && collapsible;
            dockSide = dockable ? saved.dock : null;
            if ( saved.pos ) {
                pos = saved.pos;
                moved = true;
            }
            if ( saved.size && resizable ) {
                size = { ...size, ...saved.size };
                resized = true;
            }
            if ( env.restoreState && saved.state === 'open' ) {
                handle.open();
            } else if ( env.restoreState && saved.state === 'minimized' ) {
                ensureMounted();
                setState( 'minimized' );
            }
            changed();
        },
        relayout: layout,
        needsRefresh: () => state === 'open' || previewing || ( state === 'minimized' && !!hooks.isActive?.() ),
        refresh: () => guard( id, 'refresh', () => hooks.refresh?.() ),
        inTray: def.tray !== false,
        trayItem: () => ( { id, title, icon: def.icon, badge, state, hotkey: def.hotkey && keyLabel( def.hotkey ), active: !!hooks.isActive?.() } ),
        dispose() {
            if ( disposed ) {
                return;
            }
            disposed = true;
            // Closed panels were torn down already; this reaches panels that are still open or minimized.
            guard( id, 'dispose', () => hooks.dispose?.() );
            env.stack.remove( el );
            el.remove();
        }
    };
}
