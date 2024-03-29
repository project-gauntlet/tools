import { z } from "zod";
import { parse as parseToml } from "toml";
import { InputOptions, OutputOptions } from "rollup";
import nodeResolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "@rollup/plugin-typescript";
import { cpSync, readFileSync, writeFileSync } from "node:fs";

const preferences = z.discriminatedUnion("type", [
    z.strictObject({
        type: z.literal("number"),
        name: z.string(),
        default: z.optional(z.number()),
        description: z.string(),
    }),
    z.strictObject({
        type: z.literal("string"),
        name: z.string(),
        default: z.optional(z.string()),
        description: z.string(),
    }),
    z.strictObject({
        type: z.literal("enum"),
        name: z.string(),
        default: z.optional(z.string()),
        description: z.string(),
        enum_values: z.array(z.strictObject({
            label: z.string(),
            value: z.string()
        })),
    }),
    z.strictObject({
        type: z.literal("bool"),
        name: z.string(),
        default: z.optional(z.boolean()),
        description: z.string(),
    }),
    z.strictObject({
        type: z.literal("list_of_strings"),
        name: z.string(),
        // default: z.optional(z.array(z.string())),
        description: z.string(),
    }),
    z.strictObject({
        type: z.literal("list_of_numbers"),
        name: z.string(),
        // default: z.optional(z.array(z.number())),
        description: z.string(),
    }),
    z.strictObject({
        type: z.literal("list_of_enums"),
        name: z.string(),
        // default: z.optional(z.array(z.string())),
        description: z.string(),
        enum_values: z.array(z.strictObject({
            label: z.string(),
            value: z.string()
        })),
    })
]);

const Manifest = z.strictObject({
    gauntlet: z.strictObject({
        name: z.string(),
        description: z.string()
    }),
    preferences: z.optional(z.array(preferences)),
    entrypoint: z.array(z.strictObject({
        id: z.string(),
        name: z.string(),
        description: z.string(),
        path: z.string(),
        type: z.enum(["command", "view", "inline-view", "command-generator"]),
        preferences: z.optional(z.array(preferences)),
        actions: z.optional(z.array(z.strictObject({
                id: z.string(),
                description: z.string(),
                shortcut: z.strictObject({
                    key: z.enum([ // only stuff that is present on 60% keyboard
                        "1",
                        "2",
                        "3",
                        "4",
                        "5",
                        "6",
                        "7",
                        "8",
                        "9",
                        "0",
                        "-",
                        "=",

                        "!",
                        "@",
                        "#",
                        "$",
                        "%",
                        "^",
                        "&",
                        "*",
                        "(",
                        ")",
                        "_",
                        "+",

                        "a",
                        "b",
                        "c",
                        "d",
                        "e",
                        "f",
                        "g",
                        "h",
                        "i",
                        "j",
                        "k",
                        "l",
                        "m",
                        "n",
                        "o",
                        "p",
                        "q",
                        "r",
                        "s",
                        "t",
                        "u",
                        "v",
                        "w",
                        "x",
                        "y",
                        "z",

                        "A",
                        "B",
                        "C",
                        "D",
                        "E",
                        "F",
                        "G",
                        "H",
                        "I",
                        "J",
                        "K",
                        "L",
                        "M",
                        "N",
                        "O",
                        "P",
                        "Q",
                        "R",
                        "S",
                        "T",
                        "U",
                        "V",
                        "W",
                        "X",
                        "Y",
                        "Z",

                        ",",
                        ".",
                        "/",
                        "[",
                        "]",
                        ";",
                        "'",
                        "\\",

                        "<",
                        ">",
                        "?",
                        "{",
                        "}",
                        ":",
                        "\"",
                        "|"
                    ]),
                    kind: z.enum(["main", "alternative"]),
                })
            }))
        )
    })).refine(
        entrypoints => entrypoints.filter(value => value.type === "inline-view").length <= 1,
        { message: "Only single 'inline-view' entrypoint is allowed" }
    ),
    permissions: z.strictObject({
        environment: z.array(z.string()).default([]),
        high_resolution_time: z.boolean().default(false),
        network: z.array(z.string()).default([]),
        ffi: z.array(z.string()).default([]),
        fs_read_access: z.array(z.string()).default([]),
        fs_write_access: z.array(z.string()).default([]),
        run_subprocess: z.array(z.string()).default([]),
        system: z.array(z.string()).default([]),
    }).default({}),
    supported_system: z.array(z.discriminatedUnion("os", [
        z.strictObject({ os: z.literal("linux") })
    ])).default([]),
});

type Manifest = z.infer<typeof Manifest>;

export function readManifest(): string {
    return readFileSync("./gauntlet.toml", "utf8")
}

export function writeDistManifest(manifestText: string) {
    writeFileSync("dist/gauntlet.toml", manifestText)
}

export function copyAssetData() {
    try {
        cpSync("assets", "dist/assets", { recursive: true });
    } catch (err) {
        if ((err as any).code === 'ENOENT') {
            return;
        } else {
            throw err
        }
    }
}

export function parseManifest(manifestText: string) {
    const manifest = Manifest.parse(parseToml(manifestText));

    const permEnvExist = manifest.permissions.environment.length !== 0;
    const permFfiExist = manifest.permissions.ffi.length !== 0;
    const permFsReadExist = manifest.permissions.fs_read_access.length !== 0;
    const permFsWriteExist = manifest.permissions.fs_write_access.length !== 0;
    const permRunExist = manifest.permissions.run_subprocess.length !== 0;
    const permSystemExist = manifest.permissions.system.length !== 0;

    if (permEnvExist || permFfiExist || permFsReadExist || permFsWriteExist || permRunExist || permSystemExist) {
        if (manifest.supported_system.length === 0) {
            throw new Error('Permissions "environment", "ffi", "fs_read_access", "fs_write_access", "run_subprocess", "system" require you to specify "supported_system"')
        }
    }

    return manifest
}


export function rollupInputOptions(manifest: Manifest): InputOptions {
    const mapInputs = manifest.entrypoint.map(entrypoint => [entrypoint.id, entrypoint.path] as const);
    const entries = new Map(mapInputs);
    const inputs = Object.fromEntries(entries);

    return {
        input: inputs,
        external: ["react", "react/jsx-runtime", /^@project-gauntlet\/api/],
        plugins: [
            nodeResolve(),
            commonjs(),
            typescript({
                tsconfig: './tsconfig.json',
            }),
        ],
    }
}

export function rollupOutputOptions(): OutputOptions {
    return {
        dir: 'dist/js',
        format: 'esm',
        sourcemap: 'inline',
        manualChunks: (id, _meta) => {
            if (id.includes('node_modules') || id === '\x00commonjsHelpers.js') {
                return 'vendor';
            } else {
                return 'shared';
            }
        },
        chunkFileNames: '[name].js'
    }
}
