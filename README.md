# School Management System

An offline-first desktop application for running a school day to day — students,
teachers, classes, attendance, timetables, grades, report cards and fees — built
to be usable by people who are not comfortable with computers.

Fully bilingual: **English and العربية**, with real right-to-left layout (the
whole interface mirrors, not just the words).

---

## Getting started

```bash
npm install     # also rebuilds better-sqlite3 for Electron
npm run dev     # start the app in development
```

On first launch you get a setup wizard. If you would rather look around first,
the wizard's first step offers **"Try it with example data"**, which fills the
system with a fictional school (roughly 180 students across 5 grades, with
attendance, grades, fees and timetables already in place).

Demo sign-in: user `admin`, PIN `1234`.

### Building installers

```bash
npm run build       # typecheck + bundle
npm run dist:win    # .exe   (NSIS installer)
npm run dist:mac    # .dmg
npm run dist:linux  # .AppImage and .deb
npm run pack:dir    # unpacked build, for a quick local check
```

**Build Windows on Windows.** The GitHub Actions workflow in
`.github/workflows/build-windows.yml` does this: run it from the Actions tab,
or push a `v*` tag to get a Release with the installer attached. It compiles
`better-sqlite3` natively and stamps the icon into the `.exe`.

Cross-building for Windows *from Linux* does work, with two compromises worth
knowing about:

- `@electron/rebuild` cannot compile `better-sqlite3` for Windows on a Linux
  host and silently leaves the **Linux** binary in the package — an installer
  that crashes the moment it opens the database. `build/after-pack.cjs`
  detects this, substitutes the official prebuilt Windows binary, and fails
  the build rather than let a broken package out.
- Stamping the icon and version into the `.exe` runs `rcedit` under wine, so
  `win.signAndEditExecutable` is off in the committed config. The app works;
  it just wears the stock Electron icon. The Actions workflow overrides this
  back to `true`.

The Linux build was verified end to end here: the packaged binary launches and
creates its database with `better-sqlite3` loaded from outside the asar.

---

## Where the data lives

Everything is in **one SQLite file** in the user's app-data folder:

| Platform | Path |
|---|---|
| Windows | `%APPDATA%\school-management-system\school_data.db` |
| macOS | `~/Library/Application Support/school-management-system/school_data.db` |
| Linux | `~/.config/school-management-system/school_data.db` |

Backing up the school means copying that one file — and Settings → Backup does
it for you, including "save a copy to a USB stick".

Photos, logos and attached documents live next to it in `files/`, and automatic
backups in `backups/`.

---

## How it is put together

```
electron/                  Main process — owns the database, nothing else can touch it
  db/
    schema.sql             All tables; inlined into the bundle at build time
    index.ts               Connection, PIN hashing, soft-delete + recycle bin
    seed.ts                The fictional demo school
  services/                One module per domain, plain functions over SQLite
    school.ts  users.ts  academics.ts  students.ts  staff.ts
    attendance.ts  grades.ts  fees.ts  timetable.ts
    communication.ts  dashboard.ts  recycle.ts  backup.ts  exporter.ts
  ipc.ts                   Every action the renderer may call, by name
  main.ts / preload.ts     Window, menu, and the single contextBridge

shared/types.ts            Types used by both processes

src/                       Renderer — React, no filesystem or database access
  i18n/                    en.json / ar.json (511 keys, generated in lockstep)
  lib/                     api client, formatting, printing, hooks
  store/app.ts             Zustand: session, language, preferences, toasts
  components/ui/           Button, Card, Field, Modal, DataTable, Wizard, …
  layouts/AppShell.tsx     Sidebar + global search
  features/                One folder per module
    setup/ auth/ dashboard/ students/ staff/ academics/
    attendance/ timetable/ grades/ fees/ communication/
    reports/ settings/ recycle/ help/
  print/                   Report cards, receipts, ID cards, reports (HTML → PDF)
  assets/fonts/            Cairo, bundled so Arabic works with no internet
```

The renderer has **no Node access at all**. Every read and write goes through a
named action in `electron/ipc.ts`, which the main process validates. Photos are
handed back as data URLs rather than file paths.

---

## Design rules the code actually enforces

These are the constraints from the brief, and where they live:

| Rule | Where |
|---|---|
| Wizards, not giant forms | `components/ui/Wizard.tsx`; add-student is 4 steps, setup is 6 |
| Nothing is ever truly lost | `db/index.ts` `softDelete()` → Recycle Bin, 30-day window |
| Undo after every action | `store/app.ts` toasts carry an action; delete flows pass one |
| Big text, big targets | `min-h-touch` (44px) on every control; 16px base font |
| Colour is never the only signal | `StatusPill` and the attendance calendar pair colour with an icon and a word |
| Search everywhere | One box in the header → `dashboard.globalSearch` across students, staff, receipts, classes |
| Works offline | No network calls anywhere; fonts bundled; SQLite embedded |
| Print-friendly | `usePrinting()` + `print/templates.ts`; every list exports to CSV and prints |
| Helpful empty states | `EmptyState` on every list, each with the action that fills it |
| Guided first use | `ModuleTour` per module, plus an offline Help page |

### Right-to-left

Switching language sets `document.dir`, and that is the entire mechanism —
components use CSS **logical properties** (`ms-`/`me-`, `ps-`/`pe-`,
`text-start`/`text-end`, `border-e`) rather than left/right, so the sidebar,
tables, forms and modals all mirror on their own. Icons that imply direction
carry `.flip-rtl`.

Arabic text is stored in dedicated `*_ar` columns alongside the Latin ones, so a
student can be searched and sorted in either script, and printed documents pick
the right one per language.

---

## Notes for whoever picks this up next

- **`build/icon.png` is a placeholder.** Replace it with real branding before
  shipping. electron-builder generates the Windows `.ico` and macOS `.icns`
  from it, so one 512x512 PNG is all you need to swap.
- **Auto-update is configured but not pointed anywhere.** `electron-builder.yml`
  has a `publish` block with a placeholder URL; set a real one and wire
  `electron-updater` in `main.ts` when you have somewhere to publish to.
- **Excel export is CSV** (with a UTF-8 BOM so Arabic opens correctly in Excel).
  A true `.xlsx` writer would need a library.
- **Library and Transport modules are not built** — they were scoped as
  post-v1 in the brief.
- **SMS/email notifications are not built.** They are the only feature in the
  brief that needs the internet, and were marked optional.
