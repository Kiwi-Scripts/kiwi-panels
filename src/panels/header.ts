import { button, div } from '../dom/h';

/** A default header button, given as its title and action; the icon and the position are fixed by the header. */
export interface HeaderAction {
    title: string;
    onClick(): void;
}

export interface HeaderCollapse extends HeaderAction {
    /** Shows the icon for expanding instead of the one for collapsing; the panel itself has to follow the state. */
    collapsed?: boolean;
}

export interface HeaderFullscreen extends HeaderAction {
    /** Shows the icon for going back to a window; the panel itself has to follow the state. */
    active?: boolean;
}

export interface HeaderSpec {
    /** Custom items after the collapse button. */
    left?: Node[];
    /** Custom items before the minimize, fullscreen and close buttons. */
    right?: Node[];
    /** Leftmost: folds the panel up to its header. */
    collapse?: HTMLElement | HeaderCollapse;
    /** Right, before fullscreen: hides the panel, which stays active in the tray. */
    minimize?: HTMLElement | HeaderAction;
    /** Right, before close: lets the panel cover the page, or brings it back to a window. */
    fullscreen?: HTMLElement | HeaderFullscreen;
    /** Rightmost. */
    close?: HTMLElement | HeaderAction;
    onPointerDown?: ( ev: PointerEvent ) => void;
}

const actionButton = ( icon: string, action: HTMLElement | HeaderAction ): HTMLElement =>
    action instanceof HTMLElement ? action : button( icon, action.title, action.onClick );

/** The top row of a panel: collapse, `left` items, a spacer, `right` items, then minimize, fullscreen and close. */
export function renderHeader( spec: HeaderSpec ): HTMLElement {
    const row = div( 'kp-row kp-header' );
    row.onpointerdown = spec.onPointerDown ?? null;
    const { collapse, fullscreen, minimize, close } = spec;
    row.append(
        ...( collapse ? [actionButton( 'collapsed' in collapse && collapse.collapsed ? '▸' : '▾', collapse )] : [] ),
        ...( spec.left ?? [] ),
        div( 'kp-spacer' ),
        ...( spec.right ?? [] ),
        ...( minimize ? [actionButton( '–', minimize )] : [] ),
        ...( fullscreen ? [actionButton( 'active' in fullscreen && fullscreen.active ? '❐' : '⛶', fullscreen )] : [] ),
        ...( close ? [actionButton( '✕', close )] : [] ) );
    return row;
}
