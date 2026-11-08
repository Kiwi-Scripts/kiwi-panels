import type { Overlay } from '../overlay';
import type { AnyPos, DockSide, PanelIcon, PanelSize, PanelState } from '../types';
import type { PositionSpec } from './placement';

/** Everything an application can do with a registered panel. */
export interface PanelHandle {
    readonly id: string;
    /** The panel's root element, inside the overlay's shadow root. */
    readonly element: HTMLElement;
    /** The scrolling content area below the header. */
    readonly body: HTMLElement;
    readonly state: PanelState;
    readonly collapsed: boolean;
    readonly fullscreen: boolean;
    readonly dockSide: DockSide | null;
    /** Whether the panel is shown transiently by `preview()`. A previewing panel is still `closed` or `minimized` as far as its `state` goes. */
    readonly previewing: boolean;
    /**
     * Shows the panel on top of the others and calls `onShow( args )`. On a panel that is already open it only raises it and
     * calls `onShow` again, so `args` can retarget it.
     */
    open( args?: unknown ): void;
    /**
     * Ends the panel's content: `onHide` and `dispose` are called and the body is emptied, so the next `open()` runs `mount()` again
     * from scratch. Only the window (position, size, collapsed, dock) is remembered. Use `minimize()` to keep the content.
     */
    close( options?: { force?: boolean } ): void;
    /**
     * Shows a closed or minimized panel transiently, next to the viewport point `at` (default: where the panel would open). It leaves
     * the tray, the persisted state and the focus alone, and calls `onShow( args )`; calling it again retargets the panel. Nothing
     * happens to an open panel. `open()` (or `toggle()`) promotes the preview in place: same mounted content, and the same position unless the user has
     * placed the panel before, in which case it goes there.
     * What starts and ends a preview (a held key, hovering, ...) is up to the caller.
     */
    preview( args?: unknown, at?: { x: number; y: number } ): void;
    /**
     * Hides a preview. A closed panel ends like after `close()` (`onHide`, `dispose`, the body is emptied); a minimized one goes back
     * to being minimized, content included (`onMinimize`). Does nothing if the panel is not previewing.
     */
    endPreview(): void;
    /** Opens a closed or minimized panel, minimize an open one (or closes it, see `PanelDefinition.trayToggle`). */
    toggle(): void;
    /** Hides an open panel but keeps it alive, content and state included; its tray button stays. */
    minimize(): void;
    raise(): void;
    setCollapsed( on: boolean ): void;
    setFullscreen( on: boolean ): void;
    /** Snaps the panel to the full height of the left or right edge, or back to a window with `null`. */
    dock( side: DockSide | null ): void;
    moveTo( pos: AnyPos ): void;
    resizeTo( size: Partial<PanelSize> ): void;
}

/** What a panel can hand back from `mount()` to react to the overlay. Everything is optional. */
export interface PanelHooks {
    /** The panel was opened, or opened again with other `args`. */
    onShow?( args?: unknown ): void;
    /**
     * The panel is about to be closed, by its close button, `close()`, Escape or the tray. Return `false` to keep it open: to end
     * something that is running first, say, so that the first close only stops it. `close( { force: true } )` does not ask.
     */
    beforeClose?(): boolean | void;
    /** The panel was closed. */
    onHide?(): void;
    /** The panel was minimized: it is hidden but not closed. */
    onMinimize?(): void;
    /** Redraw. Called throttled while the panel is open, previewing, or minimized and active, and by `overlay.refresh()`. */
    refresh?(): void;
    /** Whether the panel holds something that is running. A minimized panel for which this is true keeps refreshing and is outlined in the tray. */
    isActive?(): boolean;
    /** The content ends: the panel was closed (it mounts again when reopened), or it is removed together with the overlay. */
    dispose?(): void;
}

/** What `mount()` may return: nodes to put into the body, hooks, or both (`content` plus hooks). */
export type PanelMountResult = Node | ( PanelHooks & { content?: Node } ) | void;

export interface PanelContext {
    readonly id: string;
    readonly overlay: Overlay;
    readonly panel: PanelHandle;
    /** The content area. Append to it directly, or return a node from `mount()`. */
    readonly body: HTMLElement;
    setTitle( title: string ): void;
    /** A count on the panel's tray button; `null` removes it. */
    setBadge( badge: string | number | null ): void;
    /** Nodes in the header between the collapse button and the spacer (after the title). */
    setHeaderLeft( nodes: Node[] ): void;
    /** Nodes in the header before the default buttons. */
    setHeaderRight( nodes: Node[] ): void;
    /** Asks for a throttled refresh of all panels. */
    requestRefresh(): void;
    /** Tells the tray that something about the panel changed that it shows (e.g. what `isActive()` returns). */
    updateTray(): void;
}

export interface PanelDefinition {
    /** Unique among the panels of an overlay. */
    id: string;
    title: string;
    /** Shown on the tray button. An SVG path (24x24) or a node; default is the first letter of the title. */
    icon?: PanelIcon;
    className?: string;

    /** Initial size in px; what is missing is determined by the content (height) or the theme (width). */
    size?: Partial<PanelSize>;
    minSize?: Partial<PanelSize>;
    /**
     * Where the panel appears: a fixed place, one that makes room for the panels already there, or one next to the pointer or an
     * element (see {@link PositionSpec}). Default: 'center'. After the user moved the panel, it keeps that position.
     */
    defaultPosition?: PositionSpec;
    /** A key (see {@link HotkeyBinding.combo}) that toggles the panel; needs the overlay's modifier key if it has one. */
    hotkey?: string;

    /** Header buttons and behaviors; all default to true, except dockable. */
    collapsible?: boolean;
    minimizable?: boolean;
    closable?: boolean;
    fullscreenable?: boolean;
    resizable?: boolean;
    dockable?: boolean;
    /**
     * Whether the panel has a button in the tray. Without one it is only opened by code (or its hotkey), e.g. a small transient
     * panel that belongs to another. Default: true.
     */
    tray?: boolean;
    /** What the tray button does to an open panel. Default: 'minimize'. */
    trayToggle?: 'close' | 'minimize';

    /**
     * Builds the content when the panel is opened (or restored), and again whenever it is opened after having been closed;
     * minimizing keeps it.
     * Level 1 — plain DOM: return a node, or append to `ctx.body` yourself.
     * Level 2 — lifecycle: return hooks (optionally with `content`).
     * A declarative layer (a `view` description rendered for you) is planned and will be added here without breaking either.
     */
    mount( ctx: PanelContext ): PanelMountResult;
}
