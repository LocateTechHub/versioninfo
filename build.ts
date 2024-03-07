const appName = "simple"
const appVersion = "5.3.29"

const gitHash = await cmd("git", ["rev-parse", "HEAD"]);
const gitBranch = await cmd("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
const gitMessage = await cmd("git", ["show", "-s", "--format=format:%s", "HEAD"]);
const author = await cmd("git", ["show", "-s", "--format=format:%aN", "HEAD"]);
const dirty = await cmd("git", ["diff", "HEAD"]) !== "";


const buildTime = new Date().getTime();

// generate version resource file


// go build
await cmd("go", ["build",
    "-ldflags=-s -w "
    + ` -X 'main.Version=${appVersion}'`
    + ` -X 'main.GitHash=${gitHash}'`
    + ` -X 'main.GitBranch=${gitBranch}'`
    + ` -X 'main.GitMessage=${gitMessage}'`
    + ` -X 'main.Author=${author}'`
    + ` -X 'main.DirtyBuild=${dirty}'`
    + ` -X 'main.BuildTime=${buildTime}'`
    ,
    "-installsuffix", "cgo",
    "-o", `${appName}.exe`,
    "main.go"]);


// help function

async function cmd(cmd: string, args: string[]): Promise<string | undefined> {
    const decoder = new TextDecoder();
    try {
        const command = new Deno.Command(cmd, {
            args: args,
        });
        const {stdout} = await command.output();
        return decoder.decode(stdout).trimEnd();
    } catch {
        return undefined;
    }
}