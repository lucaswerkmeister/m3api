import axios from 'axios';
import axiosCookieJarSupport from 'axios-cookiejar-support';
import tough from 'tough-cookie';
import { Session } from './core.js';

const defaultUserAgent = 'm3api/0.1.1 (m3api@lucaswerkmeister.de)';

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
		axiosCookieJarSupport.default( this.session );
		Object.assign( this.session.defaults, { // must happen after axiosCookieJarSupport
			jar: new tough.CookieJar(),
			withCredentials: true,
		} );
	}

	async internalGet( params ) {
		const response = await this.session.request( {
			method: 'GET',
			params,
		} );
		return response.data;
	}

	async internalPost( urlParams, bodyParams ) {
		const response = await this.session.request( {
			method: 'POST',
			params: urlParams,
			data: new URLSearchParams( bodyParams ),
		} );
		return response.data;
	}

}

export {
	AxiosSession,
};
