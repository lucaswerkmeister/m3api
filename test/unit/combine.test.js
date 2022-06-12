/* eslint-env mocha */

import { mixCombiningSessionInto } from '../../combine.js';
import { ApiWarnings, Session, set } from '../../core.js';
import {
	BaseTestSession,
	singleRequestSession as singleRequestCoreSession,
	sequentialRequestSession as sequentialRequestCoreSession,
} from './sessions.js';
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
chai.use( chaiAsPromised );

describe( 'CombiningSession', () => {

	const response = { response: true };

	/**
	 * Create a CombiningSession that expects a single internal request.
	 *
	 * @param {Object} expectedParams The expected parameters of the call.
	 * For convenience, format='json' is added automatically.
	 * @param {Object} [response_] The response object, default to `response`.
	 * @param {string} [method] The expected method, 'GET' or 'POST'.
	 * @return {Session}
	 */
	function singleRequestSession( expectedParams, response_ = response, method = 'GET' ) {
		const session = singleRequestCoreSession( expectedParams, response_, method );
		mixCombiningSessionInto( Object.getPrototypeOf( session ).constructor );
		return session;
	}

	describe( 'combines compatible requests', () => {

		it( 'empty + nonempty', async () => {
			const session = singleRequestSession( {
				formatversion: '2',
			} );
			const promise1 = session.request( {} );
			const promise2 = session.request( { formatversion: 2 } );
			const [ response1, response2 ] = await Promise.all( [ promise1, promise2 ] );
			expect( response1 ).to.equal( response );
			expect( response2 ).to.equal( response );
		} );

		it( 'nonempty + empty', async () => {
			const session = singleRequestSession( {
				formatversion: '2',
			} );
			const promise1 = session.request( { formatversion: 2 } );
			const promise2 = session.request( {} );
			const [ response1, response2 ] = await Promise.all( [ promise1, promise2 ] );
			expect( response1 ).to.equal( response );
			expect( response2 ).to.equal( response );
		} );

		it( 'identical parameters', async () => {
			const session = singleRequestSession( {
				formatversion: '2',
				errorformat: 'raw',
			} );
			const promise1 = session.request( { formatversion: 2, errorformat: 'raw' } );
			const promise2 = session.request( { formatversion: 2, errorformat: 'raw' } );
			const [ response1, response2 ] = await Promise.all( [ promise1, promise2 ] );
			expect( response1 ).to.equal( response );
			expect( response2 ).to.equal( response );
		} );

		it( 'identical but swapped parameters', async () => {
			const session = singleRequestSession( {
				formatversion: '2',
				errorformat: 'raw',
			} );
			const promise1 = session.request( { formatversion: 2, errorformat: 'raw' } );
			const promise2 = session.request( { errorformat: 'raw', formatversion: 2 } );
			const [ response1, response2 ] = await Promise.all( [ promise1, promise2 ] );
			expect( response1 ).to.equal( response );
			expect( response2 ).to.equal( response );
		} );

		it( 'disjoint parameters', async () => {
			const session = singleRequestSession( {
				formatversion: '2',
				errorformat: 'raw',
			} );
			const promise1 = session.request( { formatversion: 2 } );
			const promise2 = session.request( { errorformat: 'raw' } );
			const [ response1, response2 ] = await Promise.all( [ promise1, promise2 ] );
			expect( response1 ).to.equal( response );
			expect( response2 ).to.equal( response );
		} );

		it( 'differently typed scalar parameters', async () => {
			const session = singleRequestSession( {
				two: '2',
				yes: '',
			} );
			const promise1 = session.request( { two: 2, yes: true, no: false } );
			const promise2 = session.request( { two: '2', yes: '', no: null } );
			const [ response1, response2 ] = await Promise.all( [ promise1, promise2 ] );
			expect( response1 ).to.equal( response );
			expect( response2 ).to.equal( response );
		} );

		it( 'set parameters', async () => {
			const session = singleRequestSession( {
				meta: 'siteinfo|userinfo',
			} );
			const promise1 = session.request( { meta: set( 'siteinfo' ) } );
			const promise2 = session.request( { meta: set( 'userinfo' ) } );
			const [ response1, response2 ] = await Promise.all( [ promise1, promise2 ] );
			expect( response1 ).to.equal( response );
			expect( response2 ).to.equal( response );
		} );

		it( 'set + nonempty set', async () => {
			const session = singleRequestSession( {
				meta: 'siteinfo',
			} );
			const promise1 = session.request( { meta: set() } );
			const promise2 = session.request( { meta: set( 'siteinfo' ) } );
			const [ response1, response2 ] = await Promise.all( [ promise1, promise2 ] );
			expect( response1 ).to.equal( response );
			expect( response2 ).to.equal( response );
		} );

		it( 'nonempty set + empty set', async () => {
			const session = singleRequestSession( {
				meta: 'siteinfo',
			} );
			const promise1 = session.request( { meta: set( 'siteinfo' ) } );
			const promise2 = session.request( { meta: set() } );
			const [ response1, response2 ] = await Promise.all( [ promise1, promise2 ] );
			expect( response1 ).to.equal( response );
			expect( response2 ).to.equal( response );
		} );

		it( 'longer sets', async () => {
			const session = singleRequestSession( {
				alpha: 'a|b|c|d|e|f|g|h',
			} );
			const promise1 = session.request( { alpha: set( 'a', 'b', 'c', 'd', 'e' ) } );
			const promise2 = session.request( { alpha: set( 'd', 'e', 'f', 'g', 'h' ) } );
			const [ response1, response2 ] = await Promise.all( [ promise1, promise2 ] );
			expect( response1 ).to.equal( response );
			expect( response2 ).to.equal( response );
		} );

		it( 'sets with differently typed scalars', async () => {
			const session = singleRequestSession( {
				two: '2',
			} );
			const promise1 = session.request( { two: set( 2 ) } );
			const promise2 = session.request( { two: set( '2' ) } );
			const [ response1, response2 ] = await Promise.all( [ promise1, promise2 ] );
			expect( response1 ).to.equal( response );
			expect( response2 ).to.equal( response );
		} );

		it( 'sets from more than two requests', async () => {
			const session = singleRequestSession( {
				meta: 'siteinfo|userinfo|tokens',
				siprop: 'general|statistics',
				uiprop: 'editcount',
				type: 'csrf|patrol|rollback',
			} );
			const promise1 = session.request( {
				meta: set( 'siteinfo' ),
				siprop: set( 'general' ),
			} );
			const promise2 = session.request( {
				meta: set( 'siteinfo' ),
				siprop: set( 'statistics' ),
			} );
			const promise3 = session.request( {
				meta: set( 'userinfo' ),
			} );
			const promise4 = session.request( {
				meta: set( 'userinfo' ),
				uiprop: set( 'editcount' ),
			} );
			const promise5 = session.request( {
				meta: set( 'tokens' ),
				type: set( 'csrf' ),
			} );
			const promise6 = session.request( {
				meta: set( 'tokens' ),
				type: set( 'patrol' ),
			} );
			const promise7 = session.request( {
				meta: set( 'tokens' ),
				type: set( 'rollback' ),
			} );
			const [
				response1,
				response2,
				response3,
				response4,
				response5,
				response6,
				response7,
			] = await Promise.all( [
				promise1,
				promise2,
				promise3,
				promise4,
				promise5,
				promise6,
				promise7,
			] );
			expect( response1 ).to.equal( response );
			expect( response2 ).to.equal( response );
			expect( response3 ).to.equal( response );
			expect( response4 ).to.equal( response );
			expect( response5 ).to.equal( response );
			expect( response6 ).to.equal( response );
			expect( response7 ).to.equal( response );
		} );

		it( 'requestAndContinue + requestAndContinue', async () => {
			const session = singleRequestSession( {
				list: 'allpages|allrevisions',
			} );
			const promise1 = session.requestAndContinue( { list: set( 'allpages' ) } ).next();
			const promise2 = session.requestAndContinue( { list: set( 'allrevisions' ) } ).next();
			const [
				{ value: response1 },
				{ value: response2 },
			] = await Promise.all( [ promise1, promise2 ] );
			expect( response1 ).to.equal( response );
			expect( response2 ).to.equal( response );
		} );

		it( 'requestAndContinue + request', async () => {
			const session = singleRequestSession( {
				meta: 'siteinfo',
				list: 'allpages',
			} );
			const promise1 = session.requestAndContinue( { meta: set( 'siteinfo' ) } ).next();
			const promise2 = session.request( { list: set( 'allpages' ) } );
			const [
				{ value: response1 },
				response2,
			] = await Promise.all( [ promise1, promise2 ] );
			expect( response1 ).to.equal( response );
			expect( response2 ).to.equal( response );
		} );

		it( 'same options', async () => {
			const session = singleRequestSession( {}, response, 'POST' );
			const promise1 = session.request( {}, {
				method: 'POST',
				maxRetries: 10,
			} );
			const promise2 = session.request( {}, {
				method: 'POST',
				maxRetries: 10,
			} );
			const [ response1, response2 ] = await Promise.all( [ promise1, promise2 ] );
			expect( response1 ).to.equal( response );
			expect( response2 ).to.equal( response );
		} );

		it( 'explicit default options', async () => {
			const session = singleRequestSession( {} );
			const promise1 = session.request( {}, {
				method: 'GET',
			} );
			const promise2 = session.request( {}, {
				maxRetries: 1,
			} );
			const [ response1, response2 ] = await Promise.all( [ promise1, promise2 ] );
			expect( response1 ).to.equal( response );
			expect( response2 ).to.equal( response );
		} );

	} );

	it( 'propagates errors', async () => {
		const error = new Error();
		class TestSession extends BaseTestSession {
			async internalGet() {
				throw error;
			}
		}
		mixCombiningSessionInto( TestSession );

		const session = new TestSession( 'en.wikipedia.org' );
		await expect( session.request() )
			.to.be.rejectedWith( error );
	} );

	describe( 'propagates warnings', () => {

		it( 'to per-request handlers', async () => {
			const params = { rvprop: 'content' };
			const response = {
				warnings: {
					main: { warnings: 'Subscribe to…' },
					revisions: { warnings: 'Because…' },
				},
			};
			let called1 = false;
			let warnings;
			function warn1( warnings_ ) {
				expect( called1, 'warn1 already called' ).to.be.false;
				called1 = true;
				expect( warnings_.warnings[ 0 ].module ).to.equal( 'revisions' );
				warnings = warnings_;
			}
			let called2 = false;
			function warn2( warnings_ ) {
				expect( called2, 'warn2 already called' ).to.be.false;
				called2 = true;
				expect( warnings_ ).to.equal( warnings );
			}
			let called3 = false;
			function warn3( warnings_ ) {
				expect( called3, 'warn3 already called' ).to.be.false;
				called3 = true;
				expect( warnings_ ).to.equal( warnings );
			}
			const session = singleRequestSession( params, response );
			const promise1 = session.request( params, { warn: warn1 } );
			const promise2 = session.request( params, { warn: warn2 } );
			const promise3 = session.request( params, { warn: warn3 } );
			const [
				response1,
				response2,
				response3,
			] = await Promise.all( [
				promise1,
				promise2,
				promise3,
			] );
			expect( response1 ).to.equal( response );
			expect( response2 ).to.equal( response );
			expect( response3 ).to.equal( response );
			expect( called1 ).to.be.true;
			expect( called2 ).to.be.true;
			expect( called3 ).to.be.true;
		} );

		it( 'to session default handler', async () => {
			const session = singleRequestSession( {}, {
				warnings: {
					main: { warnings: 'Subscribe to…' },
					revisions: { warnings: 'Because…' },
				},
			} );
			let call = 0;
			session.defaultOptions.warn = function ( warnings ) {
				++call;
				expect( warnings ).to.be.instanceof( ApiWarnings );
				expect( warnings.warnings ).to.have.lengthOf( 2 );
			};
			await Promise.all( [ session.request( {} ), session.request( {} ) ] );
			expect( call ).to.equal( 2 );
		} );

	} );

	/**
	 * Create a CombiningSession that expects a series of requests.
	 *
	 * @param {Object[]} expectedCalls The expected calls.
	 * Each call is an object with expectedParams, response, and/or method;
	 * response defaults to an empty object,
	 * not the outer `response` as in {@link singleRequestSession}.
	 * @return {Session}
	 */
	function sequentialRequestSession( expectedCalls ) {
		const session = sequentialRequestCoreSession( expectedCalls );
		mixCombiningSessionInto( Object.getPrototypeOf( session ).constructor );
		return session;
	}

	describe( 'supports sequential requests', () => {

		it( 'identical', async () => {
			const expectedParams = {
				formatversion: '2',
			};
			const session = sequentialRequestSession( [
				{ expectedParams, response },
				{ expectedParams, response },
			] );
			expect( await session.request( { formatversion: 2 } ) ).to.equal( response );
			expect( await session.request( { formatversion: 2 } ) ).to.equal( response );
		} );

		it( 'incompatible', async () => {
			const params1 = { action: 'foo' };
			const response1 = { foo: 'FOO' };
			const params2 = { action: 'bar' };
			const response2 = { bar: 'BAR' };
			const session = sequentialRequestSession( [
				{ expectedParams: params1, response: response1 },
				{ expectedParams: params2, response: response2 },
			] );
			expect( await session.request( params1 ) ).to.equal( response1 );
			expect( await session.request( params2 ) ).to.equal( response2 );
		} );

	} );

	describe( 'does not combine concurrent incompatible requests', () => {

		it( 'different strings', async () => {
			const params1 = { action: 'foo' };
			const response1 = { foo: 'FOO' };
			const params2 = { action: 'bar' };
			const response2 = { bar: 'BAR' };
			const session = sequentialRequestSession( [
				{ expectedParams: params1, response: response1 },
				{ expectedParams: params2, response: response2 },
			] );
			const promise1 = session.request( params1 );
			const promise2 = session.request( params2 );
			const responses = await Promise.all( [ promise1, promise2 ] );
			expect( responses[ 0 ] ).to.equal( response1 );
			expect( responses[ 1 ] ).to.equal( response2 );
		} );

		it( 'string + set', async () => {
			const params1 = { action: 'foo' };
			const response1 = { foo: 'FOO' };
			const params2 = { action: set( 'foo' ) };
			const response2 = { foo: 'FOO' };
			const expectedParams = params1; // same for both
			const session = sequentialRequestSession( [
				{ expectedParams, response: response1 },
				{ expectedParams, response: response2 },
			] );
			const promise1 = session.request( params1 );
			const promise2 = session.request( params2 );
			const responses = await Promise.all( [ promise1, promise2 ] );
			expect( responses[ 0 ] ).to.equal( response1 );
			expect( responses[ 1 ] ).to.equal( response2 );
		} );

		it( 'string + array', async () => {
			const params1 = { action: 'foo' };
			const response1 = { foo: 'FOO' };
			const params2 = { action: [ 'foo' ] };
			const response2 = { foo: 'FOO' };
			const expectedParams = params1; // same for both
			const session = sequentialRequestSession( [
				{ expectedParams, response: response1 },
				{ expectedParams, response: response2 },
			] );
			const promise1 = session.request( params1 );
			const promise2 = session.request( params2 );
			const responses = await Promise.all( [ promise1, promise2 ] );
			expect( responses[ 0 ] ).to.equal( response1 );
			expect( responses[ 1 ] ).to.equal( response2 );
		} );

		it( 'array + set', async () => {
			const params1 = { action: [ 'foo' ] };
			const response1 = { foo: 'FOO' };
			const params2 = { action: set( 'foo' ) };
			const response2 = { foo: 'FOO' };
			const expectedParams = { action: 'foo' }; // same for both
			const session = sequentialRequestSession( [
				{ expectedParams, response: response1 },
				{ expectedParams, response: response2 },
			] );
			const promise1 = session.request( params1 );
			const promise2 = session.request( params2 );
			const responses = await Promise.all( [ promise1, promise2 ] );
			expect( responses[ 0 ] ).to.equal( response1 );
			expect( responses[ 1 ] ).to.equal( response2 );
		} );

		it( 'array + array', async () => {
			const params1 = { action: [ 'foo' ] };
			const response1 = { foo: 'FOO' };
			const params2 = { action: [ 'foo' ] };
			const response2 = { foo: 'FOO' };
			const expectedParams = { action: 'foo' }; // same for both
			const session = sequentialRequestSession( [
				{ expectedParams, response: response1 },
				{ expectedParams, response: response2 },
			] );
			const promise1 = session.request( params1 );
			const promise2 = session.request( params2 );
			const responses = await Promise.all( [ promise1, promise2 ] );
			expect( responses[ 0 ] ).to.equal( response1 );
			expect( responses[ 1 ] ).to.equal( response2 );
		} );

		it( 'true + false', async () => {
			const params1 = { redirects: true };
			const response1 = { redirect: true };
			const params2 = { redirects: false };
			const response2 = { redirect: false };
			const session = sequentialRequestSession( [
				{ expectedParams: { redirects: '' }, response: response1 },
				{ expectedParams: {}, response: response2 },
			] );
			const promise1 = session.request( params1 );
			const promise2 = session.request( params2 );
			const responses = await Promise.all( [ promise1, promise2 ] );
			expect( responses[ 0 ] ).to.equal( response1 );
			expect( responses[ 1 ] ).to.equal( response2 );
		} );

		it( 'string + undefined', async () => {
			const params1 = { siprop: 'statistics' };
			const response1 = { statistics: 1 };
			const params2 = { siprop: undefined };
			const response2 = { statistics: 0 };
			const session = sequentialRequestSession( [
				{ expectedParams: params1, response: response1 },
				{ expectedParams: {}, response: response2 },
			] );
			const promise1 = session.request( params1 );
			const promise2 = session.request( params2 );
			const responses = await Promise.all( [ promise1, promise2 ] );
			expect( responses[ 0 ] ).to.equal( response1 );
			expect( responses[ 1 ] ).to.equal( response2 );
		} );

		it( 'set + null', async () => {
			const params1 = { siprop: set( 'statistics' ) };
			const response1 = { statistics: 1 };
			const params2 = { siprop: undefined };
			const response2 = { statistics: 0 };
			const session = sequentialRequestSession( [
				{ expectedParams: { siprop: 'statistics' }, response: response1 },
				{ expectedParams: {}, response: response2 },
			] );
			const promise1 = session.request( params1 );
			const promise2 = session.request( params2 );
			const responses = await Promise.all( [ promise1, promise2 ] );
			expect( responses[ 0 ] ).to.equal( response1 );
			expect( responses[ 1 ] ).to.equal( response2 );
		} );

		for ( const first of [ 'generator', 'continue' ] ) {
			for ( const second of [ 'titles', 'pageids', 'revids' ] ) {
				it( `${first} + ${second}`, async () => {
					const params1 = { [ first ]: '' };
					const response1 = { kind: 'first' };
					const params2 = { [ second ]: '' };
					const response2 = { kind: 'second' };
					const session = sequentialRequestSession( [
						{ expectedParams: params1, response: response1 },
						{ expectedParams: params2, response: response2 },
					] );
					const promise1 = session.request( params1 );
					const promise2 = session.request( params2 );
					const responses = await Promise.all( [ promise1, promise2 ] );
					expect( responses[ 0 ] ).to.equal( response1 );
					expect( responses[ 1 ] ).to.equal( response2 );
				} );
			}
		}

		for ( const first of [ 'titles', 'pageids', 'revids' ] ) {
			for ( const second of [ 'generator', 'continue' ] ) {
				it( `${first} + ${second}`, async () => {
					const params1 = { [ first ]: '' };
					const response1 = { kind: 'first' };
					const params2 = { [ second ]: '' };
					const response2 = { kind: 'second' };
					const session = sequentialRequestSession( [
						{ expectedParams: params1, response: response1 },
						{ expectedParams: params2, response: response2 },
					] );
					const promise1 = session.request( params1 );
					const promise2 = session.request( params2 );
					const responses = await Promise.all( [ promise1, promise2 ] );
					expect( responses[ 0 ] ).to.equal( response1 );
					expect( responses[ 1 ] ).to.equal( response2 );
				} );
			}
		}

		it( 'requestAndContinue + request with manual continue', async () => {
			const params1 = {};
			const response1 = { batchcomplete: true };
			const params2 = { continue: '' };
			const response2 = { batchcomplete: false };
			const session = sequentialRequestSession( [
				{ expectedParams: params1, response: response1 },
				{ expectedParams: params2, response: response2 },
			] );
			const promise1 = session.requestAndContinue( params1 ).next();
			const promise2 = session.request( params2 );
			const responses = await Promise.all( [ promise1, promise2 ] );
			expect( responses[ 0 ].value ).to.equal( response1 );
			expect( responses[ 1 ] ).to.equal( response2 );
		} );

		describe( 'incompatible options', () => {

			it( 'different method', async () => {
				const params = { action: 'foo' };
				const response = { foo: 'foo' };
				const session = sequentialRequestSession( [
					{ expectedParams: params, response, method: 'GET' },
					{ expectedParams: params, response, method: 'POST' },
				] );
				const promise1 = session.request( params, { method: 'GET' } );
				const promise2 = session.request( params, { method: 'POST' } );
				const responses = await Promise.all( [ promise1, promise2 ] );
				expect( responses[ 0 ] ).to.equal( response );
				expect( responses[ 1 ] ).to.equal( response );
			} );

			for ( const [ optionName, optionA, optionB ] of [
				[ 'maxRetries', 0, 1 ],
				[ 'userAgent', 'foo', 'bar' ],
				[ 'different-package/unknownOption', 'x', 'y' ],
				[
					'callableOption',
					function x() {},
					function y() {},
				],
			] ) {
				it( `different ${optionName}`, async () => {
					const params = { action: 'foo' };
					const response = { foo: 'foo' };
					const session = sequentialRequestSession( [
						{ expectedParams: params, response },
						{ expectedParams: params, response },
					] );
					const promise1 = session.request( params, { [ optionName ]: optionA } );
					const promise2 = session.request( params, { [ optionName ]: optionB } );
					const responses = await Promise.all( [ promise1, promise2 ] );
					expect( responses[ 0 ] ).to.equal( response );
					expect( responses[ 1 ] ).to.equal( response );
				} );
			}

			it( 'explicit non-default option in first request', async () => {
				const params = { action: 'foo' };
				const response = { foo: 'foo' };
				const session = sequentialRequestSession( [
					{ expectedParams: params, response },
					{ expectedParams: params, response },
				] );
				const promise1 = session.request( params, { maxRetries: 0 } );
				const promise2 = session.request( params );
				const responses = await Promise.all( [ promise1, promise2 ] );
				expect( responses[ 0 ] ).to.equal( response );
				expect( responses[ 1 ] ).to.equal( response );
			} );

			it( 'explicit non-default option in second request', async () => {
				const params = { action: 'foo' };
				const response = { foo: 'foo' };
				const session = sequentialRequestSession( [
					{ expectedParams: params, response },
					{ expectedParams: params, response },
				] );
				const promise1 = session.request( params );
				const promise2 = session.request( params, { maxRetries: 0 } );
				const responses = await Promise.all( [ promise1, promise2 ] );
				expect( responses[ 0 ] ).to.equal( response );
				expect( responses[ 1 ] ).to.equal( response );
			} );

		} );

	} );

} );
