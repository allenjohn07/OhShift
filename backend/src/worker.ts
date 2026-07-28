import { CloudflareAdapter } from "elysia/adapter/cloudflare-worker";
import { buildApp } from "./app";

export default buildApp({ adapter: CloudflareAdapter }).compile();
