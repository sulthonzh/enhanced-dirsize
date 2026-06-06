'use strict';

const fs = require('fs');
const path = require('path');

// ── Size formatting ──

function formatSize(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const val = bytes / Math.pow(1024, i);
  return val.toFixed(i === 0 ? 0 : 1) + ' ' + units[i];
}

function parseSize(str) {
  const match = str.match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB|TB)$/i);
  if (!match) return -1;
  const [, num, unit] = match;
  const exp = ['B', 'KB', 'MB', 'GB', 'TB'].indexOf(unit.toUpperCase());
  return Math.round(Number(num) * Math.pow(1024, exp));
}

// ── File type detection ──

const TYPE_MAP = {
  // Code
  '.js': 'JavaScript', '.jsx': 'JavaScript', '.ts': 'TypeScript', '.tsx': 'TypeScript',
  '.mjs': 'JavaScript', '.cjs': 'JavaScript', '.mts': 'TypeScript', '.cts': 'TypeScript',
  '.py': 'Python', '.rb': 'Ruby', '.go': 'Go', '.rs': 'Rust', '.java': 'Java',
  '.kt': 'Kotlin', '.swift': 'Swift', '.c': 'C', '.cpp': 'C++', '.h': 'C/C++ Header',
  '.cs': 'C#', '.php': 'PHP', '.zig': 'Zig', '.nim': 'Nim', '.lua': 'Lua',
  '.scala': 'Scala', '.r': 'R', '.R': 'R',
  // Web
  '.html': 'HTML', '.htm': 'HTML', '.css': 'CSS', '.scss': 'SCSS', '.sass': 'SCSS',
  '.less': 'Less', '.vue': 'Vue', '.svelte': 'Svelte',
  // Data
  '.json': 'JSON', '.yaml': 'YAML', '.yml': 'YAML', '.xml': 'XML',
  '.toml': 'TOML', '.csv': 'CSV', '.tsv': 'TSV', '.ini': 'INI',
  // Docs
  '.md': 'Markdown', '.mdx': 'MDX', '.txt': 'Text', '.pdf': 'PDF',
  '.doc': 'Word', '.docx': 'Word', '.rst': 'reStructuredText',
  // Images
  '.png': 'Image', '.jpg': 'Image', '.jpeg': 'Image', '.gif': 'Image',
  '.svg': 'Image', '.webp': 'Image', '.ico': 'Image', '.bmp': 'Image',
  '.tiff': 'Image', '.avif': 'Image',
  // Video
  '.mp4': 'Video', '.avi': 'Video', '.mov': 'Video', '.mkv': 'Video',
  '.webm': 'Video', '.flv': 'Video', '.wmv': 'Video',
  // Audio
  '.mp3': 'Audio', '.wav': 'Audio', '.ogg': 'Audio', '.flac': 'Audio',
  '.aac': 'Audio', '.m4a': 'Audio',
  // Archives
  '.zip': 'Archive', '.tar': 'Archive', '.gz': 'Archive', '.bz2': 'Archive',
  '.xz': 'Archive', '.7z': 'Archive', '.rar': 'Archive', '.tgz': 'Archive',
  // Fonts
  '.ttf': 'Font', '.otf': 'Font', '.woff': 'Font', '.woff2': 'Font', '.eot': 'Font',
  // Config
  '.env': 'Config', '.gitignore': 'Config', '.editorconfig': 'Config',
  '.eslintrc': 'Config', '.prettierrc': 'Config',
  // Binary/Exec
  '.exe': 'Executable', '.dll': 'Library', '.so': 'Library', '.dylib': 'Library',
  '.wasm': 'WebAssembly',
  // Lock/deps
  '.lock': 'Lockfile',
};

