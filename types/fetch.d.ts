export class FetchSession extends Session {
    /**
     * Get the modified `fetch()` options for this request.
     *
     * @protected
     * @param {RequestInit} fetchOptions Should not be modified.
     * @return {RequestInit}
     */
    protected getFetchOptions(fetchOptions: RequestInit): RequestInit;
    fetch(resource: any, fetchOptions: any): Promise<Response>;
}
import { Session } from './core.js';
//# sourceMappingURL=fetch.d.ts.map