import { join } from "node:path";

/**
 * Utility for managing application paths.
 */
export class PathManager {
  private static _resourcesDir: string | null = null;

  /**
   * Returns the path to the Resources directory.
   */
  static getResourcesDir(): string {
    if (this._resourcesDir) return this._resourcesDir;

    const isPackaged = import.meta.dir.includes("Resources");
    this._resourcesDir = isPackaged
      ? join(import.meta.dir, "../..") // Resources/app/bun -> Resources
      : join(import.meta.dir, "../../Resources"); // src/bun -> Resources (dev)

    return this._resourcesDir;
  }

  /**
   * Returns the app version. Note: prefers local resolution.
   */
  static getAppVersion(currentDir: string): string {
    // This is often needed in main.ts
    return "0.4.0"; // Should be synced with constants or read from package.json
  }

  /**
   * Get candidates for the application icon.
   */
  static getIconCandidates(cwd: string): string[] {
    const resDir = this.getResourcesDir();
    return [
      join(resDir, "icons/icon.ico"),
      join(resDir, "app/views/mainview/assets/icon.ico"),
      join(cwd, "icons/icon.ico"),
    ];
  }
}
