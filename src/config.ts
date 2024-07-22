import { z } from "zod";
import { parse as parseToml } from "toml";
import { InputOptions, OutputOptions, Plugin } from "rollup";
import nodeResolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "rollup-plugin-typescript2";
import { cpSync, readFileSync, writeFileSync } from "node:fs";
import { cleandir } from "rollup-plugin-cleandir";

// needs to be valid and properly cased js identifier
const preferenceName = z.string()
    .regex(/^[a-zA-Z0-9]+$/, "Preference name can only contain letters and numbers");

const preferences = z.discriminatedUnion("type", [
    z.strictObject({
        type: z.literal("number"),
        name: preferenceName,
        default: z.optional(z.number()),
        description: z.string(),
    }),
    z.strictObject({
        type: z.literal("string"),
        name: preferenceName,
        default: z.optional(z.string()),
        description: z.string(),
    }),
    z.strictObject({
        type: z.literal("enum"),
        name: preferenceName,
        default: z.optional(z.string()),
        description: z.string(),
        enum_values: z.array(z.strictObject({
            label: z.string(),
            value: z.string()
        })),
    }),
    z.strictObject({
        type: z.literal("bool"),
        name: preferenceName,
        default: z.optional(z.boolean()),
        description: z.string(),
    }),
    z.strictObject({
        type: z.literal("list_of_strings"),
        name: preferenceName,
        // default: z.optional(z.array(z.string())),
        description: z.string(),
    }),
    z.strictObject({
        type: z.literal("list_of_numbers"),
        name: preferenceName,
        // default: z.optional(z.array(z.number())),
        description: z.string(),
    }),
    z.strictObject({
        type: z.literal("list_of_enums"),
        name: preferenceName,
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
        id: z.string().regex(/^[a-z0-9-]+$/, "Entrypoint id can only contain small letters, numbers and dash"), // needs to be valid js file
        name: z.string(),
        description: z.string(),
        path: z.string(),
        type: z.enum(["command", "view", "inline-view", "command-generator"]),
        preferences: z.optional(z.array(preferences)),
        actions: z.optional(z.array(z.strictObject({
            id: z.string().regex(/^[a-zA-Z0-9]+$/, "Action id can only contain letters and numbers"), // needs to be valid and properly cased js identifier
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
        }))).superRefine((value: { id: string, shortcut: { key: string, kind: string } }[] | undefined, ctx) => {
            if (value) {
                const uniqueElements = new Set();
                const duplicates: { id: string }[] = [];

                for (const item of value) {
                    let key = `${item.shortcut.key}-${item.shortcut.kind}`;
                    if (uniqueElements.has(key)) {
                        duplicates.push(item);
                    } else {
                        uniqueElements.add(key);
                    }
                }

                for (const duplicate of duplicates) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: `Duplicated key and kind combination found in shortcut: ${duplicate.id}`,
                    });
                }
            }
        })
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
    supported_system: z.array(
        z.discriminatedUnion("os", [
            z.strictObject({ os: z.literal("linux") }),
            z.strictObject({ os: z.literal("windows") }),
            z.strictObject({ os: z.literal("macos") })
        ])
    ).default([]),
});

export type Manifest = z.infer<typeof Manifest>;

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

export function parseManifest(manifestText: string): Manifest {
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


export function rollupInputOptions(manifest: Manifest, additionalPlugins: Plugin[] = []): InputOptions {
    const mapInputs = manifest.entrypoint.map(entrypoint => [entrypoint.id, entrypoint.path] as const);
    const entries = new Map(mapInputs);
    const inputs = Object.fromEntries(entries);

    return {
        input: inputs,
        external: ["react", "react/jsx-runtime", /^@project-gauntlet\/api/],
        plugins: [
            ...additionalPlugins,
            cleandir(),
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
