/** @format */

// src/classes/shared/routerDiagnostics.ts

import { RouterLogger, LogEntry, LogLevel } from './routerLogger';
import { WindowRouter } from './windowRouter';

/**
 * Enhanced diagnostic tools for WindowRouter debugging and analysis
 */
export class RouterDiagnostics {
  private static instance: RouterDiagnostics | null = null;
  
  public static getInstance(): RouterDiagnostics {
    if (!RouterDiagnostics.instance) {
      RouterDiagnostics.instance = new RouterDiagnostics();
    }
    return RouterDiagnostics.instance;
  }
  
  /**
   * Analyze routing performance patterns
   */
  public analyzePerformance(logger: RouterLogger): any {
    const entries = logger.getRecentEntries(1000);
    const routingEntries = entries.filter(e => e.category === 'ROUTING');
    
    if (routingEntries.length === 0) {
      return { error: 'No routing performance data available' };
    }
    
    const routingTimes = routingEntries
      .filter(e => e.data?.routingTime)
      .map(e => e.data.routingTime);
    
    const analysis = {
      totalMessages: routingTimes.length,
      averageTime: routingTimes.reduce((a, b) => a + b, 0) / routingTimes.length,
      minTime: Math.min(...routingTimes),
      maxTime: Math.max(...routingTimes),
      p95Time: this.percentile(routingTimes, 95),
      p99Time: this.percentile(routingTimes, 99),
      slowMessages: routingTimes.filter(t => t > 1.0).length,
      messageTypes: this.analyzeMessageTypes(routingEntries)
    };
    
    return analysis;
  }
  
  /**
   * Analyze message routing patterns
   */
  public analyzeMessagePatterns(logger: RouterLogger): any {
    const entries = logger.getRecentEntries(2000);
    const routingEntries = entries.filter(e => e.category === 'ROUTING');
    
    const patterns = {
      windowDistribution: new Map<string, number>(),
      messageTypeDistribution: new Map<string, number>(),
      hourlyDistribution: new Map<string, number>(),
      averageSizeByType: new Map<string, { total: number; count: number }>()
    };
    
    for (const entry of routingEntries) {
      if (entry.data) {
        // Window distribution
        const windowId = entry.data.windowId || 'unknown';
        patterns.windowDistribution.set(windowId, (patterns.windowDistribution.get(windowId) || 0) + 1);
        
        // Message type distribution
        const messageType = entry.data.messageType || 'unknown';
        patterns.messageTypeDistribution.set(messageType, (patterns.messageTypeDistribution.get(messageType) || 0) + 1);
        
        // Hourly distribution
        const hour = new Date(entry.timestamp).getHours().toString();
        patterns.hourlyDistribution.set(hour, (patterns.hourlyDistribution.get(hour) || 0) + 1);
        
        // Size analysis
        const size = entry.data.size || 0;
        if (!patterns.averageSizeByType.has(messageType)) {
          patterns.averageSizeByType.set(messageType, { total: 0, count: 0 });
        }
        const sizeData = patterns.averageSizeByType.get(messageType)!;
        sizeData.total += size;
        sizeData.count++;
      }
    }
    
    return {
      windowDistribution: Object.fromEntries(patterns.windowDistribution),
      messageTypeDistribution: Object.fromEntries(patterns.messageTypeDistribution),
      hourlyDistribution: Object.fromEntries(patterns.hourlyDistribution),
      averageSizeByType: Object.fromEntries(
        Array.from(patterns.averageSizeByType.entries()).map(([key, value]) => [
          key, 
          { averageSize: value.total / value.count, messageCount: value.count }
        ])
      )
    };
  }
  
