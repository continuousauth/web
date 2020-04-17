import { getLogs } from "../src/server/requesters/AzureDevOpsRequester";

// your collection url
const orgName = 'gparlakov';
const projName = 'scuri';
let releaseDefId = 1;

const token: string = "2bg5hcf7kgjcz7woxf74wob6xffisdisnthbs4qp6qtvw6mwkoia";// process.env.AZURE_PERSONAL_ACCESS_TOKEN; // e.g "cbdeb34vzyuk5l4gxc4qfczn3lko3avfkfqyb47etahq6axpcqha"; 



(async function run() {
    try {
        const { logs, skippedFor } = await getLogs(orgName, projName, releaseDefId, token);
        console.log("length", logs.length, skippedFor.length > 0 ? "Log entries were skipped due to errors" : "");
    } catch (e) {
        console.log(`We could not reach the ${orgName}/${projName} releaseDefinition(${releaseDefId}) with these or there were no runs/logs in that release`);
    }
}());

