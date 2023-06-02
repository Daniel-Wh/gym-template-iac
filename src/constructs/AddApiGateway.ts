import { Construct } from "constructs";
import { apiGatewayRestApi } from "@cdktf/provider-aws";

export interface ApiGatewayConfig {
    name: string,
    env: string
}



export class AddApiGateway {
    public createdApiGateway: apiGatewayRestApi.ApiGatewayRestApi;
    get apiGw(): apiGatewayRestApi.ApiGatewayRestApi {
        return this.createdApiGateway;
    }
    constructor(scope: Construct, config: ApiGatewayConfig) {
        const gateway = new apiGatewayRestApi.ApiGatewayRestApi(scope, `${config.name}-${config.env}`, {
            name: `${config.name}-${config.env}`

        })

        this.createdApiGateway = gateway;
    }
}