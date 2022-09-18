import { AxiosSession } from './axios.js';
import { mixCombiningSessionInto } from './combine.js';
import './add-performance-global.js';

export default class NodeSession extends AxiosSession {
}

mixCombiningSessionInto( NodeSession );

export {
	ApiErrors,
	ApiWarnings,
	set,
} from './core.js';
