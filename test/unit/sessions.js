import { Session } from '../../core.js';
import { File } from 'buffer'; // only available globally since Node 20
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

	fetch() {
		throw new Error( 'fetch() should not be called in this test' );
	}

}

/**
 * Make a successful response from this body,
 * to be returned from {@link Session#fetch}.
 *
 * @param {Object} body
 * @return {Response}
 */
export function successfulResponse( body ) {
	const response = new Response();
	// return the same body object (rather than constructing Response.json( body ))
	// so that various test can use .equal() instead of .eql() when asserting it
	response.json = async () => body;
	return response;
}

/**
 * Make a response from the given body or response.
 *
 * @param {Response|Object} bodyOrResponse Either a Response,
 * to be returned from {@link Session#fetch},
 * or just a response body, to be turned into a successful response.
 * @return {Object}
 */
export function makeResponse( bodyOrResponse ) {
	if ( bodyOrResponse instanceof Response ) {
		return bodyOrResponse;
	} else {
		return successfulResponse( bodyOrResponse );
	}
}

/**
 * Extract the params from the given fetch() parameters,
 * check them, and return them for further assertions.
 *
 * @param {string} resource
 * @param {RequestInit} fetchOptions
 * @return {Object}
 */
function extractParams( resource, fetchOptions ) {
	expect( resource ).to.be.an.instanceof( URL );

	const urlParams = {};
	for ( const [ key, value ] of resource.searchParams ) {
		urlParams[ key ] = value;
		if ( fetchOptions.method !== 'GET' ) {
			expect( key, 'URL param for non-GET request' ).to.be.oneOf( [
				'action',
				'origin',
				'crossorigin',
			] );
		}
	}

	const bodyParams = {};
	for ( const [ key, value ] of fetchOptions.body || [] ) {
		bodyParams[ key ] = value;
		expect( key, 'body param' ).not.to.be.oneOf( [
			'action',
			'origin',
			'crossorigin',
		] );
	}

	if ( Object.keys( urlParams ).length > 0 && Object.keys( bodyParams ).length > 0 ) {
		expect( bodyParams ).not.to.have.any.keys( urlParams );
	}

	return { ...urlParams, ...bodyParams };
}

/**
 * Normalize the params for assertion purposes.
 *
 * This is necessary because FormData turns input Blob values into File values
 * (see https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#create-an-entry),
 * and a new file’s lastModified time defaults to Date.now(),
 * so if we don’t normalize Blob and File values to be File values with a static lastModified time,
 * tests that try to use Blob and File params will fail.
 *
 * @param {Object} params Not modified.
 * @return {Object} A normalized copy of the params.
 */
function normalizeParams( params ) {
	const normalized = {};
	for ( let [ key, value ] of Object.entries( params ) ) {
		if ( value instanceof Blob && !( value instanceof File ) ) {
			value = new File( [ value ], 'blob', {
				type: 'text/plain',
			} );
		}
		if ( value instanceof File ) {
			value = new File( [ value ], value.name, {
				type: value.type,
				lastModified: 0,
			} );
		}
		normalized[ key ] = value;
	}
	return normalized;
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
		async fetch( resource, fetchOptions ) {
			expect( fetchOptions, 'fetchOptions' ).to.have.property( 'method', method );
			expect( called, 'fetch already called' ).to.be.false;
			called = true;
			const params = extractParams( resource, fetchOptions );
			const normalizedParams = normalizeParams( params );
			const normalizedExpectedParams = normalizeParams( expectedParams );
			expect( normalizedParams ).to.eql( normalizedExpectedParams );
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
		async fetch( resource, fetchOptions ) {
			expect( expectedCalls ).to.not.be.empty;
			const [ {
				expectedParams = {},
				response = {},
				method = 'GET',
			} ] = expectedCalls.splice( -1 );
			expect( fetchOptions, 'fetchOptions' ).to.have.property( 'method', method );
			expectedParams.format = 'json';
			const params = extractParams( resource, fetchOptions );
			const normalizedParams = normalizeParams( params );
			const normalizedExpectedParams = normalizeParams( expectedParams );
			expect( normalizedParams ).to.eql( normalizedExpectedParams );
			return makeResponse( response );
		}
	}

	return new TestSession( 'en.wikipedia.org' );
}
