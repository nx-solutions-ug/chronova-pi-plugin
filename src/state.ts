import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import * as crypto from "node:crypto";
import { logger } from "./logger.js";

const STATE_DIR = path.join(os.homedir(), ".chronova-pi-plugin", "state");
const RATE_LIMIT_SECONDS = 60;

interface ProjectState {
  lastHeartbeatAt: number;
}

function projectStateFile(projectFolder: string): string {
  const hash = crypto.createHash("sha256").update(projectFolder).digest("hex").slice(0, 16);
  return path.join(STATE_DIR, `${hash}.json`);
}

function readState(filePath: string): ProjectState | null {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as ProjectState;
  } catch {
    return null;
  }
}

function writeState(filePath: string, state: ProjectState): void {
  try {
    fs.mkdirSync(STATE_DIR, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(state));
  } catch (err) {
    logger.error("Failed to write state file", { filePath, error: String(err) });
  }
}

export function shouldSendHeartbeat(projectFolder: string, force = false): boolean {
  if (force) return true;

  const stateFile = projectStateFile(projectFolder);
  const state = readState(stateFile);
  if (!state) return true;

  const elapsed = Math.floor(Date.now() / 1000) - state.lastHeartbeatAt;
  return elapsed >= RATE_LIMIT_SECONDS;
}

export function updateLastHeartbeat(projectFolder: string): void {
  const stateFile = projectStateFile(projectFolder);
  const now = Math.floor(Date.now() / 1000);
  writeState(stateFile, { lastHeartbeatAt: now });
  logger.debug("Updated heartbeat state", { projectFolder, lastHeartbeatAt: now });
}