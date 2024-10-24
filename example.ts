import VersionBuilder from "https://raw.githubusercontent.com/LocateTechHub/versioninfo/v0.1.6/builder.ts"


const builder = new VersionBuilder()
builder.appName = "example-app"
builder.dockerName = "example-app"
builder.appVersion = "2.1"
await builder.build();