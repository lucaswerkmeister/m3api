/* eslint-env mocha */

import NodeSession from '../../node.js';
import { expect } from 'chai';
import 'dotenv/config';

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

	it( 'validatepassword', async function () {
		const session = new NodeSession( 'https://en.wikipedia.org/w/api.php', {
			formatversion: 2,
		} );
		const response = await session.request( {
			action: 'validatepassword',
			password: [ 0, 0, 0 ].map( () => ( Math.random() + 1 ).toString( 36 ).slice( 2 ) ).join( '' ),
		}, { method: 'POST' } );
		expect( response.validatepassword.validity ).to.equal( 'Good' );
	} );

	it( 'login, edit', async function () {
		if ( !( 'MEDIAWIKI_USERNAME' in process.env && 'MEDIAWIKI_PASSWORD' in process.env ) ) {
			return this.skip();
		}
		this.timeout( 10000 ); // this test makes a lot of requests
		const session = new NodeSession( 'https://en.wikipedia.beta.wmflabs.org/w/api.php', {
			formatversion: 2,
		} );
		const { query: { tokens: { logintoken } } } = await session.request( {
			action: 'query',
			meta: [ 'tokens' ],
			type: [ 'login' ],
		} );
		const { login: { lgusername: username } } = await session.request( {
			action: 'login',
			lgname: process.env.MEDIAWIKI_USERNAME,
			lgpassword: process.env.MEDIAWIKI_PASSWORD,
			lgtoken: logintoken,
		}, { method: 'POST' } );
		const { query: { tokens: { csrftoken } } } = await session.request( {
			action: 'query',
			meta: [ 'tokens' ],
			type: [ 'csrf' ],
		} );
		const title = `User:${username}/m3api test`;
		const text = `Test content (${new Date().toISOString()}).`;
		await session.request( {
			action: 'edit',
			title,
			text,
			token: csrftoken,
			bot: true,
			assert: 'user',
		}, { method: 'POST' } );
		const { query: { pages: [ page ] } } = await session.request( {
			action: 'query',
			titles: [ title ],
			prop: [ 'revisions' ],
			rvprop: [ 'content' ],
			rvslots: [ 'main' ],
		} );
		const { revisions: [ { slots: { main: { content } } } ] } = page;
		expect( content ).to.equal( text );
	} );

} );
