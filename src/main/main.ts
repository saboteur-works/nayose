import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { registerVaultHandlers } from './ipc/vault-handlers.ts';

const isDev = !app.isPackaged;

// IPC round-trip test handler: renderer sends a ping payload, main echoes it
// back with a marker proving the message was handled in the main process.
ipcMain.handle('nayose:ping', (_event, payload: string) => {
  return `pong:${payload}`;
});

function createWindow(): void {
  const window = new BrowserWindow({
    width: 900,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    void window.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    void window.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  }
}

void app.whenReady().then(() => {
  registerVaultHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
