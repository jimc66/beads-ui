# Releasing this fork

This fork is distributed as a **prebuilt tarball attached to a GitHub Release**,
not via the npm registry. Users install it with a plain `npm install -g <url>`,
without cloning the repo or needing an npm account.

## Why a release tarball (and not `npm install -g github:owner/repo`)

Installing globally straight from a git ref
(`npm install -g github:owner/repo`) clones the repo into npm's cache and, on
some npm/Node versions, leaves a **broken symlink** in the global
`node_modules` (pointing into `~/.npm/_cacache/tmp/git-clone*`, which npm then
deletes). The result is a dangling link and an unusable `bdui`.

A tarball downloaded over HTTPS is neither a git clone nor a local path, so npm
**extracts it into a real directory** — sidestepping that behavior. That is why
the install URL points at a release asset, not the repo.

The frontend bundle (`app/main.bundle.js`) is gitignored and built on demand;
`npm pack` runs the `prepack` script, which builds the bundle into the tarball.
So the published tarball is complete even though the repo does not commit the
bundle.

## Cutting a release

Prerequisites: `npm install` has been run in the repo (dev dependencies present,
needed for the esbuild build), and `gh` is authenticated.

1. Be on an up-to-date `main`:

   ```bash
   git checkout main && git pull
   ```

2. Build and pack. `npm pack` runs `prepack` (the build) automatically and
   writes `beads-ui-<version>.tgz`:

   ```bash
   npm pack
   ```

3. Sanity-check that the tarball contains the built UI before publishing it:

   ```bash
   tar -tzf beads-ui-*.tgz | grep -E 'app/index.html|app/main.bundle.js'
   ```

4. Create the release and attach the tarball. Use a tag that distinguishes this
   fork build from upstream's tag (e.g. `v<version>-fork.N`):

   ```bash
   gh release create v<version>-fork.N beads-ui-<version>.tgz \
     --title "v<version>-fork.N" \
     --notes "Fork build. Install without cloning:

   npm install -g https://github.com/<owner>/beads-ui/releases/download/v<version>-fork.N/beads-ui-<version>.tgz

   Fixes ahead of upstream <version>: <short list>."
   ```

5. Verify the published URL installs a **real directory** (not a symlink):

   ```bash
   npm install -g https://github.com/<owner>/beads-ui/releases/download/v<version>-fork.N/beads-ui-<version>.tgz
   ls -ld "$(npm root -g)/beads-ui"        # expect drwx... (a directory), not lrwx... (a symlink)
   bdui --version
   ```

6. Remove the local tarball so it is not committed:

   ```bash
   rm beads-ui-*.tgz
   ```

7. Update any consumer docs that pin the install URL to the new tag.

## Conventions

- **Tag naming:** `v<upstream-version>-fork.N`. Keep the upstream version so it
  is obvious which mainline release this is built on; the `-fork.N` suffix marks
  it as a fork build and increments per fork release.
- **Keep public artifacts generic.** Branch names, PR titles, release tags, and
  release notes are public. Do not reference any private/internal project or
  deployment in them — describe the change, not where it is used.
- **The bundle is a generated artifact.** Never hand-edit `app/main.bundle.js`;
  it is rebuilt from `app/` sources by `npm run build` / `prepack`.
