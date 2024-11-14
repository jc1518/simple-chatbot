#!/usr/bin/env node
import "source-map-support/register";
import { App } from "aws-cdk-lib";
import { SimpleChatbotStack } from "../lib/simple-chatbot-stack";

const props = {
  appName: process.env.APP_NAME || "SimpleChatbot",
  allowedDomain: process.env.ALLOWED_DOMAIN || "amazon.com",
  region: process.env.REGION || "ap-southeast-2",
  bedrockRegion: process.env.BEDROCK_REGION || "ap-southeast-2",
  modelId:
    process.env.MODEL_ID || "apac.anthropic.claude-3-5-sonnet-20240620-v1:0",
};

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: props.region,
};

const app = new App();

new SimpleChatbotStack(app, "SimpleChatbot", {
  ...props,
  env: env,
});

app.synth();
