/* eslint-disable */
import { Session } from './core.js';

const DEFAULT_OPTIONS = {
	warn: console.warn, // copied from core.js
};

class CombiningSession extends Session {

	/*
	 * Implementation note: this class is “mixed into” other session classes
	 * by copying its methods into their prototypes;
	 * therefore, it cannot have a constructor,
	 * and when you add a new method to it,
	 * you also have to add it to mixCombiningSessionInto().
	 */

	request( params, options = {} ) {
		const pendingRequests = this.pendingRequests || ( this.pendingRequests = new Set() );
		const newRequest = { params, options };
		for ( const pendingRequest of pendingRequests ) {
			const combinedRequest = this.combineRequests( pendingRequest, newRequest );
			if ( combinedRequest !== null ) {
				return combinedRequest.promise;
			}
		}
		pendingRequests.add( newRequest );
		return newRequest.promise = new Promise( async ( resolve ) => {
			await Promise.resolve(); // brief pause to let other requests join this one
			pendingRequests.delete( newRequest );
			resolve( super.request( newRequest.params, newRequest.options ) );
		} );
	}

	/**
	 * @private
	 * Try to merge the a new request into an existing one.
	 *
	 * @param {Object} requestA The existing request.
	 * If the requests are compatible, this request’s params and options will be replaced.
	 * @param {Object} requestB The new request. (Not modified.)
	 * @return {Object|null} requestA (modified) if the requests are compatible, else null.
	 */
	combineRequests( requestA, requestB ) {
		const { warn: warnA, ...optionsA } = requestA.options,
			{ warn: warnB, ...optionsB } = requestB.options;
		if ( JSON.stringify( optionsA ) !== JSON.stringify( optionsB ) ){
			return null;
		}
		const combinedParams = this.combineParams( requestA.params, requestB.params );
		if ( combinedParams === null ) {
			return null;
		}
		requestA.params = combinedParams;
		requestA.options = {
			warn: ( ...args ) => {
				( warnA || this.defaultOptions.warn || DEFAULT_OPTIONS.warn )( ...args );
				// `return` so it’s a tail call :)
				return ( warnB || this.defaultOptions.warn || DEFAULT_OPTIONS.warn )( ...args );
			},
			...optionsA,
		};
		return requestA;
	}

	/**
	 * @private
	 * Try to combine the two sets of parameters for the given session.
	 *
	 * @param {Object} paramsA The first set of params. (Not modified.)
	 * @param {Object} paramsB The other set of params. (Not modified.)
	 * @param {Object|null} A new set of combined params, if possible, else null.
	 */
	combineParams( paramsA, paramsB ) {
		// never combine generator/continue with titles/pageids/revids
		const hasParam = ( params, key ) => this.transformParamScalar( params[ key ] ) !== undefined;
		const hasParams = ( params, ...keys ) => keys.some( ( key ) => hasParam( params, key ) );
		if ( hasParams( paramsA, 'generator', 'continue' )
			&& hasParams( paramsB, 'titles', 'pageids', 'revids' )
			|| hasParams( paramsB, 'generator', 'continue' )
			&& hasParams( paramsA, 'titles', 'pageids', 'revids' )
		) {
			return null;
		}

		const params = {};
		for ( let [ key, valueB ] of Object.entries( paramsB ) ) {
			if ( !Object.prototype.hasOwnProperty.call( paramsA, key ) ) {
				params[ key ] = valueB;
				continue;
			}
			let valueA = paramsA[ key ];
			valueA = this.transformParamScalar( valueA );
			valueB = this.transformParamScalar( valueB );
			if ( valueA === valueB ) {
				params[ key ] = valueA;
				continue;
			}
			if ( valueA instanceof Set && valueB instanceof Set ) {
				const valueAB = new Set();
				for ( const value of [ valueA, valueB ] ) {
					for ( const element of value ) {
						valueAB.add( this.transformParamScalar( element ) );
					}
				}
				params[ key ] = valueAB;
				continue;
			}
			return null;
		}
		for ( let [ key, valueA ] of Object.entries( paramsA ) ) {
			if ( !Object.prototype.hasOwnProperty.call( paramsB, key ) ) {
				params[ key ] = valueA;
			}
		}
		return params;
	}

}

function mixCombiningSessionInto( otherClass ) {
	otherClass.prototype.request = CombiningSession.prototype.request;
	otherClass.prototype.combineRequests = CombiningSession.prototype.combineRequests;
	otherClass.prototype.combineParams = CombiningSession.prototype.combineParams;
}

export {
	mixCombiningSessionInto,
	// note: we don’t export CombiningSession,
	// because we don’t want anyone to check `instanceof CombiningSession`,
	// which wouldn’t work
};
