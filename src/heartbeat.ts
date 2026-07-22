import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import * as path from "node:path";
import { VERSION as OMP_VERSION } from "@oh-my-pi/pi-coding-agent";
import { logger } from "./logger.js";
import { updateLastHeartbeat } from "./state.js";

const CLI_PATH = path.join(
  process.env.HOME ?? "/home/dev",
  ".local/bin/chronova-cli"
);

/**
 * Plugin version, read from the sibling package.json at module load.
 * Resolves correctly from both src/ (run by omp) and dist/ (compiled).
 */
const PLUGIN_VERSION: string = readPluginVersion();

function readPluginVersion(): string {
  const pkg = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  ) as { version?: unknown };
  return typeof pkg.version === "string" ? pkg.version : "0.0.0";
}

/** User-Agent style string sent to chronova-cli via --plugin. */
const PLUGIN_ARG = `oh-my-pi/${OMP_VERSION} chronova-pi-plugin/${PLUGIN_VERSION}`;

export interface HeartbeatPayload {
  entity: string;
  projectFolder: string;
  isWrite: boolean;
}

/**
 * Send a heartbeat via chronova-cli. Fire-and-forget — never blocks
 * the agent loop. Resolves after the process is spawned (not after it exits).
 */
export function sendHeartbeat(payload: HeartbeatPayload): void {
  const args = buildHeartbeatArgs(payload);

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
  const args = buildHeartbeatArgs(payload);

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

/**
 * Build the chronova-cli argv for a heartbeat payload.
 * Shared by sendHeartbeat and sendHeartbeatForce.
 */
function buildHeartbeatArgs(payload: HeartbeatPayload): string[] {
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

  // Note: --ai-line-changes is accepted by chronova-cli but the Heartbeat
  // struct has no corresponding field, so the value is silently dropped
  // before reaching the API. The AI-vs-manual distinction is made by the
  // server based on the user_agent string containing "oh-my-pi".

  return args;
}