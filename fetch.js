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
		this.fetchOptions = {};
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
		const body = new FormData();
		for ( const [ paramName, paramValue ] of Object.entries( bodyParams ) ) {
			body.append( paramName, paramValue );
		}
		const response = await fetch( url, {
			...this.getFetchOptions( headers ),
			method: 'POST',
			body,
		} );
		return transformResponse( response );
	}

}

export {
	FetchSession,
};
