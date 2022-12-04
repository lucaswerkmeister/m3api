# Releasing a new m3api version

This file documents (for maintainers) how to make a new m3api release.
For the release notes (for users), see [CHANGES.md](./CHANGES.md).

1. Consider running `npm audit fix`, `npm update`,
   checking `npm outdated`, etc.
   Add any resulting changes to `CHANGES.md`.

2. Reviewing `CHANGES.md`, decide on the new version number
   (i.e. whether the changes warrant a patch, minor, or major release).

3. Update the version number in `package.json` and `core.json`,
   and add it with the current date to `CHANGES.md`;
   run `npm install` to update `package-lock.json`;
   then commit the changes with a message like “Bump version to *version*”.

4. Push the commit, checking that CI still passes.

5. Create an annotated git tag (<code>git tag -a v*version*</code>).
   The title is the tag name (v*version*),
   the first body line may be a quick summary;
   the rest of the body should be the `CHANGES.md` section
   (in Vim, use `:r CHANGES.md`, then remove other sections),
   reflowed to a maximum width of 72 characters (`gqip` in Vim).

6. Push the tag.

7. On GitHub, turn the tag into a proper release.
   Use the tag message for the release notes,
   but with line breaks removed.
   Once the release is published, CI will automatically publish it to npm.

8. Add a new section for the next release to `CHANGES.md`,
   and commit it with the message “Add CHANGES.md section for next release”:

   > ## next (not yet released)
   >
   > No changes yet.
