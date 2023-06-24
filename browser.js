import { FetchBrowserSession } from './fetch-browser.js';
import { mixCombiningSessionInto } from './combine.js';

export default class BrowserSession extends FetchBrowserSession {
}

mixCombiningSessionInto( BrowserSession );

// re-export core.js exports expected to be useful to end-users / applications,
// but not ones that are only expected to be useful for extension packages
export {
	ApiErrors,
	ApiWarnings,
	set,
} from './core.js';
