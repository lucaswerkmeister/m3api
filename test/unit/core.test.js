/* eslint-env mocha */

import { ApiErrors, Session } from '../../core.js';
import { expect } from 'chai';

describe( 'ApiErrors', () => {

	it( 'uses first error code as message', () => {
		const errors = [ { code: 'code1' }, { code: 'code2' } ];
		const apiErrors = new ApiErrors( errors );
		expect( apiErrors.message ).to.equal( 'code1' );
	} );

	it( 'sets name', () => {
		const apiErrors = new ApiErrors( [ { code: 'code' } ] );
		expect( apiErrors.name ).to.equal( 'ApiErrors' );
	} );

} );

describe( 'Session', () => {

	const session = new Session( 'https://en.wikipedia.org/w/api.php' );

	describe( 'transformParamValue', () => {
		for ( const [ value, expected ] of [
			[ 'a string', 'a string' ],
			[ 1, '1' ],
			[ 0, '0' ],
			[ [ 'an', 'array' ], 'an|array' ],
			[ [], '' ],
			[ [ 'an', 'array', 'with', '|' ], '\x1fan\x1farray\x1fwith\x1f|' ],
			[ true, '' ],
			[ false, undefined ],
			[ null, undefined ],
			[ undefined, undefined ],
		] ) {
			it( `${value} => ${expected}`, () => {
				const actual = session.transformParamValue( value );
				expect( actual ).to.equal( expected );
			} );
		}
	} );

	it( 'transformParams', () => {
		expect( session.transformParams( {
			string: 'a string',
			one: 1,
			zero: 0,
			anArray: [ 'an', 'array' ],
			anEmptyArray: [],
			anArrayWithPipe: [ 'an', 'array', 'with', '|' ],
			true: true,
			false: false,
			null: null,
			undefined: undefined,
		} ) ).to.eql( {
			string: 'a string',
			one: '1',
			zero: '0',
			anArray: 'an|array',
			anEmptyArray: '',
			anArrayWithPipe: '\x1fan\x1farray\x1fwith\x1f|',
			true: '',
		} );
	} );

	describe( 'throwErrors', () => {

		it( 'formatversion=1', () => {
			expect( () => session.throwErrors( {
				error: { code: 'errorcode' },
			} ) ).to.throw( ApiErrors, 'errorcode' );
		} );

		it( 'formatversion=2', () => {
			expect( () => session.throwErrors( {
				errors: [ { code: 'errorcode' }, { code: 'other' } ],
			} ) ).to.throw( ApiErrors, 'errorcode' );
		} );

	} );

} );
