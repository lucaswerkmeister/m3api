import { AxiosSession } from './axios.js';
import { mixCombiningSessionInto } from './combine.js';

export default class NodeSession extends AxiosSession {
}

mixCombiningSessionInto( NodeSession );

// re-export core.js exports expected to be useful to end-users / applications,
// but not ones that are only expected to be useful for extension packages
export {
	ApiErrors,
	ApiWarnings,
	set,
} from './core.js';
