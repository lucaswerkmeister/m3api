/* eslint-env mocha */

import NodeSession, { set } from '../../node.js';
import { expect } from 'chai';
import { File } from 'buffer'; // only available globally since Node 20
import fs from 'fs/promises';
import process from 'process';

const userAgent = 'm3api-integration-tests (https://github.com/lucaswerkmeister/m3api/)';

describe( 'NodeSession', function () {

	this.timeout( 60000 );

	let mediawikiUsername, mediawikiPassword;

	before( 'load credentials', async () => {
		// note: m3api-botpassword has a copy of this code
		mediawikiUsername = process.env.MEDIAWIKI_USERNAME;
		mediawikiPassword = process.env.MEDIAWIKI_PASSWORD;

		if ( !mediawikiUsername || !mediawikiPassword ) {
			let envFile;
			try {
				envFile = await fs.readFile( '.env', { encoding: 'utf8' } );
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
					console.warn( `.env: ignoring bad format: ${ line }` );
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
						console.warn( `.env: ignoring unknown assignment: ${ line }` );
						break;
				}
			}
		}
	} );

	it( 'siteinfo, array siprops, default formatversion', async () => {
		const session = new NodeSession( 'en.wikipedia.org', {
			formatversion: 2,
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
		const session = new NodeSession( 'en.wikipedia.org', {
			formatversion: 2,
		}, {
			userAgent,
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
		const session = new NodeSession( 'test.wikipedia.org', {
			formatversion: 2,
		}, {
			userAgent,
		} );
		const { login: { lgusername: username } } = await session.request( {
			action: 'login',
			lgname: mediawikiUsername,
			lgpassword: mediawikiPassword,
		}, { method: 'POST', tokenType: 'login', tokenName: 'lgtoken' } );
		session.tokens.clear();
		const title = `User:${ username }/m3api test`;
		const text = `Test content (${ new Date().toISOString() }).`;
		await session.request( {
			action: 'edit',
			title,
			text,
			bot: true,
			assert: 'user',
		}, { method: 'POST', tokenType: 'csrf' } );
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

	for ( const { name, getData } of [
		{
			name: 'Blob',
			getData( content ) {
				return new Blob( [ content ], { type: 'image/svg+xml' } );
			},
		},
		{
			name: 'File',
			getData( content ) {
				return new File( [ content ], 'blank.svg', { type: 'image/svg.xml' } );
			},
		},
	] ) {
		const contentA = "<svg xmlns='http://www.w3.org/2000/svg'/>\n";
		const contentB = "<svg xmlns='http://www.w3.org/2000/svg' />\n";
		// eslint-disable-next-line no-loop-func
		it( `upload (${ name })`, async function () {
			if ( !mediawikiUsername || !mediawikiPassword ) {
				return this.skip();
			}

			const session = new NodeSession( 'test.wikipedia.org', {
				formatversion: 2,
			}, {
				userAgent,
			} );
			await session.request( {
				action: 'login',
				lgname: mediawikiUsername,
				lgpassword: mediawikiPassword,
			}, { method: 'POST', tokenType: 'login', tokenName: 'lgtoken' } );
			session.tokens.clear();

			let content = contentA;
			const uploadParams = {
				action: 'upload',
				filename: `m3api test file ${ new Date().getUTCFullYear() }.svg`,
				comment: 'm3api integration test',
				text: 'Minimal file for m3api integration tests. CC0.',
				watchlist: 'nochange',
			};
			const uploadOptions = {
				method: 'POST',
				tokenType: 'csrf',
			};

			let { upload } = await session.request( {
				...uploadParams,
				file: getData( content ),
			}, uploadOptions );

			// check and repeat upload if necessary a few times
			for ( let attempt = 1; attempt < 10; attempt++ ) {
				if ( upload.result === 'Success' ) {
					break;
				}
				const warnings = upload.warnings;

				if ( 'nochange' in warnings ) {
					// switch to the other content
					content = content === contentA ? contentB : contentA;
					upload = ( await session.request( {
						...uploadParams,
						file: getData( content ),
					}, uploadOptions ) ).upload;
					continue;
				}

				// handle warnings about the same content already existing
				delete warnings.exists; // file already exists
				delete warnings.duplicateversions; // same content in old version of same file
				if ( 'duplicate' in warnings ) {
					// same content in file from earlier years?
					if ( warnings.duplicate.every( ( name ) => name.startsWith( 'M3api_test_file_' ) ) ) {
						delete warnings.duplicate;
					}
				}

				if ( Object.keys( warnings ).length === 0 ) {
					// ignore these specific warnings, repeat by file key
					expect( upload ).to.have.property( 'filekey' );
					upload = ( await session.request( {
						...uploadParams,
						filekey: upload.filekey,
						ignorewarnings: true,
					}, uploadOptions ) ).upload;
					continue;
				}
			}

			expect( upload.result, JSON.stringify( upload ) ).to.equal( 'Success' );
		} );
	}

} );
