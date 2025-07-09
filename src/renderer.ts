// GitHub Personal Access Token - reads from stored settings
/// <reference path="./GithubProvider.ts" />

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

  constructor() {
    this.container = document.getElementById('container')!;
    this.loading = document.getElementById('loading')!;
    this.settingsBtn = document.getElementById('settingsBtn') as HTMLButtonElement;
    this.refreshBtn = document.getElementById('refreshBtn') as HTMLButtonElement;
    this.resizeZone = document.getElementById('resizeZone')!;
    this.githubProvider = new GithubProvider('');

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
    // Inject CSS variables from design tokens
    this.injectCSSVariables();
    
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
      const prItem = document.createElement('div');
      prItem.className = 'pr-item';

      const state = pr.draft ? 'draft' : pr.state;
      const stateDisplay = pr.draft ? 'Draft' : pr.state;
      
      // Extract repo name from repository_url (e.g., "https://api.github.com/repos/user/repo" -> "repo")
      const repoName = pr.repository_url.split('/').pop() || 'Unknown';
      
      // Don't truncate in JS - let CSS handle it with available space

      prItem.innerHTML = `
        <div class="pr-header">
          <img class="pr-avatar" src="${pr.user.avatar_url}" alt="${pr.user.login}" onerror="this.style.display='none'">
          <div class="pr-title">
            <a href="${pr.html_url}" target="_blank" title="${this.escapeHtml(pr.title)}">${this.escapeHtml(pr.title)}</a>
          </div>
          <div class="pr-status-indicators">
            ${this.renderStatusIndicator('ci', pr.ci_status)}
            ${this.renderStatusIndicator('review', pr.review_status)}
            ${pr.graphite_url ? this.renderGraphiteButton(pr.graphite_url) : ''}
          </div>
        </div>
        <div class="pr-meta">
          <span class="pr-repo">${this.escapeHtml(repoName)}</span>
          <span class="pr-state ${state}">${stateDisplay}</span>
        </div>
      `;
      
      // Add click handler to open PR (but not when clicking on buttons)
      prItem.addEventListener('click', (event) => {
        const target = event.target as HTMLElement;
        const graphiteBtn = target.closest('.graphite-btn') as HTMLElement;
        
        if (graphiteBtn) {
          // Handle Graphite button click
          const graphiteUrl = graphiteBtn.getAttribute('data-graphite-url');
          if (graphiteUrl) {
            rendererIpc.invoke('open-external', graphiteUrl);
          }
        } else {
          // Handle regular PR click
          rendererIpc.invoke('open-external', pr.html_url);
        }
      });

      prList.appendChild(prItem);
    });

    this.container.innerHTML = '';
    this.container.appendChild(prList);
  }

  private renderStatusIndicator(type: 'ci' | 'review', status?: string): string {
    if (!status) return '';
    
    const icons = {
      ci: {
        success: '✓',
        failure: '✗',
        pending: '⏳',
        unknown: '?'
      },
      review: {
        approved: '✓',
        changes_requested: '✗',
        pending: '⏳',
        unknown: '?'
      }
    };
    
    const icon = icons[type][status as keyof typeof icons[typeof type]] || '?';
    const className = `status-indicator ${type}-${status}`;
    
    // Enhanced tooltips with clear descriptions
    const tooltips = {
      ci: {
        success: 'CI Checks: Passed ✓',
        failure: 'CI Checks: Fail ✗',
        pending: 'CI Checks: Running ⏳',
        unknown: 'CI Checks: Unknown ?'
      },
      review: {
        approved: 'Code Review: Approved by reviewer(s) ✓',
        changes_requested: 'Code Review: Changes requested ✗',
        pending: 'Code Review: Waiting for review ⏳',
        unknown: 'Code Review: No review activity ?'
      }
    };
    
    const title = tooltips[type][status as keyof typeof tooltips[typeof type]] || 'Status unknown';
    
    return `<span class="${className}" data-tooltip="${title}">${icon}</span>`;
  }

  private renderGraphiteButton(graphiteUrl: string): string {
    return `<button class="graphite-btn" data-graphite-url="${graphiteUrl}" data-tooltip="View in Graphite 📚">📚</button>`;
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

// Initialize the widget when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new GitHubPRWidget();
});

// Handle app closing
window.addEventListener('beforeunload', () => {
  // Cleanup if needed
});