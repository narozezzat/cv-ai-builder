/**
 * Stub for the `server-only` package.
 *
 * The real module exports an empty file under the `react-server` condition and a
 * throwing one everywhere else, which is how it stops a server module reaching a
 * client bundle. Vitest resolves neither condition the way Next's compiler does, so
 * importing anything from `services/` — all of which is `server-only` by design —
 * would throw before a single assertion ran. The guard is a build-time concern; the
 * tests are asserting the module's behaviour, not its bundling.
 */

export {};
