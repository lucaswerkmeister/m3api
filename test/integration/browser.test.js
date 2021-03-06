/* eslint-env mocha */

import BrowserSession, { set } from '../../browser.js';
import '../../node_modules/chai/chai.js'; /* globals expect */

describe( 'BrowserSession', function () {

	this.timeout( 60000 );

	it( 'siteinfo, array siprops, default formatversion+origin', async () => {
		const session = new BrowserSession( 'en.wikipedia.org', {
			formatversion: 2,
			origin: '*',
		}, {
			userAgent: 'm3api-integration-tests',
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

	it( 'validatepassword', async function () {
		const session = new BrowserSession( 'en.wikipedia.org', {
			formatversion: 2,
			origin: '*',
		}, {
			userAgent: 'm3api-integration-tests',
		} );
		const response = await session.request( {
			action: 'validatepassword',
			password: [ 0, 0, 0 ].map( () => ( Math.random() + 1 ).toString( 36 ).slice( 2 ) ).join( '' ),
		}, { method: 'POST' } );
		expect( response.validatepassword.validity ).to.equal( 'Good' );
	} );

} );
