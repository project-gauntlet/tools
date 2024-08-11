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

    let manifestText: string;

    try {
        manifestText = readManifest()
    } catch (err) {
        if ((err as any).code == 'ENOENT') {
            manifestNotFoundErrorWithTime()
            process.exit(1)
        } else {
            throw err
        }
    }

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
                await event.result.close()

                let manifestText;

                try {
                    manifestText = readManifest()
                } catch (err: unknown) {
                    if ((err as any).code == 'ENOENT') {
                        manifestNotFoundErrorWithTime()
                        break;
                    } else {
                        throw err
                    }
                }

                try {
                    parseManifest(manifestText);
                } catch (err) {
                    zodParseErrorWithTime(err)
                    break;
                }

                await copyAssetData()

                writeDistManifest(manifestText)

                let serverResponse;
                try {
                    serverResponse = await SaveLocalPlugin(pluginId)
                } catch (err: unknown) {
                    grpcErrorWithTime(err);

                    if (stdoutTail != undefined) {
                        stdoutTail.unwatch()
                    }
                    if (stderrTail != undefined) {
                        stderrTail.unwatch()
                    }
                    break;
                }

                let { stdoutFilePath, stderrFilePath } = serverResponse;

                if (stdoutTail != undefined) {
                    stdoutTail.unwatch()
                }
                stdoutTail = new Tail(stdoutFilePath)
                stdoutTail.on("line", function (line) {
                    console.log(currentTimePlugin() + ' ' + chalk.whiteBright(line));
                });
                stdoutTail.on("error", function (error) {
                    console.error(currentTime() + ' ' + chalk.red("ERROR READING STDOUT LOGS: " + error));
                });

                if (stderrTail != undefined) {
                    stderrTail.unwatch()
                }
                stderrTail = new Tail(stderrFilePath)
                stderrTail.on("line", function (line) {
                    console.error(currentTimePlugin() + ' ' + chalk.redBright(line));
                });
                stderrTail.on("error", function (error) {
                    console.error(currentTime() + ' ' + chalk.red("ERROR READING STDERR LOGS: " + error));
                });

                console.log(currentTime() + ' ' + chalk.green(`Reloaded in ${event.duration}ms`));
                break;
            }
            case "END": {
                break;
            }
            case "ERROR": {
                // unknown error also go here, so we do our best to catch them before in "BUNDLE_END" section
                rollupBuildError(event.error, "Error reloading")
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

export function manifestNotFoundErrorWithTime() {
    console.log(currentTime() + ' ' + chalk.red("Plugin manifest (gauntlet.toml) not found"));
}

export function grpcErrorWithTime(err: unknown) {
    let error = err as any; // should be ServiceError but grpc types are broken
    console.log(currentTime() + ' ' + chalk.red("Error reloading"));
    console.log(currentTime() + ' ' + chalk.red(error.details));
}

export function rollupBuildError(error: RollupError, errMessage: string) {
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