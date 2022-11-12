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
			httpAgent: new HttpCookieAgent( agentOptions ),
			httpsAgent: new HttpsCookieAgent( agentOptions ),
		} );
	}

	async internalGet( apiUrl, params, headers ) {
		const response = await this.session.request( {
			method: 'GET',
			baseURL: apiUrl,
			params,
			headers,
		} );
		return transformResponse( response );
	}

	async internalPost( apiUrl, urlParams, bodyParams, headers ) {
		const response = await this.session.request( {
			method: 'POST',
			baseURL: apiUrl,
			params: urlParams,
			data: new URLSearchParams( bodyParams ),
			headers,
		} );
		return transformResponse( response );
	}

}

export {
	AxiosSession,
};
