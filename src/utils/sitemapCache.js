/**
 * Shared in-memory sitemap cache singleton.
 * Import this in server.js (to serve the cache) and in any
 * controller that mutates content (blog, service, fleet, event)
 * so a content change immediately busts the cache.
 *
 * Usage in a controller:
 *   import { sitemapState } from "../utils/sitemapCache.js";
 *   sitemapState.bust(); // forces next /sitemap.xml request to rebuild from DB
 */

export const sitemapState = {
  cache: null,
  cacheTime: 0,
  bust() {
    this.cache = null;
    this.cacheTime = 0;
  },
};
