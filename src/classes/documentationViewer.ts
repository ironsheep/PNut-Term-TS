import { BrowserWindow, ipcMain, shell, app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import MarkdownIt from 'markdown-it';

interface NavigationEntry {
  id: string;
  title: string;
  level: number;
  children?: NavigationEntry[];
}

export class DocumentationViewer {
  private window: BrowserWindow | null = null;
  private parent: BrowserWindow;
  private markdown: MarkdownIt;
  private currentFile: string = '';
  private navigationTree: NavigationEntry[] = [];
  
  constructor(parent: BrowserWindow) {
    this.parent = parent;
    this.markdown = new MarkdownIt({
      html: true,
      linkify: true,
      typographer: true
    });
  }

  public show(): void {
    if (this.window) {
      this.window.focus();
      return;
    }

    this.window = new BrowserWindow({
      width: 1000,
      height: 700,
      parent: this.parent,
      modal: false,
      resizable: true,
      title: 'PNut-Term-TS Documentation',
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    // Load user guide by default
    const defaultDoc = this.findUserGuide();
    this.loadDocument(defaultDoc);

    this.setupIPCHandlers();

    this.window.on('closed', () => {
      this.cleanup();
      this.window = null;
    });
  }

  private findUserGuide(): string {
    // Determine base path: In packaged apps, use process.resourcesPath/app
    // In development, use process.cwd()
    const basePath = app.isPackaged
      ? path.join(process.resourcesPath, 'app')  // App files are in Resources/app/
      : process.cwd();

    // Return APP-HELP.md path - this file must always be packaged with the app
    return path.join(basePath, 'DOCs', 'APP-HELP.md');
  }

  private loadDocument(filepath: string): void {
    this.currentFile = filepath;
    
    try {
      let content = '';
      let documentTitle = 'Documentation';
      
      if (fs.existsSync(filepath)) {
        content = fs.readFileSync(filepath, 'utf-8');
        documentTitle = path.basename(filepath, '.md');
      } else {
        content = this.getOfflineFallbackContent();
        documentTitle = 'Documentation Not Available';
      }

      // Generate navigation tree
      this.navigationTree = this.generateNavigation(content);
      
      // Convert markdown to HTML
      const htmlContent = this.markdown.render(content);
      
      // Generate complete HTML page
      const html = this.getHTML(htmlContent, documentTitle);
      
      // Load the content
      this.window?.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
      
    } catch (error) {
      console.error('[Documentation] Error loading document:', error);
      const fallbackHtml = this.getHTML(
        '<h1>Error Loading Documentation</h1><p>Could not load the documentation file. Please check the online documentation.</p>',
        'Error'
      );
      this.window?.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(fallbackHtml)}`);
    }
  }

  private generateNavigation(content: string): NavigationEntry[] {
    const lines = content.split('\n');
    const navigation: NavigationEntry[] = [];
    const stack: NavigationEntry[] = [];

    let idCounter = 0;

    for (const line of lines) {
      const match = line.match(/^(#{1,6})\s+(.+)$/);
      if (match) {
        const level = match[1].length;
        const title = match[2].trim();
        const id = `heading-${idCounter++}`;

        const entry: NavigationEntry = {
          id,
          title,
          level,
          children: []
        };

        // Find the correct parent level
        while (stack.length > 0 && stack[stack.length - 1].level >= level) {
          stack.pop();
        }

        if (stack.length === 0) {
          navigation.push(entry);
        } else {
          const parent = stack[stack.length - 1];
          if (!parent.children) parent.children = [];
          parent.children.push(entry);
        }

        stack.push(entry);
      }
    }

    return navigation;
  }

  private getOfflineFallbackContent(): string {
    return `# PNut-Term-TS Documentation

## Documentation Not Available Offline

The documentation file could not be found locally. This may happen if:

1. The documentation files haven't been packaged with the application
2. The file path has changed
3. You're running a development version without the docs folder

## Available Online

You can access the complete documentation online at:

- **GitHub Repository**: [PNut-Term-TS](https://github.com/parallaxinc/PNut-Term-TS)
- **Wiki Pages**: [Documentation Wiki](https://github.com/parallaxinc/PNut-Term-TS/wiki)

## Quick Start

1. **Connect Hardware**: Connect your Parallax Propeller 2 device
2. **Select Port**: Use the Connection menu to select your serial port
3. **Start Debugging**: Use the Debug menu to open debug windows
4. **Monitor Output**: View debug output in the various debug windows

## Getting Help

If you need assistance:

- Check the GitHub Issues page for known problems
- Submit a new issue if you encounter bugs
- Join the Parallax community forums for general help

Click the "Online Documentation" button below to access the full documentation.
`;
  }

  private setupIPCHandlers(): void {
    ipcMain.on('doc-navigate-section', (event, sectionId) => {
      // Scroll to section - handled by frontend JavaScript
    });

    ipcMain.on('doc-open-online', () => {
      shell.openExternal('https://github.com/parallaxinc/PNut-Term-TS/wiki');
    });

    ipcMain.on('doc-reload', () => {
      this.loadDocument(this.currentFile);
    });

    ipcMain.on('doc-get-navigation', (event) => {
      event.reply('doc-navigation', this.navigationTree);
    });
  }

  private cleanup(): void {
    ipcMain.removeAllListeners('doc-navigate-section');
    ipcMain.removeAllListeners('doc-open-online');
    ipcMain.removeAllListeners('doc-reload');
    ipcMain.removeAllListeners('doc-get-navigation');
  }

  private getHTML(content: string, title: string): string {
    const navigationHtml = this.renderNavigation(this.navigationTree);
    
    return `<!DOCTYPE html>
<html>
<head>
  <title>${title} - PNut-Term-TS Documentation</title>
  <meta charset="utf-8">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background: #fff;
      color-scheme: light;
      display: flex;
      height: 100vh;
    }
    
    /* Sidebar Navigation */
    .sidebar {
      width: 280px;
      background: #f8f9fa;
      border-right: 1px solid #dee2e6;
      overflow-y: auto;
      flex-shrink: 0;
    }
    
    .sidebar-header {
      padding: 20px;
      border-bottom: 1px solid #dee2e6;
      background: #e9ecef;
    }
    
    .sidebar-title {
      font-size: 16px;
      font-weight: 600;
      color: #495057;
      margin-bottom: 8px;
    }
    
    .sidebar-actions {
      display: flex;
      gap: 8px;
    }
    
    .btn {
      padding: 6px 12px;
      border: 1px solid #ced4da;
      background: #fff;
      color: #495057;
      font-size: 12px;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .btn:hover {
      background: #e9ecef;
      border-color: #adb5bd;
    }
    
    .btn-primary {
      background: #007bff;
      color: white;
      border-color: #007bff;
    }
    
    .btn-primary:hover {
      background: #0056b3;
      border-color: #0056b3;
    }
    
    /* Navigation Tree */
    .nav-tree {
      padding: 0;
      margin: 0;
      list-style: none;
    }
    
    .nav-item {
      border-bottom: 1px solid #e9ecef;
    }
    
    .nav-link {
      display: block;
      padding: 12px 20px;
      color: #495057;
      text-decoration: none;
      font-size: 14px;
      transition: background-color 0.2s;
    }
    
    .nav-link:hover {
      background: #e9ecef;
      color: #007bff;
    }
    
    .nav-link.level-2 { padding-left: 35px; font-size: 13px; }
    .nav-link.level-3 { padding-left: 50px; font-size: 12px; }
    .nav-link.level-4 { padding-left: 65px; font-size: 12px; }
    .nav-link.level-5 { padding-left: 80px; font-size: 12px; }
    .nav-link.level-6 { padding-left: 95px; font-size: 12px; }
    
    /* Main Content */
    .main-content {
      flex: 1;
      overflow-y: auto;
      padding: 40px;
    }
    
    .content {
      max-width: 800px;
      margin: 0 auto;
    }
    
    /* Markdown Styling */
    h1, h2, h3, h4, h5, h6 {
      margin-top: 24px;
      margin-bottom: 16px;
      font-weight: 600;
      line-height: 1.25;
      scroll-margin-top: 20px;
    }
    
    h1 { font-size: 32px; color: #1e2329; border-bottom: 1px solid #eaecef; padding-bottom: 10px; }
    h2 { font-size: 24px; color: #1e2329; border-bottom: 1px solid #eaecef; padding-bottom: 8px; }
    h3 { font-size: 20px; color: #1e2329; }
    h4 { font-size: 16px; color: #1e2329; }
    h5 { font-size: 14px; color: #1e2329; }
    h6 { font-size: 13px; color: #1e2329; }
    
    p {
      margin-bottom: 16px;
    }
    
    ul, ol {
      margin-bottom: 16px;
      padding-left: 32px;
    }
    
    li {
      margin-bottom: 4px;
    }
    
    code {
      padding: 2px 4px;
      background: #f1f3f4;
      border-radius: 3px;
      font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
      font-size: 85%;
    }
    
    pre {
      background: #f6f8fa;
      border-radius: 6px;
      padding: 16px;
      overflow-x: auto;
      margin-bottom: 16px;
      border: 1px solid #e1e4e8;
    }
    
    pre code {
      background: none;
      padding: 0;
      font-size: 14px;
    }
    
    blockquote {
      border-left: 4px solid #dfe2e5;
      padding: 0 16px;
      color: #6a737d;
      margin-bottom: 16px;
    }
    
    table {
      border-collapse: collapse;
      width: 100%;
      margin-bottom: 16px;
    }
    
    th, td {
      border: 1px solid #dfe2e5;
      padding: 8px 12px;
      text-align: left;
    }
    
    th {
      background: #f6f8fa;
      font-weight: 600;
    }
    
    a {
      color: #007bff;
      text-decoration: none;
    }
    
    a:hover {
      text-decoration: underline;
    }
    
    img {
      max-width: 100%;
      height: auto;
    }
    
    hr {
      border: none;
      border-top: 1px solid #e1e4e8;
      margin: 24px 0;
    }
    
    /* Responsive */
    @media (max-width: 768px) {
      body {
        flex-direction: column;
      }
      
      .sidebar {
        width: 100%;
        height: auto;
        max-height: 200px;
      }
      
      .main-content {
        padding: 20px;
      }
    }
  </style>
</head>
<body>
  <div class="sidebar">
    <div class="sidebar-header">
      <div class="sidebar-title">Documentation</div>
      <div class="sidebar-actions">
        <button class="btn" onclick="reloadDoc()">Reload</button>
        <button class="btn btn-primary" onclick="openOnline()">Online</button>
      </div>
    </div>
    <nav>
      <ul class="nav-tree">
        ${navigationHtml}
      </ul>
    </nav>
  </div>
  
  <div class="main-content">
    <div class="content">
      ${content}
    </div>
  </div>
  
  <script>
    const { ipcRenderer } = require('electron');
    
    // Add click handlers to navigation links
    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = link.getAttribute('href').substring(1);
        const element = document.getElementById(targetId);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
      });
    });
    
    // Button handlers
    function reloadDoc() {
      ipcRenderer.send('doc-reload');
    }
    
    function openOnline() {
      ipcRenderer.send('doc-open-online');
    }
    
    // Add IDs to headings for navigation
    document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((heading, index) => {
      if (!heading.id) {
        heading.id = 'heading-' + index;
      }
    });
    
    // Handle external links
    document.querySelectorAll('a[href^="http"]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        require('electron').shell.openExternal(link.href);
      });
    });
  </script>
</body>
</html>`;
  }

  private renderNavigation(entries: NavigationEntry[], level: number = 1): string {
    return entries.map(entry => {
      const childrenHtml = entry.children && entry.children.length > 0 
        ? this.renderNavigation(entry.children, level + 1) 
        : '';
      
      return `
        <li class="nav-item">
          <a href="#${entry.id}" class="nav-link level-${entry.level}">${entry.title}</a>
          ${childrenHtml ? `<ul class="nav-tree">${childrenHtml}</ul>` : ''}
        </li>
      `;
    }).join('');
  }
}