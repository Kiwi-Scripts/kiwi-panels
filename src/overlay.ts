import { createEmitter } from './core/events';
import { createScheduler } from './core/scheduler';
import { div } from './dom/h';
import { createOverlayHost } from './host';
import { createHotkeys, type HotkeyBinding, type Hotkeys } from './input/hotkeys';
import { createModifier, type Modifier } from './input/modifier';
import { createPanelController, type PanelController } from './panels/panel-controller';
import type { PanelDefinition, PanelHandle } from './panels/panel-definition';
import { createPanelStack } from './panels/panel-stack';
import { createPanelPersistence } from './persistence/panel-persistence';
import { sessionStorageAdapter, type StorageAdapter } from './persistence/storage';
import type { Theme } from './styles';
import { cornerDock } from './tray/corner-dock';
import type { Tray, TrayCommand } from './tray/tray';
import type { DockSide, ModifierKey, PanelChange } from './types';

export interface OverlayOptions {
    /** The taskbar. Default: a {@link cornerDock}. `false` for none, e.g. when the application opens panels itself. */
    tray?: Tray | false;
    /** Extra buttons for the tray that are not tied to a panel (e.g. a power button), shown after the panel buttons. */
    trayCommands?: readonly TrayCommand[];
    /** Overrides of the design tokens. */
    theme?: Theme;
    /** Where panel positions, sizes and states are kept. Default: session storage. `false` turns persistence off. */
    storage?: StorageAdapter | false;
    /** Reopen the panels that were open when the page was left. Default: true. Positions and sizes are always restored. */
    restoreState?: boolean;
    hotkeys?: {
        /** A key that has to be held for the hotkeys of the panels; without one they fire as plain keys (except while typing in a text field). */
        modifier?: ModifierKey;
        /** `KeyboardEvent.code` that latches the modifier together with it (e.g. 'KeyL'): hotkeys then work without holding it. */
        latchKey?: string;
        /** Whether clicking the tray button latches the modifier. */
        trayLatch?: boolean;
        /** Escape leaves fullscreen and, if this is set, then closes the panel on top. Default: false. */
        escapeToClose?: boolean;
    } | false;
    /**
     * Runs setup code that registers listeners and timers. Pass a function that leaves the zone of a framework with change detection
     * (e.g. `NgZone.runOutsideAngular`), so that hovering and dragging do not trigger it. Default: runs it directly.
     */
    runOutside?: <T>( fn: () => T ) => T;
    /** Minimum time between throttled refreshes in ms. Default: 250. */
    refreshInterval?: number;
    /** Reuse the existing overlay if one created with this option is active, instead of making a second. Default: false. */
    singleton?: boolean;
    /** Where the host element is added. Default: `document.body`. */
    container?: HTMLElement;
}

export interface OverlayEvents extends Record<string, unknown> {
    /** A panel was opened, closed or minimized. */
    panelchange: PanelChange;
    register: { id: string };
    unregister: { id: string };
    dispose: undefined;
}

export interface PanelsApi {
    get( id: string ): PanelHandle | undefined;
    /** All panels in registration order. */
    list(): PanelHandle[];
    /** These throw for an unknown id. */
    open( id: string, args?: unknown ): void;
    close( id: string ): void;
    toggle( id: string ): void;
    minimize( id: string ): void;
    raise( id: string ): void;
    dock( id: string, side: DockSide | null ): void;
}

export interface Overlay {
    /** The element in the page that hosts the shadow root. */
    readonly host: HTMLElement;
    /** The shadow root everything is rendered into. */
    readonly root: ShadowRoot;
    readonly panels: PanelsApi;
    /** The modifier key, if the overlay was created with one. */
    readonly modifier: Modifier | undefined;
    readonly hotkeys: Hotkeys;
    /** Adds a panel. It stays closed (unless persisted as open) until opened. */
    register( definition: PanelDefinition ): PanelHandle;
    /** Closes a panel and removes it, with its tray button. */
    unregister( id: string ): void;
    /** Refreshes all open panels right away. */
    refresh(): void;
    /** Refreshes all open panels soon, at most once per refresh interval. */
    requestRefresh(): void;
    /** Whether the element belongs to the overlay (so that page-level handlers can ignore it). */
    inOverlay( target: EventTarget | null ): boolean;
    on<K extends keyof OverlayEvents>( type: K, listener: ( payload: OverlayEvents[K] ) => void ): () => void;
    /** Removes everything the overlay added to the page. */
    dispose(): void;
}

let singleton: Overlay | undefined;

