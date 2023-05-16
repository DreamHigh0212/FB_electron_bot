/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable no-undef */
// main.js

const { app, BrowserWindow } = require("electron");
const path = require("path");
const isDev = require("electron-is-dev");

let mainWindow;
const createWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 900,
    height: 900,
    autoHideMenuBar: true,
    icon: path.join(__dirname, "../public/facebook-bot-logo.png"),
    webPreferences: {
      nodeIntegration: true,
      webSecurity: false,
      devTools: !app.isPackaged,
      contextIsolation: false,
    },
  });

  mainWindow.on("closed", () => (mainWindow = null));
  // and load the index.html of the app.
  mainWindow.loadURL(
    isDev
      ? "http://localhost:3000"
      : `file://${path.join(__dirname, "../build/index.html")}`
  );
  // Open the DevTools.
  isDev && mainWindow.webContents.openDevTools();
};
app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
