import {VersionInfo, VersionInfoBuilder} from "./versionInfo.ts";
import {gzipFile} from "https://deno.land/x/compress@v0.4.6/gzip/mod.ts";
import {parseArgs} from "jsr:@std/cli/parse-args";
import {green, red} from "jsr:@std/fmt/colors";
import "jsr:@std/dotenv/load";
import { Logger } from "jsr:@deno-library/logger";
import MinioClient from "./minio.ts";
import {homedir} from "node:os";

const logger = new Logger();


class VersionBuilder {
    public appName = "simple";
    public dockerName = "simple";
    public appVersion = "1.0";
    public defaultTarget = "win";
    public appDebugVersion = false;
    public publish = false;
    public release = false;

    public publishBasePath = "temp/";
    public releaseBucket = "artifact";
    public target = {};
    private descriptionData: VersionInfo;

    mergeParam() {
        const args = parseArgs(Deno.args, {
            boolean: ["publish", "release", "debug"],
            alias: {publish: "p", version: "v", release: "r", debug: "d"},
            string: ["v"],
        });

        if (args._[0]) {
            this.defaultTarget = args._[0];
        }
        if (args.publish) {
            this.publish = args.publish;
        }
        if (args.version) {
            this.appVersion = args.version;
        }
        if (args.debug) {
            this.defaultTarget = "docker";
            this.appDebugVersion = args.debug;
        }
        if (args.release) {
            this.appDebugVersion = false;
            this.publish = true;
            this.release = args.release;
        }
    }

    public async build() {
        this.mergeParam();

        logger.info(green("读取项目信息..."));

        const gitHash = await cmdWithOutput("git", ["rev-parse", "HEAD"]);
        const gitBranch = safeString(
            await cmdWithOutput("git", ["rev-parse", "--abbrev-ref", "HEAD"]),
        );
        const gitMessage = safeString(
            await cmdWithOutput("git", ["show", "-s", "--format=format:%s", "HEAD"]),
        );
        const author = safeString(
            await cmdWithOutput("git", ["show", "-s", "--format=format:%aN", "HEAD"]),
        );
        const dirty = await cmdWithOutput("git", ["diff", "HEAD"]) !== "";

        const buildTime = new Date().getTime();

        this.descriptionData = {
            gitHash: gitHash,
            gitBranch: gitBranch,
            gitMessage: gitMessage,
            author: author,
            dirty: dirty,
            buildTime: buildTime,
        };

        const descriptionData = JSON.stringify(this.descriptionData);

        // generate version resource file
        logger.info(green("生成信息文件..."));
        const versionInfoBuilder = new VersionInfoBuilder();
        await versionInfoBuilder.build(descriptionData);

        if (this.release) {
            await this._release();
        } else {
            // go build
            await this._build(this.defaultTarget);
        }

        // del version resource file
        await Deno.remove("resource.syso");
    }

    public async _release() {
        for (const [target, publishPaths] of Object.entries(this.target.releasePath)) {
            let goPath = this.target?.goPath?.[target] ?? targetInfoMap[target]?.goPath;
            let outputFile = await this.doBuild(target, goPath);

            for (let publishPath of publishPaths) {
                publishPath = publishPath ?? this.publishBasePath;
                const ossFilePath = `${publishPath}${outputFile}`;
                let remoteUrl = await this.pushToOss(outputFile, ossFilePath, this.releaseBucket);
                logger.info(`${target} release to ${remoteUrl}`);
            }
        }
    }

    public async _build(target: string, goPath?: string, publishPath?: string, bucket?: string) {
        let outputFile = await this.doBuild(target, goPath);
        if (this.publish) {
            publishPath = publishPath ?? this.publishBasePath;
            const ossFilePath = `${publishPath}${outputFile}`;
            let remoteUrl = await this.pushToOss(outputFile, ossFilePath, bucket);
            logger.info("bin:");
            logger.info(remoteUrl);
            if (this.targetDocker(target)) {
                logger.info("Docker image import command is:");
                logger.info(`curl ${remoteUrl} | docker load`);
            }
        }
    }

    public async doBuild(target: string, goPath?: string) {
        let outputFile = this.binaryName(target);

        logger.info(green("构建项目..."));

        if (!this.appDebugVersion) {
            await this.goBuild(target, goPath);
        }

        if (this.targetDocker(target)) {
            logger.info(green("构建docker镜像..."));
            outputFile = await this.dockerBuild();
            logger.info(green("docker镜像构建完成"));
        }
        return outputFile;
    }

