import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { SimpleChatbotStack } from '../lib/simple-chatbot-stack';

describe('SimpleChatbotStack', () => {
  let app: cdk.App;
  let stack: SimpleChatbotStack;
  let template: Template;

  beforeEach(() => {
    app = new cdk.App();
    stack = new SimpleChatbotStack(app, 'TestSimpleChatbotStack', {
      appName: 'TestChatbot',
      allowedDomain: 'example.com',
      region: 'us-east-1',
      bedrockRegion: 'us-east-1',
      modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
      env: {
        account: '123456789012',
        region: 'us-east-1'
      }
    });
    template = Template.fromStack(stack);
  });

  test('Cognito User Pool Created', () => {
    template.resourceCountIs('AWS::Cognito::UserPool', 1);
    template.hasResourceProperties('AWS::Cognito::UserPool', {
      SelfSignUpEnabled: true,
      AccountRecoveryPolicy: {
        RecoveryMechanisms: [
          {
            Name: 'verified_email',
            Priority: 1
          }
        ]
      },
      MfaConfiguration: 'OPTIONAL',
      UsernameAttributes: ['email']
    });
  });

  test('Cognito Identity Pool Created', () => {
    template.resourceCountIs('AWS::Cognito::IdentityPool', 1);
    template.hasResourceProperties('AWS::Cognito::IdentityPool', {
      AllowUnauthenticatedIdentities: false
    });
  });

  test('Lambda Functions Created', () => {
    // Check for the chatBot Lambda function
    template.hasResourceProperties('AWS::Lambda::Function', {
      Handler: 'index.handler',
      Runtime: 'nodejs20.x',
      Architectures: ['arm64'],
      Timeout: 300
    });
  });

  test('API Gateway Created', () => {
    template.resourceCountIs('AWS::ApiGateway::RestApi', 1);
    template.hasResourceProperties('AWS::ApiGateway::RestApi', {
      Name: 'chatBot1API'
    });
  });

  test('WebSocket API Created', () => {
    template.resourceCountIs('AWS::ApiGatewayV2::Api', 1);
    template.hasResourceProperties('AWS::ApiGatewayV2::Api', {
      ProtocolType: 'WEBSOCKET'
    });
  });

  test('CloudFront Distribution Created', () => {
    template.resourceCountIs('AWS::CloudFront::Distribution', 1);
  });

  test('S3 Bucket Created', () => {
    template.resourceCountIs('AWS::S3::Bucket', 1);
  });

  test('IAM Roles Created', () => {
    // Check for Lambda execution roles
    template.hasResourceProperties('AWS::IAM::Role', {
      AssumeRolePolicyDocument: {
        Statement: [
          {
            Action: 'sts:AssumeRole',
            Effect: 'Allow',
            Principal: {
              Service: 'lambda.amazonaws.com'
            }
          }
        ]
      },
      ManagedPolicyArns: [
        {
          'Fn::Join': [
            '',
            [
              'arn:',
              { Ref: 'AWS::Partition' },
              ':iam::aws:policy/service-role/AWSLambdaBasicExecutionRole'
            ]
          ]
        }
      ]
    });
  });

  test('Bedrock Permissions Added', () => {
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
          })
        ])
      }
    });
  });
});
