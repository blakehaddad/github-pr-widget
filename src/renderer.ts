// GitHub Personal Access Token - reads from GITHUB_PAT environment variable
const GITHUB_TOKEN = process.env.GITHUB_PAT || 'ghp_your_token_here';

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

  constructor() {
    this.container = document.getElementById('container')!;
    this.loading = document.getElementById('loading')!;
    this.refreshBtn = document.getElementById('refreshBtn') as HTMLButtonElement;
    this.lastUpdated = document.getElementById('lastUpdated')!;

    this.init();
  }

  private init(): void {
    this.refreshBtn.addEventListener('click', () => this.fetchPullRequests());
    
    // Initial load
    this.fetchPullRequests();
    
    // Set up auto-refresh every 10 minutes
    this.refreshInterval = setInterval(() => {
      this.fetchPullRequests();
    }, 10 * 60 * 1000);
  }

  private async fetchPullRequests(): Promise<void> {
    try {
      this.setLoading(true);
      
      // Search for PRs where current user is the author
      const response = await fetch('https://api.github.com/search/issues?q=is:pr+is:open+author:@me', {
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
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

      prItem.innerHTML = `
        <div class="pr-title">
          <a href="${pr.html_url}" target="_blank">${this.escapeHtml(pr.title)}</a>
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