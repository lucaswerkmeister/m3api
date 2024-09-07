/* eslint-env browser */

import { Session } from './core.js';

async function transformResponse( response ) {
	const headers = {};
	for ( const [ name, value ] of response.headers.entries() ) {
		headers[ name ] = value;
	}

	return {
		status: response.status,
		headers,
		body: await response.json(),
	};
}

class FetchSession extends Session {

	constructor( apiUrl, defaultParams = {}, defaultOptions = {} ) {
		super( apiUrl, defaultParams, defaultOptions );
	}

	/**
	 * Get the fetch() options for this request.
	 *
	 * @protected
	 * @param {Object} headers
	 * @return {Object}
	 */
	getFetchOptions( headers ) {
		return { headers };
	}

	async internalGet( apiUrl, params, headers ) {
		const url = new URL( apiUrl );
		url.search = new URLSearchParams( params );
		const response = await fetch( url, {
			...this.getFetchOptions( headers ),
		} );
		return transformResponse( response );
	}

	async internalPost( apiUrl, urlParams, bodyParams, headers ) {
		const url = new URL( apiUrl );
		url.search = new URLSearchParams( urlParams );
		// try to send the body as application/x-www-form-urlencoded (URLSearchParams),
		// as this is required for OAuth 2.0 and also shorter;
		// fall back to multipart/form-data (FormData) if needed for e.g. file params
		let body1 = new URLSearchParams();
		const body2 = new FormData();
		for ( const [ paramName, paramValue ] of Object.entries( bodyParams ) ) {
			if ( body1 !== null && typeof paramValue === 'string' ) {
				body1.append( paramName, paramValue );
			} else {
				body1 = null;
			}
			body2.append( paramName, paramValue );
		}
		const response = await fetch( url, {
			...this.getFetchOptions( headers ),
			method: 'POST',
			body: body1 !== null ? body1 : body2,
		} );
		return transformResponse( response );
	}

}

export {
	FetchSession,
};
