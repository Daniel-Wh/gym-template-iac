import { apiGatewayDeployment, apiGatewayRestApiPolicy, apiGatewayStage } from "@cdktf/provider-aws";
import { ApiGatewayIntegration } from "@cdktf/provider-aws/lib/api-gateway-integration";
import { ApiGatewayMethod } from "@cdktf/provider-aws/lib/api-gateway-method";
import { ApiGatewayResource } from "@cdktf/provider-aws/lib/api-gateway-resource";
import { AwsProvider } from "@cdktf/provider-aws/lib/provider";
import { TerraformStack } from "cdktf";
import { Construct } from "constructs";
import { AddApiGateway } from "../constructs/AddApiGateway";
import { AddDynamoStore } from "../constructs/AddDynamoStore";
import { LambdaStack } from "../constructs/AddLamdbaFunc";

export interface IBackendNpConfig {
    env: string;
}
export class BackendNpInfraStack extends TerraformStack {
    public authService;
    public userTable;
    public userStatsTable;
    constructor(scope: Construct, name: string, config: IBackendNpConfig) {
        super(scope, name)

        new AwsProvider(this, "aws", {
            region: 'us-east-1',
            accessKey: process.env.ACCESS_KEY,
            secretKey: process.env.SECRET_KEY
        })

        const apiGw = new AddApiGateway(this, {
            name: `backend-services`,
            env: config.env
        })
        if (config.env === "dev") {

            const authServiceLambda = new LambdaStack(this, 'auth-service-nonprod', {
                name: 'auth-service-nonprod',
                runtime: 'nodejs16.x',
                version: '0.0',
                env: 'dev',
                apiGwSourceArn: `${apiGw.apiGw.executionArn}/*/*/*`
            })
            this.authService = authServiceLambda.getFunc();
            const userStore = new AddDynamoStore(this, {
                name: 'Users-nonprod',
                primaryKeyName: 'Email',
                primaryKeyType: "S",
                sortKeyName: 'Gym',
                sortKeyType: 'S',
            })
            this.userTable = userStore.getTable();
            console.log("user table arn: " + this.userTable.arn);
            const userStats = new AddDynamoStore(this, {
                name: 'User-Stats-nonprod',
                primaryKeyName: 'Id',
                primaryKeyType: "S",
                sortKeyName: 'Gym',
                sortKeyType: 'S',
            })
            this.userStatsTable = userStats.getTable();
            console.log("user stats table arn: " + this.userTable.arn);
            console.log("auth service arn: " + this.authService.arn)
        } else {
            // use data resource to get ARN of user services to give perms to other lambdas
        }

        const env = config.env
        // each env gets an apigateway and two lambdas, both of those lambdas need to be able to invoke
        // the user lambda
        // make two apigateway resources and then make a method (any) for each and point the resource path to the correct lambda function
        const userServicesLambda = new LambdaStack(this, `user-services-${env}`, {
            name: `user-services-${env}`,
            runtime: 'nodejs16.x',
            version: '0.0',
            env: env,
            apiGwSourceArn: `${apiGw.apiGw.executionArn}/*/*`
        })
        const clientServicesLambda = new LambdaStack(this, `client-services-${env}`, {
            name: `client-services-${env}`,
            runtime: 'nodejs16.x',
            version: '0.0',
            env: env,
            apiGwSourceArn: `${apiGw.apiGw.executionArn}/*/*`
        })


        const apiGwResource = new ApiGatewayResource(this, `user-gw-resource-${env}`, {
            restApiId: apiGw.apiGw.id,
            parentId: apiGw.apiGw.rootResourceId,
            pathPart: `user`,
            dependsOn: [apiGw.apiGw]
        })
        const apiGwUserMethod = new ApiGatewayMethod(this, `user-integration-method-${env}`, {
            authorization: 'NONE',
            httpMethod: 'ANY',
            resourceId: apiGwResource.id,
            restApiId: apiGw.apiGw.id,
            dependsOn: [apiGwResource]
        })
        const userIntegration = new ApiGatewayIntegration(this, `user-services-integration-${env}`, {
            restApiId: apiGw.apiGw.id,
            resourceId: apiGwResource.id,
            httpMethod: apiGwUserMethod.httpMethod,
            integrationHttpMethod: 'POST',
            type: 'AWS_PROXY',
            uri: userServicesLambda.getFunc().invokeArn,
            dependsOn: [apiGwUserMethod]
        })
        const apiGwClientResource = new ApiGatewayResource(this, `client-gw-resource-${env}`, {
            restApiId: apiGw.apiGw.id,
            parentId: apiGw.apiGw.rootResourceId,
            pathPart: `client`,
            dependsOn: [apiGw.apiGw]
        })
        const apiGwClientMethod = new ApiGatewayMethod(this, `client-integration-method-${env}`, {
            authorization: 'NONE',
            httpMethod: 'ANY',
            resourceId: apiGwClientResource.id,
            restApiId: apiGw.apiGw.id,
            dependsOn: [apiGwClientResource]
        })

        const clientIntegration = new ApiGatewayIntegration(this, `client-services-integration-${env}`, {
            restApiId: apiGw.apiGw.id,
            resourceId: apiGwClientResource.id,
            httpMethod: apiGwClientMethod.httpMethod,
            integrationHttpMethod: 'POST',
            type: 'AWS_PROXY',
            uri: clientServicesLambda.getFunc().invokeArn,
            dependsOn: [apiGwClientMethod]
        })



        const apiGatewayPolicy = {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Action": "lambda:InvokeFunction",
                    "Principal": "*",
                    "Effect": "Allow",
                    "Resource": [
                        `${userServicesLambda.getFunc().invokeArn}/*/*`,
                        `${clientServicesLambda.getFunc().invokeArn}/*/*`
                    ]
                },
                {
                    "Action": "execute-api:Invoke",
                    "Principal": "*",
                    "Effect": "Allow",
                    "Resource": "*",
                }
            ]
        };

        new apiGatewayRestApiPolicy.ApiGatewayRestApiPolicy(this, `backend-services-${env}-policy`, {
            restApiId: apiGw.apiGw.id,
            policy: JSON.stringify(apiGatewayPolicy)
        })
        const deployment = new apiGatewayDeployment.ApiGatewayDeployment(this, `backend-gateway-${env}-${name}`, {
            restApiId: apiGw.apiGw.id,
            dependsOn: [
                clientIntegration,
                userIntegration
            ],
            lifecycle: {
                createBeforeDestroy: true
            }
        })

        new apiGatewayStage.ApiGatewayStage(this, 'backend-gateway-stage', {
            deploymentId: deployment.id,
            restApiId: apiGw.apiGw.id,
            stageName: "dev",
            lifecycle: {
                createBeforeDestroy: true
            }
        })

    }
}