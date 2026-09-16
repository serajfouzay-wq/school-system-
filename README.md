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
    exams.ts               Exam papers, auto-marking, results into Grades
    examServer.ts          The LAN web server students' phones connect to
    examStudentPage.ts     The page those phones load, as one self-contained file
    whatsapp.ts            Message building, phone normalising, send log
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
    attendance/ timetable/ grades/ exams/ fees/ communication/
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

## Online exams over the school Wi-Fi

The office computer *is* the server. When a teacher presses **Start the exam**,
the app opens a small HTTP server on the local network and shows a six-character
join code, the address, and a QR code to put on the projector. Students open
that address on their own phones, pick their name from the class list, type the
code, and answer. Nothing leaves the building and no internet is involved.

Marking is automatic for multiple-choice and true/false. A typed answer is
matched against the alternatives the teacher listed (`65|sixty five`), after
normalising case, spacing and the usual Arabic variations — أ/إ/آ, ة/ه, ى/ي and
diacritics. **A typed answer that does not match is flagged for the teacher, not
marked wrong**, because spelling and phrasing vary and a machine should not fail
a child over it. Finished results go into the normal Grades table, so an online
exam reaches the report card exactly like a paper one.

What the server deliberately does not do: it never sends a correct answer to a
phone (the paper is stripped before it leaves), it refuses a second attempt by
the same student, it only answers the handful of requests an exam needs, and it
shuts down with the app.

## WhatsApp to parents

There is no WhatsApp account, API key or approval to arrange. The app builds the
message — fee reminder, absent today, report card ready, or your own text — and
opens WhatsApp with the parent's number and the text already filled in. Staff
press send in WhatsApp itself.

This is a deliberate choice. Sending automatically needs a Meta Business account
with pre-approved templates and a per-message charge; the unofficial libraries
that drive WhatsApp Web in the background break WhatsApp's terms and get school
numbers banned. The click-to-send route costs nothing and works today.

The tedious part — knowing who still needs contacting — is what the app handles:
a queue for everyone who owes fees or was absent, a tick against each one as it
goes, and a log so nobody is messaged twice. Local numbers (`0912345678`) are
converted to international form using the country code in Settings.

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
- **SMS/email notifications are not built.** WhatsApp click-to-send covers the
  same need without an account or a per-message cost.
- **Exams are LAN-only by design.** Students must be on the school Wi-Fi.
  Taking exams from home would need a rented server, student accounts and a
  monthly cost, and would stop the app being offline-first.
- **Exam identity is by name, not password.** A student picks their name from
  the class list and types the join code. The teacher sees who has joined in
  real time and one attempt per student is enforced, which suits a supervised
  room. Unsupervised exams would need per-student credentials.
