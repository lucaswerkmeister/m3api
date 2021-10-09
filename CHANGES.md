# Changelog

This file records the changes in each m3api release.

The annotated tag (and GitHub release) for each version also lists the changes,
but this file may sometimes contain later improvements (e.g. typo fixes).

## v0.2.1 (upcoming)

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
