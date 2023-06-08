import { Construct } from 'constructs';
import { DynamodbTable } from "@cdktf/provider-aws/lib/dynamodb-table";
import { region } from '../utils/CommonInterfaces';

export interface IAddDynamoStore {
    name: string;
    primaryKeyName: string;
    sortKeyName?: string;
    primaryKeyType?: "B" | "S" | "N";
    sortKeyType?: "B" | "S" | "N";
    additionalRegions?: region[]

}

export function AddDynamoStore(scope: Construct, config: IAddDynamoStore) {
    // todo - add additional region replication
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
    return new DynamodbTable(scope, config.name, {
        name: config.name,
        hashKey: config.primaryKeyName,
        rangeKey: config.sortKeyName ?? undefined,
        billingMode: "PAY_PER_REQUEST",
        attribute: attributes
    })

}

