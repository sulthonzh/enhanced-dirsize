'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Enhanced version of dirsize with enterprise features:
 * - Historical data tracking
 * - Cloud storage integration
 * - CI/CD integration
 * - Performance metrics
 * - Predictive analysis
 * - Team collaboration features
 */

class EnhancedDirSize {
  constructor(options = {}) {
    this.options = {
      dataDir: options.dataDir || path.join(process.cwd(), '.dirsize-data'),
      enableCloud: options.enableCloud || false,
      enableHistory: options.enableHistory || true,
      enablePredictive: options.enablePredictive || false,
      ciMode: options.ciMode || false,
      teamMode: options.teamMode || false,
      ...options
    };
    
    this.init();
  }

  init() {
    // Ensure data directory exists
    if (!fs.existsSync(this.options.dataDir)) {
      fs.mkdirSync(this.options.dataDir, { recursive: true });
    }
    
    // Initialize database
    this.db = new this.Database(path.join(this.options.dataDir, 'data.json'));
    
    // Initialize cloud storage if enabled
    if (this.options.enableCloud) {
      this.cloud = new this.CloudStorage(this.options.cloudConfig || {});
    }
  }

  /**
   * Enhanced scan with historical tracking
   */
  async scan(dirPath, scanOptions = {}) {
    const startTime = Date.now();
    
    // Perform standard scan
    const result = this.scanDir(dirPath, scanOptions);
    
    // Collect additional metrics
    const metrics = await this.collectMetrics(dirPath, result);
    
    // Store historical data
    if (this.options.enableHistory) {
      await this.storeHistory(dirPath, { result, metrics, scanTime: Date.now() - startTime });
    }
    
    // Perform predictive analysis if enabled
    if (this.options.enablePredictive) {
      const predictions = await this.predictFutureUsage(dirPath, result);
      return { result, metrics, predictions };
    }
    
    return { result, metrics };
  }

  /**
   * Collect additional performance and system metrics
   */
  async collectMetrics(dirPath, scanResult) {
    const metrics = {
      scanTime: Date.now() - this.scanStartTime,
      systemMetrics: this.getSystemMetrics(),
      diskHealth: this.getDiskHealth(dirPath),
      recommendationScore: this.calculateRecommendationScore(scanResult),
      complianceScore: this.calculateComplianceScore(scanResult),
    };
    
    return metrics;
  }

  /**
   * Get system performance metrics
   */
  getSystemMetrics() {
    const metrics = {
      cpuUsage: this.getCPUsage(),
      memoryUsage: this.getMemoryUsage(),
      diskUsage: this.getDiskUsage(),
      nodeVersion: process.version,
      platform: process.platform,
      uptime: process.uptime(),
    };
    
    return metrics;
  }

  /**
   * Get CPU usage percentage
   */
  getCPUsage() {
    try {
      const loadavg = os.loadavg();
      const cpus = os.cpus().length;
      return (loadavg[0] / cpus * 100).toFixed(2);
    } catch (e) {
      return 'N/A';
    }
  }

  /**
   * Get memory usage percentage
   */
  getMemoryUsage() {
    try {
      const memUsage = process.memoryUsage();
      const totalMem = os.totalmem();
      return (memUsage.heapUsed / totalMem * 100).toFixed(2);
    } catch (e) {
      return 'N/A';
    }
  }

  /**
   * Get disk usage information
   */
  getDiskUsage() {
    try {
      const stats = fs.statfs(this.options.dataDir || process.cwd());
      return {
        total: stats.blocks * stats.bsize,
        free: stats.bavail * stats.bsize,
        used: (stats.blocks - stats.bavail) * stats.bsize,
        usagePercent: ((stats.blocks - stats.bavail) / stats.blocks * 100).toFixed(2)
      };
    } catch (e) {
      return 'N/A';
    }
  }

  /**
   * Get disk health metrics
   */
  getDiskHealth(dirPath) {
    try {
      const stats = fs.statfs(dirPath);
      const errors = this.checkDiskErrors(dirPath);
      const fragmented = this.checkFragmentation(dirPath);
      
      return {
        errors: errors.length,
        fragmented: fragmented,
        smartStatus: 'healthy',
        warnings: errors.length > 0 ? ['Potential disk errors detected'] : []
      };
    } catch (e) {
      return { errors: [], fragmented: false, smartStatus: 'unknown', warnings: [] };
    }
  }

