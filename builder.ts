import VersionInfoBuilder from "./versionInfo.ts";
import {gzipFile} from "https://deno.land/x/compress@v0.4.6/gzip/mod.ts";
import {parseArgs} from "jsr:@std/cli/parse-args";
import {green} from "jsr:@std/fmt/colors";
import "jsr:@std/dotenv/load";
import MinioClient from "./minio.ts";

class VersionBuilder {
    public appName = "simple"
    public dockerName = "simple"
    public appVersion = "1.0"
    public appTarget = "win"
    public buildDocker = false
    public publish = false
    public publishBasePath = "temp"
    private outputFile;


    public async build() {
        const args = parseArgs(Deno.args, {
            boolean: ["publish"],
            alias: {publish: "p", version: "v"},
            string: ["v"],
        });

        if (args._[0]) {
            this.appTarget = args._[0];
            if (args._[0] === "docker") {
                this.appTarget = "linux";
                this.buildDocker = true;
            }
        }
        if (args.publish) {
            this.publish = args.publish;
        }
        if (args.version) {
            this.appVersion = args.version;
        }
        this.outputFile = this.binaryName();

        console.log(green("读取项目信息..."))

        const gitHash = await cmd("git", ["rev-parse", "HEAD"]);
        const gitBranch = safeString(await cmd("git", ["rev-parse", "--abbrev-ref", "HEAD"]));
        const gitMessage = safeString(await cmd("git", ["show", "-s", "--format=format:%s", "HEAD"]));
        const author = safeString(await cmd("git", ["show", "-s", "--format=format:%aN", "HEAD"]));
        const dirty = await cmd("git", ["diff", "HEAD"]) !== "";


        const buildTime = new Date().getTime();

        const descriptionDataJson = {
            gitHash: gitHash,
            gitBranch: gitBranch,
            gitMessage: gitMessage,
            author: author,
            dirty: dirty,
            buildTime: buildTime
        };
        const descriptionData = JSON.stringify(descriptionDataJson);
        // generate version resource file

        console.log(green("生成信息文件..."))
        const versionInfoBuilder = new VersionInfoBuilder();
        await versionInfoBuilder.build(descriptionData);
        console.log(green("构建项目..."))

        // go build
        const goOutput = await cmd("go", ["build",
            "-ldflags=-s -w "
            + ` -X 'github.com/LocateTechHub/versioninfo.Version=${this.appVersion}'`
            + ` -X 'github.com/LocateTechHub/versioninfo.GitHash=${gitHash}'`
            + ` -X 'github.com/LocateTechHub/versioninfo.GitBranch=${gitBranch}'`
            + ` -X 'github.com/LocateTechHub/versioninfo.GitMessage=${gitMessage}'`
            + ` -X 'github.com/LocateTechHub/versioninfo.Author=${author}'`
            + ` -X 'github.com/LocateTechHub/versioninfo.DirtyBuild=${dirty}'`
            + ` -X 'github.com/LocateTechHub/versioninfo.BuildTime=${buildTime}'`
            ,
            "-installsuffix", "cgo",
            "-trimpath",
            "-o", `${this.binaryName()}`,
        ], targetMap[this.appTarget].env);
        if (goOutput) {
            console.log(goOutput);
        }

        // del version resource file
        await Deno.remove("resource.syso");

        console.log(green("构建完成"))

        if (this.buildDocker) {
            console.log(green("构建docker镜像..."))
            await this.docker();
        }
        if (this.publish) {
            console.log(green("推送OSS..."))
            const minioClient = new MinioClient({
                endPoint: Deno.env.get("BUILDER_OSS_END_POINT"),
                accessKey: Deno.env.get("BUILDER_OSS_ACCESS_KEY"),
                secretKey: Deno.env.get("BUILDER_OSS_SECRET_KEY"),
                bucket: "aries"
            });
            const ossFilePath = `${this.publishBasePath}/${this.outputFile}`;
            await minioClient.uploadFile({
                sourceFilePath: this.outputFile,
                ossFilePath: ossFilePath,
            });
            console.log("bin:")
            console.log(`http://oss.airocov.com/aries/${ossFilePath}`);
            if (this.buildDocker) {
                console.log("docker:");
                console.log(`curl http://oss.airocov.com/aries/${ossFilePath}|docker load`);
            }
        }

    }

    public async docker() {
        const imageTag = `${this.dockerName}:${this.appVersion}`;
        const tarFileName = `${this.dockerName}-${this.appVersion}.tar`;
        const gzFileName = `${tarFileName}.gz`;
        this.outputFile = gzFileName;

        // build docker
        await cmd("docker", ["build", "-t", imageTag, "."]);

        await cmd("docker", ["save", imageTag, "-o", tarFileName]);

        await gzipFile(tarFileName, `${gzFileName}`);

        await Deno.remove(tarFileName);
        await Deno.remove(this.binaryName());
    }

    public binaryName() {
        return `${this.appName}${targetMap[this.appTarget].outputSuffix}`;
    }
}


// help function

async function cmd(cmd: string, args: string[], env?: Record<string, string>): Promise<string | undefined> {
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

function safeString(str: string | undefined): string {
    if (str) {
        return str.replaceAll("'", "\"");
    }
    return "undefined"
}

interface TargetInfo {
    outputSuffix: string
    env: Record<string, string>
}

const targetMap: Record<string, TargetInfo> = {
    "win": {
        outputSuffix: ".exe",
        env: {
            "GOOS": "windows",
            "GOARCH": "amd64"
        }
    },
    "linux": {
        outputSuffix: "",
        env: {
            "GOOS": "linux",
            "GOARCH": "amd64"
        }
    }
}

export default VersionBuilder;