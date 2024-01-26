import { GitError, simpleGit } from 'simple-git';
import { cp, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { build } from "./build";

export async function publish() {
    await build()

    const projectDir = process.cwd();
    const projectGit = simpleGit(projectDir);

    // get remote of current repo
    const originRemote = await projectGit.getConfig('remote.origin.url');
    const originUrl = originRemote.value;

    if (!originUrl) {
        throw new Error('unable to get url of "origin" remote')
    }

    const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'gauntlet-publish-'));

    try {
        // clone git repo into /tmp
        await simpleGit().clone(originUrl, tmpDir);
        const cloneGit = simpleGit(tmpDir);

        let createBranch = false;
        try {
            await cloneGit.raw('show-ref', '--exists', 'refs/remotes/origin/release');
        } catch (e) {
            if (e instanceof GitError && e.message === 'error: reference does not exist\n') {
                createBranch = true
            } else {
                throw e;
            }
        }

        // create if detached branch doesn't exist
        // switch to release branch
        if (createBranch) {
            await cloneGit.raw('checkout', '--orphan', 'release')
        } else {
            await cloneGit.raw('checkout', 'release')
        }

        // remove everything from tmp repo
        await cloneGit.raw('rm', '-rf', '.');

        // copy everything from dist
        let distDir = path.resolve(projectDir, 'dist');
        await cp(path.resolve(distDir, 'js'), path.resolve(tmpDir, 'js'), { recursive: true })
        await cp(path.resolve(distDir, 'gauntlet.toml'), path.resolve(tmpDir, 'gauntlet.toml'))

        await cloneGit.raw('add', '-A')

        // commit
        const commitHashRaw = await projectGit.raw('rev-parse', 'HEAD')
        const commitHash = commitHashRaw.trim()
        await cloneGit.commit(`chore: deploy ${commitHash}`)

        // add current version tag (overwrite if exists)
        await cloneGit.raw('tag', '--force', 'current-version', commitHash)

        // push
        await cloneGit.push()
        // push tags
        await cloneGit.pushTags()
    } finally {
        await rm(tmpDir, { recursive: true, force: true })
    }
}