const CATEGORY_MAP = {
  'JavaScript': 'code', 'TypeScript': 'code', 'Python': 'code', 'Ruby': 'code',
  'Go': 'code', 'Rust': 'code', 'Java': 'code', 'Kotlin': 'code', 'Swift': 'code',
  'C': 'code', 'C++': 'code', 'C/C++ Header': 'code', 'C#': 'code', 'PHP': 'code',
  'Zig': 'code', 'Nim': 'code', 'Lua': 'code', 'Scala': 'code', 'R': 'code',
  'HTML': 'markup', 'CSS': 'markup', 'SCSS': 'markup', 'Less': 'markup',
  'Vue': 'markup', 'Svelte': 'markup',
  'JSON': 'data', 'YAML': 'data', 'XML': 'data', 'TOML': 'data', 'CSV': 'data',
  'TSV': 'data', 'INI': 'data',
  'Markdown': 'docs', 'MDX': 'docs', 'Text': 'docs', 'PDF': 'docs',
  'Word': 'docs', 'reStructuredText': 'docs',
  'Image': 'assets', 'Font': 'assets', 'Video': 'assets', 'Audio': 'assets',
  'Archive': 'archives', 'Executable': 'binary', 'Library': 'binary',
  'WebAssembly': 'binary', 'Config': 'config', 'Lockfile': 'lockfile',
};

const CATEGORY_LABELS = {
  code: '📦 Source Code', markup: '🎨 Markup/Style', data: '📄 Data Files',
  docs: '📝 Documentation', assets: '🖼️  Assets', archives: '📦 Archives',
  binary: '⚙️  Binary', config: '🔧 Config', lockfile: '🔒 Lockfiles',
  other: '📎 Other',
};

function getFileType(filepath) {
  const ext = path.extname(filepath).toLowerCase();
  const basename = path.basename(filepath).toLowerCase();
  // Check special filenames
  if (basename === 'license' || basename === 'license.md') return 'License';
  if (basename === 'makefile') return 'Makefile';
  if (basename === 'dockerfile') return 'Dockerfile';
  if (basename === 'gemfile') return 'Ruby Config';
  return TYPE_MAP[ext] || 'Other';
}

function getFileCategory(type) {
  return CATEGORY_MAP[type] || 'other';
}

// ── Tree walker ──

const DEFAULT_IGNORE = [
  'node_modules', '.git', '.svn', '.hg', '.cache', '.Trash',
  '__pycache__', '.pytest_cache', '.mypy_cache', '.tox',
  'target', 'build', 'dist', '.next', '.nuxt', '.output',
  'vendor/bundle', '.terraform', '.venv', 'venv',
];

function shouldIgnore(name, ignorePatterns) {
  return ignorePatterns.some(pattern => {
    if (pattern.startsWith('*')) {
      return name.endsWith(pattern.slice(1));
    }
    return name === pattern;
  });
}

function scanDir(dirPath, options = {}) {
  const {
    maxDepth = Infinity,
    ignorePatterns = DEFAULT_IGNORE,
    minSize = 0,
    sortBy = 'size',
    countFiles = false,
  } = options;

  const result = {
    path: dirPath,
    name: path.basename(dirPath) || dirPath,
    size: 0,
    fileCount: 0,
    dirCount: 0,
    children: [],
    types: {},
  };

  let entries;
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch (e) {
    result.error = e.message;
    return result;
  }

  for (const entry of entries) {
    if (shouldIgnore(entry.name, ignorePatterns)) continue;

    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      if (maxDepth <= 0) continue;
      const child = scanDir(fullPath, {
        ...options,
        maxDepth: maxDepth === Infinity ? Infinity : maxDepth - 1,
      });
      child.name = entry.name;
      result.size += child.size;
      result.fileCount += child.fileCount;
      result.dirCount += child.dirCount + 1;
      if (child.size >= minSize) {
        result.children.push(child);
      }
    } else if (entry.isFile()) {
      try {
        const stat = fs.statSync(fullPath);
        result.size += stat.size;
        result.fileCount += 1;

        const ftype = getFileType(fullPath);
        const cat = getFileCategory(ftype);
        if (!result.types[cat]) result.types[cat] = { size: 0, count: 0, label: CATEGORY_LABELS[cat] || cat };
        result.types[cat].size += stat.size;
        result.types[cat].count += 1;
      } catch (e) {
        // skip files we can't stat
      }
    } else if (entry.isSymbolicLink()) {
      try {
        const stat = fs.statSync(fullPath);
        result.size += stat.size;
        result.fileCount += 1;
      } catch (e) {
        // broken symlink
      }
    }
  }

  // Sort children
  result.children.sort((a, b) => {
    if (sortBy === 'size') return b.size - a.size;
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    if (sortBy === 'files') return b.fileCount - a.fileCount;
    return 0;
  });

  return result;
}

