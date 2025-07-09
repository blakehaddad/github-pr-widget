// GitHub Personal Access Token - reads from stored settings
const { ipcRenderer: rendererIpc } = require('electron');

interface PullRequest {
  id: number;
  title: string;
  html_url: string;
  repository_url: string;
  state: string;
  draft: boolean;
  created_at: string;
  updated_at: string;
}

interface GitHubResponse {
  items: PullRequest[];
}

class GitHubPRWidget {
  private container: HTMLElement;
  private loading: HTMLElement;
  private refreshBtn: HTMLButtonElement;
  private lastUpdated: HTMLElement;
  private refreshInterval: NodeJS.Timeout | null = null;
  private githubToken: string = '';

  constructor() {
    this.container = document.getElementById('container')!;
    this.loading = document.getElementById('loading')!;
    this.refreshBtn = document.getElementById('refreshBtn') as HTMLButtonElement;
    this.lastUpdated = document.getElementById('lastUpdated')!;

    this.init();
  }

  private async init(): Promise<void> {
    this.refreshBtn.addEventListener('click', () => this.fetchPullRequests());
    
    // Listen for token updates
    rendererIpc.on('token-updated', () => {
      this.loadTokenAndFetch();
    });
    
    // Initial load
    await this.loadTokenAndFetch();
    
    // Set up auto-refresh every 10 minutes
    this.refreshInterval = setInterval(() => {
      this.fetchPullRequests();
    }, 10 * 60 * 1000);
  }

  private async loadTokenAndFetch(): Promise<void> {
    try {
      this.githubToken = await rendererIpc.invoke('get-github-token');
      if (!this.githubToken) {
        this.showError('No GitHub token configured. Please go to Settings to add your token.');
        return;
      }
      await this.fetchPullRequests();
    } catch (error) {
      console.error('Error loading token:', error);
      this.showError('Failed to load GitHub token');
    }
  }

  private async fetchPullRequests(): Promise<void> {
    try {
      this.setLoading(true);
      
      if (!this.githubToken) {
        this.showError('No GitHub token configured. Please go to Settings to add your token.');
        return;
      }
      
      // Search for PRs where current user is the author
      const response = await fetch('https://api.github.com/search/issues?q=is:pr+is:open+author:@me', {
        headers: {
          'Authorization': `token ${this.githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'GitHub-PR-Widget'
        }
      });

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
      }

      const data: GitHubResponse = await response.json();
      this.renderPullRequests(data.items);
      this.updateLastUpdated();
      
    } catch (error) {
      console.error('Error fetching pull requests:', error);
      this.showError(error instanceof Error ? error.message : 'Unknown error occurred');
    } finally {
      this.setLoading(false);
    }
  }

  private renderPullRequests(pullRequests: PullRequest[]): void {
    if (pullRequests.length === 0) {
      this.container.innerHTML = '<div class="loading">No open pull requests found</div>';
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
      
      // Truncate title to 35 characters with ellipsis
      const truncatedTitle = pr.title.length > 35 ? pr.title.substring(0, 35) + '...' : pr.title;

      prItem.innerHTML = `
        <div class="pr-title">
          <a href="${pr.html_url}" target="_blank" title="${this.escapeHtml(pr.title)}">${this.escapeHtml(truncatedTitle)}</a>
        </div>
        <div class="pr-meta">
          <span class="pr-repo">${this.escapeHtml(repoName)}</span>
          <span class="pr-state ${state}">${stateDisplay}</span>
        </div>
      `;

      prList.appendChild(prItem);
    });

    this.container.innerHTML = '';
    this.container.appendChild(prList);
  }

  private setLoading(isLoading: boolean): void {
    this.refreshBtn.disabled = isLoading;
    this.refreshBtn.textContent = isLoading ? 'Loading...' : 'Refresh';
    
    if (isLoading) {
      this.loading.style.display = 'block';
    } else {
      this.loading.style.display = 'none';
    }
  }

  private showError(message: string): void {
    this.container.innerHTML = `<div class="error">Error: ${this.escapeHtml(message)}</div>`;
  }

  private updateLastUpdated(): void {
    const now = new Date();
    const timeString = now.toLocaleTimeString();
    this.lastUpdated.textContent = `Last updated: ${timeString}`;
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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