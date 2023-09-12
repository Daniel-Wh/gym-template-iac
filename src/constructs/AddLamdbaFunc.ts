import * as path from "path";
import { Construct } from "constructs";
import { TerraformAsset, AssetType, Fn } from "cdktf";
import { S3Bucket } from "@cdktf/provider-aws/lib/s3-bucket";
import { S3Object } from "@cdktf/provider-aws/lib/s3-object";
import { IamRole } from "@cdktf/provider-aws/lib/iam-role";
import { LambdaPermission } from "@cdktf/provider-aws/lib/lambda-permission";
import { LambdaFunction } from "@cdktf/provider-aws/lib/lambda-function";
import { IamRolePolicyAttachment } from "@cdktf/provider-aws/lib/iam-role-policy-attachment";
import { GetDynamoResourcePolicy, IDynamoResourcePolicyConfig } from "../utils/ResourcePolicies";
import { IamPolicy } from "@cdktf/provider-aws/lib/iam-policy";
import { DataAwsSecretsmanagerSecret } from "@cdktf/provider-aws/lib/data-aws-secretsmanager-secret";
import { DataAwsSecretsmanagerSecretVersion } from "@cdktf/provider-aws/lib/data-aws-secretsmanager-secret-version";

export interface LambdaFunctionConfig {
    runtime: string,
    version: string,
    env: string,
    name: string,
    entryPoint: string,
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
    lambdaStatementArr.push({
        "Sid": "getSecretValue",
        "Effect": "Allow",
        "Action": ["secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret"],
        "Resource": "*"
    })
    const lambdaRolePolicyDoc = {
        "Version": "2012-10-17",
        "Statement": lambdaStatementArr
    }
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
        path: path.resolve(__dirname, 'publish.zip'),
        type: AssetType.FILE, // if left empty it infers directory and file
    });

    // Create unique S3 bucket that hosts Lambda executable
    const bucket = new S3Bucket(scope, `bucket-${config.name}-${config.env}`, {
        bucketPrefix: config.name,
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
        assumeRolePolicy: JSON.stringify(lambdaRolePolicy)
    });

    const policy = new IamPolicy(scope, `policy-${config.name}-${config.env}`, {
        policy: JSON.stringify(lambdaRolePolicyDoc),
    })

    new IamRolePolicyAttachment(scope, `policy-attached-${config.name}-${config.env}`, {
        policyArn: policy.arn,
        role: role.name
    })

    const isAuthServices = config.name.includes("auth")
    let SIGNINGKEY = "";

    if (isAuthServices) {
        const secret = new DataAwsSecretsmanagerSecret(scope, "SIGNINGKEYSECRET", {
            name: "JWTSIGNINGKEY"
        })
        const key = new DataAwsSecretsmanagerSecretVersion(scope, "SIGNINGKEYSECRETVALUE", {
            secretId: secret.id
        })
        SIGNINGKEY = Fn.jsonencode(key.secretString)

    }
    // Create Lambda function
    const lambdaFunc = new LambdaFunction(scope, `${config.name}-${config.env}`, {
        functionName: config.name,
        s3Bucket: bucket.bucket,
        s3Key: lambdaArchive.key,
        handler: config.entryPoint,
        timeout: 600,
        runtime: config.runtime,
        role: role.arn,
        environment: {
            variables: {
                SIGNINGKEY
            }
        }
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

