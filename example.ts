import VersionBuilder from "./builder.ts";


const builder = new VersionBuilder()

builder.appName ="example-app"
await builder.build();