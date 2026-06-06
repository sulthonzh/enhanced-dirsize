#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const EnhancedDirSize = require('../enhanced.js');

const args = process.argv.slice(2);

function showHelp() {
  console.log(`
Enhanced dirsize v2.0 — Enterprise-grade directory size analyzer

Usage:
  enhanced-dirsize [path] [options]

Commands:
  enhanced-dirsize [path]                    Enhanced directory analysis (default)
  enhanced-dirsize report [path]            Generate comprehensive analysis report
  enhanced-dirsize ci [path]                CI/CD integration report
  enhanced-dirsize history [path]           Show historical data trends
  enhanced-dirsize predict [path]          Predict future disk usage
  enhanced-dirsize cloud [path]             Export to cloud storage
  enhanced-dirsize team [path]              Team collaboration mode
  enhanced-dirsize compliance [path]        Enterprise compliance check
  enhanced-dirsize monitor [path]           Real-time monitoring mode

Enterprise Options:
  --ci-mode                Enable CI/CD integration mode
  --team-mode              Enable team collaboration features
  --cloud-config <file>    Cloud configuration file path
  --data-dir <dir>         Custom data directory for tracking
  --threshold <type:size>   Set thresholds (e.g., "files:10GB,disk:80%")
  --enable-predictive      Enable usage prediction algorithms
  --enable-compliance      Enable enterprise compliance checks
  --auto-export            Auto-export results to cloud
  --webhook <url>          Webhook URL for notifications

Standard Options:
  -d, --depth <n>          Max depth (default: 5)
  --min-size <size>        Min size to show (e.g. 10MB)
  --ignore <patterns>      Additional ignore patterns (comma-separated)
  --no-ignore             Don't ignore any directories
  -j, --json              JSON output for scripting
  --md                    Markdown output
  --html                  HTML report
  -n, --limit <n>         Limit results (default: 20)
  --bar-width <n>         Bar chart width (default: 20)
  --include-hidden        Include hidden files and directories
  --no-compression       Don't analyze compressed files
  -h, --help              Show this help
  -v, --version           Show version

Examples:
  enhanced-dirsize .                    Basic enhanced analysis
  enhanced-dirsize ~/projects            Analyze home projects
  enhanced-dirsize ci . --json          CI/CD compliance report
  enhanced-dirsize predict .             Future usage prediction
  enhanced-dirsize report . --html      HTML report with charts
  enhanced-dirsize team . --webhook https://hooks.slack.com/... Team collaboration

Integration Examples:
  # In CI/CD pipeline
  enhanced-dirsize ci . --threshold "files:5GB,unused:30%" --ci-mode
  
  # Enterprise compliance
  enhanced-dirsize compliance . --enable-compliance
  
  # Cloud integration
  enhanced-dirsize cloud . --auto-export --cloud-config ./cloud.json
  
  # Monitoring mode
  enhanced-dirsize monitor . --interval 60 --webhook https://monitoring.company.com

Webhook Integration:
The tool supports webhooks for real-time notifications. Set --webhook to send 
notifications for issues, predictions, or compliance events.

Cloud Integration:
Export data to various cloud storage providers (AWS S3, Azure Blob, Google Cloud)
for enterprise analytics and long-term storage.

Team Collaboration:
Share analysis results with team members, track changes over time, and collaborate
on cleanup decisions.
`);
}

