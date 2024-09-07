/* eslint-env mocha */

import { set } from '../../core.js';
import { FetchSession } from '../../fetch.js';
import { expect } from 'chai';
import { File } from 'buffer'; // only available globally since Node 20

describe( 'FetchSession', () => {

	let realFetch, mockFetchArguments;

	before( function storeFetch() {
		realFetch = global.fetch;
	} );

	beforeEach( function mockFetch() {
		global.fetch = async function ( ...args ) {
			mockFetchArguments = args;
			return new Response( '{}' );
		};
	} );

	afterEach( function unmockFetch() {
		global.fetch = realFetch;
		mockFetchArguments = undefined;
	} );

	const session = new FetchSession(
		'en.wikipedia.org',
		{},
		{ userAgent: 'm3api-unit-test' },
	);

	describe( 'internalPost', () => {

		it( 'uses URLSearchParams if possible', async () => {
			await session.request( {
				action: 'query',
				meta: set( 'userinfo', 'siteinfo' ),
				siprop: [ 'general', 'namespaces' ], // array instead of set just for coverage
				curtimestamp: true,
				formatversion: 2,
			}, { method: 'POST' } );
			expect( mockFetchArguments ).to.have.lengthOf( 2 );
			expect( mockFetchArguments[ 0 ] ).to.be.an.instanceof( URL );
			expect( mockFetchArguments[ 0 ].toString() ).to.equal(
				'https://en.wikipedia.org/w/api.php?action=query',
			);
			expect( mockFetchArguments[ 1 ] ).to.have.deep.property( 'headers', {
				'user-agent': session.getUserAgent( {} ),
			} );
			expect( mockFetchArguments[ 1 ] ).to.have.property( 'method', 'POST' );
			expect( mockFetchArguments[ 1 ].body ).to.be.an.instanceof( URLSearchParams );
			expect( mockFetchArguments[ 1 ].body.toString() ).to.equal(
				new URLSearchParams( {
					meta: 'userinfo|siteinfo',
					siprop: 'general|namespaces',
					curtimestamp: '',
					formatversion: '2',
					format: 'json',
				} ).toString(),
			);
		} );

		it( 'uses FormData if necessary', async () => {
			const file = new File( [ '1' ], { type: 'text/plain' } );
			await session.request( {
				file,
			}, { method: 'POST' } );
			expect( mockFetchArguments[ 1 ].body ).to.be.an.instanceof( FormData );
			expect( [ ...mockFetchArguments[ 1 ].body.keys() ] ).to.eql( [ 'file', 'format' ] );
			expect( mockFetchArguments[ 1 ].body.getAll( 'format' ) ).to.eql( [ 'json' ] );
			expect( mockFetchArguments[ 1 ].body.getAll( 'file' ) ).to.eql( [ file ] );
		} );

	} );

} );