// ── Tree visualization ──

function buildTree(node, prefix, isLast, maxDepth, showFiles, barWidth) {
  const lines = [];
  const connector = isLast ? '└── ' : '├── ';
  const bar = buildBar(node.size, node.parentSize || node.size, barWidth || 20);
  const sizeStr = formatSize(node.size).padStart(10);

  let label = node.name;
  if (node.fileCount > 0 && !node.children?.length) {
    label += ` (${node.fileCount} file${node.fileCount !== 1 ? 's' : ''})`;
  }

  lines.push(`${prefix}${connector}${label}  ${sizeStr} ${bar}`);

  if (maxDepth <= 0 && node.children?.length) {
    const remaining = node.children.length;
    const nextPrefix = prefix + (isLast ? '    ' : '│   ');
    lines.push(`${nextPrefix}... ${remaining} more director${remaining !== 1 ? 'ies' : 'y'}`);
    return lines;
  }

  if (node.children) {
    const nextPrefix = prefix + (isLast ? '    ' : '│   ');
    node.children.forEach((child, i) => {
      const childLast = i === node.children.length - 1;
      child.parentSize = node.size;
      const childLines = buildTree(child, nextPrefix, childLast, maxDepth - 1, showFiles, barWidth);
      lines.push(...childLines);
    });
  }

  return lines;
}

function buildBar(value, total, width) {
  const ratio = total > 0 ? value / total : 0;
  const filled = Math.round(ratio * width);
  const empty = width - filled;
  if (filled === 0 && value > 0) return '▏' + '░'.repeat(width - 1);
  return '█'.repeat(filled) + '░'.repeat(empty);
}

function formatTree(result, options = {}) {
  const {
    depth = 5,
    showFiles = false,
    barWidth = 20,
  } = options;

  const lines = [];
  lines.push(`${result.name}  ${formatSize(result.size)} (${result.fileCount} files, ${result.dirCount} dirs)`);
  lines.push('');

  result.children.forEach((child, i) => {
    child.parentSize = result.size;
    const isLast = i === result.children.length - 1;
    const childLines = buildTree(child, '', isLast, depth - 1, showFiles, barWidth);
    lines.push(...childLines);
  });

  return lines.join('\n');
}

// ── Type breakdown ──

function formatTypeBreakdown(types, totalSize) {
  const entries = Object.entries(types)
    .filter(([, v]) => v.size > 0)
    .sort((a, b) => b[1].size - a[1].size);

  if (!entries.length) return 'No files found.';

  const lines = [];
  const maxLabelLen = Math.max(...entries.map(([, v]) => (v.label || '').length));

  for (const [cat, data] of entries) {
    const pct = totalSize > 0 ? ((data.size / totalSize) * 100).toFixed(1) : '0.0';
    const bar = buildBar(data.size, totalSize, 30);
    const label = (data.label || cat).padEnd(maxLabelLen);
    lines.push(`  ${label}  ${formatSize(data.size).padStart(10)}  ${bar}  ${pct}% (${data.count})`);
  }

  return lines.join('\n');
}

// ── Cleanup suggestions ──

