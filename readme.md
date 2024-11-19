# Simple Chatbot

## Description

Simple Chatbot is a sample project to demostrate how to build a Chatbot with AWS serverless architecture.

The frontend is written in React and deployed to CloudFront with Cognito authentication.

The backend has 3 options:

- Lambda function URL (with streaming support)
- API Gateway (Rest API) + Lambda
- API Gateway (Websocket API) + Lambda (with streaming support)

Lambda uses Converse API to interact with LLM models in Bedrock.

The conversation history is stored in browser local storage for simpility.

![simple_chatbot](./diagrams/simple-chatbot.png)

## Architecture

![architecture](./diagrams/architecture.png)

## Usage

### Customization

Go to [simple-chatbot.ts](./cdk/bin/simple-chatbot.ts) and update the settings accordinly:

```javascript
const props = {
  appName: process.env.APP_NAME || "SimpleChatbot",
  allowedDomain: process.env.ALLOWED_DOMAIN || "amazon.com", // Allowed email domain in Cognito
  region: process.env.REGION || "ap-southeast-2",
  bedrockRegion: process.env.BEDROCK_REGION || "ap-southeast-2",
  modelId:
    process.env.MODEL_ID || "apac.anthropic.claude-3-5-sonnet-20240620-v1:0",
};
```

### Create stack

```bash
cd cdk
npm install
cdk deploy
```

### Destroy stack

```bash
cd cdk
cdk destroy
```

## Demo

[![Watch the video](https://img.youtube.com/vi/5PUlrJ-w2RM/maxresdefault.jpg)](https://youtu.be/5PUlrJ-w2RM)
