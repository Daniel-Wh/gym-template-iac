import { App } from "cdktf";
import { BackendNpInfraStack } from "./src/backend/Backend-np-Infra";

const app = new App();


new BackendNpInfraStack(app, "Backend-nonprod")

app.synth();