function getSuggestions(result, dirPath) {
  const suggestions = [];

  function walk(node, fullPath) {
    const currentPath = fullPath || result.path;

    // node_modules
    if (node.name === 'node_modules' && node.size > 0) {
      suggestions.push({
        path: currentPath,
        size: node.size,
        reason: 'node_modules — reinstall with npm ci if needed',
        safe: true,
        command: `rm -rf "${currentPath}"`,
      });
    }

    // .cache directories
    if (node.name === '.cache' && node.size > 10 * 1024 * 1024) {
      suggestions.push({
        path: currentPath,
        size: node.size,
        reason: `cache dir (${formatSize(node.size)}) — safe to clear`,
        safe: true,
        command: `rm -rf "${currentPath}"`,
      });
    }

    // dist/build output
    if ((node.name === 'dist' || node.name === 'build' || node.name === '.next') && node.size > 0) {
      suggestions.push({
        path: currentPath,
        size: node.size,
        reason: `build output (${formatSize(node.size)}) — regenerate with build command`,
        safe: true,
        command: `rm -rf "${currentPath}"`,
      });
    }

    // Large log files
    if (node.name.endsWith('.log') && node.size > 5 * 1024 * 1024) {
      suggestions.push({
        path: currentPath,
        size: node.size,
        reason: `large log file (${formatSize(node.size)}) — consider truncating`,
        safe: true,
        command: `truncate -s 0 "${currentPath}"`,
      });
    }

    // .terraform providers
    if (node.name === '.terraform' && node.size > 0) {
      suggestions.push({
        path: currentPath,
        size: node.size,
        reason: `Terraform providers (${formatSize(node.size)}) — reinit with terraform init`,
        safe: true,
        command: `rm -rf "${currentPath}"`,
      });
    }

    // Large coverage/snapshot directories
    if ((node.name === 'coverage' || node.name === '__snapshots__') && node.size > 1024 * 1024) {
      suggestions.push({
        path: currentPath,
        size: node.size,
        reason: `test artifacts (${formatSize(node.size)}) — regenerate with test run`,
        safe: true,
        command: `rm -rf "${currentPath}"`,
      });
    }

    if (node.children) {
      for (const child of node.children) {
        walk(child, path.join(currentPath, child.name));
      }
    }
  }

  walk(result, dirPath);

  // Sort by potential savings
  suggestions.sort((a, b) => b.size - a.size);

  // Add total potential savings
  if (suggestions.length > 0) {
    const total = suggestions.reduce((sum, s) => sum + s.size, 0);
    suggestions.unshift({ totalSavings: total });
  }

  return suggestions;
}

function formatSuggestions(suggestions) {
  if (suggestions.length <= 1) return 'No cleanup suggestions found.';

  const lines = [];
  const header = suggestions.shift();
  lines.push(`  Potential savings: ${formatSize(header.totalSavings)}`);
  lines.push('');

  for (const s of suggestions.slice(0, 15)) {
    const sizeStr = formatSize(s.size).padStart(10);
    lines.push(`  ${sizeStr}  ${s.path}`);
    lines.push(`           ${s.reason}`);
    if (s.command) lines.push(`           → ${s.command}`);
    lines.push('');
  }

  if (suggestions.length > 15) {
    lines.push(`  ... and ${suggestions.length - 15} more`);
  }

  return lines.join('\n');
}

// ── Top files ──

function findTopFiles(dirPath, options = {}) {
  const { ignorePatterns = DEFAULT_IGNORE, limit = 20 } = options;
  const files = [];

  function walk(currentPath) {
    let entries;
    try {
      entries = fs.readdirSync(currentPath, { withFileTypes: true });
    } catch (e) { return; }

    for (const entry of entries) {
      if (shouldIgnore(entry.name, ignorePatterns)) continue;
      const fullPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        try {
          const stat = fs.statSync(fullPath);
          files.push({
            path: fullPath,
            size: stat.size,
            type: getFileType(fullPath),
            modified: stat.mtime,
          });
        } catch (e) { /* skip */ }
      }
    }
  }

  walk(dirPath);
  files.sort((a, b) => b.size - a.size);
  return files.slice(0, limit);
}

