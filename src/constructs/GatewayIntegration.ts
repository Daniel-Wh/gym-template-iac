import { ApiGatewayIntegration } from "@cdktf/provider-aws/lib/api-gateway-integration";
import { ApiGatewayMethod } from "@cdktf/provider-aws/lib/api-gateway-method";
import { ApiGatewayResource } from "@cdktf/provider-aws/lib/api-gateway-resource";
import { ApiGatewayRestApi } from "@cdktf/provider-aws/lib/api-gateway-rest-api";
import { LambdaFunction } from "@cdktf/provider-aws/lib/lambda-function";
import { Construct } from "constructs";

export interface IGatewayIntegrationForLambda {
    name: string;
    env: string;
    pathPart: string,
    apiGw: ApiGatewayRestApi;
    lambda: LambdaFunction;
}

export function CreateGatewayIntegrationForLambda(scope: Construct, config: IGatewayIntegrationForLambda) {
    const apiGwResource = new ApiGatewayResource(scope, `${config.pathPart}-gw-resource-${config.env}`, {
        restApiId: config.apiGw.id,
        parentId: config.apiGw.rootResourceId,
        pathPart: config.pathPart,
        dependsOn: [config.apiGw]
    })
    const apiGwUserMethod = new ApiGatewayMethod(scope, `${config.pathPart}-integration-method-${config.env}`, {
        authorization: 'NONE',
        httpMethod: 'ANY',
        resourceId: apiGwResource.id,
        restApiId: config.apiGw.id,
        dependsOn: [apiGwResource]
    })
    const integration = new ApiGatewayIntegration(scope, `${config.pathPart}-services-integration-${config.env}`, {
        restApiId: config.apiGw.id,
        resourceId: apiGwResource.id,
        httpMethod: apiGwUserMethod.httpMethod,
        integrationHttpMethod: 'POST',
        type: 'AWS_PROXY',
        uri: config.lambda.invokeArn,
        dependsOn: [apiGwUserMethod]
    })

    return integration;
}