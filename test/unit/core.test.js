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

const isResponseKey = Set.prototype.has.bind(
	new Set( Object.keys( successfulResponse( {} ) ) ),
);

function isResponse( bodyOrResponse ) {
	return Object.keys( bodyOrResponse )
		.every( isResponseKey );
}

/**
 * Make a response from the given body or response.
 *
 * @param {Object} bodyOrResponse Either a response,
 * to be returned from {@link Session#internalGet} or {@link Session#internalPost}
 * (with any body, status, and/or headers, but no other keys),
 * or just a response body, to be turned into a successful response.
 * Response objects may still omit parts of a full response,
 * to be completed with defaults from a successful response.
 * @return {Object}
 */
export function makeResponse( bodyOrResponse ) {
	if ( isResponse( bodyOrResponse ) ) {
		return {
			...successfulResponse( {} ),
			...bodyOrResponse,
		};
	} else {
		return successfulResponse( bodyOrResponse );
	}
}

/**
 * Create a Session that expects a single internal GET.
 *
 * @param {Object} expectedParams The expected parameters of the call.
 * For convenience, format='json' is added automatically.
 * @param {Object} response A response object or just its body, see {@link makeResponse}.
 * @return {Session}
 */
export function singleGetSession( expectedParams, response ) {
	expectedParams.format = 'json';
	let called = false;
	class TestSession extends BaseTestSession {
		async internalGet( params ) {
			expect( called, 'internalGet already called' ).to.be.false;
			called = true;
			expect( params ).to.eql( expectedParams );
			return makeResponse( response );
		}
	}

	return new TestSession( 'en.wikipedia.org' );
}

/**
 * Create a Session that expects a series of GETs.
 *
 * @param {Object[]} expectedCalls The expected calls.
 * Each call is an object with expectedParams and response (object or body).
 * format='json' is added to the expectedParams automatically.
 * @return {Session}
 */
