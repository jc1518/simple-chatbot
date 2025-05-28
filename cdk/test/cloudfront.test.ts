import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { CloudFrontResources } from '../lib/cloudfront';
import { UserPool, UserPoolClient, CfnIdentityPool } from 'aws-cdk-lib/aws-cognito';

describe('CloudFrontResources', () => {
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
    
    const userPoolClient = new UserPoolClient(stack, 'TestUserPoolClient', {
      userPool,
      generateSecret: false
    });
    
    const identityPool = new CfnIdentityPool(stack, 'TestIdentityPool', {
      allowUnauthenticatedIdentities: false
    });
    
    new CloudFrontResources(stack, 'TestCloudFront', {
      lambdaUrl: 'https://example.lambda-url.us-east-1.amazonaws.com',
      apiUrl: 'https://example.execute-api.us-east-1.amazonaws.com/prod/',
      webSocketUrl: 'wss://example.execute-api.us-east-1.amazonaws.com/prod',
      userPool: userPool,
      userPoolClient: userPoolClient,
      userPoolRegion: 'us-east-1',
      identityPool: identityPool
    });
    
    template = Template.fromStack(stack);
  });

  test('S3 Bucket Created with Correct Configuration', () => {
    template.hasResourceProperties('AWS::S3::Bucket', {
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true
      },
      WebsiteConfiguration: {
        IndexDocument: 'index.html',
        ErrorDocument: 'index.html'
      }
    });
  });

  test('CloudFront Origin Access Identity Created', () => {
    template.resourceCountIs('AWS::CloudFront::CloudFrontOriginAccessIdentity', 1);
  });

  test('CloudFront Distribution Created with Correct Origins', () => {
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: {
        DefaultRootObject: 'index.html',
        Enabled: true,
        HttpVersion: 'http2',
        IPV6Enabled: true,
        Origins: Match.arrayWith([
          Match.objectLike({
            DomainName: Match.stringLikeRegexp('\\.s3\\.'),
            S3OriginConfig: {
              OriginAccessIdentity: Match.anyValue()
            }
          })
        ]),
        DefaultCacheBehavior: Match.objectLike({
          AllowedMethods: ['GET', 'HEAD', 'OPTIONS'],
          CachedMethods: ['GET', 'HEAD', 'OPTIONS'],
          Compress: true,
          ViewerProtocolPolicy: 'redirect-to-https'
        })
      }
    });
  });

  test('CloudFront Error Responses Configured', () => {
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: {
        CustomErrorResponses: Match.arrayWith([
          Match.objectLike({
            ErrorCode: 403,
            ResponseCode: 200,
            ResponsePagePath: '/index.html'
          }),
          Match.objectLike({
            ErrorCode: 404,
            ResponseCode: 200,
            ResponsePagePath: '/index.html'
          })
        ])
      }
    });
  });

  test('S3 Bucket Policy Created', () => {
    template.hasResourceProperties('AWS::S3::BucketPolicy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: 's3:GetObject',
            Effect: 'Allow',
            Principal: {
              CanonicalUser: Match.anyValue()
            }
          })
        ])
      }
    });
  });

  test('Config File Created', () => {
    template.hasResourceProperties('Custom::S3BucketObject', {
      ServiceToken: Match.anyValue(),
      SourceBucket: Match.anyValue(),
      SourceKey: 'config.json',
      DestinationBucket: Match.anyValue(),
      DestinationKey: 'config.json'
    });
  });
});