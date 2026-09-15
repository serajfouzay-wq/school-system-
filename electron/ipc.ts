import { ipcMain, dialog, BrowserWindow, shell, app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import * as school from './services/school'
import * as users from './services/users'
import * as academics from './services/academics'
import * as students from './services/students'
import * as staff from './services/staff'
import * as attendance from './services/attendance'
import * as grades from './services/grades'
import * as fees from './services/fees'
import * as timetable from './services/timetable'
import * as communication from './services/communication'
import * as dashboard from './services/dashboard'
import * as recycle from './services/recycle'
import * as backup from './services/backup'
import { parseCsv, writeCsv } from './services/exporter'
import { seedDemoData, isSeeded } from './db/seed'
import { getDb } from './db/index'

/** The signed-in user, tracked in the main process so services can stamp
 *  "who did this" onto records without the renderer being able to spoof it. */
let currentUserId: number | null = null

type Handler = (payload: any) => unknown | Promise<unknown>

function printableWindow(html: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const win = new BrowserWindow({
      show: false,
      webPreferences: { offscreen: true, sandbox: false },
    })
    const cleanup = () => { if (!win.isDestroyed()) win.destroy() }
    win.webContents.once('did-finish-load', async () => {
      try {
        // Give webfonts a moment so Arabic shapes correctly in the PDF.
        await new Promise((r) => setTimeout(r, 400))
        const pdf = await win.webContents.printToPDF({
          printBackground: true,
          margins: { top: 0, bottom: 0, left: 0, right: 0 },
          pageSize: 'A4',
        })
        resolve(pdf)
      } catch (e) {
        reject(e)
      } finally {
        cleanup()
      }
    })
    win.webContents.once('did-fail-load', (_e, _c, desc) => { cleanup(); reject(new Error(desc)) })
    win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
  })
}

