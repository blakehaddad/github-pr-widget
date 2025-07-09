// GitHub Personal Access Token - reads from stored settings
/// <reference path="./GithubProvider.ts" />
/// <reference path="./PRRenderer.ts" />

const { ipcRenderer: rendererIpc } = require('electron');
const fs = require('fs');
const path = require('path');

// Design tokens - single source of truth for layout dimensions
const DESIGN_TOKENS = {
  headerHeight: 41,
  prItemHeight: 58,
  prListGap: 8,
  containerPadding: 40,
  resizeZoneHeight: 15,
  emptyStateHeight: 180,
  loadingHeight: 140,
  bufferHeight: 15,
  minWindowHeight: 220
} as const;

// Default theme colors
const DEFAULT_THEME = {
  // Primary accent color (blue)
  primaryHue: 213,
  primarySaturation: 100,
  primaryLightness: 76,
  
  // Background gradients
  bgPrimary: '#0d1117',
  bgSecondary: '#161b22', 
  bgTertiary: '#1c2128',
  
  // Accent colors for gradients
  accentPrimary: 'rgba(88, 166, 255, 0.1)',
  accentSecondary: 'rgba(139, 148, 158, 0.08)',
  
  // Text colors
  textPrimary: '#f0f6fc',
  textSecondary: '#8b949e',
  
  // Status colors
  successColor: '#28a745',
  errorColor: '#f85149',
  warningColor: '#ffc107',
  
  // Interactive elements
  borderColor: 'rgba(255, 255, 255, 0.1)',
  borderColorHover: 'rgba(88, 166, 255, 0.3)'
} as const;

interface ThemeColors {
  primaryHue: number;
  primarySaturation: number;
  primaryLightness: number;
  bgPrimary: string;
  bgSecondary: string;
  bgTertiary: string;
  accentPrimary: string;
  accentSecondary: string;
  textPrimary: string;
  textSecondary: string;
  successColor: string;
  errorColor: string;
  warningColor: string;
  borderColor: string;
  borderColorHover: string;
}

interface PullRequest {
  id: number;
  number: number; // PR number (different from id)
  title: string;
  html_url: string;
  repository_url: string;
  state: string;
  draft: boolean;
  created_at: string;
  updated_at: string;
  user: {
    login: string;
    avatar_url: string;
  };
  // Status indicators (will be populated separately)
  ci_status?: 'success' | 'failure' | 'pending' | 'unknown';
  review_status?: 'approved' | 'changes_requested' | 'pending' | 'unknown';
  graphite_url?: string;
}

class ThemeManager {
  private currentTheme: ThemeColors = { ...DEFAULT_THEME };

  async loadTheme(): Promise<void> {
    try {
      const savedTheme = await rendererIpc.invoke('get-theme');
      if (savedTheme) {
        this.currentTheme = { ...DEFAULT_THEME, ...savedTheme };
      }
    } catch (error) {
      console.error('Error loading theme:', error);
    }
  }

  async saveTheme(theme: Partial<ThemeColors>): Promise<void> {
    this.currentTheme = { ...this.currentTheme, ...theme };
    try {
      await rendererIpc.invoke('set-theme', this.currentTheme);
    } catch (error) {
      console.error('Error saving theme:', error);
    }
  }

  async resetToDefault(): Promise<void> {
    this.currentTheme = { ...DEFAULT_THEME };
    try {
      await rendererIpc.invoke('set-theme', this.currentTheme);
    } catch (error) {
      console.error('Error resetting theme:', error);
    }
  }

  getTheme(): ThemeColors {
    return { ...this.currentTheme };
  }

