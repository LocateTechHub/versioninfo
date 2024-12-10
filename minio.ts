import {Client} from "npm:minio";
import {encodeBase64} from "jsr:@std/encoding/base64";
import {VersionInfo} from "./versionInfo.ts";

export default class MinioClient {
    public minioClient: Client;
    public defaultBucket: string;

    constructor({endPoint, accessKey, secretKey, bucket}: {
        endPoint: string;
        accessKey: string;
        secretKey: string;
        bucket: string;
    }) {
        const params = {
            endPoint: endPoint,
            useSSL: true,
            accessKey: accessKey,
            secretKey: secretKey,
        };
        this.defaultBucket = bucket;
        this.minioClient = new Client(params);
    }

    async uploadFile({sourceFilePath, ossFilePath, bucket, descriptionData}: {
        sourceFilePath: string;
        ossFilePath: string;
        bucket?: string;
        descriptionData?: VersionInfo;
    }) {
        await Deno.lstat(sourceFilePath);

        if (!bucket) {
            bucket = this.defaultBucket;
        }

        const exists = await this.minioClient.bucketExists(bucket);
        if (!exists) {
            throw new Error("bucket not exists");
        }

        const metaData = {
            "e-description": encodeBase64(JSON.stringify(descriptionData)),
            "e-git-branch": descriptionData.gitBranch,
            "e-git-hash": descriptionData.gitHash,
            "e-build-time": descriptionData.buildTime,
        }

        await this.minioClient.fPutObject(bucket, ossFilePath, sourceFilePath, metaData);
        console.log(
            "File " + sourceFilePath + " uploaded as object " + ossFilePath +
            " in bucket " + bucket,
        );
    }
}
