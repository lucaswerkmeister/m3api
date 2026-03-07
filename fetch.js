/* eslint-env browser */

import { Session } from './core.js';

class FetchSession extends Session {

	/**
	 * Get the modified `fetch()` options for this request.
	 *
	 * @protected
	 * @param {RequestInit} fetchOptions Should not be modified.
	 * @return {RequestInit}
	 */
	getFetchOptions( fetchOptions ) {
		return fetchOptions;
	}

	fetch( resource, fetchOptions ) {
		return fetch( resource, this.getFetchOptions( fetchOptions ) );
	}

}

export {
	FetchSession,
};
