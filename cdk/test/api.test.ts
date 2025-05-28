import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { ApiResources } from '../lib/api';
import { UserPool } from 'aws-cdk-lib/aws-cognito';

describe('ApiResources', () => {
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
    
    new ApiResources(stack, 'TestApi', {
      userPool: userPool,
      bedrockRegion: 'us-east-1',
      modelId: 'anthropic.claude-3-sonnet-20240229-v1:0'
    });
    
    template = Template.fromStack(stack);
  });

  test('ChatBot1 Lambda Function Created', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      Handler: 'index.handler',
      Runtime: 'nodejs20.x',
      Architectures: ['arm64'],
      Timeout: 300
    });
  });

  test('Lambda Role Created with Bedrock Permissions', () => {
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
      }
    });

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

  test('REST API Created with Correct Configuration', () => {
    template.hasResourceProperties('AWS::ApiGateway::RestApi', {
      Name: 'chatBot1API',
      EndpointConfiguration: {
        Types: ['REGIONAL']
      }
    });
  });

  test('API Gateway CORS Configuration', () => {
    template.hasResourceProperties('AWS::ApiGateway::RestApi', {
      Body: Match.objectLike({
        paths: Match.objectLike({
          '/': Match.objectLike({
            options: Match.objectLike({
              responses: Match.objectLike({
                '200': Match.objectLike({
                  headers: Match.objectLike({
                    'Access-Control-Allow-Headers': Match.anyValue(),
                    'Access-Control-Allow-Methods': Match.anyValue(),
                    'Access-Control-Allow-Origin': Match.anyValue()
                  })
                })
              })
            })
          })
        })
      })
    });
  });

  test('Cognito Authorizer Created', () => {
    template.hasResourceProperties('AWS::ApiGateway::Authorizer', {
      Type: 'COGNITO_USER_POOLS',
      IdentitySource: 'method.request.header.Authorization',
      ProviderARNs: Match.arrayWith([Match.anyValue()])
    });
  });

  test('Chat Endpoint Created with POST Method', () => {
    template.hasResourceProperties('AWS::ApiGateway::Resource', {
      PathPart: 'chat'
    });

    template.hasResourceProperties('AWS::ApiGateway::Method', {
      HttpMethod: 'POST',
      AuthorizationType: 'COGNITO_USER_POOLS',
      Integration: {
        IntegrationHttpMethod: 'POST',
        Type: 'AWS_PROXY'
      }
    });
  });
});