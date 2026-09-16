import { app, BrowserWindow, Menu, shell } from 'electron'
import path from 'node:path'
import { getDb, closeDb, purgeExpiredBinEntries } from './db/index'
import { registerIpc } from './ipc'
import { scheduleAutoBackup, stopAutoBackup } from './services/backup'
import { stop as stopExamServer } from './services/examServer'

// Pin the data-folder name explicitly. Electron otherwise derives it from
// whichever package.json it finds, so the school's database could land in a
// different folder in development than in the installed app. Must run before
// anything asks for `userData`.
app.setName('school-management-system')

process.env.APP_ROOT = path.join(__dirname, '..')
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL
const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    backgroundColor: '#f8fafc',
    title: 'School Management System',
    icon: path.join(process.env.APP_ROOT!, 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  mainWindow.once('ready-to-show', () => mainWindow?.show())

  // Links to the outside world open in the real browser, never inside the app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }

  mainWindow.on('closed', () => { mainWindow = null })
}

/**
 * A short, plain-language menu. Everything important is reachable from the
 * sidebar too — the menu bar is a convenience, never the only route.
 */
function buildMenu(): void {
  const isMac = process.platform === 'darwin'
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac ? [{ role: 'appMenu' as const }] : []),
    {
      label: 'File',
      submenu: [
        { role: 'close' as const },
        ...(isMac ? [] : [{ role: 'quit' as const }]),
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' as const }, { role: 'redo' as const }, { type: 'separator' as const },
        { role: 'cut' as const }, { role: 'copy' as const }, { role: 'paste' as const },
        { role: 'selectAll' as const },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' as const },
        { role: 'resetZoom' as const }, { role: 'zoomIn' as const }, { role: 'zoomOut' as const },
        { type: 'separator' as const }, { role: 'togglefullscreen' as const },
      ],
    },
    { role: 'windowMenu' as const },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

// Only one copy of the app may touch the database file at a time.
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(() => {
    getDb()
    try {
      purgeExpiredBinEntries(30)
    } catch (e) {
      console.error('Could not tidy the recycle bin:', e)
    }
    registerIpc()
    buildMenu()
    createWindow()
    scheduleAutoBackup()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  stopAutoBackup()
  // Never leave the exam server listening after the app is gone.
  stopExamServer()
  closeDb()
})
