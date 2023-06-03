import { Construct } from "constructs";
import { apiGatewayRestApi } from "@cdktf/provider-aws";

export interface IApiGatewayConfig {
    name: string,
    env: string
}



export function AddApiGateway(scope: Construct, config: IApiGatewayConfig) {

    return new apiGatewayRestApi.ApiGatewayRestApi(scope, `${config.name}-${config.env}-gw`, {
        name: `${config.name}-${config.env}`,
        lifecycle: {
            createBeforeDestroy: true
        }
    })

}
