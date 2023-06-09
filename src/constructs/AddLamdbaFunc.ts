import * as path from "path";
import { Construct } from "constructs";
import { TerraformAsset, AssetType } from "cdktf";
import { S3Bucket } from "@cdktf/provider-aws/lib/s3-bucket";
import { S3Object } from "@cdktf/provider-aws/lib/s3-object";
import { IamRole } from "@cdktf/provider-aws/lib/iam-role";
import { LambdaPermission } from "@cdktf/provider-aws/lib/lambda-permission";
import { LambdaFunction } from "@cdktf/provider-aws/lib/lambda-function";
import { IamRolePolicyAttachment } from "@cdktf/provider-aws/lib/iam-role-policy-attachment";
import { GetDynamoResourcePolicy, IDynamoResourcePolicyConfig } from "../utils/ResourcePolicies";

export interface LambdaFunctionConfig {
    runtime: string,
    version: string,
    env: string,
    name: string,
    apiGwSourceArn: string,
    tableResources: IDynamoResourcePolicyConfig[],
}



export function CreateLambdaFunc(scope: Construct, config: LambdaFunctionConfig) {
    const lambdaStatementArr = []
    config.tableResources.map(val => lambdaStatementArr.push(GetDynamoResourcePolicy(val)))
    lambdaStatementArr.push({
        "Sid": "invokeApis",
        "Effect": "Allow",
        "Action": "execute-api:Invoke",
        "Resource": "*"
    })
    const lambdaRolePolicyDoc = {
        "Version": "2012-10-17",
        "Statement": lambdaStatementArr
    }
    console.log(lambdaRolePolicyDoc);
    const lambdaRolePolicy = {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Sid": "",
                "Effect": "Allow",
                "Principal": {
                    "Service": [
                        "lambda.amazonaws.com"
                    ]
                },
                "Action": "sts:AssumeRole"
            }
        ]
    }
    // Create Lambda executable
    const asset = new TerraformAsset(scope, `asset-${config.name}-${config.env}`, {
        path: path.resolve(__dirname, 'main.zip'),
        type: AssetType.FILE, // if left empty it infers directory and file
    });

    // Create unique S3 bucket that hosts Lambda executable
    const bucket = new S3Bucket(scope, `bucket-${config.name}-${config.env}`, {
        bucketPrefix: `${config.name}`,
    });

    // Upload Lambda zip file to newly created S3 bucket
    const lambdaArchive = new S3Object(scope, `archive-${config.name}-${config.env}`, {
        bucket: bucket.bucket,
        key: `${config.name}/${asset.fileName}`,
        source: asset.path, // returns a posix path
    });
    // Create Lambda role
    const role = new IamRole(scope, `role-${config.name}-${config.env}`, {
        name: config.name,
        assumeRolePolicy: JSON.stringify(lambdaRolePolicy),
        inlinePolicy: [
            {
                policy: JSON.stringify(lambdaRolePolicyDoc)
            }
        ]
    });

    new IamRolePolicyAttachment(scope, `policy-attached-${config.name}-${config.env}`, {
        policyArn: "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
        role: role.name
    })

    // Create Lambda function
    const lambdaFunc = new LambdaFunction(scope, `${config.name}-${config.env}`, {
        functionName: config.name,
        s3Bucket: bucket.bucket,
        s3Key: lambdaArchive.key,
        handler: 'main',
        runtime: config.runtime,
        role: role.arn
    });

    // add lambda permission to be executed by apiGateway
    new LambdaPermission(scope, `apigateway-perm-${config.name}-${config.env}`, {
        statementId: 'allow-apigw-execution',
        action: "lambda:InvokeFunction",
        functionName: lambdaFunc.functionName,
        principal: "apigateway.amazonaws.com",
        sourceArn: `${config.apiGwSourceArn}`
    })

    return lambdaFunc
}

