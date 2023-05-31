import { Construct } from 'constructs';
import { DynamodbTable } from "@cdktf/provider-aws/lib/dynamodb-table";
import { region } from '../utils/CommonInterfaces';
import { TerraformStack } from 'cdktf';
import { AwsProvider } from '@cdktf/provider-aws/lib/provider';

export interface IAddDynamoStore {
    name: string;
    primaryKeyName: string;
    sortKeyName?: string;
    primaryKeyType?: "B" | "S" | "N";
    sortKeyType?: "B" | "S" | "N";
    additionalRegions?: region[]

}

export class AddDynamoStore extends TerraformStack {
    public createdTable;
    constructor(scope: Construct, name: string, config: IAddDynamoStore){
    super(scope, name)

    new AwsProvider(this, "aws", {
        region: "us-east-1"
      });

    const attributes = config.sortKeyName ? [{
        name: config.primaryKeyName,
        type: config.primaryKeyType ?? "S"
    },
    {
        name: config.sortKeyName,
        type: config.sortKeyType ?? "S"
    }] : [
        {
            name: config.primaryKeyName,
            type: config.primaryKeyType ?? "S"
        },
    ]
    this.createdTable = new DynamodbTable(this, config.name, {
        name: config.name,
        hashKey: config.primaryKeyName,
        rangeKey: config.sortKeyName ?? undefined,
        billingMode: "PAY_PER_REQUEST",
        attribute: attributes
    })
    
    }
    public getTable = () => {
        return this.createdTable;
    }
}