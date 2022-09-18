/* eslint-disable-next-line node/no-missing-import */
import { performance } from 'node:perf_hooks';

if ( !( 'performance' in global ) ) {
	global.performance = performance;
}
