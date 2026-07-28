import { buildApp } from "./app";

if (!process.env.AUTH_SECRET) {
  console.error(
    "AUTH_SECRET is not configured. Set it in backend/.env (e.g. openssl rand -base64 32) and restart.",
  );
  process.exit(1);
}

const port = Number(process.env.PORT) || 3001;

const app = buildApp().listen(port);

console.log(
  `OhShift API running at http://${app.server?.hostname}:${app.server?.port}`,
);
