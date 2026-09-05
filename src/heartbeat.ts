import { execFile } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { VERSION as OMP_VERSION } from "@oh-my-pi/pi-coding-agent";
import { logger } from "./logger.js";
import { updateLastHeartbeat } from "./state.js";

const DEFAULT_CLI_PATH = path.join(os.homedir(), ".local", "bin", "chronova-cli");

export function getCliPath(): string {
  if (process.env.CHRONOVA_CLI_PATH) {
    return process.env.CHRONOVA_CLI_PATH;
  }
  if (existsSync(DEFAULT_CLI_PATH)) {
    return DEFAULT_CLI_PATH;
  }
  return "chronova-cli";
}

/**
 * Plugin version, read from the sibling package.json at module load.
 * Resolves correctly from both src/ (run by omp) and dist/ (compiled).
 */
export function readPluginVersion(): string {
  try {
    const pkg = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8"),
    ) as { version?: unknown };
    return typeof pkg.version === "string" ? pkg.version : "0.0.0";
  } catch {
    return "0.0.0";
  }
}

export const PLUGIN_VERSION: string = readPluginVersion();

/** User-Agent style string sent to chronova-cli via --plugin. */
export const PLUGIN_ARG = `oh-my-pi/${OMP_VERSION} chronova-pi-plugin/${PLUGIN_VERSION}`;

export interface HeartbeatPayload {
  entity: string;
  projectFolder: string;
  isWrite: boolean;
}

/**
 * Build the chronova-cli argv for a heartbeat payload.
 * Shared by sendHeartbeat and sendHeartbeatForce.
 */
export function buildHeartbeatArgs(payload: HeartbeatPayload): string[] {
  const args: string[] = [
    "--entity", payload.entity,
    "--entity-type", "file",
    "--project-folder", payload.projectFolder,
    "--plugin", PLUGIN_ARG,
    "--category", "coding",
  ];

  if (payload.isWrite) {
    args.push("--write");
  }

  return args;
}

/**
 * Send a heartbeat via chronova-cli. Fire-and-forget — never blocks
 * the agent loop. Resolves after the process is spawned (not after it exits).
 */
export function sendHeartbeat(payload: HeartbeatPayload): void {
  const cliPath = getCliPath();
  const args = buildHeartbeatArgs(payload);

  logger.debug("Spawning chronova-cli", { cliPath, args });

  try {
    const child = execFile(cliPath, args, (err, stdout, stderr) => {
      if (err) {
        logger.error("chronova-cli error", { error: String(err) });
        return;
      }
      if (stderr) {
        logger.warn("chronova-cli stderr", { stderr: stderr.trim() });
      }
      if (stdout) {
        logger.debug("chronova-cli stdout", { stdout: stdout.trim() });
      }
    });

    child.unref();
  } catch (err) {
    logger.error("Failed to spawn chronova-cli", { error: String(err) });
  }

  updateLastHeartbeat(payload.projectFolder);
}

/**
 * Force-send a heartbeat, bypassing rate limits.
 * Used for session shutdown flush.
 */
export function sendHeartbeatForce(payload: HeartbeatPayload): void {
  logger.debug("Spawning chronova-cli (forced)", { projectFolder: payload.projectFolder });
  sendHeartbeat(payload);
}