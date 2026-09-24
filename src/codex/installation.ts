import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

export async function installedPackages(root: string): Promise<string[]> {
  const manifests: string[] = [];
  let visited = 0;
  async function walk(directory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (++visited > 10_000)
        throw new Error("Installed package entry limit exceeded");
      const path = join(directory, entry.name);
      if (entry.isSymbolicLink())
        throw new Error("Unexpected symlink in installed package cache");
      if (entry.isDirectory()) await walk(path);
      if (entry.isFile() && entry.name === "plugin.json") {
        const manifest = JSON.parse(await readFile(path, "utf8")) as {
          $schema?: string;
        };
        if (
          manifest.$schema ===
          "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json"
        )
          manifests.push(directory);
      }
    }
  }
  await walk(root);
  return manifests;
}
