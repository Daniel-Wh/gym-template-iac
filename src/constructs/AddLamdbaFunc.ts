import * as path from "path";
import { Construct } from "constructs";
import { TerraformStack, TerraformAsset, AssetType} from "cdktf";

import * as aws from "@cdktf/provider-aws";

interface LambdaFunctionConfig {
  runtime: string,
  stageName: string,
  version: string,
  env: string,
  name: string
};

const lambdaRolePolicy = {
  "Version": "2012-10-17",
  "Statement": [
    {
      "Action": "sts:AssumeRole",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Effect": "Allow",
      "Sid": ""
    }
  ]
};

export class LambdaStack extends TerraformStack {
  public createdFunc: aws.lambdaFunction.LambdaFunction;
  constructor(scope: Construct, name: string, config: LambdaFunctionConfig) {
    super(scope, name);

    new aws.provider.AwsProvider(this, "aws", {
      region: "us-east-1",
    });


    // Create Lambda executable
    const asset = new TerraformAsset(this, "lambda-asset", {
      path: path.resolve(__dirname, 'StarterLambda.zip'),
      type: AssetType.FILE, // if left empty it infers directory and file
    });

    // Create unique S3 bucket that hosts Lambda executable
    const bucket = new aws.s3Bucket.S3Bucket(this, "bucket", {
      bucketPrefix: `#${config.env}-${name}`,
    });

    // Upload Lambda zip file to newly created S3 bucket
    const lambdaArchive = new aws.s3Object.S3Object(this, "lambda-archive", {
      bucket: bucket.bucket,
      key: `${config.version}/${asset.fileName}`,
      source: asset.path, // returns a posix path
    });

    // Create Lambda role
    const role = new aws.iamRole.IamRole(this, "lambda-exec", {
      name: config.name,
      assumeRolePolicy: JSON.stringify(lambdaRolePolicy)
    });

    // Add execution role for lambda to write to CloudWatch logs
    new aws.iamRolePolicyAttachment.IamRolePolicyAttachment(this, "lambda-managed-policy", {
      policyArn: 'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
      role: role.name
    });

    // Create Lambda function
    const lambdaFunc = new aws.lambdaFunction.LambdaFunction(this, "learn-cdktf-lambda", {
      functionName: config.name,
      s3Bucket: bucket.bucket,
      s3Key: lambdaArchive.key,
      handler: 'index.handler',
      runtime: config.runtime,
      role: role.arn
    });

    this.createdFunc = lambdaFunc
  }
  public getFunc = () => {
    return this.createdFunc;
  }
};