export function sequentialGetSession( expectedCalls ) {
	expectedCalls.reverse();
	class TestSession extends BaseTestSession {
		async internalGet( params ) {
			expect( expectedCalls ).to.not.be.empty;
			const [ { expectedParams, response } ] = expectedCalls.splice( -1 );
			expectedParams.format = 'json';
			expect( params ).to.eql( expectedParams );
			return makeResponse( response );
		}
	}

	return new TestSession( 'en.wikipedia.org' );
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
			const session = singleGetSession( { action: 'query' }, {
				status: 502,
				body: 'irrelevant',
			} );
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

					const session = sequentialGetSession( [
						{ expectedParams: {}, response: { response: true } },
						{ expectedParams: {}, response: { response: true } },
					] );
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

					await singleGetSession( {}, { response: true } )
						.request( {}, { userAgent: undefined, warn } );
					expect( warnCalled ).to.be.true;
					warnCalled = false;
					await singleGetSession( {}, { response: true } )
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
				const session = sequentialGetSession( [
					{ expectedParams: {}, response: {
						headers: { 'retry-after': '5' },
						body: 'irrelevant',
					} },
					{ expectedParams: {}, response: { response: true } },
				] );
				const promise = session.request( {} );
				clock.tickAsync( 5000 );
				const response = await promise;
				expect( response ).to.eql( { response: true } );
			} );

			it( 'maxRetries 5 (actual retries 3)', async () => {
				const calls = [];
				for ( let i = 0; i < 3; i++ ) {
					calls.push( { expectedParams: {}, response: {
						headers: { 'retry-after': '5' },
						body: 'irrelevant',
					} } );
				}
				calls.push( { expectedParams: {}, response: { response: true } } );
				const session = sequentialGetSession( calls );

				const promise = session.request( {}, { maxRetries: 5 } );
				for ( let i = 0; i < 3; i++ ) {
					clock.tickAsync( 5000 );
				}
				const response = await promise;
				expect( response ).to.eql( { response: true } );
			} );

			it( 'disabled', async () => {
				const session = singleGetSession( {}, {
					headers: { 'retry-after': '5' },
					body: { response: true },
				} );
				const response = await session.request( {}, { maxRetries: 0 } );
				expect( response ).to.eql( { response: true } );
			} );

		} );

		it( 'keeps truncatedresult warning by default', async () => {
			const session = singleGetSession( {}, {
				batchcomplete: true,
				warnings: [
					{ code: 'truncatedresult' },
				],
			} );
			let called = false;
			await session.request(
				{},
				{ warn( warnings ) {
					called = true;
					expect( warnings ).to.be.instanceof( ApiWarnings );
					expect( warnings.warnings ).to.eql( [
						{ code: 'truncatedresult' },
					] );
				} },
			);
			expect( called ).to.be.true;
		} );

		it( 'drops truncatedresult warning with dropTruncatedResultWarning=true', async () => {
			const session = singleGetSession( {}, {
				batchcomplete: true,
				warnings: [
					{ code: 'truncatedresult' },
				],
			} );
			await session.request(
				{},
				{
					warn() {
						throw new Error( 'Should not be called in this test' );
					},
					dropTruncatedResultWarning: true,
				},
			);
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
			const session = sequentialGetSession( [
				{
					expectedParams: {
						action: 'query',
						generator: 'allpages',
						gaplimit: '1',
						format: 'json',
						formatversion: '2',
					},
					response: firstResponse,
				},
				{
					expectedParams: {
						action: 'query',
						generator: 'allpages',
						gaplimit: '1',
						gapcontinue: '!!',
						continue: 'gapcontinue||',
						format: 'json',
						formatversion: '2',
					},
					response: secondResponse,
				},
			] );

			const params = {
				action: 'query',
				generator: 'allpages',
				gaplimit: 1,
				formatversion: '2',
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

			const session = sequentialGetSession( [
				{
					expectedParams: {
						action: 'query',
						format: 'json',
						formatversion: '2',
					},
					response: firstResponse,
				},
				{
					expectedParams: {
						action: 'query',
						c: '1',
						format: 'json',
						formatversion: '2',
					},
					response: secondResponse,
				},
				{
					expectedParams: {
						action: 'query',
						c: '2',
						format: 'json',
						formatversion: '2',
					},
					response: thirdResponse,
				},
			] );

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

			const params = { action: 'query', formatversion: 2 };
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
			expect( reduceCall, 'reduce() call' ).to.equal( 3 );
			expect( iteration, 'iteration' ).to.equal( 2 );
		} );

		it( 'drops truncatedresult warning by default', async () => {
			const session = singleGetSession( {}, {
				batchcomplete: true,
				warnings: [
					{ code: 'truncatedresult' },
				],
			} );
			await session.requestAndContinueReducingBatch(
				{},
				{ warn() {
					throw new Error( 'Should not be called in this test' );
				} },
				() => null,
			).next();
		} );

		it( 'keeps truncatedresult warning with dropTruncatedResultWarning=false', async () => {
			const session = singleGetSession( {}, {
				batchcomplete: true,
				warnings: [
					{ code: 'truncatedresult' },
				],
			} );
			let called = false;
			await session.requestAndContinueReducingBatch(
				{},
				{
					warn( warnings ) {
						called = true;
						expect( warnings ).to.be.instanceof( ApiWarnings );
						expect( warnings.warnings ).to.eql( [
							{ code: 'truncatedresult' },
						] );
					},
					dropTruncatedResultWarning: false,
				},
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
			} }, warn, false );
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
			} }, warn, false );
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
			] }, warn, false );
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
			] }, warn, false );
			expect( called ).to.be.true;
		} );

		describe( 'dropTruncatedResultWarning', () => {

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
					it( description, () => {
						session.handleWarnings( { warnings }, warn, true );
					} );
				}

			} );

			describe( 'passes through other warnings', () => {

				for ( const [ description, warnings, expectedLength ] of [
					[ 'deprecation warnings', {
						main: { '*': 'Subscribe to the mediawiki-api-announce…' },
						revisions: { '*': 'Because "rvslots" was not specified…' },
					}, 2 ],
					[ 'misleading message', [ {
						code: 'unrelated',
						'*': 'This result was truncated because it would otherwise be larger than the limit of 1 bytes',
					} ], 1 ],
				] ) {
					it( description, () => {
						let seenWarnings;
						function warn( warnings ) {
							expect( warnings ).to.be.instanceof( ApiWarnings );
							seenWarnings = warnings.warnings;
						}
						session.handleWarnings( { warnings }, warn, true );
						expect( seenWarnings ).to.have.lengthOf( expectedLength );
					} );
				}

			} );

			it( 'drops truncatedresult from several warnings', () => {
				let called = false;
				function warn( warnings ) {
					called = true;
					expect( warnings ).to.be.instanceof( ApiWarnings );
					expect( warnings.warnings ).to.eql( [
						{ code: 'deprecation' },
						{ code: 'deprecation-help' },
					] );
				}
				const warnings = [
					{ code: 'deprecation' },
					{ code: 'truncatedresult' },
					{ code: 'deprecation-help' },
				];
				session.handleWarnings( { warnings }, warn, true );
				expect( called ).to.be.true;
			} );

			it( 'keeps truncatedresult with dropTruncatedResultWarning=false', () => {
				let called = false;
				function warn( warnings ) {
					called = true;
					expect( warnings ).to.be.instanceof( ApiWarnings );
					expect( warnings.warnings ).to.eql( [
						{ code: 'truncatedresult' },
					] );
				}
				const warnings = [
					{ code: 'truncatedresult' },
				];
				session.handleWarnings( { warnings }, warn, false );
				expect( called ).to.be.true;
			} );

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
