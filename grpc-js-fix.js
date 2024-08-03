import { unlinkSync } from "node:fs";
import { join } from "node:path";
import { workspaceRootSync } from "workspace-root";

const workspaceRoot = workspaceRootSync();
let grpcIndexTsLocation = "node_modules/@grpc/grpc-js/build/src/index.d.ts";

console.log("Workspace Root:")
console.log(workspaceRoot)

if (workspaceRoot) {
    // tools in main repo included via submodule
    grpcIndexTsLocation = join(workspaceRoot, grpcIndexTsLocation)
}

try {
    unlinkSync(grpcIndexTsLocation)
} catch (err) {
    if (err.code !== 'ENOENT') {
        throw err;
    }
}