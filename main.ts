import { App } from "cdktf";
import { BackendNpInfraStack } from "./src/backend/Backend-np-Infra";

const app = new App();


new BackendNpInfraStack(app, "Backend-services", {
  env: 'dev'
});
// new BackendNpInfraStack(app, "Backend-services", {
//   env: 'qa'
// })
// new BackendNpInfraStack(app, "Backend-services", {
//   env: 'staging'
// })



app.synth();