  injectThemeVariables(): void {
    const root = document.documentElement;
    const theme = this.currentTheme;
    
    // Primary color as HSL for easy manipulation
    root.style.setProperty('--primary-hue', theme.primaryHue.toString());
    root.style.setProperty('--primary-saturation', `${theme.primarySaturation}%`);
    root.style.setProperty('--primary-lightness', `${theme.primaryLightness}%`);
    root.style.setProperty('--primary-color', `hsl(${theme.primaryHue}, ${theme.primarySaturation}%, ${theme.primaryLightness}%)`);
    
    // Background colors
    root.style.setProperty('--bg-primary', theme.bgPrimary);
    root.style.setProperty('--bg-secondary', theme.bgSecondary);
    root.style.setProperty('--bg-tertiary', theme.bgTertiary);
    
    // Accent colors
    root.style.setProperty('--accent-primary', theme.accentPrimary);
    root.style.setProperty('--accent-secondary', theme.accentSecondary);
    
    // Text colors
    root.style.setProperty('--text-primary', theme.textPrimary);
    root.style.setProperty('--text-secondary', theme.textSecondary);
    
    // Status colors
    root.style.setProperty('--success-color', theme.successColor);
    root.style.setProperty('--error-color', theme.errorColor);
    root.style.setProperty('--warning-color', theme.warningColor);
    
    // Interactive elements
    root.style.setProperty('--border-color', theme.borderColor);
    root.style.setProperty('--border-color-hover', theme.borderColorHover);
  }
}

class GitHubPRWidget {
  private container: HTMLElement;
  private loading: HTMLElement;
  private settingsBtn: HTMLButtonElement;
  private refreshBtn: HTMLButtonElement;
  private resizeZone: HTMLElement;
  private refreshInterval: NodeJS.Timeout | null = null;
  private githubToken: string = '';
  private githubProvider: GithubProvider;
  private currentPRs: PullRequest[] = [];
  private themeManager: ThemeManager;

  constructor() {
    this.container = document.getElementById('container')!;
    this.loading = document.getElementById('loading')!;
    this.settingsBtn = document.getElementById('settingsBtn') as HTMLButtonElement;
    this.refreshBtn = document.getElementById('refreshBtn') as HTMLButtonElement;
    this.resizeZone = document.getElementById('resizeZone')!;
    this.githubProvider = new GithubProvider('');
    this.themeManager = new ThemeManager();

    this.init();
  }

  private injectCSSVariables(): void {
    const root = document.documentElement;
    root.style.setProperty('--header-height', `${DESIGN_TOKENS.headerHeight}px`);
    root.style.setProperty('--pr-item-height', `${DESIGN_TOKENS.prItemHeight}px`);
    root.style.setProperty('--pr-list-gap', `${DESIGN_TOKENS.prListGap}px`);
    root.style.setProperty('--container-padding-top', '2px');
    root.style.setProperty('--container-padding-bottom', '12px');
    root.style.setProperty('--resize-zone-height', `${DESIGN_TOKENS.resizeZoneHeight}px`);
  }

  private loadRefreshIcon(): void {
    try {
      const iconPath = path.join(__dirname, '../src/assets/icons/refresh.svg');
      const iconSvg = fs.readFileSync(iconPath, 'utf8');
      this.refreshBtn.innerHTML = iconSvg;
    } catch (error) {
      console.error('Error loading refresh icon:', error);
      // Fallback to text if icon loading fails
      this.refreshBtn.innerHTML = '🔄';
    }
  }

  private async init(): Promise<void> {
    // Load theme and inject CSS variables
    await this.themeManager.loadTheme();
    this.injectCSSVariables();
    this.themeManager.injectThemeVariables();
    
    // Load refresh icon
    this.loadRefreshIcon();
    
    this.settingsBtn.addEventListener('click', () => {
      rendererIpc.invoke('open-settings');
    });

    this.refreshBtn.addEventListener('click', () => {
      this.fetchPullRequests();
    });

    // Add double-click event for auto-fit height
    this.resizeZone.addEventListener('dblclick', () => {
      this.autoFitHeight();
    });
    
    // Listen for token updates
    rendererIpc.on('token-updated', () => {
      this.loadTokenAndFetch();
    });

    // Listen for theme updates
    rendererIpc.on('theme-updated', async () => {
      await this.themeManager.loadTheme();
      this.themeManager.injectThemeVariables();
    });
    
    // Initial load
    await this.loadTokenAndFetch();
    
    // Set up auto-refresh every 30 seconds
    this.refreshInterval = setInterval(() => {
      this.fetchPullRequests(true); // true = silent refresh (no loading animation)
    }, 30 * 1000);
  }

