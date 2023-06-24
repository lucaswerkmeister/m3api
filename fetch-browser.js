import { FetchSession } from './fetch.js';

class FetchBrowserSession extends FetchSession {

	getFetchOptions( headers ) {
		const { 'user-agent': userAgent, ...otherHeaders } = headers;
		return {
			...super.getFetchOptions( headers ),
			headers: {
				...otherHeaders,
				'api-user-agent': userAgent,
			},
		};
	}

}

export {
	FetchBrowserSession,
};
