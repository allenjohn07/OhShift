import { buildApp } from "./app";

const port = Number(process.env.PORT) || 3001;

const app = buildApp().listen(port);

console.log(
  `OhShift API running at http://${app.server?.hostname}:${app.server?.port}`,
);
