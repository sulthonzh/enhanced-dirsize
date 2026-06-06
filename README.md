# dirsize

Directory size analyzer with tree visualization, file type breakdown, and cleanup suggestions.

Because `du -sh *` doesn't tell you *what's eating your disk* — just that something is.

## Why?

I got tired of SSHing into servers and playing detective with `du`, `find`, and `ls -lah`. I wanted one command that shows me:

- **Where the space goes** — visual tree with bar charts
- **What types of files** — source code vs assets vs cache vs logs
- **How to clean up** — actionable suggestions with exact commands
- **Scriptable output** — JSON and Markdown for automation

Zero dependencies. Node.js >= 16.

## Install

```bash
npm install -g dirsize
```

Or use without installing:

```bash
npx dirsize .
```

## Usage

### Tree view (default)

```bash
dirsize ~/projects
```

```
projects  2.4 GB (1,847 files, 143 dirs)

├── frontend     1.2 GB  ██████████████████░░ 12.3% (423 files)
│   ├── node_modules  890.0 MB  ████████████████░░░░ 36.2%
│   ├── dist     120.0 MB  ███░░░░░░░░░░░░░░░░░░ 4.9%
│   └── src      45.2 MB  █░░░░░░░░░░░░░░░░░░░░ 1.8%
├── backend      800.0 MB  ██████████████░░░░░░ 32.5%
│   ├── .terraform  450.0 MB  █████████░░░░░░░░░░░░ 18.3%
│   ├── vendor   200.0 MB  ████░░░░░░░░░░░░░░░░░░ 8.1%
│   └── src      50.0 MB  █░░░░░░░░░░░░░░░░░░░░ 2.0%
└── docs          400.0 MB  ████████░░░░░░░░░░░░ 16.3%
    ├── images  350.0 MB  ███████░░░░░░░░░░░░░░ 14.2%
    └── pages    50.0 MB  █░░░░░░░░░░░░░░░░░░░░ 2.0%

──────────────────────────────────────────────────
Total: 2.4 GB | 1,847 files | 143 dirs
```

### File type breakdown

```bash
dirsize types .
```

```
  File types in my-project  (450.2 MB)

  📦 Source Code     120.5 MB  ████████░░░░░░░░░░░░░░░░░░░░  26.8% (342)
  🖼️  Assets          200.0 MB  █████████████░░░░░░░░░░░░░░░  44.4% (89)
  📄 Data Files       50.2 MB  ███░░░░░░░░░░░░░░░░░░░░░░░░░  11.2% (15)
  🔒 Lockfiles        40.0 MB  ██░░░░░░░░░░░░░░░░░░░░░░░░░░   8.9% (3)
  📝 Documentation    30.0 MB  ██░░░░░░░░░░░░░░░░░░░░░░░░░░   6.7% (28)
  📎 Other             9.5 MB  █░░░░░░░░░░░░░░░░░░░░░░░░░░░   2.1% (12)
```

### Cleanup suggestions

```bash
dirsize clean .
```

```
  Cleanup suggestions for my-project

  Potential savings: 1.2 GB

       890.0 MB  ./frontend/node_modules
               node_modules — reinstall with npm ci if needed
               → rm -rf "./frontend/node_modules"

       450.0 MB  ./backend/.terraform
               Terraform providers (450.0 MB) — reinit with terraform init
               → rm -rf "./backend/.terraform"

       120.0 MB  ./frontend/dist
               build output (120.0 MB) — regenerate with build command
               → rm -rf "./frontend/dist"
```

### Largest files

```bash
dirsize top . --limit 10
```

### Quick summary

```bash
dirsize summary ~/projects
```

### JSON output (for scripting)

```bash
dirsize . --json
dirsize types . -j
dirsize top . -j -n 5
```

### Markdown reports

```bash
dirsize . --md > size-report.md
```

## Commands

| Command | Description |
|---------|-------------|
| `dirsize [path]` | Tree view with sizes and bar charts |
| `dirsize types [path]` | File type breakdown by category |
| `dirsize top [path]` | Largest individual files |
| `dirsize clean [path]` | Cleanup suggestions with exact commands |
| `dirsize summary [path]` | Quick summary with top dirs |

## Options

| Flag | Description |
|------|-------------|
| `-d, --depth <n>` | Max directory depth (default: 5) |
| `--min-size <size>` | Minimum size to show (e.g. `10MB`, `1GB`) |
| `--ignore <patterns>` | Additional ignore patterns, comma-separated |
| `--no-ignore` | Don't skip any directories |
| `-j, --json` | JSON output |
| `--md` | Markdown output |
| `-n, --limit <n>` | Limit results (for `top`) |
| `--bar-width <n>` | Bar chart width (default: 20) |

## What it detects for cleanup

- **node_modules** — reinstall anytime
- **.cache** directories — safe to clear
- **dist/build/.next** — build artifacts, regenerate with build
- **.terraform** — provider cache, reinit with `terraform init`
- **coverage** — test artifacts
- **Large .log files** — consider truncating

All suggestions include the exact command to run.

## Programmatic API

```js
const { scanDir, formatSize, getSuggestions } = require('dirsize');

const result = scanDir('/path/to/project', {
  maxDepth: 3,
  ignorePatterns: ['node_modules', '.git'],
  minSize: 1024 * 1024, // 1MB minimum
});

console.log(`Total: ${formatSize(result.size)}`);
console.log(`Files: ${result.fileCount}`);

// Type breakdown
for (const [category, data] of Object.entries(result.types)) {
  console.log(`${category}: ${formatSize(data.size)} (${data.count} files)`);
}

// Cleanup suggestions
const suggestions = getSuggestions(result, '/path/to/project');
```

## File type detection

Recognizes 100+ extensions across 10 categories:

- **Source code** — JS/TS/Python/Ruby/Go/Rust/Java/C/C#/PHP/Zig/Nim/Lua/Scala/R
- **Markup/Style** — HTML/CSS/SCSS/Less/Vue/Svelte
- **Data** — JSON/YAML/XML/TOML/CSV/TSV/INI
- **Docs** — Markdown/Text/PDF/Word/reStructuredText
- **Assets** — PNG/JPG/GIF/SVG/WebP/MP3/WAV/MP4/fonts
- **Archives** — ZIP/TAR/GZ/BZ2/XZ/7Z/RAR
- **Binary** — EXE/DLL/SO/DYLIB/WASM
- **Config** — .env/.gitignore/.editorconfig/eslint/prettier
- **Lockfiles** — .lock files

## Why zero dependencies?

Because a tool that tells you about disk usage shouldn't itself take up disk space. It's a single-purpose CLI — pulling in 50 transitive deps for that would be ironic.

## License

MIT
