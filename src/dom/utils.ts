/** Whether the event comes from a text field, where plain keys must reach the page. */
export function isEditing( ev: Event ): boolean {
    const target = ev.composedPath()[0];
    return target instanceof HTMLElement && ( target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes( target.tagName ) );
}

/** Shows `box` (a `.kp-highlight` element) as an outline around `el`, or hides it if the element is gone. */
export function placeBox( box: HTMLElement, el: Element | null | undefined ): void {
    if ( !el?.isConnected ) {
        box.style.display = 'none';
        return;
    }
    const r = el.getBoundingClientRect();
    Object.assign( box.style, {
        display: 'block', left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`
    } );
}