/** Creates the overlay: a shadow root with the panels, the tray, and the hotkeys. See {@link OverlayOptions}. */
export function createOverlay( options: OverlayOptions = {} ): Overlay {
    if ( typeof document === 'undefined' ) {
        throw new Error( 'createOverlay() needs a DOM; call it in the browser.' );
    }
    if ( options.singleton && singleton ) {
        return singleton;
    }
    const runOutside = options.runOutside ?? ( <T>( fn: () => T ): T => fn() );

    const { host, root } = createOverlayHost( options.container, options.theme );
    const layer = div( 'kp-layer' );
    const trayRoot = div( 'kp-tray-root' );
    root.append( layer, trayRoot );

    const events = createEmitter<OverlayEvents>();
    const controllers = new Map<string, PanelController>();
    const unbinders = new Map<string, () => void>();
    const stack = createPanelStack( runOutside );
    const storage = options.storage === false ? undefined : options.storage ?? sessionStorageAdapter();
    const persistence = storage && createPanelPersistence( storage );
    const tray = options.tray === false ? undefined : options.tray ?? cornerDock();

    const inOverlay = ( target: EventTarget | null ): boolean =>
        target instanceof Node && ( target === host || host.contains( target ) || root.contains( target ) );

    const hotkeyOptions = options.hotkeys === false ? undefined : options.hotkeys;
    const modifier = hotkeyOptions?.modifier && createModifier( hotkeyOptions.modifier, inOverlay );
    const hotkeys = createHotkeys( { modifier, latchKey: hotkeyOptions?.latchKey } );
    const trayLatch = hotkeyOptions?.trayLatch ?? false;

    const updateTray = (): void => tray?.update( Array.from( controllers.values() ).filter( c => c.inTray ).map( c => c.trayItem() ) );

    const refresh = (): void => {
        controllers.forEach( c => c.needsRefresh() && c.refresh() );
        updateTray();
    };
    const scheduler = createScheduler( refresh, options.refreshInterval ?? 250, runOutside );

    const must = ( id: string ): PanelHandle => {
        const handle = controllers.get( id )?.handle;
        if ( !handle ) {
            throw new Error( `Unknown panel "${id}"` );
        }
        return handle;
    };

    const panels: PanelsApi = {
        get: id => controllers.get( id )?.handle,
        list: () => Array.from( controllers.values(), c => c.handle ),
        open: ( id, args ) => must( id ).open( args ),
        close: id => must( id ).close(),
        toggle: id => must( id ).toggle(),
        minimize: id => must( id ).minimize(),
        raise: id => must( id ).raise(),
        dock: ( id, side ) => must( id ).dock( side )
    };

    tray?.mount( trayRoot, {
        toggle: id => controllers.get( id )?.handle.toggle(),
        commands: options.trayCommands,
        launcher: modifier && trayLatch ? () => void modifier.toggleLatched() : undefined
    } );
    if ( modifier ) {
        const syncModifier = (): void => tray?.setModifierState?.( { held: modifier.isDown(), latched: modifier.isLatched() } );
        modifier.onChange( syncModifier );
    }
    if ( tray?.trayHotkey !== null ) {
        const trayHotkey = tray?.trayHotkey || 'KeyT';
        const binding: HotkeyBinding = {
            combo: trayHotkey,
            modifier: !!modifier,
            handler: () => modifier && !trayLatch && tray?.toggle?.()
        };
        hotkeys.bind( binding );
    }

    const register = ( definition: PanelDefinition ): PanelHandle => {
        if ( controllers.has( definition.id ) ) {
            throw new Error( `A panel with the id "${definition.id}" is already registered` );
        }
        const controller = createPanelController( definition, {
            overlay,
            layer,
            stack,
            persistence,
            restoreState: options.restoreState ?? true,
            onStateChange: change => events.emit( 'panelchange', change ),
            onTrayChange: updateTray,
            requestRefresh: scheduler.request
        } );
        controllers.set( definition.id, controller );
        if ( definition.hotkey ) {
            const binding: HotkeyBinding = { combo: definition.hotkey, handler: () => controller.handle.toggle() };
            unbinders.set( definition.id, hotkeys.bind( binding ) );
        }
        controller.restore();
        updateTray();
        events.emit( 'register', { id: definition.id } );
        return controller.handle;
    };

    /** @param closing whether the panel is closed first (an explicit unregister); disposing the overlay keeps the persisted state. */
    const remove = ( id: string, closing: boolean ): void => {
        const controller = controllers.get( id );
        if ( !controller ) {
            return;
        }
        if ( closing ) {
            controller.handle.close();
        }
        unbinders.get( id )?.();
        unbinders.delete( id );
        controller.dispose();
        controllers.delete( id );
        updateTray();
        events.emit( 'unregister', { id } );
    };
    const unregister = ( id: string ): void => remove( id, true );

    // Escape: leaves fullscreen first; then, if asked for, closes the panel on top.
    if ( hotkeyOptions ) {
        hotkeys.bind( {
            combo: 'Escape', modifier: false, allowWhileEditing: true,
            handler: () => {
                const open = stack.order().map( el => controllers.get( el.dataset.panel ?? '' )?.handle ).filter( h => h?.state === 'open' );
                const fullscreen = open.find( h => h?.fullscreen );
                if ( fullscreen ) {
                    fullscreen.setFullscreen( false );
                    return true;
                }
                const top = open.at( -1 );
                if ( hotkeyOptions.escapeToClose && top ) {
                    top.close();
                    return true;
                }
                return false;
            }
        } );
    }

    const onResize = (): void => controllers.forEach( c => c.relayout() );
    const listeners = [...( hotkeyOptions ? hotkeys.listeners : [] ), [window, 'resize', onResize, false] as const];
    runOutside( () => listeners.forEach( ( [target, type, fn, capture] ) => target.addEventListener( type, fn, capture ) ) );

    const overlay: Overlay = {
        host,
        root,
        panels,
        modifier,
        hotkeys,
        register,
        unregister,
        refresh,
        requestRefresh: scheduler.request,
        inOverlay,
        on: ( type, listener ) => events.on( type, listener ),
        dispose() {
            scheduler.cancel();
            listeners.forEach( ( [target, type, fn, capture] ) => target.removeEventListener( type, fn, capture ) );
            Array.from( controllers.keys() ).forEach( id => remove( id, false ) );
            stack.dispose();
            tray?.dispose();
            host.remove();
            events.emit( 'dispose', undefined );
            events.clear();
            if ( singleton === overlay ) {
                singleton = undefined;
            }
        }
    };
    if ( options.singleton ) {
        singleton = overlay;
    }
    return overlay;
}