  /**
   * Generate health report
   */
  public generateHealthReport(router: WindowRouter, logger: RouterLogger): any {
    const stats = router.getRoutingStats();
    const loggerStats = logger.getStatistics();
    const performanceAnalysis = this.analyzePerformance(logger);
    const patterns = this.analyzeMessagePatterns(logger);
    
    const health = {
      timestamp: new Date().toISOString(),
      status: this.calculateHealthStatus(stats, performanceAnalysis),
      routing: {
        activeWindows: stats.windowsActive,
        messagesRouted: stats.messagesRouted,
        bytesProcessed: stats.bytesProcessed,
        errorRate: stats.errors / Math.max(stats.messagesRouted, 1),
        averageRoutingTime: stats.averageRoutingTime,
        peakRoutingTime: stats.peakRoutingTime
      },
      logging: {
        totalMessages: loggerStats.totalMessages,
        totalErrors: loggerStats.totalErrors,
        bufferUsage: loggerStats.bufferSize,
        isEnabled: loggerStats.isEnabled
      },
      performance: performanceAnalysis,
      patterns: patterns,
      warnings: this.generateWarnings(stats, performanceAnalysis, patterns)
    };
    
    return health;
  }
  
  /**
   * Calculate overall health status
   */
  private calculateHealthStatus(stats: any, performance: any): 'healthy' | 'warning' | 'critical' {
    const errorRate = stats.errors / Math.max(stats.messagesRouted, 1);
    const avgRoutingTime = performance.averageTime || 0;
    const slowMessageRate = (performance.slowMessages || 0) / Math.max(performance.totalMessages, 1);
    
    if (errorRate > 0.05 || avgRoutingTime > 5.0 || slowMessageRate > 0.1) {
      return 'critical';
    } else if (errorRate > 0.01 || avgRoutingTime > 2.0 || slowMessageRate > 0.05) {
      return 'warning';
    } else {
      return 'healthy';
    }
  }
  
  /**
   * Generate warnings based on analysis
   */
  private generateWarnings(stats: any, performance: any, patterns: any): string[] {
    const warnings: string[] = [];
    
    const errorRate = stats.errors / Math.max(stats.messagesRouted, 1);
    if (errorRate > 0.01) {
      warnings.push(`High error rate: ${(errorRate * 100).toFixed(2)}%`);
    }
    
    if (performance.averageTime > 2.0) {
      warnings.push(`High average routing time: ${performance.averageTime.toFixed(2)}ms`);
    }
    
    if (performance.slowMessages > performance.totalMessages * 0.05) {
      warnings.push(`${performance.slowMessages} slow messages (>${((performance.slowMessages / performance.totalMessages) * 100).toFixed(1)}%)`);
    }
    
    if (stats.peakRoutingTime > 10.0) {
      warnings.push(`Peak routing time exceeded 10ms: ${stats.peakRoutingTime.toFixed(2)}ms`);
    }
    
    // Check for unbalanced window usage
    const windowCounts = Object.values(patterns.windowDistribution) as number[];
    if (windowCounts.length > 1) {
      const max = Math.max(...windowCounts);
      const min = Math.min(...windowCounts);
      if (max / min > 10) {
        warnings.push('Unbalanced message distribution across windows');
      }
    }
    
    return warnings;
  }
  
