const { app, BrowserWindow } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const isDev = !app.isPackaged;

// Configuração básica do auto-updater
autoUpdater.autoDownload = true;
autoUpdater.allowPrerelease = false;

function createWindow() {
    const win = new BrowserWindow({
        width: 1280,
        height: 720,
        webPreferences: {
            nodeIntegration: false,
            contextBridge: true,
            preload: path.join(__dirname, 'preload.js')
        },
        backgroundColor: '#0a0a0c',
        icon: path.join(__dirname, 'public/favicon.ico'), // Garantir que o ícone exista
        title: 'Nexus Tactics'
    });

    win.setMenuBarVisibility(false);

    if (isDev) {
        win.loadURL('http://localhost:5173');
        // win.webContents.openDevTools();
    } else {
        win.loadFile(path.join(__dirname, 'dist/index.html'));
    }
}

app.whenReady().then(() => {
    createWindow();

    if (!isDev) {
        autoUpdater.checkForUpdatesAndNotify();
    }

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

// Eventos do Auto-updater para feedback (opcional: pode logar ou mandar pro front)
autoUpdater.on('update-available', () => {
    console.log('Atualização disponível!');
});

autoUpdater.on('update-downloaded', () => {
    console.log('Atualização baixada. O jogo será atualizado ao reiniciar.');
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
