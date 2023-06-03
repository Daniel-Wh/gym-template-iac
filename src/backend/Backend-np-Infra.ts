import { apiGatewayDeployment, apiGatewayRestApiPolicy, apiGatewayStage, dataAwsLambdaFunction } from "@cdktf/provider-aws";
import { AwsProvider } from "@cdktf/provider-aws/lib/provider";
import { TerraformStack } from "cdktf";
import { Construct } from "constructs";
import { AddApiGateway } from "../constructs/AddApiGateway";
import { AddDynamoStore } from "../constructs/AddDynamoStore";
import { CreateLambdaFunc } from "../constructs/AddLamdbaFunc";
import { CreateGatewayIntegrationForLambda } from "../constructs/GatewayIntegration";
import { DataAwsLambdaFunction } from "@cdktf/provider-aws/lib/data-aws-lambda-function";

export interface IBackendNpConfig {
    env: string;
}
export class BackendNpInfraStack extends TerraformStack {

    constructor(scope: Construct, name: string, config: IBackendNpConfig) {
        super(scope, name)

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

            CreateLambdaFunc(this, {
                name: 'auth-service-nonprod',
                runtime: 'go1.x',
                version: '0.0',
                env: 'dev',
                apiGwSourceArn: `${apiGw.executionArn}/*/*/*`
            })
            new AddDynamoStore(this, {
                name: 'Users-nonprod',
                primaryKeyName: 'Email',
                primaryKeyType: "S",
                sortKeyName: 'Gym',
                sortKeyType: 'S',
            })
            new AddDynamoStore(this, {
                name: 'User-Stats-nonprod',
                primaryKeyName: 'Id',
                primaryKeyType: "S",
                sortKeyName: 'Gym',
                sortKeyType: 'S',
            })

        } else {
            new DataAwsLambdaFunction(this, "auth-service-nonprod", {
                functionName: "auth-service-nonprod"
            })

            // use data resource to get ARN of auth services to give perms to other lambdas to execute
            // will need auth services lambda to set up apigateway integration at /user and change integration authorization to iam user
            // to restrict access to only other lambdas
        }

        const env = config.env
        // each env gets an apigateway and two lambdas, both of those lambdas need to be able to invoke
        // the user lambda
        // make two apigateway resources and then make a method (any) for each and point the resource path to the correct lambda function
        const userServicesLambda = CreateLambdaFunc(this, {
            name: `user-services-${env}`,
            runtime: 'go1.x',
            version: '0.0',
            env: env,
            apiGwSourceArn: `${apiGw.executionArn}/*/*`
        })
        const clientServicesLambda = CreateLambdaFunc(this, {
            name: `client-services-${env}`,
            runtime: 'go1.x',
            version: '0.0',
            env: env,
            apiGwSourceArn: `${apiGw.executionArn}/*/*`
        })

        const userIntegration = CreateGatewayIntegrationForLambda(this, {
            apiGw: apiGw,
            lambda: userServicesLambda,
            pathPart: 'user',
            name: 'user-integration',
            env: env
        })

        const clientIntegration = CreateGatewayIntegrationForLambda(this, {
            apiGw: apiGw,
            lambda: clientServicesLambda,
            pathPart: 'client',
            name: 'client-integration',
            env: env
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

        new apiGatewayRestApiPolicy.ApiGatewayRestApiPolicy(this, `backend-services-${env}-policy`, {
            restApiId: apiGw.id,
            policy: JSON.stringify(apiGatewayPolicy)
        })
        const deployment = new apiGatewayDeployment.ApiGatewayDeployment(this, `backend-gateway-${env}-${name}`, {
            restApiId: apiGw.id,
            dependsOn: [
                clientIntegration,
                userIntegration
            ],
            triggers: {
                "client": clientIntegration.id,
                "user": userIntegration.id
            },
            lifecycle: {
                createBeforeDestroy: true
            }
        })

        new apiGatewayStage.ApiGatewayStage(this, 'backend-gateway-stage', {
            deploymentId: deployment.id,
            restApiId: apiGw.id,
            stageName: "dev",
            lifecycle: {
                createBeforeDestroy: true
            }
        })

    }
}