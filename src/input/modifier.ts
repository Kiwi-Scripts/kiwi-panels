import { HELD_FLAGS } from '../constants';
import { isEditing } from '../dom/utils';
import type { ModifierKey } from '../types';

/**
 * A modifier key that has to be held for the hotkeys, and that can be latched so that it counts as held without touching it.
 * The latch does not apply to keys typed in text fields, nor to mouse events inside the overlay, which need the key itself.
 */
export interface Modifier {
    readonly key: ModifierKey;
    /** Whether the key is held during the event, or latched. */
    isHeld( ev: KeyboardEvent | MouseEvent ): boolean;
    /** Whether the key itself is pressed during the event, regardless of the latch. */
    isPressed( ev: KeyboardEvent | MouseEvent ): boolean;
    isLatched(): boolean;
    /** Holds the key until toggled again; returns the new state. */
    toggleLatched(): boolean;
    /** Whether the key is currently down, as tracked from the key events passed to `sync`. */
    isDown(): boolean;
    sync( ev: KeyboardEvent ): void;
    /** Forgets that the key is down (e.g. when the window lost focus). */
    reset(): void;
    onChange( listener: () => void ): () => void;
}

export function createModifier( key: ModifierKey, inOverlay: ( target: EventTarget | null ) => boolean ): Modifier {
    const flag = HELD_FLAGS[key.toLowerCase() as Lowercase<ModifierKey>];
    const listeners = new Set<() => void>();
    let latched = false;
    let down = false;
    const changed = (): void => listeners.forEach( fn => fn() );

    return {
        key,
        isHeld: ev => ev[flag] || ( latched && !( ev instanceof KeyboardEvent && isEditing( ev ) ) && !( ev instanceof MouseEvent && inOverlay( ev.target ) ) ),
        isPressed: ev => ev[flag],
        isLatched: () => latched,
        toggleLatched() {
            latched = !latched;
            changed();
            return latched;
        },
        isDown: () => down,
        sync( ev ) {
            if ( ev[flag] !== down ) {
                down = ev[flag];
                changed();
            }
        },
        reset() {
            if ( down ) {
                down = false;
                changed();
            }
        },
        onChange( listener ) {
            listeners.add( listener );
            return () => listeners.delete( listener ) && undefined;
        }
    };
}
