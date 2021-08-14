import axios from 'axios';
import { Session } from './core.js';

const defaultUserAgent = 'm3api/0.1.0 (m3api@lucaswerkmeister.de)';

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
	}

	async internalGet( params ) {
		const response = await this.session.request( {
			method: 'GET',
			params,
		} );
		return response.data;
	}

	async internalPost( params ) {
		const response = await this.session.request( {
			method: 'POST',
			data: params,
		} );
		return response.data;
	}

}

export {
	AxiosSession,
};
