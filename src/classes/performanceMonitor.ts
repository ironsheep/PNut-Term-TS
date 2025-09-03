import { BrowserWindow, ipcMain } from 'electron';

interface PerformanceMetrics {
  throughput: number;
  bufferUsage: number;
  queueDepth: number;
  status: string;
  bufferSize: number;
  bufferUsed: number;
  bufferAvailable: number;
  highWaterMark: number;
  overflowEvents: number;
  totalMessages: number;
  messagesPerSecond: number;
  recordingActive: boolean;
  recordingSize: number;
  parseErrors: number;
  activeWindows: Array<{
    name: string;
    queueDepth: number;
  }>;
}

export class PerformanceMonitor {
  private window: BrowserWindow | null = null;
  private parent: BrowserWindow;
  private updateInterval: NodeJS.Timeout | null = null;
  private metrics: PerformanceMetrics = {
    throughput: 0,
    bufferUsage: 0,
    queueDepth: 0,
    status: '✓',
    bufferSize: 65536,
    bufferUsed: 0,
    bufferAvailable: 65536,
    highWaterMark: 0,
    overflowEvents: 0,
    totalMessages: 0,
    messagesPerSecond: 0,
    recordingActive: false,
    recordingSize: 0,
    parseErrors: 0,
    activeWindows: []
  };

  constructor(parent: BrowserWindow) {
    this.parent = parent;
  }

