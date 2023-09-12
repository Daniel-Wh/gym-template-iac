import { AwsProvider } from "@cdktf/provider-aws/lib/provider";
import { TerraformStack } from "cdktf";
import { Construct } from "constructs";
import { AddApiGateway } from "../constructs/AddApiGateway";
import { AddDynamoStore } from "../constructs/AddDynamoStore";
import { CreateLambdaFunc } from "../constructs/AddLamdbaFunc";
import { CreateGatewayIntegrationForLambda } from "../constructs/GatewayIntegration";
import { DataAwsLambdaFunction } from "@cdktf/provider-aws/lib/data-aws-lambda-function";
import { ApiGatewayStage } from "@cdktf/provider-aws/lib/api-gateway-stage";
import { ApiGatewayDeployment } from "@cdktf/provider-aws/lib/api-gateway-deployment";
import { ApiGatewayRestApiPolicy } from "@cdktf/provider-aws/lib/api-gateway-rest-api-policy";
import { DataAwsDynamodbTable } from "@cdktf/provider-aws/lib/data-aws-dynamodb-table";
import { IDynamoResourcePolicyConfig } from "../utils/ResourcePolicies";
import { IamUser } from "@cdktf/provider-aws/lib/iam-user";
import { IamUserPolicy } from "@cdktf/provider-aws/lib/iam-user-policy";
import { IamAccessKey } from "@cdktf/provider-aws/lib/iam-access-key";

export interface IBackendNpConfig {
    env: string;
}
export class BackendNpInfraStack extends TerraformStack {

