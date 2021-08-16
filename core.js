/* eslint no-unused-vars: [ "error", { "args": "none" } ] */
// Session has abstract methods with parameters only used in subclasses

/**
 * @private
 * @param {Object} params
 * @return {Array.<Object>} [urlParams, bodyParams]
 */
function splitPostParameters( params ) {
	const urlParams = {};
	const bodyParams = {};
	for ( const [ key, value ] of Object.entries( params ) ) {
		if ( key === 'origin' ) {
			urlParams[ key ] = value;
		} else {
			bodyParams[ key ] = value;
		}
	}
	return [ urlParams, bodyParams ];
}

/**
 * An Error wrapping one or more API errors.
 */
class ApiErrors extends Error {

	constructor( errors, ...params ) {
		super( errors[ 0 ].code, ...params );

		if ( Error.captureStackTrace ) {
			Error.captureStackTrace( this, ApiErrors );
		}

		this.name = 'ApiErrors';
		this.errors = errors;
	}

}

/**
 * A session to make API requests.
 */
class Session {

	/**
	 * @param {string} apiUrl The URL to the api.php endpoint,
	 * such as https://en.wikipedia.org/w/api.php
	 * @param {Object} [defaultParams] Parameters to include in every API request.
	 * You are strongly encouraged to specify formatversion: 2 here;
	 * other useful global parameters include uselang, errorformat, maxlag
	 * @param {string} [userAgent] The user agent to send,
	 * see https://meta.wikimedia.org/wiki/User-Agent_policy
	 */
	constructor( apiUrl, defaultParams = {}, userAgent = '' ) {
		this.defaultParams = defaultParams;
	}

	/**
	 * Make an API request.
	 *
	 * @param {Object} params The parameters.
	 * Values may be strings, numbers, arrays thereof, booleans, null, or undefined.
	 * Parameters with values false, null, or undefined are completely removed.
	 * @param {Object} [options] Other options for the request.
	 * @param {string} [options.method] The method, either GET (default) or POST.
	 * @return {Object}
	 * @throws {ApiErrors}
	 */
	async request( params, options = {} ) {
		const {
			method,
		} = Object.assign( {
			method: 'GET',
		}, options );

		const response = await this.internalRequest( method, this.transformParams( {
			...this.defaultParams,
			...params,
			format: 'json',
		} ) );
		this.throwErrors( response );
		return response;
	}

	/**
	 * Make a series of API requests, following API continuation.
	 *
	 * @param {Object} params Same as for request.
	 * Continuation parameters will be added automatically.
	 * @param {Object} [options] Same as for request.
	 * @return {Object}
	 * @throws {ApiErrors}
	 */
	async * requestAndContinue( params, options = {} ) {
		const {
			method,
		} = Object.assign( {
			method: 'GET',
		}, options );

		const baseParams = this.transformParams( {
			...this.defaultParams,
			...params,
			format: 'json',
		} );
		let continueParams = {};
		do {
			const response = await this.internalRequest( method, {
				...baseParams,
				...continueParams,
			} );
			this.throwErrors( response );
			continueParams = response.continue || {};
			yield response;
		} while ( Object.keys( continueParams ).length > 0 );
	}

	/**
	 * @private
	 * @param {Object} params
	 * @return {Object}
	 */
	transformParams( params ) {
		const transformedParams = {};
		for ( const [ key, value ] of Object.entries( params ) ) {
			const transformedParamValue = this.transformParamValue( value );
			if ( transformedParamValue !== undefined ) {
				transformedParams[ key ] = transformedParamValue;
			}
		}
		return transformedParams;
	}

	/**
	 * @private
	 * @param {*} value
	 * @return {string|undefined}
	 */
	transformParamValue( value ) {
		if ( Array.isArray( value ) ) {
			if ( value.some( ( element ) => /[|]/.test( element ) ) ) {
				return '\x1f' + value.join( '\x1f' );
			} else {
				return value.join( '|' );
			}
		}
		if ( typeof value === 'number' ) {
			return String( value );
		}
		if ( value === true ) {
			return '';
		}
		if ( value === false || value === null || value === undefined ) {
			return undefined;
		}
		return value;
	}

	/**
	 * @private
	 * @param {string} method
	 * @param {Object} params
	 * @return {Object}
	 */
	internalRequest( method, params ) {
		if ( method === 'GET' ) {
			return this.internalGet( params );
		} else if ( method === 'POST' ) {
			const [ urlParams, bodyParams ] = splitPostParameters( params );
			return this.internalPost( urlParams, bodyParams );
		} else {
			throw new Error( `Unknown request method: ${method}` );
		}
	}

	/**
	 * Actually make a GET request.
	 *
	 * @abstract
	 * @protected
	 * @param {Object} params
	 * @return {Promise<Object>}
	 */
	internalGet( params ) {
		throw new Error( 'Abstract method internalGet not implemented!' );
	}

	/**
	 * Actually make a POST request.
	 *
	 * @abstract
	 * @protected
	 * @param {Object} urlParams
	 * @param {Object} bodyParams
	 * @return {Object}
	 */
	internalPost( urlParams, bodyParams ) {
		throw new Error( 'Abstract method internalPost not implemented!' );
	}

	/**
	 * @private
	 * @param {Object} response
	 * @throws {ApiErrors}
	 */
	throwErrors( response ) {
		if ( 'error' in response ) {
			throw new ApiErrors( [ response.error ] );
		}
		if ( 'errors' in response ) {
			throw new ApiErrors( response.errors );
		}
	}

}

export {
	ApiErrors,
	Session,
};
