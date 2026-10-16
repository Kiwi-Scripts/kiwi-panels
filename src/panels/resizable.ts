import type { PanelSize } from '../types';

export interface ResizeOptions {
    minSize?: Partial<PanelSize>;
    /** Called when a resize starts, e.g. to anchor the panel at its left edge so it can grow to the right. */
    onStart?( rect: DOMRect ): void;
    onResize( size: PanelSize ): void;
    onEnd?(): void;
}

const MIN_WIDTH = 120;
const MIN_HEIGHT = 60;

/** Makes `handle` resize `panel` from its bottom right corner; the size is limited to the viewport. */
export function attachResize( handle: HTMLElement, panel: HTMLElement, options: ResizeOptions ): () => void {
    const onDown = ( ev: PointerEvent ): void => {
        if ( ev.button !== 0 ) {
            return;
        }
        ev.preventDefault();
        ev.stopPropagation();
        const rect = panel.getBoundingClientRect();
        options.onStart?.( rect );
        const startX = ev.clientX;
        const startY = ev.clientY;
        const minW = options.minSize?.width ?? MIN_WIDTH;
        const minH = options.minSize?.height ?? MIN_HEIGHT;
        const onMove = ( e: PointerEvent ): void => options.onResize( {
            width: Math.max( minW, Math.min( rect.width + e.clientX - startX, window.innerWidth - rect.left ) ),
            height: Math.max( minH, Math.min( rect.height + e.clientY - startY, window.innerHeight - rect.top ) )
        } );
        const onUp = (): void => {
            document.removeEventListener( 'pointermove', onMove, true );
            document.removeEventListener( 'pointerup', onUp, true );
            document.removeEventListener( 'pointercancel', onUp, true );
            options.onEnd?.();
        };
        document.addEventListener( 'pointermove', onMove, true );
        document.addEventListener( 'pointerup', onUp, true );
        document.addEventListener( 'pointercancel', onUp, true );
    };
    handle.addEventListener( 'pointerdown', onDown );
    return () => handle.removeEventListener( 'pointerdown', onDown );
}
