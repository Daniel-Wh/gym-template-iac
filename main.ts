import { App } from "cdktf";
import { AddDynamoStore } from "./src/constructs/AddDynamoStore";
import { LambdaStack } from "./src/constructs/AddLamdbaFunc";

const envs = ["dev", "qa", "staging", "prod"]
const app = new App();


envs.forEach(env => {
  // each environment gets an apigateway and open api spec that maps the client/user services lambdas for the apigateway
  // non prod environments share user auth service lambda
  let authService;
  if(env == "dev"){
    // make the non prod auth service and shared nonprod dynamo tables
    authService = new LambdaStack(app, 'auth-service-nonprod', {
      name: 'auth-service-nonprod',
      runtime: 'nodejs16.x',
      stageName: '',
      version: '0.0',
      env: 'dev'
    })
    const userTable = new AddDynamoStore(app, 'Users', {
      name: 'Users-nonprod',
      primaryKeyName: 'Email',
      primaryKeyType: "S",
      sortKeyName: 'Gym',
      sortKeyType: 'S',
    })
    console.log("user table arn: " + userTable.getTable().arn);
    const userStats = new AddDynamoStore(app, "User-Stats", {
      name: 'User-Stats-nonprod',
      primaryKeyName: 'Id',
      primaryKeyType: "S",
      sortKeyName: 'Gym',
      sortKeyType: 'S',
    })
    console.log("user stats table arn: " + userStats.getTable().arn);
    console.log("auth service arn: " + authService.getFunc().arn)
  }

})

app.synth();
