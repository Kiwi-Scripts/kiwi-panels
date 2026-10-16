/** Marks everything the overlay renders, so that it can be told apart from the page. */
export const OVERLAY_ATTR = 'data-kp-overlay';

/** Tag name of the element that hosts the shadow root. */
export const HOST_TAG = 'kiwi-panels';

/** The highest z-index there is. */
export const Z_MAX = 2147483647;
/** The room at the very top for elements that are always above the panels (tray, hints). */
export const Z_FIXED_ZONE = 100;
/** The room for the panels; one z-index each, ordered by the panel stack. */
export const Z_PANEL_ZONE = 100;
/** The z-index of the lowest panel. Highlights and outlines of page elements lie below it. */
export const Z_PANEL_BASE = Z_MAX - Z_FIXED_ZONE - Z_PANEL_ZONE;

export const HELD_FLAGS = { alt: 'altKey', control: 'ctrlKey', shift: 'shiftKey', meta: 'metaKey' } as const;

/** Default prefix of the keys the persistence layer writes. */
export const DEFAULT_STORAGE_PREFIX = 'kiwi-panels';

/** `KeyF` -> `F`, `Digit1` -> `1`. */
export const hotkeyLabel = ( code: string ): string => code.replace( /^(Key|Digit)/, '' );
