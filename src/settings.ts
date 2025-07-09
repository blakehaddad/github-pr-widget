const { ipcRenderer: settingsIpc } = require('electron');

class SettingsManager {
  private tokenInput!: HTMLInputElement;
  private tokenForm!: HTMLFormElement;
  private cancelBtn!: HTMLButtonElement;
  private saveBtn!: HTMLButtonElement;
  private errorMessage!: HTMLElement;
  private successMessage!: HTMLElement;
  private tokenStatus!: HTMLElement;
  private tokenLink!: HTMLElement;

  constructor() {
    try {
      this.tokenInput = document.getElementById('githubToken') as HTMLInputElement;
      this.tokenForm = document.getElementById('tokenForm') as HTMLFormElement;
      this.cancelBtn = document.getElementById('cancelBtn') as HTMLButtonElement;
      this.saveBtn = document.getElementById('saveBtn') as HTMLButtonElement;
      this.errorMessage = document.getElementById('errorMessage') as HTMLElement;
      this.successMessage = document.getElementById('successMessage') as HTMLElement;
      this.tokenStatus = document.getElementById('tokenStatus') as HTMLElement;
      this.tokenLink = document.getElementById('tokenLink') as HTMLElement;

      // Check if elements were found
      if (!this.tokenInput || !this.tokenForm || !this.cancelBtn || !this.saveBtn) {
        throw new Error('Required elements not found');
      }

      this.init();
    } catch (error) {
      console.error('Error initializing SettingsManager:', error);
    }
  }

  private async init(): Promise<void> {
    // Load existing token
    const existingToken = await settingsIpc.invoke('get-github-token');
    this.updateTokenStatus(existingToken);
    
    // Set up event listeners
    this.tokenForm.addEventListener('submit', (e) => this.handleSubmit(e));
    this.cancelBtn.addEventListener('click', () => this.handleCancel());
    this.tokenLink.addEventListener('click', (e) => this.handleTokenLinkClick(e));
    this.tokenInput.addEventListener('input', () => this.clearMessages());
  }

  private updateTokenStatus(token: string): void {
    if (token && token !== '') {
      this.tokenStatus.textContent = 'GitHub token is configured ✓';
      this.tokenStatus.className = 'token-status has-token';
    } else {
      this.tokenStatus.textContent = 'No GitHub token configured';
      this.tokenStatus.className = 'token-status no-token';
    }
  }

  private async handleSubmit(e: Event): Promise<void> {
    e.preventDefault();
    
    const token = this.tokenInput.value.trim();
    
    if (!token) {
      this.showError('Please enter a GitHub token');
      return;
    }

    if (!this.validateToken(token)) {
      this.showError('Invalid token format. GitHub tokens start with "ghp_"');
      return;
    }

    this.saveBtn.disabled = true;
    this.saveBtn.textContent = 'Saving...';

    try {
      // Test the token by making a simple API call
      const response = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'GitHub-PR-Widget'
        }
      });

      if (!response.ok) {
        throw new Error('Invalid token or insufficient permissions');
      }

      // Token is valid, save it
      await settingsIpc.invoke('set-github-token', token);
      
      this.showSuccess('Token saved successfully!');
      this.updateTokenStatus(token);
      this.tokenInput.value = '';
      
      // Close settings window after a delay
      setTimeout(() => {
        settingsIpc.invoke('close-settings');
      }, 1500);
      
    } catch (error) {
      this.showError('Failed to validate token. Please check your token and try again.');
    } finally {
      this.saveBtn.disabled = false;
      this.saveBtn.textContent = 'Save Token';
    }
  }

  private validateToken(token: string): boolean {
    // GitHub personal access tokens start with "ghp_"
    return token.startsWith('ghp_') && token.length >= 40;
  }

  private handleCancel(): void {
    settingsIpc.invoke('close-settings');
  }

  private handleTokenLinkClick(e: Event): void {
    e.preventDefault();
    settingsIpc.invoke('open-external', 'https://github.com/settings/tokens');
  }

  private showError(message: string): void {
    this.errorMessage.textContent = message;
    this.errorMessage.style.display = 'block';
    this.successMessage.style.display = 'none';
  }

  private showSuccess(message: string): void {
    this.successMessage.textContent = message;
    this.successMessage.style.display = 'block';
    this.errorMessage.style.display = 'none';
  }

  private clearMessages(): void {
    this.errorMessage.style.display = 'none';
    this.successMessage.style.display = 'none';
  }
}

// Initialize settings when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  try {
    new SettingsManager();
  } catch (error) {
    console.error('Error creating SettingsManager:', error);
  }
});