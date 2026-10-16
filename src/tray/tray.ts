import type { PanelIcon, PanelState } from '../types';

/** What a tray shows for one registered panel. The overlay derives it from the panel's state. */
export interface TrayItem {
    id: string;
    title: string;
    icon?: PanelIcon;
    /** A count shown on the button; hidden for `null`, `''` and `0`. */
    badge: string | number | null;
    state: PanelState;
    /** Whether the panel holds something that is running (e.g. a recording), which a minimized panel shows as an outline. */
    active: boolean;
}

export interface TrayActions {
    /** Opens the panel, or closes/minimizes it if it is open. */
    toggle( id: string ): void;
    /** The launcher was clicked. Only provided when the overlay has something to do with it (toggling the modifier latch). */
    launcher?(): void;
}

/**
 * The taskbar of the overlay. The overlay owns the panels; a tray only draws one button per panel and reports clicks.
 * Implement it to build a different tray, or use {@link cornerDock} and {@link edgeBar}.
 */
export interface Tray {
    /** Override the hotkey for opening (and pinning) the tray. Uses `KeyT` by default, set to `null` to disable. */
    trayHotkey?: string | null;
    /** Toggles the open/closed state of the tray. (pins open) */
    toggle?: ( state?: boolean ) => void;
    /** Called once; `container` lies inside the overlay's shadow root, so the overlay styles apply. */
    mount( container: HTMLElement, actions: TrayActions ): void;
    /** Called whenever anything about the panels changed. Items are in registration order. */
    update( items: readonly TrayItem[] ): void;
    /** Called when the modifier key is pressed or latched (only if the overlay has a modifier key). */
    setModifierState?( state: { held: boolean; latched: boolean } ): void;
    dispose(): void;
}
