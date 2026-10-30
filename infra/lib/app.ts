import { existsSync } from "node:fs";
import * as path from "node:path";
import type { App } from "aws-cdk-lib";
import { WebStack } from "./hosting";

export interface AppOptions {
  region: string;
  /** The built web app; defaults to web/dist. */
  webDist?: string;
}

export interface BuiltApp {
  web: WebStack;
}

/**
 * The account is never in this repo: it comes from the deploying credentials (CDK_DEFAULT_ACCOUNT),
 * and with none set the stack synths env-agnostic.
 */
export function buildApp(scope: App, opts: AppOptions): BuiltApp {
  const webDist = opts.webDist ?? path.join(__dirname, "..", "..", "web", "dist");
  if (!existsSync(path.join(webDist, "index.html"))) {
    throw new Error(`No web build at ${webDist}; run \`npm run build:web\` from the repo root first`);
  }
  const web = new WebStack(scope, "AppConnectorWeb", {
    env: { account: process.env.CDK_DEFAULT_ACCOUNT || undefined, region: opts.region },
    webDist,
  });
  return { web };
}
