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
	 * Values may be strings, numbers, arrays or sets thereof, booleans, null, or undefined.
	 * Parameters with values false, null, or undefined are completely removed.
	 * @param {Object} [options] Other options for the request.
	 * @param {string} [options.method] The method, either GET (default) or POST.
	 * @param {number} [options.maxRetries] The maximum number of automatic retries,
	 * i.e. times the request will be repeated if the response contains a Retry-After header.
	 * Defaults to 1; set to 0 to disable automatic retries.
	 * @return {Object}
	 * @throws {ApiErrors}
	 */
	async request( params, options = {} ) {
		const {
			method,
			maxRetries,
		} = Object.assign( {
			method: 'GET',
			maxRetries: 1,
		}, options );

		const response = await this.internalRequest( method, this.transformParams( {
			...this.defaultParams,
			...params,
			format: 'json',
		} ), maxRetries );
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
		let continueParams = { continue: undefined };
		do {
			const response = await this.request( {
				...params,
				...continueParams,
			}, options );
			continueParams = response.continue;
			yield response;
		} while ( continueParams !== undefined );
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
		if ( value instanceof Set ) {
			value = [ ...value ];
		}
		if ( Array.isArray( value ) ) {
			return this.transformParamArray( value );
		} else {
			return this.transformParamScalar( value );
		}
	}

	/**
	 * @private
	 * @param {(string|number)[]} value
	 * @return {string}
	 */
	transformParamArray( value ) {
		if ( value.some( ( element ) => /[|]/.test( element ) ) ) {
			return '\x1f' + value.join( '\x1f' );
		} else {
			return value.join( '|' );
		}
	}

	/**
	 * @private
	 * @param {*} value
	 * @return {*} string|undefined for string|number|boolean|null|undefined value,
	 * the value unmodified otherwise
	 */
	transformParamScalar( value ) {
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
	 * @param {number} maxRetries
	 * @return {Object}
	 */
	async internalRequest( method, params, maxRetries ) {
		let result;
		if ( method === 'GET' ) {
			result = this.internalGet( params );
		} else if ( method === 'POST' ) {
			const [ urlParams, bodyParams ] = splitPostParameters( params );
			result = this.internalPost( urlParams, bodyParams );
		} else {
			throw new Error( `Unknown request method: ${method}` );
		}
		const {
			status,
			headers,
			body,
		} = await result;

		if ( maxRetries > 0 && 'retry-after' in headers ) {
			await new Promise( ( resolve ) => {
				setTimeout( resolve, 1000 * parseInt( headers[ 'retry-after' ] ) );
			} );
			return this.internalRequest( method, params, maxRetries - 1 );
		}

		if ( status !== 200 ) {
			throw new Error( `API request returned non-200 HTTP status code: ${status}` );
		}

		return body;
	}

	/**
	 * Actually make a GET request.
	 *
	 * @abstract
	 * @protected
	 * @param {Object} params
	 * @return {Promise<Object>} Object with members status (number),
	 * headers (object mapping lowercase names to string values, without set-cookie),
	 * and body (JSON-decoded).
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
	 * @return {Promise<Object>} Same as for internalGet.
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

/**
 * Convenience function to get a boolean from an API response object.
 *
 * Works for formatversion=1 booleans
 * (absent means false, empty string means true)
 * as well as formatversion=2 booleans
 * (absent or false means false, true means true).
 * Mostly useful in library code,
 * when you don’t know the formatversion of the response.
 * (If you control the request parameters, just use formatversion=2.)
 *
 * @param {Object} object An object from an API response.
 * (Typically not the whole response, but a member like response.query.general.)
 * @param {string} key The key of the boolean in the response object.
 * @return {boolean}
 */
function responseBoolean( object, key ) {
	return ( object[ key ] && '' ) === '';
}

/**
 * Convenience function to create a Set.
 *
 * The two invocations
 *
 *     new Set( [ 'a', 'b' ] )
 *     set( 'a', 'b' )
 *
 * are equivalent, but the second one is shorter and easier to type.
 *
 * @param {...*} elements
 * @return {Set}
 */
function set( ...elements ) {
	return new Set( elements );
}

export {
	ApiErrors,
	Session,
	responseBoolean,
	set,
};
