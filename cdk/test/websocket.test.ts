import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { WebSocketResources } from '../lib/websocket';
import { UserPool } from 'aws-cdk-lib/aws-cognito';

describe('WebSocketResources', () => {
  let app: cdk.App;
  let stack: cdk.Stack;
  let template: Template;

  beforeEach(() => {
    app = new cdk.App();
    stack = new cdk.Stack(app, 'TestStack', {
      env: { account: '123456789012', region: 'us-east-1' }
    });
    
    const userPool = new UserPool(stack, 'TestUserPool', {
      selfSignUpEnabled: true,
      signInAliases: {
        email: true
      }
    });
    
    new WebSocketResources(stack, 'TestWebSocket', {
      userPool: userPool,
      bedrockRegion: 'us-east-1',
      modelId: 'anthropic.claude-3-sonnet-20240229-v1:0'
    });
    
    template = Template.fromStack(stack);
  });

  test('WebSocket API Created', () => {
    template.hasResourceProperties('AWS::ApiGatewayV2::Api', {
      ProtocolType: 'WEBSOCKET',
      RouteSelectionExpression: '$request.body.action'
    });
  });

  test('WebSocket Routes Created', () => {
    // Connect route
    template.hasResourceProperties('AWS::ApiGatewayV2::Route', {
      RouteKey: '$connect',
      AuthorizationType: 'AWS_IAM'
    });

    // Disconnect route
    template.hasResourceProperties('AWS::ApiGatewayV2::Route', {
      RouteKey: '$disconnect'
    });

    // Default route
    template.hasResourceProperties('AWS::ApiGatewayV2::Route', {
      RouteKey: '$default'
    });

    // Chat route
    template.hasResourceProperties('AWS::ApiGatewayV2::Route', {
      RouteKey: 'chat'
    });
  });

  test('WebSocket Stage Created', () => {
    template.hasResourceProperties('AWS::ApiGatewayV2::Stage', {
      StageName: 'prod',
      AutoDeploy: true
    });
  });

  test('ChatBot2 Lambda Function Created', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      Handler: 'index.handler',
      Runtime: 'nodejs20.x',
      Architectures: ['arm64'],
      Timeout: 300
    });
  });

  test('Lambda Role Created with Bedrock and WebSocket Permissions', () => {
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: [
              'bedrock:InvokeModel',
              'bedrock:InvokeModelWithResponseStream'
            ],
            Effect: 'Allow',
            Resource: '*'
          }),
          Match.objectLike({
            Action: [
              'execute-api:ManageConnections'
            ],
            Effect: 'Allow',
            Resource: Match.stringLikeRegexp('arn:aws:execute-api:*')
          })
        ])
      }
    });
  });

  test('WebSocket Integrations Created', () => {
    template.hasResourceProperties('AWS::ApiGatewayV2::Integration', {
      IntegrationType: 'AWS_PROXY',
      IntegrationUri: Match.anyValue(),
      ContentHandlingStrategy: 'CONVERT_TO_TEXT'
    });
  });
});