  public show(): void {
    if (this.window) {
      this.window.focus();
      return;
    }

    this.window = new BrowserWindow({
      width: 500,
      height: 600,
      parent: this.parent,
      modal: false,
      resizable: true,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    const html = this.getHTML();
    this.window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

    this.setupIPCHandlers();
    this.startMetricsUpdate();

    this.window.on('closed', () => {
      this.cleanup();
      this.window = null;
    });
  }

  public updateMetrics(metrics: Partial<PerformanceMetrics>): void {
    this.metrics = { ...this.metrics, ...metrics };
  }

  private cleanup(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    ipcMain.removeAllListeners('perf-get-metrics');
    ipcMain.removeAllListeners('perf-clear-stats');
  }

  private setupIPCHandlers(): void {
    ipcMain.on('perf-get-metrics', (event) => {
      event.reply('perf-metrics', this.metrics);
    });

    ipcMain.on('perf-clear-stats', () => {
      this.metrics.overflowEvents = 0;
      this.metrics.parseErrors = 0;
      this.metrics.totalMessages = 0;
      this.metrics.highWaterMark = this.metrics.bufferUsed;
      console.log('[Performance] Stats cleared');
    });
  }

  private startMetricsUpdate(): void {
    this.updateInterval = setInterval(() => {
      if (this.window && !this.window.isDestroyed()) {
        this.window.webContents.send('perf-metrics', this.metrics);
      }
    }, 100);
  }

  private getHTML(): string {
    return `<!DOCTYPE html>
<html>
<head>
  <title>Performance Monitor</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace;
      background: #1e1e1e;
      color: #d4d4d4;
      padding: 20px;
      font-size: 13px;
    }
    
    h2 {
      color: #4ec9b0;
      margin-bottom: 15px;
      font-size: 16px;
      border-bottom: 1px solid #333;
      padding-bottom: 5px;
    }
    
    .section {
      margin-bottom: 25px;
      background: #252526;
      padding: 15px;
      border-radius: 5px;
    }
    
    .metric-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      align-items: center;
    }
    
    .metric-label {
      color: #969696;
    }
    
    .metric-value {
      font-family: 'Consolas', 'Monaco', monospace;
      color: #4ec9b0;
      font-weight: bold;
    }
    
    .status-indicator {
      font-size: 20px;
      text-shadow: 0 0 2px currentColor;
    }
    
    .status-ok { color: #00ff00; }
    .status-warning { color: #ffaa00; }
    .status-error { color: #ff0000; }
    
    .progress-bar {
      height: 20px;
      background: #3e3e42;
      border-radius: 3px;
      overflow: hidden;
      position: relative;
    }
    
    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #0e639c, #1177bb);
      transition: width 0.1s ease;
    }
    
    .progress-text {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      color: white;
      font-size: 11px;
      text-shadow: 0 0 2px rgba(0,0,0,0.5);
    }
    
    .sparkline {
      height: 40px;
      background: #3e3e42;
      border-radius: 3px;
      position: relative;
      overflow: hidden;
    }
    
    .sparkline-canvas {
      width: 100%;
      height: 100%;
    }
    
    .window-list {
      max-height: 150px;
      overflow-y: auto;
      background: #1e1e1e;
      padding: 10px;
      border-radius: 3px;
      margin-top: 10px;
    }
    
    .window-item {
      display: flex;
      justify-content: space-between;
      margin-bottom: 5px;
      padding: 3px 5px;
      background: #2d2d30;
      border-radius: 2px;
    }
    
    button {
      background: #0e639c;
      color: white;
      border: none;
      padding: 6px 15px;
      border-radius: 3px;
      cursor: pointer;
      font-size: 12px;
      margin-right: 10px;
    }
    
    button:hover {
      background: #1177bb;
    }
    
    .controls {
      margin-top: 20px;
      display: flex;
      align-items: center;
    }
    
    label {
      margin-left: 5px;
      margin-right: 15px;
    }
  </style>
</head>
<body>
  <div class="section">
    <h2>Live Metrics</h2>
    <div class="metric-row">
      <span class="metric-label">Throughput:</span>
      <span class="metric-value" id="throughput">0 kb/s</span>
    </div>
    <div class="sparkline">
      <canvas id="throughput-chart" class="sparkline-canvas"></canvas>
    </div>
    <div class="metric-row" style="margin-top: 10px;">
      <span class="metric-label">Buffer Usage:</span>
      <span class="metric-value" id="buffer-percentage">0%</span>
    </div>
    <div class="progress-bar">
      <div class="progress-fill" id="buffer-bar"></div>
      <div class="progress-text" id="buffer-text">0 KB / 64 KB</div>
    </div>
    <div class="metric-row" style="margin-top: 10px;">
      <span class="metric-label">Queue Depth:</span>
      <span class="metric-value" id="queue-depth">0</span>
    </div>
    <div class="metric-row">
      <span class="metric-label">Status:</span>
      <span class="status-indicator status-ok" id="status">✓</span>
    </div>
  </div>
  
  <div class="section">
    <h2>Buffer Details</h2>
    <div class="metric-row">
      <span class="metric-label">Buffer Size:</span>
      <span class="metric-value" id="buffer-size">64 KB</span>
    </div>
    <div class="metric-row">
      <span class="metric-label">Used / Available:</span>
      <span class="metric-value" id="buffer-used">0 KB / 64 KB</span>
    </div>
    <div class="metric-row">
      <span class="metric-label">High Water Mark:</span>
      <span class="metric-value" id="high-water">0 KB</span>
    </div>
    <div class="metric-row">
      <span class="metric-label">Overflow Events:</span>
      <span class="metric-value" id="overflow-events">0</span>
    </div>
  </div>
  
  <div class="section">
    <h2>Message Routing</h2>
    <div class="metric-row">
      <span class="metric-label">Total Messages:</span>
      <span class="metric-value" id="total-messages">0</span>
    </div>
    <div class="metric-row">
      <span class="metric-label">Messages/sec:</span>
      <span class="metric-value" id="msg-per-sec">0</span>
    </div>
    <div class="metric-row">
      <span class="metric-label">Recording:</span>
      <span class="metric-value" id="recording-status">Inactive</span>
    </div>
    <div class="metric-row">
      <span class="metric-label">Parse Errors:</span>
      <span class="metric-value" id="parse-errors">0</span>
    </div>
  </div>
  
  <div class="section">
    <h2>Active Windows</h2>
    <div class="window-list" id="window-list">
      <div class="window-item">
        <span>No active debug windows</span>
        <span>-</span>
      </div>
    </div>
  </div>
  
  <div class="controls">
    <button onclick="clearStats()">Clear Stats</button>
    <input type="checkbox" id="auto-refresh" checked>
    <label for="auto-refresh">Auto-refresh</label>
  </div>
  
  <script>
    const { ipcRenderer } = require('electron');
    
    let throughputHistory = new Array(50).fill(0);
    let autoRefresh = true;
    
    const canvas = document.getElementById('throughput-chart');
    const ctx = canvas.getContext('2d');
    
    // Set canvas size
    function resizeCanvas() {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Listen for metrics updates
    ipcRenderer.on('perf-metrics', (event, metrics) => {
      if (!autoRefresh) return;
      updateDisplay(metrics);
    });
    
    // Request initial metrics
    ipcRenderer.send('perf-get-metrics');
    
    function updateDisplay(metrics) {
      // Live metrics
      document.getElementById('throughput').textContent = metrics.throughput.toFixed(1) + ' kb/s';
      document.getElementById('buffer-percentage').textContent = metrics.bufferUsage.toFixed(0) + '%';
      document.getElementById('queue-depth').textContent = metrics.queueDepth;
      document.getElementById('status').textContent = metrics.status;
      
      // Update status color
      const statusEl = document.getElementById('status');
      statusEl.className = 'status-indicator';
      if (metrics.status === '✓') statusEl.classList.add('status-ok');
      else if (metrics.status === '⚠') statusEl.classList.add('status-warning');
      else if (metrics.status === '✗') statusEl.classList.add('status-error');
      
      // Buffer bar
      document.getElementById('buffer-bar').style.width = metrics.bufferUsage + '%';
      const bufferKB = (metrics.bufferUsed / 1024).toFixed(1);
      const totalKB = (metrics.bufferSize / 1024).toFixed(0);
      document.getElementById('buffer-text').textContent = bufferKB + ' KB / ' + totalKB + ' KB';
      
      // Buffer details
      document.getElementById('buffer-size').textContent = (metrics.bufferSize / 1024).toFixed(0) + ' KB';
      document.getElementById('buffer-used').textContent = 
        (metrics.bufferUsed / 1024).toFixed(1) + ' KB / ' + 
        (metrics.bufferAvailable / 1024).toFixed(1) + ' KB';
      document.getElementById('high-water').textContent = (metrics.highWaterMark / 1024).toFixed(1) + ' KB';
      document.getElementById('overflow-events').textContent = metrics.overflowEvents;
      
      // Message routing
      document.getElementById('total-messages').textContent = metrics.totalMessages;
      document.getElementById('msg-per-sec').textContent = metrics.messagesPerSecond.toFixed(1);
      document.getElementById('recording-status').textContent = 
        metrics.recordingActive ? 'Active (' + (metrics.recordingSize / 1024).toFixed(1) + ' KB)' : 'Inactive';
      document.getElementById('parse-errors').textContent = metrics.parseErrors;
      
      // Active windows
      updateWindowList(metrics.activeWindows);
      
      // Update throughput graph
      updateThroughputGraph(metrics.throughput);
    }
    
    function updateWindowList(windows) {
      const list = document.getElementById('window-list');
      if (windows.length === 0) {
        list.innerHTML = '<div class="window-item"><span>No active debug windows</span><span>-</span></div>';
      } else {
        list.innerHTML = windows.map(w => 
          '<div class="window-item"><span>' + w.name + '</span><span>Queue: ' + w.queueDepth + '</span></div>'
        ).join('');
      }
    }
    
    function updateThroughputGraph(value) {
      throughputHistory.shift();
      throughputHistory.push(value);
      
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw grid lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(0, (canvas.height / 4) * i);
        ctx.lineTo(canvas.width, (canvas.height / 4) * i);
        ctx.stroke();
      }
      
      // Draw throughput line
      ctx.strokeStyle = '#4ec9b0';
      ctx.lineWidth = 2;
      ctx.beginPath();
      
      const maxVal = Math.max(...throughputHistory, 10);
      for (let i = 0; i < throughputHistory.length; i++) {
        const x = (canvas.width / (throughputHistory.length - 1)) * i;
        const y = canvas.height - (throughputHistory[i] / maxVal * canvas.height);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    
    function clearStats() {
      ipcRenderer.send('perf-clear-stats');
    }
    
    document.getElementById('auto-refresh').addEventListener('change', (e) => {
      autoRefresh = e.target.checked;
    });
  </script>
</body>
</html>`;
  }
}