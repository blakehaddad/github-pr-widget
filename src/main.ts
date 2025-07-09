import { app, BrowserWindow, shell, Menu, MenuItemConstructorOptions, ipcMain } from 'electron';
import * as path from 'path';
import Store from 'electron-store';

let mainWindow: BrowserWindow;
let settingsWindow: BrowserWindow | null = null;
const store = new Store();

const createWindow = (): void => {
  mainWindow = new BrowserWindow({
    height: 300,
    width: 380,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    alwaysOnTop: true,
    resizable: true,
    frame: false,
    show: false,
  });

  mainWindow.loadFile(path.join(__dirname, '../src/renderer.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Handle navigation to external links
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== mainWindow.webContents.getURL()) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // Toggle dev tools with Cmd+Option+I (Mac) or Ctrl+Shift+I (Windows/Linux)  
  mainWindow.webContents.on('before-input-event', (_, input) => {
    if (input.key === 'F12' || 
        (input.key === 'i' && input.meta && input.alt) || // Cmd+Option+I on Mac
        (input.key === 'I' && input.control && input.shift)) { // Ctrl+Shift+I on Windows/Linux
      mainWindow.webContents.toggleDevTools();
    }
  });
};

const createMenu = (): void => {
  const template: MenuItemConstructorOptions[] = [
    {
      label: 'GitHub PR Widget',
      submenu: [
        {
          label: 'Always on Top',
          type: 'checkbox',
          checked: true,
          click: (menuItem) => {
            mainWindow.setAlwaysOnTop(menuItem.checked);
          }
        },
        { type: 'separator' },
        {
          label: 'Settings...',
          accelerator: process.platform === 'darwin' ? 'Cmd+,' : 'Ctrl+,',
          click: () => {
            createSettingsWindow();
          }
        },
        { type: 'separator' },
        {
          label: 'Toggle Developer Tools',
          accelerator: process.platform === 'darwin' ? 'Cmd+Alt+I' : 'Ctrl+Shift+I',
          click: () => {
            mainWindow.webContents.toggleDevTools();
          }
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    }
  ];

  // On macOS, add standard Edit menu for copy/paste functionality
  if (process.platform === 'darwin') {
    template.push({
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
};

const createSettingsWindow = (): void => {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 500,
    height: 400,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    parent: mainWindow,
    modal: false,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    show: false,
  });

  settingsWindow.loadFile(path.join(__dirname, 'settings.html'));

  settingsWindow.once('ready-to-show', () => {
    settingsWindow?.show();
  });

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
};

// IPC handlers for settings
ipcMain.handle('get-github-token', () => {
  return (store as any).get('githubToken', '');
});

ipcMain.handle('set-github-token', (_, token: string) => {
  (store as any).set('githubToken', token);
  // Refresh the main window to use the new token
  mainWindow.webContents.send('token-updated');
  return true;
});

ipcMain.handle('open-external', (_, url: string) => {
  shell.openExternal(url);
});

ipcMain.handle('close-settings', () => {
  if (settingsWindow) {
    settingsWindow.close();
  }
});

app.whenReady().then(() => {
  createWindow();
  createMenu();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Export store for main window access
ipcMain.handle('get-store-value', (_, key: string) => {
  return (store as any).get(key);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});