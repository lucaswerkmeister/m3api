import axios from 'axios';
import { wrapper as axiosCookieJarSupport } from 'axios-cookiejar-support';
import tough from 'tough-cookie';
import { Session } from './core.js';

const defaultUserAgent = 'm3api/0.3.0 (https://www.npmjs.com/package/m3api)';

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

	constructor( apiUrl, defaultParams = {}, userAgent = '' ) {
		super( apiUrl, defaultParams, userAgent );
		this.session = axios.create( {
			baseURL: apiUrl,
			headers: {
				common: {
					'user-agent': userAgent ?
						`${userAgent} ${defaultUserAgent}` :
						defaultUserAgent,
				},
			},
		} );
		axiosCookieJarSupport( this.session );
		Object.assign( this.session.defaults, { // must happen after axiosCookieJarSupport
			jar: new tough.CookieJar(),
		} );
	}

	async internalGet( params ) {
		const response = await this.session.request( {
			method: 'GET',
			params,
		} );
		return transformResponse( response );
	}

	async internalPost( urlParams, bodyParams ) {
		const response = await this.session.request( {
			method: 'POST',
			params: urlParams,
			data: new URLSearchParams( bodyParams ),
		} );
		return transformResponse( response );
	}

}

export {
	AxiosSession,
};
