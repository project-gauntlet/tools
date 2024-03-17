import { rollup, RollupBuild } from "rollup";
import {
    copyAssetData,
    parseManifest,
    readManifest,
    rollupInputOptions,
    rollupOutputOptions,
    writeDistManifest
} from "./config";


export async function build(exit: boolean) {
    console.log("Building...")
    const manifestText = readManifest();

    const manifest = parseManifest(manifestText);

    let rollupBuild: RollupBuild | undefined;
    let buildFailed = false;
    try {
        rollupBuild = await rollup(rollupInputOptions(manifest));

        await rollupBuild.write(rollupOutputOptions());

        copyAssetData()

        writeDistManifest(manifestText)
    } catch (error) {
        buildFailed = true;
        console.error(error);
    }
    
    if (rollupBuild) {
        await rollupBuild.close();
    }

    if (exit) {
        process.exit(buildFailed ? 1 : 0);
    }
}