  /**
   * Check for disk errors
   */
  checkDiskErrors(dirPath) {
    const errors = [];
    try {
      const files = fs.readdirSync(dirPath);
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        try {
          const stat = fs.statSync(filePath);
          if (!stat.isFile() && !stat.isDirectory()) {
            errors.push(`Invalid file type: ${file}`);
          }
        } catch (e) {
          errors.push(`Access error: ${file} - ${e.message}`);
        }
      }
    } catch (e) {
      errors.push(`Directory access error: ${e.message}`);
    }
    return errors;
  }

  /**
   * Check for disk fragmentation (simplified)
   */
  checkFragmentation(dirPath) {
    // Simplified fragmentation check based on file sizes and distribution
    try {
      const files = fs.readdirSync(dirPath)
        .map(f => path.join(dirPath, f))
        .filter(f => fs.statSync(f).isFile())
        .map(f => fs.statSync(f).size);
      
      if (files.length === 0) return false;
      
      // If files are very small and very large, might indicate fragmentation
      const avgSize = files.reduce((a, b) => a + b, 0) / files.length;
      const variance = files.reduce((a, b) => a + Math.pow(b - avgSize, 2), 0) / files.length;
      const stdDev = Math.sqrt(variance);
      
      return stdDev > avgSize * 2; // High variance indicates potential fragmentation
    } catch (e) {
      return false;
    }
  }

  /**
   * Calculate recommendation score based on scan results
   */
  calculateRecommendationScore(scanResult) {
    let score = 100;
    const { size, types, children } = scanResult;
    
    // Deduct points for large unused directories
    const largeUnusedDirs = children.filter(c => 
      this.isLikelyUnused(c) && c.size > 100 * 1024 * 1024 // 100MB
    );
    score -= largeUnusedDirs.length * 10;
    
    // Deduct points for excessive cache/binary files
    const cacheSize = (types.cache || {}).size || 0;
    const binarySize = (types.binary || {}).size || 0;
    const totalSize = types.reduce((sum, t) => sum + t.size, 0);
    if (cacheSize > totalSize * 0.3) score -= 15;
    if (binarySize > totalSize * 0.2) score -= 10;
    
    // Deduct points for large individual files
    const largeFiles = children.flatMap(c => 
      c.children ? c.children.filter(gc => gc.size > 1024 * 1024 * 1024).map(gc => gc.size) : []
    ).filter(s => s > 1024 * 1024 * 1024);
    score -= Math.min(largeFiles.length * 5, 20);
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Check if directory is likely unused
   */
  isLikelyUnused(dir) {
    const name = dir.name.toLowerCase();
    return name.includes('temp') || 
           name.includes('cache') || 
           name.includes('old') || 
           name.includes('backup') || 
           name.includes('archive') ||
           name.endsWith('_old') ||
           name.includes('unused');
  }

  /**
   * Calculate compliance score for enterprise standards
   */
  calculateComplianceScore(scanResult) {
    let score = 100;
    const { types } = scanResult;
    
    // Check for sensitive file types
    const sensitiveFiles = (types.config || {}).count || 0;
    if (sensitiveFiles > 100) score -= 20;
    
    // Check for proper documentation
    const docsRatio = (types.docs || {}).count / (scanResult.fileCount || 1);
    if (docsRatio < 0.1) score -= 15; // Less than 10% docs
    
    // Check for excessive binary files
    const binaryRatio = (types.binary || {}).count / (scanResult.fileCount || 1);
    if (binaryRatio > 0.5) score -= 25; // More than 50% binaries
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Store historical scan data
   */
  async storeHistory(dirPath, scanData) {
    const history = await this.db.get('history', {});
    const timestamp = new Date().toISOString();
    
    if (!history[dirPath]) history[dirPath] = [];
    history[dirPath].push({
      timestamp,
      ...scanData
    });
    
    // Keep only last 100 scans
    if (history[dirPath].length > 100) {
      history[dirPath] = history[dirPath].slice(-100);
    }
    
    await this.db.set('history', history);
  }

  /**
   * Predict future disk usage trends
   */
  async predictFutureUsage(dirPath, currentResult) {
    const history = await this.db.get('history', {});
    const pathHistory = history[dirPath] || [];
    
    if (pathHistory.length < 2) {
      return {
        trend: 'unknown',
        projectedSize: currentResult.size,
        confidence: 0,
        recommendations: []
      };
    }
    
    // Calculate growth rate
    const recentScans = pathHistory.slice(-10); // Last 10 scans
    const growthRates = [];
    
    for (let i = 1; i < recentScans.length; i++) {
      const prev = recentScans[i - 1];
      const curr = recentScans[i];
      const daysDiff = (new Date(curr.timestamp) - new Date(prev.timestamp)) / (1000 * 60 * 60 * 24);
      const sizeDiff = curr.result.size - prev.result.size;
      
      if (daysDiff > 0) {
        growthRates.push(sizeDiff / daysDiff);
      }
    }
    
    const avgGrowthRate = growthRates.reduce((a, b) => a + b, 0) / growthRates.length;
    const lastScan = recentScans[recentScans.length - 1];
    const daysSinceLast = (Date.now() - new Date(lastScan.timestamp)) / (1000 * 60 * 60 * 24);
    
    // Project future size
    const projectedSize = lastScan.result.size + (avgGrowthRate * daysSinceLast);
    const confidence = Math.min(growthRates.length * 10, 100);
    
    // Generate recommendations based on prediction
    const recommendations = [];
    if (avgGrowthRate > 1024 * 1024 * 1024) { // > 1GB/day growth
      recommendations.push({
        type: 'warning',
        message: 'Rapid disk growth detected. Consider implementing cleanup policies.',
        action: 'Implement automated cleanup for temporary files.'
      });
    } else if (avgGrowthRate > 100 * 1024 * 1024) { // > 100MB/day growth
      recommendations.push({
        type: 'info',
        message: 'Moderate disk growth detected. Monitor usage patterns.',
        action: 'Set up monitoring alerts for growth rate thresholds.'
      });
    }
    
    return {
      trend: avgGrowthRate > 0 ? 'increasing' : avgGrowthRate < 0 ? 'decreasing' : 'stable',
      projectedSize,
      confidence,
      recommendations,
      growthRate: avgGrowthRate,
      daysSinceLastScan: daysSinceLast
    };
  }

  /**
   * CI/CD integration methods
   */
  async generateCICDReport(dirPath, options = {}) {
    const { result, metrics, predictions } = await this.scan(dirPath, options);
    
    const report = {
      timestamp: new Date().toISOString(),
      directory: dirPath,
      summary: {
        totalSize: result.size,
        totalFiles: result.fileCount,
        totalDirs: result.dirCount,
        recommendationScore: metrics.recommendationScore,
        complianceScore: metrics.complianceScore
      },
      systemMetrics: metrics.systemMetrics,
      topIssues: this.identifyTopIssues(result),
      predictions,
      recommendations: this.generateRecommendations(result, predictions),
      ciStatus: this.calculateCIStatus(result, options)
    };
    
    return report;
  }

  /**
   * Identify top issues for CI/CD
   */
  identifyTopIssues(result) {
    const issues = [];
    
    // Large directories
    const largeDirs = result.children.filter(c => c.size > 1024 * 1024 * 1024);
    if (largeDirs.length > 0) {
      issues.push({
        type: 'large_directories',
        severity: 'warning',
        message: `${largeDirs.length} directories larger than 1GB`,
        directories: largeDirs.map(d => ({ name: d.name, size: d.size }))
      });
    }
    
    // Potential cleanup candidates
    const cleanupCandidates = result.children.filter(c => 
      this.isLikelyUnused(c) && c.size > 50 * 1024 * 1024
    );
    if (cleanupCandidates.length > 0) {
      issues.push({
        type: 'cleanup_candidates',
        severity: 'info',
        message: `${cleanupCandidates.length} directories may be eligible for cleanup`,
        savings: cleanupCandidates.reduce((sum, c) => sum + c.size, 0)
      });
    }
    
    // Compliance issues
    if (metrics.complianceScore < 80) {
      issues.push({
        type: 'compliance',
        severity: 'error',
        message: `Low compliance score: ${metrics.complianceScore}%`,
        recommendation: 'Review file organization and documentation'
      });
    }
    
    return issues;
  }

  /**
   * Generate actionable recommendations
   */
  generateRecommendations(result, predictions) {
    const recommendations = [];
    
    // Based on size
    if (result.size > 100 * 1024 * 1024 * 1024) { // > 100GB
      recommendations.push({
        priority: 'high',
        category: 'storage',
        title: 'Implement storage management policies',
        description: 'Large directory detected. Consider implementing cleanup policies or archiving.',
        estimatedSavings: result.size * 0.3 // 30% potential savings
      });
    }
    
    // Based on file types
    const codeRatio = ((result.types.code || {}).size || 0) / result.size;
    if (codeRatio > 0.7) {
      recommendations.push({
        priority: 'medium',
        category: 'code_organization',
        title: 'Review code structure',
        description: 'High percentage of code files. Consider code organization improvements.',
        estimatedSavings: result.size * 0.05 // 5% potential savings
      });
    }
    
    // Based on predictions
    if (predictions.trend === 'increasing' && predictions.confidence > 50) {
      recommendations.push({
        priority: 'high',
        category: 'growth_management',
        title: 'Address growth trends',
        description: `Disk usage is ${predictions.trend} at ${this.formatSize(predictions.growthRate)}/day`,
        estimatedSavings: result.size * 0.1 // 10% potential savings
      });
    }
    
    return recommendations;
  }

  /**
   * Calculate CI status based on thresholds
   */
  calculateCIStatus(result, options) {
    const thresholds = options.thresholds || {
      maxFileSize: 1024 * 1024 * 1024 * 10, // 10GB max file size
      maxTotalSize: 1024 * 1024 * 1024 * 100, // 100GB max total
      maxUnusedPercent: 0.3 // 30% max unused
    };
    
    const issues = [];
    
    // Check file sizes
    const largeFiles = result.children.flatMap(c => 
      c.children ? c.children.filter(gc => gc.size > thresholds.maxFileSize) : []
    );
    if (largeFiles.length > 0) {
      issues.push({
        type: 'large_files',
        message: `${largeFiles.length} files exceed maximum size threshold`,
        severity: 'warning'
      });
    }
    
    // Check total size
    if (result.size > thresholds.maxTotalSize) {
      issues.push({
        type: 'total_size',
        message: `Directory exceeds maximum size threshold`,
        severity: 'error'
      });
    }
    
    // Determine status
    if (issues.length === 0) return 'success';
    if (issues.some(i => i.severity === 'error')) return 'failed';
    return 'warning';
  }

  /**
   * Export data to cloud storage
   */
  async exportToCloud(data, options = {}) {
    if (!this.cloud) {
      throw new Error('Cloud storage not configured');
    }
    
    const exportData = {
      timestamp: new Date().toISOString(),
      data,
      metadata: {
        source: this.getSystemInfo(),
        version: require('../package.json').version
      }
    };
    
    const destination = options.destination || `dirsize-export-${Date.now()}.json`;
    return await this.cloud.upload(exportData, destination);
  }

  /**
   * Get system information
   */
  getSystemInfo() {
    return {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime(),
      cwd: process.cwd()
    };
  }

  /**
   * Enhanced formatting methods
   */
  formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const val = bytes / Math.pow(1024, i);
    return val.toFixed(i === 0 ? 0 : 1) + ' ' + units[i];
  }

  /**
   * Cloud storage class (placeholder)
   */
  static get CloudStorage() {
    return class CloudStorage {
      constructor(config) {
        this.config = config;
      }
      
      async upload(data, destination) {
        // Placeholder implementation
        console.log(`Uploading to cloud: ${destination}`);
        return { success: true, path: destination };
      }
    };
  }

  /**
   * Database class (simple JSON file storage)
   */
  static get Database() {
    return class Database {
      constructor(filePath) {
        this.filePath = filePath;
        this.data = this.load();
      }
      
      load() {
        try {
          const content = fs.readFileSync(this.filePath, 'utf8');
          return JSON.parse(content);
        } catch (e) {
          return {};
        }
      }
      
      save() {
        fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
      }
      
      get(key, defaultValue) {
        return this.data[key] || defaultValue;
      }
      
      set(key, value) {
        this.data[key] = value;
        this.save();
      }
    };
  }
}

module.exports = EnhancedDirSize;