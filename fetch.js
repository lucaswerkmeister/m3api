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

	async internalGet( params, headers ) {
		const url = new URL( this.apiUrl );
		url.search = new URLSearchParams( params );
		const { 'user-agent': userAgent, ...otherHeaders } = headers;
		const response = await fetch( url, {
			headers: {
				...otherHeaders,
				'api-user-agent': userAgent,
			},
		} );
		return transformResponse( response );
	}

	async internalPost( urlParams, bodyParams, headers ) {
		const url = new URL( this.apiUrl );
		url.search = new URLSearchParams( urlParams );
		const { 'user-agent': userAgent, ...otherHeaders } = headers;
		const response = await fetch( url, {
			method: 'POST',
			body: new URLSearchParams( bodyParams ),
			headers: {
				...otherHeaders,
				'api-user-agent': userAgent,
			},
		} );
		return transformResponse( response );
	}

}

export {
	FetchSession,
};
