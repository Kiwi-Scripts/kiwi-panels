import { isEditing } from '../dom/utils';
import type { Modifier } from './modifier';

export type ListenerTuple = readonly [target: EventTarget, type: string, fn: ( ev: any ) => void, capture: boolean];

export interface HotkeyBinding {
    /**
     * A `KeyboardEvent.code`, optionally with extra modifiers: `'KeyF'`, `'Shift+KeyR'`, `'Ctrl+Alt+Digit1'`.
     * Extra modifiers must match exactly; the overlay's own modifier key is handled separately, see `modifier`.
     */
    combo: string;
    /**
     * Whether the overlay's modifier key has to be held (or latched). Default: true if the overlay has a modifier key.
     * Bindings without it do not fire while typing in a text field unless `allowWhileEditing` is set.
     */
    modifier?: boolean;
    allowWhileEditing?: boolean;
    /** Return `false` to pass the key on (to later bindings and the page); anything else consumes it. */
    handler( ev: KeyboardEvent ): void | boolean;
}

export interface Hotkeys {
    bind( binding: HotkeyBinding ): () => void;
    /** The listeners that make it work; the overlay attaches them (outside of a host framework's change detection). */
    readonly listeners: readonly ListenerTuple[];
}

export interface HotkeysOptions {
    modifier?: Modifier;
    /** With a modifier: pressed with it, this key latches the modifier. Pressed alone while latched, it releases it again. */
    latchKey?: string;
}

interface Parsed {
    code: string;
    shift: boolean;
    ctrl: boolean;
    alt: boolean;
    meta: boolean;
}

const FLAG_OF_KEY = { Alt: 'alt', Control: 'ctrl', Shift: 'shift', Meta: 'meta' } as const;
const EVENT_FLAG = { shift: 'shiftKey', ctrl: 'ctrlKey', alt: 'altKey', meta: 'metaKey' } as const;

export function parseCombo( combo: string ): Parsed {
    const parts = combo.split( '+' ).map( part => part.trim() );
    const parsed: Parsed = { code: parts.pop() ?? '', shift: false, ctrl: false, alt: false, meta: false };
    for ( const part of parts ) {
        switch ( part.toLowerCase() ) {
            case 'shift': parsed.shift = true; break;
            case 'ctrl': case 'control': parsed.ctrl = true; break;
            case 'alt': parsed.alt = true; break;
            case 'meta': case 'cmd': parsed.meta = true; break;
            default: throw new Error( `Unknown modifier "${part}" in hotkey "${combo}"` );
        }
    }
    return parsed;
}

export function createHotkeys( options: HotkeysOptions = {} ): Hotkeys {
    const { modifier, latchKey } = options;
    const bindings: { binding: HotkeyBinding; parsed: Parsed }[] = [];
    const modifierFlag = modifier && FLAG_OF_KEY[modifier.key];
    // A lone tap of the modifier key releases the latch; any other key in between cancels the tap.
    let tap = false;

    const matches = ( { binding, parsed }: ( typeof bindings )[number], ev: KeyboardEvent, editing: boolean ): boolean => {
        if ( ev.code !== parsed.code ) {
            return false;
        }
        const wantsModifier = !!modifier && binding.modifier !== false;
        if ( wantsModifier && !modifier.isHeld( ev ) ) {
            return false;
        }
        if ( !wantsModifier && editing && !binding.allowWhileEditing ) {
            return false;
        }
        return ( ['shift', 'ctrl', 'alt', 'meta'] as const ).every( name =>
            ( wantsModifier && name === modifierFlag ) || ev[EVENT_FLAG[name]] === parsed[name] );
    };

    const onKeyDown = ( ev: KeyboardEvent ): void => {
        modifier?.sync( ev );
        const editing = isEditing( ev );
        if ( modifier ) {
            tap = ev.key === modifier.key && !ev.repeat;
            if ( latchKey && ev.code === latchKey && ( modifier.isPressed( ev ) || ( modifier.isLatched() && !editing ) ) ) {
                modifier.toggleLatched();
                ev.preventDefault();
                ev.stopPropagation();
                return;
            }
        }
        if ( ev.repeat ) {
            return;
        }
        for ( const entry of bindings ) {
            if ( matches( entry, ev, editing ) && entry.binding.handler( ev ) !== false ) {
                ev.preventDefault();
                ev.stopPropagation();
                return;
            }
        }
    };

    const onKeyUp = ( ev: KeyboardEvent ): void => {
        modifier?.sync( ev );
        if ( modifier && tap && ev.key === modifier.key && modifier.isLatched() ) {
            modifier.toggleLatched();
        }
        tap = false;
    };

    return {
        bind( binding ) {
            const entry = { binding, parsed: parseCombo( binding.combo ) };
            bindings.push( entry );
            return () => {
                const index = bindings.indexOf( entry );
                if ( index >= 0 ) {
                    bindings.splice( index, 1 );
                }
            };
        },
        listeners: [
            [document, 'keydown', onKeyDown, true],
            [document, 'keyup', onKeyUp, true],
            [window, 'blur', () => modifier?.reset(), false]
        ]
    };
}
