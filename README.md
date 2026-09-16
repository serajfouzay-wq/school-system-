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

Demo sign-in — five accounts, one per job:

| User | PIN | Role | What they can do |
|---|---|---|---|
| `owner` | `0000` | Owner | Everything, including creating other owners and loading demo data |
| `admin` | `1234` | Administrator | Everything day to day; cannot promote anyone to owner |
| `clerk` | `1111` | Registrar | Students, classes, attendance, timetable, transport, lending books |
| `accounts` | `2222` | Accountant | Fees and transport money |
| `nadia` | `3333` | Teacher | Attendance, grades, exams, lending books — read-only elsewhere |

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
    examServer.ts          The LAN web server phones connect to (exams + library)
    examStudentPage.ts     The page those phones load, as one self-contained file
    libraryPage.ts         The reading page, likewise
    whatsapp.ts            Message building, phone normalising, send log
    library.ts             Books, loans, fines
    transport.ts           Bus routes, drivers, riders, bus money
  ipc.ts                   Every action the renderer may call, by name,
                           each one mapped to the capability it requires
  main.ts / preload.ts     Window, menu, and the single contextBridge

shared/types.ts            Types used by both processes
shared/permissions.ts      Roles, capabilities, and who may act on whom

src/                       Renderer — React, no filesystem or database access
  i18n/                    en.json / ar.json (709 keys, generated in lockstep)
  lib/                     api client, formatting, printing, hooks
  store/app.ts             Zustand: session, language, preferences, toasts
  components/ui/           Button, Card, Field, Modal, DataTable, Wizard, …
  layouts/AppShell.tsx     Sidebar + global search
  features/                One folder per module
    setup/ auth/ dashboard/ students/ staff/ academics/
    attendance/ timetable/ grades/ exams/ fees/ communication/
    library/ transport/ reports/ settings/ recycle/ help/
  print/                   Report cards, receipts, ID cards, reports (HTML → PDF)
  assets/fonts/            Cairo, bundled so Arabic works with no internet
```

The renderer has **no Node access at all**. Every read and write goes through a
named action in `electron/ipc.ts`, which the main process validates. Photos are
handed back as data URLs rather than file paths.

Adding a table to `schema.sql` is enough; adding a **column** to an existing one
is too, because `CREATE TABLE IF NOT EXISTS` never updates a table that already
exists. `addMissingColumns()` in `db/index.ts` compares the schema with the file
on disk at every open and adds what is missing, so a school that has been
running since an earlier version is not left with a database the new code cannot
query.

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

## Who can do what

Roles used to be labels; they are now enforced. Every action the renderer can
call is mapped to a capability in `shared/permissions.ts`, and the main process
checks it before doing anything. The interface hides what you cannot do, but
hiding is only a courtesy — the check in the main process is what protects the
data, and it **fails closed**: an action nobody thought to map is owner-only
rather than open to everyone.

**The owner is the school's own account.** It outranks everything, and it is the
only role that can create another owner or touch the danger zone (loading demo
data, anything that rewrites the whole database). The first account made in the
setup wizard is the owner.

Nobody can act on an account that outranks them, and nobody can promote anyone
above themselves — which is what stops an administrator quietly making
themselves the owner. The last owner cannot be deleted, demoted or deactivated,
and nobody can delete their own account.

Before the first account exists the school is unclaimed and the setup wizard may
do what it needs to; the moment an owner exists, that closes for good. The
sign-in picker reads a deliberately minimal list (`auth.signInList`) — names and
roles, nothing else — because it has to work before anyone has signed in.

---

## The library

Two things under one roof:

- **Books to lend.** Copies, who has them, when they are due, and the fine if
  they come back late. The fine per day and the loan length live in Settings.
  A book cannot be deleted while copies are out, and one person cannot hold two
  copies of the same title.
- **Books to read on a phone.** Attach a PDF to a book and turn on *Share the
  library on the school Wi-Fi*, and students can open it on their own phones
  from inside the school — the same LAN server the exams use, so there is
  nothing extra to set up and still no internet involved. Sharing is off until
  someone turns it on.

## Transport

Bus routes with the driver's name (in both scripts), phone, helper, vehicle,
seats, morning and afternoon times, and the stops along the way. Students are
put on a route with their pickup point and whether they ride in the morning, the
afternoon, or both — the bus refuses a rider past its seat count, and refuses to
put a child on two buses at once.

Bus money is kept **apart from school fees**, so neither report can quietly
swallow the other. Each payment gets its own receipt number (`T-2026-00001`) and
prints a receipt on the spot; the list reprints one for a parent who lost theirs.
*Who has not paid* feeds straight into the WhatsApp queue, and the driver's sheet
— who gets on, where, and the guardian's number — prints for the bus itself.

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
- **SMS/email notifications are not built.** WhatsApp click-to-send covers the
  same need without an account or a per-message cost.
- **Exams are LAN-only by design.** Students must be on the school Wi-Fi.
  Taking exams from home would need a rented server, student accounts and a
  monthly cost, and would stop the app being offline-first.
- **Exam identity is by name, not password.** A student picks their name from
  the class list and types the join code. The teacher sees who has joined in
  real time and one attempt per student is enforced, which suits a supervised
  room. Unsupervised exams would need per-student credentials.
