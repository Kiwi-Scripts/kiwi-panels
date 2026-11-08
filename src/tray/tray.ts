import type { PanelIcon, PanelState } from '../types';

/** What a tray shows for one registered panel. The overlay derives it from the panel's state. */
export interface TrayItem {
    id: string;
    title: string;
    icon?: PanelIcon;
    /** A count shown on the button; hidden for `null`, `''` and `0`. */
    badge: string | number | null;
    state: PanelState;
    /** The panel's hotkey as it is shown on the button (e.g. 'I'); the tray may leave it out. */
    hotkey?: string;
    /** Whether the panel holds something that is running (e.g. a recording), which a minimized panel shows as an outline. */
    active: boolean;
}

/** An extra button of the tray that is not tied to a panel, e.g. a power button. Supplied through `OverlayOptions.trayCommands`. */
export interface TrayCommand {
    id: string;
    title: string;
    icon: PanelIcon;
    /** A short text in the corner of the button, e.g. its hotkey. */
    label?: string;
    onClick(): void;
}

export interface TrayActions {
    /** Extra buttons the tray shows after the panel buttons. Trays that have no room for them may ignore them. */
    commands?: readonly TrayCommand[];
    /** Opens the panel, or closes/minimizes it if it is open. */
    toggle( id: string ): void;
    /** The overlay's modifier key as it is shown on the launcher (e.g. 'Alt'); not there without one. */
    modifier?: string;
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