  /**
   * Create formatted diagnostic report
   */
  public createFormattedReport(router: WindowRouter, logger: RouterLogger): string {
    const health = this.generateHealthReport(router, logger);
    
    const report = `
WindowRouter Health Report
Generated: ${health.timestamp}
Status: ${health.status.toUpperCase()}

ROUTING METRICS:
- Active Windows: ${health.routing.activeWindows}
- Messages Routed: ${health.routing.messagesRouted.toLocaleString()}
- Bytes Processed: ${(health.routing.bytesProcessed / 1024 / 1024).toFixed(2)} MB
- Error Rate: ${(health.routing.errorRate * 100).toFixed(3)}%
- Average Routing Time: ${health.routing.averageRoutingTime.toFixed(3)}ms
- Peak Routing Time: ${health.routing.peakRoutingTime.toFixed(3)}ms

PERFORMANCE ANALYSIS:
- Total Messages Analyzed: ${health.performance.totalMessages || 0}
- Average Time: ${(health.performance.averageTime || 0).toFixed(3)}ms
- Min/Max Time: ${(health.performance.minTime || 0).toFixed(3)}ms / ${(health.performance.maxTime || 0).toFixed(3)}ms
- P95/P99 Time: ${(health.performance.p95Time || 0).toFixed(3)}ms / ${(health.performance.p99Time || 0).toFixed(3)}ms
- Slow Messages (>1ms): ${health.performance.slowMessages || 0}

LOGGING STATUS:
- Total Log Messages: ${health.logging.totalMessages.toLocaleString()}
- Total Errors Logged: ${health.logging.totalErrors}
- Buffer Usage: ${health.logging.bufferUsage}
- Logging Enabled: ${health.logging.isEnabled ? 'YES' : 'NO'}

WINDOW DISTRIBUTION:
${Object.entries(health.patterns.windowDistribution).map(([window, count]) => 
  `- ${window}: ${count} messages`).join('\n')}

MESSAGE TYPE DISTRIBUTION:
${Object.entries(health.patterns.messageTypeDistribution).map(([type, count]) => 
  `- ${type}: ${count} messages`).join('\n')}

${health.warnings.length > 0 ? `
WARNINGS:
${health.warnings.map((w: string) => `⚠️  ${w}`).join('\n')}
` : 'No warnings detected.'}

${health.status === 'healthy' ? '✅ Router is operating normally' : 
  health.status === 'warning' ? '⚠️ Router has performance issues' : 
  '🔴 Router has critical issues requiring attention'}
`;
    
    return report.trim();
  }
  
  /**
   * Utility: Calculate percentile
   */
  private percentile(arr: number[], p: number): number {
    if (arr.length === 0) return 0;
    
    const sorted = [...arr].sort((a, b) => a - b);
    const index = (p / 100) * (sorted.length - 1);
    
    if (Math.floor(index) === index) {
      return sorted[index];
    } else {
      const lower = sorted[Math.floor(index)];
      const upper = sorted[Math.ceil(index)];
      return lower + (upper - lower) * (index - Math.floor(index));
    }
  }
  
  /**
   * Utility: Analyze message types from routing entries
   */
  private analyzeMessageTypes(entries: LogEntry[]): any {
    const types = new Map<string, { count: number; totalSize: number; totalTime: number }>();
    
    for (const entry of entries) {
      if (entry.data) {
        const type = entry.data.messageType || 'unknown';
        const size = entry.data.size || 0;
        const time = entry.data.routingTime || 0;
        
        if (!types.has(type)) {
          types.set(type, { count: 0, totalSize: 0, totalTime: 0 });
        }
        
        const typeData = types.get(type)!;
        typeData.count++;
        typeData.totalSize += size;
        typeData.totalTime += time;
      }
    }
    
    return Object.fromEntries(
      Array.from(types.entries()).map(([type, data]) => [
        type,
        {
          count: data.count,
          averageSize: data.totalSize / data.count,
          averageTime: data.totalTime / data.count
        }
      ])
    );
  }
  
  /**
   * Monitor routing performance in real-time
   */
  public startPerformanceMonitoring(router: WindowRouter, logger: RouterLogger, intervalMs: number = 30000): NodeJS.Timeout {
    return setInterval(() => {
      const health = this.generateHealthReport(router, logger);
      
      if (health.status !== 'healthy') {
        console.warn(`WindowRouter Status: ${health.status.toUpperCase()}`);
        
        if (health.warnings.length > 0) {
          console.warn('Warnings:', health.warnings.join(', '));
        }
        
        if (health.status === 'critical') {
          logger.error('DIAGNOSTICS', `Critical router health detected`, health);
        }
      }
    }, intervalMs);
  }
}