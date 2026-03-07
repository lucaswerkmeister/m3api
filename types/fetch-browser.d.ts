export class FetchBrowserSession extends FetchSession {
    getFetchOptions(fetchOptions: any): {
        headers: Headers;
        body?: BodyInit | null;
        cache?: RequestCache;
        credentials?: RequestCredentials;
        integrity?: string;
        keepalive?: boolean;
        method?: string;
        mode?: RequestMode;
        priority?: RequestPriority;
        redirect?: RequestRedirect;
        referrer?: string;
        referrerPolicy?: ReferrerPolicy;
        signal?: AbortSignal | null;
        window?: null;
    };
}
import { FetchSession } from './fetch.js';
//# sourceMappingURL=fetch-browser.d.ts.map