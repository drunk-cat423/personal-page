# Waline official client

- Package: `@waline/client` 3.16.0.
- Source: https://registry.npmjs.org/@waline/client/-/client-3.16.0.tgz
- Upstream: https://github.com/walinejs/waline/tree/main/packages/client
- License: MIT; the original license is included in `LICENSE`.
- `waline.css` is the unmodified official browser distribution.
- `waline.js` retains the official distribution with one local like-handler change:
  an import of `../../../like-state.js` and replacement of the original `k` like handler
  with `createLikeHandler`, using the same Vue likes ref, comment object and `updateComment` API.
  It emits `waline:like-state` for the root `like-motion.js` feedback.

Site-specific visual overrides are in the root `waline-theme.css`.
Keep the import and like-handler replacement when refreshing this pinned distribution;
regression checks are `node --test scripts/like-state.test.mjs`.
The official package's source maps are not bundled. Its source is available upstream.
