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

export const AddDynamoStore = (construct: Construct, params: IAddDynamoStore) => {

    return new DynamodbTable(construct, params.name, {
        name: params.name,
        hashKey: params.primaryKeyName,
        rangeKey: params.sortKeyName ?? undefined,
        billingMode: "PAY_PER_REQUEST",
    })
}