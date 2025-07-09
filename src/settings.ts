/// <reference path="./PRRenderer.ts" />
const { ipcRenderer: settingsIpc } = require('electron');

// Helper function to convert HSL to hex
function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  
  if (0 <= h && h < 60) {
    r = c; g = x; b = 0;
  } else if (60 <= h && h < 120) {
    r = x; g = c; b = 0;
  } else if (120 <= h && h < 180) {
    r = 0; g = c; b = x;
  } else if (180 <= h && h < 240) {
    r = 0; g = x; b = c;
  } else if (240 <= h && h < 300) {
    r = x; g = 0; b = c;
  } else if (300 <= h && h < 360) {
    r = c; g = 0; b = x;
  }
  
  r = Math.round((r + m) * 255);
  g = Math.round((g + m) * 255);
  b = Math.round((b + m) * 255);
  
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

class SettingsManager {
  private tokenInput!: HTMLInputElement;
  private tokenForm!: HTMLFormElement;
  private saveBtn!: HTMLButtonElement;
  private errorMessage!: HTMLElement;
  private successMessage!: HTMLElement;
  private tokenStatus!: HTMLElement;
  private tokenLink!: HTMLElement;
  private closeBtn!: HTMLButtonElement;
  private closeSettingsBtn!: HTMLButtonElement;
  
  // Theme elements
  private bgPrimaryPicker!: HTMLInputElement;
  private bgSecondaryPicker!: HTMLInputElement;
  private textPrimaryPicker!: HTMLInputElement;
  private successColorPicker!: HTMLInputElement;
  private errorColorPicker!: HTMLInputElement;
  private resetThemeBtn!: HTMLButtonElement;
  private applyThemeBtn!: HTMLButtonElement;

  constructor() {
    try {
      this.tokenInput = document.getElementById('githubToken') as HTMLInputElement;
      this.tokenForm = document.getElementById('tokenForm') as HTMLFormElement;
      this.saveBtn = document.getElementById('saveBtn') as HTMLButtonElement;
      this.errorMessage = document.getElementById('errorMessage') as HTMLElement;
      this.successMessage = document.getElementById('successMessage') as HTMLElement;
      this.tokenStatus = document.getElementById('tokenStatus') as HTMLElement;
      this.tokenLink = document.getElementById('tokenLink') as HTMLElement;
      this.closeBtn = document.getElementById('closeBtn') as HTMLButtonElement;
      this.closeSettingsBtn = document.getElementById('closeSettingsBtn') as HTMLButtonElement;
      
      // Theme elements
      this.bgPrimaryPicker = document.getElementById('bgPrimary') as HTMLInputElement;
      this.bgSecondaryPicker = document.getElementById('bgSecondary') as HTMLInputElement;
      this.textPrimaryPicker = document.getElementById('textPrimary') as HTMLInputElement;
      this.successColorPicker = document.getElementById('successColor') as HTMLInputElement;
      this.errorColorPicker = document.getElementById('errorColor') as HTMLInputElement;
      this.resetThemeBtn = document.getElementById('resetTheme') as HTMLButtonElement;
      this.applyThemeBtn = document.getElementById('applyTheme') as HTMLButtonElement;

      // Check if elements were found
      if (!this.tokenInput || !this.tokenForm || !this.saveBtn) {
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
    
    // Load existing theme
    await this.loadTheme();
    
    // Set up event listeners
    this.tokenForm.addEventListener('submit', (e) => this.handleSubmit(e));
    this.tokenLink.addEventListener('click', (e) => this.handleTokenLinkClick(e));
    this.tokenInput.addEventListener('input', () => this.clearMessages());
    
    // Close button event listeners
    this.closeBtn.addEventListener('click', () => this.handleClose());
    this.closeSettingsBtn.addEventListener('click', () => this.handleClose());
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.handleClose();
      }
    });
    
    // Theme event listeners
    if (this.bgPrimaryPicker) {
      this.bgPrimaryPicker.addEventListener('input', () => this.updatePreview());
      this.bgSecondaryPicker.addEventListener('input', () => this.updatePreview());
      this.textPrimaryPicker.addEventListener('input', () => this.updatePreview());
      this.successColorPicker.addEventListener('input', () => this.updatePreview());
      this.errorColorPicker.addEventListener('input', () => this.updatePreview());
      this.resetThemeBtn.addEventListener('click', () => this.resetTheme());
      this.applyThemeBtn.addEventListener('click', () => this.applyTheme());
    }
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

