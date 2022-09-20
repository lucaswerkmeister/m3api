import axios from 'axios';
import { HttpCookieAgent, HttpsCookieAgent } from 'http-cookie-agent';
import { CookieJar } from 'tough-cookie';
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
		super( apiUrl, defaultParams, defaultOptions );
		const agentOptions = {
			jar: new CookieJar(),
			keepAlive: true,
		};
		this.session = axios.create( {
			baseURL: this.apiUrl,
			httpAgent: new HttpCookieAgent( agentOptions ),
			httpsAgent: new HttpsCookieAgent( agentOptions ),
		} );
	}

	async internalGet( params, userAgent ) {
		const response = await this.session.request( {
			method: 'GET',
			params,
			headers: {
				'user-agent': userAgent,
				'accept-encoding': 'gzip',
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
