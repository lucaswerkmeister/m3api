/* eslint-env mocha */

import {
	ApiErrors,
	ApiWarnings,
	DefaultUserAgentWarning,
	Session,
	responseBoolean,
	set,
} from '../../core.js';
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import FakeTimers from '@sinonjs/fake-timers';
chai.use( chaiAsPromised );

export class BaseTestSession extends Session {

	constructor( apiUrl, defaultParams = {}, defaultOptions = {} ) {
		if ( !( 'warn' in defaultOptions ) ) {
			defaultOptions.warn = function () {
				throw new Error( 'warn() should not be called in this test' );
			};
		}
		if ( !( 'userAgent' in defaultOptions ) ) {
			defaultOptions.userAgent = 'm3api-unit-test';
		}
		super( apiUrl, defaultParams, defaultOptions );
	}

	internalGet() {
		throw new Error( 'internalGet() should not be called in this test' );
	}

	internalPost() {
		throw new Error( 'internalPost() should not be called in this test' );
	}

}

export function successfulResponse( body ) {
	return {
		status: 200,
		headers: {},
		body,
	};
}

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

	const session = new BaseTestSession( 'en.wikipedia.org' );

	describe( 'apiUrl', () => {

		it( 'full URL', () => {
			const session = new BaseTestSession( 'https://starwars.fandom.com/api.php' );
			expect( session.apiUrl ).to.equal( 'https://starwars.fandom.com/api.php' );
		} );

		it( 'domain', () => {
			const session = new BaseTestSession( 'en.wikipedia.org' );
			expect( session.apiUrl ).to.equal( 'https://en.wikipedia.org/w/api.php' );
		} );

	} );

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
			class TestSession extends BaseTestSession {
				async internalGet() {
					return {
						status: 502,
						headers: {},
						body: 'irrelevant',
					};
				}
			}

			const session = new TestSession( 'en.wikipedia.org' );
			await expect( session.request( { action: 'query' } ) )
				.to.be.rejectedWith( '502' );
		} );

		describe( 'user agent', () => {

			it( 'from default options', async () => {
				let called = false;
				class TestSession extends BaseTestSession {
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

				const session = new TestSession( 'en.wikipedia.org', {}, {
					userAgent: 'user-agent',
				} );
				await session.request( {} );
				expect( called ).to.be.true;
			} );

			it( 'from request options', async () => {
				let called = false;
				class TestSession extends BaseTestSession {
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

				const session = new TestSession( 'en.wikipedia.org' );
				await session.request( {}, {
					userAgent: 'user-agent',
				} );
				expect( called ).to.be.true;
			} );

			describe( 'default', () => {

				it( 'value', async () => {
					let called = false;
					class TestSession extends BaseTestSession {
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

					const session = new TestSession( 'en.wikipedia.org' );
					await session.request( {}, { userAgent: undefined, warn: () => {} } );
					expect( called ).to.be.true;
				} );

				it( 'warns once per session', async () => {
					let warnCalled = false;
					function warn( warning ) {
						expect( warning ).to.be.instanceof( DefaultUserAgentWarning );
						expect( warnCalled, 'warn() not called yet' ).to.be.false;
						warnCalled = true;
					}

					class TestSession extends BaseTestSession {
						async internalGet() {
							return {
								status: 200,
								headers: {},
								body: { response: true },
							};
						}
					}

					const session = new TestSession( 'en.wikipedia.org' );
					await session.request( {}, { userAgent: undefined, warn } );
					expect( warnCalled ).to.be.true;
					await session.request( {}, { userAgent: undefined, warn } );
				} );

				it( 'warns multiple times for different sessions', async () => {
					let warnCalled = false;
					function warn( warning ) {
						expect( warning ).to.be.instanceof( DefaultUserAgentWarning );
						expect( warnCalled, 'warn() not called yet' ).to.be.false;
						warnCalled = true;
					}

					class TestSession extends BaseTestSession {
						async internalGet() {
							return {
								status: 200,
								headers: {},
								body: { response: true },
							};
						}
					}

					await new TestSession( 'en.wikipedia.org' )
						.request( {}, { userAgent: undefined, warn } );
					expect( warnCalled ).to.be.true;
					warnCalled = false;
					await new TestSession( 'en.wikipedia.org' )
						.request( {}, { userAgent: undefined, warn } );
					expect( warnCalled ).to.be.true;
					warnCalled = false;
				} );

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
				class TestSession extends BaseTestSession {
					async internalGet( params ) {
						expect( params ).to.eql( { format: 'json' } );
						switch ( ++call ) {
							case 1:
								return {
									status: 200,
									headers: { 'retry-after': '5' },
									body: 'irrelevant',
								};
							case 2:
								return {
									status: 200,
									headers: {},
									body: { response: true },
								};
							default:
								throw new Error( `Unexpected call #${call}` );
						}
					}
				}

				const session = new TestSession( 'en.wikipedia.org' );
				const promise = session.request( {} );
				clock.tickAsync( 5000 );
				const response = await promise;
				expect( response ).to.eql( { response: true } );
				expect( call ).to.equal( 2 );
			} );

			it( 'maxRetries 5 (actual retries 3)', async () => {
				let call = 0;
				class TestSession extends BaseTestSession {
					async internalGet( params ) {
						expect( params ).to.eql( { format: 'json' } );
						switch ( ++call ) {
							case 1:
							case 2:
							case 3:
								return {
									status: 200,
									headers: { 'retry-after': '5' },
									body: 'irrelevant',
								};
							case 4:
								return {
									status: 200,
									headers: {},
									body: { response: true },
								};
							default:
								throw new Error( `Unexpected call #${call}` );
						}
					}
				}

				const session = new TestSession( 'en.wikipedia.org' );
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
				class TestSession extends BaseTestSession {
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

				const session = new TestSession( 'en.wikipedia.org', {}, {
					maxRetries: 0,
				} );
				const response = await session.request( {} );
				expect( response ).to.eql( { response: true } );
				expect( called ).to.equal( true );
			} );

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
			class TestSession extends BaseTestSession {
				async internalGet( params ) {
					switch ( ++call ) {
						case 1:
							expect( params ).to.eql( {
								action: 'query',
								generator: 'allpages',
								gaplimit: '1',
								format: 'json',
								formatversion: '2',
							} );
							return successfulResponse( firstResponse );
						case 2:
							expect( params ).to.eql( {
								action: 'query',
								generator: 'allpages',
								gaplimit: '1',
								gapcontinue: '!!',
								continue: 'gapcontinue||',
								format: 'json',
								formatversion: '2',
							} );
							return successfulResponse( secondResponse );
						default:
							throw new Error( `Unexpected call #${call}` );
					}
				}
			}

			const session = new TestSession( 'en.wikipedia.org', {
				formatversion: 2,
			} );
			const params = {
				action: 'query',
				generator: 'allpages',
				gaplimit: 1,
			};
			let iteration = 0;
			for await ( const response of session.requestAndContinue( params ) ) {
				switch ( ++iteration ) {
					case 1:
						expect( response ).to.eql( firstResponse );
						break;
					case 2:
						expect( response ).to.eql( secondResponse );
						break;
					default:
						throw new Error( `Unexpected iteration #${iteration}` );
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
			class TestSession extends BaseTestSession {
				async internalPost( urlParams, bodyParams ) {
					expect( urlParams ).to.eql( {} );
					switch ( ++call ) {
						case 1:
							expect( bodyParams ).to.eql( {
								action: 'purge',
								generator: 'allpages',
								gaplimit: '1',
								format: 'json',
								formatversion: '2',
							} );
							return successfulResponse( firstResponse );
						case 2:
							expect( bodyParams ).to.eql( {
								action: 'purge',
								generator: 'allpages',
								gaplimit: '1',
								gapcontinue: '!!',
								continue: 'gapcontinue||',
								format: 'json',
								formatversion: '2',
							} );
							return successfulResponse( secondResponse );
						default:
							throw new Error( `Unexpected call #${call}` );
					}
				}
			}

			const session = new TestSession( 'en.wikipedia.org', {
				formatversion: 2,
			} );
			const params = {
				action: 'purge',
				generator: 'allpages',
				gaplimit: 1,
			};
			let iteration = 0;
			for await ( const response of session.requestAndContinue( params, { method: 'POST' } ) ) {
				switch ( ++iteration ) {
					case 1:
						expect( response ).to.eql( firstResponse );
						delete response.continue.gapcontinue; // should *not* affect continuation
						break;
					case 2:
						expect( response ).to.eql( secondResponse );
						break;
					default:
						throw new Error( `Unexpected iteration #${iteration}` );
				}
			}

			expect( call ).to.equal( 2 );
			expect( iteration ).to.equal( 2 );
		} );

	} );

	describe( 'requestAndContinueReducingBatch', () => {

		it( 'calls reduce and returns results', async () => {
			const firstResponse = {
				continue: { c: '1' },
				query: {
					pages: [
						{ title: 't', prop: 'p' },
						{ title: 'T' },
					],
				},
			};
			const secondResponse = {
				batchcomplete: true,
				continue: { c: '2' },
				query: {
					pages: [
						{ title: 't' },
						{ title: 'T', prop: 'P' },
					],
				},
			};
			const thirdResponse = {
				batchcomplete: true,
				query: {
					pages: [ { title: '7' } ],
				},
			};

			const firstInitial = '1st initial';
			const firstAccumulator = '1st accumulator';
			const secondAccumulator = '2nd accumulator';
			const secondInitial = '2nd initial';
			const thirdAccumulator = '3rd accumulator';
			const thirdInitial = '3rd initial';

			let initialCall = 0;
			function initial() {
				switch ( ++initialCall ) {
					case 1:
						return firstInitial;
					case 2:
						return secondInitial;
					case 3:
						// allow an extra initial() call that won’t be used
						return thirdInitial;
					default:
						throw new Error( `Unexpected initial() call #${initialCall}` );
				}
			}

			let getCall = 0;
			class TestSession extends BaseTestSession {
				async internalGet( params ) {
					switch ( ++getCall ) {
						case 1:
							expect( params ).to.eql( {
								action: 'query',
								format: 'json',
								formatversion: '2',
							} );
							return successfulResponse( firstResponse );
						case 2:
							expect( params ).to.eql( {
								action: 'query',
								c: '1',
								format: 'json',
								formatversion: '2',
							} );
							return successfulResponse( secondResponse );
						case 3:
							expect( params ).to.eql( {
								action: 'query',
								c: '2',
								format: 'json',
								formatversion: '2',
							} );
							return successfulResponse( thirdResponse );
						default:
							throw new Error( `Unexpected internalGet() call #${getCall}` );
					}
				}
			}

			let reduceCall = 0;
			function reduce( accumulator, response ) {
				switch ( ++reduceCall ) {
					case 1:
						expect( accumulator ).to.equal( firstInitial );
						expect( response ).to.equal( firstResponse );
						return firstAccumulator;
					case 2:
						expect( accumulator ).to.equal( firstAccumulator );
						expect( response ).to.equal( secondResponse );
						delete response.batchcomplete; // this should *not* affect continuation
						return secondAccumulator;
					case 3:
						expect( accumulator ).to.equal( secondInitial );
						expect( response ).to.equal( thirdResponse );
						return thirdAccumulator;
					default:
						throw new Error( `Unexpected reduce() call #${reduceCall}` );
				}
			}

			const session = new TestSession( 'en.wikipedia.org', {
				formatversion: 2,
			} );
			const params = { action: 'query' };
			let iteration = 0;
			for await ( const result of session.requestAndContinueReducingBatch(
				params,
				{},
				reduce,
				initial,
			) ) {
				switch ( ++iteration ) {
					case 1:
						expect( result ).to.equal( secondAccumulator );
						break;
					case 2:
						expect( result ).to.equal( thirdAccumulator );
						break;
					default:
						throw new Error( `Unexpected iteration #${iteration}` );
				}
			}

			// allow an extra initial() call that won’t be used (just before continuation ends)
			expect( initialCall, 'initial() call' ).to.be.oneOf( [ 2, 3 ] );
			expect( getCall, 'internalGet() call' ).to.equal( 3 );
			expect( reduceCall, 'reduce() call' ).to.equal( 3 );
			expect( iteration, 'iteration' ).to.equal( 2 );
		} );

		describe( 'drops single truncatedresult warning', () => {

			function warn() {
				throw new Error( 'Should not be called in this test' );
			}

			for ( const [ description, warnings ] of [
				[ 'errorformat=bc, formatversion=1, 1.37', {
					main: {
						'*': 'This result was truncated because it would otherwise be larger than the limit of 1 bytes',
					},
				} ],
				[ 'errorformat=bc, formatversion=1, 1.27', {
					main: {
						'*': 'This result was truncated because it would otherwise  be larger than the limit of 1 bytes',
					},
				} ],
				[ 'errorformat=bc, formatversion=2', {
					main: {
						warnings: 'This result was truncated because it would otherwise be larger than the limit of 1 bytes',
					},
				} ],
				[ 'errorformat=none', [
					{ code: 'truncatedresult' },
				] ],
			] ) {
				it( description, async () => {
					class TestSession extends BaseTestSession {
						async internalGet() {
							return successfulResponse( {
								batchcomplete: true,
								warnings,
							} );
						}
					}
					const session = new TestSession( 'en.wikipedia.org' );
					await session.requestAndContinueReducingBatch( {}, { warn }, () => 0 ).next();
				} );
			}

		} );

		describe( 'passes through other warnings', () => {

			let seenWarnings;
			function warn( warnings ) {
				expect( warnings ).to.be.instanceof( ApiWarnings );
				seenWarnings = warnings.warnings;
			}
			afterEach( () => {
				seenWarnings = undefined;
			} );

			for ( const [ d1, warnings, expectedLength ] of [
				[ 'deprecation warnings', {
					main: { '*': 'Subscribe to the mediawiki-api-announce…' },
					revisions: { '*': 'Because "rvslots" was not specified…' },
				}, 2 ],
				[ 'misleading message', [ {
					code: 'unrelated',
					'*': 'This result was truncated because it would otherwise be larger than the limit of 1 bytes',
				} ], 1 ],
			] ) {
				for ( const [ d2, defaultOptions, options ] of [
					[ 'warn in options', {}, { warn } ],
					[ 'warn in defaultOptions', { warn }, {} ],
				] ) {
					// eslint-disable-next-line no-loop-func
					it( `${d1}, ${d2}`, async () => {
						class TestSession extends BaseTestSession {
							async internalGet() {
								return successfulResponse( {
									batchcomplete: true,
									warnings,
								} );
							}
						}
						const session = new TestSession( 'en.wikipedia.org', {}, defaultOptions );
						await session.requestAndContinueReducingBatch(
							{},
							options,
							() => null,
						).next();
						expect( seenWarnings ).to.have.lengthOf( expectedLength );
					} );
				}
			}

		} );

		it( 'drops truncatedresult from several warnings', async () => {
			class TestSession extends BaseTestSession {
				async internalGet() {
					return successfulResponse( {
						batchcomplete: true,
						warnings: [
							{ code: 'deprecation' },
							{ code: 'truncatedresult' },
							{ code: 'deprecation-help' },
						],
					} );
				}
			}
			const session = new TestSession( 'en.wikipedia.org' );
			let called = false;
			await session.requestAndContinueReducingBatch(
				{},
				{ warn( warnings ) {
					called = true;
					expect( warnings ).to.be.instanceof( ApiWarnings );
					expect( warnings.warnings ).to.eql( [
						{ code: 'deprecation' },
						{ code: 'deprecation-help' },
					] );
				} },
				() => null,
			).next();
			expect( called ).to.be.true;
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
