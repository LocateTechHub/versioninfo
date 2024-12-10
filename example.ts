import VersionBuilder from "https://raw.githubusercontent.com/LocateTechHub/versioninfo/v0.1.8/builder.ts";

const builder = new VersionBuilder();

builder.target = {
    goPath: {
        win7: "xxx",
    },
    releasePath: {
        win7: ["general/engine/v1/win7/"],
        win: ["general/engine/v1/win10/"],
        docker: ["general/engine/v1/docker/"],
    },
}


builder.appName = "example-app";
builder.dockerName = "example-app";
builder.appVersion = "2.1";
await builder.build();