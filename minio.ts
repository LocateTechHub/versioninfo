import {Client} from 'npm:minio'


export default class MinioClient {
    public minioClient: Client;
    public defaultBucket: string;

    constructor({endPoint, accessKey, secretKey, bucket}: {
        endPoint: string,
        accessKey: string,
        secretKey: string,
        bucket: string
    }) {
        const params = {
            endPoint: endPoint,
            useSSL: true,
            accessKey: accessKey,
            secretKey: secretKey,
        }
        this.defaultBucket = bucket
        this.minioClient = new Client(params)
    }

    async uploadFile({sourceFilePath, ossFilePath, bucket}: {
        sourceFilePath: string,
        ossFilePath: string,
        bucket?: string
    }) {
        await Deno.lstat(sourceFilePath);

        if (!bucket) {
            bucket = this.defaultBucket;
        }

        const exists = await this.minioClient.bucketExists(bucket)
        if (!exists) {
            throw new Error('bucket not exists');
        }

        await this.minioClient.fPutObject(bucket, ossFilePath, sourceFilePath)
        console.log('File ' + sourceFilePath + ' uploaded as object ' + ossFilePath + ' in bucket ' + bucket)

    }

}
