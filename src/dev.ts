import {
    copyAssetData, Manifest,
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
import { version } from "../package.json";
import { fromError } from "zod-validation-error";

export async function dev() {
    const { SaveLocalPlugin } = await setupGrpc();

    let pluginId = process.cwd();// TODO: get dir which contains package.json

    console.log(chalk.bgYellowBright.black(`Gauntlet Dev Server `) + chalk.bgYellowBright.whiteBright(`v${version}`));
    console.log(chalk.whiteBright(`Plugin ID: file://${pluginId}`));

    const manifestWatcherPlugin = (): Plugin => ({
        name: "manifest-watcher",
        buildStart() {
            this.addWatchFile("./gauntlet.toml");
        },
    });

    let manifestText = readManifest();

    let manifest: Manifest

    try {
        manifest = parseManifest(manifestText);
    } catch (err) {
        zodParseError(err)
        process.exit(1)
    }

    const watcher = watch({
        watch: {
            exclude: [
                '**/node_modules/**',
                '**/.git/**',
                '**/dist/**',
            ],
        },
        ...rollupInputOptions(manifest, [manifestWatcherPlugin()]),
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
                console.log(currentTime() + ' ' + chalk.yellowBright(`Change detected. Reloading...`));
                break;
            }
            case "BUNDLE_END": {
                const manifestText = readManifest();

                try {
                    parseManifest(manifestText);
                } catch (err) {
                    zodParseErrorWithTime(err)
                    break;
                }

                copyAssetData()

                writeDistManifest(manifestText)

                await event.result.close()

                try {
                    let { stdoutFilePath, stderrFilePath } = await SaveLocalPlugin(pluginId)

                    if (stdoutTail != undefined) {
                        stdoutTail.unwatch()
                    }
                    stdoutTail = new Tail(stdoutFilePath)
                    stdoutTail.on("line", function(line) {
                        console.log(currentTimePlugin() + ' ' + chalk.whiteBright(line));
                    });
                    stdoutTail.on("error", function(error) {
                        console.error(currentTime() + ' ' + chalk.red("ERROR READING STDOUT LOGS: " + error));
                    });

                    if (stderrTail != undefined) {
                        stderrTail.unwatch()
                    }
                    stderrTail = new Tail(stderrFilePath)
                    stderrTail.on("line", function(line) {
                        console.error(currentTimePlugin() + ' ' + chalk.redBright(line));
                    });
                    stderrTail.on("error", function(error) {
                        console.error(currentTime() + ' ' + chalk.red("ERROR READING STDERR LOGS: " + error));
                    });
                } catch (e) {
                    if (stdoutTail != undefined) {
                        stdoutTail.unwatch()
                    }
                    if (stderrTail != undefined) {
                        stderrTail.unwatch()
                    }
                    throw e;
                }

                console.log(currentTime() + ' ' + chalk.green(`Reloaded in ${event.duration}ms`));
                break;
            }
            case "END": {
                break;
            }
            case "ERROR": {
                outputBuildError(event.error, "Error reloading")
                break;
            }
        }
    });
}

export function currentTime(): string {
    return chalk.blackBright('[' + new Date().toLocaleTimeString() + ']')
}

function currentTimePlugin(): string {
    return chalk.whiteBright('[' + new Date().toLocaleTimeString() + ']')
}

export function zodParseError(err: unknown) {
    const validationError = fromError(err);

    console.log(chalk.red("Manifest " + validationError.toString()));
}

export function zodParseErrorWithTime(err: unknown) {
    const validationError = fromError(err);

    console.log(currentTime() + ' ' + chalk.red("Manifest " + validationError.toString()));
}

export function outputBuildError(error: RollupError, errMessage: string) {
    const { message, id, loc, frame } = error;

    console.error(currentTime() + ' ' + chalk.red(errMessage))
    console.error(chalk.red(message))
    if (id) {
        const locMsg = loc ? `:${loc.line}:${loc.column}` : ''
        console.error(`file: ${chalk.cyan(`${id}${locMsg}`)}`)
    }
    if (frame) {
        console.error(chalk.yellow(frame))
    }
}