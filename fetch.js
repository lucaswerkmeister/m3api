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
		this.baseUrl = apiUrl;
	}

	async internalGet( params, userAgent ) {
		const url = new URL( this.baseUrl );
		url.search = new URLSearchParams( params );
		const response = await fetch( url, {
			headers: {
				'api-user-agent': userAgent,
			},
		} );
		return transformResponse( response );
	}

	async internalPost( urlParams, bodyParams, userAgent ) {
		const url = new URL( this.baseUrl );
		url.search = new URLSearchParams( urlParams );
		const response = await fetch( url, {
			method: 'POST',
			body: new URLSearchParams( bodyParams ),
			headers: {
				'api-user-agent': userAgent,
			},
		} );
		return transformResponse( response );
	}

}

export {
	FetchSession,
};
