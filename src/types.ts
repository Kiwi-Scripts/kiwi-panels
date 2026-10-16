/** Position from the top left corner of the viewport, in px. */
export interface PanelPos {
    left: number;
    top: number;
}

/** Position from the top right corner of the viewport, in px. */
export interface PanelPosRight {
    right: number;
    top: number;
}

export type AnyPos = PanelPos | PanelPosRight;

export interface PanelSize {
    width: number;
    height: number;
}

export type DockSide = 'left' | 'right';

/** `closed` panels are not shown, `minimized` ones are hidden but stay alive and keep their tray button lit. */
export type PanelState = 'closed' | 'open' | 'minimized';

export type ModifierKey = 'Alt' | 'Control' | 'Shift' | 'Meta';

/** An SVG path (24x24 viewBox) or a node, which is cloned wherever the icon is shown. */
export type PanelIcon = string | Node;

/** What gets persisted for a panel. */
export interface PanelSnapshot {
    state: PanelState;
    collapsed: boolean;
    dock: DockSide | null;
    /** Only present once the user moved the panel. */
    pos?: AnyPos;
    /** Only present once the user resized the panel. */
    size?: Partial<PanelSize>;
}

export interface PanelChange {
    id: string;
    state: PanelState;
    previous: PanelState;
}
