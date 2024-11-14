import { Stack, StackProps, CfnOutput } from "aws-cdk-lib";
import { Construct } from "constructs";
import { PolicyStatement, Effect } from "aws-cdk-lib/aws-iam";
import { CognitoResources, LambdaResources, CloudFrontResources } from ".";

export interface SimpleChatbotProps extends StackProps {
  appName: string;
  allowedDomain: string;
  bedrockRegion: string;
  modelId: string;
}

export class SimpleChatbotStack extends Stack {
  constructor(scope: Construct, id: string, props: SimpleChatbotProps) {
    super(scope, id, props);

    const cognitoResources = new CognitoResources(this, "Cognito", {
      appName: props.appName,
      allowedDomain: props.allowedDomain,
    });

    const lambdaResources = new LambdaResources(this, "Lambda", {
      userPool: cognitoResources.userPool,
      bedrockRegion: props.bedrockRegion,
      modelId: props.modelId,
    });

    cognitoResources.authenticatedRole.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ["lambda:InvokeFunctionUrl"],
        resources: [lambdaResources.chatBot.functionArn],
      })
    );

    const cloudFrontResources = new CloudFrontResources(this, "CloudFront", {
      apiUrl: lambdaResources.chatBotUrl.url,
      userPool: cognitoResources.userPool,
      userPoolClient: cognitoResources.userPoolClient,
      userPoolRegion: cognitoResources.userPoolRegion,
      identityPool: cognitoResources.identityPool,
    });

    new CfnOutput(this, "DeployBucket", {
      value: cloudFrontResources.siteBucket.bucketName,
    });
    new CfnOutput(this, "CloudFrontUrl", {
      value: `https://${cloudFrontResources.distribution.domainName}`,
    });
  }
}
