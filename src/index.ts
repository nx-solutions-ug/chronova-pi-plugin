import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";
import { logger } from "./logger.js";
import { sendHeartbeat, sendHeartbeatForce } from "./heartbeat.js";
import { trackRead, trackWrite, trackEdit, flushPending, pendingCount, resolvePath } from "./tracker.js";
import { shouldSendHeartbeat } from "./state.js";

export default function chronovaPiPlugin(pi: ExtensionAPI): void {
  pi.setLabel("Chronova Heartbeat");

  let projectFolder = "";

  // --- session_start: set up project folder ---
  pi.on("session_start", async (_event, ctx) => {
    projectFolder = ctx.cwd;
    logger.info("Chronova tracking active", { projectFolder });
  });

  // --- tool_result: extract file changes and flush heartbeats ---
  pi.on("tool_result", async (event, _ctx) => {
    if (!projectFolder) return;

    const input = event.input;

    switch (event.toolName) {
      case "read": {
        const filePath = input.path as string | undefined;
        if (filePath) {
          const resolved = resolvePath(projectFolder, filePath);
          if (resolved) trackRead(resolved);
          tryFlush();
        }
        break;
      }

      case "edit": {
        const details = event.details as EditDetails | undefined;
        if (details) {
          const resolvedDetails = {
            ...details,
            path: details.path ? resolvePath(projectFolder, details.path) ?? undefined : undefined,
            perFileResults: details.perFileResults
              ?.map(r => ({ ...r, path: resolvePath(projectFolder, r.path) ?? undefined }))
              .filter(r => r.path !== undefined),
          };
          trackEdit(resolvedDetails);
          tryFlush();
        }
        break;
      }

      case "write": {
        const filePath = input.path as string | undefined;
        if (filePath) {
          const resolved = resolvePath(projectFolder, filePath);
          if (resolved) trackWrite(resolved);
          tryFlush();
        }
        break;
      }

      case "ast_edit": {
        const details = event.details as AstEditDetails | undefined;
        if (details) {
          trackEdit({
            files: details.files
              ?.map(f => resolvePath(projectFolder, f))
              .filter((f): f is string => f !== null),
            fileReplacements: details.fileReplacements
              ?.map(r => ({ ...r, path: resolvePath(projectFolder, r.path) ?? undefined }))
              .filter(r => r.path !== undefined),
          });
          tryFlush();
        }
        break;
      }

      default:
        break;
    }
  });

  // --- session_shutdown: force-flush pending heartbeats ---

  pi.on("session_shutdown", async () => {
    if (!projectFolder) return;

    const count = pendingCount();
    if (count > 0) {
      logger.info("Flushing pending heartbeats on shutdown", { count });
      const payloads = flushPending(projectFolder);
      for (const payload of payloads) {
        sendHeartbeatForce(payload);
      }
    }
  });

  // --- internal ---

  /**
   * Only flush pending changes when the rate limit allows.
   * If rate-limited, changes stay in the pending map for the next opportunity.
   */
  function tryFlush(): void {
    if (!projectFolder || pendingCount() === 0) return;
    if (!shouldSendHeartbeat(projectFolder)) {
      logger.debug("Rate-limited, keeping pending changes", {
        pendingCount: pendingCount(),
      });
      return;
    }
    const payloads = flushPending(projectFolder);
    for (const payload of payloads) {
      sendHeartbeat(payload);
    }
  }
}

// --- type interfaces for tool details ---
// These match the oh-my-pi tool detail types but are declared locally
// to avoid importing internal package types that may not be exported.

interface EditDetails {
  diff?: string;
  path?: string;
  perFileResults?: Array<{
    path: string;
    diff?: string;
    isError?: boolean;
  }>;
  files?: string[];
  fileReplacements?: Array<{ path: string; count: number }>;
}

interface AstEditDetails {
  totalReplacements: number;
  filesTouched: number;
  filesSearched: number;
  applied: boolean;
  files?: string[];
  fileReplacements?: Array<{ path: string; count: number }>;
}