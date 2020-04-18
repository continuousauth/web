import axios from 'axios';
import { Request, Response } from 'express';
import * as fs from 'fs';
import * as Joi from 'joi';
import * as yauzl from 'yauzl';
import { AzureDevOpsRequesterConfig, OTPRequest, Project } from '../db/models';
import { RequestInformation } from '../responders/Responder';
import { AllowedState, Requester } from './Requester';


export interface AzDOOTPRequestMetadata {
    releaseId: number;
}

/**
 * based on https://docs.microsoft.com/en-us/rest/api/azure/devops/release/releases/get%20release?view=azure-devops-rest-5.1#referencelinks 
 * */
export interface AzDORelease {
    id: number;
    name: string;
    operationStatus:
    | 'phaseInProgress'
    | 'all'
    | 'approved'
    | 'canceled'
    | 'cancelling'
    | 'deferred'
    | 'evaluatingGates'
    | 'gateFailed'
    | 'manualInterventionPending'
    | 'pending'
    | 'phaseCanceled'
    | 'phaseFailed'
    | 'phaseInProgress'
    | 'phasePartiallySucceeded'
    | 'phaseSucceeded'
    | 'queued'
    | 'queuedForAgent'
    | 'queuedForPipeline'
    | 'rejected'
    | 'scheduled'
    | 'undefined';
    _links: { self: { href: string }, web: { href: string } };
}

export const getAxiosForConfig = (config: AzureDevOpsRequesterConfig) =>
    axios.create({
        // based on https://docs.microsoft.com/en-us/rest/api/azure/devops/release/releases/get%20release?view=azure-devops-rest-5.1
        baseURL: `https://vsrm.dev.azure.com/${config.organizationName}/${config.projectName}/_apis/`,
        headers: {
            // based on https://docs.microsoft.com/en-us/rest/api/azure/devops/?view=azure-devops-rest-5.1#assemble-the-request
            Authorization: `Basic ${Buffer.from(`PAT:${this.token}`).toString('base64')}`,
            // based on the same request sent by the azure-devops-node-api  see https://github.com/microsoft/azure-devops-node-api/blob/dcf730b1426fb559d6fe2715223d4a7f3b56ef27/api/handlers/personalaccesstoken.ts#L7 which in turn uses https://github.com/microsoft/typed-rest-client/blob/master/lib/handlers/personalaccesstoken.ts
            'X-TFS-FedAuthRedirect': 'Suppress'
        },
        validateStatus: () => true,
    });


const validateMetadataObject = (object: any) => {
    return Joi.validate(object, {
        releaseId: Joi.number()
            .min(1)
            .integer()
            .required(),
    });
};

export class AzureDevOpsRequester implements Requester<AzureDevOpsRequesterConfig, AzDOOTPRequestMetadata>{

    slug: string = 'azuredevops-release';

    getConfigForProject(project: Project): AzureDevOpsRequesterConfig | null {
        return project.requester_AzureDevOps || null;
    }
    async metadataForInitialRequest(req: Request, res: Response): Promise<AzDOOTPRequestMetadata | null> {
        const result = validateMetadataObject(req.body);

        if (result.error) {
            res.status(400).json({
                error: 'Request Validation Error',
                message: result.error.message,
            });
            return null;
        }
        return { releaseId: result.value.releaseId };
    }
    async validateActiveRequest(request: OTPRequest<AzDOOTPRequestMetadata, unknown>, config: AzureDevOpsRequesterConfig): Promise<AllowedState> {
        const axios = getAxiosForConfig(config);
        const response = await axios.get<AzDORelease>(`release/releases/${request.requestMetadata.releaseId}`);

        if (response.status !== 200) {
            return {
                ok: false,
                error: "Release with id " + request.requestMetadata.releaseId + " does not exist!"
            }
        }

        if (response.data.operationStatus != 'phaseInProgress') {
            return {
                ok: false,
                error: "Release with id " + request.requestMetadata.releaseId + " is not in progress!"
            }
        }

        return {
            ok: true
        }
    }
    isOTPRequestValidForRequester(request: OTPRequest<unknown, unknown>): Promise<OTPRequest<AzDOOTPRequestMetadata, unknown> | null> {
        const result = validateMetadataObject(request);
        return result.error ? null : request as any;
    }

    async getRequestInformationToPassOn(request: OTPRequest<AzDOOTPRequestMetadata, unknown>): Promise<RequestInformation> {
        const { project } = request;

        const axios = getAxiosForConfig(project.requester_AzureDevOps!);
        const release = await axios.get<AzDORelease>(`release/releases/${request.requestMetadata.releaseId}`);

        return {
            description: `Azure DevOps Release ${project.repoOwner}/${project.repoName}#${request.requestMetadata.releaseId}`,
            url: release.data._links.web.href
        }
    }

