import {
  CfnOutput, Duration, RemovalPolicy, Stack, type StackProps,
  aws_budgets as budgets,
  aws_certificatemanager as acm,
  aws_cloudfront as cloudfront,
  aws_cloudfront_origins as origins,
  aws_route53 as route53,
  aws_route53_targets as targets,
  aws_s3 as s3,
  aws_s3_deployment as s3deploy,
} from "aws-cdk-lib";
import type { Construct } from "constructs";
import type { HostingConfig } from "./config";

/** The address App Connector is served at. */
export const APP_DOMAIN = "apps.ashershores.com";
/** Value of the `app` cost-allocation tag on every resource (bin/app.ts); the budget filters on it. */
export const APP_TAG = "app-connector";
const BUDGET_EMAIL = "asher.shores5@gmail.com";

interface ZoneProps {
  hosting: HostingConfig;
  domain: string;
}

const zoneOf = (scope: Construct, { hosting }: ZoneProps) =>
  route53.HostedZone.fromHostedZoneAttributes(scope, "Zone", { hostedZoneId: hosting.hostedZoneId, zoneName: hosting.zoneName });

/** CloudFront certificates must live in us-east-1. DNS-validated in the existing zone. */
export class CertStack extends Stack {
  readonly certificate: acm.ICertificate;

  constructor(scope: Construct, id: string, props: StackProps & ZoneProps) {
    super(scope, id, props);
    this.certificate = new acm.Certificate(this, "Cert", {
      domainName: props.domain,
      validation: acm.CertificateValidation.fromDns(zoneOf(this, props)),
    });
  }
}

export interface WebStackProps extends StackProps {
  /** The built web app (web/dist). */
  webDist: string;
  /**
   * The custom domain: zone, name and its us-east-1 certificate. Without it the site is served
   * only on its CloudFront address (a plain local synth, no setup needed).
   */
  live?: ZoneProps & { certificate: acm.ICertificate };
}

/**
 * The PWA: a private S3 bucket that only CloudFront can read (Origin Access Control), with a
 * strict CSP. The page is public by design: it is a list of links and holds no data or secrets.
 * When live, it answers on the app domain via A/AAAA aliases in the existing zone.
 */
export class WebStack extends Stack {
  constructor(scope: Construct, id: string, props: WebStackProps) {
    super(scope, id, props);

    const bucket = new s3.Bucket(this, "Web", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const headers = new cloudfront.ResponseHeadersPolicy(this, "Headers", {
      securityHeadersBehavior: {
        contentSecurityPolicy: {
          override: true,
          // Everything (shell, Tile icons) is served from this origin; Apps are opened, never framed.
          contentSecurityPolicy: [
            "default-src 'self'",
            "script-src 'self'",
            "style-src 'self'",
            "img-src 'self'",
            "connect-src 'self'",
            "manifest-src 'self'",
            "worker-src 'self'",
            "frame-src 'none'",
            "object-src 'none'",
            "frame-ancestors 'none'",
            "base-uri 'self'",
          ].join("; "),
        },
        strictTransportSecurity: { override: true, accessControlMaxAge: Duration.days(365), includeSubdomains: false },
        contentTypeOptions: { override: true },
        frameOptions: { override: true, frameOption: cloudfront.HeadersFrameOption.DENY },
        referrerPolicy: { override: true, referrerPolicy: cloudfront.HeadersReferrerPolicy.SAME_ORIGIN },
      },
    });

    const distribution = new cloudfront.Distribution(this, "Cdn", {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        responseHeadersPolicy: headers,
      },
      defaultRootObject: "index.html",
      ...(props.live && { domainNames: [props.live.domain], certificate: props.live.certificate }),
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
    });

    new s3deploy.BucketDeployment(this, "Deploy", {
      destinationBucket: bucket,
      sources: [s3deploy.Source.asset(props.webDist)],
      // Vite assets are content-hashed; no-cache just forces cheap revalidation of index.html.
      cacheControl: [s3deploy.CacheControl.noCache()],
      distribution,
      distributionPaths: ["/*"],
    });

    // ---- cost guardrail: everything here is tagged app=app-connector (bin/app.ts) ----
    // In this stack because it is the one stack that always exists; budgets are account-wide.
    new budgets.CfnBudget(this, "Budget", {
      budget: {
        budgetName: "app-connector-monthly",
        budgetType: "COST",
        timeUnit: "MONTHLY",
        budgetLimit: { amount: 1, unit: "USD" },
        costFilters: { TagKeyValue: [`user:app$${APP_TAG}`] },
      },
      notificationsWithSubscribers: [
        {
          notification: { notificationType: "ACTUAL", comparisonOperator: "GREATER_THAN", threshold: 80 },
          subscribers: [{ subscriptionType: "EMAIL", address: BUDGET_EMAIL }],
        },
        {
          notification: { notificationType: "FORECASTED", comparisonOperator: "GREATER_THAN", threshold: 100 },
          subscribers: [{ subscriptionType: "EMAIL", address: BUDGET_EMAIL }],
        },
      ],
    });

    if (props.live) {
      const zone = zoneOf(this, props.live);
      for (const [name, Rec] of [["A", route53.ARecord], ["AAAA", route53.AaaaRecord]] as const) {
        new Rec(this, `Alias${name}`, {
          zone,
          recordName: props.live.domain,
          target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution)),
        });
      }
      new CfnOutput(this, "Url", { value: `https://${props.live.domain}` });
    }

    new CfnOutput(this, "DistributionDomain", { value: distribution.distributionDomainName });
    new CfnOutput(this, "DistributionId", { value: distribution.distributionId });
    new CfnOutput(this, "BucketName", { value: bucket.bucketName });
  }
}