function parseArgs(argv) {
  const opts = {
    command: 'analyze',
    target: '.',
    depth: 5,
    minSize: 0,
    ignorePatterns: [],
    json: false,
    markdown: false,
    html: false,
    limit: 20,
    barWidth: 20,
    enableCloud: false,
    cloudConfig: null,
    dataDir: null,
    ciMode: false,
    teamMode: false,
    enablePredictive: false,
    enableCompliance: false,
    autoExport: false,
    webhook: null,
    thresholds: {},
    includeHidden: false,
    noCompression: false,
    interval: null,
    maxDepth: Infinity
  };

  let i = 0;
  const commands = ['report', 'ci', 'history', 'predict', 'cloud', 'team', 'compliance', 'monitor'];

  while (i < argv.length) {
    const arg = argv[i];

    if (arg === '-h' || arg === '--help') {
      showHelp();
      process.exit(0);
    } else if (arg === '-v' || arg === '--version') {
      const pkg = require('../package.json');
      console.log(`enhanced-dirsize v${pkg.version}`);
      process.exit(0);
    } else if (arg === '-j' || arg === '--json') {
      opts.json = true;
    } else if (arg === '--md') {
      opts.markdown = true;
    } else if (arg === '--html') {
      opts.html = true;
    } else if ((arg === '-d' || arg === '--depth') && argv[i + 1]) {
      opts.depth = parseInt(argv[++i], 10);
    } else if (arg === '--max-depth' && argv[i + 1]) {
      opts.maxDepth = parseInt(argv[++i], 10);
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
    } else if (arg === '--ci-mode') {
      opts.ciMode = true;
    } else if (arg === '--team-mode') {
      opts.teamMode = true;
    } else if (arg === '--enable-predictive') {
      opts.enablePredictive = true;
    } else if (arg === '--enable-compliance') {
      opts.enableCompliance = true;
    } else if (arg === '--auto-export') {
      opts.autoExport = true;
    } else if (arg === '--webhook' && argv[i + 1]) {
      opts.webhook = argv[++i];
    } else if (arg === '--cloud-config' && argv[i + 1]) {
      opts.cloudConfig = argv[++i];
    } else if (arg === '--data-dir' && argv[i + 1]) {
      opts.dataDir = argv[++i];
    } else if (arg === '--threshold' && argv[i + 1]) {
      const threshold = argv[++i];
      const [type, value] = threshold.split(':');
      if (type && value) {
        opts.thresholds[type] = parseSize(value);
      }
    } else if (arg === '--interval' && argv[i + 1]) {
      opts.interval = parseInt(argv[++i], 10);
    } else if (arg === '--include-hidden') {
      opts.includeHidden = true;
    } else if (arg === '--no-compression') {
      opts.noCompression = true;
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

function parseSize(str) {
  const match = str.match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB|TB)$/i);
  if (!match) return -1;
  const [, num, unit] = match;
  const exp = ['B', 'KB', 'MB', 'GB', 'TB'].indexOf(unit.toUpperCase());
  return Math.round(Number(num) * Math.pow(1024, exp));
}

async function main() {
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

  // Initialize enhanced dirsize
  const dirsize = new EnhancedDirSize({
    ciMode: opts.ciMode,
    teamMode: opts.teamMode,
    enableCloud: opts.enableCloud,
    cloudConfig: opts.cloudConfig ? require(opts.cloudConfig) : null,
    dataDir: opts.dataDir,
    enablePredictive: opts.enablePredictive,
    enableCompliance: opts.enableCompliance,
  });

  try {
    switch (opts.command) {
      case 'analyze':
        await runAnalysis(dirsize, target, opts);
        break;
      
      case 'report':
        await runReport(dirsize, target, opts);
        break;
      
      case 'ci':
        await runCICD(dirsize, target, opts);
        break;
      
      case 'history':
        await runHistory(dirsize, target, opts);
        break;
      
      case 'predict':
        await runPrediction(dirsize, target, opts);
        break;
      
      case 'cloud':
        await runCloudExport(dirsize, target, opts);
        break;
      
      case 'team':
        await runTeamMode(dirsize, target, opts);
        break;
      
      case 'compliance':
        await runCompliance(dirsize, target, opts);
        break;
      
      case 'monitor':
        await runMonitor(dirsize, target, opts);
        break;
      
      default:
        await runAnalysis(dirsize, target, opts);
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    if (opts.json) {
      console.log(JSON.stringify({ error: error.message }, null, 2));
    }
    process.exit(1);
  }
}

async function runAnalysis(dirsize, target, opts) {
  console.log(`🔍 Enhanced directory analysis for: ${target}`);
  
  const scanOpts = {
    maxDepth: opts.maxDepth,
    ignorePatterns: opts.ignorePatterns,
    minSize: opts.minSize,
  };
  
  const { result, metrics } = await dirsize.scan(target, scanOpts);
  
  if (opts.json) {
    console.log(JSON.stringify({ result, metrics }, null, 2));
  } else if (opts.markdown) {
    console.log(formatMarkdownReport(result, metrics));
  } else if (opts.html) {
    console.log(formatHTMLReport(result, metrics));
  } else {
    console.log(`\n  📊 Enhanced Analysis Results\n`);
    console.log(`  Directory: ${target}`);
    console.log(`  Size: ${dirsize.formatSize(result.size)} (${result.fileCount} files, ${result.dirCount} dirs)`);
    console.log(`  Recommendation Score: ${metrics.recommendationScore}/100`);
    console.log(`  Compliance Score: ${metrics.complianceScore}/100`);
    console.log(`\n  System Metrics:`);
    console.log(`    CPU Usage: ${metrics.systemMetrics.cpuUsage}%`);
    console.log(`    Memory Usage: ${metrics.systemMetrics.memoryUsage}%`);
    console.log(`    Disk Usage: ${metrics.systemMetrics.diskUsage?.usagePercent || 'N/A'}%`);
    console.log(`\n  Top Issues:`);
    
    const issues = identifyIssues(result);
    issues.slice(0, 5).forEach(issue => {
      const icon = getIssueIcon(issue.type);
      console.log(`    ${icon} ${issue.message}`);
    });
    
    console.log(`\n  ${'─'.repeat(50)}`);
    console.log(`  Analysis completed in ${metrics.scanTime}ms`);
    console.log('');
  }
}

async function runReport(dirsize, target, opts) {
  console.log(`📋 Generating comprehensive report for: ${target}`);
  
  const { result, metrics, predictions } = await dirsize.scan(target, {
    maxDepth: opts.maxDepth,
    ignorePatterns: opts.ignorePatterns,
    minSize: opts.minSize,
  });
  
  const report = {
    metadata: {
      timestamp: new Date().toISOString(),
      target,
      scanTime: metrics.scanTime,
      recommendationScore: metrics.recommendationScore,
      complianceScore: metrics.complianceScore
    },
    summary: {
      size: result.size,
      files: result.fileCount,
      directories: result.dirCount,
      types: result.types
    },
    issues: identifyIssues(result),
    recommendations: dirsize.generateRecommendations(result, predictions),
    systemMetrics: metrics.systemMetrics,
    predictions,
    history: await dirsize.db.get('history', {})[target] || []
  };
  
  if (opts.json) {
    console.log(JSON.stringify(report, null, 2));
  } else if (opts.markdown) {
    console.log(formatComprehensiveMarkdown(report));
  } else if (opts.html) {
    console.log(formatComprehensiveHTML(report));
  } else {
    console.log(formatComprehensiveText(report));
  }
}

async function runCICD(dirsize, target, opts) {
  console.log(`⚙️  CI/CD integration analysis for: ${target}`);
  
  const report = await dirsize.generateCICDReport(target, {
    maxDepth: opts.maxDepth,
    ignorePatterns: opts.ignorePatterns,
    minSize: opts.minSize,
    thresholds: opts.thresholds
  });
  
  if (opts.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`CI Status: ${report.ci.status.toUpperCase()}`);
    console.log(`Total Size: ${dirsize.formatSize(report.summary.totalSize)}`);
    console.log(`Recommendation Score: ${report.summary.recommendationScore}/100`);
    console.log(`Compliance Score: ${report.summary.complianceScore}/100`);
    
    if (report.topIssues.length > 0) {
      console.log(`\nIssues:`);
      report.topIssues.forEach(issue => {
        console.log(`  ${getSeverityIcon(issue.severity)} ${issue.message}`);
      });
    }
    
    if (report.recommendations.length > 0) {
      console.log(`\nRecommendations:`);
      report.recommendations.forEach(rec => {
        console.log(`  ${getPriorityIcon(rec.priority)} ${rec.title}`);
      });
    }
    
    // Send webhook if configured
    if (opts.webhook) {
      await sendWebhook(opts.webhook, report);
    }
  }
}

async function runHistory(dirsize, target, opts) {
  const history = await dirsize.db.get('history', {})[target] || [];
  
  if (history.length === 0) {
    console.log(`No historical data available for ${target}`);
    return;
  }
  
  if (opts.json) {
    console.log(JSON.stringify(history, null, 2));
  } else {
    console.log(`📈 Historical data for: ${target}`);
    console.log(`\n  ${'─'.repeat(60)}`);
    console.log(`  Date/Time                Size           Files  Recommendations`);
    console.log(`  ${'─'.repeat(60)}`);
    
    history.slice(-10).forEach(record => {
      const date = new Date(record.timestamp).toLocaleString();
      const size = dirsize.formatSize(record.result.size);
      const files = record.result.fileCount;
      const score = record.metrics.recommendationScore;
      const status = score >= 80 ? '✓' : score >= 60 ? '~' : '✗';
      
      console.log(`  ${date.slice(0, 19).padEnd(19)} ${size.padEnd(12)} ${files.toString().padEnd(6)} ${status} (${score}%)`);
    });
    
    console.log(`\n  Total historical scans: ${history.length}`);
    console.log('');
  }
}

async function runPrediction(dirsize, target, opts) {
  const { result, metrics, predictions } = await dirsize.scan(target, {
    maxDepth: opts.maxDepth,
    ignorePatterns: opts.ignorePatterns,
    minSize: opts.minSize,
  });
  
  console.log(`🔮 Usage prediction for: ${target}`);
  console.log(`\n  Current size: ${dirsize.formatSize(result.size)}`);
  console.log(`  Projected size: ${dirsize.formatSize(predictions.projectedSize)}`);
  console.log(`  Growth trend: ${predictions.trend}`);
  console.log(`  Confidence: ${predictions.confidence}%`);
  
  if (predictions.recommendations.length > 0) {
    console.log(`\n  Recommendations:`);
    predictions.recommendations.forEach(rec => {
      const icon = rec.type === 'warning' ? '⚠️' : 'ℹ️';
      console.log(`    ${icon} ${rec.message}`);
      console.log(`       Action: ${rec.action}`);
    });
  }
  
  if (opts.json) {
    console.log(JSON.stringify({ result, metrics, predictions }, null, 2));
  }
}

async function runCloudExport(dirsize, target, opts) {
  const { result, metrics } = await dirsize.scan(target, {
    maxDepth: opts.maxDepth,
    ignorePatterns: opts.ignorePatterns,
    minSize: opts.minSize,
  });
  
  const exportData = {
    timestamp: new Date().toISOString(),
    target,
    result,
    metrics,
    metadata: {
      source: 'enhanced-dirsize',
      version: require('../package.json').version
    }
  };
  
  try {
    if (opts.cloudConfig) {
      const cloudResult = await dirsize.exportToCloud(exportData, {
        destination: `dirsize-report-${Date.now()}.json`
      });
      console.log(`✅ Successfully exported to cloud: ${cloudResult.path}`);
    } else {
      console.log('Cloud export requires --cloud-config option');
    }
  } catch (error) {
    console.error(`Cloud export failed: ${error.message}`);
  }
}

async function runTeamMode(dirsize, target, opts) {
  console.log(`👥 Team collaboration mode for: ${target}`);
  
  const { result, metrics } = await dirsize.scan(target, {
    maxDepth: opts.maxDepth,
    ignorePatterns: opts.ignorePatterns,
    minSize: opts.minSize,
  });
  
  const teamReport = {
    analysis: { result, metrics },
    recommendations: dirsize.generateRecommendations(result, {}),
    teamActions: generateTeamActions(result),
    notifications: []
  };
  
  if (opts.webhook) {
    await sendWebhook(opts.webhook, {
      type: 'team_analysis',
      target,
      teamReport
    });
    console.log(`📢 Team analysis sent to webhook`);
  }
  
  console.log(`Team collaboration analysis completed`);
  console.log(`Recommendations: ${teamReport.recommendations.length}`);
  console.log(`Team actions: ${teamReport.teamActions.length}`);
}

async function runCompliance(dirsize, target, opts) {
  console.log(`📋 Enterprise compliance check for: ${target}`);
  
  const { result, metrics } = await dirsize.scan(target, {
    maxDepth: opts.maxDepth,
    ignorePatterns: opts.ignorePatterns,
    minSize: opts.minSize,
  });
  
  const compliance = {
    overallScore: metrics.complianceScore,
    checks: performComplianceChecks(result, metrics),
    violations: identifyComplianceViolations(result),
    recommendations: getComplianceRecommendations(result)
  };
  
  console.log(`Compliance Score: ${compliance.overallScore}/100`);
  
  if (compliance.violations.length > 0) {
    console.log(`\nViolations:`);
    compliance.violations.forEach(v => {
      console.log(`  ${getComplianceIcon(v.severity)} ${v.description}`);
    });
  }
  
  if (compliance.recommendations.length > 0) {
    console.log(`\nRecommendations:`);
    compliance.recommendations.forEach(r => {
      console.log(`  ${getComplianceIcon(r.priority)} ${r.action}`);
    });
  }
  
  if (opts.json) {
    console.log(JSON.stringify(compliance, null, 2));
  }
}

async function runMonitor(dirsize, target, opts) {
  console.log(`👁️  Starting monitoring for: ${target}`);
  
  if (!opts.interval) {
    console.log('Monitoring mode requires --interval option');
    return;
  }
  
  console.log(`Monitoring every ${opts.interval} seconds...`);
  console.log(`Press Ctrl+C to stop`);
  
  const monitor = {
    startTime: Date.now(),
    scans: [],
    alerts: []
  };
  
  const monitorInterval = setInterval(async () => {
    try {
      const { result, metrics } = await dirsize.scan(target, {
        maxDepth: opts.maxDepth,
        ignorePatterns: opts.ignorePatterns,
        minSize: opts.minSize,
      });
      
      const scan = {
        timestamp: new Date().toISOString(),
        size: result.size,
        files: result.fileCount,
        recommendationScore: metrics.recommendationScore,
        systemMetrics: metrics.systemMetrics
      };
      
      monitor.scans.push(scan);
      
      // Check for alerts
      const alerts = checkForAlerts(scan, opts.thresholds);
      alerts.forEach(alert => {
        console.log(`🚨 Alert: ${alert.message}`);
        monitor.alerts.push(alert);
        
        if (opts.webhook) {
          sendWebhook(opts.webhook, {
            type: 'monitor_alert',
            target,
            scan,
            alert
          });
        }
      });
      
      if (monitor.scans.length === 1) {
        console.log(`  Initial scan: ${dirsize.formatSize(result.size)} (${result.fileCount} files)`);
      }
      
    } catch (error) {
      console.error(`Monitor error: ${error.message}`);
    }
  }, opts.interval * 1000);
  
  // Handle shutdown
  process.on('SIGINT', () => {
    clearInterval(monitorInterval);
    console.log(`\n📊 Monitoring completed after ${monitor.scans.length} scans`);
    console.log(`Total alerts: ${monitor.alerts.length}`);
    process.exit(0);
  });
}

// Utility functions
function identifyIssues(result) {
  const issues = [];
  
  // Large directories
  const largeDirs = result.children.filter(c => c.size > 1024 * 1024 * 1024); // 1GB
  if (largeDirs.length > 0) {
    issues.push({
      type: 'large_directories',
      message: `${largeDirs.length} directories larger than 1GB`,
      severity: 'warning'
    });
  }
  
  // Potential cleanup
  const cleanupCandidates = result.children.filter(c => 
    c.name.includes('temp') || c.name.includes('cache') || c.name.includes('old')
  );
  if (cleanupCandidates.length > 0) {
    const totalCleanup = cleanupCandidates.reduce((sum, c) => sum + c.size, 0);
    issues.push({
      type: 'cleanup_candidates',
      message: `${cleanupCandidates.length} directories may be eligible for cleanup (${dirsize.formatSize(totalCleanup)})`,
      severity: 'info'
    });
  }
  
  return issues;
}

function getIssueIcon(type) {
  const icons = {
    large_directories: '⚠️',
    cleanup_candidates: '🧹',
    security: '🔒',
    performance: '⚡',
    compliance: '📋'
  };
  return icons[type] || '❓';
}

function getSeverityIcon(severity) {
  const icons = {
    critical: '🔴',
    error: '🟠',
    warning: '🟡',
    info: '🔵'
  };
  return icons[severity] || '⚪';
}

function getPriorityIcon(priority) {
  const icons = {
    high: '🔴',
    medium: '🟡',
    low: '🔵'
  };
  return icons[priority] || '⚪';
}

function getComplianceIcon(severity) {
  const icons = {
    critical: '🚨',
    high: '🔴',
    medium: '🟡',
    low: '🔵'
  };
  return icons[severity] || '⚪';
}

async function sendWebhook(url, data) {
  const https = require('https');
  const http = require('http');
  
  const postData = JSON.stringify(data);
  
  const options = new URL(url);
  const protocol = options.protocol === 'https:' ? https : http;
  
  const req = protocol.request({
    hostname: options.hostname,
    port: options.port || (protocol === https ? 443 : 80),
    path: options.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  }, (res) => {
    if (res.statusCode === 200) {
      console.log(`✅ Webhook sent successfully`);
    } else {
      console.log(`⚠️ Webhook failed: ${res.statusCode}`);
    }
  });
  
  req.on('error', (error) => {
    console.log(`⚠️ Webhook error: ${error.message}`);
  });
  
  req.write(postData);
  req.end();
}

function generateTeamActions(result) {
  return [
    {
      action: 'review_cleanup_candidates',
      description: 'Review and approve cleanup of temporary directories',
      estimatedTime: '2-4 hours',
      assignedTeam: 'Development'
    },
    {
      action: 'implement_storage_policy',
      description: 'Implement storage management policies for large files',
      estimatedTime: '1-2 weeks',
      assignedTeam: 'DevOps'
    }
  ];
}

function performComplianceChecks(result, metrics) {
  return [
    {
      name: 'File Organization',
      passed: metrics.complianceScore > 70,
      score: metrics.complianceScore
    },
    {
      name: 'Documentation Coverage',
      passed: ((result.types.docs || {}).count || 0) / result.fileCount > 0.1,
      score: ((result.types.docs || {}).count || 0) / result.fileCount * 100
    },
    {
      name: 'Security Standards',
      passed: ((result.types.config || {}).count || 0) < 50,
      score: Math.min(100, 100 - ((result.types.config || {}).count || 0) * 2)
    }
  ];
}

function identifyComplianceViolations(result) {
  const violations = [];
  
  // Documentation requirement
  const docRatio = ((result.types.docs || {}).count || 0) / result.fileCount;
  if (docRatio < 0.1) {
    violations.push({
      type: 'documentation',
      severity: 'medium',
      description: 'Less than 10% of files are documentation',
      recommendation: 'Increase documentation coverage'
    });
  }
  
  return violations;
}

function getComplianceRecommendations(result) {
  return [
    {
      priority: 'high',
      action: 'Implement documentation standards',
      description: 'Require minimum documentation for all new features'
    },
    {
      priority: 'medium',
      action: 'Establish file naming conventions',
      description: 'Implement consistent naming standards across the project'
    }
  ];
}

function checkForAlerts(scan, thresholds) {
  const alerts = [];
  
  if (thresholds.maxFileSize && scan.size > thresholds.maxFileSize) {
    alerts.push({
      type: 'size_threshold',
      message: `Directory size exceeds maximum threshold: ${dirsize.formatSize(scan.size)} > ${dirsize.formatSize(thresholds.maxFileSize)}`,
      severity: 'critical'
    });
  }
  
  if (scan.recommendationScore < 50) {
    alerts.push({
      type: 'recommendation_score',
      message: `Low recommendation score: ${scan.recommendationScore}/100`,
      severity: 'warning'
    });
  }
  
  return alerts;
}

// Report formatting functions
function formatMarkdownReport(result, metrics) {
  return `# Enhanced Directory Size Report
  
## Summary
- Size: ${dirsize.formatSize(result.size)}
- Files: ${result.fileCount}
- Directories: ${result.dirCount}
- Recommendation Score: ${metrics.recommendationScore}/100
- Compliance Score: ${metrics.complianceScore}/100

## System Metrics
- CPU Usage: ${metrics.systemMetrics.cpuUsage}%
- Memory Usage: ${metrics.systemMetrics.memoryUsage}%
- Disk Usage: ${metrics.systemMetrics.diskUsage?.usagePercent || 'N/A'}%

## Issues
${identifyIssues(result).map(issue => `- ${getIssueIcon(issue.type)} ${issue.message}`).join('\n')}

## File Types
${Object.entries(result.types).map(([type, data]) => 
  `- ${data.label}: ${dirsize.formatSize(data.size)} (${data.count} files)`
).join('\n')}
`;
}

function formatHTMLReport(result, metrics) {
  return `<!DOCTYPE html>
<html>
<head>
    <title>Directory Size Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .summary { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .metric { display: inline-block; margin: 10px; }
        .issues { margin-top: 20px; }
        .issue { background: #fff3cd; padding: 10px; margin: 5px 0; border-radius: 3px; }
    </style>
</head>
<body>
    <h1>Directory Size Report</h1>
    <div class="summary">
        <div class="metric"><strong>Size:</strong> ${dirsize.formatSize(result.size)}</div>
        <div class="metric"><strong>Files:</strong> ${result.fileCount}</div>
        <div class="metric"><strong>Recommendation:</strong> ${metrics.recommendationScore}/100</div>
        <div class="metric"><strong>Compliance:</strong> ${metrics.complianceScore}/100</div>
    </div>
    
    <div class="issues">
        <h2>Issues</h2>
        ${identifyIssues(result).map(issue => 
          `<div class="issue">${getIssueIcon(issue.type)} ${issue.message}</div>`
        ).join('')}
    </div>
</body>
</html>`;
}

// Text report formatting
function formatComprehensiveText(report) {
  const lines = [];
  lines.push(`📊 Enhanced Directory Size Report`);
  lines.push(``.padEnd(50, '─'));
  
  // Summary
  lines.push(`Summary:`);
  lines.push(`  Target: ${report.metadata.target}`);
  lines.push(`  Size: ${dirsize.formatSize(report.summary.size)}`);
  lines.push(`  Files: ${report.summary.files}`);
  lines.push(`  Directories: ${report.summary.directories}`);
  lines.push(`  Recommendation Score: ${report.metadata.recommendationScore}/100`);
  lines.push(`  Compliance Score: ${report.metadata.complianceScore}/100`);
  lines.push(``);
  
  // System metrics
  lines.push(`System Metrics:`);
  lines.push(`  CPU Usage: ${report.systemMetrics.cpuUsage}%`);
  lines.push(`  Memory Usage: ${report.systemMetrics.memoryUsage}%`);
  lines.push(`  Disk Usage: ${report.systemMetrics.diskUsage?.usagePercent || 'N/A'}%`);
  lines.push(``);
  
  // Issues
  if (report.issues.length > 0) {
    lines.push(`Issues:`);
    report.issues.forEach(issue => {
      lines.push(`  ${getIssueIcon(issue.type)} ${issue.message}`);
    });
    lines.push(``);
  }
  
  // Recommendations
  if (report.recommendations.length > 0) {
    lines.push(`Recommendations:`);
    report.recommendations.forEach(rec => {
      lines.push(`  ${getPriorityIcon(rec.priority)} ${rec.title}`);
      lines.push(`     ${rec.description}`);
    });
    lines.push(``);
  }
  
  return lines.join('\n');
}

function formatComprehensiveMarkdown(report) {
  let md = `# Enhanced Directory Size Report\n\n`;
  md += `Generated: ${new Date(report.metadata.timestamp).toISOString()}\n\n`;
  
  md += `## Summary\n\n`;
  md += `- **Target:** ${report.metadata.target}\n`;
  md += `- **Size:** ${dirsize.formatSize(report.summary.size)}\n`;
  md += `- **Files:** ${report.summary.files}\n`;
  md += `- **Directories:** ${report.summary.directories}\n`;
  md += `- **Recommendation Score:** ${report.metadata.recommendationScore}/100\n`;
  md += `- **Compliance Score:** ${report.metadata.complianceScore}/100\n\n`;
  
  md += `## System Metrics\n\n`;
  md += `- **CPU Usage:** ${report.systemMetrics.cpuUsage}%\n`;
  md += `- **Memory Usage:** ${report.systemMetrics.memoryUsage}%\n`;
  md += `- **Disk Usage:** ${report.systemMetrics.diskUsage?.usagePercent || 'N/A'}%\n\n`;
  
  if (report.issues.length > 0) {
    md += `## Issues\n\n`;
    report.issues.forEach(issue => {
      md += `- ${getIssueIcon(issue.type)} ${issue.message}\n`;
    });
    md += `\n`;
  }
  
  if (report.recommendations.length > 0) {
    md += `## Recommendations\n\n`;
    report.recommendations.forEach(rec => {
      md += `- ${getPriorityIcon(rec.priority)} **${rec.title}**\n`;
      md += `  - ${rec.description}\n`;
      md += `  - Estimated savings: ${dirsize.formatSize(rec.estimatedSavings)}\n`;
    });
    md += `\n`;
  }
  
  return md;
}

function formatComprehensiveHTML(report) {
  return `<!DOCTYPE html>
<html>
<head>
    <title>Enhanced Directory Size Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f8f9fa; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #2c3e50; margin-bottom: 30px; }
        .summary { background: #f8f9fa; padding: 20px; border-radius: 6px; margin-bottom: 30px; }
        .metric { display: inline-block; margin-right: 30px; margin-bottom: 10px; }
        .metric-label { font-weight: bold; color: #6c757d; }
        .metric-value { font-size: 1.2em; color: #2c3e50; }
        .issues { margin-bottom: 30px; }
        .issue { background: #fff3cd; padding: 15px; margin: 10px 0; border-radius: 6px; border-left: 4px solid #ffc107; }
        .recommendations { margin-bottom: 30px; }
        .recommendation { background: #d1ecf1; padding: 15px; margin: 10px 0; border-radius: 6px; border-left: 4px solid #17a2b8; }
        .priority-high { border-left-color: #dc3545; }
        .priority-medium { border-left-color: #ffc107; }
        .priority-low { border-left-color: #17a2b8; }
        .timestamp { text-align: right; color: #6c757d; font-size: 0.9em; }
    </style>
</head>
<body>
    <div class="container">
        <h1>📊 Enhanced Directory Size Report</h1>
        
        <div class="timestamp">Generated: ${new Date(report.metadata.timestamp).toISOString()}</div>
        
        <div class="summary">
            <div class="metric">
                <div class="metric-label">Target</div>
                <div class="metric-value">${report.metadata.target}</div>
            </div>
            <div class="metric">
                <div class="metric-label">Size</div>
                <div class="metric-value">${dirsize.formatSize(report.summary.size)}</div>
            </div>
            <div class="metric">
                <div class="metric-label">Files</div>
                <div class="metric-value">${report.summary.files}</div>
            </div>
            <div class="metric">
                <div class="metric-label">Recommendation Score</div>
                <div class="metric-value">${report.metadata.recommendationScore}/100</div>
            </div>
            <div class="metric">
                <div class="metric-label">Compliance Score</div>
                <div class="metric-value">${report.metadata.complianceScore}/100</div>
            </div>
        </div>
        
        ${report.systemMetrics ? `
        <div class="metrics">
            <h2>System Metrics</h2>
            <div class="metric">
                <div class="metric-label">CPU Usage</div>
                <div class="metric-value">${report.systemMetrics.cpuUsage}%</div>
            </div>
            <div class="metric">
                <div class="metric-label">Memory Usage</div>
                <div class="metric-value">${report.systemMetrics.memoryUsage}%</div>
            </div>
            <div class="metric">
                <div class="metric-label">Disk Usage</div>
                <div class="metric-value">${report.systemMetrics.diskUsage?.usagePercent || 'N/A'}%</div>
            </div>
        </div>
        ` : ''}
        
        ${report.issues.length > 0 ? `
        <div class="issues">
            <h2>Issues</h2>
            ${report.issues.map(issue => 
              `<div class="issue">${getIssueIcon(issue.type)} ${issue.message}</div>`
            ).join('')}
        </div>
        ` : ''}
        
        ${report.recommendations.length > 0 ? `
        <div class="recommendations">
            <h2>Recommendations</h2>
            ${report.recommendations.map(rec => 
              `<div class="recommendation priority-${rec.priority}">
                <strong>${getPriorityIcon(rec.priority)} ${rec.title}</strong><br>
                ${rec.description}<br>
                <em>Estimated savings: ${dirsize.formatSize(rec.estimatedSavings)}</em>
              </div>`
            ).join('')}
        </div>
        ` : ''}
        
        <div style="text-align: center; margin-top: 30px; color: #6c757d; font-size: 0.9em;">
            Generated with enhanced-dirsize v2.0
        </div>
    </div>
</body>
</html>`;
}

main();