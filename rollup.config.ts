import typescript from "rollup-plugin-typescript2";
import json from '@rollup/plugin-json';
import { defineConfig } from "rollup";
import { cleandir } from "rollup-plugin-cleandir";

export default defineConfig({
    input: [
        'src/main.ts'
    ],
    output: [
        {
            dir: 'dist',
            format: 'esm',
            sourcemap: 'inline'
        }
    ],
    plugins: [
        cleandir(),
        typescript({
            tsconfig: './tsconfig.json',
        }),
        json()
    ]
})
