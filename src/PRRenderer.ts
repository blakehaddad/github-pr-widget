/// <reference path="./GithubProvider.ts" />

class PRRenderer {
  private static escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private static renderStatusIndicator(type: 'ci' | 'review', status?: string): string {
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

  private static renderGraphiteButton(graphiteUrl: string): string {
    return `<button class="graphite-btn" data-graphite-url="${graphiteUrl}" data-tooltip="View in Graphite 📚">📚</button>`;
  }

  public static renderPRItem(pr: PullRequest, isPreview: boolean = false): HTMLElement {
    const prItem = document.createElement('div');
    prItem.className = 'pr-item animate-fade-in-up';

    const state = pr.draft ? 'draft' : pr.state;
    const stateDisplay = pr.draft ? 'Draft' : pr.state;
    
    // Extract repo name from repository_url
    const repoName = pr.repository_url.split('/').pop() || 'Unknown';
    
    const titleElement = isPreview 
      ? `<span class="block overflow-hidden text-ellipsis whitespace-nowrap" title="${this.escapeHtml(pr.title)}">${this.escapeHtml(pr.title)}</span>`
      : `<a href="${pr.html_url}" target="_blank" class="block overflow-hidden text-ellipsis whitespace-nowrap text-[var(--text-primary)] no-underline transition-all duration-300 hover:text-[var(--primary-color)] hover:text-shadow-[0_0_12px_var(--primary-color)]" title="${this.escapeHtml(pr.title)}">${this.escapeHtml(pr.title)}</a>`;
    
    prItem.innerHTML = `
      <div class="flex items-center gap-3 mb-2">
        <img class="w-6 h-6 rounded-full border-2 border-white/10 bg-[var(--bg-secondary)] flex-shrink-0 shadow-[0_1px_0_rgba(255,255,255,0.1)_inset,0_2px_8px_rgba(0,0,0,0.3)]" src="${pr.user.avatar_url}" alt="${pr.user.login}" onerror="this.style.display='none'">
        <div class="flex-1 text-sm font-medium text-[var(--text-primary)] leading-[1.4] min-w-0 text-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
          ${titleElement}
        </div>
        <div class="flex gap-2 items-center flex-shrink-0">
          ${this.renderStatusIndicator('ci', pr.ci_status)}
          ${this.renderStatusIndicator('review', pr.review_status)}
          ${pr.graphite_url && !isPreview ? this.renderGraphiteButton(pr.graphite_url) : ''}
        </div>
      </div>
      <div class="flex justify-between items-center text-xs text-[var(--text-secondary)] ml-9">
        <span class="font-medium opacity-90 whitespace-nowrap overflow-hidden text-ellipsis flex-1 mr-3">${this.escapeHtml(repoName)}</span>
        <span class="pr-state-${state} text-[9px] font-semibold rounded-xl uppercase tracking-[0.3px] whitespace-nowrap flex-shrink-0 border border-transparent transition-all duration-300 backdrop-blur-sm" style="padding: 3px 8px;">${stateDisplay}</span>
      </div>
    `;
    
    // Add click handler only for non-preview items
    if (!isPreview) {
      prItem.addEventListener('click', (event) => {
        const target = event.target as HTMLElement;
        
        // Don't handle clicks on status indicators to allow tooltips
        if (target.classList.contains('status-indicator')) {
          return;
        }
        
        const graphiteBtn = target.closest('.graphite-btn') as HTMLElement;
        
        if (graphiteBtn) {
          // Handle Graphite button click
          const graphiteUrl = graphiteBtn.getAttribute('data-graphite-url');
          if (graphiteUrl) {
            const { ipcRenderer } = require('electron');
            ipcRenderer.invoke('open-external', graphiteUrl);
          }
        } else {
          // Handle regular PR click
          const { ipcRenderer } = require('electron');
          ipcRenderer.invoke('open-external', pr.html_url);
        }
      });
    }

    return prItem;
  }

  public static createMockPR(): PullRequest {
    return {
      id: 1,
      number: 123,
      html_url: '#',
      title: 'Add theme customization feature',
      user: {
        avatar_url: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTAiIGZpbGw9IiM1OEE2RkYiLz4KPHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2ZmZiI+CjxwYXRoIGQ9Ik0xMiAxMmMxLjEwNSAwIDItLjg5NSAyLTJzLS44OTUtMi0yLTItMiAuODk1LTIgMiAuODk1IDIgMiAyem0wIDJjLTIuMjEgMC00IDEuNzktNCA0djFoOHYtMWMwLTIuMjEtMS43OS00LTQtNCIvPgo8L3N2Zz4KPC9zdmc+',
        login: 'developer'
      },
      repository_url: 'https://api.github.com/repos/user/awesome-project',
      draft: false,
      state: 'open',
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T00:00:00Z',
      ci_status: 'failure',
      review_status: 'approved'
    };
  }
}