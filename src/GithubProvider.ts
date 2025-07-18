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
  graphite_url?: string;
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
        const [ci_status, review_status, graphite_url] = await Promise.all([
          this.fetchCIStatus(pr),
          this.fetchReviewStatus(pr),
          this.fetchGraphiteUrl(pr)
        ]);
        return { ...pr, ci_status, review_status, graphite_url };
      })
    );

    return pullRequestsWithStatus;
  }

  private async fetchCIStatus(pr: PullRequest): Promise<'success' | 'failure' | 'pending' | 'unknown'> {
    try {
      const urlParts = pr.repository_url.split('/');
      const owner = urlParts[urlParts.length - 2];
      const repo = urlParts[urlParts.length - 1];
      
      // Use GraphQL to get the current PR status including PR-level checks
      const graphqlQuery = `
        query($owner: String!, $repo: String!, $number: Int!) {
          repository(owner: $owner, name: $repo) {
            pullRequest(number: $number) {
              statusCheckRollup {
                state
              }
            }
          }
        }
      `;
      
      const graphqlResponse = await fetch('https://api.github.com/graphql', {
        method: 'POST',
        headers: {
          'Authorization': `token ${this.githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'GitHub-PR-Widget',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: graphqlQuery,
          variables: {
            owner: owner,
            repo: repo,
            number: pr.number
          }
        })
      });

      if (!graphqlResponse.ok) {
        return 'unknown';
      }

      const graphqlData = await graphqlResponse.json();
      
      // Log the response for debugging
      console.log(`GraphQL status response for PR #${pr.number}:`, graphqlData);
      
      const rollupState = graphqlData?.data?.repository?.pullRequest?.statusCheckRollup?.state;
      
      if (!rollupState) {
        return 'unknown';
      }
      
      // Map GitHub GraphQL states to our simplified status types
      switch (rollupState) {
        case 'SUCCESS':
          return 'success';
        case 'FAILURE':
        case 'ERROR':
          return 'failure';
        case 'PENDING':
        case 'EXPECTED':
          return 'pending';
        default:
          return 'unknown';
      }
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

  private async fetchGraphiteUrl(pr: PullRequest): Promise<string | undefined> {
    try {
      const urlParts = pr.repository_url.split('/');
      const owner = urlParts[urlParts.length - 2];
      const repo = urlParts[urlParts.length - 1];
      
      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues/${pr.number}/comments`, {
        headers: {
          'Authorization': `token ${this.githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'GitHub-PR-Widget'
        }
      });

      if (!response.ok) {
        return undefined;
      }

      const comments = await response.json();
      
      // Look for Graphite bot comments
      for (const comment of comments) {
        const body = comment.body || '';
        
        // Check if it's a Graphite-managed PR comment
        if (body.includes('managed by Graphite') || body.includes('View in Graphite')) {
          // Extract Graphite URL from the comment
          const graphiteUrlMatch = body.match(/https:\/\/app\.graphite\.dev\/[^\s)]+/);
          if (graphiteUrlMatch) {
            return graphiteUrlMatch[0];
          }
        }
      }
      
      return undefined;
    } catch (error) {
      console.error('Error fetching Graphite URL:', error);
      return undefined;
    }
  }
}