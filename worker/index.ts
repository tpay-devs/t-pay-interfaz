/**
 * Cloudflare Worker entry point.
 * This minimal script enables Variables and Secrets for the Worker.
 * All requests are forwarded to static assets from ./dist
 */
interface Env {
  ASSETS: Fetcher;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return env.ASSETS.fetch(request);
  },
};
