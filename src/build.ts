import { rollup, RollupBuild, RollupError } from "rollup";
import {
    copyAssetData, Manifest,
    parseManifest,
    readManifest,
    rollupInputOptions,
    rollupOutputOptions,
    writeDistManifest
} from "./config";
import { currentTime, outputBuildError, zodParseError } from "./dev";
import chalk from "chalk";


export async function build(exit: boolean) {
    console.log(currentTime() + ' ' + chalk.yellowBright("Building..."));

    const manifestText = readManifest();

    let manifest: Manifest

    try {
        manifest = parseManifest(manifestText);
    } catch (err) {
        zodParseError(err)
        process.exit(1)
    }

    let rollupBuild: RollupBuild | undefined;
    let buildFailed = false;
    try {
        rollupBuild = await rollup(rollupInputOptions(manifest));

        await rollupBuild.write(rollupOutputOptions());
    } catch (error) {
        buildFailed = true;
        outputBuildError(error as RollupError, "Error building");
    }

    if (rollupBuild) {
        await rollupBuild.close();
    }

    try {
        copyAssetData()

        writeDistManifest(manifestText)
    } catch (error) {
        buildFailed = true;
        console.error(chalk.red(error));
    }

    if (!buildFailed) {
        console.log(currentTime() + ' ' + chalk.green("Build successful"));
    }

    if (exit) {
        process.exit(buildFailed ? 1 : 0);
    }
}