    validateProofForRequest(
        request: OTPRequest<AzDOOTPRequestMetadata, unknown>,
        config: AzureDevOpsRequesterConfig
    ): Promise<boolean> {

        async function attemptValidateProof(attempts: number) {
            if (attempts <= 0) {
                return false;
            }

            const again = async () => {
                await new Promise(r => setTimeout(r, 5000));
                return attemptValidateProof(attempts - 1);
            };

            return getLogs(config, request.requestMetadata.releaseId)
                .then(({ logs }) => logs.includes(request.proof) ? true : again())
                .catch(e => {
                    return again();
                });
        }

        return attemptValidateProof(3);
    }

}

/**
 * Get the logs from an Azure Dev Ops Release pipeline. They come in a zip file with multiple log files in it - 1 per phase task. 
 * Reject if could not reach the organization/project/releaseDef or there were no runs/logs in that release 
 * @param config  
 * @param releaseId 
 * @example 
 * // See release definition https://dev.azure.com/gparlakov/Scuri/_release?definitionId=1&view=mine&_a=releases
 * // and release run https://dev.azure.com/gparlakov/Scuri/_releaseProgress?_a=release-environment-logs&releaseId=58&environmentId=87 
 * config.organizationName === 'gparlakov';
 * config.projectName === 'scuri';
 * config.accessToken = 'easasdasdasdasdasda12d2312d13ed1d'; 
 * releaseId === 58  
 */
export function getLogs(
    config: AzureDevOpsRequesterConfig,
    releaseId: number
): Promise<{ logs: string, skippedFor: Error[] }> {
    const instance = getAxiosForConfig(config);

    return instance.get<NodeJS.ReadableStream>(`release/releases/${releaseId}/logs`, { responseType: 'stream' })
        .then(logs => {
            if (logs.status != 200) {
                throw new Error('logs missing');
            }
            return storeZippedLogsToTempFile(logs.data);
        })
        .then(({ zipFileName, cleanUp }) => readLogs(zipFileName, cleanUp));
}

function storeZippedLogsToTempFile(logsZipped: NodeJS.ReadableStream): Promise<{ zipFileName: string, cleanUp: () => void }> {
    return new Promise((res, rej) => {
        const zipFileName = `./logs${Date.now()}.zip`;

        logsZipped.pipe(fs.createWriteStream(zipFileName))
            .on('error', error => {
                rej(error)
            })

            .on('finish', () => {
                res({
                    zipFileName,
                    cleanUp() {
                        if (fs.existsSync(zipFileName)) {
                            fs.unlinkSync(zipFileName);
                        }
                    }
                })
            });
    })
}

function readLogs(zipFileName: string, cleanUp: () => void): Promise<{ logs: string, skippedFor: Error[] }> {

    // we'll reject the promise when we can't read anything from the zip
    // and resolve it when we could read (some) plus add the errors for the skipped parts 
    // in the end we'd like to say - yes the logs contain the Proof OR no the logs do not contain the proof but there were skipped parts 
    return new Promise((res, rej) => {

        const es: Error[] = [];

        yauzl.open(zipFileName, { lazyEntries: true }, function (err, zipfile) {
            // can not even open the archive just reject the promise
            if (err) {
                rej(err);
            }
            if (zipfile != null) {
                const chunks: any[] = [];

                zipfile.on("entry", function (entry) {

                    if (/\/$/.test(entry.fileName)) {
                        // Directory file names end with '/'.
                        // Note that entries for directories themselves are optional.
                        // An entry's fileName implicitly requires its parent directories to exist.
                        zipfile.readEntry();
                    } else {
                        // file entry
                        zipfile.openReadStream(entry, function (err, readStream) {
                            if (err) {
                                es.push(err);
                                // skip this one - could not read it from zip
                                zipfile.readEntry();
                            };
                            if (readStream == null) {
                                // just skip - could not get a read stream from it
                                es.push(new Error('Could not create a readable stream for the log ' + (entry || {}).fileName || '<missing file name>'))
                                zipfile.readEntry();
                            } else {
                                readStream.on('data', c => chunks.push(c))
                                readStream.on('error', e => {
                                    es.push(e);
                                    // skip this one - could not read it from zip
                                    zipfile.readEntry();
                                });
                                readStream.on('end', function () {
                                    zipfile.readEntry();
                                });
                            }
                        });
                    }
                });

                zipfile.once('end', function () {
                    zipfile.close();
                    cleanUp();
                    res({ logs: Buffer.concat(chunks).toString('utf8'), skippedFor: es });
                });

                zipfile.readEntry();
            } else {
                // can't read the archive - reject the promise
                rej(new Error('Could not read the zipfile contents'));
            }
        });
    })
}