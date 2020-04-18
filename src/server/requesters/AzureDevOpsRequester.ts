import * as azdev from "azure-devops-node-api";

import * as yauzl from "yauzl";
import * as fs from 'fs';

import { Requester } from './Requester';
import { OTPRequest, Project, AzureDevOpsRequesterConfig } from '../db/models';
import { Request, Response } from 'express';
import * as Joi from 'joi';

export interface AzDOOTPRequestMetadata {
    releaseId: number;
}


const validateMetadataObject = (object: any) => {
    return Joi.validate(object, {
        releaseId: Joi.number()
            .min(1)
            .integer()
            .required(),
    });
};

export class AzureDevOpsRequester implements Requester<AzureDevOpsRequesterConfig, AzDOOTPRequestMetadata>{

    slug: string = "azuredevops-release";

    getConfigForProject(project: Project): AzureDevOpsRequesterConfig | null {
        return project.requester_AzureDevOps || null;
    }
    async metadataForInitialRequest(req: Request, res: Response): Promise<AzDOOTPRequestMetadata | null> {
        const valid = validateMetadataObject(req.body);

        if (valid.error) {
            res.status(400).json({
                error: 'Request Validation Error',
                message: valid.error.message,
            });
            return null;
        }
        return { releaseId: valid.value.releaseId };
    }
    validateActiveRequest(request: OTPRequest<AzDOOTPRequestMetadata, unknown>, config: AzureDevOpsRequesterConfig): Promise<import("./Requester").AllowedState> {
        throw new Error('Method not implemented.');
    }
    isOTPRequestValidForRequester(request: OTPRequest<unknown, unknown>): Promise<OTPRequest<AzDOOTPRequestMetadata, unknown> | null> {
        throw new Error('Method not implemented.');
    }
    getRequestInformationToPassOn(request: OTPRequest<AzDOOTPRequestMetadata, unknown>): Promise<import("../responders/Responder").RequestInformation> {
        throw new Error('Method not implemented.');
    }
    validateProofForRequest(
        request: OTPRequest<AzDOOTPRequestMetadata, unknown>,
        {
            organizationName,
            projectName,
            accessToken
        }: AzureDevOpsRequesterConfig
    ): Promise<boolean> {
        return getLogs(
            organizationName,
            projectName,
            request.requestMetadata.releaseId,
            accessToken
        )
            .then(({ logs, skippedFor }) => {
                const proved = logs.includes(request.proof);
                if (!proved && skippedFor && skippedFor.length > 0) {
                    console.log('The proof was not found, but there were skipped log file entries!')
                }
                return proved;
            })
            .catch(e => {
                return false;
            })
    }

}

/**
 * Get the logs from an Azure Dev Ops Release pipeline. Reject if could not reach the organization/project/releaseDef or there were no runs/logs in that release 
 * @param organizationName 
 * @param projectName 
 * @param releaseDefinitionId 
 * @param token 
 * @returns ✅ A promise resolved with the logs along with errors for skipped log task entries (AzDO logs out individual task logs vs single stdout output - see https://dev.azure.com/gparlakov/Scuri/_releaseProgress?_a=release-environment-logs&releaseId=58&environmentId=87)
 * @returns ❌ A promise rejected for cases when it could not reach the organization/project/releaseDef or there were no runs/logs in that release.
 * @example 
 * // See release definition https://dev.azure.com/gparlakov/Scuri/_release?definitionId=1&view=mine&_a=releases
 * // and release run https://dev.azure.com/gparlakov/Scuri/_releaseProgress?_a=release-environment-logs&releaseId=58&environmentId=87 
 * organizationName === 'gparlakov';
 * projectName === 'scuri';
 * releaseDefinitionId === 1  
 */
export function getLogs(
    organizationName: string,
    projectName: string,
    releaseId: number,
    token: string
): Promise<{ logs: string, skippedFor: Error[] }> {
    const authHandler = azdev.getPersonalAccessTokenHandler(token);
    const orgUrl = `https://dev.azure.com/${organizationName}`;
    const connection = new azdev.WebApi(orgUrl, authHandler);
    return connection.getReleaseApi()
        .then(releaseApi => releaseApi.getLogs(projectName, releaseId))
        .then(logs => storeZippedLogsToTempFile(logs))
        .then(({ zipFileName, cleanUp }) => readLogs(zipFileName, cleanUp));
}

function storeZippedLogsToTempFile(l: NodeJS.ReadableStream): Promise<{ zipFileName: string, cleanUp: () => void }> {
    return new Promise((res, rej) => {
        const zipFileName = `./logs${Date.now()}.zip`;

        l.pipe(fs.createWriteStream(zipFileName))
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
                                readStream.on("end", function () {
                                    zipfile.readEntry();
                                });
                            }
                        });
                    }
                });

                zipfile.once("end", function () {
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