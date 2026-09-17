import { app, BrowserWindow, Menu, shell, dialog } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
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

/**
 * Where to write when something goes wrong before there is a window to say it
 * in. userData is the right place, but if that is the very thing that is
 * broken, the temp folder still works.
 */
function logPath(): string {
  try {
    return path.join(app.getPath('userData'), 'startup.log')
  } catch {
    return path.join(os.tmpdir(), 'school-system-startup.log')
  }
}

/** A breadcrumb trail, so a failure says how far it got rather than nothing. */
function note(line: string): void {
  try {
    fs.appendFileSync(logPath(), `${new Date().toISOString()}  ${line}\n`)
  } catch {
    /* logging must never be the thing that breaks startup */
  }
}

/**
 * Startup used to fail in total silence: `getDb()` threw, the promise was
 * never caught, and the user double-clicked the icon and got nothing at all —
 * no window, no error, nothing to report. Anything that stops the app opening
 * now says so on screen and writes the details to a file.
 */
function reportFatal(stage: string, error: unknown): void {
  const detail = error instanceof Error ? `${error.message}\n\n${error.stack ?? ''}` : String(error)
  note(`FAILED at ${stage}: ${detail}`)
  try {
    dialog.showErrorBox(
      'School System could not start',
      `Something went wrong while starting the program (${stage}).\n\n` +
        `${error instanceof Error ? error.message : String(error)}\n\n` +
        `Details were written to:\n${logPath()}\n\n` +
        `Try opening the program again. If it still will not start, your school's ` +
        `data is safe — it is in a separate file — and the most recent backup can be restored.`
    )
  } catch {
    /* nothing more we can do */
  }
  app.exit(1)
}

// A crash anywhere else in the main process gets the same treatment.
process.on('uncaughtException', (e) => reportFatal('running', e))
process.on('unhandledRejection', (e) => reportFatal('running', e))

/** The window icon, if it was packaged; undefined rather than a dead path. */
function windowIcon(): string | undefined {
  try {
    const file = path.join(process.env.APP_ROOT!, 'build', 'icon.png')
    return fs.existsSync(file) ? file : undefined
  } catch {
    return undefined
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    backgroundColor: '#f8fafc',
    title: 'School Management System',
    // Only pass an icon that is really there: a path into the package that
    // does not exist is worth neither a warning nor a risk at startup.
    ...(windowIcon() ? { icon: windowIcon()! } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  // The window is created hidden and shown when the page is ready, so nobody
  // watches it paint. That trade has a failure mode: if the page never becomes
  // ready, the window never appears and the program looks like it did nothing
  // at all. So the wait has a limit, and a load failure is reported rather
  // than swallowed.
  const reveal = () => {
    if (!mainWindow || mainWindow.isDestroyed() || mainWindow.isVisible()) return
    mainWindow.show()
  }
  mainWindow.once('ready-to-show', () => { note('page ready'); reveal() })
  const failsafe = setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      note('page was not ready in 10s - showing the window anyway')
      reveal()
    }
  }, 10_000)
  mainWindow.once('closed', () => clearTimeout(failsafe))

  mainWindow.webContents.on('did-fail-load', (_e, code, description, url) => {
    // -3 is an aborted load, which happens normally on redirects.
    if (code === -3) return
    note(`page failed to load (${code} ${description}) for ${url}`)
    reveal()
    dialog.showErrorBox(
      'School System could not open its screen',
      `The program started but its screen could not be loaded.\n\n${description} (${code})\n\n` +
        `This usually means some of the program's files did not unpack correctly. ` +
        `Delete the "School System" folder and run the installer again.\n\n` +
        `Your school's data is not in that folder and is not affected.`
    )
  })

  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    note(`renderer gone: ${details.reason}`)
  })

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
  // Another copy holds the database. Saying so beats quitting into silence —
  // on Windows a stuck earlier copy is otherwise indistinguishable from the
  // program simply not working.
  note('another instance already holds the lock; asking it to come forward')
  app.whenReady().then(() => {
    dialog.showErrorBox(
      'School System is already open',
      'Another copy of School System is already running on this computer.\n\n' +
        'Look for its window, or for its icon in the taskbar.\n\n' +
        'If you cannot find it, restart the computer and open the program again.'
    )
    app.exit(0)
  })
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(() => {
    // The window comes first. If the database is unopenable the user still
    // gets a window and a message, instead of an icon that does nothing.
    try {
      note(`starting - ${app.getVersion()} on ${process.platform} ${process.arch}`)
      buildMenu()
      createWindow()
      note('window created')
    } catch (e) {
      return reportFatal('opening the window', e)
    }

    try {
      getDb()
      note('database opened')
    } catch (e) {
      return reportFatal('opening the database', e)
    }

    try {
      purgeExpiredBinEntries(30)
    } catch (e) {
      note(`could not tidy the recycle bin: ${String(e)}`)
    }

    try {
      registerIpc()
      scheduleAutoBackup()
      note('ready')
    } catch (e) {
      return reportFatal('setting up', e)
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  }).catch((e) => reportFatal('starting', e))
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
