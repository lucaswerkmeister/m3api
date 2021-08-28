/* eslint-env browser */

import { Session } from './core.js';

const defaultUserAgent = 'm3api/0.1.2 (https://www.npmjs.com/package/m3api)';

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

	constructor( apiUrl, defaultParams = {}, userAgent = '' ) {
		super( apiUrl, defaultParams, userAgent );
		this.baseUrl = apiUrl;
		this.headers = {
			'api-user-agent': userAgent ?
				`${userAgent} ${defaultUserAgent}` :
				defaultUserAgent,
		};
	}

	async internalGet( params ) {
		const url = new URL( this.baseUrl );
		url.search = new URLSearchParams( params );
		const response = await fetch( url, {
			headers: this.headers,
		} );
		return transformResponse( response );
	}

	async internalPost( urlParams, bodyParams ) {
		const url = new URL( this.baseUrl );
		url.search = new URLSearchParams( urlParams );
		const response = await fetch( url, {
			method: 'POST',
			body: new URLSearchParams( bodyParams ),
			headers: this.headers,
		} );
		return transformResponse( response );
	}

}

export {
	FetchSession,
};
