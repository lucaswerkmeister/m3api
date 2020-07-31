'use strict';

const axios = require( 'axios' );

const defaultUserAgent = 'myapi/0.1.0 (myapi@lucaswerkmeister.de)';

class ApiErrors extends Error {

	constructor( errors, ...params ) {
		super( errors[ 0 ].code, ...params );

		if ( Error.captureStackTrace ) {
			Error.captureStackTrace( this, ApiErrors );
		}

		this.name = 'ApiErrors';
		this.errors = errors;
	}

}

class Session {

	constructor( apiUrl, defaultParams = {}, userAgent = '' ) {
		this.session = axios.create( {
			baseURL: apiUrl,
			headers: {
				common: {
					'user-agent': userAgent
						? `${userAgent} ${defaultUserAgent}`
						: defaultUserAgent,
				},
			},
		} );
		this.defaultParams = defaultParams;
	}

	async request( params, method = 'GET' ) {
		const response = await this.session.request( {
			method,
			[ method === 'GET' ? 'params' : 'data' ]: this.transformParams( {
				...this.defaultParams,
				...params,
				format: 'json',
			} ),
		} );
		this.throwErrors( response.data );
		return response.data;
	}
	
	async * requestAndContinue( params, method = 'GET' ) {
		const baseParams = this.transformParams( {
			...this.defaultParams,
			...params,
			format: 'json',
		} );
		let continueParams = {};
		do {
			const response = await this.session.request( {
				method,
				[ method === 'GET' ? 'params' : 'data' ]: {
					...baseParams,
					...continueParams,
				},
			} );
			this.throwErrors( response.data );
			continueParams = response.data.continue || {};
			yield response.data;
		} while ( Object.keys( continueParams ).length > 0 );
	}

	transformParams( params ) {
		const transformedParams = {};
		for ( const [ key, value ] of Object.entries( params ) ) {
			const transformedParamValue = this.transformParamValue( value );
			if ( transformedParamValue !== undefined ) {
				transformedParams[ key ] = transformedParamValue;
			}
		}
		return transformedParams;
	}

	transformParamValue( value ) {
		if ( Array.isArray( value ) ){
			if ( value.some( ( element ) => /[|]/.test( element ) ) ) {
				return '\x1f' + value.join( '\x1f' );
			} else {
				return value.join( '|' );
			}
		}
		if ( typeof value === 'number' ) {
			return String( value );
		}
		if ( value === true ) {
			return '';
		}
		if ( value === false || value === null || value === undefined ) {
			return undefined;
		}
		return value;
	}

	throwErrors( response ) {
		if ( 'error' in response ) {
			throw new ApiErrors( [ response.error ] );
		}
		if ( 'errors' in response ) {
			throw new ApiErrors( response.errors );
		}
	}

}

module.exports = {
	ApiErrors,
	Session,
};
