# Changelog

This file records the changes in each m3api release.

The annotated tag (and GitHub release) for each version also lists the changes,
but this file may sometimes contain later improvements (e.g. typo fixes).

## next (not yet released)

No changes yet.

## v0.8.1 (2023-11-12)

- Updated undici, avoiding [CVE-2023-45143][].
  The potential impact of this security vulnerability should have been very low:
  when using the fetch-node backend and a cookie-based session type,
  an attacker with the ability to create an open redirect on the target API
  could potentially have obtained session cookies for the API.
  (I see no reason to expect an open redirect vulnerability to exist in the action API:
  I’m not aware of any API action that issues HTTP-level redirects at all.)
- Updated dependencies.

## v0.8.0 (2023-07-10)

- BREAKING CHANGE:
  m3api now requires at least Node.js version 18.2.0,
  up from Node 12.22.0 or Node 14.17.0 previously.
  The internal breaking changes below are also related to this.
- Internal Breaking Change:
  The file `add-performance-global.js` has been removed,
  as it is no longer needed.
- Internal Breaking Change:
  The file `axios.js` has been removed,
  as axios is no longer used.
  Its role has been taken over by `fetch-node.js`.
- Internal Breaking Change:
  The file `fetch.js` is no longer suitable for use in Chrome-like browsers.
  The functionality of renaming the `user-agent` request header to `api-user-agent`
  has been moved to `fetch-browser.js`.
- m3api now uses `fetch()` on all supported platforms.
  The public interface, `browser.js` and `node.js`, can be used as before.
  The internal interface has been rearranged,
  with `fetch.js` now used for both backends,
  augmented by `fetch-browser.js` and `fetch-node.js`.
- m3api now supports `Blob` and `File` parameters in POST requests.
  This can be used to upload files.
- Improved `README.md` formatting for npmjs.com.
- Updated dependencies.

## v0.7.3 (2023-04-11)

- The new `errorHandlers` option can be used to customize error handling.
  It is only part of the internal interface, not of the stable, public interface.
  Using this options, extension packages or end users can register handlers for certain API error codes;
  the handlers can e.g. perform necessary cleanup actions and/or retry the request.
  The existing support for retrying after `maxlag`, `readonly` or `badtoken` errors
  is now also internally implemented in terms of this new option.
- Updated dependencies.

## v0.7.2 (2022-12-04)

- Internal Breaking Change:
  The signature of the `internalGet()` and `internalPost()` methods has changed;
  an `apiUrl` string has been added as the first parameter,
  and the last parameter is now a `headers` object instead of a `userAgent` string.
  The `apiUrl` should always be used instead of `this.apiUrl`.
  In `headers`, the header names are always in all-lowercase,
  so you can safely get the `userAgent` value as `headers['user-agent']`.
