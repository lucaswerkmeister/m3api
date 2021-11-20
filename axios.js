import axios from 'axios';
import { wrapper as axiosCookieJarSupport } from 'axios-cookiejar-support';
import process from 'process';
import tough from 'tough-cookie';
import { Session } from './core.js';

function transformResponse( response ) {
	const headers = { ...response.headers };
	delete headers[ 'set-cookie' ];

	return {
		status: response.status,
		headers,
		body: response.data,
	};
}

class AxiosSession extends Session {

	constructor( apiUrl, defaultParams = {}, defaultOptions = {} ) {
		if ( typeof defaultOptions.warn !== 'function' ) {
			if ( process.env.NODE_ENV === 'development' ) {
				defaultOptions.warn = console.warn;
			} else {
				defaultOptions.warn = function () {};
			}
		}
		super( apiUrl, defaultParams, defaultOptions );
		this.session = axios.create( {
			baseURL: this.apiUrl,
		} );
		axiosCookieJarSupport( this.session );
		Object.assign( this.session.defaults, { // must happen after axiosCookieJarSupport
			jar: new tough.CookieJar(),
		} );
	}

	async internalGet( params, userAgent ) {
		const response = await this.session.request( {
			method: 'GET',
			params,
			headers: {
				'user-agent': userAgent,
			},
		} );
		return transformResponse( response );
	}

	async internalPost( urlParams, bodyParams, userAgent ) {
		const response = await this.session.request( {
			method: 'POST',
			params: urlParams,
			data: new URLSearchParams( bodyParams ),
			headers: {
				'user-agent': userAgent,
			},
		} );
		return transformResponse( response );
	}

}

export {
	AxiosSession,
};
