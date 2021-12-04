# Changelog

This file records the changes in each m3api release.

The annotated tag (and GitHub release) for each version also lists the changes,
but this file may sometimes contain later improvements (e.g. typo fixes).

## next (not yet released)

No changes yet.

## v0.5.0 (2021-12-04)

- BREAKING CHANGE (internal):
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
- BREAKING CHANGE (internal):
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

- BREAKING CHANGE (internal):
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
