import { Construct } from "constructs";
import { TerraformStack} from "cdktf";
import * as aws from "@cdktf/provider-aws";

export interface ApiGatewayConfig {
    name: string,
    openApiSpec: string,
    env: string
}



export class AddApiGateway extends TerraformStack {
    public createdApiGateway: aws.apiGatewayRestApi.ApiGatewayRestApi;
    constructor(scope: Construct, name: string, config: ApiGatewayConfig) {
        super(scope, name);
        const gateway = new aws.apiGatewayRestApi.ApiGatewayRestApi(this, config.name, {
            name: `${config.env}-${config.name}`,
            body: config.openApiSpec

        })

        this.createdApiGateway = gateway;
    }
    public getGateway = () => {
        return this.createdApiGateway;
    }
}