    constructor(scope: Construct, name: string, config: IBackendNpConfig) {
        super(scope, name)
        let usersNonProd;
        let usersTableNonProd;
        let userStatsNonProd;
        let authServicesLambda;
        new AwsProvider(this, "aws", {
            region: 'us-east-1',
            accessKey: process.env.ACCESS_KEY,
            secretKey: process.env.SECRET_KEY
        })

        const apiGw = AddApiGateway(this, {
            name: `backend-services`,
            env: config.env
        })
        if (config.env === "dev") {
            usersTableNonProd = AddDynamoStore(this, {
                name: 'Users-nonprod',
                primaryKeyName: 'Email',
                primaryKeyType: "S",
                sortKeyName: 'Gym',
                sortKeyType: 'S',
            })
            usersNonProd = AddDynamoStore(this, {
                name: 'Users-Table-nonprod',
                primaryKeyName: 'Email',
                primaryKeyType: "S",
                sortKeyName: 'Gym',
                sortKeyType: 'S',
            })
            userStatsNonProd = AddDynamoStore(this, {
                name: 'User-Stats-nonprod',
                primaryKeyName: 'Id',
                primaryKeyType: "S",
                sortKeyName: 'Gym',
                sortKeyType: 'S',
            })
            authServicesLambda = CreateLambdaFunc(this, {
                name: 'auth-service-nonprod',
                entryPoint: 'auth.services::auth.services.LambdaEntryPoint::FunctionHandlerAsync',
                runtime: 'dotnet6',
                version: '0.0',
                env: 'dev',
                apiGwSourceArn: `${apiGw.executionArn}/*/*/*`,
                tableResources: [{
                    dynamoArns: [usersNonProd.arn],
                    actions: ["dynamodb:*"]
                }]
            })

            // role for github pre-release and deploy
            const githubUserRole = new IamUser(this, 'github_user_role', {
                name: 'github_s3_read_only_deploy_lambda'
            })
            new IamAccessKey(this, 'github_user_access_key', {
                user: githubUserRole.name
            })

            const githubActionsPolicy = {
                "Version": "2012-10-17",
                "Statement": [
                    {
                        "Effect": "Allow",
                        "Action": [
                            "s3:*",
                            "s3-object-lambda:*",
                            "lambda:UpdateFunctionCode"
                        ],
                        "Resource": "*"
                    }
                ]

            }
            new IamUserPolicy(this, 'github_user_policy', {
                user: githubUserRole.name,
                policy: JSON.stringify(githubActionsPolicy)
            })


        } else {
            //TODO: update these when beyond dev env
            authServicesLambda = new DataAwsLambdaFunction(this, "auth-service-nonprod", {
                functionName: "auth-service-nonprod"
            })
            usersNonProd = new DataAwsDynamodbTable(this, "Token", {
                name: "Token"
            })
            userStatsNonProd = new DataAwsDynamodbTable(this, "Token", {
                name: "Token"
            })
            usersTableNonProd = new DataAwsDynamodbTable(this, "Token", {
                name: "Token"
            })

            // use data resource to get ARN of auth services to give perms to other lambdas to execute
            // will need auth services lambda to set up apigateway integration at /user and change integration authorization to iam user
            // to restrict access to only other lambdas
        }
        const env = config.env

        const readOnlyTableConfig: IDynamoResourcePolicyConfig = {
            dynamoArns: [usersNonProd.arn],
            actions: ["dynamodb:GetItem", "dynamodb:Query", "dynamodb:ConditionCheckItem", "dynamodb:Scan"]
        }

        const openTables: IDynamoResourcePolicyConfig = {
            dynamoArns: [userStatsNonProd.arn, usersTableNonProd.arn],
            actions: ["dynamo:*"]
        }


        // each env gets an apigateway and two lambdas, both of those lambdas need to be able to invoke
        // the user lambda
        // make two apigateway resources and then make a method (any) for each and point the resource path to the correct lambda function
        const userServicesLambda = CreateLambdaFunc(this, {
            name: `user-services-${env}`,
            entryPoint: 'User.Services::User.Services.LambdaEntryPoint::FunctionHandlerAsync',
            runtime: 'dotnet6',
            version: '0.0',
            env: env,
            apiGwSourceArn: `${apiGw.executionArn}/*/*`,
            tableResources: [readOnlyTableConfig, openTables]
        })
        const clientServicesLambda = CreateLambdaFunc(this, {
            name: `client-services-${env}`,
            entryPoint: 'Client.Services::Client.Services.LambdaEntryPoint::FunctionHandlerAsync',
            runtime: 'dotnet6',
            version: '0.0',
            env: env,
            apiGwSourceArn: `${apiGw.executionArn}/*/*`,
            tableResources: [readOnlyTableConfig, openTables]
        })

        const userIntegration = CreateGatewayIntegrationForLambda(this, {
            apiGw: apiGw,
            lambdaInvokeArn: userServicesLambda.invokeArn,
            pathPart: 'user',
            name: 'user-integration',
            env: env,
            isPrivate: false
        })

        const clientIntegration = CreateGatewayIntegrationForLambda(this, {
            apiGw: apiGw,
            lambdaInvokeArn: clientServicesLambda.invokeArn,
            pathPart: 'client',
            name: 'client-integration',
            env: env,
            isPrivate: false
        })

        const authIntegration = CreateGatewayIntegrationForLambda(this, {
            apiGw: apiGw,
            lambdaInvokeArn: authServicesLambda.invokeArn,
            pathPart: 'auth',
            name: 'auth-integration',
            env: env,
            isPrivate: true
        })

        const apiGatewayPolicy = {
            "Version": "2012-10-17",
            "Statement": [

                {
                    "Action": "execute-api:Invoke",
                    "Principal": "*",
                    "Effect": "Allow",
                    "Resource": "*",
                }
            ]
        };

        new ApiGatewayRestApiPolicy(this, `backend-services-${env}-policy`, {
            restApiId: apiGw.id,
            policy: JSON.stringify(apiGatewayPolicy)
        })
        const deployment = new ApiGatewayDeployment(this, `backend-gateway-${env}-${name}`, {
            restApiId: apiGw.id,
            dependsOn: [
                clientIntegration,
                userIntegration,
                authIntegration
            ],
            triggers: {
                "client": clientIntegration.id,
                "user": userIntegration.id,
                "auth": authIntegration.id
            },
            lifecycle: {
                createBeforeDestroy: true
            }
        })

        new ApiGatewayStage(this, 'backend-gateway-stage', {
            deploymentId: deployment.id,
            restApiId: apiGw.id,
            stageName: "dev",
            lifecycle: {
                createBeforeDestroy: true
            }
        })

    }
}