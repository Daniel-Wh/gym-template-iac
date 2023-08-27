export interface IDynamoResourcePolicyConfig {
    dynamoArns: string[];
    actions: string[];
}
export function GetDynamoResourcePolicy(config: IDynamoResourcePolicyConfig) {
    return {
        Effect: "Allow",
        Action: config.actions,
        Resource: config.dynamoArns
    }

}

// export interface ILambdaResourcePolicyConfig {
// }
// export function GetLambdaResourcePolicy(config: ILambdaResourcePolicyConfig) {

// }