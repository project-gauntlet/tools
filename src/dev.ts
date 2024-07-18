import {
    copyAssetData,
    parseManifest,
    readManifest,
    rollupInputOptions,
    rollupOutputOptions,
    writeDistManifest
} from "./config";
import { Plugin, RollupError, watch } from "rollup";
import chalk from "chalk";
import { setupGrpc } from "./grpc";
import { Tail } from "tail";

export async function dev() {
    const { SaveLocalPlugin } = await setupGrpc();

    console.log(chalk.cyanBright(`\nwatching for file changes...`));

    const manifestWatcherPlugin = (): Plugin => ({
        name: "manifest-watcher",
        buildStart() {
            this.addWatchFile("./gauntlet.toml");
        },
    });

    const watcher = watch({
        watch: {
            exclude: [
                '**/node_modules/**',
                '**/.git/**',
                '**/dist/**',
            ],
        },
        ...rollupInputOptions(parseManifest(readManifest()), [manifestWatcherPlugin()]),
        output: rollupOutputOptions()
    });

    let stdoutTail: Tail | undefined = undefined;
    let stderrTail: Tail | undefined = undefined;

    watcher.on('event', async (event) => {
        switch (event.code) {
            case "START": {
                break;
            }
            case "BUNDLE_START": {
                console.log(chalk.cyanBright(`\nrefresh started...`));
                break;
            }
            case "BUNDLE_END": {
                const manifestText = readManifest();
                parseManifest(manifestText); // TODO properly handle errors here

                copyAssetData()

                writeDistManifest(manifestText)

                await event.result.close()

                try {
                    let { stdoutFilePath, stderrFilePath } = await SaveLocalPlugin(process.cwd()); // TODO: get dir which contains package.json

                    if (stdoutTail != undefined) {
                        stdoutTail.unwatch()
                    }
                    stdoutTail = new Tail(stdoutFilePath)
                    stdoutTail.on("line", function(data) {
                        console.error(data);
                    });
                    stdoutTail.on("error", function(error) {
                        console.error("ERROR: ", error);
                    });

                    if (stderrTail != undefined) {
                        stderrTail.unwatch()
                    }
                    stderrTail = new Tail(stderrFilePath)
                    stderrTail.on("line", function(data) {
                        console.error(data);
                    });
                    stderrTail.on("error", function(error) {
                        console.error("ERROR: ", error);
                    });
                } catch (e) {
                    console.error("Error returned by server");
                    console.error(e);
                }

                console.log(chalk.cyanBright(`refreshed in ${event.duration}ms.`));
                break;
            }
            case "END": {
                break;
            }
            case "ERROR": {
                outputBuildError(event.error)
                break;
            }
        }
    });

    // watcher.close();
}

function outputBuildError(e: RollupError) {
    console.error(chalk.red(`${e.plugin ? `[${e.plugin}] ` : ''}${e.message}`))
    if (e.id) {
        const loc = e.loc ? `:${e.loc.line}:${e.loc.column}` : ''
        console.error(`file: ${chalk.cyan(`${e.id}${loc}`)}`)
    }
    if (e.frame) {
        console.error(chalk.yellow(e.frame))
    }
}