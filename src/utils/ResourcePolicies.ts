export interface IDynamoResourcePolicyConfig {
    dynamoArns: string[];
    actions: string[];
}
export function GetDynamoResourcePolicy(config: IDynamoResourcePolicyConfig) {
    return {
        Effect: "Allow",
        action: config.actions,
        resource: config.dynamoArns
    }

}

// export interface ILambdaResourcePolicyConfig {
// }
// export function GetLambdaResourcePolicy(config: ILambdaResourcePolicyConfig) {

// }