# GitHub PR Widget

A floating Electron app that displays your GitHub pull requests in a clean, always-on-top window.

## Features

- 🪟 **Floating Window**: Always-on-top, resizable window (~400x600)
- 🔗 **Clickable Links**: PR titles open in your default browser
- 🎨 **Dark Theme**: Clean, modern interface with dark styling
- 🔄 **Auto-refresh**: Updates every 10 minutes + manual refresh button
- 📱 **Responsive**: Scrollable list that adapts to window size
- 🖱️ **Draggable**: Move window by dragging the header
- 🚫 **Frameless**: Seamless look without title bar

## Quick Start

### Option 1: Download Pre-built App (Recommended)

1. Go to the [Releases](https://github.com/blakehaddad/github-pr-widget/releases) page
2. Download the latest `.dmg` file for macOS
3. Double-click the `.dmg` file and drag the app to your Applications folder
4. Launch the app from Launchpad or Applications folder
5. Set your GitHub token via environment variable or edit the code

### Option 2: Build from Source

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set your GitHub Personal Access Token:
   ```bash
   export GITHUB_PAT=your_github_token_here
   ```

3. Build and run:
   ```bash
   npm run build
   npm start
   ```

### Option 3: Build Your Own Installer

```bash
# Build for macOS
npm run dist:mac

# Build for Windows
npm run dist:win

# Build for Linux
npm run dist:linux

# Build for all platforms
npm run dist
```

## Scripts

- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Build and run the app
- `npm run dev` - Build and run in development mode
- `npm run pack` - Build unpacked app for testing
- `npm run dist` - Build distributable for all platforms
- `npm run dist:mac` - Build macOS `.dmg` installer
- `npm run dist:win` - Build Windows `.exe` installer
- `npm run dist:linux` - Build Linux AppImage

## Configuration

The app reads your GitHub token from the `GITHUB_PAT` environment variable. If not set, it falls back to a hardcoded value in `src/renderer.ts`.

## Keyboard Shortcuts

- **F12** / **Cmd+Option+I** / **Ctrl+Shift+I** - Toggle developer tools
- **Cmd+Q** (Mac) / **Alt+F4** (Windows/Linux) - Quit app

## Tech Stack

- **Electron** - Desktop app framework
- **TypeScript** - Type-safe JavaScript
- **GitHub REST API** - Fetch pull request data
- **Plain JavaScript + DOM** - No frontend framework dependencies

## Project Structure

```
src/
├── main.ts          # Electron main process
├── renderer.html    # UI structure and styling
└── renderer.ts      # GitHub API integration and UI logic

## Releases

Automated releases are created via GitHub Actions when you push a git tag:

```bash
git tag v1.0.0
git push origin v1.0.0
```

This will automatically:
- Build the app for macOS, Windows, and Linux
- Create a GitHub release with downloadable installers
- Generate release notes from commit messages