/* eslint-env mocha */

import { mixCombiningSessionInto } from '../../combine.js';
import { ApiWarnings, Session, set } from '../../core.js';
import { BaseTestSession, successfulResponse } from './core.test.js';
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
chai.use( chaiAsPromised );

describe( 'CombiningSession', () => {

	const response = successfulResponse( { response: true } );

	/**
	 * Create a CombiningSession that expects a single internal GET.
	 *
	 * @param {Object} expectedParams The expected parameters of the call.
	 * For convenience, format='json' is added automatically.
	 * @param {Object} [response_] The response object, default to `response`.
	 * @return {Session}
	 */
	function singleGetSession( expectedParams, response_ = response ) {
		expectedParams.format = 'json';
		let called = false;
		class TestSession extends BaseTestSession {
			async internalGet( params ) {
				expect( called, 'internalGet already called' ).to.be.false;
				called = true;
				expect( params ).to.eql( expectedParams );
				return response_;
			}
		}
		mixCombiningSessionInto( TestSession );

		return new TestSession( 'en.wikipedia.org' );
	}

	describe( 'combines compatible requests', () => {

		it( 'empty + nonempty', async () => {
			const session = singleGetSession( {
				formatversion: '2',
			} );
			const promise1 = session.request( {} );
			const promise2 = session.request( { formatversion: 2 } );
			const [ response1, response2 ] = await Promise.all( [ promise1, promise2 ] );
			expect( response1 ).to.equal( response.body );
			expect( response2 ).to.equal( response.body );
		} );

		it( 'nonempty + empty', async () => {
			const session = singleGetSession( {
				formatversion: '2',
			} );
			const promise1 = session.request( { formatversion: 2 } );
			const promise2 = session.request( {} );
			const [ response1, response2 ] = await Promise.all( [ promise1, promise2 ] );
			expect( response1 ).to.equal( response.body );
			expect( response2 ).to.equal( response.body );
		} );

		it( 'identical parameters', async () => {
			const session = singleGetSession( {
				formatversion: '2',
				errorformat: 'raw',
			} );
			const promise1 = session.request( { formatversion: 2, errorformat: 'raw' } );
			const promise2 = session.request( { formatversion: 2, errorformat: 'raw' } );
			const [ response1, response2 ] = await Promise.all( [ promise1, promise2 ] );
			expect( response1 ).to.equal( response.body );
			expect( response2 ).to.equal( response.body );
		} );

		it( 'identical but swapped parameters', async () => {
			const session = singleGetSession( {
				formatversion: '2',
				errorformat: 'raw',
			} );
			const promise1 = session.request( { formatversion: 2, errorformat: 'raw' } );
			const promise2 = session.request( { errorformat: 'raw', formatversion: 2 } );
			const [ response1, response2 ] = await Promise.all( [ promise1, promise2 ] );
			expect( response1 ).to.equal( response.body );
			expect( response2 ).to.equal( response.body );
		} );

		it( 'disjoint parameters', async () => {
			const session = singleGetSession( {
				formatversion: '2',
				errorformat: 'raw',
			} );
			const promise1 = session.request( { formatversion: 2 } );
			const promise2 = session.request( { errorformat: 'raw' } );
			const [ response1, response2 ] = await Promise.all( [ promise1, promise2 ] );
			expect( response1 ).to.equal( response.body );
			expect( response2 ).to.equal( response.body );
		} );

		it( 'differently typed scalar parameters', async () => {
			const session = singleGetSession( {
				two: '2',
				yes: '',
			} );
			const promise1 = session.request( { two: 2, yes: true, no: false } );
			const promise2 = session.request( { two: '2', yes: '', no: null } );
			const [ response1, response2 ] = await Promise.all( [ promise1, promise2 ] );
			expect( response1 ).to.equal( response.body );
			expect( response2 ).to.equal( response.body );
		} );

		it( 'set parameters', async () => {
			const session = singleGetSession( {
				meta: 'siteinfo|userinfo',
			} );
			const promise1 = session.request( { meta: set( 'siteinfo' ) } );
			const promise2 = session.request( { meta: set( 'userinfo' ) } );
			const [ response1, response2 ] = await Promise.all( [ promise1, promise2 ] );
			expect( response1 ).to.equal( response.body );
			expect( response2 ).to.equal( response.body );
		} );

		it( 'set + nonempty set', async () => {
			const session = singleGetSession( {
				meta: 'siteinfo',
			} );
			const promise1 = session.request( { meta: set() } );
			const promise2 = session.request( { meta: set( 'siteinfo' ) } );
			const [ response1, response2 ] = await Promise.all( [ promise1, promise2 ] );
			expect( response1 ).to.equal( response.body );
			expect( response2 ).to.equal( response.body );
		} );

		it( 'nonempty set + empty set', async () => {
			const session = singleGetSession( {
				meta: 'siteinfo',
			} );
			const promise1 = session.request( { meta: set( 'siteinfo' ) } );
			const promise2 = session.request( { meta: set() } );
			const [ response1, response2 ] = await Promise.all( [ promise1, promise2 ] );
			expect( response1 ).to.equal( response.body );
			expect( response2 ).to.equal( response.body );
		} );

		it( 'longer sets', async () => {
			const session = singleGetSession( {
				alpha: 'a|b|c|d|e|f|g|h',
			} );
			const promise1 = session.request( { alpha: set( 'a', 'b', 'c', 'd', 'e' ) } );
			const promise2 = session.request( { alpha: set( 'd', 'e', 'f', 'g', 'h' ) } );
			const [ response1, response2 ] = await Promise.all( [ promise1, promise2 ] );
			expect( response1 ).to.equal( response.body );
			expect( response2 ).to.equal( response.body );
		} );

		it( 'sets with differently typed scalars', async () => {
			const session = singleGetSession( {
				two: '2',
			} );
			const promise1 = session.request( { two: set( 2 ) } );
			const promise2 = session.request( { two: set( '2' ) } );
			const [ response1, response2 ] = await Promise.all( [ promise1, promise2 ] );
			expect( response1 ).to.equal( response.body );
			expect( response2 ).to.equal( response.body );
		} );

		it( 'sets from more than two requests', async () => {
			const session = singleGetSession( {
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
			expect( response1 ).to.equal( response.body );
			expect( response2 ).to.equal( response.body );
			expect( response3 ).to.equal( response.body );
			expect( response4 ).to.equal( response.body );
			expect( response5 ).to.equal( response.body );
			expect( response6 ).to.equal( response.body );
			expect( response7 ).to.equal( response.body );
		} );

		it( 'requestAndContinue + requestAndContinue', async () => {
			const session = singleGetSession( {
				list: 'allpages|allrevisions',
			} );
			const promise1 = session.requestAndContinue( { list: set( 'allpages' ) } ).next();
			const promise2 = session.requestAndContinue( { list: set( 'allrevisions' ) } ).next();
			const [
				{ value: response1 },
				{ value: response2 },
			] = await Promise.all( [ promise1, promise2 ] );
			expect( response1 ).to.equal( response.body );
			expect( response2 ).to.equal( response.body );
		} );

		it( 'requestAndContinue + request', async () => {
			const session = singleGetSession( {
				meta: 'siteinfo',
				list: 'allpages',
			} );
			const promise1 = session.requestAndContinue( { meta: set( 'siteinfo' ) } ).next();
			const promise2 = session.request( { list: set( 'allpages' ) } );
			const [
				{ value: response1 },
				response2,
			] = await Promise.all( [ promise1, promise2 ] );
			expect( response1 ).to.equal( response.body );
			expect( response2 ).to.equal( response.body );
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
			const response = successfulResponse( {
				warnings: {
					main: { warnings: 'Subscribe to???' },
					revisions: { warnings: 'Because???' },
				},
			} );
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
			const session = singleGetSession( params, response );
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
			expect( response1 ).to.equal( response.body );
			expect( response2 ).to.equal( response.body );
			expect( response3 ).to.equal( response.body );
			expect( called1 ).to.be.true;
			expect( called2 ).to.be.true;
			expect( called3 ).to.be.true;
		} );

		it( 'to session default handler', async () => {
			const session = singleGetSession( {}, successfulResponse( {
				warnings: {
					main: { warnings: 'Subscribe to???' },
					revisions: { warnings: 'Because???' },
				},
			} ) );
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
	 * Create a CombiningSession that expects a series of GETs.
	 *
	 * @param {Object[]} expectedCalls The expected calls.
	 * Each call is an object with expectedParams and response.
	 * format='json' is added to the expectedParams automatically.
	 * @return {Session}
	 */
	function sequentialGetSession( expectedCalls ) {
		expectedCalls.reverse();
		class TestSession extends BaseTestSession {
			async internalGet( params ) {
				expect( expectedCalls ).to.not.be.empty;
				const [ { expectedParams, response } ] = expectedCalls.splice( -1 );
				expectedParams.format = 'json';
				expect( params ).to.eql( expectedParams );
				return response;
			}
		}
		mixCombiningSessionInto( TestSession );

		return new TestSession( 'en.wikipedia.org' );
	}

	describe( 'supports sequential requests', () => {

		it( 'identical', async () => {
			const expectedParams = {
				formatversion: '2',
			};
			const session = sequentialGetSession( [
				{ expectedParams, response },
				{ expectedParams, response },
			] );
			expect( await session.request( { formatversion: 2 } ) ).to.equal( response.body );
			expect( await session.request( { formatversion: 2 } ) ).to.equal( response.body );
		} );

		it( 'incompatible', async () => {
			const params1 = { action: 'foo' };
			const response1 = successfulResponse( { foo: 'FOO' } );
			const params2 = { action: 'bar' };
			const response2 = successfulResponse( { bar: 'BAR' } );
			const session = sequentialGetSession( [
				{ expectedParams: params1, response: response1 },
				{ expectedParams: params2, response: response2 },
			] );
			expect( await session.request( params1 ) ).to.equal( response1.body );
			expect( await session.request( params2 ) ).to.equal( response2.body );
		} );

	} );

	describe( 'does not combine concurrent incompatible requests', () => {

		it( 'different strings', async () => {
			const params1 = { action: 'foo' };
			const response1 = successfulResponse( { foo: 'FOO' } );
			const params2 = { action: 'bar' };
			const response2 = successfulResponse( { bar: 'BAR' } );
			const session = sequentialGetSession( [
				{ expectedParams: params1, response: response1 },
				{ expectedParams: params2, response: response2 },
			] );
			const promise1 = session.request( params1 );
			const promise2 = session.request( params2 );
			const responses = await Promise.all( [ promise1, promise2 ] );
			expect( responses[ 0 ] ).to.equal( response1.body );
			expect( responses[ 1 ] ).to.equal( response2.body );
		} );

		it( 'string + set', async () => {
			const params1 = { action: 'foo' };
			const response1 = successfulResponse( { foo: 'FOO' } );
			const params2 = { action: set( 'foo' ) };
			const response2 = successfulResponse( { foo: 'FOO' } );
			const expectedParams = params1; // same for both
			const session = sequentialGetSession( [
				{ expectedParams, response: response1 },
				{ expectedParams, response: response2 },
			] );
			const promise1 = session.request( params1 );
			const promise2 = session.request( params2 );
			const responses = await Promise.all( [ promise1, promise2 ] );
			expect( responses[ 0 ] ).to.equal( response1.body );
			expect( responses[ 1 ] ).to.equal( response2.body );
		} );

		it( 'string + array', async () => {
			const params1 = { action: 'foo' };
			const response1 = successfulResponse( { foo: 'FOO' } );
			const params2 = { action: [ 'foo' ] };
			const response2 = successfulResponse( { foo: 'FOO' } );
			const expectedParams = params1; // same for both
			const session = sequentialGetSession( [
				{ expectedParams, response: response1 },
				{ expectedParams, response: response2 },
			] );
			const promise1 = session.request( params1 );
			const promise2 = session.request( params2 );
			const responses = await Promise.all( [ promise1, promise2 ] );
			expect( responses[ 0 ] ).to.equal( response1.body );
			expect( responses[ 1 ] ).to.equal( response2.body );
		} );

		it( 'array + set', async () => {
			const params1 = { action: [ 'foo' ] };
			const response1 = successfulResponse( { foo: 'FOO' } );
			const params2 = { action: set( 'foo' ) };
			const response2 = successfulResponse( { foo: 'FOO' } );
			const expectedParams = { action: 'foo' }; // same for both
			const session = sequentialGetSession( [
				{ expectedParams, response: response1 },
				{ expectedParams, response: response2 },
			] );
			const promise1 = session.request( params1 );
			const promise2 = session.request( params2 );
			const responses = await Promise.all( [ promise1, promise2 ] );
			expect( responses[ 0 ] ).to.equal( response1.body );
			expect( responses[ 1 ] ).to.equal( response2.body );
		} );

		it( 'array + array', async () => {
			const params1 = { action: [ 'foo' ] };
			const response1 = successfulResponse( { foo: 'FOO' } );
			const params2 = { action: [ 'foo' ] };
			const response2 = successfulResponse( { foo: 'FOO' } );
			const expectedParams = { action: 'foo' }; // same for both
			const session = sequentialGetSession( [
				{ expectedParams, response: response1 },
				{ expectedParams, response: response2 },
			] );
			const promise1 = session.request( params1 );
			const promise2 = session.request( params2 );
			const responses = await Promise.all( [ promise1, promise2 ] );
			expect( responses[ 0 ] ).to.equal( response1.body );
			expect( responses[ 1 ] ).to.equal( response2.body );
		} );

		it( 'true + false', async () => {
			const params1 = { redirects: true };
			const response1 = successfulResponse( { redirect: true } );
			const params2 = { redirects: false };
			const response2 = successfulResponse( { redirect: false } );
			const session = sequentialGetSession( [
				{ expectedParams: { redirects: '' }, response: response1 },
				{ expectedParams: {}, response: response2 },
			] );
			const promise1 = session.request( params1 );
			const promise2 = session.request( params2 );
			const responses = await Promise.all( [ promise1, promise2 ] );
			expect( responses[ 0 ] ).to.equal( response1.body );
			expect( responses[ 1 ] ).to.equal( response2.body );
		} );

		it( 'string + undefined', async () => {
			const params1 = { siprop: 'statistics' };
			const response1 = successfulResponse( { statistics: 1 } );
			const params2 = { siprop: undefined };
			const response2 = successfulResponse( { statistics: 0 } );
			const session = sequentialGetSession( [
				{ expectedParams: params1, response: response1 },
				{ expectedParams: {}, response: response2 },
			] );
			const promise1 = session.request( params1 );
			const promise2 = session.request( params2 );
			const responses = await Promise.all( [ promise1, promise2 ] );
			expect( responses[ 0 ] ).to.equal( response1.body );
			expect( responses[ 1 ] ).to.equal( response2.body );
		} );

		it( 'set + null', async () => {
			const params1 = { siprop: set( 'statistics' ) };
			const response1 = successfulResponse( { statistics: 1 } );
			const params2 = { siprop: undefined };
			const response2 = successfulResponse( { statistics: 0 } );
			const session = sequentialGetSession( [
				{ expectedParams: { siprop: 'statistics' }, response: response1 },
				{ expectedParams: {}, response: response2 },
			] );
			const promise1 = session.request( params1 );
			const promise2 = session.request( params2 );
			const responses = await Promise.all( [ promise1, promise2 ] );
			expect( responses[ 0 ] ).to.equal( response1.body );
			expect( responses[ 1 ] ).to.equal( response2.body );
		} );

		for ( const first of [ 'generator', 'continue' ] ) {
			for ( const second of [ 'titles', 'pageids', 'revids' ] ) {
				it( `${first} + ${second}`, async () => {
					const params1 = { [ first ]: '' };
					const response1 = successfulResponse( { kind: 'first' } );
					const params2 = { [ second ]: '' };
					const response2 = successfulResponse( { kind: 'second' } );
					const session = sequentialGetSession( [
						{ expectedParams: params1, response: response1 },
						{ expectedParams: params2, response: response2 },
					] );
					const promise1 = session.request( params1 );
					const promise2 = session.request( params2 );
					const responses = await Promise.all( [ promise1, promise2 ] );
					expect( responses[ 0 ] ).to.equal( response1.body );
					expect( responses[ 1 ] ).to.equal( response2.body );
				} );
			}
		}

		for ( const first of [ 'titles', 'pageids', 'revids' ] ) {
			for ( const second of [ 'generator', 'continue' ] ) {
				it( `${first} + ${second}`, async () => {
					const params1 = { [ first ]: '' };
					const response1 = successfulResponse( { kind: 'first' } );
					const params2 = { [ second ]: '' };
					const response2 = successfulResponse( { kind: 'second' } );
					const session = sequentialGetSession( [
						{ expectedParams: params1, response: response1 },
						{ expectedParams: params2, response: response2 },
					] );
					const promise1 = session.request( params1 );
					const promise2 = session.request( params2 );
					const responses = await Promise.all( [ promise1, promise2 ] );
					expect( responses[ 0 ] ).to.equal( response1.body );
					expect( responses[ 1 ] ).to.equal( response2.body );
				} );
			}
		}

		it( 'requestAndContinue + request with manual continue', async () => {
			const params1 = {};
			const response1 = successfulResponse( { batchcomplete: true } );
			const params2 = { continue: '' };
			const response2 = successfulResponse( { batchcomplete: false } );
			const session = sequentialGetSession( [
				{ expectedParams: params1, response: response1 },
				{ expectedParams: params2, response: response2 },
			] );
			const promise1 = session.requestAndContinue( params1 ).next();
			const promise2 = session.request( params2 );
			const responses = await Promise.all( [ promise1, promise2 ] );
			expect( responses[ 0 ].value ).to.equal( response1.body );
			expect( responses[ 1 ] ).to.equal( response2.body );
		} );

		describe( 'different options', () => {
			for ( const [ optionName, optionA, optionB ] of [
				[ 'method', 'GET', 'POST' ],
				[ 'maxRetries', 0, 1 ],
				[ 'userAgent', 'foo', 'bar' ],
			] ) {
				it( optionName, async () => {
					const params = { action: 'foo' };
					const response = successfulResponse( { foo: 'foo' } );
					const session = sequentialGetSession( [
						{ expectedParams: params, response },
						{ expectedParams: params, response },
					] );
					session.internalPost = ( _, params ) => session.internalGet( params );
					const promise1 = session.request( params, { [ optionName ]: optionA } );
					const promise2 = session.request( params, { [ optionName ]: optionB } );
					const responses = await Promise.all( [ promise1, promise2 ] );
					expect( responses[ 0 ] ).to.equal( response.body );
					expect( responses[ 1 ] ).to.equal( response.body );
				} );
			}
		} );

	} );

} );
