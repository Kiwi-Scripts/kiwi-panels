export interface Scheduler {
    /** Runs the callback once after the interval; further requests while one is pending are absorbed. */
    request(): void;
    cancel(): void;
}

/**
 * Throttles refreshes: change notifications can come very often, the refresh of the panels only needs to run a few times a second.
 * @param runOutside timers must not trigger change detection of a host framework.
 */
export function createScheduler( run: () => void, interval: number, runOutside: <T>( fn: () => T ) => T ): Scheduler {
    let timer: ReturnType<typeof setTimeout> | undefined;
    return {
        request() {
            if ( timer === undefined ) {
                timer = runOutside( () => setTimeout( () => {
                    timer = undefined;
                    run();
                }, interval ) );
            }
        },
        cancel() {
            clearTimeout( timer );
            timer = undefined;
        }
    };
}