  private async loadTokenAndFetch(): Promise<void> {
    try {
      this.githubToken = await rendererIpc.invoke('get-github-token');
      if (!this.githubToken) {
        this.showError('No GitHub token configured. Please go to Settings to add your token.');
        return;
      }
      this.githubProvider.setToken(this.githubToken);
      await this.fetchPullRequests();
    } catch (error) {
      console.error('Error loading token:', error);
      this.showError('Failed to load GitHub token');
    }
  }


  private async fetchPullRequests(silent: boolean = false): Promise<void> {
    try {
      if (!silent) {
        this.setLoading(true);
      }
      
      if (!this.githubToken) {
        this.showError('No GitHub token configured. Please go to Settings to add your token.');
        return;
      }
      
      const pullRequests = await this.githubProvider.fetchPullRequests();
      
      // Only update UI if data has changed
      if (this.hasPRsChanged(pullRequests)) {
        this.currentPRs = pullRequests;
        this.renderPullRequests(pullRequests);
      }
      
    } catch (error) {
      console.error('Error fetching pull requests:', error);
      // Only show error UI if not silent refresh
      if (!silent) {
        this.showError(error instanceof Error ? error.message : 'Unknown error occurred');
      }
    } finally {
      if (!silent) {
        this.setLoading(false);
      }
    }
  }

  private hasPRsChanged(newPRs: PullRequest[]): boolean {
    return JSON.stringify(this.currentPRs) !== JSON.stringify(newPRs);
  }

  private renderPullRequests(pullRequests: PullRequest[]): void {
    if (pullRequests.length === 0) {
      this.container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📋</div>
          <div class="empty-state-title">No pull requests found</div>
          <div class="empty-state-message">You don't have any open pull requests at the moment.</div>
        </div>
      `;
      return;
    }

    const prList = document.createElement('div');
    prList.className = 'pr-list';

    pullRequests.forEach(pr => {
      const prItem = PRRenderer.renderPRItem(pr, false);
      prList.appendChild(prItem);
    });

    this.container.innerHTML = '';
    this.container.appendChild(prList);
  }


  private setLoading(isLoading: boolean): void {
    this.settingsBtn.disabled = isLoading;
    
    if (isLoading) {
      this.loading.style.display = 'block';
    } else {
      this.loading.style.display = 'none';
    }
  }

  private showError(message: string): void {
    this.container.innerHTML = `<div class="error">${this.escapeHtml(message)}</div>`;
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private autoFitHeight(): void {
    let contentHeight: number;
    
    if (this.currentPRs.length === 0) {
      // Empty state or loading
      contentHeight = this.loading.style.display !== 'none' ? DESIGN_TOKENS.loadingHeight : DESIGN_TOKENS.emptyStateHeight;
    } else {
      // Calculate based on PR count: items + gaps between items + padding
      const gapHeight = Math.max(0, (this.currentPRs.length - 1) * DESIGN_TOKENS.prListGap);
      contentHeight = (this.currentPRs.length * DESIGN_TOKENS.prItemHeight) + gapHeight + DESIGN_TOKENS.containerPadding;
    }
    
    const totalHeight = DESIGN_TOKENS.headerHeight + contentHeight + DESIGN_TOKENS.resizeZoneHeight;
    
    // Set reasonable min/max bounds
    const maxHeight = Math.floor(window.screen.availHeight * 0.8); // 80% of screen height
    const finalHeight = Math.max(DESIGN_TOKENS.minWindowHeight, Math.min(totalHeight + DESIGN_TOKENS.bufferHeight, maxHeight));
    
    // Send resize request to main process
    rendererIpc.invoke('resize-window', finalHeight);
  }

  public destroy(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }
}

// Global theme manager instance for settings page access
let globalThemeManager: ThemeManager;

// Initialize the widget when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  const widget = new GitHubPRWidget();
  globalThemeManager = (widget as any).themeManager;
});

// Expose theme manager for settings window
(window as any).getThemeManager = () => globalThemeManager;

// Handle app closing
window.addEventListener('beforeunload', () => {
  // Cleanup if needed
});