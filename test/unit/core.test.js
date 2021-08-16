/* eslint-env mocha */

import { ApiErrors, Session } from '../../core.js';
import { expect } from 'chai';

describe( 'ApiErrors', () => {

	it( 'uses first error code as message', () => {
		const errors = [ { code: 'code1' }, { code: 'code2' } ];
		const apiErrors = new ApiErrors( errors );
		expect( apiErrors.message ).to.equal( 'code1' );
	} );

	it( 'sets name', () => {
		const apiErrors = new ApiErrors( [ { code: 'code' } ] );
		expect( apiErrors.name ).to.equal( 'ApiErrors' );
	} );

} );

describe( 'Session', () => {

	const session = new Session( 'https://en.wikipedia.org/w/api.php' );

	describe( 'transformParamValue', () => {
		for ( const [ value, expected ] of [
			[ 'a string', 'a string' ],
			[ 1, '1' ],
			[ 0, '0' ],
			[ [ 'an', 'array' ], 'an|array' ],
			[ [], '' ],
			[ [ 'an', 'array', 'with', '|' ], '\x1fan\x1farray\x1fwith\x1f|' ],
			[ true, '' ],
			[ false, undefined ],
			[ null, undefined ],
			[ undefined, undefined ],
		] ) {
			it( `${value} => ${expected}`, () => {
				const actual = session.transformParamValue( value );
				expect( actual ).to.equal( expected );
			} );
		}
	} );

	it( 'transformParams', () => {
		expect( session.transformParams( {
			string: 'a string',
			one: 1,
			zero: 0,
			anArray: [ 'an', 'array' ],
			anEmptyArray: [],
			anArrayWithPipe: [ 'an', 'array', 'with', '|' ],
			true: true,
			false: false,
			null: null,
			undefined: undefined,
		} ) ).to.eql( {
			string: 'a string',
			one: '1',
			zero: '0',
			anArray: 'an|array',
			anEmptyArray: '',
			anArrayWithPipe: '\x1fan\x1farray\x1fwith\x1f|',
			true: '',
		} );
	} );

	describe( 'requestAndContinue', () => {

		it( 'query (GET)', async () => {
			const firstResponse = {
				batchcomplete: true,
				continue: {
					gapcontinue: '!!',
					continue: 'gapcontinue||',
				},
				query: {
					pages: [
						{
							pageid: 5878274,
							ns: 0,
							title: '!',
						},
					],
				},
			};
			const secondResponse = {
				batchcomplete: true,
				query: {
					pages: [
						{
							pageid: 3632887,
							ns: 0,
							title: '!!',
						},
					],
				},
			};
			let call = 0;
			class TestSession extends Session {
				async internalGet( params ) {
					const currentCall = ++call;
					if ( currentCall === 1 ) {
						expect( params ).to.eql( {
							action: 'query',
							generator: 'allpages',
							gaplimit: '1',
							format: 'json',
							formatversion: '2',
						} );
						return firstResponse;
					} else if ( currentCall === 2 ) {
						expect( params ).to.eql( {
							action: 'query',
							generator: 'allpages',
							gaplimit: '1',
							gapcontinue: '!!',
							continue: 'gapcontinue||',
							format: 'json',
							formatversion: '2',
						} );
						return secondResponse;
					} else {
						throw new Error( `Unexpected call #${currentCall}` );
					}
				}
			}

			const session = new TestSession( 'https://en.wikipedia.org/w/api.php', {
				formatversion: 2,
			} );
			const params = {
				action: 'query',
				generator: 'allpages',
				gaplimit: 1,
			};
			let iteration = 0;
			for await ( const response of session.requestAndContinue( params ) ) {
				const currentIteration = ++iteration;
				if ( currentIteration === 1 ) {
					expect( response ).to.eql( firstResponse );
				} else if ( currentIteration === 2 ) {
					expect( response ).to.eql( secondResponse );
				} else {
					throw new Error( `Unexpected iteration #${currentIteration}` );
				}
			}

			expect( call ).to.equal( 2 );
			expect( iteration ).to.equal( 2 );
		} );

		it( 'purge (POST)', async () => {
			const firstResponse = {
				batchcomplete: true,
				continue: {
					gapcontinue: '!!',
					continue: 'gapcontinue||',
				},
				purge: [
					{
						ns: 0,
						title: '!',
						purged: true,
					},
				],
			};
			const secondResponse = {
				batchcomplete: true,
				purge: [
					{
						ns: 0,
						title: '!!',
						purged: true,
					},
				],
			};
			let call = 0;
			class TestSession extends Session {
				async internalPost( urlParams, bodyParams ) {
					expect( urlParams ).to.eql( {} );
					const currentCall = ++call;
					if ( currentCall === 1 ) {
						expect( bodyParams ).to.eql( {
							action: 'purge',
							generator: 'allpages',
							gaplimit: '1',
							format: 'json',
							formatversion: '2',
						} );
						return firstResponse;
					} else if ( currentCall === 2 ) {
						expect( bodyParams ).to.eql( {
							action: 'purge',
							generator: 'allpages',
							gaplimit: '1',
							gapcontinue: '!!',
							continue: 'gapcontinue||',
							format: 'json',
							formatversion: '2',
						} );
						return secondResponse;
					} else {
						throw new Error( `Unexpected call #${currentCall}` );
					}
				}
			}

			const session = new TestSession( 'https://en.wikipedia.org/w/api.php', {
				formatversion: 2,
			} );
			const params = {
				action: 'purge',
				generator: 'allpages',
				gaplimit: 1,
			};
			let iteration = 0;
			for await ( const response of session.requestAndContinue( params, { method: 'POST' } ) ) {
				const currentIteration = ++iteration;
				if ( currentIteration === 1 ) {
					expect( response ).to.eql( firstResponse );
				} else if ( currentIteration === 2 ) {
					expect( response ).to.eql( secondResponse );
				} else {
					throw new Error( `Unexpected iteration #${currentIteration}` );
				}
			}

			expect( call ).to.equal( 2 );
			expect( iteration ).to.equal( 2 );
		} );

	} );

	describe( 'throwErrors', () => {

		it( 'formatversion=1', () => {
			expect( () => session.throwErrors( {
				error: { code: 'errorcode' },
			} ) ).to.throw( ApiErrors, 'errorcode' );
		} );

		it( 'formatversion=2', () => {
			expect( () => session.throwErrors( {
				errors: [ { code: 'errorcode' }, { code: 'other' } ],
			} ) ).to.throw( ApiErrors, 'errorcode' );
		} );

	} );

} );
