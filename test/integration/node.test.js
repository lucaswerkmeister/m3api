/* eslint-env mocha */

import NodeSession from '../../node.js';
import { expect } from 'chai';

describe( 'NodeSession', () => {

	it( 'siteinfo, array siprops, default formatversion', async () => {
		const session = new NodeSession( 'https://en.wikipedia.org/w/api.php', {
			formatversion: 2,
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

} );
