/* eslint-env jest */

'use strict';

const { ApiErrors, Session } = require( './index' );

describe( 'ApiErrors', () => {

	test( 'uses first error code as message', () => {
		const errors = [ { code: 'code1' }, { code: 'code2' } ];
		const apiErrors = new ApiErrors( errors );
		expect( apiErrors.message ).toBe( 'code1' );
	} );

	test( 'sets name', () => {
		const apiErrors = new ApiErrors( [ { code: 'code' } ] );
		expect( apiErrors.name ).toBe( 'ApiErrors' );
	} );

} );

describe( 'Session', () => {

	const session = new Session( 'https://en.wikipedia.org/w/api.php' );

	test.each( [
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
	] )( 'transformParamValue: %s => %s', ( value, expected ) => {
		const actual = session.transformParamValue( value );
		expect( actual ).toBe( expected );
	} );

	test( 'transformParams', () => {
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
		} ) ).toStrictEqual( {
			string: 'a string',
			one: '1',
			zero: '0',
			anArray: 'an|array',
			anEmptyArray: '',
			anArrayWithPipe: '\x1fan\x1farray\x1fwith\x1f|',
			true: '',
		} );
	} );

} );
