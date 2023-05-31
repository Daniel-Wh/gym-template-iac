import { Construct } from "constructs";
import { TerraformStack } from "cdktf";
import * as aws from "@cdktf/provider-aws";
import { AwsProvider } from "@cdktf/provider-aws/lib/provider";

export interface ApiGatewayConfig {
    name: string,
    env: string
}



export class AddApiGateway extends TerraformStack {
    public createdApiGateway: aws.apiGatewayRestApi.ApiGatewayRestApi;
    constructor(scope: Construct, name: string, config: ApiGatewayConfig) {
        super(scope, name);
        new AwsProvider(this, "aws", {
            region: 'us-east-1'
        })
        const gateway = new aws.apiGatewayRestApi.ApiGatewayRestApi(this, config.name, {
            name: `${config.env}-${config.name}`

        })

        this.createdApiGateway = gateway;
    }
    public getGateway = () => {
        return this.createdApiGateway;
    }
}