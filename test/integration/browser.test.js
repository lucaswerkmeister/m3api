/* eslint-env mocha */

import BrowserSession from '../../browser.js';
import '../../node_modules/chai/chai.js'; /* globals expect */

describe( 'BrowserSession', () => {

	it( 'siteinfo, array siprops, default formatversion+origin', async () => {
		const session = new BrowserSession( 'https://en.wikipedia.org/w/api.php', {
			formatversion: 2,
			origin: '*',
		} );
		const response = await session.request( {
			action: 'query',
			meta: 'siteinfo',
			siprop: [ 'general', 'namespaces', 'statistics' ],
		} );
		expect( response.batchcomplete ).to.equal( true ); // would be '' in formatversion 1
		expect( response.query.general.wikiid ).to.equal( 'enwiki' );
		expect( response.query.namespaces[ 1 ].canonical ).to.equal( 'Talk' );
		expect( response.query.statistics.pages ).to.be.above( 0 );
	} );

	it( 'purge', async () => {
		const session = new BrowserSession( 'https://en.wikipedia.org/w/api.php', {
			formatversion: 2,
			origin: '*',
		} );
		const response = await session.request( {
			action: 'purge',
			titles: [ 'Special:BlankPage' ],
		}, 'POST' );
		expect( response.batchcomplete ).to.equal( true );
		expect( response.purge ).to.have.lengthOf( 1 );
		expect( response.purge[ 0 ].special ).to.equal( true );
	} );

} );
