/* eslint-env mocha */

import { mixCombiningSessionInto } from '../../combine.js';
import { Session } from '../../core.js';
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
chai.use( chaiAsPromised );

describe( 'CombiningSession', () => {

	function successfulResponse( body ) {
		return {
			status: 200,
			headers: {},
			body,
		};
	}

	const response = successfulResponse( { response: true } );

	/**
	 * Create a CombiningSession that expects a single internal GET.
	 *
	 * @param {Object} expectedParams The expected parameters of the call.
	 * For convenience, format='json' is added automatically.
	 * @return {Session}
	 */
	function singleGetSession( expectedParams ) {
		expectedParams.format = 'json';
		let called = false;
		class TestSession extends Session {
			async internalGet( params ) {
				expect( called, 'internalGet already called' ).to.be.false;
				called = true;
				expect( params ).to.eql( expectedParams );
				return response;
			}
		}
		mixCombiningSessionInto( TestSession );

		return new TestSession( 'https://en.wikipedia.org/w/api.php' );
	}

	it( 'combines empty request with nonempty', async () => {
		const session = singleGetSession( {
			formatversion: '2',
		} );
		const promise1 = session.request( {} );
		const promise2 = session.request( { formatversion: 2 } );
		const [ response1, response2 ] = await Promise.all( [ promise1, promise2 ] );
		expect( response1 ).to.equal( response.body );
		expect( response2 ).to.equal( response.body );
	} );

	it( 'combines nonempty request with empty', async () => {
		const session = singleGetSession( {
			formatversion: '2',
		} );
		const promise1 = session.request( { formatversion: 2 } );
		const promise2 = session.request( {} );
		const [ response1, response2 ] = await Promise.all( [ promise1, promise2 ] );
		expect( response1 ).to.equal( response.body );
		expect( response2 ).to.equal( response.body );
	} );

	it( 'combines two requests with identical parameters', async () => {
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

	it( 'combines two requests with identical but swapped parameters', async () => {
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

	it( 'combines two requests with disjoint parameters', async () => {
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

	it( 'combines two requests with differently typed scalar parameters', async () => {
		const session = singleGetSession( {
			formatversion: '2',
		} );
		const promise1 = session.request( { formatversion: 2 } );
		const promise2 = session.request( { formatversion: '2' } );
		const [ response1, response2 ] = await Promise.all( [ promise1, promise2 ] );
		expect( response1 ).to.equal( response.body );
		expect( response2 ).to.equal( response.body );
	} );

	it( 'combines two requests with set parameters', async () => {
		const session = singleGetSession( {
			meta: 'siteinfo|userinfo',
		} );
		const promise1 = session.request( { meta: new Set( [ 'siteinfo' ] ) } );
		const promise2 = session.request( { meta: new Set( [ 'userinfo' ] ) } );
		const [ response1, response2 ] = await Promise.all( [ promise1, promise2 ] );
		expect( response1 ).to.equal( response.body );
		expect( response2 ).to.equal( response.body );
	} );

	it( 'combines empty set with nonempty set', async () => {
		const session = singleGetSession( {
			meta: 'siteinfo',
		} );
		const promise1 = session.request( { meta: new Set() } );
		const promise2 = session.request( { meta: new Set( [ 'siteinfo' ] ) } );
		const [ response1, response2 ] = await Promise.all( [ promise1, promise2 ] );
		expect( response1 ).to.equal( response.body );
		expect( response2 ).to.equal( response.body );
	} );

	it( 'combines nonempty set with empty set', async () => {
		const session = singleGetSession( {
			meta: 'siteinfo',
		} );
		const promise1 = session.request( { meta: new Set( [ 'siteinfo' ] ) } );
		const promise2 = session.request( { meta: new Set() } );
		const [ response1, response2 ] = await Promise.all( [ promise1, promise2 ] );
		expect( response1 ).to.equal( response.body );
		expect( response2 ).to.equal( response.body );
	} );

	it( 'combines longer sets', async () => {
		const session = singleGetSession( {
			alpha: 'a|b|c|d|e|f|g|h',
		} );
		const promise1 = session.request( { alpha: new Set( [ 'a', 'b', 'c', 'd', 'e' ] ) } );
		const promise2 = session.request( { alpha: new Set( [ 'd', 'e', 'f', 'g', 'h' ] ) } );
		const [ response1, response2 ] = await Promise.all( [ promise1, promise2 ] );
		expect( response1 ).to.equal( response.body );
		expect( response2 ).to.equal( response.body );
	} );

	it( 'combines sets from more than two requests', async () => {
		const session = singleGetSession( {
			meta: 'siteinfo|userinfo|tokens',
			siprop: 'general|statistics',
			uiprop: 'editcount',
			type: 'csrf|patrol|rollback',
		} );
		const promise1 = session.request( {
			meta: new Set( [ 'siteinfo' ] ),
			siprop: new Set( [ 'general' ] ),
		} );
		const promise2 = session.request( {
			meta: new Set( [ 'siteinfo' ] ),
			siprop: new Set( [ 'statistics' ] ),
		} );
		const promise3 = session.request( {
			meta: new Set( [ 'userinfo' ] ),
		} );
		const promise4 = session.request( {
			meta: new Set( [ 'userinfo' ] ),
			uiprop: new Set( [ 'editcount' ] ),
		} );
		const promise5 = session.request( {
			meta: new Set( [ 'tokens' ] ),
			type: new Set( [ 'csrf' ] ),
		} );
		const promise6 = session.request( {
			meta: new Set( [ 'tokens' ] ),
			type: new Set( [ 'patrol' ] ),
		} );
		const promise7 = session.request( {
			meta: new Set( [ 'tokens' ] ),
			type: new Set( [ 'rollback' ] ),
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

	it( 'propagates errors', async () => {
		const error = new Error();
		class TestSession extends Session {
			async internalGet() {
				throw error;
			}
		}
		mixCombiningSessionInto( TestSession );

		const session = new TestSession( 'https://en.wikipedia.org/w/api.php' );
		await expect( session.request() )
			.to.be.rejectedWith( error );
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
		class TestSession extends Session {
			async internalGet( params ) {
				expect( expectedCalls ).to.not.be.empty;
				const [ { expectedParams, response } ] = expectedCalls.splice( -1 );
				expectedParams.format = 'json';
				expect( params ).to.eql( expectedParams );
				return response;
			}
		}
		mixCombiningSessionInto( TestSession );

		return new TestSession( 'https://en.wikipedia.org/w/api.php' );
	}

	it( 'supports sequential identical requests', async () => {
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

	it( 'supports sequential incompatible requests', async () => {
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

	it( 'supports concurrent incompatible requests, different strings', async () => {
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

	it( 'supports concurrent incompatible requests, string and set', async () => {
		const params1 = { action: 'foo' };
		const response1 = successfulResponse( { foo: 'FOO' } );
		const params2 = { action: new Set( [ 'foo' ] ) };
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

	it( 'supports concurrent incompatible requests, string and array', async () => {
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

	it( 'supports concurrent incompatible requests, array and set', async () => {
		const params1 = { action: [ 'foo' ] };
		const response1 = successfulResponse( { foo: 'FOO' } );
		const params2 = { action: new Set( [ 'foo' ] ) };
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

	it( 'supports concurrent incompatible requests, array and array', async () => {
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

} );
