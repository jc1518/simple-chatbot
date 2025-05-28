import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { CognitoResources } from '../lib/cognito';

describe('CognitoResources', () => {
  let app: cdk.App;
  let stack: cdk.Stack;
  let template: Template;

  beforeEach(() => {
    app = new cdk.App();
    stack = new cdk.Stack(app, 'TestStack', {
      env: { account: '123456789012', region: 'us-east-1' }
    });
    
    new CognitoResources(stack, 'TestCognito', {
      appName: 'TestApp',
      allowedDomain: 'example.com'
    });
    
    template = Template.fromStack(stack);
  });

  test('User Pool Created with Correct Properties', () => {
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
      UsernameAttributes: ['email'],
      EmailVerificationMessage: Match.stringLikeRegexp('verification code'),
      EmailVerificationSubject: Match.stringLikeRegexp('Verify your TestApp account')
    });
  });

  test('User Pool Client Created', () => {
    template.resourceCountIs('AWS::Cognito::UserPoolClient', 1);
    template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
      SupportedIdentityProviders: ['COGNITO'],
      ExplicitAuthFlows: [
        'ALLOW_USER_SRP_AUTH',
        'ALLOW_CUSTOM_AUTH'
      ],
      RefreshTokenValidity: 12,
      AccessTokenValidity: 12
    });
  });

  test('Identity Pool Created', () => {
    template.resourceCountIs('AWS::Cognito::IdentityPool', 1);
    template.hasResourceProperties('AWS::Cognito::IdentityPool', {
      AllowUnauthenticatedIdentities: false,
      CognitoIdentityProviders: Match.arrayWith([
        Match.objectLike({
          ClientId: Match.anyValue(),
          ProviderName: Match.anyValue()
        })
      ])
    });
  });

  test('Domain Validator Lambda Created', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      Handler: 'index.handler',
      Runtime: 'nodejs20.x',
      Architectures: ['arm64'],
      Environment: {
        Variables: {
          ALLOWED_DOMAIN: 'example.com'
        }
      }
    });
  });

  test('Authenticated Role Created with Correct Policies', () => {
    template.hasResourceProperties('AWS::IAM::Role', {
      AssumeRolePolicyDocument: {
        Statement: [
          {
            Action: 'sts:AssumeRoleWithWebIdentity',
            Effect: 'Allow',
            Principal: {
              Federated: 'cognito-identity.amazonaws.com'
            },
            Condition: {
              StringEquals: {
                'cognito-identity.amazonaws.com:aud': Match.anyValue()
              },
              'ForAnyValue:StringLike': {
                'cognito-identity.amazonaws.com:amr': 'authenticated'
              }
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
              'mobileanalytics:PutEvents',
              'cognito-sync:*',
              'cognito-identity:*'
            ],
            Effect: 'Allow',
            Resource: '*'
          })
        ])
      }
    });
  });

  test('Unauthenticated Role Created with Correct Policies', () => {
    template.hasResourceProperties('AWS::IAM::Role', {
      AssumeRolePolicyDocument: {
        Statement: [
          {
            Action: 'sts:AssumeRoleWithWebIdentity',
            Effect: 'Allow',
            Principal: {
              Federated: 'cognito-identity.amazonaws.com'
            },
            Condition: {
              StringEquals: {
                'cognito-identity.amazonaws.com:aud': Match.anyValue()
              },
              'ForAnyValue:StringLike': {
                'cognito-identity.amazonaws.com:amr': 'unauthenticated'
              }
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
              'mobileanalytics:PutEvents',
              'cognito-sync:*'
            ],
            Effect: 'Allow',
            Resource: '*'
          })
        ])
      }
    });
  });

  test('Identity Pool Role Attachment Created', () => {
    template.resourceCountIs('AWS::Cognito::IdentityPoolRoleAttachment', 1);
    template.hasResourceProperties('AWS::Cognito::IdentityPoolRoleAttachment', {
      IdentityPoolId: Match.anyValue(),
      Roles: {
        authenticated: Match.anyValue(),
        unauthenticated: Match.anyValue()
      }
    });
  });
});