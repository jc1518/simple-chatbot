import { Duration } from "aws-cdk-lib";
import {
  RestApi,
  LambdaIntegration,
  EndpointType,
  MethodLoggingLevel,
  CognitoUserPoolsAuthorizer,
  AuthorizationType,
} from "aws-cdk-lib/aws-apigateway";
import {
  ManagedPolicy,
  Role,
  ServicePrincipal,
  PolicyStatement,
} from "aws-cdk-lib/aws-iam";
import { IUserPool } from "aws-cdk-lib/aws-cognito";
import { Runtime, Architecture, Function } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Construct } from "constructs";

interface ApiResourcesProps {
  userPool: IUserPool;
  bedrockRegion: string;
  modelId: string;
}

export class ApiResources extends Construct {
  public chatBot1ApiUrl: string;
  public chatBot1: Function;

  constructor(scope: Construct, id: string, props: ApiResourcesProps) {
    super(scope, id);

    const chatBot1Role = new Role(this, "chatBot1Role", {
      assumedBy: new ServicePrincipal("lambda.amazonaws.com"),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AWSLambdaBasicExecutionRole"
        ),
      ],
    });

    chatBot1Role.addToPrincipalPolicy(
      new PolicyStatement({
        actions: [
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream",
        ],
        resources: ["*"],
      })
    );

    const chatBot1 = new NodejsFunction(this, "chatBot1", {
      entry: "./lib/resources/chatBot1/index.ts",
      runtime: Runtime.NODEJS_LATEST,
      architecture: Architecture.ARM_64,
      handler: "handler",
      timeout: Duration.minutes(5),
      role: chatBot1Role,
    });

    const chatBot1Api = new RestApi(this, "chatBot1Api", {
      defaultCorsPreflightOptions: {
        allowHeaders: [
          "Content-Type",
          "X-Amz-Date",
          "Authorization",
          "x-amz-security-token",
        ],
        allowMethods: ["OPTIONS", "POST"],
        allowCredentials: true,
        allowOrigins: ["*"],
      },
      restApiName: "chatBot1API",
      deployOptions: {
        loggingLevel: MethodLoggingLevel.OFF,
        dataTraceEnabled: false,
      },
      endpointConfiguration: {
        types: [EndpointType.REGIONAL],
      },
    });

    const auth = new CognitoUserPoolsAuthorizer(this, "auth", {
      cognitoUserPools: [props.userPool],
    });

    const promptIntegration = new LambdaIntegration(chatBot1);

    const chatEndpoint = chatBot1Api.root.addResource("chat");

    chatEndpoint.addMethod("POST", promptIntegration, {
      authorizer: auth,
      authorizationType: AuthorizationType.COGNITO,
    });

    this.chatBot1 = chatBot1;
    this.chatBot1ApiUrl = chatBot1Api.url;
  }
}
