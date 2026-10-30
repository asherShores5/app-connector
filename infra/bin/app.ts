import { App, Tags } from "aws-cdk-lib";
import { buildApp } from "../lib/app";

// No account IDs in this repo: the account comes from the deploying credentials. Region defaults
// to us-west-1 (`-c region=...` to override).
const app = new App();
const region = app.node.tryGetContext("region") ?? process.env.CDK_DEFAULT_REGION ?? "us-west-1";
Tags.of(app).add("app", "app-connector");

buildApp(app, { region });
