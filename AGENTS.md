# Repository Guidelines

## Structural code search (ast-grep)

Use `ast-grep` — not `grep`/`rg` — for anything **structural**: finding call
sites, function/class/JSX shapes, or code matching a pattern rather than a
string. Use it for **every multi-file rewrite**. Text search also hits
comments, strings and unrelated identifiers; ast-grep matches AST nodes.

Fall back to `rg` only for literal text, non-code files (Markdown, JSON, lock
files), or languages ast-grep cannot parse.

```bash
# Search — single-node patterns. Always single-quote: "$A" is shell-expanded.
ast-grep run -p 'console.log($ARG)' -l ts src/
ast-grep run -p 'useEffect($CB, $DEPS)' -l tsx --json src/ | jq -r '.[].file'

# Search — relational / composite queries
ast-grep scan --inline-rules 'id: await-in-loop
language: TypeScript
rule:
  kind: for_in_statement
  has:
    pattern: await $E
    stopBy: end' src/

# Rewrite — prints a diff by default; -i reviews each edit, -U applies all
ast-grep run -p 'var $N = $V' -r 'let $N = $V' -l ts -i src/
```

Non-obvious rules, in the order they bite:

- Invoke it as `ast-grep`, never the `sg` alias — `sg` collides with
  shadow-utils' setgid tool on Linux.
- **Single-quote patterns.** `"$PROP && $PROP()"` reaches ast-grep as `" && ()"`
  after shell expansion.
- In relational rules (`has`, `inside`, `precedes`, `follows`) set
  `stopBy: end`, or the search stops at the first non-matching node.
- **Write inline rules in block YAML, not flow maps.** `has: { pattern: f() { $$$B }, stopBy: end }`
  fails to parse — the pattern's `}` closes the flow mapping. Indented keys
  always work.
- **Zero matches ≠ code absent.** Patterns match whole AST nodes, so
  `-p 'log($MSG)'` does _not_ match `console.log("hello")`. Before concluding
  something isn't there, inspect the parse: `--debug-query=pattern` shows how
  ast-grep read your pattern, `--debug-query=ast` shows the named nodes.
- `--inline-rules` works in any directory; bare `ast-grep scan` (project rule
  dirs) requires an `sgconfig.yml` at the repo root.
- Not on `PATH` — CI runners included: `bun add -g @ast-grep/cli`.

Full reference: <https://ast-grep.github.io/llms-full.txt>

When a query needs a real YAML rule rather than a one-line pattern, invoke the
`ast-grep:ast-grep` skill (rule syntax, relational/composite rules, debugging
checklist); `ast-grep:outline` gives a file's structure. Both ship with the
`ast-grep` plugin; when it isn't installed (CI runners), fall back to the
reference linked above rather than reconstructing rule syntax from memory.

## Claude Code CI automation

The `.github/workflows/claude-*.yml` workflows run Claude Code through
`anthropics/claude-code-action@v1` and invoke the project commands in
`.claude/commands/` as slash commands, e.g. `/review-pr 42`. `$ARGUMENTS` is
expanded by Claude Code itself.

Tool permissions for those runs are declared centrally per job via
`claude_args: --allowedTools ...` in the workflow — deliberately not in command
frontmatter, so there is one place to look.

`gh label create` is not idempotent: it exits 422 when the label already
exists. Always append `|| true`.
