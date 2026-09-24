import type * as Pi from "@earendil-works/pi-coding-agent";
import { join } from "node:path";

export async function openPiSession(
  sdk: typeof Pi,
  loader: string,
  agentDirectory: string,
  workspace: string,
) {
  const settingsManager = sdk.SettingsManager.inMemory({});
  const resourceLoader = new sdk.DefaultResourceLoader({
    cwd: workspace,
    agentDir: agentDirectory,
    settingsManager,
    additionalExtensionPaths: [loader],
  });
  await resourceLoader.reload();
  const modelRuntime = await sdk.ModelRuntime.create({
    authPath: join(agentDirectory, "auth.json"),
    modelsPath: null,
    allowModelNetwork: false,
    refreshOnCreate: false,
  });
  const { session, extensionsResult } = await sdk.createAgentSession({
    cwd: workspace,
    agentDir: agentDirectory,
    resourceLoader,
    settingsManager,
    modelRuntime,
    sessionManager: sdk.SessionManager.inMemory(workspace),
  });
  try {
    if (extensionsResult.errors.length)
      throw new Error("Pi extension loading failed");
    await session.bindExtensions({});
    const discovered = resourceLoader.getSkills();
    if (
      discovered.diagnostics.some((diagnostic) => diagnostic.type === "error")
    )
      throw new Error("Pi native skill discovery reported errors");
    return { session, discovered };
  } catch (error) {
    session.dispose();
    throw error;
  }
}
