import VersionInfoBuilder from "./versionInfo.ts";

class VersionBuilder {
    public appName = "simple"
    public appVersion = "5.3.29"


    public async build() {
        const gitHash = await cmd("git", ["rev-parse", "HEAD"]);
        const gitBranch = safeString(await cmd("git", ["rev-parse", "--abbrev-ref", "HEAD"]));
        const gitMessage = safeString(await cmd("git", ["show", "-s", "--format=format:%s", "HEAD"]));
        const author = safeString(await cmd("git", ["show", "-s", "--format=format:%aN", "HEAD"]));
        const dirty = await cmd("git", ["diff", "HEAD"]) !== "";


        const buildTime = new Date().getTime();

        const descriptionData = `{"gitHash":"${gitHash}","gitBranch":"${gitBranch}","gitMessage":"${gitMessage}","author":"${author}","dirty":"${dirty}","buildTime":"${buildTime}"}`
        // generate version resource file
        const versionInfoBuilder = new VersionInfoBuilder();
        await versionInfoBuilder.build(descriptionData);
        console.log("gen resource.syso end")

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
            "-o", `${this.appName}.exe`,
        ])
        if (goOutput) {
            console.log(goOutput);
        }

        // del version resource file
        await Deno.remove("resource.syso");
    }
}

// help function

async function cmd(cmd: string, args: string[]): Promise<string | undefined> {
    const decoder = new TextDecoder();
    try {
        const command = new Deno.Command(cmd, {
            env: {
                "GOOS": "windows",
                "GOARCH": "amd64"
            },
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

export default VersionBuilder;