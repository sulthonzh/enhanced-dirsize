#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  scanDir, formatTree, formatTypeBreakdown, formatSuggestions,
  formatTopFiles, findTopFiles, getSuggestions, toJSON, toMarkdown,
  formatSize, parseSize, DEFAULT_IGNORE,
} = require('./index.js');

const args = process.argv.slice(2);

function showHelp() {
  console.log(`
dirsize — directory size analyzer

Usage:
  dirsize [path] [options]

Commands:
  dirsize [path]             Show directory tree with sizes (default)
  dirsize types [path]       File type breakdown
  dirsize top [path]         Largest files
  dirsize clean [path]       Cleanup suggestions
  dirsize summary [path]     Quick summary (total, files, types)

Options:
  -d, --depth <n>            Max depth (default: 5)
  --min-size <size>          Min size to show (e.g. 10MB)
  --ignore <patterns>        Additional ignore patterns (comma-separated)
  --no-ignore                Don't ignore any directories
  -j, --json                 JSON output
  --md                       Markdown output
  -n, --limit <n>            Limit results (default: 20)
  --bar-width <n>            Bar chart width (default: 20)
  -h, --help                 Show this help
  -v, --version              Show version

Examples:
  dirsize .                  Analyze current directory
  dirsize ~/projects         Analyze home projects
  dirsize types .            File type breakdown
  dirsize top . --limit 10   Top 10 largest files
  dirsize clean .            Get cleanup suggestions
  dirsize . --json           JSON output for scripting
  dirsize . --depth 2 -j     Shallow scan, JSON output
`);
}

function parseArgs(argv) {
  const opts = {
    command: 'tree',
    target: '.',
    depth: 5,
    minSize: 0,
    ignorePatterns: [...DEFAULT_IGNORE],
    json: false,
    markdown: false,
    limit: 20,
    barWidth: 20,
  };

  let i = 0;
  const commands = ['types', 'top', 'clean', 'summary'];

  // First non-flag arg could be a command or path
  while (i < argv.length) {
    const arg = argv[i];

    if (arg === '-h' || arg === '--help') {
      showHelp();
      process.exit(0);
    } else if (arg === '-v' || arg === '--version') {
      const pkg = require('../package.json');
      console.log(`dirsize v${pkg.version}`);
      process.exit(0);
    } else if (arg === '-j' || arg === '--json') {
      opts.json = true;
    } else if (arg === '--md') {
      opts.markdown = true;
    } else if ((arg === '-d' || arg === '--depth') && argv[i + 1]) {
      opts.depth = parseInt(argv[++i], 10);
    } else if (arg === '--min-size' && argv[i + 1]) {
      opts.minSize = parseSize(argv[++i]);
      if (opts.minSize < 0) {
        console.error(`Invalid size: ${argv[i]}. Use format like 10MB, 1GB`);
        process.exit(1);
      }
    } else if (arg === '--ignore' && argv[i + 1]) {
      const extra = argv[++i].split(',').map(s => s.trim());
      opts.ignorePatterns.push(...extra);
    } else if (arg === '--no-ignore') {
      opts.ignorePatterns = [];
    } else if ((arg === '-n' || arg === '--limit') && argv[i + 1]) {
      opts.limit = parseInt(argv[++i], 10);
    } else if (arg === '--bar-width' && argv[i + 1]) {
      opts.barWidth = parseInt(argv[++i], 10);
    } else if (!arg.startsWith('-')) {
      if (commands.includes(arg)) {
        opts.command = arg;
      } else {
        opts.target = arg;
      }
    } else {
      console.error(`Unknown option: ${arg}`);
      console.error('Use --help for usage');
      process.exit(1);
    }
    i++;
  }

  return opts;
}

function main() {
  const opts = parseArgs(args);
  const target = path.resolve(opts.target);

  if (!fs.existsSync(target)) {
    console.error(`Path not found: ${target}`);
    process.exit(1);
  }

  const stat = fs.statSync(target);
  if (!stat.isDirectory()) {
    console.error(`Not a directory: ${target}`);
    process.exit(1);
  }

  const scanOpts = {
    maxDepth: opts.command === 'top' ? Infinity : opts.depth,
    ignorePatterns: opts.ignorePatterns,
    minSize: opts.minSize,
    sortBy: 'size',
  };

  if (opts.command === 'top') {
    const files = findTopFiles(target, { ignorePatterns: opts.ignorePatterns, limit: opts.limit });
    if (opts.json) {
      console.log(JSON.stringify(files.map(f => ({
        path: f.path,
        size: f.size,
        sizeHuman: formatSize(f.size),
        type: f.type,
        modified: f.modified.toISOString(),
      })), null, 2));
    } else {
      console.log(`\n  Top ${files.length} largest files in ${path.basename(target)}\n`);
      console.log(formatTopFiles(files, target));
      console.log('');
    }
    return;
  }

  if (opts.command === 'clean') {
    const result = scanDir(target, { ...scanOpts, maxDepth: Infinity });
    const suggestions = getSuggestions(result, target);
    if (opts.json) {
      console.log(JSON.stringify(suggestions, null, 2));
    } else {
      console.log(`\n  Cleanup suggestions for ${path.basename(target)}\n`);
      console.log(formatSuggestions(suggestions));
    }
    return;
  }

  const result = scanDir(target, scanOpts);

  if (opts.command === 'types') {
    if (opts.json) {
      console.log(JSON.stringify(result.types, null, 2));
    } else {
      console.log(`\n  File types in ${result.name}  (${formatSize(result.size)})\n`);
      console.log(formatTypeBreakdown(result.types, result.size));
      console.log('');
    }
    return;
  }

  if (opts.command === 'summary') {
    if (opts.json) {
      console.log(JSON.stringify({
        path: result.name,
        size: result.size,
        sizeHuman: formatSize(result.size),
        fileCount: result.fileCount,
        dirCount: result.dirCount,
        types: result.types,
        topDirs: result.children.slice(0, 5).map(c => ({
          name: c.name,
          size: c.size,
          sizeHuman: formatSize(c.size),
        })),
      }, null, 2));
    } else {
      console.log(`\n  ${result.name}`);
      console.log(`  ${'─'.repeat(40)}`);
      console.log(`  Size:     ${formatSize(result.size)}`);
      console.log(`  Files:    ${result.fileCount}`);
      console.log(`  Dirs:     ${result.dirCount}`);
      console.log('');
      console.log(formatTypeBreakdown(result.types, result.size));
      console.log('');
      console.log(`  Top directories:`);
      for (const child of result.children.slice(0, 5)) {
        const pct = result.size > 0 ? ((child.size / result.size) * 100).toFixed(1) : '0.0';
        console.log(`    ${child.name.padEnd(25)} ${formatSize(child.size).padStart(10)}  (${pct}%)`);
      }
      console.log('');
    }
    return;
  }

  // Default: tree
  if (opts.json) {
    console.log(toJSON(result, { rootPath: target }));
  } else if (opts.markdown) {
    console.log(toMarkdown(result, { rootPath: target }));
  } else {
    console.log('');
    console.log(formatTree(result, { depth: opts.depth, barWidth: opts.barWidth }));
    console.log('');
    console.log(`  ${'─'.repeat(50)}`);
    console.log(`  Total: ${formatSize(result.size)} | ${result.fileCount} files | ${result.dirCount} dirs`);
    console.log('');
  }
}

main();
