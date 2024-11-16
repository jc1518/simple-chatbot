import { execSync, ExecSyncOptions } from "child_process";
import { RemovalPolicy, DockerImage } from "aws-cdk-lib";
import {
  Distribution,
  SecurityPolicyProtocol,
  ViewerProtocolPolicy,
  CachePolicy,
} from "aws-cdk-lib/aws-cloudfront";
import { S3BucketOrigin } from "aws-cdk-lib/aws-cloudfront-origins";
import {
  CfnIdentityPool,
  IUserPool,
  IUserPoolClient,
} from "aws-cdk-lib/aws-cognito";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { Source, BucketDeployment } from "aws-cdk-lib/aws-s3-deployment";
import { Construct } from "constructs";
import * as fsExtra from "fs-extra";

interface CloudFrontResourcesProps {
  lambdaUrl: string;
  apiUrl: string;
  webSocketUrl: string;
  userPool: IUserPool;
  userPoolClient: IUserPoolClient;
  userPoolRegion: string;
  identityPool: CfnIdentityPool;
}
export class CloudFrontResources extends Construct {
  public readonly siteBucket: Bucket;
  public readonly distribution: Distribution;

  constructor(scope: Construct, id: string, props: CloudFrontResourcesProps) {
    super(scope, id);

    this.siteBucket = new Bucket(this, "websiteBucket", {
      publicReadAccess: false,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    this.distribution = new Distribution(this, "CloudfrontDistribution", {
      minimumProtocolVersion: SecurityPolicyProtocol.TLS_V1_2_2021,
      defaultBehavior: {
        origin: S3BucketOrigin.withOriginAccessControl(this.siteBucket),
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: CachePolicy.CACHING_DISABLED,
      },
      defaultRootObject: "index.html",
    });
    const execOptions: ExecSyncOptions = { stdio: "inherit" };

    const bundle = Source.asset("../frontend", {
      bundling: {
        command: [
          "sh",
          "-c",
          'echo "Docker build not supported. Please install esbuild."',
        ],
        image: DockerImage.fromRegistry("alpine"),
        local: {
          /* istanbul ignore next */
          tryBundle(outputDir: string) {
            try {
              execSync("esbuild --version", execOptions);
            } catch {
              return false;
            }
            execSync(
              "cd ../frontend && npm install && npm run build",
              execOptions
            );
            fsExtra.copySync("../frontend/dist", outputDir);
            return true;
          },
        },
      },
    });

    const config = {
      lambdaUrl: props.lambdaUrl,
      apiUrl: props.apiUrl,
      websocketUrl: props.webSocketUrl,
      userPoolRegion: props.userPoolRegion,
      userPoolId: props.userPool.userPoolId,
      userPoolClientId: props.userPoolClient.userPoolClientId,
      identityPoolId: props.identityPool.ref,
    };

    new BucketDeployment(this, "DeployBucket", {
      sources: [bundle, Source.jsonData("config.json", config)],
      destinationBucket: this.siteBucket,
      distribution: this.distribution,
      distributionPaths: ["/*"],
    });
  }
}