- m3api now has a stable interface policy, see [README.md § stability](README.md#Stability).
  Internal breaking changes, such as the one above, do not require bumping the major version number.
- The new `authorization` request option can be used to set an `Authorization:` request header.
  This will be used by the upcoming [m3api-oauth2][] package to support OAuth 2.0;
  you can also use it directly using the access token of an owner-only client.
- The `apiUrl` member of a `Session` is now public.
  This will be used by m3api-oauth2.
- A new protected method, `getUserAgent()`, can be used to get the user agent for a request.
  This will be used by m3api-oauth2.
- The `dropTruncatedResultWarning` option didn’t work properly
  when using the default `errorformat` on current MediaWiki versions;
  this has been fixed.
  (It’s still a good idea to set a non-`bc` error format in general.)
- Exclude axios 1.2.0, which should not be used due to a bug.
- Updated other dependencies.

## v0.7.1 (2022-11-12)

- Publish documentation on GitHub pages:
  [latest version][m3api-doc-latest], [v0.7.1][m3api-doc-v0.7.1].
- Add a `@typedef` for `Options`, the request options;
  this may help if you are using m3api with TypeScript or in an IDE.
- Updated dependencies.

## v0.7.0 (2022-10-19)

- BREAKING CHANGE:
  A new request option, `maxRetriesSeconds`, limits the total duration of retried requests,
  replacing the previous `maxRetries` option that limited the *number* of retried requests.
  It defaults to 65 seconds, which should be enough to cover a typical brief read-only period on Wikimedia wikis.
  Interactive applications may wish to use a lower value,
  to show an error to users earlier rather than waiting for a long time.
  The previous `maxRetries` option should no longer be used.
- m3api can now automatically add token parameters to requests,
  controlled by the two new request options `tokenType` and `tokenName`.
  The most common case, e.g. for `action=edit`,
  is to use `tokenType: 'csrf'` with the default `tokenName` (`'token'`).
  m3api will automatically fetch and cache the token
  (and this internal request can be automatically combined with other `action=query` requests),
  discarding stale tokens and retrying upon encountering a `badtoken` error.
  Tokens are cached in the public `Session.tokens` Map,
  which users and extension packages are encouraged to `clear()` after changing the session state (e.g. login),
  to avoid the overhead of a `badtoken` error.
  (Note that the [m3api-botpassword][] extension package does this for you.)
- The public interface of m3api has been clarified.
  Most importantly, `Session.defaultParams`,
  `Session.defaultOptions` and `DEFAULT_OPTIONS` have been declared public,
  and extension packages are encouraged to use the latter two for their own options as well.
  Guidelines for extension packages have also been added to the README.
- Requests that produced `maxlag` or `readonly` errors are now automatically retried,
  even if the response did not include a `Retry-After` response header.
  (Currently, MediaWiki only sends this header for `maxlag` errors.)
  Two new request options, `retryAfterMaxlagSeconds` and `retryAfterReadonlySeconds`,
  control the default retry delay (in seconds) for these errors.
  The defaults of 5 and 30 seconds respectively are intended to be useful for Wikimedia wikis.
  If you increase these values, don’t forget to increase `maxRetriesSeconds` as well.
- The Node.js backend (specifically `axios.js`)
  now keeps the network connection alive (using Node’s default Keep-Alive settings),
  which can speed up consecutive API requests (e.g. to get and then use a token).
- Requests with technically different options can be combined in some more situations.
  Specifically, a request explicitly specifying a default option is compatible
  with a request not specifying the option at all (both will use the default),
  and the `dropTruncatedResultWarning` option does not affect compatibility at all
  (the option is handled while combining requests,
  so that truncated result warnings are only sent to the correct requests).
- Updated dependencies.

## v0.6.1 (2022-05-21)

- A new request option, `dropTruncatedResultWarning`, is available.
  Previously, this behavior was hard-coded in `requestAndContinueReducingBatch()`;
  now, it can be optionally enabled in `request()` and `requestAndContinue()`,
  or disabled in `requestAndContinueReducingBatch()`.
  By default, the option is enabled in the latter function and disbled in the former two,
  so there is no change in behavior unless you set the option with a request.
- Updated dependencies.

## v0.6.0 (2022-03-27)

- BREAKING CHANGE:
  Warnings are now always logged to the console by default.
  Previously, the Node.js backend only did this if NODE_ENV = “development” was set.
  If you use m3api for an interactive CLI application on Node.js,
  you may want to configure a custom `warn` handler
  (using the second constructor argument, next to the `userAgent` option),
  so that warnings are not shown to end users.
  You should make sure that the warnings still reach the developers, though.
- BREAKING CHANGE:
  It is no longer possible to modify continuation
  by modifying the contents of a response’s `continue` member;
  continuation now always proceeds according to the original `continue` contents.
  The fact that this previously worked was not intended,
  and if any code actually behaves differently due to this change,
  it is assumed that the previous behavior was a bug rather than intended.
  If you really want to modify continuation,
  implement it yourself instead of using `requestAndContinue`.
- A new function, `requestAndContinueReducingBatch`,
  is available to work with continuation.
  It is useful in cases where data for a batch of pages is spread across multiple responses,
  i.e. in cases where not every response is marked `batchcomplete`.
  (An example is generator=search with prop=revisions:
  the generator can yield up to 500 results per response,
  but revisions are limited to 50,
  so ten requests are required to get the revisions of the whole batch,
  after which the next batch of 500 search results can commence.)
  It is expected to be mainly used in libraries,
  such as the upcoming [m3api-query][].
- The Node.js backend (specifically `axios.js`)
  now requests gzip compression of the response from the server,
  which should reduce network traffic somewhat.
- Fixed a bug in handling warnings for combined requests.
- The “modern” requirements of m3api,
  i.e. compatibility with different platforms,
  are documented in the README now.
- Updated dependencies.

## v0.5.0 (2021-12-04)

- Internal Breaking Change:
  The `Session` constructor now requires the default request options to include `warn`,
  which must be a function.
  The `fetch.js` and `axios.js` backends already add a default for this option,
  so this is only relevant for you if you wrote a custom network implementation;
  if you just import `browser.js` or `node.js`, it doesn’t matter.
- The first constructor argument can now be a domain name instead of a full `api.php` URL,
  e.g. `en.wikipedia.org` instead of `https://en.wikipedia.org/w/api.php`.
- Requests that do not specify a user agent will now trigger a warning,
  limited to once per session.
  If you see this warning, you should add a user agent to your requests –
  see the [User-Agent policy][].
  Usually you would add it to the default options at construction time:
  ```js
  const session = new Session( 'en.wikipedia.org', {
      formatversion: 2,
	  // other default params...
  }, {
	  userAgent: 'my-cool-tool',
	  // other default options...
  } );
  ```
  But it can also be specified for an individual request:
  ```js
  const response = await session.request( {
      action: 'query',
	  // other params...
  }, {
	  userAgent: 'my-cool-tool',
	  // other options...
  } );
  ```
  Recall that the default warning handler is `console.warn` in the browser,
  and also in Node.js if NODE_ENV = “development” is set,
  but otherwise the Node.js backend ignores warnings.

## v0.4.0 (2021-11-13)

- BREAKING CHANGE:
  The third constructor parameter is now an object with default request options,
  and the user agent string is just one option, under the `userAgent` key.
  Convert constructor calls like `new Session( ..., {}, 'user-agent' )`
  to `new Session( ..., {}, { userAgent: 'user-agent' } )` instead.
- Internal Breaking Change:
  The `internalGet` and `internalPost` methods now receive an additional parameter,
  the user agent string, which should be used instead of the constructor option.
  This is only relevant for you if you wrote a custom network implementation;
  if you just import `browser.js` or `node.js`, it doesn’t matter.
- Thanks to the constructor change mentioned above,
  the `userAgent` request option can now specified for an individual request if you want to,
  and conversely other options like `maxRetries` can be defaulted in the constructor.
- Added the `warn` request option,
  which can be used to handle warnings from a request.
  In the browser, and with NODE_ENV = “development” in Node.js,
  warnings are sent to the console by default.
  If you use the Node.js backend, but not for a CLI application,
  consider logging warnings regardless of environment
  by adding `warn: console.warn` to the default request options
  (or use a custom warning handler).
- Added the `responseBoolean` utility function,
  to get a boolean out of a response value regardless of `formatversion`.
- Updated dependencies.

## v0.3.0 (2021-10-10)

- m3api now automatically combines concurrent compatible API requests.
  To make use of this feature, import the `set()` helper as a named import,
  and then use `set( ... )` instead of `[ ... ]` for list-like parameters
  where additional values from other requests can be safely added,
  such as `action=query`’s `prop`, `list` and `meta` parameters.
  For more information, see the updated README,
  especially the new “automatically combining requests” section.
- Updated dependencies.

## v0.2.1 (2021-10-09)

- Updated axios, avoiding [CVE-2021-3749][].
  The potential impact of this security vulnerability should have been fairly low:
  when using the axios backend (but not the fetch backend),
  a malicious API server could have provoked long processing times,
  by sending response headers with long sequences of interior whitespace.
  This would likely have required custom server software,
  since common servers like Apache and nginx limit the maximum header length,
  and the performance impact appears to be negligible at 8K characters.
- Updated other dependencies.

## v0.2.0 (2021-09-09)

First proper update over a previous release.

- Internal Breaking Change:
  The `internalGet` and `internalPost` methods now return additional data.
  This is only relevant for you if you wrote a custom network implementation;
  if you just import `browser.js` or `node.js`, it doesn’t matter.
- Automatically retry requests when encountering a Retry-After response header.
  By default, retry once; adjust or disable with the `maxRetries` request option.
- A non-200 HTTP response status is now detected and throws an error.
- Improved the default user agent.
- Added package metadata.

## v0.1.2 (2021-08-19)

First proper release successfully published on npm.
No actual change from v0.1.1 apart from the version number.

## v0.1.1 (2021-08-17)

First release on npm.
However, at the time this release was published,
the npm registry was apparently confused due to the 0.1.0 release (see below),
so the package could not be installed until I fixed the issue by publishing v0.1.2.
In theory you can now install this version, but there’s absolutely no reason to.
No functional change from v0.1.0.

## v0.1.0 (2021-08-16)

First release ever published.
I ran `npm publish` in my working tree with some extra files in it and didn’t notice until it was too late,
so I unpublished the package from npm again and also deleted the Git tag.
The Git commit for this version was probably 00e278a13b50cc903b6fb3d530033098d3a21c90,
but I see no reason to recreate the tag now.

[CVE-2021-3749]: https://github.com/advisories/GHSA-cph5-m8f7-6c5x
[User-Agent policy]: https://meta.wikimedia.org/wiki/Special:MyLanguage/User-Agent_policy
[m3api-query]: https://www.npmjs.com/package/m3api-query
[m3api-botpassword]: https://www.npmjs.com/package/m3api-botpassword
[m3api-doc-latest]: https://lucaswerkmeister.github.io/m3api/
[m3api-doc-v0.7.1]: https://lucaswerkmeister.github.io/m3api/v0.7.1/
[m3api-oauth2]: https://www.npmjs.com/package/m3api-oauth2
[CVE-2023-45143]: https://github.com/advisories/GHSA-wqq4-5wpv-mx2g
