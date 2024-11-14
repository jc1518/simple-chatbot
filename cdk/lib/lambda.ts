import { Duration } from "aws-cdk-lib";
import {
  Runtime,
  Architecture,
  FunctionUrl,
  FunctionUrlAuthType,
  InvokeMode,
  HttpMethod,
  Function,
} from "aws-cdk-lib/aws-lambda";
import {
  ManagedPolicy,
  Role,
  ServicePrincipal,
  PolicyStatement,
  Effect,
  FederatedPrincipal,
} from "aws-cdk-lib/aws-iam";
import { IUserPool } from "aws-cdk-lib/aws-cognito";

import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Construct } from "constructs";

interface LambdaResourcesProps {
  userPool: IUserPool;
  bedrockRegion: string;
  modelId: string;
}

export class LambdaResources extends Construct {
  public readonly chatBot: Function;
  public readonly chatBotUrl: FunctionUrl;

  constructor(scope: Construct, id: string, props: LambdaResourcesProps) {
    super(scope, id);

    const chatBotRole = new Role(this, "chatBotRole", {
      assumedBy: new ServicePrincipal("lambda.amazonaws.com"),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AWSLambdaBasicExecutionRole"
        ),
      ],
    });

    chatBotRole.addToPrincipalPolicy(
      new PolicyStatement({
        actions: [
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream",
        ],
        resources: ["*"],
      })
    );

    const chatBot = new NodejsFunction(this, "chatBot", {
      entry: "./lib/resources/chatBot/index.ts",
      runtime: Runtime.NODEJS_LATEST,
      architecture: Architecture.ARM_64,
      handler: "handler",
      timeout: Duration.minutes(5),
      role: chatBotRole,
    });

    chatBot.addEnvironment("BEDROCK_REGION", props.bedrockRegion);
    chatBot.addEnvironment("MODEL_ID", props.modelId);

    const chatBotUrl = chatBot.addFunctionUrl({
      authType: FunctionUrlAuthType.AWS_IAM,
      cors: {
        allowedOrigins: ["*"],
        allowedHeaders: [
          "Content-Type",
          "X-Amz-Date",
          "Authorization",
          "X-Api-Key",
          "X-Amz-Security-Token",
          "X-Amz-User-Agent",
        ],
        allowedMethods: [HttpMethod.POST],
      },
      invokeMode: InvokeMode.RESPONSE_STREAM,
    });

    // chatBot.addPermission("CognitoAuthenticatedInvoke", {
    //   principal: new ServicePrincipal("cognito-identity.amazonaws.com"),
    //   action: "lambda:InvokeFunctionUrl",
    //   sourceArn: props.userPool.userPoolArn,
    // });

    this.chatBot = chatBot;
    this.chatBotUrl = chatBotUrl;
  }
}
