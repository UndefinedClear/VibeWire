// main.js
const { app, BrowserWindow } = require('electron');
const path = require('path');
const config = require('./config');

const lurl = config.LOAD_URL

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1500,
    height: 900,
    // Исправлено: правильный путь к иконке
    // Для лучшей совместимости:
    icon: process.platform === 'win32' 
    ? path.join(__dirname, 'icon.ico') 
    : path.join(__dirname, 'icon.png'),
    
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    
    // Скрываем меню для этого окна (Windows/Linux)
    autoHideMenuBar: true
  });

  mainWindow.loadURL(lurl);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Для Windows - установка иконки при запуске приложения
if (process.platform === 'win32') {
  app.setAppUserModelId('com.undefinedclear.vts'); // Замените на ваш ID
}