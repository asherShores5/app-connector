import { existsSync } from "node:fs";
import * as path from "node:path";
import type { App } from "aws-cdk-lib";
import { CiStack } from "./ci";
import type { HostingConfig } from "./config";
import { APP_DOMAIN, CertStack, WebStack } from "./hosting";

export interface AppOptions {
  region: string;
  /** The account and Route 53 zone. Without it, only the web stack is built (CloudFront address). */
  hosting?: HostingConfig;
  /** Numeric GitHub repo ID for the deploy role's trust policy (lib/ci.ts). */
  githubRepoId?: string;
  /** The built web app; defaults to web/dist. */
  webDist?: string;
}

export interface BuiltApp {
  web: WebStack;
  cert?: CertStack;
  ci?: CiStack;
}

/**
 * The account is never in this repo: it comes from the hosting config (lib/config.ts) or the
 * deploying credentials (CDK_DEFAULT_ACCOUNT), and with neither the web stack synths env-agnostic.
 */
export function buildApp(scope: App, opts: AppOptions): BuiltApp {
  const { region, hosting } = opts;
  const webDist = opts.webDist ?? path.join(__dirname, "..", "..", "web", "dist");
  if (!existsSync(path.join(webDist, "index.html"))) {
    throw new Error(`No web build at ${webDist}; run \`npm run build:web\` from the repo root first`);
  }
  if (!hosting) {
    const web = new WebStack(scope, "AppConnectorWeb", {
      env: { account: process.env.CDK_DEFAULT_ACCOUNT || undefined, region },
      webDist,
    });
    return { web };
  }

  const { account } = hosting;
  const zone = { hosting, domain: APP_DOMAIN };
  const cert = new CertStack(scope, "AppConnectorCert", { env: { account, region: "us-east-1" }, crossRegionReferences: true, ...zone });
  const web = new WebStack(scope, "AppConnectorWeb", {
    env: { account, region },
    crossRegionReferences: true,
    webDist,
    live: { ...zone, certificate: cert.certificate },
  });
  const ci = new CiStack(scope, "AppConnectorCi", { env: { account, region }, githubRepoId: opts.githubRepoId });
  return { web, cert, ci };
}
