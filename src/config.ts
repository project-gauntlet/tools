import { z } from "zod";
import { parse as parseToml } from "toml";
import { InputOptions, OutputOptions, Plugin } from "rollup";
import nodeResolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "rollup-plugin-typescript2";
import { readFileSync, writeFileSync } from "node:fs";
import { cleandir } from "rollup-plugin-cleandir";
import { cp } from "node:fs/promises";

// needs to be valid and properly cased js identifier
const preferenceId = z.string()
    .regex(/^[a-zA-Z0-9]+$/, "Preference id can only contain letters and numbers");

const preferences = z.discriminatedUnion("type", [
    z.strictObject({
        type: z.literal("number"),
        id: preferenceId,
        name: z.string(),
        default: z.optional(z.number()),
        description: z.string(),
    }),
    z.strictObject({
        type: z.literal("string"),
        id: preferenceId,
        name: z.string(),
        default: z.optional(z.string()),
        description: z.string(),
    }),
    z.strictObject({
        type: z.literal("enum"),
        id: preferenceId,
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
        id: preferenceId,
        name: z.string(),
        default: z.optional(z.boolean()),
        description: z.string(),
    }),
    z.strictObject({
        type: z.literal("list_of_strings"),
        id: preferenceId,
        name: z.string(),
        // default: z.optional(z.array(z.string())),
        description: z.string(),
    }),
    z.strictObject({
        type: z.literal("list_of_numbers"),
        id: preferenceId,
        name: z.string(),
        // default: z.optional(z.array(z.number())),
        description: z.string(),
    }),
    z.strictObject({
        type: z.literal("list_of_enums"),
        id: preferenceId,
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
        id: z.string().regex(/^[a-z0-9-]+$/, "Entrypoint id can only contain small letters, numbers and dash"), // needs to be valid js file
        name: z.string(),
        description: z.string(),
        path: z.string(),
        icon: z.optional(z.string()),
        type: z.enum(["command", "view", "inline-view", "entrypoint-generator"]),
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
        environment: z.array(
            z.string().min(1)
        ).default([]),
        network: z.array(
            z.string().min(1)
        ).default([]),
        filesystem: z.strictObject({
            read: z.array(
                z.string().min(1)
            ).default([]),
            write: z.array(
                z.string().min(1)
            ).default([]),
        }).default({}),
        exec: z.strictObject({
            command: z.array(
                z.string().min(1)
            ).default([]),
            executable: z.array(
                z.string().min(1)
            ).default([]),
        }).default({}),
        system: z.array(
            z.string().min(1)
        ).default([]),
        clipboard: z.array(z.enum(["read", "write", "clear"])).default([]),
        main_search_bar: z.array(z.enum(["read"])).default([]),
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

export async function copyAssetData() {
    try {
        await cp("assets", "dist/assets", { recursive: true });
    } catch (err) {
        if ((err as any).code === 'ENOENT') {
            return;
        } else {
            throw err
        }
    }
}

export function parseManifest(manifestText: string): Manifest {
    return Manifest.parse(parseToml(manifestText))
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
            cleandir('dist'),
            nodeResolve(),
            commonjs({
                strictRequires: "auto"
            }),
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
