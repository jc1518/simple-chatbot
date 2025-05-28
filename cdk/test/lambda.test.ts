import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { LambdaResources } from '../lib/lambda';
import { UserPool } from 'aws-cdk-lib/aws-cognito';

describe('LambdaResources', () => {
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
    
    new LambdaResources(stack, 'TestLambda', {
      userPool: userPool,
      bedrockRegion: 'us-east-1',
      modelId: 'anthropic.claude-3-sonnet-20240229-v1:0'
    });
    
    template = Template.fromStack(stack);
  });

  test('ChatBot Lambda Function Created', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      Handler: 'index.handler',
      Runtime: 'nodejs20.x',
      Architectures: ['arm64'],
      Timeout: 300,
      Environment: {
        Variables: {
          BEDROCK_REGION: 'us-east-1',
          MODEL_ID: 'anthropic.claude-3-sonnet-20240229-v1:0'
        }
      }
    });
  });

  test('Lambda Role Created with Correct Permissions', () => {
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

  test('Function URL Created with Correct Configuration', () => {
    template.hasResourceProperties('AWS::Lambda::Url', {
      AuthType: 'AWS_IAM',
      Cors: {
        AllowCredentials: false,
        AllowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'X-Amz-Security-Token',
          'Authorization',
          'X-Api-Key',
          'X-Amz-User-Agent',
          'x-amz-content-sha256',
          'Access-Control-Allow-Origin',
          'Access-Control-Allow-Headers',
          'Access-Control-Allow-Methods'
        ],
        AllowMethods: ['POST'],
        AllowOrigins: ['*'],
        ExposeHeaders: [
          'x-amzn-RequestId',
          'x-amzn-ErrorType',
          'x-amzn-ErrorMessage'
        ],
        MaxAge: 86400
      },
      InvokeMode: 'RESPONSE_STREAM'
    });
  });
});