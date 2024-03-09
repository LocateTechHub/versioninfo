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

        // go build
        await cmd("go", ["build",
            "-ldflags=-s -w "
            + ` -X 'main.Version=${this.appVersion}'`
            + ` -X 'main.GitHash=${gitHash}'`
            + ` -X 'main.GitBranch=${gitBranch}'`
            + ` -X 'main.GitMessage=${gitMessage}'`
            + ` -X 'main.Author=${author}'`
            + ` -X 'main.DirtyBuild=${dirty}'`
            + ` -X 'main.BuildTime=${buildTime}'`
            ,
            "-installsuffix", "cgo",
            "-trimpath",
            "-o", `${this.appName}.exe`,
        ]);

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
        const {stdout} = await command.output();
        return decoder.decode(stdout).trimEnd();
    } catch {
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