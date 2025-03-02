export class FetchNodeSession extends FetchSession {
    constructor(apiUrl: any, defaultParams?: {}, defaultOptions?: {});
    agent: CookieAgent;
    getFetchOptions(headers: any): any;
}
import { FetchSession } from './fetch.js';
import { CookieAgent } from 'http-cookie-agent/undici';
//# sourceMappingURL=fetch-node.d.ts.map