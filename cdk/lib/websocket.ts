import { Duration } from "aws-cdk-lib";
import { WebSocketApi, WebSocketStage } from "aws-cdk-lib/aws-apigatewayv2";
import { WebSocketLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
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

interface WebSocketResourcesProps {
  userPool: IUserPool;
  bedrockRegion: string;
  modelId: string;
}

export class WebSocketResources extends Construct {
  public chatBot2: Function;
  public webSocketApi: WebSocketApi;
  public webSocketStage: WebSocketStage;
  public webSocketUrl: string;

  constructor(scope: Construct, id: string, props: WebSocketResourcesProps) {
    super(scope, id);

    const chatBot2Role = new Role(this, "chatBot2Role", {
      assumedBy: new ServicePrincipal("lambda.amazonaws.com"),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AWSLambdaBasicExecutionRole"
        ),
      ],
    });

    chatBot2Role.addToPrincipalPolicy(
      new PolicyStatement({
        actions: [
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream",
          "execute-api:ManageConnections",
        ],
        resources: ["*"],
      })
    );

    this.chatBot2 = new NodejsFunction(this, "chatBot2", {
      entry: "lib/resources/chatBot2/index.ts",
      handler: "handler",
      runtime: Runtime.NODEJS_18_X,
      architecture: Architecture.ARM_64,
      role: chatBot2Role,
      timeout: Duration.seconds(120),
      environment: {
        BEDROCK_REGION: props.bedrockRegion,
        MODEL_ID: props.modelId,
      },
    });

    this.webSocketApi = new WebSocketApi(this, "ChatWebSocketApi", {
      connectRouteOptions: {
        integration: new WebSocketLambdaIntegration(
          "ConnectIntegration",
          this.chatBot2
        ),
      },
      disconnectRouteOptions: {
        integration: new WebSocketLambdaIntegration(
          "DisconnectIntegration",
          this.chatBot2
        ),
      },
      defaultRouteOptions: {
        integration: new WebSocketLambdaIntegration(
          "DefaultIntegration",
          this.chatBot2
        ),
      },
    });

    this.webSocketStage = new WebSocketStage(this, "ChatWebSocketStage", {
      webSocketApi: this.webSocketApi,
      stageName: "prod",
      autoDeploy: true,
    });

    this.webSocketUrl = this.webSocketStage.url;
  }
}
