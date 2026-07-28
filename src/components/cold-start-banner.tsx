"use client";

/**
 * Previously warned about Render free-tier cold starts.
 * Cloudflare Workers cold starts are short enough that we skip the banner.
 */
export function ColdStartBanner() {
  return null;
}