function formatTopFiles(files, rootPath) {
  if (!files.length) return 'No files found.';

  const lines = [];
  const maxPathLen = Math.min(
    Math.max(...files.map(f => f.path.replace(rootPath, '.').length)),
    60
  );

  for (const f of files) {
    const rel = f.path.replace(rootPath, '.');
    const display = rel.length > 57 ? '...' + rel.slice(-54) : rel;
    const sizeStr = formatSize(f.size).padStart(10);
    const typeStr = f.type.padEnd(14);
    const age = Date.now() - f.modified.getTime();
    const ageStr = age < 86400000 ? 'today' :
                   age < 86400000 * 7 ? `${Math.floor(age / 86400000)}d ago` :
                   age < 86400000 * 30 ? `${Math.floor(age / 86400000 / 7)}w ago` :
                   `${Math.floor(age / 86400000 / 30)}mo ago`;
    lines.push(`  ${sizeStr}  ${typeStr} ${display.padEnd(60)} ${ageStr}`);
  }

  return lines.join('\n');
}

// ── JSON output ──

function toJSON(result, options = {}) {
  const { includeChildren = true, rootPath } = options;

  function serialize(node) {
    const obj = {
      name: node.name,
      size: node.size,
      sizeHuman: formatSize(node.size),
      fileCount: node.fileCount,
      dirCount: node.dirCount,
    };
    if (node.types && Object.keys(node.types).length > 0) {
      obj.types = {};
      for (const [cat, data] of Object.entries(node.types)) {
        obj.types[cat] = { size: data.size, count: data.count, label: data.label };
      }
    }
    if (includeChildren && node.children?.length) {
      obj.children = node.children.map(serialize);
    }
    return obj;
  }

  return JSON.stringify(serialize(result), null, 2);
}

// ── Markdown output ──

function toMarkdown(result, options = {}) {
  const lines = [];
  lines.push(`# Directory Size Report: \`${result.name}\``);
  lines.push('');
  lines.push(`- **Total size:** ${formatSize(result.size)}`);
  lines.push(`- **Files:** ${result.fileCount}`);
  lines.push(`- **Directories:** ${result.dirCount}`);
  lines.push('');

  // Type breakdown
  if (Object.keys(result.types).length > 0) {
    lines.push('## File Type Breakdown');
    lines.push('');
    lines.push('| Type | Size | Files | % |');
    lines.push('|------|------|-------|---|');
    for (const [cat, data] of Object.entries(result.types).sort((a, b) => b[1].size - a[1].size)) {
      const pct = result.size > 0 ? ((data.size / result.size) * 100).toFixed(1) : '0.0';
      lines.push(`| ${data.label || cat} | ${formatSize(data.size)} | ${data.count} | ${pct}% |`);
    }
    lines.push('');
  }

  // Top dirs
  lines.push('## Largest Directories');
  lines.push('');
  lines.push('| Directory | Size | Files |');
  lines.push('|-----------|------|-------|');
  for (const child of result.children.slice(0, 20)) {
    lines.push(`| \`${child.name}\` | ${formatSize(child.size)} | ${child.fileCount} |`);
  }
  lines.push('');

  // Suggestions
  const suggestions = getSuggestions(result, options.rootPath);
  if (suggestions.length > 1) {
    lines.push('## Cleanup Suggestions');
    lines.push('');
    const header = suggestions.shift();
    lines.push(`**Potential savings: ${formatSize(header.totalSavings)}**`);
    lines.push('');
    for (const s of suggestions.slice(0, 10)) {
      lines.push(`- \`${s.path}\` — ${s.reason} (${formatSize(s.size)})`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

module.exports = {
  formatSize,
  parseSize,
  getFileType,
  getFileCategory,
  scanDir,
  formatTree,
  formatTypeBreakdown,
  getSuggestions,
  formatSuggestions,
  findTopFiles,
  formatTopFiles,
  toJSON,
  toMarkdown,
  buildBar,
  DEFAULT_IGNORE,
  CATEGORY_LABELS,
};
