interface PullRequest {
  id: number;
  number: number;
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
  ci_status?: 'success' | 'failure' | 'pending' | 'unknown';
  review_status?: 'approved' | 'changes_requested' | 'pending' | 'unknown';
}

interface GitHubResponse {
  items: PullRequest[];
}

class GithubProvider {
  private githubToken: string = '';

  constructor(token: string) {
    this.githubToken = token;
  }

  public setToken(token: string): void {
    this.githubToken = token;
  }

  public async fetchPullRequests(): Promise<PullRequest[]> {
    if (!this.githubToken) {
      throw new Error('No GitHub token configured');
    }

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
    
    const pullRequestsWithStatus = await Promise.all(
      data.items.map(async (pr) => {
        const [ci_status, review_status] = await Promise.all([
          this.fetchCIStatus(pr),
          this.fetchReviewStatus(pr)
        ]);
        return { ...pr, ci_status, review_status };
      })
    );

    return pullRequestsWithStatus;
  }

  private async fetchCIStatus(pr: PullRequest): Promise<'success' | 'failure' | 'pending' | 'unknown'> {
    try {
      const urlParts = pr.repository_url.split('/');
      const owner = urlParts[urlParts.length - 2];
      const repo = urlParts[urlParts.length - 1];
      
      const prResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${pr.number}`, {
        headers: {
          'Authorization': `token ${this.githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'GitHub-PR-Widget'
        }
      });

      if (!prResponse.ok) {
        return 'unknown';
      }

      const prData = await prResponse.json();
      const headSha = prData.head.sha;
      
      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits/${headSha}/check-runs`, {
        headers: {
          'Authorization': `token ${this.githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'GitHub-PR-Widget'
        }
      });

      if (!response.ok) {
        return 'unknown';
      }

      const data = await response.json();
      const checkRuns = data.check_runs || [];
      
      if (checkRuns.length === 0) {
        return 'unknown';
      }
      
      const hasFailure = checkRuns.some((run: any) => run.conclusion === 'failure');
      if (hasFailure) {
        return 'failure';
      }
      
      const allSuccess = checkRuns.every((run: any) => run.conclusion === 'success');
      if (allSuccess) {
        return 'success';
      }
      
      return 'pending';
    } catch (error) {
      console.error('Error fetching CI status:', error);
      return 'unknown';
    }
  }

  private async fetchReviewStatus(pr: PullRequest): Promise<'approved' | 'changes_requested' | 'pending' | 'unknown'> {
    try {
      const urlParts = pr.repository_url.split('/');
      const owner = urlParts[urlParts.length - 2];
      const repo = urlParts[urlParts.length - 1];
      
      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${pr.number}/reviews`, {
        headers: {
          'Authorization': `token ${this.githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'GitHub-PR-Widget'
        }
      });

      if (!response.ok) {
        return 'unknown';
      }

      const reviews = await response.json();
      
      if (reviews.length === 0) {
        return 'pending';
      }
      
      const latestReviews = new Map();
      reviews.forEach((review: any) => {
        if (review.user.login !== pr.user.login) {
          latestReviews.set(review.user.login, review);
        }
      });
      
      const reviewStates = Array.from(latestReviews.values()).map((review: any) => review.state);
      
      if (reviewStates.includes('CHANGES_REQUESTED')) {
        return 'changes_requested';
      }
      
      if (reviewStates.includes('APPROVED')) {
        return 'approved';
      }
      
      return 'pending';
    } catch (error) {
      console.error('Error fetching review status:', error);
      return 'unknown';
    }
  }
}