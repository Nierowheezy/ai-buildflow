import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";

import {
  findProjectRoot,
  isBuildflowProjectRoot
} from "../lib/project-root.js";

test("findProjectRoot resolves a legacy BuildFlow project", async (t) => {
  const workspace = await createWorkspace(t);
  const projectRoot = path.join(workspace, "app");
  const nestedDir = path.join(projectRoot, "src", "features");

  await fs.mkdir(path.join(projectRoot, "buildflow"), { recursive: true });
  await fs.mkdir(nestedDir, { recursive: true });
  await fs.writeFile(path.join(projectRoot, "AGENTS.md"), "# Project\n");

  const resolvedRoot = await fs.realpath(projectRoot);
  assert.equal(await findProjectRoot(nestedDir), resolvedRoot);
  assert.equal(await isBuildflowProjectRoot(projectRoot), true);
});

test("findProjectRoot resolves a manifest-backed project with missing AGENTS.md", async (t) => {
  const workspace = await createWorkspace(t);
  const projectRoot = path.join(workspace, "app");
  const manifestPath = path.join(
    projectRoot,
    "buildflow",
    ".state",
    "manifest.json"
  );

  await fs.mkdir(path.dirname(manifestPath), { recursive: true });
  await fs.writeFile(manifestPath, "{}\n");

  assert.equal(await findProjectRoot(projectRoot), await fs.realpath(projectRoot));
});

test("findProjectRoot accepts a file inside a BuildFlow project", async (t) => {
  const workspace = await createWorkspace(t);
  const projectRoot = path.join(workspace, "app");
  const sourceFile = path.join(projectRoot, "src", "index.js");

  await fs.mkdir(path.join(projectRoot, "buildflow"), { recursive: true });
  await fs.mkdir(path.dirname(sourceFile), { recursive: true });
  await fs.writeFile(path.join(projectRoot, "AGENTS.md"), "# Project\n");
  await fs.writeFile(sourceFile, "export {};\n");

  assert.equal(await findProjectRoot(sourceFile), await fs.realpath(projectRoot));
});

test("findProjectRoot returns null outside a BuildFlow project", async (t) => {
  const workspace = await createWorkspace(t);

  assert.equal(await findProjectRoot(workspace), null);
  assert.equal(await isBuildflowProjectRoot(workspace), false);
});

test(
  "findProjectRoot rejects a symlinked BuildFlow directory",
  { skip: process.platform === "win32" },
  async (t) => {
    const workspace = await createWorkspace(t);
    const projectRoot = path.join(workspace, "app");
    const externalBuildflow = path.join(workspace, "external-buildflow");

    await fs.mkdir(projectRoot);
    await fs.mkdir(externalBuildflow);
    await fs.writeFile(path.join(projectRoot, "AGENTS.md"), "# Project\n");
    await fs.symlink(externalBuildflow, path.join(projectRoot, "buildflow"));

    assert.equal(await findProjectRoot(projectRoot), null);
  }
);

async function createWorkspace(t: TestContext): Promise<string> {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "buildflow-root-"));
  t.after(() => fs.rm(workspace, { recursive: true, force: true }));
  return workspace;
}
