/* eslint-env mocha */

import NodeSession, { set } from '../../node.js';
import { expect } from 'chai';
import fs from 'fs';
import process from 'process';

describe( 'NodeSession', function () {

	this.timeout( 60000 );

	let mediawikiUsername, mediawikiPassword;

	before( 'load credentials', async () => {
		mediawikiUsername = process.env.MEDIAWIKI_USERNAME;
		mediawikiPassword = process.env.MEDIAWIKI_PASSWORD;

		if ( !mediawikiUsername || !mediawikiPassword ) {
			let envFile;
			try {
				envFile = await fs.promises.readFile( '.env', { encoding: 'utf8' } );
			} catch ( e ) {
				if ( e.code === 'ENOENT' ) {
					return;
				} else {
					throw e;
				}
			}

			for ( let line of envFile.split( '\n' ) ) {
				line = line.trim();
				if ( line.startsWith( '#' ) || line === '' ) {
					continue;
				}

				const match = line.match( /^([^=]*)='([^']*)'$/ );
				if ( !match ) {
					console.warn( `.env: ignoring bad format: ${line}` );
					continue;
				}
				switch ( match[ 1 ] ) {
					case 'MEDIAWIKI_USERNAME':
						if ( !mediawikiUsername ) {
							mediawikiUsername = match[ 2 ];
						}
						break;
					case 'MEDIAWIKI_PASSWORD':
						if ( !mediawikiPassword ) {
							mediawikiPassword = match[ 2 ];
						}
						break;
					default:
						console.warn( `.env: ignoring unknown assignment: ${line}` );
						break;
				}
			}
		}
	} );

	it( 'siteinfo, array siprops, default formatversion', async () => {
		const session = new NodeSession( 'en.wikipedia.org', {
			formatversion: 2,
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
		const session = new NodeSession( 'en.wikipedia.org', {
			formatversion: 2,
		}, {
			userAgent: 'm3api-integration-tests',
		} );
		const response = await session.request( {
			action: 'validatepassword',
			password: [ 0, 0, 0 ].map( () => ( Math.random() + 1 ).toString( 36 ).slice( 2 ) ).join( '' ),
		}, { method: 'POST' } );
		expect( response.validatepassword.validity ).to.equal( 'Good' );
	} );

	it( 'login, edit', async function () {
		if ( !mediawikiUsername || !mediawikiPassword ) {
			return this.skip();
		}
		const session = new NodeSession( 'en.wikipedia.beta.wmflabs.org', {
			formatversion: 2,
		}, {
			userAgent: 'm3api-integration-tests',
		} );
		const { query: { tokens: { logintoken } } } = await session.request( {
			action: 'query',
			meta: set( 'tokens' ),
			type: set( 'login' ),
		} );
		const { login: { lgusername: username } } = await session.request( {
			action: 'login',
			lgname: mediawikiUsername,
			lgpassword: mediawikiPassword,
			lgtoken: logintoken,
		}, { method: 'POST' } );
		const { query: { tokens: { csrftoken } } } = await session.request( {
			action: 'query',
			meta: set( 'tokens' ),
			type: set( 'csrf' ),
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
			titles: [ title ], // not set(), we destructure assuming a single page
			prop: set( 'revisions' ),
			rvprop: set( 'content' ),
			rvslots: set( 'main' ),
		} );
		const { revisions: [ { slots: { main: { content } } } ] } = page;
		expect( content ).to.equal( text );
	} );

} );
