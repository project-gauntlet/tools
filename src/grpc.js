import { load } from "@grpc/proto-loader"
import { credentials, loadPackageDefinition } from "@grpc/grpc-js"
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// in js file to workaround for https://github.com/grpc/grpc-node/issues/2617
// also we remove index.d.ts from node_modules/@grpc/grpc-js/build/src/index.d.ts
export async function setupGrpc() {
    const packageDefinition = await load(`${__dirname}/../schema/backend.proto`);
    const backend = loadPackageDefinition(packageDefinition);

    const client = new backend.RpcBackend("localhost:42320", credentials.createInsecure());

    return {
        async SaveLocalPlugin(path) {
            return new Promise((resolve, reject) => {
                client.SaveLocalPlugin({ path }, (err, _) => {
                    if (err) reject(err);
                    else (resolve({}));
                });
            });
        }
    }
}