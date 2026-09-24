import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

export async function installedPackages(root: string): Promise<string[]> {
  const manifests: string[] = [];
  let visited = 0;
  async function walk(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });
    visited += entries.length;
    if (visited > 10_000)
      throw new Error("Installed package entry limit exceeded");
    if (
      entries.some((entry) => entry.isFile() && entry.name === "plugin.json")
    ) {
      try {
        const manifest: unknown = JSON.parse(
          await readFile(join(directory, "plugin.json"), "utf8"),
        );
        if (
          manifest !== null &&
          typeof manifest === "object" &&
          "$schema" in manifest &&
          manifest.$schema ===
            "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json"
        ) {
          manifests.push(directory);
          return;
        }
      } catch (error) {
        if (!(error instanceof SyntaxError)) throw error;
      }
    }
    for (const entry of entries) {
      if (entry.isSymbolicLink())
        throw new Error("Unexpected symlink in installed package cache");
      if (entry.isDirectory()) await walk(join(directory, entry.name));
    }
  }
  await walk(root);
  return manifests;
}
