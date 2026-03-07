import { CookieAgent } from 'http-cookie-agent/undici';
import { CookieJar } from 'tough-cookie';
import { FetchSession } from './fetch.js';

class FetchNodeSession extends FetchSession {

	constructor( apiUrl, defaultParams = {}, defaultOptions = {} ) {
		super( apiUrl, defaultParams, defaultOptions );

		this.agent = new CookieAgent( {
			cookies: { jar: new CookieJar() },
		} );
	}

	getFetchOptions( fetchOptions ) {
		return {
			...fetchOptions,
			dispatcher: this.agent,
		};
	}

}

export {
	FetchNodeSession,
};