const handlers: Record<string, Handler> = {
  /* ---- session ---- */
  'session.setUser': ({ userId }) => { currentUserId = userId ?? null; return true },
  'session.currentUser': () => (currentUserId ? users.getUser(currentUserId) : null),

  /* ---- school & setup ---- */
  'school.get': () => school.getSchool(),
  'school.save': (p) => school.saveSchool(p),
  'school.isSetupComplete': () => school.isSetupComplete(),
  'school.preferences': () => school.getPreferences(),
  'school.setPreference': ({ key, value }) => { school.setPreference(key, value); return true },

  /* ---- users & auth ---- */
  'users.list': (p) => users.listUsers(p?.includeInactive ?? true),
  'users.count': () => users.countUsers(),
  'users.create': (p) => users.createUser(p),
  'users.update': ({ id, ...patch }) => users.updateUser(id, patch),
  'users.delete': ({ id }) => { users.deleteUser(id, currentUserId); return true },
  'auth.login': ({ username, pin }) => {
    const u = users.login(username, pin)
    currentUserId = u.id
    return u
  },
  'auth.logout': () => { currentUserId = null; return true },
  'auth.securityQuestion': ({ username }) => users.getSecurityQuestion(username),
  'auth.resetPin': ({ username, answer, newPin }) => users.resetPinWithAnswer(username, answer, newPin),

  /* ---- academics ---- */
  'classes.list': () => academics.listClasses(),
  'classes.save': (p) => academics.saveClass(p),
  'classes.delete': ({ id }) => { academics.deleteClass(id, currentUserId); return true },
  'sections.list': (p) => academics.listSections(p?.classId),
  'sections.save': (p) => academics.saveSection(p),
  'sections.delete': ({ id }) => { academics.deleteSection(id, currentUserId); return true },
  'subjects.list': () => academics.listSubjects(),
  'subjects.save': (p) => academics.saveSubject(p),
  'subjects.delete': ({ id }) => { academics.deleteSubject(id, currentUserId); return true },
  'terms.list': () => academics.listExamTerms(),
  'terms.save': (p) => academics.saveExamTerm(p),
  'terms.delete': ({ id }) => { academics.deleteExamTerm(id, currentUserId); return true },
  'assignments.list': (p) => academics.listAssignments(p),
  'assignments.save': (p) => { academics.saveAssignment(p); return true },
  'assignments.delete': ({ id }) => { academics.deleteAssignment(id, currentUserId); return true },

  /* ---- students ---- */
  'students.list': (p) => students.listStudents(p ?? {}),
  'students.get': ({ id }) => students.getStudent(id),
  'students.save': (p) => students.saveStudent(p),
  'students.delete': ({ id }) => { students.deleteStudent(id, currentUserId); return true },
  'students.setStatus': ({ id, status }) => students.setStudentStatus(id, status),
  'students.move': ({ ids, sectionId }) => students.moveStudents(ids, sectionId),
  'students.profile': ({ id }) => students.getStudentProfile(id),
  'students.nextCode': () => students.nextStudentCode(),
  'students.addNote': ({ studentId, body }) => { students.addStudentNote(studentId, body, currentUserId); return true },
  'students.deleteNote': ({ id }) => { students.deleteStudentNote(id, currentUserId); return true },
  'students.addDocument': ({ studentId, title, sourcePath }) => { students.addStudentDocument(studentId, title, sourcePath); return true },
  'students.deleteDocument': ({ id }) => { students.deleteStudentDocument(id, currentUserId); return true },
  'students.import': ({ rows, mapping, sectionId }) => students.importStudents(rows, mapping, sectionId ?? null),

  /* ---- staff ---- */
  'staff.list': (p) => staff.listStaff(p ?? {}),
  'staff.get': ({ id }) => staff.getStaff(id),
  'staff.save': (p) => staff.saveStaff(p),
  'staff.delete': ({ id }) => { staff.deleteStaff(id, currentUserId); return true },

  /* ---- attendance ---- */
  'attendance.section': ({ sectionId, date }) => attendance.getSectionAttendance(sectionId, date),
  'attendance.save': ({ date, marks }) => attendance.saveAttendance(date, marks, currentUserId),
  'attendance.studentMonth': ({ studentId, month }) => attendance.getStudentAttendanceMonth(studentId, month),
  'attendance.sectionMonth': ({ sectionId, month }) => attendance.getSectionAttendanceMonth(sectionId, month),
  'attendance.report': (p) => attendance.attendanceReport(p),
  'attendance.staffDay': ({ date }) => attendance.getStaffAttendance(date),
  'attendance.saveStaff': ({ date, marks }) => attendance.saveStaffAttendance(date, marks, currentUserId),

  /* ---- grades ---- */
  'grades.grid': ({ sectionId, termId }) => grades.getGradeGrid(sectionId, termId),
  'grades.save': ({ termId, entries }) => grades.saveGrades(termId, entries),
  'grades.subjectsForSection': ({ sectionId }) => grades.subjectsForSection(sectionId),
  'grades.reportCard': ({ studentId, termId }) => grades.getReportCard(studentId, termId),
  'grades.saveRemarks': ({ studentId, termId, remarks }) => { grades.saveTeacherRemarks(studentId, termId, remarks); return true },

  /* ---- fees ---- */
  'fees.structures': (p) => fees.listFeeStructures(p?.classId),
  'fees.saveStructure': (p) => { fees.saveFeeStructure(p); return true },
  'fees.deleteStructure': ({ id }) => { fees.deleteFeeStructure(id, currentUserId); return true },
  'fees.payments': (p) => fees.listPayments(p ?? {}),
  'fees.recordPayment': (p) => fees.recordPayment(p, currentUserId),
  'fees.deletePayment': ({ id }) => { fees.deletePayment(id, currentUserId); return true },
  'fees.balances': (p) => fees.feeBalances(p ?? {}),
  'fees.studentSummary': ({ studentId }) => fees.studentFeeSummary(studentId),
  'fees.receipt': ({ paymentId }) => fees.getReceipt(paymentId),
  'fees.summary': () => fees.financialSummary(),

  /* ---- timetable ---- */
  'timetable.list': (p) => timetable.listTimetable(p ?? {}),
  'timetable.save': (p) => timetable.saveTimetableEntry(p),
  'timetable.delete': ({ id }) => { timetable.deleteTimetableEntry(id, currentUserId); return true },
  'timetable.conflicts': (p) => timetable.findConflicts(p),
  'timetable.periods': () => timetable.defaultPeriods(),

  /* ---- announcements & calendar ---- */
  'announcements.list': (p) => communication.listAnnouncements(p?.limit ?? 50),
  'announcements.save': (p) => { communication.saveAnnouncement(p, currentUserId); return true },
  'announcements.delete': ({ id }) => { communication.deleteAnnouncement(id, currentUserId); return true },
  'events.list': (p) => communication.listEvents(p ?? {}),
  'events.save': (p) => { communication.saveEvent(p); return true },
  'events.delete': ({ id }) => { communication.deleteEvent(id, currentUserId); return true },

  /* ---- dashboard & search ---- */
  'dashboard.summary': () => dashboard.dashboardSummary(),
  'search.global': ({ query }) => dashboard.globalSearch(query),

  /* ---- recycle bin ---- */
  'recycle.list': () => recycle.listRecycleBin(),
  'recycle.restore': ({ id }) => { recycle.restore(id); return true },
  'recycle.purgeExpired': () => recycle.purgeExpired(),

  /* ---- backup ---- */
  'backup.create': async ({ triggeredBy }) => backup.createBackup(triggeredBy ?? 'manual'),
  'backup.list': () => backup.listBackups(),
  'backup.restore': ({ file }) => backup.restoreBackup(file),
  'backup.status': () => ({
    lastBackupAt: backup.lastBackupAt(),
    autoEnabled: backup.isAutoBackupEnabled(),
    folder: backup.dataFolder(),
  }),
  'backup.setAuto': ({ enabled }) => { backup.setAutoBackup(enabled); return true },
  'backup.chooseAndCopy': async () => {
    const res = await dialog.showSaveDialog({
      title: 'Save a copy of the school data',
      defaultPath: `school-backup-${new Date().toISOString().slice(0, 10)}.db`,
      filters: [{ name: 'School backup', extensions: ['db'] }],
    })
    if (res.canceled || !res.filePath) return null
    const d = getDb()
    await d.backup(res.filePath)
    return res.filePath
  },
  'backup.chooseAndRestore': async () => {
    const res = await dialog.showOpenDialog({
      title: 'Choose a backup file to restore',
      properties: ['openFile'],
      filters: [{ name: 'School backup', extensions: ['db'] }],
    })
    if (res.canceled || !res.filePaths[0]) return null
    return backup.restoreBackup(res.filePaths[0])
  },

  /* ---- demo data ---- */
  'demo.isSeeded': () => isSeeded(),
  'demo.seed': () => { seedDemoData(); return true },

  /* ---- files ---- */
  'files.pickImage': async () => {
    const res = await dialog.showOpenDialog({
      title: 'Choose a picture',
      properties: ['openFile'],
      filters: [{ name: 'Pictures', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] }],
    })
    return res.canceled ? null : res.filePaths[0]
  },
  'files.pickAny': async () => {
    const res = await dialog.showOpenDialog({ title: 'Choose a file', properties: ['openFile'] })
    return res.canceled ? null : res.filePaths[0]
  },
  'files.pickCsv': async () => {
    const res = await dialog.showOpenDialog({
      title: 'Choose a spreadsheet file',
      properties: ['openFile'],
      filters: [{ name: 'Spreadsheet', extensions: ['csv', 'txt'] }],
    })
    if (res.canceled || !res.filePaths[0]) return null
    const text = fs.readFileSync(res.filePaths[0], 'utf8')
    return { path: res.filePaths[0], rows: parseCsv(text) }
  },
  'files.saveStudentPhoto': ({ sourcePath, studentCode }) => students.saveStudentPhoto(sourcePath, studentCode),
  'files.saveStaffPhoto': ({ sourcePath, staffCode }) => staff.saveStaffPhoto(sourcePath, staffCode),
  'files.saveLogo': ({ sourcePath }) => {
    const dir = path.join(app.getPath('userData'), 'files')
    fs.mkdirSync(dir, { recursive: true })
    const dest = path.join(dir, `logo${path.extname(sourcePath) || '.png'}`)
    fs.copyFileSync(sourcePath, dest)
    return dest
  },
  /** Read an image as a data URL — the renderer has no filesystem access. */
  'files.readImage': ({ filePath }) => {
    try {
      if (!filePath || !fs.existsSync(filePath)) return null
      const ext = path.extname(filePath).slice(1).toLowerCase() || 'png'
      const mime = ext === 'jpg' ? 'jpeg' : ext
      return `data:image/${mime};base64,${fs.readFileSync(filePath).toString('base64')}`
    } catch {
      return null
    }
  },
  'files.openFolder': ({ folder }) => { shell.openPath(folder); return true },
  'files.showItem': ({ filePath }) => { shell.showItemInFolder(filePath); return true },

  /* ---- export & print ---- */
  'export.csv': async ({ suggestedName, columns, rows }) => {
    const res = await dialog.showSaveDialog({
      title: 'Save as a spreadsheet file',
      defaultPath: suggestedName ?? 'export.csv',
      filters: [{ name: 'Spreadsheet (CSV)', extensions: ['csv'] }],
    })
    if (res.canceled || !res.filePath) return null
    return writeCsv(res.filePath, columns, rows)
  },
  'print.html': async ({ html }) => {
    const win = new BrowserWindow({ show: false, webPreferences: { sandbox: false } })
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
    await new Promise((r) => setTimeout(r, 400))
    return new Promise((resolve) => {
      win.webContents.print({ silent: false, printBackground: true }, (success, reason) => {
        if (!win.isDestroyed()) win.destroy()
        resolve({ success, reason })
      })
    })
  },
  'print.pdf': async ({ html, suggestedName }) => {
    const res = await dialog.showSaveDialog({
      title: 'Save as PDF',
      defaultPath: suggestedName ?? 'document.pdf',
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    })
    if (res.canceled || !res.filePath) return null
    const pdf = await printableWindow(html)
    fs.writeFileSync(res.filePath, pdf)
    return res.filePath
  },

  /* ---- app ---- */
  'app.version': () => app.getVersion(),
  'app.dataFolder': () => app.getPath('userData'),
}

export function registerIpc(): void {
  ipcMain.handle('api:call', async (_event, method: string, payload: unknown) => {
    const handler = handlers[method]
    if (!handler) return { ok: false, error: `Unknown action: ${method}` }
    try {
      const data = await handler(payload ?? {})
      return { ok: true, data }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      console.error(`[api] ${method} failed:`, message)
      return { ok: false, error: message }
    }
  })
}

export type ApiMethod = keyof typeof handlers
