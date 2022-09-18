import { Session } from '../../core.js';
import '../../add-performance-global.js';
import { expect } from 'chai';

/**
 * Base class for all Sessions in unit tests.
 */
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

/**
 * Make a successful response from this body,
 * to be returned from {@link Session#internalGet} or {@link Session#internalPost}.
 *
 * @param {Object} body
 * @return {Object}
 */
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
 * Create a Session that expects a single internal request.
 *
 * @param {Object} [expectedParams] The expected parameters of the call.
 * For convenience, format='json' is added automatically.
 * @param {Object} [response] A response object or just its body, see {@link makeResponse}.
 * @param {string} [method] The expected method, 'GET' or 'POST'.
 * @return {Session}
 */
export function singleRequestSession( expectedParams = {}, response = {}, method = 'GET' ) {
	expectedParams.format = 'json';
	let called = false;
	class TestSession extends BaseTestSession {
		async internalGet( params ) {
			expect( 'GET', `${method} request expected` ).to.equal( method );
			expect( called, 'internalGet already called' ).to.be.false;
			called = true;
			expect( params ).to.eql( expectedParams );
			return makeResponse( response );
		}
		async internalPost( urlParams, bodyParams ) {
			expect( 'POST', `${method} request expected` ).to.equal( method );
			expect( called, 'internalPost already called' ).to.be.false;
			called = true;
			expect( bodyParams ).to.eql( expectedParams );
			return makeResponse( response );
		}
	}

	return new TestSession( 'en.wikipedia.org' );
}

/**
 * Create a Session that expects a series of requests.
 *
 * @param {Object[]} expectedCalls The expected calls.
 * Each call is an object with expectedParams, response, and method;
 * each is optional and has the same meaning and default as in {@link singleRequestSession}.
 * @return {Session}
 */
export function sequentialRequestSession( expectedCalls ) {
	expectedCalls.reverse();
	class TestSession extends BaseTestSession {
		async internalGet( params ) {
			expect( expectedCalls ).to.not.be.empty;
			const [ {
				expectedParams = {},
				response = {},
				method = 'GET',
			} ] = expectedCalls.splice( -1 );
			expect( 'GET', `${method} request expected` ).to.equal( method );
			expectedParams.format = 'json';
			expect( params ).to.eql( expectedParams );
			return makeResponse( response );
		}
		async internalPost( urlParams, bodyParams ) {
			expect( expectedCalls ).to.not.be.empty;
			const [ {
				expectedParams = {},
				response = {},
				method = 'GET',
			} ] = expectedCalls.splice( -1 );
			expect( 'POST', `${method} request expected` ).to.equal( method );
			expectedParams.format = 'json';
			expect( bodyParams ).to.eql( expectedParams );
			return makeResponse( response );
		}
	}

	return new TestSession( 'en.wikipedia.org' );
}