    public async goBuild(target: string, goPath?: string) {
        goPath = goPath ?? "go";
        await cmd(goPath, [
            "build",
            "-ldflags=-s -w " +
            ` -X 'github.com/LocateTechHub/versioninfo.Version=${this.appVersion}'` +
            ` -X 'github.com/LocateTechHub/versioninfo.GitHash=${this.descriptionData.gitHash}'` +
            ` -X 'github.com/LocateTechHub/versioninfo.GitBranch=${this.descriptionData.gitBranch}'` +
            ` -X 'github.com/LocateTechHub/versioninfo.GitMessage=${this.descriptionData.gitMessage}'` +
            ` -X 'github.com/LocateTechHub/versioninfo.Author=${this.descriptionData.author}'` +
            ` -X 'github.com/LocateTechHub/versioninfo.DirtyBuild=${this.descriptionData.dirty}'` +
            ` -X 'github.com/LocateTechHub/versioninfo.BuildTime=${this.descriptionData.buildTime}'`,
            "-installsuffix",
            "cgo",
            "-trimpath",
            "-o",
            `${this.binaryName(target)}`,
        ], targetInfoMap[target].env);
        logger.info(green("构建完成"));
    }

    public async pushToOss(filePath: string, ossPath: string, bucket?: string): string {
        logger.info(green("推送OSS..."));
        bucket = bucket ?? "aries";

        const minioClient = new MinioClient({
            endPoint: Deno.env.get("BUILDER_OSS_END_POINT"),
            accessKey: Deno.env.get("BUILDER_OSS_ACCESS_KEY"),
            secretKey: Deno.env.get("BUILDER_OSS_SECRET_KEY"),
            bucket: bucket,
        });
        await minioClient.uploadFile({
            sourceFilePath: filePath,
            ossFilePath: ossPath,
            descriptionData: this.descriptionData,
        });

        return `http://oss.airocov.com/${bucket}/${ossPath}`;
    }

    public async dockerBuild(): string {
        const imageTag = `${this.dockerName}:${this.appVersion}`;
        const tarFileName = `${this.dockerName}-${this.appVersion}.tar`;
        const gzFileName = `${tarFileName}.gz`;

        // build docker
        if (!this.appDebugVersion) {
            await cmd("docker", ["build", "-t", imageTag, "."]);
        } else {
            await cmd("docker", ["build", "-f", "Dockerfile-debug", "-t", imageTag, "."]);
        }

        await cmd("docker", ["save", imageTag, "-o", tarFileName]);

        await gzipFile(tarFileName, `${gzFileName}`);

        await Deno.remove(tarFileName);

        return gzFileName;
    }

    public binaryName(target: string): string {
        return `${this.appName}${targetInfoMap[target].outputSuffix}`;
    }

    public targetDocker(target: string): boolean {
        return target === "docker";
    }
}

// help function

async function cmdWithOutput(
    cmd: string,
    args: string[],
    env?: Record<string, string>,
): Promise<string | undefined> {
    const decoder = new TextDecoder();
    try {
        const command = new Deno.Command(cmd, {
            env: env,
            args: args,
        });
        const {stdout, stderr} = await command.output();
        const out = decoder.decode(stdout).trimEnd();
        const err = decoder.decode(stderr).trimEnd();
        if (err != "") {
            console.error("cmd: ", cmd);
            console.error(err);
            console.error();
        }
        return out;
    } catch (e) {
        console.error(`cmd [${cmd}] run error : `, e.toString());
        return undefined;
    }
}

async function cmd(
    cmd: string,
    args: string[],
    env?: Record<string, string>,
): Promise<undefined> {
    const command = new Deno.Command(cmd, {
        env: env,
        args: args,
        stderr: "piped",
        stdout: "piped",
    });
    const process = command.spawn();

    process.stdout.pipeTo(Deno.stdout.writable, {preventClose: true});
    process.stderr.pipeTo(Deno.stderr.writable, {preventClose: true});

    if (!(await process.status).success) {
        throw new Error(red(`${cmd} not successfully.`));
    }
}

function safeString(str: string | undefined): string {
    if (str) {
        return str.replaceAll("'", '"');
    }
    return "undefined";
}

interface TargetInfo {
    goPath?: string,
    outputSuffix: string;
    env: Record<string, string>;
}

const targetInfoMap: Record<string, TargetInfo> = {
    "win": {
        outputSuffix: ".exe",
        env: {
            "GOOS": "windows",
            "GOARCH": "amd64",
        },
    },
    "win7": {
        goPath: homedir() + "/sdk/go1.21.0/bin/go.exe",
        outputSuffix: ".exe",
        env: {
            "GOROOT": homedir() + "/sdk/go1.21.0",
            "GOOS": "windows",
            "GOARCH": "amd64",
        },
    },
    "linux": {
        outputSuffix: "",
        env: {
            "GOOS": "linux",
            "GOARCH": "amd64",
        },
    },
    "docker": {
        outputSuffix: "",
        env: {
            "GOOS": "linux",
            "GOARCH": "amd64",
        },
    },
};

export default VersionBuilder;
