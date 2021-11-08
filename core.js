/* eslint no-unused-vars: [ "error", { "args": "none" } ] */
// Session has abstract methods with parameters only used in subclasses

const defaultUserAgent = 'm3api/0.3.0 (https://www.npmjs.com/package/m3api)';

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
 * An Error wrapping one or more API warnings.
 */
class ApiWarnings extends Error {

	constructor( warnings, ...params ) {
		super(
			warnings[ 0 ].code || warnings[ 0 ].warnings || warnings[ 0 ][ '*' ],
			...params,
		);

		if ( Error.captureStackTrace ) {
			Error.captureStackTrace( this, ApiWarnings );
		}

		this.name = 'ApiWarnings';
		this.warnings = warnings;
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
	 * See {@link #request} for supported value types.
	 * You are strongly encouraged to specify formatversion: 2 here;
	 * other useful global parameters include uselang, errorformat, maxlag.
	 * @param {Object} [defaultOptions] Options to set for each request.
	 * See {@link #request} for supported options.
	 * You are strongly encouraged to specify a userAgent according to the
	 * {@link https://meta.wikimedia.org/wiki/User-Agent_policy User-Agent policy}.
	 */
	constructor( apiUrl, defaultParams = {}, defaultOptions = {} ) {
		this.defaultParams = defaultParams;
		if ( typeof defaultOptions === 'string' ) {
			console.warn(
				'The third Session constructor parameter should now be an object. ' +
					"Change your code to pass { userAgent: '...' } instead.",
			);
			defaultOptions = { userAgent: defaultOptions };
		}
		this.defaultOptions = defaultOptions;
	}

	/**
	 * Make an API request.
	 *
	 * @param {Object} params The parameters.
	 * Values may be strings, numbers, arrays or sets thereof, booleans, null, or undefined.
	 * Parameters with values false, null, or undefined are completely removed.
	 * Default parameters from the constructor are added to these,
	 * with per-request parameters overriding default parameters in case of collision.
	 * @param {Object} [options] Other options for the request.
	 * Default options from the constructor are added to these,
	 * with per-request options overriding default options in case of collision.
	 * @param {string} [options.method] The method, either GET (default) or POST.
	 * @param {number} [options.maxRetries] The maximum number of automatic retries,
	 * i.e. times the request will be repeated if the response contains a Retry-After header.
	 * Defaults to 1; set to 0 to disable automatic retries.
	 * @param {string} [options.userAgent] The User-Agent header to send.
	 * (Usually specified as a default option in the constructor.)
	 * @param {Function} [options.warn] A handler for warnings from this API request.
	 * Called with a single instance of a subclass of Error, such as {@link ApiWarnings}.
	 * The default is console.warn in the browser, and in Node.js if NODE_ENV is 'development',
	 * or a no-op function (ignore warnings) in Node.js otherwise.
	 * @return {Object}
	 * @throws {ApiErrors}
	 */
	async request( params, options = {} ) {
		const {
			method,
			maxRetries,
			userAgent,
			warn,
		} = Object.assign( {
			method: 'GET',
			maxRetries: 1,
		}, this.defaultOptions, options );
		const fullUserAgent = userAgent ?
			`${userAgent} ${defaultUserAgent}` :
			defaultUserAgent;

		const response = await this.internalRequest( method, this.transformParams( {
			...this.defaultParams,
			...params,
			format: 'json',
		} ), fullUserAgent, maxRetries );
		this.throwErrors( response );
		this.handleWarnings( response, warn );
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
	 * @param {string} userAgent
	 * @param {number} maxRetries
	 * @return {Object}
	 */
	async internalRequest( method, params, userAgent, maxRetries ) {
		let result;
		if ( method === 'GET' ) {
			result = this.internalGet( params, userAgent );
		} else if ( method === 'POST' ) {
			const [ urlParams, bodyParams ] = splitPostParameters( params );
			result = this.internalPost( urlParams, bodyParams, userAgent );
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
			return this.internalRequest( method, params, userAgent, maxRetries - 1 );
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
	 * @param {string} userAgent
	 * @return {Promise<Object>} Object with members status (number),
	 * headers (object mapping lowercase names to string values, without set-cookie),
	 * and body (JSON-decoded).
	 */
	internalGet( params, userAgent ) {
		throw new Error( 'Abstract method internalGet not implemented!' );
	}

	/**
	 * Actually make a POST request.
	 *
	 * @abstract
	 * @protected
	 * @param {Object} urlParams
	 * @param {Object} bodyParams
	 * @param {string} userAgent
	 * @return {Promise<Object>} Same as for internalGet.
	 */
	internalPost( urlParams, bodyParams, userAgent ) {
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

	/**
	 * @private
	 * @param {Object} response
	 * @param {Function} warn
	 */
	handleWarnings( response, warn ) {
		let warnings = response.warnings;
		if ( !warnings ) {
			return;
		}
		if ( !Array.isArray( warnings ) ) {
			const bcWarnings = Object.entries( warnings );
			if ( bcWarnings[ 0 ][ 0 ] === 'main' ) {
				// move to end of list
				bcWarnings.push( bcWarnings.shift() );
			}
			warnings = [];
			for ( const [ module, warning ] of bcWarnings ) {
				warning.module = module;
				warnings.push( warning );
			}
		}
		warn( new ApiWarnings( warnings ) );
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
	ApiWarnings,
	Session,
	responseBoolean,
	set,
};
