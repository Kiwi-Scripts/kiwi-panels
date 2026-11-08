export { createOverlay } from './overlay';
export type { Overlay, OverlayEvents, OverlayOptions, PanelsApi } from './overlay';

export type {
    PanelContext, PanelDefinition, PanelHandle, PanelHooks, PanelMountResult
} from './panels/panel-definition';
export type {
    AnchoredPlacement, AnchorSpec, Direction, NamedPosition, PlacementEnv, PlacementStep, PositionSpec, StackedPlacement, StepSpec
} from './panels/placement';
export { placeAround, placeStacked } from './panels/placement';
export type { HeaderAction, HeaderCollapse, HeaderFullscreen, HeaderSpec } from './panels/header';
export { renderHeader } from './panels/header';

export type { Tray, TrayActions, TrayCommand, TrayItem } from './tray/tray';
export { cornerDock } from './tray/corner-dock';
export type { Corner, CornerDockOptions } from './tray/corner-dock';
export { edgeBar } from './tray/edge-bar';
export type { Edge, EdgeBarOptions } from './tray/edge-bar';

export { createDormantLauncher } from './dormant';
export type { DormantLauncher, DormantOptions } from './dormant';

export { createHotkeys, parseCombo } from './input/hotkeys';
export type { HotkeyBinding, Hotkeys, HotkeysOptions } from './input/hotkeys';
export type { Modifier } from './input/modifier';

export { localStorageAdapter, memoryStorage, sessionStorageAdapter, webStorage } from './persistence/storage';
export type { StorageAdapter } from './persistence/storage';

export type { Theme } from './styles';
export type {
    AnyPos, DockSide, ModifierKey, PanelChange, PanelIcon, PanelPos, PanelPosRight, PanelSize, PanelSnapshot, PanelState
} from './types';

// DOM helpers for building panel content.
export { badge, button, div, link, renderIcon, span, svgEl, svgIcon } from './dom/h';
export type { ButtonOptions } from './dom/h';
export { keepState, openKeys, renderDetails, renderSection } from './dom/details';
export type { DetailsSpec } from './dom/details';
export { isEditing, placeBox } from './dom/utils';
