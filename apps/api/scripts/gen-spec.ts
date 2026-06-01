// Regenerates apps/api/openapi.json from the route definitions in src/app.ts.
// Run this whenever the API surface changes: `pnpm --filter api spec:gen`.
import { writeFileSync } from "node:fs";
import { app, openApiConfig } from "../src/app.js";

const doc = app.getOpenAPI31Document(openApiConfig);
const outPath = new URL("../openapi.json", import.meta.url);

writeFileSync(outPath, JSON.stringify(doc, null, 2) + "\n");
console.log(`Wrote ${outPath.pathname}`);
