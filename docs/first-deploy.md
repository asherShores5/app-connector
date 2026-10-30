# First deploy

A one-time, by-hand setup. After it, a push to `prod` deploys through GitHub Actions.
Run everything from the repo root, in the VS Code terminal on the dev desktop, with the
`personal` AWS profile (the same account and Route 53 zone as HoneyDo and Games Catalog).
Nothing below goes in a tracked file: the account ID and zone ID are passed as env vars or set
in GitHub settings.

What gets created: three stacks, all in us-west-1 except the certificate.

- `AppConnectorCert` (us-east-1): the certificate for apps.ashershores.com (DNS-validated)
- `AppConnectorWeb`: private S3 bucket, CloudFront (the only reader, via OAC), A/AAAA records
  for apps.ashershores.com, and the $1/month `app-connector-monthly` budget
- `AppConnectorCi`: the `app-connector-github-deploy` role GitHub Actions assumes

## 1. Sign in and pin the region

The dev desktop defaults to us-west-2, so pin us-west-1 for this shell.

```sh
aws login --remote --region us-west-1 --profile personal   # paste the code from your Mac browser
export AWS_PROFILE=personal AWS_REGION=us-west-1 AWS_DEFAULT_REGION=us-west-1
aws sts get-caller-identity                                 # expect user ashershores
```

## 2. Look up the values

```sh
export CDK_DEFAULT_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
export HOSTED_ZONE_NAME=ashershores.com
export HOSTED_ZONE_ID=$(aws route53 list-hosted-zones-by-name --dns-name "$HOSTED_ZONE_NAME" \
  --query 'HostedZones[0].Id' --output text | sed 's#/hostedzone/##')
REPO_ID=$(gh api repos/asherShores5/app-connector --jq .id)   # the repo must exist on GitHub
echo "$CDK_DEFAULT_ACCOUNT $HOSTED_ZONE_ID $REPO_ID"
```

Check `apps.ashershores.com` isn't already taken in the zone (expect no output):

```sh
aws route53 list-resource-record-sets --hosted-zone-id "$HOSTED_ZONE_ID" \
  --query "ResourceRecordSets[?Name=='apps.ashershores.com.']" --output text
```

## 3. CDK bootstrap (both regions)

Already done for HoneyDo and Games Catalog; running it again is harmless.

```sh
(cd infra && npx cdk bootstrap "aws://$CDK_DEFAULT_ACCOUNT/us-west-1" "aws://$CDK_DEFAULT_ACCOUNT/us-east-1")
```

## 4. GitHub OIDC provider (reused, not created)

An account has one provider per URL. HoneyDo's CI stack created it and Games Catalog reuses it;
App Connector does the same. Check it's there:

```sh
aws iam list-open-id-connect-providers   # expect .../oidc-provider/token.actions.githubusercontent.com
```

If it's missing, stop: something deleted HoneyDo's CI stack, and that needs looking at first.

## 5. Deploy once from your machine

This creates the deploy role, so CI can't do it the first time. Review the IAM changes CDK shows
before saying yes. The certificate waits for DNS validation, which usually takes a few minutes.

```sh
npm ci
npm run build:web
(cd infra && npx cdk deploy --all -c requireHosting=true -c githubRepoId="$REPO_ID")
```

Note the outputs: `Url` and `BucketName` (AppConnectorWeb) and `DeployRoleArn` (AppConnectorCi).

## 6. Check it

```sh
# The site answers over HTTPS (expect 200):
curl -sI https://apps.ashershores.com/ | head -1
# It serves the bundle you just built (expect the same asset names in both):
grep -o 'assets/[^"]*' web/dist/index.html
curl -s https://apps.ashershores.com/ | grep -o 'assets/[^"]*'
# The bucket is not readable directly (expect 403; only CloudFront can read it):
curl -sI "https://<BucketName>.s3.us-west-1.amazonaws.com/index.html" | head -1
```

If the bucket returns 200, stop and fix it before going on.

On the phone: open https://apps.ashershores.com in Safari, then Share > Add to Home Screen.

## 7. GitHub settings for CI

Names only here; set the values in the repo's Settings > Secrets and variables > Actions, or:

```sh
gh secret set AWS_ACCOUNT_ID --repo asherShores5/app-connector --body "$CDK_DEFAULT_ACCOUNT"   # secret, so it's masked in public logs
gh variable set HOSTED_ZONE_ID --repo asherShores5/app-connector --body "$HOSTED_ZONE_ID"
gh variable set HOSTED_ZONE_NAME --repo asherShores5/app-connector --body "$HOSTED_ZONE_NAME"
# optional: gh variable set AWS_REGION --repo asherShores5/app-connector --body us-west-1
```

CI gets the repo ID from GitHub itself (`GITHUB_REPOSITORY_ID`), so the role's trust policy stays
the same on later deploys.

## 8. Deploy from CI

Push `main` first (tests, typecheck and synth only), then fast-forward `prod` to it. The `prod`
push runs the checks and then `npm run deploy` as the deploy role. The role trusts only this
repo's `prod` branch and can only assume the CDK bootstrap roles. Afterwards, repeat the checks
in step 6.

## 9. Budget

The budget filters on the `app=app-connector` cost tag. The `app` tag key should already be
active for cost allocation (HoneyDo and Games Catalog use it); check under Billing > Cost
allocation tags. New tag values can take up to a day to show up in Billing. Budget emails go to
asher.shores5@gmail.com at 80% of $1 actual and 100% forecast.

## Context and env keys (reference)

Context key (`-c key=value`) or env var; context wins. Read by `infra/lib/config.ts` and `infra/bin/app.ts`.

```
account         CDK_DEFAULT_ACCOUNT    the CDK CLI sets the env var from your credentials
hostedZoneId    HOSTED_ZONE_ID         existing public zone
zoneName        HOSTED_ZONE_NAME       apps.ashershores.com must be inside it
githubRepoId    GITHUB_REPOSITORY_ID   numeric; set automatically in GitHub Actions
region          CDK_DEFAULT_REGION     defaults to us-west-1
requireHosting  -                      true makes a missing zone an error (npm run deploy sets it)
```

With no zone set, `npm run synth` builds only `AppConnectorWeb`, on its CloudFront address.
