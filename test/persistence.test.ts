import { describe, expect, it } from 'vitest';

import { createPanelPersistence } from '../src/persistence/panel-persistence';
import { memoryStorage, webStorage } from '../src';

describe( 'panel persistence', () => {
    it( 'round-trips a snapshot', () => {
        const persistence = createPanelPersistence( memoryStorage() );
        const snapshot = { state: 'minimized' as const, collapsed: true, dock: 'right' as const, pos: { right: 5, top: 6 }, size: { width: 100 } };
        persistence.save( 'a', snapshot );
        expect( persistence.load( 'a' ) ).toEqual( snapshot );
        persistence.clear( 'a' );
        expect( persistence.load( 'a' ) ).toBeUndefined();
    } );

    it( 'ignores garbage and sanitizes unknown fields', () => {
        const storage = memoryStorage();
        const persistence = createPanelPersistence( storage );
        storage.set( 'bad', '{nope' );
        expect( persistence.load( 'bad' ) ).toBeUndefined();
        storage.set( 'odd', JSON.stringify( { state: 'flying', dock: 'top', pos: { left: 'x' }, size: { width: null } } ) );
        expect( persistence.load( 'odd' ) ).toEqual( { state: 'closed', collapsed: false, dock: null, pos: undefined, size: undefined } );
    } );
} );

describe( 'webStorage', () => {
    it( 'namespaces keys and swallows storage errors', () => {
        const data = new Map<string, string>();
        const fake = { getItem: ( k: string ) => data.get( k ) ?? null, setItem: ( k: string, v: string ) => void data.set( k, v ), removeItem: ( k: string ) => void data.delete( k ) } as Storage;
        const adapter = webStorage( () => fake, 'x' );
        adapter.set( 'a', '1' );
        expect( data.get( 'x:a' ) ).toBe( '1' );
        expect( adapter.get( 'a' ) ).toBe( '1' );

        const blocked = webStorage( () => { throw new Error( 'blocked' ); } );
        expect( () => blocked.set( 'a', '1' ) ).not.toThrow();
        expect( blocked.get( 'a' ) ).toBeNull();
    } );
} );
