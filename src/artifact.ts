import { createHash } from "node:crypto";
import { lstat, readFile, readdir, readlink, realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { Ajv2020 } from "ajv/dist/2020.js";
import manifestSchema from "./schemas/plugin.schema.json" with { type: "json" };
import mcpSchema from "./schemas/mcp.schema.json" with { type: "json" };
import type { Suite } from "./suite/schema.js";

const validator = new Ajv2020({ allErrors: true, strict: false });
const validateManifest = validator.compile(manifestSchema);
const validateMcp = validator.compile(mcpSchema);

export type ArtifactEntry = {
  path: string;
  kind: "file" | "directory" | "symlink";
  executable?: boolean;
  sha256?: string;
  target?: string;
};
export type ArtifactSnapshot = {
  digest: string;
  entries: ArtifactEntry[];
  bytes: number;
};

export function digest(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

export function containsPath(root: string, candidate: string): boolean {
  const path = relative(root, candidate);
  return (
    path === "" ||
    (!path.startsWith(".." + "/") && path !== ".." && !isAbsolute(path))
  );
}

export async function containedPath(
  root: string,
  path: string,
): Promise<string> {
  const canonicalRoot = await realpath(root);
  const candidate = await realpath(resolve(canonicalRoot, path));
  if (!containsPath(canonicalRoot, candidate))
    throw new Error(`Path escapes artifact: ${path}`);
  return candidate;
}

export async function snapshotArtifact(
  root: string,
  limits: Pick<Suite["limits"], "maxArtifactBytes" | "maxArtifactEntries">,
): Promise<ArtifactSnapshot> {
  const canonicalRoot = await realpath(root);
  const entries: ArtifactEntry[] = [];
  let bytes = 0;
  async function walk(directory: string): Promise<void> {
    for (const name of (await readdir(directory)).sort()) {
      const absolute = resolve(directory, name);
      const path = relative(canonicalRoot, absolute).split("\\").join("/");
      const stat = await lstat(absolute);
      if (entries.length >= limits.maxArtifactEntries)
        throw new Error("Artifact entry limit exceeded");
      if (stat.isSymbolicLink()) {
        await containedPath(canonicalRoot, path);
        entries.push({
          path,
          kind: "symlink",
          target: await readlink(absolute),
        });
      } else if (stat.isDirectory()) {
        entries.push({ path, kind: "directory" });
        await walk(absolute);
      } else if (stat.isFile()) {
        bytes += stat.size;
        if (bytes > limits.maxArtifactBytes)
          throw new Error("Artifact byte limit exceeded");
        const content = await readFile(absolute);
        if (content.length !== stat.size)
          throw new Error(`Artifact changed while reading: ${path}`);
        entries.push({
          path,
          kind: "file",
          executable: (stat.mode & 0o111) !== 0,
          sha256: digest(content),
        });
      } else {
        throw new Error(`Unsupported artifact entry: ${path}`);
      }
    }
  }
  await walk(canonicalRoot);
  return { digest: digest(JSON.stringify(entries)), entries, bytes };
}

async function readObject(root: string, path: string): Promise<unknown> {
  return JSON.parse(await readFile(await containedPath(root, path), "utf8"));
}

export async function inspectArtifact(suite: Suite): Promise<ArtifactSnapshot> {
  const root = await realpath(suite.artifact.root);
  const snapshot = await snapshotArtifact(root, suite.limits);
  if (suite.artifact.digest && suite.artifact.digest !== snapshot.digest)
    throw new Error("Artifact digest does not match the required identity");
  const packageNames = new Set<string>();
  for (const packagePath of suite.artifact.packages) {
    const packageRoot = await containedPath(root, packagePath);
    await snapshotArtifact(packageRoot, suite.limits);
    const manifest = await readObject(packageRoot, "plugin.json");
    if (!validateManifest(manifest))
      throw new Error(
        `Invalid emitted manifest ${packagePath}: ${validator.errorsText(validateManifest.errors)}`,
      );
    const name = (manifest as { name: string }).name;
    if (packageNames.has(name))
      throw new Error(`Duplicate generated package name: ${name}`);
    packageNames.add(name);
    try {
      await lstat(resolve(packageRoot, "mcp.json"));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw error;
    }
    const configuration = await readObject(packageRoot, "mcp.json");
    if (!validateMcp(configuration))
      throw new Error(
        `Invalid emitted MCP configuration ${packagePath}: ${validator.errorsText(validateMcp.errors)}`,
      );
  }
  for (const expected of suite.artifact.requiredFiles) {
    const path = await containedPath(root, expected.path);
    const stat = await lstat(path);
    if (!stat.isFile())
      throw new Error(`Required asset is not a file: ${expected.path}`);
    if (
      expected.executable !== undefined &&
      ((stat.mode & 0o111) !== 0) !== expected.executable
    )
      throw new Error(
        `Required executable permission differs: ${expected.path}`,
      );
    if (expected.sha256 && digest(await readFile(path)) !== expected.sha256)
      throw new Error(`Required asset content differs: ${expected.path}`);
  }
  return snapshot;
}
