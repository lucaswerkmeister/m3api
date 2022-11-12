/* eslint-disable */
import {
	DEFAULT_OPTIONS,
	Session,
	makeWarnDroppingTruncatedResultWarning,
} from './core.js';

class CombiningSession extends Session {

	/*
	 * Implementation note: this class is “mixed into” other session classes
	 * by copying its methods into their prototypes;
	 * therefore, it cannot have a constructor,
	 * and when you add a new method to it,
	 * you also have to add it to mixCombiningSessionInto().
	 */

	async request( params, options = {} ) {
		const { tokenType } = {
			...DEFAULT_OPTIONS,
			...this.defaultOptions,
			...options,
		};
		if ( tokenType !== null ) {
			// getToken() calls request(), let that be combined with other requests;
			// actually adding the token is left to core.js
			// (we just preload the token for this.tokens)
			await this.getToken( tokenType, options );
		}

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
	 * Try to merge the a new request into an existing one.
	 *
	 * @private
	 * @param {Object} requestA The existing request.
	 * If the requests are compatible, this request’s params and options will be replaced.
	 * @param {Object} requestB The new request. (Not modified.)
	 * @return {Object|null} requestA (modified) if the requests are compatible, else null.
	 */
	combineRequests( requestA, requestB ) {
		const combinedParams = this.combineParams( requestA.params, requestB.params );
		if ( combinedParams === null ) {
			return null;
		}
		const combinedOptions = this.combineOptions( requestA.options, requestB.options );
		if ( combinedOptions === null ) {
			return null;
		}
		requestA.params = combinedParams;
		requestA.options = combinedOptions;
		return requestA;
	}

	/**
	 * Try to combine the two sets of parameters.
	 *
	 * @private
	 * @param {Object} paramsA The first set of params. (Not modified.)
	 * @param {Object} paramsB The other set of params. (Not modified.)
	 * @return {Object|null} A new set of combined params, if possible, else null.
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

	/**
	 * Try to combine the two sets of options.
	 *
	 * @private
	 * @param {Options} optionsA The first set of options. (Not modified.)
	 * @param {Options} optionsB The other set of options. (Not modified.)
	 * @return {Options|null} A new set of combined options, if possible, else null.
	 */
	combineOptions( optionsA, optionsB ) {
		const defaultOptions = { ...DEFAULT_OPTIONS, ...this.defaultOptions };
		const isDefaultOption = ( key, value ) => defaultOptions[ key ] === value;

		const {
			warn: warnA = defaultOptions.warn,
			dropTruncatedResultWarning: dtrwA = defaultOptions.dropTruncatedResultWarning,
			tokenType: tokenTypeA = defaultOptions.tokenType,
			tokenName: tokenNameA = defaultOptions.tokenName,
			...otherOptionsA
		} = optionsA;
		const {
			warn: warnB = defaultOptions.warn,
			dropTruncatedResultWarning: dtrwB = defaultOptions.dropTruncatedResultWarning,
			tokenType: tokenTypeB = defaultOptions.tokenType,
			tokenName: tokenNameB = defaultOptions.tokenName,
			...otherOptionsB
		} = optionsB;

		const realWarnA = dtrwA ? makeWarnDroppingTruncatedResultWarning( warnA ) : warnA;
		const realWarnB = dtrwB ? makeWarnDroppingTruncatedResultWarning( warnB ) : warnB;
		const options = {
			warn: ( ...args ) => {
				realWarnA( ...args );
				// `return` so it’s a tail call :)
				return realWarnB( ...args );
			},
			dropTruncatedResultWarning: false,
			tokenType: tokenTypeA, // if !== tokenTypeB, we return below
		};

		if ( tokenTypeA === null && tokenTypeB === null ) {
			// compatible as far as tokens are concerned,
			// ignore tokenName when checking remaining options
		} else if ( tokenTypeA === tokenTypeB ) {
			// tokenType compatible, include tokenName in options check
			otherOptionsA.tokenName = tokenNameA;
			otherOptionsB.tokenName = tokenNameB;
		} else {
			// tokenType incompatible
			return null;
		}

		for ( const [ key, optionB ] of Object.entries( otherOptionsB ) ) {
			if ( Object.prototype.hasOwnProperty.call( otherOptionsA, key ) ) {
				const optionA = otherOptionsA[ key ];
				if ( optionA !== optionB ) {
					return null;
				}
			} else {
				if ( !isDefaultOption( key, optionB ) ) {
					return null;
				}
			}
			options[ key ] = optionB;
		}
		for ( const [ key, optionA ] of Object.entries( otherOptionsA ) ) {
			if ( !Object.prototype.hasOwnProperty.call( otherOptionsB, key ) ) {
				if ( !isDefaultOption( key, optionA ) ) {
					return null;
				}
			}
			options[ key ] = optionA;
		}

		return options;
	}

}

function mixCombiningSessionInto( otherClass ) {
	otherClass.prototype.request = CombiningSession.prototype.request;
	otherClass.prototype.combineRequests = CombiningSession.prototype.combineRequests;
	otherClass.prototype.combineParams = CombiningSession.prototype.combineParams;
	otherClass.prototype.combineOptions = CombiningSession.prototype.combineOptions;
}

export {
	mixCombiningSessionInto,
	// note: we don’t export CombiningSession,
	// because we don’t want anyone to check `instanceof CombiningSession`,
	// which wouldn’t work
};
