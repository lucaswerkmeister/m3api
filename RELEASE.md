# Releasing a new m3api version

This file documents (for maintainers) how to make a new m3api release.
For the release notes (for users), see [CHANGES.md](./CHANGES.md).

1. Consider running `npm audit fix`, `npm update`,
   checking `npm outdated`, etc.
   Add any resulting changes to `CHANGES.md`.

1. If [T404511](https://phabricator.wikimedia.org/T404511) isn’t resolved yet,
   manually check that the browser tests work in a browser
   by running `python -m http.server` and opening <http://localhost:8000/browser-test.html>.
   (Don’t use the `file:` protocol, it doesn’t work.)

1. Check if the [access token](https://www.npmjs.com/settings/lucaswerkmeister/tokens)
   used to publish the release from CI is still valid.
   If it isn’t, generate a [new granular access token](https://www.npmjs.com/settings/lucaswerkmeister/tokens/granular-access-tokens/new)
   named “m3api publish GitLab CI”, bypass 2FA enabled,
   no allowed IP ranges ([because](https://github.com/orgs/community/discussions/186022)),
   read and write access to all packages, no organizational access, expires as late as possible,
   then add that to the [m3api group variables](https://gitlab.wikimedia.org/groups/repos/m3api/-/settings/ci_cd#ci-variables),
   replacing the previous `NPM_ACCESS_TOKEN`.

1. Reviewing `CHANGES.md`, decide on the new version number
   (i.e. whether the changes warrant a patch, minor, or major release).

1. Update the version number in `package.json` and `core.json`,
   and add it with the current date to `CHANGES.md`;
   run `npm install` to update `package-lock.json`;
   then commit the changes with a message like “Bump version to *version*”.

1. Push the commit, checking that CI still passes.

1. Create an annotated git tag (<code>git tag -a v*version*</code>).
   The title is the tag name (v*version*),
   the first body line may be a quick summary;
   the rest of the body should be the `CHANGES.md` section
   (in Vim, use `:r CHANGES.md`, then remove other sections),
   reflowed to a maximum width of 72 characters (`gqip` in Vim).

1. Push the tag.

1. On GitLab, wait for CI to publish the release,
   then optionally tweak the release message (formatting) if required.

1. Add a new section for the next release to `CHANGES.md`,
   and commit it with the message “Add CHANGES.md section for next release”:

   > ## next (not yet released)
   >
   > No changes yet.

1. If the release was a minor or even major version,
   release new versions of extension packages bumping their peer dependencies as needed.
