/* eslint-env mocha */

import {
	ApiErrors,
	ApiWarnings,
	DefaultUserAgentWarning,
	responseBoolean,
	set,
} from '../../core.js';
import {
	BaseTestSession,
	singleRequestSession,
	sequentialRequestSession,
} from './sessions.js';
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import FakeTimers from '@sinonjs/fake-timers';
use( chaiAsPromised );

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

	describe( 'request', () => {

		it( 'transforms params', async () => {
			const params = {
				string: 'a string',
				one: 1,
				zero: 0,
				anArray: [ 'an', 'array' ],
				anEmptyArray: [],
				anArrayOfNumbers: [ 1, 2, 3, 4 ],
				aMixedArray: [ 1, 'array' ],
				anArrayWithPipe: [ 'an', 'array', 'with', '|' ],
				aSet: new Set( [ 'a', 'set' ] ),
				anEmptySet: new Set(),
				aSetWithPipe: new Set( [ 'a', 'set', 'with', '|' ] ),
				true: true,
				false: false,
				null: null,
				undefined: undefined,
			};
			const expectedParams = {
				string: 'a string',
				one: '1',
				zero: '0',
				anArray: 'an|array',
				anEmptyArray: '',
				anArrayOfNumbers: '1|2|3|4',
				aMixedArray: '1|array',
				anArrayWithPipe: '\x1fan\x1farray\x1fwith\x1f|',
				aSet: 'a|set',
				anEmptySet: '',
				aSetWithPipe: '\x1fa\x1fset\x1fwith\x1f|',
				true: '',
			};
			const session = singleRequestSession( expectedParams, {} );
			await session.request( params );
		} );

		it( 'supports non-200 status with mediawiki-api-error response header', async () => {
			const session = singleRequestSession( { action: 'query' }, {
				status: 404,
				headers: { 'mediawiki-api-error': 'some-not-found-error' },
				body: { error: { code: 'some-not-found-error' } },
			} );
			await expect( session.request( { action: 'query' } ) )
				.to.be.rejectedWith( ApiErrors );
		} );

		it( 'throws on non-200 status without mediawiki-api-error response header', async () => {
			const session = singleRequestSession( { action: 'query' }, {
				status: 502,
				body: 'irrelevant',
			} );
			await expect( session.request( { action: 'query' } ) )
				.to.be.rejectedWith( '502' );
		} );

		describe( 'tokens', () => {

			it( 'GETs token of tokenType using continuation', async () => {
				const session = sequentialRequestSession( [
					{
						expectedParams: {
							action: 'query',
							meta: 'tokens',
							type: 'csrf',
						},
						response: {
							query: {
								pages: [ /* ... */ ],
								// no tokens
							},
							continue: { continue: '-||' },
						},
					},
					{
						expectedParams: {
							action: 'query',
							meta: 'tokens',
							type: 'csrf',
							continue: '-||',
						},
						response: {
							query: {
								tokens: {
									othertoken: '...+\\',
									// no csrftoken
								},
							},
							continue: { continue: '-||', type: 'csrf|-other' },
						},
					},
					{
						expectedParams: {
							action: 'query',
							meta: 'tokens',
							type: 'csrf|-other',
							continue: '-||',
						},
						response: {
							query: {
								tokens: {
									csrftoken: 'csrftoken+\\',
									unrelatedtoken: '...+\\',
								},
							},
							// should not follow continuation past this point
							continue: { continue: '-||' },
						},
					},
					{
						expectedParams: {
							action: 'edit',
							token: 'csrftoken+\\',
						},
						response: { edit: true },
						method: 'POST',
					},
				] );

				const response = await session.request(
					{ action: 'edit' },
					{ method: 'POST', tokenType: 'csrf' },
				);
				expect( response ).to.eql( { edit: true } );
			} );

			it( 'uses tokenName', async () => {
				const session = sequentialRequestSession( [
					{
						expectedParams: {
							action: 'query',
							meta: 'tokens',
							type: 'login',
						},
						response: { query: { tokens: { logintoken: 'logintoken+\\' } } },
					},
					{
						expectedParams: {
							action: 'login',
							lgtoken: 'logintoken+\\',
						},
						response: { login: true },
						method: 'POST',
					},
				] );

				const response = await session.request(
					{ action: 'login' },
					{ method: 'POST', tokenType: 'login', tokenName: 'lgtoken' },
				);
				expect( response ).to.eql( { login: true } );
			} );

			it( 'reuses tokens', async () => {
				const session = sequentialRequestSession( [
					{
						expectedParams: {
							action: 'query',
							meta: 'tokens',
							type: 'csrf',
						},
						response: { query: { tokens: { csrftoken: 'csrftoken+\\' } } },
					},
					{
						expectedParams: {
							action: 'edit',
							token: 'csrftoken+\\',
						},
						response: { edit: 1 },
						method: 'POST',
					},
					// no second tokens request in between
					{
						expectedParams: {
							action: 'edit',
							token: 'csrftoken+\\',
						},
						response: { edit: 2 },
						method: 'POST',
					},
				] );

				const params = { action: 'edit' };
				const options = { method: 'POST', tokenType: 'csrf' };
				expect( await session.request( params, options ) ).to.eql( { edit: 1 } );
				expect( await session.request( params, options ) ).to.eql( { edit: 2 } );
			} );

			it( 'sends token with each continuation request', async () => {
				const firstResponse = {
					other: 'whatever',
					continue: { continue: 'other' },
				};
				const secondResponse = {
					other: 'done',
					continue: { continue: 'checkuser' },
				};
				const thirdResponse = {
					batchcomplete: true,
					checkuser: 'done',
				};
				const session = sequentialRequestSession( [
					{
						expectedParams: {
							action: 'query',
							meta: 'tokens',
							type: 'csrf',
						},
						response: { query: { tokens: { csrftoken: 'csrftoken+\\' } } },
					},
					{
						expectedParams: {
							action: 'query',
							list: 'other|checkuser',
							cutoken: 'csrftoken+\\',
						},
						response: firstResponse,
						method: 'POST',
					},
					{
						expectedParams: {
							action: 'query',
							list: 'other|checkuser',
							cutoken: 'csrftoken+\\',
							continue: 'other',
						},
						response: secondResponse,
						method: 'POST',
					},
					{
						expectedParams: {
							action: 'query',
							list: 'other|checkuser',
							cutoken: 'csrftoken+\\',
							continue: 'checkuser',
						},
						response: thirdResponse,
						method: 'POST',
					},
				] );

				const params = {
					action: 'query',
					list: set( 'other', 'checkuser' ),
				};
				const options = {
					tokenType: 'csrf',
					tokenName: 'cutoken',
					method: 'POST',
				};
				let iteration = 0;
				for await ( const response of session.requestAndContinue( params, options ) ) {
					switch ( ++iteration ) {
						case 1:
							expect( response ).to.eql( firstResponse );
							break;
						case 2:
							expect( response ).to.eql( secondResponse );
							break;
						case 3:
							expect( response ).to.eql( thirdResponse );
							break;
						default:
							throw new Error( `Unexpected iteration #${ iteration }` );
					}
				}

				expect( iteration ).to.equal( 3 );
			} );

			it( 'uses userAgent option for token request', async () => {
				let called = false;
				class TestSession extends BaseTestSession {
					async internalGet( apiUrl, params, { 'user-agent': userAgent } ) {
						expect( userAgent ).to.match( /^user-agent / );
						expect( called, 'not called yet' ).to.be.false;
						called = true;
						return {
							status: 200,
							headers: {},
							body: { error: { code: 'unknown' } },
						};
					}
				}

				const session = new TestSession( 'en.wikipedia.org' );
				await expect( session.request( {}, { userAgent: 'user-agent' } ) )
					.to.be.rejectedWith( ApiErrors );
				expect( called ).to.be.true;
			} );

			it( 'uses warn option for token request', async () => {
				let warnCalled = false;
				function warn( warnings ) {
					expect( warnings ).to.be.instanceof( ApiWarnings );
					expect( warnings.warnings ).to.eql( [
						{ code: 'whatever' },
					] );
					expect( warnCalled, 'warn() not called yet' ).to.be.false;
					warnCalled = true;
				}

				const session = sequentialRequestSession( [
					{
						expectedParams: {
							action: 'query',
							meta: 'tokens',
							type: 'csrf',
						},
						response: {
							query: { tokens: { csrftoken: 'csrftoken+\\' } },
							warnings: [ { code: 'whatever' } ],
						},
					},
					{
						expectedParams: {
							edit: '',
							token: 'csrftoken+\\',
						},
						response: { edited: true },
					},
				] );
				expect( await session.request( { edit: '' }, { warn, tokenType: 'csrf' } ) )
					.to.eql( { edited: true } );
				expect( warnCalled ).to.be.true;
			} );

			it( 'uses retry options for token request', async () => {
				const clock = FakeTimers.install();
				await clock.tickAsync( 1000 ); // just so it doesn’t start at 0

				try {
					const expectedParams = {
						action: 'query',
						meta: 'tokens',
						type: 'csrf',
					};
					const session = sequentialRequestSession( [
						{ // retry this one
							expectedParams,
							response: { error: { code: 'maxlag' } },
						},
						{ // retry this one
							expectedParams,
							response: { error: { code: 'readonly' } },
						},
						{ // don’t retry this one, exceeds maxRetriesSeconds
							expectedParams,
							response: { error: { code: 'maxlag' } },
						},
					] );
					const promise = session.request( {}, {
						maxRetriesSeconds: 5,
						retryAfterMaxlagSeconds: 2,
						retryAfterReadonlySeconds: 3,
						tokenType: 'csrf',
					} );
					await clock.tickAsync( 5000 );
					await expect( promise )
						.to.be.rejectedWith( ApiErrors );
				} finally {
					clock.uninstall();
					expect( clock.countTimers() ).to.equal( 0 );
				}
			} );

			describe( 'badtoken error', () => {

				it( 'discards tokens and retries with maxRetriesSeconds > 0', async () => {
					const session = sequentialRequestSession( [
						{
							expectedParams: {
								action: 'edit',
								token: 'badtoken+\\',
							},
							response: { errors: [ { code: 'badtoken' } ] },
							method: 'POST',
						},
						{
							expectedParams: {
								action: 'query',
								meta: 'tokens',
								type: 'csrf',
							},
							response: { query: { tokens: { csrftoken: 'csrftoken+\\' } } },
						},
						{
							expectedParams: {
								action: 'edit',
								token: 'csrftoken+\\',
							},
							response: { edit: true },
							method: 'POST',
						},
					] );
					session.tokens.set( 'csrf', 'badtoken+\\' );
					session.tokens.set( 'other', 'othertoken+\\' );

					const response = await session.request(
						{ action: 'edit' },
						{ method: 'POST', tokenType: 'csrf' },
					);
					expect( response ).to.eql( { edit: true } );
					expect( session.tokens ).not.to.have.keys( 'other' );
				} );

				it( 'discards tokens but does not retry with maxRetriesSeconds = 0', async () => {
					const session = singleRequestSession(
						{
							action: 'edit',
							token: 'badtoken+\\',
						},
						{ errors: [ { code: 'badtoken' } ] },
						'POST',
					);
					session.tokens.set( 'csrf', 'badtoken+\\' );
					session.tokens.set( 'other', 'othertoken+\\' );

					await expect( session.request(
						{ action: 'edit' },
						{ method: 'POST', tokenType: 'csrf', maxRetriesSeconds: 0 },
					) ).to.be.rejectedWith( 'badtoken' );
					expect( session.tokens ).to.be.empty;
				} );

				it( 'does nothing special if token specified manually', async () => {
					const session = singleRequestSession(
						{
							action: 'edit',
							token: 'customtoken+\\',
						},
						{ errors: [ { code: 'badtoken' } ] },
						'POST',
					);
					session.tokens.set( 'csrf', 'csrftoken+\\' );

					await expect( session.request( {
						action: 'edit',
						token: 'customtoken+\\',
					}, { method: 'POST' } ) ).to.be.rejectedWith( 'badtoken' );
					expect( session.tokens ).not.to.be.empty; // not cleared
				} );

			} );

		} );

		describe( 'user agent', () => {

			it( 'from default options', async () => {
				const session = new BaseTestSession( 'en.wikipedia.org', {}, {
					userAgent: 'user-agent',
				} );
				expect( session.getUserAgent( {} ) )
					.to.match( /^user-agent m3api\/[0-9.]* \(https:\/\/www\.npmjs\.com\/package\/m3api\)/ );
			} );

			it( 'from request options', async () => {
				const session = new BaseTestSession( 'en.wikipedia.org' );
				expect( session.getUserAgent( {
					userAgent: 'user-agent',
				} ) ).to.match( /^user-agent m3api\/[0-9.]* \(https:\/\/www\.npmjs\.com\/package\/m3api\)/ );
			} );

			it( 'is used for internalGet()', async () => {
				let called = false;
				class TestSession extends BaseTestSession {
					async internalGet( apiUrl, params, { 'user-agent': userAgent } ) {
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
					const session = new BaseTestSession( 'en.wikipedia.org' );
					expect( session.getUserAgent( {
						userAgent: undefined,
						warn: () => {},
					} ) ).to.match( /^m3api\/[0-9.]* \(https:\/\/www\.npmjs\.com\/package\/m3api\)/ );
				} );

				it( 'warns once per session', async () => {
					let warnCalled = false;
					function warn( warning ) {
						expect( warning ).to.be.instanceof( DefaultUserAgentWarning );
						expect( warnCalled, 'warn() not called yet' ).to.be.false;
						warnCalled = true;
					}

					const session = sequentialRequestSession( [
						{ response: { response: true } },
						{ response: { response: true } },
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

					await singleRequestSession( {}, { response: true } )
						.request( {}, { userAgent: undefined, warn } );
					expect( warnCalled ).to.be.true;
					warnCalled = false;
					await singleRequestSession( {}, { response: true } )
						.request( {}, { userAgent: undefined, warn } );
					expect( warnCalled ).to.be.true;
					warnCalled = false;
				} );

			} );

		} );

		describe( 'Authorization header', () => {
			it( 'not by default', async () => {
				let called = false;
				class TestSession extends BaseTestSession {
					async internalGet( apiUrl, params, headers ) {
						expect( headers ).not.to.have.property( 'authorization' );
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
				await session.request( {} );
				expect( called ).to.be.true;
			} );

			for ( const [ name, defaultOptions, options ] of [
				[ 'accessToken in defaultOptions', { accessToken: 'the-access-token' }, {} ],
				[ 'accessToken in options', {}, { accessToken: 'the-access-token' } ],
			] ) {
				it( name, async () => {
					let called = false;
					class TestSession extends BaseTestSession {
						async internalGet( apiUrl, params, { authorization } ) {
							expect( authorization ).to.equal( 'Bearer the-access-token' );
							expect( called, 'not called yet' ).to.be.false;
							called = true;
							return {
								status: 200,
								headers: {},
								body: { response: true },
							};
						}
					}

					const session = new TestSession( 'en.wikipedia.org', {}, defaultOptions );
					await session.request( {}, options );
					expect( called ).to.be.true;
				} );
			}

			for ( const [ name, defaultOptions, options ] of [
				[ 'authorization in defaultOptions', { authorization: 'the-authorization' }, {} ],
				[ 'authorization in options', {}, { authorization: 'the-authorization' } ],
			] ) {
				it( name, async () => {
					let called = false;
					class TestSession extends BaseTestSession {
						async internalGet( apiUrl, params, { authorization } ) {
							expect( authorization ).to.equal( 'the-authorization' );
							expect( called, 'not called yet' ).to.be.false;
							called = true;
							return {
								status: 200,
								headers: {},
								body: { response: true },
							};
						}
					}

					const session = new TestSession( 'en.wikipedia.org', {}, defaultOptions );
					await session.request( {}, options );
					expect( called ).to.be.true;
				} );
			}

			it( 'accessToken consistent with authorization', async () => {
				let called = false;
				class TestSession extends BaseTestSession {
					async internalGet( apiUrl, params, { authorization } ) {
						expect( authorization ).to.equal( 'Bearer the-access-token' );
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
					authorization: 'Bearer the-access-token',
					accessToken: 'the-access-token',
				} );
				expect( called ).to.be.true;
			} );

			it( 'accessToken inconsistent with authorization', async () => {
				let called = false;
				class TestSession extends BaseTestSession {
					async internalGet() {
						called = true;
						throw new Error( 'Should not be called in this test' );
					}
				}

				const session = new TestSession( 'en.wikipedia.org', {}, {
					authorization: 'the-authorization',
					accessToken: 'the-access-token',
				} );
				await expect( session.request( {} ) )
					.to.be.rejected;
				expect( called ).to.be.false;
			} );
		} );

		describe( 'automatic retry', () => {

			let clock;
			beforeEach( () => {
				clock = FakeTimers.install();
			} );
			afterEach( () => {
				/*
				 * For some reason, since @sinonjs/fake-timers v13,
				 * the first test in this block which runs (no matter which specific test it is)
				 * creates a Node-internal afterWriteTick microtask / job
				 * in between the test returning and the afterEach hook running,
				 * which fails the countTimers expectation below unless we run it first.
				 * It’s weird, but at least this keeps the tests working 🤷
				 */
				clock.runMicrotasks();

				clock.uninstall();
				expect( clock.countTimers() ).to.equal( 0 );
			} );

			it( 'default, retry once after 60 seconds', async () => {
				const session = sequentialRequestSession( [
					{ response: {
						headers: { 'retry-after': '60' },
						body: { error: { code: 'maxlag' } },
					} },
					{ response: { response: true } },
				] );
				const promise = session.request( {} );
				await clock.tickAsync( 60000 );
				const response = await promise;
				expect( response ).to.eql( { response: true } );
			} );

			it( 'default, no retry after 66 seconds', async () => {
				const session = singleRequestSession( {}, {
					headers: { 'retry-after': '66' },
					body: { error: { code: 'maxlag' } },
				} );
				await expect( session.request( {} ) )
					.to.be.rejectedWith( ApiErrors );
			} );

			it( 'default, retry repeatedly up to 65 seconds', async () => {
				const session = sequentialRequestSession( [
					{ response: {
						headers: { 'retry-after': '30' },
						body: { error: { code: 'readonly' } },
					} },
					{ response: {
						headers: { 'retry-after': '30' },
						body: { error: { code: 'readonly' } },
					} },
					{ response: {
						headers: { 'retry-after': '5' },
						body: { error: { code: 'maxlag' } },
					} },
					{ response: { response: true } },
				] );
				const promise = session.request( {} );
				await clock.tickAsync( 65000 );
				const response = await promise;
				expect( response ).to.eql( { response: true } );
			} );

			it( 'only retry up to 5 seconds', async () => {
				const session = sequentialRequestSession( [
					{ response: {
						headers: { 'retry-after': '5' },
						body: { error: { code: 'maxlag' } },
					} },
					{ response: {
						headers: { 'retry-after': '5' },
						body: { error: { code: 'maxlag' } },
					} },
				] );
				const promise = session.request( {}, { maxRetriesSeconds: 5 } );
				await clock.tickAsync( 5000 );
				await expect( promise )
					.to.be.rejectedWith( ApiErrors );
			} );

			it( 'disabled', async () => {
				const session = singleRequestSession( {}, {
					headers: { 'retry-after': '5' },
					body: { response: true },
				} );
				const response = await session.request( {}, { maxRetriesSeconds: 0 } );
				expect( response ).to.eql( { response: true } );
			} );

			it( 'retryUntil overrides maxRetriesSeconds', async () => {
				const session = singleRequestSession( {}, {
					headers: { 'retry-after': '5' },
					body: { error: { code: 'maxlag' } },
				} );
				await expect( session.request( {}, {
					retryUntil: performance.now() + 4000, // not enough for retry-after: 5
					maxRetriesSeconds: 6, // enough for retry-after: 5 but overridden by retryUntil
				} ) ).to.be.rejectedWith( ApiErrors );
			} );

			it( 'default maxlag retry delay', async () => {
				const session = sequentialRequestSession( [
					{ response: { error: { code: 'maxlag' } } },
					{ response: { response: true } },
				] );
				const promise = session.request( {} );
				await clock.tickAsync( 5000 );
				const response = await promise;
				expect( response ).to.eql( { response: true } );
			} );

			it( 'default readonly retry delay', async () => {
				const session = sequentialRequestSession( [
					{ response: { error: { code: 'readonly' } } },
					{ response: { response: true } },
				] );
				const promise = session.request( {} );
				await clock.tickAsync( 30000 );
				const response = await promise;
				expect( response ).to.eql( { response: true } );
			} );

			it( 'custom maxlag retry delay', async () => {
				const session = sequentialRequestSession( [
					{ response: { error: { code: 'maxlag' } } },
					{ response: { response: true } },
				] );
				const promise = session.request( {}, { retryAfterMaxlagSeconds: 2 } );
				await clock.tickAsync( 2000 );
				const response = await promise;
				expect( response ).to.eql( { response: true } );
			} );

			it( 'custom readonly retry delay', async () => {
				const session = sequentialRequestSession( [
					{ response: { error: { code: 'readonly' } } },
					{ response: { response: true } },
				] );
				const promise = session.request( {}, { retryAfterReadonlySeconds: 10 } );
				await clock.tickAsync( 10000 );
				const response = await promise;
				expect( response ).to.eql( { response: true } );
			} );

		} );

		describe( 'custom error handlers', () => {

			it( 'handler returns object', async () => {
				const session = singleRequestSession( {}, {
					error: { code: 'custom' },
				} );
				let called = false;
				const response = await session.request( {}, {
					errorHandlers: {
						custom: ( session_, params, options, internalResponse, error ) => {
							expect( session_ ).to.equal( session );
							expect( params ).to.eql( {} );
							expect( options ).to.have.property( 'errorHandlers' );
							expect( options ).to.have.property( 'retryUntil' );
							expect( internalResponse ).to.have.property( 'body' )
								.to.eql( { error: { code: 'custom' } } );
							expect( error ).to.eql( { code: 'custom' } );
							expect( called, 'not called yet' ).to.be.false;
							called = true;
							return { response: true };
						},
					},
				} );
				expect( response ).to.eql( { response: true } );
				expect( called ).to.be.true;
			} );

			it( 'handler returns promise resolving to object', async () => {
				const session = singleRequestSession( {}, {
					error: { code: 'custom' },
				} );
				let called = false;
				const response = await session.request( {}, {
					errorHandlers: {
						custom: async () => {
							expect( called, 'not called yet' ).to.be.false;
							called = true;
							return { response: true };
						},
					},
				} );
				expect( response ).to.eql( { response: true } );
				expect( called ).to.be.true;
			} );

			it( 'handler returns null', async () => {
				const session = singleRequestSession( {}, {
					error: { code: 'custom' },
				} );
				let called = false;
				const promise = session.request( {}, {
					errorHandlers: {
						custom: () => {
							expect( called, 'not called yet' ).to.be.false;
							called = true;
							return null;
						},
					},
				} );
				await expect( promise ).to.be.rejectedWith( ApiErrors );
				expect( called ).to.be.true;
			} );

			it( 'handler returns promise resolving to null', async () => {
				const session = singleRequestSession( {}, {
					error: { code: 'custom' },
				} );
				let called = false;
				const promise = session.request( {}, {
					errorHandlers: {
						custom: async () => {
							expect( called, 'not called yet' ).to.be.false;
							called = true;
							return null;
						},
					},
				} );
				await expect( promise ).to.be.rejectedWith( ApiErrors );
				expect( called ).to.be.true;
			} );

			it( 'handler throws exception', async () => {
				const exception = new Error( 'exception from error handler' );
				const session = singleRequestSession( {}, {
					error: { code: 'custom' },
				} );
				let called = false;
				const promise = session.request( {}, {
					errorHandlers: {
						custom: () => {
							expect( called, 'not called yet' ).to.be.false;
							called = true;
							throw exception;
						},
					},
				} );
				await expect( promise ).to.be.rejectedWith( exception );
				expect( called ).to.be.true;
			} );

			it( 'handler returns promise rejecting with exception', async () => {
				const exception = new Error( 'exception from error handler' );
				const session = singleRequestSession( {}, {
					error: { code: 'custom' },
				} );
				let called = false;
				const promise = session.request( {}, {
					errorHandlers: {
						custom: async () => {
							expect( called, 'not called yet' ).to.be.false;
							called = true;
							throw exception;
						},
					},
				} );
				await expect( promise ).to.be.rejectedWith( exception );
				expect( called ).to.be.true;
			} );

			it( 'falls through handlers for different error codes', async () => {
				const session = singleRequestSession( {}, {
					errors: [
						{ code: 'custom1' },
						{ code: 'custom2' },
						{ code: 'custom3' },
					],
				} );
				let called2 = false, called3 = false;
				const response = await session.request( {}, {
					errorHandlers: {
						// no handler for custom1
						custom2: () => {
							expect( called2, 'not called yet' ).to.be.false;
							called2 = true;
							return null;
						},
						custom3: () => {
							expect( called3, 'not called yet' ).to.be.false;
							called3 = true;
							return { response: true };
						},
					},
				} );
				expect( response ).to.eql( { response: true } );
				expect( called2 ).to.be.true;
				expect( called3 ).to.be.true;
			} );

		} );

		it( 'keeps truncatedresult warning by default', async () => {
			const session = singleRequestSession( {}, {
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
			const session = singleRequestSession( {}, {
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

		describe( 'throw errors', () => {

			it( 'formatversion=1', async () => {
				const session = singleRequestSession( {}, {
					error: { code: 'errorcode' },
				} );
				await expect( session.request( {} ) )
					.to.be.rejectedWith( ApiErrors, 'errorcode' );
			} );

			it( 'formatversion=2', async () => {
				const session = singleRequestSession( {}, {
					errors: [ { code: 'errorcode' }, { code: 'other' } ],
				} );
				await expect( session.request( {} ) )
					.to.be.rejectedWith( ApiErrors, 'errorcode' );
			} );

		} );

		describe( 'handle warnings', () => {

			it( 'errorformat=bc, formatversion=1', async () => {
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
				const session = singleRequestSession( {}, { warnings: {
					main: {
						'*': 'Subscribe to the mediawiki-api-announce…',
					},
					revisions: {
						'*': 'Because "rvslots" was not specified…',
					},
				} } );
				await session.request( {}, { warn } );
				expect( called ).to.be.true;
			} );

			it( 'errorformat=bc, formatversion=2', async () => {
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
				const session = singleRequestSession( {}, { warnings: {
					main: {
						warnings: 'Subscribe to the mediawiki-api-announce…',
					},
					revisions: {
						warnings: 'Because "rvslots" was not specified…',
					},
				} } );
				await session.request( {}, { warn } );
				expect( called ).to.be.true;
			} );

			it( 'errorformat=plaintext, formatversion=1', async () => {
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
				const session = singleRequestSession( {}, { warnings: [
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
				] } );
				await session.request( {}, { warn } );
				expect( called ).to.be.true;
			} );

			it( 'errorformat=plaintext, formatversion=2', async () => {
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
				const session = singleRequestSession( {}, { warnings: [
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
				] } );
				await session.request( {}, { warn } );
				expect( called ).to.be.true;
			} );

			describe( 'dropTruncatedResultWarning', () => {

				describe( 'drops single truncatedresult warning', () => {

					function warn() {
						throw new Error( 'Should not be called in this test' );
					}

					for ( const [ description, warnings ] of [
						// warning message was introduced in commit d8a241f6a7
						// and remained constant up to and including 1.23
						[ 'errorformat=bc, formatversion=1, 1.23.17', {
							main: {
								'*': 'This result was truncated because it would otherwise be larger than the limit of 1 bytes',
							},
						} ],
						// change I7b37295e88 (commit 1c57794e37 on master or 453c558e5f on REL1_25)
						// accidentally introduced an extra space
						[ 'errorformat=bc, formatversion=1, 1.25.0', {
							main: {
								'*': 'This result was truncated because it would otherwise  be larger than the limit of 1 bytes',
							},
						} ],
						// change I5888d617ab (commit f465c7feb4) fixed the double space,
						// making 1.28 identical to 1.23 again
						// change Iae0e2ce3bd (commit 4e6810e4a2) added i18n for the warning,
						// adding a period in the process
						[ 'errorformat=bc, formatversion=1, 1.29.0', {
							main: {
								'*': 'This result was truncated because it would otherwise be larger than the limit of 1 bytes.',
							},
						} ],
						// since then, the English version of the message hasn’t changed;
						// test other formatversion/errorformat now
						[ 'errorformat=bc, formatversion=2', {
							main: {
								warnings: 'This result was truncated because it would otherwise be larger than the limit of 1 bytes.',
							},
						} ],
						[ 'errorformat=none', [
							{ code: 'truncatedresult' },
						] ],
					] ) {
						it( description, async () => {
							const session = singleRequestSession( {}, { warnings } );
							await session.request( {}, { warn, dropTruncatedResultWarning: true } );
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
						it( description, async () => {
							let seenWarnings;
							function warn( warnings ) {
								expect( warnings ).to.be.instanceof( ApiWarnings );
								seenWarnings = warnings.warnings;
							}
							const session = singleRequestSession( {}, { warnings } );
							await session.request( {}, { warn, dropTruncatedResultWarning: true } );
							expect( seenWarnings ).to.have.lengthOf( expectedLength );
						} );
					}

				} );

				it( 'drops truncatedresult from several warnings', async () => {
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
					const session = singleRequestSession( {}, { warnings } );
					await session.request( {}, { warn, dropTruncatedResultWarning: true } );
					expect( called ).to.be.true;
				} );

				it( 'keeps truncatedresult with dropTruncatedResultWarning=false', async () => {
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
					const session = singleRequestSession( {}, { warnings } );
					await session.request( {}, { warn, dropTruncatedResultWarning: false } );
					expect( called ).to.be.true;
				} );

			} );

		} );

		it( 'splits URL and body params', async () => {
			const session = singleRequestSession( {
				action: 'query',
				list: 'search',
				srsearch: 'test',
				origin: '*',
				crossorigin: '',
			}, {}, 'POST' );
			await session.request( {
				action: 'query',
				list: 'search',
				srsearch: 'test',
				origin: '*',
				crossorigin: true,
			}, { method: 'POST' } );
			// actual assertions are in checkPostParams()
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
			const session = sequentialRequestSession( [
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
						throw new Error( `Unexpected iteration #${ iteration }` );
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
			const session = sequentialRequestSession( [
				{
					expectedParams: {
						action: 'purge',
						generator: 'allpages',
						gaplimit: '1',
						format: 'json',
						formatversion: '2',
					},
					response: firstResponse,
					method: 'POST',
				},
				{
					expectedParams: {
						action: 'purge',
						generator: 'allpages',
						gaplimit: '1',
						gapcontinue: '!!',
						continue: 'gapcontinue||',
						format: 'json',
						formatversion: '2',
					},
					response: secondResponse,
					method: 'POST',
				},
			] );

			const params = {
				action: 'purge',
				generator: 'allpages',
				gaplimit: 1,
				formatversion: 2,
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
						throw new Error( `Unexpected iteration #${ iteration }` );
				}
			}

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

			const session = sequentialRequestSession( [
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
						throw new Error( `Unexpected initial() call #${ initialCall }` );
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
						throw new Error( `Unexpected reduce() call #${ reduceCall }` );
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
						throw new Error( `Unexpected iteration #${ iteration }` );
				}
			}

			// allow an extra initial() call that won’t be used (just before continuation ends)
			expect( initialCall, 'initial() call' ).to.be.oneOf( [ 2, 3 ] );
			expect( reduceCall, 'reduce() call' ).to.equal( 3 );
			expect( iteration, 'iteration' ).to.equal( 2 );
		} );

		it( 'drops truncatedresult warning by default', async () => {
			const session = singleRequestSession( {}, {
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
			const session = singleRequestSession( {}, {
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
