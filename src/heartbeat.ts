import { execFile } from "node:child_process";
import * as path from "node:path";
import { logger } from "./logger.js";
import { shouldSendHeartbeat, updateLastHeartbeat } from "./state.js";

const PLUGIN_VERSION = "1.0.0";
const CLI_PATH = path.join(
  process.env.HOME ?? "/home/dev",
  ".local/bin/chronova-cli"
);

export interface HeartbeatPayload {
  entity: string;
  projectFolder: string;
  isWrite: boolean;
  aiLineChanges: number;
}

/**
 * Send a heartbeat via chronova-cli. Fire-and-forget — never blocks
 * the agent loop. Resolves after the process is spawned (not after it exits).
 */
export function sendHeartbeat(payload: HeartbeatPayload): void {
  if (!shouldSendHeartbeat(payload.projectFolder)) {
    logger.debug("Heartbeat rate-limited, skipping", { projectFolder: payload.projectFolder });
    return;
  }

  const args: string[] = [
    "--entity", payload.entity,
    "--entity-type", "file",
    "--project-folder", payload.projectFolder,
    "--plugin", `oh-my-pi/1.0.0 chronova-pi-plugin/${PLUGIN_VERSION}`,
    "--category", "ai coding",
  ];

  if (payload.isWrite) {
    args.push("--write");
  }

  if (payload.aiLineChanges !== 0) {
    args.push("--ai-line-changes", String(payload.aiLineChanges));
  }

  logger.debug("Spawning chronova-cli", { args });

  const child = execFile(CLI_PATH, args, (err, stdout, stderr) => {
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
  updateLastHeartbeat(payload.projectFolder);
}

/**
 * Force-send a heartbeat, bypassing rate limits.
 * Used for session shutdown flush.
 */
export function sendHeartbeatForce(payload: HeartbeatPayload): void {
  if (!shouldSendHeartbeat(payload.projectFolder, true)) {
    // Always true with force, but keep the guard for type safety
    return;
  }

  const args: string[] = [
    "--entity", payload.entity,
    "--entity-type", "file",
    "--project-folder", payload.projectFolder,
    "--plugin", `oh-my-pi/1.0.0 chronova-pi-plugin/${PLUGIN_VERSION}`,
    "--category", "ai coding",
  ];

  if (payload.isWrite) {
    args.push("--write");
  }

  if (payload.aiLineChanges !== 0) {
    args.push("--ai-line-changes", String(payload.aiLineChanges));
  }

  logger.debug("Spawning chronova-cli (forced)", { args });

  const child = execFile(CLI_PATH, args, (err, stdout, stderr) => {
    if (err) {
      logger.error("chronova-cli error (forced)", { error: String(err) });
      return;
    }
    if (stderr) {
      logger.warn("chronova-cli stderr (forced)", { stderr: stderr.trim() });
    }
  });

  child.unref();
  updateLastHeartbeat(payload.projectFolder);
}