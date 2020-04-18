import { getLogs } from "../src/server/requesters/AzureDevOpsRequester";
import { AzureDevOpsRequesterConfig } from '../src/server/db/models';

// your collection url
const organizationName = 'gparlakov';
const projectName = 'scuri';
let releaseDefId = 1;
const releaseId = 58;

const accessToken = process.env.AZURE_PERSONAL_ACCESS_TOKEN; // e.g "cbdeb34vzyuk5l4gxc4qfczn3lko3avfkfqyb47etahq6axpcqha"; 

async function run() {
    if (accessToken == null) {
        console.log('The azure token is empty - please set it in your AZURE_PERSONAL_ACCESS_TOKEN environment variable')
        process.exit(1);
    }
    try {
        const { logs, skippedFor } = await getLogs({ organizationName, projectName, accessToken } as AzureDevOpsRequesterConfig, releaseId);
        console.log("length", logs.length, skippedFor.length > 0 ? "Log entries were skipped due to errors" : "");
        console.log(logs);
    } catch (e) {
        console.log(`We could not reach the ${organizationName}/${projectName} release(${releaseId}) with these or there were no runs/logs in that release`, e);
    }
}

run();

