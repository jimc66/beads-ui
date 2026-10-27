# Releasing this fork

This fork is distributed as a **prebuilt tarball attached to a GitHub Release**,
not via the npm registry. Users install it with a plain `npm install -g <url>`,
without cloning the repo or needing an npm account.

## Why a release tarball (and not `npm install -g github:owner/repo`)

Installing globally straight from a git ref (`npm install -g github:owner/repo`)
clones the repo into npm's cache and, on some npm/Node versions, leaves a
**broken symlink** in the global `node_modules` (pointing into
`~/.npm/_cacache/tmp/git-clone*`, which npm then deletes). The result is a
dangling link and an unusable `bdui`.

A tarball downloaded over HTTPS is neither a git clone nor a local path, so npm
**extracts it into a real directory** — sidestepping that behavior. That is why
the install URL points at a release asset, not the repo.

The frontend bundle (`app/main.bundle.js`) is gitignored and built on demand;
`npm pack` runs the `prepack` script, which builds the bundle into the tarball.
So the published tarball is complete even though the repo does not commit the
bundle.

## The `latest` asset

Each release carries the same tarball twice: once as `beads-ui-<version>.tgz`
and once as `beads-ui-latest.tgz`. They are byte-identical copies.

The duplicate exists so consumers have a URL that never changes:

```
https://github.com/<owner>/beads-ui/releases/latest/download/beads-ui-latest.tgz
```

GitHub's `/releases/latest/download/<asset>` redirects to that asset on the most
recent non-prerelease release, but the asset **name** has to be spelled in the
URL. The versioned name carries the upstream npm version, so it changes whenever
the fork rebases onto a new mainline release — which would break any URL built
from it. A fixed name is what makes the redirect durable.

This is the registry `latest` dist-tag done by hand. A published npm package
would get it for free; this fork is distributed as release tarballs instead (see
above), and GitHub offers no "the only `.tgz` in the latest release" URL, so the
stable name is supplied at upload time.

The versioned asset stays because pinning is still worth doing deliberately — to
reproduce a report against an exact build, or to hold a known-good version while
a regression is sorted out.

## Cutting a release

Prerequisites: `npm install` has been run in the repo (dev dependencies present,
needed for the esbuild build), and `gh` is authenticated.

1. Be on an up-to-date `main`:

   ```bash
   git checkout main && git pull
   ```

2. Build and pack. `npm pack` runs `prepack` (the build) automatically and
   writes `beads-ui-<version>.tgz`. Copy it to the fixed name as well, so the
   release carries both (see [The `latest` asset](#the-latest-asset)):

   ```bash
   npm pack
   cp -f beads-ui-*.tgz beads-ui-latest.tgz
   ```

3. Sanity-check that the tarball contains the built UI before publishing it:

   ```bash
   tar -tzf beads-ui-*.tgz | grep -E 'app/index.html|app/main.bundle.js'
   ```

4. Create the release and attach the tarball. Use a tag that distinguishes this
   fork build from upstream's tag (e.g. `v<version>-fork.N`):

   ```bash
   gh release create v<version>-fork.N beads-ui-<version>.tgz beads-ui-latest.tgz \
     --title "v<version>-fork.N" \
     --notes "Fork build. Install without cloning:

   npm install -g https://github.com/<owner>/beads-ui/releases/latest/download/beads-ui-latest.tgz

   Fixes ahead of upstream <version>: <short list>."
   ```

   Do **not** mark the release as a prerelease: `/releases/latest/` resolves to
   the most recent non-prerelease release, so flagging one hides it from the
   stable install URL.

5. Verify the published URL installs a **real directory** (not a symlink), and
   that the stable URL now resolves to this release:

   ```bash
   npm install -g https://github.com/<owner>/beads-ui/releases/latest/download/beads-ui-latest.tgz
   ls -ld "$(npm root -g)/beads-ui"        # expect drwx... (a directory), not lrwx... (a symlink)
   bdui --version

   # Confirm the stable URL points at the tag just cut:
   curl -sI -o /dev/null -w '%{redirect_url}\n' \
     https://github.com/<owner>/beads-ui/releases/latest/download/beads-ui-latest.tgz
   ```

6. Remove the local tarballs so they are not committed:

   ```bash
   rm -f beads-ui-*.tgz
   ```

7. No consumer-doc edit is needed for the URL: consumers install from the stable
   `releases/latest/download/beads-ui-latest.tgz`, which this release's upload
   repointed. Update consumer docs only when a release changes something they
   describe (a new flag, a changed default, a `bd` version requirement).

## Conventions

- **Tag naming:** `v<upstream-version>-fork.N`. Keep the upstream version so it
  is obvious which mainline release this is built on; the `-fork.N` suffix marks
  it as a fork build and increments per fork release.
- **Keep public artifacts generic.** Branch names, PR titles, release tags, and
  release notes are public. Do not reference any private/internal project or
  deployment in them — describe the change, not where it is used.
- **The bundle is a generated artifact.** Never hand-edit `app/main.bundle.js`;
  it is rebuilt from `app/` sources by `npm run build` / `prepack`.
