import { contextBridge, ipcRenderer } from 'electron'

/**
 * The only bridge between the renderer and the database. The renderer has no
 * Node access at all — every read and write goes through a named action that
 * the main process validates.
 */
contextBridge.exposeInMainWorld('api', {
  call: (method: string, payload?: unknown) => ipcRenderer.invoke('api:call', method, payload),
  platform: process.platform,
})
