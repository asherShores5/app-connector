import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { beforeAll, describe, expect, it } from "vitest";
import { buildApp, type BuiltApp } from "../lib/app";

let built: BuiltApp;
let web: Template;
let webDist: string;
beforeAll(() => {
  delete process.env.CDK_DEFAULT_ACCOUNT; // synth as a fresh checkout would, with no credentials
  webDist = mkdtempSync(path.join(tmpdir(), "apps-web-"));
  writeFileSync(path.join(webDist, "index.html"), "<!doctype html>");
  built = buildApp(new App(), { region: "us-west-1", webDist });
  web = Template.fromStack(built.web);
}, 120_000);

describe("web hosting", () => {
  it("lives in us-west-1", () => {
    expect(built.web.region).toBe("us-west-1");
  });

  it("the bucket blocks all public access and only CloudFront (via OAC) may read it", () => {
    web.hasResourceProperties("AWS::S3::Bucket", {
      PublicAccessBlockConfiguration: { BlockPublicAcls: true, BlockPublicPolicy: true, IgnorePublicAcls: true, RestrictPublicBuckets: true },
    });
    web.resourceCountIs("AWS::CloudFront::OriginAccessControl", 1);
    web.hasResourceProperties("AWS::CloudFront::Distribution", {
      DistributionConfig: Match.objectLike({
        DefaultRootObject: "index.html",
        Origins: [Match.objectLike({ OriginAccessControlId: Match.anyValue(), S3OriginConfig: { OriginAccessIdentity: "" } })],
        DefaultCacheBehavior: Match.objectLike({ ViewerProtocolPolicy: "redirect-to-https" }),
      }),
    });
  });

  it("no bucket policy statement allows an anonymous or unconditioned CloudFront principal", () => {
    const policies = Object.values(web.findResources("AWS::S3::BucketPolicy"));
    expect(policies.length).toBeGreaterThan(0);
    for (const p of policies) {
      for (const s of p.Properties.PolicyDocument.Statement) {
        if (s.Effect !== "Allow") continue;
        expect(s.Principal).not.toBe("*");
        expect(JSON.stringify(s.Principal)).not.toContain('"AWS":"*"');
        if (s.Principal?.Service === "cloudfront.amazonaws.com") expect(s.Condition?.StringEquals?.["AWS:SourceArn"]).toBeDefined();
      }
    }
  });

  it("App Connector itself can't be framed, and the page loads nothing from other origins", () => {
    const [policy] = Object.values(web.findResources("AWS::CloudFront::ResponseHeadersPolicy"));
    const csp: string = policy.Properties.ResponseHeadersPolicyConfig.SecurityHeadersConfig.ContentSecurityPolicy.ContentSecurityPolicy;
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("frame-src 'none'");
    expect(csp).toContain("default-src 'self'");
    expect(csp).not.toMatch(/https?:/);
  });

  it("refuses to build without a web build, instead of deploying an empty site", () => {
    const empty = mkdtempSync(path.join(tmpdir(), "apps-empty-"));
    expect(() => buildApp(new App(), { region: "us-west-1", webDist: empty })).toThrow(/npm run build:web/);
  });

  it("puts no AWS account ID in the template when synthesised without one", () => {
    expect(JSON.stringify(web.toJSON())).not.toMatch(/\b\d{12}\b/);
  });
});
