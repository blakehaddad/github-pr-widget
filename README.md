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

## Setup

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

## Scripts

- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Build and run the app
- `npm run dev` - Build and run in development mode

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
```