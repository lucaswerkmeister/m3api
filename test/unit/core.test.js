/* eslint-env mocha */

import {
	ApiErrors,
	ApiWarnings,
	Session,
	responseBoolean,
	set,
} from '../../core.js';
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import FakeTimers from '@sinonjs/fake-timers';
chai.use( chaiAsPromised );

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
			[ new Set( [ 'a', 'set' ] ), 'a|set' ],
			[ new Set(), '' ],
			[ new Set( [ 'a', 'set', 'with', '|' ] ), '\x1fa\x1fset\x1fwith\x1f|' ],
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
			aSet: new Set( [ 'a', 'set' ] ),
			anEmptySet: new Set(),
			aSetWithPipe: new Set( [ 'a', 'set', 'with', '|' ] ),
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
			aSet: 'a|set',
			anEmptySet: '',
			aSetWithPipe: '\x1fa\x1fset\x1fwith\x1f|',
			true: '',
		} );
	} );

	describe( 'request', () => {

		it( 'throws on non-200 status', async () => {
			class TestSession extends Session {
				async internalGet() {
					return {
						status: 502,
						headers: {},
						body: 'irrelevant',
					};
				}
			}

			const session = new TestSession( 'https://en.wikipedia.org/w/api.php' );
			await expect( session.request( { action: 'query' } ) )
				.to.be.rejectedWith( '502' );
		} );

		describe( 'user agent', () => {

			it( 'from default options', async () => {
				let called = false;
				class TestSession extends Session {
					async internalGet( params, userAgent ) {
						expect( userAgent ).to.match( /^user-agent m3api\/[0-9.]* \(https:\/\/www\.npmjs\.com\/package\/m3api\)/ );
						expect( called, 'not called yet' ).to.be.false;
						called = true;
						return {
							status: 200,
							headers: {},
							body: { response: true },
						};
					}
				}

				const session = new TestSession( 'https://en.wikipedia.org/w/api.php', {}, {
					userAgent: 'user-agent',
				} );
				await session.request( {} );
				expect( called ).to.be.true;
			} );

			it( 'from request options', async () => {
				let called = false;
				class TestSession extends Session {
					async internalGet( params, userAgent ) {
						expect( userAgent ).to.match( /^user-agent m3api\/[0-9.]* \(https:\/\/www\.npmjs\.com\/package\/m3api\)/ );
						expect( called, 'not called yet' ).to.be.false;
						called = true;
						return {
							status: 200,
							headers: {},
							body: { response: true },
						};
					}
				}

				const session = new TestSession( 'https://en.wikipedia.org/w/api.php' );
				await session.request( {}, {
					userAgent: 'user-agent',
				} );
				expect( called ).to.be.true;
			} );

			it( 'default', async () => {
				let called = false;
				class TestSession extends Session {
					async internalGet( params, userAgent ) {
						expect( userAgent ).to.match( /^m3api\/[0-9.]* \(https:\/\/www\.npmjs\.com\/package\/m3api\)/ );
						expect( called, 'not called yet' ).to.be.false;
						called = true;
						return {
							status: 200,
							headers: {},
							body: { response: true },
						};
					}
				}

				const session = new TestSession( 'https://en.wikipedia.org/w/api.php' );
				await session.request( {} );
				expect( called ).to.be.true;
			} );

		} );

		describe( 'automatic retry', () => {

			let clock;
			beforeEach( () => {
				clock = FakeTimers.install();
			} );
			afterEach( () => {
				clock.uninstall();
				expect( clock.countTimers() ).to.equal( 0 );
			} );

			it( 'default', async () => {
				let call = 0;
				class TestSession extends Session {
					async internalGet( params ) {
						expect( params ).to.eql( { format: 'json' } );
						const currentCall = ++call;
						if ( currentCall === 1 ) {
							return {
								status: 200,
								headers: { 'retry-after': '5' },
								body: 'irrelevant',
							};
						} else if ( currentCall === 2 ) {
							return {
								status: 200,
								headers: {},
								body: { response: true },
							};
						} else {
							throw new Error( `Unexpected call #${currentCall}` );
						}
					}
				}

				const session = new TestSession( 'https://en.wikipedia.org/w/api.php' );
				const promise = session.request( {} );
				clock.tickAsync( 5000 );
				const response = await promise;
				expect( response ).to.eql( { response: true } );
				expect( call ).to.equal( 2 );
			} );

			it( 'maxRetries 5 (actual retries 3)', async () => {
				let call = 0;
				class TestSession extends Session {
					async internalGet( params ) {
						expect( params ).to.eql( { format: 'json' } );
						const currentCall = ++call;
						if ( currentCall <= 3 ) {
							return {
								status: 200,
								headers: { 'retry-after': '5' },
								body: 'irrelevant',
							};
						} else if ( currentCall === 4 ) {
							return {
								status: 200,
								headers: {},
								body: { response: true },
							};
						} else {
							throw new Error( `Unexpected call #${currentCall}` );
						}
					}
				}

				const session = new TestSession( 'https://en.wikipedia.org/w/api.php' );
				const promise = session.request( {}, { maxRetries: 5 } );
				for ( let i = 0; i < 3; i++ ) {
					clock.tickAsync( 5000 );
				}
				const response = await promise;
				expect( response ).to.eql( { response: true } );
				expect( call ).to.equal( 4 );
			} );

			it( 'disabled', async () => {
				let called = false;
				class TestSession extends Session {
					async internalGet( params ) {
						expect( params ).to.eql( { format: 'json' } );
						if ( called === false ) {
							called = true;
							return {
								status: 200,
								headers: { 'retry-after': '5' },
								body: { response: true },
							};
						} else {
							throw new Error( 'Unexpected additional call' );
						}
					}
				}

				const session = new TestSession( 'https://en.wikipedia.org/w/api.php', {}, {
					maxRetries: 0,
				} );
				const response = await session.request( {} );
				expect( response ).to.eql( { response: true } );
				expect( called ).to.equal( true );
			} );

		} );

	} );

	describe( 'requestAndContinue', () => {

		function transformResponse( response ) {
			return {
				status: 200,
				headers: {},
				body: response,
			};
		}

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
						return transformResponse( firstResponse );
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
						return transformResponse( secondResponse );
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
						return transformResponse( firstResponse );
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
						return transformResponse( secondResponse );
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

	describe( 'handleWarnings', () => {

		it( 'errorformat=bc, formatversion=1', () => {
			let called = false;
			function warn( warnings ) {
				expect( called, 'not called yet' ).to.be.false;
				called = true;
				expect( warnings ).to.be.an.instanceof( ApiWarnings );
				expect( warnings.message ).to.equal(
					'Because "rvslots" was not specified…',
				);
				expect( warnings.warnings ).to.eql( [
					{
						'*': 'Because "rvslots" was not specified…',
						module: 'revisions',
					},
					{
						'*': 'Subscribe to the mediawiki-api-announce…',
						module: 'main',
					},
				] );
			}
			session.handleWarnings( { warnings: {
				main: {
					'*': 'Subscribe to the mediawiki-api-announce…',
				},
				revisions: {
					'*': 'Because "rvslots" was not specified…',
				},
			} }, warn );
			expect( called ).to.be.true;
		} );

		it( 'errorformat=bc, formatversion=2', () => {
			let called = false;
			function warn( warnings ) {
				expect( called, 'not called yet' ).to.be.false;
				called = true;
				expect( warnings ).to.be.an.instanceof( ApiWarnings );
				expect( warnings.message ).to.equal(
					'Because "rvslots" was not specified…',
				);
				expect( warnings.warnings ).to.eql( [
					{
						warnings: 'Because "rvslots" was not specified…',
						module: 'revisions',
					},
					{
						warnings: 'Subscribe to the mediawiki-api-announce…',
						module: 'main',
					},
				] );
			}
			session.handleWarnings( { warnings: {
				main: {
					warnings: 'Subscribe to the mediawiki-api-announce…',
				},
				revisions: {
					warnings: 'Because "rvslots" was not specified…',
				},
			} }, warn );
			expect( called ).to.be.true;
		} );

		it( 'errorformat=plaintext, formatversion=1', () => {
			let called = false;
			function warn( warnings ) {
				expect( called, 'not called yet' ).to.be.false;
				called = true;
				expect( warnings ).to.be.an.instanceof( ApiWarnings );
				expect( warnings.message ).to.equal(
					'deprecation',
				);
				expect( warnings.warnings ).to.eql( [
					{
						code: 'deprecation',
						data: { feature: 'action=query&prop=revisions&!rvslots' },
						module: 'query+revisions',
						'*': 'Because "rvslots" was not specified…',
					},
					{
						code: 'deprecation-help',
						module: 'main',
						'*': 'Subscribe to the mediawiki-api-announce…',
					},
				] );
			}
			session.handleWarnings( { warnings: [
				{
					code: 'deprecation',
					data: { feature: 'action=query&prop=revisions&!rvslots' },
					module: 'query+revisions',
					'*': 'Because "rvslots" was not specified…',
				},
				{
					code: 'deprecation-help',
					module: 'main',
					'*': 'Subscribe to the mediawiki-api-announce…',
				},
			] }, warn );
			expect( called ).to.be.true;
		} );

		it( 'errorformat=plaintext, formatversion=2', () => {
			let called = false;
			function warn( warnings ) {
				expect( called, 'not called yet' ).to.be.false;
				called = true;
				expect( warnings ).to.be.an.instanceof( ApiWarnings );
				expect( warnings.message ).to.equal(
					'deprecation',
				);
				expect( warnings.warnings ).to.eql( [
					{
						code: 'deprecation',
						text: 'Because "rvslots" was not specified…',
						data: { feature: 'action=query&prop=revisions&!rvslots' },
						module: 'query+revisions',
					},
					{
						code: 'deprecation-help',
						text: 'Subscribe to the mediawiki-api-announce…',
						module: 'main',
					},
				] );
			}
			session.handleWarnings( { warnings: [
				{
					code: 'deprecation',
					text: 'Because "rvslots" was not specified…',
					data: { feature: 'action=query&prop=revisions&!rvslots' },
					module: 'query+revisions',
				},
				{
					code: 'deprecation-help',
					text: 'Subscribe to the mediawiki-api-announce…',
					module: 'main',
				},
			] }, warn );
			expect( called ).to.be.true;
		} );

	} );

} );

describe( 'responseBoolean', () => {

	for ( const [ name, object, expected ] of [
		[ 'formatversion=1 false', {}, false ],
		[ 'formatversion=1 true', { key: '' }, true ],
		[ 'formatversion=2 false', { key: false }, false ],
		[ 'formatversion=2 true', { key: true }, true ],
	] ) {
		it( name, () => {
			expect( responseBoolean( object.key ) ).to.equal( expected );
		} );
	}

} );

describe( 'set', () => {

	it( 'one argument', () => {
		expect( set( 'a' ) ).to.eql( new Set( [ 'a' ] ) );
	} );

	it( 'several arguments', () => {
		expect( set( 'a', 'b' ) ).to.eql( new Set( [ 'a', 'b' ] ) );
	} );

	it( 'redundant arguments', () => {
		expect( set( 'a', 'b', 'a' ) ).to.eql( new Set( [ 'a', 'b' ] ) );
	} );

	it( 'no arguments', () => {
		expect( set() ).to.eql( new Set() );
	} );

} );
