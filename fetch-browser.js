import { FetchSession } from './fetch.js';

class FetchBrowserSession extends FetchSession {

	getFetchOptions( fetchOptions ) {
		const headers = new Headers( fetchOptions.headers );
		const userAgent = headers.get( 'user-agent' );
		if ( userAgent === null ) {
			throw new Error( 'Missing User-Agent request header!' );
		}
		headers.set( 'api-user-agent', userAgent );
		headers.delete( 'user-agent' );
		return {
			...super.getFetchOptions( fetchOptions ),
			headers,
		};
	}

}

export {
	FetchBrowserSession,
};
