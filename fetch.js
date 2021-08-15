/* eslint-env browser */

import { Session } from './core.js';

const defaultUserAgent = 'm3api/0.1.0 (m3api@lucaswerkmeister.de)';

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
		return response.json();
	}

	async internalPost( params ) {
		const response = await fetch( this.baseUrl, {
			method: 'POST',
			body: new URLSearchParams( params ),
			headers: this.headers,
		} );
		return response.json();
	}

}

export {
	FetchSession,
};