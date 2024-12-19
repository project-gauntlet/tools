import { load } from "@grpc/proto-loader"
import { credentials, loadPackageDefinition } from "@grpc/grpc-js"
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function setupGrpc() {
    const packageDefinition = await load(`${__dirname}/../schema/backend.proto`);
    const backend = loadPackageDefinition(packageDefinition) as any;

    const client = new backend.RpcBackend("localhost:42320", credentials.createInsecure());

    return {
        async SaveLocalPlugin(path: string): Promise<{ stdoutFilePath: string, stderrFilePath: string }> {
            return new Promise((resolve, reject) => {
                client.SaveLocalPlugin({ path }, (err: any, response: any) => {
                    if (err) reject(err);
                    else (resolve(response));
                });
            });
        }
    }
}