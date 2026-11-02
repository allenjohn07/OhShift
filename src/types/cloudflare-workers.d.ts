// The frontend type-checks backend route files (for the typed API client)
// without the Workers runtime types; `env` is only used server-side.
declare module "cloudflare:workers" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const env: any;
}
