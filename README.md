# m3api

m3api is a **minimal, modern MediaWiki API client**,
a library for interacting with the [MediaWiki Action API][] from JavaScript.

- It is **minimal**: It wraps the MediaWiki API, without much more.
  This library does not have many abstractions above the API,
  as you might find in other libraries (“get page”, “make edit”).
  It’s for people who are comfortable working with the API directly –
  you pass in the same parameters that you’d find in e.g. the [API Sandbox][],
  and get back the original MediaWiki response (JSON-decoded).
  As a general rule, this library only implements features
  that apply to more than one API module.
  (In this respect, m3api is similar to [mediawiki-js][].)

- It is **modern**: It’s based on Promises, provides iterators,
  uses ES6 modules, and so on.
  (Specifically, it’s “modern” as of mid-2021 –
  future updates are expected but not guaranteed.)

It supports both Node.js (using axios) and browsers (using `fetch`).
The browser version has no external dependencies.

## Usage

Here’s an example demonstrating some ways to use m3api:

```js
// you may need to change the import path,
// e.g. ./node_modules/m3api/node.js if installed via npm
import Session from './node.js';

( async () => { // almost-toplevel await ;)

	// create a session from an api.php URL
	const session = new Session( 'https://en.wikipedia.org/w/api.php', {
		// these default parameters will be added to all requests
		formatversion: 2,
		errorformat: 'plaintext',
	} );

	// a sample request to the siteinfo API
	const siteinfoResponse = await session.request( {
		action: 'query',
		meta: 'siteinfo',
		// array parameters are automatically converted
		siprop: [ 'general', 'statistics' ],
	} );
	// one way to handle the response: destructure it
	const { query: {
		general: { sitename },
		statistics: { edits },
	} } = siteinfoResponse;
	console.log( `Welcome to ${sitename}, home to ${edits} edits!` );

	// a slightly contrived example for continuation
	console.log( 'Here are ten local file pages linking to web.archive.org:' );
	// due to miser mode, each request may only return few results,
	// so we need continuation in order to get ten results in total
	let n = 0;
	outer: for await ( const urlResponse of session.requestAndContinue( {
		// requestAndContinue returns an async iterable of responses
		action: 'query',
		list: 'exturlusage',
		euprotocol: 'https',
		euquery: 'web.archive.org',
		eunamespace: [ 6 ], // File:
		eulimit: 'max',
		euprop: [ 'title' ],
	} ) ) {
		for ( const page of urlResponse.query.exturlusage ) {
			console.log( page.title );
			if ( ++n >= 10 ) {
				break outer;
				// once we stop iterating, no more requests are made
			}
		}
	}

} )().catch( console.error );
```

This code works in Node.js, but also in the browser with only two changes:

- import `browser.js` instead of `node.js`
- add `origin: '*'` to the default parameters (anonymous cross-site request)

Other features not demonstrated above:

- m3api detects any error(s) returned by the API,
  and throws them as an `ApiErrors` instance
  (the class can be imported as a non-default export
  of the `browser.js` and `node.js` modules).
  The first error code is used as the message,
  and all the error objects can be accessed as `.errors`.
  (The shape of those objects will depend on the request `errorformat`.)

- To make POST requests instead of GET requests,
  pass an object with a `method` value as the second parameter:
  e.g. `request( { ... }, { method: 'POST' } )`.
  (`requestAndContinue` also supports this.)
  Other options may be added to this object later.

- Apart from strings, numbers, and arrays thereof,
  parameter values can also be booleans, `null`, or `undefined`.
  `false`, `null` and `undefined` parameters are omitted from the request,
  according to their standard meaning in the MediaWiki API.
  `true`, the empty string and the empty array are all _not_ omitted,
  but instead use the empty string as the parameter value;
  for example, you can use `props: []` to override a nonempty default value.

For more details, see also the code-level documentation (JSdoc comments).

## License

Published under the [ISC License][].
By contributing to this software,
you agree to publish your contribution under the same license.

[MediaWiki Action API]: https://www.mediawiki.org/wiki/Special:MyLanguage/API:Main_page
[API Sandbox]: https://en.wikipedia.org/wiki/Special:ApiSandbox
[mediawiki-js]: https://github.com/brettz9/mediawiki-js
[ISC License]: https://spdx.org/licenses/ISC.html