  private handleClose(): void {
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

  // Theme management methods
  private async loadTheme(): Promise<void> {
    try {
      const theme = await settingsIpc.invoke('get-theme');
      if (theme && this.bgPrimaryPicker) {
        this.bgPrimaryPicker.value = theme.bgPrimary || '#0d1117';
        this.bgSecondaryPicker.value = theme.bgSecondary || '#161b22';
        this.textPrimaryPicker.value = theme.textPrimary || '#f0f6fc';
        this.successColorPicker.value = theme.successColor || '#28a745';
        this.errorColorPicker.value = theme.errorColor || '#f85149';
        
        this.updatePreview();
      }
    } catch (error) {
      console.error('Error loading theme:', error);
    }
  }

  private updatePreview(): void {
    const root = document.documentElement;
    
    // Apply current theme to preview (using default primary color)
    const primaryColor = '#58a6ff'; // Default blue
    
    root.style.setProperty('--primary-hue', '213');
    root.style.setProperty('--primary-saturation', '100%');
    root.style.setProperty('--primary-lightness', '76%');
    root.style.setProperty('--primary-color', primaryColor);
    
    root.style.setProperty('--bg-primary', this.bgPrimaryPicker.value);
    root.style.setProperty('--bg-secondary', this.bgSecondaryPicker.value);
    root.style.setProperty('--bg-tertiary', '#1c2128');
    root.style.setProperty('--text-primary', this.textPrimaryPicker.value);
    root.style.setProperty('--success-color', this.successColorPicker.value);
    root.style.setProperty('--error-color', this.errorColorPicker.value);
    root.style.setProperty('--warning-color', '#ffc107');
    
    // Use default accent colors
    root.style.setProperty('--accent-primary', 'rgba(88, 166, 255, 0.1)');
    root.style.setProperty('--accent-secondary', 'rgba(139, 148, 158, 0.08)');
    
    // Update the actual PR preview
    this.renderPreviewPR();
  }

  private renderPreviewPR(): void {
    const previewContainer = document.querySelector('.theme-preview');
    if (!previewContainer) return;
    
    // Create mock PR with both success and error states
    const mockPR = PRRenderer.createMockPR();
    
    // Create a PR list container
    const prList = document.createElement('div');
    prList.className = 'pr-list';
    prList.style.margin = '0';
    prList.style.padding = '0';
    
    // Render the PR item as a preview
    const prItem = PRRenderer.renderPRItem(mockPR, true);
    prList.appendChild(prItem);
    
    // Replace the preview content
    previewContainer.innerHTML = '';
    previewContainer.appendChild(prList);
  }

  private async resetTheme(): Promise<void> {
    try {
      // Reset to default values
      this.bgPrimaryPicker.value = '#0d1117';
      this.bgSecondaryPicker.value = '#161b22';
      this.textPrimaryPicker.value = '#f0f6fc';
      this.successColorPicker.value = '#28a745';
      this.errorColorPicker.value = '#f85149';
      
      this.updatePreview();
      this.showSuccess('Theme reset to default!');
    } catch (error) {
      this.showError('Failed to reset theme');
    }
  }

  private async applyTheme(): Promise<void> {
    try {
      const theme = {
        primaryHue: 213,
        primarySaturation: 100,
        primaryLightness: 76,
        bgPrimary: this.bgPrimaryPicker.value,
        bgSecondary: this.bgSecondaryPicker.value,
        bgTertiary: '#1c2128',
        accentPrimary: 'rgba(88, 166, 255, 0.1)',
        accentSecondary: 'rgba(139, 148, 158, 0.08)',
        textPrimary: this.textPrimaryPicker.value,
        textSecondary: '#8b949e',
        successColor: this.successColorPicker.value,
        errorColor: this.errorColorPicker.value,
        warningColor: '#ffc107',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderColorHover: 'rgba(88, 166, 255, 0.3)'
      };

      await settingsIpc.invoke('set-theme', theme);
      this.showSuccess('Theme applied successfully!');
      
    } catch (error) {
      this.showError('Failed to apply theme');
      console.error('Error applying theme:', error);
    }
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