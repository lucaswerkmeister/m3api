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
import Session, { set } from './node.js';

// note: this example uses top-level await for simplicity,
// you may need an async wrapper function

// create a session from a wiki domain (or full api.php URL)
const session = new Session( 'en.wikipedia.org', {
	// these default parameters will be added to all requests
	formatversion: 2,
	errorformat: 'plaintext',
}, {
	// these default options will apply to all requests
	userAgent: 'm3api-README-example',
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

// another way to get the same result
async function getSiteName( session ) {
	const response = await session.request( {
		action: 'query',
		// set parameters may be combined with other requests
		meta: set( 'siteinfo' ),
		siprop: set( 'general' ),
	} );
	return response.query.general.sitename;
}
async function getSiteEdits( session ) {
	const response = await session.request( {
		action: 'query',
		meta: set( 'siteinfo' ),
		siprop: set( 'statistics' ),
	} );
	return response.query.statistics.edits;
}
// the following two concurrent API requests will be automatically combined,
// sending a single request with siprop=general|statistics,
// because they are compatible (set parameters get merged, others are equal)
const [ sitename_, edits_ ] = await Promise.all( [
	getSiteName( session ),
	getSiteEdits( session ),
] );
console.log( `Welcome back to ${sitename_}, home to ${edits_} edits!` );

// a slightly contrived example for continuation
console.log( 'Here are ten local file pages linking to web.archive.org:' );
// due to miser mode, each request may only return few results,
// so we need continuation in order to get ten results in total
let n = 0;
outer: for await ( const urlResponse of session.requestAndContinue( {
	// requestAndContinue returns an async iterable of responses
	action: 'query',
	list: set( 'exturlusage' ),
	euprotocol: 'https',
	euquery: 'web.archive.org',
	eunamespace: [ 6 ], // File:
	eulimit: 'max',
	euprop: set( 'title' ),
} ) ) {
	for ( const page of urlResponse.query.exturlusage ) {
		console.log( page.title );
		if ( ++n >= 10 ) {
			break outer;
			// once we stop iterating, no more requests are made
		}
	}
}
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

- Any warnings returned by the API are also detected.
  You can specify a custom `warn` handler function in the request options;
  by default, warnings are logged to the console in the browser,
  and also in Node.js if NODE_ENV is set to “development”.
  Node.js users that aren’t CLI applications
  (e.g. bots or tool backends)
  are encouraged to pass `warn: console.warn` in the default request options in the constructor
  (along with the `userAgent` option),
  to ensure that warnings are visible and can be acted on.

- To make POST requests instead of GET requests,
  pass an object with a `method` value as the second parameter:
  e.g. `request( { ... }, { method: 'POST' } )`.
  (`requestAndContinue` also supports this.)

- If the API response contains a Retry-After header
  (most common case: you specified the `maxlag` parameter and lag is currently higher),
  the request will automatically be retried once by default
  (after waiting for the amount of time specified in the header).
  You can change this with the `maxRetries` request option:
  e.g. `request( { ... }, { maxRetries: 3 } )`.
  Set `maxRetries` to 0 to disable this feature entirely.

- Apart from strings, numbers, and arrays and sets thereof,
  parameter values can also be booleans, `null`, or `undefined`.
  `false`, `null` and `undefined` parameters are omitted from the request,
  according to their standard meaning in the MediaWiki API.
  `true`, the empty string, the empty array and the empty set are all _not_ omitted,
  but instead use the empty string as the parameter value;
  for example, you can use `props: []` to override a nonempty default value.

- The `responseBoolean` helper can be used to get a boolean from a response object.
  For example, `responseBoolean( response.query.general.rtl )` returns `true`
  if `response.query.general` had `rtl: ""` (`formatversion=1`) or `rtl: true` (`formatversion=2`).
  This is mostly useful in library code, when you don’t know the `formatversion` of the response;
  you can import the helper from `core.js` (but not `browser.js` or `node.js`).

For more details, see also the code-level documentation (JSdoc comments).

### Automatically combining requests

One m3api feature deserves a more detailed discussion:
how it automatically combines concurrent, compatible API requests.

- API requests are **concurrent** if they are made within the same JS call stack,
  or (in other words) in the same “callback”.
  Technically, as soon as m3api receives a request,
  it queues a microtask (using `Promise.resolve()`) to dispatch it,
  and only other requests which arrive before that microtask runs have a chance to be combined with it.
- API requests are **compatible** if they have the same options,
  and all the parameters they have in common are compatible.
  Parameters are compatible if they’re identical
  (after simple transformations like `2` → `"2"`),
  or if they’re both sets, in which case they’re merged for the combined request.
  (The `set( ... )` function, which can be imported from `node.js` and `browser.js`,
  is just a shortcut for `new Set( [ ... ] )`.)

To take advantage of this feature,
it’s recommended to use `set( ... )` instead of `[ ... ]` for most “list-like” API paremeters,
even if you’re only specifying a single set element,
as long as that parameter is safe to merge with other requests.
For example, consider this request from the usage example above:

```js
session.requestAndContinue( {
	action: 'query',
	list: set( 'exturlusage' ),
	euprotocol: 'https',
	euquery: 'web.archive.org',
	eunamespace: [ 6 ], // File:
	eulimit: 'max',
	euprop: set( 'title' ),
} )
```

Let’s go through those parameters in turn:

- `action: 'query'`: There can only be one action at a time,
  so this parameter has a single value.
- `list: set( 'exturlusage' )`: The query API supports multiple lists at once,
  and it doesn’t matter to us if there are other lists in the response
  (they’ll be tucked away under a different key in the result),
  so we specify this as a set.
  If another request has e.g. `list: set( 'allpages' )`,
  then the remaining parameters of that request will probably start with `ap*`
  (the `list=allpages` API parameter prefix),
  so they won’t conflict with our `eu*` parameters.
- `euprotocol: 'https'`: Must be a single value.
- `euquery: 'web.archive.org'`: Must be a single value.
- `eunamespace: [ 6 ]`: Here we specify an array, not a set.
  The parameter can take multiple values in the API,
  but we want results limited to just the file namespace,
  and if this parameter was a set,
  we might get results from other namespaces due to merged requests.
  The alternative would be to specify this as `eunamespace: set( 6 )`,
  but then to check the namespace of each result we get,
  so that we skip results from other namespaces,
  and only process the ones we really wanted.
- `eulimit: 'max'`: Must be a single value.
- `euprop: set( 'title' )`: Here we use a set again,
  because we don’t mind if other requests add extra properties to each result,
  as long as the title itself is included.
  Note that the default value for this parameter is `ids|title|url`,
  so if we didn’t specify it at all,
  we would probably get the data we need as well;
  however, if our request was then combined with another request,
  and that request had `euprop: set( 'ids' )`,
  then we wouldn’t get the title in our request.

The last point is worth elaborating on:
**don’t just rely on default parameter values if your requests may be combined with others.**
This is most important when you’re writing library code
(similar to the `getSiteName` and `getSiteEdits` functions in the usage example above),
where you don’t know which other requests may be made at any time;
if you’re directly making API requests from an application,
you may know that no other concurrent requests will be made at a certain time,
and could get away with relying on default parameters.

To avoid just relying on default parameter values, you have several options:

1. Explicitly specify a value for the parameter,
   either the default or (as with `title` vs. `ids|title|url` above) a part of it.
2. Explicitly specify the parameter as `null` or `undefined`.
   This means that the parameter won’t be sent with the request
   (i.e. the server-side default will be used),
   but makes the request incompatible with any other request that has a different value for the parameter.
   (This is similar to using an array instead of a set, as we saw for `eunamespace` above:
   both strategies inhibit merging with some other requests.)
3. Process the response in a way that works regardless of parameter value.
   This is not always possible, but as an example, with a bit of extra code,
   you may be able to process both `formatversion=1` and `formatversion=2` responses
   (see also the `responseBoolean` helper function).

## License

Published under the [ISC License][].
By contributing to this software,
you agree to publish your contribution under the same license.

[MediaWiki Action API]: https://www.mediawiki.org/wiki/Special:MyLanguage/API:Main_page
[API Sandbox]: https://en.wikipedia.org/wiki/Special:ApiSandbox
[mediawiki-js]: https://github.com/brettz9/mediawiki-js
[ISC License]: https://spdx.org/licenses/ISC.html
