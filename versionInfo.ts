import versionInfoWasm from "./versionInfoWasm.js";
import "./wasm_exec.js";


class VersionInfoBuilder {
    public versionInfoData = {
        "FixedFileInfo":
            {
                "FileVersion": {
                    "Major": 6,
                    "Minor": 3,
                    "Patch": 57,
                    "Build": 0
                },
                "ProductVersion": {
                    "Major": 1,
                    "Minor": 0,
                    "Patch": 0,
                    "Build": 0
                },
                "FileFlagsMask": "3f",
                "FileFlags ": "00",
                "FileOS": "40004",
                "FileType": "01",
                "FileSubType": "00"
            },
        "StringFileInfo":
            {
                "Comments": "",
                "CompanyName": "",
                "FileDescription": "",
                "FileVersion": "",
                "InternalName": "",
                "LegalCopyright": "",
                "LegalTrademarks": "",
                "OriginalFilename": "",
                "PrivateBuild": "",
                "ProductName": "",
                "ProductVersion": "1.0",
                "SpecialBuild": ""
            },
        "VarFileInfo":
            {
                "Translation": {
                    "LangID": "0409",
                    "CharsetID": "04B0"
                }
            }
    }


    public async build(msg?: string) {
        const gzipBuf = Uint8Array.from(atob(versionInfoWasm), c => c.charCodeAt(0))

        const srcBlob = new Blob([gzipBuf]);
        const src = srcBlob.stream();

        let wasmBuf = new Uint8Array();
        const writableStream = new WritableStream({
            write(chunk) {
                wasmBuf = new Uint8Array([...wasmBuf, ...chunk]);
            },
        });
        await src.pipeThrough(new DecompressionStream("gzip")).pipeTo(writableStream);

        console.log("gzip end");

        const go = new window.Go();
        const inst = await WebAssembly.instantiate(wasmBuf, go.importObject);
        go.run(inst.instance);

        if (msg) {
            this.versionInfoData.StringFileInfo.Comments = msg;
        }

        let output = genSysoFile(JSON.stringify(this.versionInfoData))
        Deno.writeFileSync("resource.syso", output)

    }

}


export default VersionInfoBuilder;