import * as path from "path";
import { Construct } from "constructs";
import { TerraformAsset, AssetType } from "cdktf";
import * as aws from "@cdktf/provider-aws";

interface LambdaFunctionConfig {
    runtime: string,
    version: string,
    env: string,
    name: string
}

const lambdaRolePolicyDoc = {
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "ReadWriteTable",
            "Effect": "Allow",
            "Action": [
                "dynamodb:BatchGetItem",
                "dynamodb:GetItem",
                "dynamodb:Query",
                "dynamodb:Scan",
                "dynamodb:BatchWriteItem",
                "dynamodb:PutItem",
                "dynamodb:UpdateItem"
            ],
            "Resource": "*"
        },
        {
            "Sid": "GetStreamRecords",
            "Effect": "Allow",
            "Action": "dynamodb:GetRecords",
            "Resource": "arn:aws:dynamodb:*:*:table/*/stream/* "
        },
        {
            "Sid": "WriteLogStreamsAndGroups",
            "Effect": "Allow",
            "Action": [
                "logs:CreateLogStream",
                "logs:PutLogEvents"
            ],
            "Resource": "*"
        },
        {
            "Sid": "CreateLogGroup",
            "Effect": "Allow",
            "Action": "logs:CreateLogGroup",
            "Resource": "*"
        },
        {
            "Sid": "invokeApis",
            "Effect": "Allow",
            "Action": "execute-api:Invoke",
            "Resource": "*"
        },
    ]
}

const lambdaRolePolicy = {
    "Version": "2012-10-17",
    "Statement": [
        {
            "Action": "sts:AssumeRole",
            "Principal": {
                "Service": "lambda.amazonaws.com"
            },
            "Effect": "Allow",
        },
        {
            "Action": "sts:AssumeRole",
            "Principal": {
                "Service": "apigateway.amazonaws.com"
            },
            "Effect": "Allow",
        }
    ]
};

export class LambdaStack {
    public createdFunc: aws.lambdaFunction.LambdaFunction;
    constructor(scope: Construct, name: string, config: LambdaFunctionConfig) {
        // Create Lambda executable
        const asset = new TerraformAsset(scope, `asset-${config.name}-${config.env}`, {
            path: path.resolve(__dirname, 'index.zip'),
            type: AssetType.FILE, // if left empty it infers directory and file
        });

        // Create unique S3 bucket that hosts Lambda executable
        const bucket = new aws.s3Bucket.S3Bucket(scope, `bucket-${config.name}-${config.env}`, {
            bucketPrefix: `${config.env}-${name}`,
        });

        // Upload Lambda zip file to newly created S3 bucket
        const lambdaArchive = new aws.s3Object.S3Object(scope, `archive-${config.name}-${config.env}`, {
            bucket: bucket.bucket,
            key: `${config.name}${config.env}/${asset.fileName}`,
            source: asset.path, // returns a posix path
        });
        // Create Lambda role
        const role = new aws.iamRole.IamRole(scope, `role-${config.name}-${config.env}`, {
            name: config.name,
            assumeRolePolicy: JSON.stringify(lambdaRolePolicy),
            inlinePolicy: [
                {
                    name: `policy-doc-${config.name}-${config.env}`,
                    policy: JSON.stringify(lambdaRolePolicyDoc)
                }
            ]
        });

        // Create Lambda function
        const lambdaFunc = new aws.lambdaFunction.LambdaFunction(scope, `${config.name}-${config.env}`, {
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
}

