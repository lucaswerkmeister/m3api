import { FetchSession } from './fetch.js';
import { mixCombiningSessionInto } from './combine.js';

export default class BrowserSession extends FetchSession {
}

mixCombiningSessionInto( BrowserSession );

export {
	ApiErrors,
	set,
} from './core.js';
