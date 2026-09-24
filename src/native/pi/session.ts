import type * as Pi from "@earendil-works/pi-coding-agent";
import { join } from "node:path";

export async function openPiSession(
  sdk: typeof Pi,
  loader: string,
  agentDirectory: string,
  workspace: string,
  extensions: string[] = [],
) {
  const settingsManager = sdk.SettingsManager.inMemory({});
  const resourceLoader = new sdk.DefaultResourceLoader({
    cwd: workspace,
    agentDir: agentDirectory,
    settingsManager,
    additionalExtensionPaths: [loader, ...extensions],
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
  const errors: Pi.ExtensionError[] = [];
  const assertHealthy = () => {
    if (errors.length) throw new Error("Pi native extension reported an error");
  };
  const close = async () => {
    try {
      await session.extensionRunner.emit({
        type: "session_shutdown",
        reason: "quit",
      });
      assertHealthy();
    } finally {
      session.clearQueue();
      session.dispose();
    }
  };
  try {
    if (extensionsResult.errors.length)
      throw new Error("Pi extension loading failed");
    await session.bindExtensions({ onError: (error) => errors.push(error) });
    assertHealthy();
    const discovered = resourceLoader.getSkills();
    if (
      discovered.diagnostics.some((diagnostic) => diagnostic.type === "error")
    )
      throw new Error("Pi native skill discovery reported errors");
    return { session, discovered, assertHealthy, close };
  } catch (error) {
    await close();
    throw error;
  }
}
