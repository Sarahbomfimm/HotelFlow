const path = require('path');
const { app, BrowserWindow, Tray, Menu, ipcMain, Notification, nativeImage } = require('electron');

let mainWindow;
let tray;
let isQuitting = false;

function getStartUrl() {
    const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
    const isDev = !app.isPackaged;
    return isDev ? devUrl : `file://${path.join(__dirname, '..', 'dist', 'index.html')}`;
}

function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 1366,
        height: 860,
        minWidth: 1100,
        minHeight: 720,
        show: false,
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
        },
    });

    const startUrl = getStartUrl();
    if (startUrl.startsWith('http')) {
        mainWindow.loadURL(startUrl);
    } else {
        mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
    }

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    mainWindow.on('close', (event) => {
        if (!isQuitting) {
            event.preventDefault();
            mainWindow.hide();

            if (tray && Notification.isSupported()) {
                const notification = new Notification({
                    title: 'HotelFlow continua ativo',
                    body: 'O app foi minimizado para a bandeja do sistema.',
                });
                notification.show();
            }
        }
    });
}

function createTray() {
    const trayImage = nativeImage.createFromPath(process.execPath);
    tray = new Tray(trayImage);

    const trayMenu = Menu.buildFromTemplate([
        {
            label: 'Abrir HotelFlow',
            click: () => {
                if (!mainWindow) return;
                mainWindow.show();
                mainWindow.focus();
            },
        },
        {
            type: 'separator',
        },
        {
            label: 'Sair',
            click: () => {
                isQuitting = true;
                app.quit();
            },
        },
    ]);

    tray.setToolTip('HotelFlow');
    tray.setContextMenu(trayMenu);
    tray.on('double-click', () => {
        if (!mainWindow) return;
        mainWindow.show();
        mainWindow.focus();
    });
}

function setupIpc() {
    ipcMain.handle('desktop:notify', (_, payload) => {
        const title = payload?.title || 'HotelFlow';
        const body = payload?.body || '';

        if (!Notification.isSupported()) {
            return false;
        }

        const notification = new Notification({ title, body });
        notification.show();
        return true;
    });
}

app.setAppUserModelId('com.hotelflow.desktop');

app.whenReady().then(() => {
    setupIpc();
    createMainWindow();
    createTray();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createMainWindow();
        } else if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
        }
    });
});

app.on('before-quit', () => {
    isQuitting = true;
});

app.on('window-all-closed', () => {
    // Mantemos o app ativo na bandeja para continuar notificando.
});
