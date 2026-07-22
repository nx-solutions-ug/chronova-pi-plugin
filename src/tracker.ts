import * as path from "node:path";
import * as os from "node:os";
import { logger } from "./logger.js";
import type { HeartbeatPayload } from "./heartbeat.js";

/**
 * Accumulated file changes keyed by absolute path.
 * Values track total additions, deletions, and whether the file was written.
 */
interface FileChange {
  additions: number;
  deletions: number;
  isWrite: boolean;
}

const pending = new Map<string, FileChange>();

/**
 * Record a file view (read-only). Zero line changes.
 */
export function trackRead(filePath: string): void {
  const absPath = resolveAbs(filePath);
  if (!absPath) return;

  const existing = pending.get(absPath);
  if (!existing) {
    pending.set(absPath, { additions: 0, deletions: 0, isWrite: false });
    logger.debug("Tracked read", { path: absPath });
  }
}

/**
 * Record a file write. Marked as isWrite=true.
 */
export function trackWrite(filePath: string): void {
  const absPath = resolveAbs(filePath);
  if (!absPath) return;

  const existing = pending.get(absPath);
  if (existing) {
    existing.isWrite = true;
  } else {
    pending.set(absPath, { additions: 0, deletions: 0, isWrite: true });
  }
  logger.debug("Tracked write", { path: absPath });
}

/**
 * Record an edit with line changes.
 * If perFileResults is available, extract per-file diffs.
 * Otherwise use the top-level diff for a single-file edit.
 */
export function trackEdit(details: {
  diff?: string;
  path?: string;
  perFileResults?: Array<{
    path?: string;
    diff?: string;
    isError?: boolean;
  }>;
  files?: string[];
  fileReplacements?: Array<{ path?: string; count: number }>;
}): void {
  if (details.perFileResults && details.perFileResults.length > 0) {
    for (const result of details.perFileResults) {
      if (result.isError) continue;
      const absPath = resolveAbs(result.path);
      if (!absPath) continue;
      const lineChanges = result.diff ? countLineChanges(result.diff) : { additions: 0, deletions: 0 };
      mergeChange(absPath, { ...lineChanges, isWrite: true });
      logger.debug("Tracked edit (perFile)", { path: absPath, ...lineChanges });
    }
    return;
  }

  // ast_edit reports touched files + per-file replacement counts
  if (details.files && details.files.length > 0) {
    for (const filePath of details.files) {
      const absPath = resolveAbs(filePath);
      if (!absPath) continue;
      const count = details.fileReplacements?.find(r => r.path === filePath)?.count ?? 1;
      mergeChange(absPath, { additions: count, deletions: 0, isWrite: true });
      logger.debug("Tracked ast_edit", { path: absPath, count });
    }
    return;
  }

  // Single-file edit with top-level diff
  const filePath = details.path;
  if (!filePath) {
    logger.debug("Skipped edit: no path in details");
    return;
  }

  const absPath = resolveAbs(filePath);
  if (!absPath) return;

  const lineChanges = details.diff ? countLineChanges(details.diff) : { additions: 1, deletions: 0 };
  mergeChange(absPath, { ...lineChanges, isWrite: true });
  logger.debug("Tracked edit (single)", { path: absPath, ...lineChanges });
}

/**
 * Flush all pending file changes into heartbeat payloads.
 * Clears the pending map after extraction.
 */
export function flushPending(projectFolder: string): HeartbeatPayload[] {
  if (pending.size === 0) return [];

  const payloads: HeartbeatPayload[] = [];
  for (const [entity, change] of pending) {
    payloads.push({
      entity,
      projectFolder,
      isWrite: change.isWrite,
    });
  }

  pending.clear();
  logger.debug("Flushed pending heartbeats", { count: payloads.length });
  return payloads;
}

/**
 * Get the number of pending file changes (for debugging/force-flush).
 */
export function pendingCount(): number {
  return pending.size;
}

// --- internal helpers ---

function resolveAbs(filePath: string | undefined): string | null {
  if (!filePath) return null;
  const expanded = expandTilde(filePath);
  if (path.isAbsolute(expanded)) return expanded;
  // Relative path — can't resolve without a base directory.
  // Callers should pass absolute paths from the entry point.
  return expanded;
}

/**
 * Resolve a possibly-relative path against a base directory.
 * Expands leading ~ to the home directory and rejects non-file URIs
 * (artifact://, memory://, ssh://, etc.) that are not real files.
 */
export function resolvePath(base: string, filePath: string): string | null {
  if (!filePath) return null;

  // Reject non-file URI schemes — they are not real files on disk
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(filePath)) {
    logger.debug("Skipping non-file URI", { path: filePath });
    return null;
  }

  // Strip line/range selectors appended by the read tool (e.g. "foo.ts:50-56")
  const stripped = stripLineSelector(filePath);

  const expanded = expandTilde(stripped);
  if (path.isAbsolute(expanded)) return expanded;
  return path.resolve(base, expanded);
}

/**
 * Expand a leading ~ to the user's home directory.
 * Node's path module does not understand ~ — path.isAbsolute('~') is false,
 * so without this, paths like '~/.projects/foo' get mangled by path.resolve.
 */
function expandTilde(filePath: string): string {
  if (filePath === "~") return os.homedir();
  if (filePath.startsWith("~/")) return path.join(os.homedir(), filePath.slice(2));
  return filePath;
}

/**
 * Strip trailing line/range selectors from a file path.
 * The read tool appends ":50" or ":50-56" or ":50+150" to paths;
 * these are not part of the actual file path.
 */
function stripLineSelector(filePath: string): string {
  // Only strip if the suffix looks like a line selector: :<digits>[-+]<digits>?
  const match = filePath.match(/^(.+):(\d+)(?:[-+]\d+)?$/);
  if (match) return match[1];
  return filePath;
}

function mergeChange(absPath: string, change: FileChange): void {
  const existing = pending.get(absPath);
  if (existing) {
    existing.additions += change.additions;
    existing.deletions += change.deletions;
    if (change.isWrite) existing.isWrite = true;
  } else {
    pending.set(absPath, { ...change });
  }
}

/**
 * Count additions and deletions from a unified diff string.
 * Lines starting with '+' (after the diff header) are additions.
 * Lines starting with '-' are deletions.
 * Ignore the '+++' and '---' header lines.
 */
function countLineChanges(diff: string): { additions: number; deletions: number } {
  let additions = 0;
  let deletions = 0;

  const lines = diff.split("\n");
  for (const line of lines) {
    if (line.startsWith("+++ ") || line.startsWith("--- ")) continue;
    if (line.startsWith("+")) additions++;
    else if (line.startsWith("-")) deletions++;
  }

  return { additions, deletions };
}