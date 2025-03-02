export class FetchSession extends Session {
    /**
     * Get the fetch() options for this request.
     *
     * @protected
     * @param {Object} headers
     * @return {Object}
     */
    protected getFetchOptions(headers: any): any;
    internalGet(apiUrl: any, params: any, headers: any): Promise<{
        status: any;
        headers: {};
        body: any;
    }>;
    internalPost(apiUrl: any, urlParams: any, bodyParams: any, headers: any): Promise<{
        status: any;
        headers: {};
        body: any;
    }>;
}
import { Session } from './core.js';
//# sourceMappingURL=fetch.d.ts.map