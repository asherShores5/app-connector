import { readFileSync } from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { DEPLOY_BRANCH, DEPLOY_ROLE_NAME } from "../lib/ci";

const workflow = readFileSync(path.join(__dirname, "..", "..", ".github", "workflows", "ci.yml"), "utf8");

describe("CI workflow", () => {
  it("assumes the role CiStack creates, with the account from a secret (never a literal ID)", () => {
    expect(workflow).toContain(`arn:aws:iam::\${{ secrets.AWS_ACCOUNT_ID }}:role/${DEPLOY_ROLE_NAME}`);
    expect(workflow).not.toMatch(/\b\d{12}\b/);
  });

  it("deploys only on pushes to the branch the role trusts", () => {
    expect(workflow).toContain(`if: github.event_name == 'push' && github.ref == 'refs/heads/${DEPLOY_BRANCH}'`);
  });

  it("checks tests, typecheck and synth before any deploy", () => {
    for (const step of ["npm test", "npm run typecheck", "npm run synth"]) expect(workflow).toContain(`- run: ${step}`);
    expect(workflow).toContain("needs: test");
  });
});
