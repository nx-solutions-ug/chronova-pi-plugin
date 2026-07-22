---
type: operations
title: Troubleshooting
description: Debug logging, common issues, and how to verify heartbeat activity.
tags: [troubleshooting, debug, logging, faq]
---

# Troubleshooting

## Enable debug logging

Set one of the following before starting oh-my-pi:

- Environment variable:

  ```bash
  export CHRONOVA_PI_DEBUG=1
  ```

- Config file entry in `~/.chronova.cfg`:

  ```ini
  debug = true
  ```

Logs are appended to:

```text
~/.chronova-pi-plugin/plugin.log
```

The log includes every heartbeat payload, argument list, `chronova-cli` output, and rate-limit decision.

## No heartbeats appearing in Chronova

1. Confirm `chronova-cli` is installed at the expected path:

   ```bash
   ls -l ~/.local/bin/chronova-cli
   ~/.local/bin/chronova-cli --version
   ```

2. Verify your API key is in `~/.chronova.cfg`:

   ```bash
   cat ~/.chronova.cfg
   ```

3. Check the plugin log for spawn errors or stderr:

   ```bash
   tail -f ~/.chronova-pi-plugin/plugin.log
   ```

4. Remember the rate limit: only one heartbeat per project per minute is sent. Subsequent activity is held in the pending map and flushed later or on shutdown. Because the rate limit is checked only once per flush, a multi-file flush sends one payload per file; earlier versions silently dropped all but the first payload.

## Rate-limit behavior looks wrong

Per-project state is stored as:

```text
~/.chronova-pi-plugin/state/<hash>.json
```

The hash is the first 16 characters of the SHA-256 of the absolute project folder. If you move or rename the project folder, the hash changes and the rate-limit window resets.

To force a reset, stop oh-my-pi and remove the state file for the project. The plugin will recreate it on the next heartbeat.

## Plugin is not loaded

- Ensure `npm run build` has produced `dist/index.js`.
- Check that `package.json` contains the `omp.extensions` entry pointing to `./dist/index.js`.
- Restart oh-my-pi after installing or updating the plugin.

## Category shown as coding instead of AI coding

The plugin sends `--category "coding"`. The Chronova server classifies the heartbeat as AI coding automatically when the user-agent string (built from `--plugin`) contains `oh-my-pi`. If a heartbeat is not marked as AI, verify the `--plugin` argument includes `oh-my-pi/<version>` and check `chronova-cli` forwards it unchanged.

## Related pages

- [Architecture overview](../architecture/overview.md)
- [Event tracking](../architecture/event-tracking.md)
- [Heartbeat CLI invocation](../architecture/heartbeat-cli.md)
- [Rate limiting & state](../architecture/rate-limiting.md)
