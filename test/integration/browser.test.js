/* eslint-env mocha */

/*
 * This test is supposed to run in a browser,
 * but there’s currently no great way to do that automatically,
 * so in CI and `npm t` it actually runs in Node.js,
 * using its experimental fetch() support.
 * It would be great to fix this – see #23.
 * (You can still manually run it in a browser using browser-test.html.)
 */

import BrowserSession, { set } from '../../browser.js';
import '../../node_modules/chai/chai.js'; /* globals chai */

/* chai isn’t a proper module so we have to import it differently in Node */
/* eslint-disable es-x/no-global-this, es-x/no-top-level-await, es-x/no-dynamic-import */
let expect;
if ( 'chai' in globalThis ) {
	expect = chai.expect;
} else {
	expect = ( await import( '../../node_modules/chai/chai.js' ) ).default.expect;
}
/* eslint-enable es-x/no-global-this, es-x/no-top-level-await, es-x/no-dynamic-import */

const userAgent = 'm3api-integration-tests (https://github.com/lucaswerkmeister/m3api/)';

describe( 'BrowserSession', function () {

	this.timeout( 60000 );

	it( 'siteinfo, array siprops, default formatversion+origin', async () => {
		const session = new BrowserSession( 'en.wikipedia.org', {
			formatversion: 2,
			origin: '*',
		}, {
			userAgent,
		} );
		const response = await session.request( {
			action: 'query',
			meta: set( 'siteinfo' ),
			siprop: set( 'general', 'namespaces', 'statistics' ),
		} );
		expect( response.batchcomplete ).to.equal( true ); // would be '' in formatversion 1
		expect( response.query.general.wikiid ).to.equal( 'enwiki' );
		expect( response.query.namespaces[ 1 ].canonical ).to.equal( 'Talk' );
		expect( response.query.statistics.pages ).to.be.above( 0 );
	} );

	it( 'validatepassword', async () => {
		const session = new BrowserSession( 'en.wikipedia.org', {
			formatversion: 2,
			origin: '*',
		}, {
			userAgent,
		} );
		const response = await session.request( {
			action: 'validatepassword',
			password: [ 0, 0, 0 ].map( () => ( Math.random() + 1 ).toString( 36 ).slice( 2 ) ).join( '' ),
		}, { method: 'POST' } );
		expect( response.validatepassword.validity ).to.equal( 'Good' );
	} );

} );
